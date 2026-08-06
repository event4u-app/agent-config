/**
 * Is there a human at the other end of this execution?
 *
 * Phase 4 of `road-to-zero-ceremony-settings`: *"Skip cleanly in non-TTY, CI,
 * and headless contexts: no file, defaults, no questions, ever."* A settings
 * question posed where nobody can answer it is not a question — it is either a
 * hang or a silently-taken default wearing a prompt's clothes.
 *
 * WHY THIS MODULE EXISTS RATHER THAN A FOURTH INLINE CHECK. The tree already
 * carries several CI-detection shapes that disagree:
 *
 * - `set && !== '0'` — `src/cli/firstRunNotice.ts`, `src/cli/initRouting.ts`
 * - truthy only — `src/scripts/install.ts`, `src/scripts/release.ts`
 * - exact match — `src/scripts/_lib/exec_evidence.ts` (`'true' | '1'`)
 * - widest, three variables — `src/scripts/reach_doctor.ts`
 *   (`CI`, `GITHUB_ACTIONS`, `AGENT_CONFIG_CI`)
 *
 * This module takes the **widest** shape, because the failure modes are
 * asymmetric: a false "interactive" hangs an automated run or fabricates a
 * consent, while a false "non-interactive" merely declines to ask and takes a
 * conservative default — which is the documented behaviour anyway.
 *
 * It deliberately does NOT rewrite those four call sites. Their behaviour is
 * correct for what they gate (a printed notice, a browser launch), and
 * converting them here would be a drive-by change to code this concern does not
 * own. The divergence is recorded rather than repaired — see the roadmap note on
 * Phase 4 step 3.
 *
 * Pure — the environment and the TTY flags are arguments, never read from
 * `process` inside the predicate, so a test never depends on the machine it
 * runs on.
 */

/** Why an execution cannot host a question. `null` means it can. */
export type NonInteractiveReason =
    | 'ci'
    | 'no-ui-requested'
    | 'not-a-tty'
    | 'headless';

export interface SessionProbe {
    /** `process.env`, or a fixture. */
    env: NodeJS.ProcessEnv;
    /** `process.stdin.isTTY === true`. */
    stdinTty: boolean;
    /** `process.stdout.isTTY === true`. */
    stdoutTty: boolean;
    /**
     * A display-less environment (SSH without forwarding, Linux without
     * `DISPLAY`). Supplied by the caller because probing it is platform work,
     * and `src/cli/commands/uiServe.ts` already owns that probe.
     */
    headless?: boolean;
}

/**
 * The CI variables this predicate honours, widest-first.
 *
 * A variable counts as set when it is present and not the literal `0` — the
 * `set && !== '0'` convention already used by the first-run notice, kept so a
 * consumer who exports `CI=0` to mean "not CI" is believed.
 */
const CI_ENV_KEYS = ['CI', 'GITHUB_ACTIONS', 'AGENT_CONFIG_CI'] as const;

function _flagSet(env: NodeJS.ProcessEnv, key: string): boolean {
    const raw = (env[key] ?? '').trim();
    return raw !== '' && raw !== '0';
}

/**
 * The reason this execution may not ask, or `null` when a human is reachable.
 *
 * Order is deliberate and is the order a reader should think in: an explicit
 * request not to be asked outranks a capability probe, and CI outranks
 * everything because a CI run that asks is a CI run that hangs.
 */
export function nonInteractiveReason(probe: SessionProbe): NonInteractiveReason | null {
    for (const key of CI_ENV_KEYS) {
        if (_flagSet(probe.env, key)) {
            return 'ci';
        }
    }
    if (_flagSet(probe.env, 'AGENT_CONFIG_NO_UI')) {
        return 'no-ui-requested';
    }
    if (!probe.stdinTty || !probe.stdoutTty) {
        return 'not-a-tty';
    }
    if (probe.headless === true) {
        return 'headless';
    }
    return null;
}

/** Convenience inverse — `true` when a question is answerable. */
export function isInteractiveSession(probe: SessionProbe): boolean {
    return nonInteractiveReason(probe) === null;
}
