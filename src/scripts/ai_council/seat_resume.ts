/**
 * Whether a council seat continues its CLI session — road-to-a-cold-start-paid-once 5.2.
 *
 * Only a non-blind follow-up to the same seat resumes, and only inside the
 * window the provider's prompt cache lives for. A blind round never resumes:
 * the session holds the reviewer's earlier position, and an anonymised round
 * exists precisely so the reviewer cannot recognise it.
 */

export interface SeatSession {
    readonly id: string;
    readonly at_ms: number;
}

/** The prompt-cache lifetime a resume is worth paying for. */
export const SEAT_RESUME_TTL_MS = 5 * 60_000;

/** Extra argv for a resumed call; `[]` means a fresh session. */
export function seatResumeArgs(
    provider: string,
    session: SeatSession | null,
    ctx: { readonly blind: boolean; readonly now_ms: number; readonly ttl_ms?: number },
): string[] {
    if (ctx.blind || session === null || session.id === '') return [];
    const age = ctx.now_ms - session.at_ms;
    if (age < 0 || age >= (ctx.ttl_ms ?? SEAT_RESUME_TTL_MS)) return [];
    if (provider === 'anthropic') return ['--resume', session.id];
    if (provider === 'openai') return ['resume', session.id];
    return [];
}

/**
 * `codex exec resume` refuses `--sandbox` (measured on codex-cli 0.148.0), so a
 * resumed seat carries the same bound as a config override instead of dropping it.
 */
export function resumeBound(bound: readonly string[]): string[] {
    const i = bound.indexOf('--sandbox');
    if (i < 0 || bound[i + 1] === undefined) return [...bound];
    return [...bound.slice(0, i), '-c', `sandbox_mode="${bound[i + 1]}"`, ...bound.slice(i + 2)];
}
