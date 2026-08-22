#!/usr/bin/env tsx
/**
 * check_rule_layer_partition.ts — one rule, one layer, across ALL FIVE host rule
 * trees, not only `.claude/`.
 *
 * WHY THIS GATE EXISTS (measured 2026-08-22)
 * -----------------------------------------
 * ADR-236 decided that a rule is delivered from exactly one layer: package-only
 * rules stay in the project tree, everything else arrives from the host's global
 * directory and is withheld from the project tree. Measured in a freshly
 * generated worktree with `partitionActive: true`, it holds for one host in five:
 *
 * ```
 *   .claude/rules      13 files, 13 package-only,   0 global-only
 *   .clinerules        14 files, 13 package-only,   0 global-only
 *   .cursor/rules     126 files, 26 package-only, 100 global-only
 *   .windsurf/rules   113 files, 13 package-only, 100 global-only
 *   .augment/rules    118 files, 15 package-only, 103 global-only
 * ```
 *
 * The two symlink trees are right because `generate_rule_symlinks` filters on
 * `isExclusivelyPackageOnly`. The cursor-`.mdc`, windsurf and augment emitters
 * never ask, so they write the full set regardless — into directories whose
 * global layers were verified to already hold all 103.
 *
 * WHY THE EXISTING GATES DO NOT CATCH IT
 * --------------------------------------
 *   - `check_single_delivery` hardcodes `~/.claude` and `<repo>/.claude`
 *     (`:446-447`), so the four other host directories are outside its corpus.
 *     Its own docstring records that in CI it compares nothing at all, because
 *     `.claude/` is gitignored and no CI leg installs at user scope.
 *   - `check_rule_projection_integrity` audits the trees against
 *     `projected_rule_trees()` — the generator's own emit plan. It answers "is
 *     the tree what the generator meant to write", which is COMPLETENESS. If the
 *     generator means to write a duplicate, that gate is green by construction.
 *     This gate asks the other question: is what the generator meant to write
 *     already delivered from the global layer.
 *
 * WHAT IT REFUSES TO DO
 * ---------------------
 * It never reports a duplicate for a host whose global layer cannot be read. A
 * project copy is the ONLY carrier when the global one is absent, so demanding
 * its removal on unread evidence would delete the rule from that host entirely —
 * the failure `partitionEligibility`'s fail-safe ordering exists to prevent. Such
 * a host is SKIPPED, by name, with its reason printed. A gate that scans nothing
 * and exits green is indistinguishable from a gate that passed, so the skip is
 * always visible.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { isExclusivelyPackageOnly } from '../install/partitionEligibility.js';
import { PROJECT_RULE_DIRS, globalRuleLayerNames, globalRuleLayerPath } from '../install/globalRuleLayers.js';
import { GateLedger, UnaccountedTargetsError } from './_lib/gate_ledger.js';
import { reportScanned } from './_lib/scan_scope.js';
import { runSelfTest } from './_lib/gate_self_test.js';

/** Re-exported so `check_rule_layer_partition`'s own importers keep working. */
export { PROJECT_RULE_DIRS };

const RULES_SOURCE = 'src/rules';

/** One project directory's verdict. */
export interface DirAudit {
    readonly dir: string;
    readonly toolId: string;
    /** Present in the project tree, normalised to `.md`, deduplicated. */
    readonly projected: readonly string[];
    /** Of those, the ones that are package-only and belong here. */
    readonly packageOnly: readonly string[];
    /**
     * Of those, the ones that are global-scope AND verified present in the host's
     * global layer — i.e. genuinely delivered twice.
     */
    readonly duplicated: readonly string[];
    /**
     * Global-scope names in the project tree that the global layer does NOT hold.
     * Not a finding: the project copy is the only carrier, which is the state the
     * partition must not break.
     */
    readonly soleCarrier: readonly string[];
    /** Null when the layer could not be read — the skip case. */
    readonly globalLayer: string | null;
    readonly globalCount: number | null;
}

export interface PartitionAudit {
    readonly dirs: readonly DirAudit[];
    /** dir → why it was skipped, when it was. */
    readonly skipped: Readonly<Record<string, string>>;
    readonly ledger: GateLedger;
}

/** `foo.mdc` → `foo.md`; everything else unchanged. */
function normalise(name: string): string {
    return name.endsWith('.mdc') ? `${name.slice(0, -4)}.md` : name;
}

/**
 * Classify every rule in `src/rules` once. Reading the SOURCE rather than each
 * projected copy matters: `.mdc` files carry a rewritten frontmatter dialect
 * (`description` / `globs` / `alwaysApply` only), so `workspaces:` is not present
 * to read there and a per-copy classification would call every cursor rule
 * global-scope.
 */
function classifySource(root: string): Map<string, boolean> {
    const out = new Map<string, boolean>();
    const dir = path.join(root, RULES_SOURCE);
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return out;
    }
    for (const f of entries) {
        if (!f.endsWith('.md')) continue;
        out.set(f, isExclusivelyPackageOnly(path.join(dir, f)));
    }
    return out;
}

