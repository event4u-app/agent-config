// road-to-a-control-that-matches-its-neighbours 3.1/3.2: the two consistency
// findings, each with its positive case and its near-miss.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildArtefact } from '../../src/cli/commands/uiAudit.js';
import type { RoleEntry } from '../../src/scripts/_lib/control_roles.js';
import {
    consistencyFindings,
    main,
    shadowRecord,
    shadowReport,
    shadowRulesOf,
    shadowWindow,
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

// The reverse trigger's reading: what the last two weeks of live rows hold.
describe('shadow window report', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    const row = (at: string, file: string, raw: number) => ({
        at,
        file,
        would_fire: { tolerance_0px: raw },
        raw_control: raw,
        deviations_px: [],
    });

    it('counts writes and firing writes inside the window only', () => {
        const w = shadowWindow(
            [
                row('2026-10-20T00:00:00Z', 'app/old.tsx', 1),
                row('2026-11-01T00:00:00Z', 'app/a.tsx', 0),
                row('2026-11-02T00:00:00Z', 'app/b.tsx', 2),
                row('2026-11-03T00:00:00Z', 'app/b.tsx', 1),
                row('2026-11-09T00:00:00Z', 'app/c.tsx', 0),
            ],
            now,
            14,
        );
        expect(w).toMatchObject({ writes: 4, firing: 2, since: '2026-10-27T12:00:00.000Z' });
        expect(w.files).toEqual([{ file: 'app/b.tsx', firing_writes: 2 }]);
    });

    it('an empty window is reported as empty, never as a 0 % rate', () => {
        expect(shadowWindow([], now, 14)).toMatchObject({ writes: 0, firing: 0, files: [] });
    });

    it('a row it cannot read is skipped, not counted', () => {
        expect(shadowWindow([{ at: 'not a date', file: 'x.tsx', raw_control: 1 } as never], now, 14).writes).toBe(0);
    });

    it('every firing write is listed with what fired, so it can be classified later', () => {
        const r = {
            ...row('2026-11-02T00:00:00Z', 'app/b.tsx', 1),
            head: 'abc123',
            findings: [{ rule: 'consistency-raw-control', line: 3, message: 'raw select', context: '<select name="s">' }],
        };
        const w = shadowWindow([r, { ...r, at: '2026-11-03T00:00:00Z' }], now, 14);
        expect(w.firings).toHaveLength(2);
        expect(w.firings[0]).toEqual({
            at: '2026-11-02T00:00:00Z',
            file: 'app/b.tsx',
            head: 'abc123',
            findings: [{ rule: 'consistency-raw-control', line: 3, message: 'raw select', context: '<select name="s">' }],
        });
    });
});

describe('a shadow row carries what fired', () => {
    it('rule, line, message and the source line of each raw-control finding', () => {
        const roles = { select: { canonical: 'Select', uses: 2, implementations: { Select: 2 }, outliers: [], defined: ['Select'], families: ['jsx'], box_metrics: null } };
        const text = 'export const F = () => (\n  <select name="status"></select>\n);';
        const r = shadowRecord(text, 'app/f.tsx', roles, new Date(0));
        expect(r.findings).toEqual([
            {
                rule: 'consistency-raw-control',
                line: 2,
                message: "raw select — this project's select is Select",
                context: '<select name="status"></select>',
            },
        ]);
    });

    it('two controls on one long line each get the context around their own position', () => {
        const roles = { input: { canonical: 'Input', uses: 2, implementations: { Input: 2 }, outliers: [], defined: ['Input'], families: ['jsx'], box_metrics: null } };
        const gap = `<span>${'y '.repeat(200)}</span>`;
        const r = shadowRecord(`<div><input name="first" />${gap}<input name="second" /></div>`, 'app/f.tsx', roles, new Date(0));
        expect(r.findings).toHaveLength(2);
        expect(r.findings![0]!.context).toContain('name="first"');
        expect(r.findings![1]!.context).toContain('name="second"');
    });

    it('a control deep in a long line stays in the recorded context', () => {
        const roles = { select: { canonical: 'Select', uses: 2, implementations: { Select: 2 }, outliers: [], defined: ['Select'], families: ['jsx'], box_metrics: null } };
        const pad = `<div className="${'x '.repeat(200)}">`;
        const r = shadowRecord(`${pad}<select name="late"></select></div>`, 'app/f.tsx', roles, new Date(0));
        expect(r.findings![0]!.context).toContain('<select name="late">');
        expect(r.findings![0]!.context.length).toBeLessThanOrEqual(200);
    });
});

