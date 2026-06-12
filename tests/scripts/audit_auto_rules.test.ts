// Tests for src/scripts/audit_auto_rules.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite existed for audit_auto_rules.py, so this is a focused
// differential suite:
//   1. Unit checks of the pure helpers (_split_frontmatter, _trigger_summary,
//      render_markdown shape) driven in-process.
//   2. A golden-parity layer (python3 vs tsx) on the real repo: stdout,
//      stderr, exit code, and BOTH written artefacts (auto-rules-audit.json,
//      auto-rules-audit.md) are asserted byte-identical. The report files are
//      snapshotted and restored so the run leaves zero git drift. Skipped
//      without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _split_frontmatter, _trigger_summary } from '../../src/scripts/audit_auto_rules.js';
import { acquireGlobalStateLock } from './_global_state_lock.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_auto_rules.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_auto_rules.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const REPORT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
const JSON_OUT = path.join(REPORT_DIR, 'auto-rules-audit.json');
const MD_OUT = path.join(REPORT_DIR, 'auto-rules-audit.md');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function runTs(args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}
function runPy(args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

describe('audit_auto_rules — unit helpers', () => {
    it('_split_frontmatter splits a leading block', () => {
        const text = '---\ntype: auto\ndescription: hi\n---\n\nbody here\n';
        const [fm, body] = _split_frontmatter(text);
        expect(fm['type']).toBe('auto');
        expect(fm['description']).toBe('hi');
        expect(body).toBe('body here\n');
    });
    it('_split_frontmatter returns empty + full text when absent', () => {
        const [fm, body] = _split_frontmatter('no frontmatter here');
        expect(fm).toEqual({});
        expect(body).toBe('no frontmatter here');
    });
    it('_trigger_summary buckets path/keyword/intent', () => {
        const t = _trigger_summary([
            { path_prefix: 'src/' },
            { keyword: 'foo' },
            { intent: 'bar' },
            { keyword: 'baz' },
            'not-a-dict',
        ]);
        expect(t.path_prefixes).toEqual(['src/']);
        expect(t.keywords).toEqual(['foo', 'baz']);
        expect(t.intents).toEqual(['bar']);
    });
    it('_trigger_summary tolerates non-list input', () => {
        expect(_trigger_summary(null)).toEqual({ path_prefixes: [], keywords: [], intents: [] });
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('audit_auto_rules — golden parity (python3 vs tsx)', () => {
    let snapJson: string | null = null;
    let snapMd: string | null = null;
    let release: (() => void) | null = null;
    beforeEach(() => {
        release = acquireGlobalStateLock();
        snapJson = fs.existsSync(JSON_OUT) ? fs.readFileSync(JSON_OUT, 'utf-8') : null;
        snapMd = fs.existsSync(MD_OUT) ? fs.readFileSync(MD_OUT, 'utf-8') : null;
    });
    afterEach(() => {
        // Restore the report artefacts so the test leaves zero git drift.
        if (snapJson !== null) {
            fs.writeFileSync(JSON_OUT, snapJson, 'utf-8');
        } else if (fs.existsSync(JSON_OUT)) {
            fs.rmSync(JSON_OUT);
        }
        if (snapMd !== null) {
            fs.writeFileSync(MD_OUT, snapMd, 'utf-8');
        } else if (fs.existsSync(MD_OUT)) {
            fs.rmSync(MD_OUT);
        }
        if (release) {
            release();
            release = null;
        }
    });

    it('stdout + exit + JSON + MD byte-identical on the real repo', () => {
        const p = runPy([]);
        const pJson = fs.readFileSync(JSON_OUT, 'utf-8');
        const pMd = fs.readFileSync(MD_OUT, 'utf-8');
        const t = runTs([]);
        const tJson = fs.readFileSync(JSON_OUT, 'utf-8');
        const tMd = fs.readFileSync(MD_OUT, 'utf-8');
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
        expect(t.status).toBe(0);
        expect(tJson).toBe(pJson);
        expect(tMd).toBe(pMd);
    });
});
