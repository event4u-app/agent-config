/**
 * The standing-payload bounds are shrink-only, checked against the base ref.
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/config/preamble-payload-budget.json` says of its grace ceiling: *"It may
 * never move UP."* `grace_ceiling_history` in the same file records it moving up
 * twice — 138,212 → 138,273 on 2026-09-02 and 138,273 → 138,490 on 2026-09-08 —
 * each with a careful prose justification. ADR-264 resolved that contradiction
 * against the practice: the sentence stands, the two raises are violations caused
 * by contradictory wording, and standing-rule growth needs a compensating
 * reduction elsewhere.
 *
 * That decision then had no enforcement. A sentence in a JSON string is not a
 * gate, and the file's own history is the evidence: nothing objected either time.
 * This module is the enforcement — and it is the ONLY thing
 * `road-to-a-standing-budget-with-headroom` step 1.3 ships, because the 128-token
 * Iron Law reserve that step designed was refused by an AI council 2/2 on
 * 2026-09-08. See ADR-265.
 *
 * WHAT IT CANNOT DO, STATED PLAINLY
 * ---------------------------------
 * The change under review can edit this file. Both council seats named that as
 * the defect fatal to the reserve — "the checker, its imports, token census,
 * workflow, and status context are all part of the trusted computing base", so a
 * protected record read by an unprotected verifier grants nothing. It is fatal to
 * a mechanism that GRANTS budget and it is not fatal to one that only REFUSES,
 * which is the whole reason the reserve stayed unshipped and this ratchet did
 * not: disabling this check requires visibly editing it, and every gate in this
 * repository already rests on that same review. A ratchet whose only failure mode
 * is "someone deleted the ratchet" is strictly better than the sentence it
 * replaces, which had no failure mode because it did nothing.
 */
import { spawnSync } from 'node:child_process';

/** Repo-relative path of the budget config the bound lives in. */
export const BUDGET_CONFIG_PATH = 'src/config/preamble-payload-budget.json';

/** Injection seam: run git, capture output, never throw on a non-zero exit. */
export type GitRunner = (args: readonly string[], cwd: string) => {
    ok: boolean;
    stdout: string;
    stderr: string;
};

