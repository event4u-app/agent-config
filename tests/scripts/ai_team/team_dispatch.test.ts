// Phase 3 Step 5 tests — team-review multi-host fallback (road-to-team-mode).
//
// ALL transport goes through fake seams: the git runner is injected and the
// codex CLI is a `TeamReviewCliClient` whose `_runSubprocess` is patched
// (same pattern as tests/scripts/ai_council/clients.test.ts). Zero billable
// calls, zero live processes.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    load_cli_call_counts,
    record_cli_call,
    type SubprocessResult,
} from '../../../src/scripts/ai_council/clients';
import { build_ai_team_config } from '../../../src/scripts/ai_team/config';
import {
    assert_delegate_allowed,
    build_repo_context_bundle,
    DIFF_BUNDLE_MAX_CHARS,
    type GitRunner,
    parse_review_findings,
    render_capability_delta_header,
    render_manual_block,
    run_team_review,
    TEAM_REVIEW_SYSTEM_PROMPT,
    TeamDelegateDisabledError,
    TeamDisabledError,
    TeamReviewCliClient,
    truncation_marker,
} from '../../../src/scripts/ai_team/team_dispatch';

const tmp_dirs: string[] = [];

function make_tmp(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ai-team-dispatch-')));
    tmp_dirs.push(dir);
    return dir;
}

