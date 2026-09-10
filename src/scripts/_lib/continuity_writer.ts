/**
 * The deterministic continuity-record writer.
 *
 * `road-to-continuity-writer-activation` step 1.2. Until this module existed
 * `agent-config session:recycle` was the ONLY writer of the continuity record
 * in the tree, which is why `verb:session:recycle` counts on the
 * `public_continuity_commands` axis and why an advisory had to tell a human to
 * run it before `/clear`: continuity did not happen unless somebody
 * remembered. Since step 3.2 (2026-09-10) this module is armed by default and
 * that advisory is gone; the verb is retained as an explicit affordance, not
 * as the normal path.
 *
 * Every field here is computed from on-disk state and nothing is asked of a
 * model. That is not a cost optimisation, it is what makes the record a
 * `continuity_record` rather than a `main_session` one: the judgement fields
 * (`decisions`, `failed_approaches`, `successful_approaches`, …) are FORBIDDEN
 * on the variant precisely so a deterministic writer cannot fill one with a
 * guess and a reader cannot be left unable to tell a derived record from a
 * judged one.
 *
 * Two gates, and both are needed:
 *
 *   1. `continuity.auto_record` must be `on`. It ships `on` since 2026-09-10
 *      (step 3.2, AI council under the owner's written delegation); before
 *      that it shipped `off` and this module was never reached on a default
 *      install. The switch still exists and still fails CLOSED, so an
 *      unreadable settings cascade disarms the producer rather than arming it.
 *   2. The session must be SUBSTANTIVE by the committed floor
 *      (`is_substantive`) and must have a resolvable task. Both come from the
 *      concern's own counters and claim state, never from file presence.
 *
 * The task gate is the sharper of the two, and its bound is stated rather than
 * hidden: a record needs at least one `acceptance_criteria` entry, and the only
 * deterministic source of one in this tree is the roadmap a session has
 * claimed. A session with no claim therefore leaves no record — and the
 * alternative, writing a placeholder acceptance criterion, would assert a
 * definition of "done" nobody set, which is the exact failure the variant's
 * forbidden-key set exists to prevent.
 */
import * as fs from 'node:fs';

import { load_agent_settings, settings_layer_states } from './agent_settings.js';
import { resolvePredecessor } from './recycle_envelope_paths.js';
import { CHECKBOX_LINE, phaseLines } from './roadmap_checkboxes.js';
import { readHead, roadmapPath } from './run_checkpoint.js';
import { is_substantive, type StoredEolCounters } from './session_eol.js';
import { CAPSULE_SCHEMA_VERSION, MAX_ENTRIES, MAX_LINE_CHARS } from './subagent_capsule.js';

/** Settings key that arms this writer. Ships `on` since 2026-09-10 (step 3.2). */
export const AUTO_RECORD_KEY = 'continuity.auto_record';

/**
 * Read `continuity.auto_record` from the merged settings cascade.
 *
 * The cascade merges the shipped template, so a workspace with no settings file
 * resolves the TEMPLATE's value. That is what the 2026-09-10 flip acts on:
 * changing the template to `on` arms a default install.
 *
 * FAIL-CLOSED, AND IT IS NOW CARRIED BY CODE RATHER THAN BY THE DEFAULT.
 *
 * This function is documented — here, in `docs/contracts/continuity-rollback.md`
 * and in step 1.4 of its roadmap — as failing closed: a settings cascade the
 * user has broken must leave the producer disarmed. Until 2026-09-10 that
 * property was carried by the TEMPLATE saying `off`, not by the `catch` below:
 * measured, `load_agent_settings` does not throw on a malformed
 * `.agent-settings.yml`; it skips the layer and returns the template's value.
 * So the catch never ran for that case, and the flip to `on` removed the
 * property outright — found by the fixture that was written to pin it.
 *
 * The repair is the property, not the wording. An AI council of 2026-09-10
 * (2 seats, convergent, under the owner's written delegation) ruled option (A):
 * openai — *"The defective implementation is grounds to repair the protection,
 * not authority to repeal it."* Both seats classified the alternative (flipping
 * the documented polarity to fail-open, matching `run_checkpoints_enabled`) as
 * a WEAKENING of a class-C `consent` protection and therefore owner-reserved,
 * not council-decidable, even done openly.
 *
 * So the malformed case is now decided by `settings_layer_states`, which
 * reports per-layer validity instead of letting a resolved value stand in for
 * it. The `catch` stays as the last resort for a genuine throw, and it is no
 * longer the thing the claim rests on.
 *
 * The diagnostic is a required ATTEMPT with non-guaranteed delivery, which is
 * the strongest promise this path can honestly make: the Stop slot never blocks
 * and the dispatcher does not forward a concern's stderr on every host, so a
 * line written here may reach nobody. Saying "warns you" would be the same
 * class of claim this whole comment exists to correct.
 */
