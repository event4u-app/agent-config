/**
 * Control roles for the `ui:audit` artefact: which implementation IS the select
 * (or date, checkbox, dialog, ...) in this project, how often it is used, where
 * it is not, and the box metrics a new one should copy.
 *
 * The role table mirrors `work_engine/_lib/control_roles.ts`. It is not imported
 * from there because the CLI must not take a runtime edge into the template
 * tree (see `src/cli/commands/uiAudit.ts` § COVERAGE_BUCKETS);
 * `tests/scripts/control_roles_parity.test.ts` keeps the two in step.
 */
import * as path from 'node:path';

export const CONTROL_ROLES = [
    'select',
    'input',
    'textarea',
    'checkbox',
    'radio',
    'switch',
    'date',
    'dialog',
    'details',
    'popover',
    'combobox',
    'menu',
    'menu-button',
    'tooltip',
    'tabs',
    'table',
] as const;

export type ControlRole = (typeof CONTROL_ROLES)[number];

const NAME: Record<ControlRole, string> = {
    select: 'select|selectbox|listbox|native-select',
    input: 'input|text-?field|text-?input',
    textarea: 'textarea',
    checkbox: 'checkbox',
    radio: 'radio|radio-?group',
    switch: 'switch|toggle',
    date: 'date-?picker|calendar|date-?input|time-?picker',
    dialog: 'dialog|modal|alert-?dialog|sheet|drawer',
    details: 'details|accordion|collapsible',
    popover: 'popover|popup',
    combobox: 'combobox|autocomplete|command',
    menu: 'menu|dropdown-?menu|context-?menu|menubar',
    'menu-button': 'menu-?button|dropdown-?trigger|menu-?trigger',
    tooltip: 'tooltip',
    tabs: 'tabs|tab-?list|tab-?group',
    table: 'table|data-?table|data-?grid',
};

const NATIVE: Partial<Record<ControlRole, string>> = {
    select: 'select',
    input: 'input',
    textarea: 'textarea',
    dialog: 'dialog',
    details: 'details',
    table: 'table',
};

const INPUT_TYPE_ROLE: Record<string, ControlRole> = {
    checkbox: 'checkbox',
    radio: 'radio',
    date: 'date',
    'datetime-local': 'date',
    time: 'date',
    month: 'date',
    week: 'date',
};
const INPUT_TYPES_NOT_A_CONTROL = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

export interface Occurrence {
    role: ControlRole;
    /** `native:<tag>` for an HTML element, the tag as written for a component. */
    impl: string;
    line: number;
    /** The element's `class` / `className` value, when one is written inline. */
    classes: string;
}

const TAG_RE = /<([A-Za-z][\w:.-]*)([^<>]*?)\/?>/g;

function lineOf(text: string, index: number): number {
    let n = 1;
    for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
    return n;
}

