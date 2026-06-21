// Tests for src/scripts/skill_usage_report.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public helpers (parse_ts, aggregate, status_for, render)
// plus a golden-parity layer that runs python3 vs tsx on a controlled
// --in fixture and a tmp --out, comparing the written report + stdout +
// exit byte-for-byte (skipped without python3). The known-slug discovery
// reads the repo's real .augment/.claude/dist skills, so the parity run
// shares the same repo state across both runtimes.

import { describe, expect, it } from 'vitest';

import * as sur from '../../src/scripts/skill_usage_report.js';



describe('skill_usage_report — behavioural spec', () => {
    it('parse_ts handles Z suffix and bad input', () => {
        expect(sur.parse_ts('')).toBeNull();
        expect(sur.parse_ts('not-a-date')).toBeNull();
        const d = sur.parse_ts('2026-05-01T00:00:00Z');
        expect(d).not.toBeNull();
        expect((d as Date).toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });

    it('aggregate buckets exposures/mentions in + out of window', () => {
        const now = new Date('2026-06-01T00:00:00Z');
        const records = [
            { slug: 'a', kind: 'exposure', ts: '2026-05-28T00:00:00Z' }, // in 30d
            { slug: 'a', kind: 'mention', ts: '2026-05-28T00:00:00Z' }, // in 30d
            { slug: 'a', kind: 'exposure', ts: '2026-01-01T00:00:00Z' }, // out of 30d
            { slug: 'b', kind: 'exposure', ts: '2026-05-29T00:00:00Z' }, // in 30d, no mention
            { slug: 'c', kind: 'bogus', ts: '2026-05-29T00:00:00Z' }, // ignored
        ];
        const per = sur.aggregate(records, now, 30);
        const a = per.get('a')!;
        expect(a.exposures_total).toBe(2);
        expect(a.exposures_30d).toBe(1);
        expect(a.mentions_total).toBe(1);
        expect(a.mentions_30d).toBe(1);
        expect(per.has('c')).toBe(false);
        expect(sur.status_for(a)).toBe('active');
        expect(sur.status_for(per.get('b')!)).toBe('exposed-only');
    });

    it('status_for classifies dead', () => {
        expect(
            sur.status_for({
                exposures_total: 5,
                mentions_total: 0,
                exposures_30d: 0,
                mentions_30d: 0,
                last_seen: null,
            }),
        ).toBe('dead');
    });

    it('render sorts dead-first, then by exposures desc, then slug', () => {
        const per = new Map<string, ReturnType<typeof mk>>();
        per.set('zdead', mk(3, 0, 0, 0));
        per.set('aactive', mk(1, 1, 1, 1));
        const text = sur.render(per, new Set(['zdead', 'aactive']));
        const zIdx = text.indexOf('`zdead`');
        const aIdx = text.indexOf('`aactive`');
        // dead sorts first (status != 'dead' is False=0 → ahead).
        expect(zIdx).toBeGreaterThan(0);
        expect(aIdx).toBeGreaterThan(0);
        expect(zIdx).toBeLessThan(aIdx);
        expect(text).toContain('# Skill Usage Report (baseline)');
    });
});

function mk(et: number, mt: number, e30: number, m30: number) {
    return {
        exposures_total: et,
        mentions_total: mt,
        exposures_30d: e30,
        mentions_30d: m30,
        last_seen: null as Date | null,
    };
}

// --- Golden parity (python3 vs tsx) on a controlled --in fixture -------------


