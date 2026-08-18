#!/usr/bin/env tsx
/**
 * `check_estate_count` — the roadmap estate walks DOWN, and a new roadmap pays
 * for itself.
 *
 * WHY THIS EXISTS
 * ---------------
 * `road-to-estate-drawdown` § 0 states the defect: the estate carries dozens of
 * active roadmaps and dozens of open blockers, and **the count does not go down
 * by itself**. New roadmaps arrive faster than old ones terminate — the roadmap
 * that registered this campaign was itself adopted in a sitting that added seven
 * files at once, and records that as an instance of the defect rather than an
 * exception to it.
 *
 * Nothing in this tree objected. `lint_roadmap_family_cap` bounds concurrency
 * WITHIN one `road-to-<family>-*` family; `lint_empty_roadmaps` and
 * `check_roadmap_trackable` police individual files. No gate reads the estate as
 * a whole, so growth was invisible to CI and visible only to whoever happened to
 * read the dashboard header.
 *
 * TWO CHECKS, ONE GATE
 * --------------------
 * **T2, the ratchet.** The committed baseline in
 * `src/config/estate-count-budget.json` walks down only. Growth in any gated
 * count is a policy failure (exit 1) that names the metric, the baseline and the
 * live number. A count BELOW the baseline is ALSO a failure (exit 1) — an
 * un-walked tightening — because a lower measurement becomes the new ceiling
 * rather than becoming unused headroom, and a gate that only warned about it is
 * how the headroom survived to be spent. The one exemption is a metric raised in
 * the same change with a recorded reason AND a new baseline equal to the live
 * count; an over-raise fails here rather than in the next change.
 *
 * Corrected 2026-08-19. This paragraph documented the below-baseline case as
 * green and pointed at `check_preamble_payload_budget` for the shape, while
 * `check_estate_count.test.ts` asserted the committed budget EQUALS the live
 * tree — so the gate, its own test, and this header described three positions on
 * one state.
 *
 * **T3, one-in-one-out.** A change that adds an active roadmap archives, parks
 * or merges one in the same change — or the added file carries an explicit
 * `estate_offset_exempt:` reason in its frontmatter, which costs a visible line
 * in the diff of the very commit that claims it. This half is diff-scoped: it
 * reads `<base>...HEAD` over `agents/roadmaps/`, so on a branch that adds no
 * roadmap it legitimately finds nothing to weigh.
 *
 * WHY THE COUNTS ARE READ FROM THE DASHBOARD'S OWN PARSER
 * -------------------------------------------------------
 * `collect()` from `update_roadmap_progress` is the function the dashboard is
 * generated from, imported rather than re-implemented — the same discipline
 * `roadmap_gates.ts` states for the blocker projection. Verified 2026-08-18:
 * `collect().length` is 38 and its summed open blockers are 49, which are
 * exactly the two numbers the dashboard header prints. A gate that re-derived
 * them could disagree with the dashboard, and then the reader has to decide
 * which one lied.
 *
 * `later/` is counted from the filesystem because parked roadmaps are
 * deliberately outside `collect()`'s corpus — they are estate all the same, and
 * a drawdown that moved everything into `later/` and called the number down
 * would be the burial T1's quality anchor exists to prevent.
 *
 * Invocation (from project root):
 *   ./scripts-run src/scripts/check_estate_count
 *   ./scripts-run src/scripts/check_estate_count --json
 *   ./scripts-run src/scripts/check_estate_count --base origin/main
 *
 * Exit codes: 0 within budget · 1 policy violation (growth, or an unpaid
 * addition) · 2 could-not-run (unreadable budget, dead scan scope).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    collect,
    is_draft as isDraft,
    is_roadmap_candidate as isRoadmapCandidate,
    parse_frontmatter as parseFrontmatter,
    parse_roadmap as parseRoadmap,
} from '../agent-src/scripts/update_roadmap_progress.js';
import { reportScanned, DeadScopeError } from './_lib/scan_scope.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { resolveBaseRef } from './_lib/ratchet_base_ref.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';

const GATE = 'check_estate_count';
const BUDGET_REL = path.join('src', 'config', 'estate-count-budget.json');
const ROADMAPS_REL = path.join('agents', 'roadmaps');

/** The three gated counts. Each is a metric the budget file defines in prose. */
export interface EstateCounts {
    active_roadmaps: number;
    later_roadmaps: number;
    open_blockers: number;
}

export type MetricName = keyof EstateCounts;

export const METRICS: readonly MetricName[] = ['active_roadmaps', 'later_roadmaps', 'open_blockers'];

