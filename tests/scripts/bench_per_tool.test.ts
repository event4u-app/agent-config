// Tests for src/scripts/bench_per_tool.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure pieces (load_descriptions, render_markdown shape) plus a golden-parity
// layer that runs python3 vs tsx and compares stdout + stderr + exit code,
// normalising only the embedded UTC `generated_at` timestamp (the single
// volatile field). The `--write-report` path is exercised with snapshot +
// restore of internal/bench/reports/ so the test leaves zero git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as bpt from '../../src/scripts/bench_per_tool.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'bench_per_tool.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'bench_per_tool.py');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Normalise the embedded UTC timestamp (the only volatile output value). */
function normTs(s: string): string {
    return s
        .replace(/"generated_at": "[^"]*"/g, '"generated_at": "TS"')
        .replace(/_Generated [0-9TZ:-]+ /g, '_Generated TS ')
        .replace(/reports\/[0-9TZ:-]+-/g, 'reports/TS-');
}

describe('bench_per_tool — pure helpers', () => {
    it('load_descriptions returns an empty map for a missing dir', () => {
        const m = bpt.load_descriptions(path.join(REPO_ROOT, 'no', 'such', 'dir'));
        expect(m.size).toBe(0);
    });

    // .augment/skills is a gitignored generated projection (symlink → dist);
    // present after `task sync` but absent in a bare CI checkout. Skip when
    // absent (the empty-dir contract is covered by the test above).
    it.skipIf(!fs.existsSync(path.join(REPO_ROOT, '.augment', 'skills')))('load_descriptions reads name + description from .augment/skills', () => {
        const m = bpt.load_descriptions(path.join(REPO_ROOT, '.augment', 'skills'));
        expect(m.size).toBeGreaterThan(0);
        // Each value is "name description" (name prefixed).
        for (const [name, blob] of m) {
            expect(blob.startsWith(`${name} `)).toBe(true);
        }
    });

    it('render_markdown carries the header + threshold + reference', () => {
        const summary = bpt.evaluate(
            path.join(REPO_ROOT, 'tests', 'eval', 'corpus-dev.yaml'),
            3,
            0.85,
        );
        const md = bpt.render_markdown(summary);
        expect(md).toContain('# Projection fidelity — ');
        expect(md).toContain('threshold=0.85');
        expect(md).toContain('reference=`augment`');
        expect(md).toContain('| tool | status | skills | accuracy | fidelity | pass |');
    });
});

describe.runIf(hasPython3())('bench_per_tool — golden parity (python3 vs tsx)', () => {
    const cases: string[][] = [
        ['--corpus', 'dev', '--json'],
        ['--corpus', 'dev'],
        ['--corpus', 'dev', '--threshold', '0.9', '--json'],
        ['--corpus', 'dev', '--top-k', '1'],
        ['--corpus', 'does-not-exist'],
    ];
    for (const args of cases) {
        it(`stdout + stderr + exit match for: ${args.join(' ')}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            expect(ts.status).toBe(py.status);
            expect(normTs(ts.stdout)).toBe(normTs(py.stdout));
            expect(normTs(ts.stderr)).toBe(normTs(py.stderr));
        });
    }
});

describe.runIf(hasPython3())('bench_per_tool — --write-report parity (snapshot + restore)', () => {
    let preexisting: Set<string>;

    beforeEach(() => {
        preexisting = new Set(fs.existsSync(REPORTS_DIR) ? fs.readdirSync(REPORTS_DIR) : []);
    });
    afterEach(() => {
        // Remove only projection files this test created; leave the rest intact.
        if (!fs.existsSync(REPORTS_DIR)) {
            return;
        }
        for (const name of fs.readdirSync(REPORTS_DIR)) {
            if (!preexisting.has(name) && name.includes('-projection.')) {
                fs.rmSync(path.join(REPORTS_DIR, name));
            }
        }
    });

    function latestProjection(): { json: string; md: string } {
        const names = fs
            .readdirSync(REPORTS_DIR)
            .filter((n) => n.endsWith('-dev-projection.json'))
            .sort();
        const jsonName = names[names.length - 1]!;
        const base = jsonName.replace(/\.json$/, '');
        return {
            json: fs.readFileSync(path.join(REPORTS_DIR, `${base}.json`), 'utf-8'),
            md: fs.readFileSync(path.join(REPORTS_DIR, `${base}.md`), 'utf-8'),
        };
    }

    it('writes byte-identical JSON + MD reports + stderr', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--corpus', 'dev', '--write-report'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const pyOut = latestProjection();
        // Clean up py's files before the ts run so latestProjection picks ts's.
        for (const name of fs.readdirSync(REPORTS_DIR)) {
            if (!preexisting.has(name) && name.includes('-projection.')) {
                fs.rmSync(path.join(REPORTS_DIR, name));
            }
        }
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--corpus', 'dev', '--write-report'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const tsOut = latestProjection();
        expect(ts.status).toBe(py.status);
        expect(normTs(ts.stderr)).toBe(normTs(py.stderr));
        expect(normTs(tsOut.json)).toBe(normTs(pyOut.json));
        expect(normTs(tsOut.md)).toBe(normTs(pyOut.md));
    });
});