export function auto_record_enabled(root: string): boolean {
    try {
        // Fail-closed on a layer the USER can break, before the value is read.
        // Order matters: reading first and checking second would let a valid
        // template value decide a case in which the user's own file is broken.
        const broken = settings_layer_states({ cwd: root }).filter((l) => l.state === 'malformed');
        if (broken.length > 0) {
            try {
                process.stderr.write(
                    `continuity: ${AUTO_RECORD_KEY} disabled for this invocation — ` +
                        `unreadable or malformed settings layer(s): ` +
                        `${broken.map((l) => l.path).join(', ')}. ` +
                        `Validate the file; the shipped default cannot be trusted while a layer above it is broken.\n`,
                );
            } catch {
                // a diagnostic that cannot be written must not change the verdict
            }
            return false;
        }
        const settings = load_agent_settings({ cwd: root });
        const section = settings['continuity'];
        if (section && typeof section === 'object' && !Array.isArray(section)) {
            const v = (section as Record<string, unknown>)['auto_record'];
            // YAML 1.1 parses a bare `on` as boolean true — accept both.
            return v === 'on' || v === true;
        }
    } catch {
        // last resort: a genuine throw leaves the writer disarmed
    }
    return false;
}

/** Settings key that governs run-checkpoint production. Ships `on`. */
export const RUN_CHECKPOINTS_KEY = 'continuity.run_checkpoints';

/**
 * Read `continuity.run_checkpoints` from the merged settings cascade.
 *
 * Fails OPEN, unlike its sibling above, and the asymmetry is the point: this
 * switch governs behaviour the tree already had, so an unreadable cascade must
 * leave it running. Its sibling arms something new, so an unreadable cascade
 * must leave that disarmed. A single helper with one polarity would have been
 * wrong for one of the two.
 *
 * ONE HONEST QUALIFICATION, from the 2026-09-10 audit of its sibling. This
 * function's `catch` is unreachable for a malformed settings file too — the
 * loader skips a broken layer instead of throwing. Its fail-OPEN claim is true
 * anyway, because the template says `on` and a malformed layer therefore
 * resolves to `on`. So the polarity holds while the shipped default happens to
 * agree with it, which is exactly the accident that broke the sibling when its
 * default flipped. It is left as it is deliberately: the behaviour is correct
 * today, and hardening a reader whose claim is currently true is a change with
 * no observable effect. If this key's default ever moves to `off`, this comment
 * is the notice that the claim moves with it.
 */
export function run_checkpoints_enabled(root: string): boolean {
    try {
        const settings = load_agent_settings({ cwd: root });
        const section = settings['continuity'];
        if (section && typeof section === 'object' && !Array.isArray(section)) {
            const v = (section as Record<string, unknown>)['run_checkpoints'];
            if (v === 'off' || v === false) return false;
        }
    } catch {
        // fail-open: an unreadable cascade never silently removes a recovery aid
    }
    return true;
}

/** Why no record was built, when none was. Always a stated reason. */
export interface WriterDecision {
    record: Record<string, unknown> | null;
    reason: string;
}

/** How many `remaining` / `acceptance_criteria` lines a record carries. */
const LIST_CAP = 12;

function _clip(line: string): string {
    const one = line.replace(/\s+/g, ' ').trim();
    return one.length <= MAX_LINE_CHARS ? one : `${one.slice(0, MAX_LINE_CHARS - 1)}…`;
}

/**
 * Open, closed and parked step counts plus the open step bodies.
 *
 * Deliberately reuses `phaseLines` + `CHECKBOX_LINE` rather than a fourth
 * regex: a writer that disagreed with the dashboard about whether a roadmap is
 * finished would put that disagreement into the record a successor resumes
 * from.
 */
