#!/usr/bin/env tsx
/**
 * Python-twin rationale guard (road-to-truth-and-reference-hygiene Phase 2).
 *
 * The py2ts migration (ADR-200) is closed and its Python originals are
 * deleted; the parity scaffolding comments ("TypeScript twin of …", "latent
 * Python quirks replicated", "byte-identical to the Python original") were
 * swept on 2026-07-08 and re-attributed to their live consumers (tests,
 * checksum gates, pinned CLI contracts). This lint keeps the residue from
 * creeping back: a NEW comment that rationalises behaviour by fidelity to
 * the deleted Python twin fails CI.
 *
 * Scope: comment lines in `src/scripts/**\/*.ts`. Historical provenance
 * mentions ("ported from the retired Python `x.py` (ADR-200)") are fine —
 * they state history, not a live contract; only the twin-rationale shapes
 * below are banned.
 *
 * Exit codes: 0 clean · 1 findings.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SCOPE = path.join(ROOT, 'src', 'scripts');

/**
 * Banned rationale shapes (case-insensitive).
 *
 * `twin-of` is qualified with a Python signal on purpose. The bare `/\btwin of\b/`
 * it replaced banned an English word rather than a claim shape, and produced 6 false
 * positives out of 7 findings: a CLI twin of an MCP tool, a sync twin of an async
 * probe in the same file, a debate twin of a sibling function, a SQLite twin of a
 * JSON cache. None of those rationalise anything by fidelity to a deleted Python
 * original — which is the only thing this gate exists to stop — and rewording correct
 * comments to dodge a word would have been the tail wagging the dog.
 *
 * The narrowing does not weaken the gate: every shape it targets names Python by
 * construction ("TypeScript twin of the Python original", "twin of the retired
 * .py"), so the qualifier is satisfied precisely when the claim is the banned one.
 * The other three patterns already carry their own Python signal.
 */
export const BANNED: ReadonlyArray<[string, RegExp]> = [
    ['twin-of', /\btwin of\b[^\n]*\b(?:python|py2ts|\.py)\b|\b(?:python|py2ts|\.py)\b[^\n]*\btwin of\b/i],
    ['latent-quirks', /latent (?:python )?(?:quirks|bugs) replicated/i],
    ['byte-identical-python', /byte-identical to the python/i],
    ['python-original', /\bthe python original\b/i],
];

const COMMENT = /^\s*(\/\/|\*|\/\*)/;

function* walk(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name < b.name ? -1 : 1,
    )) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) yield* walk(full);
        else if (e.name.endsWith('.ts')) yield full;
    }
}

export function scan_file(rel: string, text: string): string[] {
    const findings: string[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!COMMENT.test(line)) continue;
        for (const [name, pat] of BANNED) {
            if (pat.test(line)) {
                findings.push(`${rel}:${i + 1}: ${name} — ${line.trim().slice(0, 100)}`);
            }
        }
    }
    return findings;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const QUIET = argv.includes('--quiet');
    const findings: string[] = [];
    let scanned = 0;
    for (const f of walk(SCOPE)) {
        if (path.resolve(f) === path.resolve(_HERE)) continue; // this guard documents the shapes
        scanned += 1;
        const rel = path.relative(ROOT, f).split(path.sep).join('/');
        findings.push(...scan_file(rel, fs.readFileSync(f, 'utf-8')));
    }
    try {
        assertScanned({
            gate: 'lint_no_python_twin_rationale',
            scanned,
            units: 'source file(s)',
            roots: ['src/scripts'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stdout.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    if (findings.length === 0) {
        if (!QUIET) process.stdout.write('✅  No Python-twin rationale in src/scripts comments.\n');
        return 0;
    }
    process.stdout.write(`❌  Python-twin rationale reintroduced — ${findings.length} finding(s):\n`);
    for (const f of findings) process.stdout.write(`    ${f}\n`);
    process.stdout.write(
        '\nFix: state the LIVE contract instead (which test/gate/consumer pins the\n' +
            'behaviour) — never fidelity to the deleted Python original. See\n' +
            'road-to-truth-and-reference-hygiene Phase 2.\n',
    );
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
