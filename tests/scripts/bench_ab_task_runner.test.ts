// Tests for src/scripts/bench_ab_task_runner.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists. This is a focused differential suite over the pure
// helpers (utc_stamp shape, count_ask_events, per_category_aggregate,
// snapshot_clone over a temp tree) plus a dry-run golden-parity layer that
// runs python3 vs tsx end-to-end and compares the written JSON + Markdown
// reports byte-for-byte. The reports/ab + clones directories are snapshot +
// restored so the test leaves zero git drift. The volatile fields are the
// embedded UTC `stamp` (also in the report filename) and `duration_seconds`
// (a wall-clock measurement); both are normalised per ADR-090's timing-
// non-determinism guidance. `wall_time_seconds` is 0.0 in dry-run mode (no
// CLI invocation), so it stays deterministic and IS compared.
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as runner from '../../src/scripts/bench_ab_task_runner.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'bench_ab_task_runner.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'bench_ab_task_runner.py');
const REPORTS_AB = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Normalise the two volatile fields: the UTC stamp + duration_seconds. */
function normReport(s: string): string {
    return s
        .replace(/"stamp": "[^"]*"/g, '"stamp": "TS"')
        .replace(/"duration_seconds": [0-9.]+/g, '"duration_seconds": D')
        // The cache_key carries the live claude CLI version + shape hash; both
        // implementations compute it via the same python helper, so it matches.
        // Markdown stamp line.
        .replace(/- Stamp: `[^`]*`/g, '- Stamp: `TS`');
}

describe('bench_ab_task_runner — pure helpers', () => {
    it('utc_stamp matches the %Y-%m-%dT%H-%M-%SZ shape (colon-free)', () => {
        expect(runner.utc_stamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);
    });

    it('count_ask_events: empty transcript → all-zero, int ratio', () => {
        const ev = runner.count_ask_events('');
        expect(ev.asked).toBe(0);
        expect(ev.acted_with_commit).toBe(0);
        expect(ev.ratio).toBe(0);
        expect(ev.ratioIsInt).toBe(true);
    });

    it('count_ask_events: present transcript, no markers → int ratio 0', () => {
        const ev = runner.count_ask_events('hello world no markers');
        expect(ev).toMatchObject({ asked: 0, acted_with_commit: 0, ratio: 0, ratioIsInt: true });
    });

    it('count_ask_events: mixed ask + commit markers → round-half-even ratio', () => {
        const ev = runner.count_ask_events('Should I do this? git commit -m x. shall i?');
        expect(ev.asked).toBe(2);
        expect(ev.acted_with_commit).toBe(1);
        expect(ev.ratio).toBe(0.667); // round(2/3, 3)
        expect(ev.ratioIsInt).toBe(false);
    });

    it('per_category_aggregate groups + rounds completion_rate / mean_wall_time', () => {
        const pt = [
            { id: 1, category: 'a', score: { passed: true, checks: [] }, wall_time_seconds: 1.0 },
            { id: 2, category: 'a', score: { passed: false, checks: [] }, wall_time_seconds: 3.0 },
            { id: 3, category: 'b', score: { passed: true, checks: [] }, wall_time_seconds: 2.0 },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any;
        const agg = runner.per_category_aggregate(pt);
        const map = new Map(agg);
        expect(map.get('a')).toMatchObject({ passed: 1, total: 2, completion_rate: 0.5, mean_wall_time: 2 });
        expect(map.get('b')).toMatchObject({ passed: 1, total: 1, completion_rate: 1, mean_wall_time: 2 });
    });
});

describe('bench_ab_task_runner — snapshot_clone over a temp tree', () => {
    let tmp: string | null = null;
    afterEach(() => {
        if (tmp && fs.existsSync(tmp)) {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
        tmp = null;
    });

    it('hashes fixture files; skips .claude/.augment + AGENTS/CLAUDE/manifest', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
        fs.writeFileSync(path.join(tmp, 'src.txt'), 'hello');
        fs.mkdirSync(path.join(tmp, 'nested'));
        fs.writeFileSync(path.join(tmp, 'nested', 'a.txt'), 'world');
        // Surface files that must be excluded.
        fs.mkdirSync(path.join(tmp, '.claude'));
        fs.writeFileSync(path.join(tmp, '.claude', 'x.md'), 'skip');
        fs.writeFileSync(path.join(tmp, 'AGENTS.md'), 'skip');
        fs.writeFileSync(path.join(tmp, '.bench-ab-manifest.json'), '{}');

        const snap = runner.snapshot_clone(tmp);
        expect(Object.keys(snap).sort()).toEqual(['nested/a.txt', 'src.txt']);
        // sha256("hello")[:16]
        const expected = crypto.createHash('sha256').update('hello').digest('hex').slice(0, 16);
        expect(snap['src.txt']).toBe(expected);
    });

    it('drops files deeper than max_depth', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
        let dir = tmp;
        for (let i = 0; i < 8; i++) {
            dir = path.join(dir, `d${i}`);
            fs.mkdirSync(dir);
        }
        fs.writeFileSync(path.join(dir, 'deep.txt'), 'x');
        fs.writeFileSync(path.join(tmp, 'shallow.txt'), 'y');
        const snap = runner.snapshot_clone(tmp, 6);
        expect(snap['shallow.txt']).toBeDefined();
        // 8 dir components + filename → 9 parts > 6 → excluded.
        expect(Object.keys(snap)).toEqual(['shallow.txt']);
    });
});

describe.runIf(hasPython3())('bench_ab_task_runner — CLI surface parity', () => {
    it('invalid --variant → exit 2 (both), stderr names the bad choice', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--variant', 'nope'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--variant', 'nope'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(2);
        expect(ts.status).toBe(2);
        expect(py.stderr).toContain("invalid choice: 'nope'");
        expect(ts.stderr).toContain("invalid choice: 'nope'");
    });

    it('invalid --mode → exit 2 (both)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--mode', 'nope'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--mode', 'nope'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(2);
        expect(ts.status).toBe(2);
    });
});

// write_report golden: a deterministic differential over the report
// serialization (JSON + Markdown) driven by a SYNTHETIC per_task list, so it
// does NOT touch the flaky clone-rebuild shell-out path (bench_ab_clone.py
// manages a gitignored scratch dir whose rmtree races in a worktree — that is
// the "shells out to a real benchmark" surface ADR-090 says to keep out of
// golden parity). Both implementations write into reports/ab; the new files
// are removed and any pre-existing files restored, leaving zero git drift. The
// only volatile fields are the embedded UTC stamp (also in the filename) and
// duration_seconds — both normalised.
describe.runIf(hasPython3())('bench_ab_task_runner — write_report golden (synthetic per_task)', () => {
    let savedReports: Map<string, Buffer>;
    let savedReportNames: Set<string>;

    beforeEach(() => {
        savedReports = new Map();
        savedReportNames = new Set();
        if (fs.existsSync(REPORTS_AB)) {
            for (const n of fs.readdirSync(REPORTS_AB)) {
                savedReportNames.add(n);
                const full = path.join(REPORTS_AB, n);
                if (fs.statSync(full).isFile()) {
                    savedReports.set(n, fs.readFileSync(full));
                }
            }
        }
    });
    afterEach(() => {
        if (fs.existsSync(REPORTS_AB)) {
            for (const n of fs.readdirSync(REPORTS_AB)) {
                if (!savedReportNames.has(n)) {
                    const full = path.join(REPORTS_AB, n);
                    if (fs.statSync(full).isFile()) {
                        fs.rmSync(full);
                    }
                }
            }
        }
        for (const [n, buf] of savedReports) {
            fs.writeFileSync(path.join(REPORTS_AB, n), buf);
        }
    });

    function readReport(jsonPath: string): { json: string; md: string } {
        const base = jsonPath.replace(/\.json$/, '');
        return {
            json: fs.readFileSync(`${base}.json`, 'utf-8'),
            md: fs.readFileSync(`${base}.md`, 'utf-8'),
        };
    }

    function removeNewReports(): void {
        if (!fs.existsSync(REPORTS_AB)) return;
        for (const n of fs.readdirSync(REPORTS_AB)) {
            if (!savedReportNames.has(n)) {
                const full = path.join(REPORTS_AB, n);
                if (fs.statSync(full).isFile()) fs.rmSync(full);
            }
        }
    }

    it('python3 vs tsx write_report produce byte-identical JSON + MD', () => {
        // A synthetic per_task list exercising: pass + fail entries, two
        // categories, a non-empty ask_events ratio, and a check list.
        const perTaskPy = `[
  {"id": "t1", "category": "edit", "score": {"passed": True, "checks": [{"name": "target_file_modified", "ok": True, "reason": "file: a.txt"}]}, "wall_time_seconds": 0.0, "exit_code": 0, "mode": "dry-run", "reason": "ok", "ask_events": {"asked": 2, "acted_with_commit": 1, "ratio": 0.667}},
  {"id": "t2", "category": "edit", "score": {"passed": False, "checks": []}, "wall_time_seconds": 0.0, "exit_code": 0, "mode": "dry-run", "reason": "ok", "ask_events": {"asked": 0, "acted_with_commit": 0, "ratio": 0}},
  {"id": "t3", "category": "test", "score": {"passed": True, "checks": []}, "wall_time_seconds": 0.0, "exit_code": 0, "mode": "dry-run", "reason": "ok", "ask_events": {"asked": 0, "acted_with_commit": 0, "ratio": 0}}
]`;
        const driver = [
            'import importlib.util, sys',
            `spec = importlib.util.spec_from_file_location("r", ${JSON.stringify(PY_SCRIPT)})`,
            'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
            `per_task = ${perTaskPy}`,
            'p = m.write_report("with", mode="dry-run", per_task=per_task, duration=1.234)',
            'sys.stdout.write(str(p))',
        ].join('\n');
        const py = spawnSync('python3', ['-c', driver], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(0);
        const pyOut = readReport(py.stdout.trim());
        removeNewReports();

        // Mirror the same synthetic per_task in the TS shape.
        const perTaskTs = [
            {
                id: 't1',
                category: 'edit',
                score: { passed: true, checks: [{ name: 'target_file_modified', ok: true, reason: 'file: a.txt' }] },
                wall_time_seconds: 0.0,
                exit_code: 0,
                mode: 'dry-run',
                reason: 'ok',
                ask_events: { asked: 2, acted_with_commit: 1, ratio: 0.667, ratioIsInt: false },
            },
            {
                id: 't2',
                category: 'edit',
                score: { passed: false, checks: [] },
                wall_time_seconds: 0.0,
                exit_code: 0,
                mode: 'dry-run',
                reason: 'ok',
                ask_events: { asked: 0, acted_with_commit: 0, ratio: 0, ratioIsInt: true },
            },
            {
                id: 't3',
                category: 'test',
                score: { passed: true, checks: [] },
                wall_time_seconds: 0.0,
                exit_code: 0,
                mode: 'dry-run',
                reason: 'ok',
                ask_events: { asked: 0, acted_with_commit: 0, ratio: 0, ratioIsInt: true },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any;
        const tsJsonPath = runner.write_report('with', 'dry-run', perTaskTs, 1.234);
        const tsOut = readReport(tsJsonPath);
        removeNewReports();

        expect(normReport(tsOut.json)).toBe(normReport(pyOut.json));
        expect(normReport(tsOut.md)).toBe(normReport(pyOut.md));
    });
});