export interface EstateBudget {
    baseline: EstateCounts;
    /**
     * The audit trail a raise is read from. Each entry records the metrics it set
     * and WHY in a real sentence; a raise whose newest entry carries no `why`, or
     * whose `why` does not name the metric's new value, is refused.
     */
    baseline_history?: Array<Partial<EstateCounts> & { at?: string; why?: string }>;
    /**
     * `applies_above_active: null` ⇒ one-in-one-out is unconditional.
     *
     * T3 phrases the condition as "while the active count sits above target",
     * and T1 says the target number belongs to the maintainer. Rather than
     * inventing a ceiling so the condition can be evaluated, `null` states that
     * no ceiling is registered and the lint therefore applies. Registering a
     * number here is how it gets a threshold.
     */
    one_in_one_out: { applies_above_active: number | null };
}

/** One growth finding — a gated count that rose above its committed baseline. */
export interface GrowthFinding {
    metric: MetricName;
    baseline: number;
    live: number;
}

/** How a change touched the active roadmap tree, as git reports it. */
export interface OffsetLedger {
    /** Files that entered the active top level: new files, and un-parked ones. */
    added: string[];
    /** Files that left it: deleted, archived, parked or merged away. */
    offsets: string[];
    /** Added files carrying an `estate_offset_exempt:` reason, with the reason. */
    exempt: Array<{ file: string; reason: string }>;
}

/**
 * A baseline number this change RAISED, and whether it carries its reason.
 *
 * The whole point of a ratchet is that the change under review cannot silence it
 * by editing the number, so the "before" side is read from the base ref with
 * `git show <baseRef>:<path>` — the one reading of the baseline this commit
 * cannot rewrite. Same argument `_lib/ratchet_base_ref`'s header makes for entry
 * sets, applied to a count.
 */
export interface RaiseFinding {
    metric: MetricName;
    from: number;
    to: number;
    /** A raise WITH a reason is legal and reported; without one it fails. */
    reason: string | null;
}

export interface EstateVerdict {
    counts: EstateCounts;
    baseline: EstateCounts;
    growth: GrowthFinding[];
    /**
     * Counts strictly below their baseline — every one of them, exempt or not.
     * Kept whole so a `--json` consumer can still tell "nothing is below
     * baseline" from "something is, and a bounded reasoned raise exempted it".
     */
    tightened: GrowthFinding[];
    /**
     * The subset of `tightened` that FAILS: below baseline with no bounded
     * reasoned raise covering it. This is what `withinBudget` reads.
     */
    unwalked: GrowthFinding[];
    /** Baselines raised against the base ref, each with its reason or `null`. */
    raises: RaiseFinding[];
    /** `null` when the raise check could not run; the reason is printed either way. */
    raiseSkipReason: string | null;
    /** `null` when the diff half could not run; the reason is printed either way. */
    offsets: OffsetLedger | null;
    offsetSkipReason: string | null;
    unpaid: number;
    withinBudget: boolean;
}

function repoRootFrom(start: string): string {
    let dir = path.resolve(start);
    for (;;) {
        if (fs.existsSync(path.join(dir, ROADMAPS_REL))) {
            return dir;
        }
        const up = path.dirname(dir);
        if (up === dir) {
            return path.resolve(start);
        }
        dir = up;
    }
}

function git(args: readonly string[], cwd: string): { ok: boolean; stdout: string } {
    const res = spawnSync('git', [...args], { cwd, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });
    return { ok: res.status === 0, stdout: res.stdout ?? '' };
}

/**
 * Roadmap-shaped `.md` files directly inside `<roadmaps>/<sub>`.
 *
 * The predicate is fed the BARE FILENAME, never the path: `is_roadmap_candidate`
 * excludes any path with an `archive`/`skipped`/`stubs`/`later` component, which
 * is correct for the active walk and would make every file in a disposition
 * directory invisible here. Passing the name keeps the parts that apply —
 * `README.md`, `template.md`, `open-questions*` are not roadmaps in any
 * directory. (First version passed the path and counted 0 of 44.)
 */
function countIn(roadmapRoot: string, sub: string): number {
    try {
        return fs
            .readdirSync(path.join(roadmapRoot, sub))
            .filter((n) => n.endsWith('.md') && isRoadmapCandidate(n)).length;
    } catch {
        return 0;
    }
}

/** Non-draft roadmaps parked in `later/`, parsed for their blockers. */
function laterRoadmaps(roadmapRoot: string): Array<{ open_blockers: readonly unknown[] }> {
    const dir = path.join(roadmapRoot, 'later');
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: Array<{ open_blockers: readonly unknown[] }> = [];
    for (const name of names) {
        if (!name.endsWith('.md') || !isRoadmapCandidate(name)) continue;
        const abs = path.join(dir, name);
        // `collect()` cannot be reused here: it filters through the same
        // path-based predicate and would reject its own root.
        const text = fs.readFileSync(abs, 'utf-8');
        if (isDraft(parseFrontmatter(text))) continue;
        const stats = parseRoadmap(abs, dir);
        if (stats !== null) out.push(stats as unknown as { open_blockers: readonly unknown[] });
    }
    return out;
}

