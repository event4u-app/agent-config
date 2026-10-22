import { describe, expect, it } from 'vitest';

import { buildNudgeLine, classifyPrompt } from '../../src/scripts/hooks/delegation_nudge_hook.js';
import { handKindFromPrompt } from '../../src/scripts/_lib/hand_kinds.js';

const CLASSIFY_SLICE = 'classify this error message: ETIMEDOUT on remote host';

describe('delegation nudge — the free rung', () => {
    it('a classify slice with an admissible route names the free rung and dispatches nothing', () => {
        const r = classifyPrompt(CLASSIFY_SLICE, process.cwd(), 'claude', { freeRouteAdmissible: () => true });
        expect(r).not.toBeNull();
        expect(r!.rung).toBe(0.5);
        expect(r!.handKind).toBe('classify');
        expect(r!.classification.delegable).toBe(false);
        expect(r!.classification.action).toBe('ask');
        expect(r!.sliceCount).toBe(0);

        const line = buildNudgeLine(r!.rung, r!.classification, r!.sliceCount, r!.tier, r!.sliceKind, r!.handKind);
        expect(line).toContain('free rung');
        expect(line).toContain('ask_transport --kind classify');
        expect(line).not.toMatch(/Agent call|subagent-orchestration|dispatch single-slice/);
    });

    it('stays silent when no route is admissible — the default', () => {
        expect(classifyPrompt(CLASSIFY_SLICE, process.cwd(), 'claude', { freeRouteAdmissible: () => false })).toBeNull();
        expect(classifyPrompt(CLASSIFY_SLICE, process.cwd(), 'claude')).toBeNull();
    });

    it('stays silent on an untyped question even when a route is admissible', () => {
        expect(
            classifyPrompt('is exponential backoff the right retry default?', process.cwd(), 'claude', {
                freeRouteAdmissible: () => true,
            }),
        ).toBeNull();
    });

    it('the admissibility check is asked about the matched kind only', () => {
        const asked: string[] = [];
        classifyPrompt(CLASSIFY_SLICE, process.cwd(), 'claude', {
            freeRouteAdmissible: (k) => {
                asked.push(k);
                return true;
            },
        });
        expect(asked).toEqual(['classify']);
    });
});

describe('handKindFromPrompt', () => {
    it('reads the kind from the leading verb, and nothing from a head-only request', () => {
        expect(handKindFromPrompt(CLASSIFY_SLICE)).toBe('classify');
        expect(handKindFromPrompt('extract every date from this text: ...')).toBe('extract');
        expect(handKindFromPrompt('summarise the following text: ...')).toBe('summarise-given-text');
        expect(handKindFromPrompt('propose test cases for this function: ...')).toBe('test-candidates');
        expect(handKindFromPrompt('draft a candidate implementation of: ...')).toBe('draft-candidate');
        expect(handKindFromPrompt('propose findings for this diff: ...')).toBe('finding-proposal');
        expect(handKindFromPrompt('plan the migration')).toBeNull();
        expect(handKindFromPrompt('decide which route to take')).toBeNull();
    });
});
