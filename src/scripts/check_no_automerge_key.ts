#!/usr/bin/env tsx
/**
 * CI gate: the settings key space stays free of an auto-merge policy key.
 *
 * WHY. `ADR-239:79-97` records that merge authority is not extended, and
 * `:185-188` leaves the merge-authority question itself to the owner. A
 * settings key named autoMerge / auto_merge / mergePolicy would grant that
 * authority by configuration rather than by decision. The three names are a
 * closed set on purpose: this is a namespace ratchet, not a policy. Every other
 * route to granting merge authority — a command flag, an ADR, a per-turn
 * confirmation, a differently-named key — is untouched, which is the reason the
 * council ruled the ratchet does not encroach on the reservation
 * (2026-08-23, 2/2 convergent, Q1 verdict (a)).
 *
 * It is a REVERSIBLE architectural boundary, not a permanent prohibition. If the
 * owner later wants one of these exact names, the owner deletes this gate.
 *
 * SCOPE is the two settings files, and the match is anchored on a KEY rather
 * than the word. That is not a style choice: this file's own docstring contains
 * `autoMerge`, so a word-matching gate over the tree would refuse the decision
 * it protects.
 *
 * Exit codes:
 *   0 — no forbidden key present
 *   1 — a forbidden key is declared in a settings file
 *   2 — the gate could not run (missing corpus file, bad args)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger, LedgerUsageError } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.join(path.dirname(_HERE), '..', '..');

/** This script's repo-relative path, for the self-test's CLI invocations. */
const SELF = 'src/scripts/check_no_automerge_key.ts';

/**
 * Self-test floors. Below these, `--self-test` fails instead of printing
 * success — deleting cases would otherwise be the cheapest route to a green one.
 */
const SELF_TEST_MIN_CASES = 7;
const SELF_TEST_MIN_REJECT = 4;

/** Repo-relative corpus. Both files must exist; a missing one is exit 2. */
const CORPUS = [
    'src/config/agent-settings.template.yml',
    'src/scripts/schemas/agent-settings.schema.json',
] as const;

/**
 * Closed set. Widening it is a policy change, not a maintenance edit — the
 * council's verdict is scoped to exactly these three names.
 */
const FORBIDDEN = ['autoMerge', 'auto_merge', 'mergePolicy'] as const;

