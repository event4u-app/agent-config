// Tests for src/scripts/hooks/dispatch_hook.ts (py2ts Phase 6 — hooks core).
//
// 1:1 port of the pure-parser cases in tests/hooks/test_dispatcher_parser.py
// (_fallback_yaml, _resolve_concerns, _build_envelope, _parse_concern_stdout,
// _severity_for, _reduce, EVENT_VOCABULARY, _maybe_capture_payload). The
// python3-vs-tsx golden-parity layer was retired with the Python→TS final
// deletion (the Python dispatcher no longer exists); end-to-end dispatcher
// behaviour is covered by dispatcher_feedback_traversal.test.ts.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    EVENT_VOCABULARY,
    EXIT_ALLOW,
    EXIT_BLOCK,
    EXIT_WARN,
    _build_envelope,
    _concern_matches_tool,
    _fallback_yaml,
    _load_yaml,
    _maybe_capture_payload,
    _parse_concern_stdout,
    _payload_tool_name,
    _reduce,
    _resolve_concerns,
    _resolve_execution_failure,
    _severity_for,
} from '../../../src/scripts/hooks/dispatch_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

function ns(platform = 'augment', event = 'stop', native = 'Stop') {
    return {
        platform,
        event,
        native_event: native,
        manifest: MANIFEST,
        dry_run: false,
        project_dir: '',
        min_version: 0,
    };
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-hook-'));
    delete process.env['AGENT_HOOK_CAPTURE_DIR'];
});
afterEach(() => {
    delete process.env['AGENT_HOOK_CAPTURE_DIR'];
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
});

// --- _fallback_yaml ---------------------------------------------------

describe('dispatch_hook — _fallback_yaml', () => {
    it('handles lists and scalars', () => {
        const body = [
            '# comment line',
            'schema_version: 1',
            'concerns:',
            '  chat-history:',
            '    script: src/scripts/chat_history.py',
            '    args: [hook-dispatch]',
            '    fail_closed: false',
            'platforms:',
            '  augment:',
            '    session_start: [chat-history]',
            '    stop: []',
            '  copilot:',
            '    fallback_only: true',
            '',
        ].join('\n');
        const parsed = _fallback_yaml(body) as Record<string, Record<string, Record<string, unknown>>>;
        expect(parsed['schema_version']).toBe(1);
        expect(parsed['concerns']?.['chat-history']?.['script']).toBe('src/scripts/chat_history.py');
        expect(parsed['concerns']?.['chat-history']?.['args']).toEqual(['hook-dispatch']);
        expect(parsed['concerns']?.['chat-history']?.['fail_closed']).toBe(false);
        expect(parsed['platforms']?.['augment']?.['session_start']).toEqual(['chat-history']);
        expect(parsed['platforms']?.['augment']?.['stop']).toEqual([]);
        expect(parsed['platforms']?.['copilot']?.['fallback_only']).toBe(true);
    });

    it('strips quoted scalars', () => {
        expect(_fallback_yaml('key: "quoted-value"\n')).toEqual({ key: 'quoted-value' });
    });
});

// --- _resolve_concerns ------------------------------------------------

const MANIFEST_OBJ = {
    concerns: {
        'chat-history': { script: 'src/scripts/chat_history.py', args: ['hook-dispatch'] },
        'roadmap-progress': { script: 'src/scripts/roadmap_progress_hook.py' },
    },
    platforms: {
        augment: { session_start: ['chat-history'], stop: ['chat-history', 'roadmap-progress'] },
        copilot: { fallback_only: true },
    },
};

describe('dispatch_hook — _resolve_concerns', () => {
    it('returns an ordered list', () => {
        const out = _resolve_concerns(MANIFEST_OBJ as Parameters<typeof _resolve_concerns>[0], 'augment', 'stop');
        expect(out.map((c) => c['name'])).toEqual(['chat-history', 'roadmap-progress']);
        expect(out[0]!['script']).toBe('src/scripts/chat_history.py');
    });
    it('unknown platform yields empty', () => {
        expect(_resolve_concerns(MANIFEST_OBJ as Parameters<typeof _resolve_concerns>[0], 'ghost', 'stop')).toEqual([]);
    });
    it('unknown event yields empty', () => {
        expect(_resolve_concerns(MANIFEST_OBJ as Parameters<typeof _resolve_concerns>[0], 'augment', 'ghost')).toEqual([]);
    });
    it('fallback_only platform yields empty', () => {
        expect(_resolve_concerns(MANIFEST_OBJ as Parameters<typeof _resolve_concerns>[0], 'copilot', 'stop')).toEqual([]);
    });
    it('skips an unknown concern name and warns', () => {
        const errSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        const bad = { concerns: {}, platforms: { augment: { stop: ['missing'] } } };
        expect(_resolve_concerns(bad as Parameters<typeof _resolve_concerns>[0], 'augment', 'stop')).toEqual([]);
        expect(errSpy.mock.calls.map((c) => String(c[0])).join('')).toContain('unknown concern');
    });
});

