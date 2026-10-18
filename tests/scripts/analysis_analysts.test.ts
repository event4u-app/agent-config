import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    AnalystError,
    DEFAULT_ANALYSTS,
    briefDigest,
    parseHandoff,
    planAnalysts,
    readExternalDrops,
    roundViolations,
    cliAnalystCommand,
    stampOutput,
    type AnalystOutput,
} from '../../src/scripts/analysis_analysts.js';
import { AGENCY_BYPASS_FLAGS, ANALYST_BOUNDS, analystBoundFor, boundFor } from '../../src/scripts/ai_council/cli_agency_bounds.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-analysts-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const BRIEF = 'Analyse the scope at /repo for capability gaps; three lens loops each.';

function handoff(fields: Record<string, string>, body = '## Findings vs tree\n\n- F1 holds at src/a.ts:12\n'): string {
    const fm = Object.entries(fields)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    return `---\n${fm}\n---\n${body}`;
}

function dropExternal(roundId: string, name: string, text: string): void {
    const dir = path.join(root, 'agents/tmp', roundId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
}

describe('analyst plan', () => {
    it('defaults to three analysts with an exchange', () => {
        expect(planAnalysts({})).toEqual({ count: DEFAULT_ANALYSTS, exchange: true, reason: 'default' });
    });

    it('runs one analyst and no exchange under --quick', () => {
        expect(planAnalysts({ quick: true })).toEqual({ count: 1, exchange: false, reason: 'quick' });
    });

    it('runs one analyst and no exchange on a scope below the size threshold', () => {
        expect(planAnalysts({ scopeFiles: 4, smallScopeFiles: 10 })).toEqual({
            count: 1,
            exchange: false,
            reason: 'small-scope',
        });
        expect(planAnalysts({ scopeFiles: 10, smallScopeFiles: 10 }).count).toBe(DEFAULT_ANALYSTS);
    });

    it('refuses an analyst count outside 1..5', () => {
        expect(() => planAnalysts({ analysts: 0 })).toThrow(AnalystError);
        expect(() => planAnalysts({ analysts: 6 })).toThrow(AnalystError);
    });
});

describe('analyst outputs', () => {
    it('never stamps a subagent analyst cross-family', () => {
        const out = stampOutput({
            analyst_id: 'an-1',
            mode: 'subagent',
            hostFamily: 'anthropic',
            phase: 'seed',
            brief: BRIEF,
            body: 'seed',
            consulted: [],
        });
        expect(out.family).toBe('anthropic');
        expect(out.review_independence).toBe('same-family');
        expect(out.context_relation).toBe('fresh');
        expect(() =>
            stampOutput({
                analyst_id: 'an-1',
                mode: 'subagent',
                hostFamily: 'anthropic',
                family: 'openai',
                phase: 'seed',
                brief: BRIEF,
                body: 'seed',
                consulted: [],
            }),
        ).toThrow(AnalystError);
    });

    it('stamps an external analyst of an unknown family unknown, never cross-family', () => {
        const out = stampOutput({
            analyst_id: 'ext-1',
            mode: 'external',
            hostFamily: 'anthropic',
            family: 'some-local-model',
            phase: 'deepen',
            brief: BRIEF,
            body: 'x',
            consulted: [],
        });
        expect(out.review_independence).toBe('unknown');
    });

    it('a fixture round of two subagents and one external drop yields three stamped, independent outputs', () => {
        dropExternal(
            'round-1',
            'analyst-c.md',
            handoff({ handoff: 'v1', phase: 'deepen', loop: '3', pin: 'abc123', family: 'openai', brief_digest: briefDigest(BRIEF) }),
        );
        dropExternal('round-1', 'analyst-c.annex.md', '# sources, never read as an output\n');
        const drops = readExternalDrops(root, 'round-1');
        expect(drops.skipped).toEqual([]);
        expect(drops.handoffs).toHaveLength(1);

        const outputs: AnalystOutput[] = [
            stampOutput({ analyst_id: 'an-1', mode: 'subagent', hostFamily: 'anthropic', phase: 'deepen', brief: BRIEF, body: 'a', consulted: [] }),
            stampOutput({ analyst_id: 'an-2', mode: 'subagent', hostFamily: 'anthropic', phase: 'deepen', brief: BRIEF, body: 'b', consulted: [] }),
            ...drops.handoffs.map((h) =>
                stampOutput({
                    analyst_id: h.analyst_id,
                    mode: 'external',
                    hostFamily: 'anthropic',
                    family: h.family,
                    phase: h.phase === 'seed' ? 'seed' : 'deepen',
                    brief: BRIEF,
                    body: h.body,
                    consulted: [],
                }),
            ),
        ];
        expect(outputs).toHaveLength(3);
        expect(new Set(outputs.map((o) => o.brief_digest)).size).toBe(1);
        expect(outputs.map((o) => o.review_independence)).toEqual(['same-family', 'same-family', 'cross-family']);
        expect(roundViolations(outputs)).toEqual([]);
    });

    it('names an output that consulted another analyst before the exchange', () => {
        const a = stampOutput({ analyst_id: 'an-1', mode: 'subagent', hostFamily: 'anthropic', phase: 'seed', brief: BRIEF, body: 'a', consulted: [] });
        const b = stampOutput({ analyst_id: 'an-2', mode: 'subagent', hostFamily: 'anthropic', phase: 'deepen', brief: BRIEF, body: 'b', consulted: ['an-1'] });
        expect(roundViolations([a, b])).toEqual(['an-2 (deepen) consulted an-1 before the exchange']);
    });

    it('names an output whose brief differs from the round', () => {
        const a = stampOutput({ analyst_id: 'an-1', mode: 'subagent', hostFamily: 'anthropic', phase: 'seed', brief: BRIEF, body: 'a', consulted: [] });
        const b = stampOutput({ analyst_id: 'an-2', mode: 'subagent', hostFamily: 'anthropic', phase: 'seed', brief: `${BRIEF} Focus on auth.`, body: 'b', consulted: [] });
        expect(roundViolations([a, b])).toEqual(['an-2 (seed) ran on a different brief than an-1']);
    });
});

describe('handoff-v1 drops', () => {
    it('skips a drop without the handoff: v1 frontmatter and says why', () => {
        dropExternal('round-2', 'notes.md', '# just notes\n');
        dropExternal('round-2', 'old.md', handoff({ handoff: 'v0', phase: 'seed', loop: '1', pin: 'p' }));
        const drops = readExternalDrops(root, 'round-2');
        expect(drops.handoffs).toEqual([]);
        expect(drops.skipped.map((s) => s.file).sort()).toEqual(['notes.md', 'old.md']);
    });

    it('reads no drop folder as no drops', () => {
        expect(readExternalDrops(root, 'absent')).toEqual({ handoffs: [], skipped: [] });
    });

    it('requires phase, loop and pin', () => {
        expect(() => parseHandoff(handoff({ handoff: 'v1', phase: 'seed', pin: 'p' }), 'x.md')).toThrow(/loop/);
        expect(() => parseHandoff(handoff({ handoff: 'v1', phase: 'later', loop: '1', pin: 'p' }), 'x.md')).toThrow(/phase/);
    });
});

describe('cli analysts (step 2.4b)', () => {
    const cli = (family: string | undefined) =>
        stampOutput({
            analyst_id: `cli:${family ?? 'x'}`,
            mode: 'cli',
            hostFamily: 'anthropic',
            family,
            phase: 'seed',
            brief: BRIEF,
            body: 'x',
            consulted: [],
        });

    it('stamps a cli analyst of another provider cross-family', () => {
        const out = cli('openai');
        expect(out.family).toBe('openai');
        expect(out.review_independence).toBe('cross-family');
        expect(out.context_relation).toBe('fresh');
    });

    it('stamps a cli analyst of the host provider same-family, never cross-family', () => {
        expect(cli('anthropic').review_independence).toBe('same-family');
    });

    it('refuses a cli analyst without a known provider family', () => {
        expect(() => cli(undefined)).toThrow(AnalystError);
        expect(() => cli('someone')).toThrow(AnalystError);
    });

    it('builds the analyst argv from the read-only analyst profile, not the seat bound', () => {
        const cmd = cliAnalystCommand('anthropic');
        expect(cmd.binary).toBe('claude');
        expect(cmd.argv).toEqual(analystBoundFor('anthropic'));
        expect(cmd.argv).not.toEqual(boundFor('anthropic'));
        expect(cmd.promptVia).toBe('stdin');
    });

    it('refuses a member whose analyst profile was never probed or failed its probe', () => {
        expect(() => cliAnalystCommand('gemini')).toThrow(/no probed read-only analyst profile/);
        expect(() => cliAnalystCommand('xai')).toThrow(/no probed read-only analyst profile/);
        expect(() => cliAnalystCommand('nobody')).toThrow(/no probed read-only analyst profile/);
    });

    it('never puts a bypass flag in an analyst profile and records the probe behind every bound', () => {
        for (const b of ANALYST_BOUNDS) {
            for (const flag of b.bound) expect(AGENCY_BYPASS_FLAGS).not.toContain(flag);
            if (b.bound.length > 0) {
                expect(b.probed_version).not.toBeNull();
                expect(b.probed_on).not.toBeNull();
            }
        }
    });

    it('leaves the seat bound untouched (seat doctrine unchanged)', () => {
        expect(boundFor('anthropic')).toEqual(['--tools', '']);
        expect(boundFor('openai')).toEqual(['--sandbox', 'read-only']);
    });
});
