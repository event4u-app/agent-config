/**
 * run_checkpoint — the deterministic checkpoint a dying run leaves behind,
 * and the re-verification a resumed run owes before trusting it.
 *
 * road-to-long-horizon-execution Phase 3.0 / 3.2 (sequencing UOTL Phase 6.1).
 *
 * ## Why "deterministic" is the load-bearing word
 *
 * A handoff summary is authored — a model writes prose about where the work
 * stands, and prose can be wrong in ways nothing catches. A checkpoint is
 * DERIVED: every field here is recomputed from files on disk, so writing one
 * costs no judgement and reading one back can be checked against the tree
 * that produced it. The two are complements, not alternatives: the summary
 * says what the run was thinking, this says what the run had actually done.
 *
 * ## Why a resumed run re-verifies rather than trusts
 *
 * The reference design this borrows from resumes by BOOKKEEPING — the daemon
 * believes its own record of where a session was. That is fine while nothing
 * else touches the tree, and wrong the moment something does: a human
 * committing, a sibling worktree, a partially-applied edit the dying session
 * never finished. So `verifyCheckpoint` recomputes the same fields and reports
 * a per-field agreement rather than a boolean — a resumed run should be able
 * to say WHICH claim went stale, not merely that something did.
 *
 * A disagreement is explicitly NOT an error here. Work landing between the
 * checkpoint and the resume is the normal case, and a verifier that treats
 * progress as corruption would refuse every healthy resume.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { CHECKBOX_LINE, phaseLines } from './roadmap_checkboxes.js';

export const CHECKPOINT_DIR_REL = path.join('agents', 'runtime', 'state', 'checkpoints');

/**
 * A run's derived state at the moment its session ended.
 *
 * Every field is recomputed, never remembered — that is what makes
 * `verifyCheckpoint` possible at all.
 */
export interface RunCheckpoint {
    readonly schema_version: 1;
    /** The session-derived run id this checkpoint belongs to. */
    readonly run_id: string;
    /** Roadmap slug from the session's `sessions:claim` file. */
    readonly roadmap: string;
    /** Steps still `[ ]` at checkpoint time. */
    readonly open_steps: number;
    /** Steps already `[x]` at checkpoint time. */
    readonly done_steps: number;
    /** `[~]` deferred plus `[-]` cancelled — neither is open work. */
    readonly parked_steps: number;
    /** The next `[ ]` step's text, trimmed, or `null` when none remains. */
    readonly next_step: string | null;
    /** Commit the tree was on. A resume onto a different commit is normal, and visible. */
    readonly head: string | null;
    /**
     * The situational-awareness reading this run last took —
     * `contextFingerprint()` over `origin/main` plus every open PR's head SHA.
     *
     * `road-to-roadmap-situational-awareness` § 5.6. Every other field here
     * reports **roadmap** drift; none reported **repository** drift, so a run
     * resumed after a long gap trusted a context reading it never re-took. A
     * disagreement here forces a re-probe before the first step.
     *
     * Optional: a checkpoint written before this field existed, or by a run that
     * could not reach the probe, is still a valid checkpoint. Absent means "not
     * known", never "unchanged" — `verifyCheckpoint` treats a null on either
     * side as unknown, the same way it already treats `head`.
     */
    readonly context_fingerprint?: string | null;
    readonly written_at: string;
}

/** Counts derived from a roadmap body — the same vocabulary the loop uses. */
export interface RoadmapCounts {
    open: number;
    done: number;
    parked: number;
    next: string | null;
}

/**
 * Count checkboxes in a roadmap body.
 *
 * `[~]` (deferred) and `[-]` (cancelled) are PARKED, not open: a resumed run
 * that treated them as work to do would re-engage into the exact items a human
 * decided not to do, which is the anti-stall mechanism manufacturing a stall.
 */
export function countRoadmap(text: string): RoadmapCounts {
    const counts: RoadmapCounts = { open: 0, done: 0, parked: 0, next: null };
    // Phase spans only, and the dashboard's own vocabulary — see
    // `_lib/roadmap_checkboxes.ts` for what each half was getting wrong.
    for (const raw of phaseLines(text)) {
        const m = CHECKBOX_LINE.exec(raw);
        if (m === null) continue;
        const mark = m[1];
        if (mark === 'x' || mark === 'X') {
            counts.done += 1;
        } else if (mark === '~' || mark === '-') {
            counts.parked += 1;
        } else {
            counts.open += 1;
            if (counts.next === null) {
                counts.next = (m[2] ?? '').trim() || null;
            }
        }
    }
    return counts;
}

