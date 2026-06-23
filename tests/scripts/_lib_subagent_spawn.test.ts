import { describe, expect, it } from 'vitest';

import { MAX_KNOWLEDGE_REFS, MAX_PERSONAS, composeSpawnBrief } from '../../src/scripts/_lib/subagent_spawn.js';

describe('composeSpawnBrief — composition', () => {
    it('composes role-mode + profile + persona + knowledge refs into a brief', () => {
        const b = composeSpawnBrief({
            task: 'review the auth middleware diff',
            role_mode: 'reviewer',
            profile: 'developer',
            personas: ['security-abuse-case'],
            knowledge_refs: ['memory/knowledge/auth-notes', 'docs/threat-model.md'],
        });
        expect(b).toMatchObject({
            role_mode: 'reviewer',
            profile: 'developer',
            personas: ['security-abuse-case'],
            knowledge_refs: ['memory/knowledge/auth-notes', 'docs/threat-model.md'],
        });
        expect(b.warnings).toHaveLength(0);
    });

    it('unknown role_mode is dropped with a warning', () => {
        const b = composeSpawnBrief({ task: 't', role_mode: 'wizard' as never });
        expect(b.role_mode).toBeNull();
        expect(b.warnings.join()).toMatch(/role_mode/);
    });
});

describe('composeSpawnBrief — minimal-slice invariant (lethal-trifecta-guard)', () => {
    it('rejects non-ref knowledge bodies, keeps refs', () => {
        const body = 'line one\nline two — this is an inline body, not a ref';
        const b = composeSpawnBrief({ task: 't', knowledge_refs: ['ok/ref', body] });
        expect(b.knowledge_refs).toEqual(['ok/ref']);
        expect(b.warnings.join()).toMatch(/non-ref/);
    });

    it('caps knowledge refs at MAX_KNOWLEDGE_REFS', () => {
        const many = Array.from({ length: MAX_KNOWLEDGE_REFS + 3 }, (_, i) => `ref/${i}`);
        const b = composeSpawnBrief({ task: 't', knowledge_refs: many });
        expect(b.knowledge_refs).toHaveLength(MAX_KNOWLEDGE_REFS);
        expect(b.warnings.join()).toMatch(/capped/);
    });

    it('caps personas at MAX_PERSONAS', () => {
        const b = composeSpawnBrief({ task: 't', personas: ['a', 'b', 'c'] });
        expect(b.personas).toHaveLength(MAX_PERSONAS);
        expect(b.warnings.join()).toMatch(/personas capped/);
    });

    it('defaults are null/empty when nothing selected', () => {
        const b = composeSpawnBrief({ task: 't' });
        expect(b).toMatchObject({ role_mode: null, profile: null, personas: [], knowledge_refs: [] });
    });
});
