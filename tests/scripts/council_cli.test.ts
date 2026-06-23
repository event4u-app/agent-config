// Tests for src/scripts/council_cli.ts (py2ts Phase 1, ADR-094).
//
// council_cli is the non-interactive council orchestration CLI — the largest
// ai_council piece and the last one migrated. It wraps the whole ai_council
// cluster (orchestrator, clients, config, consensus, replay, solo_dispatch,
// necessity, advisors, …).
//
// These were originally golden-parity tests against the python twin. The
// python `council_cli.py` is DELETED (py2ts teardown), so the parity blocks
// are now python-free INTENT tests: they spawn the tsx twin with the same
// argv the parity cases exercised and assert the tsx CLI's OWN contract
// (exit code + the load-bearing output marker) directly. Coverage preserved:
//   - render / replay / quota / shadow-report on fixtures
//   - the argparse error / exit paths
//   - the output-path validator
//   - the cost-disclosure / estimate text (static pricing → deterministic)
//
// LIVE-SPEND paths (run / debate dispatch, the orchestrator transport) NEVER
// make real API calls here. `estimate` would construct API members from the
// real config; the TS `AnthropicClient` ctor throws without an injected SDK.
// So the `estimate` cost-output cases drive `cmd_estimate` through a harness
// that INJECTS mock members via the `members=` option, bypassing member
// construction. Static pricing makes the cost math deterministic.
//
// Per the migration convention we do NOT assert the full --help prose — only
// the exit code + the usage line.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runTsScript } from './ai_council/_harness.js';

// tests/scripts/council_cli.test.ts → two levels up is the repo root.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

interface Run {
    status: number;
    stdout: string;
    stderr: string;
}

function runTs(args: string[]): Run {
    const r = runTsScript('council_cli', args, { cwd: REPO_ROOT });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

// ── fixtures ────────────────────────────────────────────────────────

let TMP: string;
let QUESTION: string; // a free-form prompt artefact
let RESP_PLAIN: string; // a responses JSON with no consensus block
let HARNESS_TS: string;

const RESP_PLAIN_PAYLOAD = {
    schema_version: 1,
    mode: 'analysis',
    members: ['anthropic/claude-sonnet-4-5'],
    rounds: 1,
    responses: [
        {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            text: 'Hello world finding.',
            input_tokens: 10,
            output_tokens: 5,
            latency_ms: 0,
            error: null,
            metadata: {},
        },
    ],
};

// Injected-member estimate harness. A fixed mock-member set + a fake settings
// dict (council enabled, real provider names) + the real static price table →
// deterministic cost output without constructing API clients (no spend).
// argv: <question-file> <rounds-or-empty> <debate-flag "1"|"">.
function tsHarness(root: string): string {
    return `import { cmd_estimate } from ${JSON.stringify(path.join(root, 'src/scripts/council_cli.ts'))};
import { ExternalAIClient, CouncilResponse } from ${JSON.stringify(
        path.join(root, 'src/scripts/ai_council/clients.ts'),
    )};
import { load_prices } from ${JSON.stringify(path.join(root, 'src/scripts/ai_council/pricing.ts'))};

class Mock extends ExternalAIClient {
    constructor(n, m, b = true) {
        super();
        this.name = n;
        this.model = m;
        this.billable = b;
    }
    ask() {
        return new CouncilResponse({ provider: this.name, model: this.model, text: 'x' });
    }
}

const members = [new Mock('anthropic', 'claude-sonnet-4-5'), new Mock('openai', 'gpt-4o')];
const settings = {
    ai_council: {
        enabled: true,
        members: { anthropic: { enabled: true }, openai: { enabled: true } },
    },
};
const qfile = process.argv[2];
const roundsArg = process.argv[3] ?? '';
const debateArg = process.argv[4] ?? '';
const rounds = roundsArg ? Number(roundsArg) : null;
const debate = debateArg === '1';
const args = {
    cmd: 'estimate',
    question: qfile,
    input_mode: 'prompt',
    prompt_mode: null,
    max_tokens: null,
    mode_override: null,
    model: null,
    siblings: null,
    original_ask: '',
    peer_review: false,
    output: null,
    confirm: false,
    rounds,
    depth: 'standard',
    invocation: 'agent',
    proceed_anyway: false,
    single: false,
    prose_synthesis: null,
    auto_continue: false,
    continue_as_debate: null,
    responses: null,
    include_member_arguments: null,
    low_impact_stats: false,
    reset: null,
    log: null,
    window_days: 7,
    debate,
};
const rc = cmd_estimate(args, { settings, members, table: load_prices() });
process.exitCode = rc;
`;
}

// Spawn the real tsx estimate harness (live, no spend — members are injected).
function runHarnessTs(qfile: string, rounds: string, debate: string): Run {
    const r = spawnSync(TSX_BIN, [HARNESS_TS, qfile, rounds, debate], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return {
        status: r.status ?? -1,
        stdout: r.stdout ?? '',
        stderr: r.stderr ?? '',
    };
}

beforeAll(() => {
    TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'council-cli-'));
    QUESTION = path.join(TMP, 'q.txt');
    fs.writeFileSync(QUESTION, 'Should we adopt a hexagonal architecture for the billing module?\n');
    RESP_PLAIN = path.join(TMP, 'resp.json');
    fs.writeFileSync(RESP_PLAIN, JSON.stringify(RESP_PLAIN_PAYLOAD));
    HARNESS_TS = path.join(TMP, 'est_harness.ts');
    fs.writeFileSync(HARNESS_TS, tsHarness(REPO_ROOT));
});

