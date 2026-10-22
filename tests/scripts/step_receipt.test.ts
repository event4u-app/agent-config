import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isStructurallySafe, lowersSoFar, parseReceipt, rolledBackClasses, sampledForAudit, type AuditSample } from '../../src/scripts/_lib/depth_flip.js';
import { loadAuditSamples, loadDepthTable, receiptFor, wouldSkip, type DepthTable } from '../../src/scripts/step_receipt.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const table = loadDepthTable();

describe('step_receipt', () => {
    it('the depth table is in shadow mode and names a row for every class', () => {
        expect(table.mode).toBe('shadow');
        for (const k of ['R0', 'R1', 'R2', 'R3'] as const) {
            expect(Object.keys(table.classes[k]).sort()).toEqual(Object.keys(table.full).sort());
        }
    });

    it('lists what a lowered class would skip, and nothing for R3', () => {
        expect(wouldSkip('R0', table)).toEqual(['council', 'evidence', 'retro', 'revalidation', 'review']);
        expect(wouldSkip('R2', table)).toEqual(['revalidation']);
        expect(wouldSkip('R3', table)).toEqual([]);
    });

    it('classifies from paths, and a raise only ever raises', () => {
        const docs = ['docs/x.md'];
        expect(receiptFor(docs, null, table).cls).toBe('R0');
        expect(receiptFor(docs, 'R2', table).cls).toBe('R2');
        expect(receiptFor(['src/scripts/hooks/x.ts'], 'R0', table).cls).toBe('R3');
    });

    it('renders one marker line naming class, binding reason and would-skip', () => {
        const line = receiptFor(['docs/x.md'], null, table).line;
        expect(line).toMatch(/^<!-- receipt: class=R0 · shadow · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->$/);
    });
});

