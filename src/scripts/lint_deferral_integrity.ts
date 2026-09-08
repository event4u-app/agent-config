#!/usr/bin/env tsx
/**
 * Standing validator for deferral carries whose parent is already archived.
 *
 * A `[~]` step carried to a follow-up roadmap is checked once, at the moment
 * the parent is archived, and never again. The check that performs it runs
 * inside a sweep over active roadmaps, so once the parent moves under
 * `archive/` neither end of the pair is ever looked at together again. The
 * receiver can then be deleted, renamed, or stripped of its back-link and
 * nothing goes red.
 *
 * This gate closes that by walking from the ARCHIVED side. An archived roadmap
 * is a durable record: nothing rewrites it, and it names its destination by
 * slug. So the expected set of live receivers is derivable at any time without
 * a registry to maintain, and whole-file deletion is detected on the first
 * pass — which a validator enumerating only the surviving receivers cannot do.
 *
 * Annotation parsing is delegated to `parseDeferredItems`, the same function the
 * archival sweep uses, so the syntax has one implementation and cannot drift.
 * The RESOLUTION POLICY is deliberately not shared, and the reason is temporal
 * rather than accidental. At archival time a destination under `archive/` is a
 * refusal: carrying an item into an already-dead roadmap loses it on arrival.
 * Afterwards, a destination that completed its own work and archived is the
 * SUCCESS case, not a loss. Sharing that branch would red two carries in this
 * repository whose receivers did exactly what they were asked to do — measured,
 * not predicted: both were reported on the first run against real data.
 *
 * So the standing policy is: the destination must still exist somewhere (a
 * missing file is the deletion this gate is for), it must still back-link, and
 * if it is archived it must carry no OPEN steps. An archived roadmap with open
 * steps was moved by hand and its obligations are stranded. A destination under
 * `skipped/` is red in either policy — skipping is not fulfilment.
 *
 * Unsupported transitions fail closed rather than being inferred. A rename
 * breaks destination resolution. A re-parent breaks the back-link. An onward
 * carry that removes the intermediate breaks the original parent's link. All
 * three are red here, deliberately, until a disposition vocabulary exists to
 * express them.
 *
 * A SECOND ENUMERATION used to run beside this one, over the live roadmaps that
 * declared `status: carrier`, reddening any that no archived parent named. It
 * existed only to police the three exemptions that status bought — from the
 * active roadmap count, from `check_roadmap_trackable` and from the plan risk
 * register — so that a file nobody carried anything to could not wear them for
 * free. ADR-262 deleted the status and all three exemptions, leaving nothing to
 * police: a file that would once have been an unjustified carrier is now
 * ordinary estate, caught by those gates for present-tense reasons rather than
 * for its ancestry. The reciprocal direction — every carry names a destination
 * that exists and back-links — is this enumeration, and it is untouched.
 *
 * Exit codes: 0 = every carry resolves, 1 = at least one does not.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    parseDeferredItems,
    _relatesTo as relatesTo,
    type DeferredItem,
} from '../agent-src/scripts/archive_completed_roadmaps.js';
import { checkRatchet } from './_lib/gate_baseline.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { reportScanned, DeadScopeError } from './_lib/scan_scope.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';

const _HERE = fileURLToPath(import.meta.url);
const _DEFAULT_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Directories holding roadmaps that can no longer be re-checked by the sweep. */
const DEAD_DIRS: readonly string[] = ['archive', 'skipped'];

/**
 * Cheap pre-filter. It must match a BARE `[~]` too, not only the annotation:
 * a deferred step with no annotation at all is the loss case, and filtering on
 * the annotation alone made the gate blind to exactly the shape it exists for.
 * Its own self-test caught that, which is the difference between a `scanned:`
 * floor and a proof that the reading changes the verdict.
 */
const CARRY_CANDIDATE_RE = /deferred-resolution:|^[ \t]*[-*][ \t]*\[~\]/m;

const EXCLUDE_NAMES: ReadonlySet<string> = new Set([
    'README.md',
    'INDEX.md',
    'template.md',
    'progress.md',
]);

/**
 * Two classes, and the split is the whole design.
 *
 * `unannotated` — a `[~]` step with no `deferred-resolution:` comment at all.
 * Every one of the 243 in this repository predates the annotation contract,
 * which was settled by council three months after the newest of them. It is
 * real debt, it is shrink-only, and it is not what this gate was built for.
 *
 * `broken-destination` — an annotation that named a receiver which no longer
 * holds up its end: deleted, renamed, re-parented, skipped, or archived with
 * open steps. This class is a hard failure at zero, because every member of it
 * is an obligation that had a recorded home and lost it. Deleting a live
 * receiver produces this class, not the other one.
 */
