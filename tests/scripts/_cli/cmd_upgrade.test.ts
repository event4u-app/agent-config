// Golden-parity tests for the `cmd_upgrade` TypeScript twin (ADR-200).
//
// `cmd_upgrade` shells out to `npm install -g …` + `agent-config global` and
// fetches the latest version over the network. The CLI process cannot inject
// the `runner` / `fetcher` seams, so a raw `tsx cmd_upgrade.ts` run would
// mutate the developer's global install and hit the registry — neither is
// safe nor deterministic.
//
// Strategy:
//  - USAGE / `--help` / argument errors: spawned via the real CLI (no network,
//    no subprocess) and compared byte-for-byte (usage token + exit for help).
//  - Functional paths (`--check`, `--dry-run`, apply success/failure): driven
//    through the in-process `main({ fetcher, runner, installed, out, err })`
//    seam — the EXACT seam the Python `main(..., runner=, fetcher=, installed=,
//    out=, err=)` exposes. A tiny python3 harness and a tsx harness call that
//    seam with identical injected values and dump OUT/ERR/EXIT; we compare them
//    byte-for-byte. No network, no global mutation.
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
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_upgrade.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

// --- CLI spawns (usage / --help only — no network, no subprocess) ---

function runPyCli(args: string[]): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src') },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTsCli(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// --- In-process seam harnesses (injected fetcher / runner / installed) ---

// A python harness that calls cmd_upgrade.main with injected seams and prints
// OUT/ERR/EXIT in a parse-stable envelope.
const PY_HARNESS = [
    'import io, sys',
    'from scripts._cli import cmd_upgrade as m',
    'inst, latest, rc = sys.argv[1], sys.argv[2], int(sys.argv[3])',
    'args = sys.argv[4:]',
    'out, err = io.StringIO(), io.StringIO()',
    'code = m.main(args, runner=lambda c: rc, fetcher=lambda: latest or "", installed=inst, out=out, err=err)',
    'sys.stdout.write("\\x00OUT\\x00" + out.getvalue() + "\\x00ERR\\x00" + err.getvalue() + "\\x00EXIT\\x00" + str(code))',
].join('\n');

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

let pyHarnessPath: string;
let tsHarnessPath: string;
let harnessDir: string;

beforeEach(() => {
    harnessDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-h-'));
    pyHarnessPath = path.join(harnessDir, 'harness.py');
    tsHarnessPath = path.join(harnessDir, 'harness.mjs');
    fs.writeFileSync(pyHarnessPath, PY_HARNESS);
    fs.writeFileSync(tsHarnessPath, TS_HARNESS);
});
afterEach(() => {
    fs.rmSync(harnessDir, { recursive: true, force: true });
});

function seamPy(installed: string, latest: string, rc: number, args: string[]): SeamResult {
    const r = spawnSync('python3', [pyHarnessPath, installed, latest, String(rc), ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src') },
    });
    return parseSeam(r.stdout ?? '');
}

function seamTs(installed: string, latest: string, rc: number, args: string[]): SeamResult {
    const r = spawnSync(TSX_BIN, [tsHarnessPath, installed, latest, String(rc), ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return parseSeam(r.stdout ?? '');
}

function expectSeamParity(installed: string, latest: string, rc: number, args: string[]): void {
    const p = seamPy(installed, latest, rc, args);
    const t = seamTs(installed, latest, rc, args);
    expect(normBin(t.out)).toBe(normBin(p.out));
    expect(normBin(t.err)).toBe(normBin(p.err));
    expect(t.exit).toBe(p.exit);
}

// ---------------------------------------------------------------------------
// Usage / argument errors (real CLI).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('upgrade — argument errors (CLI)', () => {
    it('--help: exit 0, usage token on stdout', () => {
        const p = runPyCli(['--help']);
        const t = runTsCli(['--help']);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        expect(t.stdout.startsWith('usage: agent-config upgrade')).toBe(true);
        expect(p.stdout.startsWith('usage: agent-config upgrade')).toBe(true);
    });

    it('unknown flag: exit 2, usage + error byte-identical on stderr', () => {
        const p = runPyCli(['--bogus']);
        const t = runTsCli(['--bogus']);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });
});

// ---------------------------------------------------------------------------
// --check (in-process seam; no network, no subprocess).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('upgrade --check', () => {
    it('up-to-date (installed newer than latest): exit 0', () => {
        expectSeamParity('2.0.0', '1.0.0', 0, ['--check']);
    });
    it('newer available: exit 0, ℹ info line', () => {
        expectSeamParity('1.0.0', '2.0.0', 0, ['--check']);
    });
    it('equal versions: up-to-date line, exit 0', () => {
        expectSeamParity('2.0.0', '2.0.0', 0, ['--check']);
    });
    it('unknown installed: "installed: unknown", exit 0', () => {
        expectSeamParity('', '2.0.0', 0, ['--check']);
    });
    it('latest unavailable (registry unreachable): stderr note, exit 0', () => {
        expectSeamParity('1.0.0', '', 0, ['--check']);
    });
    it('v-prefixed versions normalize identically', () => {
        expectSeamParity('v1.0.0', 'v2.0.0', 0, ['--check']);
    });
});

// ---------------------------------------------------------------------------
// --dry-run + apply (injected runner — never executes npm/bash).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('upgrade --dry-run / apply', () => {
    it('--dry-run prints the would-run command list, exit 0', () => {
        expectSeamParity('1.0.0', '2.0.0', 0, ['--dry-run']);
    });
    it('apply success (runner returns 0): both steps echoed, exit 0', () => {
        expectSeamParity('1.0.0', '2.0.0', 0, []);
    });
    it('apply step failure (runner returns 7): error + exit 1', () => {
        expectSeamParity('1.0.0', '2.0.0', 7, []);
    });
    it('apply with latest unavailable still proceeds against @latest tag', () => {
        // Non-check path ignores `latest` for the npm target (always @latest);
        // exercises the empty-fetch + apply interaction for parity.
        expectSeamParity('1.0.0', '', 0, []);
    });
});
