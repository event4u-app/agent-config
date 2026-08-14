#!/usr/bin/env tsx
/**
 * Scale-history bench RUNNER — the producer half of the pre-registered bench.
 *
 * `internal/bench/corpora/scale-history-PREREG.md` fixes 3 arms × ≥2 model
 * families × N=16 replicates = 96 artifacts. Until this file existed the bench
 * had a scorer (`score.ts`) and no producer: nothing in the tree generated the
 * artifacts the scorer scores, so the spend authorization had nothing to spend
 * on. This closes that gap and nothing else.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO — PRIMARY SCORING.
 * The pre-registration makes the manual rubric PRIMARY and `lint_persistence`
 * SECONDARY (`scale-history-PREREG.md:63-69`), and `rubric.md:4` binds the
 * ordering: "The rater never sees `lint_persistence` output before scoring
 * (anti-anchor)". An agent scoring artifacts an agent produced is the
 * substitution that invalidates the result. So this runner produces artifacts,
 * records cost, and emits a BLIND rating workbook for a human rater. The
 * primary defect counts are entered by that human. `--score` runs the
 * secondary layer only, and refuses to run before the workbook is filled.
 *
 * ARM MECHANISM — a protocol note, because the prereg did not pin it.
 * The prereg names the arms by pack surface ("neither pack loaded" / "loaded,
 * advisory" / "loaded, gating") without fixing HOW the pack reaches the model.
 * Two mechanisms were available: enable the packs in a cloned install, or
 * inject the two pack rules as a system prompt. This runner injects, for one
 * reason that decides it: `codex` has no plugin concept at all, so the clone
 * mechanism exists on exactly one of the two families and would confound
 * family with mechanism — the one comparison the prereg forbids averaging
 * away. Injection is uniform across families and is the house precedent
 * (`bench_ab_task_runner.ts` `sysprompt_file`, used for the `with-rdp` arm for
 * the same "surface not in the installed plugin" reason). Stated here, not
 * buried: this is a mechanism choice made after pre-registration, visible in
 * git history, and it is a protocol amendment rather than a silent retrofit.
 *
 * FAMILIES. `anthropic` drives the `claude` CLI; `openai` drives `codex exec`.
 * Both are agentic file-writers, which is required for parity — a single-shot
 * chat completion would produce artifacts by a different process than the CLI
 * arm and confound production mode with family. Results are reported PER
 * FAMILY; this runner never averages across them.
 *
 * ISOLATION. The agent runs in a throwaway workspace under the OS temp dir,
 * never in the repo: an agentic run with write permission inside this checkout
 * could edit the bench that measures it. Produced files are copied into
 * `artifacts/<family>/<arm>/run-NN/`, which is gitignored (`.gitignore:314`)
 * because the output is untrusted LLM code, and which `score.ts` requires as
 * the confinement root.
 *
 * RESUME. A full 96-run sweep is hours of wall-clock. `--resume` skips any run
 * whose `run.json` already exists, so an interrupted sweep continues instead of
 * re-spending on completed cells.
 *
 * Usage:
 *   run.ts --dry                        # whole pipeline, zero model calls
 *   run.ts --estimate                   # render the cost sheet, spend nothing
 *   run.ts --live --family anthropic --arm A --n 16 [--resume]
 *   run.ts --live --all --n 16 --resume # the full pre-registered sweep
 *   run.ts --workbook                   # (re)emit the blind rating workbook
 *   run.ts --score                      # SECONDARY layer, after rating
 *
 * Exit codes: 0 ok · 1 usage / IO error · 2 refused (confinement, missing
 * transport, or a guard that must not be worked around).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hardenedSpawnEnv } from '../../../src/scripts/_lib/spawn_env.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const ARTIFACT_ROOT = path.join(HERE, 'artifacts');
const TASK_FILE = path.join(HERE, 'task.md');
const SEED_FILE = path.join(HERE, 'seed-schema.sql');
const SAMPLE = path.join(HERE, 'sample-artifact');
const SCORER = path.join(HERE, 'score.ts');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');

/** The two pack rules whose presence IS arms B and C. */
const PACK_RULES = [
    path.join(REPO, 'src', 'rules', 'scale-discipline.md'),
    path.join(REPO, 'src', 'rules', 'history-discipline.md'),
];

const ARMS = ['A', 'B', 'C'] as const;
const FAMILIES = ['anthropic', 'openai'] as const;
type Arm = (typeof ARMS)[number];
type Family = (typeof FAMILIES)[number];

/** Registered N per arm per family (prereg power analysis, α=0.01, power 0.8). */
const REGISTERED_N = 16;
/** Bounded fix-or-waive rounds for arm C. Unbounded would let one run eat the sweep. */
const MAX_GATING_ROUNDS = 3;
const DEFAULT_TIMEOUT_S = 900;

