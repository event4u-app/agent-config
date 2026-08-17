// Python-compatible JSON serialisation, extracted verbatim from `clients.ts`
// (road-to-council-quota-accounting-truth) so that file drops below the
// source-size ratchet without changing a byte of behaviour.
//
// A frozen byte-parity golden compares the counter state file this writes
// against output captured from the deleted Python twin, so this is a MOVE and
// must stay one: `ensure_ascii=True`, insertion-order keys, Python float
// repr, astral-plane surrogate pairs. Any "cleanup" here forks that golden.

/** `json.dumps(obj, indent=2)` — default ensure_ascii=True, insertion-order keys. */
export function jsonDumpsIndent2(value: unknown): string {
    return _jsonDumpsIndented(value, 2, 0);
}

function _jsonDumpsIndented(value: unknown, indent: number, level: number): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'number':
            return _pyJsonNumber(value);
        case 'string':
            return _pyJsonStringAscii(value);
        case 'object':
            break;
        default:
            throw new TypeError(`Object of type ${typeof value} is not JSON serializable`);
    }
    const pad = ' '.repeat(indent * (level + 1));
    const closePad = ' '.repeat(indent * level);
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _jsonDumpsIndented(v, indent, level + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
        return '{}';
    }
    const items = keys.map(
        (k) => `${pad}${_pyJsonStringAscii(k)}: ${_jsonDumpsIndented(obj[k], indent, level + 1)}`,
    );
    return `{\n${items.join(',\n')}\n${closePad}}`;
}

/** Render a number like Python `json.dumps` (int vs float; JS has one type). */
function _pyJsonNumber(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return String(n);
}

/** Escape a string like Python `json.dumps(..., ensure_ascii=True)` (default). */
function _pyJsonStringAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            // Astral plane → surrogate pair, matching Python json.dumps default.
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}