// --- _build_envelope --------------------------------------------------

describe('dispatch_hook — _build_envelope', () => {
    it('schema + passthrough', () => {
        const env = _build_envelope(ns(), '{"session_id": "abc", "extra": 1}');
        expect(env['schema_version']).toBe(1);
        expect(env['platform']).toBe('augment');
        expect(env['event']).toBe('stop');
        expect(env['native_event']).toBe('Stop');
        expect(env['session_id']).toBe('abc');
        expect(env['payload']).toEqual({ session_id: 'abc', extra: 1 });
        expect(env['settings']).toEqual({});
    });
    it('empty stdin yields empty payload', () => {
        expect(_build_envelope(ns(), '')['payload']).toEqual({});
    });
    it('non-dict payload wrapped', () => {
        expect(_build_envelope(ns(), '"raw-string"')['payload']).toEqual({ _raw: 'raw-string' });
    });
    it('malformed json preserved as raw', () => {
        expect(_build_envelope(ns(), '{not-json')['payload']).toEqual({ _raw: '{not-json' });
    });
});

// --- _parse_concern_stdout / _severity_for / _reduce -----------------

describe('dispatch_hook — stdout/severity/reduce', () => {
    it('parse_concern_stdout variants', () => {
        expect(_parse_concern_stdout('')).toEqual({});
        expect(_parse_concern_stdout('not json')).toEqual({ _raw_stdout: 'not json' });
        expect(_parse_concern_stdout('{"decision": "warn"}')).toEqual({ decision: 'warn' });
        expect(_parse_concern_stdout('[1, 2]')).toEqual({ _raw: [1, 2] });
    });
    it('severity_for', () => {
        expect(_severity_for(0)).toBe('allow');
        expect(_severity_for(1)).toBe('block');
        expect(_severity_for(2)).toBe('warn');
        expect(_severity_for(7)).toBe('error');
    });
    it('reduce: block dominates warn dominates allow', () => {
        expect(_reduce([0, 0, 0])).toBe(EXIT_ALLOW);
        expect(_reduce([0, 2, 0])).toBe(EXIT_WARN);
        expect(_reduce([0, 2, 1])).toBe(EXIT_BLOCK);
        expect(_reduce([])).toBe(EXIT_ALLOW);
    });
});

describe('dispatch_hook — vocabulary', () => {
    it('includes agent_error and session_start', () => {
        expect(EVENT_VOCABULARY.has('agent_error')).toBe(true);
        expect(EVENT_VOCABULARY.has('session_start')).toBe(true);
    });
});

// --- _maybe_capture_payload ------------------------------------------

