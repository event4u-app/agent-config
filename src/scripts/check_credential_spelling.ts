#!/usr/bin/env tsx
/**
 * The rule table is the only place a raw-key prefix is spelled
 * (road-to-one-detector-and-the-senders-we-own 2.2).
 *
 * Every non-test TypeScript file under `src/scripts` and `src/cli` is read, from
 * the filesystem rather than the index so a file not yet added is seen too; a
 * code line outside `src/scripts/_lib/egress_rules.ts` (and its generated,
 * equality-checked projection `egress_prefixes.ts`) that spells one of the
 * table's declared prefixes at a token start fails. A second spelling is how the
 * seven private copies of F2 drifted apart — one key shape caught by one
 * consumer and passed unchanged by the next.
 *
 * What it sees: a prefix written as a literal, in a string or a regex, with
 * backslash escapes removed first so `ya29\.` counts; a prefix spelled through a
 * character class or an alternation (`gh[pousr]_`, `(sk|pk)-`) that expands to
 * one of the table's prefixes; and a keyword-assignment shape — a credential
 * keyword of the table's vocabulary and the `[:=]` operator class on one line
 * (step 2.7). What it does not see: a shape assembled across lines, or a keyword
 * spelled through a variable. A line that names a prefix in prose or as an inert
 * fake value carries `not-a-credential-pattern: <reason>`; a bare marker does
 * not mute.
 *
 * Exit: 0 one spelling · 1 a second spelling found.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CREDENTIAL_PREFIXES as PROJECTED } from './_lib/egress_prefixes.js';
import { ASSIGNMENT_KEYWORDS, CREDENTIAL_PREFIXES, EGRESS_RULES } from './_lib/egress_rules.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const GATE = 'check_credential_spelling';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCAN_DIRS: readonly string[] = ['src/scripts', 'src/cli'];
export const OWNER = 'src/scripts/_lib/egress_rules.ts';
/** The bundled projection of the table's prefix list, checked equal to it by its own test. */
export const PROJECTION = 'src/scripts/_lib/egress_prefixes.ts';

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

// A quoted rule id names a row (`'xai-api-key'`); it is not a spelling of the
// prefix it happens to start with, so it is removed before the line is judged.
const RULE_ID = new RegExp(
    `(['"\`])(?:${EGRESS_RULES.map((r) => escapeRe(r.rule)).join('|')})\\1`,
    'g',
);

// One alternative of a class spelling: a stem with at most one character class.
const CLASS_ALT = /^([a-z_]{1,16})(?:\[([a-z]{1,16})\])?$/;
// What follows a class spelling: one separator, or a class of separators.
const SEPARATOR = /^(?:\[[-_]{1,2}\]|[-_])/;
const CLASS_GROUP = /\(([a-z_|[\]]{1,80})\)/g;
const BARE_CLASS = /(?<![A-Za-z0-9_(|])([a-z]{1,16})\[([a-z]{1,16})\]/g;

function expandAlt(alt: string): string[] {
    const m = CLASS_ALT.exec(alt);
    if (m === null) return [];
    const stem = m[1] as string;
    return m[2] === undefined ? [stem] : [...(m[2] as string)].map((c) => stem + c);
}

/** The table prefixes a class or alternation spelling on this line expands to. */
export function classSpelledHits(code: string, prefixes: readonly string[] = CREDENTIAL_PREFIXES): string[] {
    const hits = new Set<string>();
    const judge = (stems: readonly string[], after: string): void => {
        const sep = SEPARATOR.exec(after)?.[0];
        if (sep === undefined) return;
        const seps = sep.length === 1 ? [sep] : [...sep.slice(1, -1)];
        for (const stem of stems) for (const c of seps) if (prefixes.includes(stem + c)) hits.add(stem + c);
    };
    for (const m of code.matchAll(CLASS_GROUP)) {
        judge(
            (m[1] as string).split('|').flatMap(expandAlt),
            code.slice((m.index ?? 0) + m[0].length),
        );
    }
    for (const m of code.matchAll(BARE_CLASS)) {
        judge(expandAlt(`${m[1] as string}[${m[2] as string}]`), code.slice((m.index ?? 0) + m[0].length));
    }
    return [...hits];
}

const KEYWORD = new RegExp(Object.values(ASSIGNMENT_KEYWORDS).map(escapeRe).join('|'), 'i');
const ASSIGNMENT_OPERATOR = /\[:=\]/;

/** A keyword-assignment shape spelled on one line: a table keyword beside the `[:=]` operator class. */
export function spellsAssignmentShape(code: string): boolean {
    return ASSIGNMENT_OPERATOR.test(code) && KEYWORD.test(code);
}

/** 1-based lines that spell a prefix or a shape; comment lines and reasoned markers excluded. */
export function offendingLines(text: string, prefixes: readonly string[] = CREDENTIAL_PREFIXES): number[] {
    const re = prefixSpelling(prefixes);
    const out: number[] = [];
    text.split('\n').forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
        if (NOT_A_PATTERN.test(code)) return;
        const bare = code.replace(RULE_ID, '');
        if (
            re.test(bare.replace(/\\/g, '')) ||
            classSpelledHits(bare, prefixes).length > 0 ||
            spellsAssignmentShape(bare)
        ) {
            out.push(i + 1);
        }
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
        if (rel === OWNER || rel === PROJECTION) {
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
    if (JSON.stringify(PROJECTED) !== JSON.stringify(CREDENTIAL_PREFIXES)) {
        process.stderr.write(`❌  ${GATE}: ${PROJECTION} no longer equals the table's prefix list — regenerate it.\n`);
        return 1;
    }
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
            minCases: 8,
            minRejectCases: 5,
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
                    name: 'a prefix family spelled as a character class is rejected',
                    expect: 'reject',
                    run: () => run(fixture('class', 'src/scripts/e.ts', 'const RE = /\\b(gh[pousr]|x)[-_][A-Za-z0-9]{8,}/g;\n')), // not-a-credential-pattern: self-test fixture
                },
                {
                    name: 'a keyword-assignment shape spelled outside the table is rejected',
                    expect: 'reject',
                    run: () => run(fixture('assign', 'src/cli/f.ts', 'const RE = /(?:password|api[_-]?key)\\s*[:=]\\s*\\S{8,}/i;\n')), // not-a-credential-pattern: self-test fixture
                },
                {
                    name: 'a shape read from the table passes',
                    expect: 'accept',
                    run: () =>
                        run(
                            fixture(
                                'reads',
                                'src/scripts/g.ts',
                                "const RE = assignmentPattern({ keywords: ['password'], value: '\\\\S{8,}' }, 'i');\n",
                            ),
                        ),
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
