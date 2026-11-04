/**
 * Did a vendor CLI refuse because the ACCOUNT ran out, rather than because the
 * call was bad?
 *
 * Only an account limit is worth retrying on another account; every other
 * failure would fail the same way there and cost a second call for nothing.
 * So the patterns are the vendors' own limit wording, not the generic quota
 * vocabulary `CliClient._QUOTA_PATTERNS` uses for classification.
 */

export class SeatLimitReached {
    constructor(
        /** The account that served the refused call, e.g. `codex/Matze1`. */
        readonly profile: string,
        /** The vendor's own line, truncated — never a path, never a token. */
        readonly line: string,
    ) {}
}

const LIMIT_PATTERNS: readonly RegExp[] = [
    // codex `--json` stream: `{"type":"error","code":"usage_limit_reached",…}` / turn.failed message
    /usage_limit_reached/i,
    /you'?ve hit your usage limit/i,
    // claude: "Claude AI usage limit reached|1730000000" / "usage limit reached"
    /usage limit reached/i,
    // HTTP 429 as it surfaces in either CLI's error text
    /\b429\b[^\n]{0,40}too many requests/i,
    /too many requests[^\n]{0,40}\b429\b/i,
    /"?status(?:_code)?"?\s*[:=]\s*429\b/i,
];

/** The first line of `text` that names an account limit, or null. */
export function limitLine(text: string): string | null {
    if (!text) return null;
    for (const line of text.split('\n')) {
        if (LIMIT_PATTERNS.some((p) => p.test(line))) return line.trim().slice(0, 300);
    }
    return null;
}

export function classifySeatLimit(text: string, profile: string | null): SeatLimitReached | null {
    if (profile === null) return null;
    const line = limitLine(text);
    return line === null ? null : new SeatLimitReached(profile, line);
}
