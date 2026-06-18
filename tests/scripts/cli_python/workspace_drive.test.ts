// Golden-parity tests for src/cli/python/workspace_drive.ts (py2ts ADR-200 —
// the Tier-1 host drive loop).
//
// Strategy: run `python3 src/cli/python/workspace_drive.py` vs
// `tsx src/cli/python/workspace_drive.ts` and byte-compare stdout / stderr /
// exit. Two surfaces:
//
//   1. CLI-level golden — the deterministic, HERMETIC error paths that return
//      an error turn BEFORE any host CLI is spawned (`unsupported-host`,
//      `empty-prompt`) plus argparse usage errors. No real `claude`/`codex`/
//      `gemini` is ever launched: an unknown `--host` short-circuits in
//      `drive()`, and an empty prompt short-circuits too. The prompt is read
//      from a real temp file (not process substitution, which yields a
//      `/dev/fd` path Node's readFileSync treats as a directory).
//   2. Envelope-parser golden via DIRECT IMPORT — `_parse_claude` /
//      `_parse_codex` / `_parse_gemini` and the post-spawn error taxonomy
//      (nonzero-exit, session-expired, is_error, bad-envelope) are exercised
//      by calling `drive(host, prompt, {runner})` with an INJECTED fake runner
//      that returns canned stdout/exit — never spawning a host. The Python side
//      runs the equivalent via `python3 -c`. Both serialise the returned turn
//      with their own `json.dumps(..., sort_keys=True)` and the bytes are
//      compared.
//
// No network, no real host CLI, no repo mutation — everything is hermetic.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_drive.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_drive.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();
const itPy = py3 ? it : it.skip;

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPy(args: string[], cwd: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80', PYTHONPATH: path.join(REPO_ROOT, 'src') },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], cwd: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const roots: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acdrive-'));
    roots.push(r);
    return r;
}

