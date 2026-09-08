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
 * Compare the grace ceiling in this tree against the one at the base ref.
 *
 * SKIPS rather than fails when the base ref or the base config cannot be read.
 * That is the opposite of the fail-closed posture the same council demanded for
 * the reserve, and the asymmetry is deliberate: an unreadable base there would
 * have GRANTED budget on an infrastructure failure, whereas here it would REFUSE
 * a change on one. A shallow clone, a first commit and a detached build all
 * legitimately have no base, and a gate that reds on them gets switched off —
 * which is how a repository loses the enforcement it just built. The skip is
 * reported in both the human and JSON output so it cannot pass for a check.
 */
export function assertBoundsDidNotRise(opts: {
    repoRoot: string;
    baseRef: string | null;
    git?: GitRunner;
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
    if (opts.baseRef === null || opts.baseRef.trim() === '') {
        return {
            ok: true,
            violations: [],
            baseGraceCeiling: null,
            baseRef: null,
            note: 'no base ref resolved, so the shrink-only bound was NOT verified in this run',
        };
    }
    const cfg = showAtRef(git, opts.repoRoot, opts.baseRef, BUDGET_CONFIG_PATH);
    if (cfg === null) {
        return {
            ok: true,
            violations: [],
            baseGraceCeiling: null,
            baseRef: opts.baseRef,
            note: `${BUDGET_CONFIG_PATH} could not be read at ${opts.baseRef}, so the shrink-only bound was NOT verified`,
        };
    }
    let baseGrace: number | null = null;
    try {
        const parsed = JSON.parse(cfg) as Record<string, unknown>;
        const delivery = (parsed['ci_delivery'] ?? {}) as Record<string, unknown>;
        const n = Number(delivery['grace_ceiling']);
        baseGrace = Number.isFinite(n) ? n : null;
    } catch {
        return {
            ok: true,
            violations: [],
            baseGraceCeiling: null,
            baseRef: opts.baseRef,
            note: `${BUDGET_CONFIG_PATH} at ${opts.baseRef} is not parseable, so the shrink-only bound was NOT verified`,
        };
    }
    if (baseGrace === null) {
        return {
            ok: true,
            violations: [],
            baseGraceCeiling: null,
            baseRef: opts.baseRef,
            note: `no ci_delivery.grace_ceiling at ${opts.baseRef}, so there is no earlier bound to ratchet against`,
        };
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