export function checkpointFile(repoRoot: string, runId: string): string {
    return path.join(repoRoot, CHECKPOINT_DIR_REL, `${runId.replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
}

export function roadmapPath(repoRoot: string, slug: string): string {
    return path.join(repoRoot, 'agents', 'roadmaps', `${slug}.md`);
}

export interface BuildOptions {
    /** Injected so a test does not depend on the ambient git state. */
    readonly head?: string | null;
    readonly now?: () => Date;
    /**
     * The run's situational-awareness fingerprint
     * (`roadmap:context --fingerprint`). Injected rather than read here, so this
     * library keeps its no-subprocess property — `readHead` reads `.git`
     * directly for the same reason, and the probe cannot.
     *
     * Omitted → the field is absent, and a resume reports "not known" rather
     * than asserting the repository stood still.
     */
    readonly contextFingerprint?: string | null;
}

/**
 * The current commit, read straight off `.git` — no subprocess.
 *
 * R2 round 2, finding 5. `head` was populated only from `opts.head`, and the
 * ONE production caller (`session_eol_hook`) never passed it, so the field was
 * always `null` while the checkpoint's own docblock, the loop contract and the
 * roadmap all describe it as carrying the commit the tree was on. Only the
 * test injected a value, which is why nothing noticed.
 *
 * No `git rev-parse`: this runs on the Stop path, where a spawn is a cost paid
 * on every reply. Two files answer it — and a WORKTREE is the case a naive
 * reader gets wrong, because there `.git` is a FILE holding `gitdir: <path>`
 * rather than a directory. This package is developed in worktrees, so the naive
 * version would have returned null exactly where it was being exercised.
 *
 * Returns `null` on anything unexpected. A checkpoint without a commit is
 * still useful; a Stop path that throws is not.
 */
export function readHead(repoRoot: string): string | null {
    try {
        let gitDir = path.join(repoRoot, '.git');
        if (fs.statSync(gitDir).isFile()) {
            const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(gitDir, 'utf-8').trim());
            if (m === null) return null;
            gitDir = path.resolve(repoRoot, m[1] as string);
        }
        // HEAD is per-worktree; REFS are not. A linked worktree's gitdir holds
        // its own HEAD and a `commondir` pointer, and `refs/` + `packed-refs`
        // live at that commondir — never beside HEAD.
        //
        // R2 round 3, finding 1, and the round-2 version of this function got
        // it exactly half right: it handled `.git`-as-a-file and then resolved
        // refs against the worktree gitdir, so `head` was null in every linked
        // worktree — including the one this package is developed in. Its test
        // passed because the fixture wrote refs beside HEAD, a layout git never
        // produces. A fixture that agrees with the code instead of with reality
        // reads as coverage and is worse than no test at all.
        let refRoot = gitDir;
        try {
            const common = fs.readFileSync(path.join(gitDir, 'commondir'), 'utf-8').trim();
            if (common !== '') refRoot = path.resolve(gitDir, common);
        } catch {
            // No commondir — a plain repository, where gitDir already is it.
        }
        const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf-8').trim();
        // A detached HEAD is the sha itself.
        if (/^[0-9a-f]{40}$/.test(head)) return head;
        const ref = /^ref:\s*(.+)$/.exec(head);
        if (ref === null) return null;
        const refName = ref[1] as string;
        try {
            return fs.readFileSync(path.join(refRoot, refName), 'utf-8').trim() || null;
        } catch {
            // Packed refs: a loose file does not exist for every branch.
            const packed = fs.readFileSync(path.join(refRoot, 'packed-refs'), 'utf-8');
            for (const line of packed.split('\n')) {
                const pm = /^([0-9a-f]{40})\s+(.+)$/.exec(line.trim());
                if (pm !== null && pm[2] === refName) return pm[1] as string;
            }
            return null;
        }
    } catch {
        return null;
    }
}

/**
 * Derive a checkpoint from the tree. Returns `null` when the roadmap is
 * unreadable — a checkpoint that guesses is worse than none, because the whole
 * contract of this file is that its fields were computed rather than recalled.
 */
export function buildCheckpoint(
    repoRoot: string,
    runId: string,
    slug: string,
    opts: BuildOptions = {},
): RunCheckpoint | null {
    let text: string;
    try {
        text = fs.readFileSync(roadmapPath(repoRoot, slug), 'utf-8');
    } catch {
        return null;
    }
    const counts = countRoadmap(text);
    return {
        schema_version: 1,
        run_id: runId,
        roadmap: slug,
        open_steps: counts.open,
        done_steps: counts.done,
        parked_steps: counts.parked,
        next_step: counts.next,
        head: opts.head ?? readHead(repoRoot),
        // Absent rather than null when nothing was supplied: a checkpoint that
        // predates this field and one written without a probe are the same
        // state, and both must read as "not known".
        ...(opts.contextFingerprint !== undefined
            ? { context_fingerprint: opts.contextFingerprint }
            : {}),
        written_at: (opts.now ?? ((): Date => new Date()))().toISOString(),
    };
}

/** Write a checkpoint. Best-effort: a failed write must never break a Stop. */
export function writeCheckpoint(repoRoot: string, cp: RunCheckpoint): string | null {
    const file = checkpointFile(repoRoot, cp.run_id);
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(cp, null, 2)}\n`, 'utf-8');
        return file;
    } catch {
        return null;
    }
}

