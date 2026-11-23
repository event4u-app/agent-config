// A ratification run is demanded by the kernel-edit gate, which needs two
// providers' stances on record; the necessity classifier answering "this prompt
// does not warrant a council" for it is a verdict on a question the gate has
// already settled. Measured 2026-11-23: an agent-invoked ratification prompt
// was skipped as `unnecessary`, and only `--invocation user_explicit
// --proceed-anyway` got the record written.
import { beforeAll, describe, expect, it } from 'vitest';

const AI_CFG = { necessity_classifier: { enabled: true, mode: 'educate' } };
const TRIVIAL = 'Fix the typo and the formatting in this file.';

let gate: (opts: Record<string, unknown>) => [boolean, number, unknown];

beforeAll(async () => {
    process.env['AGENT_CONFIG_NO_EVENTS_LOG'] = '1';
    ({ _necessity_gate: gate } = (await import('../../../src/scripts/council_cli.js')) as never);
});

describe('_necessity_gate — ratification prompts', () => {
    it('an agent-invoked trivial prompt is still skipped (the gate keeps its job)', () => {
        const lines: string[] = [];
        const [proceed] = gate({ prompt: TRIVIAL, lens: 'analysis', invocation: 'agent', proceed_anyway: false, ai_cfg: AI_CFG, stdout: (l: string) => lines.push(l) });
        expect(proceed).toBe(false);
    });

    for (const mode of ['educate', 'block']) {
        it(`an agent-invoked ratification prompt proceeds under mode=${mode}`, () => {
            const lines: string[] = [];
            const [proceed, exit] = gate({
                prompt: TRIVIAL,
                lens: 'analysis',
                invocation: 'agent',
                proceed_anyway: false,
                ratification: true,
                ai_cfg: { necessity_classifier: { enabled: true, mode } },
                stdout: (l: string) => lines.push(l),
            });
            expect([proceed, exit]).toEqual([true, 0]);
            expect(lines.join('')).toContain('ratification');
        });
    }
});
