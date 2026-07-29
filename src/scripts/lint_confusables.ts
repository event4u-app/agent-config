// Visible mixed-script confusable / homoglyph linter
// (road-to-injection-defense-pressure-corpus.md, Phase 1.2).
//
// Sibling of `lint_hidden_unicode.ts`. That linter catches the INVISIBLE
// smuggling class (zero-width, bidi, tag-block). This one catches the VISIBLE
// class it misses: a Latin word with one or more letters swapped for
// visually-identical Cyrillic or Greek lookalikes (mixed-script token) — the
// homoglyph version of the rules-file-backdoor attack. A reviewer sees
// "ignore"; the model reads a token whose 'o' is U+043E CYRILLIC SMALL LETTER O.
//
// Detection signature (high-precision, low-false-positive):
//   A whitespace-delimited token is flagged when ALL hold —
//     1. it contains >= 1 Latin letter AND >= 1 Cyrillic-or-Greek letter that
//        is in the TR39 confusable set (has a Latin lookalike). Math operators
//        with NO Latin lookalike (Δ Σ Π Ω Φ Θ Λ Ξ Ψ Γ …) are NOT confusables,
//        so legit notation like "ΔNWC" / "Σwᵢ" is never flagged,
//     2. it has >= MIN_LETTERS total letters, and
//     3. Latin is the MAJORITY script (the attack is a Latin word with foreign
//        lookalike substitutions, not a foreign word with one Latin letter).
//   Pure-Cyrillic / pure-Greek / CJK prose is single-script per token and is
//   never flagged — legit non-Latin text passes.
//
// Scope + containment mirror lint_hidden_unicode: scans every .md under
// src/{skills,rules,agent-src,domains} via sl.iter_corpus(); a
// ```security-example fence or a `security-lint: allow mixed-script-confusable`
// pragma exempts a region/file (a doc teaching confusables needs to show one).
//
// Exit 0 clean, 1 on any blocking finding.
//
// Usage: ./scripts-run src/scripts/lint_confusables [--json]

import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as sl from './_lib/security_lint.js';
import {
    MIN_LETTERS as SHARED_MIN_LETTERS,
    TOKEN_RE,
    classifyToken,
} from './_lib/confusables.js';

export const CHECK = 'mixed-script-confusable';

// The confusable table + the mixed-script decision rule live in ONE place so
// this authoring-time linter and the runtime encoding scanner cannot drift apart
// (road-to-runtime-encoding-hardening Phase 3). `_classify_token` stays exported
// under its original name — it is this module's published surface and its tests
// address it here.
const MIN_LETTERS = SHARED_MIN_LETTERS;
const _TOKEN = TOKEN_RE;

/**
 * Classify a single token. Returns the offending mixed-script descriptor when
 * the token matches the homoglyph signature, else null.
 *
 * Thin re-export of the shared implementation — see `_lib/confusables.ts`.
 */
export const _classify_token = classifyToken;

export function _scan(sf: sl.ScannedFile): sl.Finding[] {
    if (sf.pragma_allows(CHECK)) {
        return [];
    }
    const out: sl.Finding[] = [];
    for (const [lineno, text] of sf.iter_lines({ skip_example_fence: true })) {
        const tokens = text.match(_TOKEN);
        if (tokens === null) continue;
        for (const tok of tokens) {
            const desc = _classify_token(tok);
            if (desc !== null) {
                out.push(
                    new sl.Finding(
                        sf.rel,
                        lineno,
                        CHECK,
                        'HIGH',
                        `mixed-script confusable token "${tok}" — ${desc}`,
                        sf.weight,
                    ),
                );
            }
        }
    }
    return out;
}

interface Args {
    json: boolean;
}

function _argError(msg: string): never {
    process.stderr.write('usage: lint_confusables [-h] [--json]\n');
    process.stderr.write(`lint_confusables: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): Args {
    const out: Args = { json: false };
    const extra: string[] = [];
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_confusables [-h] [--json]\n');
            process.exit(0);
        } else if (a === '--json') {
            out.json = true;
        } else {
            extra.push(a);
        }
    }
    if (extra.length > 0) {
        _argError(`unrecognized arguments: ${extra.join(' ')}`);
    }
    return out;
}

export function main(argv: readonly string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const findings: sl.Finding[] = [];
    for (const sf of sl.iter_corpus()) {
        for (const h of _scan(sf)) {
            findings.push(h);
        }
    }

    if (args.json) {
        const payload = sl.py_json_dumps_indent2(findings.map((f) => f.toDict()));
        process.stdout.write(payload + '\n');
        return findings.some((f) => f.is_fail) ? 1 : 0;
    }

    return sl.report(findings, { check_label: 'mixed-script-confusable' });
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
