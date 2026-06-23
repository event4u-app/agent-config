import { describe, expect, it } from 'vitest';

import { bundleAuditLine, filterKnowledgeByPolicy, resolveBundle } from '../../src/scripts/_lib/subagent_bundle.js';
import { composeSpawnBrief } from '../../src/scripts/_lib/subagent_spawn.js';

describe('resolveBundle — reuse judge-* lenses + tier', () => {
    it('review slice → judge-code-quality, reviewer, medium', () => {
        const b = resolveBundle({ kind: 'review', task: 'review the diff' });
        expect(b.judge_lens).toBe('judge-code-quality');
        expect(b.selection.role_mode).toBe('reviewer');
        expect(b.tier).toBe('medium');
        expect(b.selection.personas).toContain('judge-code-quality');
    });

    it('security slice → judge-security-auditor, high tier', () => {
        const b = resolveBundle({ kind: 'security', task: 'audit auth' });
        expect(b.judge_lens).toBe('judge-security-auditor');
        expect(b.tier).toBe('high');
    });

    it('research slice → no lens, lite tier', () => {
        const b = resolveBundle({ kind: 'research', task: 'find all call sites' });
        expect(b.judge_lens).toBeNull();
        expect(b.tier).toBe('lite');
    });

    it('resolved selection composes into a valid spawn brief', () => {
        const b = resolveBundle({ kind: 'tests', task: 'cover the new branch' });
        const brief = composeSpawnBrief(b.selection);
        expect(brief.role_mode).toBe('tester');
        expect(brief.personas).toContain('judge-test-coverage');
    });
});

describe('filterKnowledgeByPolicy — ADR-100 guard', () => {
    const refs = [
        { ref: 'k/public-note', tier: 'public' as const },
        { ref: 'k/vendor-doc', tier: 'vendor' as const },
        { ref: 'k/secret-playbook', tier: 'proprietary' as const },
    ];

    it('cross-project drops proprietary refs', () => {
        const { kept, dropped } = filterKnowledgeByPolicy(refs, true);
        expect(kept).toEqual(['k/public-note', 'k/vendor-doc']);
        expect(dropped).toBe(1);
    });

    it('in-project keeps all refs', () => {
        const { kept, dropped } = filterKnowledgeByPolicy(refs, false);
        expect(kept).toHaveLength(3);
        expect(dropped).toBe(0);
    });

    it('resolveBundle honours the guard end-to-end', () => {
        const b = resolveBundle({
            kind: 'review',
            task: 't',
            knowledge: refs,
            cross_project: true,
        });
        expect(b.selection.knowledge_refs).not.toContain('k/secret-playbook');
        expect(b.dropped_proprietary).toBe(1);
        expect(b.reason).toMatch(/dropped 1 proprietary/);
    });
});

describe('bundleAuditLine — counts/ids only', () => {
    it('emits role/lens/tier + counts, no bodies', () => {
        const b = resolveBundle({ kind: 'security', task: 't', knowledge: [{ ref: 'k/x', tier: 'public' }] });
        const line = bundleAuditLine(b);
        expect(line).toMatchObject({ role_mode: 'reviewer', judge_lens: 'judge-security-auditor', tier: 'high', knowledge_ref_count: 1, dropped_proprietary: 0 });
        // no free-text body fields leak
        expect(Object.keys(line).sort()).toEqual(['dropped_proprietary', 'judge_lens', 'knowledge_ref_count', 'role_mode', 'tier']);
    });
});
