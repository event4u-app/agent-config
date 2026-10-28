/**
 * The cost-of-parity loop.
 *
 * One run = the task prompt, graded; then, while the primary score is below the
 * task's pre-registered `parity_bar`, the SAME host session is resumed with the
 * next step of a pre-written feedback ladder, up to K follow-ups. Both arms walk
 * the same ladder after a miss. A run that never reaches the bar is CENSORED —
 * recorded as "not reached by K", never imputed a number of steps it did not
 * take. A step the grader could not score (`unknown`) ends the run as
 * INDETERMINATE: no parity claim either way.
 *
 * The ladder text comes from the corpus, written from the rubric before any
 * run: a ladder derived from the with-arm's output would hand the other arm the
 * answer, so nothing here reads an arm's output to phrase feedback.
 */
import type { ArtifactTask, LadderName } from './bench_artifact_corpus.js';
import type { GraderResult } from './bench_artifact_graders.js';

export const PARITY_CAP_K = 5;

export interface HostTurn {
    session_id: string | null;
    errored: boolean;
    reason?: string;
    /** Total tokens for this turn, or null when telemetry did not report them. */
    tokens: number | null;
    turns: number | null;
    usd?: number | null;
}

/** A host that can start a session and resume it with a follow-up prompt. */
export interface ArtifactHost {
    start(prompt: string): Promise<HostTurn>;
    resume(session_id: string, prompt: string): Promise<HostTurn>;
}

export interface ParityStep {
    prompt_index: number; // 0 = the task prompt, n = ladder step n
    prompt: string;
    status: GraderResult['status'];
    score: number | null;
    tokens: number | null;
    turns: number | null;
}

export type ParityOutcome = 'reached' | 'censored' | 'indeterminate' | 'errored';

export interface ParityRun {
    task: string;
    arm: string;
    ladder: LadderName;
    parity_bar: number;
    cap_k: number;
    outcome: ParityOutcome;
    /** Prompts sent until the bar was reached (1 = first shot); null unless reached. */
    prompts_to_parity: number | null;
    first_shot_score: number | null;
    steps: ParityStep[];
    /** Sum over steps, or null as soon as one step's telemetry is missing. */
    tokens_total: number | null;
    turns_total: number | null;
    reason?: string;
}

function sum(xs: (number | null)[]): number | null {
    return xs.some((x) => x === null) ? null : (xs as number[]).reduce((a, b) => a + b, 0);
}

export async function parity_loop(args: {
    task: ArtifactTask;
    arm: string;
    ladder: LadderName;
    host: ArtifactHost;
    grade: () => Promise<GraderResult>;
    cap_k?: number;
}): Promise<ParityRun> {
    const { task, arm, ladder, host, grade } = args;
    const cap_k = args.cap_k ?? PARITY_CAP_K;
    const follow_ups = task.feedback_ladder[ladder].slice(0, cap_k);
    const steps: ParityStep[] = [];
    const finish = (outcome: ParityOutcome, reason?: string): ParityRun => ({
        task: task.id,
        arm,
        ladder,
        parity_bar: task.parity_bar,
        cap_k,
        outcome,
        prompts_to_parity: outcome === 'reached' ? steps.length : null,
        first_shot_score: steps[0]?.score ?? null,
        steps,
        tokens_total: sum(steps.map((s) => s.tokens)),
        turns_total: sum(steps.map((s) => s.turns)),
        ...(reason ? { reason } : {}),
    });

    let session: string | null = null;
    const prompts = [task.prompt, ...follow_ups];
    for (let i = 0; i < prompts.length; i += 1) {
        const prompt = prompts[i] as string;
        let turn: HostTurn;
        if (i === 0) {
            turn = await host.start(prompt);
        } else if (session === null) {
            return finish('errored', 'host returned no session id to resume');
        } else {
            turn = await host.resume(session, prompt);
        }
        session = turn.session_id ?? session;
        if (turn.errored) {
            steps.push({ prompt_index: i, prompt, status: 'unknown', score: null, tokens: turn.tokens, turns: turn.turns });
            return finish('errored', turn.reason ?? 'host error');
        }
        const g = await grade();
        steps.push({ prompt_index: i, prompt, status: g.status, score: g.score, tokens: turn.tokens, turns: turn.turns });
        if (g.score === null) return finish('indeterminate', g.reason ?? 'primary grader returned unknown');
        if (g.score >= task.parity_bar) return finish('reached');
    }
    return finish('censored', follow_ups.length < cap_k ? 'ladder exhausted before K' : `not reached by K=${cap_k}`);
}
