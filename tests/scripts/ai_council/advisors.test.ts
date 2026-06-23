// Tests for src/scripts/ai_council/advisors.ts (py2ts Phase 1).
//
// advisors selects advisor personas (frontmatter strip + condensed-tree
// preference + one-advisor-per-provider invariant).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    AdvisorPlan,
    build_persona_labels,
    plan_advisor_swap,
    resolve_persona_text,
} from '../../../src/scripts/ai_council/advisors.js';
import type { AdvisorConfig } from '../../../src/scripts/ai_council/config.js';

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'advisors-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length) {
        fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
    }
});

function writePersona(root: string, tree: string, relPath: string, body: string): void {
    const full = path.join(root, tree, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf-8');
}

function adv(partial: Partial<AdvisorConfig> & { name: string; member: string }): AdvisorConfig {
    return {
        name: partial.name,
        enabled: partial.enabled ?? true,
        member: partial.member,
        persona: partial.persona ?? 'personas/p.md',
        model: partial.model ?? null,
    };
}

// ── Unit tests ───────────────────────────────────────────────────────

describe('advisors — resolve_persona_text', () => {
    it('reads condensed tree, strips frontmatter, returns trimmed body + meta', () => {
        const root = mkTmp();
        writePersona(
            root,
            'dist/agent-src',
            'personas/c.md',
            '---\nrole: The Contrarian\nx: 1\n---\nBody line.\n\nMore.\n',
        );
        const [body, meta] = resolve_persona_text('personas/c.md', root);
        expect(body).toBe('Body line.\n\nMore.');
        expect(meta).toEqual({ role: 'The Contrarian', x: 1 });
    });
    it('falls back to uncondensed tree', () => {
        const root = mkTmp();
        writePersona(root, '.agent-src.uncondensed', 'personas/u.md', 'No frontmatter here.\n');
        const [body, meta] = resolve_persona_text('personas/u.md', root);
        expect(body).toBe('No frontmatter here.');
        expect(meta).toEqual({});
    });
    it('prefers condensed over uncondensed', () => {
        const root = mkTmp();
        writePersona(root, 'dist/agent-src', 'personas/d.md', 'CONDENSED');
        writePersona(root, '.agent-src.uncondensed', 'personas/d.md', 'UNCONDENSED');
        expect(resolve_persona_text('personas/d.md', root)[0]).toBe('CONDENSED');
    });
    it('raises CouncilConfigError when no candidate exists', () => {
        const root = mkTmp();
        expect(() => resolve_persona_text('personas/nope.md', root)).toThrow(
            /Persona file not found for advisor \(path='personas\/nope.md'\)/,
        );
    });
});

describe('advisors — plan_advisor_swap', () => {
    it('skips disabled, builds plan per enabled advisor', () => {
        const root = mkTmp();
        writePersona(root, 'dist/agent-src', 'personas/contra.md', '---\nrole: Contra\n---\nC body');
        writePersona(root, 'dist/agent-src', 'personas/red.md', 'Red body');
        const advisors = new Map<string, AdvisorConfig>([
            ['contrarian', adv({ name: 'contrarian', member: 'anthropic', persona: 'personas/contra.md' })],
            ['red-team', adv({ name: 'red-team', member: 'openai', persona: 'personas/red.md', model: 'gpt-x' })],
            ['off', adv({ name: 'off', member: 'google', persona: 'personas/contra.md', enabled: false })],
        ]);
        const plans = plan_advisor_swap(advisors, root);
        expect([...plans.keys()].sort()).toEqual(['anthropic', 'openai']);
        expect(plans.get('anthropic')!.display_name).toBe('Contra');
        const red = plans.get('openai')!;
        expect(red.display_name).toBe('Red Team'); // titleized from key
        expect(red.persona_text).toBe('Red body');
        expect(red.model_override).toBe('gpt-x');
    });
    it('raises when two enabled advisors bind the same provider', () => {
        const root = mkTmp();
        writePersona(root, 'dist/agent-src', 'personas/p.md', 'body');
        const advisors = new Map<string, AdvisorConfig>([
            ['a', adv({ name: 'a', member: 'anthropic', persona: 'personas/p.md' })],
            ['b', adv({ name: 'b', member: 'anthropic', persona: 'personas/p.md' })],
        ]);
        expect(() => plan_advisor_swap(advisors, root)).toThrow(
            /advisors.b and advisors.a both bind member='anthropic'/,
        );
    });
});

describe('advisors — build_persona_labels', () => {
    it('maps provider:model → display_name for matching members only', () => {
        const plans = new Map<string, AdvisorPlan>([
            [
                'anthropic',
                new AdvisorPlan({
                    name: 'contrarian',
                    display_name: 'Contra',
                    member: 'anthropic',
                    persona_text: 'x',
                }),
            ],
        ]);
        const labels = build_persona_labels(plans, [
            { name: 'anthropic', model: 'claude' },
            { name: 'openai', model: 'gpt' },
        ]);
        expect([...labels]).toEqual([['anthropic:claude', 'Contra']]);
    });
});
