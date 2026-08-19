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
    for (const raw of text.split('\n')) {
        const m = /^\s*-\s*\[([ x~-])\]\s*(.*)$/.exec(raw);
        if (m === null) continue;
        const mark = m[1];
        if (mark === 'x') {
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
        head: opts.head ?? null,
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
export function verifyCheckpoint(repoRoot: string, cp: RunCheckpoint): VerifyResult {
    let text: string;
    try {
        text = fs.readFileSync(roadmapPath(repoRoot, cp.roadmap), 'utf-8');
    } catch {
        return { readable: false, fields: [], agrees: false };
    }
    const counts = countRoadmap(text);
    const fields: FieldVerdict[] = [
        { field: 'open_steps', claimed: cp.open_steps, actual: counts.open, agrees: cp.open_steps === counts.open },
        { field: 'done_steps', claimed: cp.done_steps, actual: counts.done, agrees: cp.done_steps === counts.done },
        { field: 'parked_steps', claimed: cp.parked_steps, actual: counts.parked, agrees: cp.parked_steps === counts.parked },
        { field: 'next_step', claimed: cp.next_step, actual: counts.next, agrees: cp.next_step === counts.next },
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
    for (const f of res.fields) {
        lines.push(
            f.agrees
                ? `  ok       ${f.field}: ${String(f.actual)}`
                : `  CHANGED  ${f.field}: claimed ${String(f.claimed)} → actual ${String(f.actual)}`,
        );
    }
    lines.push(
        res.agrees
            ? '  the tree still matches the checkpoint.'
            : '  the tree moved since the checkpoint — the ACTUAL column is what to resume from.',
    );
    return lines.join('\n');
}
