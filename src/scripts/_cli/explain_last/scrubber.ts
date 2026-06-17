/**
 * PII / cost-metadata scrubber for the `explain last` trace.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/scrubber.py` (ADR-200).
 * Behaviour mirrors the Python original EXACTLY — same regex sources, same
 * resolution order, same idempotence, same long-string threshold and
 * summary text. No behaviour changes — latent bugs are replicated, not
 * fixed.
 *
 * The standard project redactor under
 * `scripts.ai_council.redact_low_impact_entry` is a *refusal* gate — it
 * returns `ok=False` and asks the human to rephrase. The explain surface
 * cannot refuse to produce output; the user already executed the upstream
 * command and is now asking *why*. So this module mirrors the same regex
 * patterns but performs in-place masking instead of refusal.
 *
 * Masks applied (resolution order):
 *
 * 1. Raw-key secret prefixes (`sk_live_…`, `ghp_…` etc.) and inline
 *    `api_key=…` shapes → `<secret>`.
 * 2. Emails → `<email>`.
 * 3. Absolute file paths (`/Users/…`, `/home/…`, `C:\…`) → `<path>`.
 * 4. URLs → `<scheme>://<host>/…` (path / query / fragment stripped).
 * 5. `*.internal` / `*.local` hostnames → `<host>`.
 * 6. Monetary amounts (`$1,234`, `USD 500`) → `<money>` — strips
 *    billing-cost leakage from council token-usage metadata.
 * 7. Long strings (> 200 chars) → `<NNN chars>` summary.
 *
 * Parity notes (ADR-200):
 *  - Python's `re` `\w` / `\b` are Unicode-aware by default on `str`
 *    (no `re.ASCII`). The JS twin uses the `u` flag with `\p{L}\p{N}_`
 *    in place of `\w` and a non-`\b` boundary built from the same class
 *    so a `café@exämple.com` email or a `/Users/möchte/f` path masks
 *    identically to CPython. `_INTERNAL_HOST_RE`'s leading-char class is
 *    `[a-zA-Z0-9]` in Python (ASCII-only) — kept ASCII here too.
 *  - `len(out) > 200` is a Python `len` (code-point count, not UTF-16
 *    units); the twin uses `pyLen` (Array.from spread) accordingly.
 *  - The long-string summary uses the post-mask length (`len(out)`),
 *    matching the original's `f"<{len(out)} chars>"`.
 */

export const LONG_STRING_THRESHOLD = 200;

const _RAW_KEY_PREFIXES: readonly string[] = [
    'sk_live_', 'sk_test_', 'ghp_', 'github_pat_', 'gho_', 'ghs_',
    'ghu_', 'xoxb-', 'xoxp-', 'AIza', 'AKIA',
];

/** Escape a literal for a RegExp, mirroring Python's `re.escape`. */
function _reEscape(literal: string): string {
    // Python `re.escape` escapes non-alphanumerics; under the `u` flag a
    // `\-` is an illegal escape, so `-` is escaped via its unicode form.
    // The fixed prefixes only contain `-` (e.g. `xoxb-`), so this is the
    // sole case that matters; the broad class covers the rest faithfully.
    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '\\u002d');
}

// Unicode word-char class standing in for Python's default-mode `\w`.
const _W = '\\p{L}\\p{N}_';

const _RAW_KEY_RE = new RegExp(
    '(?:' + _RAW_KEY_PREFIXES.map(_reEscape).join('|') + ')[A-Za-z0-9_-]{6,}',
    'gu',
);
const _API_KEY_RE = new RegExp(
    '\\bapi[_-]?key\\b\\s*[:=]\\s*[A-Za-z0-9+/=_-]{12,}',
    'giu',
);
const _EMAIL_RE = new RegExp(
    `(?<![${_W}.+-])[${_W}.+-]+@[${_W}-]+\\.[${_W}.-]+(?![${_W}.-])`,
    'gu',
);
const _PATH_RE = new RegExp(
    `(?:/Users/|/home/|/opt/|/private/|[A-Z]:\\\\)[${_W}./\\\\-]+`,
    'gu',
);
const _URL_RE = new RegExp(
    '(?<![\\p{L}\\p{N}_])(?<scheme>https?|ftp|ws|wss)://(?<host>[^\\s/:?#]+)(?:[^\\s]*)?',
    'gu',
);
const _INTERNAL_HOST_RE = new RegExp(
    `(?<![${_W}])[a-zA-Z0-9][${_W}.-]*\\.(?:internal|local)(?![${_W}])`,
    'giu',
);
const _MONEY_RE = new RegExp(
    '(?:[$€£¥]\\s?\\d{1,3}(?:[,.]\\d{3})*(?:\\.\\d+)?'
    + '|\\b(?:USD|EUR|GBP|JPY)\\s?\\d+(?:[,.]\\d+)?)',
    'gu',
);

/** Python `len()` — counts Unicode code points, not UTF-16 units. */
function pyLen(s: string): number {
    let n = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ch of s) {
        n += 1;
    }
    return n;
}

function _stripUrl(_match: string, scheme: string, host: string): string {
    return `${scheme}://${host}/…`;
}

export function scrub_string(value: unknown): unknown {
    // Mirror Python's `if not isinstance(value, str) or not value` guard.
    if (typeof value !== 'string' || value === '') {
        return value;
    }
    let out = value.replace(_RAW_KEY_RE, '<secret>');
    out = out.replace(_API_KEY_RE, 'api_key=<secret>');
    out = out.replace(_EMAIL_RE, '<email>');
    out = out.replace(_URL_RE, _stripUrl);
    out = out.replace(_PATH_RE, '<path>');
    out = out.replace(_INTERNAL_HOST_RE, '<host>');
    out = out.replace(_MONEY_RE, '<money>');
    if (pyLen(out) > LONG_STRING_THRESHOLD) {
        return `<${pyLen(out)} chars>`;
    }
    return out;
}

export function scrub_value(value: unknown): unknown {
    if (typeof value === 'string') {
        return scrub_string(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => scrub_value(item));
    }
    if (typeof value === 'object' && value !== null) {
        const out: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            out[key] = scrub_value(val);
        }
        return out;
    }
    return value;
}
