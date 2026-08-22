/**
 * Python-format helpers, extracted from `config.ts`.
 *
 * Every error string this package emits is byte-faithful to the Python original
 * it replaced, which is why `repr()`, `type().__name__` and `oct()` are
 * reimplemented here instead of being approximated with template literals.
 *
 * Pure and self-contained: these functions call only each other, which is what
 * made the section safe to move out whole. Extracted because config.ts is
 * hundreds of lines above the 1500-line source ceiling and a change adding to it
 * has to pay for the lines somewhere.
 */
/** Python `repr()` for a string scalar (single-quoted, escaped). */
export function _pyReprStr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s
        .replace(/\\/g, '\\\\')
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

/** Python `repr()` for a float value (shortest round-trip, `N.0` for ints). */
export function _pyReprFloat(value: number): string {
    if (Number.isInteger(value) && Number.isFinite(value)) {
        return `${value}.0`;
    }
    if (value === Infinity) {
        return 'inf';
    }
    if (value === -Infinity) {
        return '-inf';
    }
    if (Number.isNaN(value)) {
        return 'nan';
    }
    return String(value);
}

/**
 * Python `repr()` for an arbitrary parsed value. Floats are tracked via
 * `_FLOAT` so int-valued floats render `N.0`; bare numbers render as
 * Python ints (no decimal). Mirrors `{value!r}` formatting.
 */
export function _pyRepr(value: unknown): string {
    if (value instanceof _Float) {
        return _pyReprFloat(value.value);
    }
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (typeof value === 'string') {
        return _pyReprStr(value);
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _pyRepr(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
        const parts: string[] = [];
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            parts.push(`${_pyReprStr(k)}: ${_pyRepr(v)}`);
        }
        return `{${parts.join(', ')}}`;
    }
    return String(value);
}

/** Wrapper marking a number that should `repr()` as a Python float. */
export class _Float {
    constructor(readonly value: number) {}
}

/** Mark `n` so `_pyRepr` renders it with a Python float repr (`N.0`). */
export function _f(n: number): _Float {
    return new _Float(n);
}

/** Python `type(value).__name__`. */
export function _pyTypeName(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NoneType';
    }
    if (typeof value === 'boolean') {
        return 'bool';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'int' : 'float';
    }
    if (typeof value === 'string') {
        return 'str';
    }
    if (Array.isArray(value)) {
        return 'list';
    }
    if (typeof value === 'object') {
        return 'dict';
    }
    return typeof value;
}

/** Python `sorted(set_of_strings)` rendered as a list repr `['a', 'b']`. */
export function _sortedListRepr(items: Iterable<string>): string {
    const sorted = [...items].sort();
    return `[${sorted.map((s) => _pyReprStr(s)).join(', ')}]`;
}

/** Python `oct(mode)` → `0o600`-shaped string. */
export function _pyOct(mode: number): string {
    return `0o${mode.toString(8)}`;
}
