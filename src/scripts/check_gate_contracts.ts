/**
 * Two shrink-only ratchets over the gates' own contracts
 * (road-to-checks-that-name-their-catch 1.3 and 3.2).
 *
 * 1. argv strictness — a gate that exits 0 on a flag it does not know runs the
 *    lenient path green on a typo. The gates measured permissive on 2026-11-02
 *    are listed in `src/config/gate-argv-permissive.json`; that list may only
 *    shrink. Every other gate that is NEW or CHANGED in `--base...HEAD` is
 *    probed with an unknown flag and must not exit 0. Probing all ~350 gates
 *    costs over a minute of CPU, so the full sweep is `--all`, run on demand.
 * 2. exit dialect — a self-test gate that declares `exit: { finding, cannot_run }`
 *    lets the harness tell a catch from a usage error. Gates without it are
 *    counted against a baseline.
 *
 * Usage: check_gate_contracts [--root <dir>] [--base <ref>] [--all] [--self-test]
 * Exit: 0 clean · 1 a ratchet regressed or a probed gate accepted an unknown flag · 2 usage / cannot run.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

import { parseGateArgs, USAGE_EXIT } from './_lib/gate_args.js';
import { checkRatchet } from './_lib/gate_baseline.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { exitOnDeadScope, reportScanned } from './_lib/scan_scope.js';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const GATE = 'check_gate_contracts';
const PERMISSIVE_REL = 'src/config/gate-argv-permissive.json';
const PROBE_FLAG = '--definitely-not-a-flag';
const PROBE_TIMEOUT_MS = 60_000;
const GATE_FILE = /^(check|lint)_[a-z0-9_]+\.ts$/;
const SELF_TEST_CALL = /\brunSelfTest\s*\(/;
const EXIT_DIALECT = /\bexit:\s*\{\s*finding\s*:/;

export function listGates(root: string): string[] {
    const dir = path.join(root, 'src', 'scripts');
    return fs.readdirSync(dir).filter((f) => GATE_FILE.test(f)).map((f) => f.slice(0, -3)).sort();
}

export function undeclaredDialects(root: string): string[] {
    const dir = path.join(root, 'src', 'scripts');
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
        .filter((f) => {
            const src = fs.readFileSync(path.join(dir, f), 'utf-8');
            return SELF_TEST_CALL.test(src) && !EXIT_DIALECT.test(src);
        })
        .map((f) => f.slice(0, -3))
        .sort();
}

function readPermissive(root: string): string[] {
    const raw = JSON.parse(fs.readFileSync(path.join(root, PERMISSIVE_REL), 'utf-8')) as { gates?: unknown };
    if (!Array.isArray(raw.gates)) throw new Error(`${PERMISSIVE_REL}: missing "gates" array`);
    return raw.gates.map(String);
}

function git(root: string, args: string[]): { ok: boolean; out: string } {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf-8' });
    return { ok: r.status === 0, out: r.stdout ?? '' };
}

/** Gates added or modified in base...HEAD. */
function touchedGates(root: string, base: string): string[] | null {
    if (!git(root, ['rev-parse', '--verify', '--quiet', base]).ok) return null;
    const d = git(root, ['diff', '--name-only', '--diff-filter=AM', `${base}...HEAD`, '--', 'src/scripts']);
    if (!d.ok) return null;
    return d.out
        .split('\n')
        .map((l) => path.basename(l.trim()))
        .filter((f) => GATE_FILE.test(f))
        .map((f) => f.slice(0, -3));
}

/** Exit code a gate returns for an unknown flag, or null on timeout/signal. */
export function probe(root: string, gate: string, tsx: string): number | null {
    const r = spawnSync(tsx, [path.join(root, 'src', 'scripts', `${gate}.ts`), PROBE_FLAG], {
        cwd: root,
        encoding: 'utf-8',
        timeout: PROBE_TIMEOUT_MS,
        maxBuffer: 64 * 1024 * 1024,
    });
    return r.status;
}