export type DeferralProblemClass = 'unannotated' | 'broken-destination';

export interface DeferralProblem {
    /** Repo-relative path of the archived roadmap whose carry is broken. */
    source: string;
    cls: DeferralProblemClass;
    detail: string;
}

/** Roadmap files under the dead directories, sorted for stable output. */
export function deadRoadmaps(root: string): string[] {
    const out: string[] = [];
    for (const dir of DEAD_DIRS) {
        const abs = path.join(root, 'agents', 'roadmaps', dir);
        let entries: string[];
        try {
            entries = fs.readdirSync(abs);
        } catch {
            continue;
        }
        for (const name of entries.sort()) {
            if (!name.endsWith('.md') || EXCLUDE_NAMES.has(name)) {
                continue;
            }
            const full = path.join(abs, name);
            if (!fs.statSync(full).isFile()) {
                continue;
            }
            out.push(path.posix.join('agents/roadmaps', dir, name));
        }
    }
    return out;
}

/** Escape a slug for literal use inside a RegExp. */
function _escapeRe(v: string): string {
    return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The frontmatter block's body, or `''` when the file opens without one.
 *
 * Every structural test below reads this rather than the whole file. A roadmap
 * body legitimately quotes roadmap syntax — that is what the stub recording the
 * deferred transition vocabulary does — so a whole-file regex answers a question
 * about documentation as if it were a question about declarations.
 */
export function frontmatter(text: string): string {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    return m === null ? '' : (m[1] ?? '');
}

/**
 * True when `text` DECLARES `parent_roadmap: <slug>` or a `relates:` row naming
 * it, in its frontmatter.
 *
 * Frontmatter-scoped, and the scope is the check. The first version matched
 * `- slug: <parent>` anywhere in the file, which re-opened the defect a prior
 * review closed in `deferralProblems`: a mention in prose, in an example, or
 * inside a fenced block is not a declaration, and a back-link that prose can
 * satisfy proves nothing about either end of the pair. The `relates:` walk is
 * imported from the archival sweep rather than re-implemented, for the same
 * one-implementation reason the annotation parser is.
 */
function _linksBackTo(text: string, slug: string): boolean {
    const fm = frontmatter(text);
    if (fm === '') {
        return false;
    }
    if (new RegExp(`^parent_roadmap:[ \t]*${_escapeRe(slug)}[ \t]*$`, 'm').test(fm)) {
        return true;
    }
    return relatesTo(fm, slug);
}

/** Where a destination slug resolves, and under which directory. */
function _locate(root: string, slug: string): { file: string; dir: 'active' | 'later' | 'archive' | 'skipped' } | null {
    const candidates: ReadonlyArray<readonly [string, 'active' | 'later' | 'archive' | 'skipped']> = [
        [path.join(root, 'agents', 'roadmaps', `${slug}.md`), 'active'],
        [path.join(root, 'agents', 'roadmaps', 'later', `${slug}.md`), 'later'],
        [path.join(root, 'agents', 'roadmaps', 'archive', `${slug}.md`), 'archive'],
        [path.join(root, 'agents', 'roadmaps', 'skipped', `${slug}.md`), 'skipped'],
    ];
    for (const [file, dir] of candidates) {
        if (fs.existsSync(file)) {
            return { file, dir };
        }
    }
    return null;
}

/** An OPEN checkbox on one line — `-` or `*`, matching the canonical grammar. */
const OPEN_STEP_RE = /^[ \t]*[-*][ \t]*\[[ ][ \t]*\][ \t]/;
/** A fenced block's delimiter, in either of the two fence styles in use here. */
const FENCE_RE = /^[ \t]*(?:```|~~~)/;

/**
 * True when an OPEN step appears OUTSIDE every fenced block.
 *
 * Fence-aware because this branch hard-fails at zero with no baseline, and a
 * roadmap that documents step syntax inside a fenced block is not a roadmap
 * with an open step. Measured before the fix: a fenced `markdown` example
 * containing one `- [ ]` line reddened CI with a diagnostic naming the wrong
 * cause and offering remediation that did not apply.
 */
export function hasOpenStep(text: string): boolean {
    let inFence = false;
    for (const line of text.split('\n')) {
        if (FENCE_RE.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (!inFence && OPEN_STEP_RE.test(line)) {
            return true;
        }
    }
    return false;
}

/**
 * The standing carry policy for one archived roadmap. See the module header for
 * why this is not `deferralProblems`.
 */
export function carryProblems(
    root: string,
    sourceSlug: string,
    text: string,
): Array<{ cls: DeferralProblemClass; detail: string }> {
    return carryProblemsFor(root, sourceSlug, parseDeferredItems(text));
}

/**
 * The same policy over an ALREADY-PARSED item list.
 *
 * Split out so the walk parses each candidate once and hands the item list to
 * this check, rather than parsing the same file twice per run.
 */
export function carryProblemsFor(
    root: string,
    sourceSlug: string,
    items: readonly DeferredItem[],
): Array<{ cls: DeferralProblemClass; detail: string }> {
    const problems: Array<{ cls: DeferralProblemClass; detail: string }> = [];
    for (const item of items) {
        const label = item.text === '' ? '(unnamed step)' : item.text;
        if (item.kind === null || item.destination === null) {
            problems.push({
                cls: 'unannotated',
                detail:
                    `deferred step ${JSON.stringify(label)} carries no ` +
                    '`<!-- deferred-resolution: carried-to=<slug> -->` annotation, so nothing records where it went',
            });
            continue;
        }
        if (item.destination === sourceSlug) {
            problems.push({
                cls: 'broken-destination',
                detail: `deferred step ${JSON.stringify(label)} names its OWN roadmap as the destination`,
            });
            continue;
        }
        const found = _locate(root, item.destination);
        if (found === null) {
            problems.push({
                cls: 'broken-destination',
                detail: `deferred step ${JSON.stringify(label)} names destination \`${item.destination}\`, ` +
                    'which no longer exists anywhere under `agents/roadmaps/` — the receiver was deleted ' +
                    'and the obligation went with it',
            });
            continue;
        }
        if (found.dir === 'skipped') {
            problems.push({
                cls: 'broken-destination',
                detail: `destination \`${item.destination}\` is under \`skipped/\` — skipping a receiver is not ` +
                    'fulfilling the carry',
            });
            continue;
        }
        const destText = fs.readFileSync(found.file, 'utf-8');
        if (found.dir === 'archive' && hasOpenStep(destText)) {
            problems.push({
                cls: 'broken-destination',
                detail: `destination \`${item.destination}\` is archived but still has OPEN steps — it was moved ` +
                    'by hand rather than completed, so the carried obligation is stranded',
            });
            continue;
        }
        if (!_linksBackTo(destText, sourceSlug)) {
            problems.push({
                cls: 'broken-destination',
                detail: `destination \`${item.destination}\` carries no \`parent_roadmap: ${sourceSlug}\` ` +
                    'back-link and no `relates:` row naming it — the link must verify from both ends',
            });
        }
    }
    return problems;
}