afterAll(() => {
    if (TMP) {
        fs.rmSync(TMP, { recursive: true, force: true });
    }
});

const TOP_USAGE = 'usage: agent-config council [-h]';

// ── argparse / dispatch error intent (no member construction) ───────

describe('council_cli CLI — argparse intent', () => {
    it('no subcommand: exit 2 + usage + missing-cmd error', () => {
        const ts = runTs([]);
        expect(ts.status, 'exit code').toBe(2);
        expect(ts.stderr.split('\n')[0]).toBe(TOP_USAGE);
        expect(ts.stderr).toContain('error: the following arguments are required: cmd');
    });

    it('bad subcommand: exit 2 + usage + invalid-choice error', () => {
        const ts = runTs(['bogus']);
        expect(ts.status, 'exit code').toBe(2);
        expect(ts.stderr.split('\n')[0]).toBe(TOP_USAGE);
        expect(ts.stderr).toContain("error: argument cmd: invalid choice: 'bogus'");
    });

    it('--help: exit 0 + top usage line (prose not asserted)', () => {
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(ts.stdout.split('\n')[0]).toBe(TOP_USAGE);
    });

    // Group A — main-caught validation (ArgumentTypeError / ValueError) →
    // a `❌ council:<cmd>:` line with no usage block — and the two
    // unrecognized-flag cases that bubble to the fixed top-level usage.
    for (const [label, args, marker] of [
        [
            'estimate bad --model shape (main-caught)',
            ['estimate', '__Q__', '--model', 'badshape'],
            "❌  council:estimate: --model expects '<member>=<model-id>', got 'badshape'.",
        ],
        [
            'estimate empty --model member (main-caught)',
            ['estimate', '__Q__', '--model', '=x'],
            "❌  council:estimate: --model member and model-id must both be non-empty: '=x'.",
        ],
        [
            'estimate bad --siblings (1 model, main-caught)',
            ['estimate', '__Q__', '--siblings', 'anthropic=only-one'],
            "❌  council:estimate: --siblings requires ≥ 2 distinct models for 'anthropic', got ['only-one'].",
        ],
        [
            'run unrecognized flag (top usage)',
            ['run', '__Q__', '--output', 'x', '--bogus'],
            'error: unrecognized arguments: --bogus',
        ],
        [
            'estimate unrecognized flag (top usage)',
            ['estimate', '__Q__', '--bogus'],
            'error: unrecognized arguments: --bogus',
        ],
    ] as const) {
        it(`arg error: exit 2 + error line — ${label}`, () => {
            const concrete = (args as readonly string[]).map((a) =>
                a === '__Q__' ? QUESTION : a === '__R__' ? RESP_PLAIN : a,
            );
            const ts = runTs(concrete);
            expect(ts.status, 'exit code').toBe(2);
            expect(ts.stderr).toContain(marker);
        });
    }

    // Group B — subparser validation errors (choices / required). argparse
    // prints the full per-subcommand usage block before the `error:` line.
    // Per the migration convention we do NOT assert usage prose — assert
    // exit 2, the subcommand usage prefix, and the final `prog: error: …`
    // line (the load-bearing semantics).
    function lastLine(s: string): string {
        const lines = s.replace(/\n$/, '').split('\n');
        return lines[lines.length - 1] ?? '';
    }
    for (const [label, args, errLine] of [
        [
            'run missing --output (required)',
            ['run', '__Q__'],
            'agent-config council run: error: the following arguments are required: --output',
        ],
        [
            'run bad --depth choice',
            ['run', '__Q__', '--depth', 'bogus'],
            "agent-config council run: error: argument --depth: invalid choice: 'bogus' (choose from 'standard', 'deep')",
        ],
        [
            'render bad --prompt-mode choice',
            ['render', '__R__', '--prompt-mode', 'nope'],
            "agent-config council render: error: argument --prompt-mode: invalid choice: 'nope' (choose from 'default', 'pr', 'design', 'optimize', 'analysis', 'prompt', 'roadmap', 'diff', 'files')",
        ],
        [
            'estimate bad --input-mode choice',
            ['estimate', '__Q__', '--input-mode', 'nope'],
            "agent-config council estimate: error: argument --input-mode: invalid choice: 'nope' (choose from 'prompt', 'roadmap')",
        ],
    ] as const) {
        it(`arg error: exit 2 + error line + usage prefix — ${label}`, () => {
            const concrete = (args as readonly string[]).map((a) =>
                a === '__Q__' ? QUESTION : a === '__R__' ? RESP_PLAIN : a,
            );
            const ts = runTs(concrete);
            expect(ts.status, 'exit code').toBe(2);
            expect(lastLine(ts.stderr), 'error line').toBe(errLine);
            const cmd = concrete[0] as string;
            const prefix = `usage: agent-config council ${cmd} [-h]`;
            expect(ts.stderr.startsWith(prefix), 'usage prefix').toBe(true);
        });
    }
});