/** `key:` in YAML, `"key":` in JSON. A mention in prose or a comment is not a key. */
function keyOccurrences(text: string): { key: string; line: number }[] {
    const out: { key: string; line: number }[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] ?? '';
        // Strip a YAML comment tail so `# autoMerge: never` is not a key.
        const code = raw.replace(/#.*$/, '');
        // A leading `{`, `[` or `,` is allowed so an inline JSON object literal
        // is parsed too; the corpus is pretty-printed, but a one-line fixture is
        // the cheapest way to state a JSON case and it must not read as clean.
        const m = code.match(/^[\s{[,]*"?([A-Za-z_][A-Za-z0-9_-]*)"?\s*:/);
        if (m?.[1] !== undefined) out.push({ key: m[1], line: i + 1 });
    }
    return out;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

interface Finding {
    file: string;
    line: number;
    key: string;
}

function check(root: string): { code: number; findings: Finding[]; scanned: number } {
    const findings: Finding[] = [];
    const ledger = new GateLedger('check_no_automerge_key');
    let scanned = 0;

    const occurrences: { file: string; key: string; line: number }[] = [];
    for (const rel of CORPUS) {
        const abs = path.join(root, rel);
        if (!_isFile(abs)) {
            process.stdout.write(`❌  corpus file not found: ${rel}\n`);
            return { code: 2, findings, scanned: 0 };
        }
        for (const occ of keyOccurrences(fs.readFileSync(abs, 'utf-8'))) {
            occurrences.push({ file: rel, ...occ });
        }
    }
    scanned = occurrences.length;

    // Counted on every key inspected, not on the forbidden subset: a shape change
    // that makes the key regex stop matching yields zero keys, zero findings, and
    // a green "no forbidden key". Exit 2 (the gate could not run), never 0.
    try {
        reportScanned({
            gate: 'check_no_automerge_key',
            scanned,
            units: 'settings key(s)',
            roots: [...CORPUS],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return { code: 2, findings, scanned };
        }
        throw err;
    }

    try {
        // The ledger unit is one occurrence, keyed by file:line so a key that
        // legitimately repeats across the two files is not a duplicate plan id.
        ledger.plan(occurrences.map((o) => `${o.file}:${o.line}`));
        for (const o of occurrences) {
            const id = `${o.file}:${o.line}`;
            if ((FORBIDDEN as readonly string[]).includes(o.key)) {
                findings.push({ file: o.file, line: o.line, key: o.key });
                ledger.fail(id, `forbidden settings key \`${o.key}\``);
            } else {
                ledger.complete(id);
            }
        }
    } catch (err) {
        if (err instanceof LedgerUsageError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return { code: 2, findings, scanned };
        }
        throw err;
    }
    ledger.report();

    return { code: findings.length > 0 ? 1 : 0, findings, scanned };
}

/**
 * Build a throwaway settings root and return its path.
 *
 * The self-test drives the REAL CLI against it (`runGateCli`), never `check()`
 * in-process: the thing that has silently no-opped in this repository before is
 * the binary's argv parsing and entry guard, which an in-process call skips.
 */
function _fixtureRoot(templateBody: string, schemaBody: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'automerge-key-'));
    fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src', 'scripts', 'schemas'), { recursive: true });
    fs.writeFileSync(path.join(dir, CORPUS[0]), templateBody);
    fs.writeFileSync(path.join(dir, CORPUS[1]), schemaBody);
    return dir;
}

const CLEAN_TEMPLATE = 'personal:\n  autonomy: auto\n';
const CLEAN_SCHEMA = '{\n  "type": "object",\n  "properties": {\n    "personal": { "type": "object" }\n  }\n}\n';

/**
 * Prove the gate's rejections still fire, from the binary a contributor runs.
 *
 * Two of the accept cases are the ones that made the first draft wrong: a
 * comment mention and a prose mention must NOT be findings, or the gate refuses
 * its own docstring — which contains all three forbidden names.
 */
export function selfTest(): number {
    const made: string[] = [];
    const root = (t: string, sc: string): string => {
        const d = _fixtureRoot(t, sc);
        made.push(d);
        return d;
    };
    const run = (t: string, sc: string): number =>
        runGateCli(DEFAULT_ROOT, SELF, ['--quiet', '--root', root(t, sc)], DEFAULT_ROOT);

    const cases: SelfTestCase[] = [
        {
            name: 'rejects a camelCase YAML key',
            expect: 'reject',
            run: () => run('git:\n  autoMerge: true\n', CLEAN_SCHEMA),
        },
        {
            name: 'rejects a snake_case YAML key',
            expect: 'reject',
            run: () => run('git:\n  auto_merge: false\n', CLEAN_SCHEMA),
        },
        {
            name: 'rejects a policy-named YAML key',
            expect: 'reject',
            run: () => run('git:\n  mergePolicy: strict\n', CLEAN_SCHEMA),
        },
        {
            name: 'rejects a JSON schema property',
            expect: 'reject',
            run: () =>
                run(CLEAN_TEMPLATE, '{\n  "properties": {\n    "autoMerge": { "type": "boolean" }\n  }\n}\n'),
        },
        {
            name: 'accepts a commented-out mention (a comment is not a key)',
            expect: 'accept',
            run: () => run('# autoMerge: never\npersonal:\n  autonomy: auto\n', CLEAN_SCHEMA),
        },
        {
            name: 'accepts a prose mention in a value (the word is not a key)',
            expect: 'accept',
            run: () => run('description: forbids autoMerge and mergePolicy\n', CLEAN_SCHEMA),
        },
        { name: 'accepts a clean corpus', expect: 'accept', run: () => run(CLEAN_TEMPLATE, CLEAN_SCHEMA) },
        {
            name: 'rejects a moved corpus rather than reporting clean (exit 2)',
            expect: 'reject',
            run: () => runGateCli(DEFAULT_ROOT, SELF, ['--quiet', '--root', path.join(DEFAULT_ROOT, 'no-such-root')], DEFAULT_ROOT),
        },
    ];

    try {
        return runSelfTest({
            gate: 'check_no_automerge_key',
            cases,
            minCases: SELF_TEST_MIN_CASES,
            minRejectCases: SELF_TEST_MIN_REJECT,
        });
    } finally {
        for (const d of made) fs.rmSync(d, { recursive: true, force: true });
    }
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const quiet = args.includes('--quiet');
    if (args.includes('--self-test')) return selfTest();

    const rootIdx = args.indexOf('--root');
    const root = rootIdx >= 0 ? (args[rootIdx + 1] ?? DEFAULT_ROOT) : DEFAULT_ROOT;

    const { code, findings, scanned } = check(root);
    if (code === 2) return 2;

    if (findings.length > 0) {
        process.stdout.write(`❌  forbidden auto-merge settings key declared:\n\n`);
        for (const f of findings) {
            process.stdout.write(`  ${f.file}:${f.line} — \`${f.key}\`\n`);
        }
        process.stdout.write(
            `\nMerge authority is owner-reserved (ADR-239:185-188). A settings key would\n` +
                `grant it by configuration. If the owner has decided to grant it this way,\n` +
                `delete this gate deliberately — it is a reversible boundary, not a veto.\n`,
        );
        return 1;
    }

    if (!quiet) {
        process.stdout.write(`✅  no auto-merge settings key (${scanned} key(s) across ${CORPUS.length} file(s)).\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { main, check, keyOccurrences, FORBIDDEN, CORPUS };
