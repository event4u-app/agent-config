// Intent tests for src/cli/python/workspace_sessions.ts (py2ts ADR-200 —
// local workspace session store, daily-workspace.md §Session JSONL schema).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly. Session ids are
// `<UTC-stamp>-<8 random hex>` and records carry a `ts` (UTC second) + a float
// `mtime` — all NONDETERMINISTIC. Every functional case runs in a hermetic
// `<tmp>/workspace/sessions` root, then `norm()` masks the random id, the
// timestamp, the float mtime, and the tmp root before snapshotting — leaving the
// structural payload (kinds, data shape, scrubbed body, ordering, PyFloat
// round-trip) reproducible on any machine at any time.
//
// `_validate_cli_root` requires `--root` to be a `.../workspace/sessions` dir.
// Each case spawns with a **node-only PATH** (a temp dir holding just a `node`
// symlink) so host-CLI detection (used by `start --host`) is deterministic, plus
// COLUMNS=200 so arg-error/usage stderr does not re-wrap to terminal width.
// The `--help` BODY is NOT snapshotted (only the `usage:` line) — help body is
// not part of the porting contract. Encryption-at-rest defaults OFF (no
// `.agent-settings.yml` in the run CWD): migrate raises (exit 1), decrypt-all is
// a crypto-free `{decrypted: 0}` — both deterministic.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_sessions.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

// node-only PATH → deterministic host-CLI detection (nothing but `node` resolves).
const NODE_ONLY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wssess-nodeonly-'));
fs.symlinkSync(process.execPath, path.join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    fs.rmSync(NODE_ONLY_DIR, { recursive: true, force: true });
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PATH: NODE_ONLY_DIR, COLUMNS: '200', ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Mask nondeterministic ids / timestamps / float mtime / tmp roots. */
function norm(text: string, roots: string[]): string {
    let out = text;
    for (const root of roots) {
        out = out.split(root).join('<TMP>');
        let real = root;
        try {
            real = fs.realpathSync(root);
        } catch {
            /* removed */
        }
        out = out.split(real).join('<TMP>');
    }
    out = out.replace(/\d{8}T\d{6}Z-[0-9a-f]{8}/g, '<ID>'); // session id token
    out = out.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, '<TS>'); // ISO second
    out = out.replace(/"mtime": [0-9.]+/g, '"mtime": <M>'); // float mtime
    return out;
}

/** Compare only the `usage:` portion of a `-h` run (help body not snapshotted). */
function usageOnly(text: string): string {
    const out: string[] = [];
    for (const line of text.split('\n')) {
        if (out.length > 0 && line.trim() === '') break;
        out.push(line);
    }
    return out.join('\n');
}

let tsRoot: string;
let tsTmp: string;
beforeEach(() => {
    tsTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wssess-ts-'));
    tsRoot = path.join(tsTmp, 'workspace', 'sessions');
    fs.mkdirSync(tsRoot, { recursive: true });
});
afterEach(() => {
    fs.rmSync(tsTmp, { recursive: true, force: true });
});

