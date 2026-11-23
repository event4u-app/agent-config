// `council:run` on a ratification prompt, driven end to end with injected seats
// (no spend). Two defects measured 2026-11-23 meet here:
//   - the necessity gate skipped an agent-invoked ratification prompt as
//     `unnecessary`, so only `--invocation user_explicit --proceed-anyway`
//     produced the record;
//   - the final round handed the seat the generic STANCE contract and the
//     inline-findings block on top of the prompt's own ratification line.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const SUBJECT = 'a'.repeat(64);

function harness(): string {
    return `import * as fs from 'node:fs';
import { cmd_run } from ${JSON.stringify(path.join(ROOT, 'src/scripts/council_cli.ts'))};
import { ExternalAIClient, CouncilResponse } from ${JSON.stringify(path.join(ROOT, 'src/scripts/ai_council/clients.ts'))};
import { load_prices } from ${JSON.stringify(path.join(ROOT, 'src/scripts/ai_council/pricing.ts'))};
const log = process.argv[4];
class Seat extends ExternalAIClient {
    constructor(n) { super(); this.name = n; this.model = n + '-m'; this.billable = false; }
    ask(_system, user) {
        fs.appendFileSync(log, JSON.stringify(user) + '\\n');
        return new CouncilResponse({ provider: this.name, model: this.model, text: 'ok\\n\\nSTANCE: ratified | CONFIDENCE: high | DEALBREAKER: no', error: null });
    }
}
const settings = { ai_council: { enabled: true, members: { anthropic: { enabled: true } },
    necessity_classifier: { enabled: true, mode: 'educate' },
    consensus_scoring: { enabled: true, inline_findings: true } } };
const args = { cmd: 'run', question: process.argv[2], input_mode: 'prompt', prompt_mode: 'analysis', max_tokens: null,
    mode_override: null, model: null, siblings: null, original_ask: '', peer_review: false, output: process.argv[3],
    confirm: true, rounds: 1, depth: 'standard', invocation: 'agent', proceed_anyway: false, single: false,
    prose_synthesis: null, auto_continue: false, continue_as_debate: null, responses: null,
    include_member_arguments: null, low_impact_stats: false, reset: null, log: null, window_days: 7, debate: false };
process.exitCode = cmd_run(args, { settings, members: [new Seat('anthropic')], table: load_prices() });
`;
}

let TMP = '';
beforeAll(() => {
    TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ratification-run-'));
    fs.writeFileSync(path.join(TMP, 'h.ts'), harness());
});
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

function run(question: string): { stdout: string; prompts: string[] } {
    const q = path.join(TMP, `q-${Math.random().toString(36).slice(2)}.md`);
    const log = `${q}.log`;
    fs.writeFileSync(q, question);
    const outRel = `agents/runtime/council/responses/__test-ratification-${path.basename(q)}.json`;
    fs.mkdirSync(path.join(ROOT, path.dirname(outRel)), { recursive: true });
    try {
        const r = spawnSync(TSX, [path.join(TMP, 'h.ts'), q, outRel, log], {
            cwd: ROOT, encoding: 'utf8', env: { ...process.env, AGENT_CONFIG_NO_EVENTS_LOG: '1' },
        });
        const prompts = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as string) : [];
        return { stdout: `${r.stdout}${r.stderr}`, prompts };
    } finally {
        fs.rmSync(path.join(ROOT, outRel), { force: true });
    }
}

const TRIVIAL = 'Fix the typo and the formatting in this file.';
const RATIFICATION = `${TRIVIAL}\n\n\`subject: ${SUBJECT}\`\n\nClose your reply with exactly one line:\n\n\`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>\`\n`;

describe('council:run on a ratification prompt (injected seat)', () => {
    it('control: the same trivial prompt without a subject line is skipped by the necessity gate', () => {
        const { stdout, prompts } = run(`${TRIVIAL}\n`);
        expect(stdout).toContain('council:necessity · skipped');
        expect(prompts).toEqual([]);
    }, 60_000);

    it('an agent-invoked ratification prompt reaches the seat, with one closing contract', () => {
        const { stdout, prompts } = run(RATIFICATION);
        expect(stdout).toContain('council:necessity · bypassed');
        expect(prompts.length).toBeGreaterThan(0);
        const final = prompts.find((p) => p.includes(SUBJECT)) as string;
        expect(final).toContain('confirmed-non-expanding');
        expect(final).not.toContain('<option-label>');
        expect(final).not.toContain('After your analysis');
    }, 60_000);
});
