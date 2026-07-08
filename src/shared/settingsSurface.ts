/**
 * Settings-surface snapshot + semantic delta
 * (road-to-settings-change-review).
 *
 * A *surface* is the flattened, machine-comparable shape of the settings
 * schema at one package version: per dotted leaf key its type, default,
 * enum vocabulary, and description. Every global install persists the
 * surface to `state/settings-surface.json`; the next upgrade reads the
 * persisted file as the OLD surface before overwriting it and computes a
 * semantic delta (added / removed / default_changed / enum_added /
 * enum_removed / type_changed) that drives the upgrade review form.
 *
 * Pure module — no I/O; consumed by the installer (bundled), the Fastify
 * server, and the Preact UI.
 */

export type JsonLike =
    | string
    | number
    | boolean
    | null
    | JsonLike[]
    | { [key: string]: JsonLike };

export interface SurfaceEntry {
    type: string;
    default?: JsonLike;
    enum?: Array<string | number>;
    description?: string;
}

export interface SettingsSurface {
    /** Package version that produced the snapshot. */
    version: string;
    /** Dotted leaf key → shape. */
    entries: Record<string, SurfaceEntry>;
}

/** One reviewable change between two surfaces. */
export interface SurfaceChange {
    key: string;
    kind: 'added' | 'removed' | 'default_changed' | 'enum_added' | 'enum_removed' | 'type_changed';
    /** Old surface entry (absent for `added`). */
    old?: SurfaceEntry;
    /** New surface entry (absent for `removed`). */
    new?: SurfaceEntry;
    /** For enum_added/enum_removed: the specific values. */
    values?: Array<string | number>;
}

export interface SurfaceDelta {
    oldVersion: string;
    newVersion: string;
    changes: SurfaceChange[];
}

interface JsonSchemaNode {
    type?: string;
    default?: JsonLike;
    enum?: Array<string | number>;
    description?: string;
    properties?: Record<string, JsonSchemaNode>;
    items?: JsonSchemaNode;
    additionalProperties?: boolean | JsonSchemaNode;
    definitions?: Record<string, JsonSchemaNode>;
    $ref?: string;
}

function unwrapRef(root: JsonSchemaNode): JsonSchemaNode {
    if (root.$ref !== undefined && root.definitions !== undefined) {
        const name = root.$ref.replace('#/definitions/', '');
        const def = root.definitions[name];
        if (def !== undefined) return def;
    }
    return root;
}

/**
 * Flatten a `zodToJsonSchema` output into dotted leaf entries. Objects with
 * `properties` recurse; everything else (scalars, enums, arrays, free-form
 * maps) is a leaf. Deterministic key order (sorted) so snapshots diff
 * cleanly in git and across runs.
 */
export function flattenSurface(schema: JsonSchemaNode, version: string): SettingsSurface {
    const entries: Record<string, SurfaceEntry> = {};
    const walk = (node: JsonSchemaNode, prefix: string): void => {
        if (node.type === 'object' && node.properties !== undefined) {
            for (const key of Object.keys(node.properties).sort()) {
                const child = node.properties[key] as JsonSchemaNode;
                walk(child, prefix === '' ? key : `${prefix}.${key}`);
            }
            return;
        }
        if (prefix === '') return;
        const entry: SurfaceEntry = { type: node.type ?? (node.enum !== undefined ? 'enum' : 'unknown') };
        if (node.default !== undefined) entry.default = node.default;
        if (node.enum !== undefined) entry.enum = [...node.enum];
        if (node.description !== undefined) entry.description = node.description;
        entries[prefix] = entry;
    };
    walk(unwrapRef(schema), '');
    return { version, entries };
}

function sameJson(a: JsonLike | undefined, b: JsonLike | undefined): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Semantic delta between two surfaces. One key can contribute multiple
 * changes (e.g. a default change AND new enum values). Order: stable by
 * key, then by kind — the UI groups by kind anyway.
 */
export function computeSurfaceDelta(oldS: SettingsSurface, newS: SettingsSurface): SurfaceDelta {
    const changes: SurfaceChange[] = [];
    const oldKeys = new Set(Object.keys(oldS.entries));
    const newKeys = new Set(Object.keys(newS.entries));

    for (const key of [...newKeys].sort()) {
        const n = newS.entries[key] as SurfaceEntry;
        if (!oldKeys.has(key)) {
            changes.push({ key, kind: 'added', new: n });
            continue;
        }
        const o = oldS.entries[key] as SurfaceEntry;
        if (o.type !== n.type) {
            changes.push({ key, kind: 'type_changed', old: o, new: n });
        }
        if (!sameJson(o.default, n.default)) {
            changes.push({ key, kind: 'default_changed', old: o, new: n });
        }
        const oldEnum = new Set(o.enum ?? []);
        const newEnum = new Set(n.enum ?? []);
        if (o.enum !== undefined || n.enum !== undefined) {
            const addedVals = [...newEnum].filter((v) => !oldEnum.has(v));
            const removedVals = [...oldEnum].filter((v) => !newEnum.has(v));
            if (addedVals.length > 0) {
                changes.push({ key, kind: 'enum_added', old: o, new: n, values: addedVals });
            }
            if (removedVals.length > 0) {
                changes.push({ key, kind: 'enum_removed', old: o, new: n, values: removedVals });
            }
        }
    }
    for (const key of [...oldKeys].sort()) {
        if (!newKeys.has(key)) {
            changes.push({ key, kind: 'removed', old: oldS.entries[key] as SurfaceEntry });
        }
    }
    return { oldVersion: oldS.version, newVersion: newS.version, changes };
}

/**
 * Classify a change against the user's CURRENT value — drives the review
 * form's per-item control and the blocking semantics:
 *
 *   - `must_fix`  — the stored value is invalid under the new surface
 *                   (enum_removed hit / type_changed mismatch). Blocks save.
 *   - `adopt`     — user never customized (value equals the OLD default) and
 *                   the default changed → preselect adopting the new default.
 *   - `review`    — user customized; informational old→new context.
 *   - `info`      — nothing actionable (enum_added, removed, added-with-default).
 */
export type ChangeSeverity = 'must_fix' | 'adopt' | 'review' | 'info';

export function classifyChange(change: SurfaceChange, currentValue: JsonLike | undefined): ChangeSeverity {
    if (change.kind === 'enum_removed') {
        const removed = new Set(change.values ?? []);
        if (currentValue !== undefined && removed.has(currentValue as string | number)) return 'must_fix';
        return 'info';
    }
    if (change.kind === 'type_changed') {
        return 'must_fix';
    }
    if (change.kind === 'default_changed') {
        const neverCustomized = currentValue === undefined
            || sameJson(currentValue, change.old?.default);
        return neverCustomized ? 'adopt' : 'review';
    }
    if (change.kind === 'added') {
        return change.new?.default === undefined ? 'must_fix' : 'info';
    }
    return 'info';
}
