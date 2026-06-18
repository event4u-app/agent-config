// Tests for src/scripts/council_cli.ts (py2ts Phase 1, ADR-094).
//
// council_cli is the non-interactive council orchestration CLI — the largest
// ai_council piece and the last one migrated. It wraps the whole ai_council
// cluster (orchestrator, clients, config, consensus, replay, solo_dispatch,
// necessity, advisors, …).
//
// Golden parity: run the REAL python3 script and the tsx twin with identical
// argv and assert byte-identical stdout/stderr/exit for the SIDE-EFFECT-FREE,
// NON-SPENDING surfaces:
//   - render / replay / quota / shadow-report on fixtures
//   - the argparse error / exit paths
//   - the output-path validator
//   - the cost-disclosure / estimate text (static pricing → deterministic)
//
// LIVE-SPEND paths (run / debate dispatch, the orchestrator transport) NEVER
// make real API calls here. `estimate` would construct API members from the
// real config; the TS `AnthropicClient` ctor throws without an injected SDK
// (a pre-existing clients.ts divergence — Python defers the SDK import to call
// time). So `estimate` byte-parity is driven through a harness that INJECTS
// mock members on both sides via the `members=` kwarg, bypassing member
// construction. Static pricing makes the cost math deterministic.
//
// Per the migration convention we do NOT byte-compare the full --help prose —
// only the exit code + the usage line.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { oracle2, oracleFile } from '../_lib/parity_oracle.js';
import { hasPython3, runPyScript, runTsScript } from './ai_council/_harness.js';

const py3 = hasPython3();

// tests/scripts/council_cli.test.ts → two levels up is the repo root.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

interface Run {
    status: number;
    stdout: string;
    stderr: string;
    // v3 file-sink — frozen python file side-effects, present only when the
    // call declared `outputs`. Decode with `oracleFile(run, name)`.
    files?: Record<string, string | null>;
}

function pyEnv(): NodeJS.ProcessEnv {
    const src = path.join(REPO_ROOT, 'src');
    const existing = process.env.PYTHONPATH;
    const parts = [src, REPO_ROOT];
    if (existing) {
        parts.push(existing);
    }
    return { ...process.env, PYTHONPATH: parts.join(path.delimiter) };
}

interface RunOpts {
    // Volatile abs paths passed in argv → collapsed to a stable `<scratch:i>`
    // token in the snapshot KEY (oracle side) so capture/replay resolve to the
    // same golden. The spawn still receives the real path.
    scratch?: string[];
    // Symmetric normalize: applied to the python golden (oracle, capture+replay)
    // AND to the live `.ts` twin output before comparison. Strips volatile path
    // text that the command echoes into stdout/stderr.
    normalize?: (s: string) => string;
    // v3 file-sink — python file side-effects to freeze (logical name → path).
    outputs?: Record<string, string>;
}

function runPy(args: string[], opts: RunOpts = {}): Run {
    const r = runPyScript('council_cli', args, {
        cwd: REPO_ROOT,
        ...(opts.scratch !== undefined ? { scratch: opts.scratch } : {}),
        ...(opts.normalize !== undefined ? { normalize: opts.normalize } : {}),
        ...(opts.outputs !== undefined ? { outputs: opts.outputs } : {}),
    });
    return {
        status: r.status ?? -1,
        stdout: r.stdout,
        stderr: r.stderr,
        ...(r.files !== undefined ? { files: r.files } : {}),
    };
}

