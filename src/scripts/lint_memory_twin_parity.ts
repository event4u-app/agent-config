#!/usr/bin/env tsx
/**
 * Memory-twin parity — the copies may not drift apart again.
 *
 * `road-to-memory-twin-reconciliation` Phase 3. Seven scripts exist twice, once
 * under `src/scripts/` and once under `src/agent-src/templates/scripts/`, and
 * `package.json:files[]` ships BOTH. Until this gate there was no sync, no drift
 * check and no parity check between them — so they diverged in both directions
 * and the divergence was found by a redundancy audit rather than by CI.
 *
 * ── What it compares ────────────────────────────────────────────────────────
 * NON-COMMENT lines only. Block comments, line comments and blank lines are
 * stripped from both sides before diffing, because the docstring differences
 * between the copies are known-correct: the template's header explains what a
 * consumer installed, the dev copy's explains this repository's own tooling.
 * A gate comparing whole diffs would fire on every unrelated PR — which is
 * exactly the risk this roadmap's own register names at rank 4.
 *
 * ── Two modes, and why not one ──────────────────────────────────────────────
 * `exact` — the non-comment diff must be EMPTY. This is the real check, and a
 * twin is put here whenever it can be driven to zero.
 *
 * `bounded` — a recorded ceiling on non-comment changed lines, shrink-only. It
 * exists for the twins that CANNOT reach zero, and the reason is structural
 * rather than a preference: the installed consumer tree has no `scripts/_lib/`,
 * so a template script may import node built-ins, `yaml` and its own installed
 * siblings — nothing else. Every `keep-duplicated` verdict in the config names
 * which non-installable import forces it.
 *
 * **What `bounded` does NOT claim**, stated because a ceiling reads stronger
 * than it is: it catches GROWTH, not substitution. Replacing one 18-line
 * divergence with a different 18-line divergence passes. That is the honest
 * limit of a count, and it is why every twin that can be `exact` is `exact`.
 *
 * Exit codes: 0 within verdicts · 1 divergence beyond them · 2 config / IO error.
 *
 * Usage:
 *     ./scripts-run src/scripts/lint_memory_twin_parity
 *     ./scripts-run src/scripts/lint_memory_twin_parity --format json
 *     ./scripts-run src/scripts/lint_memory_twin_parity --root <fixture>
 *     ./scripts-run src/scripts/lint_memory_twin_parity --self-test
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const CONFIG_REL = 'src/config/memory-twin-verdicts.yml';

export interface TwinVerdict {
    file: string;
    mode: 'exact' | 'bounded';
    max_changed_lines?: number;
    verdict: string;
    reason: string;
}

export interface TwinConfig {
    dev_root: string;
    template_root: string;
    twins: TwinVerdict[];
}

export function loadConfig(repoRoot: string): TwinConfig {
    const raw = fs.readFileSync(path.join(repoRoot, CONFIG_REL), 'utf8');
    const doc = parseYaml(raw) as Partial<TwinConfig>;
    if (typeof doc.dev_root !== 'string' || typeof doc.template_root !== 'string' || !Array.isArray(doc.twins)) {
        throw new Error(`${CONFIG_REL}: dev_root, template_root and twins are all required`);
    }
    return { dev_root: doc.dev_root, template_root: doc.template_root, twins: doc.twins };
}

/**
 * Strip comments and blank lines.
 *
 * Deliberately textual rather than a parse: the gate must not need a TypeScript
 * compiler to answer "did these two files diverge", and a stripper that is
 * slightly conservative (a `*` continuation line inside a string would be
 * dropped) errs toward reporting FEWER differences, which cannot manufacture a
 * failure. It is the same shape the roadmap's own Phase 1 measurements used.
 */
export function stripComments(src: string): string[] {
    const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '');
    const out: string[] = [];
    for (const line of noBlocks.split('\n')) {
        const t = line.trim();
        if (t === '' || t.startsWith('//') || t.startsWith('*')) continue;
        out.push(line.replace(/\s+$/, ''));
    }
    return out;
}

