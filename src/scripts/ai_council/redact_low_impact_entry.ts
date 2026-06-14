/**
 * Privacy floor for `agents/decisions/low-impact-decisions.md` (Phase 12).
 *
 * TypeScript twin of `src/scripts/ai_council/redact_low_impact_entry.py`
 * (ADR-094 — Python→TS migration, Phase 1). Security-sensitive: the
 * redaction regexes and refusal markers are matched byte-for-byte against
 * the Python original.
 *
 * Non-bypassable redactor invoked on intake (write-side) AND on
 * upstream (`/learn-low-impact`, leave-the-repo side). Both gates call
 * {@link redact_low_impact_entry} and refuse to proceed when a forbidden
 * pattern fires.
 *
 * Iron Law: nothing leaves the project repo until this redactor clears
 * the entry. See `.augment/rules/low-impact-corpus-privacy-floor.md`.
 *
 * Forbidden-content classes (per Phase 12 § Step 4):
 *
 * 1. Secrets — raw-key prefixes mirrored from
 *    `scripts.ai_council.config._RAW_KEY_PREFIXES`, plus a generic
 *    `api[-_]?key:\s*<token>` shape.
 * 2. Emails — RFC-5322-ish shape, deliberately permissive.
 * 3. Project-rooted paths — anything starting `/Users/`, `/home/`,
 *    `/opt/`, `/private/`, drive letters (`C:\`), or the configured repo
 *    root from `.agent-settings.yml` when supplied.
 * 4. Customer / tenant names — caller passes a name list (project
 *    policy); generic placeholders `<customer>`, `<tenant>`, `<account>`,
 *    `<user>` survive.
 * 5. Internal hostnames — `*.internal`, `*.local`, plus any project-private
 *    domain the caller supplies.
 * 6. Monetary amounts — `$1,234` / `€500` / `USD 1000` shapes that look
 *    like business figures.
 * 7. Business-context SQL identifiers — caller-supplied table / column
 *    allow-list. Default empty.
 * 8. Inline code excerpts > 40 chars — any backtick-fenced run > 40.
 */

import { _RAW_KEY_PREFIXES } from './config.js';

/**
 * Code-point length, matching Python `len(str)`. JS `String.length`
 * counts UTF-16 units, so an astral char would over-count; Python counts
 * code points. `Array.from` iterates code points.
 */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/**
 * Slice the first `n` code points, matching Python `s[:n]`. JS
 * `String.slice` is UTF-16-unit based; we slice by code point for parity.
 */
function _pySliceHead(s: string, n: number): string {
    let out = '';
    let i = 0;
    for (const ch of s) {
        if (i >= n) {
            break;
        }
        out += ch;
        i += 1;
    }
    return out;
}

/** Python `str.strip()` — leading/trailing whitespace. */
function _strip(s: string): string {
    return s.trim();
}

/**
 * Escape a string for literal use inside a `u`-flagged RegExp.
 *
 * Python `re.escape` backslash-escapes every non-word char; under the JS
 * `u` flag an escape like `\-` is illegal, so we escape only the
 * ECMAScript regex metacharacters. The *match behaviour* is identical
 * (literal match of the input string) — only the pattern source differs,
 * which is not observable.
 */
function _reEscape(s: string): string {
    // `-` and `/` are NOT metacharacters outside a character class in
    // ECMAScript; escaping `-` as `\-` is illegal under the `u` flag.
    return s.replace(/[.*+?^${}()|[\]\\]/gu, (c) => '\\' + c);
}

/** Single forbidden-pattern hit. */
export interface RedactionViolation {
    readonly category: string;
    readonly snippet: string;
    readonly note: string;
}

function _violation(category: string, snippet: string, note = ''): RedactionViolation {
    return { category, snippet, note };
}

