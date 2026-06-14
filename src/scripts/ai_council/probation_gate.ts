/**
 * Probation promote-and-prune for `agents/decisions/low-impact-decisions.md`.
 *
 * TypeScript twin of `src/scripts/ai_council/probation_gate.py` (ADR-096 —
 * Python→TS migration, Phase 1; ai_council FOUNDATION wave). Public surface
 * mirrors the Python module exactly (snake_case kept deliberately):
 * `WINDOW_DAYS`, `PROMOTION_THRESHOLD`, `GateRun`, `run_gate`.
 *
 * Phase 12 § Step 3. Runs at council startup AND after every intake append.
 * Idempotent — a second run on an unchanged corpus is a no-op.
 *
 * Rules:
 * - **Prune.** For each `## On Probation` entry, drop any `seen` timestamp
 *   older than `WINDOW_DAYS` (default 30) from `today` (UTC). If the `seen`
 *   array empties, drop the whole entry.
 * - **Promote.** If the trimmed `seen` array has ≥ `PROMOTION_THRESHOLD`
 *   (default 3), move the entry to `## Validated` — strip the `seen` array,
 *   add `validated <today>` marker. One-way.
 * - **Log.** Returns a `GateRun` with the counts.
 *
 * PARITY NOTES
 * - The line regex uses U+2014 (em-dash) and U+00B7 (middle dot) literals,
 *   byte-identical to the Python `re` pattern; matched with the `u` flag so
 *   `\s` / `\d` align with Python's defaults (no MULTILINE).
 * - `splitlines()` is mirrored by `_splitlines` (full CPython boundary set).
 * - Date math is done on tz-aware UTC epoch-millis; `d >= cutoff` matches
 *   Python's tz-aware comparison exactly.
 * - The corpus is written only when the run is not a no-op, via UTF-8.
 */

import * as fs from 'node:fs';

export const WINDOW_DAYS = 30;
export const PROMOTION_THRESHOLD = 3;

const _PROBATION_HEADER = '## On Probation';
const _VALIDATED_HEADER = '## Validated';
const _TERMINAL_HEADERS: readonly string[] = ['## Anti-Examples', '## Security', '## Provenance'];

export class GateRun {
    constructor(
        readonly pruned_timestamps: number,
        readonly dropped_entries: number,
        readonly promoted_entries: number,
    ) {}

    log_line(): string {
        return (
            `probation-gate: pruned ${this.pruned_timestamps} stale ` +
            `timestamps; promoted ${this.promoted_entries} entries; ` +
            `dropped ${this.dropped_entries} expired entries`
        );
    }

    get is_noop(): boolean {
        return (
            this.pruned_timestamps === 0 &&
            this.dropped_entries === 0 &&
            this.promoted_entries === 0
        );
    }
}

/** Now, as a tz-aware UTC epoch-millisecond value. */
function _today(): number {
    return Date.now();
}

/**
 * Mirror Python `str.splitlines()` — boundary set is
 * \n \r \r\n \v(0x0B) \f(0x0C) \x1c \x1d \x1e \x85    .
 * No trailing empty element for a final boundary.
 */
function _splitlines(text: string): string[] {
    const out: string[] = [];
    let buf = '';
    const n = text.length;
    let i = 0;
    while (i < n) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        if (code === 0x0d) {
            out.push(buf);
            buf = '';
            if (i + 1 < n && text.charCodeAt(i + 1) === 0x0a) {
                i += 2;
            } else {
                i += 1;
            }
            continue;
        }
        if (
            code === 0x0a ||
            code === 0x0b ||
            code === 0x0c ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029
        ) {
            out.push(buf);
            buf = '';
            i += 1;
            continue;
        }
        buf += ch;
        i += 1;
    }
    if (buf !== '') {
        out.push(buf);
    }
    return out;
}

/**
 * Locate the body span [start, end) of the section under `header`.
 *
 * Mirrors Python `_section_span`: body starts after the header's newline;
 * the end is the nearest following `"\n<otherHeader>"` among the other
 * probation / validated / terminal headers. Returns `null` if `header`
 * absent.
 */
function _section_span(text: string, header: string): [number, number] | null {
    const i = text.indexOf(header);
    if (i < 0) {
        return null;
    }
    const nl = text.indexOf('\n', i);
    const body_start = nl + 1; // Python: text.find("\n", i) + 1
    let end = text.length;
    const others = [_PROBATION_HEADER, _VALIDATED_HEADER, ..._TERMINAL_HEADERS];
    for (const other of others) {
        if (other === header) {
            continue;
        }
        const j = text.indexOf('\n' + other, body_start);
        if (j >= 0 && j < end) {
            end = j;
        }
    }
    return [body_start, end];
}

