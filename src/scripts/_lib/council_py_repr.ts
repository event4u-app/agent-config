/**
 * Python-`repr()` helpers of the council CLI, relocated out of `council_cli.ts`
 * unchanged (that file is past the source ceiling). Byte-exact to what the CLI
 * printed before; `ai_council/py_format.ts` escapes more and is not a drop-in.
 */

/** Python `repr()` for a string (single-quoted unless it embeds a `'`). */
export function _pyReprStr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Python `repr()` of a list of strings. */
export function _pyReprStrList(items: readonly string[]): string {
    return `[${items.map(_pyReprStr).join(', ')}]`;
}

/** Python `sorted(...)` of strings (code-point order). */
export function _pySortedStr(items: Iterable<string>): string[] {
    return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