function runTs(args: string[], opts: RunOpts = {}): Run {
    const r = runTsScript('council_cli', args, { cwd: REPO_ROOT });
    const norm = opts.normalize ?? ((s: string): string => s);
    return { status: r.status ?? -1, stdout: norm(r.stdout), stderr: norm(r.stderr) };
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

// Injected-member estimate harness. Identical mock-member set on both sides;
// a fake settings dict (council enabled, real provider names) plus the real
// static price table → deterministic cost output without constructing API
// clients. argv: <question-file> <rounds-or-empty> <debate-flag "1"|"">.
//
// rounds/debate are read from argv (NOT env) so the oracle folds them into the
// snapshot key — the single-shot and the --debate --rounds-2 case resolve to
// distinct frozen goldens. The PY side runs through the inline oracle
// (kind:inline) so no live python3 in normal mode; the TS twin is spawned live.
const PY_HARNESS = `import sys
import scripts.council_cli as cc
from scripts.ai_council.clients import ExternalAIClient, CouncilResponse
from scripts.ai_council.pricing import load_prices


class Mock(ExternalAIClient):
    def __init__(self, name, model, billable=True):
        self.name = name
        self.model = model
        self.billable = billable

    def ask(self, system_prompt, user_prompt, max_tokens=2048):
        return CouncilResponse(self.name, self.model, "x")


members = [Mock("anthropic", "claude-sonnet-4-5"), Mock("openai", "gpt-4o")]
settings = {
    "ai_council": {
        "enabled": True,
        "members": {"anthropic": {"enabled": True}, "openai": {"enabled": True}},
    }
}
qfile = sys.argv[1]
rounds_arg = sys.argv[2] if len(sys.argv) > 2 else ""
debate_arg = sys.argv[3] if len(sys.argv) > 3 else ""
ns_args = ["estimate", qfile]
if debate_arg == "1":
    ns_args.append("--debate")
if rounds_arg:
    ns_args += ["--rounds", rounds_arg]
args = cc.build_parser().parse_args(ns_args)
rc = cc.cmd_estimate(args, settings=settings, members=members, table=load_prices())
sys.exit(rc)
`;

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

// Symmetric normalize: the question file is a volatile per-test tmp path. The
// estimate cost output does not echo it, but normalising it on both sides keeps
// the frozen golden machine-independent even if a future cost line surfaces it.
function makeHarnessNormalize(qfile: string): (s: string) => string {
    return (s: string): string => s.split(qfile).join('<qfile>');
}

// PY side → inline oracle (kind:inline). The injected harness code is the inline
// `-c` target; rounds/debate ride in argv so they fold into the snapshot key.
// `scratch:[qfile]` collapses the volatile question path in the key; the spawn
// (capture only) still receives the real path. Normal mode replays the frozen
// golden — no live python3.
function runHarnessPy(qfile: string, rounds: string, debate: string): Run {
    const normalize = makeHarnessNormalize(qfile);
    const r = oracle2({
        kind: 'inline',
        target: PY_HARNESS,
        args: [qfile, rounds, debate],
        env: { PYTHONPATH: pyEnv().PYTHONPATH as string },
        cwd: REPO_ROOT,
        scratch: [qfile],
        normalize,
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// TS side → spawn the real tsx twin (live). Apply the SAME normalize before
// comparing against the frozen-and-normalized python golden (oracle normalize
// contract — symmetry is the caller's responsibility).
function runHarnessTs(qfile: string, rounds: string, debate: string): Run {
    const normalize = makeHarnessNormalize(qfile);
    const r = spawnSync(TSX_BIN, [HARNESS_TS, qfile, rounds, debate], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return {
        status: r.status ?? -1,
        stdout: normalize(r.stdout ?? ''),
        stderr: normalize(r.stderr ?? ''),
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

// ── argparse / dispatch error parity (no member construction) ───────

describe.runIf(py3)('council_cli CLI — argparse parity with python3', () => {
    for (const [label, args] of [
        ['no subcommand', []],
        ['bad subcommand', ['bogus']],
    ] as const) {
        it(`exit 2 + identical usage/error lines — ${label}`, () => {
            const py = runPy([...args]);
            const ts = runTs([...args]);
            expect(ts.status, 'exit code').toBe(2);
            expect(py.status, 'exit code').toBe(2);
            expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
            expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
            expect(ts.stderr.split('\n')[0]).toBe(TOP_USAGE);
        });
    }

    it('--help: exit 0 + top usage line (prose not byte-compared)', () => {
        const py = runPy(['--help']);
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(py.status).toBe(0);
        expect(ts.stdout.split('\n')[0]).toBe(TOP_USAGE);
        expect(py.stdout.split('\n')[0]).toBe(TOP_USAGE);
    });

    // Group A — FULL stderr byte-parity. These errors either route through
    // the fixed top-level usage (unrecognized args bubble to the top parser,
    // matching argparse) or are caught in `main()` as ArgumentTypeError /
    // ValueError → a `❌ council:<cmd>:` line with no usage block.
    for (const [label, args] of [
        ['estimate bad --model shape (main-caught)', ['estimate', '__Q__', '--model', 'badshape']],
        ['estimate empty --model member (main-caught)', ['estimate', '__Q__', '--model', '=x']],
        ['estimate bad --siblings (1 model, main-caught)', ['estimate', '__Q__', '--siblings', 'anthropic=only-one']],
        ['run unrecognized flag (top usage)', ['run', '__Q__', '--output', 'x', '--bogus']],
        ['estimate unrecognized flag (top usage)', ['estimate', '__Q__', '--bogus']],
    ] as const) {
        it(`arg error: exit 2 + byte-identical stderr — ${label}`, () => {
            const concrete = (args as readonly string[]).map((a) =>
                a === '__Q__' ? QUESTION : a === '__R__' ? RESP_PLAIN : a,
            );
            const py = runPy(concrete);
            const ts = runTs(concrete);
            expect(ts.status, 'exit code').toBe(2);
            expect(py.status, 'exit code').toBe(2);
            expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
            expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
        });
    }

    // Group B — subparser validation errors (choices / required). argparse
    // prints the full per-subcommand usage block (wrapped flag list) before
    // the `error:` line. Per the migration convention we do NOT byte-compare
    // usage prose — assert exit 2, the first usage line, and the final
    // `prog: error: …` line (the load-bearing semantics).
    function lastLine(s: string): string {
        const lines = s.replace(/\n$/, '').split('\n');
        return lines[lines.length - 1] ?? '';
    }
    for (const [label, args] of [
        ['run missing --output (required)', ['run', '__Q__']],
        ['run bad --depth choice', ['run', '__Q__', '--depth', 'bogus']],
        ['render bad --prompt-mode choice', ['render', '__R__', '--prompt-mode', 'nope']],
        ['estimate bad --input-mode choice', ['estimate', '__Q__', '--input-mode', 'nope']],
    ] as const) {
        it(`arg error: exit 2 + identical error line + usage prefix — ${label}`, () => {
            const concrete = (args as readonly string[]).map((a) =>
                a === '__Q__' ? QUESTION : a === '__R__' ? RESP_PLAIN : a,
            );
            const py = runPy(concrete);
            const ts = runTs(concrete);
            expect(ts.status, 'exit code').toBe(2);
            expect(py.status, 'exit code').toBe(2);
            expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
            // The trailing `prog: error: …` line is byte-identical.
            expect(lastLine(ts.stderr), 'error line byte-parity').toBe(lastLine(py.stderr));
            // Both start with the subcommand usage prefix.
            const cmd = concrete[0] as string;
            const prefix = `usage: agent-config council ${cmd} [-h]`;
            expect(ts.stderr.startsWith(prefix), 'ts usage prefix').toBe(true);
            expect(py.stderr.startsWith(prefix), 'py usage prefix').toBe(true);
        });
    }
});

// ── quota / shadow-report (read-only, no member construction) ───────

describe.runIf(py3)('council_cli quota + shadow-report — byte-parity', () => {
    it('quota (no configured caps in user-global config)', () => {
        const py = runPy(['quota']);
        const ts = runTs(['quota']);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
    });

    it('quota --reset openai without --confirm → exit 2', () => {
        const py = runPy(['quota', '--reset', 'openai']);
        const ts = runTs(['quota', '--reset', 'openai']);
        expect(ts.status, 'exit code').toBe(2);
        expect(py.status, 'exit code').toBe(2);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
    });

    it('shadow-report with an empty / missing log', () => {
        // Point at a non-existent log so the result is deterministic
        // regardless of the developer's local shadow-log.jsonl.
        const missing = path.join(TMP, 'no-such-shadow.jsonl');
        const py = runPy(['shadow-report', '--log', missing]);
        const ts = runTs(['shadow-report', '--log', missing]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
    });
});

// ── render (re-render a saved responses JSON) ───────────────────────

describe.runIf(py3)('council_cli render — byte-parity', () => {
    it('render to stdout (default decision-lens template)', () => {
        const py = runPy(['render', RESP_PLAIN]);
        const ts = runTs(['render', RESP_PLAIN]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
        expect(ts.status).toBe(0);
    });

    it('render --prompt-mode pr (lens override)', () => {
        const py = runPy(['render', RESP_PLAIN, '--prompt-mode', 'pr']);
        const ts = runTs(['render', RESP_PLAIN, '--prompt-mode', 'pr']);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
    });

    it('render --prose-synthesis (R4 Q4 escape hatch)', () => {
        const py = runPy(['render', RESP_PLAIN, '--prose-synthesis']);
        const ts = runTs(['render', RESP_PLAIN, '--prose-synthesis']);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
    });
});

// ── replay (decision-replay re-render + low-impact stats) ───────────

describe.runIf(py3)('council_cli replay — byte-parity', () => {
    it('replay on a payload with no consensus block → exit 2', () => {
        const py = runPy(['replay', RESP_PLAIN]);
        const ts = runTs(['replay', RESP_PLAIN]);
        expect(ts.status, 'exit code').toBe(2);
        expect(py.status, 'exit code').toBe(2);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
    });

    it('replay --low-impact-stats with no resolutions log alongside', () => {
        // The "no low-impact-resolutions.md alongside <RESP_PLAIN>" line echoes
        // the volatile tmp path. Collapse it symmetrically (oracle golden + live
        // ts twin) to a stable token, and key the snapshot via scratch.
        const norm = (s: string): string => s.split(RESP_PLAIN).join('<resp>');
        const opts = { scratch: [RESP_PLAIN], normalize: norm };
        const py = runPy(['replay', RESP_PLAIN, '--low-impact-stats'], opts);
        const ts = runTs(['replay', RESP_PLAIN, '--low-impact-stats'], opts);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
        expect(ts.status).toBe(0);
    });
});

// ── output-path validator ───────────────────────────────────────────
// The validator fires at WRITE time. For `run` it only fires after
// `--confirm` (so a non-confirmed `run` prints the estimate, not the
// error). `render --output` validates immediately. We test the render
// path with a non-canonical absolute target so no spend / member
// construction happens.

describe.runIf(py3)('council_cli output-path validation — byte-parity', () => {
    it('render --output outside agents/runtime/council/sessions → exit 2', () => {
        const badOut = path.join(TMP, 'not-canonical.md');
        // The validator error echoes the volatile `--output` abs path; collapse
        // it symmetrically and key the snapshot on it via scratch.
        const norm = (s: string): string => s.split(badOut).join('<badout>');
        const opts = { scratch: [badOut], normalize: norm };
        const py = runPy(['render', RESP_PLAIN, '--output', badOut], opts);
        const ts = runTs(['render', RESP_PLAIN, '--output', badOut], opts);
        expect(ts.status, 'exit code').toBe(2);
        expect(py.status, 'exit code').toBe(2);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
        // Sanity: nothing written.
        expect(fs.existsSync(badOut)).toBe(false);
    });
});

// ── render --output to the canonical (gitignored) dir, snapshot+restore ─

describe.runIf(py3)('council_cli render --output (canonical dir) — byte-parity', () => {
    const SESSIONS_REL = 'agents/runtime/council/sessions';

    function snapshot(dir: string): { existed: boolean; entries: Set<string> } {
        const abs = path.join(REPO_ROOT, dir);
        if (!fs.existsSync(abs)) {
            return { existed: false, entries: new Set() };
        }
        return { existed: true, entries: new Set(fs.readdirSync(abs)) };
    }

    it('render --output writes byte-identical files + identical stdout', () => {
        const abs = path.join(REPO_ROOT, SESSIONS_REL);
        const before = snapshot(SESSIONS_REL);
        const pyRel = `${SESSIONS_REL}/__cc_test_py.md`;
        const tsRel = `${SESSIONS_REL}/__cc_test_ts.md`;
        const created: string[] = [];
        try {
            // PY side is a file-sink: the observable is the WRITTEN file, not
            // stdout. `outputs: { rendered: pyRel }` freezes the written bytes
            // into the snapshot (capture, while .py exists) and replays them in
            // normal mode — python is NOT spawned, so the file is never written
            // to the repo on replay. The TS twin still writes its file live.
            const py = runPy(['render', RESP_PLAIN, '--output', pyRel], {
                outputs: { rendered: pyRel },
            });
            const ts = runTs(['render', RESP_PLAIN, '--output', tsRel]);
            created.push(path.join(REPO_ROOT, tsRel));
            expect(py.status).toBe(0);
            expect(ts.status).toBe(0);
            // stdout differs only in the echoed filename; normalise it.
            const pyOut = py.stdout.replace('__cc_test_py.md', '__OUT__');
            const tsOut = ts.stdout.replace('__cc_test_ts.md', '__OUT__');
            expect(tsOut, 'stdout byte-parity (filename normalised)').toBe(pyOut);
            expect(ts.stderr).toBe(py.stderr);
            // Written file bodies must be byte-identical. The python body is the
            // frozen golden (oracleFile); the ts body is the live-written file.
            const pyBytes = oracleFile(py, 'rendered');
            expect(pyBytes, 'frozen python render must exist').not.toBeNull();
            const pyBody = (pyBytes as Buffer).toString('utf8');
            const tsBody = fs.readFileSync(path.join(REPO_ROOT, tsRel), 'utf8');
            expect(tsBody, 'written file byte-parity').toBe(pyBody);
        } finally {
            // Restore: delete only the files we created (the ts twin's file;
            // python's was frozen, never written on replay). If the dir did not
            // exist before and is now empty, remove it too.
            for (const f of created) {
                if (fs.existsSync(f)) {
                    fs.rmSync(f, { force: true });
                }
            }
            if (!before.existed && fs.existsSync(abs) && fs.readdirSync(abs).length === 0) {
                fs.rmdirSync(abs);
            }
        }
    });
});

// ── estimate / debate-estimate cost output (injected mock members) ──
// Both sides inject the SAME mock member set + the real static price
// table → deterministic cost math (the `:.4f` round-half-even f-strings).
// No API client is constructed → no spend.

describe.runIf(py3)('council_cli estimate cost-output — byte-parity (injected members)', () => {
    it('estimate · single-shot cost preview', () => {
        const py = runHarnessPy(QUESTION, '', '');
        const ts = runHarnessTs(QUESTION, '', '');
        expect(ts.status, 'exit code').toBe(py.status);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
        expect(ts.status).toBe(0);
        // Anchor: the cost lines + TOTAL must be present (round-half-even).
        expect(ts.stdout).toContain('council:estimate · mode=prompt · members=2 (billable=2)');
        expect(ts.stdout).toContain('TOTAL:  $');
    });

    it('estimate --debate --rounds 2 · round-by-round projection', () => {
        const py = runHarnessPy(QUESTION, '2', '1');
        const ts = runHarnessTs(QUESTION, '2', '1');
        expect(ts.status, 'exit code').toBe(py.status);
        expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
        expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
        expect(ts.stdout).toContain('PROJECTED TOTAL (2 rounds):  $');
    });
});
