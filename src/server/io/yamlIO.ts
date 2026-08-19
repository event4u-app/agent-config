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
 * The indent width this document actually uses, or 2 when it has no nesting.
 *
 * Read from the FIRST indented mapping line rather than assumed, because an
 * assumed width silently produces a duplicate mapping key on any other one
 * (see `upsertScalar`). Tabs are not YAML indentation and are ignored.
 */
export function detectIndentWidth(lines: readonly string[]): number {
    for (const line of lines) {
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        if (line.startsWith('\t')) continue;
        const indentLen = line.length - line.trimStart().length;
        if (indentLen > 0 && /^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(line.trim())) return indentLen;
    }
    return 2;
}

/**
 * Set the scalar at `dottedPath`, CREATING the nesting when it is absent.
 *
 * R2 round 2, finding 6. `replaceScalar` returns the template unchanged when
 * the path cannot be located, and the wizard's `set` helper never appended —
 * so on every pre-existing `.ai-council.yml` written before a key existed, the
 * wizard's toggle for that key returned 200 and wrote nothing. The user flips
 * a switch, the server reports success, and the file is untouched.
 *
 * `mergeIntoTemplate` is not the fix for a NESTED key: its fallback appends a
 * flat `a.b: value` line, which a YAML reader sees as a top-level key literally
 * named "a.b" — so `doc['fallback']` stays undefined and the toggle is still
 * inert, now with a line in the file suggesting otherwise.
 *
 * Insertion point is the end of the deepest EXISTING ancestor block, so an
 * existing `fallback:` section gains a key rather than a second `fallback:`
 * being appended — a duplicate mapping key is a YAML error in strict parsers
 * and a silent last-wins in lenient ones.
 *
 * Comments and unrelated keys are preserved: nothing is rewritten, only
 * inserted.
 */
export function upsertScalar(template: string, dottedPath: string[], value: unknown): string {
    if (dottedPath.length === 0) return template;
    const replaced = replaceScalar(template, dottedPath, value);
    if (replaced !== template) return replaced;

    const sections = dottedPath.slice(0, -1);
    const key = dottedPath[dottedPath.length - 1] as string;
    const formatted = formatScalar(value);
    const lines = template.split('\n');
    // The document's OWN indent width, not an assumed two.
    //
    // R2 round 4, finding 7. Both the ancestor search and the emitted block
    // hardcoded `'  '.repeat(depth)`, so on a 4-space file the depth-2 walk
    // round 3 added matched nothing at depth 1, `matched` stayed 0, and the
    // whole chain was appended at EOF — producing a SECOND `fallback:` mapping
    // key beside the existing one. `wizard.ts` writes the result without
    // re-parsing and reports `{ok: true}`, so the user gets a 200 over a file
    // a strict parser now rejects and a lenient one reads last-wins.
    const width = detectIndentWidth(lines);
    const pad = (depth: number): string => ' '.repeat(width * depth);

    // How deep an existing ancestor chain runs, and where its block ends.
    let matched = 0;
    let insertAt = lines.length;
    // The bounds of the ancestor matched at the previous depth. Each level
    // searches only INSIDE its parent, so a nested key never binds to a
    // same-named section under a different parent.
    let parentStart = -1;
    let parentEnd = lines.length;
    for (let depth = 0; depth < sections.length; depth++) {
        const want = sections[depth];
        const indent = pad(depth);
        let found = -1;
        // R2 round 3, finding 5: this carried `depth === 0 ? 0 : insertAt ===
        // lines.length ? 0 : 0` — every branch zero, i.e. a comment claiming a
        // scoped search over an expression that does not scope anything. Made
        // real: a nested section is searched only INSIDE its parent's block,
        // so a depth-2 path cannot bind to a same-named key under a different
        // parent. Latent today (the one caller is depth 1) and fixed rather
        // than deleted, because the next caller is the one it would bite.
        const from = depth === 0 ? 0 : parentStart + 1;
        const until = depth === 0 ? lines.length : parentEnd;
        for (let i = from; i < until; i++) {
            const line = lines[i];
            if (line === undefined) continue;
            if (line.trim() === '' || line.trim().startsWith('#')) continue;
            const indentLen = line.length - line.trimStart().length;
            if (indentLen !== indent.length) continue;
            const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line.trim());
            if (m !== null && m[1] === want) {
                found = i;
                break;
            }
        }
        if (found === -1) break;
        matched = depth + 1;
        // End of this block: the next line at or above its own indent level.
        let end = lines.length;
        for (let i = found + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line === undefined) continue;
            if (line.trim() === '' || line.trim().startsWith('#')) continue;
            const indentLen = line.length - line.trimStart().length;
            if (indentLen <= indent.length) {
                end = i;
                break;
            }
        }
        insertAt = end;
        parentStart = found;
        parentEnd = end;
    }

    const block: string[] = [];
    for (let depth = matched; depth < sections.length; depth++) {
        block.push(`${pad(depth)}${sections[depth] as string}:`);
    }
    block.push(`${pad(sections.length)}${key}: ${formatted}`);

    if (matched === 0) {
        // No ancestor at all — append at EOF as its own block.
        let body = template;
        if (!body.endsWith('\n')) body += '\n';
        return `${body}${block.join('\n')}\n`;
    }
    lines.splice(insertAt, 0, ...block);
    return lines.join('\n');
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