function selfTest(): number {
    const roots: string[] = [];
    const repo = (opts: { permissive: string[]; gates: Record<string, string>; added: Record<string, string> }): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-contracts-'));
        roots.push(dir);
        const sh = (args: string[]): void => {
            spawnSync('git', args, { cwd: dir });
        };
        fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
        fs.writeFileSync(path.join(dir, PERMISSIVE_REL), JSON.stringify({ gates: opts.permissive }));
        const baselines = {
            gates: {
                [`${GATE}:permissive-argv`]: { count: 5, landed: new Date().toISOString().slice(0, 10), note: 'fixture' },
                [`${GATE}:undeclared-exit-dialect`]: { count: 5, landed: new Date().toISOString().slice(0, 10), note: 'fixture' },
            },
        };
        fs.writeFileSync(path.join(dir, 'src', 'config', 'gate-violation-baselines.json'), JSON.stringify(baselines));
        for (const [n, body] of Object.entries(opts.gates)) fs.writeFileSync(path.join(dir, 'src', 'scripts', `${n}.ts`), body);
        sh(['init', '-q', '-b', 'main']);
        sh(['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A']);
        sh(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base']);
        for (const [n, body] of Object.entries(opts.added)) fs.writeFileSync(path.join(dir, 'src', 'scripts', `${n}.ts`), body);
        sh(['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A']);
        sh(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'change']);
        return dir;
    };
    const lenient = 'process.exit(0);\n';
    const strict = "if (process.argv.length > 2) { console.error('unknown flag'); process.exit(2); }\n";
    const run = (dir: string, extra: string[] = []): number =>
        runGateCli(REPO_ROOT, 'src/scripts/check_gate_contracts.ts', ['--root', dir, '--base', 'HEAD~1', ...extra], dir);
    try {
        return runSelfTest({
            gate: GATE,
            minCases: 5,
            minRejectCases: 3,
            exit: { finding: 1, cannot_run: USAGE_EXIT },
            cases: [
                {
                    name: 'a new gate that refuses an unknown flag passes',
                    expect: 'accept',
                    run: () => run(repo({ permissive: ['lint_old'], gates: { lint_old: lenient }, added: { lint_new: strict } })),
                },
                {
                    name: 'a new gate that exits 0 on an unknown flag is rejected and named',
                    expect: 'reject',
                    names: /lint_new accepts an unknown flag/,
                    run: () => run(repo({ permissive: [], gates: { lint_old: strict }, added: { lint_new: lenient } })),
                },
                {
                    name: 'a listed permissive gate that no longer exists is rejected — the list only names live debt',
                    expect: 'reject',
                    names: /lint_gone .*no longer exists/,
                    run: () => run(repo({ permissive: ['lint_gone'], gates: { lint_old: strict }, added: { lint_new: strict } })),
                },
                {
                    name: 'growing the permissive list past its baseline is rejected (lookalike of a pass)',
                    expect: 'reject',
                    names: /permissive-argv/,
                    run: () =>
                        run(
                            repo({
                                permissive: ['lint_a', 'lint_b', 'lint_c', 'lint_d', 'lint_e', 'lint_f'],
                                gates: { lint_a: lenient, lint_b: lenient, lint_c: lenient, lint_d: lenient, lint_e: lenient, lint_f: lenient },
                                added: { lint_new: strict },
                            }),
                        ),
                },
                {
                    name: 'an unknown flag to this gate is refused',
                    expect: 'refuse',
                    run: () => runGateCli(REPO_ROOT, 'src/scripts/check_gate_contracts.ts', [PROBE_FLAG], REPO_ROOT),
                },
            ],
        });
    } finally {
        for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
    }
}

export function main(argv: readonly string[]): number {
    const parsed = parseGateArgs(GATE, argv, {
        root: { type: 'string' },
        base: { type: 'string' },
        all: { type: 'boolean' },
        'self-test': { type: 'boolean' },
    });
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message}\n`);
        return USAGE_EXIT;
    }
    if (parsed.values['self-test']) return selfTest();
    const root = path.resolve(parsed.values.root ?? REPO_ROOT);
    const tsx = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

    let permissive: string[];
    try {
        permissive = readPermissive(root);
    } catch (e) {
        process.stderr.write(`${GATE}: ${(e as Error).message}\n`);
        return USAGE_EXIT;
    }
    const gates = listGates(root);
    const failures: string[] = [];
    for (const g of permissive) {
        if (!gates.includes(g)) failures.push(`${g} is listed in ${PERMISSIVE_REL} but no longer exists — remove it`);
    }

    let candidates: string[];
    if (parsed.values.all) {
        candidates = gates.filter((g) => !permissive.includes(g) && g !== GATE);
    } else {
        const touched = touchedGates(root, parsed.values.base ?? 'origin/main');
        if (touched === null) {
            process.stderr.write(`${GATE}: cannot resolve --base ${parsed.values.base ?? 'origin/main'}\n`);
            return USAGE_EXIT;
        }
        candidates = touched.filter((g) => !permissive.includes(g) && g !== GATE);
    }
    for (const g of candidates) {
        const code = probe(root, g, tsx);
        if (code === 0) {
            failures.push(
                `${g} accepts an unknown flag and exits 0 — parse argv with _lib/gate_args.ts (parseGateArgs) so a typo is refused`,
            );
        }
    }

    const ratchets = [
        checkRatchet({ gate: `${GATE}:permissive-argv`, actual: permissive.length, repoRoot: root }),
        checkRatchet({
            gate: `${GATE}:undeclared-exit-dialect`,
            actual: undeclaredDialects(root).length,
            repoRoot: root,
            fix: 'declare exit: { finding, cannot_run } in the gate\'s runSelfTest options',
        }),
    ];
    for (const v of ratchets) if (!v.ok) failures.push(v.message);

    reportScanned({ gate: GATE, scanned: gates.length, units: 'gate(s)', roots: ['src/scripts'] });
    for (const f of failures) process.stderr.write(`❌  ${f}\n`);
    for (const v of ratchets) if (v.ok) process.stdout.write(`${v.message}\n`);
    if (failures.length > 0) return 1;
    process.stdout.write(`✅  ${GATE}: ${String(candidates.length)} probed gate(s) refuse unknown flags\n`);
    return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    process.exit(exitOnDeadScope(() => main(process.argv.slice(2))));
}