interface Usage {
    input_tokens: number | null;
    output_tokens: number | null;
    total_tokens: number | null;
    cost_usd: number | null;
    cost_source: string;
}

interface TransportResult {
    ok: boolean;
    reason: string | null;
    usage: Usage;
    wall_seconds: number;
}

interface RunRecord {
    run_id: string;
    family: Family;
    arm: Arm;
    replicate: number;
    mode: 'live' | 'dry';
    model: string | null;
    rounds: number;
    gate_defects_secondary: number | null;
    wall_seconds: number;
    usage: Usage;
    files_produced: string[];
    errored: boolean;
    reason: string | null;
}

// ---------------------------------------------------------------- utilities

function nowSeconds(): number {
    return Number(process.hrtime.bigint() / 1_000_000n) / 1000;
}

function round(n: number, digits: number): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

function emptyUsage(source: string): Usage {
    return {
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        cost_usd: null,
        cost_source: source,
    };
}

function intOrNull(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Deterministic PRNG (32-bit LCG) so the blind mapping is reproducible from
 * the run id. `Math.random` would make the rating workbook unauditable — a
 * reviewer could not re-derive which opaque id was which arm.
 */
function seededShuffle<T>(items: T[], seed: string): T[] {
    let state = 0;
    for (const ch of seed) state = (state * 31 + ch.charCodeAt(0)) >>> 0;
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
        state = (state * 1_664_525 + 1_013_904_223) >>> 0;
        const j = state % (i + 1);
        [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
}

function which(bin: string): string | null {
    const res = spawnSync('which', [bin], { encoding: 'utf8' });
    const found = (res.stdout ?? '').trim().split('\n')[0] ?? '';
    return res.status === 0 && found ? found : null;
}

/**
 * Copy a directory tree, skipping VCS, dependency, and agent-runtime noise.
 *
 * `agents/` is skipped because the agent-config plugin's hooks write session
 * state there (`agents/state/`, `agents/runtime/state/`) into whatever CWD the
 * agent runs in — 60 of the 73 files in the first smoke artifact were that,
 * not deliverables. Dropping the plugin per-arm stops most of it; skipping the
 * directory is the belt to that braces, since a stray state file inside a
 * scored artifact would be linted and rated as if the model had written it.
 * The trade, stated: a task whose real deliverable is an `agents/` directory
 * would lose it. This task's deliverable is a Laravel module, so it cannot.
 */
function copyTree(from: string, to: string): string[] {
    const written: string[] = [];
    const skip = new Set(['.git', 'node_modules', 'vendor', '.codex', '.claude', 'agents']);
    const walk = (src: string, dst: string, rel: string): void => {
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            if (skip.has(entry.name)) continue;
            const s = path.join(src, entry.name);
            const d = path.join(dst, entry.name);
            const r = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) {
                fs.mkdirSync(d, { recursive: true });
                walk(s, d, r);
            } else if (entry.isFile()) {
                fs.mkdirSync(path.dirname(d), { recursive: true });
                fs.copyFileSync(s, d);
                written.push(r);
            }
        }
    };
    fs.mkdirSync(to, { recursive: true });
    walk(from, to, '');
    return written;
}

// ------------------------------------------------------------- prompt build

function taskPrompt(): string {
    const task = fs.readFileSync(TASK_FILE, 'utf8');
    const seed = fs.readFileSync(SEED_FILE, 'utf8');
    return [
        task.trim(),
        '',
        'The existing schema you are building on:',
        '',
        '```sql',
        seed.trim(),
        '```',
        '',
        'Write real files into the current working directory using normal',
        'Laravel paths (database/migrations/, app/Models/, app/Http/Controllers/,',
        'and whatever jobs / listeners / observers you decide to add). Do not',
        'explain the code in prose — deliver the files.',
    ].join('\n');
}

/**
 * The arm's pack surface. Arm A gets nothing; B and C get both pack rules
 * verbatim. The differing half between B and C is the FEEDBACK LOOP, not the
 * text: B sees findings as advice it may ignore, C must fix or waive.
 */
function armSystemPrompt(arm: Arm): string | null {
    if (arm === 'A') return null;
    const bodies = PACK_RULES.map((p) => fs.readFileSync(p, 'utf8').trim());
    const posture =
        arm === 'B'
            ? [
                  'These persistence rules are ADVISORY for this task. Findings',
                  'against them are shown to you as advice; you may act on them or',
                  'not, at your judgement.',
              ]
            : [
                  'These persistence rules are GATING for this task. Any gate-tier',
                  'finding against them blocks completion: you must either fix it, or',
                  'waive it explicitly with a written reason in the code using the',
                  "waiver comment the rule names (for example `// no-index: <reason>`).",
              ];
    return [posture.join(' '), '', bodies.join('\n\n---\n\n')].join('\n');
}

