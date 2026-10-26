// road-to-a-control-that-matches-its-neighbours 3.1/3.2: the two consistency
// findings, each with its positive case and its near-miss.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildArtefact } from '../../src/cli/commands/uiAudit.js';
import { consistencyFindings, shadowRecord } from '../../src/scripts/lint_design_consistency.js';

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

const SHADCN = buildArtefact('.', pairsOf('follow-up-select-shadcn')).control_roles;
const NATIVE = buildArtefact('.', pairsOf('follow-up-native-no-primitive')).control_roles;

describe('consistency-raw-control', () => {
    it('fires on a raw select added beside the project Select', () => {
        const filters = pairsOf('follow-up-select-shadcn').find(([r]) => r === 'app/orders/filters.tsx')![1];
        const edited = filters.replace(
            '        </div>',
            '            <select name="status" className="border p-1"><option>Open</option></select>\n        </div>',
        );
        const f = consistencyFindings(edited, 'app/orders/filters.tsx', SHADCN);
        expect(f.map((x) => x.rule)).toContain('consistency-raw-control');
        expect(f.find((x) => x.rule === 'consistency-raw-control')!.message).toContain('Select');
    });

    it('near-miss: a native select in a project without a primitive stays clean', () => {
        const html = pairsOf('follow-up-native-no-primitive').find(([r]) => r === 'callback.html')![1];
        const edited = html.replace(
            '        <button',
            '        <label class="label">Time<select class="field" name="t"></select></label>\n        <button',
        );
        expect(consistencyFindings(edited, 'callback.html', NATIVE)).toEqual([]);
    });

    it('the primitive file itself is never a finding', () => {
        const [rel, text] = pairsOf('follow-up-select-shadcn').find(([r]) => r === 'components/ui/input.tsx')!;
        expect(consistencyFindings(text, rel, SHADCN)).toEqual([]);
    });
});

describe('consistency-sibling-metrics', () => {
    it('fires on an input whose padding and height differ from the project Input', () => {
        const f = consistencyFindings('<Input className="h-11 px-5 rounded-md" />', 'app/x.tsx', SHADCN);
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ rule: 'consistency-sibling-metrics', deviation_px: 8 });
    });

    it('near-miss: a deliberately dense operate table is judged against its own rows', () => {
        const table = [
            '<table className="w-full text-sm">',
            '  <tr><td><Input className="h-8 px-2 rounded-md" /></td></tr>',
            '  <tr><td><Input className="h-8 px-2 rounded-md" /></td></tr>',
            '  <tr><td><Input className="h-8 px-2 rounded-md" /></td></tr>',
            '</table>',
        ].join('\n');
        expect(consistencyFindings(table, 'app/orders/table.tsx', SHADCN)).toEqual([]);
    });

    it('tolerance absorbs a deviation inside it and not one outside it', () => {
        const input = '<Input className="h-10 px-3 rounded-md" />';
        expect(consistencyFindings(input, 'app/x.tsx', SHADCN, 4)).toEqual([]);
        expect(consistencyFindings(input, 'app/x.tsx', SHADCN, 2)).toHaveLength(1);
    });

    it('the shadow row counts would_fire at every candidate tolerance', () => {
        const row = shadowRecord('<Input className="h-10 px-3 rounded-md" />', 'app/x.tsx', SHADCN, new Date(0));
        expect(row.would_fire).toEqual({ tolerance_0px: 1, tolerance_2px: 1, tolerance_4px: 0 });
        expect(row.deviations_px).toEqual([4]);
        expect(row.raw_control).toBe(0);
    });

    it('no box metrics on either side → no finding, never a guessed one', () => {
        expect(consistencyFindings('<input name="q">', 'callback.html', NATIVE)).toEqual([]);
    });
});
