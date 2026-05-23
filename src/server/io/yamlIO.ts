/**
 * YAML round-trip helpers for `.agent-settings.yml`.
 *
 * Important contract: the template ships with comments that explain
 * every key — we MUST NOT discard them when the wizard writes back.
 * `js-yaml.dump` cannot preserve comments, so we use a key-level
 * replace strategy that mirrors `scripts/install.py::_replace_template_value`:
 * scan the rendered template line-by-line, replace only the scalar
 * value at each dotted path, leave comments and indentation alone.
 *
 * For arrays and nested objects we fall back to re-serializing the
 * subtree (`js-yaml.dump`) because line-level replace can't safely
 * splice multi-line blocks. The form renderer keeps depth ≤ 2, so
 * the subtree footprint is small.
 */

import { dump as yamlDump, load as yamlLoad } from 'js-yaml';

export interface ReadResult {
    values: Record<string, unknown>;
    raw: string;
}

export function parseYaml(raw: string): Record<string, unknown> {
    const parsed = yamlLoad(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('settings file did not parse to an object');
    }
    return parsed as Record<string, unknown>;
}

function formatScalar(value: unknown): string {
    if (typeof value === 'string') {
        // js-yaml safely quotes strings that need it; trim the trailing newline.
        return yamlDump(value, { lineWidth: -1 }).replace(/\n$/, '').trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value === null || value === undefined) return '""';
    // Arrays / nested objects: dump inline. Form keeps depth ≤ 2 so this is rare.
    return yamlDump(value, { lineWidth: -1, flowLevel: 0 }).replace(/\n$/, '').trim();
}

interface FlatEntry {
    path: string[];
    value: unknown;
}

function flatten(value: unknown, prefix: string[] = []): FlatEntry[] {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return [{ path: prefix, value }];
    }
    const entries: FlatEntry[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        entries.push(...flatten(v, [...prefix, k]));
    }
    return entries;
}

/**
 * Replace the scalar at `dottedPath` in `template` with `value`.
 * Comments and unrelated keys are preserved verbatim. Returns the
 * template unchanged when the path cannot be located (matches the
 * Python installer's tolerant behaviour).
 */
export function replaceScalar(template: string, dottedPath: string[], value: unknown): string {
    if (dottedPath.length === 0) return template;
    const sections = dottedPath.slice(0, -1);
    const key = dottedPath[dottedPath.length - 1];
    const targetIndent = '  '.repeat(sections.length);

    const lines = template.split('\n');
    const currentPath: (string | null)[] = new Array<string | null>(sections.length).fill(null);
    const formatted = formatScalar(value);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        const stripped = line.trim();
        if (stripped === '' || stripped.startsWith('#')) continue;
        const indentLen = line.length - line.trimStart().length;
        if (indentLen % 2 !== 0) continue;
        const level = indentLen / 2;
        if (level > sections.length) continue;

        const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(stripped);
        if (!m) continue;
        const lineKey = m[1];
        if (lineKey === undefined) continue;
        if (level < sections.length) {
            if (lineKey === sections[level]) {
                currentPath[level] = lineKey;
                for (let j = level + 1; j < currentPath.length; j++) currentPath[j] = null;
            } else if (currentPath[level] !== null && lineKey !== currentPath[level]) {
                currentPath[level] = null;
            }
            continue;
        }
        // level === sections.length → leaf candidate
        const parentsMatch = sections.every((s, idx) => currentPath[idx] === s);
        if (!parentsMatch) continue;
        if (lineKey !== key) continue;
        lines[i] = `${targetIndent}${key}: ${formatted}`;
        return lines.join('\n');
    }
    return template;
}

/**
 * Apply every leaf change from `newValues` to `templateBody`. Paths that
 * are not present in the template are appended at the end. Comments are
 * preserved for every key that already exists in the template.
 */
export function mergeIntoTemplate(templateBody: string, newValues: Record<string, unknown>): string {
    let body = templateBody;
    const appended: string[] = [];
    for (const entry of flatten(newValues)) {
        const before = body;
        body = replaceScalar(body, entry.path, entry.value);
        if (body === before) {
            // Path is not in the template — append a flat key=value at EOF.
            // Form coverage is asserted by parity test, so this branch only
            // fires on hand-edited templates.
            appended.push(`${entry.path.join('.')}: ${formatScalar(entry.value)}`);
        }
    }
    if (appended.length > 0) {
        if (!body.endsWith('\n')) body += '\n';
        body += `\n# Wizard-added keys (no template entry)\n${appended.join('\n')}\n`;
    }
    return body;
}

export function diffValues(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
): Array<{ path: string; from: unknown; to: unknown }> {
    const out: Array<{ path: string; from: unknown; to: unknown }> = [];
    const bMap = new Map(flatten(before).map((e) => [e.path.join('.'), e.value]));
    const aMap = new Map(flatten(after).map((e) => [e.path.join('.'), e.value]));
    const paths = new Set<string>([...bMap.keys(), ...aMap.keys()]);
    for (const path of paths) {
        const fromV = bMap.get(path);
        const toV = aMap.get(path);
        if (JSON.stringify(fromV) !== JSON.stringify(toV)) out.push({ path, from: fromV, to: toV });
    }
    return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Recursive dict merge — overlay wins, nested dicts are merged, lists
 * are replaced (not concatenated). Mirrors `scripts/install.py::deep_merge`
 * so the Python installer and the Fastify server produce the same
 * three-layer settings tree (`defaults < global < project`).
 */
export function deepMerge(
    base: Record<string, unknown>,
    overlay: Record<string, unknown>,
): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
        const existing = result[key];
        if (isPlainObject(existing) && isPlainObject(value)) {
            result[key] = deepMerge(existing, value);
        } else {
            result[key] = value;
        }
    }
    return result;
}