// The reverse trigger must never read missing or damaged evidence as a clean window.
describe('the shadow report on the file as recorded', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    const good = JSON.stringify({ at: '2026-11-02T00:00:00Z', file: 'app/a.tsx', would_fire: {}, raw_control: 0, deviations_px: [] });
    const at = (text?: string) => {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-report-'));
        const f = path.join(d, 'shadow.jsonl');
        if (text !== undefined) fs.writeFileSync(f, text);
        return f;
    };

    it('a clean file reports its window and exits 0', () => {
        const r = shadowReport(at(`${good}\n${good}\n`), now, 14, false);
        expect(r.code).toBe(0);
        expect(r.out).toContain('2 UI write(s), 0 firing');
    });

    it('a missing file is no evidence, not an empty window', () => {
        const r = shadowReport(at(), now, 14, false);
        expect(r.code).toBe(1);
        expect(r.out).toContain('no shadow file');
        expect(r.out).not.toContain('0 UI write(s)');
    });

    it('a file with no write in the window is no observation, never a clean window', () => {
        const old = JSON.stringify({ at: '2026-09-01T00:00:00Z', file: 'app/a.tsx', would_fire: {}, raw_control: 0, deviations_px: [] });
        for (const text of ['', '  \n\n', `${old}\n`]) {
            const r = shadowReport(at(text), now, 14, false);
            expect(r.code).toBe(1);
            expect(r.out).toContain('no UI write recorded');
            const j = JSON.parse(shadowReport(at(text), now, 14, true).out) as { evidence: string };
            expect(j.evidence).toBe('empty');
        }
    });

    it('an unreadable file is reported, not read as empty', () => {
        const f = at();
        fs.mkdirSync(f);
        const r = shadowReport(f, now, 14, false);
        expect(r.code).toBe(1);
        expect(r.out).toContain('unreadable');
    });

    it('a malformed row is rejected by line, and the valid rows still count', () => {
        const wrongShape = JSON.stringify({ at: '2026-11-03T00:00:00Z' });
        const r = shadowReport(at(`${good}\n{not json\n${wrongShape}\n${good}\n`), now, 14, false);
        expect(r.code).toBe(1);
        expect(r.out).toContain('2 UI write(s), 0 firing');
        expect(r.out).toContain('2 row(s) rejected');
        expect(r.out).toContain('line 2: not JSON');
        expect(r.out).toContain('line 3: `file` is missing');
    });

    it('a row that parses but cannot be read is rejected with its reason, never counted as complete', () => {
        const rows = [
            good,
            JSON.stringify({ at: 'not a date', file: 'app/a.tsx', raw_control: 0 }),
            JSON.stringify({ at: '2026-11-02T00:00:00Z', file: 'app/a.tsx', raw_control: 1 }),
            JSON.stringify({ at: '2026-11-02T00:00:00Z', file: 'app/a.tsx', raw_control: 1, findings: [null] }),
            JSON.stringify({ at: '2026-11-02T00:00:00Z', file: 'app/a.tsx', raw_control: -1 }),
            JSON.stringify({ at: '2026-11-02T00:00:00Z', file: 'app/a.tsx', raw_control: 1, findings: [{ rule: 'made-up', line: 3, message: 'm', context: 'c' }] }),
            JSON.stringify({ at: '2026-11-02T00:00:00Z', file: 'app/a.tsx', raw_control: 1, findings: [{ rule: 'consistency-raw-control', line: 0, message: 'm', context: 'c' }] }),
        ];
        const r = shadowReport(at(`${rows.join('\n')}\n`), now, 14, false);
        expect(r.code).toBe(1);
        expect(r.out).toContain('1 UI write(s), 0 firing');
        expect(r.out).toContain('6 row(s) rejected');
        expect(r.out).toContain('line 2: `at` is not a date');
        expect(r.out).toContain('line 3: a firing row without its findings');
        expect(r.out).toContain('line 4: a finding is malformed');
        expect(r.out).toContain('line 5: `raw_control` is not a count');
    });

    it('--json carries the rejected lines too', () => {
        const r = shadowReport(at(`{bad\n${good}\n`), now, 14, true);
        expect(r.code).toBe(1);
        expect(JSON.parse(r.out)).toMatchObject({ writes: 1, rejected_lines: [1], evidence: 'incomplete' });
    });
});