/** Python repr() for a string: single-quoted (used by `summary()`). */
function _pyRepr(s: string): string {
    // Mirror Python repr for the snippet types this module produces
    // (printable ASCII / unicode runs without embedded quotes-needing
    // escapes beyond the wrapping). Python prefers single quotes unless
    // the string contains a single quote and no double quote.
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s.replace(/\\/g, '\\\\');
    body = body
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    } else {
        body = body.replace(/"/g, '\\"');
    }
    return `${quote}${body}${quote}`;
}

/** Outcome of one redaction pass. */
export class RedactionResult {
    readonly ok: boolean;
    readonly violations: readonly RedactionViolation[];

    constructor(ok: boolean, violations: readonly RedactionViolation[] = []) {
        this.ok = ok;
        this.violations = violations;
    }

    summary(): string {
        if (this.ok) {
            return 'redaction: clean';
        }
        const parts = this.violations.map((v) => `${v.category}: ${_pyRepr(v.snippet)}`);
        return 'redaction REFUSED — ' + parts.join('; ');
    }
}

// ── regex patterns (Python `re` semantics replicated) ────────────────────
// Python `\w`/`\b`/`\d` are Unicode by default. JS `\w`/`\b`/`\d` are
// ASCII-only even with the `u` flag, so where Python uses them we replicate
// the Unicode class explicitly.

// Python: \b[\w.+-]+@[\w-]+\.[\w.-]+\b
// Unicode \w == [\p{L}\p{N}_]. We emulate \b via lookarounds on the
// Unicode word-char class.
const _UWORD = '[\\p{L}\\p{N}_]';
const _UNB_BEFORE = `(?<!${_UWORD})`;
const _UNB_AFTER = `(?!${_UWORD})`;
const _EMAIL_RE = new RegExp(
    `${_UNB_BEFORE}[\\p{L}\\p{N}_.+-]+@[\\p{L}\\p{N}_-]+\\.[\\p{L}\\p{N}_.-]+${_UNB_AFTER}`,
    'gu',
);

// Python: (?:^|[\s"'(]) (?:/Users/|/home/|/opt/|/private/|[A-Z]:\\) [\w.\-/\\]+
// \s is Unicode in Python; \w Unicode. No \b here.
const _PATH_RE = new RegExp(
    '(?:^|[\\s"\'(])' +
        '(?:/Users/|/home/|/opt/|/private/|[A-Z]:\\\\)' +
        '[\\p{L}\\p{N}_.\\-/\\\\]+',
    'gmu',
);

// Python: \b[a-zA-Z0-9][\w.-]*\.(?:internal|local)\b  (IGNORECASE)
const _INTERNAL_HOST_RE = new RegExp(
    `${_UNB_BEFORE}[a-zA-Z0-9][\\p{L}\\p{N}_.-]*\\.(?:internal|local)${_UNB_AFTER}`,
    'giu',
);

// Python:
//   (?:[\$€£¥]\s?\d{1,3}(?:[,.]\d{3})*(?:\.\d+)?
//    |\b(?:USD|EUR|GBP|JPY)\s?\d+(?:[,.]\d+)?)
// \d and \s Unicode in Python; \b Unicode (before the currency-code alt).
const _UD = '[\\p{Nd}]';
const _MONEY_RE = new RegExp(
    `(?:[\\$€£¥]\\s?${_UD}{1,3}(?:[,.]${_UD}{3})*(?:\\.${_UD}+)?` +
        `|${_UNB_BEFORE}(?:USD|EUR|GBP|JPY)\\s?${_UD}+(?:[,.]${_UD}+)?)`,
    'gu',
);

// Python: (?i)\bapi[_-]?key\b\s*[:=]\s*[A-Za-z0-9+/=_\-]{12,}
const _API_KEY_RE = new RegExp(
    `${_UNB_BEFORE}api[_-]?key${_UNB_AFTER}\\s*[:=]\\s*[A-Za-z0-9+/=_\\-]{12,}`,
    'giu',
);

