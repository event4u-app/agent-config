/**
 * Per-trial workspace lifecycle — the clone, and the transcript beside it.
 *
 * The two belong together: `reset_fixture` re-creates the clone AND drops the
 * sibling transcript, and both are the delta-#7 evidence an offline re-scorer
 * reads. They moved out of `bench_ab_v2_run.ts` because the source-size ratchet
 * is shrink-only and extraction is its intended answer — raising the baseline
 * is a defect, and trimming the prose out of load-bearing comments is worse.
 *
 * ## Transcript preservation — delta #7's sibling, for T5.
 *
 * T5 scores what a run did BEFORE it wrote, which leaves no residue in the
 * final tree: the transcript is the only evidence, and the report discards it.
 * These two functions are what make a completed sweep re-scorable for search
 * adherence instead of needing a re-run.
 *
 * BESIDE the clone, never inside it. `changed_files` diffs the clone against
 * the pristine fixture, so a transcript written into the workspace would appear
 * as a file the run created: T5's evidence would corrupt T1's, and the size
 * endpoint would gain one added file per trial for a reason no reader could see.
 *
 * A file rather than a field on the trial record because transcripts are the
 * largest thing a sweep produces, and inlining them would multiply a pinned
 * report's size for data only the T5 re-scorer ever reads. Truncating instead
 * was the other option and is worse: a rubric scored on a clipped transcript
 * measures the clip.
 *
 * KNOWN COVERAGE GAP, stated rather than silently carried: the
 * `package-recursive` arm records neither `workspace` nor `transcript_path`, so
 * T1/T2/T4 and now T5 all skip it. The workspace half predates this module and
 * closing it would alter what the existing endpoints cover, which is a
 * different decision from adding one — so it is named here and in the T5
 * re-scorer's "no transcript recorded" reason instead of being half-fixed.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { pristine_tree_for } from './bench_ab_pinned_repo.js';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'internal', 'bench', 'ab');
const WORK_ROOT = path.join(os.tmpdir(), 'agent-config-bench-v2-clones');

type Dict = Record<string, unknown>;

/** Where this trial's transcript is preserved — a sibling of the clone. */
export function transcript_path_for(clone: string): string {
    return `${clone}.transcript.txt`;
}

/**
 * Write the transcript beside the clone; return the path, or `null` when there
 * was nothing to preserve or the write failed.
 *
 * A null propagates onto the trial as `transcript_path: null`, which the T5
 * re-scorer reads as "not measured on this trial" — never as a zero score. A
 * failed write must not be able to look like a run that searched for nothing.
 */
export function preserve_transcript(clone: string, transcript: string): string | null {
    if (!transcript) return null;
    const dest = transcript_path_for(clone);
    try {
        fs.writeFileSync(dest, transcript, { encoding: 'utf-8' });
    } catch {
        return null;
    }
    return dest;
}


/**
 * Workspace directory for one trial — delta #7 of the S0.3 spike.
 *
 * Keyed by `task|arm|seed`, not by task alone. The old task-only key meant every
 * arm and every seed of a task reused ONE directory that the next trial deleted,
 * so at the end of a sweep exactly one workspace survived per task — the last one
 * written, with no record of which arm or seed it belonged to.
 *
 * That is not a tidiness problem. Phase 3's anti-golfing gate is specified as
 * retro-fittable onto already-completed runs by offline re-scoring, and the
 * roadmap calls that gate cheap *because* the workspaces are preserved. Under the
 * old key there was nothing to re-score, so the claim was false. A distinct
 * directory per trial is what makes it true.
 *
 * `arm` is sanitised because arm names are used verbatim as a path segment and
 * one of them would otherwise be free to escape the root.
 */
export function workspace_dir(task_id: string, arm: string, seed: number): string {
    const safe_arm = arm.replace(/[^A-Za-z0-9._-]/g, '_');
    return path.join(WORK_ROOT, `${task_id}__${safe_arm}__seed${seed}`);
}

/**
 * Copy the task's pristine fixture into this trial's own working clone.
 *
 * The clone is re-created from the fixture on every call, so a resumed or
 * repeated trial still starts pristine — the per-trial key changes *which*
 * directory that is, never whether it is clean.
 */
export function reset_fixture(task: Dict, arm: string, seed: number): [string, string] {
    // Delta #9: a task may pin an external repo at a SHA instead of naming an
    // in-repo fixture. `pristine_tree_for` returns the tree either way, so the
    // per-trial copy below — and every endpoint that diffs against the pristine
    // tree — is unchanged by which kind of task this is.
    const fixture = pristine_tree_for(task, { fixturesRoot: FIXTURES_ROOT });
    if (fixture === null) {
        throw new Error(`task ${String(task['id'])} declares neither a \`fixture\` nor a pinned \`repo\`/\`sha\``);
    }
    const dest = workspace_dir(String(task['id']), arm, seed);
    if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.rmSync(transcript_path_for(dest), { force: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(fixture, dest, { recursive: true });
    return [dest, fixture];
}
