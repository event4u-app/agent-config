/**
 * The ADR-236 rule partition, decided per HOST directory on that host's own
 * evidence.
 *
 * ## Why the decision moved from per-run to per-directory
 *
 * The filter used to sit in `condense.ts::_scoped_rule_basenames()`, which runs
 * once per generation, so `partitionActive` — a claude-only fingerprint against
 * `installed.lock` — decided for every host at once. That contradicted
 * `partitionEligibility.ts`'s own fail-safe reasoning, which refuses to withhold a
 * cursor artefact on claude's evidence because it "would deliver it nowhere", and
 * it was measurably wrong in both directions on 2026-08-22 (partition ACTIVE,
 * freshly generated worktree):
 *
 * ```
 *   .claude/rules      13 files, 13 package-only,   0 global-only
 *   .clinerules        14 files, 13 package-only,   0 global-only   ← narrowed on
 *                                                                     borrowed evidence
 *   .cursor/rules     126 files, 26 package-only, 100 global-only   ← never narrowed
 *   .windsurf/rules   113 files, 13 package-only, 100 global-only   ← never narrowed
 *   .augment/rules    118 files, 15 package-only, 103 global-only   ← never narrowed
 * ```
 *
 * So the narrowing is per directory and gated on real evidence:
 * {@link hostLayerCarries} reads that host's global directory and answers whether
 * every name about to be withheld is actually there. No layer, an unreadable layer,
 * or one missing a single name → the full projection is returned. A withhold now
 * costs a directory read; the alternative cost a rule.
 *
 * ## Why it lives here rather than in condense.ts
 *
 * Four call sites consume it — the symlink emit plan, the cursor `.mdc` emitter,
 * the windsurf emitter, the augment projector — and four sites deciding this
 * separately is exactly how three of them came to disagree. It is in `src/install/`
 * beside {@link partitionActive} and {@link hostLayerCarries}, the two predicates
 * it composes, rather than in the 2,700-line generator that calls it.
 *
 * ## The classification source is the PROJECTION, not the authored tree
 *
 * `rulesSource` is `dist/agent-src/rules` at every call site, deliberately. A rule
 * absent from `dist/` is compile-disabled and never projected, so it can be neither
 * withheld nor duplicated — classifying from `src/rules` would count
 * `telegraph-speak.md` (compile-disabled: 119 rules / 16 package-only in `src/`,
 * 118 / 15 in `dist/`) and disagree with the emitter by exactly one file.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isExclusivelyPackageOnly, partitionActive } from './partitionEligibility.js';
import { hostLayerCarries, toolIdForProjectRuleDir } from './globalRuleLayers.js';
/**
 * Narrow one directory's rule list to the package-only set — but only when THIS
 * host's global layer is verified to carry what would be withheld.
 *
 * Returns a copy of `rules` unchanged in every uncertain case. That direction is
 * the whole design: an unnecessary duplicate costs context, a wrong withhold costs
 * the rule.
 */
export function partitionRulesForDir(opts) {
    const { toolDir, rules, projectRoot, rulesSource } = opts;
    if (!partitionActive(projectRoot)) {
        return [...rules];
    }
    const toolId = toolIdForProjectRuleDir(toolDir);
    if (toolId === null) {
        // An unmapped directory has no global layer this code can point at, so
        // there is no evidence to withhold on.
        return [...rules];
    }
    const packageOnly = rules.filter((r) => isExclusivelyPackageOnly(path.join(rulesSource, r)));
    const keep = new Set(packageOnly);
    const withheld = rules.filter((r) => !keep.has(r));
    const home = opts.userHome ?? process.env['HOME'] ?? os.homedir();
    const verdict = hostLayerCarries(toolId, withheld, home);
    if (!verdict.carries) {
        opts.announce?.(`  ⚠️  ${toolDir}: full projection kept — ${toolId}'s global layer ${verdict.reason}` +
            (verdict.missing.length > 0
                ? ` (${String(verdict.missing.length)} rule(s) not there, e.g. ` +
                    `${verdict.missing.slice(0, 3).join(', ')})`
                : ''));
        return [...rules];
    }
    return packageOnly;
}
// ── The older, weaker duplicate-avoidance mechanism ──────────────────────────
//
// `projection.scope_dedup` (default OFF) predates the partition and solves the
// same problem with a narrower method: skip a project copy only when its
// user-scope twin is BYTE-IDENTICAL. It moved here from condense.ts alongside the
// partition because the two are one subject — a reader deciding how a duplicate is
// avoided should find both in one file rather than one here and one in a
// 2,700-line generator. Behaviour is unchanged; only `MODULE_STATE` reads became
// parameters.
/** `fs.statSync(p).isFile()`, false on any error — condense.ts's `_isFile`. */
function isFile(p) {
    try {
        return fs.statSync(p).isFile();
    }
    catch {
        return false;
    }
}
/**
 * Per-tool user-scope rule directory, for the scope-dedup below. Only tools
 * whose host reads a user-scope rules directory can have a redundant twin;
 * everything else has nothing to de-duplicate against.
 */
const USER_SCOPE_RULE_DIRS = {
    '.claude/rules': path.join('.claude', 'rules'),
};
export function dedupableRules(opts) {
    const { toolDir: tool_dir, rules, userHome, rulesSource } = opts;
    const relative = USER_SCOPE_RULE_DIRS[tool_dir];
    if (relative === undefined) {
        return new Set();
    }
    // A hostile or simply absent $HOME must make the dedup inert, not
    // adventurous. In a container `$HOME` is often unset (so `homedir()` can
    // resolve to `/`) or world-writable, and this function decides which rules
    // to STOP emitting — reading an unexpected tree there is how a projection
    // silently loses a rule. Council review of PR #1055 raised exactly this.
    let userDirStat;
    const userDir = path.join(userHome, relative);
    try {
        userDirStat = fs.statSync(userDir);
    }
    catch {
        return new Set();
    }
    if (!userDirStat.isDirectory()) {
        return new Set();
    }
    // World-writable user scope: anyone on the box could plant a byte-identical
    // twin and thereby delete a rule from the project projection. Refuse.
    if ((userDirStat.mode & 0o002) !== 0) {
        opts.announce?.(`  ⚠️  ${tool_dir}: user-scope rules dir is world-writable — scope-dedup skipped`);
        return new Set();
    }
    const skip = new Set();
    for (const rule of rules) {
        const twin = path.join(userDir, rule);
        const source = path.join(rulesSource, rule);
        try {
            if (!isFile(twin) || !isFile(source))
                continue;
            if (fs.readFileSync(twin).equals(fs.readFileSync(source))) {
                skip.add(rule);
            }
        }
        catch {
            // An unreadable twin is simply not de-duplicable — emit the project copy.
        }
    }
    return skip;
}
//# sourceMappingURL=ruleLayerPartition.js.map