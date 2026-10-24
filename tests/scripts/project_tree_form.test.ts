import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveLeanProjection } from '../../src/scripts/_lib/lean_projection_mode.js';
import {
    KILL_SWITCH_ENV,
    PROJECT_TREE_FORM_REL,
    projectTreeForm,
    readProjectTreeForms,
    shippedProjection,
} from '../../src/scripts/_lib/project_tree_form.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const temps: string[] = [];
afterEach(() => {
    for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function rootWith(record: unknown): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-tree-form-'));
    temps.push(root);
    fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
    if (record !== undefined) {
        fs.writeFileSync(path.join(root, PROJECT_TREE_FORM_REL), JSON.stringify(record));
    }
    return root;
}

describe('the shipped project-tree form', () => {
    it('carries claude-code at delivery with ADR-267 as its basis', () => {
        const forms = readProjectTreeForms(REPO);
        expect(forms.get('claude-code')?.form).toBe('delivery');
        expect(forms.get('claude-code')?.basis).toBe('ADR-267');
    });

    it('refuses a row with no measured block rather than reading it as a default', () => {
        // The record is a claim that THIS host's delivery was measured. A row
        // without the measurement is a claim nobody made, and reading it would
        // make the file a settings key after all — a place to write a form.
        const root = rootWith({ schema_version: 1, hosts: { cursor: { form: 'delivery', basis: 'ADR-267' } } });
        expect(readProjectTreeForms(root).has('cursor')).toBe(false);
    });

    it('refuses an empty or figure-less measured block as no measurement', () => {
        for (const measured of [{}, { deliveries_byte_equal: '' }, { deliveries_byte_equal: 616 }]) {
            const root = rootWith({ schema_version: 1, hosts: { cursor: { form: 'delivery', basis: 'x', measured } } });
            expect(readProjectTreeForms(root).has('cursor')).toBe(false);
        }
    });

    it('refuses a row whose form is not a form the projector has', () => {
        const root = rootWith({ schema_version: 1, hosts: { cline: { form: 'turbo', basis: 'x', measured: {} } } });
        expect(readProjectTreeForms(root).has('cline')).toBe(false);
    });

    it('is empty, never a throw, when the record is absent or malformed', () => {
        expect(readProjectTreeForms(rootWith(undefined)).size).toBe(0);
        const bad = rootWith(undefined);
        fs.writeFileSync(path.join(bad, PROJECT_TREE_FORM_REL), '{not json');
        expect(readProjectTreeForms(bad).size).toBe(0);
    });
});

describe('precedence — only an observed PROJECT-TREE verdict supersedes the record', () => {
    const NO_ENV = {};
    const tree = (form: 'full' | 'thinned', reason: string) => ({ form, reason, scope: 'project-tree' });

    it('uses the record while the verdict can only say delivery-unobserved', () => {
        expect(projectTreeForm(REPO, 'claude-code', tree('full', 'delivery-unobserved'), NO_ENV)).toBe('delivery');
    });

    it('uses the record when there is no verdict at all', () => {
        expect(projectTreeForm(REPO, 'claude-code', null, NO_ENV)).toBe('delivery');
    });

    it('yields to an observed project-tree verdict, in both directions', () => {
        // The direction that matters: an observed `full` must WIN over a record
        // saying `delivery`, or the record is a bypass rather than a stand-in.
        expect(projectTreeForm(REPO, 'claude-code', tree('full', 'demoted'), NO_ENV)).toBe('eager-all');
        expect(projectTreeForm(REPO, 'claude-code', tree('thinned', 'all-conditions-hold'), NO_ENV)).toBe('delivery');
    });

    it('refuses the installed layer verdict whatever its reason', () => {
        // Council 2026-10-24: provenance is structural. The decision function's
        // verdict describes ~/.claude/rules and carries no project-tree scope.
        for (const scope of [undefined, 'installed-layer']) {
            const v = { form: 'full' as const, reason: 'demoted', ...(scope ? { scope } : {}) };
            expect(projectTreeForm(REPO, 'claude-code', v, NO_ENV)).toBe('delivery');
        }
    });

    it('the kill switch forces the full form over the record and over any verdict', () => {
        const off = { [KILL_SWITCH_ENV]: 'full' };
        expect(projectTreeForm(REPO, 'claude-code', null, off)).toBe('eager-all');
        expect(projectTreeForm(REPO, 'claude-code', tree('thinned', 'all-conditions-hold'), off)).toBe('eager-all');
        expect(projectTreeForm(REPO, 'claude-code', null, { [KILL_SWITCH_ENV]: 'delivery' })).toBe('delivery');
    });

    it('gives a host with no row the full form', () => {
        expect(projectTreeForm(REPO, 'windsurf', null, NO_ENV)).toBe('eager-all');
        expect(projectTreeForm(REPO, 'cursor', tree('thinned', 'all-conditions-hold'), NO_ENV)).toBe('eager-all');
    });
});

describe('the live path runs the precedence rule', () => {
    it('resolveLeanProjection reads the record through it: delivery on claude-code today', () => {
        expect(resolveLeanProjection({ packageRoot: REPO })).toMatchObject({ mode: 'delivery', modeExplicit: false });
        expect(resolveLeanProjection({ packageRoot: REPO }).hosts.hosts).toEqual(['claude-code']);
    });

    it('an observed project-tree full verdict turns the projection full', () => {
        const full = shippedProjection(REPO, () => ({ form: 'full', reason: 'demoted', scope: 'project-tree' }), {});
        expect(full).toEqual({ mode: 'eager-all', hosts: [] });
    });

    it('an installed-layer verdict leaves the projection unchanged', () => {
        const same = shippedProjection(REPO, () => ({ form: 'full', reason: 'demoted' }), {});
        expect(same).toEqual({ mode: 'delivery', hosts: ['claude-code'] });
    });

    it('the kill switch turns the projection full', () => {
        expect(shippedProjection(REPO, undefined, { [KILL_SWITCH_ENV]: 'full' })).toEqual({ mode: 'eager-all', hosts: [] });
    });
});
