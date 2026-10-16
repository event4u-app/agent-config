/**
 * The roadmap-location DETECTOR — one implementation, two callers.
 *
 * `check_agent_artifact_location` runs it over this repository in CI;
 * `agent-config doctor` runs it over a consumer's tree through
 * `install_reach_checks`. It lives here rather than in the gate so the CLI
 * imports a module with no CLI-entry guard and no self-test machinery, and so
 * the two callers cannot hold different definitions of what counts: a change to
 * the detector moves both, which `tests/scripts/agent_artifact_location_two_callers.test.ts`
 * asserts. Why the detection takes three content signals rather than the name
 * test alone is stated in the gate's header.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { is_roadmap_candidate as isRoadmapCandidate } from '../../agent-src/scripts/update_roadmap_progress.js';

/** The one legitimate home. Everything else is a finding. */
export const ROADMAP_ROOT_REL = 'agents/roadmaps';

/**
 * Directories the walk never enters.
 *
 * `dist/` and the per-tool projection trees are generated copies — a finding
 * there is a finding about `src/`, reported twice. `node_modules` and `.git`
 * are not this repository's prose. `vendor` is the PHP equivalent of
 * `node_modules` in a consumer tree — third-party prose, never theirs to move.
 */
const SKIP_DIRS: ReadonlySet<string> = new Set([
    '.git',
    'node_modules',
    'vendor',
    'dist',
    '.augment',
    '.claude',
    '.cursor',
    '.clinerules',
    '.agents',
    'coverage',
    '.venv',
]);

/** Frontmatter keys that only a roadmap carries in this tree. */
const FM_ROADMAP_RE = /^complexity:[ \t]*(lightweight|structural)[ \t]*$/m;
/**
 * Anchored at the absolute start of the string — `^` with no `m` flag — on
 * purpose: this is a FRONTMATTER fence, which by the project's own convention
 * only means something at byte offset 0 of the file. A `---` fence that
 * begins three lines in is not frontmatter, it is a horizontal rule or a
 * quoted example, so loosening this to `m` would create false positives of
 * its own.
 *
 * The R2 review-input roadmap snapshots used to depend on that strictness as an
 * INCIDENTAL exemption: their two-line HTML-comment header, written for a
 * different gate, pushed this fence off offset 0. They are now exempt by path —
 * see `isReviewInputRoadmapSnapshot` — so neither the header nor this regex's
 * anchoring decides their fate any more.
 *
 * Tested in `check_agent_artifact_location.test.ts`
 * (describe: "review-input snapshot convention").
 */
const FM_RE = /^---\n([\s\S]*?)\n---/;
const PHASE_RE = /^##[ \t]+Phase[ \t]/m;
const CHECKBOX_RE = /^[ \t]*- \[[ x~-]\][ \t]/m;

export interface Shape {
    /** Which signals fired. Empty means not roadmap-shaped. */
    readonly signals: readonly string[];
    readonly isRoadmap: boolean;
}

/**
 * Decide whether a file's CONTENT is a roadmap.
 *
 * All three signals are required. Each is individually common; together they are
 * this repository's roadmap format and nothing else's.
 */
export function roadmapShape(text: string): Shape {
    const signals: string[] = [];
    const fm = FM_RE.exec(text);
    if (fm !== null && FM_ROADMAP_RE.test(fm[1] as string)) {
        signals.push('roadmap frontmatter (`complexity:` lightweight|structural)');
    }
    if (PHASE_RE.test(text)) {
        signals.push('a `## Phase` heading');
    }
    if (CHECKBOX_RE.test(text)) {
        signals.push('at least one checkbox step');
    }
    return { signals, isRoadmap: signals.length === 3 };
}

export interface Finding {
    readonly rel: string;
    readonly signals: readonly string[];
}

export interface ScanResult {
    readonly findings: readonly Finding[];
    /** Every `.md` file the walk visited — the scope, not the matches. */
    readonly scanned: number;
}

function walkMarkdown(root: string): string[] {
    const out: string[] = [];
    const stack = [root];
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
                if (!SKIP_DIRS.has(e.name)) stack.push(full);
            } else if (e.name.toLowerCase().endsWith('.md')) {
                out.push(full);
            }
        }
    }
    return out.sort();
}

/**
 * The one declared exemption: an R2 review-input roadmap snapshot.
 *
 * `dispatch_r2_reviewer.ts` writes a verbatim roadmap copy to exactly this
 * shape, and a file in it is non-authoritative evidence whoever wrote it —
 * nothing reads it back as a roadmap. Decided by path, not by a marker an
 * author could type anywhere (authority-routing roadmap 5.1, `## Decisions`):
 * measured 2026-10-07, every roadmap-shaped file outside the root was one of
 * these snapshots, so the path names the whole population and nothing else.
 * Takes the repository-relative POSIX path the walker produces; the walker
 * never follows a symlink, so a link cannot manufacture an exempt path.
 */
const REVIEW_INPUT_SNAPSHOT_PATH_RE = /^agents\/evidence\/(?:[^/]+\/)*[^/.][^/]*\.review-input\/roadmap\.md$/;

export function isReviewInputRoadmapSnapshot(rel: string): boolean {
    return REVIEW_INPUT_SNAPSHOT_PATH_RE.test(rel) && !rel.split('/').some((s) => s === '..' || s === '.');
}

/** `true` when `child` is at or below `root`. */
function isUnder(child: string, root: string): boolean {
    const rel = path.relative(root, child);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function scan(root: string): ScanResult {
    const roadmapRoot = path.join(root, ...ROADMAP_ROOT_REL.split('/'));
    const files = walkMarkdown(root);
    const findings: Finding[] = [];
    for (const f of files) {
        if (isUnder(f, roadmapRoot)) continue;
        if (isReviewInputRoadmapSnapshot(path.relative(root, f).split(path.sep).join('/'))) continue;
        // Cheap name pre-filter first — the SHARED definition, imported, so the
        // roadmap corpus and this guard cannot drift apart.
        if (!isRoadmapCandidate(f)) continue;
        let text: string;
        try {
            text = fs.readFileSync(f, 'utf-8');
        } catch {
            continue;
        }
        const shape = roadmapShape(text);
        if (!shape.isRoadmap) continue;
        findings.push({
            rel: path.relative(root, f).split(path.sep).join('/'),
            signals: shape.signals,
        });
    }
    return { findings, scanned: files.length };
}
