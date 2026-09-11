/**
 * The standing-payload bounds are shrink-only, checked against the base ref.
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/config/preamble-payload-budget.json` said of its grace ceiling: *"It may
 * never move UP."* `grace_ceiling_history` in the same file recorded it moving
 * up twice — 138,212 → 138,273 on 2026-09-02 and 138,273 → 138,490 on
 * 2026-09-08 — each with a careful prose justification. ADR-264 resolved that
 * contradiction against the practice: the sentence stands, the two raises are
 * violations caused by contradictory wording, and standing-rule growth needs a
 * compensating reduction elsewhere.
 *
 * That decision then had no enforcement. A sentence in a JSON string is not a
 * gate, and the file's own history was the evidence: nothing objected either
 * time. This module is the enforcement.
 *
 * WHAT IT BOUNDS NOW — AND WHY THE SUBJECT CHANGED
 * -------------------------------------------------
 * It used to bound one number, `ci_delivery.grace_ceiling`. That key is GONE
 * (`road-to-delivery-for-every-host` 4.4): the ceiling is no longer stored, it
 * is MEASURED at the base ref as `max(design_ceiling, base + active grants)`.
 * A measured ceiling captures every merged reduction automatically, which a
 * stored one never did.
 *
 * Moving the ceiling out of the config did not remove the need for a
 * shrink-only bound — it moved the attack surface. Three numbers in the tree
 * can still widen the effective ceiling without adding a single token of
 * payload, and all three are now bounded:
 *
 *   · `design_ceiling`, derived from `baseline_tokens` × `headroom_pct`. It is
 *     the FLOOR of the measured ceiling, so raising it raises the ceiling
 *     directly. ADR-264's sentence applies to it verbatim.
 *   · every existing exception's `granted_tokens` — enlarging a live grant is
 *     a raise wearing a break-glass label.
 *   · every existing exception's `watermark` — the watermark is what pins the
 *     base while a grant is live, so raising it launders the grant into the
 *     next base, which is precisely the failure the watermark exists to stop.
 *
 * A NEW exception id is deliberately NOT a violation: recording a fresh,
 * approved, dated grant is the break-glass path working. Editing one that
 * already existed is not.
 *
 * WHAT IT CANNOT DO, STATED PLAINLY
 * ---------------------------------
 * The change under review can edit this file. Both council seats named that as
 * the defect fatal to a mechanism that GRANTS budget, and it is not fatal to
 * one that only REFUSES: disabling this check requires visibly editing it, and
 * every gate in this repository already rests on that same review. A ratchet
 * whose only failure mode is "someone deleted the ratchet" is strictly better
 * than the sentence it replaces, which had no failure mode because it did
 * nothing. The 2026-09-10 verdict added one mitigation on top and named its
 * limit in the same breath: CI runs this code AS IT EXISTS AT THE BASE REF, so
 * a same-PR weakening cannot measure its own change — *"the mechanism does not
 * prevent the exploit; it makes the exploit auditable."*
 */
import { spawnSync } from 'node:child_process';

/** Repo-relative path of the budget config the bounds live in. */
export const BUDGET_CONFIG_PATH = 'src/config/preamble-payload-budget.json';
/** Repo-relative path of the break-glass ledger the grant bounds live in. */
export const EXCEPTIONS_CONFIG_PATH = 'src/config/preamble-payload-exceptions.json';

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

/** Named shrink-only numbers, keyed by a stable bound id. */
export type BoundSet = Record<string, number>;

export interface BoundsRatchetVerdict {
    ok: boolean;
    violations: string[];
    /** The bounds read at the base ref, or `null` when they could not be read. */
    baseBounds: BoundSet | null;
    /** The ref compared against, or `null` when none resolved. */
    baseRef: string | null;
    /** Why the comparison was skipped, when it was. Printed, never silent. */
    note: string | null;
    /**
     * `false` means the bounds could not be READ, not that one rose.
     *
     * Two refusals reach a caller with `ok: false` and they need opposite
     * actions: a risen bound is fixed by lowering the addition, an unverifiable
     * one by repairing the checkout. A completion review caught both being
     * rendered as "ROSE", which would send an operator to shrink a rule over
     * what was a fetch problem.
     */
    verified: boolean;
}

/**
 * The bound map, derived identically from head and base configs.
 *
 * ONE function for both sides, on purpose: two derivations of one boundary is
 * the drift shape that let the grace ceiling rise twice under a sentence
 * forbidding it. `budget` and `exceptions` are parsed JSON, or `null` when the
 * file is absent — an absent exceptions ledger contributes no bounds, which is
 * correct: there are no grants to protect.
 */