describe('depth flip — option (d): structurally safe paths, then the audit', () => {
    const active: DepthTable = { ...table, mode: 'active' };
    const sample = (cls: 'R0' | 'R1', i: number, escaped = false, critical = false): AuditSample => ({
        step: `road-x.md#${String(i)}`,
        cls,
        escaped,
        critical,
        date: `2026-11-${String(10 + (i % 18)).padStart(2, '0')}T${String(i).padStart(2, '0')}`,
    });

    it('the real table stays shadow until a committed reading names itself in flip.reading', () => {
        expect(table.flip.scope).toBe('structurally-safe-paths');
        expect(table.flip.classes).toEqual(['R0', 'R1']);
        expect(table.flip.requires).toEqual({ min_steps: 30, max_escaped: 1, max_critical: 0 });
        if (table.mode === 'active') {
            expect(table.flip.reading).not.toBeNull();
            expect(fs.existsSync(path.join(ROOT, table.flip.reading!))).toBe(true);
        } else {
            expect(table.flip.reading).toBeNull();
        }
    });

    it('safe means roadmap, evidence and docs prose, README, and test fixtures — never a rule, skill or contract', () => {
        for (const p of [
            'agents/roadmaps/road-x.md',
            'agents/evidence/analysis/x.md',
            'docs/guides/x.md',
            'README.md',
            'tests/fixtures/x.json',
            'tests/scripts/fixtures/y.ts',
        ]) {
            expect(isStructurallySafe([p]), p).toBe(true);
        }
        for (const p of [
            'src/rules/x.md',
            'src/skills/x/SKILL.md',
            'docs/contracts/x.md',
            'docs/decisions/ADR-1-x.md',
            'docs/guidelines/php/x.md',
            'agents/evidence/owner-directives/2026-10-21-x.md',
            'agents/evidence/ratifications/x.md',
            'tests/scripts/x.test.ts',
            'agents/roadmaps/x.json',
        ]) {
            expect(isStructurallySafe([p]), p).toBe(false);
        }
        expect(isStructurallySafe([])).toBe(false);
        expect(isStructurallySafe(['agents/roadmaps/road-x.md', 'src/rules/x.md'])).toBe(false);
    });

    it('an active table lowers only safe R0/R1 steps', () => {
        expect(receiptFor(['agents/roadmaps/road-x.md'], null, active).mode).toBe('active');
        expect(receiptFor(['tests/fixtures/x.json'], null, active).mode).toBe('active');
        expect(receiptFor(['src/rules/x.md'], null, active).mode).toBe('shadow');
        expect(receiptFor(['tests/scripts/x.test.ts'], null, active).mode).toBe('shadow');
        expect(receiptFor(['agents/roadmaps/road-x.md'], 'R2', active).mode).toBe('shadow');
        expect(receiptFor(['agents/roadmaps/road-x.md'], null, table).mode).toBe('shadow');
    });

    it('a planted escape past the threshold rolls the class back to full depth', () => {
        const clean = Array.from({ length: 30 }, (_, i) => sample('R0', i));
        expect(rolledBackClasses(clean, table.flip.requires)).toEqual([]);
        const oneEscape = clean.map((s, i) => (i === 3 ? { ...s, escaped: true } : s));
        expect(rolledBackClasses(oneEscape, table.flip.requires)).toEqual([]);
        const twoEscapes = clean.map((s, i) => (i === 3 || i === 9 ? { ...s, escaped: true } : s));
        expect(rolledBackClasses(twoEscapes, table.flip.requires)).toEqual(['R0']);
        const oneCritical = clean.map((s, i) => (i === 3 ? { ...s, escaped: true, critical: true } : s));
        expect(rolledBackClasses(oneCritical, table.flip.requires)).toEqual(['R0']);
        expect(receiptFor(['agents/roadmaps/road-x.md'], null, active, twoEscapes).mode).toBe('shadow');
        expect(receiptFor(['tests/fixtures/x.json'], null, active, twoEscapes).mode).toBe('active');
    });

    it('a breach among fewer samples than the floor rolls the class back at once; clean ones do not', () => {
        const fewClean = Array.from({ length: 5 }, (_, i) => sample('R1', i));
        expect(rolledBackClasses(fewClean, table.flip.requires)).toEqual([]);
        expect(rolledBackClasses([sample('R1', 0, true, true)], table.flip.requires)).toEqual(['R1']);
        expect(rolledBackClasses([sample('R1', 0, true), sample('R1', 1, true)], table.flip.requires)).toEqual(['R1']);
        expect(rolledBackClasses([sample('R1', 0, true)], table.flip.requires)).toEqual([]);
    });

    it('the receipt says when a step sits in the flip scope, and parseReceipt reads it back', () => {
        const safe = receiptFor(['agents/roadmaps/road-x.md'], null, table).line;
        expect(safe).toContain('· shadow · scope=safe · would-skip=');
        expect(parseReceipt(safe)).toEqual({ cls: 'R0', mode: 'shadow', safe: true });
        const rule = receiptFor(['src/rules/x.md'], null, table).line;
        expect(rule).not.toContain('scope=safe');
        expect(parseReceipt(rule)).toEqual({ cls: 'R0', mode: 'shadow', safe: false });
        expect(parseReceipt('no receipt here')).toBeNull();
    });

    it('lowersSoFar counts ticked active receipts of the class only', () => {
        const text = [
            '- [x] **1.1 a** <!-- receipt: class=R0 · active · scope=safe · would-skip=review · bound=x -->',
            '- [x] **1.2 b** <!-- receipt: class=R0 · shadow · scope=safe · would-skip=review · bound=x -->',
            '- [x] **1.3 c** <!-- receipt: class=R1 · active · scope=safe · would-skip=review · bound=x -->',
            '- [ ] **1.4 d** <!-- receipt: class=R0 · active · scope=safe · would-skip=review · bound=x -->',
        ].join('\n');
        expect(lowersSoFar([text], 'R0')).toBe(1);
        expect(lowersSoFar([text], 'R1')).toBe(1);
    });

    it('sampling is seeded and lands near 1 in 4, then near 1 in 10', () => {
        const keys = Array.from({ length: 4000 }, (_, i) => `road-x.md#${String(i)}`);
        const early = keys.filter((k) => sampledForAudit(k, 0, table.flip.requires)).length / keys.length;
        const late = keys.filter((k) => sampledForAudit(k, 30, table.flip.requires)).length / keys.length;
        expect(early).toBeGreaterThan(0.2);
        expect(early).toBeLessThan(0.3);
        expect(late).toBeGreaterThan(0.07);
        expect(late).toBeLessThan(0.13);
        expect(keys.map((k) => sampledForAudit(k, 0, table.flip.requires))).toEqual(
            keys.map((k) => sampledForAudit(k, 0, table.flip.requires)),
        );
    });

    it('the committed audit ledger parses and every sample is well-formed', () => {
        // Not pinned empty: the flip needs recorded samples, so a test that
        // only stays green while the ledger holds no evidence would forbid the
        // thing it gates. Each recorded sample must carry the fields the flip reads.
        const samples = loadAuditSamples();
        expect(Array.isArray(samples)).toBe(true);
        for (const s of samples) {
            expect(s, JSON.stringify(s)).toMatchObject({
                step: expect.any(String) as unknown,
                cls: expect.stringMatching(/^R[0-3]$/u) as unknown,
                escaped: expect.any(Boolean) as unknown,
                critical: expect.any(Boolean) as unknown,
                date: expect.any(String) as unknown,
            });
        }
    });
});
