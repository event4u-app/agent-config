/**
 * One reader for a transcript entry's text — the shape half, shared.
 *
 * WHY THIS EXISTS, measured rather than anticipated. A Claude Code transcript
 * carries a user entry's `message.content` in TWO shapes: a bare string, and an
 * array of content blocks. `conformance_scan` handled both; a second reader
 * written against the same field handled only the string, and the store says why
 * that is fatal rather than cosmetic:
 *
 *   user entries in one 30-session store:  1 440 string · 23 907 array
 *   injected skill bodies among them:      0 via string · 41 via array
 *
 * So the narrower reader saw **none** of them, and the failure was invisible:
 * a detector whose loaded-set is empty returns no findings, which is
 * indistinguishable from compliance. `grep` over the raw JSONL finds the marker
 * either way — reading raw text is not evidence about the parse path, and that
 * is the mistake this module removes the opportunity to repeat.
 *
 * Scope is deliberately just the shape, plus the sidechain exclusion. Semantic
 * filters (a `<system-reminder>` is not a chat message, an injected body is not a
 * user turn) stay with the caller that needs them: they differ per question, and
 * folding them in here would make one module answer two.
 */

/** A parsed transcript line. */
export type TranscriptEntry = Record<string, unknown>;

function _isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * A subagent's own turns. Excluded by every reader in this tree: a sidechain turn
 * did not happen in the main thread, so counting it lets a skill loaded in one
 * context be paired with an act taken in another.
 */
export function isSidechain(entry: TranscriptEntry): boolean {
    return entry['isSidechain'] === true;
}

/**
 * Flatten `message.content` to text, whichever shape it arrived in.
 *
 * Returns `''` when there is no text (a tool-result-only entry, an unparseable
 * shape) — never `null`, so a caller cannot forget the second branch.
 */
export function entryText(entry: TranscriptEntry): string {
    const msg = entry['message'];
    const content = _isObject(msg) ? msg['content'] : undefined;
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return '';
    }
    return content
        .filter((b) => _isObject(b) && b['type'] === 'text')
        .map((b) => String((b as Record<string, unknown>)['text'] ?? ''))
        .join('\n');
}

/** Tool calls in an entry, flattened to name + input. Both shapes are arrays. */
export function toolUses(entry: TranscriptEntry): Array<{ name: string; input: Record<string, unknown> }> {
    const msg = entry['message'];
    const content = _isObject(msg) ? msg['content'] : undefined;
    if (!Array.isArray(content)) {
        return [];
    }
    const out: Array<{ name: string; input: Record<string, unknown> }> = [];
    for (const part of content) {
        if (!_isObject(part) || part['type'] !== 'tool_use') {
            continue;
        }
        out.push({
            name: typeof part['name'] === 'string' ? part['name'] : '',
            input: _isObject(part['input']) ? part['input'] : {},
        });
    }
    return out;
}
