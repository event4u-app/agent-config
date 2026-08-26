#!/usr/bin/env tsx
/**
 * check_rule_projection_integrity.ts — the host rule trees are COMPLETE and
 * FRESH against `dist/agent-src/rules/`, read as they stand on disk.
 *
 * WHY THIS GATE EXISTS (road-to-conformance-round5 Phase 1, measured 2026-08-07)
 * ---------------------------------------------------------------------------
 * `docs/contracts/rule-router.md` (§ "The router earns its place as a
 * **compile-time** artifact") states that under every shipped default nothing
 * loads `dist/router.json` at runtime, so **projection is the only reach
 * mechanism there is**:
 *
 * CORRECTED 2026-08-26. This docblock used to cite that section's "measured:
 * zero consumers under `src/scripts/hooks/`", and that measurement is stale: the
 * `rule-inject` concern reads the router via `_lib/rule_injection.ts:76-79` and
 * is bound on three slots. The gate's rationale survives the correction because
 * the concern is DEFAULT-OFF and returns before reading the router unless
 * `lean_projection.mode: delivery` is set — so on a shipped default, projection
 * IS still the only reach mechanism. What no longer holds is the stronger claim
 * that no such mechanism exists. Stated here rather than quietly re-worded,
 * because a gate whose stated reason rests on a refuted premise is exactly the
 * decoration ADR-127 rejects: a non-kernel rule activates by the model's judgment over text
 * already in context, and the per-tool rule tree is what puts it there. That
 * makes the state of the projection load-bearing, and it was broken:
 *
 *   - `.claude/rules/` in the working checkout held **92** entries. A
 *     regeneration in a clean worktree produces **108**. The tree was last
 *     generated **2026-07-05**, and **21 rules added since then had no entry** —
 *     among them `secret-vcs-guard`, `broken-access-control`,
 *     `senior-engineering-discipline`, `evaluator-independence`,
 *     `session-canary`, `settings-ask-protocol`, `active-remediation`. At
 *     project scope those 21 obligations were carried by nothing. The same 21
 *     were absent from `.clinerules/` and `.cursor/rules/*.md`.
 *   - The trees are gitignored and untracked, so no diff review sees the gap.
 *
 * WHY THE EXISTING GATES DO NOT CATCH IT
 * --------------------------------------
 *   - `check_bridge_derivation` **regenerates** the trees and then diffs, so it
 *     can only ever observe a fixpoint; both CI and the pre-push chain run it
 *     ahead of anything else, which is why five weeks of staleness were invisible.
 *     Its symlink leg asserts that entries which EXIST resolve — a missing entry
 *     is not a wrong entry.
 *   - `check_generator_output_coverage.ts:37` asserts only that the output
 *     *root* is classified in the ignore manifest, never its contents.
 *   - `check_condensation.ts` stops at `dist/`.
 *
 * So the last hop — the one that decides what the model actually sees — was
 * ungated. This gate reads the tree WITHOUT touching it: no regeneration, no
 * writes. That is the whole design constraint, and it is why the check is a
 * separate script rather than a third leg on `check_bridge_derivation`.
 *
 * HONEST SCOPE — where each leg has teeth
 * ---------------------------------------
 * On a fresh CI checkout the trees do not exist at all (gitignored), so CI must
 * run this AFTER `task generate-tools`, where it is a **generator-regression**
 * check: it proves the generator emitted every rule it planned to. The stale
 * case is caught on a developer's working checkout, which is why the pre-push
 * `preflight` chain runs it FIRST — before `check_bridge_derivation` regenerates
 * and erases the evidence. Both registrations are deliberate; neither subsumes
 * the other.
 *
 * THE TWO ASSERTIONS
 * ------------------
 * 1. COMPLETENESS. Every rule the generator would emit has an entry in every
 *    active host rule tree. The expected set comes from
 *    `condense.projected_rule_trees()` — the generator's OWN emit plan, which
 *    `generate_rule_symlinks` also consumes. It is deliberately NOT a list in
 *    this file and deliberately NOT `dist/agent-src/rules/` verbatim: a
 *    hand-maintained array goes obsolete silently, and the dist directory
 *    over-counts by the ADR-004 `type: manual` rules the trees omit on purpose
 *    (113 files on disk, 5 manual, 108 projected). A completeness check keyed on
 *    a non-canonical source propagates that source's mistakes as requirements.
 * 2. FRESHNESS. No rule in `dist/agent-src/rules/` may be newer than the
 *    projection entry pointing at it. Entries are symlinks, so the comparison
 *    uses `lstat` on the LINK, never `stat`: `stat` follows the link and returns
 *    the target's own mtime, which would compare the dist file with itself and
 *    make the assertion vacuous. Verified empirically before wiring — with a
 *    target touched after the link was created, `lstat(link).mtimeMs !==
 *    stat(target).mtimeMs` while `stat(link).mtimeMs === stat(target).mtimeMs`.
 *    Under `lean_projection: thin` the entries are real files rather than
 *    symlinks; `lstat` is correct there too (the file's own mtime).
 *
 * NOT IN SCOPE. `.cursor/rules/*.mdc` and `.windsurf/rules/` are written by
 * different generators with their own filters; this gate covers the three trees
 * `condense.TOOL_DIRS` projects (`.claude/rules`, `.cursor/rules`, `.clinerules`)
 * and their `.md` entries, which is where the measured defect was.
 *
 * CLI: `--root <path>` (default: this repo) · `--quiet` suppresses the
 * per-target ledger line. Exit 0 = complete and fresh, or no tool active at all
 * (announced on stderr — see `auditRuleProjection`); 1 = any gap, any stale
 * entry, a ledger accounting error, or a dead scan scope.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger, UnaccountedTargetsError } from './_lib/gate_ledger.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { _resetStateForTest as _pointCondenseAt, projected_rule_trees } from './condense.js';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Where the projected rules are condensed to — the freshness comparison's left side. */