describe('workspace_sessions — start + append + read + list', () => {
    it('start writes the launcher.input line; read it back (normalized)', () => {
        const tid = runTs(['start', '--role', 'sales', '--task', 'draft offer', '--root', tsRoot]).stdout.trim();
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(t.status).toBe(0);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toMatchInlineSnapshot(`
          "[{"data": {"role": "sales", "task": "draft offer"}, "kind": "launcher.input", "ts": "<TS>"}]
          "
        `);
    });

    it('start --host writes host_tier + host_id', () => {
        const tid = runTs(['start', '--role', 'r', '--task', 't', '--host', 'claude-code', '--root', tsRoot]).stdout.trim();
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toMatchInlineSnapshot(`
          "[{"data": {"host_id": "claude-code", "host_tier": "tier-1", "role": "r", "task": "t"}, "kind": "launcher.input", "ts": "<TS>"}]
          "
        `);
    });

    it('start scrubs a pasted secret in the task', () => {
        const sec = 'AKIAIOSFODNN7EXAMPLE';
        const tid = runTs(['start', '--role', 'r', '--task', `do ${sec} now`, '--root', tsRoot]).stdout.trim();
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(t.stdout).not.toContain(sec);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toMatchInlineSnapshot(`
          "[{"data": {"role": "r", "task": "do [SECRET] now"}, "kind": "launcher.input", "ts": "<TS>"}]
          "
        `);
    });

    it('append --data k=v (flat strings)', () => {
        const tid = runTs(['start', '--role', 'r', '--task', 't', '--root', tsRoot]).stdout.trim();
        runTs(['append', tid, '--kind', 'host.turn', '--data', 'k=v', '--data', 'n=3', '--root', tsRoot]);
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toMatchInlineSnapshot(`
          "[{"data": {"role": "r", "task": "t"}, "kind": "launcher.input", "ts": "<TS>"}, {"data": {"k": "v", "n": "3"}, "kind": "host.turn", "ts": "<TS>"}]
          "
        `);
    });

    it('append --data-json preserves nested structure + PyFloat (2.0 stays 2.0)', () => {
        const dj = '{"n":3,"f":1.5,"nested":{"k":"v","arr":[1,2.0,"x"]},"b":true,"z":null,"big":2.0e3,"neg":-4.0}';
        const tid = runTs(['start', '--role', 'r', '--task', 't', '--root', tsRoot]).stdout.trim();
        runTs(['append', tid, '--kind', 'host.output', '--data-json', dj, '--root', tsRoot]);
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toMatchInlineSnapshot(`
          "[{"data": {"role": "r", "task": "t"}, "kind": "launcher.input", "ts": "<TS>"}, {"data": {"b": true, "big": 2000.0, "f": 1.5, "n": 3, "neg": -4.0, "nested": {"arr": [1, 2.0, "x"], "k": "v"}, "z": null}, "kind": "host.output", "ts": "<TS>"}]
          "
        `);
        expect(t.stdout).toContain('2.0'); // float preserved, not collapsed to 2
    });

    it('append --data-json scrubs a secret in a string leaf', () => {
        const dj = '{"k":"AKIAIOSFODNN7EXAMPLE here","v":2.0}';
        const tid = runTs(['start', '--role', 'r', '--task', 't', '--root', tsRoot]).stdout.trim();
        runTs(['append', tid, '--kind', 'host.output', '--data-json', dj, '--root', tsRoot]);
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toMatchInlineSnapshot(`
          "[{"data": {"role": "r", "task": "t"}, "kind": "launcher.input", "ts": "<TS>"}, {"data": {"k": "[SECRET] here", "v": 2.0}, "kind": "host.output", "ts": "<TS>"}]
          "
        `);
    });

    it('append rejects an unknown kind → stderr + exit 1', () => {
        const tid = runTs(['start', '--role', 'r', '--task', 't', '--root', tsRoot]).stdout.trim();
        const t = runTs(['append', tid, '--kind', 'bogus.kind', '--root', tsRoot]);
        expect(t.status).toMatchInlineSnapshot(`1`);
        expect(t.stderr).toMatchInlineSnapshot(`
          "workspace_sessions: rejecting unknown kind 'bogus.kind'
          "
        `);
    });

    it('append to a missing session → stderr + exit 1', () => {
        const t = runTs(['append', '20200101T000000Z-deadbeef', '--kind', 'host.turn', '--root', tsRoot]);
        expect(t.status).toMatchInlineSnapshot(`1`);
        expect(t.stdout).toMatchInlineSnapshot(`""`);
        expect(t.stderr).toMatchInlineSnapshot(`
          "workspace_sessions: no session 20200101T000000Z-deadbeef
          "
        `);
    });

    it('read missing session → empty (exit 0)', () => {
        const t = runTs(['read', '20200101T000000Z-deadbeef', '--json', '--root', tsRoot]);
        expect(t.status).toMatchInlineSnapshot(`0`);
        expect(t.stdout).toMatchInlineSnapshot(`
          "[]
          "
        `); // "[]"
    });

    it('list --json (single entry, normalized)', () => {
        runTs(['start', '--role', 'sales', '--task', 'one', '--root', tsRoot]);
        const t = runTs(['list', '--json', '--root', tsRoot]);
        expect(t.status).toBe(0);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toMatchInlineSnapshot(`
          "[{"mtime": <M>, "role": "sales", "session_id": "<ID>", "started_at": "<TS>", "task": "one"}]
          "
        `);
    });

    it('list text (per-line JSON, empty root)', () => {
        const t = runTs(['list', '--root', tsRoot]);
        expect(t.status).toBe(0);
        expect(t.stdout).toMatchInlineSnapshot(`""`); // empty
    });
});