/** Strip Python-`str.strip()`-style (leading/trailing ASCII+unicode whitespace). */
function _strip(s: string): string {
    // Python str.strip() removes leading/trailing whitespace per
    // str.isspace(); JS String.trim() removes the same Unicode whitespace
    // set plus the BOM. For corpus content (spaces) the result is identical.
    return s.trim();
}

/**
 * Parse a probation line into `[prefix, first_seen, seen[]]`, or `null`.
 *
 * Pattern (verbatim from Python):
 *   ^(\s*-\s*"[^"]+")\s*—\s*first-seen\s+(\d{4}-\d{2}-\d{2})
 *   \s*·\s*seen\s*\[([^\]]*)\]\s*$
 */
function _parse_probation_line(line: string): [string, string, string[]] | null {
    const re =
        /^(\s*-\s*"[^"]+")\s*—\s*first-seen\s+(\d{4}-\d{2}-\d{2})\s*·\s*seen\s*\[([^\]]*)\]\s*$/u;
    const m = re.exec(line);
    if (m === null) {
        return null;
    }
    const prefix = m[1] as string;
    const first_seen = m[2] as string;
    const seen_raw = _strip(m[3] as string);
    const seen =
        seen_raw !== ''
            ? seen_raw
                  .split(',')
                  .map((s) => _strip(s))
                  .filter((s) => s !== '')
            : [];
    return [prefix, first_seen, seen];
}

/** Parse a `YYYY-MM-DD` date as tz-aware UTC epoch-millis, or `null`. */
function _parse_date(s: string): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(s);
    if (m === null) {
        return null;
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    // Python datetime.strptime validates calendar ranges and raises ValueError
    // on out-of-range fields → we return null for those (matches the caller's
    // `if (d := _parse_date(s)) is not None` guard).
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }
    const ms = Date.UTC(year, month - 1, day);
    // Reject overflow (e.g. 2026-02-31 → March 3) so out-of-range raises like
    // strptime instead of silently rolling over.
    const d = new Date(ms);
    if (
        d.getUTCFullYear() !== year ||
        d.getUTCMonth() !== month - 1 ||
        d.getUTCDate() !== day
    ) {
        return null;
    }
    return ms;
}

/** `today.strftime("%Y-%m-%d")` on a UTC epoch-millis value. */
function _strftimeYmd(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Promote-and-prune pass. Writes corpus only when state changes. */
export function run_gate(corpus_path: string, options: { today?: number | null } = {}): GateRun {
    const today = options.today ?? _today();
    const cutoff = today - WINDOW_DAYS * 24 * 3600 * 1000;
    const text = fs.readFileSync(corpus_path, 'utf-8');
    const prob = _section_span(text, _PROBATION_HEADER);
    const val = _section_span(text, _VALIDATED_HEADER);
    if (prob === null || val === null) {
        return new GateRun(0, 0, 0);
    }

    const prob_body = text.slice(prob[0], prob[1]);
    const promoted: string[] = [];
    let pruned_ts = 0;
    let dropped = 0;
    const out_lines: string[] = [];
    for (const line of _splitlines(prob_body)) {
        const parsed = _parse_probation_line(line);
        if (parsed === null) {
            out_lines.push(line);
            continue;
        }
        const [prefix, first_seen, seen] = parsed;
        const original_len = seen.length;
        const fresh = seen.filter((s) => {
            const d = _parse_date(s);
            return d !== null && d >= cutoff;
        });
        pruned_ts += original_len - fresh.length;
        if (fresh.length >= PROMOTION_THRESHOLD) {
            const today_str = _strftimeYmd(today);
            promoted.push(`${prefix} — domain: low-impact · validated ${today_str}`);
            continue;
        }
        if (fresh.length === 0) {
            dropped += 1;
            continue;
        }
        out_lines.push(`${prefix} — first-seen ${first_seen} · seen [${fresh.join(', ')}]`);
    }

    let new_prob_body = out_lines.join('\n');
    if (!new_prob_body.endsWith('\n')) {
        new_prob_body += '\n';
    }

    let new_text = text.slice(0, prob[0]) + new_prob_body + text.slice(prob[1]);
    if (promoted.length > 0) {
        const span = _section_span(new_text, _VALIDATED_HEADER) as [number, number];
        const v_end = span[1];
        const insertion = promoted.join('\n') + '\n';
        new_text =
            _rstrip(new_text.slice(0, v_end)) + '\n\n' + insertion + new_text.slice(v_end);
    }

    const result = new GateRun(pruned_ts, dropped, promoted.length);
    if (!result.is_noop) {
        fs.writeFileSync(corpus_path, new_text, { encoding: 'utf-8' });
    }
    return result;
}

/** Python `str.rstrip()` — strip trailing whitespace. */
function _rstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}
