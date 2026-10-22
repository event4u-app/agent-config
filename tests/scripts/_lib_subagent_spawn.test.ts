import { describe, expect, it } from 'vitest';

import { KERNEL_RULE_IDS } from '../../src/scripts/_lib/kernel_rules.js';
import {
    MAX_KNOWLEDGE_REFS,
    MAX_PERSONAS,
    composeSpawnBrief,
    serializeSpawnPayload,
} from '../../src/scripts/_lib/subagent_spawn.js';
import { render_floor } from '../../src/scripts/generate_subagent_floor.js';

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

describe('composeSpawnBrief — a worker that skips project instructions', () => {
    const FLOOR = render_floor();
    const CONSTRAINTS = [
        'Do not touch files under src/rules/.',
        'Keep the public API of `foo()` unchanged — callers in two repos depend on it.',
    ];

    it('skipping-worker-carries-kernel-and-constraints', () => {
        const b = composeSpawnBrief({
            task: 'refactor foo',
            omit_project_instructions: true,
            safety_floor: FLOOR,
            user_constraints: CONSTRAINTS,
        });
        expect(b.omit_project_instructions).toBe(true);
        expect(b.warnings).toHaveLength(0);

        const [prefix, tail] = serializeSpawnPayload(b).split('\n');
        const head = JSON.parse(prefix!) as { safety_floor: string };
        const rest = JSON.parse(tail!) as { user_constraints: string[] };
        // The floor rides byte for byte, and with it every kernel rule id it names.
        expect(head.safety_floor).toBe(FLOOR);
        for (const id of KERNEL_RULE_IDS) expect(head.safety_floor).toContain(id);
        // Each user constraint rides byte for byte, in the order given.
        expect(rest.user_constraints).toEqual(CONSTRAINTS);
    });

    it('refuses to skip when there is no floor to carry, and says so', () => {
        for (const floor of [undefined, null, '', '   ']) {
            const b = composeSpawnBrief({
                task: 't',
                omit_project_instructions: true,
                ...(floor === undefined ? {} : { safety_floor: floor }),
            });
            expect(b.omit_project_instructions).toBe(false);
            expect(b.safety_floor).toBeNull();
            expect(b.warnings.join()).toMatch(/skip refused/);
        }
    });

    it('refuses to skip on a floor that is not the generated one', () => {
        // Any non-empty string used to pass, so 'x' stood in for the whole rule
        // layer the host's skip flag drops (finding c27e483ddcba).
        const truncated = FLOOR.split('\n').slice(0, 6).join('\n');
        for (const floor of ['x', 'SAFETY FLOOR — be careful.', truncated, FLOOR.replace('Do NOT commit', 'Do commit')]) {
            const b = composeSpawnBrief({ task: 't', omit_project_instructions: true, safety_floor: floor });
            expect(b.omit_project_instructions, floor).toBe(false);
            expect(b.safety_floor, floor).toBeNull();
            expect(b.warnings.join(), floor).toMatch(/not the generated floor/);
        }
        // The generated floor with framing around it is still the floor.
        const framed = composeSpawnBrief({ task: 't', omit_project_instructions: true, safety_floor: `intro\n${FLOOR}\noutro` });
        expect(framed.omit_project_instructions).toBe(true);
    });

    it('a worker that loads project instructions carries no floor copy, constraints still verbatim', () => {
        const b = composeSpawnBrief({ task: 't', safety_floor: FLOOR, user_constraints: CONSTRAINTS });
        expect(b.omit_project_instructions).toBe(false);
        expect(b.safety_floor).toBeNull();
        expect(b.user_constraints).toEqual(CONSTRAINTS);
    });

    it('constraints are never trimmed, deduplicated or capped', () => {
        const odd = ['  leading and trailing  ', 'same', 'same', 'line one\nline two'];
        const b = composeSpawnBrief({ task: 't', user_constraints: odd });
        expect(b.user_constraints).toEqual(odd);
    });

    it('the floor sits in the cache-stable prefix, the constraints in the variable tail', () => {
        const brief = (task: string, c: string) =>
            serializeSpawnPayload(
                composeSpawnBrief({ task, omit_project_instructions: true, safety_floor: FLOOR, user_constraints: [c] }),
            );
        const a = brief('a', 'x');
        const c = brief('c', 'y');
        expect(a.split('\n')[0]).toBe(c.split('\n')[0]);
        expect(a.split('\n')[0]).toContain('SAFETY FLOOR');
    });
});
