/**
 * Agent-artifact location guard.
 *
 * The gate's own `--self-test` drives the real CLI over throwaway trees and is
 * the surface CI exercises. These cases cover what the CLI cannot reach: the
 * SHAPE predicate in isolation, where the interesting behaviour is which
 * combinations of signals do NOT count. A detector that fires on frontmatter
 * alone would pass every CLI case in the self-test and still report hundreds of
 * legitimate documents on a real tree, because `is_roadmap_candidate` accepts
 * nearly every `.md` filename by design — it answers "eligible inside the
 * roadmap root", not "is a roadmap".
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import {
    ROADMAP_ROOT_REL,
    roadmapShape,
    scan,
} from '../../src/scripts/check_agent_artifact_location.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const tmps: string[] = [];

const FM = '---\ncomplexity: lightweight\nstatus: ready\n---\n';
const PHASE = '\n## Phase 1 - a phase\n';
const STEP = '\n- [ ] **1.1 A step.**\n';

function tree(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'artloc-t-'));
    tmps.push(dir);
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(dir, ...rel.split('/'));
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }
    return dir;
}

afterAll(() => {
    for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
});

describe('roadmapShape — all three signals, or it is not a roadmap', () => {
    it('accepts frontmatter + phase + checkbox', () => {
        const s = roadmapShape(FM + '# t' + PHASE + STEP);
        expect(s.isRoadmap).toBe(true);
        expect(s.signals).toHaveLength(3);
    });

    // Each of these is a document class that really exists in this tree, and
    // each would be a false positive under a looser detector.
    it('rejects frontmatter alone — most docs have frontmatter', () => {
        expect(roadmapShape(FM + '# just a doc\n').isRoadmap).toBe(false);
    });

    it('rejects a phase heading alone', () => {
        expect(roadmapShape('# a plan' + PHASE).isRoadmap).toBe(false);
    });

    it('rejects checkboxes alone — a design doc can carry a todo list', () => {
        expect(roadmapShape('# a design doc' + STEP).isRoadmap).toBe(false);
    });

    it('rejects frontmatter + checkbox with no phase heading', () => {
        expect(roadmapShape(FM + '# a doc' + STEP).isRoadmap).toBe(false);
    });

    it('rejects frontmatter whose complexity is not the roadmap vocabulary', () => {
        const s = roadmapShape('---\ncomplexity: trivial\n---\n# t' + PHASE + STEP);
        expect(s.isRoadmap).toBe(false);
        expect(s.signals).not.toContain(
            'roadmap frontmatter (`complexity:` lightweight|structural)',
        );
    });

    it('names the signals that fired, so a false positive is arguable', () => {
        const s = roadmapShape(FM + '# t' + PHASE);
        expect(s.signals).toContain('a `## Phase` heading');
        expect(s.signals).not.toContain('at least one checkbox step');
    });
});

describe('scan — both polarities over a real directory tree', () => {
    const body = FM + '# Road to a fixture' + PHASE + STEP;

    it('reports a roadmap-shaped file under docs/roadmaps/', () => {
        const r = scan(tree({ 'docs/roadmaps/road-to-x.md': body }));
        expect(r.findings.map((f) => f.rel)).toEqual(['docs/roadmaps/road-to-x.md']);
        expect(r.findings[0]?.signals).toHaveLength(3);
    });

    it('does NOT report the byte-identical file inside the roadmap root', () => {
        const r = scan(tree({ [`${ROADMAP_ROOT_REL}/road-to-x.md`]: body }));
        expect(r.findings).toEqual([]);
    });

    it('does NOT report a nested roadmap-root subdirectory', () => {
        const r = scan(tree({ [`${ROADMAP_ROOT_REL}/later/road-to-x.md`]: body }));
        expect(r.findings).toEqual([]);
    });

    it('reports one at the tree root', () => {
        expect(scan(tree({ 'road-to-x.md': body })).findings).toHaveLength(1);
    });

    it('does not descend into generated projection trees', () => {
        const r = scan(
            tree({
                'dist/agent-src/road-to-x.md': body,
                '.claude/road-to-x.md': body,
                'node_modules/pkg/road-to-x.md': body,
            }),
        );
        expect(r.findings).toEqual([]);
    });

    it('counts every markdown file it visits, not the matches', () => {
        const r = scan(
            tree({
                'docs/a.md': '# a\n',
                'docs/b.md': '# b\n',
                [`${ROADMAP_ROOT_REL}/road-to-x.md`]: body,
            }),
        );
        expect(r.findings).toEqual([]);
        // Zero matches is the clean state; only the unfiltered walk separates
        // "nothing misplaced" from "nothing read".
        expect(r.scanned).toBe(3);
    });

    it('leaves this repository clean', () => {
        const r = scan(REPO_ROOT);
        expect(r.findings).toEqual([]);
        expect(r.scanned).toBeGreaterThan(3000);
    });
});