describe('workspace_sessions — encryption-at-rest defaults (flag off)', () => {
    it('migrate with flag off → exit 1 (RuntimeError)', () => {
        const t = runTs(['migrate', '--root', tsRoot]);
        expect(t.status).toMatchInlineSnapshot(`1`);
    });
    it('decrypt-all on plaintext → {"decrypted": 0} (crypto-free)', () => {
        runTs(['start', '--role', 'r', '--task', 't', '--root', tsRoot]);
        const t = runTs(['decrypt-all', '--root', tsRoot]);
        expect(t.status).toMatchInlineSnapshot(`0`);
        expect(t.stdout).toMatchInlineSnapshot(`
          "{"decrypted": 0}
          "
        `);
    });
});

describe('workspace_sessions — argparse + root validation errors', () => {
    it('no args → required cmd, exit 2', () => {
        expect(runTs([])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_sessions [-h]
                                    {start,append,list,read,migrate,decrypt-all,rekey}
                                    ...
          workspace_sessions: error: the following arguments are required: cmd
          ",
            "stdout": "",
          }
        `);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expect(runTs(['bogus'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_sessions [-h]
                                    {start,append,list,read,migrate,decrypt-all,rekey}
                                    ...
          workspace_sessions: error: argument cmd: invalid choice: 'bogus' (choose from 'start', 'append', 'list', 'read', 'migrate', 'decrypt-all', 'rekey')
          ",
            "stdout": "",
          }
        `);
    });
    it('start missing required → exit 2', () => {
        expect(runTs(['start'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_sessions start [-h] --role ROLE --task TASK [--host HOST]
                                          [--root ROOT]
          workspace_sessions start: error: the following arguments are required: --role, --task
          ",
            "stdout": "",
          }
        `);
    });
    it('append missing session_id → exit 2', () => {
        expect(runTs(['append', '--kind', 'host.turn'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_sessions append [-h] --kind KIND [--data DATA]
                                           [--data-json DATA_JSON] [--root ROOT]
                                           session_id
          workspace_sessions append: error: the following arguments are required: session_id
          ",
            "stdout": "",
          }
        `);
    });
    it('append missing --kind → exit 2', () => {
        expect(runTs(['append', 'sid'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_sessions append [-h] --kind KIND [--data DATA]
                                           [--data-json DATA_JSON] [--root ROOT]
                                           session_id
          workspace_sessions append: error: the following arguments are required: --kind
          ",
            "stdout": "",
          }
        `);
    });
    it('read missing session_id → exit 2', () => {
        expect(runTs(['read'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_sessions read [-h] [--root ROOT] [--json] session_id
          workspace_sessions read: error: the following arguments are required: session_id
          ",
            "stdout": "",
          }
        `);
    });
    it('list bad --limit int → exit 2', () => {
        expect(runTs(['list', '--limit', 'abc'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_sessions list [-h] [--limit LIMIT] [--root ROOT] [--json]
          workspace_sessions list: error: argument --limit: invalid int value: 'abc'
          ",
            "stdout": "",
          }
        `);
    });
    it('--root not a workspace/sessions dir → SystemExit, exit 1', () => {
        expect(runTs(['list', '--root', '/tmp/not-a-sessions-dir'])).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "workspace_sessions: --root must be a .../workspace/sessions dir, got '/tmp/not-a-sessions-dir'
          ",
            "stdout": "",
          }
        `);
    });
    it('start -h usage line', () => {
        const t = runTs(['start', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`
          "usage: workspace_sessions start [-h] --role ROLE --task TASK [--host HOST]
                                          [--root ROOT]"
        `);
    });
    it('append -h usage line', () => {
        const t = runTs(['append', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`
          "usage: workspace_sessions append [-h] --kind KIND [--data DATA]
                                           [--data-json DATA_JSON] [--root ROOT]
                                           session_id"
        `);
    });
    it('list -h usage line', () => {
        const t = runTs(['list', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`"usage: workspace_sessions list [-h] [--limit LIMIT] [--root ROOT] [--json]"`);
    });
    it('read -h usage line', () => {
        const t = runTs(['read', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`"usage: workspace_sessions read [-h] [--root ROOT] [--json] session_id"`);
    });
    it('migrate -h usage line', () => {
        const t = runTs(['migrate', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`"usage: workspace_sessions migrate [-h] [--root ROOT]"`);
    });
    it('decrypt-all -h usage line', () => {
        const t = runTs(['decrypt-all', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`"usage: workspace_sessions decrypt-all [-h] [--root ROOT]"`);
    });
    it('rekey -h usage line', () => {
        const t = runTs(['rekey', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`"usage: workspace_sessions rekey [-h] [--root ROOT]"`);
    });
});
