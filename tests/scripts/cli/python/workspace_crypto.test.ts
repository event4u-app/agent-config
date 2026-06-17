// Golden-parity tests for src/cli/python/workspace_crypto.ts (py2ts ADR-200 —
// the workspace encryption-at-rest CLI, ADR-062 / ADR-064).
//
// Strategy: run `python3 src/cli/python/workspace_crypto.py` vs
// `tsx src/cli/python/workspace_crypto.ts` and byte-compare stdout / stderr /
// exit. The CLI surfaces that DON'T need the crypto library — `status`,
// `rotate-key` json output, `is_enabled` parsing, arg/usage errors — are pure
// byte-parity. The argparse `--help` BODY is NOT byte-compared (only the
// `usage:` line) per the porting contract.
//
// Crypto parity is NOT a byte-equal-output assertion: the nonce is random
// (`secrets.token_bytes(12)` / `crypto.randomBytes(12)`), so two encrypt runs
// NEVER produce the same envelope. The real byte-parity proof for crypto is
// cross-language ENVELOPE INTEROP: ts-encrypt then py-DECRYPT round-trips to the
// original plaintext, AND py-encrypt then ts-decrypt round-trips — using a
// shared `AGENT_CONFIG_WORKSPACE_KEY` env so both languages resolve the same
// key. Plus a fixed assertion on the `AC1\0\x01` envelope header. These crypto
// cases are GUARDED on python3 having the `cryptography` package importable;
// when it is absent the Python encrypt/decrypt subcommands raise a RuntimeError
// and cross-decrypt is impossible, so those cases skip (the non-crypto cases
// still run).
//
// DOCUMENTED DIVERGENCE — master-key resolution. Python's order is
// override → env → keyring → file; Node has no keyring binding (keyring branch
// unavailable → file path). To make py and ts agree we force the explicit-key
// path with a shared `AGENT_CONFIG_WORKSPACE_KEY`. `rotate-key` and the file
// fallback are exercised with `HOME` pointed at a temp dir so the real
// `~/.event4u` is never touched.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
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
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_crypto.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

