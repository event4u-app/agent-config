/**
 * The single-delivery partition predicate — one artefact, one layer.
 *
 * ## What it decides
 *
 * Two layers deliver agent artefacts: a machine-local project layer at
 * `<repo>/.claude/` (gitignored, 0 tracked files, rewritten by every
 * `task generate-tools`) and a host-global layer at `~/.claude/` (written by
 * `agent-config install`, never by the build). Measured 2026-08-19 on a freshly
 * regenerated tree: **110 rules arrive twice**, and standing rule prose is
 * 203,873 tokens against a 110,000 cap (185.3 %).
 *
 * ADR-236 partitions them: an artefact that exists ONLY for this package stays
 * in the project layer; everything else is delivered only globally. That takes
 * `<repo>/.claude/` from 111 rules and 338 skills to **16 rules and zero
 * skills**.
 *
 * ## Why the predicate is fail-safe and never fails the build
 *
 * The partition is a removal, so the build loses its repair path: it can no
 * longer heal a stale global layer by regenerating, because it stops writing
 * those files. Every uncertainty therefore resolves to `standalone/full` — the
 * pre-partition behaviour — and **never** to a refusal:
 *
 * `.github/workflows/consistency.yml:169` runs `task generate-tools` on a fresh
 * checkout where, by that workflow's own comment at `:172-174`, the host rule
 * trees are gitignored and absent. An option that made a missing global layer a
 * hard failure was eliminated by that fact in the 2026-08-19 council round, not
 * by preference. Under-governing a checkout is the one regression this estate
 * exists to prevent; breaking the Consistency pipeline is the other. Full
 * projection is the only branch that does neither.
 *
 * ## Why content and not a version number
 *
 * Rationale and the 153-skill measurement that decided it: see
 * `hostLayerFingerprint.ts`. Version equality is checked too, but as a cheap
 * pre-filter — it is necessary, never sufficient.
 *
 * ## Contract
 *
 * Side-effect-free, no I/O of its own (callers supply the facts), no CLI entry,
 * no `process.exit`. Ships inside the consumer installer bundle, same
 * constraint as `ruleInScope.ts`.
 */
import * as fs from 'node:fs';
import { parseFrontmatter } from './ruleInScope.js';
/** The workspace id that marks an artefact as existing only for this package. */
export const MAINTAINER_WORKSPACE = 'agent-config-maintainer';
/**
 * Select the delivery mode. Total function: always returns a verdict, never
 * throws, never refuses.
 *
 * The order of the guards is the fail-safe order — cheapest and most decisive
 * first, so the fingerprint is computed only when everything else already
 * agrees.
 */
export function partitionVerdict(inputs) {
    if (!inputs.hostLayerPresent) {
        return {
            mode: 'standalone/full',
            reason: 'no host-global layer on this machine',
        };
    }
    const lock = inputs.lockfile;
    if (lock === null) {
        return {
            mode: 'standalone/full',
            reason: 'host layer present but no install record (installed.lock absent)',
        };
    }
    const recorded = lock.agent_config_version;
    if (!recorded) {
        return {
            mode: 'standalone/full',
            reason: 'install record carries no version',
        };
    }
    // Exact equality, deliberately not `>=`. A NEWER global layer is not a
    // superset: a later release may have renamed or removed an artefact this
    // checkout still expects, and ordering does not establish substitutability.
    if (recorded !== inputs.projectVersion) {
        return {
            mode: 'standalone/full',
            reason: `version mismatch (installed ${recorded}, building ${inputs.projectVersion})`,
        };
    }
    const installedFp = lock.host_layer_fingerprint;
    if (!installedFp) {
        return {
            mode: 'standalone/full',
            reason: 'install predates host-layer fingerprinting — re-run `agent-config install` to enable the partition',
        };
    }
    let expected;
    try {
        expected = inputs.expectedFingerprint();
    }
    catch {
        return {
            mode: 'standalone/full',
            reason: 'could not compute the expected host-layer fingerprint',
        };
    }
    if (installedFp !== expected) {
        return {
            mode: 'standalone/full',
            reason: 'host-layer content differs from this checkout — re-run `agent-config install`',
        };
    }
    return {
        mode: 'dual-layer/partitioned',
        reason: `host layer verified at ${recorded} (fingerprint ${installedFp.slice(0, 12)})`,
    };
}
/**
 * Does this artefact exist ONLY for this package?
 *
 * True iff `workspaces:` is present, non-empty, and its every entry is
 * {@link MAINTAINER_WORKSPACE}. Measured 2026-08-20: exactly **16** rules in
 * `src/rules/` satisfy this — the figure ADR-236 partitions on.
 *
 * The direction of the default is the opposite of `rule_in_scope`'s, and that
 * is deliberate rather than an inconsistency. There, an untagged artefact ships
 * — over-shipping is the safe error for a scope filter. Here, an untagged
 * artefact is NOT package-only, so it is delivered globally and withheld from
 * the project layer. Both defaults resolve toward "the artefact is generally
 * useful"; only one of them is about withholding.
 */
export function isExclusivelyPackageOnly(source_path) {
    let meta;
    try {
        [meta] = parseFrontmatter(fs.readFileSync(source_path, 'utf-8'));
    }
    catch {
        return false; // unreadable → not package-only → delivered globally
    }
    const raw = meta['workspaces'];
    if (!Array.isArray(raw) || raw.length === 0) {
        return false;
    }
    return raw.every((w) => String(w) === MAINTAINER_WORKSPACE);
}
//# sourceMappingURL=partitionEligibility.js.map