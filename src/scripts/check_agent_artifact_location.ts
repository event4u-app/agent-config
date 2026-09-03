#!/usr/bin/env tsx
/**
 * Agent-artifact location guard — a roadmap-shaped file outside the roadmap root.
 *
 * WHAT IT PROTECTS, AND WHAT IT DOES NOT.
 * ---------------------------------------
 * This gate protects THIS repository, and only this one. A consumer repository
 * never runs this repository's CI, so a gate scoped here protects the tree
 * where the error is LEAST likely to occur — the observed failure was in a
 * consumer project. That is not a reason to skip it, since the same mistake is
 * possible here, but it IS a reason to write the limit down: a gate whose reach
 * is not stated gets cited as broader than it is.
 *
 * The outward-facing half is `agent-config doctor --strict`, which already
 * knows the consumer shape and can now return a non-zero exit.
 *
 * The constraint the detection rests on: every other mechanism that governs a
 * roadmap is keyed on the roadmap root, so a file placed outside it is governed
 * by nothing. This gate is the one that is keyed on the complement.
 *
 * WHY THE NAME TEST ALONE IS NOT THE DETECTOR.
 * -------------------------------------------
 * `is_roadmap_candidate` is IMPORTED from `update_roadmap_progress` rather than
 * mirrored locally, the way `check_estate_count.ts` does it — one definition of
 * what counts, so the roadmap corpus and this guard cannot drift apart.
 *
 * But that function answers "is this filename eligible to be a roadmap inside
 * the roadmap root", and its answer over an arbitrary tree is YES for nearly
 * every `.md` file: it excludes four names and one prefix and otherwise accepts
 * anything. Run bare over this repository it would report thousands of
 * legitimate documents. So the name test is a PRE-FILTER, and the decision is
 * made by {@link roadmapShape}, which reads the file: roadmap frontmatter plus a
 * `## Phase` heading plus at least one checkbox step. All three, because each
 * alone is common — plenty of documents carry frontmatter, and a design doc can
 * carry checkboxes.
 *
 * The finding NAMES the signals that fired, so a false positive is arguable
 * rather than mysterious. A document that trips this gate and should not is a
 * conversation about the signals, which is the conversation worth having.
 *
 * Exit codes: 0 = clean · 1 = a roadmap-shaped file sits outside the root · 3 = internal error.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { is_roadmap_candidate as isRoadmapCandidate } from '../agent-src/scripts/update_roadmap_progress.js';
import { reportScanned, DeadScopeError } from './_lib/scan_scope.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The one legitimate home. Everything else is a finding. */
export const ROADMAP_ROOT_REL = 'agents/roadmaps';

/**
 * Directories the walk never enters.
 *
 * `dist/` and the per-tool projection trees are generated copies — a finding
 * there is a finding about `src/`, reported twice. `node_modules` and `.git`
 * are not this repository's prose.
 */
const SKIP_DIRS: ReadonlySet<string> = new Set([
    '.git',
    'node_modules',
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

interface Args {
    quiet: boolean;
    selfTest: boolean;
    root: string;
}

function parseArgs(argv: readonly string[]): Args {
    const args: Args = { quiet: false, selfTest: false, root: REPO_ROOT };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--quiet') args.quiet = true;
        else if (a === '--self-test') args.selfTest = true;
        else if (a === '--root') args.root = path.resolve(argv[++i] ?? '.');
        else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: check_agent_artifact_location [-h] [--quiet] [--root DIR] [--self-test]\n',
            );
            process.exit(0);
        } else {
            process.stderr.write(
                `check_agent_artifact_location: error: unrecognized arguments: ${a}\n`,
            );
            process.exit(2);
        }
    }
    return args;
}

/** A minimal file with all three shape signals. */
const ROADMAP_FIXTURE =
    '---\ncomplexity: lightweight\nstatus: ready\n---\n' +
    '# Road to a fixture\n\n## Phase 1 - a phase\n\n- [ ] **1.1 A step.**\n';

/** Same content, but not roadmap-shaped — frontmatter only. */
const PROSE_FIXTURE = '---\ntitle: a design note\n---\n\n# A design note\n\n- [ ] a todo\n';

function selfTestCases(): SelfTestCase[] {
    const mk = (rel: string, body: string): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'artloc-'));
        const full = path.join(dir, ...rel.split('/'));
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
        return dir;
    };
    const run = (dir: string): number =>
        runGateCli(
            REPO_ROOT,
            'src/scripts/check_agent_artifact_location.ts',
            ['--root', dir, '--quiet'],
            REPO_ROOT,
        );
    return [
        {
            name: 'a roadmap-shaped file under docs/roadmaps/ is reported',
            expect: 'reject',
            run: () => run(mk('docs/roadmaps/road-to-a-fixture.md', ROADMAP_FIXTURE)),
        },
        {
            name: 'a roadmap-shaped file at the tree root is reported',
            expect: 'reject',
            run: () => run(mk('road-to-a-fixture.md', ROADMAP_FIXTURE)),
        },
        {
            name: 'the SAME file under agents/roadmaps/ is not reported',
            expect: 'accept',
            run: () => run(mk('agents/roadmaps/road-to-a-fixture.md', ROADMAP_FIXTURE)),
        },
        {
            name: 'a file under agents/roadmaps/later/ is not reported',
            expect: 'accept',
            run: () => run(mk('agents/roadmaps/later/road-to-a-fixture.md', ROADMAP_FIXTURE)),
        },
        {
            name: 'prose carrying frontmatter and a checkbox but no phase is not reported',
            expect: 'accept',
            run: () => run(mk('docs/a-design-note.md', PROSE_FIXTURE)),
        },
    ];
}

export function main(argv?: readonly string[]): number {
    const args = parseArgs(argv ?? process.argv.slice(2));

    if (args.selfTest) {
        return runSelfTest({
            gate: 'check_agent_artifact_location',
            cases: selfTestCases(),
            minCases: 5,
            minRejectCases: 2,
        });
    }

    let result: ScanResult;
    try {
        result = scan(args.root);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`❌  internal error: ${msg}\n`);
        return 3;
    }

    // The unit is every `.md` the walk VISITED, not the matches: zero matches is
    // the normal clean state, so only the unfiltered walk can tell "nothing
    // misplaced" from "nothing read".
    try {
        reportScanned({
            gate: 'check_agent_artifact_location',
            scanned: result.scanned,
            units: 'markdown file(s)',
            roots: [path.relative(REPO_ROOT, args.root) || '.'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (result.findings.length === 0) {
        if (!args.quiet) {
            process.stdout.write(
                `✅  check_agent_artifact_location: no roadmap-shaped file outside ` +
                    `${ROADMAP_ROOT_REL}/ (${String(result.scanned)} markdown file(s) read).\n`,
            );
        }
        return 0;
    }

    process.stderr.write(
        `❌  check_agent_artifact_location: ${String(result.findings.length)} ` +
            `roadmap-shaped file(s) outside ${ROADMAP_ROOT_REL}/:\n`,
    );
    for (const f of result.findings) {
        process.stderr.write(`    ${f.rel}\n`);
        process.stderr.write(`      reads as a roadmap because it carries ${f.signals.join(', ')}\n`);
    }
    process.stderr.write(
        `    Move it to ${ROADMAP_ROOT_REL}/, or — if it is genuinely not a roadmap — ` +
            'say which of the three signals it should not be carrying.\n' +
            '    NOTE: this gate scans THIS repository only. A consumer project never runs\n' +
            '    it; `agent-config doctor` is the surface that carries a finding outward.\n',
    );
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
