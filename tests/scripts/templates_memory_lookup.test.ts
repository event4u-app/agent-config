// Intent tests for src/agent-src/templates/scripts/memory_lookup.ts.
//
// Was a python3-vs-tsx byte-parity rig; the template `.py` is gone, so this now
// asserts the tsx template-script's own contract directly. This is the
// CONSUMER-shipped template twin — retrieval is entirely file-backed (no
// external backend) and supports `knowledge` / `cross-repo` types.
// MEMORY_ROOT / INTAKE_ROOT are `agents/memory[/intake]` relative to CWD, so the
// process runs with `cwd` set to a tmp fixture tree. To stay deterministic
// regardless of the runner's installed CLIs, the tsx launcher is spawned with a
// **node-only PATH** (a temp dir holding just a `node` symlink) and COLUMNS=200.
// Output is fully stable (no clock / tmp-path leakage) so it is inline-snapshotted.
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
const TS_SCRIPT = join(DIR, 'memory_lookup.ts');

// node-only PATH → deterministic env (nothing but `node` resolves).
const NODE_ONLY_DIR = mkdtempSync(join(tmpdir(), 'tpl-ml-nodeonly-'));
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
    const found = lines.find((l) => /^memory_lookup: error:/.test(l));
    return found ?? stderr.trimEnd();
}

const CURATED_ENTRY = [
    '  - id: own-1',
    '    status: active',
    '    confidence: high',
    '    source:',
    '      - ADR-1',
    '    owner: team',
    '    last_validated: 2026-01-01',
    '    review_after_days: 180',
    '    path: "app/Http/Controllers/Billing"',
];

