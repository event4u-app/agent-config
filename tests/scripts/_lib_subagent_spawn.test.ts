import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { KERNEL_RULE_IDS } from '../../src/scripts/_lib/kernel_rules.js';
import {
    MAX_KNOWLEDGE_REFS,
    MAX_PERSONAS,
    composeSpawnBrief,
    serializeSpawnPayload,
} from '../../src/scripts/_lib/subagent_spawn.js';
import { render_floor } from '../../src/scripts/generate_subagent_floor.js';
import { digestFor } from '../../src/scripts/hooks/subagent_constraints_hook.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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

    // road-to-a-cold-start-paid-once 2.5: the shipped definitions, not a brief no
    // production path builds. The host runs the projected file; the floor rides in
    // its body and the consumer's CLAUDE.md arrives through SubagentStart.
    it('skipping-worker-carries-kernel-and-constraints on the host Agent path', () => {
        const planted = 'PLANTED-CONSTRAINT-2a5c: never write under vendor/.';
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cold-start-2-5-')));
        const config = fs.mkdtempSync(path.join(os.tmpdir(), 'cold-start-2-5-cfg-'));
        try {
            fs.mkdirSync(path.join(root, '.git'));
            fs.mkdirSync(path.join(root, '.claude', 'agents'), { recursive: true });
            fs.writeFileSync(path.join(root, 'CLAUDE.md'), `# Consumer project\n\n${planted}\n`);
            for (const name of ['ac-worker', 'ac-researcher']) {
                const shipped = fs.readFileSync(path.join(REPO, 'docs', 'wedge', name, `${name}.md`), 'utf-8');
                fs.writeFileSync(path.join(root, '.claude', 'agents', `${name}.md`), shipped);
                const fm = /^---\n([\s\S]*?)\n---\n/.exec(shipped)?.[1] ?? '';
                expect(fm).toMatch(/^omitClaudeMd: true$/m);
                for (const id of KERNEL_RULE_IDS) expect(shipped).toContain(id);
                const digest = digestFor(
                    { event: 'subagent_start', workspace_root: root, payload: { agent_type: name } },
                    { CLAUDE_CONFIG_DIR: config },
                );
                expect(digest).toContain(planted);
            }
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(config, { recursive: true, force: true });
        }
    });
});
