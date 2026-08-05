#!/usr/bin/env node
/**
 * Settings A/B/C class linter — every template leaf carries exactly one class.
 *
 * Phase 1 of `road-to-zero-ceremony-settings`. The package is growing an
 * agent-writable settings path (`settings set`); the A/B/C taxonomy in
 * `docs/contracts/settings-classes.md` is the fence that keeps a spend ceiling,
 * an allowlist, or a gate switch off that path. A key with no class is a key
 * with no fence, so this gate refuses the build until every leaf has a row.
 *
 * Checks, in order:
 *   1. every template leaf has exactly one row in the contract table;
 *   2. every contract row names a key the template actually has;
 *   3. every row's class is one of A | B | C;
 *   4. every B row's template default is a conservative value
 *      (`false` / `""` / `0` / `[]` / `null` / `{}`) — the invariant that makes
 *      "absent" and "declined" the same outcome in a sparse settings file;
 *   5. the contract's own Counts table matches the tallies computed here.
 *
 * **Landed at error, not advisory.** The authoring guideline's advisory-first
 * rule exists so a gate cannot be wired to error over a corpus whose hits are
 * unfixable. That does not apply here: the gate was run against the real
 * template in the same change, all 140 leaves were classified, and the finding
 * count reached zero before it was wired. There is therefore no
 * `gate-violation-baselines.json` entry — zero is the standing requirement, not
 * a floor a ratchet walks down to.
 *
 * **Gaming risk.** The cheap degenerate pass is class inflation in the *other*
 * direction from the one people expect: marking every key `C` makes the gate
 * green while making the writer useless, and nothing here can tell a
 * conscientious C from a lazy one. Mitigation: the contract states eight
 * explicit tests for C (the eighth, audit-and-observability, is the one a lazy
 * blanket-C most often hides behind) and names `commands.suggestion.enabled` as the worked
 * A-not-C counter-example, so a blanket-C diff reads as wrong to a reviewer;
 * check 4 additionally makes the B class mechanically falsifiable rather than
 * decorative. Residual: **the A/B/C judgement itself is not machine-checkable.**
 * This gate proves the table is *complete and consistent with the template*; it
 * cannot prove a row's class is *correct*. The C list was council-reviewed once
 * (Phase 1 step 4) precisely because completeness is checkable and correctness
 * is not.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { load as parseYaml } from 'js-yaml';

import {
    getSettingsLeaf,
    isConservativeDefault,
    isSettingsClass,
    parseDeclaredClassCounts,
    parseSettingsClassRows,
    SETTINGS_CLASSES,
    type SettingsClass,
    type SettingsClassRow,
    settingsLeafPaths,
} from '../shared/settingsClasses.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const GATE = 'lint_settings_classes';

/** Mirrors the sibling gates: a bare argv membership check, computed at import. */
const QUIET = process.argv.slice(2).includes('--quiet');

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const TEMPLATE_RELATIVE = 'src/config/agent-settings.template.yml';
const CONTRACT_RELATIVE = 'docs/contracts/settings-classes.md';

type Yaml = string | number | boolean | null | Yaml[] | { [k: string]: Yaml };

function _rootOverride(argv: readonly string[]): string | null {
    const i = argv.indexOf('--root');
    const value = i === -1 ? undefined : argv[i + 1];
    return value === undefined ? null : path.resolve(value);
}

