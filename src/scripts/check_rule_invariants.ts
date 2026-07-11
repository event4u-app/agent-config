#!/usr/bin/env tsx
/**
 * Kernel semantic-invariants checker.
 *
 * Counterfactual (2026-07-10): PRs #840/#844 showed MERGED on GitHub but their
 * content vanished from main (merge commits unreachable after a history repair);
 * re-landed as #847 (13f244c9b — non-destructive "Irreversible external action"
 * row + "Never act while asking" clause) and #849 (2c46e7f3b — direct-answers
 * "no duration estimates" + "never cite the rule"). This checker's invariant set
 * covers those exact strings — it would have flagged the loss at CI time.
 *
 * Loads `tests/golden/invariants.json` and verifies that every invariant
 * string (whitespace-normalised: runs of whitespace collapse to a single
 * space) is present in BOTH the kernel rule's `src/rules/` source and its
 * `dist/agent-src/rules/` projection. A missing string means a rule's
 * behaviour guarantee was silently lost in a merge / condensation pass.
 *
 * Kernel set: docs/contracts/kernel-membership.md § 4 (9 locked rules).
 *
 * Usage:
 *   npx tsx src/scripts/check_rule_invariants.ts [--root ROOT]
 *   npx tsx src/scripts/check_rule_invariants.ts --mutation-selftest
 *
 * `--mutation-selftest` picks the first invariant and verifies the check
 * WOULD fail if that string were absent (in-memory mutation) — guards the
 * checker itself against a silently-green normalisation bug.
 *
 * Exit codes: 0 = clean / selftest passed, 1 = missing invariant(s) or
 * selftest failure, 2 = usage error, 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// src/scripts/check_rule_invariants.ts → two dirs up is the repo root.
const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const INVARIANTS_JSON = 'tests/golden/invariants.json';

interface InvariantEntry {
    rule: string;
    file: string;
    dist: string;
    strings: string[];
}

interface Miss {
    rule: string;
    file: string;
    invariant: string;
}

/** Collapse every run of whitespace (incl. newlines) to a single space. */
function normalize(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function loadEntries(root: string): InvariantEntry[] {
    const p = path.join(root, INVARIANTS_JSON);
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
        throw new Error(`${INVARIANTS_JSON}: expected a top-level array`);
    }
    // A leading `{"_meta": ...}` element carries the change-process pointer
    // (JSON has no comments); it is not an invariant entry.
    const entries = (parsed as Array<InvariantEntry | { _meta: unknown }>).filter(
        (e): e is InvariantEntry => !('_meta' in e),
    );
    for (const entry of entries) {
        if (
            typeof entry.rule !== 'string' ||
            typeof entry.file !== 'string' ||
            typeof entry.dist !== 'string' ||
            !Array.isArray(entry.strings) ||
            entry.strings.some((s) => typeof s !== 'string' || s.length === 0)
        ) {
            throw new Error(
                `${INVARIANTS_JSON}: malformed entry ${JSON.stringify(entry.rule ?? entry)}`,
            );
        }
    }
    return entries;
}

/** Check one entry against pre-normalised file contents. */
function checkEntry(
    entry: InvariantEntry,
    normalizedByFile: ReadonlyMap<string, string>,
): Miss[] {
    const misses: Miss[] = [];
    for (const target of [entry.file, entry.dist]) {
        const haystack = normalizedByFile.get(target);
        if (haystack === undefined) {
            for (const s of entry.strings) {
                misses.push({ rule: entry.rule, file: target, invariant: s });
            }
            continue;
        }
        for (const s of entry.strings) {
            if (!haystack.includes(normalize(s))) {
                misses.push({ rule: entry.rule, file: target, invariant: s });
            }
        }
    }
    return misses;
}

function readNormalized(root: string, entries: readonly InvariantEntry[]): Map<string, string> {
    const out = new Map<string, string>();
    for (const entry of entries) {
        for (const target of [entry.file, entry.dist]) {
            if (out.has(target)) {
                continue;
            }
            const p = path.join(root, target);
            try {
                out.set(target, normalize(fs.readFileSync(p, 'utf-8')));
            } catch {
                // Leave absent — checkEntry reports every string as missing.
            }
        }
    }
    return out;
}