export function boundsFrom(budget: unknown, exceptions: unknown): BoundSet | null {
    const b = (budget ?? null) as Record<string, unknown> | null;
    if (b === null) return null;
    const baseline = Number(b['baseline_tokens']);
    const headroom = Number(b['headroom_pct']);
    if (!Number.isFinite(baseline) || !Number.isFinite(headroom)) return null;
    // `design_ceiling` is the whole config-side bound now. The retained stored
    // allowance stage 1 kept beside it was deleted in stage 2 (ADR-276), so a
    // tree at or below design is bounded by this number and a tree above it is
    // bounded by its own base measurement — neither of which lives in a field
    // anyone can edit upward.
    const out: BoundSet = { design_ceiling: Math.round(baseline * (1 + headroom / 100)) };

    const ex = (exceptions ?? null) as Record<string, unknown> | null;
    const list = ex === null ? null : ex['exceptions'];
    if (Array.isArray(list)) {
        for (const item of list) {
            const e = (item ?? {}) as Record<string, unknown>;
            const id = e['id'];
            if (typeof id !== 'string' || id.trim() === '') continue;
            const granted = Number(e['granted_tokens']);
            const watermark = Number(e['watermark']);
            if (Number.isFinite(granted)) out[`exception:${id}:granted_tokens`] = granted;
            if (Number.isFinite(watermark)) out[`exception:${id}:watermark`] = watermark;
        }
    }
    return out;
}

function showAtRef(git: GitRunner, repoRoot: string, ref: string, relPath: string): string | null {
    const r = git(['show', `${ref}:${relPath}`], repoRoot);
    return r.ok ? r.stdout : null;
}

/**
 * A condition that stops the comparison: skip when advisory, refuse when not.
 *
 * One helper for all causes rather than an inline branch each, so the posture
 * cannot drift between them — the failure this closes was four independent
 * `ok: true` returns that all had to be found before any of them could be
 * trusted.
 */
function unverified(reason: string, requireBase: boolean, baseRef: string | null): BoundsRatchetVerdict {
    if (requireBase) {
        return {
            ok: false,
            verified: false,
            baseBounds: null,
            baseRef,
            note: `${reason}, so the shrink-only bounds were NOT verified in this run`,
            violations: [
                `the shrink-only bounds could not be verified: ${reason}. This run is `
                    + 'ENFORCING, so an unverifiable bound refuses rather than skips — an '
                    + 'unreadable base would otherwise grant budget on an infrastructure '
                    + 'failure. This is NOT a bound rise: fix the checkout (a full fetch '
                    + 'of the base ref) rather than lowering the addition.',
            ],
        };
    }
    return {
        ok: true,
        verified: false,
        violations: [],
        baseBounds: null,
        baseRef,
        note: `${reason}, so the shrink-only bounds were NOT verified in this run`,
    };
}