describe('dispatch_hook — _maybe_capture_payload', () => {
    it('writes when env set', () => {
        process.env['AGENT_HOOK_CAPTURE_DIR'] = tmp;
        _maybe_capture_payload(
            ns('cursor', 'stop', 'stop'),
            '{"hook_event_name": "stop", "session_id": "abc"}',
        );
        const files = fs.readdirSync(tmp).filter((f) => /^cursor__stop__.*\.json$/.test(f));
        expect(files.length).toBe(1);
        const record = JSON.parse(fs.readFileSync(path.join(tmp, files[0]!), 'utf8'));
        expect(record['platform']).toBe('cursor');
        expect(record['event']).toBe('stop');
        expect(record['native_event']).toBe('stop');
        expect(record['raw_payload']['session_id']).toBe('abc');
        expect('captured_at' in record).toBe(true);
    });
    it('silent without env', () => {
        delete process.env['AGENT_HOOK_CAPTURE_DIR'];
        _maybe_capture_payload(ns('cursor', 'stop', 'stop'), '{"x": 1}');
        expect(fs.readdirSync(tmp).filter((f) => f.endsWith('.json'))).toEqual([]);
    });
    it('tolerates invalid json', () => {
        process.env['AGENT_HOOK_CAPTURE_DIR'] = tmp;
        _maybe_capture_payload(ns('windsurf', 'stop', 'post_cascade_response'), 'not-json{garbage');
        const files = fs.readdirSync(tmp).filter((f) => /^windsurf__post_cascade_response__/.test(f));
        expect(files.length).toBe(1);
        const record = JSON.parse(fs.readFileSync(path.join(tmp, files[0]!), 'utf8'));
        expect(record['raw_payload']).toEqual({ _raw_text: 'not-json{garbage' });
    });
    it('creates dir lazily', () => {
        const target = path.join(tmp, 'fresh', 'captures');
        process.env['AGENT_HOOK_CAPTURE_DIR'] = target;
        _maybe_capture_payload(ns('gemini', 'stop', 'AfterAgent'), '{}');
        expect(fs.statSync(target).isDirectory()).toBe(true);
        expect(fs.readdirSync(target).filter((f) => /^gemini__AfterAgent__/.test(f)).length).toBe(1);
    });
});

// --- _load_yaml on the real manifest ---------------------------------

describe('dispatch_hook — _load_yaml', () => {
    it('loads the real manifest with schema_version 1', () => {
        const m = _load_yaml(MANIFEST) as Record<string, unknown>;
        expect(m['schema_version']).toBe(1);
        expect(typeof m['concerns']).toBe('object');
        expect(typeof m['platforms']).toBe('object');
    });
});

describe('_concern_matches_tool — the per-concern `tools:` filter', () => {
    it('absent, "*", malformed, or empty all mean "every event"', () => {
        // Fail toward RUNNING the concern: a filter that cannot be read must
        // never be the thing that silences a guard.
        expect(_concern_matches_tool({ name: 'c' }, 'Bash')).toBe(true);
        expect(_concern_matches_tool({ name: 'c', tools: null }, 'Bash')).toBe(true);
        expect(_concern_matches_tool({ name: 'c', tools: ['*'] }, 'Bash')).toBe(true);
        expect(_concern_matches_tool({ name: 'c', tools: 'Bash' }, 'Bash')).toBe(true);
        expect(_concern_matches_tool({ name: 'c', tools: [] }, 'Bash')).toBe(true);
        expect(_concern_matches_tool({ name: 'c', tools: [1, 2] }, 'Bash')).toBe(true);
    });

    it('filters exactly on the declared names', () => {
        // A hand-written list, not a shipped concern's — the subject is the
        // matcher's exactness, and naming a real concern here would make the
        // assertions below drift every time that concern's set changes.
        const c = { name: 'example', tools: ['Grep', 'Glob', 'Read'] };
        expect(_concern_matches_tool(c, 'Grep')).toBe(true);
        expect(_concern_matches_tool(c, 'Read')).toBe(true);
        expect(_concern_matches_tool(c, 'Bash')).toBe(false);
        expect(_concern_matches_tool(c, 'Write')).toBe(false);
        // Exact, not prefix or case-insensitive — a tool namespace is literal.
        expect(_concern_matches_tool(c, 'grep')).toBe(false);
        expect(_concern_matches_tool(c, 'GrepTool')).toBe(false);
    });

    it('a NON-tool event is never filtered', () => {
        // session_start / stop carry no tool_name. A key that only describes
        // tool events must not silently skip a lifecycle concern.
        const c = { name: 'c', tools: ['Grep'] };
        expect(_concern_matches_tool(c, '')).toBe(true);
    });
});

describe('_payload_tool_name', () => {
    it('reads the host tool name and degrades to "" on any other shape', () => {
        expect(_payload_tool_name({ payload: { tool_name: 'Bash' } })).toBe('Bash');
        expect(_payload_tool_name({ payload: {} })).toBe('');
        expect(_payload_tool_name({ payload: { tool_name: 7 } })).toBe('');
        expect(_payload_tool_name({})).toBe('');
        expect(_payload_tool_name({ payload: 'raw' })).toBe('');
    });
});

