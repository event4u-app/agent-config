#!/usr/bin/env tsx
/**
 * `check_routing_coverage` — two coverage ratchets, one per routed scope.
 *
 * `road-to-routing-assurance` Phase 0.3. Coverage ratio = corpus cases / routed
 * units, per scope, seeded at the measured current value. **CI fails only on a
 * DECREASE** — the same COUNT-ratchet disposition `lint_trigger_precision.ts`
 * already uses, and for the same reason: the number is a property of the estate,
 * so a rise is somebody's work and a fall is somebody's omission.
 *
 * TWO scopes, never one aggregate, because the aggregate hides the finding:
 *
 *   rules  94 / 105 = 0.895   deterministic corpus, gating
 *   skills 76 / 299 = 0.254   advisory live harness only
 *
 * The rules surface is ~90 % covered by a corpus that can fail a PR. The skills
 * surface — the one production actually routes on — is 25 %, covered only by a
 * harness that is "advisory only, never gating" (`rule_trigger_eval.ts:4`). One
 * blended figure would read as ~46 % and describe neither.
 *
 * WHY A RATIO AND NOT A COUNT: the denominator moves. Adding 8 skills without
 * adding corpus cases lowers coverage while every count rises, and a count
 * ratchet would call that progress.
 *
 * Exit codes: 0 = at or above seed · 1 = a scope fell · 2 = dead scope.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { type SelfTestCase, runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const HERE = fileURLToPath(import.meta.url);
const REAL_REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..');
/**
 * Scan root. The env override exists for `--self-test`, which drives the REAL
 * CLI against a synthetic tree — an in-process call would skip the argv parsing
 * and the entry guard, and a gate resolving its root from `import.meta.url`
 * reads the live checkout whatever the cwd, so every fixture would be green for
 * the wrong reason.
 */
const REPO_ROOT = process.env['CHECK_ROUTING_COVERAGE_ROOT'] ?? REAL_REPO_ROOT;
export const SEED_REL = 'src/config/routing-coverage-seed.json';

export type Scope = 'rules' | 'skills';

export interface ScopeReading {
    scope: Scope;
    cases: number;
    units: number;
    ratio: number;
}

export interface Seed {
    rules: number;
    skills: number;
}

/** Routed rules = every tier-1 and tier-2 entry in the compiled router. */
export function measureRules(root: string): ScopeReading {
    const routerPath = path.join(root, 'dist', 'router.json');
    let doc: { tier_1?: { id: string }[]; tier_2?: { id: string }[] };
    try {
        doc = JSON.parse(fs.readFileSync(routerPath, 'utf-8')) as typeof doc;
    } catch {
        throw new DeadScopeError(
            'check_routing_coverage',
            'dist/router.json is unreadable — the routed-rule denominator cannot be measured, ' +
                'and a missing router is not a coverage of zero.',
        );
    }
    const ids = new Set([...(doc.tier_1 ?? []), ...(doc.tier_2 ?? [])].map((r) => r.id));
    const dir = path.join(root, 'tests', 'eval', 'routing-matrix');
    let files: string[];
    try {
        files = fs.readdirSync(dir);
    } catch {
        files = [];
    }
    const stems = new Set(
        files.filter((f) => /\.ya?ml$/.test(f)).map((f) => f.replace(/\.ya?ml$/, '')),
    );
    // Intersection, not the file count: a fixture naming no routed rule covers
    // nothing, and counting it would let the ratio rise on dead files.
    let covered = 0;
    for (const s of stems) if (ids.has(s)) covered += 1;
    return { scope: 'rules', cases: covered, units: ids.size, ratio: ids.size === 0 ? 0 : covered / ids.size };
}

/** Routed skills = every SKILL.md; a case = that skill's `evals/triggers.json`. */
export function measureSkills(root: string): ScopeReading {
    const base = path.join(root, 'src', 'skills');
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
        throw new DeadScopeError(
            'check_routing_coverage',
            'src/skills is unreadable — the routed-skill denominator cannot be measured.',
        );
    }
    let units = 0;
    let cases = 0;
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (!fs.existsSync(path.join(base, e.name, 'SKILL.md'))) continue;
        units += 1;
        if (fs.existsSync(path.join(base, e.name, 'evals', 'triggers.json'))) cases += 1;
    }
    return { scope: 'skills', cases, units, ratio: units === 0 ? 0 : cases / units };
}

