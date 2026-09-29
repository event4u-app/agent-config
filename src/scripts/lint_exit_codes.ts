#!/usr/bin/env tsx
/**
 * A hook's exit code comes from the table, never from a numeral.
 *
 * road-to-a-kernel-that-guards-its-plumbing 4.1, the enforcing half.
 * `hooks/exit_codes.ts` is the table; this is what keeps it the only one.
 *
 * WHAT THE NUMERALS COST. Thirty-three files under `src/scripts/hooks/` each
 * declared their own `EXIT_ALLOW = 0` / `EXIT_BLOCK = 1` / `EXIT_WARN = 2`, two
 * of them under a third name. The danger is not a typo: 1 and 2 mean the
 * OPPOSITE things on Claude Code from what they mean in this tree's internal
 * language, which is why `host_semantics.ts` exists to lower one onto the
 * other. A bare `process.exit(1)` in a concern is a claim about which of the
 * two dialects the writer had in mind, and the source does not record which.
 *
 * WHAT IT SCANS. `.ts` under `src/scripts/hooks/`, refusing a call whose
 * argument is a bare numeric literal. An identifier is accepted whatever it is
 * called — this gate does not verify that the identifier came from the table,
 * because a gate that resolved imports would be a type-checker, and the thing
 * it would catch (a local `const EXIT_BLOCK = 1` shadowing the import) is
 * already visible in review as a duplicate declaration. Stated rather than left
 * for a reader to assume the green covers it.
 *
 * WHY THE DISPATCHERS ARE OUT OF SCOPE. The `*-dispatcher.sh` trampolines carry
 * `process.exit(0)` inside a `node -e` one-liner that reads a workspace root
 * off stdin. They are shell, they cannot import, and their exit code is the
 * one-liner's, never a verdict. The table's own header says so; this gate scans
 * `.ts` only, which is the same boundary stated once more where it is enforced.
 *
 * THE TABLE FILE ITSELF is excluded, and that is the one exclusion: it is where
 * the numerals are DEFINED, so a gate that refused them there would forbid the
 * fix it exists to require.
 *
 * Exit codes: 0 clean · 1 a bare numeral reached `process.exit` · 2 the corpus
 * could not be read.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const GATE = 'lint_exit_codes';

const HOOKS_REL = path.join('src', 'scripts', 'hooks');

/** The file that DEFINES the numerals. Excluding it is not a carve-out. */
const TABLE_BASENAME = 'exit_codes.ts';

/**
 * `process.exit(<digits>)`, with optional whitespace.
 *
 * Deliberately anchored on `process.exit` rather than on any `exit(`: a
 * concern's own helper named `exit` is not the process boundary, and widening
 * the pattern to catch it would red on ordinary code.
 */
const BARE_EXIT = /process\s*\.\s*exit\s*\(\s*(-?\d+)\s*\)/g;

export interface ExitFinding {
    readonly file: string;
    readonly line: number;
    readonly code: string;
}

/** Findings in one file's text. Pure, so a test reads the decision. */
export function findBareExits(rel: string, text: string): ExitFinding[] {
    const out: ExitFinding[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string;
        // A commented example is prose about the rule, not an exit.
        if (/^\s*(\*|\/\/)/.test(line)) continue;
        BARE_EXIT.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = BARE_EXIT.exec(line)) !== null) {
            out.push({ file: rel, line: i + 1, code: m[1] as string });
        }
    }
    return out;
}