// ---------------------------------------------------------------- transports

function runClaude(
    workspace: string,
    prompt: string,
    sysPromptFile: string | null,
    model: string | null,
    timeoutS: number,
): TransportResult {
    const bin = process.env['CLAUDE_CLI'] ?? which('claude');
    if (!bin) {
        return {
            ok: false,
            reason: 'claude CLI not found; set CLAUDE_CLI or install it',
            usage: emptyUsage('unavailable'),
            wall_seconds: 0,
        };
    }
    const cmd = ['--print', '--output-format', 'json', '--permission-mode', 'bypassPermissions'];
    // Drop the globally-installed agent-config plugin on EVERY arm. Without
    // this the host's own rule surface rides along, and arm A — defined as
    // "neither pack loaded" — runs with the full package active; the first
    // smoke run proved it, by depositing the plugin's `agents/runtime/state/`
    // hook output into the artifact. That is a confound on exactly the A-vs-C
    // contrast the bench exists to measure. Dropping it uniformly leaves the
    // injected arm surface as the ONLY difference between arms, which is the
    // isolation the design needs. `--setting-sources`, not `--bare`: the latter
    // also kills auth (`bench_ab_task_runner.ts:61-69`, same finding).
    cmd.push('--setting-sources', 'project,local');
    if (model) cmd.push('--model', model);
    if (sysPromptFile) cmd.push('--append-system-prompt-file', sysPromptFile);
    cmd.push('--', prompt);

    const started = nowSeconds();
    const res = spawnSync(bin, cmd, {
        cwd: workspace,
        env: hardenedSpawnEnv(),
        encoding: 'utf8',
        timeout: timeoutS * 1000,
        maxBuffer: 32 * 1024 * 1024,
    });
    const wall = round(nowSeconds() - started, 3);
    if (res.error || res.signal) {
        return {
            ok: false,
            reason: res.signal ? `killed (${res.signal})` : `spawn failed: ${res.error}`,
            usage: emptyUsage('errored'),
            wall_seconds: wall,
        };
    }
    const usage = emptyUsage('claude --output-format json');
    try {
        const env = JSON.parse(res.stdout ?? '{}') as Record<string, unknown>;
        const u = (env['usage'] ?? {}) as Record<string, unknown>;
        usage.input_tokens = intOrNull(u['input_tokens']);
        usage.output_tokens = intOrNull(u['output_tokens']);
        const cacheRead = intOrNull(u['cache_read_input_tokens']) ?? 0;
        const cacheCreate = intOrNull(u['cache_creation_input_tokens']) ?? 0;
        if (usage.input_tokens !== null || usage.output_tokens !== null) {
            usage.total_tokens =
                (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) + cacheRead + cacheCreate;
        }
        usage.cost_usd = intOrNull(env['total_cost_usd']);
    } catch {
        // Envelope unparseable: leave the nulls. A null here is an honest
        // "not reported", never a zero — a fabricated 0 would understate spend.
    }
    return { ok: res.status === 0, reason: res.status === 0 ? null : `exit ${res.status}`, usage, wall_seconds: wall };
}

