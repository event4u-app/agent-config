#!/usr/bin/env tsx
/**
 * A step a pull request ticks reaches production (road-to-a-tick-the-shipped-path-earns 3.2).
 *
 * Reads only the PR's own new ticks, the `check_step_receipts` diff walk. For each,
 * the step's SUBJECT modules are the `src/` paths its block names (its receipt's
 * `production code touched:` bound included), and its tests are the test files it
 * names plus each subject's conventional test. Every public symbol such a test
 * takes from a subject must be imported by name somewhere in the production
 * closure (`_lib/production_reach.ts`), or the subject is itself an entry. A
 * `_`-prefixed name is a testing seam and is not counted.
 *
 * A step whose code is built but not wired stays `[ ]` with `built, not wired`; a
 * ticked step carrying that phrase is refused outright. `production entry: <path>`
 * in the block adds an entry for that step. Report mode exits 0 (3.3: one release
 * of shadow first); `--enforce` exits 1 on a finding.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_step_production_reach [--base <ref>] [--head <ref>] [--enforce] [--json]
 *   ./scripts-run src/scripts/check_step_production_reach --self-test
 *
 * Exit 0 clean or report-only · 1 a finding while enforcing · 2 usage or git error.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    commitTreeOf,
    ENTRIES_CONFIG_REL,
    moduleImports,
    productionReach,
    type Reach,
    type ReachTree,
    worktreeOf,
} from './_lib/production_reach.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ROADMAP_ROOT = 'agents/roadmaps';
const TICK = /^- \[x\] \*\*([^\s*]+)/;

export interface NewTick {
    readonly file: string;
    readonly step: string;
}

/** Steps an added line ticks that no removed line of the same file ticked. */
export function newTicks(diff: string): NewTick[] {
    const perFile = new Map<string, { added: string[]; removed: Set<string> }>();
    let cur: { added: string[]; removed: Set<string> } | null = null;
    for (const line of diff.split('\n')) {
        if (line.startsWith('+++ ')) {
            const target = line.slice(4).replace(/^b\//, '');
            cur = target === '/dev/null' ? null : { added: [], removed: new Set() };
            if (cur !== null) perFile.set(target, cur);
            continue;
        }
        if (cur === null || line.startsWith('--- ')) continue;
        const id = TICK.exec(line.slice(1))?.[1];
        if (id === undefined) continue;
        if (line.startsWith('+')) cur.added.push(id);
        else if (line.startsWith('-')) cur.removed.add(id);
    }
    const out: NewTick[] = [];
    for (const [file, { added, removed }] of perFile) {
        for (const step of added) if (!removed.has(step)) out.push({ file, step });
    }
    return out;
}

/** The step's block: its tick line through the line before the next checkbox or heading. */
export function stepBlock(text: string, step: string): string | null {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => TICK.exec(l)?.[1] === step);
    if (start < 0) return null;
    let end = start + 1;
    while (end < lines.length && !/^\s*- \[[ x~-]\]/.test(lines[end] as string) && !/^#{1,6}\s/.test(lines[end] as string)) end += 1;
    return lines.slice(start, end).join('\n');
}

const PATH_RE = /(?:^|[\s`(:,])((?:src\/|tests\/|_lib\/)[A-Za-z0-9_/.-]+\.ts)\b/g;

/** `src/` subjects and test files a block names; `_lib/x.ts` means `src/scripts/_lib/x.ts`. */
export function namedPaths(tree: ReachTree, block: string): { subjects: string[]; tests: string[]; entries: string[] } {
    const subjects = new Set<string>();
    const tests = new Set<string>();
    for (const m of block.matchAll(PATH_RE)) {
        let p = m[1] as string;
        if (p.startsWith('_lib/')) p = `src/scripts/${p}`;
        if (tree.read(p) === null) continue;
        if (/\.test\.ts$/.test(p)) tests.add(p);
        else if (p.startsWith('src/')) subjects.add(p);
    }
    const entries = [...block.matchAll(/production entry:\s*`?([A-Za-z0-9_/.-]+\.ts)`?/g)].map((m) => m[1] as string);
    // A named test's own module is a subject too: `tests/scripts/_lib_x.test.ts` → `src/scripts/_lib/x.ts`.
    for (const t of tests) {
        const stem = path.posix.basename(t, '.test.ts');
        const own = t.startsWith('src/')
            ? t.replace(/\.test\.ts$/, '.ts')
            : `src/scripts/${stem.startsWith('_lib_') ? `_lib/${stem.slice(5)}` : stem}.ts`;
        if (tree.read(own) !== null) subjects.add(own);
    }
    for (const s of [...subjects]) {
        const dir = path.posix.dirname(s);
        const base = path.posix.basename(s, '.ts');
        const rel = s.replace(/^src\/scripts\//, '').replace(/\.ts$/, '').replace(/\//g, '_');
        for (const c of [`${dir}/${base}.test.ts`, `tests/scripts/${base}.test.ts`, `tests/scripts/${rel}.test.ts`]) {
            if (tree.read(c) !== null) tests.add(c);
        }
    }
    return { subjects: [...subjects].sort(), tests: [...tests].sort(), entries };
}

export interface Finding {
    readonly file: string;
    readonly step: string;
    readonly reason: string;
}

/** The unreached public symbols this block's tests take from its subjects. */
export function checkStep(tree: ReachTree, reach: Reach, file: string, step: string, block: string): Finding | null {
    // Quoted, the phrase is talk about the rule; bare, it is the step's own status.
    if (/built, not wired/i.test(block.replace(/`[^`]*`/g, ''))) {
        return { file, step, reason: 'ticked while it says `built, not wired` — such a step stays `[ ]`' };
    }
    const { subjects, tests, entries } = namedPaths(tree, block);
    const r = entries.length ? productionReach(tree, entries) : reach;
    const reached = (key: string, mod: string): boolean =>
        r.entries.has(mod) || r.symbols.has(key) || r.symbols.has(`${mod}#*`);
    const missing: string[] = [];
    for (const t of tests) {
        for (const imp of moduleImports(tree, t)) {
            if (!subjects.includes(imp.target)) continue;
            for (const n of imp.names) {
                if (n === '*' || n.startsWith('_')) continue;
                if (!reached(`${imp.target}#${n}`, imp.target)) missing.push(`${imp.target}#${n}`);
            }
        }
    }
    if (missing.length === 0) return null;
    return {
        file,
        step,
        reason: `tested but unreached from any production entry: ${[...new Set(missing)].join(', ')}`,
    };
}