/**
 * Validate every carry annotation in the dead directories.
 *
 * @param walked the dead-roadmap list, when the caller already has it. The walk
 * `statSync`s every file in the archive, so taking it as a parameter is what
 * stops the run doing that twice — once for the ledger's plan and once here.
 * @returns the problems found and how many dead roadmaps were read.
 */
export function auditCarries(
    root: string,
    walked: readonly string[] = deadRoadmaps(root),
): { problems: DeferralProblem[]; scanned: number } {
    const problems: DeferralProblem[] = [];
    let scanned = 0;
    for (const rel of walked) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf-8');
        } catch {
            continue;
        }
        scanned += 1;
        if (!CARRY_CANDIDATE_RE.test(text)) {
            continue;
        }
        const items = parseDeferredItems(text);
        const sourceSlug = path.basename(rel).replace(/\.md$/, '');
        for (const found of carryProblemsFor(root, sourceSlug, items)) {
            problems.push({ source: rel, ...found });
        }
    }
    return { problems, scanned };
}

const USAGE = `usage: lint_deferral_integrity [--root <dir>] [--self-test] [--quiet]

  --root <dir>   audit another checkout (default: this repository)
  --self-test    run the built-in discrimination suite and exit
  --quiet        suppress the green summary line
`;

function _writeFixture(dir: string, rel: string, body: string): void {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf-8');
}

const PARENT_WITH_CARRY = '---\ncomplexity: bounded\n---\n# Parent\n\n## Phase 1 - a phase\n\n- [~] **1.1 A carried step.**\n      <!-- deferred-resolution: carried-to=road-to-receiver -->\n';

function _receiver(backlink: string): string {
    return `---
complexity: bounded
${backlink}
---
# Receiver

Body.
`;
}

