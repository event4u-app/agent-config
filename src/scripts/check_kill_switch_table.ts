#!/usr/bin/env node
/**
 * The kill-switch table says what it counts — this checks that it still does.
 *
 * `docs/contracts/hook-architecture-v1.md` § Kill switches enumerates every
 * `AGENT_CONFIG_*` identifier a file under `src/scripts/hooks/` or
 * `src/scripts/_lib/` carries, and publishes the command that reproduces the
 * count. An equality between a hand-written table and a grep over a growing
 * tree is exactly the claim that decays without anybody touching the document:
 * the table shipped at 28 == 28 and was stale within a day, because a merge
 * brought in one hook carrying one new switch. Found by an independent review,
 * which is a worse way to find it than a gate.
 *
 * WHAT IS CHECKED, and it is the equality itself rather than a proxy for it:
 * the gate runs the published enumeration and compares the SET against the
 * table's rows. A set comparison rather than a count, because two errors that
 * cancel — one switch added, one row for a deleted switch left behind — is the
 * failure a count cannot see, and it is the one that leaves a reader chasing a
 * variable nothing reads.
 *
 * WHAT IS DELIBERATELY NOT CHECKED: the owner class, and the prose of each row.
 * Whether a switch is `maintainer` or `harness` is a judgement about who is
 * expected to set it, and a gate that guessed at it would either be wrong or
 * would have to encode the judgement somewhere else — which is the table.
 *
 * THE TWO EXCLUSIONS ARE PART OF THE CONTRACT, not a convenience.
 * `__AGENT_CONFIG_BUNDLE__` and `__AGENT_CONFIG_CLI_DELEGATE__` are esbuild
 * `--define` identifiers (see `package.json`'s `build:*` scripts): nothing can
 * set one at runtime, so neither is a switch. They are excluded on the emitted
 * token, because `grep -o` strips the leading underscores and the naive
 * `grep -v __AGENT_CONFIG_BUNDLE__` therefore matches nothing.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { assertScanned, reportScanned } from './_lib/scan_scope.js';

const GATE = 'check_kill_switch_table';
const CONTRACT = path.join('docs', 'contracts', 'hook-architecture-v1.md');
const SECTION = '## Kill switches';
const ROOTS = [path.join('src', 'scripts', 'hooks'), path.join('src', 'scripts', '_lib')];

/** The esbuild defines. Not environment variables, so not switches. */
const BUILD_DEFINES: ReadonlySet<string> = new Set([
    'AGENT_CONFIG_BUNDLE__',
    'AGENT_CONFIG_CLI_DELEGATE__',
]);

const TOKEN = /AGENT_CONFIG_[A-Z_]+/g;
/** A table row: `| \`AGENT_CONFIG_X\` | owner | … |`. */
const ROW = /^\|\s*`(AGENT_CONFIG_[A-Z_]+)`\s*\|/gm;

function walk(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            walk(full, out);
        } else if (e.isFile()) {
            out.push(full);
        }
    }
}

/** Every switch name the declared roots carry, minus the build defines. */
export function switchesInTree(root: string): { names: Set<string>; files: number } {
    const files: string[] = [];
    for (const rel of ROOTS) {
        walk(path.join(root, rel), files);
    }
    const names = new Set<string>();
    for (const f of files) {
        let text: string;
        try {
            text = fs.readFileSync(f, 'utf-8');
        } catch {
            continue;
        }
        for (const m of text.matchAll(TOKEN)) {
            const name = m[0];
            if (!BUILD_DEFINES.has(name)) names.add(name);
        }
    }
    return { names, files: files.length };
}

/** Every switch the contract's table has a row for. */
export function switchesInTable(root: string): { names: Set<string>; present: boolean } {
    let text: string;
    try {
        text = fs.readFileSync(path.join(root, CONTRACT), 'utf-8');
    } catch {
        return { names: new Set(), present: false };
    }
    const at = text.indexOf(SECTION);
    if (at === -1) return { names: new Set(), present: false };
    const rest = text.slice(at + SECTION.length);
    const end = rest.indexOf('\n## ');
    const section = end === -1 ? rest : rest.slice(0, end);
    const names = new Set<string>();
    for (const m of section.matchAll(ROW)) {
        const n = m[1];
        if (n !== undefined) names.add(n);
    }
    return { names, present: true };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();

    const root = process.cwd();
    const ledger = new GateLedger(GATE);
    ledger.plan(['tree-enumeration', 'table-rows', 'set-equality']);

    const tree = switchesInTree(root);
    const scope = {
        gate: GATE,
        scanned: tree.files,
        units: 'source file(s)',
        roots: ROOTS,
    };
    // BEFORE the verdict, per the empty-corpus contract: a run that read no
    // source file must refuse rather than report an empty tree as agreement
    // with an empty table.
    assertScanned(scope);
    reportScanned(scope);
    ledger.complete('tree-enumeration');

    const table = switchesInTable(root);
    if (!table.present) {
        ledger.fail('table-rows', `no "${SECTION}" section in ${CONTRACT}`);
        ledger.fail('set-equality', 'nothing to compare against');
        ledger.report();
        process.stderr.write(
            `❌  ${GATE}: ${CONTRACT} carries no "${SECTION}" section. The section is the\n` +
                '    contract; a tree enumeration with nothing to compare it against is not a pass.\n',
        );
        return 1;
    }
    ledger.complete('table-rows');

    const missing = [...tree.names].filter((n) => !table.names.has(n)).sort();
    const extra = [...table.names].filter((n) => !tree.names.has(n)).sort();

    if (missing.length === 0 && extra.length === 0) {
        ledger.complete('set-equality');
        ledger.report();
        process.stdout.write(
            `✅  ${GATE}: ${String(tree.names.size)} switch(es) in ` +
                `${String(tree.files)} file(s), ${String(table.names.size)} table row(s), sets equal\n`,
        );
        return 0;
    }

    ledger.fail('set-equality', `${String(missing.length + extra.length)} mismatch(es)`);
    ledger.report();
    process.stderr.write(`❌  ${GATE}: the table and the tree disagree.\n\n`);
    for (const n of missing) {
        process.stderr.write(`  MISSING ROW  ${n} — read by the tree, absent from the table\n`);
    }
    for (const n of extra) {
        process.stderr.write(
            `  STALE ROW    ${n} — a table row for a name the tree no longer carries\n`,
        );
    }
    process.stderr.write(
        `\nAdd or remove the row in ${CONTRACT} § Kill switches. A switch with no row is\n` +
            'one an operator cannot find; a row with no switch is one they will set expecting\n' +
            'an effect. If a name is genuinely read outside the two declared roots, the row\n' +
            'stays and says so — the row still has to exist.\n',
    );
    return 1;
}

