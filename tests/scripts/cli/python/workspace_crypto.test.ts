// Intent tests for src/cli/python/workspace_crypto.ts (py2ts ADR-200 — the
// workspace encryption-at-rest CLI, ADR-062 / ADR-064).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly. Every case spawns the tsx
// launcher with a **node-only PATH** (a temp dir holding just a `node` symlink)
// so the runner's installed CLIs cannot leak into behaviour, and COLUMNS=200 so
// argparse usage/error lines never re-wrap to terminal width.
//
// Determinism for crypto: AES-256-GCM uses a random 96-bit nonce
// (`crypto.randomBytes(12)`), so two encrypt runs NEVER produce the same
// envelope — raw ciphertext is therefore NEVER snapshotted. Crypto cases assert
// the ROUND-TRIP contract instead (encrypt → decrypt → original plaintext) plus
// structural invariants (exit codes, the fixed `AC1\0\x01` envelope header,
// plaintext pass-through). A shared explicit `AGENT_CONFIG_WORKSPACE_KEY` forces
// the same master key for encrypt and decrypt; HOME is pointed at a temp dir so
// the real ~/.event4u key store is never touched by rotate-key / file fallback.
// All assertions here are reproducible on any machine at any run.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { mkdtempSync, symlinkSync } from 'node:fs';
import * as os from 'node:os';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// This test lives at tests/scripts/cli/python/<file> → REPO_ROOT is 5 `..`
// hops from the file (first hop strips the filename, then 4 dir levels:
// python → cli → scripts → tests → repo root).
const REPO_ROOT = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
    '..',
);
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_crypto.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

// node-only PATH → no installed CLI leaks into behaviour (only `node` resolves).
const NODE_ONLY_DIR = mkdtempSync(path.join(tmpdir(), 'wscrypto-nodeonly-'));
symlinkSync(process.execPath, path.join(NODE_ONLY_DIR, 'node'));

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: string[], cwd: string, extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, PATH: NODE_ONLY_DIR, COLUMNS: '200', ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// ---------------------------------------------------------------------------
// Fixtures — a temp cwd (for .agent-settings.yml) and a temp HOME (so the
// real ~/.event4u key store is never touched by rotate-key / file fallback).
// ---------------------------------------------------------------------------

let tmp: string;
let home: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wscrypto-'));
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'wscrypto-home-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
});

function writeSettings(body: string): void {
    fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), body);
}

// ---------------------------------------------------------------------------
// status — is_enabled parsing (no crypto key required)
// ---------------------------------------------------------------------------

