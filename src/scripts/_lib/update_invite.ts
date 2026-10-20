/**
 * Whether an install that already exists may be ASKED, once, to let updates
 * install themselves — and the question it would be asked.
 *
 * ADR-291 settled the policy: `auto` may default for a NEW install; an
 * existing one is asked once, after the ring-0 exit and the live-session
 * register, with a binding "never", and a dismissal keeps `notify`. This
 * module is that policy as a function, so the thing a reviewer checks is a
 * table of conditions rather than a hook's control flow.
 *
 * **Every condition is a reason to stay silent.** The function returns the
 * question only when all of them clear, and returns WHY otherwise, because a
 * prompt that appears in CI, in a pipe, in a headless run, under `--json` or
 * inside a subagent is not a question — it is output nobody can answer, in a
 * place that may be parsed.
 *
 * **It never writes the setting.** `update.mode` is class C: only a human's
 * hand-edit or the GUI's write route may set it. The invitation says how; the
 * "never" it offers is recorded in this concern's own state file, which is not
 * a setting and binds nothing but this question.
 */
import type { UpdateMode } from './classify_update.js';

/** The exact line `ring-0-unattended-record-*.md` carries, and the only one read. */
export const RING_ZERO_EXIT_LINE = /^ring-0-exit:\s*(yes|no)\s*$/m;

/**
 * Whether the ring-0 record says the exit happened.
 *
 * Absent file, absent line, or anything but a literal `yes` is `false`. The
 * line is written by a human after reading the table; nothing recomputes it
 * from the rows, because a count an agent could compute is a count an agent
 * could be wrong about, and this one authorises a prompt on an install the
 * user already has.
 */
export function ringZeroExited(recordText: string | null): boolean {
    if (recordText === null) return false;
    const m = RING_ZERO_EXIT_LINE.exec(recordText);
    return m !== null && m[1] === 'yes';
}

export interface InviteEnv {
    readonly ci: boolean;
    /** stdout AND stderr are a terminal a human is looking at. */
    readonly interactive: boolean;
    readonly headless: boolean;
    /** The run was asked for machine-readable output. */
    readonly jsonOutput: boolean;
    readonly subagent: boolean;
}

export interface InviteInput {
    readonly mode: UpdateMode | undefined;
    /** The ring-0 record's exit line. */
    readonly ringZeroExited: boolean;
    /** True once a global live-session register exists — step 1.4. */
    readonly registerAvailable: boolean;
    /** The user already said never. Binding, forever, on this machine. */
    readonly neverAsked: boolean;
    /** The invitation was already shown once. It is a once, not a cadence. */
    readonly alreadyInvited: boolean;
    /** The turn that just ended finished on a verified success. */
    readonly turnEndedOnVerifiedSuccess: boolean;
    readonly env: InviteEnv;
}

export type InviteDecision = { readonly ask: true; readonly lines: readonly string[] } | { readonly ask: false; readonly reason: string };

/** The question, once, or the reason there is none. */
export function autoInviteDecision(input: InviteInput): InviteDecision {
    if (input.env.ci) return { ask: false, reason: 'CI' };
    if (input.env.jsonOutput) return { ask: false, reason: '--json output' };
    if (input.env.subagent) return { ask: false, reason: 'subagent run' };
    if (input.env.headless) return { ask: false, reason: 'headless' };
    if (!input.env.interactive) return { ask: false, reason: 'non-TTY' };
    if (!input.ringZeroExited) return { ask: false, reason: 'ring-0 has not exited' };
    if (!input.registerAvailable) return { ask: false, reason: 'no machine-wide session register' };
    if (input.neverAsked) return { ask: false, reason: 'the user said never' };
    if (input.alreadyInvited) return { ask: false, reason: 'already invited once' };
    if (input.mode === 'auto') return { ask: false, reason: 'already auto' };
    if (input.mode === 'off') return { ask: false, reason: 'update.mode off' };
    if (input.mode === 'ask') return { ask: false, reason: 'update.mode ask' };
    if (!input.turnEndedOnVerifiedSuccess) return { ask: false, reason: 'the turn did not end on a verified success' };
    return {
        ask: true,
        lines: [
            'agent-config can install its own updates at a session start, once every gate passes',
            'and no other session is open on this machine. It is off on your install, and it stays',
            'off unless you say otherwise — nothing here changes it for you.',
            '',
            '  1. Turn it on — set `update: { mode: auto }` in your user-global settings,',
            '     by hand or in `agent-config setup`.',
            '  2. Leave it as it is — you keep being told, and nothing installs itself.',
            '  3. Never ask me again — run `agent-config upgrade --never-ask-auto`.',
            '',
            'Recommendation: 2, unless this machine is one you maintain rather than one you work on.',
        ],
    };
}
