/**
 * Intake trigger + dedup for `agents/decisions/low-impact-decisions.md` (Phase 12).
 *
 * TypeScript twin of `src/scripts/ai_council/low_impact_intake.py`
 * (ADR-096 — Python→TS migration, Phase 1). Pure-text, deterministic.
 *
 * User signals "leichte Frage" / "low-impact question" / equivalents
 * (see {@link TRIGGER_PHRASES}); the host agent collects the
 * most-recently-asked question, translates to English, runs the privacy
 * redactor, and routes the result through this module.
 *
 * Behaviour (per Phase 12 § Step 2):
 *
 * - Normalise: lowercase, strip punctuation, collapse whitespace.
 * - Match against `## On Probation` → append today's UTC date to that
 *   entry's `seen` array (idempotent on same-day re-append).
 * - Match against `## Validated` → no-op, returns {@link IntakeOutcome}
 *   with `kind="duplicate_validated"`.
 * - No match → append a fresh entry under `## On Probation` with
 *   `first-seen <today>` and `seen [<today>]`.
 *
 * The promotion / pruning step is `probation_gate`, called by the caller
 * after intake (or at council startup).
 */

import * as fs from 'node:fs';

/** User trigger phrases (DE + EN) — substring match, lowercase. */
export const TRIGGER_PHRASES: readonly string[] = [
    // German
    'das ist eine leichte frage',
    'eine leichte frage',
    'mach das selber',
    'lös das selber',
    'löse das im council',
    'frag das council',
    // English
    'low-impact question',
    'low impact question',
    'council should answer this',
    'you should know this yourself',
    'ask the council',
];

const _PROBATION_HEADER = '## On Probation';
const _VALIDATED_HEADER = '## Validated';
const _ANTI_HEADER = '## Anti-Examples (Always Ask User)';

// Python: re.compile(r"[^\w\s]") — Unicode \w and \s by default.
const _NORMALISE_PUNCT_RE = /[^\p{L}\p{N}_\s]/gu;
// Python: re.compile(r"\s+") — Unicode \s.
const _WHITESPACE_RE = /\s+/gu;

export type IntakeKind = 'appended_seen' | 'new_probation' | 'duplicate_validated' | 'noop';

export interface IntakeOutcome {
    readonly kind: IntakeKind;
    readonly question: string;
    readonly today: string;
    readonly note: string;
}

function _outcome(kind: IntakeKind, question: string, today: string, note = ''): IntakeOutcome {
    return { kind, question, today, note };
}

/** Python `str.strip()` — leading/trailing whitespace. */
function _strip(s: string): string {
    return s.trim();
}

/** True when `userText` carries any intake trigger phrase. */
export function matches_trigger(userText: string): boolean {
    const lo = userText.toLowerCase();
    return TRIGGER_PHRASES.some((p) => lo.includes(p));
}

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalise(question: string): string {
    let out = _strip(question.toLowerCase());
    out = out.replace(_NORMALISE_PUNCT_RE, ' ');
    out = out.replace(_WHITESPACE_RE, ' ');
    return _strip(out);
}

function _today(): string {
    // Python: datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return new Date().toISOString().slice(0, 10);
}

/** Return {header: [body_start, body_end]} char offsets. */
function _splitSections(text: string): Map<string, [number, number]> {
    const headers = [_PROBATION_HEADER, _VALIDATED_HEADER, _ANTI_HEADER];
    const spans = new Map<string, [number, number]>();
    for (const h of headers) {
        const i = text.indexOf(h);
        if (i < 0) {
            continue;
        }
        const bodyStart = text.indexOf('\n', i) + 1;
        let nextHeaderI = text.length;
        for (const other of [...headers, '## Security', '## Provenance']) {
            const j = text.indexOf('\n' + other, bodyStart);
            if (j >= 0 && j < nextHeaderI) {
                nextHeaderI = j;
            }
        }
        spans.set(h, [bodyStart, nextHeaderI]);
    }
    return spans;
}

// Python: re.match(r'^\s*-\s*"([^"]+)"', line)
const _ENTRY_RE = /^\s*-\s*"([^"]+)"/u;

/** Return [[quoted_question, full_line]] for `- "…" — …` bullets. */
function _parseEntries(body: string): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    for (const line of _splitlines(body)) {
        const m = _ENTRY_RE.exec(line);
        if (m) {
            out.push([m[1] as string, line]);
        }
    }
    return out;
}

/**
 * Python `str.splitlines()` — splits on universal newlines and drops a
 * single trailing newline (no empty final element). For corpus text the
 * `\n` / `\r\n` / `\r` set is what matters.
 */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    const lines = s.split(/\r\n|\r|\n/u);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

export interface RecordIntakeOptions {
    today?: string | null;
}

/** Append intake signal to the corpus. Pure-text, deterministic. */
export function record_intake(
    corpusPath: string,
    question: string,
    opts: RecordIntakeOptions = {},
): IntakeOutcome {
    const today = opts.today ?? _today();
    const text = fs.readFileSync(corpusPath, { encoding: 'utf-8' });
    const normQ = normalise(question);
    const spans = _splitSections(text);

    if (spans.has(_VALIDATED_HEADER)) {
        const [s, e] = spans.get(_VALIDATED_HEADER) as [number, number];
        for (const [q] of _parseEntries(text.slice(s, e))) {
            if (normalise(q) === normQ) {
                return _outcome('duplicate_validated', question, today, 'already learned');
            }
        }
    }

    if (spans.has(_PROBATION_HEADER)) {
        const [s, e] = spans.get(_PROBATION_HEADER) as [number, number];
        const body = text.slice(s, e);
        for (const [q, line] of _parseEntries(body)) {
            if (normalise(q) === normQ) {
                if (line.includes(today)) {
                    return _outcome('noop', question, today, 'already seen today');
                }
                const newLine = _appendSeen(line, today);
                const newText = text.slice(0, s) + _replaceOnce(body, line, newLine) + text.slice(e);
                fs.writeFileSync(corpusPath, newText, { encoding: 'utf-8' });
                return _outcome('appended_seen', question, today);
            }
        }

        const newEntry = `- "${_strip(question)}" — first-seen ${today} · seen [${today}]\n`;
        const newText = _rstrip(text.slice(0, e)) + '\n\n' + newEntry + '\n' + text.slice(e);
        fs.writeFileSync(corpusPath, newText, { encoding: 'utf-8' });
        return _outcome('new_probation', question, today);
    }

    return _outcome('noop', question, today, 'probation section missing');
}

/** Python `str.rstrip()` — strip trailing whitespace. */
function _rstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** Python `str.replace(old, new, 1)` — replace first occurrence only. */
function _replaceOnce(s: string, oldStr: string, newStr: string): string {
    const i = s.indexOf(oldStr);
    if (i < 0) {
        return s;
    }
    return s.slice(0, i) + newStr + s.slice(i + oldStr.length);
}

// Python: re.sub(r"seen \[([^\]]*)\]", _sub, line)
const _SEEN_RE = /seen \[([^\]]*)\]/gu;

/** Append `today` to the `seen [...]` array on a probation line. */
function _appendSeen(line: string, today: string): string {
    if (line.includes('seen [')) {
        return line.replace(_SEEN_RE, (whole, group1: string) => {
            const body = _strip(group1);
            if (body.includes(today)) {
                return whole;
            }
            const newBody = body ? body + ', ' + today : today;
            return `seen [${newBody}]`;
        });
    }
    return _rstrip(line) + ` · seen [${today}]`;
}
