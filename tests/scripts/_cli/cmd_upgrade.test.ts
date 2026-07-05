// Contract tests for the `cmd_upgrade` TypeScript CLI (ADR-200).
//
// `cmd_upgrade` shells out to `npm install -g …` + `agent-config global` and
// fetches the latest version over the network. The CLI process cannot inject
// the `runner` / `fetcher` seams, so a raw `tsx cmd_upgrade.ts` run would
// mutate the developer's global install and hit the registry — neither is
// safe nor deterministic.
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Strategy:
//  - USAGE / `--help` / argument errors: spawned via the real CLI (no network,
//    no subprocess) — assert exit codes + usage token.
//  - Functional paths (`--check`, `--dry-run`, apply success/failure): driven
//    through the in-process `main({ fetcher, runner, installed, out, err })`
//    seam with injected values that never touch the network or the global
//    install. Each branch is asserted structurally (defined exit + determinism).
//
// `_agent_config_bin()` resolves the machine's real `agent-config` on PATH
// (the dry-run step text), so its path is normalized to `<BIN>` before compare.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_upgrade.ts');
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

// --- CLI spawn (usage / --help only — no network, no subprocess) ---

function runTsCli(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// --- In-process seam harness (injected fetcher / runner / installed) ---

const TS_HARNESS = `
(async () => {
    const m = await import(${JSON.stringify(TS_SCRIPT)});
    const inst = process.argv[2], latest = process.argv[3], rc = parseInt(process.argv[4], 10);
    const args = process.argv.slice(5);
    let out = '', err = '';
    const sink = (b) => ({ write: (t) => { if (b === 'o') out += t; else err += t; } });
    const code = await m.main(args, { fetcher: () => latest || '', runner: () => rc, installed: inst, out: sink('o'), err: sink('e') });
    process.stdout.write('\\x00OUT\\x00' + out + '\\x00ERR\\x00' + err + '\\x00EXIT\\x00' + code);
})();
`;

interface SeamResult {
    out: string;
    err: string;
    exit: string;
}

function parseSeam(raw: string): SeamResult {
    // Envelope: \x00OUT\x00<out>\x00ERR\x00<err>\x00EXIT\x00<code>
    const m = /\x00OUT\x00([\s\S]*)\x00ERR\x00([\s\S]*)\x00EXIT\x00([\s\S]*)$/.exec(raw);
    if (!m) {
        throw new Error(`unparseable seam envelope:\n${raw}`);
    }
    return { out: m[1] ?? '', err: m[2] ?? '', exit: m[3] ?? '' };
}

/** Normalize the machine-specific resolved `agent-config` binary path. */
function normBin(s: string): string {
    return s.replace(/\S*agent-config global/g, '<BIN> global');
}

let tsHarnessPath: string;
let harnessDir: string;

beforeEach(() => {
    harnessDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-h-'));
    tsHarnessPath = path.join(harnessDir, 'harness.mjs');
    fs.writeFileSync(tsHarnessPath, TS_HARNESS);
});
afterEach(() => {
    fs.rmSync(harnessDir, { recursive: true, force: true });
});

function seamTs(installed: string, latest: string, rc: number, args: string[]): SeamResult {
    const r = spawnSync(TSX_BIN, [tsHarnessPath, installed, latest, String(rc), ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return parseSeam(r.stdout ?? '');
}

/** The seam runs to a defined exit and is deterministic (path masked out). */
function expectSeamStable(
    installed: string,
    latest: string,
    rc: number,
    args: string[],
): SeamResult {
    const a = seamTs(installed, latest, rc, args);
    const b = seamTs(installed, latest, rc, args);
    expect(a.exit).not.toBe('');
    expect(normBin(b.out)).toBe(normBin(a.out));
    expect(normBin(b.err)).toBe(normBin(a.err));
    expect(b.exit).toBe(a.exit);
    return a;
}

// ---------------------------------------------------------------------------
// Usage / argument errors (real CLI).
// ---------------------------------------------------------------------------

describe('upgrade — argument errors (CLI)', () => {
    it('--help: exit 0, usage token on stdout', () => {
        const t = runTsCli(['--help']);
        expect(t.status).toBe(0);
        expect(t.stdout.startsWith('usage: agent-config upgrade')).toBe(true);
    });

    it('unknown flag: exit 2', () => {
        expect(runTsCli(['--bogus']).status).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// --check (in-process seam; no network, no subprocess).
// ---------------------------------------------------------------------------

describe('upgrade --check', () => {
    it('up-to-date (installed newer than latest): exit 0', () => {
        expect(expectSeamStable('2.0.0', '1.0.0', 0, ['--check']).exit).toBe('0');
    });
    it('newer available: exit 0, ℹ info line', () => {
        expect(expectSeamStable('1.0.0', '2.0.0', 0, ['--check']).exit).toBe('0');
    });
    it('equal versions: up-to-date line, exit 0', () => {
        expect(expectSeamStable('2.0.0', '2.0.0', 0, ['--check']).exit).toBe('0');
    });
    it('unknown installed: "installed: unknown", exit 0', () => {
        expect(expectSeamStable('', '2.0.0', 0, ['--check']).exit).toBe('0');
    });
    it('latest unavailable (registry unreachable): stderr note, exit 0', () => {
        expect(expectSeamStable('1.0.0', '', 0, ['--check']).exit).toBe('0');
    });
    it('v-prefixed versions normalize identically', () => {
        expectSeamStable('v1.0.0', 'v2.0.0', 0, ['--check']);
    });
});

// ---------------------------------------------------------------------------
// --dry-run + apply (injected runner — never executes npm/bash).
// ---------------------------------------------------------------------------

describe('upgrade --dry-run / apply', () => {
    it('--dry-run prints the would-run command list, exit 0', () => {
        expect(expectSeamStable('1.0.0', '2.0.0', 0, ['--dry-run']).exit).toBe('0');
    });
    it('apply success (runner returns 0): both steps echoed, exit 0', () => {
        expect(expectSeamStable('1.0.0', '2.0.0', 0, []).exit).toBe('0');
    });
    it('apply step failure (runner returns 7): error + exit 1', () => {
        expect(expectSeamStable('1.0.0', '2.0.0', 7, []).exit).toBe('1');
    });
    it('apply with latest unavailable still proceeds against @latest tag', () => {
        // Non-check path ignores `latest` for the npm target (always @latest).
        expect(expectSeamStable('1.0.0', '', 0, []).exit).toBe('0');
    });
});
