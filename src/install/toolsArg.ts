/**
 * The `--tools` / `--ai` value of `agent-config install`: the two flags are
 * aliases, so their comma lists are unioned in order with duplicates dropped,
 * and an empty union means every tool.
 */
export function mergeToolsAliases(tools: string | null, ai: string | null): string {
    const items: string[] = [];
    for (const raw of [tools, ai]) {
        if (!raw) continue;
        for (const piece of raw.split(',')) {
            const stripped = piece.trim();
            if (stripped && !items.includes(stripped)) items.push(stripped);
        }
    }
    return items.length > 0 ? items.join(',') : 'all';
}
