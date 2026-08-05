/**
 * Tests for `src/scripts/lint_roadmap_family_cap.ts`.
 *
 * Paired fixtures, per the discipline the gated roadmap itself introduces: a
 * gate with no negative fixture cannot be shown to discriminate, and a gate
 * that only ever passes is decorative. So this suite proves all four states:
 *
 *   1. the REAL repo tree is at or under the cap (exit 0, denominator printed),
 *   2. an over-cap fixture FAILS (exit 1) and names every member,
 *   3. subdirectories are not counted — the same family members parked in
 *      `later/` / `archive/` do NOT trip the cap,
 *   4. a dead scan root FAILS rather than passing green (anti-vacuity).
 *
 * State 4 is the one that matters most here: this gate reports an absence, so
 * without the scan-scope assertion a moved or empty roadmap tree would print the
 * same green line as a healthy one.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_roadmap_family_cap.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const FAMILY = 'road-to-skill-ecosystem-';

function run(cwd: string, args: string[] = []) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

/** Minimal roadmap body — content shape is irrelevant to this gate. */
function writeRoadmap(dir: string, name: string): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, name),
        '---\ncomplexity: lightweight\n---\n\n# Fixture\n\n## Phase 1: x\n\n- [ ] **Step 1:** x\n',
        'utf8',
    );
}

describe('lint_roadmap_family_cap', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'family-cap-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('real repo: at or under the cap, and prints the scanned denominator', () => {
        const r = run(REPO_ROOT);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('lint-roadmap-family-cap:');
        // The denominator on the green path is the anti-vacuity affordance: a
        // reader must be able to see coverage without waiting for a failure.
        expect(r.stdout).toMatch(/scanned \d+ active roadmap file\(s\)/);
    });

    it('over the cap: exits 1 and names every family member', () => {
        const rm = path.join(tmp, 'agents', 'roadmaps');
        writeRoadmap(rm, `${FAMILY}alpha.md`);
        writeRoadmap(rm, `${FAMILY}beta.md`);
        writeRoadmap(rm, `${FAMILY}gamma.md`);
        writeRoadmap(rm, 'road-to-something-unrelated.md');

        const r = run(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('3 concurrently-open');
        expect(r.stdout).toContain(`${FAMILY}alpha.md`);
        expect(r.stdout).toContain(`${FAMILY}beta.md`);
        expect(r.stdout).toContain(`${FAMILY}gamma.md`);
        // An unrelated roadmap is scanned but must not be counted against the cap.
        expect(r.stdout).not.toContain('road-to-something-unrelated.md');
        // The remedy must be actionable, not a bare refusal.
        expect(r.stdout).toContain('free a slot first');
    });

    it('exactly at the cap: passes', () => {
        const rm = path.join(tmp, 'agents', 'roadmaps');
        writeRoadmap(rm, `${FAMILY}alpha.md`);
        writeRoadmap(rm, `${FAMILY}beta.md`);

        const r = run(tmp);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('2/2 slot(s) used');
    });

    it('parked and archived members are not concurrently open', () => {
        const rm = path.join(tmp, 'agents', 'roadmaps');
        writeRoadmap(rm, `${FAMILY}alpha.md`);
        writeRoadmap(rm, `${FAMILY}beta.md`);
        // Three more of the same family, but parked / archived. If the gate
        // walked subdirectories these would push the count to five and fail.
        writeRoadmap(path.join(rm, 'later'), `${FAMILY}gamma.md`);
        writeRoadmap(path.join(rm, 'later'), `${FAMILY}delta.md`);
        writeRoadmap(path.join(rm, 'archive'), `${FAMILY}epsilon.md`);

        const r = run(tmp);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('2/2 slot(s) used');
    });

    it('dead scan root: fails rather than passing green', () => {
        // An empty roadmap dir means the gate inspected nothing. Zero findings
        // and zero coverage must not look alike — that is the exact failure class
        // this gate's own roadmap exists to generalise.
        fs.mkdirSync(path.join(tmp, 'agents', 'roadmaps'), { recursive: true });

        const r = run(tmp);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('lint_roadmap_family_cap');
        expect(r.stdout).not.toContain('slot(s) used');
    });

    it('--quiet suppresses the green line but keeps the exit code', () => {
        const rm = path.join(tmp, 'agents', 'roadmaps');
        writeRoadmap(rm, `${FAMILY}alpha.md`);

        const r = run(tmp, ['--quiet']);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('');
    });
});
