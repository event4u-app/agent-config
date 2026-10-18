#!/usr/bin/env tsx
/**
 * The rule table is the only place a raw-key prefix is spelled
 * (road-to-one-detector-and-the-senders-we-own 2.2).
 *
 * Every non-test TypeScript file under `src/scripts` and `src/cli` is read, from
 * the filesystem rather than the index so a file not yet added is seen too; a
 * code line outside `src/scripts/_lib/egress_rules.ts` that spells one of the
 * table's declared prefixes at a token start fails. A second spelling is how the
 * seven private copies of F2 drifted apart — one key shape caught by one
 * consumer and passed unchanged by the next.
 *
 * What it sees: a prefix written as a literal, in a string or a regex, with
 * backslash escapes removed first so `ya29\.` counts. What it does not see: a
 * prefix spelled through a character class (`gh[pousr]_`) or a keyword
 * assignment (`password =`), which carry no vendor literal. A line that names a
 * prefix in prose or as an inert fake value carries
 * `not-a-credential-pattern: <reason>`; a bare marker does not mute.
 *
 * Exit: 0 one spelling · 1 a second spelling found.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CREDENTIAL_PREFIXES } from './_lib/egress_rules.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const GATE = 'check_credential_spelling';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCAN_DIRS: readonly string[] = ['src/scripts', 'src/cli'];
export const OWNER = 'src/scripts/_lib/egress_rules.ts';

function walk(dir: string, out: string[]): void {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name === 'fixtures') continue;
            walk(p, out);
        } else if (/\.(ts|mts)$/.test(e.name) && !/\.(test|spec)\.ts$/.test(e.name)) {
            out.push(p);
        }
    }
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A prefix at a token start; `task-` does not spell `sk-`. */
function prefixSpelling(prefixes: readonly string[]): RegExp {
    const alt = [...prefixes].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
    return new RegExp(`(?<![A-Za-z0-9])(?:${alt})`);
}

const NOT_A_PATTERN = /not-a-credential-pattern: \S/;

/** 1-based lines that spell a prefix; comment lines and reasoned markers excluded. */
export function offendingLines(text: string, prefixes: readonly string[] = CREDENTIAL_PREFIXES): number[] {
    const re = prefixSpelling(prefixes);
    const out: number[] = [];
    text.split('\n').forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
        if (NOT_A_PATTERN.test(code)) return;
        if (re.test(code.replace(/\\/g, ''))) out.push(i + 1);
    });
    return out;
}

/** Every `file:line` outside the table that spells a prefix, and the file count read. */
export function findSpellings(root: string, ledger?: GateLedger): { hits: string[]; scanned: number } {
    const files: string[] = [];
    for (const d of SCAN_DIRS) walk(path.join(root, d), files);
    const hits: string[] = [];
    for (const f of files) {
        const rel = path.relative(root, f).split(path.sep).join('/');
        ledger?.plan(rel);
        if (rel === OWNER) {
            ledger?.outOfScope(rel, 'declared_exemption');
            continue;
        }
        const lines = offendingLines(fs.readFileSync(f, 'utf-8'));
        for (const line of lines) hits.push(`${rel}:${String(line)}`);
        if (lines.length > 0) ledger?.fail(rel, `${String(lines.length)} spelling(s)`);
        else ledger?.complete(rel);
    }
    return { hits, scanned: files.length };
}

export function check(root: string): number {
    const ledger = new GateLedger(GATE);
    const { hits, scanned } = findSpellings(root, ledger);
    ledger.report();
    reportScanned({ gate: GATE, scanned, units: 'TypeScript source file(s)', roots: [...SCAN_DIRS] });
    if (hits.length > 0) {
        process.stderr.write(`❌  ${GATE}: a raw-key prefix is spelled outside ${OWNER}:\n`);
        for (const h of hits) process.stderr.write(`  · ${h}\n`);
        process.stderr.write(
            '\nRead the shape from the table (prefixesOf, rawKeyPrefixPattern, detect) instead of spelling it,\n' +
                'or mark an inert mention with `not-a-credential-pattern: <reason>`.\n',
        );
        return 1;
    }
    process.stdout.write(`✅  ${GATE}: one spelling — every raw-key prefix lives in ${OWNER}.\n`);
    return 0;
}

function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'credential-spelling-selftest-'));
    const prefix = CREDENTIAL_PREFIXES.find((p) => p.endsWith('_')) ?? (CREDENTIAL_PREFIXES[0] as string);
    const dotted = CREDENTIAL_PREFIXES.find((p) => p.includes('.')) ?? prefix;
    const fixture = (name: string, rel: string, body: string): string => {
        const root = path.join(tmp, name);
        fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
        fs.mkdirSync(path.join(root, 'src/scripts'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src/scripts/clean.ts'), 'export const x = 1;\n');
        return root;
    };
    const run = (root: string): number => runGateCli(REPO_ROOT, 'src/scripts/check_credential_spelling.ts', ['--root', root], root);
    try {
        return runSelfTest({
            gate: GATE,
            minCases: 5,
            minRejectCases: 3,
            cases: [
                {
                    name: 'a prefix spelled in a regex under src/scripts is rejected',
                    expect: 'reject',
                    run: () => run(fixture('regex', 'src/scripts/a.ts', `const RE = /${prefix}[A-Za-z0-9]{36}/;\n`)),
                },
                {
                    name: 'a regex-escaped prefix under src/cli is rejected',
                    expect: 'reject',
                    run: () => run(fixture('escaped', 'src/cli/b.ts', `const P = ['${escapeRe(dotted)}', 'x'];\n`)),
                },
                {
                    name: 'a bare marker with no reason does not mute',
                    expect: 'reject',
                    run: () => run(fixture('bare', 'src/scripts/c.ts', `const k = '${prefix}x'; // not-a-credential-pattern:\n`)),
                },
                {
                    name: 'a reasoned marker mutes an inert value',
                    expect: 'accept',
                    run: () =>
                        run(fixture('marked', 'src/scripts/d.ts', `const k = '${prefix}x'; // not-a-credential-pattern: fake\n`)),
                },
                {
                    name: 'a spelling inside the table itself passes',
                    expect: 'accept',
                    run: () => run(fixture('owner', OWNER, `const RE = /${prefix}[A-Za-z0-9]{36}/;\n`)),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`usage: ${GATE} [--root DIR] [--self-test]\n`);
        return 0;
    }
    if (argv.includes('--self-test')) return selfTest();
    const i = argv.indexOf('--root');
    return check(i === -1 ? REPO_ROOT : (argv[i + 1] ?? REPO_ROOT));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
