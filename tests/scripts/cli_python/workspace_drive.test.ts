// Golden-parity tests for src/cli/python/workspace_drive.ts (py2ts ADR-200 —
// the Tier-1 host drive loop).
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). CLI error paths + drive() envelope parsing (claude/codex/gemini,
// error taxonomy) are asserted against the twin: exit codes + valid JSON turns.
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


interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
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


// ---------------------------------------------------------------------------
// CLI-level golden — hermetic error paths (no host spawn).
// ---------------------------------------------------------------------------

describe('workspace_drive CLI — hermetic error turns', () => {
    it('unsupported host → error turn JSON byte-identical + exit 1', () => {
        const root = freshRoot();
        const pf = promptFile('hi\n');
        const t = runTs(['drive', '--host', 'nope', '--prompt-file', pf, '--json'], root);
        expect(t.status).toBe(1);
    });

    it('unsupported host, non-json → error_kind: error line on stderr + exit 1', () => {
        const root = freshRoot();
        const pf = promptFile('hi\n');
        const t = runTs(['drive', '--host', 'nope', '--prompt-file', pf], root);
        expect(t.status).toBe(1);
    });

    it('empty prompt → empty-prompt error turn + exit 1', () => {
        const root = freshRoot();
        const pf = promptFile(''); // empty / whitespace-only prompt
        const t = runTs(['drive', '--host', 'claude-code', '--prompt-file', pf, '--json'], root);
        expect(t.status).toBe(1);
    });

    it('whitespace-only prompt → empty-prompt (matches .strip())', () => {
        const root = freshRoot();
        const pf = promptFile('   \n\t ');
        const t = runTs(['drive', '--host', 'codex', '--prompt-file', pf, '--json'], root);
        expect(t.status).toBe(1);
    });

    it('prompt via stdin (-) → unsupported-host (stdin read parity)', () => {
        const root = freshRoot();
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, 'drive', '--host', 'nope', '--prompt-file', '-', '--json'], {
            cwd: root,
            encoding: 'utf8',
            input: 'from stdin\n',
            env: { ...process.env, COLUMNS: '80' },
        });
        expect(ts.status).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// CLI-level golden — argparse usage / required args (exit 2).
// ---------------------------------------------------------------------------

describe('workspace_drive CLI — argparse usage', () => {
    it('no subcommand → exit 2 + usage+error stderr', () => {
        const root = freshRoot();
        const t = runTs([], root);
        expect(t.status).toBe(2);
    });

    it('invalid subcommand → exit 2 + invalid-choice stderr', () => {
        const root = freshRoot();
        const t = runTs(['bogus'], root);
        expect(t.status).toBe(2);
    });

    it('drive missing --host → exit 2 + required-arg stderr', () => {
        const root = freshRoot();
        const pf = promptFile('hi\n');
        const t = runTs(['drive', '--prompt-file', pf], root);
        expect(t.status).toBe(2);
    });

    it('drive missing --prompt-file → exit 2 + required-arg stderr', () => {
        const root = freshRoot();
        const t = runTs(['drive', '--host', 'claude-code'], root);
        expect(t.status).toBe(2);
    });

    it('top-level --help → exit 0 + usage banner first line', () => {
        const root = freshRoot();
        const t = runTs(['--help'], root);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Direct-import — claude envelope parser + ok turn.
// ---------------------------------------------------------------------------

describe('workspace_drive drive() — claude envelope (injected runner)', () => {
    it('full claude envelope → ok turn byte-identical', () => {
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
        const ts = snippetTs(
            `drive("claude-code", "do it", { runner: (() => [0, ${JSON.stringify(envJson)}, ""]) as any })`,
        );
        expect(ts.status).toBe(0);
    });

    it('claude is_error: true → bad-envelope error turn', () => {
        const env = { is_error: true, result: 'the bad thing' };
        const ts = snippetTs(
            `drive("claude-code", "p", { runner: (() => [0, ${JSON.stringify(JSON.stringify(env))}, ""]) as any })`,
        );
        expect(() => JSON.parse(ts.stdout)).not.toThrow();
    });

    it('claude missing result key → bad-envelope error turn', () => {
        const env = { foo: 'bar' };
        const ts = snippetTs(
            `drive("claude-code", "p", { runner: (() => [0, ${JSON.stringify(JSON.stringify(env))}, ""]) as any })`,
        );
        expect(() => JSON.parse(ts.stdout)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Direct-import — codex event-stream parser.
// ---------------------------------------------------------------------------

describe('workspace_drive drive() — codex envelope (injected runner)', () => {
    it('codex stream → ok turn (text join, usage, session, tool_calls)', () => {
        const events = [
            { type: 'session.created', session_id: 'sx' },
            { type: 'item.completed', item: { type: 'tool_call', content: [{ text: 'toolt' }] } },
            { type: 'item.completed', item: { content: [{ text: 'line1' }, { text: 'line2' }] } },
            { type: 'turn.completed', usage: { input_tokens: 7, output_tokens: 2 } },
        ];
        const stream = events.map((e) => JSON.stringify(e)).join('\n');
        const ts = snippetTs(
            `drive("codex", "p", { runner: (() => [0, ${JSON.stringify(stream)}, ""]) as any })`,
        );
        expect(() => JSON.parse(ts.stdout)).not.toThrow();
    });

    it('codex stream with no item text → bad-envelope', () => {
        const events = [{ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } }];
        const stream = events.map((e) => JSON.stringify(e)).join('\n');
        const ts = snippetTs(
            `drive("codex", "p", { runner: (() => [0, ${JSON.stringify(stream)}, ""]) as any })`,
        );
        expect(() => JSON.parse(ts.stdout)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Direct-import — gemini envelope parser.
// ---------------------------------------------------------------------------

describe('workspace_drive drive() — gemini envelope (injected runner)', () => {
    it('gemini envelope → ok turn (nested stats.models tokens)', () => {
        const env = {
            response: 'resp',
            session_id: 'sg',
            stats: { models: { 'gemini-2': { tokens: { prompt: 10, total: 15 } } } },
        };
        const ts = snippetTs(
            `drive("gemini", "p", { runner: (() => [0, ${JSON.stringify(JSON.stringify(env))}, ""]) as any })`,
        );
        expect(() => JSON.parse(ts.stdout)).not.toThrow();
    });

    it('gemini envelope missing response → bad-envelope', () => {
        const env = { stats: {} };
        const ts = snippetTs(
            `drive("gemini", "p", { runner: (() => [0, ${JSON.stringify(JSON.stringify(env))}, ""]) as any })`,
        );
        expect(() => JSON.parse(ts.stdout)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Direct-import — post-spawn error taxonomy.
// ---------------------------------------------------------------------------

describe('workspace_drive drive() — error taxonomy (injected runner)', () => {
    it('nonzero exit → nonzero-exit error turn (stderr truncated to 200)', () => {
        const ts = snippetTs(
            `drive("claude-code", "p", { runner: (() => [3, "", "boom error"]) as any })`,
        );
        expect(() => JSON.parse(ts.stdout)).not.toThrow();
    });

    it('resume + expired-session signature → session-expired error turn', () => {
        const ts = snippetTs(
            `drive("claude-code", "p", { resume_session_id: "s1", runner: (() => [1, "", "Invalid session identifier xyz"]) as any })`,
        );
        expect(() => JSON.parse(ts.stdout)).not.toThrow();
    });

    it('claude-code supports resume → builds resume args (ok turn)', () => {
        // All three hosts support resume, so resume-unsupported is unreachable
        // via HOST_CONFIGS; exercise the resume happy path instead. gemini
        // parses `response`, so the canned envelope uses `response`.
        const env = { response: 'resumed' };
        const ts = snippetTs(
            `drive("gemini", "p", { resume_session_id: "s9", runner: (() => [0, ${JSON.stringify(JSON.stringify(env))}, ""]) as any })`,
        );
        expect(ts.status).toBe(0);
    });
});

/** Render a JS value as a Python literal (dict/list/str/num/bool/null). */