describe('the shipped manifest filter matches its concern source', () => {
    it("code-graph-context's tools: list is exactly the set the hook branches on", () => {
        // A manifest list that drifts from the hook's own branches is a silently
        // disabled concern. Pinned against the source, not against a copy of it.
        const manifest = _load_yaml(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'));
        const concerns = (manifest as Record<string, Record<string, Record<string, unknown>>>)['concerns'];
        const declared = concerns?.['code-graph-context']?.['tools'];
        expect(declared).toEqual(['Grep', 'Glob', 'Read', 'Bash']);

        const src = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'code_graph_context_hook.ts'),
            'utf-8',
        );
        const branched = new Set(
            [...src.matchAll(/name === '([A-Za-z]+)'/g)].map((m) => m[1] as string),
        );
        expect([...branched].sort()).toEqual([...(declared as string[])].sort());
    });
});

// --- step 3.3: rc >= 3 resolves by declared severity -------------------
//
// Six of nine `severity: blocking` concerns used to permit the call whenever
// they crashed, because the branch read the `fail_closed:` flag rather than the
// declaration that authorises a refusal in the first place. These pin the new
// resolution in both directions, plus the one-retry bound that keeps a broken
// stop-slot guard from refusing a turn end indefinitely.

describe('dispatch_hook — _resolve_execution_failure', () => {
    it('refuses for a blocking concern that could not decide', () => {
        expect(_resolve_execution_failure({ name: 'g', severity: 'blocking' }, false)).toBe(
            EXIT_BLOCK,
        );
    });

    it('refuses a blocking concern that never opted in via fail_closed', () => {
        // The flag is no longer consulted here. Six concerns depend on this.
        expect(
            _resolve_execution_failure(
                { name: 'g', severity: 'blocking', fail_closed: false },
                false,
            ),
        ).toBe(EXIT_BLOCK);
    });

    it('fails OPEN on the refusal retry, so a deterministic crash cannot wedge a turn', () => {
        expect(
            _resolve_execution_failure({ name: 'turn-end-gate', severity: 'blocking' }, true),
        ).toBe(EXIT_ALLOW);
    });

    it('fails open for an advisory concern even when it declares fail_closed', () => {
        // Severity decides, and it decides BOTH directions. A `fail_closed`
        // advisory concern would otherwise be promoted here and downgraded
        // again by `_is_advisory` — two steps to the answer severity already has.
        expect(
            _resolve_execution_failure(
                { name: 'a', severity: 'advisory', fail_closed: true },
                false,
            ),
        ).toBe(EXIT_ALLOW);
    });

    it('fails open when severity is absent or unrecognised, and is case-insensitive', () => {
        // The safe direction for a typo: an undeclared concern inherits the
        // historical fail-open, never a refusal it was never authorised to make.
        expect(_resolve_execution_failure({ name: 'x' }, false)).toBe(EXIT_ALLOW);
        expect(_resolve_execution_failure({ name: 'x', severity: 'blocked' }, false)).toBe(
            EXIT_ALLOW,
        );
        expect(_resolve_execution_failure({ name: 'x', severity: 'BLOCKING' }, false)).toBe(
            EXIT_BLOCK,
        );
    });
});

// --- step 3.3 end-to-end: the resolution is WIRED, not merely defined --
//
// The unit cases above pin the decision; these run the real dispatcher so the
// branch is proved reachable from a dispatch. `concern_exits_3` rather than
// `concern_throws`, because an uncaught throw exits 1 — a verdict — and never
// reaches the error band this step changed.

const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');