/**
 * Placeholders the shipped template carries, and the value each resolves to
 * when nothing has substituted it. The installer fills these from the chosen
 * profile preset; anything reading the template directly must substitute them
 * too, or it writes a literal `__PLACEHOLDER__` into the user's file.
 */
export const TEMPLATE_PLACEHOLDER_DEFAULTS: Readonly<Record<string, string>> = {
    __RULE_LOADING_TIER__: 'balanced',
    // Successor knob (ADR-110). P2-verdict council 2026-07-07: the
    // balanced-heritage default is `auto` — lift only where measured
    // (vendor-granular unknown_defaults in src/config/host-capabilities.yml).
    __DISCIPLINE_PROFILE__: 'auto',
    __USER_TYPE__: '',
    __CHAT_HISTORY_FREQUENCY__: 'per_turn',
};

/** Replace every known template placeholder with its default value. */
export function substituteTemplatePlaceholders(body: string): string {
    let rendered = body;
    for (const [placeholder, value] of Object.entries(TEMPLATE_PLACEHOLDER_DEFAULTS)) {
        rendered = rendered.replaceAll(placeholder, value);
    }
    return rendered;
}

/** Read one dotted path out of a parsed settings tree. `undefined` when absent. */
export function readPath(root: Record<string, unknown>, dotted: string): unknown {
    let node: unknown = root;
    for (const segment of dotted.split('.')) {
        if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return node;
}

/** Write one dotted path into a settings tree, creating intermediate objects. */
export function writePath(root: Record<string, unknown>, dotted: string, value: unknown): void {
    const segments = dotted.split('.');
    const leaf = segments.pop();
    if (leaf === undefined) return;
    let node = root;
    for (const segment of segments) {
        const next = node[segment];
        if (next === null || typeof next !== 'object' || Array.isArray(next)) {
            const created: Record<string, unknown> = {};
            node[segment] = created;
            node = created;
        } else {
            node = next as Record<string, unknown>;
        }
    }
    node[leaf] = value;
}

/**
 * Render a SPARSE settings document — the decisions actually made, and nothing
 * else (`road-to-zero-ceremony-settings` Phase 3).
 *
 * The counterpart to `mergeIntoTemplate`, which returns the whole 1,233-line
 * template with the answers patched in. Here the template is consulted only as
 * the value source for the carve-out keys; it is never copied into the output.
 *
 * Comment preservation is not a concern in this direction, because there are no
 * template comments to preserve — the long-form explanation those comments used
 * to carry now lives in the generated `docs/settings-reference.md`, which the
 * header points at.
 */
export function renderSparseSettings(values: Record<string, unknown>): string {
    const header = [
        '# Your settings — a record of decisions, not a copy of the defaults.',
        '#',
        '# Every key absent from this file resolves to its documented default.',
        '# The full key list, with defaults and explanations, is generated at',
        '# docs/settings-reference.md — this file stays small on purpose.',
        '#',
        '# How each entry was decided is recorded beside it in',
        '# `.agent-settings.provenance.json`.',
        '',
    ].join('\n');
    const body = Object.keys(values).length === 0
        ? ''
        : yamlDump(values, { lineWidth: -1, sortKeys: true });
    return `${header}${body}`;
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
