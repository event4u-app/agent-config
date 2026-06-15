/**
 * Per-provider CLI install hints for `mode: cli` members (step-9 P2).
 *
 * TypeScript twin of `src/scripts/ai_council/cli_hints.py` (ADR-096 —
 * Python→TS migration, Phase 1; ai_council FOUNDATION wave). Public surface
 * mirrors the Python module exactly (snake_case kept deliberately):
 * `INSTALL_HINTS`, `hint_for`, `format_install_hints`.
 *
 * When `build_members` cannot construct a `mode: cli` member because the
 * binary is missing on PATH, it records a skip entry of shape
 * `{"member": <provider>, "reason": "binary_missing", "detail": <msg>}`.
 * This module turns that bookkeeping into an actionable pre-flight banner —
 * one line per skipped member.
 *
 * PARITY NOTES
 * - The banner uses the same `·`-separated layout, byte-for-byte. The middle
 *   dot is U+00B7; it survives JS string literals identically.
 * - `str(entry.get(key, default))` is mirrored by `_pyStr` so non-string
 *   values render with Python's `str()` spellings (`True`/`None`/int) — the
 *   real caller only ever passes strings, but the cast is faithful.
 */

/** A skip entry as recorded by `build_members`. */
export type SkipEntry = Record<string, unknown>;

/**
 * Provider → `[binary, docs_url, one_liner_install]`.
 *
 * - `binary`: executable name the CLI client looks for.
 * - `docs_url`: canonical install page.
 * - `one_liner_install`: shortest copy-pasteable install command.
 */
export const INSTALL_HINTS: Record<string, readonly [string, string, string]> = {
    anthropic: [
        'claude',
        'https://docs.anthropic.com/en/docs/claude-code/quickstart',
        'npm install -g @anthropic-ai/claude-code',
    ],
    openai: ['codex', 'https://github.com/openai/codex', 'npm install -g @openai/codex'],
    gemini: [
        'gemini',
        'https://github.com/google-gemini/gemini-cli',
        'npm install -g @google/gemini-cli',
    ],
    xai: ['grok', 'https://github.com/superagent-ai/grok-cli', 'npm install -g @superagent-ai/grok-cli'],
    perplexity: [
        'perplexity',
        'https://github.com/perplexityai/perplexity-cli',
        'npm install -g perplexity-cli',
    ],
};

/**
 * Return `[binary, docs_url, one_liner]` for `provider`, else `null`.
 *
 * Unknown providers return `null` so the caller can fall through to a
 * generic message rather than crashing the pre-flight banner.
 */
export function hint_for(provider: string): readonly [string, string, string] | null {
    return Object.prototype.hasOwnProperty.call(INSTALL_HINTS, provider)
        ? (INSTALL_HINTS[provider] as readonly [string, string, string])
        : null;
}

/** `str(entry.get(key, default))` — Python's str() spellings for non-strings. */
function _pyStr(v: unknown, dflt: string): string {
    if (v === undefined) {
        return dflt;
    }
    if (v === null) {
        return 'None';
    }
    if (typeof v === 'string') {
        return v;
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    if (typeof v === 'number') {
        return Number.isInteger(v) ? String(v) : String(v);
    }
    return String(v);
}

/**
 * Render the per-skip pre-flight banner.
 *
 * `skipped` is the list `build_members` populates — each entry carries
 * `member` (provider name), `reason` (`binary_missing` or future variants),
 * and `detail` (the raw error message). Output shape, one line per entry:
 *
 *     council:cli-skip · <provider> · binary not found · install: <one_liner> · docs: <url>
 *
 * For providers with no entry in `INSTALL_HINTS`, falls back to the raw
 * `detail`. Returns `""` when `skipped` is empty so callers can write the
 * string unconditionally without a leading blank line. Only
 * `reason == "binary_missing"` entries get the install line.
 */
export function format_install_hints(skipped: Iterable<SkipEntry>): string {
    const lines: string[] = [];
    for (const entry of skipped) {
        const name = _pyStr(entry.member, '?');
        const reason = _pyStr(entry.reason, '');
        const detail = _pyStr(entry.detail, '');
        if (reason !== 'binary_missing') {
            lines.push(`council:cli-skip · ${name} · ${reason || 'unknown'} · ${detail}`);
            continue;
        }
        const hint = hint_for(name);
        if (hint === null) {
            lines.push(`council:cli-skip · ${name} · binary not found · ${detail}`);
            continue;
        }
        const [, url, one_liner] = hint;
        lines.push(
            `council:cli-skip · ${name} · binary not found · ` + `install: ${one_liner} · docs: ${url}`,
        );
    }
    return lines.join('\n');
}