export function readSeed(root: string): Seed {
    const p = path.join(root, SEED_REL);
    let raw: string;
    try {
        raw = fs.readFileSync(p, 'utf-8');
    } catch {
        throw new DeadScopeError(
            'check_routing_coverage',
            `${SEED_REL} is missing — a ratchet with no seed passes every tree.`,
        );
    }
    const doc = JSON.parse(raw) as { seed?: Partial<Seed> };
    const s = doc.seed ?? {};
    if (typeof s.rules !== 'number' || typeof s.skills !== 'number') {
        throw new DeadScopeError(
            'check_routing_coverage',
            `${SEED_REL} carries no numeric seed for both scopes.`,
        );
    }
    return { rules: s.rules, skills: s.skills };
}

export interface Verdict {
    readings: ScopeReading[];
    seed: Seed;
    fallen: Scope[];
    ledger: GateLedger;
}

/**
 * Compare against the seed.
 *
 * Rounded to four decimals before comparing: an un-rounded float makes a ratio
 * that did not change fail on a representation difference, which is a red the
 * contributor cannot act on.
 */
/**
 * The comparison precision, shared by the verdict AND the display.
 *
 * Exported because the first version rounded only inside `evaluate` and printed
 * the raw float: rules read 0.895238… against a seed of 0.8952 and rendered `↑`,
 * skills read 0.254180… against 0.2542 and rendered `❌`, while the summary line
 * correctly said green. A gate whose rows contradict its verdict is worse than
 * one that is simply wrong, because the reader cannot tell which half to trust.
 */
export function r4(n: number): number {
    return Math.round(n * 10_000) / 10_000;
}

export function evaluate(root = REPO_ROOT): Verdict {
    const seed = readSeed(root);
    const readings = [measureRules(root), measureSkills(root)];
    // The ledger's target is the SCOPE, not the individual unit: this gate's
    // verdict is per scope, so a ledger over 404 units would report 404 rows
    // no one can act on while hiding which of the two actually fell.
    const ledger = new GateLedger('check_routing_coverage');
    ledger.plan(readings.map((r) => r.scope));
    const fallen: Scope[] = [];
    for (const r of readings) {
        if (r4(r.ratio) < r4(seed[r.scope])) {
            fallen.push(r.scope);
            ledger.fail(
                r.scope,
                `${r.ratio.toFixed(4)} < seed ${seed[r.scope].toFixed(4)} ` +
                    `(${String(r.cases)}/${String(r.units)})`,
            );
        } else {
            ledger.complete(r.scope);
        }
    }
    return { readings, seed, fallen, ledger };
}

/**
 * Build a synthetic tree with `r` routed rules of which `rc` carry a fixture,
 * and `s` routed skills of which `sc` carry a triggers file, plus a seed.
 *
 * A REALISTIC corpus rather than a minimal one: both scopes are always
 * populated, because the gate reports two scopes and a fixture that leaves one
 * empty would red for the empty scope no matter what the case under test does.
 */