/**
 * A body that DOCUMENTS roadmap syntax inside a fence rather than declaring it.
 * `hasOpenStep` used to match the `- [ ]` line inside it and red an archived
 * receiver that had completed its work.
 */
const FENCED_SYNTAX_DOC = 'Syntax this file documents rather than declares:\n\n```markdown\n---\nstatus: draft\n---\n- [ ] **1.1 An example open step.**\n```\n';

/** A back-link that exists only in the body — a mention, never a declaration. */
const FENCED_BODY_BACKLINK = 'What a back-link looks like, quoted:\n\n```yaml\nparent_roadmap: road-to-parent\nrelates:\n  - slug: road-to-parent\n    relation: extends\n```\n';

/**
 * Each case builds a throwaway tree, runs the real CLI against it with
 * `--root`, and asserts the exit code. Shelling out rather than calling
 * `auditCarries` directly keeps argv parsing and the exit-code mapping inside
 * what is proven.
 *
 * Every case here is a `broken-destination` case, because that is the class
 * this CLI hard-fails on. The `unannotated` class cannot be proven by exit code
 * at all: it is ratcheted against a baseline of 243, so one planted fixture
 * finding sits far below the floor and correctly exits 0. Its detection is
 * proven instead by a unit test over `carryProblems`, which asserts the class
 * directly, plus by the 243 it reports against the real tree on every run.
 */
export function selfTestCases(root: string): SelfTestCase[] {
    const build = (name: string, plant: (dir: string) => void): (() => number) => {
        return () => {
            const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), name));
            try {
                plant(dir);
                return runGateCli(
                    root,
                    'src/scripts/lint_deferral_integrity.ts',
                    ['--root', dir, '--quiet'],
                    root,
                );
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        };
    };
    const parent = (dir: string): void =>
        _writeFixture(dir, 'agents/roadmaps/archive/road-to-parent.md', PARENT_WITH_CARRY);
    return [
        {
            name: 'a live receiver with a back-link is accepted',
            expect: 'accept',
            run: build('deferral-ok-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/road-to-receiver.md',
                    _receiver('parent_roadmap: road-to-parent'),
                );
            }),
        },
        {
            name: 'a receiver parked under later/ is equally live and is accepted',
            expect: 'accept',
            run: build('deferral-later-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/later/road-to-receiver.md',
                    _receiver('parent_roadmap: road-to-parent'),
                );
            }),
        },
        {
            name: 'a receiver that completed its work and archived is accepted — fulfilment, not loss',
            expect: 'accept',
            run: build('deferral-done-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/archive/road-to-receiver.md',
                    `${_receiver('parent_roadmap: road-to-parent')}\n- [x] **1.1 Done.**\n`,
                );
            }),
        },
        {
            name: 'a back-link supplied as a relates: row instead of parent_roadmap is accepted',
            expect: 'accept',
            run: build('deferral-relates-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/road-to-receiver.md',
                    _receiver('relates:\n  - slug: road-to-parent\n    relation: extends'),
                );
            }),
        },
        {
            name: 'an archived receiver that only documents roadmap syntax in a fence is accepted',
            expect: 'accept',
            run: build('deferral-fenced-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/archive/road-to-receiver.md',
                    `${_receiver('parent_roadmap: road-to-parent')}\n${FENCED_SYNTAX_DOC}`,
                );
            }),
        },
        {
            name: 'an archived receiver with an asterisk-bulleted OPEN step is rejected',
            expect: 'reject',
            run: build('deferral-asterisk-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/archive/road-to-receiver.md',
                    `${_receiver('parent_roadmap: road-to-parent')}\n* [ ] **1.1 Still open.**\n`,
                );
            }),
        },
        {
            name: 'a back-link that only appears in the body, not the frontmatter, is rejected',
            expect: 'reject',
            run: build('deferral-bodylink-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/road-to-receiver.md',
                    `${_receiver('owner: maintainer')}\n${FENCED_BODY_BACKLINK}`,
                );
            }),
        },
        {
            name: 'the receiver deleted entirely is rejected',
            expect: 'reject',
            run: build('deferral-deleted-', parent),
        },
        {
            name: 'a receiver archived while still carrying OPEN steps is rejected — stranded, not completed',
            expect: 'reject',
            run: build('deferral-stranded-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/archive/road-to-receiver.md',
                    `${_receiver('parent_roadmap: road-to-parent')}\n- [ ] **1.1 Still open.**\n`,
                );
            }),
        },
        {
            name: 'a receiver under skipped/ is rejected — skipping is not fulfilling',
            expect: 'reject',
            run: build('deferral-skipped-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/skipped/road-to-receiver.md',
                    _receiver('parent_roadmap: road-to-parent'),
                );
            }),
        },
        {
            name: 'the back-link removed is rejected — the link must verify from both ends',
            expect: 'reject',
            run: build('deferral-nolink-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/road-to-receiver.md',
                    _receiver('owner: maintainer'),
                );
            }),
        },
        {
            name: 'a back-link naming a different parent is rejected',
            expect: 'reject',
            run: build('deferral-reparent-', (dir) => {
                parent(dir);
                _writeFixture(
                    dir,
                    'agents/roadmaps/road-to-receiver.md',
                    _receiver('parent_roadmap: road-to-someone-else'),
                );
            }),
        },
    ];
}

