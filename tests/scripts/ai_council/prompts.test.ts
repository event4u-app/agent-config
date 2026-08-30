// Tests for src/scripts/ai_council/prompts.ts (py2ts Phase 1).
//
// prompts assembles neutrality system-prompt text (pure string-building).
import { describe, expect, it } from 'vitest';

import { ProjectContext } from '../../../src/scripts/ai_council/project_context.js';
import {
    advisor_system_prompt,
    all_modes,
    all_synthesis_modes,
    build_extraction_user_prompt,
    build_peer_review_user_prompt,
    build_scoring_user_prompt,
    handoff_preamble,
    HOST_AGENT_IDENTITY_PATTERNS,
    NEUTRALITY_PREAMBLE,
    peer_review_synthesis_addendum,
    synthesis_template,
    system_prompt_for,
} from '../../../src/scripts/ai_council/prompts.js';

// ── Unit tests of the TS surface ─────────────────────────────────────

describe('prompts — constants + mode tables', () => {
    it('NEUTRALITY_PREAMBLE is stripped (no leading/trailing whitespace)', () => {
        expect(NEUTRALITY_PREAMBLE).toBe(NEUTRALITY_PREAMBLE.trim());
        expect(NEUTRALITY_PREAMBLE.startsWith('You are an independent reviewer')).toBe(true);
    });
    it('all_modes returns the 9 sorted mode keys', () => {
        expect(all_modes()).toEqual([
            'analysis',
            'debate',
            'design',
            'diff',
            'files',
            'optimize',
            'pr',
            'prompt',
            'roadmap',
        ]);
    });
    it('all_synthesis_modes returns the 5 sorted lens keys', () => {
        expect(all_synthesis_modes()).toEqual(['analysis', 'default', 'design', 'optimize', 'pr']);
    });
    it('HOST_AGENT_IDENTITY_PATTERNS covers the documented needles', () => {
        expect(HOST_AGENT_IDENTITY_PATTERNS).toContain('augment');
        expect(HOST_AGENT_IDENTITY_PATTERNS).toContain('claude code');
    });
});

describe('prompts — synthesis_template', () => {
    it('null → default decision template', () => {
        expect(synthesis_template(null)).toBe(synthesis_template('default'));
    });
    it('input modes inherit default', () => {
        for (const m of ['prompt', 'roadmap', 'diff', 'files']) {
            expect(synthesis_template(m)).toBe(synthesis_template('default'));
        }
    });
    it('creative lenses keep a free-form body but carry the two required verdict sections', () => {
        // Phase 0 (road-to-opt-council-deliberation): creative lenses are no
        // longer empty passthroughs — every lens must close with Kill criteria
        // + Concrete next step. The body stays open-ended prose.
        for (const lens of ['design', 'optimize']) {
            const t = synthesis_template(lens);
            expect(t).not.toBe('');
            expect(t).toContain('free-form');
            expect(t).toContain('### Kill criteria');
            expect(t).toContain('### Concrete next step');
        }
        expect(synthesis_template('design')).toBe(synthesis_template('optimize'));
    });
    it('every decision lens template carries Kill criteria + Concrete next step', () => {
        for (const lens of ['default', 'pr', 'analysis']) {
            const t = synthesis_template(lens);
            expect(t).toContain('### Kill criteria');
            expect(t).toContain('### Concrete next step');
        }
    });
    it('unknown mode raises with sorted-union expected list', () => {
        expect(() => synthesis_template('bogus')).toThrow(/Unknown synthesis mode 'bogus'/);
        expect(() => synthesis_template('bogus')).toThrow(
            /Expected one of: \['analysis', 'default', 'design', 'diff', 'files', 'optimize', 'pr', 'prompt', 'roadmap'\]/,
        );
    });
});

describe('prompts — system_prompt_for', () => {
    it('unknown mode raises with sorted expected list', () => {
        expect(() => system_prompt_for('bogus')).toThrow(/Unknown council mode 'bogus'/);
    });
    it('bare call = NEUTRALITY_PREAMBLE + addendum', () => {
        const out = system_prompt_for('prompt');
        expect(out.startsWith(NEUTRALITY_PREAMBLE)).toBe(true);
    });
    it('project + ask prepend the handoff preamble', () => {
        const out = system_prompt_for('diff', {
            project: new ProjectContext('Demo', 'PHP 8.3', 'A purpose.'),
            original_ask: 'Should I ship?',
        });
        expect(out).toContain('Project: Demo');
        expect(out).toContain('> Should I ship?');
    });
});

describe('prompts — handoff_preamble neutrality', () => {
    it('strips host-identity lines from project + ask', () => {
        const project = new ProjectContext('Built with Augment', 'PHP', 'Uses Claude Code here.');
        const out = handoff_preamble(project, 'Ask via Cursor IDE\nSecond line ok');
        expect(out.toLowerCase()).not.toContain('augment');
        expect(out.toLowerCase()).not.toContain('claude code');
        expect(out.toLowerCase()).not.toContain('cursor ide');
        expect(out).toContain('Second line ok');
    });
    it('null project + empty ask → bare preamble', () => {
        expect(handoff_preamble(null, '')).toBe(NEUTRALITY_PREAMBLE);
    });
});

describe('prompts — advisor + builder prompts', () => {
    it('advisor_system_prompt appends persona body', () => {
        const out = advisor_system_prompt('  Persona body.  ');
        expect(out.endsWith('Persona body.')).toBe(true);
    });
    it('advisor_system_prompt raises on empty persona', () => {
        expect(() => advisor_system_prompt('   ')).toThrow(/persona_text is empty/);
    });
    it('build_scoring_user_prompt renders labels', () => {
        const out = build_scoring_user_prompt(
            new Map([
                ['Finding-A', 'first'],
                ['Finding-B', 'second'],
            ]),
        );
        expect(out).toContain('### Finding-A\n\nfirst');
        expect(out).toContain('### Finding-B\n\nsecond');
    });
    it('build_peer_review_user_prompt renders labels, with the body fenced (3.6)', () => {
        // Was `toContain('### Response-A\n\nbody')`. Step 3.6 moved the body
        // inside a nonced untrusted fence and left the label outside it, so the
        // label and the body are no longer adjacent — that separation IS the
        // control. Both halves are still asserted, and their ORDER is asserted,
        // which is what "the label is outside the fence" means at this layer.
        const out = build_peer_review_user_prompt(new Map([['Response-A', 'body']]));
        expect(out).toContain('### Response-A');
        expect(out).toContain('body');
        expect(out.indexOf('### Response-A')).toBeLessThan(out.indexOf('<untrusted_content id='));
        expect(out.indexOf('<untrusted_content id=')).toBeLessThan(out.lastIndexOf('body'));
    });
    it('build_extraction_user_prompt strips host identity', () => {
        const out = build_extraction_user_prompt('line one with Windsurf\nline two');
        expect(out.toLowerCase()).not.toContain('windsurf');
        expect(out).toContain('line two');
    });
    it('peer_review_synthesis_addendum starts with a leading newline', () => {
        expect(peer_review_synthesis_addendum().startsWith('\n### Peer-Review-Surfaced')).toBe(true);
    });
});
