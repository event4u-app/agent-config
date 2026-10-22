import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    PROJECT_TREE_FORM_REL,
    projectTreeForm,
    readProjectTreeForms,
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

describe('precedence — an observed verdict supersedes the record', () => {
    it('uses the record while the decision function can only say delivery-unobserved', () => {
        expect(projectTreeForm(REPO, 'claude-code', { form: 'full', reason: 'delivery-unobserved' })).toBe('delivery');
    });

    it('uses the record when there is no verdict at all', () => {
        expect(projectTreeForm(REPO, 'claude-code', null)).toBe('delivery');
    });

    it('yields to an observed verdict, in both directions', () => {
        // The direction that matters: an observed verdict of `full` must WIN
        // over a record saying `delivery`, or the record is a bypass of 3.1
        // rather than a stand-in for it.
        expect(projectTreeForm(REPO, 'claude-code', { form: 'full', reason: 'demoted' })).toBe('eager-all');
        expect(projectTreeForm(REPO, 'claude-code', { form: 'thinned', reason: 'all-conditions-hold' })).toBe('delivery');
    });

    it('gives a host with no row the full form', () => {
        expect(projectTreeForm(REPO, 'windsurf', null)).toBe('eager-all');
        expect(projectTreeForm(REPO, 'cursor', null)).toBe('eager-all');
    });
});