export function main(argv: string[]): number {
    let root = _DEFAULT_ROOT;
    let quiet = false;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] as string;
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(USAGE);
            return 0;
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '--root') {
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write('lint_deferral_integrity: --root needs a directory\n');
                return 2;
            }
            root = path.resolve(next);
            i += 1;
        } else if (arg === '--self-test') {
            return runSelfTest({
                gate: 'lint_deferral_integrity',
                cases: selfTestCases(_DEFAULT_ROOT),
                // 16/10 before ADR-262 deleted `status: carrier`, which took one
                // accept case (a named live carrier) and three reject cases (two
                // orphan carriers, one archived carrier destination) with it.
                minCases: 12,
                minRejectCases: 7,
            });
        } else {
            process.stderr.write(`lint_deferral_integrity: unknown argument ${JSON.stringify(arg)}\n`);
            process.stderr.write(USAGE);
            return 2;
        }
    }

    const ledger = new GateLedger('lint_deferral_integrity');
    const walked = deadRoadmaps(root);
    // Walked ONCE and handed to the audit, so the run does not readdir and
    // `statSync` every archived file twice for one reading.
    const { problems, scanned } = auditCarries(root, walked);
    ledger.plan([...walked]);
    const failed = new Set(problems.map((p) => p.source));
    for (const rel of walked) {
        if (failed.has(rel)) {
            ledger.fail(rel, problems.find((p) => p.source === rel)?.detail ?? 'broken carry');
        } else {
            ledger.complete(rel);
        }
    }
    try {
        reportScanned({
            gate: 'lint_deferral_integrity',
            scanned,
            units: 'archived roadmap(s)',
            roots: DEAD_DIRS.map((d) => `agents/roadmaps/${d}`),
            allowEmpty: 'a checkout with no archived roadmaps has no carry to break',
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`${e.message}\n`);
            ledger.report();
            return 1;
        }
        throw e;
    }

    const broken = problems.filter((p) => p.cls === 'broken-destination');
    const unannotated = problems.filter((p) => p.cls === 'unannotated');

    // Hard failure, at zero, no baseline. Every member of this class is an
    // obligation that had a recorded destination and lost it.
    if (broken.length > 0) {
        process.stderr.write(
            `\n❌  ${String(broken.length)} broken deferral carr${broken.length === 1 ? 'y' : 'ies'}. ` +
                'An archived roadmap named a receiver that no longer holds up its end, so the ' +
                'obligations it carried have no live destination.\n\n',
        );
        for (const p of broken) {
            process.stderr.write(`  ❌ ${p.source}\n     ${p.detail}\n`);
        }
        process.stderr.write(
            '\n    Restore the receiver, restore its `parent_roadmap:` back-link, or move the\n' +
                '    carried items back to open in the archived parent. A rename or a re-parent is\n' +
                '    not expressible yet and fails closed on purpose.\n',
        );
        ledger.report();
        return 1;
    }

    const verdict = checkRatchet({
        gate: 'lint_deferral_integrity',
        actual: unannotated.length,
        repoRoot: _DEFAULT_ROOT,
    });
    if (!verdict.ok) {
        process.stderr.write(`\n❌  ${verdict.message}\n\n`);
        for (const p of unannotated.slice(0, 20)) {
            process.stderr.write(`  ❌ ${p.source}\n     ${p.detail}\n`);
        }
        if (unannotated.length > 20) {
            process.stderr.write(`  … and ${String(unannotated.length - 20)} more.\n`);
        }
        ledger.report();
        return 1;
    }

    if (!quiet) {
        process.stdout.write(`✅  ${verdict.message}\n`);
        process.stdout.write(
            `✅  lint_deferral_integrity: ${String(scanned)} dead roadmap(s) scanned, ` +
                'every annotated carry resolves.\n',
        );
    }
    ledger.report();
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main(process.argv.slice(2)));
}