export function auditRuleLayers(
    root: string,
    home: string = process.env['HOME'] ?? os.homedir(),
): PartitionAudit {
    const ledger = new GateLedger('check_rule_layer_partition');
    const cls = classifySource(root);
    const dirs: DirAudit[] = [];
    const skipped: Record<string, string> = {};

    ledger.plan(Object.keys(PROJECT_RULE_DIRS));

    for (const [dir, toolId] of Object.entries(PROJECT_RULE_DIRS)) {
        const abs = path.join(root, dir);
        let names: string[];
        try {
            names = fs.readdirSync(abs);
        } catch {
            // No project tree for this host — nothing can be duplicated from it.
            ledger.skip(dir, 'no_applicable_files');
            skipped[dir] = 'project directory absent';
            continue;
        }
        const projected = [
            ...new Set(
                names
                    .filter((f) => f.endsWith('.md') || f.endsWith('.mdc'))
                    .map(normalise)
                    .filter((f) => cls.has(f)),
            ),
        ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

        const globalNames = globalRuleLayerNames(toolId, home);
        if (globalNames === null) {
            ledger.skip(dir, 'precondition_unmet');
            skipped[dir] =
                `no readable global layer at ${globalRuleLayerPath(toolId, home) ?? '(none for this host)'}` +
                ` — the project copies are the only carrier, so nothing is reported`;
            continue;
        }
        const globalSet = new Set(globalNames);

        const packageOnly = projected.filter((f) => cls.get(f) === true);
        const globalScope = projected.filter((f) => cls.get(f) === false);
        const duplicated = globalScope.filter((f) => globalSet.has(f));
        const soleCarrier = globalScope.filter((f) => !globalSet.has(f));

        dirs.push({
            dir,
            toolId,
            projected,
            packageOnly,
            duplicated,
            soleCarrier,
            globalLayer: globalRuleLayerPath(toolId, home),
            globalCount: globalNames.length,
        });

        if (duplicated.length > 0) {
            ledger.fail(dir, `${String(duplicated.length)} rules delivered from both layers`);
        } else {
            ledger.complete(dir);
        }
    }

    return { dirs, skipped, ledger };
}

/** The measurement table — printed in both modes, because it is the point. */
export function renderTable(audit: PartitionAudit): string[] {
    const lines: string[] = [
        'project directory      tool          files  package-only  DUPLICATED  sole-carrier  global',
    ];
    for (const d of audit.dirs) {
        lines.push(
            d.dir.padEnd(22) +
                d.toolId.padEnd(13) +
                String(d.projected.length).padStart(6) +
                String(d.packageOnly.length).padStart(14) +
                String(d.duplicated.length).padStart(12) +
                String(d.soleCarrier.length).padStart(14) +
                String(d.globalCount ?? 0).padStart(8),
        );
    }
    for (const [dir, why] of Object.entries(audit.skipped)) {
        lines.push(`${dir.padEnd(22)}skipped: ${why}`);
    }
    return lines;
}

/**
 * `--self-test`: does this gate DISCRIMINATE?
 *
 * An enforced `scanned:` floor proves the gate read something; only this proves the
 * reading changes the verdict. Each case builds a synthetic project root and home,
 * so the suite is hermetic and never touches the live tree — which matters here
 * because the directories under audit are gitignored and a leaked fixture would sit
 * in one unnoticed.
 *
 * Three rejecting cases, deliberately more than the floor of one: the three ways
 * this gate can be wrong are a duplicate it fails to see, a sole-carrier it
 * mistakes for a duplicate, and a missing global layer it reports on anyway. The
 * middle and last are the ones that would DELETE a rule from a host.
 */
function selfTest(): number {
    const seed = (opts: {
        readonly projectHas: readonly string[];
        readonly globalHas: readonly string[];
    }): { root: string; home: string } => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'crlp-st-root-'));
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'crlp-st-home-'));
        const src = path.join(root, RULES_SOURCE);
        fs.mkdirSync(src, { recursive: true });
        fs.writeFileSync(
            path.join(src, 'pkg-only.md'),
            '---\nworkspaces:\n  - agent-config-maintainer\n---\n# pkg\n',
        );
        fs.writeFileSync(path.join(src, 'global-scope.md'), '---\ntier: 1\n---\n# global\n');
        const proj = path.join(root, '.cursor/rules');
        fs.mkdirSync(proj, { recursive: true });
        for (const n of opts.projectHas) fs.writeFileSync(path.join(proj, n), '# x\n');
        if (opts.globalHas.length > 0) {
            const gdir = path.join(home, '.cursor/rules');
            fs.mkdirSync(gdir, { recursive: true });
            for (const n of opts.globalHas) fs.writeFileSync(path.join(gdir, n), '# x\n');
        }
        return { root, home };
    };

    /** 1 when the audit would fail the build, 0 otherwise. */
    const verdict = (root: string, home: string): number => {
        const a = auditRuleLayers(root, home);
        return a.dirs.some((d) => d.duplicated.length > 0) ? 1 : 0;
    };

    return runSelfTest({
        gate: 'check_rule_layer_partition',
        minCases: 4,
        minRejectCases: 3,
        cases: [
            {
                name: 'a global-scope rule in both layers is refused',
                expect: 'reject',
                run: () => {
                    const { root, home } = seed({
                        projectHas: ['pkg-only.md', 'global-scope.md'],
                        globalHas: ['global-scope.md'],
                    });
                    return verdict(root, home);
                },
            },
            {
                name: 'a .mdc duplicate is refused too (normalisation is not a bypass)',
                expect: 'reject',
                run: () => {
                    const { root, home } = seed({
                        projectHas: ['global-scope.mdc'],
                        globalHas: ['global-scope.md'],
                    });
                    return verdict(root, home);
                },
            },
            {
                name: 'a duplicate under a .mdc global layer is refused',
                expect: 'reject',
                run: () => {
                    const { root, home } = seed({
                        projectHas: ['global-scope.md'],
                        globalHas: ['global-scope.mdc'],
                    });
                    return verdict(root, home);
                },
            },
            {
                name: 'package-only in the project layer is accepted',
                expect: 'accept',
                run: () => {
                    const { root, home } = seed({
                        projectHas: ['pkg-only.md'],
                        globalHas: ['global-scope.md'],
                    });
                    return verdict(root, home);
                },
            },
            {
                name: 'a sole-carrier is accepted — removing it would delete the rule',
                expect: 'accept',
                run: () => {
                    const { root, home } = seed({
                        projectHas: ['global-scope.md'],
                        globalHas: ['something-else.md'],
                    });
                    return verdict(root, home);
                },
            },
            {
                name: 'no global layer at all is accepted, never reported on',
                expect: 'accept',
                run: () => {
                    const { root, home } = seed({
                        projectHas: ['global-scope.md'],
                        globalHas: [],
                    });
                    return verdict(root, home);
                },
            },
        ],
    });
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        return selfTest();
    }
    const report = argv.includes('--report');
    const root = process.cwd();
    const audit = auditRuleLayers(root);

    for (const l of renderTable(audit)) process.stdout.write(`${l}\n`);

    // Scope hardening. The count is the number of directory PAIRS actually
    // compared, not the five planned — otherwise a run that skipped everything
    // would publish `scanned: 5` and the number would describe an intention rather
    // than a reading.
    //
    // `allowEmpty` is load-bearing rather than a formality: on a fresh CI checkout
    // both sides are legitimately absent (the project trees are gitignored, no CI
    // leg installs at user scope), so zero is the correct reading there and the
    // skip lines above already name every host it applies to.
    reportScanned({
        gate: 'check_rule_layer_partition',
        scanned: audit.dirs.length,
        units: 'host rule directory pairs',
        roots: Object.keys(PROJECT_RULE_DIRS),
        allowEmpty:
            'both layers are absent on a fresh checkout — the project rule trees are ' +
            'gitignored and no CI leg installs at user scope, so there is no pair to compare. ' +
            'The run prints "nothing compared … This is not a pass" instead of a success line.',
    });

    let tally;
    try {
        tally = audit.ledger.report();
    } catch (exc) {
        if (exc instanceof UnaccountedTargetsError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const offenders = audit.dirs.filter((d) => d.duplicated.length > 0);
    if (offenders.length === 0) {
        const skips = Object.keys(audit.skipped).length;
        if (tally.completed === 0) {
            // Measured nothing. Saying "each rule is delivered from one layer" here
            // would be the exact failure this gate's docstring names: a gate that
            // scans nothing and exits green reads identically to one that passed.
            // The skip lines above already say which hosts and why; this line has to
            // agree with them rather than contradict them in the same output.
            process.stdout.write(
                `⚠️  check_rule_layer_partition: nothing compared — ${String(skips)} host ` +
                    `directory/directories skipped (see the reasons above). This is not a pass.\n`,
            );
            return 0;
        }
        process.stdout.write(
            `✅  check_rule_layer_partition: ${String(tally.completed)} host rule tree(s) deliver ` +
                `each rule from one layer` +
                (skips > 0 ? `; ${String(skips)} skipped (reasons above)` : '') +
                `\n`,
        );
        return 0;
    }

    for (const d of offenders) {
        process.stderr.write(
            `${report ? '⚠️ ' : '❌ '} ${d.dir}: ${String(d.duplicated.length)} rule(s) also present in ` +
                `${d.globalLayer ?? '(unknown)'} — e.g. ${d.duplicated.slice(0, 5).join(', ')}\n`,
        );
    }
    process.stderr.write(
        `\nA rule in both layers is loaded twice: the host reads the global directory AND ` +
            `the project one, with no dedup (ADR-236). Regenerate with \`task generate-tools\` ` +
            `after the emitter for that directory consults the partition.\n`,
    );
    return report ? 0 : 1;
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('check_rule_layer_partition.ts')) {
    process.exit(main());
}
