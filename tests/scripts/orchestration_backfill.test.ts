import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    classifyFamily,
    transcriptDirFor,
    extract,
    summarize,
} from '../../src/scripts/orchestration_backfill.ts';

/**
 * Assertions derive expected values from the inputs rather than pinning the
 * numbers one production run happened to produce — a test that hardcodes
 * "39 dispatches" passes only until the corpus grows by one.
 */

describe('transcriptDirFor', () => {
    it('slugifies every non-alphanumeric character, not just separators', () => {
        const path = '/Users/a/projects/my.repo-name';
        const dir = transcriptDirFor(path, '/home');
        expect(dir).toBe(join('/home', '.claude', 'projects', '-Users-a-projects-my-repo-name'));
        // The property, not the literal: nothing outside [A-Za-z0-9-] survives.
        expect(dir.split('projects/')[1]).toMatch(/^[A-Za-z0-9-]+$/);
    });
});

describe('classifyFamily', () => {
    it('returns unclassified when no enumerated signal matches', () => {
        const { family, signal } = classifyFamily(null, 'do a thing', 'please do the thing');
        expect(family).toBe('unclassified');
        expect(signal).toMatch(/no enumerated family signal/);
    });

    it('prefers verdict-judge over read-only when a dispatch is both', () => {
        // Most verdict passes are also read-only; if read-only won, the
        // verdict family would be silently absorbed and the per-family split
        // would understate it.
        const both = classifyFamily('Explore', 'Verify AC1', 'READ-ONLY investigation — verify this acceptance criterion');
        expect(both.family).toBe('verdict-judge');
    });

    it('classifies by subagent_type without needing prompt text', () => {
        expect(classifyFamily('Explore', null, null).family).toBe('read-only-fanout');
        expect(classifyFamily('production-validator', null, null).family).toBe('verdict-judge');
    });

    it('is case-insensitive on prompt signals', () => {
        const upper = classifyFamily(null, null, 'READ-ONLY: do not edit anything');
        const lower = classifyFamily(null, null, 'read-only: do not edit anything');
        expect(upper.family).toBe(lower.family);
        expect(upper.family).toBe('read-only-fanout');
    });
});

/** Build a minimal transcript that exercises the sync / async / orphan paths. */
function seedCorpus(): string {
    const root = mkdtempSync(join(tmpdir(), 'obf-'));
    const dir = join(root, '.claude', 'projects', '-repo');
    mkdirSync(dir, { recursive: true });

    const dispatch = (id: string, subagentType: string) =>
        JSON.stringify({
            timestamp: '2026-08-07T00:00:00.000Z',
            message: {
                content: [{ type: 'tool_use', name: 'Agent', id, input: { subagent_type: subagentType, description: 'd', prompt: 'p' } }],
            },
        });
    const result = (id: string, payload: Record<string, unknown>) =>
        JSON.stringify({
            message: { content: [{ type: 'tool_result', tool_use_id: id }] },
            toolUseResult: payload,
        });

    writeFileSync(
        join(dir, 'sess.jsonl'),
        [
            dispatch('a', 'Explore'),
            result('a', { resolvedModel: 'm1', totalTokens: 100, totalDurationMs: 5, totalToolUseCount: 2 }),
            dispatch('b', 'Explore'),
            result('b', { resolvedModel: 'm1', isAsync: true, status: 'async_launched' }),
            dispatch('c', 'Explore'), // orphan — result never landed
            '{ not json',
        ].join('\n'),
        'utf8',
    );
    return dir;
}

describe('extract', () => {
    it('counts an async launch as a dispatch but never as measured cost', () => {
        const { dispatches, unparseable_lines } = extract(seedCorpus());
        expect(dispatches).toHaveLength(3);
        expect(unparseable_lines).toBe(1);

        const measured = dispatches.filter((d) => d.cost_provenance === 'measured');
        expect(measured).toHaveLength(1);
        expect(measured[0]!.total_tokens).toBe(100);

        const async_ = dispatches.find((d) => d.tool_use_id === 'b')!;
        expect(async_.async_launch).toBe(true);
        expect(async_.cost_provenance).toBe('absent');
        expect(async_.total_tokens).toBeNull();
    });

    it('reports an orphaned dispatch rather than dropping it silently', () => {
        const { dispatches } = extract(seedCorpus());
        const orphan = dispatches.find((d) => d.tool_use_id === 'c')!;
        expect(orphan).toBeDefined();
        expect(orphan.cost_provenance).toBe('absent');
    });

    it('returns an empty extraction for a missing corpus instead of throwing', () => {
        const out = extract(join(tmpdir(), 'obf-does-not-exist'));
        expect(out.dispatches).toEqual([]);
        expect(out.sessions_scanned).toBe(0);
    });
});

describe('summarize', () => {
    const line = (family: string, tokens: number | null) => ({
        session_id: 's',
        tool_use_id: `t${tokens}`,
        timestamp: null,
        subagent_type: null,
        description: null,
        family,
        family_signal: 'x',
        resolved_model: 'm',
        total_tokens: tokens,
        wall_clock_ms: null,
        tool_use_count: null,
        cost_provenance: tokens === null ? 'absent' : 'measured',
        async_launch: false,
    });

    it('marks a family below the n=5 floor UNDERPOWERED and never merges it away', () => {
        const rows = [line('ordered-steps', 10), line('read-only-fanout', 1), line('read-only-fanout', 2), line('read-only-fanout', 3), line('read-only-fanout', 4), line('read-only-fanout', 5)];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = summarize(rows as any) as any;
        expect(s.families['ordered-steps'].power).toBe('UNDERPOWERED');
        expect(s.families['ordered-steps'].n).toBe(1);
        expect(s.families['read-only-fanout'].power).toBe('reportable');
        // The underpowered family survives as its own row — it is not folded in.
        expect(Object.keys(s.families).sort()).toEqual(['ordered-steps', 'read-only-fanout']);
    });

    it('excludes cost-less dispatches from family stats but counts them in the population', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = summarize([line('read-only-fanout', 100), line('read-only-fanout', null)] as any) as any;
        expect(s.dispatches_total).toBe(2);
        expect(s.dispatches_with_measured_cost).toBe(1);
        expect(s.families['read-only-fanout'].n).toBe(1);
        expect(s.cost_coverage_ratio).toBe(0.5);
    });

    it('never emits a token_delta, and says why in the payload', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = summarize([line('read-only-fanout', 100)] as any) as any;
        expect(JSON.stringify(s)).not.toContain('token_delta"');
        expect(String(s.baseline_note)).toMatch(/counterfactual/i);
    });
});
