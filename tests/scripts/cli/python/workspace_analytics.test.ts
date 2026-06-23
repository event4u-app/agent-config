// Intent tests for src/cli/python/workspace_analytics.ts (py2ts ADR-200 —
// local-only workspace analytics, local-analytics.md).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly. The CLI has NO `--root`/`--path`
// flag — every subcommand reads/writes `$HOME/.event4u/.../analytics/
// events.jsonl` — so each case runs under a hermetic `HOME` and a neutral CWD
// (no `.agent-settings.yml` → analytics on, encryption off). `norm()` masks the
// only nondeterministic surface (the per-record `ts` UTC second); the `show`
// report otherwise renders deterministically (top-prompts, round-half-to-even
// completion %, divmod session length, CSV `\r\n`, JSON `indent=2`).
//
// Each case spawns with a **node-only PATH** (a temp dir holding just a `node`
// symlink) so any host-CLI probing is deterministic, plus COLUMNS=200 so
// arg-error/usage stderr does not re-wrap to terminal width. The `--help` BODY
// is NOT snapshotted (only the `usage:` line). Encryption-at-rest defaults OFF:
// migrate raises (exit 1), decrypt-all is a crypto-free `{decrypted: N}` — both
// deterministic.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_analytics.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

// node-only PATH → deterministic host-CLI detection (nothing but `node` resolves).
const NODE_ONLY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wsan-nodeonly-'));
fs.symlinkSync(process.execPath, path.join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    fs.rmSync(NODE_ONLY_DIR, { recursive: true, force: true });
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

let tsHome: string;
let cwd: string;

function runTs(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd,
        env: { ...process.env, HOME: tsHome, PATH: NODE_ONLY_DIR, COLUMNS: '200', ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Mask the per-record `ts` UTC second (the only nondeterministic surface). */
function norm(text: string): string {
    return text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, '<TS>');
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

/** Emit an event into the store (under the active HOME). */
function emit(event: string, data: string[]): void {
    runTs(['emit', event, ...data.flatMap((d) => ['--data', d])]);
}

beforeEach(() => {
    tsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wsan-ts-'));
    // A neutral CWD with NO .agent-settings.yml → analytics on, encryption off.
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wsan-cwd-'));
});
afterEach(() => {
    fs.rmSync(tsHome, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
});

describe('workspace_analytics — emit', () => {
    it('emit a valid event → exit 0, no output', () => {
        const t = runTs(['emit', 'launcher.opened', '--data', 'role=sales']);
        expect(t.status).toMatchInlineSnapshot(`0`);
        expect(t.stdout).toMatchInlineSnapshot(`""`);
        expect(t.stderr).toMatchInlineSnapshot(`""`);
    });

    it('emit an unknown event → stderr + exit 1', () => {
        const t = runTs(['emit', 'bogus.event']);
        expect(t.status).toMatchInlineSnapshot(`1`);
        expect(t.stdout).toMatchInlineSnapshot(`""`);
        expect(t.stderr).toMatchInlineSnapshot(`
          "workspace_analytics: rejecting unknown event 'bogus.event'
          "
        `); // names the rejected event
    });

    it('emit with a bad --data (no =) → SystemExit string + exit 1', () => {
        expect(runTs(['emit', 'launcher.opened', '--data', 'novalue'])).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "--data expects key=value, got 'novalue'
          ",
            "stdout": "",
          }
        `);
    });

    it('emit under env opt-out → exit 1 (no write)', () => {
        const t = runTs(['emit', 'launcher.opened'], { AGENT_CONFIG_NO_LOCAL_ANALYTICS: '1' });
        expect(t.status).toMatchInlineSnapshot(`1`);
        expect(t.stdout).toMatchInlineSnapshot(`""`);
        expect(t.stderr).toMatchInlineSnapshot(`""`);
    });

    it('emit under settings opt-out (analytics.local: off) → exit 1', () => {
        fs.writeFileSync(path.join(cwd, '.agent-settings.yml'), 'analytics:\n  local: off\n');
        const t = runTs(['emit', 'launcher.opened']);
        expect(t.status).toMatchInlineSnapshot(`1`);
    });
});

describe('workspace_analytics — show', () => {
    it('markdown report (top prompts, completion %, session length)', () => {
        emit('launcher.task_launched', ['role=sales', 'task=offer']);
        emit('launcher.task_launched', ['role=sales', 'task=offer']);
        emit('launcher.task_launched', ['role=support', 'task=reply']);
        emit('session.completed', ['role=sales', 'duration_ms=90000']);
        emit('knowledge.source_clicked', ['source=docA']);
        const t = runTs(['show', '--window', '30d']);
        expect(t.status).toBe(0);
        expect(norm(t.stdout)).toMatchInlineSnapshot(`
          "# Workspace analytics — last 30d

          ## Top prompts

          - \`sales\` · \`offer\` — 2
          - \`support\` · \`reply\` — 1

          ## Launcher → completion rate per role

          - \`sales\` — 50% (2 launched · 1 completed)
          - \`support\` — 0% (1 launched · 0 completed)

          **Average session length:** 1m 30s

          **Knowledge sources clicked:** 1
          _(docA)_
          "
        `);
    });

    it('markdown report on an empty store', () => {
        const t = runTs(['show']);
        expect(t.status).toBe(0);
        expect(norm(t.stdout)).toMatchInlineSnapshot(`
          "# Workspace analytics — last 30d

          _No events recorded in this window._
          "
        `);
    });

    it('round-half-to-even completion percentage (3 launched, 2 completed → 67%)', () => {
        for (let i = 0; i < 3; i += 1) emit('launcher.task_launched', ['role=r', 'task=t']);
        for (let i = 0; i < 2; i += 1) emit('session.completed', ['role=r']);
        const t = runTs(['show']);
        expect(norm(t.stdout)).toMatchInlineSnapshot(`
          "# Workspace analytics — last 30d

          ## Top prompts

          - \`r\` · \`t\` — 3

          ## Launcher → completion rate per role

          - \`r\` — 67% (3 launched · 2 completed)

          **Knowledge sources clicked:** 0
          "
        `);
    });

    it('csv format (\\r\\n rows, header)', () => {
        emit('launcher.task_launched', ['role=sales', 'task=offer']);
        emit('session.completed', ['role=sales', 'duration_ms=60000', 'host_tier=tier-1']);
        const t = runTs(['show', '--format', 'csv']);
        expect(t.status).toBe(0);
        expect(norm(t.stdout)).toMatchInlineSnapshot(`
          "ts,event,role,task,host_tier,duration_ms
          <TS>,launcher.task_launched,sales,offer,,
          <TS>,session.completed,sales,,tier-1,60000
          "
        `);
        expect(t.stdout).toContain('\r\n'); // csv.writer line terminator
    });

    it('json format (indent=2, insertion-order keys)', () => {
        emit('launcher.task_launched', ['role=sales', 'task=offer', 'duration_ms=5']);
        const t = runTs(['show', '--format', 'json']);
        expect(t.status).toBe(0);
        expect(norm(t.stdout)).toMatchInlineSnapshot(`
          "[
            {
              "ts": "<TS>",
              "event": "launcher.task_launched",
              "data": {
                "duration_ms": 5,
                "role": "sales",
                "task": "offer"
              }
            }
          ]"
        `);
    });

    it('--event filter', () => {
        emit('launcher.task_launched', ['role=a', 'task=x']);
        emit('session.completed', ['role=a']);
        const t = runTs(['show', '--format', 'json', '--event', 'session.completed']);
        expect(norm(t.stdout)).toMatchInlineSnapshot(`
          "[
            {
              "ts": "<TS>",
              "event": "session.completed",
              "data": {
                "role": "a"
              }
            }
          ]"
        `);
    });

    it('--role filter', () => {
        emit('launcher.task_launched', ['role=a', 'task=x']);
        emit('launcher.task_launched', ['role=b', 'task=y']);
        const t = runTs(['show', '--format', 'csv', '--role', 'a']);
        expect(norm(t.stdout)).toMatchInlineSnapshot(`
          "ts,event,role,task,host_tier,duration_ms
          <TS>,launcher.task_launched,a,x,,
          "
        `);
    });
});

describe('workspace_analytics — prune + encryption defaults', () => {
    it('prune an empty store → "pruned 0 event(s)"', () => {
        const t = runTs(['prune']);
        expect(t.status).toBe(0);
        expect(t.stdout).toMatchInlineSnapshot(`
          "pruned 0 event(s)
          "
        `);
    });

    it('prune keeps recent events → "pruned 0 event(s)"', () => {
        emit('launcher.opened', ['role=r']);
        const t = runTs(['prune']);
        expect(t.status).toBe(0);
        expect(t.stdout).toMatchInlineSnapshot(`
          "pruned 0 event(s)
          "
        `); // 0 dropped (just emitted)
    });

    it('migrate with encryption off → exit 1 (RuntimeError)', () => {
        emit('launcher.opened', ['role=r']);
        const t = runTs(['migrate']);
        expect(t.status).toMatchInlineSnapshot(`1`);
    });

    it('decrypt-all on plaintext → {"decrypted": N} (crypto-free)', () => {
        emit('launcher.opened', ['role=r']);
        emit('session.completed', ['role=r']);
        const t = runTs(['decrypt-all']);
        expect(t.status).toBe(0);
        expect(t.stdout).toMatchInlineSnapshot(`
          "{"decrypted": 2}
          "
        `); // {"decrypted": 2}
    });
});

describe('workspace_analytics — argparse errors', () => {
    it('no args → required cmd, exit 2', () => {
        expect(runTs([])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_analytics [-h]
                                     {emit,show,prune,migrate,decrypt-all,rekey} ...
          workspace_analytics: error: the following arguments are required: cmd
          ",
            "stdout": "",
          }
        `);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expect(runTs(['bogus'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_analytics [-h]
                                     {emit,show,prune,migrate,decrypt-all,rekey} ...
          workspace_analytics: error: argument cmd: invalid choice: 'bogus' (choose from 'emit', 'show', 'prune', 'migrate', 'decrypt-all', 'rekey')
          ",
            "stdout": "",
          }
        `);
    });
    it('show bad --window → invalid choice, exit 2', () => {
        expect(runTs(['show', '--window', '99d'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_analytics show [-h] [--window {24h,30d,7d}] [--event EVENT]
                                          [--role ROLE] [--format {markdown,csv,json}]
          workspace_analytics show: error: argument --window: invalid choice: '99d' (choose from '24h', '30d', '7d')
          ",
            "stdout": "",
          }
        `);
    });
    it('show bad --format → invalid choice, exit 2', () => {
        expect(runTs(['show', '--format', 'xml'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_analytics show [-h] [--window {24h,30d,7d}] [--event EVENT]
                                          [--role ROLE] [--format {markdown,csv,json}]
          workspace_analytics show: error: argument --format: invalid choice: 'xml' (choose from 'markdown', 'csv', 'json')
          ",
            "stdout": "",
          }
        `);
    });
    it('emit missing event → required, exit 2', () => {
        expect(runTs(['emit'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_analytics emit [-h] [--data K=V] event
          workspace_analytics emit: error: the following arguments are required: event
          ",
            "stdout": "",
          }
        `);
    });
    it('emit -h usage line', () => {
        const t = runTs(['emit', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`"usage: workspace_analytics emit [-h] [--data K=V] event"`);
    });
    it('show -h usage line', () => {
        const t = runTs(['show', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`
          "usage: workspace_analytics show [-h] [--window {24h,30d,7d}] [--event EVENT]
                                          [--role ROLE] [--format {markdown,csv,json}]"
        `);
    });
    it('prune -h usage line', () => {
        const t = runTs(['prune', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`"usage: workspace_analytics prune [-h]"`);
    });
    it('migrate -h usage line', () => {
        const t = runTs(['migrate', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`"usage: workspace_analytics migrate [-h]"`);
    });
    it('decrypt-all -h usage line', () => {
        const t = runTs(['decrypt-all', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`"usage: workspace_analytics decrypt-all [-h]"`);
    });
    it('rekey -h usage line', () => {
        const t = runTs(['rekey', '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchInlineSnapshot(`"usage: workspace_analytics rekey [-h]"`);
    });
});
