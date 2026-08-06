// Tests for src/scripts/bench_ab_v2_run.ts (py2ts, ADR-096).
//
// No pytest suite exists. This is a focused differential suite over the pure
// helpers (placebo_prose, status_bucket, trajectory_metrics) plus golden-parity
// layers that run python3 vs `node node_modules/.bin/tsx` end-to-end:
//
//  - dry-run / arg-error CLI parity (byte-identical stdout/stderr/exit),
//  - a live JSON-write parity layer driven by a FAKE `claude` binary
//    (CLAUDE_CLI override) that emits a deterministic JSON envelope — never a
//    real model call. The reports/ab-v2 directory is snapshot + restored so the
//    suite leaves zero git drift. The volatile fields are the embedded UTC
//    `stamp` (also in the report filename) and `wall_time_seconds` (wall-clock);
//    both are normalised per ADR-094's timing-non-determinism guidance.
//
// `--help` prose is NOT byte-compared (argparse wraps differently); we assert
// exit 0 + the `usage: <prog>` token only.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    placebo_prose,
    status_bucket,
    trajectory_metrics,
    injected_text,
    hardened_blocks_text,
    bare_principle_text,
    ladder_rule_text,
    lift_audit_arms,
    workspace_dir,
    selftest_run,
    selftest_usage,
    ARMS,
    CODEX_VALID_ARMS,
    checkpoint_key,
    run_key,
    freeze_result,
    thaw_result,
    load_checkpoint,
    append_checkpoint,
    collect_records,
    integrity_fields,
    PyFloat,
    type CheckpointIO,
} from '../../src/scripts/bench_ab_v2_run.js';
import type { ScoreResultV2 } from '../../src/scripts/_lib/bench_ab_scoring_v2.js';
import { activation_verdict, audit_activation, expected_injection } from '../../src/scripts/_lib/bench_ab_activation.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPTS = path.join(REPO_ROOT, 'src', 'scripts');
const TS_SCRIPT = path.join(SCRIPTS, 'bench_ab_v2_run.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

interface RunOut {
    stdout: string;
    stderr: string;
    status: number | null;
}
function runTs(args: string[], env: NodeJS.ProcessEnv = {}): RunOut {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        env: { ...process.env, ...env },
        maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('bench_ab_v2_run — pure helpers', () => {
    it('placebo_prose is deterministic and exactly target_chars long', () => {
        for (const n of [0, 1, 100, 2000, 4096]) {
            const p = placebo_prose(n);
            expect(p.length).toBe(n);
            // deterministic
            expect(placebo_prose(n)).toBe(p);
        }
    });

    it('placebo_prose has no caution-priming vocabulary', () => {
        const p = placebo_prose(4000).toLowerCase();
        for (const word of ['verify', 'minimal', 'careful', ' ask ', 'confirm']) {
            expect(p.includes(word)).toBe(false);
        }
    });

    it('injected_text: null / rdp / placebo branches', () => {
        expect(injected_text(null, 2000)).toBeNull();
        expect(injected_text('placebo', 50)).toBe(placebo_prose(50));
        // rdp delegates to v1.system_prompt_for("with-rdp") — string or null.
        const rdp = injected_text('rdp', 2000);
        expect(rdp === null || typeof rdp === 'string').toBe(true);
    });

    it('injected_text: hardened returns the HARD CONSTRAINT blocks; hardened-placebo is length-matched', () => {
        const hard = injected_text('hardened', 2000);
        expect(hard).toBe(hardened_blocks_text());
        // covers all three tier:safety-floor rules under test.
        expect(hard).toContain('HARD CONSTRAINT');
        expect(hard).toContain('commit-policy');
        expect(hard).toContain('non-destructive-by-default');
        expect(hard).toContain('scope-control');
        // placebo control must match the hardened block length exactly, and carry
        // none of the discipline-priming vocabulary (it is a pure length control).
        const placebo = injected_text('hardened-placebo', 2000) as string;
        expect(placebo.length).toBe(hardened_blocks_text().length);
        expect(placebo).not.toContain('HARD CONSTRAINT');
    });

    // ── road-to-solution-minimalism Phase 3, Arms step ──────────────────────
    //
    // The two arms the step names and `ARMS` lacked. Every assertion here is a
    // property of the arm's PURPOSE, not a snapshot of its text: the
    // bare-principle arm's job is to be floor-free and small, the ladder arm's job
    // is to carry the projected rule rather than a restatement of it.

    it('bare-principle: one short sentence, no floor vocabulary, no ladder rungs', () => {
        const bare = injected_text('bare-principle', 2000);
        expect(bare).toBe(bare_principle_text());
        const text = bare as string;

        // Small by construction — this is finding F6's control, so it must not
        // smuggle in a second treatment. One sentence, no line breaks.
        expect(text.length).toBeLessThan(200);
        expect(text).not.toContain('\n');

        // Floor-free is the whole point: the arm exists to measure what the
        // ROUTED floors add over the naked principle, so it may not route any.
        for (const floor of [
            'engineering-safety-floor',
            'security-sensitive-stop',
            'senior-engineering-discipline',
            'scale-discipline',
            'HARD CONSTRAINT',
        ]) {
            expect(text).not.toContain(floor);
        }
        // Nor may it carry the ladder's own rungs — that would make it a second
        // ladder arm rather than a control.
        for (const rung of ['reuse-in-repo', 'native platform', 'stdlib']) {
            expect(text.toLowerCase()).not.toContain(rung.toLowerCase());
        }
    });

    it('package-ladder: injects the PROJECTED ladder rule, not a restatement', () => {
        const injected = injected_text('ladder', 2000);
        expect(injected).toBe(ladder_rule_text());
        const text = injected as string;

        // Read from `dist/agent-src/rules/improve-before-implement.md`, so it must
        // carry that rule's own ladder section — if the projection ever stopped
        // carrying the ladder, this arm would be measuring the wrong thing and
        // this assertion is what says so.
        expect(text).toContain('solution-size ladder');
        expect(text).toContain('reuse-in-repo');
        // Substantially larger than the bare control — the contrast between the
        // two arms is the measurement, so a collapse of that contrast is a bug.
        expect(text.length).toBeGreaterThan(bare_principle_text().length * 5);
    });

    it('ARMS: the two new arms use the channels their purpose requires', () => {
        // Plugin ON + text injection: the ladder is guaranteed in context rather
        // than left to `improve-before-implement`'s keyword triggers.
        expect(ARMS['package-ladder']).toEqual({ setting_sources: null, inject: 'ladder' });
        // Plugin scoped AWAY + text injection: no floors reach the model.
        expect(ARMS['bare-principle']).toEqual({
            setting_sources: 'project,local',
            inject: 'bare-principle',
            min_lift_ratio: null,
        });
    });

    it('lift_audit_arms: excludes the tiny-treatment arm, keeps every real lift arm', () => {
        const selected = lift_audit_arms(['vanilla', 'package', 'package-ladder', 'bare-principle', 'placebo']);

        // Baseline is never its own lift arm.
        expect(selected).not.toContain('vanilla');
        // A deliberately minimal treatment cannot show footprint lift; requiring
        // it would fail legitimate runs.
        expect(selected).not.toContain('bare-principle');
        // Every arm that DOES carry a real surface stays audited — this is the
        // half that must not silently shrink.
        expect(selected).toContain('package');
        expect(selected).toContain('package-ladder');
        expect(selected).toContain('placebo');

        // An unknown arm name is not silently promoted into the audit set.
        expect(lift_audit_arms(['no-such-arm'])).toEqual([]);
    });

    it('bare-principle stays audited: the text direction fires BOTH ways for it', () => {
        // The point of the `min_lift_ratio: null` opt-out is that it narrows the
        // audit to the text channel — never that it removes the arm from auditing.
        // Both directions are asserted here so neither an always-firing nor a
        // never-firing audit passes.
        const spec = ARMS['bare-principle'];
        expect(spec).toBeDefined();
        const expected = expected_injection(spec as NonNullable<typeof spec>);
        expect(expected).toBe('text');

        const usage = {
            input_tokens: 900,
            output_tokens: 100,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
        };
        // Declared a text injection and carried none → violation.
        expect(
            activation_verdict({ expected, tokens_breakdown: usage, injected_chars: 0, errored: false }).verdict,
        ).toBe('violation');
        // Declared one and carried it → ok.
        expect(
            activation_verdict({
                expected,
                tokens_breakdown: usage,
                injected_chars: bare_principle_text().length,
                errored: false,
            }).verdict,
        ).toBe('ok');
    });

    it('CODEX_VALID_ARMS: the pure-injection arm carries to codex, the plugin one does not', () => {
        expect(CODEX_VALID_ARMS).toContain('bare-principle');
        expect(CODEX_VALID_ARMS).not.toContain('package-ladder');
    });

    // ── delta #7 — one preserved workspace per trial ─────────────────────────

    it('workspace_dir: distinct per task AND arm AND seed', () => {
        const a = workspace_dir('t1', 'vanilla', 0);
        const variants = [
            workspace_dir('t2', 'vanilla', 0), // different task
            workspace_dir('t1', 'package', 0), // different arm
            workspace_dir('t1', 'vanilla', 1), // different seed
        ];
        // The old key was task-only, so the last two of these collided with `a`
        // and every arm/seed of a task overwrote the previous one's evidence.
        for (const v of variants) {
            expect(v).not.toBe(a);
        }
        expect(new Set([a, ...variants]).size).toBe(4);
    });

    it('workspace_dir: an arm name cannot escape the work root', () => {
        const evil = workspace_dir('t1', '../../etc', 0);
        // Arm names reach this as a path segment; separators must not survive.
        expect(path.basename(evil)).toBe(evil.slice(evil.lastIndexOf(path.sep) + 1));
        expect(evil).not.toContain(`..${path.sep}`);
        expect(path.resolve(evil).startsWith(path.resolve(path.dirname(evil)))).toBe(true);
    });

    it('status_bucket: completed / budget_limit / task_limit / validation_failed', () => {
        expect(status_bucket({ errored: false })).toBe('completed');
        expect(status_bucket({ errored: true, subtype: 'budget_exceeded' })).toBe('budget_limit');
        expect(status_bucket({ errored: true, reason: 'timeout after 30s' })).toBe('task_limit');
        expect(status_bucket({ errored: true, exit_code: -1 })).toBe('task_limit');
        expect(status_bucket({ errored: true, subtype: 'max_turns_reached' })).toBe('task_limit');
        expect(status_bucket({ errored: true, subtype: 'error_during_execution' })).toBe('validation_failed');
    });

    it('trajectory_metrics shape mirrors the Python dict keys', () => {
        const score: ScoreResultV2 = {
            capability_pass: true,
            discipline_score: 1.0,
            discipline_pass: true,
            files_changed: ['a.txt', 'b.txt'],
            capability_checks: [],
            discipline_checks: [],
        };
        const m = trajectory_metrics(
            { errored: false, num_turns: 3, wall_time_seconds: 1.5, tokens: 1234, transcript: 'should i commit? git commit' },
            score,
        );
        expect(Object.keys(m).sort()).toEqual(
            ['ask_events', 'ask_vs_act_ratio', 'files_changed', 'num_turns', 'status_bucket', 'tokens', 'wall_time_seconds'].sort(),
        );
        expect(m['files_changed']).toBe(2);
        expect(m['num_turns']).toBe(3);
        expect(m['tokens']).toBe(1234);
        expect(m['status_bucket']).toBe('completed');
        // ask_events is always 0 (Python source reads the absent "asks" key).
        expect(m['ask_events']).toBe(0);
    });
});

describe('bench_ab_v2_run — --help', () => {
    it('exits 0 and prints the usage token (prose not byte-compared)', () => {
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(ts.stdout.startsWith('usage: bench_ab_v2_run.py')).toBe(true);
    });

    it('accepts the checkpoint flags without an arg error', () => {
        // dry-run returns before any checkpoint IO — this asserts parse only.
        const ts = runTs(['--mode', 'dry-run', '--no-checkpoint', '--fresh', '--limit', '1']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('DRY');
    });
});

describe('bench_ab_v2_run — checkpoint / resume', () => {
    const mkTmp = (): string => {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-v2-ckpt-'));
        tmpDirs.push(d);
        return d;
    };

    it('checkpoint_key is deterministic and sensitive to every config field', () => {
        const cfg = {
            corpus: 'ab-trackb-v2',
            model: 'gpt-5-mini',
            seeds: 3,
            arms: ['vanilla', 'placebo'],
            budget: 1.0,
            timeout: 180,
            host: 'codex',
            task_ids: ['t1', 't2'],
        };
        const base = checkpoint_key(cfg);
        expect(checkpoint_key({ ...cfg })).toBe(base);
        expect(checkpoint_key({ ...cfg, model: 'other' })).not.toBe(base);
        expect(checkpoint_key({ ...cfg, seeds: 2 })).not.toBe(base);
        expect(checkpoint_key({ ...cfg, arms: ['vanilla'] })).not.toBe(base);
        expect(checkpoint_key({ ...cfg, task_ids: ['t1'] })).not.toBe(base);
        expect(checkpoint_key({ ...cfg, host: 'claude' })).not.toBe(base);
    });

    it('freeze/thaw round-trips PyFloat losslessly (the 1.0-vs-1 report parity)', () => {
        const result: Record<string, unknown> = {
            errored: false,
            discipline_score: new PyFloat(1),
            metrics: { wall_time_seconds: new PyFloat(0), ask_vs_act_ratio: 0, num_turns: 3 },
            seed: 2,
        };
        const thawed = thaw_result(JSON.parse(JSON.stringify(freeze_result(result)))) as Record<string, unknown>;
        expect(thawed['discipline_score']).toBeInstanceOf(PyFloat);
        expect((thawed['discipline_score'] as PyFloat).value).toBe(1);
        const metrics = thawed['metrics'] as Record<string, unknown>;
        expect(metrics['wall_time_seconds']).toBeInstanceOf(PyFloat);
        // the int-0 ask ratio must stay a plain number, NOT become a PyFloat
        expect(metrics['ask_vs_act_ratio']).toBe(0);
        expect(thawed['seed']).toBe(2);
    });

    it('load_checkpoint skips a truncated tail line and lets later duplicates win', () => {
        const dir = mkTmp();
        const file = path.join(dir, 'ckpt.jsonl');
        append_checkpoint(file, run_key('t1', 'vanilla', 0), { errored: false, v: 1 });
        append_checkpoint(file, run_key('t1', 'vanilla', 1), { errored: false, v: 2 });
        append_checkpoint(file, run_key('t1', 'vanilla', 0), { errored: false, v: 3 }); // dup → wins
        fs.appendFileSync(file, '{"key":"t1|vanilla|2","result":{"err'); // killed mid-write
        const map = load_checkpoint(file);
        expect(map.size).toBe(2);
        expect((map.get('t1|vanilla|0') as Record<string, unknown>)['v']).toBe(3);
        expect(map.has('t1|vanilla|2')).toBe(false);
        // missing file → empty map, no throw
        expect(load_checkpoint(path.join(dir, 'nope.jsonl')).size).toBe(0);
    });

    it('collect_records resumes: a killed sweep re-runs ONLY the missing runs', () => {
        const dir = mkTmp();
        const ckptPath = path.join(dir, 'ckpt.jsonl');
        const tasks = [
            { id: 't1', archetype: 'a', rule: 'r' },
            { id: 't2', archetype: 'a', rule: 'r' },
        ];
        const arms = ['vanilla', 'placebo'];
        const seeds = 2; // 2 tasks × 2 arms × 2 seeds = 8 runs
        const mkResult = (task: Record<string, unknown>, arm: string, seed: number): Record<string, unknown> => ({
            errored: false,
            reason: null,
            discipline_score: new PyFloat(1),
            marker: `${String(task['id'])}-${arm}-${seed}`,
        });

        // First sweep: the run function dies on call #4 (simulated kill at 3/8).
        let calls1 = 0;
        const dying = (task: Record<string, unknown>, arm: string, seed: number): Record<string, unknown> => {
            calls1 += 1;
            if (calls1 > 3) {
                throw new Error('killed');
            }
            return mkResult(task, arm, seed);
        };
        const ckpt1: CheckpointIO = { path: ckptPath, completed: new Map() };
        expect(() => collect_records(tasks, arms, seeds, dying, ckpt1, () => {})).toThrow('killed');
        expect(load_checkpoint(ckptPath).size).toBe(3); // 3 completed runs survived the kill

        // Second sweep, same config: resume from the checkpoint.
        let calls2 = 0;
        const counting = (task: Record<string, unknown>, arm: string, seed: number): Record<string, unknown> => {
            calls2 += 1;
            return mkResult(task, arm, seed);
        };
        const ckpt2: CheckpointIO = { path: ckptPath, completed: load_checkpoint(ckptPath) };
        const logs: string[] = [];
        const { records, executed, reused } = collect_records(tasks, arms, seeds, counting, ckpt2, (m) => logs.push(m));
        expect(reused).toBe(3);
        expect(executed).toBe(5);
        expect(calls2).toBe(5); // the 3 completed runs were NOT re-spent
        // progress lines only for executed runs, with the GLOBAL run index
        expect(logs).toHaveLength(5);
        expect(logs[0]).toContain('[4/8]');

        // The assembled report is complete and ordered as a fresh full run.
        expect(records).toHaveLength(2);
        for (const [ti, task] of tasks.entries()) {
            const perArm = (records[ti] as Record<string, unknown>)['arms'] as Record<string, Record<string, unknown>[]>;
            for (const arm of arms) {
                expect(perArm[arm]).toHaveLength(seeds);
                for (let seed = 0; seed < seeds; seed += 1) {
                    const r = perArm[arm]![seed] as Record<string, unknown>;
                    expect(r['marker']).toBe(`${task.id}-${arm}-${seed}`);
                    expect(r['seed']).toBe(seed);
                    // PyFloat survives the checkpoint round-trip on reused runs too
                    expect(r['discipline_score']).toBeInstanceOf(PyFloat);
                }
            }
        }
    });

    it('collect_records without a checkpoint keeps the pre-checkpoint semantics', () => {
        const tasks = [{ id: 't1', archetype: 'a', rule: 'r' }];
        const logs: string[] = [];
        const { records, executed, reused } = collect_records(
            tasks,
            ['vanilla'],
            2,
            (_t, _a, seed) => ({ errored: false, s: seed }),
            null,
            (m) => logs.push(m),
        );
        expect(executed).toBe(2);
        expect(reused).toBe(0);
        expect(logs).toEqual(['[1/2] t1 · vanilla · seed 0\n', '[2/2] t1 · vanilla · seed 1\n']);
        const perArm = (records[0] as Record<string, unknown>)['arms'] as Record<string, unknown[]>;
        expect(perArm['vanilla']).toHaveLength(2);
    });
});

// ── measurement integrity (S0.3 deltas #1–#4) ───────────────────────────────
//
// These guard the paid-run preconditions the roadmap's Phase-3 halt note says
// must land before any spend. Each gate is asserted BOTH ways: it fires on the
// bad input and stays quiet on the good one.
describe('bench_ab_v2_run — measurement integrity', () => {
    it('refuses a bare model alias before any spend', () => {
        const r = runTs(['--model', 'sonnet', '--mode', 'dry-run']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('refusing bare model alias');
    });

    it('accepts a pinned full model id', () => {
        const r = runTs(['--model', 'claude-sonnet-4-6', '--mode', 'dry-run', '--limit', '1']);
        expect(r.status).toBe(0);
    });

    it('refuses --max-usd when no pricing row matches the model', () => {
        // Enforcing a cap the harness cannot price would be a cap in name only.
        // Asserted in dry-run so the check is proven on a host WITHOUT the claude
        // CLI too — behind the CLI-presence check this was unreachable in CI.
        const r = runTs(['--model', 'some-unpriced-model-9', '--max-usd', '10', '--limit', '1', '--mode', 'dry-run']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('the sweep cap cannot be enforced');
    });

    it('accepts --max-usd on a priceable model', () => {
        const r = runTs(['--model', 'claude-sonnet-4-6', '--max-usd', '10', '--limit', '1', '--mode', 'dry-run']);
        expect(r.status).toBe(0);
    });

    it('leaves an unpriceable model alone when no cap was asked for', () => {
        // The refusal is about an unenforceable CAP, not about the model.
        const r = runTs(['--model', 'some-unpriced-model-9', '--limit', '1', '--mode', 'dry-run']);
        expect(r.status).toBe(0);
    });

    it('reports the sweep cap in the dry-run line', () => {
        expect(runTs(['--mode', 'dry-run', '--limit', '1', '--max-usd', '25']).stdout).toContain('sweep cap=$25');
        expect(runTs(['--mode', 'dry-run', '--limit', '1']).stdout).toContain('sweep cap=none');
    });

    it('integrity_fields stamps the activation block a plugin arm needs', () => {
        const run = {
            errored: false,
            tokens_breakdown: { input_tokens: 90_000, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
            models_seen: ['claude-sonnet-4-6'],
        };
        const f = integrity_fields(run, { setting_sources: null, inject: null }, 0, 'claude-sonnet-4-6');
        expect((f['activation'] as Record<string, unknown>)['expected']).toBe('plugin');
        expect((f['activation'] as Record<string, unknown>)['verdict']).toBe('ok');
        expect((f['activation'] as Record<string, unknown>)['prompt_tokens']).toBe(90_000);
        // Delta #2: the breakdown survives onto the record instead of being discarded.
        expect(f['tokens_breakdown']).toEqual(run.tokens_breakdown);
        expect((f['model_check'] as Record<string, unknown>)['ok']).toBe(true);
    });

    it('integrity_fields records a model swap the totals would not reveal', () => {
        const f = integrity_fields(
            { errored: false, tokens_breakdown: {}, models_seen: ['claude-opus-4-8'] },
            { setting_sources: null, inject: null },
            0,
            'claude-sonnet-4-6',
        );
        expect((f['model_check'] as Record<string, unknown>)['ok']).toBe(false);
    });

    it('collect_records stops the sweep when the guard aborts, keeping completed runs', () => {
        const tasks = [{ id: 't1' }, { id: 't2' }];
        let seen = 0;
        const { records, executed, aborted } = collect_records(
            tasks,
            ['vanilla'],
            2,
            () => ({ errored: false }),
            null,
            () => {},
            () => (++seen >= 2 ? 'sweep budget abort: test' : null),
        );
        expect(aborted).toContain('sweep budget abort');
        expect(executed).toBe(2);
        // The completed runs are still returned — an abort costs no finished work.
        const perArm = (records[0] as Record<string, unknown>)['arms'] as Record<string, unknown[]>;
        expect(perArm['vanilla']).toHaveLength(2);
        expect(records).toHaveLength(1);
    });

    it('collect_records runs to completion when the guard never aborts', () => {
        const { executed, aborted } = collect_records(
            [{ id: 't1' }, { id: 't2' }],
            ['vanilla'],
            2,
            () => ({ errored: false }),
            null,
            () => {},
            () => null,
        );
        expect(aborted).toBeNull();
        expect(executed).toBe(4);
    });
});

// ── delta #8 — the no-network selftest ──────────────────────────────────────
//
// The mode's whole claim is "runs green with no network and no key", so the
// end-to-end test strips the credentials from the child env rather than trusting
// that nothing reached for them.

describe('bench_ab_v2_run — selftest mode', () => {
    const NO_CREDS: NodeJS.ProcessEnv = {
        ANTHROPIC_API_KEY: undefined,
        CLAUDE_CODE_OAUTH_TOKEN: undefined,
        ANTHROPIC_AUTH_TOKEN: undefined,
    };

    it('exits 0 with no key and marks the report unpublishable', () => {
        const r = runTs(
            [
                '--mode',
                'selftest',
                '--arms',
                'vanilla,package,package-ladder,bare-principle,placebo',
                '--seeds',
                '2',
                '--limit',
                '2',
                '--model',
                'claude-sonnet-4-5-20250929',
                '--no-checkpoint',
            ],
            NO_CREDS,
        );
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('SELFTEST');
        expect(r.stdout).toContain('not publishable');

        // The report path is named so a selftest artefact cannot be mistaken for a
        // measured one, and the payload says the same thing independently.
        const m = /internal\/bench\/reports\/ab-v2\/([^\s]+\.json)/.exec(r.stdout);
        expect(m).not.toBeNull();
        const file = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab-v2', (m as RegExpExecArray)[1] as string);
        expect(path.basename(file)).toContain('-selftest');

        const payload = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
        expect(payload['tier']).toBe('selftest');
        expect(payload['synthetic']).toBe(true);

        const audit = payload['activation_audit'] as Record<string, unknown>;
        // The audit RAN (it is not vacuous) and passed.
        expect(audit['violations']).toEqual([]);
        expect(audit['checked']).toBeGreaterThan(0);

        // Delta #7 end-to-end: one preserved workspace per (task, arm, seed).
        // Under the old task-only key this set would have had one element.
        const records = payload['records'] as Record<string, unknown>[];
        const workspaces: string[] = [];
        let syntheticRuns = 0;
        for (const rec of records) {
            for (const runs of Object.values(rec['arms'] as Record<string, Record<string, unknown>[]>)) {
                for (const run of runs) {
                    workspaces.push(String(run['workspace']));
                    if (run['synthetic'] === true) {
                        syntheticRuns += 1;
                    }
                }
            }
        }
        expect(workspaces).toHaveLength(2 * 5 * 2);
        expect(new Set(workspaces).size).toBe(workspaces.length);
        // Every trial is stamped synthetic, so no single run can be quoted as real.
        expect(syntheticRuns).toBe(workspaces.length);

        fs.rmSync(file, { force: true });
    });

    it('selftest_usage: lift arms clear the audit ratio, the bare control cannot', () => {
        const base = selftest_usage('vanilla', 0, 2000);
        const basePt = base.input_tokens + base.cache_read_input_tokens + base.cache_creation_input_tokens;

        for (const arm of ['package', 'package-ladder', 'placebo']) {
            const u = selftest_usage(arm, 0, 2000);
            const pt = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens;
            expect(pt / basePt).toBeGreaterThan(1.2);
        }
        // This is the measured reason `bare-principle` declares min_lift_ratio:
        // null — its footprint sits just above baseline, so a lift check on it
        // would fail a perfectly healthy run.
        const bare = selftest_usage('bare-principle', 0, 2000);
        const barePt = bare.input_tokens + bare.cache_read_input_tokens + bare.cache_creation_input_tokens;
        expect(barePt / basePt).toBeLessThan(1.2);
    });

    it('the selftest audit fires in the FAILURE direction too', () => {
        // A selftest that can only ever be observed passing proves nothing. Force
        // a plugin arm to collapse to baseline and assert the audit catches it —
        // the same violation a disabled or version-drifted plugin would produce in
        // a live sweep.
        const task = { id: 'trapA-overeng-01', fixture: 'fixtures-v2/trapA-overeng-01' };
        const opts = { model: 'claude-sonnet-4-5-20250929', max_budget: null, timeout: 30, placebo_chars: 2000, sp_dir: os.tmpdir() };
        const collapsed = (_arm: string, seed: number) => ({
            input_tokens: 1000,
            output_tokens: 200 + seed,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
        });

        const records = [
            {
                id: task.id,
                arms: {
                    vanilla: [{ ...selftest_run(task, 'vanilla', { ...opts, seed: 0 }), seed: 0 }],
                    package: [{ ...selftest_run(task, 'package', { ...opts, seed: 0 }, collapsed), seed: 0 }],
                },
            },
        ];
        const audit = audit_activation(records, { baseline_arm: 'vanilla', lift_arms: lift_audit_arms(['vanilla', 'package']) });
        expect(audit.checked).toBe(1);
        expect(audit.violations).toHaveLength(1);
        expect(audit.violations[0]?.kind).toBe('collapsed-to-baseline');
        expect(audit.violations[0]?.arm).toBe('package');
    });
});
