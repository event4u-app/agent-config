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
import { pathToFileURL } from 'node:url';

import * as sl from './_lib/security_lint.js';

export const CHECK = 'mixed-script-confusable';

const MIN_LETTERS = 3;

// Unicode-script classifiers via property escapes (requires the `u` flag).
const _LATIN = /\p{Script=Latin}/u;
const _CYRILLIC = /\p{Script=Cyrillic}/u;
const _GREEK = /\p{Script=Greek}/u;
const _LETTER = /\p{L}/u;
// A "token" is a maximal run of letters / combining marks / decimal digits.
const _TOKEN = /[\p{L}\p{M}\p{Nd}]+/gu;

// Cyrillic + Greek codepoints that have a basic-Latin lookalike (Unicode TR39
// confusables, common subset). A foreign letter only counts toward the
// confusable signal when it is in this set — Greek math operators with no Latin
// twin (Δ Σ Π Ω Φ Θ Λ Ξ Ψ Γ δ π ω …) are deliberately excluded so legit
// notation does not false-positive.
const _CONFUSABLE_FOREIGN: ReadonlySet<number> = new Set([
    // Cyrillic lowercase ↔ Latin
    0x0430 /*а→a*/, 0x0435 /*е→e*/, 0x043e /*о→o*/, 0x0440 /*р→p*/, 0x0441 /*с→c*/,
    0x0443 /*у→y*/, 0x0445 /*х→x*/, 0x0455 /*ѕ→s*/, 0x0456 /*і→i*/, 0x0458 /*ј→j*/,
    0x04bb /*һ→h*/, 0x0501 /*ԁ→d*/, 0x051b /*ԛ→q*/, 0x0577 /*no*/,
    // Cyrillic uppercase ↔ Latin
    0x0410 /*А→A*/, 0x0412 /*В→B*/, 0x0415 /*Е→E*/, 0x041a /*К→K*/, 0x041c /*М→M*/,
    0x041d /*Н→H*/, 0x041e /*О→O*/, 0x0420 /*Р→P*/, 0x0421 /*С→C*/, 0x0422 /*Т→T*/,
    0x0423 /*У→Y*/, 0x0425 /*Х→X*/, 0x0405 /*Ѕ→S*/, 0x0406 /*І→I*/, 0x0408 /*Ј→J*/,
    // Greek lowercase ↔ Latin
    0x03b1 /*α→a*/, 0x03b5 /*ε→e*/, 0x03bf /*ο→o*/, 0x03bd /*ν→v*/, 0x03c1 /*ρ→p*/,
    0x03c5 /*υ→u*/, 0x03c7 /*χ→x*/, 0x03ba /*κ→k*/,
    // Greek uppercase ↔ Latin (only those with a real Latin twin)
    0x0391 /*Α→A*/, 0x0392 /*Β→B*/, 0x0395 /*Ε→E*/, 0x0396 /*Ζ→Z*/, 0x0397 /*Η→H*/,
    0x0399 /*Ι→I*/, 0x039a /*Κ→K*/, 0x039c /*Μ→M*/, 0x039d /*Ν→N*/, 0x039f /*Ο→O*/,
    0x03a1 /*Ρ→P*/, 0x03a4 /*Τ→T*/, 0x03a5 /*Υ→Y*/, 0x03a7 /*Χ→X*/, 0x0392 /*Β→B*/,
]);

type ScriptName = 'latin' | 'cyrillic' | 'greek' | 'other';

function _script_of(ch: string): ScriptName {
    if (_LATIN.test(ch)) return 'latin';
    if (_CYRILLIC.test(ch)) return 'cyrillic';
    if (_GREEK.test(ch)) return 'greek';
    return 'other';
}

/**
 * Classify a single token. Returns the offending mixed-script descriptor when
 * the token matches the homoglyph signature, else null.
 */
export function _classify_token(token: string): string | null {
    let latin = 0;
    let cyrillic = 0;
    let greek = 0;
    let letters = 0;
    for (const ch of token) {
        if (!_LETTER.test(ch)) continue; // skip combining marks / digits for script vote
        letters += 1;
        const script = _script_of(ch);
        if (script === 'latin') {
            latin += 1;
        } else if (script === 'cyrillic' || script === 'greek') {
            // Only confusable foreign letters (TR39) count — math operators with
            // no Latin twin are ignored, so legit notation never trips.
            if (_CONFUSABLE_FOREIGN.has(ch.codePointAt(0) as number)) {
                if (script === 'cyrillic') cyrillic += 1;
                else greek += 1;
            }
        }
    }
    if (letters < MIN_LETTERS) return null;
    const foreign = cyrillic + greek;
    if (latin === 0 || foreign === 0) return null; // single-script (or no Latin) → legit
    if (latin <= foreign) return null; // majority must be Latin (foreign word ≠ attack)
    const which = cyrillic > 0 && greek > 0
        ? 'cyrillic+greek'
        : cyrillic > 0
            ? 'cyrillic'
            : 'greek';
    return `latin+${which} (${latin} latin / ${foreign} foreign-confusable)`;
}

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

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    process.exitCode = main();
}