function scan(root: string): Miss[] {
    const entries = loadEntries(root);
    const normalizedByFile = readNormalized(root, entries);
    const misses: Miss[] = [];
    for (const entry of entries) {
        misses.push(...checkEntry(entry, normalizedByFile));
    }
    return misses;
}

function formatText(misses: Miss[], invariantCount: number): string {
    if (misses.length === 0) {
        return `✅  All ${invariantCount} kernel rule invariants present in src + dist.`;
    }
    const lines: string[] = [
        `❌  ${misses.length} missing kernel rule invariant(s):\n`,
    ];
    for (const m of misses) {
        lines.push(`  🔴 ${m.rule} — ${m.file}\n     missing: "${m.invariant}"`);
    }
    lines.push(
        '\nA kernel rule lost a load-bearing clause — likely a merge or condensation ' +
            'dropped it silently (see the #840/#844 incident in this file header). ' +
            'Restore the clause, or reword it via the documented change process: ' +
            'docs/contracts/kernel-membership.md § 10 — Changing a protected invariant ' +
            '(never "update the gate green").',
    );
    return lines.join('\n');
}

/**
 * Mutation self-test: remove the first invariant string from its src file's
 * content in-memory and verify the check catches the absence.
 */
function mutationSelftest(root: string): number {
    const entries = loadEntries(root);
    const first = entries[0];
    if (first === undefined || first.strings[0] === undefined) {
        process.stderr.write('mutation-selftest: no invariants defined\n');
        return 1;
    }
    const invariant = first.strings[0];
    const p = path.join(root, first.file);
    const original = normalize(fs.readFileSync(p, 'utf-8'));
    const needle = normalize(invariant);
    if (!original.includes(needle)) {
        process.stderr.write(
            `mutation-selftest: baseline broken — "${invariant}" not present in ${first.file}\n`,
        );
        return 1;
    }
    const mutated = original.split(needle).join('');
    if (mutated.includes(needle)) {
        process.stderr.write('mutation-selftest: mutation did not remove the string\n');
        return 1;
    }
    // Run the REAL check path against the mutated content: swap the src
    // file's normalised content in-memory and assert checkEntry reports
    // the removed invariant as missing.
    const normalizedByFile = readNormalized(root, [first]);
    normalizedByFile.set(first.file, mutated);
    const misses = checkEntry(first, normalizedByFile);
    const detected = misses.some(
        (m) => m.file === first.file && m.invariant === invariant,
    );
    if (!detected) {
        process.stderr.write(
            `mutation-selftest: FAILED — removing "${invariant}" from ${first.file} was NOT detected\n`,
        );
        return 1;
    }
    process.stdout.write(
        `✅  mutation-selftest passed: removing "${invariant}" from ${first.file} is detected.\n`,
    );
    return 0;
}

interface ParsedArgs {
    root: string;
    mutationSelftest: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let root = ROOT;
    let selftest = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--root') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --root: expected one argument');
            }
            root = v;
        } else if (arg.startsWith('--root=')) {
            root = arg.slice('--root='.length);
        } else if (arg === '--mutation-selftest') {
            selftest = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_rule_invariants [-h] [--root ROOT] [--mutation-selftest]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { root, mutationSelftest: selftest };
}

function _argparse_error(message: string): never {
    process.stderr.write(`check_rule_invariants: error: ${message}\n`);
    process.exit(2);
}

function main(): number {
    const args = parse_args(process.argv.slice(2));
    try {
        if (args.mutationSelftest) {
            return mutationSelftest(args.root);
        }
        const entries = loadEntries(args.root);
        const invariantCount = entries.reduce((n, e) => n + e.strings.length, 0);
        const misses = scan(args.root);
        process.stdout.write(formatText(misses, invariantCount) + '\n');
        return misses.length ? 1 : 0;
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`Internal error: ${msg}\n`);
        return 3;
    }
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

export { type InvariantEntry, type Miss, ROOT, INVARIANTS_JSON, normalize, scan, main };
