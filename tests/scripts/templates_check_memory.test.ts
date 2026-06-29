// Intent tests for src/agent-src/templates/scripts/check_memory.ts.
//
// Was a python3-vs-tsx byte-parity rig; the template `.py` is gone, so this now
// asserts the tsx template-script's own contract directly. This is the
// CONSUMER-shipped template twin — the leaner consumer surface (NO
// `--shadow-report`, NO priority / date-discipline / critical-stale /
// tier-0-inflation checks; those are dev-side-only). The scanned root is taken
// from `--path`, and `str(Path)` of relative roots is CWD-relative, so the
// process runs with `cwd` set to a tmp fixture tree and a relative
// `--path agents/memory`. To stay deterministic regardless of the runner's
// installed CLIs, the tsx launcher is spawned with a **node-only PATH** (a temp
// dir holding just a `node` symlink) and COLUMNS=200. Output is fully stable
// (no clock / tmp-path leakage in the cases below) so it is inline-snapshotted.
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
const TS_SCRIPT = join(DIR, 'check_memory.ts');

// node-only PATH → deterministic env (nothing but `node` resolves).
const NODE_ONLY_DIR = mkdtempSync(join(tmpdir(), 'tpl-cm-nodeonly-'));
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
    const found = lines.find((l) => /^check_memory: error:/.test(l));
    return found ?? stderr.trimEnd();
}

const REQUIRED = [
    'id: own-1',
    'status: active',
    'confidence: high',
    'source:',
    '  - ADR-1',
    'owner: team',
    'last_validated: 2026-01-01',
    'review_after_days: 180',
];