function runCodex(
    workspace: string,
    prompt: string,
    sysPromptFile: string | null,
    model: string | null,
    timeoutS: number,
): TransportResult {
    const bin = process.env['CODEX_CLI'] ?? which('codex');
    if (!bin) {
        return {
            ok: false,
            reason: 'codex CLI not found; set CODEX_CLI or install it',
            usage: emptyUsage('unavailable'),
            wall_seconds: 0,
        };
    }
    // codex has no --append-system-prompt: the arm surface is prepended to the
    // prompt itself. Same text, same position relative to the task, so the two
    // families differ in transport but not in what the model is told.
    const full = sysPromptFile
        ? `${fs.readFileSync(sysPromptFile, 'utf8')}\n\n---\n\n${prompt}`
        : prompt;
    const cmd = [
        'exec',
        '--cd',
        workspace,
        '--sandbox',
        'workspace-write',
        '--skip-git-repo-check',
        // Family-parity twin of `--setting-sources project,local` on the claude
        // side: no ambient user config, so the injected arm surface is the only
        // guidance either family receives.
        '--ignore-user-config',
        '--json',
    ];
    if (model) cmd.push('--model', model);
    cmd.push('--', full);

    const started = nowSeconds();
    const res = spawnSync(bin, cmd, {
        cwd: workspace,
        env: hardenedSpawnEnv(),
        encoding: 'utf8',
        timeout: timeoutS * 1000,
        maxBuffer: 32 * 1024 * 1024,
    });
    const wall = round(nowSeconds() - started, 3);
    if (res.error || res.signal) {
        return {
            ok: false,
            reason: res.signal ? `killed (${res.signal})` : `spawn failed: ${res.error}`,
            usage: emptyUsage('errored'),
            wall_seconds: wall,
        };
    }
    // --json emits JSONL events; token usage arrives on a usage-bearing event.
    // Sum defensively and leave nulls when the stream carries none.
    const usage = emptyUsage('codex --json token_count events');
    let sawUsage = false;
    let inTok = 0;
    let outTok = 0;
    let turnError: string | null = null;
    for (const line of (res.stdout ?? '').split('\n')) {
        const t = line.trim();
        if (!t.startsWith('{')) continue;
        try {
            const ev = JSON.parse(t) as Record<string, unknown>;
            // codex reports a failed turn in-band and can still exit 0, so the
            // exit code alone is not the health signal. The first smoke run hit
            // exactly this: an expired ChatGPT token surfaced as `turn.failed`
            // while `codex login status` still printed "Logged in".
            if (ev['type'] === 'turn.failed' || ev['type'] === 'error') {
                const err = (ev['error'] ?? ev) as Record<string, unknown>;
                turnError = typeof err['message'] === 'string' ? (err['message'] as string) : 'turn failed';
            }
            const u = (ev['usage'] ?? ev['token_usage'] ?? null) as Record<string, unknown> | null;
            if (!u) continue;
            const i = intOrNull(u['input_tokens']) ?? intOrNull(u['prompt_tokens']);
            const o = intOrNull(u['output_tokens']) ?? intOrNull(u['completion_tokens']);
            if (i !== null || o !== null) {
                sawUsage = true;
                inTok += i ?? 0;
                outTok += o ?? 0;
            }
        } catch {
            continue;
        }
    }
    if (sawUsage) {
        usage.input_tokens = inTok;
        usage.output_tokens = outTok;
        usage.total_tokens = inTok + outTok;
    }
    // codex here is authenticated via a ChatGPT subscription (`codex login
    // status`), so per-call USD is not reported by the CLI and is NOT derivable
    // from tokens at API list price. Recorded as null with the reason, rather
    // than imputed — an imputed number would enter the cost sheet as if measured.
    usage.cost_source = 'codex (subscription auth — no per-call USD reported)';
    if (turnError !== null) {
        const expired = /expired|could not be refreshed|sign in again|401/i.test(turnError);
        return {
            ok: false,
            reason: expired
                ? `codex auth expired — run \`codex login\` interactively, then re-run with --resume (${turnError})`
                : `codex turn failed: ${turnError}`,
            usage,
            wall_seconds: wall,
        };
    }
    return { ok: res.status === 0, reason: res.status === 0 ? null : `exit ${res.status}`, usage, wall_seconds: wall };
}

// ------------------------------------------------------------ secondary lint

interface LintSummary {
    gate_total: number;
    by_class: Record<string, number>;
    findings_text: string;
}

/**
 * Secondary layer. Spawned, never in-process: the artifact is untrusted LLM
 * output and this inherits `score.ts`'s threat model (PR #1016 review).
 */
function lintArtifact(artifactDir: string): LintSummary | null {
    const res = spawnSync(
        TSX,
        [
            path.join(REPO, 'src', 'scripts', 'lint_persistence.ts'),
            '--dir',
            artifactDir,
            '--stack',
            'eloquent',
            '--stack',
            'raw-sql',
            '--format',
            'json',
        ],
        {
            cwd: REPO,
            env: hardenedSpawnEnv(),
            encoding: 'utf8',
            timeout: 30_000,
            maxBuffer: 4 * 1024 * 1024,
        },
    );
    if (res.error || res.signal) return null;
    try {
        const report = JSON.parse(res.stdout ?? '{}') as {
            findings?: { failure_class: string; tier: string; waived?: boolean; message?: string; file?: string }[];
        };
        const by_class: Record<string, number> = {};
        const lines: string[] = [];
        for (const f of report.findings ?? []) {
            if (f.waived || f.tier !== 'gate') continue;
            by_class[f.failure_class] = (by_class[f.failure_class] ?? 0) + 1;
            lines.push(`- [${f.failure_class}] ${f.file ?? '?'}: ${f.message ?? ''}`.trim());
        }
        const gate_total = Object.values(by_class).reduce((a, b) => a + b, 0);
        return { gate_total, by_class, findings_text: lines.join('\n') };
    } catch {
        return null;
    }
}

// ------------------------------------------------------------------ one run

function artifactDirFor(family: Family, arm: Arm, replicate: number): string {
    const cell = `run-${String(replicate).padStart(2, '0')}`;
    return path.join(ARTIFACT_ROOT, family, `arm-${arm}`, cell);
}