const DIST_RULES = path.join('dist', 'agent-src', 'rules');

export type ProjectionFindingKind = 'missing' | 'stale' | 'dangling';

export interface ProjectionFinding {
    /** Repo-relative tool dir, e.g. `.claude/rules`. */
    tree: string;
    /** Rule basename, e.g. `secret-vcs-guard.md`. */
    rule: string;
    kind: ProjectionFindingKind;
    message: string;
}

export interface ProjectionAudit {
    findings: ProjectionFinding[];
    /** `tree` → whether the directory exists at all; an absent tree fails every rule under it. */
    treePresent: Record<string, boolean>;
    ledger: GateLedger;
}

function _lstatOrNull(p: string): fs.Stats | null {
    try {
        return fs.lstatSync(p);
    } catch {
        return null;
    }
}

/**
 * Audit `expected` (tool dir → rule basenames) against the trees under `repoRoot`.
 *
 * Pure read: every branch stats, none writes. `expected` is injected rather than
 * computed here so the caller controls which root the generator's emit plan was
 * derived from, and so a test can pin an expectation without a settings file.
 */
export function auditRuleProjection(
    repoRoot: string,
    expected: Readonly<Record<string, readonly string[]>>,
): ProjectionAudit {
    const ledger = new GateLedger('check_rule_projection_integrity');
    const findings: ProjectionFinding[] = [];
    const treePresent: Record<string, boolean> = {};

    for (const [tree, rules] of Object.entries(expected)) {
        ledger.plan(rules.map((r) => `${tree}/${r}`));
    }

    // The planned set is every (tree × rule) pair, and zero has TWO causes that
    // are not the same defect. `projected_rule_trees()` returns one key per
    // ACTIVE tool dir, so the key count is the discriminator:
    //
    //   - keys > 0, rules == 0 → the rule corpus is dead. No rule reached
    //     `dist/agent-src/rules/`, or every scope filter rejected every rule,
    //     and a green checkmark here would cover an assertion never evaluated.
    //     This still throws.
    //   - keys == 0 → `agents/.agent-tools.yml` selects zero tools, which
    //     `_active_tools()` honours by design. There is no projection surface
    //     in this checkout, so there is nothing to be stale or missing. That is
    //     an absent optional surface, not a moved root.
    //
    // Conflating the two made the gate unsatisfiable on a supported config: it
    // runs FIRST in the pre-push `preflight` chain, so a maintainer who
    // deactivates the per-tool trees (they duplicate a globally installed
    // `~/.claude`) could not push at all, with no fix available short of the
    // env escape hatch. A gate whose only compliant path is to change an
    // unrelated setting is not a gate. `main()` prints the skip explicitly —
    // the empty case must be LOUD, never a silent green.
    const noActiveTree = Object.keys(expected).length === 0;
    assertScanned({
        gate: 'check_rule_projection_integrity',
        scanned: Object.values(expected).reduce((n, rules) => n + rules.length, 0),
        units: 'projected rule entries',
        roots: [DIST_RULES, ...Object.keys(expected)],
        ...(noActiveTree
            ? {
                  allowEmpty:
                      'OPTIONAL_INPUT: no host rule tree is active — agents/.agent-tools.yml ' +
                      'selects zero tools, so the surface this gate audits does not exist in ' +
                      'this checkout. With one or more active tools the emit plan carries the ' +
                      'full rule set by construction, so a dead dist/agent-src/rules/ still fails here.',
              }
            : {}),
    });

    for (const [tree, rules] of Object.entries(expected)) {
        const treeDir = path.join(repoRoot, tree);
        const treeStat = _lstatOrNull(treeDir);
        treePresent[tree] = treeStat !== null && treeStat.isDirectory();

        for (const rule of rules) {
            const target = `${tree}/${rule}`;
            const entry = _lstatOrNull(path.join(treeDir, rule));
            if (entry === null) {
                findings.push({
                    tree,
                    rule,
                    kind: 'missing',
                    message: treePresent[tree]
                        ? 'no projection entry — the rule reaches the model at no project scope'
                        : 'projection tree does not exist',
                });
                ledger.fail(target, 'missing projection entry');
                continue;
            }

            const dist = path.join(repoRoot, DIST_RULES, rule);
            let distStat: fs.Stats;
            try {
                distStat = fs.statSync(dist);
            } catch {
                // Unreachable while `expected` derives from this same dist tree,
                // but reachable if the tree changes under a running gate. Report
                // rather than crash: a projection entry whose source is gone is
                // a dangling link, which is a real defect either way.
                findings.push({
                    tree,
                    rule,
                    kind: 'dangling',
                    message: `projection entry has no source at ${DIST_RULES}/${rule}`,
                });
                ledger.fail(target, 'dangling projection entry');
                continue;
            }

            // `entry` is an lstat: for a symlink that is the LINK's mtime, which
            // is what "when was this projected" means. `statSync` here follows
            // nothing — dist rules are regular files.
            if (distStat.mtimeMs > entry.mtimeMs) {
                findings.push({
                    tree,
                    rule,
                    kind: 'stale',
                    message:
                        `source is newer than the projection entry ` +
                        `(${DIST_RULES}/${rule} ${new Date(distStat.mtimeMs).toISOString()} > ` +
                        `entry ${new Date(entry.mtimeMs).toISOString()})`,
                });
                ledger.fail(target, 'stale projection entry');
                continue;
            }

            ledger.complete(target);
        }
    }

    return { findings, treePresent, ledger };
}