describe('dispatch_hook end-to-end — rc >= 3 resolves by severity', () => {
    function manifestWith(severity: string, event = 'pre_tool_use', native = 'PreToolUse') {
        const p = path.join(tmp, `manifest-${severity}-${event}.yaml`);
        fs.writeFileSync(
            p,
            [
                'schema_version: 1',
                'concerns:',
                '  boom:',
                '    script: tests/hooks/fixtures/concern_exits_3.ts',
                '    fail_closed: false',
                `    severity: ${severity}`,
                'platforms:',
                '  claude:',
                `    ${event}: [boom]`,
                'native_event_aliases:',
                '  claude:',
                `    ${native}: ${event}`,
                '',
            ].join('\n'),
            'utf8',
        );
        return p;
    }

    function dispatch(
        ws: string,
        manifest: string,
        payload: Record<string, unknown>,
        event = 'pre_tool_use',
        native = 'PreToolUse',
    ) {
        return spawnSync(
            TSX_BIN,
            [
                TS_SCRIPT,
                '--platform',
                'claude',
                '--event',
                event,
                '--native-event',
                native,
                '--manifest',
                manifest,
            ],
            { cwd: ws, input: JSON.stringify(payload), encoding: 'utf8' },
        );
    }

    function workspace() {
        const ws = path.join(tmp, `ws-${String(Math.random()).slice(2)}`);
        fs.mkdirSync(ws, { recursive: true });
        return ws;
    }

    function issueRows(ws: string): Array<Record<string, unknown>> {
        const log = path.join(ws, 'agents', 'runtime', 'state', 'dispatch-issues.jsonl');
        if (!fs.existsSync(log)) return [];
        return fs
            .readFileSync(log, 'utf-8')
            .split('\n')
            .filter((l) => l.trim() !== '')
            .map((l) => JSON.parse(l) as Record<string, unknown>);
    }

    it('a blocking concern that could not decide refuses the call', () => {
        const ws = workspace();
        const r = dispatch(ws, manifestWith('blocking'), {
            session_id: 'e2e-blocking',
            tool_name: 'Bash',
        });
        // Claude lowers an internal BLOCK onto exit 2 on pre_tool_use; the
        // assertion that matters is that it is NOT the allow the old flag-based
        // branch produced for a concern without `fail_closed: true`.
        expect(r.status).not.toBe(EXIT_ALLOW);
    });

    it('an advisory concern that could not decide allows, and leaves an issue row', () => {
        const ws = workspace();
        const r = dispatch(ws, manifestWith('advisory'), {
            session_id: 'e2e-advisory',
            tool_name: 'Bash',
        });
        expect(r.status).toBe(EXIT_ALLOW);
        const rows = issueRows(ws);
        expect(rows.some((row) => row['issue'] === 'execution_failed')).toBe(true);
        expect(rows.some((row) => row['hook'] === 'boom')).toBe(true);
    });

    it('a blocking stop concern allows once the host marks the refusal retry', () => {
        // The bound that keeps a deterministic crash from refusing every turn
        // end. Same manifest, same concern, same failure — only the host's
        // `stop_hook_active` differs.
        const m = manifestWith('blocking', 'stop', 'Stop');
        const first = dispatch(
            workspace(),
            m,
            { session_id: 'e2e-stop-first' },
            'stop',
            'Stop',
        );
        const retry = dispatch(
            workspace(),
            m,
            { session_id: 'e2e-stop-retry', stop_hook_active: true },
            'stop',
            'Stop',
        );
        expect(first.status).not.toBe(EXIT_ALLOW);
        expect(retry.status).toBe(EXIT_ALLOW);
    });
});

// --- step 3.3: the spawn timeout stays 30 s, and why that is a finding ----
//
// Step 3.3's text also reads "timeout for a blocking concern becomes
// `sla_ms x 3`". That half is NOT landed, because the two quantities are not
// the same thing: `concern_sla_ms` is derived from the dispatcher's own
// per-concern `duration_ms`, which brackets the concern's work alone (0.564 to
// 1.587 ms registered), while a `spawnSync` timeout must also cover fork,
// interpreter start and module load — a term the bench's control row measures
// at p95 17 ms on 1 vCPU and 26 ms on the GitHub runner.
//
// Wired, it kills every spawned blocking concern before it has run a line; the
// severity resolution above then turns each of those non-verdicts into a deny.
// Probed on the real dispatcher: `AGENT_CONFIG_HOOKS_ISOLATED=1` on
// `claude/pre_tool_use` returned `ETIMEDOUT` for all six blocking concerns and
// exit 2 for an ordinary `Read`.
//
// This pins the direction. The concern is NAMED for a registered SLA row, so a
// future `sla_ms x 3` bound would apply to it and this case would red.