export function roadmapShape(text: string): { done: number; total: number; open: string[] } {
    let done = 0;
    let total = 0;
    const open: string[] = [];
    for (const raw of phaseLines(text)) {
        const m = CHECKBOX_LINE.exec(raw);
        if (m === null) continue;
        total += 1;
        const mark = m[1];
        if (mark === 'x' || mark === 'X') {
            done += 1;
            continue;
        }
        if (mark === '~' || mark === '-') continue;
        if (open.length < LIST_CAP) {
            open.push(_clip((m[2] ?? '').replace(/\*\*/g, '')));
        }
    }
    return { done, total, open };
}

/**
 * Checkbox bodies under an `## Acceptance Criteria` heading.
 *
 * `phaseLines` deliberately excludes this section — an autonomous run must not
 * mistake an acceptance criterion for its next step — so it is read separately
 * here, which is the one place the two readings legitimately differ.
 */
export function acceptanceCriteria(text: string): string[] {
    const lines = text.split('\n');
    const out: string[] = [];
    let inside = false;
    for (const raw of lines) {
        const heading = /^(#{2,3})[ \t]+(.*?)[ \t]*$/.exec(raw);
        if (heading !== null) {
            inside = /^Acceptance[ \t]+Criteria\b/i.test(heading[2] ?? '');
            continue;
        }
        if (!inside) continue;
        const m = CHECKBOX_LINE.exec(raw);
        if (m === null) continue;
        if (out.length < LIST_CAP) {
            out.push(_clip((m[2] ?? '').replace(/\*\*/g, '')));
        }
    }
    return out;
}

export interface BuildInput {
    /** Workspace root — the record's `workspace`, and the root every read is relative to. */
    root: string;
    /** Raw session id, as the record paths and the claim state key on it. */
    sessionId: string;
    /** The roadmap slug this session claimed, or `null` when it claimed none. */
    slug: string | null;
    /** The concern's own counters for this session. */
    counters: StoredEolCounters | null;
    /** Injected for determinism in tests. */
    now?: Date;
}

/**
 * Build the record, or say why there is none.
 *
 * Never throws and never shells out: this runs on the Stop path, where a
 * subprocess is a latency cost paid on every turn's end and an exception is
 * worse than a missing record. `head` is read from `.git` directly (worktree
 * aware) rather than through `git`, and the richer anchor fields
 * `session:recycle` collects with `git status` are deliberately omitted — the
 * trade is one drift line for a Stop path that spawns nothing, and it is stated
 * in `docs/contracts/continuity-record-slot.md` rather than left for a reader
 * to discover by diffing two producers.
 */
export function buildContinuityRecord(input: BuildInput): WriterDecision {
    const { root, sessionId, slug, counters } = input;
    const now = input.now ?? new Date();

    if (!is_substantive(counters)) {
        return {
            record: null,
            reason: 'no record — the session is not substantive by the committed floor',
        };
    }
    if (slug === null || slug.trim() === '') {
        return {
            record: null,
            reason: 'no record — no claimed roadmap, so no deterministic acceptance criterion exists',
        };
    }

    let text: string;
    try {
        text = fs.readFileSync(roadmapPath(root, slug), 'utf-8');
    } catch {
        return { record: null, reason: `no record — the claimed roadmap ${slug} is not readable` };
    }

    const shape = roadmapShape(text);
    if (shape.total === 0) {
        return { record: null, reason: `no record — ${slug} carries no phase checkboxes to count` };
    }

    const declared = acceptanceCriteria(text);
    const criteria =
        declared.length > 0
            ? declared
            : // A roadmap with no declared criteria still has one definitional
              // completion condition, and it is derived from the artefact class
              // rather than judged: every step closed. Anything richer would be
              // a definition of done nobody wrote.
              [`every phase step in agents/roadmaps/${slug}.md is closed`];

    const record: Record<string, unknown> = {
        capsule_version: CAPSULE_SCHEMA_VERSION,
        variant: 'continuity_record',
        summary: _clip(`${slug}: ${shape.done} of ${shape.total} steps closed`),
        task: _clip(slug),
        workspace: root,
        written_at: now.toISOString(),
        acceptance_criteria: criteria.slice(0, MAX_ENTRIES),
        remaining: shape.open.slice(0, MAX_ENTRIES),
        predecessor: resolvePredecessor(root, sessionId),
        artifact_paths: [`agents/roadmaps/${slug}.md`],
    };
    if (sessionId.trim() !== '') {
        record['session_id'] = sessionId.trim();
    }
    const head = readHead(root);
    if (head !== null) {
        record['head'] = head;
    }
    return { record, reason: `record built for ${slug} (${shape.done}/${shape.total} closed)` };
}
