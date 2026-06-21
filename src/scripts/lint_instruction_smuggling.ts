// P1.2 — instruction-smuggling / suppression-phrase linter (road-to-security-pillar.md).
//
// TypeScript twin of `src/scripts/lint_instruction_smuggling.py` (ADR-200 —
// Python→TS migration). Behaviour mirrors the Python module byte-for-byte.
//
// Detects instructions smuggled into rule/skill/command bodies (and MCP tool
// descriptions) that try to steer or silence the agent — the prose half of the
// "rules-file backdoor" + MCP "tool-poisoning" attack classes.
//
// Precision over recall (false-positive containment, P1.5): the corpus
// *legitimately* quotes attack strings as teaching material, so this linter only
// treats a pattern as a **blocking (HIGH)** smuggle when it appears as live
// **prose** — outside any code fence and outside inline `backtick` spans, where a
// teaching doc would put a quoted example. Shell / secret-path signatures are
// common in legitimate security docs, so they are **MED warnings**, never blocking.
//
// - HIGH (fail): disclosure-suppression imperative or an imperative injection
//   tag / phrase in live prose.
// - MED (warn): pipe-to-shell, reverse-shell, or secret-path read in live prose.
//
// Scope: every `.md` under src/{skills,rules,agent-src,domains}. Exempt: a
// ```security-example fence or a `security-lint: allow instruction-smuggling` pragma.
//
// Usage: ./scripts-run src/scripts/lint_instruction_smuggling [--json]

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import * as sl from './_lib/security_lint.js';

export const CHECK = 'instruction-smuggling';

// Python: re.compile(r"`[^`]*`") — global so .replace mirrors re.sub over all.
const _INLINE_CODE = /`[^`]*`/g;

// HIGH — disclosure suppression as an imperative addressed to the agent.
//   Python (re.IGNORECASE):
//     \b(do not|don'?t|never)\s+(mention|tell|inform|disclose|reveal|notify)\b
//     [^.]{0,40}\b(the )?(user|human|reviewer|operator|owner)\b
//     |without (telling|informing|notifying|explaining to) (the )?(user|them|anyone)
const _SUPPRESS = new RegExp(
    '\\b(do not|don\'?t|never)\\s+(mention|tell|inform|disclose|reveal|notify)\\b' +
        '[^.]{0,40}\\b(the )?(user|human|reviewer|operator|owner)\\b' +
        '|without (telling|informing|notifying|explaining to) (the )?(user|them|anyone)',
    'i',
);

// HIGH — imperative injection / role-takeover tags and phrases.
const _INJECT = new RegExp(
    '<\\s*(important|system|admin|secret|critical)\\s*>' +
        '|ignore (all |the )?(previous|prior|above) (instructions|prompts|rules)' +
        '|disregard (all |the )?(previous|prior|above)' +
        '|you are now (a|an|the)\\b' +
        '|new system prompt',
    'i',
);

// MED — execution / exfil signatures (common in legit security docs → warn only).
const _MED: ReadonlyArray<[RegExp, string]> = [
    [/\bcurl\b[^\n|]*\|\s*(ba|z|fi)?sh\b/i, 'pipe-to-shell (curl|sh)'],
    [/\bwget\b[^\n|]*\|\s*(ba|z|fi)?sh\b/i, 'pipe-to-shell (wget|sh)'],
    [/\b(socat|nc)\b[^\n]*\b(exec|-e)\b|\/dev\/tcp\//i, 'reverse-shell signature'],
    [/(~\/\.ssh\/id_[rd]sa|\/etc\/shadow|\.aws\/credentials)/, 'secret-path read'],
];

/** Blank out inline `code` spans so quoted examples don't trip prose checks. */
function _strip_inline_code(text: string): string {
    return text.replace(_INLINE_CODE, (m) => ' '.repeat(m.length));
}

export function _scan(sf: sl.ScannedFile): sl.Finding[] {
    if (sf.pragma_allows(CHECK)) {
        return [];
    }
    const out: sl.Finding[] = [];
    // prose = lines outside ANY fence; inline-code spans blanked.
    for (const [lineno, text] of sf.iter_lines({ skip_example_fence: true, skip_any_fence: true })) {
        const prose = _strip_inline_code(text);
        if (_SUPPRESS.test(prose)) {
            out.push(
                new sl.Finding(
                    sf.rel,
                    lineno,
                    CHECK,
                    'HIGH',
                    'disclosure-suppression imperative in prose',
                    sf.weight,
                ),
            );
        }
        if (_INJECT.test(prose)) {
            out.push(
                new sl.Finding(
                    sf.rel,
                    lineno,
                    CHECK,
                    'HIGH',
                    'injection / role-takeover phrase in prose',
                    sf.weight,
                ),
            );
        }
        for (const [rx, label] of _MED) {
            if (rx.test(prose)) {
                out.push(
                    new sl.Finding(
                        sf.rel,
                        lineno,
                        CHECK,
                        'MED',
                        `${label} in prose (verify intent)`,
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
    process.stderr.write('usage: lint_instruction_smuggling [-h] [--json]\n');
    process.stderr.write(`lint_instruction_smuggling: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): Args {
    const out: Args = { json: false };
    const extra: string[] = [];
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_instruction_smuggling [-h] [--json]\n');
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
    return sl.report(findings, { check_label: 'instruction-smuggling' });
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    process.exitCode = main();
}