export function readCheckpoint(repoRoot: string, runId: string): RunCheckpoint | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(checkpointFile(repoRoot, runId), 'utf-8'));
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const o = parsed as Record<string, unknown>;
        if (typeof o['run_id'] !== 'string' || typeof o['roadmap'] !== 'string') return null;
        if (typeof o['open_steps'] !== 'number' || typeof o['done_steps'] !== 'number') return null;
        return parsed as RunCheckpoint;
    } catch {
        return null;
    }
}

/**
 * The most recent checkpoint for a ROADMAP, across every run id.
 *
 * R2 review, finding 7. `readCheckpoint` keys on the run id, which is derived
 * from the session id of the session that DIED — so a relaunched session, which
 * by definition has a new id and no index from slug to old id, could not reach
 * its own checkpoint through any path in the tree. `verifyCheckpoint` and
 * `renderVerification` had zero production call sites, and the loop contract
 * nonetheless instructed a resumed run that "the first act is verifyCheckpoint".
 * The mitigation Risk 5 names was unreachable as shipped.
 *
 * The roadmap slug is the one key a relaunched run genuinely holds: it claims
 * the same roadmap, which is what makes it a resume rather than a new run.
 *
 * Ties are broken by `written_at` descending, then by filename, so the result
 * is deterministic when two checkpoints share a timestamp. A malformed or
 * unreadable file is skipped rather than failing the lookup — a resume that
 * refuses to start because one stale JSON file is corrupt is worse than a
 * resume that verifies against the newest readable one.
 */
export function latestCheckpointFor(repoRoot: string, roadmap: string): RunCheckpoint | null {
    const dir = path.join(repoRoot, CHECKPOINT_DIR_REL);
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
    } catch {
        return null;
    }
    const found: RunCheckpoint[] = [];
    for (const name of names.sort()) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
        } catch {
            continue;
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        const o = parsed as Record<string, unknown>;
        if (o['roadmap'] !== roadmap) continue;
        if (typeof o['run_id'] !== 'string') continue;
        if (typeof o['open_steps'] !== 'number' || typeof o['done_steps'] !== 'number') continue;
        found.push(parsed as RunCheckpoint);
    }
    if (found.length === 0) return null;
    found.sort((a, b) => {
        const at = String(a.written_at ?? '');
        const bt = String(b.written_at ?? '');
        if (at !== bt) return at < bt ? 1 : -1;
        return a.run_id < b.run_id ? 1 : -1;
    });
    return found[0] ?? null;
}

/** One claim's verdict — the field, what was claimed, what is true now. */
export interface FieldVerdict {
    readonly field: string;
    readonly claimed: string | number | null;
    readonly actual: string | number | null;
    readonly agrees: boolean;
}

export interface VerifyResult {
    /** `false` when the roadmap named by the checkpoint no longer reads. */
    readonly readable: boolean;
    readonly fields: readonly FieldVerdict[];
    /** Every field agreed. NOT a precondition for resuming — see the header. */
    readonly agrees: boolean;
}

/**
 * Recompute the checkpoint's claims against the tree as it is NOW.
 *
 * Reports per-field rather than a boolean on purpose: "the checkpoint is
 * stale" tells a resumed run nothing it can act on, while "open_steps claimed
 * 4, actual 3" tells it a step landed after the checkpoint was written and
 * which count to trust.
 */