function git(root: string, args: string[]): string | null {
    const res = spawnSync('git', args, { cwd: root, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
    return res.status === 0 ? res.stdout : null;
}

export function run(
    root: string,
    base: string,
    head: string | null,
    ledger: GateLedger = new GateLedger('check_step_production_reach'),
): { scanned: number; findings: Finding[] } | null {
    const range = head === null ? `${base}...HEAD` : `${base}...${head}`;
    const diff = git(root, ['diff', '-U0', '--find-renames', '--no-color', range, '--', `${ROADMAP_ROOT}/`]);
    if (diff === null) return null;
    const ticks = newTicks(diff);
    // A replayed commit predates the entries config, so the checkout's copy is read over it.
    const config = worktreeOf(root).read(ENTRIES_CONFIG_REL);
    const at = head === null ? worktreeOf(root) : commitTreeOf(root, head);
    const tree: ReachTree = { list: at.list, read: (rel) => (rel === ENTRIES_CONFIG_REL ? config : at.read(rel)) };
    const reach = productionReach(tree);
    const findings: Finding[] = [];
    for (const { file, step } of ticks) {
        const target = `${file}#${step}`;
        ledger.plan(target);
        const block = stepBlock(tree.read(file) ?? '', step);
        if (block === null) {
            ledger.skip(target, 'precondition_unmet');
            continue;
        }
        const f = checkStep(tree, reach, file, step, block);
        if (f === null) ledger.complete(target);
        else {
            ledger.fail(target, f.reason);
            findings.push(f);
        }
    }
    return { scanned: ticks.length, findings };
}

function selfTest(): number {
    // Assembled at run time, so prepack's import scan does not read fixture text as a shipped import.
    const from = (spec: string): string => `from '${spec}';`;
    const files: Record<string, string> = {
        'src/config/production-entries.json': JSON.stringify({ entries: ['src/main.ts'], entry_sources: [] }),
        'src/main.ts': `import { wired } ${from('./lib.js')}\nwired();\n`,
        'src/lib.ts': 'export function wired() {}\nexport function unwired() {}\n',
        'src/cli.ts': `import { unwired } ${from('./lib.js')}\nunwired();\n`,
        'tests/lib.test.ts': `import { wired, unwired } ${from('../src/lib.js')}\n`,
        'tests/wired.test.ts': `import { wired } ${from('../src/lib.js')}\n`,
    };
    const tree: ReachTree = { list: () => Object.keys(files), read: (rel) => files[rel] ?? null };
    const reach = productionReach(tree);
    const failures: string[] = [];
    const unwired = checkStep(tree, reach, 'r.md', '1.1', '- [x] **1.1 x** `src/lib.ts`\n  verify: `tests/lib.test.ts`');
    if (unwired === null || !unwired.reason.includes('src/lib.ts#unwired')) failures.push('an unwired symbol did not red');
    if (checkStep(tree, reach, 'r.md', '1.2', '- [x] **1.2 x** `src/lib.ts`\n  verify: `tests/wired.test.ts`') !== null) {
        failures.push('a wired symbol red');
    }
    const declared = '- [x] **1.4 x** `src/lib.ts`, production entry: `src/cli.ts`\n  verify: `tests/lib.test.ts`';
    if (checkStep(tree, reach, 'r.md', '1.4', declared) !== null) failures.push('a declared production entry was not honoured');
    if (checkStep(tree, reach, 'r.md', '1.3', '- [x] **1.3 x** built, not wired') === null) {
        failures.push('a ticked built-not-wired step did not red');
    }
    if (newTicks('+++ b/r.md\n-- [ ] **1.1 x**\n+- [x] **1.1 x**\n').length !== 1) failures.push('a new tick was not read');
    if (newTicks('+++ b/r.md\n-- [x] **1.1 x**\n+- [x] **1.1 y**\n').length !== 0) failures.push('a reworded tick read as new');
    for (const f of failures) process.stderr.write(`❌  check_step_production_reach --self-test: ${f}\n`);
    if (failures.length === 0) process.stdout.write('✅  check_step_production_reach --self-test: both directions hold\n');
    return failures.length ? 1 : 0;
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--self-test')) return selfTest();
    const value = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const ledger = new GateLedger('check_step_production_reach');
    const result = run(REPO_ROOT, value('--base') ?? 'origin/main', value('--head') ?? null, ledger);
    if (result === null) {
        process.stderr.write('check_step_production_reach: cannot diff the range\n');
        return 2;
    }
    reportScanned({
        gate: 'check_step_production_reach',
        scanned: result.scanned,
        units: 'newly ticked step(s)',
        roots: [`git diff ${value('--base') ?? 'origin/main'}... -- ${ROADMAP_ROOT}/`],
        allowEmpty: 'EMPTY_VALID: the scan root is a DIFF, and most pull requests tick no roadmap step.',
    });
    if (!argv.includes('--json')) ledger.report();
    else ledger.finalize();
    if (argv.includes('--json')) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else if (result.findings.length === 0) {
        process.stdout.write('✅  check_step_production_reach: every newly ticked step reaches a production entry\n');
    }
    const enforce = argv.includes('--enforce');
    if (!argv.includes('--json')) {
        for (const f of result.findings) process.stdout.write(`${enforce ? '❌' : '⚠️ '}  ${f.file}: step ${f.step} — ${f.reason}\n`);
        if (result.findings.length && !enforce) process.stdout.write('   Report only (shadow, step 3.3): nothing is refused yet.\n');
    }
    return enforce && result.findings.length ? 1 : 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    process.exit(main(process.argv.slice(2)));
}