afterEach(() => {
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

const FAKE_HEAD = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

/** Fake git runner: canned per-subcommand output + a call log. */
function fake_git(overrides: Partial<Record<string, string>> = {}): {
    run: GitRunner;
    calls: string[][];
} {
    const calls: string[][] = [];
    const canned: Record<string, string> = {
        'rev-parse': `${FAKE_HEAD}\n`,
        status: ' M src/a.ts\n',
        'diff:--cached': 'diff --git a/src/a.ts b/src/a.ts\n+staged line\n',
        diff: 'diff --git a/src/b.ts b/src/b.ts\n+unstaged line\n',
        'ls-files': 'src/a.ts\nsrc/b.ts\n',
        ...overrides,
    };
    const run: GitRunner = (args) => {
        calls.push([...args]);
        const key = args[0] === 'diff' && args[1] === '--cached' ? 'diff:--cached' : (args[0] ?? '');
        return canned[key] ?? '';
    };
    return { run, calls };
}

/** Enabled config with a tunable ceiling. */
function enabled_config(extra: Record<string, unknown> = {}) {
    return build_ai_team_config({ enabled: true, ...extra });
}

/** Fake codex client: real TeamReviewCliClient with `_runSubprocess` patched. */
function fake_client(
    canned: SubprocessResult,
    opts: Record<string, unknown> = {},
): { client: TeamReviewCliClient; calls: { cmd: string[]; stdin: string | null }[] } {
    const calls: { cmd: string[]; stdin: string | null }[] = [];
    const client = new TeamReviewCliClient({ binary: '/bin/echo', ...opts });
    (
        client as unknown as {
            _runSubprocess: (c: string[], s: string | null) => SubprocessResult;
        }
    )._runSubprocess = (cmd, stdinPayload) => {
        calls.push({ cmd, stdin: stdinPayload });
        return canned;
    };
    return { client, calls };
}

/** Codex NDJSON stream carrying `text` as the final assistant message. */
function codex_stdout(text: string): string {
    return (
        `${JSON.stringify({ type: 'item.completed', item: { content: [{ text }] } })}\n` +
        `${JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5 } })}\n`
    );
}

// === bundle: size cap red/green at the boundary ============================

describe('build_repo_context_bundle — diff cap', () => {
    // The combined diff is deterministic: two fixed section headers + bodies.
    function combined_len(staged: string, unstaged: string): number {
        return (
            `### staged diff (git diff --cached)\n${staged}\n\n### unstaged diff (git diff)\n${unstaged}`
                .length
        );
    }

    it('exactly at the cap → NOT truncated, no marker (green boundary)', () => {
        const staged = 'S'.repeat(200);
        const unstaged = 'U'.repeat(100);
        const cap = combined_len(staged, unstaged);
        const { run } = fake_git({ 'diff:--cached': staged, diff: unstaged });
        const bundle = build_repo_context_bundle({ run_git: run, max_diff_chars: cap });
        expect(bundle.diff_truncated).toBe(false);
        expect(bundle.diff_cut_chars).toBe(0);
        expect(bundle.diff).not.toContain('TRUNCATED');
        expect(bundle.diff.length).toBe(cap);
    });

    it('one char over the cap → truncated, marker names the cut (red boundary)', () => {
        const staged = 'S'.repeat(200);
        const unstaged = 'U'.repeat(100);
        const cap = combined_len(staged, unstaged) - 1; // combined = cap + 1
        const { run } = fake_git({ 'diff:--cached': staged, diff: unstaged });
        const bundle = build_repo_context_bundle({ run_git: run, max_diff_chars: cap });
        expect(bundle.diff_truncated).toBe(true);
        expect(bundle.diff_cut_chars).toBe(1);
        expect(bundle.diff).toContain(truncation_marker(1, cap));
        // Cut at exactly the cap; only the marker follows.
        expect(bundle.diff.startsWith(`### staged diff (git diff --cached)\n${staged}`)).toBe(true);
        expect(bundle.diff.length).toBe(cap + truncation_marker(1, cap).length);
    });

    it('truncation marker names how much was cut and at which cap', () => {
        expect(truncation_marker(1234, 500)).toContain('1234 characters');
        expect(truncation_marker(1234, 500)).toContain('500-char bundle cap');
    });

    it('default cap is the module constant', () => {
        const { run } = fake_git();
        const bundle = build_repo_context_bundle({ run_git: run });
        expect(bundle.diff_truncated).toBe(false);
        expect(DIFF_BUNDLE_MAX_CHARS).toBeGreaterThan(bundle.diff.length);
    });
});

// === bundle: read-only by construction =====================================

describe('build_repo_context_bundle — read-only guard', () => {
    it('only allowlisted read-only git subcommands are issued', () => {
        const { run, calls } = fake_git();
        build_repo_context_bundle({ run_git: run });
        const subs = calls.map((c) => c[0]);
        expect(new Set(subs)).toEqual(new Set(['rev-parse', 'status', 'diff', 'ls-files']));
    });

    it('bundle carries HEAD sha, status, and tracked files', () => {
        const { run } = fake_git();
        const bundle = build_repo_context_bundle({ run_git: run });
        expect(bundle.head_ref).toBe(FAKE_HEAD);
        expect(bundle.status).toBe(' M src/a.ts');
        expect(bundle.files).toEqual(['src/a.ts', 'src/b.ts']);
    });
});

// === capability-delta header ===============================================

describe('render_capability_delta_header', () => {
    it('names every honesty clause: one sync call, diff bundle, no background jobs, plugin pointer', () => {
        const header = render_capability_delta_header();
        expect(header).toContain('FALLBACK (reduced capability)');
        expect(header).toContain('ONE synchronous model call');
        expect(header).toContain('no background jobs');
        expect(header).toContain('size-capped diff bundle, NOT the live repository');
        expect(header).toContain('agent-config doctor --check team');
        expect(header).toContain('strictly more capable');
    });

    it('run_team_review renders the header FIRST in call mode', () => {
        const lines: string[] = [];
        const { run } = fake_git();
        const { client } = fake_client(
            { returncode: 0, stdout: codex_stdout('{"status":"DONE","findings":[]}'), stderr: '' },
            { cli_calls_path: path.join(make_tmp(), 'cli-calls.json') },
        );
        run_team_review({
            config: enabled_config(),
            run_git: run,
            make_client: () => client,
            cli_calls_path: null,
            out: (l) => lines.push(l),
        });
        expect(lines[0]).toBe(render_capability_delta_header());
    });

    it('run_team_review renders the header FIRST in manual mode too', () => {
        const lines: string[] = [];
        const { run } = fake_git();
        run_team_review({
            config: enabled_config(),
            run_git: run,
            manual: true,
            out: (l) => lines.push(l),
        });
        expect(lines[0]).toBe(render_capability_delta_header());
    });
});

// === fail-closed config gate ===============================================

describe('run_team_review — fail-closed when disabled', () => {
    it('enabled: false (default) → TeamDisabledError with the enable pointer, no git call', () => {
        const { run, calls } = fake_git();
        expect(() =>
            run_team_review({ config: build_ai_team_config({}), run_git: run, out: () => {} }),
        ).toThrow(TeamDisabledError);
        expect(calls).toEqual([]); // gate fires before any repo access
        try {
            run_team_review({ config: build_ai_team_config({}), run_git: run, out: () => {} });
        } catch (exc) {
            expect((exc as Error).message).toContain('ai_team.enabled: true');
            expect((exc as Error).message).toContain('.agent-settings.yml');
        }
    });
});

// === delegate double gate ==================================================

describe('assert_delegate_allowed — /team:delegate double gate', () => {
    it('enabled: false (default) → TeamDisabledError; allow_delegate alone never opens the gate', () => {
        expect(() => assert_delegate_allowed(build_ai_team_config({}))).toThrow(TeamDisabledError);
        expect(() =>
            assert_delegate_allowed(build_ai_team_config({ allow_delegate: true })),
        ).toThrow(TeamDisabledError);
    });

    it('enabled: true + allow_delegate: false (default) → TeamDelegateDisabledError with the opt-in pointer', () => {
        expect(() => assert_delegate_allowed(build_ai_team_config({ enabled: true }))).toThrow(
            TeamDelegateDisabledError,
        );
        try {
            assert_delegate_allowed(build_ai_team_config({ enabled: true }));
        } catch (exc) {
            expect((exc as Error).message).toContain('ai_team.allow_delegate: true');
            expect((exc as Error).message).toContain('write access');
        }
    });

    it('both true → gate opens (no throw)', () => {
        expect(() =>
            assert_delegate_allowed(build_ai_team_config({ enabled: true, allow_delegate: true })),
        ).not.toThrow();
    });
});

// === manual mode ===========================================================

describe('run_team_review — manual mode', () => {
    it('renders the bundle between ═ rules; no call, no quota spend', () => {
        const p = path.join(make_tmp(), 'cli-calls.json');
        const { run } = fake_git();
        const lines: string[] = [];
        const result = run_team_review({
            config: enabled_config(),
            run_git: run,
            manual: true,
            cli_calls_path: p,
            out: (l) => lines.push(l),
        });
        expect(result.mode).toBe('manual');
        const block = result.manual_block ?? '';
        const bar = '═'.repeat(67);
        expect(block.startsWith(bar)).toBe(true);
        expect(block.endsWith(bar)).toBe(true);
        expect(block).toContain('Team review — manual mode');
        expect(block).toContain('Paste this block');
        expect(block).toContain(TEAM_REVIEW_SYSTEM_PROMPT);
        expect(block).toContain(`HEAD ${FAKE_HEAD}`);
        expect(block).toContain('no call was made, no quota was spent');
        // Quota state untouched — no cli-calls.json was ever written.
        expect(fs.existsSync(p)).toBe(false);
        expect(load_cli_call_counts(p)).toEqual({});
        expect(result.envelope).toBeUndefined();
    });

    it('render_manual_block matches the council ═-rule shape', () => {
        const { run } = fake_git();
        const bundle = build_repo_context_bundle({ run_git: run });
        const block = render_manual_block(bundle);
        const rule_lines = block.split('\n').filter((l) => l === '═'.repeat(67));
        expect(rule_lines.length).toBe(4); // head pair + tail pair
    });
});

// === envelope: happy parse =================================================

describe('run_team_review — envelope (happy parse)', () => {
    it('valid findings JSON → DONE_WITH_CONCERNS envelope with findings, ref, model, quota', () => {
        const p = path.join(make_tmp(), 'cli-calls.json');
        const model_reply = JSON.stringify({
            status: 'DONE_WITH_CONCERNS',
            summary: 'one real defect.',
            findings: [
                {
                    severity: 'major',
                    evidence: '`+unstaged line` drops the null check present above the hunk',
                    suggested_fix: 'restore the guard before dereferencing',
                    location: 'src/b.ts:12',
                },
            ],
        });
        const { run } = fake_git();
        const { client, calls } = fake_client(
            { returncode: 0, stdout: codex_stdout(model_reply), stderr: '' },
            { model: 'auto', cli_calls_path: p, max_calls_per_day: 50 },
        );
        const result = run_team_review({
            config: enabled_config({ max_calls_per_day: 50 }),
            run_git: run,
            make_client: () => client,
            cli_calls_path: p,
            out: () => {},
        });
        expect(result.mode).toBe('call');
        const env = result.envelope;
        expect(env).toBeDefined();
        expect(env?.status).toBe('DONE_WITH_CONCERNS');
        expect(env?.findings).toEqual([
            {
                severity: 'major',
                evidence: '`+unstaged line` drops the null check present above the hunk',
                suggested_fix: 'restore the guard before dereferencing',
                location: 'src/b.ts:12',
            },
        ]);
        expect(env?.reviewed_ref).toBe(FAKE_HEAD);
        expect(env?.model).toBe('auto');
        expect(env?.quota).toEqual({ used: 1, ceiling: 50 }); // recorded via existing machinery
        expect(env?.raw).toBeUndefined();
        // Exactly one synchronous call; system prompt + bundle rode the argv.
        expect(calls.length).toBe(1);
        const argv = calls[0]?.cmd ?? [];
        expect(argv.join(' ')).toContain('exec');
        expect(argv).toContain('--system');
    });

    it('clean review (no findings) → DONE', () => {
        const p = path.join(make_tmp(), 'cli-calls.json');
        const { run } = fake_git();
        const { client } = fake_client(
            {
                returncode: 0,
                stdout: codex_stdout('{"status":"DONE","summary":"clean","findings":[]}'),
                stderr: '',
            },
            { cli_calls_path: p },
        );
        const result = run_team_review({
            config: enabled_config(),
            run_git: run,
            make_client: () => client,
            cli_calls_path: p,
            out: () => {},
        });
        expect(result.envelope?.status).toBe('DONE');
        expect(result.envelope?.findings).toEqual([]);
    });

    it('NEEDS_CONTEXT from the model carries blocking_question (schema conformance)', () => {
        const p = path.join(make_tmp(), 'cli-calls.json');
        const { run } = fake_git();
        const { client } = fake_client(
            {
                returncode: 0,
                stdout: codex_stdout(
                    '{"status":"NEEDS_CONTEXT","summary":"is `foo()` idempotent? the diff cannot tell.","findings":[]}',
                ),
                stderr: '',
            },
            { cli_calls_path: p },
        );
        const result = run_team_review({
            config: enabled_config(),
            run_git: run,
            make_client: () => client,
            cli_calls_path: p,
            out: () => {},
        });
        expect(result.envelope?.status).toBe('NEEDS_CONTEXT');
        expect(result.envelope?.blocking_question).toContain('idempotent');
    });
});

// === envelope: unparseable fallback ========================================

describe('run_team_review — envelope (unparseable output)', () => {
    it('non-JSON model output → DONE_WITH_CONCERNS with raw preserved verbatim', () => {
        const p = path.join(make_tmp(), 'cli-calls.json');
        const prose = 'Overall this looks fine, though I would rename a few things.';
        const { run } = fake_git();
        const { client } = fake_client(
            { returncode: 0, stdout: codex_stdout(prose), stderr: '' },
            { cli_calls_path: p },
        );
        const result = run_team_review({
            config: enabled_config(),
            run_git: run,
            make_client: () => client,
            cli_calls_path: p,
            out: () => {},
        });
        const env = result.envelope;
        expect(env?.status).toBe('DONE_WITH_CONCERNS');
        expect(env?.findings).toEqual([]);
        expect(env?.raw).toBe(prose); // never silently dropped
        expect(env?.summary).toContain('not parseable');
    });
});

// === parse_review_findings unit grid =======================================

describe('parse_review_findings', () => {
    it('strips a ```json code fence before parsing', () => {
        const fenced = '```json\n{"status":"DONE","findings":[]}\n```';
        const parsed = parse_review_findings(fenced);
        expect(parsed.parsed).toBe(true);
        expect(parsed.status).toBe('DONE');
    });

    it('findings present can never report bare DONE (consistency floor)', () => {
        const parsed = parse_review_findings(
            JSON.stringify({
                status: 'DONE',
                findings: [{ severity: 'minor', evidence: 'e', suggested_fix: 'f' }],
            }),
        );
        expect(parsed.status).toBe('DONE_WITH_CONCERNS');
    });

    it('unknown severity is clamped to info, finding kept', () => {
        const parsed = parse_review_findings(
            JSON.stringify({ findings: [{ severity: 'apocalyptic', evidence: 'e', suggested_fix: 'f' }] }),
        );
        expect(parsed.parsed).toBe(true);
        expect(parsed.findings[0]?.severity).toBe('info');
    });

    it('a finding missing evidence/suggested_fix poisons the parse → raw fallback', () => {
        const text = JSON.stringify({ findings: [{ severity: 'major' }] });
        const parsed = parse_review_findings(text);
        expect(parsed.parsed).toBe(false);
        expect(parsed.raw).toBe(text);
    });
});

// === auth-fail path ========================================================

describe('run_team_review — auth failure (shared _AUTH_FAILURE_PATTERNS)', () => {
    it('stderr matching codex login → BLOCKED with the codex-login remediation', () => {
        const p = path.join(make_tmp(), 'cli-calls.json');
        const { run } = fake_git();
        const { client } = fake_client(
            { returncode: 1, stdout: '', stderr: 'error: please run codex login first' },
            { cli_calls_path: p },
        );
        const result = run_team_review({
            config: enabled_config(),
            run_git: run,
            make_client: () => client,
            cli_calls_path: p,
            out: () => {},
        });
        const env = result.envelope;
        expect(env?.status).toBe('BLOCKED');
        expect(env?.findings).toEqual([]);
        expect(env?.blocking_reason).toContain('auth_expired');
        expect(env?.blocking_reason).toContain('codex login');
        expect(env?.reviewed_ref).toBe(FAKE_HEAD);
    });

    it('401 in stderr also classifies as auth_expired (OpenAI subclass patterns)', () => {
        const p = path.join(make_tmp(), 'cli-calls.json');
        const { run } = fake_git();
        const { client } = fake_client(
            { returncode: 3, stdout: '', stderr: 'HTTP 401 from backend' },
            { cli_calls_path: p },
        );
        const result = run_team_review({
            config: enabled_config(),
            run_git: run,
            make_client: () => client,
            cli_calls_path: p,
            out: () => {},
        });
        expect(result.envelope?.status).toBe('BLOCKED');
        expect(result.envelope?.blocking_reason).toContain('codex login');
    });
});

// === quota: shared openai bucket, existing machinery only ==================

describe('run_team_review — shared quota bucket', () => {
    it('quota exhausted → BLOCKED, no subprocess spawned, ceiling surfaced', () => {
        const p = path.join(make_tmp(), 'cli-calls.json');
        record_cli_call('openai', p);
        record_cli_call('openai', p); // used=2, ceiling=2 below
        const { run } = fake_git();
        const { client, calls } = fake_client(
            { returncode: 0, stdout: codex_stdout('{"findings":[]}'), stderr: '' },
            { cli_calls_path: p, max_calls_per_day: 2 },
        );
        const result = run_team_review({
            config: enabled_config({ max_calls_per_day: 2 }),
            run_git: run,
            make_client: () => client,
            cli_calls_path: p,
            out: () => {},
        });
        expect(calls).toEqual([]); // gate fired before any spawn
        const env = result.envelope;
        expect(env?.status).toBe('BLOCKED');
        expect(env?.blocking_reason).toContain('quota exhausted');
        expect(env?.blocking_reason).toContain('2/2');
        expect(env?.quota).toEqual({ used: 2, ceiling: 2 });
    });

    it('successful call increments the SAME counts.openai bucket the council uses', () => {
        const p = path.join(make_tmp(), 'cli-calls.json');
        record_cli_call('openai', p); // e.g. a council call earlier today
        const { run } = fake_git();
        const { client } = fake_client(
            { returncode: 0, stdout: codex_stdout('{"findings":[]}'), stderr: '' },
            { cli_calls_path: p, max_calls_per_day: 50 },
        );
        run_team_review({
            config: enabled_config(),
            run_git: run,
            make_client: () => client,
            cli_calls_path: p,
            out: () => {},
        });
        expect(load_cli_call_counts(p)).toEqual({ openai: 2 });
    });
});

// === model sentinel: 'auto' omits --model ==================================

describe('TeamReviewCliClient — ai_team.model sentinel', () => {
    it("model 'auto' passes NO --model flag (codex CLI default applies)", () => {
        const { client, calls } = fake_client(
            { returncode: 0, stdout: codex_stdout('{"findings":[]}'), stderr: '' },
            { model: 'auto', cli_calls_path: path.join(make_tmp(), 'c.json') },
        );
        client.ask('sys', 'user', 64);
        expect(calls[0]?.cmd).not.toContain('--model');
        expect(calls[0]?.cmd).toContain('exec');
    });

    it('an explicit model passes through verbatim', () => {
        const { client, calls } = fake_client(
            { returncode: 0, stdout: codex_stdout('{"findings":[]}'), stderr: '' },
            { model: 'gpt-5', cli_calls_path: path.join(make_tmp(), 'c.json') },
        );
        client.ask('sys', 'user', 64);
        const cmd = calls[0]?.cmd ?? [];
        const i = cmd.indexOf('--model');
        expect(i).toBeGreaterThanOrEqual(0);
        expect(cmd[i + 1]).toBe('gpt-5');
    });
});

// === envelope schema file ==================================================

describe('team-review-status.json schema', () => {
    const schema_path = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../src/skills/subagent-orchestration/schemas/team-review-status.json',
    );

    it('exists beside subagent-status.json and parses', () => {
        expect(fs.existsSync(schema_path)).toBe(true);
        expect(
            fs.existsSync(path.join(path.dirname(schema_path), 'subagent-status.json')),
        ).toBe(true);
        const schema = JSON.parse(fs.readFileSync(schema_path, 'utf-8'));
        expect(schema['title']).toBe('Team Review Status Envelope');
    });

    it('status + severity enums match the dispatcher types; frame fields required', () => {
        const schema = JSON.parse(fs.readFileSync(schema_path, 'utf-8'));
        expect(schema['properties']['status']['enum']).toEqual([
            'DONE',
            'DONE_WITH_CONCERNS',
            'NEEDS_CONTEXT',
            'BLOCKED',
        ]);
        expect(schema['properties']['findings']['items']['properties']['severity']['enum']).toEqual(
            ['critical', 'major', 'minor', 'info'],
        );
        expect(schema['required']).toEqual(['status', 'findings', 'reviewed_ref', 'model', 'quota']);
        expect(schema['additionalProperties']).toBe(false);
    });

    it('an emitted envelope carries only schema-declared keys', () => {
        const schema = JSON.parse(fs.readFileSync(schema_path, 'utf-8'));
        const declared = new Set(Object.keys(schema['properties']));
        const p = path.join(make_tmp(), 'cli-calls.json');
        const { run } = fake_git();
        const { client } = fake_client(
            { returncode: 0, stdout: codex_stdout('{"findings":[]}'), stderr: '' },
            { cli_calls_path: p },
        );
        const result = run_team_review({
            config: enabled_config(),
            run_git: run,
            make_client: () => client,
            cli_calls_path: p,
            out: () => {},
        });
        for (const key of Object.keys(result.envelope ?? {})) {
            expect(declared.has(key)).toBe(true);
        }
    });
});
