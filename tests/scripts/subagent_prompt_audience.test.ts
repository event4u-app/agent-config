import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Memory is cut per audience (subagent-spawn-contract § Memory audience). An implementer
// gets a few knowledge references, labelled as leads; a competing candidate, a debating
// judge and an adversarial skeptic get none, because a shared lead collapses the
// independence those modes exist to buy.
const root = path.resolve(__dirname, '..', '..');
const promptsDir = path.join(root, 'src/skills/subagent-orchestration/prompts');
const contractPath = path.join(root, 'src/agent-src/contexts/execution/subagent-spawn-contract.md');
const councilSkillPath = path.join(root, 'src/skills/ai-council/SKILL.md');
const SLOT = '{{knowledge_refs}}';
const INDEPENDENT_MODES = ['do-competitively.md', 'judge-with-debate.md', 'adversarial-verification-council.md'];

function templates(): string[] {
    return readdirSync(promptsDir).filter((f) => f.endsWith('.md') && f !== 'README.md');
}

function roleBlocks(file: string): Array<{ role: string; block: string }> {
    return readFileSync(path.join(promptsDir, file), 'utf8')
        .split('```')
        .filter((_, i) => i % 2 === 1)
        .map((block) => ({ role: /You are ([^\n.]+)/.exec(block)?.[1]?.trim() ?? '', block }))
        .filter((b) => b.role !== '');
}

const implementers = templates()
    .filter((f) => !INDEPENDENT_MODES.includes(f))
    .flatMap((file) =>
        roleBlocks(file)
            .filter((b) => /^the implementer/.test(b.role))
            .map((b): [string, string] => [`${file} — ${b.role}`, b.block]),
    );

const nonImplementers = templates().flatMap((file) =>
    roleBlocks(file)
        .filter((b) => INDEPENDENT_MODES.includes(file) || !/^the implementer/.test(b.role))
        .map((b): [string, string] => [`${file} — ${b.role}`, b.block]),
);

describe('implementer templates carry a knowledge slot labelled as leads', () => {
    it('finds the implementer prompts', () => {
        expect(implementers.length).toBe(5);
    });

    it.each(implementers)('%s carries the slot', (_name, block) => {
        expect(block).toContain(SLOT);
        const line = block.split('\n').find((l) => l.includes(SLOT)) ?? '';
        const preceding = block.slice(0, block.indexOf(SLOT));
        expect(`${preceding.slice(-400)}${line}`).toMatch(/\bleads?\b/i);
    });
});

describe('independent-verdict and judge prompts carry no knowledge slot', () => {
    it.each(INDEPENDENT_MODES)('%s has no knowledge slot anywhere', (file) => {
        expect(readFileSync(path.join(promptsDir, file), 'utf8')).not.toContain(SLOT);
    });

    it.each(nonImplementers)('%s carries no slot', (_name, block) => {
        expect(block).not.toContain(SLOT);
    });
});

describe('the audience table is the single statement of the memory cut', () => {
    const contract = readFileSync(contractPath, 'utf8');

    it('the contract carries the Memory audience section with all six audiences', () => {
        expect(contract).toMatch(/^## Memory audience/m);
        const section = contract.slice(contract.indexOf('## Memory audience'));
        for (const audience of ['orchestrator', 'non-fork', 'fork', 'judge-seat', 'unpaid', 'cheap-paid']) {
            expect(section).toMatch(new RegExp(`^\\| \\*\\*${audience}\\*\\* \\|`, 'm'));
        }
    });

    it('the council skill cites the anchor from its neutrality section', () => {
        const skill = readFileSync(councilSkillPath, 'utf8');
        const start = skill.indexOf('## Neutrality guidelines');
        const end = skill.indexOf('\n## ', start + 1);
        const neutrality = skill.slice(start, end);
        expect(neutrality).toContain('subagent-spawn-contract.md#memory-audience');
    });
});