describe('templates/check_memory — intent', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'tpl-cm-'));
        mkdirSync(join(tmp, 'agents', 'memory', 'ownership'), { recursive: true });
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    function writeYml(rel: string, body: string): void {
        const full = join(tmp, 'agents', 'memory', rel);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, body);
    }

    it('missing path (info, exit 0)', () => {
        expect(runTs(['--path', 'agents/memory/nope'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "ℹ️  agents/memory/nope not found — nothing to validate
          ",
          }
        `);
    });

    it('missing path JSON', () => {
        expect(runTs(['--path', 'agents/memory/nope', '--format', 'json'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"findings": [], "note": "agents/memory/nope not found"}
          ",
          }
        `);
    });

    it('valid entries (clean)', () => {
        writeYml('domain-invariants/d.yml', `entries:\n  - ${REQUIRED.join('\n    ')}\n`);
        expect(runTs(['--path', 'agents/memory'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "
          Summary: 0 error(s), 0 warning(s), 0 info
          ",
          }
        `);
    });

    it('missing required fields (errors, sorted)', () => {
        writeYml('domain-invariants/bad.yml', 'entries:\n  - id: x\n    status: active\n');
        expect(runTs(['--path', 'agents/memory'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "",
            "stdout": "  ❌  agents/memory/domain-invariants/bad.yml [x]  missing required field: confidence
            ❌  agents/memory/domain-invariants/bad.yml [x]  missing required field: last_validated
            ❌  agents/memory/domain-invariants/bad.yml [x]  missing required field: owner
            ❌  agents/memory/domain-invariants/bad.yml [x]  missing required field: review_after_days
            ❌  agents/memory/domain-invariants/bad.yml [x]  missing required field: source
            ❌  agents/memory/domain-invariants/bad.yml [x]  source must be a list with ≥1 entry

          Summary: 6 error(s), 0 warning(s), 0 info
          ",
          }
        `);
    });

    it('redaction leak (inline credential + internal ip)', () => {
        writeYml(
            'incident-learnings/leak.yml',
            ['entries:', '  - id: y', '    note: "api_key=ABCDEFGH12345678"', '    host: 10.0.0.5'].join('\n') + '\n',
        );
        expect(runTs(['--path', 'agents/memory'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "",
            "stdout": "  ❌  agents/memory/incident-learnings/leak.yml:3  possible leak: inline credential
            ❌  agents/memory/incident-learnings/leak.yml:4  possible leak: internal ipv4 range
            ❌  agents/memory/incident-learnings/leak.yml [y]  missing required field: confidence
            ❌  agents/memory/incident-learnings/leak.yml [y]  missing required field: last_validated
            ❌  agents/memory/incident-learnings/leak.yml [y]  missing required field: owner
            ❌  agents/memory/incident-learnings/leak.yml [y]  missing required field: review_after_days
            ❌  agents/memory/incident-learnings/leak.yml [y]  missing required field: source
            ❌  agents/memory/incident-learnings/leak.yml [y]  missing required field: status
            ❌  agents/memory/incident-learnings/leak.yml [y]  source must be a list with ≥1 entry

          Summary: 9 error(s), 0 warning(s), 0 info
          ",
          }
        `);
    });

    it('unknown memory type (warning)', () => {
        writeYml('weird-type/w.yml', 'entries: []\n');
        expect(runTs(['--path', 'agents/memory'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "  ⚠️  agents/memory/weird-type/w.yml  unknown memory type 'weird-type'

          Summary: 0 error(s), 1 warning(s), 0 info
          ",
          }
        `);
    });

    it('duplicate id (error)', () => {
        writeYml(
            'product-rules/dup.yml',
            `entries:\n  - ${REQUIRED.join('\n    ')}\n  - ${REQUIRED.join('\n    ')}\n`,
        );
        expect(runTs(['--path', 'agents/memory'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "",
            "stdout": "  ❌  agents/memory/product-rules/dup.yml [own-1]  duplicate id 'own-1'

          Summary: 1 error(s), 0 warning(s), 0 info
          ",
          }
        `);
    });

    it('missing top-level entries (error)', () => {
        writeYml('architecture-decisions/noentries.yml', 'id: z\nfoo: bar\n');
        expect(runTs(['--path', 'agents/memory'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "",
            "stdout": "  ⚠️  agents/memory/architecture-decisions/noentries.yml  unknown memory type 'architecture-decisions'
            ❌  agents/memory/architecture-decisions/noentries.yml  missing top-level 'entries' key

          Summary: 1 error(s), 1 warning(s), 0 info
          ",
          }
        `);
    });

    it('stale entry (info)', () => {
        writeYml(
            'domain-invariants/stale.yml',
            [
                'entries:',
                '  - id: old-1',
                '    status: active',
                '    confidence: high',
                '    source:',
                '      - ADR-1',
                '    owner: team',
                '    last_validated: 2000-01-01',
                '    review_after_days: 1',
            ].join('\n') + '\n',
        );
        expect(runTs(['--path', 'agents/memory'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "  ℹ️  agents/memory/domain-invariants/stale.yml [old-1]  stale: last_validated 9676 days ago (limit 1)

          Summary: 0 error(s), 0 warning(s), 1 info
          ",
          }
        `);
    });

    it('JSON format over mixed findings', () => {
        writeYml('domain-invariants/bad.yml', 'entries:\n  - id: x\n    status: nope\n');
        expect(runTs(['--path', 'agents/memory', '--format', 'json'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "",
            "stdout": "{
            "findings": [
              {
                "file": "agents/memory/domain-invariants/bad.yml",
                "line": 0,
                "severity": "error",
                "message": "missing required field: confidence",
                "entry_id": "x"
              },
              {
                "file": "agents/memory/domain-invariants/bad.yml",
                "line": 0,
                "severity": "error",
                "message": "missing required field: last_validated",
                "entry_id": "x"
              },
              {
                "file": "agents/memory/domain-invariants/bad.yml",
                "line": 0,
                "severity": "error",
                "message": "missing required field: owner",
                "entry_id": "x"
              },
              {
                "file": "agents/memory/domain-invariants/bad.yml",
                "line": 0,
                "severity": "error",
                "message": "missing required field: review_after_days",
                "entry_id": "x"
              },
              {
                "file": "agents/memory/domain-invariants/bad.yml",
                "line": 0,
                "severity": "error",
                "message": "missing required field: source",
                "entry_id": "x"
              },
              {
                "file": "agents/memory/domain-invariants/bad.yml",
                "line": 0,
                "severity": "error",
                "message": "invalid status 'nope'",
                "entry_id": "x"
              },
              {
                "file": "agents/memory/domain-invariants/bad.yml",
                "line": 0,
                "severity": "error",
                "message": "source must be a list with \\u22651 entry",
                "entry_id": "x"
              }
            ]
          }
          ",
          }
        `);
    });

    it('unrecognized arg (exit 2)', () => {
        const ts = runTs(['--bogus'], tmp);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toMatchInlineSnapshot(`"check_memory: error: unrecognized arguments: --bogus"`);
    });

    it('invalid --format choice (exit 2)', () => {
        const ts = runTs(['--format', 'xml'], tmp);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toMatchInlineSnapshot(`"check_memory: error: argument --format: invalid choice: 'xml' (choose from 'text', 'json')"`);
    });
});