function executeRun(
    family: Family,
    arm: Arm,
    replicate: number,
    opts: { live: boolean; model: string | null; timeoutS: number },
): RunRecord {
    const run_id = `${family}-${arm}-${String(replicate).padStart(2, '0')}`;
    const outDir = artifactDirFor(family, arm, replicate);
    const base: RunRecord = {
        run_id,
        family,
        arm,
        replicate,
        mode: opts.live ? 'live' : 'dry',
        model: opts.model,
        rounds: 0,
        gate_defects_secondary: null,
        wall_seconds: 0,
        usage: emptyUsage(opts.live ? 'pending' : 'dry (no model call)'),
        files_produced: [],
        errored: false,
        reason: null,
    };

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    if (!opts.live) {
        // Dry path: exercise every stage except the model. The sample artifact
        // stands in for produced files so collection, lint feedback, scoring
        // and workbook emission all run for real and can be verified free.
        const files = copyTree(SAMPLE, outDir);
        const lint = lintArtifact(outDir);
        base.files_produced = files;
        base.rounds = arm === 'A' ? 1 : 2;
        base.gate_defects_secondary = lint?.gate_total ?? null;
        base.wall_seconds = 0;
        fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(base, null, 2) + '\n');
        return base;
    }

    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `scale-history-${run_id}-`));
    let sysFile: string | null = null;
    try {
        fs.copyFileSync(SEED_FILE, path.join(workspace, 'seed-schema.sql'));
        const sys = armSystemPrompt(arm);
        if (sys !== null) {
            sysFile = path.join(workspace, '.arm-surface.md');
            fs.writeFileSync(sysFile, sys);
        }

        const transport = family === 'anthropic' ? runClaude : runCodex;
        let prompt = taskPrompt();
        let totalWall = 0;
        const agg = emptyUsage('accumulated across rounds');
        let rounds = 0;

        // Round 1 is the task. Arm A stops there. Arm B takes exactly one
        // advisory pass. Arm C loops until the gate is clean or the bound hits.
        const maxRounds = arm === 'A' ? 1 : arm === 'B' ? 2 : 1 + MAX_GATING_ROUNDS;

        for (let r = 0; r < maxRounds; r += 1) {
            const res = transport(workspace, prompt, sysFile, opts.model, opts.timeoutS);
            rounds += 1;
            totalWall += res.wall_seconds;
            for (const k of ['input_tokens', 'output_tokens', 'total_tokens', 'cost_usd'] as const) {
                const v = res.usage[k];
                if (v !== null) agg[k] = (agg[k] ?? 0) + v;
            }
            agg.cost_source = res.usage.cost_source;
            if (!res.ok) {
                base.errored = true;
                base.reason = res.reason;
                break;
            }
            if (r === maxRounds - 1) break;

            // Feedback: collect what exists so far and lint it.
            const staging = path.join(workspace, '.staged-for-lint');
            fs.rmSync(staging, { recursive: true, force: true });
            copyTree(workspace, staging);
            const lint = lintArtifact(staging);
            fs.rmSync(staging, { recursive: true, force: true });
            if (!lint || lint.gate_total === 0) break;

            prompt =
                arm === 'B'
                    ? [
                          'A persistence review of your delivered files reports the following.',
                          'This is ADVICE. Act on it or not, at your judgement, then stop.',
                          '',
                          lint.findings_text,
                      ].join('\n')
                    : [
                          'A persistence review of your delivered files reports the following',
                          'GATE-TIER findings. Completion is blocked until each one is either',
                          'fixed in the files, or waived in the code with a written reason.',
                          '',
                          lint.findings_text,
                      ].join('\n');
        }

        const files = copyTree(workspace, outDir);
        // The arm surface and the seeded schema are INPUTS we planted, not
        // deliverables: leaving them in the artifact would have the rater and
        // the linter scoring the bench's own fixtures as model output.
        const planted = new Set(['.arm-surface.md', 'seed-schema.sql']);
        for (const p of planted) fs.rmSync(path.join(outDir, p), { force: true });
        const finalLint = lintArtifact(outDir);
        base.files_produced = files.filter((f) => !planted.has(f));
        base.rounds = rounds;
        base.wall_seconds = round(totalWall, 3);
        base.usage = agg;
        base.gate_defects_secondary = finalLint?.gate_total ?? null;
    } finally {
        fs.rmSync(workspace, { recursive: true, force: true });
    }

    fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(base, null, 2) + '\n');
    return base;
}

// ------------------------------------------------------------ manifest + wb

