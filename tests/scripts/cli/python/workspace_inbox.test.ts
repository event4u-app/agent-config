// Golden-parity tests for src/cli/python/workspace_inbox.ts (py2ts ADR-200 —
// Tier-3 host hand-off inbox, ADR-023 Tier 3 / ADR-065).
//
// Strategy: run `python3 workspace_inbox.py` vs `tsx workspace_inbox.ts` and
// byte-compare stdout / stderr / exit. The store writes files into a
// `<root>/<id>.md` where `<id>` is `<UTC-stamp>-<8 random hex>` and the
// frontmatter carries `created_at` (UTC second) — both NONDETERMINISTIC and
// differing py-vs-ts. So functional cases run each language in a SEPARATE
// hermetic `<tmp>/workspace/inbox` root, replay the SAME command, then
// `norm()` masks the random id, the timestamp, and the tmp root before
// comparing — leaving the structural payload (banner shape, frontmatter keys,
// scrubbed body, JSON shape, ordering) a true byte-for-byte assertion.
//
// `_validate_cli_root` requires `--root` to be a `.../workspace/inbox` dir, so
// every root is `<tmp>/workspace/inbox`. The `--help` BODY is NOT byte-compared
// (only the `usage:` line) per the porting contract; the Python runs force
// COLUMNS=80 so the multi-line usage strings byte-match the TS hardcoded form.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_inbox.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_inbox.py');
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

const COLS80 = { COLUMNS: '80' };

function runPy(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...COLS80, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, ...COLS80, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Mask nondeterministic ids / timestamps / the tmp root. */
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
    // <YYYYMMDDTHHMMSSZ>-<8 hex> id token.
    out = out.replace(/\d{8}T\d{6}Z-[0-9a-f]{8}/g, '<ID>');
    // created_at ISO second (frontmatter + JSON).
    out = out.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, '<TS>');
    return out;
}

/** Byte-exact parity (deterministic surfaces: usage / arg errors). */
function expectParityExact(args: string[]): void {
    const p = runPy(args);
    const t = runTs(args);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
}

let pyRoot: string;
let tsRoot: string;
let pyTmp: string;
let tsTmp: string;
beforeEach(() => {
    pyTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wsinbox-py-'));
    tsTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wsinbox-ts-'));
    pyRoot = path.join(pyTmp, 'workspace', 'inbox');
    tsRoot = path.join(tsTmp, 'workspace', 'inbox');
    fs.mkdirSync(pyRoot, { recursive: true });
    fs.mkdirSync(tsRoot, { recursive: true });
});
afterEach(() => {
    fs.rmSync(pyTmp, { recursive: true, force: true });
    fs.rmSync(tsTmp, { recursive: true, force: true });
});

function bodyFile(dir: string, content: string): string {
    const p = path.join(dir, 'body.txt');
    fs.writeFileSync(p, content);
    return p;
}

