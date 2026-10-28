import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// The proof shape every page of the map-views handover closes with
// (road-to-map-views-from-the-handover, step 0.1). A page's matrix becomes
// mandatory the moment every step of its phase is ticked; before that it is
// checked whenever it exists, so a half-written matrix cannot sit in the tree.

const ROOT = path.resolve(__dirname, '../..');
const ROADMAP = path.join(ROOT, 'agents/roadmaps/road-to-map-views-from-the-handover.md');
const REVIEWS = path.join(ROOT, 'agents/evidence/reviews');

export const MATRIX_SECTIONS = [
    'Landmarks',
    'Computed styles (dark)',
    'Computed styles (light)',
    'Overflow 1440/375/320',
    'Behaviour',
    'Not implemented',
] as const;

/** Page id → the roadmap phase whose closing makes its matrix mandatory. */
const PAGE_PHASE: ReadonlyArray<readonly [string, number]> = [
    ['tokens', 0],
    ['shell', 1],
    ['overview', 2],
    ['systems', 3],
    ['code', 4],
    ['data', 4],
    ['interfaces', 4],
    ['runtime', 4],
    ['delivery', 4],
    ['impact', 4],
    ['agent', 4],
    ['projects', 5],
    ['knowledge', 6],
    ['bugs', 7],
];
const SMALL_DELTAS = new Set(['code', 'data', 'interfaces', 'runtime', 'delivery', 'impact', 'agent']);

/** True when the phase has steps and every one of them is ticked. */
export function phaseClosed(roadmap: string, phase: number): boolean {
    const start = roadmap.search(new RegExp(`^## Phase ${phase} — `, 'm'));
    if (start < 0) return false;
    const rest = roadmap.slice(start + 1);
    const end = rest.search(/^## /m);
    const body = end < 0 ? rest : rest.slice(0, end);
    const steps = [...body.matchAll(/^- \[(.)\] \*\*\d+\.\d+ /gm)].map((m) => m[1]);
    return steps.length > 0 && steps.every((s) => s === 'x');
}

/** The sections a matrix lacks, or carries without a single table row. */
export function matrixProblems(text: string): string[] {
    const problems: string[] = [];
    for (const name of MATRIX_SECTIONS) {
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const at = text.search(new RegExp(`^## ${esc}\\s*$`, 'm'));
        if (at < 0) {
            problems.push(`missing section: ${name}`);
            continue;
        }
        const after = text.slice(at).split('\n').slice(1);
        const next = after.findIndex((l) => l.startsWith('## '));
        const body = next < 0 ? after : after.slice(0, next);
        const rows = body.filter((l) => /^\|/.test(l) && !/^\|[\s|:-]+\|$/.test(l));
        // The header row plus at least one data row.
        if (rows.length < 2) problems.push(`section without a row: ${name}`);
        if (rows.some((r) => /\|\s*\|/.test(r))) problems.push(`empty cell in: ${name}`);
    }
    return problems;
}

const roadmap = fs.readFileSync(ROADMAP, 'utf-8');

describe('the matrix checker', () => {
    const whole = MATRIX_SECTIONS.map((s) => `## ${s}\n\n| a | b |\n|---|---|\n| 1 | 2 |\n`).join('\n');
    it('passes a matrix with every section and a row in each', () => {
        expect(matrixProblems(whole)).toEqual([]);
    });
    it('fails a matrix missing one section (sensitivity)', () => {
        for (const s of MATRIX_SECTIONS) {
            const cut = whole.replace(`## ${s}\n`, '## Something else\n');
            expect(matrixProblems(cut)).toContain(`missing section: ${s}`);
        }
    });
    it('fails a section with only a header row, and a row with an empty cell', () => {
        expect(matrixProblems(whole.replace('| 1 | 2 |\n', ''))).toContain('section without a row: Landmarks');
        expect(matrixProblems(whole.replace('| 1 | 2 |', '| 1 |  |'))).toContain('empty cell in: Landmarks');
    });
    it('reads phase closure from the checkboxes', () => {
        expect(phaseClosed('## Phase 9 — X\n\n- [x] **9.1 A.**\n- [x] **9.2 B.**\n\n## Next\n', 9)).toBe(true);
        expect(phaseClosed('## Phase 9 — X\n\n- [x] **9.1 A.**\n- [ ] **9.2 B.**\n', 9)).toBe(false);
        expect(phaseClosed('## Phase 8 — X\n', 9)).toBe(false);
    });
});

describe('the page matrices', () => {
    for (const [page, phase] of PAGE_PHASE) {
        const file = path.join(REVIEWS, `map-${page}-fidelity.md`);
        const present = fs.existsSync(file);
        const required = phaseClosed(roadmap, phase);
        const name = `${SMALL_DELTAS.has(page) ? 'small deltas: ' : ''}${page} matrix`;
        it.skipIf(!present && !required)(name, () => {
            expect(present, `${path.relative(ROOT, file)} is required: phase ${phase} is closed`).toBe(true);
            expect(matrixProblems(fs.readFileSync(file, 'utf-8'))).toEqual([]);
        });
    }
});