export function verifyCheckpoint(
    repoRoot: string,
    cp: RunCheckpoint,
    /**
     * The fingerprint a fresh `roadmap:context --fingerprint` returned, when the
     * resumed run took one. Omitted → the field reports "not known" rather than
     * asserting the repository stood still.
     */
    currentFingerprint?: string | null,
): VerifyResult {
    let text: string;
    try {
        text = fs.readFileSync(roadmapPath(repoRoot, cp.roadmap), 'utf-8');
    } catch {
        return { readable: false, fields: [], agrees: false };
    }
    const counts = countRoadmap(text);
    // Read ONCE, so the recorded `actual` and the verdict about it are one
    // expression rather than two that happen to agree.
    const head = readHead(repoRoot);
    const fields: FieldVerdict[] = [
        { field: 'open_steps', claimed: cp.open_steps, actual: counts.open, agrees: cp.open_steps === counts.open },
        { field: 'done_steps', claimed: cp.done_steps, actual: counts.done, agrees: cp.done_steps === counts.done },
        { field: 'parked_steps', claimed: cp.parked_steps, actual: counts.parked, agrees: cp.parked_steps === counts.parked },
        { field: 'next_step', claimed: cp.next_step, actual: counts.next, agrees: cp.next_step === counts.next },
        // `head` is recomputed like every other field. R2 round 3, finding 2:
        // round 2 fixed only the WRITE half of finding 5, so the loop
        // contract's "every field is recomputed" was false for exactly the
        // field that says whether the tree moved under the run — which is the
        // one a resume most needs to see. A disagreement here is the NORMAL
        // case (a human committed, a sibling worktree moved) and is reported,
        // never treated as corruption.
        {
            field: 'head',
            claimed: cp.head,
            actual: head,
            // A `null` on EITHER side is "not known", never "different".
            //
            // R2 round 4, finding 2. `readHead` is explicitly designed to
            // return null on any failure — no git, an unreadable ref, a
            // packed-refs miss — so a strict `===` turned "I could not read
            // the commit" into "the tree moved since the checkpoint", on a
            // resume at the SAME commit with every other field agreeing. That
            // is a false alarm on the one field whose whole job is to tell a
            // human whether anything moved, and a false alarm there costs more
            // than a missing one: it trains the reader to skip the line.
            agrees: cp.head === null || head === null || cp.head === head,
        },
        // Repository drift, which no other field here reports. The `actual` is
        // supplied by the caller (the probe is a subprocess and this library
        // stays I/O-light) — absent means the caller did not re-probe, and an
        // unknown on either side is never a disagreement, exactly as for `head`.
        {
            field: 'context_fingerprint',
            claimed: cp.context_fingerprint ?? null,
            actual: currentFingerprint ?? null,
            agrees:
                (cp.context_fingerprint ?? null) === null ||
                (currentFingerprint ?? null) === null ||
                cp.context_fingerprint === currentFingerprint,
        },
    ];
    return { readable: true, fields, agrees: fields.every((f) => f.agrees) };
}

/** A one-line-per-field report a resumed run can put in front of a human. */
export function renderVerification(cp: RunCheckpoint, res: VerifyResult): string {
    if (!res.readable) {
        return (
            `checkpoint ${cp.run_id}: roadmap '${cp.roadmap}' no longer reads — ` +
            `the claimed state cannot be re-verified, so none of it may be assumed.`
        );
    }
    const lines = [`checkpoint ${cp.run_id} · roadmap ${cp.roadmap} · written ${cp.written_at}`];
    // Three states, not two. R2 round 5, finding 3: the null-head tolerance
    // added in round 4 is correct as a VERDICT — an unknown commit is not a
    // moved one — but rendering it as `ok head: null` alongside "the tree
    // still matches the checkpoint" tells the reader something was checked
    // when nothing could be. UNKNOWN is a third word because the reader's next
    // action differs: `ok` needs nothing, `CHANGED` names what moved, and
    // UNKNOWN says this axis carries no information and the other four are
    // what the verdict rests on.
    // ONLY `head` can be unknown. R2 round 6, finding 6: the predicate was
    // written for `head` — where `null` means "could not read" — and applied
    // to all five fields, but for `next_step` a `null` is a documented VALUE
    // ("or `null` when none remains"). A finished roadmap therefore rendered
    // `UNKNOWN next_step: not readable` and claimed a field had not been
    // compared when it had been, on the exact state a resume most wants to
    // see. The field name is the discriminator because the meaning of `null`
    // is a property of the field, not of the value.
    const UNKNOWNABLE: ReadonlySet<string> = new Set(['head']);
    let unknown = 0;
    for (const f of res.fields) {
        if (UNKNOWNABLE.has(f.field) && (f.claimed === null || f.actual === null)) {
            unknown += 1;
            lines.push(
                `  UNKNOWN  ${f.field}: not readable ` +
                    `(claimed ${String(f.claimed)}, actual ${String(f.actual)}) — not compared`,
            );
            continue;
        }
        lines.push(
            f.agrees
                ? `  ok       ${f.field}: ${String(f.actual)}`
                : `  CHANGED  ${f.field}: claimed ${String(f.claimed)} → actual ${String(f.actual)}`,
        );
    }
    if (!res.agrees) {
        lines.push('  the tree moved since the checkpoint — the ACTUAL column is what to resume from.');
    } else if (unknown > 0) {
        lines.push(
            `  the ${res.fields.length - unknown} comparable field(s) match; ` +
                `${unknown} could not be read and were not compared.`,
        );
    } else {
        lines.push('  the tree still matches the checkpoint.');
    }
    return lines.join('\n');
}
