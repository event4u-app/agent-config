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

// A component tag is matched by its last name segment so `<Select>`,
// `<x-select>`, `<flux:select>`, `<ui-select>` and `<v-select>` all read as the
// select role. Each pattern is anchored on `<` so prose and identifiers do not
// count — only markup does.
const TAG = (names: string): RegExp =>
    new RegExp(`<(?:[\\w-]+[:.-])?(?:${names})(?=[\\s/>])`, 'i');

const PATTERNS: ReadonlyArray<[ControlRole, RegExp]> = [
    ['select', TAG('select|selectbox|listbox|native-select')],
    ['date', /<input\b[^>]*\btype\s*=\s*["']?(?:date|datetime-local|time|month|week)\b/i],
    ['date', TAG('date-?picker|calendar|date-?input|time-?picker')],
    ['checkbox', /<input\b[^>]*\btype\s*=\s*["']?checkbox\b/i],
    ['checkbox', TAG('checkbox')],
    ['radio', /<input\b[^>]*\btype\s*=\s*["']?radio\b/i],
    ['radio', TAG('radio|radio-?group')],
    ['switch', TAG('switch|toggle')],
    ['switch', /\brole\s*=\s*["']switch["']/i],
    ['textarea', TAG('textarea')],
    ['dialog', TAG('dialog|modal|alert-?dialog|sheet|drawer')],
    ['details', TAG('details|accordion|collapsible')],
    ['popover', TAG('popover|popup')],
    ['popover', /\bpopover\s*=\s*["']?(?:auto|manual)?["'\s>]/i],
    ['combobox', TAG('combobox|autocomplete|command')],
    ['combobox', /\brole\s*=\s*["']combobox["']/i],
    ['menu', TAG('menu|dropdown-?menu|context-?menu|menubar')],
    ['menu-button', TAG('menu-?button|dropdown-?trigger|menu-?trigger')],
    ['tooltip', TAG('tooltip')],
    ['tabs', TAG('tabs|tab-?list|tab-?group')],
    ['table', TAG('table|data-?table|data-?grid')],
];

// A plain `<input>` is the input role only when it is not one of the typed
// roles above and not hidden.
const PLAIN_INPUT =
    /<input\b(?![^>]*\btype\s*=\s*["']?(?:hidden|checkbox|radio|date|datetime-local|time|month|week|submit|button|reset|image)\b)[^>]*>?/i;
// The native `<input>` is judged by PLAIN_INPUT alone; a component needs a
// namespace prefix (`<x-input>`, `<flux:input>`) or a capital (`<Input>`).
const INPUT_COMPONENT_CAPITAL = /<(?:Input|TextField|TextInput)(?=[\s/>])/;
const INPUT_COMPONENT_PREFIXED = /<[\w-]+[:.-](?:input|text-?field|text-?input)(?=[\s/>])/i;

/** Every control role whose markup occurs in `text`. */
export function rolesIn(text: string): Set<ControlRole> {
    const found = new Set<ControlRole>();
    for (const [role, re] of PATTERNS) {
        if (re.test(text)) found.add(role);
    }
    if (
        PLAIN_INPUT.test(text) ||
        INPUT_COMPONENT_CAPITAL.test(text) ||
        INPUT_COMPONENT_PREFIXED.test(text)
    ) {
        found.add('input');
    }
    return found;
}

/** Roles present after the edit and absent before it, in role-table order. */
export function newControlRoles(before: string, after: string): ControlRole[] {
    const had = rolesIn(before);
    const has = rolesIn(after);
    return CONTROL_ROLES.filter((r) => has.has(r) && !had.has(r));
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