function hookFiles(root: string): string[] {
    const dir = path.join(root, HOOKS_REL);
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return entries
        .filter((f) => f.endsWith('.ts') && f !== TABLE_BASENAME)
        .map((f) => path.join(HOOKS_REL, f))
        .sort();
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    const i = argv.indexOf('--root');
    if (i !== -1 && (argv[i + 1] === undefined || argv[i + 1]?.startsWith('-') === true)) {
        process.stderr.write(`${GATE}: \`--root\` needs a directory.\n`);
        return 2;
    }
    const root = i === -1 ? ROOT : (argv[i + 1] as string);

    const files = hookFiles(root);
    const findings: ExitFinding[] = [];
    for (const rel of files) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf-8');
        } catch {
            continue;
        }
        findings.push(...findBareExits(rel, text));
    }

    // Before the verdict: a corpus of zero is a gate that read nothing, and a
    // green over it says the tree is clean when nobody looked.
    try {
        reportScanned({ gate: GATE, scanned: files.length, units: 'hook file(s)', roots: [HOOKS_REL] });
    } catch (exc) {
        process.stderr.write(`❌  ${String((exc as Error).message)}\n`);
        return 2;
    }

    const ledger = new GateLedger(GATE);
    ledger.plan(files);
    const failed = new Set(findings.map((f) => f.file));
    for (const f of findings) {
        ledger.fail(f.file, `bare exit numeral ${f.code} at line ${String(f.line)}`);
    }
    for (const rel of files) if (!failed.has(rel)) ledger.complete(rel);
    ledger.report();

    if (findings.length > 0) {
        for (const f of findings) {
            process.stdout.write(
                `❌  ${GATE}: ${f.file}:${String(f.line)} exits with the bare numeral ` +
                    `\`${f.code}\`. Import the name from \`hooks/exit_codes.ts\` — the numbers ` +
                    'mean opposite things in this tree and on the host, and a numeral records ' +
                    'neither.\n',
            );
        }
        return 1;
    }
    process.stdout.write(
        `✅  ${GATE}: ${String(files.length)} hook file(s), no bare exit numeral.\n`,
    );
    return 0;
}

function selfTest(): number {
    const plant = (name: string, body: string): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `exit-codes-${name}-`));
        fs.mkdirSync(path.join(dir, HOOKS_REL), { recursive: true });
        fs.writeFileSync(path.join(dir, HOOKS_REL, 'probe_hook.ts'), body, 'utf-8');
        // The table itself, so the exclusion is exercised rather than assumed.
        fs.writeFileSync(
            path.join(dir, HOOKS_REL, TABLE_BASENAME),
            'export const EXIT_ALLOW = 0;\nprocess.exit(0);\n',
            'utf-8',
        );
        return dir;
    };
    const run = (root: string): number =>
        runGateCli(ROOT, path.join('src', 'scripts', 'lint_exit_codes.ts'), ['--root', root], ROOT);

    return runSelfTest({
        gate: GATE,
        minCases: 6,
        minRejectCases: 4,
        cases: [
            {
                name: 'an empty corpus is refused, not certified green',
                expect: 'reject',
                run: () => run(fs.mkdtempSync(path.join(os.tmpdir(), 'exit-codes-empty-'))),
            },
            {
                name: 'a bare deny numeral fails',
                expect: 'reject',
                run: () => run(plant('block', 'process.exit(1);\n')),
            },
            {
                name: 'a bare allow numeral fails too — 0 is the one people think is harmless',
                expect: 'reject',
                run: () => run(plant('allow', 'process.exit(0);\n')),
            },
            {
                name: 'whitespace inside the call does not hide it',
                expect: 'reject',
                run: () => run(plant('spaced', 'process . exit ( 2 );\n')),
            },
            {
                name: 'an imported name passes',
                expect: 'accept',
                run: () =>
                    run(
                        plant(
                            'named',
                            "import { EXIT_ALLOW } from './exit_codes.js';\nprocess.exit(EXIT_ALLOW);\n",
                        ),
                    ),
            },
            {
                // The table defines the numerals; refusing them there would
                // forbid the fix this gate exists to require. Exercised, not
                // assumed — the plant writes a bare exit into it every time.
                name: 'the table file is excluded even though it carries a numeral',
                expect: 'accept',
                run: () =>
                    run(
                        plant(
                            'table',
                            "import { EXIT_WARN } from './exit_codes.js';\nprocess.exit(EXIT_WARN);\n",
                        ),
                    ),
            },
        ],
    });
}

function _isCliEntry(): boolean {
    const entry = process.argv[1];
    return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (_isCliEntry()) {
    process.exit(main());
}