/** Group findings by tree, preserving rule order, for a report a reader can act on. */
export function renderFindings(audit: ProjectionAudit): string[] {
    const lines: string[] = [];
    const byTree = new Map<string, ProjectionFinding[]>();
    for (const f of audit.findings) {
        const bucket = byTree.get(f.tree);
        if (bucket === undefined) byTree.set(f.tree, [f]);
        else bucket.push(f);
    }
    for (const [tree, group] of byTree) {
        const missing = group.filter((f) => f.kind === 'missing');
        const stale = group.filter((f) => f.kind === 'stale');
        const dangling = group.filter((f) => f.kind === 'dangling');
        if (audit.treePresent[tree] !== true) {
            lines.push(`${tree}: tree does not exist — ${String(group.length)} rule(s) reach the model at no project scope`);
        }
        if (missing.length > 0) {
            lines.push(`${tree}: ${String(missing.length)} rule(s) missing from the projection:`);
            for (const f of missing) lines.push(`    - ${f.rule}`);
        }
        if (stale.length > 0) {
            lines.push(`${tree}: ${String(stale.length)} projection entry/entries older than their source:`);
            for (const f of stale) lines.push(`    - ${f.rule} — ${f.message}`);
        }
        if (dangling.length > 0) {
            lines.push(`${tree}: ${String(dangling.length)} dangling projection entry/entries:`);
            for (const f of dangling) lines.push(`    - ${f.rule} — ${f.message}`);
        }
    }
    return lines;
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const quiet = args.includes('--quiet');
    const idx = args.indexOf('--root');
    const root = path.resolve(idx !== -1 ? (args[idx + 1] ?? REPO_ROOT) : REPO_ROOT);

    // `condense`'s emit plan reads `MODULE_STATE`, whose only root seam is this
    // reassignment. Repointing it is what makes `--root` mean the same thing for
    // the expected set and for the trees being audited — without it the gate
    // would compare this repo's rules against another checkout's projection.
    _pointCondenseAt(root);

    let audit: ProjectionAudit;
    try {
        audit = auditRuleProjection(root, projected_rule_trees());
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    // Zero active trees is a legitimate config (see `auditRuleProjection`), but
    // it means this run audited nothing. Say so on its own line instead of
    // letting the success line below report "0 entries across 0 trees", which
    // reads as a pass to every human and every log scraper.
    if (Object.keys(audit.treePresent).length === 0) {
        process.stderr.write(
            '⚠️  check_rule_projection_integrity: no host rule tree is active ' +
                '(agents/.agent-tools.yml selects zero tools) — nothing to audit. This gate ' +
                'has teeth only where a tool is active; CI activates all eight.\n',
        );
        return 0;
    }

    const lines = renderFindings(audit);

    let tally;
    try {
        tally = quiet ? audit.ledger.finalize() : audit.ledger.report();
    } catch (exc) {
        if (exc instanceof UnaccountedTargetsError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (lines.length > 0) {
        for (const l of lines) process.stderr.write(`❌  ${l}\n`);
        process.stderr.write(
            `\nThe host rule trees are the ONLY carrier for a non-kernel rule's prose ` +
                `(docs/contracts/rule-router.md § no runtime router). Regenerate with ` +
                `\`task generate-tools\`, then re-run this gate.\n`,
        );
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  ${String(tally.completed)} rule projection entries complete and fresh across ` +
                `${String(Object.keys(audit.treePresent).length)} host rule tree(s)\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
        return true;
    }
    // A symlinked invocation makes the raw URLs differ (import.meta.url is the
    // resolved real path, argv[1] keeps the symlink). Compare realpaths, or the
    // CLI silently no-ops when run through a projection — the bundled-CLI-entry
    // landmine this repo has already paid for once.
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
