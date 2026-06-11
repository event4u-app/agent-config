// Tests for src/scripts/check_roadmap_trackable.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused spec over the replicated dashboard
// helpers (parse_frontmatter / is_draft / is_roadmap_candidate) and
// violations_for, plus golden parity (python3 vs tsx) on the REAL REPO.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as crt from '../../src/scripts/check_roadmap_trackable.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_roadmap_trackable.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_roadmap_trackable.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_roadmap_trackable — replicated dashboard helpers', () => {
    it('parse_frontmatter reads flat string flags', () => {
        const fm = crt.parse_frontmatter('---\nstatus: draft\nmode: "x"\n---\nbody\n');
        expect(fm.get('status')).toBe('draft');
        expect(fm.get('mode')).toBe('x');
    });

    it('parse_frontmatter empty when no frontmatter', () => {
        expect(crt.parse_frontmatter('# Heading\n').size).toBe(0);
    });

    it('is_draft true only for status: draft', () => {
        expect(crt.is_draft(new Map([['status', 'draft']]))).toBe(true);
        expect(crt.is_draft(new Map([['status', 'ready']]))).toBe(false);
        expect(crt.is_draft(new Map())).toBe(false);
    });

    it('is_roadmap_candidate excludes template/README/archive/skipped', () => {
        expect(crt.is_roadmap_candidate('agents/roadmaps/road-to-x.md')).toBe(true);
        expect(crt.is_roadmap_candidate('agents/roadmaps/template.md')).toBe(false);
        expect(crt.is_roadmap_candidate('agents/roadmaps/README.md')).toBe(false);
        expect(crt.is_roadmap_candidate('agents/roadmaps/archive/done.md')).toBe(false);
        expect(crt.is_roadmap_candidate('agents/roadmaps/skipped/dead.md')).toBe(false);
        expect(crt.is_roadmap_candidate('agents/roadmaps/open-questions-x.md')).toBe(false);
    });

    it('violations_for: phase with no checkbox is flagged', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-'));
        try {
            const p = path.join(tmp, 'road-to-x.md');
            fs.writeFileSync(p, '# Roadmap\n\n## Phase 1 — Setup\n\nNo checkboxes here.\n');
            const v = crt.violations_for(p);
            expect(v).toHaveLength(1);
            expect(v[0]).toContain('Phase 1');
            expect(v[0]).toContain('zero');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('violations_for: no Phase heading is flagged', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-'));
        try {
            const p = path.join(tmp, 'road-to-y.md');
            fs.writeFileSync(p, '# Roadmap\n\nNot trackable.\n- [ ] orphan item\n');
            const v = crt.violations_for(p);
            expect(v).toHaveLength(1);
            expect(v[0]).toContain('PHASE_RE');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('violations_for: clean phase with a checkbox passes', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-'));
        try {
            const p = path.join(tmp, 'road-to-z.md');
            fs.writeFileSync(p, '# Roadmap\n\n## Phase 1 — Setup\n\n- [ ] do the thing\n');
            expect(crt.violations_for(p)).toEqual([]);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

const py3 = hasPython3();

// check_roadmap_trackable.py does `sys.path.insert(.augment/scripts)` then
// `from update_roadmap_progress import …` — a GENERATED projection that only
// exists after `task sync`. The TS twin inlined that logic, so it runs
// standalone; the Python original ImportError-crashes when .augment/ is absent
// (e.g. the migration-gate job, which runs npm ci only — no `task sync`).
// Golden parity can't compare against a crashing Python, so gate the suite on
// the Python dependency being present (it is, in jobs that run `task sync`).
const PY_AUGMENT_DEP = path.join(REPO_ROOT, '.augment', 'scripts', 'update_roadmap_progress.py');
const pyRunnable = py3 && fs.existsSync(PY_AUGMENT_DEP);

describe.skipIf(!pyRunnable)('check_roadmap_trackable — golden parity (python3 vs tsx)', () => {
    function expectMatch(args: readonly string[]) {
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default matches byte-for-byte', () => {
        expectMatch([]);
    });

    it('--quiet matches byte-for-byte', () => {
        expectMatch(['--quiet']);
    });
});