function collectRecords(): RunRecord[] {
    const out: RunRecord[] = [];
    if (!fs.existsSync(ARTIFACT_ROOT)) return out;
    for (const family of FAMILIES) {
        for (const arm of ARMS) {
            const dir = path.join(ARTIFACT_ROOT, family, `arm-${arm}`);
            if (!fs.existsSync(dir)) continue;
            for (const cell of fs.readdirSync(dir).sort()) {
                const rj = path.join(dir, cell, 'run.json');
                if (!fs.existsSync(rj)) continue;
                try {
                    out.push(JSON.parse(fs.readFileSync(rj, 'utf8')) as RunRecord);
                } catch {
                    continue;
                }
            }
        }
    }
    return out;
}

function writeManifest(records: RunRecord[]): string {
    const dest = path.join(ARTIFACT_ROOT, 'manifest.json');
    const cost = records.reduce((a, r) => a + (r.usage.cost_usd ?? 0), 0);
    const reported = records.filter((r) => r.usage.cost_usd !== null).length;
    const manifest = {
        registered_n: REGISTERED_N,
        arms: ARMS,
        families: FAMILIES,
        runs_present: records.length,
        runs_target: REGISTERED_N * ARMS.length * FAMILIES.length,
        errored: records.filter((r) => r.errored).length,
        cost_usd_reported_total: round(cost, 4),
        cost_reporting_coverage: `${reported}/${records.length} runs reported a USD figure`,
        note:
            'Producer manifest. Primary defect counts are NOT here — they come from ' +
            'the human rubric rating in rating-workbook.md per pre-registration.',
        runs: records,
    };
    fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(manifest, null, 2) + '\n');
    return dest;
}

/**
 * The blind rating sheet. Two properties are load-bearing and both come
 * straight from `rubric.md:4`: it carries NO lint output (anti-anchor), and it
 * does not name the arm (otherwise the rater knows which condition they are
 * scoring). The mapping is written to a separate file the rater does not open.
 *
 * The arm label lives in the artifact PATH (`artifacts/<family>/arm-<A>/…`), so
 * pointing the workbook at the real directory would defeat the opaque id in the
 * column next to it — the first version of this function did exactly that. The
 * rater therefore reads from a materialised `blind/<opaque-id>/` copy that
 * carries the code and nothing else. Copies, not symlinks: a symlink still
 * resolves to the arm path in most editors and file managers, which is the same
 * leak wearing a different hat. `score.ts` always runs against the real
 * directories, so the blind view is never in the scored path.
 */
function writeWorkbook(records: RunRecord[]): { workbook: string; key: string } {
    const usable = records.filter((r) => r.files_produced.length > 0);
    const shuffled = seededShuffle(usable, `scale-history-${usable.length}`);
    const rubric = fs.readFileSync(path.join(HERE, 'rubric.md'), 'utf8');
    const classes = Array.from(rubric.matchAll(/^\|\s*(F\d+|OVER|CORR)\s*\|/gm)).map((m) => m[1] as string);

    const lines: string[] = [
        '# Blind rating workbook — scale-history bench (PRIMARY scorer)',
        '',
        'You are the primary scorer. Fill one row per artifact, one point per',
        'distinct defect site, per `rubric.md`. Definitions are reproduced below',
        'so you never need to open another file to rate.',
        '',
        '**Do not open `manifest.json`, any `run.json`, or run `score.ts` before',
        'you have finished rating.** Those carry the arm label and the linter',
        'output; seeing either first is the anchoring the pre-registration',
        'excludes (`rubric.md:4`).',
        '',
        'Artifacts are listed in a seeded-shuffle order under opaque ids. The',
        'paths below are blind copies: they carry the delivered code and no arm,',
        'family, or replicate label anywhere in the path.',
        '',
        '## Rubric',
        '',
        rubric.split('\n').filter((l) => l.startsWith('|')).join('\n'),
        '',
        '## Rows',
        '',
        `| # | artifact id | path | ${classes.join(' | ')} | audit coverage % | notes |`,
        `|---|---|---|${classes.map(() => '---|').join('')}---|---|`,
    ];
    const key: string[] = ['# Blind key — do NOT open before rating is complete', '', '| artifact id | family | arm | replicate |', '|---|---|---|---|'];
    const blindRoot = path.join(ARTIFACT_ROOT, 'blind');
    fs.rmSync(blindRoot, { recursive: true, force: true });
    shuffled.forEach((r, i) => {
        const opaque = `art-${String(i + 1).padStart(3, '0')}`;
        const real = artifactDirFor(r.family, r.arm, r.replicate);
        const blind = path.join(blindRoot, opaque);
        copyTree(real, blind);
        // run.json names the arm — it is a producer record, not a deliverable.
        fs.rmSync(path.join(blind, 'run.json'), { force: true });
        lines.push(
            `| ${i + 1} | ${opaque} | \`${path.relative(HERE, blind)}\` | ${classes.map(() => ' ').join(' | ')} |  |  |`,
        );
        key.push(`| ${opaque} | ${r.family} | ${r.arm} | ${r.replicate} |`);
    });

    const wb = path.join(ARTIFACT_ROOT, 'rating-workbook.md');
    const kf = path.join(ARTIFACT_ROOT, 'rating-key.md');
    fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
    fs.writeFileSync(wb, lines.join('\n') + '\n');
    fs.writeFileSync(kf, key.join('\n') + '\n');
    return { workbook: wb, key: kf };
}