export const realGit: GitRunner = (args, cwd) => {
    const r = spawnSync('git', [...args], { cwd, encoding: 'utf-8' });
    return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

export interface BoundsRatchetVerdict {
    ok: boolean;
    violations: string[];
    /** The bound read at the base ref, or `null` when it could not be read. */
    baseGraceCeiling: number | null;
    /** The ref compared against, or `null` when none resolved. */
    baseRef: string | null;
    /** Why the comparison was skipped, when it was. Printed, never silent. */
    note: string | null;
}

function showAtRef(git: GitRunner, repoRoot: string, ref: string, relPath: string): string | null {
    const r = git(['show', `${ref}:${relPath}`], repoRoot);
    return r.ok ? r.stdout : null;
}

/**
 * A condition that stops the comparison: skip when advisory, refuse when not.
 *
 * One helper for all four causes rather than four inline branches, so the
 * posture cannot drift between them — the failure this closes was four
 * independent `ok: true` returns that all had to be found before any of them
 * could be trusted.
 */
function unverified(
    reason: string,
    requireBase: boolean,
    baseGraceCeiling: number | null,
    baseRef: string | null,
): BoundsRatchetVerdict {
    if (requireBase) {
        return {
            ok: false,
            baseGraceCeiling,
            baseRef,
            note: null,
            violations: [
                `the shrink-only bound could not be verified: ${reason}. This run is `
                    + 'ENFORCING, so an unverifiable bound refuses rather than skips — an '
                    + 'unreadable base would otherwise grant budget on an infrastructure '
                    + 'failure. Fix the checkout (a full fetch of the base ref) or run '
                    + 'without requireBase, which reports the skip instead.',
            ],
        };
    }
    return { ok: true, violations: [], baseGraceCeiling, baseRef, note: `${reason}, so the shrink-only bound was NOT verified` };
}

/**
 * Compare the grace ceiling in this tree against the one at the base ref.
 *
 * TWO POSTURES, AND WHICH ONE APPLIES IS THE CALLER'S TO DECLARE.
 *
 * Advisory (the default, and what every caller got before `requireBase`): a
 * base ref or base config that cannot be read SKIPS, reported in both the human
 * and JSON output so it cannot pass for a check. That default is not laziness
 * and the original reasoning still holds — a shallow clone, a first commit and
 * a detached build all legitimately have no base, and a gate that reds on them
 * gets switched off, which is how a repository loses the enforcement it just
 * built.
 *
 * Enforcing (`requireBase: true`): the same conditions REFUSE. An AI council
 * (2/2, 2026-09-10) made this blocking for the move to a base-measured ceiling,
 * and the reason is that the asymmetry above inverts once the base ref stops
 * being a cross-check and becomes the ceiling itself. Today an unreadable base
 * costs a comparison; there it would grant an unbounded budget on an
 * infrastructure failure — the exact fail-open the reserve decision refused.
 * anthropic's wording was "replaced or mode-gated"; this is the mode gate, so
 * that no existing caller silently changes behaviour.
 *
 * The flag is the caller's rather than derived from `GITHUB_ACTIONS` here: this
 * module cannot tell an enforcing CI run from a diagnostic one on the same
 * runner, and a gate that guesses its own strictness from an environment
 * variable is one `env` change away from being advisory everywhere.
 */
export function assertBoundsDidNotRise(opts: {
    repoRoot: string;
    baseRef: string | null;
    git?: GitRunner;
    /**
     * Refuse instead of skipping when the base cannot be read.
     *
     * Absent is advisory, which keeps every pre-existing caller on the
     * behaviour it was written against. The CI path sets it.
     */
    requireBase?: boolean;
    /**
     * The ceiling this run actually compares the payload against.
     *
     * The CI step passes `--ceiling <grace_ceiling>`, so the effective bound can
     * be raised either by editing the config or by passing a bigger number. Both
     * arrive here as one value, which closes the second path without a second
     * check.
     */
    headGraceCeiling: number;
}): BoundsRatchetVerdict {
    const git = opts.git ?? realGit;
    const requireBase = opts.requireBase === true;
    if (opts.baseRef === null || opts.baseRef.trim() === '') {
        return unverified('no base ref resolved', requireBase, null, null);
    }
    const cfg = showAtRef(git, opts.repoRoot, opts.baseRef, BUDGET_CONFIG_PATH);
    if (cfg === null) {
        return unverified(
            `${BUDGET_CONFIG_PATH} could not be read at ${opts.baseRef}`,
            requireBase,
            null,
            opts.baseRef,
        );
    }
    let baseGrace: number | null = null;
    try {
        const parsed = JSON.parse(cfg) as Record<string, unknown>;
        const delivery = (parsed['ci_delivery'] ?? {}) as Record<string, unknown>;
        const n = Number(delivery['grace_ceiling']);
        baseGrace = Number.isFinite(n) ? n : null;
    } catch {
        return unverified(
            `${BUDGET_CONFIG_PATH} at ${opts.baseRef} is not parseable`,
            requireBase,
            null,
            opts.baseRef,
        );
    }
    if (baseGrace === null) {
        return unverified(
            `no ci_delivery.grace_ceiling at ${opts.baseRef}, so there is no earlier bound to ratchet against`,
            requireBase,
            null,
            opts.baseRef,
        );
    }
    if (opts.headGraceCeiling > baseGrace) {
        return {
            ok: false,
            baseGraceCeiling: baseGrace,
            baseRef: opts.baseRef,
            note: null,
            violations: [
                `the standing-payload grace ceiling rose from ${String(baseGrace)} to ` +
                    `${String(opts.headGraceCeiling)} against ${opts.baseRef}. ` +
                    `${BUDGET_CONFIG_PATH} says it may not move upward and ADR-264 decided that ` +
                    'the sentence stands: standing-rule growth needs a compensating reduction ' +
                    'elsewhere, not a bigger ceiling. Lower the addition, migrate the prose out of ' +
                    'the standing rule, or reduce another standing asset by the same amount.',
            ],
        };
    }
    return { ok: true, violations: [], baseGraceCeiling: baseGrace, baseRef: opts.baseRef, note: null };
}