function _readFile(p: string): string | null {
    try {
        return fs.readFileSync(p, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Prove, against the real CLI, that this gate still rejects what it must.
 *
 * The accept case seeds a two-key template with a matching contract; each
 * reject case removes exactly one property of that fixture, so a pass proves
 * the specific check and not merely that the fixture is broken.
 */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lsc-selftest-'));
    const seed = (name: string, template: string | null, contract: string | null): string => {
        const root = path.join(tmp, name);
        fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
        fs.mkdirSync(path.join(root, 'docs', 'contracts'), { recursive: true });
        if (template !== null) {
            fs.writeFileSync(path.join(root, TEMPLATE_RELATIVE), template, 'utf-8');
        }
        if (contract !== null) {
            fs.writeFileSync(path.join(root, CONTRACT_RELATIVE), contract, 'utf-8');
        }
        return root;
    };
    const run = (cwd: string): number => runGateCli(REPO_ROOT, `src/scripts/${GATE}.ts`, ['--quiet', '--root', cwd], REPO_ROOT);

    const template = 'alpha:\n  one: false\nbeta: "keep"\n';
    const counts = (a: number, b: number, c: number, total: number): string =>
        `\n## Counts\n\n| Class | Keys |\n|---|---|\n| A — preference | ${String(a)} |\n` +
        `| B — consent | ${String(b)} |\n| C — guarded | ${String(c)} |\n` +
        `| **Total** | **${String(total)}** |\n`;
    const table = (rows: string): string => `# Fixture\n${counts(0, 1, 1, 2)}\n## The table\n\n| Key | Class | Default | Why |\n|---|---|---|---|\n${rows}`;

    const clean = table('| `alpha.one` | B | `false` | fixture |\n| `beta` | C | `"keep"` | fixture |\n');

    try {
        return runSelfTest({
            gate: GATE,
            minCases: 6,
            minRejectCases: 5,
            cases: [
                {
                    name: 'a template whose every leaf is classified passes',
                    expect: 'accept',
                    run: () => run(seed('clean', template, clean)),
                },
                {
                    name: 'an unclassified template leaf is rejected',
                    expect: 'reject',
                    run: () =>
                        run(
                            seed(
                                'unclassified',
                                template,
                                table('| `beta` | C | `"keep"` | fixture |\n') + counts(0, 0, 1, 1),
                            ),
                        ),
                },
                {
                    name: 'a contract row naming a key the template lost is rejected',
                    expect: 'reject',
                    run: () =>
                        run(
                            seed(
                                'stale-row',
                                template,
                                table(
                                    '| `alpha.one` | B | `false` | fixture |\n| `beta` | C | `"keep"` | fixture |\n' +
                                        '| `gamma.gone` | A | `1` | fixture |\n',
                                ),
                            ),
                        ),
                },
                {
                    name: 'a class outside A|B|C is rejected',
                    expect: 'reject',
                    run: () =>
                        run(
                            seed(
                                'bad-class',
                                template,
                                table('| `alpha.one` | D | `false` | fixture |\n| `beta` | C | `"keep"` | fixture |\n'),
                            ),
                        ),
                },
                {
                    name: 'a B key whose default is permissive is rejected',
                    expect: 'reject',
                    run: () =>
                        run(
                            seed(
                                'permissive-b',
                                'alpha:\n  one: true\nbeta: "keep"\n',
                                clean,
                            ),
                        ),
                },
                {
                    name: 'a Counts table that disagrees with the rows is rejected',
                    expect: 'reject',
                    run: () =>
                        run(
                            seed(
                                'bad-counts',
                                template,
                                `# Fixture\n${counts(9, 9, 9, 27)}\n## The table\n\n| Key | Class | Default | Why |\n|---|---|---|---|\n` +
                                    '| `alpha.one` | B | `false` | fixture |\n| `beta` | C | `"keep"` | fixture |\n',
                            ),
                        ),
                },
                {
                    name: 'a missing template — a dead scan root — is rejected, not passed as "nothing to check"',
                    expect: 'reject',
                    run: () => run(seed('dead-root', null, clean)),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function main(): number {
    if (process.argv.slice(2).includes('--self-test')) {
        return selfTest();
    }
    const root = _rootOverride(process.argv.slice(2)) ?? REPO_ROOT;
    const templatePath = path.join(root, TEMPLATE_RELATIVE);
    const contractPath = path.join(root, CONTRACT_RELATIVE);

    const templateText = _readFile(templatePath);
    if (templateText === null) {
        process.stderr.write(`❌  ${GATE}: settings template not found at ${TEMPLATE_RELATIVE} — the scan root is dead.\n`);
        return 1;
    }
    const contractText = _readFile(contractPath);
    if (contractText === null) {
        process.stderr.write(`❌  ${GATE}: class contract not found at ${CONTRACT_RELATIVE} — every key is unclassified.\n`);
        return 1;
    }

    let parsed: Yaml;
    try {
        parsed = parseYaml(templateText) as Yaml;
    } catch (e) {
        process.stderr.write(`❌  ${GATE}: ${TEMPLATE_RELATIVE} did not parse: ${String(e)}\n`);
        return 1;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        process.stderr.write(`❌  ${GATE}: ${TEMPLATE_RELATIVE} did not parse to a map.\n`);
        return 1;
    }

    const leaves = settingsLeafPaths(parsed);
    try {
        // Publishes the number it just asserted, so the coverage guard reads the
        // judged denominator rather than an enumerated one.
        reportScanned({ gate: GATE, scanned: leaves.length, units: 'settings leaf key(s)', roots: [TEMPLATE_RELATIVE] });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 1;
        }
        throw e;
    }

    const rows = parseSettingsClassRows(contractText);
    const rowByKey = new Map<string, SettingsClassRow>();
    const findings: string[] = [];

    // The ledger plans one target per template leaf plus one per contract row,
    // so a stale row is accounted work rather than an invisible extra.
    const ledger = new GateLedger(GATE);
    ledger.plan(leaves.map((k) => `key:${k}`));
    ledger.plan(rows.map((r, i) => `row:${String(i)}:${r.key}`));

    const leafSet = new Set(leaves);
    for (const [i, row] of rows.entries()) {
        const target = `row:${String(i)}:${row.key}`;
        const duplicate = rowByKey.get(row.key);
        if (duplicate !== undefined) {
            const finding =
                `${CONTRACT_RELATIVE}:${String(row.line)}  duplicate row for \`${row.key}\` ` +
                `(first at line ${String(duplicate.line)}) — one key, one class.`;
            findings.push(finding);
            ledger.fail(target, finding);
            continue;
        }
        rowByKey.set(row.key, row);
        if (!isSettingsClass(row.cls)) {
            const finding =
                `${CONTRACT_RELATIVE}:${String(row.line)}  \`${row.key}\` has class '${row.cls}' — ` +
                `allowed: ${SETTINGS_CLASSES.join(' | ')}.`;
            findings.push(finding);
            ledger.fail(target, finding);
            continue;
        }
        if (!leafSet.has(row.key)) {
            // Resolved HERE rather than in a later pass. A stale row that
            // `complete`s and then produces a finding downstream is counted as
            // satisfied by the ledger while the gate exits 1 — a completeness
            // report that covers less than it appears to, which is the exact
            // shape the ledger exists to make impossible.
            const finding =
                `${CONTRACT_RELATIVE}:${String(row.line)}  \`${row.key}\` is not a leaf in ` +
                `${TEMPLATE_RELATIVE} — the row is stale; delete it or restore the key.`;
            findings.push(finding);
            ledger.fail(target, finding);
            continue;
        }
        ledger.complete(target);
    }


    const tally: Record<SettingsClass, number> = { A: 0, B: 0, C: 0 };
    for (const leaf of leaves) {
        const target = `key:${leaf}`;
        const row = rowByKey.get(leaf);
        if (row === undefined) {
            const finding =
                `${TEMPLATE_RELATIVE}  \`${leaf}\` has no class — add a row to ${CONTRACT_RELATIVE}. ` +
                'An unclassified key reaches the settings writer with no fence.';
            findings.push(finding);
            ledger.fail(target, finding);
            continue;
        }
        if (!isSettingsClass(row.cls)) {
            // Already reported against the row; do not double-count the key.
            ledger.outOfScope(target, 'declared_exemption');
            continue;
        }
        const cls: SettingsClass = row.cls;
        tally[cls] += 1;
        if (cls === 'B' && !isConservativeDefault(getSettingsLeaf(parsed, leaf))) {
            const finding =
                `${CONTRACT_RELATIVE}:${String(row.line)}  \`${leaf}\` is class B but its template default is ` +
                'permissive — a B key must default to the conservative value, or "never asked" and ' +
                '"answered yes" become the same state in a sparse file.';
            findings.push(finding);
            ledger.fail(target, finding);
            continue;
        }
        ledger.complete(target);
    }

    const declared = parseDeclaredClassCounts(contractText);
    const expected: Array<[string, number | null, number]> = [
        ['A', declared.A, tally.A],
        ['B', declared.B, tally.B],
        ['C', declared.C, tally.C],
        ['Total', declared.total, leaves.length],
    ];
    for (const [label, stated, actual] of expected) {
        if (stated === null) {
            findings.push(
                `${CONTRACT_RELATIVE}  the Counts table has no '${label}' row — a published count with no ` +
                    'row is a count nothing can check.',
            );
            continue;
        }
        if (stated !== actual) {
            findings.push(
                `${CONTRACT_RELATIVE}  Counts says ${label} = ${String(stated)}, the table holds ` +
                    `${String(actual)} — a derived number beside a mechanism that can compute it.`,
            );
        }
    }

    ledger.report();

    if (findings.length > 0) {
        process.stderr.write('\n');
        for (const f of findings) {
            process.stderr.write(`❌  ${f}\n`);
        }
        process.stderr.write(`\n❌  ${GATE}: ${String(findings.length)} finding(s)\n`);
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(
            `✅  ${GATE}: ${String(leaves.length)} settings key(s) classified — ` +
                `A=${String(tally.A)} B=${String(tally.B)} C=${String(tally.C)}\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { CONTRACT_RELATIVE, GATE, REPO_ROOT, TEMPLATE_RELATIVE, main };
