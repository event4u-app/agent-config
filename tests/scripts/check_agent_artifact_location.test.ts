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
    isReviewInputRoadmapSnapshot,
    roadmapShape,
    scan,
} from '../../src/scripts/check_agent_artifact_location.js';
import { REVIEW_INPUT_ROADMAP_HEADER } from '../../src/scripts/dispatch_r2_reviewer.js';

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

describe('review-input snapshot convention — exempt by declared path, not by a header accident', () => {
    // road-to-authority-routing-mechanism 5.2. The R2 review-input roadmap
    // snapshots used to escape this gate only because their two-line header,
    // written for check_references, pushed the frontmatter fence off offset 0.
    // The exemption is now a named path predicate; these cases pin that the
    // PATH decides, in both directions, and that the header no longer does.
    const snapshotBody = FM + '# Road to a fixture' + PHASE + STEP;
    const SNAP = 'agents/evidence/reviews/x.review-input/roadmap.md';

    it('the canonical snapshot path is exempt even WITHOUT the header', () => {
        expect(scan(tree({ [SNAP]: snapshotBody })).findings).toEqual([]);
        expect(scan(tree({ [SNAP]: REVIEW_INPUT_ROADMAP_HEADER + snapshotBody })).findings).toEqual([]);
    });

    it.each([
        ['outside agents/evidence/', 'docs/x.review-input/roadmap.md'],
        ['a near-prefix of agents/evidence/', 'agents/evidence-old/x.review-input/roadmap.md'],
        ['another file in the snapshot directory', 'agents/evidence/reviews/x.review-input/notes.md'],
        ['an empty slug', 'agents/evidence/reviews/.review-input/roadmap.md'],
        ['no .review-input directory', 'agents/evidence/reviews/x/roadmap.md'],
    ])('is still reported when it is %s', (_label, rel) => {
        const r = scan(tree({ [rel]: snapshotBody }));
        expect(r.findings.map((x) => x.rel)).toEqual([rel]);
    });

    it('the predicate refuses dot segments, so a crafted path cannot reach the exemption', () => {
        expect(isReviewInputRoadmapSnapshot(SNAP)).toBe(true);
        expect(isReviewInputRoadmapSnapshot('agents/evidence/../docs/x.review-input/roadmap.md')).toBe(false);
        expect(isReviewInputRoadmapSnapshot('agents/evidence/./x.review-input/roadmap.md')).toBe(false);
    });

    it('every real review-input roadmap snapshot in this tree matches the predicate', () => {
        // Ties the declared path to the LIVE writer output: a writer that moves
        // its snapshots makes this red rather than letting the gate flood.
        const files = globReviewInputRoadmaps(REPO_ROOT);
        expect(files.length).toBeGreaterThan(0);
        for (const f of files) {
            const rel = path.relative(REPO_ROOT, f).split(path.sep).join('/');
            expect(isReviewInputRoadmapSnapshot(rel)).toBe(true);
        }
    });
});

/** Every `<slug>.review-input/roadmap.md` snapshot under `agents/`. */
function globReviewInputRoadmaps(root: string): string[] {
    const out: string[] = [];
    const stack = [path.join(root, 'agents')];
    while (stack.length > 0) {
        const cur = stack.pop() as string;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(cur, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            if (e.isSymbolicLink()) continue;
            const full = path.join(cur, e.name);
            if (e.isDirectory()) {
                stack.push(full);
            } else if (e.name === 'roadmap.md' && cur.endsWith('.review-input')) {
                out.push(full);
            }
        }
    }
    return out;
}