// ---------------------------------------------------------------- estimating

function renderEstimate(n: number): void {
    const cells = ARMS.length * FAMILIES.length * n;
    const roundsPerCell = { A: 1, B: 2, C: 1 + MAX_GATING_ROUNDS };
    const callsPerFamily = n * (roundsPerCell.A + roundsPerCell.B + roundsPerCell.C);
    const totalCalls = callsPerFamily * FAMILIES.length;
    // Anchor the projection on MEASURED runs when any exist, never on list
    // price. With none recorded yet the projection is withheld rather than
    // guessed — an invented number in a cost sheet reads as measured later.
    const priced = collectRecords().filter((r) => r.mode === 'live' && r.usage.cost_usd !== null && !r.errored);
    const perRound =
        priced.length > 0
            ? priced.reduce((a, r) => a + (r.usage.cost_usd ?? 0), 0) /
              Math.max(1, priced.reduce((a, r) => a + r.rounds, 0))
            : null;
    const wallPerRound =
        priced.length > 0
            ? priced.reduce((a, r) => a + r.wall_seconds, 0) / Math.max(1, priced.reduce((a, r) => a + r.rounds, 0))
            : null;

    const lines = [
        '# Cost estimate — scale-history bench',
        '',
        `N per arm per family        : ${n}${n === REGISTERED_N ? ' (registered)' : ` (NOT the registered ${REGISTERED_N} — α must be recomputed and REGISTERED BEFORE the run, per prereg:60)`}`,
        `Cells (family × arm × N)    : ${cells}`,
        `Max model invocations       : ${totalCalls}  (arm A ${roundsPerCell.A} round, B ≤${roundsPerCell.B}, C ≤${roundsPerCell.C})`,
        '',
    ];
    if (perRound !== null) {
        const upper = perRound * totalCalls;
        const lower = upper * 0.45; // B/C often settle before their round bound
        lines.push(
            `Measured anchor             : $${round(perRound, 4)}/round, ${round(wallPerRound ?? 0, 1)}s/round ` +
                `(${priced.length} live run(s) recorded)`,
            `Projected USD, both families: $${round(lower, 2)} – $${round(upper, 2)}`,
            `Projected wall-clock        : ${round(((wallPerRound ?? 0) * totalCalls) / 3600, 1)} h at the round bound`,
            '',
            'The upper bound assumes every arm B and C run consumes its full round',
            'allowance; a run whose gate comes back clean stops early, which is why',
            'the lower bound is not the same number. Both are anchored on measured',
            'runs in this tree, never on list price.',
            '',
        );
    } else {
        lines.push(
            'No live run recorded yet, so no USD projection is printed. Record one',
            '(`--live --arm A --n 1`) and re-run --estimate: the projection is then',
            'anchored on a measured per-round figure. A list-price multiplication',
            'would be a fabricated number in a cost sheet, which is worse than an',
            'absent one.',
            '',
        );
    }
    lines.push(
        'Per-family USD coverage differs and the manifest states it as a fraction:',
        '`claude --output-format json` reports `total_cost_usd`; `codex` on',
        'subscription auth reports none, so openai rows carry a null cost by',
        'construction rather than a zero.',
        '',
    );
    process.stdout.write(lines.join('\n') + '\n');
}

// ---------------------------------------------------------------------- main

function usage(): number {
    process.stderr.write(
        [
            'usage: run.ts --dry',
            '       run.ts --estimate [--n N]',
            '       run.ts --live (--all | --family F --arm A) [--n N] [--model M] [--resume] [--timeout S]',
            '       run.ts --workbook',
            '       run.ts --score',
            '',
        ].join('\n'),
    );
    return 1;
}

