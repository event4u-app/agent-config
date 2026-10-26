// road-to-a-control-that-matches-its-neighbours 2.1-2.3: the role map, the box
// metrics and the staleness stamp of the ui:audit artefact.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    ARTEFACT_REL,
    buildArtefact,
    computeUiAudit,
    isUiAuditStale,
    lookupControlRoles,
} from '../../src/cli/commands/uiAudit.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CASES = path.join(REPO, 'tests', 'eval', 'frontend-corpus', 'cases');

function pairsOf(caseId: string): Array<[string, string]> {
    const root = path.join(CASES, caseId);
    const out: Array<[string, string]> = [];
    const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else out.push([path.relative(root, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8')]);
        }
    };
    walk(root);
    return out;
}

describe('control_roles — which implementation IS the control', () => {
    it('shadcn: the project Select is canonical for select, Input for input, with box metrics', () => {
        const a = buildArtefact('.', pairsOf('follow-up-select-shadcn'));
        expect(a.control_roles.select).toMatchObject({ canonical: 'Select', uses: 0, defined: ['Select'] });
        expect(a.control_roles.input).toMatchObject({ canonical: 'Input', uses: 2, outliers: [] });
        expect(a.control_roles.input!.box_metrics).toMatchObject({
            height_px: 36,
            padding_x_px: 12,
            radius_px: 6,
            font_size_px: 14,
            source: 'static',
        });
        expect(a.control_roles.select!.box_metrics).toMatchObject({ height_px: 36, padding_x_px: 12 });
    });

    it('a raw select beside two uses of the project select is an outlier', () => {
        const pairs = pairsOf('follow-up-select-shadcn');
        pairs.push([
            'app/orders/status.tsx',
            'export function S() { return (<><Select value="a" /><Select value="b" /><select name="raw" /></>); }',
        ]);
        const a = buildArtefact('.', pairs);
        expect(a.control_roles.select!.canonical).toBe('Select');
        expect(a.control_roles.select!.outliers).toEqual(['app/orders/status.tsx:1']);
    });

    it('blade: x-select is canonical; the native select inside its own definition is not a use', () => {
        const a = buildArtefact('.', pairsOf('follow-up-select-blade'));
        expect(a.control_roles.select).toMatchObject({ canonical: 'x-select', uses: 0, outliers: [] });
        expect(a.control_roles.input).toMatchObject({ canonical: 'x-input', uses: 2 });
        expect(a.control_roles.input!.box_metrics).toMatchObject({ height_px: 36, padding_x_px: 12 });
    });

    it('native HTML without Tailwind: box metrics are null with a reason, never 0', () => {
        const a = buildArtefact('.', pairsOf('follow-up-native-no-primitive'));
        expect(a.control_roles.input!.canonical).toBe('native:input');
        expect(a.control_roles.input!.box_metrics).toBeNull();
        expect(a.control_roles.input!.box_metrics_reason).toBeTruthy();
        expect(a.control_roles.select).toBeUndefined();
    });

    it('two equally used implementations with no system marker is a tie → canonical null', () => {
        const a = buildArtefact('.', [
            ['src/a.tsx', 'export const A = () => <><x-picker-select /><Combo /></>;'],
            ['src/b.vue', '<template><v-select /><n-select /></template>'],
        ]);
        expect(a.control_roles.select!.canonical).toBeNull();
        expect(a.control_roles.select!.tie!.length).toBeGreaterThan(1);
    });
});

describe('stamp — the artefact knows what it was computed from', () => {
    let dir = '';
    afterEach(() => {
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    it('an edit after the audit makes it stale, and the lookup recomputes', () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-audit-stamp-'));
        const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
        git('init', '-q');
        git('config', 'user.email', 't@example.com');
        git('config', 'user.name', 't');
        fs.mkdirSync(path.join(dir, 'components'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'components', 'form.tsx'), 'export const F = () => <x-input name="a" class="h-9" />;');
        git('add', '.');
        git('commit', '-q', '-m', 'base');

        const first = computeUiAudit(dir, dir);
        expect(first.stamp.head).toMatch(/^[0-9a-f]{40}$/);
        fs.mkdirSync(path.join(dir, path.dirname(ARTEFACT_REL)), { recursive: true });
        fs.writeFileSync(path.join(dir, ARTEFACT_REL), JSON.stringify(first));
        expect(isUiAuditStale(dir, first)).toBe(false);
        expect(lookupControlRoles(dir).select).toBeUndefined();

        fs.writeFileSync(
            path.join(dir, 'components', 'form.tsx'),
            'export const F = () => <><x-input name="a" class="h-9" /><x-select name="s" /></>;',
        );
        expect(isUiAuditStale(dir, first)).toBe(true);
        expect(lookupControlRoles(dir).select).toMatchObject({ canonical: 'x-select', uses: 1 });
    });

    it('an artefact without a stamp is stale', () => {
        expect(isUiAuditStale(os.tmpdir(), {})).toBe(true);
    });
});
