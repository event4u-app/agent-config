/**
 * Council transport and cost — `road-to-adversarial-verification-and-long-runs`
 * 10.1.
 *
 * The posture is CLI → CLI quota exhausted → API within the ceiling → API over
 * the ceiling → **pause and report**. The last rung is the step's whole point:
 * over the ceiling the run does not ask whether to buy more technical API usage.
 * It reports.
 *
 * ```
 * AN OVER-CEILING COUNCIL REQUIREMENT PRODUCES A REPORT, NEVER A QUESTION.
 * TECHNICAL API SPEND IS NOT A DECISION THE OWNER IS ASKED FOR MID-RUN.
 * BUSINESS SPEND IS A TYPED OP AND A DIFFERENT CATEGORY ENTIRELY.
 * ```
 *
 * **Why a report rather than an ask, when both interrupt.** They do not
 * interrupt the same way. An ask BLOCKS: the run stops until an answer arrives,
 * and the thing being asked about — a few dollars of inference — is worth less
 * than the run's remaining work. A report does not block: it says what needed the
 * council, why the cheaper route was unavailable, what it would cost, and — the
 * load-bearing field — **what can still proceed without it**. Most of a mission
 * can.
 *
 * Pure.
 */

/** The routes, cheapest first. */
export type Route = 'cli' | 'api' | 'paused';

export interface TransportInput {
    /** Is the CLI route configured and within quota? */
    readonly cliAvailable: boolean;
    /** Why the CLI is unavailable, when it is not. */
    readonly cliUnavailableReason: string | null;
    /** Estimated USD for the API route. */
    readonly estimateUsd: number;
    /** The run's remaining technical-spend ceiling in USD. */
    readonly ceilingUsd: number;
}

export interface PauseReport {
    readonly needed: string;
    readonly cliUnavailableBecause: string;
    readonly estimateUsd: number;
    readonly ceilingUsd: number;
    readonly missionState: string;
    /** What the run continues with meanwhile. Empty is a real, reportable answer. */
    readonly canStillProceed: readonly string[];
}

export interface TransportDecision {
    readonly route: Route;
    readonly reason: string;
    /** Present only on `paused`. */
    readonly report: PauseReport | null;
}

export interface PauseContext {
    readonly needed: string;
    readonly missionState: string;
    readonly canStillProceed: readonly string[];
}

/**
 * Route one council requirement.
 *
 * A ceiling of zero pauses rather than dividing by it, and an estimate exactly
 * AT the ceiling is within it — the ceiling is a limit, not an exclusive bound,
 * and reading it the other way would pause a run that had budgeted exactly.
 */
export function routeCouncil(input: TransportInput, ctx: PauseContext): TransportDecision {
    if (input.cliAvailable) {
        return { route: 'cli', reason: 'the CLI route is available and within quota', report: null };
    }
    const why = input.cliUnavailableReason ?? 'unstated';
    if (input.estimateUsd <= input.ceilingUsd) {
        return {
            route: 'api',
            reason: `CLI unavailable (${why}); the API estimate $${input.estimateUsd.toFixed(2)} is within the $${input.ceilingUsd.toFixed(2)} ceiling`,
            report: null,
        };
    }
    return {
        route: 'paused',
        reason: `the API estimate $${input.estimateUsd.toFixed(2)} exceeds the $${input.ceilingUsd.toFixed(2)} ceiling`,
        report: {
            needed: ctx.needed,
            cliUnavailableBecause: why,
            estimateUsd: input.estimateUsd,
            ceilingUsd: input.ceilingUsd,
            missionState: ctx.missionState,
            canStillProceed: ctx.canStillProceed,
        },
    };
}

/** The six fields a pause report must carry. */
export const REPORT_FIELDS: readonly (keyof PauseReport)[] = [
    'needed',
    'cliUnavailableBecause',
    'estimateUsd',
    'ceilingUsd',
    'missionState',
    'canStillProceed',
];

/**
 * Render the report.
 *
 * It ends on what can still proceed, and that placement is deliberate: a reader
 * who stops after the cost has read a complaint, and a reader who reaches the
 * last line has read a status. Nothing here is phrased as a question, and the
 * renderer emits no `?` — asserted by a test, because the failure mode is a
 * report that drifts into an ask one helpful sentence at a time.
 */
export function renderReport(r: PauseReport): string {
    const proceeding =
        r.canStillProceed.length > 0
            ? r.canStillProceed.map((x) => `  - ${x}`).join('\n')
            : '  - nothing; the mission is blocked on this council pass alone';
    return [
        `Council paused: ${r.needed}`,
        `CLI route unavailable: ${r.cliUnavailableBecause}`,
        `API estimate $${r.estimateUsd.toFixed(2)} over the $${r.ceilingUsd.toFixed(2)} technical ceiling`,
        `Mission state: ${r.missionState}`,
        'Proceeding meanwhile with:',
        proceeding,
    ].join('\n');
}
