/**
 * Sanitize matcher input to prevent self-echo and quoted-code triggering.
 *
 * TypeScript twin of `src/scripts/command_suggester/sanitize.py`
 * (ADR-090 py2ts).
 *
 * The suggestion engine scores against the user's raw message and the
 * last 2 turns of context. Two adversarial inputs would otherwise
 * re-trigger the engine on its own output or on user-pasted code:
 *
 *  - Self-echo — the previous turn's suggestion block (`> 1. /commit
 *    — …`) is part of the conversation context. Scoring against it
 *    re-surfaces the same commands turn after turn.
 *  - Quoted code — user-pasted snippets that mention a command
 *    (`` `/implement-ticket` ``, fenced ``` ```bash\ngit commit``` ```)
 *    read like real intent signals to the substring matcher.
 *
 * Both patterns are stripped here before the matcher sees them. The
 * sanitiser is conservative: only well-formed Markdown fences,
 * inline-code spans, and the engine's own suggestion-line shape are
 * removed. Plain prose is untouched so legitimate intent ("commit my
 * changes please") still scores.
 */

// Triple-backtick fence — handles language hints (```bash …```) and
// unhinted blocks alike. Non-greedy so adjacent fences don't merge.
// Python `re.DOTALL` → JS `s` flag.
const _CODE_FENCE_RE = /```[\s\S]*?```/g;
// Inline code span. Excludes empty `` `` `` and respects single-line scope.
const _INLINE_CODE_RE = /`[^`\n]+`/g;
// Suggestion-block line shape from `render.py`:
//   > 1. /implement-ticket — drive ticket end-to-end…
//   > 2. /refine-ticket — tighten the AC…
// Numbered-options lines starting with `>` and a `/command` token.
// Python `re.MULTILINE` → JS `m` flag; `$` then matches end-of-line.
const _SUGGESTION_LINE_RE =
    /^\s*>\s*\d+\.\s*\/[A-Za-z][A-Za-z0-9_-]*\b.*$/gm;
// As-is escape hatch line — recognisable suffix from render.py.
const _AS_IS_LINE_RE =
    /^\s*>\s*\d+\.\s*Just run the prompt as-is.*$/gim;
// Header line emitted by render.py.
const _SUGGESTION_HEADER_RE =
    /^\s*>\s*💡\s*Your request matches a command.*$/gm;
// Recommendation line right after the block.
const _RECOMMENDATION_LINE_RE =
    /^\s*\*\*Recommendation:\s*\d+\b.*$/gm;

/**
 * Remove fenced and inline code spans.
 *
 * Fenced blocks first (greedy across newlines, non-greedy across
 * fences), then inline backticks. Plain text outside code is left
 * bit-identical.
 */
export function strip_code_blocks(text: string): string {
    if (!text) {
        return text;
    }
    let out = text.replace(_CODE_FENCE_RE, ' ');
    out = out.replace(_INLINE_CODE_RE, ' ');
    return out;
}

/**
 * Remove lines that look like the engine's own previous output.
 *
 * Matches the four shapes `render.py` emits:
 *  - the `> 💡 …` header
 *  - `> N. /command — …` numbered options
 *  - the `> N. Just run the prompt as-is …` escape hatch
 *  - the `**Recommendation: N — …` follow-up line
 *
 * Anything else (including user-authored quotes that happen to
 * mention a command) is preserved — only the engine's distinctive
 * block shape is filtered.
 */
export function strip_suggestion_echo(text: string): string {
    if (!text) {
        return text;
    }
    let out = text.replace(_SUGGESTION_HEADER_RE, '');
    out = out.replace(_SUGGESTION_LINE_RE, '');
    out = out.replace(_AS_IS_LINE_RE, '');
    out = out.replace(_RECOMMENDATION_LINE_RE, '');
    return out;
}

/**
 * Apply both filters to a single user message.
 *
 * Order matters: strip code first (a `/command` inside a fence is
 * code, not an echo), then strip echoes from what remains.
 */
export function sanitize_message(message: string): string {
    return strip_suggestion_echo(strip_code_blocks(message));
}

/**
 * Apply `sanitize_message` to each line of recent-turn context.
 *
 * Returns a new list — the caller's list is untouched. Empty strings
 * after sanitising are kept out of the result so they don't dilute
 * token-overlap scoring.
 */
export function sanitize_context(context_lines: Iterable<string>): string[] {
    const out: string[] = [];
    for (const line of context_lines) {
        const cleaned = sanitize_message(line);
        if (cleaned && cleaned.trim()) {
            out.push(cleaned);
        }
    }
    return out;
}