// ── quota / shadow-report (read-only, no member construction) ───────

describe('council_cli quota + shadow-report — intent', () => {
    it('quota (no configured caps in user-global config) → exit 0', () => {
        const ts = runTs(['quota']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('council:quota · no providers have a configured cli_call_budget.max_calls_per_day cap.');
    });

    it('quota --reset openai without --confirm → exit 2', () => {
        const ts = runTs(['quota', '--reset', 'openai']);
        expect(ts.status, 'exit code').toBe(2);
        expect(ts.stderr).toContain('❌  council:quota: --reset openai requires --confirm.');
    });

    it('shadow-report with an empty / missing log → exit 0', () => {
        // Point at a non-existent log so the result is deterministic
        // regardless of the developer's local shadow-log.jsonl.
        const missing = path.join(TMP, 'no-such-shadow.jsonl');
        const ts = runTs(['shadow-report', '--log', missing]);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('[shadow SLO] no samples yet');
    });
});

// ── render (re-render a saved responses JSON) ───────────────────────

describe('council_cli render — intent', () => {
    it('render to stdout (default decision-lens template)', () => {
        const ts = runTs(['render', RESP_PLAIN]);
        expect(ts.status).toBe(0);
        // The saved member response is echoed, then the analysis-lens summary.
        expect(ts.stdout).toContain('## anthropic · claude-sonnet-4-5');
        expect(ts.stdout).toContain('Hello world finding.');
        expect(ts.stdout).toContain('## Convergence / Divergence');
        expect(ts.stdout).toContain('analysis-lens shape');
    });

    it('render --prompt-mode pr (lens override)', () => {
        const ts = runTs(['render', RESP_PLAIN, '--prompt-mode', 'pr']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('## Convergence / Divergence');
        // The PR lens swaps in the PR-review shape.
        expect(ts.stdout).toContain('PR-review shape');
    });

    it('render --prose-synthesis (R4 Q4 escape hatch)', () => {
        const ts = runTs(['render', RESP_PLAIN, '--prose-synthesis']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('## Convergence / Divergence');
        // The escape hatch defers synthesis to the host agent.
        expect(ts.stdout).toContain('*to be summarised by the host agent*');
    });
});

// ── replay (decision-replay re-render + low-impact stats) ───────────

describe('council_cli replay — intent', () => {
    it('replay on a payload with no consensus block → exit 2', () => {
        const ts = runTs(['replay', RESP_PLAIN]);
        expect(ts.status, 'exit code').toBe(2);
        expect(ts.stderr).toContain('❌  council:replay: payload has no `consensus` block');
    });

    it('replay --low-impact-stats with no resolutions log alongside → exit 0', () => {
        const ts = runTs(['replay', RESP_PLAIN, '--low-impact-stats']);
        expect(ts.status).toBe(0);
        // The line echoes the volatile RESP_PLAIN path; assert the stable prefix
        // + suffix that frame it instead of the full path.
        expect(ts.stdout).toContain('council:replay · no low-impact-resolutions.md alongside');
        expect(ts.stdout).toContain('session had no fast-path entries.');
    });
});

// ── output-path validator ───────────────────────────────────────────
// The validator fires at WRITE time. For `run` it only fires after
// `--confirm` (so a non-confirmed `run` prints the estimate, not the
// error). `render --output` validates immediately. We test the render
// path with a non-canonical absolute target so no spend / member
// construction happens.

describe('council_cli output-path validation — intent', () => {
    it('render --output outside agents/runtime/council/sessions → exit 2, nothing written', () => {
        const badOut = path.join(TMP, 'not-canonical.md');
        const ts = runTs(['render', RESP_PLAIN, '--output', badOut]);
        expect(ts.status, 'exit code').toBe(2);
        expect(ts.stderr).toContain(
            'council:render --output must live under agents/runtime/council/sessions/',
        );
        // The error echoes the rejected --output path.
        expect(ts.stderr).toContain(badOut);
        // Sanity: nothing written.
        expect(fs.existsSync(badOut)).toBe(false);
    });
});

// ── render --output to the canonical (gitignored) dir, snapshot+restore ─

describe('council_cli render --output (canonical dir) — intent', () => {
    const SESSIONS_REL = 'agents/runtime/council/sessions';

    function snapshot(dir: string): { existed: boolean } {
        const abs = path.join(REPO_ROOT, dir);
        return { existed: fs.existsSync(abs) };
    }

    it('render --output writes the rendered file under the canonical dir', () => {
        const abs = path.join(REPO_ROOT, SESSIONS_REL);
        const before = snapshot(SESSIONS_REL);
        const tsRel = `${SESSIONS_REL}/__cc_test_ts.md`;
        const tsAbs = path.join(REPO_ROOT, tsRel);
        try {
            const ts = runTs(['render', RESP_PLAIN, '--output', tsRel]);
            expect(ts.status).toBe(0);
            // stdout confirms the write to the canonical relative path.
            expect(ts.stdout).toContain(`council:render · wrote ${tsRel}`);
            // The written body is the rendered template (member + summary).
            expect(fs.existsSync(tsAbs), 'file written').toBe(true);
            const body = fs.readFileSync(tsAbs, 'utf8');
            expect(body).toContain('## anthropic · claude-sonnet-4-5');
            expect(body).toContain('Hello world finding.');
            expect(body).toContain('## Convergence / Divergence');
        } finally {
            // Restore: delete the file we created. If the dir did not exist
            // before and is now empty, remove it too.
            if (fs.existsSync(tsAbs)) {
                fs.rmSync(tsAbs, { force: true });
            }
            if (!before.existed && fs.existsSync(abs) && fs.readdirSync(abs).length === 0) {
                fs.rmdirSync(abs);
            }
        }
    });
});

// ── estimate / debate-estimate cost output (injected mock members) ──
// The injected mock member set + the real static price table → deterministic
// cost math (the `:.4f` round-half-even formatting). No API client is
// constructed → no spend.

describe('council_cli estimate cost-output — intent (injected members)', () => {
    it('estimate · single-shot cost preview', () => {
        const ts = runHarnessTs(QUESTION, '', '');
        expect(ts.status, 'exit code').toBe(0);
        expect(ts.stdout).toContain('council:estimate · mode=prompt · members=2 (billable=2)');
        // Per-member cost lines (round-half-even, 4 decimals) + the TOTAL.
        expect(ts.stdout).toMatch(/anthropic\/claude-sonnet-4-5: ~\d+ in \+ \d+ out\s+=\s+\$\d+\.\d{4}/);
        expect(ts.stdout).toMatch(/TOTAL:\s+\$\d+\.\d{4}/);
    });

    it('estimate --debate --rounds 2 · round-by-round projection', () => {
        const ts = runHarnessTs(QUESTION, '2', '1');
        expect(ts.status, 'exit code').toBe(0);
        expect(ts.stdout).toContain('council:estimate · mode=debate · members=2 (billable=2) · rounds=2 (cap=4)');
        expect(ts.stdout).toContain('Round 1 of 2:');
        expect(ts.stdout).toContain('Round 2 of 2:');
        expect(ts.stdout).toMatch(/PROJECTED TOTAL \(2 rounds\):\s+\$\d+\.\d{4}/);
    });
});