describe('dispatch_hook — the spawn path keeps the historical timeout', () => {
    it('allows a blocking concern whose name carries a registered SLA row', () => {
        const ws = path.join(tmp, `ws-spawn-${String(Math.random()).slice(2)}`);
        fs.mkdirSync(ws, { recursive: true });
        // `block-no-verify` is `sla_ms: 0.921` in hook-latency-budget.json, so
        // `sla_ms x 3` would be a 3 ms kill — less than node's own startup.
        const manifest = path.join(tmp, 'manifest-spawn-sla.yaml');
        fs.writeFileSync(
            manifest,
            [
                'schema_version: 1',
                'concerns:',
                '  block-no-verify:',
                '    script: tests/hooks/fixtures/concern_allow.ts',
                '    fail_closed: true',
                '    severity: blocking',
                'platforms:',
                '  claude:',
                '    pre_tool_use: [block-no-verify]',
                'native_event_aliases:',
                '  claude:',
                '    PreToolUse: pre_tool_use',
                '',
            ].join('\n'),
            'utf8',
        );
        const r = spawnSync(
            TSX_BIN,
            [
                TS_SCRIPT,
                '--platform',
                'claude',
                '--event',
                'pre_tool_use',
                '--native-event',
                'PreToolUse',
                '--manifest',
                manifest,
            ],
            {
                cwd: ws,
                input: JSON.stringify({ session_id: 'spawn-sla', tool_name: 'Read' }),
                encoding: 'utf8',
            },
        );
        expect(r.stderr).not.toMatch(/ETIMEDOUT/);
        expect(r.status).toBe(EXIT_ALLOW);
    });
});

// --- step 3.3: a SIGNALLED spawn is a no-verdict, not an exit 0 ----------
//
// `_run_concern` read the spawn result as `proc.status ?? 0`. A child killed
// by a signal has `status === null` and `signal` set, and reaches that line
// with no `proc.error` whenever the signal came from outside this process —
// an OOM kill, a supervisor SIGTERM, an abort in the child's own runtime. The
// coalescing default turned every one of those into ALLOW.
//
// It was harmless while the error band meant fail-open for six of the nine
// blocking concerns. With the severity resolution above it is the difference
// between a guard that refuses when it is killed and one that waves the call
// through at exactly that moment. Found by an independent review, 2026-10-03.

describe('dispatch_hook — a signalled concern leaves no verdict', () => {
    function signalManifest(severity: string): string {
        const p = path.join(tmp, `manifest-signal-${severity}.yaml`);
        fs.writeFileSync(
            p,
            [
                'schema_version: 1',
                'concerns:',
                '  killed:',
                '    script: tests/hooks/fixtures/concern_self_signals.ts',
                '    fail_closed: false',
                `    severity: ${severity}`,
                'platforms:',
                '  claude:',
                '    pre_tool_use: [killed]',
                'native_event_aliases:',
                '  claude:',
                '    PreToolUse: pre_tool_use',
                '',
            ].join('\n'),
            'utf8',
        );
        return p;
    }

    function dispatchSignal(ws: string, manifest: string, session: string) {
        return spawnSync(
            TSX_BIN,
            [
                TS_SCRIPT,
                '--platform',
                'claude',
                '--event',
                'pre_tool_use',
                '--native-event',
                'PreToolUse',
                '--manifest',
                manifest,
            ],
            {
                cwd: ws,
                input: JSON.stringify({ session_id: session, tool_name: 'Bash' }),
                encoding: 'utf8',
            },
        );
    }

    function rowsIn(ws: string): Array<Record<string, unknown>> {
        const log = path.join(ws, 'agents', 'runtime', 'state', 'dispatch-issues.jsonl');
        if (!fs.existsSync(log)) return [];
        return fs
            .readFileSync(log, 'utf-8')
            .split('\n')
            .filter((l) => l.trim() !== '')
            .map((l) => JSON.parse(l) as Record<string, unknown>);
    }

    it('refuses the call when the killed concern is blocking', () => {
        const ws = path.join(tmp, `ws-sig-b-${String(Math.random()).slice(2)}`);
        fs.mkdirSync(ws, { recursive: true });
        const r = dispatchSignal(ws, signalManifest('blocking'), 'sig-blocking');
        expect(r.status).not.toBe(EXIT_ALLOW);
    });

    it('allows when advisory, and records the signal in the issue row', () => {
        const ws = path.join(tmp, `ws-sig-a-${String(Math.random()).slice(2)}`);
        fs.mkdirSync(ws, { recursive: true });
        const r = dispatchSignal(ws, signalManifest('advisory'), 'sig-advisory');
        expect(r.status).toBe(EXIT_ALLOW);
        const rows = rowsIn(ws);
        const failed = rows.filter((row) => row['issue'] === 'execution_failed');
        expect(failed.length).toBeGreaterThan(0);
        // The signal is NAMED, not just the absence of an exit code — a
        // refusal whose cause reads "unknown" is one nobody can act on.
        expect(JSON.stringify(failed)).toMatch(/SIGKILL/);
    });
});
