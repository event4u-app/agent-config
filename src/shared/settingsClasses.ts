/**
 * Settings A/B/C classes — the pure half.
 *
 * `docs/contracts/settings-classes.md` is the single source: one markdown table
 * row per template leaf, each carrying the class that decides **who may write
 * that key**. This module parses that table and nothing else. There is
 * deliberately no generated JSON twin — a second machine-readable copy is a
 * second thing to drift, and the whole point of the contract is that the fence
 * and the prose explaining it cannot disagree.
 *
 * Pure module — no I/O. Consumed by the lint (`src/scripts/lint_settings_classes.ts`),
 * the `settings set` writer, and the Fastify settings route, so all three
 * refuse the same keys for the same reason.
 *
 * @see docs/contracts/settings-classes.md
 */

/** The closed class vocabulary. A row outside it is a defect, not a new class. */
export const SETTINGS_CLASSES = ['A', 'B', 'C'] as const;

export type SettingsClass = (typeof SETTINGS_CLASSES)[number];

export function isSettingsClass(value: string): value is SettingsClass {
    return (SETTINGS_CLASSES as readonly string[]).includes(value);
}

/** One parsed row of the contract's key table. */
export interface SettingsClassRow {
    /** Dotted leaf path, e.g. `personal.autonomy`. */
    key: string;
    /** Raw class cell — NOT yet validated, so the lint can report a bad one. */
    cls: string;
    /** 1-indexed line in the contract, so a finding points at something. */
    line: number;
}

/** What the contract's own `## Counts` table claims about itself. */
export interface DeclaredClassCounts {
    A: number | null;
    B: number | null;
    C: number | null;
    total: number | null;
}

/**
 * `| \`some.key\` | C | \`false\` | why |` → one row.
 *
 * The class column is what separates the key table from the prose tables above
 * it, several of which also open with a backticked key. A second cell that is
 * not a single bare letter is not a key row.
 */
const ROW_RE = /^\|\s*`([^`]+)`\s*\|\s*([^|]*?)\s*\|/;

export function parseSettingsClassRows(markdown: string): SettingsClassRow[] {
    const rows: SettingsClassRow[] = [];
    const lines = markdown.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = ROW_RE.exec(lines[i] ?? '');
        if (m === null) {
            continue;
        }
        const key = m[1] ?? '';
        const cls = m[2] ?? '';
        if (!/^[A-Za-z]$/.test(cls)) {
            continue;
        }
        rows.push({ key, cls, line: i + 1 });
    }
    return rows;
}

/** `| A — preference | 27 |` and `| **Total** | **140** |` → the declared tallies. */
export function parseDeclaredClassCounts(markdown: string): DeclaredClassCounts {
    const read = (re: RegExp): number | null => {
        const m = re.exec(markdown);
        const raw = m?.[1];
        return raw === undefined ? null : Number.parseInt(raw, 10);
    };
    return {
        A: read(/^\|\s*A\s+—\s+preference\s*\|\s*(\d+)\s*\|/m),
        B: read(/^\|\s*B\s+—\s+consent\s*\|\s*(\d+)\s*\|/m),
        C: read(/^\|\s*C\s+—\s+guarded\s*\|\s*(\d+)\s*\|/m),
        total: read(/^\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|/m),
    };
}

/**
 * Dotted key → class, for the rows whose class is valid.
 *
 * A row with an unparseable class is DROPPED rather than defaulted, so a
 * caller asking "may I write this?" gets `undefined` — which every caller
 * treats as refuse. A typo in the contract must never widen the fence.
 */
export function buildSettingsClassIndex(rows: readonly SettingsClassRow[]): Map<string, SettingsClass> {
    const index = new Map<string, SettingsClass>();
    for (const row of rows) {
        if (!isSettingsClass(row.cls) || index.has(row.key)) {
            continue;
        }
        index.set(row.key, row.cls);
    }
    return index;
}

/**
 * Conservative-default test for class B (half one of the B invariant).
 *
 * A sparse settings file means absent = default. A B key whose default is the
 * permissive value makes "never asked" indistinguishable from "answered yes",
 * which turns the ask into decoration on a decision already taken in the
 * user's name. These are the values that cannot carry a permission.
 *
 * Half two of the invariant — that the ask fires on the user's own request and
 * never at a moment the agent chose — is prose in the contract, not code. No
 * gate can read the agent's reason for picking a moment.
 */
export function isConservativeDefault(value: unknown): boolean {
    if (value === null || value === false || value === '' || value === 0) {
        return true;
    }
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length === 0;
    }
    return false;
}

/**
 * Dotted leaf paths of a parsed settings tree.
 *
 * A leaf is anything that is not a NON-EMPTY map. An empty map is a real
 * configurable value with a real default (`subagents.host_capabilities: {}`),
 * so it is a leaf — one more than the template↔schema parity walk produces.
 * That divergence is deliberate: a key the parity walk skips is exactly the
 * key that would otherwise reach the writer with no class.
 */
export function settingsLeafPaths(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return [prefix];
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
        return [prefix];
    }
    return entries.flatMap(([k, v]) => settingsLeafPaths(v, prefix === '' ? k : `${prefix}.${k}`));
}

/** Read one dotted path out of a parsed settings tree; `undefined` when absent. */
export function getSettingsLeaf(root: unknown, dotted: string): unknown {
    let node: unknown = root;
    for (const part of dotted.split('.')) {
        if (typeof node !== 'object' || node === null || Array.isArray(node)) {
            return undefined;
        }
        node = (node as Record<string, unknown>)[part];
    }
    return node;
}
