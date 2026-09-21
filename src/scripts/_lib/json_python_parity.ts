/**
 * `json.dumps` byte-parity helpers — the emit half of the ADR-200 port.
 *
 * The retired Python installer wrote every JSON artefact through
 * `json.dumps(..., ensure_ascii=False)`, and the port's contract is
 * byte-identical output, not merely equivalent JSON. `JSON.stringify` does not
 * satisfy it: it escapes nothing above `\u001f` the same way, renders `NaN` /
 * `Infinity` as `null` rather than as Python's bare tokens, and offers no
 * separator control for the compact NDJSON form. So the three dump shapes the
 * installer needs are written out here, mirroring CPython's encoder:
 *
 * - {@link jsonDumpsIndent} — `json.dumps(data, indent=N, ensure_ascii=False)`
 *   with `sort_keys=False` (insertion order preserved, as JS object key order
 *   already matches Python dict order for our string keys);
 * - {@link jsonDumpsCompact} — `json.dumps(obj, separators=(",", ":"))`;
 * - {@link jsonStrNoAscii} — the string encoder both build on.
 *
 * Sibling of `src/scripts/install.ts`, which is its only caller. It lives here
 * rather than inline because the dump shapes are pure, total functions of their
 * input with no installer state — and because `install.ts` is far over the
 * 1,500-line source ceiling (`check_source_size_budget`), so a self-contained
 * unit belongs outside it.
 *
 * This module is in the installer's bundled import closure
 * (`npm run build:install-bundle`), so it carries no module-level side effect
 * and no `process.exit` — see `check_installer_import_purity`.
 */

export function jsonStrNoAscii(s: string): string {
    // json.dumps(ensure_ascii=False): escape control chars + " + \, keep >=0x20
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    out += ch;
                }
        }
    }
    return out + '"';
}

function _jsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            if (Number.isNaN(value)) return 'NaN';
            return value > 0 ? 'Infinity' : '-Infinity';
        }
        // Our payloads carry only integers; render as-is.
        return String(value);
    }
    if (typeof value === 'string') return jsonStrNoAscii(value);
    return null;
}

function _dumpIndent(value: unknown, indent: number, depth: number): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${jsonStrNoAscii(k)}: ${_dumpIndent(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return jsonStrNoAscii(String(value));
}

/** `json.dumps(data, indent=N, ensure_ascii=False)` (sort_keys=False). */
export function jsonDumpsIndent(value: unknown, indent: number): string {
    return _dumpIndent(value, indent, 0);
}

/** `json.dumps(obj, separators=(",", ":"))` — compact, ensure_ascii=False here. */
export function jsonDumpsCompact(value: unknown): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    if (Array.isArray(value)) {
        return '[' + value.map((v) => jsonDumpsCompact(v)).join(',') + ']';
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        return (
            '{' +
            Object.keys(obj)
                .map((k) => `${jsonStrNoAscii(k)}:${jsonDumpsCompact(obj[k])}`)
                .join(',') +
            '}'
        );
    }
    return jsonStrNoAscii(String(value));
}
