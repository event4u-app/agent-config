import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A named subagent sees none of the conversation. Whatever the user asked for that is
// not in the dispatch prompt does not exist for it — for the implementer AND for every
// judge validating the result. So every role prompt in every shipped template carries
// the same verbatim-requirements slot, and the spawn contract states why.
const root = path.resolve(__dirname, '..', '..');
const promptsDir = path.join(root, 'src/skills/subagent-orchestration/prompts');
const SLOT = '{{user_requirements}}';

function rolePrompts(): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    for (const file of readdirSync(promptsDir).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
        const blocks = readFileSync(path.join(promptsDir, file), 'utf8')
            .split('```')
            .filter((_, i) => i % 2 === 1);
        for (const block of blocks) {
            const role = /You are ([^\n.]+)/.exec(block);
            if (role) out.push([`${file} — ${role[1]!.trim()}`, block]);
        }
    }
    return out;
}

describe('dispatch prompts carry the requirements the subagent cannot see', () => {
    const prompts = rolePrompts();

    it('finds role prompts to check', () => {
        // Guards against the parse silently matching nothing.
        expect(prompts.length).toBeGreaterThanOrEqual(15);
    });

    it.each(prompts)('%s carries the verbatim-requirements slot', (_name, block) => {
        expect(block).toContain(SLOT);
    });

    it('the spawn contract states that a named subagent does not see the conversation', () => {
        const contract = readFileSync(
            path.join(root, 'src/agent-src/contexts/execution/subagent-spawn-contract.md'),
            'utf8',
        );
        expect(contract).toMatch(/sees none of the conversation/);
        expect(contract).toContain(SLOT);
    });
});