/**
 * Count changed lines between two stripped files.
 *
 * A multiset difference, not an LCS diff: a line present N times on one side and
 * M on the other contributes |N-M|. That makes the number invariant to
 * reordering, which is what we want — moving a function is not a divergence in
 * behaviour, and a real divergence changes the line CONTENT.
 */
export function changedLineCount(devLines: readonly string[], tplLines: readonly string[]): number {
    const count = (ls: readonly string[]): Map<string, number> => {
        const m = new Map<string, number>();
        for (const l of ls) m.set(l, (m.get(l) ?? 0) + 1);
        return m;
    };
    const a = count(devLines);
    const b = count(tplLines);
    let delta = 0;
    for (const k of new Set([...a.keys(), ...b.keys()])) {
        delta += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
    }
    return delta;
}

export interface Finding {
    file: string;
    measured: number;
    allowed: number | 'exact';
    detail: string;
}

export interface Report {
    findings: Finding[];
    scanned: number;
    measurements: { file: string; measured: number; mode: string }[];
}

export function evaluate(repoRoot: string, ledger?: GateLedger): Report {
    const cfg = loadConfig(repoRoot);
    const findings: Finding[] = [];
    const measurements: Report['measurements'] = [];
    ledger?.plan(cfg.twins.map((t) => t.file));

    for (const twin of cfg.twins) {
        const dev = path.join(repoRoot, cfg.dev_root, twin.file);
        const tpl = path.join(repoRoot, cfg.template_root, twin.file);
        if (!fs.existsSync(dev) || !fs.existsSync(tpl)) {
            // A declared twin that no longer exists on both sides is a CONFIG
            // defect, not a silent skip: the verdict is now describing nothing.
            findings.push({
                file: twin.file,
                measured: -1,
                allowed: twin.mode === 'exact' ? 'exact' : (twin.max_changed_lines ?? 0),
                detail: `declared twin is missing on one side (dev=${fs.existsSync(dev)}, template=${fs.existsSync(tpl)}) — the verdict describes nothing`,
            });
            ledger?.fail(twin.file, 'declared twin missing on one side');
            continue;
        }
        const measured = changedLineCount(
            stripComments(fs.readFileSync(dev, 'utf8')),
            stripComments(fs.readFileSync(tpl, 'utf8')),
        );
        measurements.push({ file: twin.file, measured, mode: twin.mode });

        if (twin.mode === 'exact') {
            if (measured !== 0) {
                findings.push({
                    file: twin.file,
                    measured,
                    allowed: 'exact',
                    detail: `declared EXACT parity but the copies differ by ${measured} non-comment line(s)`,
                });
                ledger?.fail(twin.file, `${measured} line(s) against exact parity`);
            } else {
                ledger?.complete(twin.file);
            }
            continue;
        }
        const cap = twin.max_changed_lines ?? 0;
        if (measured > cap) {
            findings.push({
                file: twin.file,
                measured,
                allowed: cap,
                detail:
                    `${measured} non-comment changed line(s) against a recorded ceiling of ${cap} — ` +
                    `${measured - cap} new. The ceiling is shrink-only: reconcile the divergence, or ` +
                    `record a verdict for it in ${CONFIG_REL}. Raising the number is a defect, not a fix.`,
            });
            ledger?.fail(twin.file, `${measured} > ${cap}`);
        } else {
            ledger?.complete(twin.file);
        }
    }
    return { findings, scanned: cfg.twins.length, measurements };
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'twin-selftest-'));
    const build = (name: string, devBody: string, tplBody: string, cfgTwin: string): string => {
        const root = path.join(tmp, name);
        fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
        fs.mkdirSync(path.join(root, 'src', 'agent-src', 'templates', 'scripts'), { recursive: true });
        fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src', 'scripts', 'twin.ts'), devBody, 'utf8');
        fs.writeFileSync(path.join(root, 'src', 'agent-src', 'templates', 'scripts', 'twin.ts'), tplBody, 'utf8');
        fs.writeFileSync(
            path.join(root, 'src', 'config', 'memory-twin-verdicts.yml'),
            `schema_version: memory-twin-verdicts-v1\ndev_root: src/scripts\ntemplate_root: src/agent-src/templates/scripts\ntwins:\n${cfgTwin}\n`,
            'utf8',
        );
        return root;
    };
    const exactTwin = "  - file: twin.ts\n    mode: exact\n    verdict: dev-side-correct\n    reason: self-test";
    const run = (root: string): number =>
        runGateCli(REPO_ROOT, 'src/scripts/lint_memory_twin_parity.ts', ['--root', root, '--quiet'], REPO_ROOT);

    try {
        return runSelfTest({
            gate: 'lint_memory_twin_parity',
            minCases: 4,
            minRejectCases: 2,
            cases: [
                {
                    name: 'identical copies pass',
                    expect: 'accept',
                    run: () => run(build('same', 'const a = 1;\n', 'const a = 1;\n', exactTwin)),
                },
                {
                    // The verify clause's green half: a comment-only plant must NOT red.
                    name: 'a comment-only divergence passes',
                    expect: 'accept',
                    run: () =>
                        run(build('comment', 'const a = 1;\n', '// template-only note\nconst a = 1;\n', exactTwin)),
                },
                {
                    // The verify clause's red half: one behavioural line must red.
                    name: 'a one-line behavioural divergence is rejected',
                    expect: 'reject',
                    run: () => run(build('drift', 'const a = 1;\n', 'const a = 2;\n', exactTwin)),
                },
                {
                    name: 'a declared twin missing on one side is rejected',
                    expect: 'reject',
                    run: () => {
                        const root = build('missing', 'const a = 1;\n', 'const a = 1;\n', exactTwin);
                        fs.rmSync(path.join(root, 'src', 'agent-src', 'templates', 'scripts', 'twin.ts'));
                        return run(root);
                    },
                },
                {
                    name: 'a bounded twin at its ceiling passes and one line over is rejected',
                    expect: 'reject',
                    run: () =>
                        run(
                            build(
                                'bounded',
                                'const a = 1;\nconst b = 2;\n',
                                'const a = 9;\nconst b = 8;\n',
                                '  - file: twin.ts\n    mode: bounded\n    max_changed_lines: 2\n    verdict: keep-duplicated\n    reason: self-test',
                            ),
                        ),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write('usage: lint_memory_twin_parity [--format json] [--root DIR] [--quiet] [--self-test]\n');
        return 0;
    }
    if (argv.includes('--self-test')) return selfTest();

    const quiet = argv.includes('--quiet');
    const asJson = argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json';
    const rootIdx = argv.indexOf('--root');
    const root = rootIdx !== -1 && rootIdx + 1 < argv.length ? path.resolve(argv[rootIdx + 1] as string) : REPO_ROOT;
    const isFixture = root !== REPO_ROOT;

    let report: Report;
    const ledger = isFixture ? undefined : new GateLedger('lint_memory_twin_parity');
    try {
        report = evaluate(root, ledger);
    } catch (e) {
        process.stderr.write(`❌  lint_memory_twin_parity: ${e instanceof Error ? e.message : String(e)}\n`);
        return 2;
    }

    try {
        assertScanned({
            gate: 'lint_memory_twin_parity',
            scanned: report.scanned,
            units: 'declared twin(s)',
            roots: [CONFIG_REL],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    if (asJson) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
    ledger?.report(quiet ? () => undefined : undefined);
    process.stdout.write(`scanned: ${report.scanned}\n`);

    if (report.findings.length > 0) {
        for (const f of report.findings) {
            process.stderr.write(`  🔴 ${f.file}: ${f.detail}\n`);
        }
        process.stderr.write(`❌  lint_memory_twin_parity: ${report.findings.length} twin(s) diverged beyond their verdict.\n`);
        return 1;
    }
    if (!quiet) {
        for (const m of report.measurements) {
            process.stdout.write(`  · ${m.file.padEnd(26)} ${String(m.measured).padStart(4)} line(s)  [${m.mode}]\n`);
        }
        process.stdout.write(`✅  lint_memory_twin_parity: ${report.scanned} twin(s) within their recorded verdicts.\n`);
    }
    return 0;
}

/* c8 ignore start */
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(_HERE).href) {
    process.exit(main());
}
/* c8 ignore stop */
