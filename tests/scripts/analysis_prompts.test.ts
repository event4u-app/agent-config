import { describe, expect, it } from 'vitest';

import { emitRound, type Finding } from '../../src/scripts/analysis_emit.js';
import { parseHandoff } from '../../src/scripts/analysis_analysts.js';
import { LENS_QUESTIONS, emitPrompts, foldLanes, promptOutput } from '../../src/scripts/analysis_prompts.js';
import { OutboundRefusedError } from '../../src/scripts/_lib/outbound_text.js';
import type { AnalysisTarget } from '../../src/scripts/analysis_target.js';

function finding(id: string, anchor: string, step: string): Finding {
    return {
        id,
        title: `Gap at ${anchor}`,
        claim: `The tree lacks what the source has at ${anchor}.`,
        anchor,
        tier: 'read',
        steps: [{ text: step, verify: `test -f ${anchor}` }],
    };
}

describe('foldLanes (step 4.4)', () => {
    it('two sources sharing a gap yield one roadmap with one phase for it', () => {
        const folded = foldLanes([
            { source: 'S1', findings: [finding('a1', 'src/x.ts', 'Add the cache'), finding('a2', 'src/y.ts', 'Add the lock')] },
            { source: 'S2', findings: [finding('b1', 'src/x.ts', 'Add the cache eviction')] },
        ]);
        expect(folded).toHaveLength(2);
        const shared = folded.find((f) => f.anchor === 'src/x.ts');
        expect(shared?.steps.map((s) => s.text)).toEqual(['Add the cache', 'Add the cache eviction']);
        expect(shared?.claim).toMatch(/S1, S2/);
        const out = emitRound({ roundId: 'r1', date: '2026-10-18', slug: 'x', findings: folded, readyAtZero: 0 });
        expect(out.roadmaps).toHaveLength(1);
        expect(out.roadmaps[0]?.body.match(/^## Phase /gm)).toHaveLength(2);
    });

    it('drops an identical step proposed by both sources', () => {
        const folded = foldLanes([
            { source: 'S1', findings: [finding('a1', 'src/x.ts', 'Add the cache')] },
            { source: 'S2', findings: [finding('b1', 'src/x.ts', 'Add the cache')] },
        ]);
        expect(folded[0]?.steps).toHaveLength(1);
    });

    it('keeps the strongest tier and an owner or block a later lane carried', () => {
        const later: Finding = { ...finding('b1', 'src/x.ts', 'Add the cache'), tier: 'executed', owner: 'a-cache', blocked_until: 'the owner names a TTL' };
        const folded = foldLanes([
            { source: 'S1', findings: [finding('a1', 'src/x.ts', 'Add the cache')] },
            { source: 'S2', findings: [later] },
        ]);
        expect(folded[0]).toMatchObject({ tier: 'executed', owner: 'a-cache', blocked_until: 'the owner names a TTL' });
    });
});

describe('emitPrompts (step 4.4)', () => {
    const prompts = emitPrompts({ scope: 'repo agent-config at /r', pin: 'abc123', roundId: 'inbox-2026-10-x' });

    it('both prompts embed the handoff-v1 frontmatter, parseable as written', () => {
        for (const p of [prompts.analyst, prompts.exchange]) {
            expect(p).toContain('handoff: v1');
            const block = /```yaml\n([\s\S]*?)```/.exec(p)?.[1] as string;
            expect(() => parseHandoff(`${block}\nbody`, 'x.md')).not.toThrow();
        }
    });

    it('the analyst prompt carries all three lens questions and the pin', () => {
        for (const q of Object.values(LENS_QUESTIONS)) expect(prompts.analyst).toContain(q);
        expect(prompts.analyst).toContain('abc123');
        expect(prompts.analyst).toContain('agents/tmp/inbox-2026-10-x/');
    });

    it('the exchange prompt carries the three reconcile loops', () => {
        for (const loop of ['inventory', 'cross-exam', 'converge']) expect(prompts.exchange).toContain(loop);
    });
});

describe('promptOutput — the printed prompts leave this host', () => {
    const target = {
        project_root: '/Users/alice/work/acme',
        scope_root: '/Users/alice/work/acme/packages/pay',
        scope_kind: 'module',
        scope_name: 'pay',
        anchor: 'git',
        module_source: 'detected',
        vcs: 'git',
        pr_target: 'github',
        ac_installed: true,
    } as unknown as AnalysisTarget;

    it('names the scope relative to the project, never by its absolute path', () => {
        const out = promptOutput(target, 'abc123', 'inbox-2026-10-x');
        expect(out).not.toContain('/Users/alice');
        expect(out).toContain('Scope: module pay at packages/pay (anchor: git)');
    });

    it('refuses to print a prompt that would carry a credential', () => {
        expect(() => promptOutput(target, 'ghp_0123456789abcdefghijklmnopqrstuvwxyzAB', 'r')).toThrow(OutboundRefusedError);
    });
});
