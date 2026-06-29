// Intent tests for src/agent-src/templates/scripts/check_memory_proposal.ts.
//
// Was a python3-vs-tsx byte-parity rig; the template `.py` is gone, so this now
// asserts the tsx template-script's own contract directly. This is the
// CONSUMER-shipped template twin — it differs from the dev-side only by lacking
// the `--quiet` flag, so the gate-passed line always prints. INTAKE_ROOT is
// `agents/memory/intake` relative to CWD, so the process runs with `cwd` set to
// a tmp fixture tree. To stay deterministic regardless of the runner's installed
// CLIs, the tsx launcher is spawned with a **node-only PATH** (a temp dir holding
// just a `node` symlink) and COLUMNS=200. All fixture references are CWD-relative
// (e.g. `--proposal p.yml`), so no absolute tmp path leaks into a snapshot.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN =
    process.env['TSX_BIN'] !== undefined
        ? resolve(REPO_ROOT, process.env['TSX_BIN'])
        : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(DIR, 'check_memory_proposal.ts');

// node-only PATH → deterministic env (nothing but `node` resolves).
const NODE_ONLY_DIR = mkdtempSync(join(tmpdir(), 'tpl-cmp-nodeonly-'));
symlinkSync(process.execPath, join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    rmSync(NODE_ONLY_DIR, { recursive: true, force: true });
});

interface Run {
    stdout: string;
    stderr: string;
    status: number;
}
function runTs(args: readonly string[], cwd: string): Run {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd,
        env: { ...process.env, PATH: NODE_ONLY_DIR, COLUMNS: '200' },
    });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 };
}
// Python argparse used a terminal-width-dependent `usage:` block; the stable
// contract is the trailing `<prog>: error: <msg>` line.
function errorLine(stderr: string): string {
    const lines = stderr.trimEnd().split('\n');
    const found = lines.find((l) => /^check_memory_proposal: error:/.test(l));
    return found ?? stderr.trimEnd();
}

describe('templates/check_memory_proposal — intent', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'tpl-cmp-'));
        mkdirSync(join(tmp, 'agents', 'memory', 'intake'), { recursive: true });
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    it('--proposal gate pass (line always prints — no --quiet)', () => {
        const p = join(tmp, 'p.yml');
        writeFileSync(
            p,
            [
                'id: sig-1',
                'entry_type: ownership',
                'path: app/Http',
                'body: x',
                'future_decisions:',
                '  - {decision: a, expected_by: 2026-01-01, owner: me}',
                '  - {decision: b, expected_by: 2026-01-02, owner: me}',
                '  - {decision: c, expected_by: 2026-01-03, owner: me}',
            ].join('\n') + '\n',
        );
        expect(runTs(['--proposal', 'p.yml'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "✅  p.yml — gate passed
          ",
          }
        `);
    });

    it('--proposal gate fail (missing fields + bad type + weak fds)', () => {
        const p = join(tmp, 'bad.yml');
        writeFileSync(p, ['id: x', 'entry_type: not-a-type', 'body: y'].join('\n') + '\n');
        expect(runTs(['--proposal', 'bad.yml'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "",
            "stdout": "❌  bad.yml — gate failed:
            🔴 missing field: \`path\`
            🔴 entry_type \`not-a-type\` not in ['domain-invariants', 'historical-patterns', 'incident-learnings', 'ownership', 'product-rules']
            🔴 weak pattern evidence (0 sibling path(s)) and future_decisions insufficient:
            🔴   - future_decisions: missing or not a list
          ",
          }
        `);
    });

    it('--proposal gate fail JSON', () => {
        const p = join(tmp, 'bad.yml');
        writeFileSync(p, ['id: x', 'entry_type: bogus'].join('\n') + '\n');
        expect(runTs(['--proposal', 'bad.yml', '--format', 'json'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "",
            "stdout": "{
            "source": "bad.yml",
            "failures": [
              "missing field: \`path\`",
              "missing field: \`body\`",
              "entry_type \`bogus\` not in ['domain-invariants', 'historical-patterns', 'incident-learnings', 'ownership', 'product-rules']",
              "weak pattern evidence (0 sibling path(s)) and future_decisions insufficient:",
              "  - future_decisions: missing or not a list"
            ]
          }
          ",
          }
        `);
    });

    it('--proposal non-mapping (exit 1)', () => {
        const p = join(tmp, 'list.yml');
        writeFileSync(p, '- a\n- b\n');
        const ts = runTs(['--proposal', 'list.yml'], tmp);
        expect(ts.status).toBe(1);
        expect(ts).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "error: list.yml is not a YAML mapping
          ",
            "stdout": "",
          }
        `);
    });

    it('--intake-id found (pattern via ≥2 sibling paths)', () => {
        const intake = join(tmp, 'agents', 'memory', 'intake', 'a.jsonl');
        writeFileSync(
            intake,
            [
                JSON.stringify({ id: 'i-1', entry_type: 'ownership', path: 'app/A', body: 'shared' }),
                JSON.stringify({ id: 'i-2', entry_type: 'ownership', path: 'app/B', body: 'shared' }),
            ].join('\n') + '\n',
        );
        expect(runTs(['--intake-id', 'i-1'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "✅  intake:i-1 — gate passed
          ",
          }
        `);
    });

    it('--intake-id not-found (exit 1)', () => {
        expect(runTs(['--intake-id', 'does-not-exist'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "error: no intake entry with id=does-not-exist
          ",
            "stdout": "",
          }
        `);
    });

    it('mutually-exclusive args (exit 2)', () => {
        const p = join(tmp, 'p.yml');
        writeFileSync(p, 'id: x\n');
        const ts = runTs(['--proposal', 'p.yml', '--intake-id', 'z'], tmp);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toMatchInlineSnapshot(`"check_memory_proposal: error: argument --intake-id: not allowed with argument --proposal"`);
    });

    it('no required group (exit 2)', () => {
        const ts = runTs([], tmp);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toMatchInlineSnapshot(`"check_memory_proposal: error: one of the arguments --intake-id --proposal is required"`);
    });
});