describe.skipIf(!py3)('workspace_inbox — write + read + list + forget', () => {
    it('write returns id/path/banner (normalized parity)', () => {
        const pb = bodyFile(pyTmp, 'Customer wants a quote.\n');
        const tb = bodyFile(tsTmp, 'Customer wants a quote.\n');
        const p = runPy(['write', '--role', 'sales', '--task', 'draft offer', '--body-file', pb, '--root', pyRoot]);
        const t = runTs(['write', '--role', 'sales', '--task', 'draft offer', '--body-file', tb, '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toBe(norm(p.stdout, [pyRoot, pyTmp]));
    });

    it('write scrubs a secret in body + task', () => {
        const secret = 'AKIAIOSFODNN7EXAMPLE';
        const pb = bodyFile(pyTmp, `key here: ${secret}\n`);
        const tb = bodyFile(tsTmp, `key here: ${secret}\n`);
        runPy(['write', '--role', 'r', '--task', `t ${secret}`, '--body-file', pb, '--root', pyRoot]);
        runTs(['write', '--role', 'r', '--task', `t ${secret}`, '--body-file', tb, '--root', tsRoot]);
        // Read each back and compare normalized file bodies; secret must be gone.
        const pf = fs.readdirSync(pyRoot)[0] as string;
        const tf = fs.readdirSync(tsRoot)[0] as string;
        const pTxt = fs.readFileSync(path.join(pyRoot, pf), 'utf8');
        const tTxt = fs.readFileSync(path.join(tsRoot, tf), 'utf8');
        expect(pTxt).not.toContain(secret);
        expect(tTxt).not.toContain(secret);
        expect(norm(tTxt, [tsRoot, tsTmp])).toBe(norm(pTxt, [pyRoot, pyTmp]));
    });

    it('write with --skill-hint pre-renders a skill section', () => {
        // Use a present skill if any; else a missing one (note section). Either
        // way the two languages must render identically.
        const hint = 'docker';
        const pb = bodyFile(pyTmp, 'Base prompt.\n');
        const tb = bodyFile(tsTmp, 'Base prompt.\n');
        runPy(['write', '--role', 'r', '--task', 't', '--body-file', pb, '--skill-hint', hint, '--root', pyRoot]);
        runTs(['write', '--role', 'r', '--task', 't', '--body-file', tb, '--skill-hint', hint, '--root', tsRoot]);
        const pTxt = fs.readFileSync(path.join(pyRoot, fs.readdirSync(pyRoot)[0] as string), 'utf8');
        const tTxt = fs.readFileSync(path.join(tsRoot, fs.readdirSync(tsRoot)[0] as string), 'utf8');
        expect(norm(tTxt, [tsRoot, tsTmp])).toBe(norm(pTxt, [pyRoot, pyTmp]));
    });

    it('read returns the file body (normalized)', () => {
        const pb = bodyFile(pyTmp, 'Read me.\n');
        const tb = bodyFile(tsTmp, 'Read me.\n');
        const pw = JSON.parse(
            runPy(['write', '--role', 'a', '--task', 'b', '--body-file', pb, '--root', pyRoot]).stdout,
        );
        const tw = JSON.parse(
            runTs(['write', '--role', 'a', '--task', 'b', '--body-file', tb, '--root', tsRoot]).stdout,
        );
        const p = runPy(['read', pw.id, '--root', pyRoot]);
        const t = runTs(['read', tw.id, '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toBe(norm(p.stdout, [pyRoot, pyTmp]));
    });

    it('read missing → stderr + exit 1', () => {
        const p = runPy(['read', 'nope', '--root', pyRoot]);
        const t = runTs(['read', 'nope', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout);
        // stderr names the id (deterministic) — compare directly.
        expect(t.stderr).toBe(p.stderr);
    });

    it('list --json (single entry, normalized)', () => {
        const pb = bodyFile(pyTmp, 'x\n');
        const tb = bodyFile(tsTmp, 'x\n');
        runPy(['write', '--role', 'sales', '--task', 'one', '--body-file', pb, '--session', 's1', '--root', pyRoot]);
        runTs(['write', '--role', 'sales', '--task', 'one', '--body-file', tb, '--session', 's1', '--root', tsRoot]);
        const p = runPy(['list', '--json', '--root', pyRoot]);
        const t = runTs(['list', '--json', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toBe(norm(p.stdout, [pyRoot, pyTmp]));
    });

    it('list text (per-line JSON, empty root)', () => {
        const p = runPy(['list', '--root', pyRoot]);
        const t = runTs(['list', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout); // both empty
    });

    it('forget present → exit 0; absent → exit 1', () => {
        const pb = bodyFile(pyTmp, 'x\n');
        const tb = bodyFile(tsTmp, 'x\n');
        const pid = JSON.parse(
            runPy(['write', '--role', 'a', '--task', 'b', '--body-file', pb, '--root', pyRoot]).stdout,
        ).id;
        const tid = JSON.parse(
            runTs(['write', '--role', 'a', '--task', 'b', '--body-file', tb, '--root', tsRoot]).stdout,
        ).id;
        expect(runTs(['forget', tid, '--root', tsRoot]).status).toBe(
            runPy(['forget', pid, '--root', pyRoot]).status,
        );
        // forget again → absent → exit 1.
        expect(runTs(['forget', tid, '--root', tsRoot]).status).toBe(
            runPy(['forget', pid, '--root', pyRoot]).status,
        );
    });

    it('prune drops nothing recent → {"pruned": 0}', () => {
        const pb = bodyFile(pyTmp, 'x\n');
        const tb = bodyFile(tsTmp, 'x\n');
        runPy(['write', '--role', 'a', '--task', 'b', '--body-file', pb, '--root', pyRoot]);
        runTs(['write', '--role', 'a', '--task', 'b', '--body-file', tb, '--root', tsRoot]);
        const p = runPy(['prune', '--root', pyRoot]);
        const t = runTs(['prune', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout); // {"pruned": 0}
    });

    it('prune --max-age-hours 0 drops everything', () => {
        const pb = bodyFile(pyTmp, 'x\n');
        const tb = bodyFile(tsTmp, 'x\n');
        runPy(['write', '--role', 'a', '--task', 'b', '--body-file', pb, '--root', pyRoot]);
        runTs(['write', '--role', 'a', '--task', 'b', '--body-file', tb, '--root', tsRoot]);
        const p = runPy(['prune', '--max-age-hours', '0', '--root', pyRoot]);
        const t = runTs(['prune', '--max-age-hours', '0', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout); // {"pruned": 1}
    });
});

describe.skipIf(!py3)('workspace_inbox — argparse + root validation errors', () => {
    it('no args → required cmd, exit 2', () => {
        expectParityExact([]);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expectParityExact(['bogus']);
    });
    it('write missing all required → exit 2', () => {
        expectParityExact(['write']);
    });
    it('read missing inbox_id → exit 2', () => {
        expectParityExact(['read']);
    });
    it('forget missing inbox_id → exit 2', () => {
        expectParityExact(['forget']);
    });
    it('list bad --limit int → exit 2', () => {
        expectParityExact(['list', '--limit', 'abc']);
    });
    it('prune bad --max-age-hours int → exit 2', () => {
        expectParityExact(['prune', '--max-age-hours', 'xyz']);
    });
    it('--root not a workspace/inbox dir → SystemExit, exit 1', () => {
        expectParityExact(['list', '--root', '/tmp/not-an-inbox']);
    });
    it('write -h → usage line + exit 0', () => {
        const p = runPy(['write', '-h']);
        const t = runTs(['write', '-h']);
        expect(t.status).toBe(p.status);
        // Compare the wrapped usage block (lines until the first blank line).
        // TS prints usage only (no body); Python prints usage + blank + body.
        // Compare the usage block, trimming the trailing newline difference.
        const usageOf = (s: string): string => (s.split('\n\n')[0] as string).trimEnd();
        expect(usageOf(t.stdout)).toBe(usageOf(p.stdout));
    });
    it('prune -h → usage line + exit 0', () => {
        const p = runPy(['prune', '-h']);
        const t = runTs(['prune', '-h']);
        expect(t.status).toBe(p.status);
        // TS prints usage only (no body); Python prints usage + blank + body.
        // Compare the usage block, trimming the trailing newline difference.
        const usageOf = (s: string): string => (s.split('\n\n')[0] as string).trimEnd();
        expect(usageOf(t.stdout)).toBe(usageOf(p.stdout));
    });
    it('top-level -h → usage line + exit 0', () => {
        const p = runPy(['-h']);
        const t = runTs(['-h']);
        expect(t.status).toBe(p.status);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
});