// ---------------------------------------------------------------------------
// Self-test — the gate proving its own rejections still fire
// ---------------------------------------------------------------------------

function fixture(body: { tree: string; table: string }): string {
    const dir = fs.mkdtempSync(path.join(process.cwd(), '.kst-'));
    fs.mkdirSync(path.join(dir, 'src', 'scripts', 'hooks'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src', 'scripts', '_lib'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'docs', 'contracts'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'scripts', 'hooks', 'a.ts'), body.tree, 'utf-8');
    fs.writeFileSync(path.join(dir, CONTRACT), body.table, 'utf-8');
    return dir;
}

function table(...names: string[]): string {
    const rows = names.map((n) => `| \`${n}\` | maintainer | does a thing | a.ts:1 |`).join('\n');
    return `# Contract\n\n${SECTION}\n\n| Switch | Owner | What | Read at |\n|---|---|---|---|\n${rows}\n\n## Stability\n\nBeta.\n`;
}

function selfTest(): number {
    const repoRoot = process.cwd();
    const script = path.join('src', 'scripts', 'check_kill_switch_table.ts');
    const dirs: string[] = [];
    const run = (body: { tree: string; table: string }): number => {
        const dir = fixture(body);
        dirs.push(dir);
        return runGateCli(repoRoot, script, [], dir);
    };

    const cases: SelfTestCase[] = [
        {
            name: 'equal sets pass',
            expect: 'accept',
            run: () =>
                run({
                    tree: "const A = process.env['AGENT_CONFIG_ALPHA'];\n",
                    table: table('AGENT_CONFIG_ALPHA'),
                }),
        },
        {
            name: 'a switch with no row is rejected',
            expect: 'reject',
            run: () =>
                run({
                    tree: "const A = process.env['AGENT_CONFIG_ALPHA'];\nconst B = process.env['AGENT_CONFIG_BETA'];\n",
                    table: table('AGENT_CONFIG_ALPHA'),
                }),
        },
        {
            name: 'a row with no switch is rejected',
            expect: 'reject',
            run: () =>
                run({
                    tree: "const A = process.env['AGENT_CONFIG_ALPHA'];\n",
                    table: table('AGENT_CONFIG_ALPHA', 'AGENT_CONFIG_GONE'),
                }),
        },
        {
            name: 'one added and one stale do NOT cancel — the count would hide it',
            expect: 'reject',
            run: () =>
                run({
                    tree: "const B = process.env['AGENT_CONFIG_BETA'];\n",
                    table: table('AGENT_CONFIG_ALPHA'),
                }),
        },
        {
            name: 'the esbuild defines are excluded, not counted',
            expect: 'accept',
            run: () =>
                run({
                    tree:
                        'declare const __AGENT_CONFIG_BUNDLE__: boolean;\n'
                        + 'declare const __AGENT_CONFIG_CLI_DELEGATE__: boolean;\n'
                        + "const A = process.env['AGENT_CONFIG_ALPHA'];\n",
                    table: table('AGENT_CONFIG_ALPHA'),
                }),
        },
        {
            name: 'a missing section is rejected, never read as an empty table',
            expect: 'reject',
            run: () =>
                run({
                    tree: "const A = process.env['AGENT_CONFIG_ALPHA'];\n",
                    table: '# Contract\n\n## Stability\n\nBeta.\n',
                }),
        },
    ];

    try {
        return runSelfTest({ gate: GATE, cases, minCases: 6, minRejectCases: 4 });
    } finally {
        for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    }
}

function isCliEntry(): boolean {
    const argv1 = process.argv[1];
    if (argv1 === undefined) return false;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(argv1))
        );
    } catch {
        return pathToFileURL(argv1).href === import.meta.url;
    }
}

if (isCliEntry()) {
    process.exit(main());
}
