import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    newControlRoles,
    newControlRolesForFiles,
    rolesIn,
} from '../../../src/agent-src/templates/scripts/work_engine/_lib/control_roles.js';
import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { run } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui_trivial/apply.js';
import { run as polishRun } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/polish.js';

const FORM = `<form>
  <label>Name <x-input name="name" /></label>
</form>
`;

describe('rolesIn — markup, not prose', () => {
    it.each([
        ['<select name="s"></select>', 'select'],
        ['<x-select :options="$o" />', 'select'],
        ['<flux:select wire:model="s">', 'select'],
        ['<Select value={v}>', 'select'],
        ['<input type="date" name="d">', 'date'],
        ['<DatePicker value={d} />', 'date'],
        ['<input type="checkbox">', 'checkbox'],
        ['<Switch checked />', 'switch'],
        ['<textarea rows="3"></textarea>', 'textarea'],
        ['<dialog open>', 'dialog'],
        ['<Tooltip content="x">', 'tooltip'],
        ['<input name="q">', 'input'],
    ])('%s → %s', (markup, role) => {
        expect(rolesIn(markup).has(role as never)).toBe(true);
    });

    it('a hidden input and a word in prose carry no role', () => {
        expect([...rolesIn('<input type="hidden" name="t">')]).toEqual([]);
        expect([...rolesIn('// select the right option from the dialog')]).toEqual([]);
    });

    it('a typed input does not also read as a plain input', () => {
        expect([...rolesIn('<input type="radio" name="r">')]).toEqual(['radio']);
    });
});

describe('newControlRoles — before against after', () => {
    it('inserting a native select is a new role', () => {
        const after = FORM.replace('</form>', '  <select name="status"></select>\n</form>');
        expect(newControlRoles(FORM, after)).toEqual(['select']);
    });

    it('changing a select label adds nothing', () => {
        const before = FORM.replace('</form>', '  <label>State <x-select name="s" /></label>\n</form>');
        expect(newControlRoles(before, before.replace('State', 'Status'))).toEqual([]);
    });

    it('duplicating an existing <x-select> adds nothing', () => {
        const before = FORM.replace('</form>', '  <x-select name="a" />\n</form>');
        const after = before.replace('</form>', '  <x-select name="b" />\n</form>');
        expect(newControlRoles(before, after)).toEqual([]);
    });
});

describe('ui_trivial apply — the computed role cannot be overridden', () => {
    let dir = '';
    const cwd0 = process.cwd();
    afterEach(() => {
        process.chdir(cwd0);
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    function repoWith(content: string): string {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'control-roles-'));
        const git = (...args: string[]) =>
            execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
        git('init', '-q');
        git('config', 'user.email', 't@example.com');
        git('config', 'user.name', 't');
        fs.writeFileSync(path.join(dir, 'filters.blade.php'), content);
        git('add', '.');
        git('commit', '-q', '-m', 'base');
        return dir;
    }

    function applyWith(envelope: Record<string, unknown>) {
        const st = new DeliveryState({ ticket: { trivial_edit: envelope } } as never);
        return { result: run(st), state: st };
    }

    it('a select inserted under new_component:false reclassifies', () => {
        const repo = repoWith(FORM);
        fs.writeFileSync(
            path.join(repo, 'filters.blade.php'),
            FORM.replace('</form>', '  <select name="status"></select>\n</form>'),
        );
        process.chdir(repo);
        const { result, state } = applyWith({
            files: ['filters.blade.php'],
            lines_changed: 1,
            new_component: false,
            new_control_roles: [],
        });
        expect(result.outcome).toBe('blocked');
        expect(result.message).toContain('new_control_role:filters.blade.php:select');
        expect(state.ticket['__reclassify_to__']).toBe('ui-improve');
    });

    it('a label change on an existing select stays trivial', () => {
        const base = FORM.replace('</form>', '  <label>State <x-select name="s" /></label>\n</form>');
        const repo = repoWith(base);
        fs.writeFileSync(path.join(repo, 'filters.blade.php'), base.replace('State', 'Status'));
        process.chdir(repo);
        const { result } = applyWith({ files: ['filters.blade.php'], lines_changed: 1 });
        expect(result.outcome).toBe('success');
    });

    it('a raw select added during a polish round is recorded on its change', () => {
        const repo = repoWith(FORM);
        fs.writeFileSync(
            path.join(repo, 'filters.blade.php'),
            FORM.replace('</form>', '  <select name="status"></select>\n</form>'),
        );
        process.chdir(repo);
        const st = new DeliveryState({
            changes: [{ kind: 'ui', file: 'filters.blade.php', summary: 'polish' }],
            ui_review: { review_clean: true, findings: [] },
        } as never);
        polishRun(st);
        expect(st.changes[0]!['new_control_roles']).toEqual(['select']);
    });

    it('reports an unreadable listed file instead of judging it clean', () => {
        const { perFile, unreadable } = newControlRolesForFiles(['nope.tsx'], os.tmpdir());
        expect(perFile).toEqual([]);
        expect(unreadable).toEqual(['nope.tsx']);
    });
});
