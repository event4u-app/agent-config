// Intent tests for src/agent-src/templates/scripts/memory_hash.ts.
//
// Was a python3-vs-tsx byte-parity rig; the template `.py` is gone, so this now
// asserts the tsx template-script's own contract directly. This is the
// CONSUMER-shipped template twin (its template `.py` was byte-identical to the
// dev-side `src/scripts/memory_hash.py`). The script is a pure stdin/file ->
// canonical-hash transform with no clock / random / host-CLI dependency, so its
// output is fully deterministic. Each case is inline-snapshotted. (Inline
// snapshots can't be written per-iteration inside `it.each`, so the former
// json-stdin parametrization is unrolled into one `it` per fixture.)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN =
    process.env['TSX_BIN'] !== undefined
        ? resolve(REPO_ROOT, process.env['TSX_BIN'])
        : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(DIR, 'memory_hash.ts');

interface Run {
    stdout: string;
    stderr: string;
    status: number;
}
function runTs(args: readonly string[], input?: string): Run {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        ...(input !== undefined ? { input } : {}),
    });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 };
}
// Python argparse used a terminal-width-dependent `usage:` block; the stable
// contract is the trailing `<prog>: error: <msg>` line.
function errorLine(stderr: string): string {
    const lines = stderr.trimEnd().split('\n');
    const found = lines.find((l) => /^memory_hash: error:/.test(l));
    return found ?? stderr.trimEnd();
}

describe('templates/memory_hash — intent', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'tpl-memhash-'));
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    it('--json-stdin: simple object with tags', () => {
        const input = JSON.stringify({ id: 'x', body: 'b', tags: ['z', 'a'] });
        expect(runTs(['--json-stdin'], input)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "dbbf67c86322
          ",
          }
        `);
    });

    it('--json-stdin: nested + unicode keys', () => {
        const input = JSON.stringify({ id: 'café ☕', nested: { z: 1, a: 2 }, list: [3, 2, 1] });
        expect(runTs(['--json-stdin'], input)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "5de6f31b72ed
          ",
          }
        `);
    });

    it('--json-stdin: top-level array', () => {
        const input = JSON.stringify(['a', 'b', { k: 'v' }]);
        expect(runTs(['--json-stdin'], input)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "59ad89063886
          ",
          }
        `);
    });

    it('--json-stdin: scalar mix (bool/null/num/float)', () => {
        const input = JSON.stringify({ bool: true, none: null, num: 42, flt: 3.14 });
        expect(runTs(['--json-stdin'], input)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "d00deb460a0a
          ",
          }
        `);
    });

    it('--json-stdin: unicode + emoji values', () => {
        const input = JSON.stringify({ unicode: 'naïve — résumé', emoji: '🎯' });
        expect(runTs(['--json-stdin'], input)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "5c29887aa641
          ",
          }
        `);
    });

    it('--json-stdin scalar error (exit 1)', () => {
        const ts = runTs(['--json-stdin'], '"justastring"');
        expect(ts.status).toBe(1);
        expect(ts).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "error: expected object/array, got str
          ",
            "stdout": "",
          }
        `);
    });

    it('--yaml date scalar', () => {
        const p = join(tmp, 'entry.yml');
        writeFileSync(
            p,
            ['id: own-01', 'status: active', 'last_validated: 2026-01-01', 'review_after_days: 180', 'path: "app/Http/**"'].join('\n') + '\n',
        );
        const ts = runTs(['--yaml', p]);
        expect({ stdout: ts.stdout, status: ts.status }).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stdout": "a224605f1eb0
          ",
          }
        `);
    });

    it('--yaml datetime scalar', () => {
        const p = join(tmp, 'dt.yml');
        writeFileSync(p, 'id: y\nts: 2026-01-01T13:45:30Z\n');
        const ts = runTs(['--yaml', p]);
        expect({ stdout: ts.stdout, status: ts.status }).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stdout": "fc33f764a48c
          ",
          }
        `);
    });

    it('mutually-exclusive args (exit 2)', () => {
        const p = join(tmp, 'm.yml');
        writeFileSync(p, 'id: x\n');
        const ts = runTs(['--yaml', p, '--json-stdin']);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toMatchInlineSnapshot(`"memory_hash: error: argument --json-stdin: not allowed with argument --yaml"`);
    });

    it('no-arg required-group (exit 2)', () => {
        const ts = runTs([]);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toMatchInlineSnapshot(`"memory_hash: error: one of the arguments --yaml --json-stdin is required"`);
    });
});