// Python: `([^`]{41,})`
const _CODE_FENCE_RE = /`([^`]{41,})`/gu;

function _checkSecrets(text: string): RedactionViolation[] {
    const hits: RedactionViolation[] = [];
    for (const prefix of _RAW_KEY_PREFIXES) {
        const pat = new RegExp(_reEscape(prefix) + '[A-Za-z0-9_\\-]{6,}', 'u');
        const m = pat.exec(text);
        if (m) {
            hits.push(
                _violation(
                    'secret',
                    _pySliceHead(m[0], 8) + '…',
                    `raw-key prefix ${_pyRepr(prefix)}`,
                ),
            );
        }
    }
    _API_KEY_RE.lastIndex = 0;
    const m = _API_KEY_RE.exec(text);
    if (m) {
        hits.push(_violation('secret', _pySliceHead(m[0], 20) + '…', 'inline api_key'));
    }
    return hits;
}

function _checkPatterns(
    text: string,
    repoRoot: string | null,
    privateDomains: Iterable<string>,
    customerNames: Iterable<string>,
    sqlIdentifiers: Iterable<string>,
): RedactionViolation[] {
    const hits: RedactionViolation[] = [];
    for (const m of text.matchAll(_EMAIL_RE)) {
        hits.push(_violation('email', m[0]));
    }
    for (const m of text.matchAll(_PATH_RE)) {
        hits.push(_violation('project_path', _strip(m[0])));
    }
    if (repoRoot && text.includes(repoRoot)) {
        hits.push(_violation('project_path', repoRoot, 'configured repo root'));
    }
    for (const m of text.matchAll(_INTERNAL_HOST_RE)) {
        hits.push(_violation('internal_hostname', m[0]));
    }
    for (const dom of privateDomains) {
        if (dom && text.includes(dom)) {
            hits.push(_violation('internal_hostname', dom, 'configured private domain'));
        }
    }
    for (const m of text.matchAll(_MONEY_RE)) {
        hits.push(_violation('monetary_amount', m[0]));
    }
    for (const name of customerNames) {
        // Python: re.search(rf"\b{re.escape(name)}\b", text, re.IGNORECASE)
        if (name && new RegExp(`${_UNB_BEFORE}${_reEscape(name)}${_UNB_AFTER}`, 'iu').test(text)) {
            hits.push(_violation('customer_name', name));
        }
    }
    for (const ident of sqlIdentifiers) {
        // Python: re.search(rf"\b{re.escape(ident)}\b", text)
        if (ident && new RegExp(`${_UNB_BEFORE}${_reEscape(ident)}${_UNB_AFTER}`, 'u').test(text)) {
            hits.push(_violation('sql_identifier', ident));
        }
    }
    for (const m of text.matchAll(_CODE_FENCE_RE)) {
        const inner = m[1] as string;
        hits.push(
            _violation('long_code_excerpt', _pySliceHead(inner, 40) + '…', `${_pyLen(inner)} chars`),
        );
    }
    return hits;
}

export interface RedactOptions {
    repoRoot?: string | null;
    privateDomains?: Iterable<string>;
    customerNames?: Iterable<string>;
    sqlIdentifiers?: Iterable<string>;
}

/**
 * Run the privacy floor over `text`. Returns clean or refused.
 *
 * The redactor never auto-rewrites the entry — that would be a soft
 * privacy gate. It refuses + surfaces what to rephrase, which keeps the
 * user in the loop and the audit trail honest.
 */
export function redact_low_impact_entry(text: string, opts: RedactOptions = {}): RedactionResult {
    const repoRoot = opts.repoRoot ?? null;
    const privateDomains = opts.privateDomains ?? [];
    const customerNames = opts.customerNames ?? [];
    const sqlIdentifiers = opts.sqlIdentifiers ?? [];

    const violations: RedactionViolation[] = [];
    violations.push(..._checkSecrets(text));
    violations.push(
        ..._checkPatterns(text, repoRoot, privateDomains, customerNames, sqlIdentifiers),
    );
    return new RedactionResult(violations.length === 0, violations);
}
