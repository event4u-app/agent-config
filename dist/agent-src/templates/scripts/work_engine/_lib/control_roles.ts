/**
 * Interactive control roles, computed from file content rather than reported.
 *
 * The `ui-trivial` lane used to trust the agent's `new_component` flag, and a
 * native `<select>` is an element, not a component — so "add a select box" on a
 * finished screen passed every trivial precondition. A role is new when the file
 * after the edit contains it and the file before did not; duplicating an
 * existing `<x-select>` or editing its label adds no role.
 *
 * The role list is the one `src/rules/ui-audit-gate.md` § Allow-list names.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
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

// The tag parser below is a copy of `src/scripts/_lib/control_roles.ts`
// (`roleOfTag`, `occurrences`): the CLI must not import from this template tree
// and this tree is projected without `src/scripts`. The two are held in step by
// `tests/scripts/control_roles_parity.test.ts`. Markup only — prose and
// identifiers never count.
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

const TAG_RE = /<([A-Za-z][\w:.-]*)([^<>]*?)\/?>/g;

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

/** Every control role whose markup occurs in `text`. */
export function rolesIn(text: string): Set<ControlRole> {
    const found = new Set<ControlRole>();
    for (const m of text.matchAll(TAG_RE)) {
        const role = roleOfTag(m[1]!, m[2] ?? '');
        if (role !== null) found.add(role);
    }
    return found;
}

/** Roles present after the edit and absent before it, in role-table order. */
export function newControlRoles(before: string, after: string): ControlRole[] {
    const had = rolesIn(before);
    const has = rolesIn(after);
    return CONTROL_ROLES.filter((r) => has.has(r) && !had.has(r));
}

/**
 * Refresh `new_control_roles` on every `state.changes` entry that names a file,
 * so a role introduced in any UI path — apply, a polish round, the UI half of a
 * mixed task — is recorded by file change rather than by intent. Returns the
 * union of roles found, in role-table order.
 */
export function annotateControlRoles(
    changes: Array<Record<string, unknown>>,
    cwd: string = process.cwd(),
): ControlRole[] {
    const found = new Set<ControlRole>();
    for (const change of changes) {
        const file = change['file'];
        const files = typeof file === 'string' ? [file] : change['files'];
        if (!Array.isArray(files)) continue;
        const names = files.filter((f): f is string => typeof f === 'string' && f !== '');
        const { perFile } = newControlRolesForFiles(names, cwd);
        const roles = perFile.flatMap((f) => f.roles);
        change['new_control_roles'] = roles;
        for (const r of roles) found.add(r);
    }
    return CONTROL_ROLES.filter((r) => found.has(r));
}

export interface FileRoles {
    file: string;
    roles: ControlRole[];
    /** `git` when the baseline came from HEAD, `untracked` when the file is new. */
    baseline: 'git' | 'untracked';
}

/**
 * Compute new roles per file against `git show HEAD:<file>`. A file that is not
 * readable on disk cannot be judged and is returned in `unreadable`, never
 * silently as "no new role".
 */
export function newControlRolesForFiles(
    files: ReadonlyArray<string>,
    cwd: string = process.cwd(),
): { perFile: FileRoles[]; unreadable: string[] } {
    const perFile: FileRoles[] = [];
    const unreadable: string[] = [];
    for (const file of files) {
        const abs = path.resolve(cwd, file);
        let after: string;
        try {
            after = fs.readFileSync(abs, 'utf8');
        } catch {
            unreadable.push(file);
            continue;
        }
        let before = '';
        let baseline: FileRoles['baseline'] = 'untracked';
        try {
            const rel = path.relative(cwd, abs).split(path.sep).join('/');
            before = execFileSync('git', ['show', `HEAD:${rel}`], {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            baseline = 'git';
        } catch {
            // Not tracked at HEAD (or not a git work tree): everything is new.
        }
        perFile.push({ file, roles: newControlRoles(before, after), baseline });
    }
    return { perFile, unreadable };
}
