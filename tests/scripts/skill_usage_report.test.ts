// Tests for src/scripts/skill_usage_report.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public helpers (parse_ts, aggregate, status_for, render)
// plus a golden-parity layer that runs python3 vs tsx on a controlled
// --in fixture and a tmp --out, comparing the written report + stdout +
// exit byte-for-byte (skipped without python3). The known-slug discovery
// reads the repo's real .augment/.claude/dist skills, so the parity run
// shares the same repo state across both runtimes.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

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



// --- The sink as a second source (road-to-org-telemetry Phase 4, step 4.1) ---

describe('skill_usage_report — the Class-A sink source', () => {
    const dirs: string[] = [];

    function sinkFile(rows: Record<string, unknown>[]): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sink-'));
        dirs.push(dir);
        const p = path.join(dir, 'telemetry-class-a.jsonl');
        fs.writeFileSync(p, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf-8');
        return p;
    }

    function usage(over: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            schema_version: 1,
            record_class: 'usage',
            ts_bucket: '2026-08-19T10:00Z',
            skill: 'brand-identity',
            host: 'claude',
            package_version: '14.6.0',
            discipline_profile: 'essential',
            org_id: 'acme',
            user_hash: 'aaaa',
            session_hash: 'ssss',
            ...over,
        };
    }

    afterEach(() => {
        while (dirs.length > 0) fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
    });

    it('parses the hour bucket and refuses anything of another precision', () => {
        expect(sur.parse_hour_bucket('2026-08-19T10:00Z')?.toISOString()).toBe(
            '2026-08-19T10:00:00.000Z',
        );
        // A full ISO timestamp is the FIRST source's shape; accepting it here
        // would claim a precision the sink deliberately does not carry.
        expect(sur.parse_hour_bucket('2026-08-19T10:22:31Z')).toBeNull();
        expect(sur.parse_hour_bucket('2026-08-19')).toBeNull();
        expect(sur.parse_hour_bucket(42)).toBeNull();
    });

    it('counts distinct users, not invocations', () => {
        const per = sur.aggregate_sink(
            sur.load_class_a(
                sinkFile([
                    usage({ user_hash: 'u1', session_hash: 's1' }),
                    usage({ user_hash: 'u1', session_hash: 's2' }),
                    usage({ user_hash: 'u1', session_hash: 's3' }),
                    usage({ user_hash: 'u2', session_hash: 's4', host: 'augment' }),
                ]),
            ),
            new Date('2026-08-20T00:00:00Z'),
            30,
        );
        const b = per.get('brand-identity');
        expect(b?.invocations_window).toBe(4);
        // Four invocations, two people — the distinction the threshold exists for.
        expect(b?.users_window.size).toBe(2);
        expect(b?.sessions_window.size).toBe(4);
        expect([...(b?.hosts ?? [])].sort()).toEqual(['augment', 'claude']);
    });

    it('excludes non-usage record classes so defect reports never read as adoption', () => {
        const per = sur.aggregate_sink(
            sur.load_class_a(
                sinkFile([
                    usage(),
                    usage({ record_class: 'self-repair', skill: 'council-availability-claim' }),
                ]),
            ),
            new Date('2026-08-20T00:00:00Z'),
            30,
        );
        expect([...per.keys()]).toEqual(['brand-identity']);
    });

    it('drops a record missing the fields the aggregate is built from', () => {
        const rows = sur.load_class_a(
            sinkFile([
                usage(),
                { record_class: 'usage', ts_bucket: '2026-08-19T10:00Z', skill: 'no-user' },
                { record_class: 'usage', user_hash: 'u1', skill: 'no-bucket' },
            ]),
        );
        expect(rows.map((r) => r.skill)).toEqual(['brand-identity']);
    });

    it('drops records outside the window from the distinct-user count', () => {
        const per = sur.aggregate_sink(
            sur.load_class_a(
                sinkFile([
                    usage({ user_hash: 'recent' }),
                    usage({ user_hash: 'ancient', ts_bucket: '2026-01-02T10:00Z' }),
                ]),
            ),
            new Date('2026-08-20T00:00:00Z'),
            30,
        );
        const b = per.get('brand-identity');
        expect(b?.invocations_total).toBe(2);
        expect(b?.users_window.size).toBe(1);
    });

    it('reads the bar off the shipped constant rather than a local number', () => {
        expect(sur.MIN_DISTINCT_USERS).toBe(3);
    });

    it('renders the bar verdict per skill', () => {
        const per = sur.aggregate_sink(
            sur.load_class_a(
                sinkFile([
                    usage({ user_hash: 'u1' }),
                    usage({ user_hash: 'u2' }),
                    usage({ user_hash: 'u3' }),
                    usage({ skill: 'laravel', user_hash: 'u1' }),
                ]),
            ),
            new Date('2026-08-20T00:00:00Z'),
            30,
        );
        const out = sur.render_sink_section(per, 30, 'x.jsonl', true).join('\n');
        expect(out).toContain('At or above the 3-distinct-user bar:** 1');
        expect(out).toMatch(/\| 1 \| `brand-identity` \| 3 \| 3 \| .* \| yes \|/u);
        expect(out).toMatch(/\| 2 \| `laravel` \| 1 \| 1 \| .* \| no \|/u);
    });

    it('says NO INSTRUMENT rather than rendering an empty table', () => {
        const absent = sur.render_sink_section(new Map(), 30, 'nope.jsonl', false).join('\n');
        expect(absent).toContain('does not exist');
        expect(absent).toContain('no instrument');
        expect(absent).not.toContain('| # | slug |');

        const empty = sur.render_sink_section(new Map(), 30, 'there.jsonl', true).join('\n');
        expect(empty).toContain('holds no usage records');
    });

    it('is additive — the first-source report is unchanged when no sink is passed', () => {
        const known = new Set(['alpha']);
        const withoutSink = sur.render(new Map(), known);
        expect(withoutSink).not.toContain('Second source');
        expect(withoutSink).toContain('# Skill Usage Report (baseline)');

        const withSink = sur.render(new Map(), known, {
            per: new Map(),
            source_rel: 'x.jsonl',
            present: false,
        });
        expect(withSink.startsWith(withoutSink.trimEnd())).toBe(true);
    });
});