/**
 * Count the estate, three ways.
 *
 * `active_roadmaps` comes from `collect()` so it cannot disagree with the
 * dashboard. `later_roadmaps` is a directory listing because parked files are
 * outside that corpus by design — filtered through the same `is_roadmap_candidate`
 * predicate as the active side, so `later/README.md` is not a roadmap here either.
 *
 * `open_blockers` spans the active tree AND `later/`, which is a correction to the
 * first version of this gate: counting it over the active tree alone meant
 * **parking a roadmap dropped the gated blocker count without resolving
 * anything**, and the ratchet then printed "free tightening" over a burial and
 * invited a permanent baseline drop. AC-1 is phrased on this metric, so the metric
 * has to survive a move that resolves nothing. `skipped/` and `archive/` stay out:
 * those are terminal, and a blocker in a skipped roadmap is not open work.
 *
 * **So this metric deliberately does NOT equal the dashboard header's blocker
 * count, which is active-only.** The first version claimed parity with it as a
 * virtue; burial-resistance is worth more here, and claiming both would be the
 * claim that broke. `active_roadmaps` keeps the parity.
 */
export function countEstate(repoRoot: string): EstateCounts {
    const roadmapRoot = path.join(repoRoot, ROADMAPS_REL);
    const stats = collect(roadmapRoot);
    const openOf = (rows: readonly { open_blockers: readonly unknown[] }[]): number =>
        rows.reduce((n, r) => n + r.open_blockers.length, 0);
    return {
        active_roadmaps: stats.length,
        later_roadmaps: countIn(roadmapRoot, 'later'),
        open_blockers: openOf(stats) + openOf(laterRoadmaps(roadmapRoot)),
    };
}

/** `agents/roadmaps/<name>.md` — the active top level, never a subdirectory. */
function isActiveTopLevel(rel: string): boolean {
    const norm = rel.split(path.sep).join('/');
    if (!norm.startsWith('agents/roadmaps/') || !norm.endsWith('.md')) {
        return false;
    }
    const tail = norm.slice('agents/roadmaps/'.length);
    return !tail.includes('/') && isRoadmapCandidate(norm);
}

/**
 * A disposition directory — where an offset sends a roadmap.
 *
 * `stubs/` is in the set, and it was missing from the first version. Un-stubbing
 * is the documented promotion path, so a stub moved to the top level is an
 * ADDITION that T3 must charge, and a roadmap demoted to a stub is an offset.
 * With `stubs/` unrecognised, a promotion was classified as neither and the lint
 * could never charge it — the one hole that let an active roadmap arrive for free.
 */
function isDisposed(rel: string): boolean {
    const norm = rel.split(path.sep).join('/');
    return /^agents\/roadmaps\/(archive|later|skipped|stubs)\//.test(norm);
}

/**
 * Read the exemption reason a newly added roadmap declares, if any.
 *
 * The key lives in the file's own frontmatter rather than in a config or a
 * commit trailer, for the reason `RATCHET_RESET_KEY` gives for living inside the
 * baseline JSON: the claim then shows up in the diff of the change that makes
 * it, and a reviewer sees it without being told to look.
 */