function selfTestRoot(
    tmp: string,
    spec: { r: number; rc: number; s: number; sc: number; seed?: Partial<Seed> | null },
): string {
    const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
    const ids: { id: string }[] = [];
    const mdir = path.join(root, 'tests', 'eval', 'routing-matrix');
    fs.mkdirSync(mdir, { recursive: true });
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    for (let i = 0; i < spec.r; i += 1) {
        ids.push({ id: `st-rule-${String(i)}` });
        if (i < spec.rc) fs.writeFileSync(path.join(mdir, `st-rule-${String(i)}.yaml`), 'cases: []\n');
    }
    fs.writeFileSync(
        path.join(root, 'dist', 'router.json'),
        JSON.stringify({ tier_1: ids.slice(0, 1), tier_2: ids.slice(1) }),
    );
    for (let i = 0; i < spec.s; i += 1) {
        const d = path.join(root, 'src', 'skills', `st-skill-${String(i)}`);
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'SKILL.md'), '---\nname: st\n---\n');
        if (i < spec.sc) {
            fs.mkdirSync(path.join(d, 'evals'), { recursive: true });
            fs.writeFileSync(path.join(d, 'evals', 'triggers.json'), '[]\n');
        }
    }
    if (spec.seed !== null) {
        fs.mkdirSync(path.join(root, path.dirname(SEED_REL)), { recursive: true });
        fs.writeFileSync(
            path.join(root, SEED_REL),
            JSON.stringify({ seed: spec.seed ?? { rules: spec.rc / spec.r, skills: spec.sc / spec.s } }),
        );
    }
    return root;
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crc-selftest-'));
    const run = (root: string): number => {
        process.env['CHECK_ROUTING_COVERAGE_ROOT'] = root;
        try {
            return runGateCli(REAL_REPO_ROOT, 'src/scripts/check_routing_coverage.ts', [], root);
        } finally {
            delete process.env['CHECK_ROUTING_COVERAGE_ROOT'];
        }
    };
    const cases: SelfTestCase[] = [
        {
            name: 'a tree exactly at seed on both scopes is accepted',
            expect: 'accept',
            run: () => run(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5 })),
        },
        {
            name: 'a tree ABOVE seed on both scopes is accepted',
            expect: 'accept',
            run: () =>
                run(selfTestRoot(tmp, { r: 10, rc: 9, s: 10, sc: 6, seed: { rules: 0.8, skills: 0.5 } })),
        },
        {
            name: 'a removed rules corpus case is rejected',
            expect: 'reject',
            run: () =>
                run(selfTestRoot(tmp, { r: 10, rc: 7, s: 10, sc: 5, seed: { rules: 0.8, skills: 0.5 } })),
        },
        {
            name: 'a removed skills corpus case is rejected',
            expect: 'reject',
            run: () =>
                run(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 4, seed: { rules: 0.8, skills: 0.5 } })),
        },
        {
            name: 'ADDING routed units with no corpus cases is rejected — the count-ratchet blind spot',
            expect: 'reject',
            run: () =>
                run(selfTestRoot(tmp, { r: 10, rc: 8, s: 12, sc: 5, seed: { rules: 0.8, skills: 0.5 } })),
        },
        {
            name: 'a missing seed exits non-zero rather than passing every tree',
            expect: 'reject',
            run: () => run(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5, seed: null })),
        },
        {
            name: 'an unreadable router exits non-zero rather than reporting coverage of zero',
            expect: 'reject',
            run: () => {
                const root = selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5 });
                fs.writeFileSync(path.join(root, 'dist', 'router.json'), 'not json');
                return run(root);
            },
        },
    ];
    try {
        return runSelfTest({
            gate: 'check_routing_coverage',
            cases,
            minCases: 7,
            minRejectCases: 5,
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2), root = REPO_ROOT): number {
    if (argv.includes('--self-test')) return selfTest();
    let v: Verdict;
    try {
        v = evaluate(root);
        reportScanned({
            gate: 'check_routing_coverage',
            scanned: v.readings.reduce((n, r) => n + r.units, 0),
            units: 'routed unit(s)',
            roots: ['dist/router.json', 'src/skills'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    v.ledger.report(argv.includes('--quiet') ? () => undefined : process.stdout.write.bind(process.stdout));
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);
        return v.fallen.length > 0 ? 1 : 0;
    }
    for (const r of v.readings) {
        const seed = v.seed[r.scope];
        // Same rounding as the verdict, deliberately: see r4's own comment.
        const mark = r4(r.ratio) < r4(seed) ? '❌' : r4(r.ratio) > r4(seed) ? '↑' : '=';
        process.stdout.write(
            `  ${mark} ${r.scope.padEnd(6)} ${String(r.cases).padStart(4)} / ${String(r.units).padEnd(4)} = ` +
                `${r.ratio.toFixed(4)}  (seed ${seed.toFixed(4)})\n`,
        );
    }
    if (v.fallen.length === 0) {
        process.stdout.write('✅  routing coverage at or above seed in both scopes.\n');
        return 0;
    }
    for (const s of v.fallen) {
        const r = v.readings.find((x) => x.scope === s)!;
        process.stderr.write(
            `❌  ${s} coverage fell: ${r.ratio.toFixed(4)} < seed ${v.seed[s].toFixed(4)} ` +
                `(${String(r.cases)} case(s) over ${String(r.units)} routed unit(s)).\n` +
                '    A ratio falls two ways and the fix differs: a corpus case was removed ' +
                '(restore it), or units were added without cases (add them). Lowering the seed ' +
                `in ${SEED_REL} is a defect, not a fix.\n`,
        );
    }
    return 1;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(HERE)) {
    process.exit(main());
}
