// Intent tests for src/cli/python/workspace_hosts.ts (py2ts ADR-200 —
// host-agent tier detection, ADR-068).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly. Detection is side-effect-free
// and reads the static HOST_INVENTORY + probes PATH (`shutil.which` semantics).
// To stay deterministic regardless of which host CLIs are installed on the
// runner, every case spawns with a **node-only PATH** (a temp dir holding just a
// `node` symlink) so the tsx launcher resolves but NO host CLI does — every host
// then reports `cli_present:false` / `effective_tier:3`. COLUMNS=200 forces
// single-line usage so arg-error stderr does not re-wrap to terminal width.
import { mkdtempSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_hosts.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

// node-only PATH → deterministic host-CLI detection (nothing but `node` resolves).
const NODE_ONLY_DIR = mkdtempSync(path.join(tmpdir(), 'ws-hosts-nodeonly-'));
symlinkSync(process.execPath, path.join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    // temp dir is left for the OS to reap; nothing sensitive.
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PATH: NODE_ONLY_DIR, COLUMNS: '200' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('workspace_hosts — detect', () => {
    it('tier-1 known host (no CLI on PATH → demotes to tier 3)', () => {
        expect(runTs(['detect', 'claude-code'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"cli": "claude", "cli_present": false, "effective_tier": 3, "host": "claude-code", "inventory_tier": 1, "known": true, "mode": "handoff"}
          ",
          }
        `);
    });
    it('tier-3 known host', () => {
        expect(runTs(['detect', 'augment'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"cli": null, "cli_present": false, "effective_tier": 3, "host": "augment", "inventory_tier": 3, "known": true, "mode": "handoff"}
          ",
          }
        `);
    });
    it('unknown host (fail-soft, exit 1)', () => {
        expect(runTs(['detect', 'nope'])).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "",
            "stdout": "{"cli": null, "cli_present": false, "effective_tier": 3, "host": "nope", "inventory_tier": null, "known": false, "mode": "handoff"}
          ",
          }
        `);
    });
    it('detect --json', () => {
        expect(runTs(['detect', 'codex', '--json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"cli": "codex", "cli_present": false, "effective_tier": 3, "host": "codex", "inventory_tier": 1, "known": true, "mode": "handoff"}
          ",
          }
        `);
    });
    it('detect --json before positional', () => {
        expect(runTs(['detect', '--json', 'gemini'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"cli": "gemini", "cli_present": false, "effective_tier": 3, "host": "gemini", "inventory_tier": 1, "known": true, "mode": "handoff"}
          ",
          }
        `);
    });
});

describe('workspace_hosts — list', () => {
    it('list (text)', () => {
        expect(runTs(['list'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "augment	tier3	no-cli
          claude-code	tier1	no-cli
          cline	tier3	no-cli
          codex	tier1	no-cli
          cursor	tier3	no-cli
          gemini	tier1	no-cli
          windsurf	tier3	no-cli
          ",
          }
        `);
    });
    it('list --json', () => {
        expect(runTs(['list', '--json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "[{"cli": null, "cli_present": false, "effective_tier": 3, "host": "augment", "inventory_tier": 3, "known": true, "mode": "handoff"}, {"cli": "claude", "cli_present": false, "effective_tier": 3, "host": "claude-code", "inventory_tier": 1, "known": true, "mode": "handoff"}, {"cli": null, "cli_present": false, "effective_tier": 3, "host": "cline", "inventory_tier": 3, "known": true, "mode": "handoff"}, {"cli": "codex", "cli_present": false, "effective_tier": 3, "host": "codex", "inventory_tier": 1, "known": true, "mode": "handoff"}, {"cli": null, "cli_present": false, "effective_tier": 3, "host": "cursor", "inventory_tier": 3, "known": true, "mode": "handoff"}, {"cli": "gemini", "cli_present": false, "effective_tier": 3, "host": "gemini", "inventory_tier": 1, "known": true, "mode": "handoff"}, {"cli": null, "cli_present": false, "effective_tier": 3, "host": "windsurf", "inventory_tier": 3, "known": true, "mode": "handoff"}]
          ",
          }
        `);
    });
});

describe('workspace_hosts — argparse errors', () => {
    it('no args → required cmd, exit 2', () => {
        expect(runTs([])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_hosts [-h] {detect,list} ...
          workspace_hosts: error: the following arguments are required: cmd
          ",
            "stdout": "",
          }
        `);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expect(runTs(['bogus'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_hosts [-h] {detect,list} ...
          workspace_hosts: error: argument cmd: invalid choice: 'bogus' (choose from 'detect', 'list')
          ",
            "stdout": "",
          }
        `);
    });
    it('detect missing host_id → exit 2', () => {
        expect(runTs(['detect'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_hosts detect [-h] [--json] host_id
          workspace_hosts detect: error: the following arguments are required: host_id
          ",
            "stdout": "",
          }
        `);
    });
    it('detect extra positional → unrecognized, exit 2', () => {
        expect(runTs(['detect', 'a', 'b'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_hosts [-h] {detect,list} ...
          workspace_hosts: error: unrecognized arguments: b
          ",
            "stdout": "",
          }
        `);
    });
    it('detect unknown flag → unrecognized, exit 2', () => {
        expect(runTs(['detect', '--bogus', 'x'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_hosts [-h] {detect,list} ...
          workspace_hosts: error: unrecognized arguments: --bogus
          ",
            "stdout": "",
          }
        `);
    });
    it('list extra positional → unrecognized, exit 2', () => {
        expect(runTs(['list', 'extra'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_hosts [-h] {detect,list} ...
          workspace_hosts: error: unrecognized arguments: extra
          ",
            "stdout": "",
          }
        `);
    });
    it('top-level -h → usage + exit 0', () => {
        expect(runTs(['-h'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "usage: workspace_hosts [-h] {detect,list} ...
          ",
          }
        `);
    });
    it('detect -h → subparser usage + exit 0', () => {
        expect(runTs(['detect', '-h'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "usage: workspace_hosts detect [-h] [--json] host_id
          ",
          }
        `);
    });
});