function classesOf(attrs: string): string {
    const m = /\b(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/.exec(attrs);
    return (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim();
}

/** The role of a tag, or null. A component matches on its last name segment. */
export function roleOfTag(tag: string, attrs: string): ControlRole | null {
    const lower = tag.toLowerCase();
    if (lower === 'input') {
        const type = /\btype\s*=\s*["']?([\w-]+)/i.exec(attrs)?.[1]?.toLowerCase() ?? 'text';
        if (INPUT_TYPES_NOT_A_CONTROL.has(type)) return null;
        return INPUT_TYPE_ROLE[type] ?? 'input';
    }
    if (/\brole\s*=\s*["']switch["']/i.test(attrs)) return 'switch';
    if (/\brole\s*=\s*["']combobox["']/i.test(attrs)) return 'combobox';
    const isNative = /^[a-z]+$/.test(tag);
    for (const role of CONTROL_ROLES) {
        if (isNative) {
            if (NATIVE[role] === lower) return role;
            continue;
        }
        const last = tag.split(/[:.]/).pop() ?? tag;
        const segment = last.replace(/^(?:x|ui|v|el|n|q|a|b)-/i, '');
        if (new RegExp(`^(?:${NAME[role]})$`, 'i').test(segment)) return role;
    }
    if (isNative && /\bpopover\b/i.test(attrs)) return 'popover';
    return null;
}

/** Every control occurrence in a file's markup. */
export function occurrences(text: string): Occurrence[] {
    const out: Occurrence[] = [];
    for (const m of text.matchAll(TAG_RE)) {
        const tag = m[1]!;
        const attrs = m[2] ?? '';
        const role = roleOfTag(tag, attrs);
        if (role === null) continue;
        const isNative = /^[a-z]+$/.test(tag);
        out.push({
            role,
            impl: isNative ? `native:${tag}` : tag,
            line: lineOf(text, m.index ?? 0),
            classes: classesOf(attrs),
        });
    }
    return out;
}

/**
 * The component a file DEFINES, as the tag a caller writes: a Blade component
 * under `resources/views/components/<name>.blade.php` defines `x-<name>`; a
 * module exporting a capitalised name defines that name.
 */
export function definedComponents(rel: string, text: string): string[] {
    const out: string[] = [];
    const blade = /resources\/views\/components\/(.+)\.blade\.php$/.exec(rel);
    if (blade) out.push(`x-${blade[1]!.replace(/\//g, '.')}`);
    for (const m of text.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g)) {
        out.push(m[1]!);
    }
    for (const m of text.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=/g)) out.push(m[1]!);
    return [...new Set(out)];
}

export interface BoxMetrics {
    height_px: number | null;
    padding_x_px: number | null;
    padding_y_px: number | null;
    radius_px: number | null;
    font_size_px: number | null;
    border_px: number | null;
    source: 'static' | 'render';
}

const SPACING_PX = (n: string): number | null => {
    if (n === 'px') return 1;
    const v = Number(n);
    return Number.isFinite(v) ? v * 4 : null;
};
const RADIUS_PX: Record<string, number> = { none: 0, sm: 2, '': 4, md: 6, lg: 8, xl: 12, '2xl': 16, '3xl': 24, full: 9999 };
const FONT_PX: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24 };

/**
 * Box metrics from Tailwind utility classes. Returns null when not one metric
 * can be read — the caller records the reason; a 0 here would claim a measured
 * zero-height control.
 */
export function boxMetricsFromClasses(classes: string): BoxMetrics | null {
    const m: BoxMetrics = {
        height_px: null,
        padding_x_px: null,
        padding_y_px: null,
        radius_px: null,
        font_size_px: null,
        border_px: null,
        source: 'static',
    };
    for (const raw of classes.split(/\s+/)) {
        const c = raw.replace(/^[\w-]+:/, '');
        let x: RegExpExecArray | null;
        if ((x = /^h-(\d+(?:\.5)?|px)$/.exec(c))) m.height_px = SPACING_PX(x[1]!);
        else if ((x = /^px-(\d+(?:\.5)?|px)$/.exec(c))) m.padding_x_px = SPACING_PX(x[1]!);
        else if ((x = /^py-(\d+(?:\.5)?|px)$/.exec(c))) m.padding_y_px = SPACING_PX(x[1]!);
        else if ((x = /^p-(\d+(?:\.5)?|px)$/.exec(c))) {
            m.padding_x_px = SPACING_PX(x[1]!);
            m.padding_y_px = SPACING_PX(x[1]!);
        } else if ((x = /^rounded(?:-(none|sm|md|lg|xl|2xl|3xl|full))?$/.exec(c))) m.radius_px = RADIUS_PX[x[1] ?? '']!;
        else if ((x = /^text-(xs|sm|base|lg|xl|2xl)$/.exec(c))) m.font_size_px = FONT_PX[x[1]!]!;
        else if ((x = /^border(?:-(\d))?$/.exec(c))) m.border_px = x[1] === undefined ? 1 : Number(x[1]);
    }
    const any = [m.height_px, m.padding_x_px, m.padding_y_px, m.radius_px, m.font_size_px, m.border_px].some(
        (v) => v !== null,
    );
    return any ? m : null;
}

export interface RoleEntry {
    /** The canonical implementation, or null when the tie could not be broken. */
    canonical: string | null;
    uses: number;
    implementations: Record<string, number>;
    outliers: string[];
    /** Components the project defines for this role, used or not. */
    defined: string[];
    tie?: string[];
    box_metrics: BoxMetrics | null;
    box_metrics_reason?: string;
}

/**
 * Build `control_roles` from (relative path, text) pairs. Canonical is the most
 * used implementation; a defined project component wins an unused role and
 * breaks a tie with a native element; any other tie is left null with `tie`
 * set, which the apply paths read as "ask".
 */
export function buildControlRoles(
    files: ReadonlyArray<readonly [string, string]>,
    systemPaths: ReadonlyArray<string> = [],
): Partial<Record<ControlRole, RoleEntry>> {
    const defs = new Map<string, string>(); // component tag -> defining file
    for (const [rel, text] of files) for (const c of definedComponents(rel, text)) defs.set(c, rel);
    const defRoles = new Map<string, ControlRole>();
    for (const tag of defs.keys()) {
        const r = roleOfTag(tag, '');
        if (r !== null) defRoles.set(tag, r);
    }

    const uses = new Map<ControlRole, Array<Occurrence & { file: string }>>();
    for (const [rel, text] of files) {
        const defined = new Set(definedComponents(rel, text).map((t) => roleOfTag(t, '')));
        for (const o of occurrences(text)) {
            // An element inside the file that defines the same role's primitive
            // is the primitive's implementation, not a use.
            if (defined.has(o.role)) continue;
            const list = uses.get(o.role) ?? [];
            list.push({ ...o, file: rel });
            uses.set(o.role, list);
        }
    }

    const out: Partial<Record<ControlRole, RoleEntry>> = {};
    for (const role of CONTROL_ROLES) {
        const list = uses.get(role) ?? [];
        const definedForRole = [...defRoles].filter(([, r]) => r === role).map(([t]) => t).sort();
        if (list.length === 0 && definedForRole.length === 0) continue;

        const counts: Record<string, number> = {};
        for (const o of list) counts[o.impl] = (counts[o.impl] ?? 0) + 1;
        for (const d of definedForRole) counts[d] ??= 0;
        const max = Math.max(...Object.values(counts));
        let top = Object.keys(counts).filter((k) => counts[k] === max).sort();
        if (top.length > 1) {
            const components = top.filter((t) => !t.startsWith('native:'));
            if (components.length === 1) top = components;
        }
        if (top.length > 1) {
            const marked = top.filter((t) => {
                const file = defs.get(t);
                return file !== undefined && systemPaths.some((p) => file.startsWith(path.posix.dirname(p)));
            });
            if (marked.length === 1) top = marked;
        }
        const canonical = top.length === 1 ? top[0]! : null;

        const entry: RoleEntry = {
            canonical,
            uses: list.length,
            implementations: counts,
            outliers: canonical === null ? [] : list.filter((o) => o.impl !== canonical).map((o) => `${o.file}:${o.line}`),
            defined: definedForRole,
            box_metrics: null,
        };
        if (canonical === null) entry.tie = top;

        const sample =
            canonical === null
                ? null
                : (list.find((o) => o.impl === canonical && o.classes !== '')?.classes ??
                  primitiveClasses(files, defs.get(canonical), role));
        const metrics = sample ? boxMetricsFromClasses(sample) : null;
        entry.box_metrics = metrics;
        if (metrics === null) {
            entry.box_metrics_reason =
                canonical === null
                    ? 'no canonical implementation (tie)'
                    : sample
                      ? 'no Tailwind sizing utility on the canonical implementation'
                      : 'no inline class list on the canonical implementation';
        }
        out[role] = entry;
    }
    return out;
}

/** Inline classes of the element that implements `role` inside its primitive's file. */
function primitiveClasses(
    files: ReadonlyArray<readonly [string, string]>,
    file: string | undefined,
    role: ControlRole,
): string | null {
    if (file === undefined) return null;
    const text = files.find(([rel]) => rel === file)?.[1];
    if (text === undefined) return null;
    const own = occurrences(text).find((o) => o.role === role && o.classes !== '');
    if (own) return own.classes;
    // A primitive that wraps a library part (`<SelectPrimitive.Trigger className=…>`)
    // carries its sizing on the trigger, not on a role-named tag.
    const trigger = /<[\w.]*Trigger\b[^>]*\bclass(?:Name)?\s*=\s*["'{`]+([^"'`}]*)/.exec(text);
    if (trigger) return trigger[1]!;
    // Blade components merge their classes into the attribute bag.
    const merge = /merge\(\s*\[\s*'class'\s*=>\s*'([^']*)'/.exec(text);
    return merge ? merge[1]! : null;
}
