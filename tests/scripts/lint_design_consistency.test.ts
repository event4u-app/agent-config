// road-to-a-control-that-matches-its-neighbours 3.1/3.2: the two consistency
// findings, each with its positive case and its near-miss.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildArtefact } from '../../src/cli/commands/uiAudit.js';
import * as os from 'node:os';

import {
    consistencyFindings,
    main,
    shadowRecord,
    shadowRulesOf,
    siblingGapFindings,
    siblingGapShadowRecord,
} from '../../src/scripts/lint_design_consistency.js';

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

// road-to-design-inputs-and-pages-read-as-they-are 4.4: uneven gaps between
// same-signature siblings, read off render rows. Shadow only.
describe('consistency-sibling-gap', () => {
    type Row = Record<string, string>;
    const parentRow = (extra: Row = {}): Row => ({ selector: 'main', class: 'list', index: '0', parents: '', visible: '1', rect: '0,0,600,2000', position: 'static', display: 'flex', 'flex-direction': 'column', gap: 'normal', 'row-gap': 'normal', 'column-gap': 'normal', ...extra });
    /** Vertical stack: one child per height, separated by the given gaps. */
    function stack(gaps: number[], opts: { tag?: string; cls?: string; height?: number; margins?: number[] } = {}): Row[] {
        const rows: Row[] = [parentRow()];
        let y = 0;
        for (let i = 0; i <= gaps.length; i++) {
            const h = opts.height ?? 100;
            rows.push({
                selector: opts.tag ?? 'div', class: opts.cls ?? 'card', index: String(i + 1), parents: '0', visible: '1',
                rect: `0,${y},600,${h}`, position: 'static',
                'margin-top': `${opts.margins?.[i] ?? 0}px`, 'margin-bottom': '0px', 'margin-left': '0px', 'margin-right': '0px',
            });
            y += h + (gaps[i] ?? 0);
        }
        return rows;
    }

    it('fires on 24/24/31/24/18 at intended 24, naming each deviating pair and the margin cause', () => {
        const rows = stack([24, 24, 31, 24, 18], { margins: [0, 0, 0, 7, 0, 0] });
        const f = siblingGapFindings(rows);
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ rule: 'consistency-sibling-gap', axis: 'vertical', intended_gap_px: 24, spread_px: 13 });
        expect(f[0]!.deviating.map((d) => [d.between, d.gap_px])).toEqual([
            [[3, 4], 31],
            [[5, 6], 18],
        ]);
        expect(f[0]!.deviating[0]!.cause).toBe('child-margin');
        expect(f[0]!.deviating[1]!.cause).toBe('other');
    });

    it('a tie between gap values names no intended gap', () => {
        const f = siblingGapFindings(stack([24, 31, 18]));
        expect(f).toHaveLength(1);
        expect(f[0]!.intended_gap_px).toBeNull();
    });

    it('near-miss: a bento grid with equal gaps stays clean', () => {
        const rows: Row[] = [parentRow({ display: 'grid' })];
        let i = 1;
        for (const y of [0, 216]) for (const x of [0, 216, 432]) rows.push({ selector: 'div', class: 'tile', index: String(i++), parents: '0', visible: '1', rect: `${x},${y},200,200`, position: 'static' });
        expect(siblingGapFindings(rows)).toEqual([]);
    });

    it('near-miss: heading → paragraph → section is not one signature', () => {
        const rows: Row[] = [parentRow(),
            { selector: 'h2', class: '', index: '1', parents: '0', visible: '1', rect: '0,0,600,40', position: 'static' },
            { selector: 'p', class: '', index: '2', parents: '0', visible: '1', rect: '0,48,600,60', position: 'static' },
            { selector: 'section', class: '', index: '3', parents: '0', visible: '1', rect: '0,160,600,300', position: 'static' }];
        expect(siblingGapFindings(rows)).toEqual([]);
    });

    it('near-miss: a short last wrapped row is not one axis', () => {
        const rows: Row[] = [parentRow({ 'flex-direction': 'row' })];
        let i = 1;
        for (const x of [0, 216, 432]) rows.push({ selector: 'div', class: 'card', index: String(i++), parents: '0', visible: '1', rect: `${x},0,200,200`, position: 'static' });
        rows.push({ selector: 'div', class: 'card', index: String(i++), parents: '0', visible: '1', rect: '0,230,200,200', position: 'static' });
        expect(siblingGapFindings(rows)).toEqual([]);
    });

    it('near-miss: a space-between nav whose items differ in width stays clean', () => {
        const rows: Row[] = [parentRow({ 'flex-direction': 'row' })];
        // Items 60/120/90/40 wide in 600px, space-between: three gaps of 96.67 → rounded rects.
        const widths = [60, 120, 90, 40];
        const free = (600 - widths.reduce((a, b) => a + b, 0)) / 3;
        let x = 0;
        widths.forEach((w, k) => {
            rows.push({ selector: 'a', class: 'nav-link', index: String(k + 1), parents: '0', visible: '1', rect: `${Math.round(x)},0,${w},24`, position: 'static' });
            x += w + free;
        });
        expect(siblingGapFindings(rows)).toEqual([]);
    });

    it('hidden and out-of-flow siblings are not counted', () => {
        const rows = stack([24, 24, 24, 24]);
        rows.push({ selector: 'div', class: 'card', index: '9', parents: '0', visible: '0', rect: '0,900,600,0', position: 'static' });
        rows.push({ selector: 'div', class: 'card', index: '10', parents: '0', visible: '1', rect: '0,620,600,100', position: 'absolute' });
        expect(siblingGapFindings(rows)).toEqual([]);
    });

    it('a truncated capture marks the finding partial', () => {
        const f = siblingGapFindings(stack([24, 24, 31, 24]), { partial: '1500/1820' });
        expect(f[0]!.partial).toBe('1500/1820');
    });

    it('the shadow row carries the rule and never reaches the exit code', () => {
        const rows = stack([24, 24, 31, 24, 18]);
        const row = siblingGapShadowRecord(rows, 'desktop.styles.json', {}, new Date(0));
        expect(row.rule).toBe('consistency-sibling-gap');
        expect(row.would_fire).toEqual({ tolerance_0px: 1, tolerance_2px: 1, tolerance_4px: 1 });
        expect(shadowRulesOf(row)).toEqual(['consistency-sibling-gap']);
        const old = shadowRecord('<Input className="h-10 px-3 rounded-md" />', 'app/x.tsx', SHADCN, new Date(0));
        delete (old as { rule?: unknown }).rule;
        expect(shadowRulesOf(old)).toEqual(['consistency-raw-control', 'consistency-sibling-metrics']);

        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sibling-gap-'));
        const file = path.join(dir, 'desktop.styles.json');
        fs.writeFileSync(file, JSON.stringify(rows));
        const cwd = process.cwd();
        try {
            process.chdir(dir);
            expect(main(['--render', file, '--json'])).toBe(0);
            expect(main(['--render', file, '--shadow'])).toBe(0);
            const shadow = fs.readFileSync(path.join(dir, 'agents', 'runtime', 'state', 'design-consistency-shadow.jsonl'), 'utf8');
            expect(JSON.parse(shadow.trim()).rule).toBe('consistency-sibling-gap');
        } finally {
            process.chdir(cwd);
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