function hasCryptography(): boolean {
    if (!py3) return false;
    const r = spawnSync(
        'python3',
        ['-c', 'from cryptography.hazmat.primitives.ciphers.aead import AESGCM'],
        { encoding: 'utf8' },
    );
    return r.status === 0;
}
const crypto = hasCryptography();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPy(args: string[], cwd: string, extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], cwd: string, extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Assert py and ts agree byte-for-byte + same exit, for a single invocation. */
function expectParity(
    args: string[],
    cwd: string,
    extraEnv: Record<string, string> = {},
): void {
    const p = runPy(args, cwd, extraEnv);
    const t = runTs(args, cwd, extraEnv);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
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

const d = py3 ? describe : describe.skip;

// ---------------------------------------------------------------------------
// status — is_enabled parsing (no crypto library required)
// ---------------------------------------------------------------------------

d('workspace_crypto — status / is_enabled', () => {
    it('no settings file → enabled false', () => {
        expectParity(['status'], tmp);
    });

    it('workspace.encrypt_at_rest: on → enabled true', () => {
        writeSettings('workspace:\n  encrypt_at_rest: on\n');
        expectParity(['status'], tmp);
    });

    it('encrypt_at_rest: true → enabled true', () => {
        writeSettings('workspace:\n  encrypt_at_rest: true\n');
        expectParity(['status'], tmp);
    });

    it('quoted yes value → enabled true', () => {
        writeSettings("workspace:\n  encrypt_at_rest: 'yes'\n");
        expectParity(['status'], tmp);
    });

    it('encrypt_at_rest: 1 → enabled true', () => {
        writeSettings('workspace:\n  encrypt_at_rest: 1\n');
        expectParity(['status'], tmp);
    });

    it('encrypt_at_rest: off → enabled false', () => {
        writeSettings('workspace:\n  encrypt_at_rest: off\n');
        expectParity(['status'], tmp);
    });

    it('key outside the workspace block is ignored → enabled false', () => {
        writeSettings('other:\n  encrypt_at_rest: on\nworkspace:\n  foo: bar\n');
        expectParity(['status'], tmp);
    });

    it('comments + blank lines are skipped', () => {
        writeSettings('# header\n\nworkspace:\n  # inner comment\n  encrypt_at_rest: on\n');
        expectParity(['status'], tmp);
    });

    it('AGENT_CONFIG_NO_ENCRYPTION force-disables even when settings say on', () => {
        writeSettings('workspace:\n  encrypt_at_rest: on\n');
        expectParity(['status'], tmp, { AGENT_CONFIG_NO_ENCRYPTION: '1' });
    });

    it('AGENT_CONFIG_NO_ENCRYPTION=0 does NOT force-disable', () => {
        writeSettings('workspace:\n  encrypt_at_rest: on\n');
        expectParity(['status'], tmp, { AGENT_CONFIG_NO_ENCRYPTION: '0' });
    });

    it('AGENT_CONFIG_NO_ENCRYPTION empty does NOT force-disable', () => {
        writeSettings('workspace:\n  encrypt_at_rest: on\n');
        expectParity(['status'], tmp, { AGENT_CONFIG_NO_ENCRYPTION: '' });
    });
});

// ---------------------------------------------------------------------------
// rotate-key — json output (no crypto library required; HOME redirected)
// ---------------------------------------------------------------------------

d('workspace_crypto — rotate-key', () => {
    it('emits {"rotated": true} and exits 0', () => {
        expectParity(['rotate-key'], tmp, { HOME: home });
    });
});

// ---------------------------------------------------------------------------
// arg / usage errors (no crypto library required)
// ---------------------------------------------------------------------------

d('workspace_crypto — arg errors', () => {
    it('no args → required cmd', () => {
        expectParity([], tmp);
    });

    it('invalid choice', () => {
        expectParity(['bogus'], tmp);
    });

    it('encrypt with no options → required --in, --out', () => {
        expectParity(['encrypt'], tmp);
    });

    it('encrypt with only --in → required --out', () => {
        expectParity(['encrypt', '--in', 'a'], tmp);
    });

    it('decrypt with no options → required --in, --out', () => {
        expectParity(['decrypt'], tmp);
    });

    it('encrypt extra positional → unrecognized (top-level)', () => {
        expectParity(['encrypt', '--in', 'a', '--out', 'b', 'extra'], tmp);
    });

    it('status with extra positional → unrecognized', () => {
        expectParity(['status', 'foo'], tmp);
    });

    it('rotate-key with extra positional → unrecognized', () => {
        expectParity(['rotate-key', 'foo'], tmp);
    });

    it('top-level -h usage line (body NOT compared)', () => {
        const p = runPy(['-h'], tmp);
        const t = runTs(['-h'], tmp);
        expect(t.status).toBe(p.status);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });

    it('encrypt -h usage line (body NOT compared)', () => {
        const p = runPy(['encrypt', '-h'], tmp);
        const t = runTs(['encrypt', '-h'], tmp);
        expect(t.status).toBe(p.status);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
});

// ---------------------------------------------------------------------------
// crypto interop — cross-language envelope round-trips + envelope header.
// GUARDED: requires python3 with the `cryptography` package.
// ---------------------------------------------------------------------------

const c = crypto ? describe : describe.skip;

// A fixed, valid base64-of-32-bytes key shared by both languages so they
// resolve the SAME master key (override the env-key path, never the keyring).
const SHARED_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

c('workspace_crypto — crypto interop', () => {
    it('SHARED_KEY decodes to exactly 32 bytes (test invariant)', () => {
        expect(Buffer.from(SHARED_KEY, 'base64').length).toBe(32);
    });

    it('ts-encrypt → py-decrypt round-trips to original plaintext', () => {
        const plain = path.join(tmp, 'plain.txt');
        const enc = path.join(tmp, 'ts.enc');
        const back = path.join(tmp, 'ts-then-py.txt');
        const data = 'cross-language secret 🔐\nline two\n';
        fs.writeFileSync(plain, data);
        const env = { AGENT_CONFIG_WORKSPACE_KEY: SHARED_KEY };
        const e = runTs(['encrypt', '--in', plain, '--out', enc], tmp, env);
        expect(e.status).toBe(0);
        const dres = runPy(['decrypt', '--in', enc, '--out', back], tmp, env);
        expect(dres.status).toBe(0);
        expect(fs.readFileSync(back, 'utf-8')).toBe(data);
    });

    it('py-encrypt → ts-decrypt round-trips to original plaintext', () => {
        const plain = path.join(tmp, 'plain.txt');
        const enc = path.join(tmp, 'py.enc');
        const back = path.join(tmp, 'py-then-ts.txt');
        const data = 'cross-language secret 🔐\nline two\n';
        fs.writeFileSync(plain, data);
        const env = { AGENT_CONFIG_WORKSPACE_KEY: SHARED_KEY };
        const e = runPy(['encrypt', '--in', plain, '--out', enc], tmp, env);
        expect(e.status).toBe(0);
        const dres = runTs(['decrypt', '--in', enc, '--out', back], tmp, env);
        expect(dres.status).toBe(0);
        expect(fs.readFileSync(back, 'utf-8')).toBe(data);
    });

    it('both languages emit the same AC1\\0\\x01 envelope header', () => {
        const plain = path.join(tmp, 'plain.txt');
        fs.writeFileSync(plain, 'header-check');
        const env = { AGENT_CONFIG_WORKSPACE_KEY: SHARED_KEY };
        const tsEnc = path.join(tmp, 'ts.enc');
        const pyEnc = path.join(tmp, 'py.enc');
        runTs(['encrypt', '--in', plain, '--out', tsEnc], tmp, env);
        runPy(['encrypt', '--in', plain, '--out', pyEnc], tmp, env);
        const header = Buffer.from([0x41, 0x43, 0x31, 0x00, 0x01]); // "AC1\0" + version 1
        const tsHead = fs.readFileSync(tsEnc).subarray(0, 5);
        const pyHead = fs.readFileSync(pyEnc).subarray(0, 5);
        expect(tsHead.equals(header)).toBe(true);
        expect(pyHead.equals(header)).toBe(true);
    });

    it('decrypt passes a plaintext (no-magic) payload through unchanged', () => {
        const plain = path.join(tmp, 'plain.txt');
        const out = path.join(tmp, 'out.txt');
        const data = 'not an envelope — plaintext written when flag off\n';
        fs.writeFileSync(plain, data);
        const env = { AGENT_CONFIG_WORKSPACE_KEY: SHARED_KEY };
        const ptres = runPy(['decrypt', '--in', plain, '--out', out], tmp, env);
        const ptOut = fs.readFileSync(out, 'utf-8');
        const tdres = runTs(['decrypt', '--in', plain, '--out', out], tmp, env);
        const tOut = fs.readFileSync(out, 'utf-8');
        expect(ptres.status).toBe(0);
        expect(tdres.status).toBe(0);
        expect(ptOut).toBe(data);
        expect(tOut).toBe(data);
    });
});