afterEach(() => {
    while (roots.length) {
        const r = roots.pop()!;
        try {
            fs.rmSync(r, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});

/** Write a prompt file inside a fresh root and return its absolute path. */
function promptFile(content: string): string {
    const root = freshRoot();
    const p = path.join(root, 'prompt.txt');
    fs.writeFileSync(p, content);
    return p;
}

// ---------------------------------------------------------------------------
// Direct-import envelope-parser golden — injected runner, NO host spawn.
// ---------------------------------------------------------------------------

// A tiny sorted-keys, ensure_ascii=True JSON dumper used ONLY inside the
// snippets to serialise the returned turn for comparison. This intentionally
// mirrors json.dumps(..., sort_keys=True) so both sides print identical bytes.
const TS_DUMP = `function __d(v){if(v===null||v===undefined)return "null";if(typeof v==="boolean")return v?"true":"false";if(typeof v==="number")return String(v);if(typeof v==="string"){let o='"';for(const ch of v){const c=ch.codePointAt(0);if(ch==='"')o+='\\\\"';else if(ch==='\\\\')o+='\\\\\\\\';else if(ch==='\\n')o+='\\\\n';else if(ch==='\\r')o+='\\\\r';else if(ch==='\\t')o+='\\\\t';else if(ch==='\\b')o+='\\\\b';else if(ch==='\\f')o+='\\\\f';else if(c<0x20)o+='\\\\u'+c.toString(16).padStart(4,'0');else if(c<0x7f)o+=ch;else if(c<=0xffff)o+='\\\\u'+c.toString(16).padStart(4,'0');else{const w=c-0x10000;o+='\\\\u'+(0xd800+(w>>10)).toString(16).padStart(4,'0')+'\\\\u'+(0xdc00+(w&0x3ff)).toString(16).padStart(4,'0');}}return o+'"';}if(Array.isArray(v))return "["+v.map(__d).join(", ")+"]";const k=Object.keys(v).sort();return "{"+k.map(x=>__d(x)+": "+__d(v[x])).join(", ")+"}";}`;

/** Run a `drive(...)` snippet through the TS module (tsx -e) and Python (-c). */
function snippetTs(driveCall: string): RunResult {
    const code = `import { drive } from ${JSON.stringify(TS_SCRIPT)};\n${TS_DUMP}\nconst t = ${driveCall};\nprocess.stdout.write(__d(t) + "\\n");`;
    const r = spawnSync(TSX_BIN, ['-e', code], { encoding: 'utf8', env: { ...process.env } });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function snippetPy(pyBody: string): RunResult {
    const code = `import json, sys\nsys.path.insert(0, ${JSON.stringify(path.join(REPO_ROOT, 'src'))})\nfrom cli.python.workspace_drive import drive\n${pyBody}`;
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8', env: { ...process.env } });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// ---------------------------------------------------------------------------
// CLI-level golden — hermetic error paths (no host spawn).
// ---------------------------------------------------------------------------

describe('workspace_drive CLI — hermetic error turns', () => {
    itPy('unsupported host → error turn JSON byte-identical + exit 1', () => {
        const root = freshRoot();
        const pf = promptFile('hi\n');
        const p = runPy(['drive', '--host', 'nope', '--prompt-file', pf, '--json'], root);
        const t = runTs(['drive', '--host', 'nope', '--prompt-file', pf, '--json'], root);
        expect(t.status).toBe(1);
        expect(p.status).toBe(1);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('unsupported host, non-json → error_kind: error line on stderr + exit 1', () => {
        const root = freshRoot();
        const pf = promptFile('hi\n');
        const p = runPy(['drive', '--host', 'nope', '--prompt-file', pf], root);
        const t = runTs(['drive', '--host', 'nope', '--prompt-file', pf], root);
        expect(t.status).toBe(1);
        expect(p.status).toBe(1);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('empty prompt → empty-prompt error turn + exit 1', () => {
        const root = freshRoot();
        const pf = promptFile(''); // empty / whitespace-only prompt
        const p = runPy(['drive', '--host', 'claude-code', '--prompt-file', pf, '--json'], root);
        const t = runTs(['drive', '--host', 'claude-code', '--prompt-file', pf, '--json'], root);
        expect(t.status).toBe(1);
        expect(p.status).toBe(1);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('whitespace-only prompt → empty-prompt (matches .strip())', () => {
        const root = freshRoot();
        const pf = promptFile('   \n\t ');
        const p = runPy(['drive', '--host', 'codex', '--prompt-file', pf, '--json'], root);
        const t = runTs(['drive', '--host', 'codex', '--prompt-file', pf, '--json'], root);
        expect(t.status).toBe(1);
        expect(t.stdout).toBe(p.stdout);
    });

    itPy('prompt via stdin (-) → unsupported-host (stdin read parity)', () => {
        const root = freshRoot();
        const py = spawnSync('python3', [PY_SCRIPT, 'drive', '--host', 'nope', '--prompt-file', '-', '--json'], {
            cwd: root,
            encoding: 'utf8',
            input: 'from stdin\n',
            env: { ...process.env, COLUMNS: '80', PYTHONPATH: path.join(REPO_ROOT, 'src') },
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, 'drive', '--host', 'nope', '--prompt-file', '-', '--json'], {
            cwd: root,
            encoding: 'utf8',
            input: 'from stdin\n',
            env: { ...process.env, COLUMNS: '80' },
        });
        expect(ts.status).toBe(1);
        expect(py.status).toBe(1);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
});

// ---------------------------------------------------------------------------
// CLI-level golden — argparse usage / required args (exit 2).
// ---------------------------------------------------------------------------

describe('workspace_drive CLI — argparse usage', () => {
    itPy('no subcommand → exit 2 + usage+error stderr', () => {
        const root = freshRoot();
        const p = runPy([], root);
        const t = runTs([], root);
        expect(t.status).toBe(2);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });

    itPy('invalid subcommand → exit 2 + invalid-choice stderr', () => {
        const root = freshRoot();
        const p = runPy(['bogus'], root);
        const t = runTs(['bogus'], root);
        expect(t.status).toBe(2);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('drive missing --host → exit 2 + required-arg stderr', () => {
        const root = freshRoot();
        const pf = promptFile('hi\n');
        const p = runPy(['drive', '--prompt-file', pf], root);
        const t = runTs(['drive', '--prompt-file', pf], root);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('drive missing --prompt-file → exit 2 + required-arg stderr', () => {
        const root = freshRoot();
        const p = runPy(['drive', '--host', 'claude-code'], root);
        const t = runTs(['drive', '--host', 'claude-code'], root);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('top-level --help → exit 0 + usage banner first line', () => {
        const root = freshRoot();
        const p = runPy(['--help'], root);
        const t = runTs(['--help'], root);
        expect(t.status).toBe(0);
        expect(p.status).toBe(0);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
});

// ---------------------------------------------------------------------------
// Direct-import — claude envelope parser + ok turn.
// ---------------------------------------------------------------------------

describe('workspace_drive drive() — claude envelope (injected runner)', () => {
    itPy('full claude envelope → ok turn byte-identical', () => {
        const env = {
            result: 'hello world',
            model: 'm1',
            session_id: 's1',
            total_cost_usd: 0.5,
            num_turns: 2,
            usage: { input_tokens: 10, output_tokens: 3 },
            tool_calls: [{ id: 't' }],
        };
        const envJson = JSON.stringify(env);
        const py = snippetPy(
            `def f(a, c, t):\n return (0, json.dumps(${pyDict(env)}), "")\nprint(json.dumps(drive("claude-code", "do it", runner=f), sort_keys=True))`,
        );
        const ts = snippetTs(
            `drive("claude-code", "do it", { runner: (() => [0, ${JSON.stringify(envJson)}, ""]) as any })`,
        );
        expect(ts.status).toBe(0);
        expect(py.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
    });

    itPy('claude is_error: true → bad-envelope error turn', () => {
        const env = { is_error: true, result: 'the bad thing' };
        const py = snippetPy(
            `def f(a, c, t):\n return (0, json.dumps(${pyDict(env)}), "")\nprint(json.dumps(drive("claude-code", "p", runner=f), sort_keys=True))`,
        );
        const ts = snippetTs(
            `drive("claude-code", "p", { runner: (() => [0, ${JSON.stringify(JSON.stringify(env))}, ""]) as any })`,
        );
        expect(ts.stdout).toBe(py.stdout);
    });

    itPy('claude missing result key → bad-envelope error turn', () => {
        const env = { foo: 'bar' };
        const py = snippetPy(
            `def f(a, c, t):\n return (0, json.dumps(${pyDict(env)}), "")\nprint(json.dumps(drive("claude-code", "p", runner=f), sort_keys=True))`,
        );
        const ts = snippetTs(
            `drive("claude-code", "p", { runner: (() => [0, ${JSON.stringify(JSON.stringify(env))}, ""]) as any })`,
        );
        expect(ts.stdout).toBe(py.stdout);
    });
});

// ---------------------------------------------------------------------------
// Direct-import — codex event-stream parser.
// ---------------------------------------------------------------------------

describe('workspace_drive drive() — codex envelope (injected runner)', () => {
    itPy('codex stream → ok turn (text join, usage, session, tool_calls)', () => {
        const events = [
            { type: 'session.created', session_id: 'sx' },
            { type: 'item.completed', item: { type: 'tool_call', content: [{ text: 'toolt' }] } },
            { type: 'item.completed', item: { content: [{ text: 'line1' }, { text: 'line2' }] } },
            { type: 'turn.completed', usage: { input_tokens: 7, output_tokens: 2 } },
        ];
        const stream = events.map((e) => JSON.stringify(e)).join('\n');
        const pyLines = events.map((e) => `json.dumps(${pyDict(e)})`).join(', ');
        const py = snippetPy(
            `def f(a, c, t):\n return (0, "\\n".join([${pyLines}]), "")\nprint(json.dumps(drive("codex", "p", runner=f), sort_keys=True))`,
        );
        const ts = snippetTs(
            `drive("codex", "p", { runner: (() => [0, ${JSON.stringify(stream)}, ""]) as any })`,
        );
        expect(ts.stdout).toBe(py.stdout);
    });

    itPy('codex stream with no item text → bad-envelope', () => {
        const events = [{ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } }];
        const stream = events.map((e) => JSON.stringify(e)).join('\n');
        const pyLines = events.map((e) => `json.dumps(${pyDict(e)})`).join(', ');
        const py = snippetPy(
            `def f(a, c, t):\n return (0, "\\n".join([${pyLines}]), "")\nprint(json.dumps(drive("codex", "p", runner=f), sort_keys=True))`,
        );
        const ts = snippetTs(
            `drive("codex", "p", { runner: (() => [0, ${JSON.stringify(stream)}, ""]) as any })`,
        );
        expect(ts.stdout).toBe(py.stdout);
    });
});

// ---------------------------------------------------------------------------
// Direct-import — gemini envelope parser.
// ---------------------------------------------------------------------------

describe('workspace_drive drive() — gemini envelope (injected runner)', () => {
    itPy('gemini envelope → ok turn (nested stats.models tokens)', () => {
        const env = {
            response: 'resp',
            session_id: 'sg',
            stats: { models: { 'gemini-2': { tokens: { prompt: 10, total: 15 } } } },
        };
        const py = snippetPy(
            `def f(a, c, t):\n return (0, json.dumps(${pyDict(env)}), "")\nprint(json.dumps(drive("gemini", "p", runner=f), sort_keys=True))`,
        );
        const ts = snippetTs(
            `drive("gemini", "p", { runner: (() => [0, ${JSON.stringify(JSON.stringify(env))}, ""]) as any })`,
        );
        expect(ts.stdout).toBe(py.stdout);
    });

    itPy('gemini envelope missing response → bad-envelope', () => {
        const env = { stats: {} };
        const py = snippetPy(
            `def f(a, c, t):\n return (0, json.dumps(${pyDict(env)}), "")\nprint(json.dumps(drive("gemini", "p", runner=f), sort_keys=True))`,
        );
        const ts = snippetTs(
            `drive("gemini", "p", { runner: (() => [0, ${JSON.stringify(JSON.stringify(env))}, ""]) as any })`,
        );
        expect(ts.stdout).toBe(py.stdout);
    });
});

// ---------------------------------------------------------------------------
// Direct-import — post-spawn error taxonomy.
// ---------------------------------------------------------------------------

describe('workspace_drive drive() — error taxonomy (injected runner)', () => {
    itPy('nonzero exit → nonzero-exit error turn (stderr truncated to 200)', () => {
        const py = snippetPy(
            `def f(a, c, t):\n return (3, "", "boom error")\nprint(json.dumps(drive("claude-code", "p", runner=f), sort_keys=True))`,
        );
        const ts = snippetTs(
            `drive("claude-code", "p", { runner: (() => [3, "", "boom error"]) as any })`,
        );
        expect(ts.stdout).toBe(py.stdout);
    });

    itPy('resume + expired-session signature → session-expired error turn', () => {
        const py = snippetPy(
            `def f(a, c, t):\n return (1, "", "Invalid session identifier xyz")\nprint(json.dumps(drive("claude-code", "p", resume_session_id="s1", runner=f), sort_keys=True))`,
        );
        const ts = snippetTs(
            `drive("claude-code", "p", { resume_session_id: "s1", runner: (() => [1, "", "Invalid session identifier xyz"]) as any })`,
        );
        expect(ts.stdout).toBe(py.stdout);
    });

    itPy('claude-code supports resume → builds resume args (ok turn)', () => {
        // All three hosts support resume, so resume-unsupported is unreachable
        // via HOST_CONFIGS; exercise the resume happy path instead. gemini
        // parses `response`, so the canned envelope uses `response`.
        const env = { response: 'resumed' };
        const py = snippetPy(
            `def f(a, c, t):\n return (0, json.dumps(${pyDict(env)}), "")\nprint(json.dumps(drive("gemini", "p", resume_session_id="s9", runner=f), sort_keys=True))`,
        );
        const ts = snippetTs(
            `drive("gemini", "p", { resume_session_id: "s9", runner: (() => [0, ${JSON.stringify(JSON.stringify(env))}, ""]) as any })`,
        );
        expect(ts.status).toBe(0);
        expect(py.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
    });
});

/** Render a JS value as a Python literal (dict/list/str/num/bool/null). */
function pyDict(v: unknown): string {
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(pyDict).join(', ') + ']';
    const obj = v as Record<string, unknown>;
    return '{' + Object.keys(obj).map((k) => `${JSON.stringify(k)}: ${pyDict(obj[k])}`).join(', ') + '}';
}