/**
 * Compare every shrink-only bound in this tree against the one at the base ref.
 *
 * TWO POSTURES, AND WHICH ONE APPLIES IS THE CALLER'S TO DECLARE.
 *
 * Advisory (the default): a base ref or base config that cannot be read SKIPS,
 * reported in both the human and JSON output so it cannot pass for a check.
 * That default is not laziness and the original reasoning still holds — a
 * shallow clone, a first commit and a detached build all legitimately have no
 * base, and a gate that reds on them gets switched off, which is how a
 * repository loses the enforcement it just built.
 *
 * Enforcing (`requireBase: true`): the same conditions REFUSE. An AI council
 * (2/2, 2026-09-10) made this blocking for the move to a base-measured ceiling,
 * because the asymmetry inverts once the base ref stops being a cross-check and
 * becomes the ceiling itself. Today an unreadable base costs a comparison;
 * there it would grant an unbounded budget on an infrastructure failure.
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
     * The shrink-only numbers as they stand in THIS tree.
     *
     * Passed in rather than re-read here so head and base go through
     * `boundsFrom` from the caller's own configuration objects — including an
     * effective value the caller may have taken from a flag rather than the
     * file, which is the second path a bound could otherwise be widened by.
     */
    headBounds: BoundSet;
}): BoundsRatchetVerdict {
    const git = opts.git ?? realGit;
    const requireBase = opts.requireBase === true;
    if (opts.baseRef === null || opts.baseRef.trim() === '') {
        return unverified('no base ref resolved', requireBase, null);
    }
    const cfg = showAtRef(git, opts.repoRoot, opts.baseRef, BUDGET_CONFIG_PATH);
    if (cfg === null) {
        return unverified(`${BUDGET_CONFIG_PATH} could not be read at ${opts.baseRef}`, requireBase, opts.baseRef);
    }
    let baseBudget: unknown;
    try {
        baseBudget = JSON.parse(cfg);
    } catch {
        return unverified(`${BUDGET_CONFIG_PATH} at ${opts.baseRef} is not parseable`, requireBase, opts.baseRef);
    }
    // An absent exceptions ledger at the base ref is normal — it did not exist
    // before this mechanism landed, and a ref predating it has no grants to
    // protect. An unparseable one is not, and refuses like a bad budget.
    const exRaw = showAtRef(git, opts.repoRoot, opts.baseRef, EXCEPTIONS_CONFIG_PATH);
    let baseExceptions: unknown = null;
    if (exRaw !== null) {
        try {
            baseExceptions = JSON.parse(exRaw);
        } catch {
            return unverified(
                `${EXCEPTIONS_CONFIG_PATH} at ${opts.baseRef} is not parseable`,
                requireBase,
                opts.baseRef,
            );
        }
    }

    const baseBounds = boundsFrom(baseBudget, baseExceptions);
    if (baseBounds === null) {
        return unverified(
            `there are no shrink-only bounds at ${opts.baseRef} to ratchet against`,
            requireBase,
            opts.baseRef,
        );
    }

    const violations: string[] = [];
    for (const [name, head] of Object.entries(opts.headBounds)) {
        const base = baseBounds[name];
        // A bound absent at the base is a NEW one — a freshly recorded grant,
        // which is the break-glass path working rather than a rise.
        if (base === undefined) continue;
        if (head > base) violations.push(explain(name, base, head, opts.baseRef));
    }

    // DELETION CANNOT DISCHARGE DEBT. A grant that existed at the base and is
    // gone at head was not repaid, it was erased — the 2026-09-11 council's
    // blocking finding #3, and the one failure a shrink-only comparison misses
    // by construction, because a removed number is not a smaller number.
    // Only `exception:` bounds are checked for deletion: `design_ceiling` is
    // always present, and the stored allowance that used to need an exemption
    // here no longer exists.
    const reportedDeletions = new Set<string>();
    for (const name of Object.keys(baseBounds)) {
        if (!name.startsWith('exception:')) continue;
        if (opts.headBounds[name] !== undefined) continue;
        const m = /^exception:(.+):(?:granted_tokens|watermark)$/.exec(name);
        const id = m === null ? name : String(m[1]);
        // One record carries two bounds; report the record once.
        if (reportedDeletions.has(id)) continue;
        reportedDeletions.add(id);
        violations.push(
            `standing-payload exception '${id}' existed at ${opts.baseRef} and is gone at head. A deleted ` +
                'record is not a repaid one: repayment is established by the payload returning to the ' +
                'watermark, and erasing the entry erases the debt along with the evidence of it. Mark it ' +
                'repaid once the measurement supports that, or leave it in place.',
        );
    }

    if (violations.length > 0) {
        return { ok: false, verified: true, baseBounds, baseRef: opts.baseRef, note: null, violations };
    }
    return { ok: true, verified: true, violations: [], baseBounds, baseRef: opts.baseRef, note: null };
}

/** One refusal message per bound kind — a generic "a bound rose" sends the
 *  reader nowhere, and the three kinds have three different fixes. */
function explain(name: string, base: number, head: number, baseRef: string): string {
    const rose = `rose from ${String(base)} to ${String(head)} against ${baseRef}`;
    if (name === 'design_ceiling') {
        return (
            `the standing-payload design ceiling ${rose}. It derives from baseline_tokens × ` +
            `headroom_pct in ${BUDGET_CONFIG_PATH}, and it is the FLOOR of the measured ceiling, so ` +
            'raising it widens every future budget without adding a token of payload. ADR-264 decided ' +
            'that standing-rule growth needs a compensating reduction elsewhere, not a bigger ceiling. ' +
            'Lower the addition, migrate the prose out of the standing rule, or reduce another standing ' +
            'asset by the same amount.'
        );
    }
    const m = /^exception:(.+):(granted_tokens|watermark)$/.exec(name);
    if (m !== null && m[2] === 'granted_tokens') {
        return (
            `standing-payload exception '${String(m[1])}' had its grant ${rose}. Enlarging a grant that ` +
            'already exists is a ceiling raise wearing a break-glass label. Record a NEW approved, dated ' +
            'exception instead, so the enlargement carries its own approver, reason and expiry.'
        );
    }
    if (m !== null) {
        return (
            `standing-payload exception '${String(m[1])}' had its watermark ${rose}. The watermark pins the ` +
            'base while the grant is live, and raising it launders the granted tokens into the next base — ' +
            'which is exactly the failure the watermark exists to prevent. It is the payload measured ' +
            'BEFORE the grant and does not change afterwards.'
        );
    }
    return `the shrink-only bound '${name}' ${rose}, and ${BUDGET_CONFIG_PATH} says it may not move upward.`;
}