function main(argv: string[]): number {
    let live = false;
    let dry = false;
    let estimate = false;
    let workbookOnly = false;
    let scoreOnly = false;
    let all = false;
    let resume = false;
    let n = REGISTERED_N;
    let model: string | null = null;
    let timeoutS = DEFAULT_TIMEOUT_S;
    let family: Family | null = null;
    let arm: Arm | null = null;

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--live') live = true;
        else if (a === '--dry') dry = true;
        else if (a === '--estimate') estimate = true;
        else if (a === '--workbook') workbookOnly = true;
        else if (a === '--score') scoreOnly = true;
        else if (a === '--all') all = true;
        else if (a === '--resume') resume = true;
        else if (a === '--n') n = Number(argv[++i] ?? REGISTERED_N);
        else if (a === '--model') model = argv[++i] ?? null;
        else if (a === '--timeout') timeoutS = Number(argv[++i] ?? DEFAULT_TIMEOUT_S);
        else if (a === '--family') family = (argv[++i] ?? '') as Family;
        else if (a === '--arm') arm = (argv[++i] ?? '') as Arm;
        else return usage();
    }

    if (!Number.isFinite(n) || n < 1) {
        process.stderr.write('❌  --n must be a positive integer\n');
        return 1;
    }
    if (estimate) {
        renderEstimate(n);
        return 0;
    }
    if (workbookOnly) {
        const recs = collectRecords();
        if (recs.length === 0) {
            process.stderr.write('❌  no runs found under artifacts/ — nothing to rate\n');
            return 1;
        }
        const { workbook, key } = writeWorkbook(recs);
        process.stdout.write(`✅  workbook ${path.relative(REPO, workbook)} · key ${path.relative(REPO, key)}\n`);
        return 0;
    }
    if (scoreOnly) {
        // The secondary layer must not run before the primary rating exists,
        // or the anti-anchor ordering is broken by the tooling itself.
        const wb = path.join(ARTIFACT_ROOT, 'rating-workbook.md');
        if (!fs.existsSync(wb)) {
            process.stderr.write('❌  refused: no rating-workbook.md — the manual rubric is PRIMARY and runs first\n');
            return 2;
        }
        const recs = collectRecords();
        for (const r of recs) {
            const dir = artifactDirFor(r.family, r.arm, r.replicate);
            const res = spawnSync(TSX, [SCORER, '--artifact', dir, '--arm', r.arm, '--family', r.family], {
                cwd: REPO,
                env: hardenedSpawnEnv(),
                encoding: 'utf8',
                timeout: 60_000,
            });
            process.stdout.write(res.stdout ?? '');
        }
        return 0;
    }
    if (live === dry) return usage();

    const families: Family[] = all ? [...FAMILIES] : family ? [family] : [];
    const arms: Arm[] = all ? [...ARMS] : arm ? [arm] : [];
    if (families.length === 0 || arms.length === 0) return usage();
    for (const f of families) {
        if (!FAMILIES.includes(f)) {
            process.stderr.write(`❌  unknown family '${f}' (expected: ${FAMILIES.join(', ')})\n`);
            return 1;
        }
    }
    for (const a of arms) {
        if (!ARMS.includes(a)) {
            process.stderr.write(`❌  unknown arm '${a}' (expected: ${ARMS.join(', ')})\n`);
            return 1;
        }
    }

    if (live && n !== REGISTERED_N) {
        process.stderr.write(
            `⚠️   N=${n} is not the registered ${REGISTERED_N}. Per prereg:60 the achievable α must be ` +
                `recomputed and REGISTERED BEFORE this run — never post-hoc.\n`,
        );
    }

    const done: RunRecord[] = [];
    for (const f of families) {
        for (const a of arms) {
            for (let rep = 1; rep <= n; rep += 1) {
                const dir = artifactDirFor(f, a, rep);
                if (resume && fs.existsSync(path.join(dir, 'run.json'))) {
                    try {
                        done.push(JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8')) as RunRecord);
                        process.stdout.write(`⏭   ${f}-${a}-${rep} (resume)\n`);
                        continue;
                    } catch {
                        // Unreadable record: fall through and re-run the cell.
                    }
                }
                const rec = executeRun(f, a, rep, { live, model, timeoutS });
                done.push(rec);
                const cost = rec.usage.cost_usd === null ? 'n/a' : `$${round(rec.usage.cost_usd, 4)}`;
                process.stdout.write(
                    `${rec.errored ? '❌' : '✅'}  ${rec.run_id} · rounds ${rec.rounds} · ` +
                        `${rec.files_produced.length} files · secondary gate defects ` +
                        `${rec.gate_defects_secondary ?? 'n/a'} · ${rec.wall_seconds}s · ${cost}` +
                        `${rec.reason ? ` · ${rec.reason}` : ''}\n`,
                );
            }
        }
    }

    const all_records = collectRecords();
    const manifest = writeManifest(all_records.length > 0 ? all_records : done);
    const { workbook } = writeWorkbook(all_records.length > 0 ? all_records : done);
    process.stdout.write(
        `\n📦  ${done.length} run(s) this invocation · manifest ${path.relative(REPO, manifest)}\n` +
            `📋  rate blind first: ${path.relative(REPO, workbook)}\n`,
    );
    return 0;
}

process.exit(main(process.argv.slice(2)));