describe('workspace_crypto — status / is_enabled', () => {
    it('no settings file → enabled false', () => {
        expect(runTs(['status'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": false}
          ",
          }
        `);
    });

    it('workspace.encrypt_at_rest: on → enabled true', () => {
        writeSettings('workspace:\n  encrypt_at_rest: on\n');
        expect(runTs(['status'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": true}
          ",
          }
        `);
    });

    it('encrypt_at_rest: true → enabled true', () => {
        writeSettings('workspace:\n  encrypt_at_rest: true\n');
        expect(runTs(['status'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": true}
          ",
          }
        `);
    });

    it('quoted yes value → enabled true', () => {
        writeSettings("workspace:\n  encrypt_at_rest: 'yes'\n");
        expect(runTs(['status'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": true}
          ",
          }
        `);
    });

    it('encrypt_at_rest: 1 → enabled true', () => {
        writeSettings('workspace:\n  encrypt_at_rest: 1\n');
        expect(runTs(['status'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": true}
          ",
          }
        `);
    });

    it('encrypt_at_rest: off → enabled false', () => {
        writeSettings('workspace:\n  encrypt_at_rest: off\n');
        expect(runTs(['status'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": false}
          ",
          }
        `);
    });

    it('key outside the workspace block is ignored → enabled false', () => {
        writeSettings('other:\n  encrypt_at_rest: on\nworkspace:\n  foo: bar\n');
        expect(runTs(['status'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": false}
          ",
          }
        `);
    });

    it('comments + blank lines are skipped', () => {
        writeSettings('# header\n\nworkspace:\n  # inner comment\n  encrypt_at_rest: on\n');
        expect(runTs(['status'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": true}
          ",
          }
        `);
    });

    it('AGENT_CONFIG_NO_ENCRYPTION force-disables even when settings say on', () => {
        writeSettings('workspace:\n  encrypt_at_rest: on\n');
        expect(runTs(['status'], tmp, { AGENT_CONFIG_NO_ENCRYPTION: '1' })).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": false}
          ",
          }
        `);
    });

    it('AGENT_CONFIG_NO_ENCRYPTION=0 does NOT force-disable', () => {
        writeSettings('workspace:\n  encrypt_at_rest: on\n');
        expect(runTs(['status'], tmp, { AGENT_CONFIG_NO_ENCRYPTION: '0' })).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": true}
          ",
          }
        `);
    });

    it('AGENT_CONFIG_NO_ENCRYPTION empty does NOT force-disable', () => {
        writeSettings('workspace:\n  encrypt_at_rest: on\n');
        expect(runTs(['status'], tmp, { AGENT_CONFIG_NO_ENCRYPTION: '' })).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"enabled": true}
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// rotate-key — json output (HOME redirected so the real keyfile is untouched)
// ---------------------------------------------------------------------------

describe('workspace_crypto — rotate-key', () => {
    it('emits {"rotated": true} and exits 0', () => {
        expect(runTs(['rotate-key'], tmp, { HOME: home })).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"rotated": true}
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// arg / usage errors
// ---------------------------------------------------------------------------

describe('workspace_crypto — arg errors', () => {
    it('no args → required cmd', () => {
        expect(runTs([], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_crypto [-h] {encrypt,decrypt,status,rotate-key} ...
          workspace_crypto: error: the following arguments are required: cmd
          ",
            "stdout": "",
          }
        `);
    });

    it('invalid choice', () => {
        expect(runTs(['bogus'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_crypto [-h] {encrypt,decrypt,status,rotate-key} ...
          workspace_crypto: error: argument cmd: invalid choice: 'bogus' (choose from 'encrypt', 'decrypt', 'status', 'rotate-key')
          ",
            "stdout": "",
          }
        `);
    });

    it('encrypt with no options → required --in, --out', () => {
        expect(runTs(['encrypt'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_crypto encrypt [-h] --in SRC --out DST
          workspace_crypto encrypt: error: the following arguments are required: --in, --out
          ",
            "stdout": "",
          }
        `);
    });

    it('encrypt with only --in → required --out', () => {
        expect(runTs(['encrypt', '--in', 'a'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_crypto encrypt [-h] --in SRC --out DST
          workspace_crypto encrypt: error: the following arguments are required: --out
          ",
            "stdout": "",
          }
        `);
    });

    it('decrypt with no options → required --in, --out', () => {
        expect(runTs(['decrypt'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_crypto decrypt [-h] --in SRC --out DST
          workspace_crypto decrypt: error: the following arguments are required: --in, --out
          ",
            "stdout": "",
          }
        `);
    });

    it('encrypt extra positional → unrecognized (top-level)', () => {
        expect(runTs(['encrypt', '--in', 'a', '--out', 'b', 'extra'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_crypto [-h] {encrypt,decrypt,status,rotate-key} ...
          workspace_crypto: error: unrecognized arguments: extra
          ",
            "stdout": "",
          }
        `);
    });

    it('status with extra positional → unrecognized', () => {
        expect(runTs(['status', 'foo'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_crypto [-h] {encrypt,decrypt,status,rotate-key} ...
          workspace_crypto: error: unrecognized arguments: foo
          ",
            "stdout": "",
          }
        `);
    });

    it('rotate-key with extra positional → unrecognized', () => {
        expect(runTs(['rotate-key', 'foo'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_crypto [-h] {encrypt,decrypt,status,rotate-key} ...
          workspace_crypto: error: unrecognized arguments: foo
          ",
            "stdout": "",
          }
        `);
    });

    it('top-level -h usage line (body NOT compared)', () => {
        const t = runTs(['-h'], tmp);
        expect(t.status).toBe(0);
        expect(t.stdout.split('\n')[0]).toBe(
            'usage: workspace_crypto [-h] {encrypt,decrypt,status,rotate-key} ...',
        );
    });

    it('encrypt -h usage line (body NOT compared)', () => {
        const t = runTs(['encrypt', '-h'], tmp);
        expect(t.status).toBe(0);
        expect(t.stdout.split('\n')[0]).toBe(
            'usage: workspace_crypto encrypt [-h] --in SRC --out DST',
        );
    });
});

// ---------------------------------------------------------------------------
// crypto — round-trip + structural envelope invariants (NO ciphertext snapshot:
// the random nonce makes raw envelopes non-reproducible).
// ---------------------------------------------------------------------------

// A fixed, valid base64-of-32-bytes key so encrypt and decrypt resolve the SAME
// master key (override the env-key path, never the keyfile).
const SHARED_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

describe('workspace_crypto — crypto', () => {
    it('SHARED_KEY decodes to exactly 32 bytes (test invariant)', () => {
        expect(Buffer.from(SHARED_KEY, 'base64').length).toBe(32);
    });

    it('encrypt → decrypt round-trips to original plaintext', () => {
        const plain = path.join(tmp, 'plain.txt');
        const enc = path.join(tmp, 'ts.enc');
        const back = path.join(tmp, 'ts-then-ts.txt');
        const data = 'cross-language secret 🔐\nline two\n';
        fs.writeFileSync(plain, data);
        const env = { AGENT_CONFIG_WORKSPACE_KEY: SHARED_KEY };
        const e = runTs(['encrypt', '--in', plain, '--out', enc], tmp, env);
        expect(e.status).toBe(0);
        const dres = runTs(['decrypt', '--in', enc, '--out', back], tmp, env);
        expect(dres.status).toBe(0);
        expect(fs.readFileSync(back, 'utf-8')).toBe(data);
    });

    it('emits the AC1\\0\\x01 envelope header', () => {
        const plain = path.join(tmp, 'plain.txt');
        fs.writeFileSync(plain, 'header-check');
        const env = { AGENT_CONFIG_WORKSPACE_KEY: SHARED_KEY };
        const enc = path.join(tmp, 'ts.enc');
        const e = runTs(['encrypt', '--in', plain, '--out', enc], tmp, env);
        expect(e.status).toBe(0);
        const header = Buffer.from([0x41, 0x43, 0x31, 0x00, 0x01]); // "AC1\0" + version 1
        const head = fs.readFileSync(enc).subarray(0, 5);
        expect(head.equals(header)).toBe(true);
    });

    it('two encrypt runs of the same plaintext produce different envelopes (random nonce)', () => {
        const plain = path.join(tmp, 'plain.txt');
        fs.writeFileSync(plain, 'nonce-uniqueness');
        const env = { AGENT_CONFIG_WORKSPACE_KEY: SHARED_KEY };
        const encA = path.join(tmp, 'a.enc');
        const encB = path.join(tmp, 'b.enc');
        expect(runTs(['encrypt', '--in', plain, '--out', encA], tmp, env).status).toBe(0);
        expect(runTs(['encrypt', '--in', plain, '--out', encB], tmp, env).status).toBe(0);
        expect(fs.readFileSync(encA).equals(fs.readFileSync(encB))).toBe(false);
    });

    it('decrypt passes a plaintext (no-magic) payload through unchanged', () => {
        const plain = path.join(tmp, 'plain.txt');
        const out = path.join(tmp, 'out.txt');
        const data = 'not an envelope — plaintext written when flag off\n';
        fs.writeFileSync(plain, data);
        const env = { AGENT_CONFIG_WORKSPACE_KEY: SHARED_KEY };
        const dres = runTs(['decrypt', '--in', plain, '--out', out], tmp, env);
        expect(dres.status).toBe(0);
        expect(fs.readFileSync(out, 'utf-8')).toBe(data);
    });
});