// The six false-alarm classes a retroactive window over two private consumer
// repositories surfaced (road-to-a-control-that-matches-its-neighbours 3.8).
// Each case is synthetic in the shape of what fired; each class keeps a
// positive control so the fix cannot pass by going quiet.
describe('false alarms from the retroactive shadow window', () => {
    const entry = (canonical: string, families: string[] | undefined = ['jsx']): RoleEntry => ({
        canonical,
        uses: 3,
        implementations: { [canonical]: 3 },
        outliers: [],
        defined: [canonical],
        families,
        box_metrics: null,
    });
    const ROLES = {
        select: entry('Select'),
        input: entry('Input'),
        textarea: entry('Textarea'),
        checkbox: entry('Checkbox'),
        popover: entry('Popover'),
    };
    const rules = (text: string, rel: string, roles: typeof ROLES | Record<string, RoleEntry> = ROLES) =>
        consistencyFindings(text, rel, roles).map((f) => f.rule);

    it('a server template cannot render a JSX component, so it is not measured against one', () => {
        const select = '<select name="year"><option>2026</option></select>';
        expect(rules(select, 'core/Templates/Export.view.php')).toEqual([]);
        expect(rules(`$html .= '<input type="checkbox" name="hide">';`, 'mods/time/list.php')).toEqual([]);
        expect(rules(select, 'public/export.html')).toEqual([]);
        expect(rules(select, 'app/export.tsx')).toEqual(['consistency-raw-control']);
    });

    it('a Blade component canonical binds Blade views only', () => {
        const blade = { select: entry('x-select', ['blade']) };
        const select = '<select name="year"></select>';
        expect(rules(select, 'resources/views/orders/index.blade.php', blade)).toEqual(['consistency-raw-control']);
        expect(rules(select, 'resources/js/orders.tsx', blade)).toEqual([]);
    });

    it('a canonical binds only the file families it is defined or used in', () => {
        const select = '<select name="year"></select>';
        const react = { select: entry('Select', ['jsx']) };
        expect(rules(select, 'app/orders.tsx', react)).toEqual(['consistency-raw-control']);
        expect(rules(select, 'docs/orders.mdx', react)).toEqual(['consistency-raw-control']);
        expect(rules(select, 'legacy/Orders.vue', react)).toEqual([]);
        expect(rules(select, 'widgets/Orders.svelte', react)).toEqual([]);
        expect(rules(select, 'pages/orders.astro', react)).toEqual([]);
        const vue = { select: entry('Select', ['vue']) };
        expect(rules(select, 'legacy/Orders.vue', vue)).toEqual(['consistency-raw-control']);
        expect(rules(select, 'app/orders.tsx', vue)).toEqual([]);
        const astro = { select: entry('Select', ['astro', 'jsx']) };
        expect(rules(select, 'pages/orders.astro', astro)).toEqual(['consistency-raw-control']);
    });

    it('a role map that does not say where its canonical lives is not measured against', () => {
        const { families: _, ...noFamilies } = entry('Select');
        const unknown = { select: noFamilies };
        expect(rules('<select name="year"></select>', 'app/orders.tsx', unknown)).toEqual([]);
        expect(rules('<select name="year"></select>', 'app/orders.tsx', { select: entry('Select', []) })).toEqual([]);
    });

    it('markup inside a comment is prose, not a control', () => {
        const tsx = [
            '/**',
            ' * Sorting shipped as a bare `<select>`, which this file replaces.',
            ' */',
            '// a page-size <select> used to drive this',
            'export function Pager() {',
            '  return <textarea name="note" />;',
            '}',
        ].join('\n');
        const f = consistencyFindings(tsx, 'app/pager.tsx', ROLES);
        expect(f.map((x) => [x.rule, x.line])).toEqual([['consistency-raw-control', 6]]);
    });

    it('a TypeScript type argument is not an element', () => {
        expect(rules('} satisfies Meta<typeof Popover>;', 'stories/Popover.stories.tsx')).toEqual([]);
    });

    it('a file input has no Input primitive to compare with, even after an arrow attribute', () => {
        expect(rules('<input type="file" onChange={(e) => upload(e)} />', 'app/upload.tsx')).toEqual([]);
        const late = '<input className="sr-only" multiple onChange={(event) => { pick(event); }} type="file" />';
        expect(rules(late, 'app/prompt.tsx')).toEqual([]);
        expect(rules('<input onChange={(e) => set(e.target.value)} type="text" />', 'app/login.tsx')).toEqual([
            'consistency-raw-control',
        ]);
    });

    it('a primitive exported through an export list is still the primitive', () => {
        const textarea = 'function Textarea(props) {\n  return <textarea {...props} />;\n}\n\nexport { Textarea };';
        expect(rules(textarea, 'packages/ui/src/components/textarea.tsx')).toEqual([]);
        const native = 'function NativeSelect(props) {\n  return <select {...props} />;\n}\n\nexport { NativeSelect };';
        expect(rules(native, 'packages/ui/src/components/native-select.tsx')).toEqual([]);
    });

    it('a design handover or agent reference is not product UI', () => {
        expect(rules('<textarea value="x"></textarea>', 'apps/web/agents/references/prototype/ToDo.dc.html')).toEqual([]);
        expect(rules('<textarea name="x" />', 'agents/references/prototype/page.tsx')).toEqual([]);
        expect(rules('<textarea name="x" />', 'apps/web/src/agents-panel.tsx')).toEqual(['consistency-raw-control']);
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