export function exemptionReason(text: string): string | null {
    const fm = parseFrontmatter(text);
    const raw = (fm as Record<string, unknown>)['estate_offset_exempt'];
    if (typeof raw !== 'string') {
        return null;
    }
    const reason = raw.trim().replace(/^["']|["']$/g, '').trim();
    return reason === '' ? null : reason;
}

/**
 * Classify the change's effect on the active roadmap tree.
 *
 * Renames carry information a name-only diff loses: `road-to-x.md` →
 * `archive/road-to-x.md` is the wanted direction and counts as an offset, while
 * `later/road-to-x.md` → `road-to-x.md` is an un-parking and counts as an
 * addition. A top-level-to-top-level rename is neither.
 */
export function classifyDiff(nameStatus: string, readFile: (rel: string) => string | null): OffsetLedger {
    const added: string[] = [];
    const offsets: string[] = [];
    const exempt: Array<{ file: string; reason: string }> = [];
    for (const line of nameStatus.split('\n')) {
        if (line.trim() === '') continue;
        const cols = line.split('\t');
        const status = (cols[0] ?? '').trim();
        if (status.startsWith('R') || status.startsWith('C')) {
            const from = cols[1] ?? '';
            const to = cols[2] ?? '';
            if (isActiveTopLevel(from) && isDisposed(to)) {
                offsets.push(from);
            } else if (isDisposed(from) && isActiveTopLevel(to)) {
                added.push(to);
            }
            continue;
        }
        const file = cols[1] ?? '';
        if (!isActiveTopLevel(file)) continue;
        if (status === 'A') {
            added.push(file);
        } else if (status === 'D') {
            offsets.push(file);
        }
    }
    for (const file of added) {
        const text = readFile(file);
        if (text === null) continue;
        const reason = exemptionReason(text);
        if (reason !== null) {
            exempt.push({ file, reason });
        }
    }
    return { added, offsets, exempt };
}

export function evaluate(
    repoRoot: string,
    opts: { baseRef?: string | undefined } = {},
): EstateVerdict {
    const budgetPath = path.join(repoRoot, BUDGET_REL);
    let budget: EstateBudget;
    try {
        budget = JSON.parse(fs.readFileSync(budgetPath, 'utf-8')) as EstateBudget;
    } catch (err) {
        throw new Error(`${BUDGET_REL} is unreadable: ${(err as Error).message}`);
    }
    if (budget.baseline === undefined) {
        throw new Error(`${BUDGET_REL} carries no "baseline" object.`);
    }

    const counts = countEstate(repoRoot);
    const growth: GrowthFinding[] = [];
    const tightened: GrowthFinding[] = [];
    for (const metric of METRICS) {
        const baseline = budget.baseline[metric];
        const live = counts[metric];
        if (typeof baseline !== 'number') {
            throw new Error(`${BUDGET_REL} baseline is missing the "${metric}" metric.`);
        }
        if (live > baseline) growth.push({ metric, baseline, live });
        else if (live < baseline) tightened.push({ metric, baseline, live });
    }

    const baseRef = opts.baseRef ?? resolveBaseRef(repoRoot);

    // The RAISE check — the half that makes this a ratchet rather than a number.
    //
    // Comparing the live count against a baseline the same commit may edit is not
    // a ratchet: the cheapest way past the growth check above is to type a bigger
    // number. So the "before" side is read from the base ref, which is the one
    // reading of the baseline this change cannot rewrite, and a raise is legal
    // only when the newest `baseline_history` entry carries a real reason AND
    // records the metric at its new value.
    const raises: RaiseFinding[] = [];
    let raiseSkipReason: string | null = null;
    if (baseRef === null || baseRef === undefined) {
        raiseSkipReason = 'no base ref resolved — a baseline raise cannot be detected, so the ratchet half is unproven on this run';
    } else {
        const show = git(['show', `${baseRef}:${BUDGET_REL.split(path.sep).join('/')}`], repoRoot);
        if (!show.ok) {
            // Absent at base and mistyped-path look identical, so this is stated
            // rather than assumed either way. On the commit that INTRODUCES the
            // budget this is the correct and expected reading.
            raiseSkipReason = `${BUDGET_REL} does not exist at ${baseRef} — treated as the introducing change, so no raise is possible`;
        } else {
            let baseBudget: EstateBudget | null = null;
            try {
                baseBudget = JSON.parse(show.stdout) as EstateBudget;
            } catch {
                baseBudget = null;
            }
            if (baseBudget === null || baseBudget.baseline === undefined) {
                raiseSkipReason = `${BUDGET_REL} at ${baseRef} is unparseable — raise undetectable`;
            } else {
                const newest = (budget.baseline_history ?? []).at(-1) ?? {};
                for (const metric of METRICS) {
                    const before = baseBudget.baseline[metric];
                    const after = budget.baseline[metric];
                    if (typeof before !== 'number' || after <= before) continue;
                    const why = typeof newest.why === 'string' ? newest.why.trim() : '';
                    // The reason must belong to THIS raise: an entry that records a
                    // different number is an older reason being reused, which is the
                    // silent-reset shape RATCHET_RESET_KEY's header warns about.
                    const namesMetric = newest[metric] === after;
                    raises.push({ metric, from: before, to: after, reason: why !== '' && namesMetric ? why : null });
                }
            }
        }
    }

    // The diff half. A missing base ref is REPORTED rather than assumed empty:
    // guessing "nothing changed" is the same silent-pass this file's own header
    // argues against, and the count half above still ran.
    let offsets: OffsetLedger | null = null;
    let offsetSkipReason: string | null = null;
    if (baseRef === null || baseRef === undefined) {
        offsetSkipReason = 'no base ref resolved (no origin/main, no merge-commit parent) — one-in-one-out not evaluated';
    } else {
        const diff = git(
            ['diff', '--name-status', '--find-renames', `${baseRef}...HEAD`, '--', ROADMAPS_REL],
            repoRoot,
        );
        if (!diff.ok) {
            offsetSkipReason = `git diff against ${baseRef} failed — one-in-one-out not evaluated`;
        } else {
            offsets = classifyDiff(diff.stdout, (rel) => {
                try {
                    return fs.readFileSync(path.join(repoRoot, rel), 'utf-8');
                } catch {
                    return null;
                }
            });
        }
    }

    const threshold = budget.one_in_one_out?.applies_above_active ?? null;
    const lintApplies = threshold === null || counts.active_roadmaps > threshold;
    let unpaid = 0;
    if (offsets !== null && lintApplies) {
        const exemptFiles = new Set(offsets.exempt.map((e) => e.file));
        const chargeable = offsets.added.filter((f) => !exemptFiles.has(f));
        unpaid = Math.max(0, chargeable.length - offsets.offsets.length);
    }

    // A metric RAISED in this same change with a recorded reason is a deliberate
    // ceiling rather than an un-walked tightening — the raise is the reviewed act
    // the ratchet exists to permit, and without an exemption the failure below
    // would make a legal raise unsatisfiable, since a raise puts the baseline
    // above the live count by construction.
    //
    // BOUNDED at `to === live`, and the bound is the whole of it. Round 2 finding
    // 1: unbounded, the exemption re-opened the defect this change exists to
    // close, one commit later. A raise could bank arbitrary headroom and exit 0;
    // the NEXT change carries no raise, so nothing exempts the still-below-
    // baseline metric, and that change plus main fail on drift they did not
    // cause. Requiring the raise to land ON the measurement means every legal
    // state leaves `baseline == live`, so a later change cannot inherit the debt —
    // and an over-raise fails in the change that types it, which is the only
    // place anyone can act on it.
    //
    // A raise recorded WITHOUT a reason is not exempt at all; it already fails on
    // its own account below, and exempting it here would let the reason
    // requirement be skipped by overshooting.
    const boundedRaise = new Set(
        raises.filter((r) => r.reason !== null && r.to === counts[r.metric]).map((r) => r.metric),
    );

    // When the raise half could not run, the information that separates a
    // deliberate ceiling from forgotten headroom is ABSENT, so this check reports
    // rather than convicts — the same permissive reading the raise half itself
    // takes on the same missing input (round 2 finding 4). Failing here while the
    // raise half skips would refuse a legal reasoned raise with no green path,
    // and would treat one missing fact two opposite ways inside one gate.
    const tighteningProvable = raiseSkipReason === null;
    const unwalked = tighteningProvable ? tightened.filter((t) => !boundedRaise.has(t.metric)) : [];

    return {
        counts,
        baseline: budget.baseline,
        growth,
        tightened,
        unwalked,
        raises,
        raiseSkipReason,
        offsets,
        offsetSkipReason,
        unpaid,
        // `tightened` is a FAILURE, not an advisory, and this is the second thing
        // it has been. Until 2026-08-19 it printed "free tightening" and left
        // `withinBudget` true, while `check_estate_count.test.ts` asserted the
        // committed budget equals the live tree — so the gate and its own test
        // disagreed about the same state. The consequence was measured rather than
        // theorised: a drawdown PR passed `task preflight` locally (this gate,
        // exit 0) and reddened CI (that test, exit 1) every single time, and on
        // 2026-08-18 it reddened `main` itself in run 32173675197, after which
        // every subsequent PR failed on drift it had not caused. That is the
        // permanently-red shape the budget file's own `67 -> 69` history entry
        // describes from the other direction.
        //
        // Failing here is also the STRONGER reading of this gate's purpose: the
        // file says in as many words that a lower measurement is the new ceiling
        // and not headroom to spend later. A baseline left above the truth is
        // exactly that headroom, and a gate that only warns about it is how the
        // headroom survives to be spent.
        withinBudget:
            growth.length === 0 &&
            unpaid === 0 &&
            unwalked.length === 0 &&
            raises.every((r) => r.reason !== null),
    };
}

/** Floors for `--self-test`, declared here so a truncation is a visible diff. */
const SELF_TEST_MIN_CASES = 9;
const SELF_TEST_MIN_REJECT = 6;

/**
 * Prove, on demand, that this gate's rejections still fire against its own CLI.
 *
 * The vitest suite covers the same ground; this covers the binary a contributor
 * runs — argv parsing, the entry guard, and the git invocation, which unit tests
 * over imported functions cannot exercise. A ratchet whose detection silently
 * stopped matching reports "estate within its ratchet" forever, and that green is
 * believed precisely because a ratchet is expected to be quiet.
 */
function selfTest(): number {
    const repo = repoRootFrom(process.cwd());
    const script = path.join('src', 'scripts', 'check_estate_count.ts');
    const roots: string[] = [];

    /** A budget body; `why` is what makes a raise against the base ref legal. */
    const budgetJson = (active: number, later: number, why?: string): string => {
        const baseline = { active_roadmaps: active, later_roadmaps: later, open_blockers: 0 };
        return `${JSON.stringify(
            {
                baseline,
                ...(why === undefined ? {} : { baseline_history: [{ at: 'fixture', ...baseline, why }] }),
                one_in_one_out: { applies_above_active: null },
            },
            null,
            4,
        )}\n`;
    };

    const fixture = (opts: {
        roadmaps: number;
        baseline: { active: number; later: number };
        after: (dir: string) => void;
    }): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ec-selftest-'));
        roots.push(dir);
        const put = (rel: string, body: string): void => {
            fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(dir, rel), body, 'utf-8');
        };
        const g = (...args: string[]): void => {
            spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
        };
        g('init', '-q', '-b', 'main');
        g('config', 'user.email', 'selftest@local');
        g('config', 'user.name', 'selftest');
        g('config', 'commit.gpgsign', 'false');
        for (let i = 0; i < opts.roadmaps; i++) {
            put(`agents/roadmaps/road-to-${String(i)}.md`, `# Roadmap: R${String(i)}\n\n## Phase 1\n\n- [ ] **1.1** s\n`);
        }
        put('src/config/estate-count-budget.json', budgetJson(opts.baseline.active, opts.baseline.later));
        g('add', '-A');
        g('commit', '-qm', 'base');
        g('checkout', '-qb', 'feat/x');
        opts.after(dir);
        g('add', '-A');
        g('commit', '-qm', 'change');
        return runGateCli(repo, script, ['--base', 'main'], dir);
    };

    const write = (dir: string, rel: string, body: string): void => {
        fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), body, 'utf-8');
    };

    const cases: SelfTestCase[] = [
        {
            name: 'baseline match → accept',
            expect: 'accept',
            run: () => fixture({ roadmaps: 3, baseline: { active: 3, later: 0 }, after: () => undefined }),
        },
        {
            name: 'active count grows past the baseline → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    baseline: { active: 3, later: 0 },
                    after: (dir) => write(dir, 'agents/roadmaps/road-to-new.md', '# Roadmap: N\n\n## Phase 1\n\n- [ ] **1.1** s\n'),
                }),
        },
        {
            name: 'addition with no offset in the same change → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    // Baseline is 4 AT THE BASE COMMIT, not raised on the branch, so
                    // the ratchet and raise halves both pass and only the offset
                    // half can fail — otherwise this case would pass for another
                    // check's reason.
                    roadmaps: 3,
                    baseline: { active: 4, later: 0 },
                    after: (dir) => write(dir, 'agents/roadmaps/road-to-new.md', '# Roadmap: N\n\n## Phase 1\n\n- [ ] **1.1** s\n'),
                }),
        },
        {
            // The bypass an R2 review found in the first version: the estate is
            // untouched and only the NUMBER moves, which satisfies the growth half
            // by construction. Proven at the CLI, because the working-tree read
            // that allowed it was in the CLI's own evaluate().
            name: 'baseline raised with no recorded reason → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    baseline: { active: 3, later: 0 },
                    after: (dir) => write(dir, 'src/config/estate-count-budget.json', budgetJson(9, 9)),
                }),
        },
        {
            // Round 2 finding 1: this case used to expect ACCEPT, which pinned an
            // over-raise of +6 as legal. A reason makes a raise reviewable; it does
            // not make banked headroom safe, and the banked headroom is inherited by
            // the next change, where nobody can act on it.
            name: 'raise WITH a reason but overshooting the measurement → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    baseline: { active: 3, later: 0 },
                    after: (dir) =>
                        write(
                            dir,
                            'src/config/estate-count-budget.json',
                            budgetJson(9, 9, 'fixture: a deliberate re-baseline, recorded so the ratchet can see it'),
                        ),
                }),
        },
        {
            // The green path the bound must leave open, or the exemption would be
            // unsatisfiable and a legal raise impossible. The addition carries
            // `estate_offset_exempt` so the one-in-one-out half cannot be the reason
            // this case passes or fails.
            name: 'raise WITH a reason landing ON the measurement → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    roadmaps: 3,
                    baseline: { active: 3, later: 0 },
                    after: (dir) => {
                        write(
                            dir,
                            'agents/roadmaps/road-to-new.md',
                            '---\nestate_offset_exempt: fixture — isolates the raise half from one-in-one-out\n---\n\n# Roadmap: N\n\n## Phase 1\n\n- [ ] **1.1** s\n',
                        );
                        write(
                            dir,
                            'src/config/estate-count-budget.json',
                            budgetJson(4, 0, 'fixture: raised to the measurement, which is what a bounded raise looks like'),
                        );
                    },
                }),
        },
        {
            // Round 2 finding 11: the rejection class this change adds had no
            // contributor-facing case, so the truncation floor could not notice it
            // going missing — which is the whole job of this self-test.
            name: 'count below baseline with no raise → reject (un-walked tightening)',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    baseline: { active: 3, later: 0 },
                    after: (dir) => fs.rmSync(path.join(dir, 'agents/roadmaps/road-to-2.md')),
                }),
        },
        {
            name: 'addition paid for by an archive move → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    roadmaps: 3,
                    baseline: { active: 3, later: 0 },
                    after: (dir) => {
                        write(dir, 'agents/roadmaps/road-to-new.md', '# Roadmap: N\n\n## Phase 1\n\n- [ ] **1.1** s\n');
                        fs.mkdirSync(path.join(dir, 'agents/roadmaps/archive'), { recursive: true });
                        spawnSync('git', ['mv', 'agents/roadmaps/road-to-2.md', 'agents/roadmaps/archive/road-to-2.md'], {
                            cwd: dir,
                            encoding: 'utf-8',
                        });
                    },
                }),
        },
        {
            name: 'emptied roadmap root → reject (dead scope, not a pass)',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 1,
                    baseline: { active: 0, later: 0 },
                    after: (dir) => fs.rmSync(path.join(dir, 'agents/roadmaps/road-to-0.md')),
                }),
        },
    ];

    try {
        return runSelfTest({
            gate: GATE,
            cases,
            minCases: SELF_TEST_MIN_CASES,
            minRejectCases: SELF_TEST_MIN_REJECT,
        });
    } finally {
        for (const dir of roots) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    const json = argv.includes('--json') || argv.includes('--format=json');
    const baseIdx = argv.indexOf('--base');
    let baseRef: string | undefined;
    if (baseIdx !== -1) {
        const next = argv[baseIdx + 1];
        // `--base --json` used to take `--json` as the ref, which then failed as
        // a git revision and silently downgraded both halves to "unproven".
        if (next === undefined || next.startsWith('-')) {
            process.stderr.write('usage: check_estate_count [--base <ref>] [--json] [--self-test]\n');
            return 2;
        }
        baseRef = next;
    }
    const repoRoot = repoRootFrom(process.cwd());

    let verdict: EstateVerdict;
    try {
        verdict = evaluate(repoRoot, { baseRef });
    } catch (err) {
        process.stderr.write(`❌  ${GATE}: ${(err as Error).message}\n`);
        return 2;
    }

    // A ratchet over an empty estate always passes. Move `agents/roadmaps/` and
    // every count is 0, which is trivially under any baseline — exit 2 (could
    // not run), never 1, which would assert the estate actually grew.
    try {
        reportScanned(
            {
                gate: GATE,
                scanned: verdict.counts.active_roadmaps + verdict.counts.later_roadmaps,
                units: 'roadmap file(s)',
                roots: [ROADMAPS_REL, path.join(ROADMAPS_REL, 'later')],
            },
            // In `--json` the line goes to stderr, so stdout really is one JSON
            // document. `reportScanned` defaults to stdout because CI passes
            // `--quiet` to most gates and a count only visible without it is not
            // a count; this gate's CI argv carries no `--json`, so the default
            // path is unaffected. Same override, same reason, as
            // check_review_prompt_binding.
            json ? (chunk: string) => process.stderr.write(chunk) : undefined,
        );
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${GATE}: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    const ledger = new GateLedger(GATE);
    ledger.plan([...METRICS, 'baseline_raise', 'one_in_one_out']);
    for (const metric of METRICS) {
        const bad = verdict.growth.find((g) => g.metric === metric);
        // Round 2 finding 3: the un-walked-tightening class exited 1 while this
        // loop reported every metric complete, so the ledger — the stderr audit
        // surface, and the only one `--json` carries — showed a fully green
        // completeness record beside a red exit. A metric is recorded once, here,
        // for whichever way it actually failed.
        const stale = verdict.unwalked.find((t) => t.metric === metric);
        if (bad !== undefined) ledger.fail(metric, `${metric} grew ${bad.baseline} → ${bad.live}`);
        else if (stale !== undefined)
            ledger.fail(metric, `${metric} un-walked: ${stale.live} under a baseline of ${stale.baseline}`);
        else ledger.complete(metric);
    }
    const unreasoned = verdict.raises.filter((r) => r.reason === null);
    if (verdict.raiseSkipReason !== null) ledger.skip('baseline_raise', 'precondition_unmet');
    else if (unreasoned.length > 0)
        ledger.fail('baseline_raise', `${String(unreasoned.length)} raise(s) with no recorded reason`);
    else ledger.complete('baseline_raise');
    if (verdict.offsets === null) ledger.skip('one_in_one_out', 'precondition_unmet');
    else if (verdict.unpaid > 0) ledger.fail('one_in_one_out', `${String(verdict.unpaid)} unpaid addition(s)`);
    else ledger.complete('one_in_one_out');

    if (json) {
        // The ledger goes to stderr here so stdout stays parseable after the
        // mandatory `scanned:` line — a JSON mode whose stdout needs a second
        // parser is not a machine-readable mode.
        ledger.report((chunk) => process.stderr.write(chunk));
        process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
        return verdict.withinBudget ? 0 : 1;
    }

    for (const metric of METRICS) {
        const live = verdict.counts[metric];
        const base = verdict.baseline[metric];
        const delta = live - base;
        const sign = delta >= 0 ? '+' : '';
        process.stdout.write(
            `  ${metric.padEnd(18)} ${String(live).padStart(5)}  (baseline ${String(base)}, ${sign}${String(delta)})\n`,
        );
    }
    if (verdict.offsets !== null) {
        const o = verdict.offsets;
        process.stdout.write(
            `  ${'this change'.padEnd(18)}  +${String(o.added.length)} active / -${String(o.offsets.length)} disposed` +
                `${o.exempt.length > 0 ? `, ${String(o.exempt.length)} exempt` : ''}\n`,
        );
    } else if (verdict.offsetSkipReason !== null) {
        process.stdout.write(`  ⚠️  ${verdict.offsetSkipReason}\n`);
    }
    if (verdict.raiseSkipReason !== null) {
        process.stdout.write(`  ⚠️  ${verdict.raiseSkipReason}\n`);
    }
    for (const r of verdict.raises.filter((x) => x.reason !== null)) {
        process.stdout.write(
            `  ↑ baseline raised with a recorded reason: ${r.metric} ${String(r.from)} → ${String(r.to)}\n` +
                `    ${(r.reason as string).slice(0, 120)}\n`,
        );
    }

    for (const t of verdict.unwalked) {
        process.stderr.write(
            `❌  un-walked tightening: ${t.metric} measured ${String(t.live)} under a baseline of ${String(t.baseline)}.\n` +
                `    Walk the baseline down in ${BUDGET_REL} — a lower measurement is the new ceiling,\n` +
                '    not headroom to spend later. This is a one-number edit plus one appended\n' +
                '    `baseline_history` entry, and it belongs in the change that earned the lower\n' +
                '    measurement. Failing here rather than warning is deliberate: this gate and\n' +
                "    `check_estate_count.test.ts` used to disagree about this exact state, so a\n" +
                '    drawdown passed preflight and reddened CI — and once it reached the trunk,\n' +
                '    every later PR failed on drift it had not caused.\n',
        );
    }

    for (const g of verdict.growth) {
        process.stderr.write(
            `❌  the roadmap estate grew: ${g.metric} ${String(g.baseline)} → ${String(g.live)}.\n` +
                '    The estate does not walk down by itself, which is the defect this ratchet\n' +
                `    exists for. Either close/park/archive enough to get back under the baseline, or\n` +
                `    raise it in ${BUDGET_REL} with the reason written as a real sentence in the\n` +
                '    same commit — a number change on its own is what a ratchet is built to refuse.\n',
        );
    }
    for (const r of unreasoned) {
        process.stderr.write(
            `❌  baseline raised with no recorded reason: ${r.metric} ${String(r.from)} → ${String(r.to)}.\n` +
                `    Read from the base ref, so editing the number in this commit cannot hide it —\n` +
                '    which is the whole difference between a ratchet and a number. A raise is legal,\n' +
                `    and it costs one appended \`baseline_history\` entry in ${BUDGET_REL} carrying\n` +
                `    \`"${r.metric}": ${String(r.to)}\` and a \`why\` written as a real sentence.\n`,
        );
    }
    if (verdict.unpaid > 0 && verdict.offsets !== null) {
        process.stderr.write(
            `❌  ${String(verdict.unpaid)} new active roadmap(s) with no offset in the same change.\n` +
                `    added:    ${verdict.offsets.added.join(', ')}\n` +
                `    disposed: ${verdict.offsets.offsets.length > 0 ? verdict.offsets.offsets.join(', ') : '(none)'}\n` +
                '    One-in-one-out (estate-drawdown T3): a change that adds an active roadmap\n' +
                '    archives, parks or merges one in the same change. If this addition genuinely\n' +
                '    cannot be offset, add `estate_offset_exempt: <reason>` to its frontmatter —\n' +
                '    that costs one reviewable line instead of a silent exception.\n',
        );
    }
    ledger.report();
    if (verdict.withinBudget) {
        process.stdout.write(`✅  ${GATE}: estate within its ratchet.\n`);
    }
    return verdict.withinBudget ? 0 : 1;
}

function isCliEntry(): boolean {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    return pathToFileURL(path.resolve(entry)).href === pathToFileURL(fileURLToPath(import.meta.url)).href;
}

if (isCliEntry()) {
    process.exit(main());
}
