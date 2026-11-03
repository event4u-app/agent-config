import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { STATE_FILE, run } from '../../src/scripts/context_hygiene_hook.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULE = fs.readFileSync(path.join(REPO, 'src/rules/context-hygiene.md'), 'utf8');
const HOOK = fs.readFileSync(path.join(REPO, 'src/scripts/context_hygiene_hook.ts'), 'utf8');

/** The enforcement header: the blockquote under the H1, up to the first blank line after it. */
function enforcementHeader(): string {
    const start = RULE.indexOf('> **Enforced by:**');
    const end = RULE.indexOf('\n\n', start);
    return RULE.slice(start, end);
}

describe('context-hygiene — the rule claims only what the hook carries', () => {
    it('every state field the rule header names is written by the hook', () => {
        const named = [...enforcementHeader().matchAll(/`([a-z_]+)`/g)].map((m) => m[1] as string);
        expect(named.length).toBeGreaterThanOrEqual(2);

        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-claims-'));
        run(JSON.stringify({ tool_name: 'Read' }), { consumer_root: root });
        const state = JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf8')) as Record<string, unknown>;
        for (const field of named) expect(Object.keys(state)).toContain(field);
    });

    it('names the 3-failure and tool-loop clauses as model-carried', () => {
        expect(enforcementHeader().replace(/\s+/g, ' ')).toMatch(/3-failure .*model-carried/i);
    });

    it('the hook no longer claims to maintain the 3-failure stop', () => {
        expect(HOOK).not.toMatch(/3-failure stop/);
    });
});

describe('bug-analyzer ships no single project root-cause list', () => {
    it('carries no "in this project" list', () => {
        const skill = fs.readFileSync(path.join(REPO, 'src/skills/bug-analyzer/SKILL.md'), 'utf8');
        expect(skill).not.toMatch(/in this project/);
    });
});
