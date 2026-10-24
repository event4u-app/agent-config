import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CONSUMER_IMPACT_VALUES, NO_IMPACT_TRAILERS, parse_impact_trailers } from '../../src/scripts/_lib/consumer_impact.js';
import { impact_bump, parse_impact_rows, replay_majors, span_bump } from '../../src/scripts/_lib/impact_bump.js';
import type { MajorSurface } from '../../src/scripts/_lib/major_surface.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BREAKING = fs.readFileSync(path.join(REPO_ROOT, 'BREAKING_CHANGES.md'), 'utf-8');

describe('impact_bump — the rule release.ts numbers by (ADR-300)', () => {
    it('is major when the span carries action, whatever the punctuation', () => {
        expect(impact_bump({ impact: 'action', breaking: false, has_minor_type: false, touches_major_surface: false })).toBe('major');
    });

    it('is major when the span touches a surface CONTRIBUTING.md lists as major', () => {
        expect(impact_bump({ impact: 'none', breaking: false, has_minor_type: false, touches_major_surface: true })).toBe('major');
    });

    it('turns an internal breaking subject into a minor', () => {
        for (const impact of ['none', 'automatic', 'notice'] as const) {
            expect(impact_bump({ impact, breaking: true, has_minor_type: false, touches_major_surface: false })).toBe('minor');
        }
    });

    it('keeps the minor and patch branches of the existing rule', () => {
        expect(impact_bump({ impact: 'none', breaking: false, has_minor_type: true, touches_major_surface: false })).toBe('minor');
        expect(impact_bump({ impact: 'none', breaking: false, has_minor_type: false, touches_major_surface: false })).toBe('patch');
    });
});

describe('BREAKING_CHANGES.md carries the recorded impact (step 2.3, AC-7)', () => {
    const rows = parse_impact_rows(BREAKING);

    it('parses every row of the by-major table', () => {
        const tableRows = BREAKING.split('\n').filter((l) => /^\| \*\*\d+\.0\.0\*\* \|/.test(l));
        expect(rows.length).toBe(tableRows.length);
        expect(rows.length).toBeGreaterThanOrEqual(17);
    });

    it('gives every row a value from the enum', () => {
        for (const row of rows) {
            expect(CONSUMER_IMPACT_VALUES as readonly string[]).toContain(row.impact);
        }
    });

    it('refuses a row whose cell is not in the enum', () => {
        const forged = '| **9.0.0** | 2026-07-13 | x | y | breaking |\n';
        expect(parse_impact_rows(forged)).toEqual([{ version: '9.0.0', impact: null }]);
    });
});

// What this replay can and cannot show: the impact cells it reads were written
// into BREAKING_CHANGES.md after these releases shipped, with their outcomes
// known. A pass shows the rule REPRODUCES labels chosen in hindsight, not that
// it would have classified the releases correctly in advance — any "AC-1
// passes" or "rule validated" statement built on it must say so.
describe('replaying 10.0.0 → 16.0.0 through the proposed rule (step 2.2, AC-1)', () => {
    const replay = replay_majors(parse_impact_rows(BREAKING));

    it('scores 13.0.0, 14.0.0 and 16.0.0 as minor', () => {
        expect(replay.get('13.0.0')).toBe('minor');
        expect(replay.get('14.0.0')).toBe('minor');
        expect(replay.get('16.0.0')).toBe('minor');
    });

    it('scores 12.0.0 and 15.0.0 as major', () => {
        expect(replay.get('12.0.0')).toBe('major');
        expect(replay.get('15.0.0')).toBe('major');
    });

    it('differs from the old classification, which made every row a major', () => {
        const window = ['10.0.0', '11.0.0', '12.0.0', '13.0.0', '14.0.0', '15.0.0', '16.0.0'];
        expect(window.filter((v) => replay.get(v) !== 'major').length).toBeGreaterThan(0);
    });

    it('takes the strongest impact when a major has more than one row', () => {
        const two = '| **6.0.0** | d | a | b | action |\n| **6.0.0** | d | c | e | automatic |\n';
        expect(replay_majors(parse_impact_rows(two)).get('6.0.0')).toBe('major');
    });
});

// ADR-300: the trailer binds the bump. What a span with no declaration does is
// the part the record leaves to the implementation, and it is pinned here.
describe('span_bump — the release span through the bound rule (step 2.1, ADR-300)', () => {
    const trailered = (body: string, breaking = true) => ({ breaking, trailers: parse_impact_trailers(body) });
    const bare = (breaking = true) => ({ breaking, trailers: NO_IMPACT_TRAILERS });
    const none = new Set<MajorSurface>();
    const run = (commits: Parameters<typeof span_bump>[0]['commits'], surfaces = none, has_minor_type = false) =>
        span_bump({ commits, surfaces, has_minor_type });

    it('makes an internal breaking subject a minor once its author declared the impact', () => {
        for (const impact of ['none', 'automatic', 'notice']) {
            expect(run([trailered(`Consumer-Impact: ${impact}`)])).toBe('minor');
        }
    });

    it('is major when any commit in the span declares action, breaking or not', () => {
        expect(run([trailered('Consumer-Impact: action', false), bare(false)])).toBe('major');
    });

    it('keeps a breaking commit with no declaration a major — absence is not a downgrade', () => {
        expect(run([bare()])).toBe('major');
        expect(run([trailered('Consumer-Impact: none'), bare()])).toBe('major');
    });

    it('keeps a breaking commit with an invalid declaration a major', () => {
        expect(run([trailered('Consumer-Impact: breaking')])).toBe('major');
        expect(run([trailered('consumer-impact: none')])).toBe('major');
    });

    it('is major for installer-layout, rule-or-skill and command removals whatever was declared', () => {
        for (const surface of ['installer-layout', 'rule-or-skill-removal', 'command-removal'] as const) {
            expect(run([trailered('Consumer-Impact: automatic')], new Set([surface]))).toBe('major');
        }
    });

    it('does not make a settings-key removal a major when the span declares it automatic', () => {
        expect(run([trailered('Consumer-Impact: automatic')], new Set(['settings-keys']))).toBe('minor');
    });

    it('keeps a settings-key removal a major when the span does not declare it automatic', () => {
        expect(run([trailered('Consumer-Impact: none')], new Set(['settings-keys']))).toBe('major');
        expect(run([trailered('Consumer-Impact: notice')], new Set(['settings-keys']))).toBe('major');
        expect(run([bare(false)], new Set(['settings-keys']))).toBe('major');
        expect(
            run([trailered('Consumer-Impact: automatic'), trailered('Consumer-Impact: notice', false)], new Set(['settings-keys'])),
        ).toBe('major');
    });

    it('keeps the minor and patch branches for spans with nothing breaking', () => {
        expect(run([bare(false)], none, true)).toBe('minor');
        expect(run([bare(false)])).toBe('patch');
        expect(run([])).toBe('patch');
    });
});