describe('templates/memory_lookup — intent', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'tpl-ml-'));
        mkdirSync(join(tmp, 'agents', 'memory', 'intake'), { recursive: true });
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    function writeMem(rel: string, body: string): void {
        const full = join(tmp, 'agents', 'memory', rel);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, body);
    }

    it('no memory tree → no hits (text)', () => {
        expect(runTs(['--types', 'ownership', '--key', 'billing'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "  (no hits)
          ",
          }
        `);
    });

    it('curated single-file layout (text)', () => {
        writeMem('ownership.yml', `entries:\n${CURATED_ENTRY.join('\n')}\n`);
        expect(runTs(['--types', 'ownership', '--key', 'Billing'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "  [curated] ownership  score=0.80  id=own-1  path=agents/memory/ownership.yml
          ",
          }
        `);
    });

    it('curated content-addressed layout (text)', () => {
        writeMem(
            'domain-invariants/abc123.yml',
            [
                'id: inv-1',
                'status: active',
                'path: "app/Domain/Money"',
                'rule: "amounts are integers"',
            ].join('\n') + '\n',
        );
        expect(runTs(['--types', 'domain-invariants', '--key', 'money'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "  [curated] domain-invariants  score=0.80  id=inv-1  path=agents/memory/domain-invariants/abc123.yml
          ",
          }
        `);
    });

    it('intake supersede-chain (json)', () => {
        const intake = join(tmp, 'agents', 'memory', 'intake', 'a.jsonl');
        writeFileSync(
            intake,
            [
                JSON.stringify({ id: 'k-1', entry_type: 'ownership', path: 'app/Old', body: 'old' }),
                JSON.stringify({ id: 'k-2', entry_type: 'ownership', path: 'app/Billing', body: 'billing owner' }),
                JSON.stringify({ type: 'supersede', supersedes: 'k-1' }),
            ].join('\n') + '\n',
        );
        expect(runTs(['--types', 'ownership', '--key', 'billing', '--format', 'json'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "hits": [
              {
                "id": "k-2",
                "type": "ownership",
                "source": "intake",
                "path": "agents/memory/intake/a.jsonl",
                "score": 0.7200000000000001,
                "entry": {
                  "id": "k-2",
                  "entry_type": "ownership",
                  "path": "app/Billing",
                  "body": "billing owner"
                }
              }
            ]
          }
          ",
          }
        `);
    });

    it('json format over curated + intake', () => {
        writeMem('ownership.yml', `entries:\n${CURATED_ENTRY.join('\n')}\n`);
        const intake = join(tmp, 'agents', 'memory', 'intake', 'b.jsonl');
        writeFileSync(
            intake,
            JSON.stringify({ id: 'k-9', entry_type: 'ownership', path: 'app/Http', body: 'b' }) + '\n',
        );
        expect(runTs(['--types', 'ownership', '--key', 'app/Http', '--format', 'json'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "hits": [
              {
                "id": "own-1",
                "type": "ownership",
                "source": "curated",
                "path": "agents/memory/ownership.yml",
                "score": 0.8,
                "entry": {
                  "id": "own-1",
                  "status": "active",
                  "confidence": "high",
                  "source": [
                    "ADR-1"
                  ],
                  "owner": "team",
                  "last_validated": "2026-01-01",
                  "review_after_days": 180,
                  "path": "app/Http/Controllers/Billing"
                }
              },
              {
                "id": "k-9",
                "type": "ownership",
                "source": "intake",
                "path": "agents/memory/intake/b.jsonl",
                "score": 0.7200000000000001,
                "entry": {
                  "id": "k-9",
                  "entry_type": "ownership",
                  "path": "app/Http",
                  "body": "b"
                }
              }
            ]
          }
          ",
          }
        `);
    });

    it('v1 envelope (known + unknown type)', () => {
        writeMem('ownership.yml', `entries:\n${CURATED_ENTRY.join('\n')}\n`);
        expect(runTs(['--types', 'ownership,bogus-type', '--key', 'billing', '--envelope', 'v1'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "contract_version": 1,
            "status": "partial",
            "entries": [
              {
                "id": "own-1",
                "type": "ownership",
                "source": "repo",
                "confidence": 0.8,
                "body": {
                  "id": "own-1",
                  "status": "active",
                  "confidence": "high",
                  "source": [
                    "ADR-1"
                  ],
                  "owner": "team",
                  "last_validated": "2026-01-01",
                  "review_after_days": 180,
                  "path": "app/Http/Controllers/Billing"
                }
              }
            ],
            "slices": {
              "ownership": {
                "status": "ok",
                "count": 1
              },
              "bogus-type": {
                "status": "unknown_type",
                "count": 0
              }
            },
            "errors": [
              {
                "type": "bogus-type",
                "code": "unknown_type",
                "message": "file-backed backend does not know type 'bogus-type'"
              }
            ]
          }
          ",
          }
        `);
    });

    it('limit clamps result count', () => {
        writeMem(
            'ownership.yml',
            'entries:\n' +
                [0, 1, 2, 3, 4]
                    .map((n) => `  - id: own-${n}\n    path: "app/Http/${n}"\n    status: active`)
                    .join('\n') +
                '\n',
        );
        expect(runTs(['--types', 'ownership', '--key', 'app/Http', '--limit', '2', '--format', 'json'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "hits": [
              {
                "id": "own-0",
                "type": "ownership",
                "source": "curated",
                "path": "agents/memory/ownership.yml",
                "score": 0.8,
                "entry": {
                  "id": "own-0",
                  "path": "app/Http/0",
                  "status": "active"
                }
              },
              {
                "id": "own-1",
                "type": "ownership",
                "source": "curated",
                "path": "agents/memory/ownership.yml",
                "score": 0.8,
                "entry": {
                  "id": "own-1",
                  "path": "app/Http/1",
                  "status": "active"
                }
              }
            ]
          }
          ",
          }
        `);
    });

    it('no hits text branch (empty key, no entries)', () => {
        expect(runTs(['--types', 'incident-learnings'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "  (no hits)
          ",
          }
        `);
    });

    it('missing --types (exit 2)', () => {
        const ts = runTs(['--key', 'x'], tmp);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toMatchInlineSnapshot(`"error: --types is required"`);
    });

    it('unrecognized arg (exit 2)', () => {
        const ts = runTs(['--bogus'], tmp);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toMatchInlineSnapshot(`"memory_lookup: error: unrecognized arguments: --bogus"`);
    });
});
