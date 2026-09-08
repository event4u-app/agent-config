/**
 * The deterministic continuity-record writer.
 *
 * `road-to-continuity-writer-activation` step 1.2. Until this module existed
 * `agent-config session:recycle` was the ONLY writer of the continuity record
 * in the tree, which is why `verb:session:recycle` counts on the
 * `public_continuity_commands` axis and why an advisory has to tell a human to
 * run it before `/clear`: continuity did not happen unless somebody
 * remembered.
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
 *   1. `continuity.auto_record` must be `on`. It ships `off`, so with the
 *      shipped default this module is never reached and the tree behaves
 *      exactly as it does today.
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

import { load_agent_settings } from './agent_settings.js';
import { resolvePredecessor } from './recycle_envelope_paths.js';
import { CHECKBOX_LINE, phaseLines } from './roadmap_checkboxes.js';
import { readHead, roadmapPath } from './run_checkpoint.js';
import { is_substantive, type StoredEolCounters } from './session_eol.js';
import { CAPSULE_SCHEMA_VERSION, MAX_ENTRIES, MAX_LINE_CHARS } from './subagent_capsule.js';

/** Settings key that arms this writer. Ships `off`. */
export const AUTO_RECORD_KEY = 'continuity.auto_record';

/**
 * Read `continuity.auto_record` from the merged settings cascade.
 *
 * The cascade merges the shipped template, so a workspace with no settings file
 * resolves `off` through the template rather than through the trailing
 * `return false` — which is why that line is defence against an unreadable
 * cascade and not the path a default install takes. Both directions are pinned
 * by fixtures, because "absent" and "off" arriving by different routes is
 * exactly the kind of thing a reader assumes and a test has to establish.
 */
export function auto_record_enabled(root: string): boolean {
    try {
        const settings = load_agent_settings({ cwd: root });
        const section = settings['continuity'];
        if (section && typeof section === 'object' && !Array.isArray(section)) {
            const v = (section as Record<string, unknown>)['auto_record'];
            // YAML 1.1 parses a bare `on` as boolean true — accept both.
            return v === 'on' || v === true;
        }
    } catch {
        // fail-closed: unreadable settings leave the writer disarmed
    }
    return false;
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
