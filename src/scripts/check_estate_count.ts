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
 * **T2, the ratchet.** The floor is not stored — it is MEASURED on the base
 * ref's own tree, with the same functions that measure HEAD. Growth in any gated
 * count above that floor is a policy failure (exit 1) naming the metric, the
 * floor and the live number. A count BELOW the floor is a drawdown and simply
 * passes: there is no stored number left to leave stale.
 *
 * Changed 2026-08-22 (ADR-243). Until then the floor lived in
 * `src/config/estate-count-budget.json` as a committed `baseline` object, and
 * that made the file the most-conflicted non-generated path in the repository —
 * 7 of 7 `CONFLICTING` open PRs on 2026-08-21, and 39 of 43 non-merge commits in
 * a 60-day window moving it. Two whole failure classes came from the storage
 * rather than from the policy, and both are now unrepresentable: a baseline left
 * ABOVE the truth (headroom a later change could spend, which this file used to
 * fail on as an "un-walked tightening"), and a baseline left BELOW it when main
 * archived a roadmap without walking the number, which reddened every branch
 * that merged main. The budget file's own final history entry recorded exactly
 * that incident.
 *
 * What the storage did buy was an authorisation path for legitimate growth: a
 * raise carrying a recorded reason. That is replaced by
 * `estate_growth_exempt: <reason>`, a frontmatter line that must be ADDED in the
 * change that needs it — see § THE THREE WAYS THE ESTATE MAY LEGITIMATELY GROW.
 *
 * **T3, one-in-one-out.** A change that adds an active roadmap archives, parks
 * or merges one in the same change — or the added file carries an explicit
 * `estate_offset_exempt:` reason in its frontmatter, which costs a visible line
 * in the diff of the very commit that claims it. This half is diff-scoped: it
 * reads `<base>...HEAD` over `agents/roadmaps/`, so on a branch that adds no  code-comment-allow provenance-comment -- the path is this script's operand, not where the code came from
 * roadmap it legitimately finds nothing to weigh.
 *
 * THE THREE WAYS THE ESTATE MAY LEGITIMATELY GROW
 * -----------------------------------------------
 * A floor measured off the base ref is exact, so unlike a lagging stored number
 * it leaves no incidental headroom. Every legitimate increase therefore needs a
 * named path, and there are three:
 *
 * 1. **An addition that cannot be offset** — `estate_offset_exempt: <reason>` in
 *    the added roadmap's frontmatter, unchanged from T3. It now also raises the
 *    `active_roadmaps` allowance by one, because under an exact floor the
 *    addition would otherwise fail the count half with no green path.
 * 2. **Parking** — a roadmap moved from the active top level into `later/` in the
 *    same change raises the `later_roadmaps` allowance by one. Parking relocates
 *    estate rather than creating it, so it needs no authorisation; what the
 *    allowance does NOT cover is a `later/` file appearing from nowhere.
 * 3. **Anything else** — `estate_growth_exempt: <reason>` added, in this change,
 *    to the frontmatter of any roadmap under `agents/roadmaps/`. The canonical  code-comment-allow provenance-comment -- the path is this script's operand, not where the code came from
 *    case is a blocker discovered while doing the work: `open_blockers` rises,
 *    nothing was archived, and the reason belongs next to the blocker.
 *
 * Two properties of that third path are load-bearing. It is **diff-scoped**: the
 * line must be ADDED between base and HEAD, so a claim cannot be left in a file
 * to authorise every later change — the banking failure a stored baseline had.
 * And it is deliberately **unbounded**, which the stored baseline could not
 * afford: a raise there had to land exactly on the measurement or the surplus was
 * inherited by the next change, where nobody could act on it. Here the next
 * change's floor IS this change's measurement, so there is no surplus to inherit
 * and a bound would buy nothing.
 *
 * WHY THE FLOOR IS MAIN'S TIP AND NOT THE MERGE BASE
 * --------------------------------------------------
 * The floor is measured at the base ref's TIP, so a branch that is behind main
 * reads as growth until it syncs. That is deliberate, and the alternative is
 * worse: against the merge base, two branches each adding one roadmap are both
 * green and main ends up two higher than either of them ever measured. A ratchet
 * whose floor is a common ancestor is not a ratchet on the trunk.
 *
 * On a GitHub PR build this costs nothing — the checkout IS the merge result and
 * `resolveBaseRef` returns `HEAD^1`, the base tip, so the comparison is
 * merged-tree against current main. Locally, a stale branch reads as growth it
 * did not cause, and the remedy is the sync it already owed. Note what that
 * replaced: the stored baseline produced the same obligation as a MERGE CONFLICT
 * in a config file, resolved by hand, four times in one afternoon on
 * 2026-08-21 — and resolved wrongly it silently returned another change's
 * drawdown.
 *
 * WHY A MISSING BASE REF FAILS RATHER THAN SKIPS
 * ---------------------------------------------
 * `resolveBaseRef` has a ladder (origin/main, then the merge commit's first
 * parent) precisely because the obvious answer is unavailable on a shallow PR
 * build. When it still resolves nothing there is no floor at all, and a
 * shrink-only gate with no floor passes everything — so this exits 1 and says
 * so, rather than reporting a green it cannot back. `--base <ref>` is the
 * explicit escape, and it is what the self-test fixtures use. Deliberately NOT
 * gated on `CI`/`GITHUB_ACTIONS`: a gate that convicts on the runner and waves
 * locally teaches contributors that its red is an environment artefact.
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
 * The same function measures the BASE side, over a scratch copy of the base
 * ref's `agents/roadmaps/` (`_lib/base_tree.ts`). Re-deriving the floor with a  code-comment-allow provenance-comment -- the path is this script's operand, not where the code came from
 * second implementation would let the two sides disagree about one tree, which
 * is the failure this section already argues against, one level up.
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
import { materialiseSubtree } from './_lib/base_tree.js';
import { SKILLS_POSIX, measureSkillEstate } from './_lib/skill_estate.js';
import { CONCERN_MANIFEST_POSIX, countConcerns } from './_lib/concern_estate.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';

const GATE = 'check_estate_count';
const BUDGET_REL = path.join('src', 'config', 'estate-count-budget.json');
const ROADMAPS_REL = path.join('agents', 'roadmaps');
/**
 * The same path as a git pathspec.
 *
 * `ROADMAPS_REL` is `path.sep`-joined for filesystem reads; a pathspec must be
 * POSIX or it matches nothing on Windows — silently, and a pathspec matching
 * nothing is how the floor becomes zero.
 */
const ROADMAPS_POSIX = 'agents/roadmaps';

/** The three gated counts. Each is a metric the budget file defines in prose. */
export interface EstateCounts {
    active_roadmaps: number;
    later_roadmaps: number;
    open_blockers: number;
    /**
     * Maintained `SKILL.md` files — `lifecycle: deprecated` excluded.
     *
     * A FOURTH corpus on the same machinery, added 2026-08-24 on AI council 2/2
     * over the alternative of a second budget file and a second gate: the
     * floor-from-the-base-ref machinery is the expensive part and should not be
     * written twice, and a second ratchet is a second place to forget.
     */
    skill_count: number;
    /**
     * Exact-BPE tokens across those skills' `description:` fields.
     *
     * The second DIMENSION, not a companion figure. A count ratchet alone is
     * gameable by merging four large skills into one file: the count falls, the
     * payload a host must carry does not. `0` here means UNRESOLVED, never
     * "no tokens" — see `tokensExact`.
     */
    skill_description_tokens: number;
    /**
     * Hook concerns declared in `src/scripts/hook_manifest.yaml`.
     *
     * A FIFTH corpus on the same machinery, and the same argument that admitted
     * skills: the floor-from-the-base-ref work is the expensive part and should
     * not be written a third time, and a separate ratchet is a separate place to
     * forget.
     *
     * Read with the SCOPED parser in `_lib/concern_estate.ts`, not the
     * whole-file grep the originating roadmap reproduces its series with. That
     * grep over-counts by exactly 16 at every one of its six pins, because
     * `roles:`, `platforms:` and `native_event_aliases:` sit at the same indent.
     * The growth finding survives the correction — the delta is constant — but
     * the absolute figure does not: the axis stands at 55, not 71, and a floor
     * of 71 is one this gate's own parser could never reproduce.
     */
    concern_count: number;
}

export type MetricName = keyof EstateCounts;

export const METRICS: readonly MetricName[] = [
    'active_roadmaps',
    'later_roadmaps',
    'open_blockers',
    'skill_count',
    'skill_description_tokens',
    'concern_count',
];

export interface EstateBudget {
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
    /**
     * The capped provisional-promotion path — specified, and DECLINED.
     *
     * READ ITS NULLS THE OTHER WAY ROUND FROM THE KEY ABOVE. There `null` means
     * UNCONDITIONAL; here `max_live: null` and `expires_after_days: null` mean
     * NOT REGISTERED, PATH INACTIVE. The two keys sit a few lines apart in one
     * file and their nulls mean opposite things, so a reader who transfers the
     * sibling's semantics reads a declined path as an uncapped one.
     */
    provisional_promotion: ProvisionalPromotion;
}

/**
 * The `provisional_promotion` object as the budget file carries it.
 *
 * `status` is optional so that a file which registered the two integers without
 * restating a status is still readable — the integers are what activate the
 * path, and a declination that dropped its own marker would fall to
 * `unregistered`, which is the safe direction.
 */
export interface ProvisionalPromotion {
    status?: string;
    max_live: number | null;
    expires_after_days: number | null;
}

/**
 * Three states, and the reason there are three rather than two.
 *
 * The 2026-09-01 council that declined the path attached one obligation to the
 * decline: the checker must distinguish an intentional declination from missing
 * configuration. Two states cannot — `null` would read the same either way, and
 * "nobody has written this yet" would be indistinguishable from "this was
 * specified in full and refused on 2026-09-01".
 */
export type ProvisionalPromotionState = 'declined' | 'unregistered' | 'registered';

/**
 * Classify the path's state. NEVER activates it, in any state.
 *
 * A half-registered object — one integer, one null — throws rather than
 * resolving to either neighbour: a cap with no expiry and an expiry with no cap
 * are different mechanisms, and guessing which half was meant is how a bounded
 * path becomes an unbounded one by omission.
 */
export function provisionalPromotionState(pp: ProvisionalPromotion): ProvisionalPromotionState {
    const live = pp.max_live;
    const days = pp.expires_after_days;
    if (typeof live === 'number' && typeof days === 'number') return 'registered';
    if ((live === null) !== (days === null)) {
        throw new Error(
            `${BUDGET_REL} "provisional_promotion" is half-registered ` +
                `(max_live=${JSON.stringify(live)}, expires_after_days=${JSON.stringify(days)}). ` +
                'Both integers activate the path; both null leave it inactive. One of each is neither.',
        );
    }
    return pp.status === 'declined' ? 'declined' : 'unregistered';
}

/** One gated count that rose above the floor measured at the base ref. */
export interface GrowthFinding {
    metric: MetricName;
    /** The base ref's own measurement — never a number anyone typed. */
    floor: number;
    live: number;
    /** Growth this change may make without an `estate_growth_exempt` claim. */
    allowance: number;
}

/** How a change touched the active roadmap tree, as git reports it. */
export interface OffsetLedger {
    /** Files that entered the active top level: new files, and un-parked ones. */
    added: string[];
    /** Files that left it: deleted, archived, parked or merged away. */
    offsets: string[];
    /** Added files carrying an `estate_offset_exempt:` reason, with the reason. */
    exempt: Array<{ file: string; reason: string }>;
    /**
     * The subset of `offsets` that went to `later/`.
     *
     * Tracked separately because parking is the one offset that RAISES another
     * gated count: active falls by one and later rises by one, which under an
     * exact floor is growth in `later_roadmaps` unless this allowance exists.
     * Kept out of a general "any offset raises any allowance" rule on purpose —
     * an archived roadmap must not buy a new `later/` file.
     */
    parked: string[];
}

/** An `estate_growth_exempt:` reason ADDED to a roadmap in this change. */
export interface GrowthClaim {
    /** The roadmap the claim was added to, as git reports the path. */
    file: string;
    reason: string;
}

export interface EstateVerdict {
    counts: EstateCounts;
    /** The base ref's measurement, or `null` when it could not be taken. */
    floor: EstateCounts | null;
    /** The ref the floor was measured at, for the reader and for `--json`. */
    floorRef: string | null;
    /** `null` when the floor was measured; a stated reason otherwise. */
    floorSkipReason: string | null;
    /** Growth with no allowance and no claim covering it — this is what fails. */
    growth: GrowthFinding[];
    /**
     * Growth an `estate_growth_exempt` claim authorised.
     *
     * Reported rather than dropped: a `--json` consumer must be able to tell
     * "nothing grew" from "something grew and a claim covered it", which is the
     * same distinction the old verdict kept `tightened` whole for.
     */
    authorisedGrowth: GrowthFinding[];
    /** The claims found in this change's diff, with their reasons. */
    claims: GrowthClaim[];
    /**
     * Metrics dropped from the compare, each with its reason.
     *
     * Never empty-and-silent: a skill metric drops when the base ref carries no
     * `src/skills` (an old tag, a shallow clone) or when the tokeniser resolved
     * on one side and not the other. Comparing an exact reading against a proxy
     * one would move the number by more than the growth this gate exists to
     * catch, so the metric is stated unavailable rather than guessed.
     */
    skippedMetrics: { metric: MetricName; reason: string }[];
    /** `null` when the diff half could not run; the reason is printed either way. */
    offsets: OffsetLedger | null;
    offsetSkipReason: string | null;
    unpaid: number;
    /**
     * The provisional-promotion path's state, reported and never acted on.
     *
     * Carried in the verdict so a `--json` consumer can tell a declined path
     * from an unwritten one without re-reading the budget file, which is the
     * distinction the 2026-09-01 decline was conditioned on. It contributes
     * nothing to `withinBudget` in any state: reading is not activation.
     */
    provisionalPromotion: ProvisionalPromotionState;
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

/** File contents, or `null` when it is absent. Absent is a real state here. */
function readIfPresent(file: string): string | null {
    try {
        return fs.readFileSync(file, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Concern count at a git ref, or `null` when the manifest is unreadable there.
 *
 * `null` is NOT zero, and the distinction is the whole reason this returns an
 * option. A missing manifest read as 0 makes the floor 0, which makes the
 * ratchet inert on that path while still printing a green line — "a gate that
 * read nothing has not passed", in this repository's own words. The caller
 * turns `null` into a floor-skip, which this gate already treats as a failure.
 */
function concernCountAt(repoRoot: string, ref: string): number | null {
    const res = git(['show', `${ref}:${CONCERN_MANIFEST_POSIX}`], repoRoot);
    return res.ok ? countConcerns(res.stdout) : null;
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
    const skills = measureSkillEstate(repoRoot);
    return {
        active_roadmaps: stats.length,
        later_roadmaps: countIn(roadmapRoot, 'later'),
        open_blockers: openOf(stats) + openOf(laterRoadmaps(roadmapRoot)),
        skill_count: skills.skill_count,
        // 0 stands for unresolved. `skillTokensExact` below is what the caller
        // reads to tell that apart from a genuinely empty corpus, and the
        // verdict skips the metric rather than comparing an exact reading
        // against a proxy one — they differ by more than the growth a ratchet
        // is trying to catch.
        skill_description_tokens: skills.skill_description_tokens ?? 0,
        concern_count: countConcerns(readIfPresent(path.join(repoRoot, CONCERN_MANIFEST_POSIX)) ?? ''),
    };
}

/** Did the tokeniser resolve under `root`? A ratchet must not mix the two modes. */
export function skillTokensExact(root: string): boolean {
    return measureSkillEstate(root).skill_description_tokens !== null;
}

/** `agents/roadmaps/<name>.md` — the active top level, never a subdirectory. */  code-comment-allow provenance-comment -- the path is this script's operand, not where the code came from
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

/** A roadmap parked for later — the one disposition that grows another count. */
function isParked(rel: string): boolean {
    return rel.split(path.sep).join('/').startsWith('agents/roadmaps/later/');
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

/** True when `text` is a roadmap whose frontmatter declares `status: carrier`. */
export function isCarrierText(text: string | null): boolean {
    if (text === null) return false;
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (fm === null) return false;
    return /^status:[ \t]*carrier[ \t]*$/m.test(fm[1] ?? '');
}

/**
 * Classify the change's effect on the active roadmap tree.
 *
 * Renames carry information a name-only diff loses: `road-to-x.md` →
 * `archive/road-to-x.md` is the wanted direction and counts as an offset, while
 * `later/road-to-x.md` → `road-to-x.md` is an un-parking and counts as an
 * addition. A top-level-to-top-level rename is neither.
 */
export function classifyDiff(
    nameStatus: string,
    readFile: (rel: string) => string | null,
    /**
     * The file's content at the BASE ref, for paths this change removed.
     *
     * Needed because a deleted carrier cannot be read from the working tree,
     * and its status is the whole question: deleting a roadmap normally earns an
     * offset, and a carrier holds obligations lifted out of an already-archived
     * parent, so paying a credit for removing one rewards the loss. Defaults to
     * returning null, which reproduces the previous behaviour exactly — a caller
     * that cannot supply a pre-image keeps the old scoring rather than silently
     * getting a different answer.
     */
    readBase: (rel: string) => string | null = () => null,
): OffsetLedger {
    const added: string[] = [];
    const offsets: string[] = [];
    const exempt: Array<{ file: string; reason: string }> = [];
    const parked: string[] = [];
    for (const line of nameStatus.split('\n')) {
        if (line.trim() === '') continue;
        const cols = line.split('\t');
        const status = (cols[0] ?? '').trim();
        if (status.startsWith('R') || status.startsWith('C')) {
            const from = cols[1] ?? '';
            const to = cols[2] ?? '';
            if (isActiveTopLevel(from) && isDisposed(to)) {
                if (!isCarrierText(readBase(from))) {
                    offsets.push(from);
                    if (isParked(to)) parked.push(to);
                }
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
            // A carrier's removal is never an offset. See `readBase`.
            if (!isCarrierText(readBase(file))) {
                offsets.push(file);
            }
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
    return { added, offsets, exempt, parked };
}

/**
 * The `estate_growth_exempt:` reasons this change ADDS, read from the patch.
 *
 * Read from the diff rather than from the file, and that is the point: a claim
 * sitting in a roadmap authorises nothing on a later change, so an exemption
 * cannot be banked the way surplus in a stored baseline could. It also means a
 * newly added roadmap and an edited one need no separate handling — in a
 * `base...HEAD` patch both arrive as `+` lines.
 *
 * `--unified=0` keeps context lines out, so a claim that merely sits NEAR an
 * edited line is not read as added. Deliberately tolerant of leading whitespace
 * and of quoted values, matching `exemptionReason`; deliberately NOT tolerant of
 * an empty reason, because an exemption whose reason is blank is the silent
 * exception the key exists to replace.
 */
export function growthClaims(patch: string): GrowthClaim[] {
    const out: GrowthClaim[] = [];
    let file = '';
    for (const line of patch.split('\n')) {
        // `+++ b/<path>` names the file the following `+` lines belong to. The
        // `/dev/null` form is a deletion, which cannot carry a claim.
        const head = /^\+\+\+ b\/(.+)$/.exec(line);
        if (head !== null) {
            file = (head[1] ?? '').trim();
            continue;
        }
        if (!line.startsWith('+') || line.startsWith('+++')) continue;
        const m = /^\+\s*estate_growth_exempt:\s*(.+?)\s*$/.exec(line);
        if (m === null) continue;
        const reason = (m[1] ?? '').trim().replace(/^["']|["']$/g, '').trim();
        if (reason !== '') out.push({ file, reason });
    }
    return out;
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
    // The file no longer carries a number, so it carries only policy — and a
    // missing policy object is still a could-not-run rather than a pass. A gate
    // that treats an unreadable config as "nothing to enforce" is the silent-pass
    // shape this file argues against everywhere else.
    if (budget.one_in_one_out === undefined) {
        throw new Error(`${BUDGET_REL} carries no "one_in_one_out" object.`);
    }
    // Same shape, same reason: an absent policy object is a could-not-run, not a
    // pass. Here it also carries a second job — with the key required, "the path
    // was declined on 2026-09-01" and "nobody has configured this" cannot
    // collapse into the same reading, which is the condition the council
    // attached to the decline.
    if (budget.provisional_promotion === undefined) {
        throw new Error(
            `${BUDGET_REL} carries no "provisional_promotion" object. ` +
                'Absent is misconfiguration, never an inactive path — a declination is recorded, not implied.',
        );
    }
    const provisionalPromotion = provisionalPromotionState(budget.provisional_promotion);

    const counts = countEstate(repoRoot);
    const baseRef = opts.baseRef ?? resolveBaseRef(repoRoot);

    // The FLOOR — measured, never read. `git show <ref>:<path>` gave the old
    // stored number the one property that made it a ratchet: the change under
    // review cannot rewrite the base side. The base ref's TREE has that same
    // property, and unlike a number nobody has to remember to update it.
    let floor: EstateCounts | null = null;
    let floorSkipReason: string | null = null;
    /**
     * Does the WORKING TREE carry a manifest at all?
     *
     * The base-ref read only matters when it does. A repository with no manifest
     * on either side has no concern axis to ratchet, and failing there would
     * turn every unrelated fixture red — which is how the first version of this
     * clause was caught.
     */
    const headHasManifest = fs.existsSync(path.join(repoRoot, CONCERN_MANIFEST_POSIX));
    /** Set when the base ref carries no `src/skills` — the skill metrics drop. */
    let skillFloorSkipReason: string | null = null;
    /** Set when either side's tokeniser did not resolve — that ONE metric drops. */
    let skillTokenSkipReason: string | null = null;
    if (!skillTokensExact(repoRoot)) {
        skillTokenSkipReason =
            'the tokeniser did not resolve at HEAD; an exact reading may not be compared ' +
            'against a proxy one';
    }
    if (baseRef === null || baseRef === undefined) {
        floorSkipReason =
            'no base ref resolved (no origin/main, no merge-commit parent) — the floor cannot be measured';
    } else {
        const base = materialiseSubtree(repoRoot, baseRef, ROADMAPS_POSIX);
        // TWO subtrees, because the estate now spans two corpora and the floor
        // must be measured on the base ref's own tree for BOTH. Materialised
        // separately rather than widening the first call: `materialiseSubtree`
        // takes one prefix, and the roadmap tree must stay readable even when
        // the skills read fails (a `src/skills`-less base ref is a real state —
        // an old tag, a shallow clone), in which case the skill metrics skip and
        // the roadmap metrics still ratchet.
        const baseSkills = materialiseSubtree(repoRoot, baseRef, SKILLS_POSIX);
        try {
            if (base.error !== null || base.files === 0) {
                floorSkipReason = `could not read ${ROADMAPS_POSIX} at ${baseRef} — ${base.error ?? 'no files'}`;
            } else {
                const roadmapFloor = countEstate(base.root);
                if (baseSkills.error !== null || baseSkills.files === 0) {
                    // Roadmap floor stands; the skill floor is stated as
                    // unavailable and its metrics are dropped from the compare.
                    const cf = concernCountAt(repoRoot, baseRef);
                    floor = { ...roadmapFloor, concern_count: cf ?? 0 };
                    if (cf === null && headHasManifest) {
                        floorSkipReason =
                            `could not read ${CONCERN_MANIFEST_POSIX} at ${baseRef} while HEAD ` +
                            'carries one. A floor of 0 would make the concern ratchet inert while ' +
                            'still printing green, so this fails rather than skips.';
                    }
                    skillFloorSkipReason =
                        `could not read ${SKILLS_POSIX} at ${baseRef} — ` +
                        `${baseSkills.error ?? 'no files'}`;
                } else {
                    const s = measureSkillEstate(baseSkills.root);
                    floor = {
                        ...roadmapFloor,
                        skill_count: s.skill_count,
                        skill_description_tokens: s.skill_description_tokens ?? 0,
                        // A SINGLE FILE, so `git show` rather than a third
                        // `materialiseSubtree` — stated because the roadmap asks
                        // which of the two this uses. Materialising a subtree to
                        // reach one known path would spend a temp tree and a
                        // recursive ls-tree on a `git cat-file` in disguise.
                        //
                        // `?? 0` never stands for "unreadable": the branch below
                        // turns that into a floor-skip, which fails. This
                        // coalesce only satisfies the type.
                        concern_count: concernCountAt(repoRoot, baseRef) ?? 0,
                    };
                    if (concernCountAt(repoRoot, baseRef) === null && headHasManifest) {
                        floorSkipReason =
                            `could not read ${CONCERN_MANIFEST_POSIX} at ${baseRef} while HEAD ` +
                            'carries one. A floor of 0 would make the concern ratchet inert while ' +
                            'still printing green, so this fails rather than skips.';
                    }
                    if (s.skill_description_tokens === null) {
                        skillTokenSkipReason =
                            `the tokeniser did not resolve at ${baseRef}; an exact reading may ` +
                            'not be compared against a proxy one';
                    }
                }
            }
        } finally {
            fs.rmSync(base.root, { recursive: true, force: true });
            fs.rmSync(baseSkills.root, { recursive: true, force: true });
        }
    }

    // The diff half. A missing base ref is REPORTED rather than assumed empty:
    // guessing "nothing changed" is the same silent-pass this file's own header
    // argues against, and the count half above still ran.
    let offsets: OffsetLedger | null = null;
    let offsetSkipReason: string | null = null;
    const claims: GrowthClaim[] = [];
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
            offsets = classifyDiff(
                diff.stdout,
                (rel) => {
                    try {
                        return fs.readFileSync(path.join(repoRoot, rel), 'utf-8');
                    } catch {
                        return null;
                    }
                },
                (rel) => {
                    const show = git(['show', `${baseRef}:${rel}`], repoRoot);
                    return show.ok ? show.stdout : null;
                },
            );
        }
        const patch = git(
            ['diff', '--unified=0', '--find-renames', `${baseRef}...HEAD`, '--', ROADMAPS_REL],
            repoRoot,
        );
        if (patch.ok) claims.push(...growthClaims(patch.stdout));
    }

    const threshold = budget.one_in_one_out?.applies_above_active ?? null;
    const lintApplies = threshold === null || counts.active_roadmaps > threshold;
    let unpaid = 0;
    if (offsets !== null && lintApplies) {
        const exemptFiles = new Set(offsets.exempt.map((e) => e.file));
        const chargeable = offsets.added.filter((f) => !exemptFiles.has(f));
        unpaid = Math.max(0, chargeable.length - offsets.offsets.length);
    }

    // The allowances, one metric at a time and never a blanket rule. An exempt
    // addition and a parked roadmap are the two increases the existing policy
    // already sanctions, and under an exact floor each needs its own headroom or
    // the sanctioned act has no green path. `open_blockers` gets none: nothing in
    // the policy sanctions a new blocker, so it takes the claim path or nothing.
    const allowance: Record<MetricName, number> = {
        active_roadmaps: offsets?.exempt.length ?? 0,
        later_roadmaps: offsets?.parked.length ?? 0,
        open_blockers: 0,
        // The skill corpus gets NO allowance, and that is the whole point of the
        // metric: the defect it addresses is a corpus that grew +8 in one release
        // with nothing objecting. An addition takes the `estate_growth_exempt`
        // claim path — a recorded reason in the diff — or it fails.
        skill_count: 0,
        skill_description_tokens: 0,
        // Step 1.2: NO new allowance key. The concern axis joins `skill_count`
        // in taking the claim path or nothing, for the reason the budget file
        // already records for skills — an allowance reopens the gaming path the
        // dimension exists to close. Eight concerns spread across eight events
        // violate the existing per-event cap zero times, which is exactly why a
        // total-growth ratchet was needed and exactly why it must not carry a
        // per-change freebie.
        concern_count: 0,
    };

    /** Metrics dropped from the compare, with the reason, never silently. */
    const skippedMetrics: { metric: MetricName; reason: string }[] = [];
    const skipMetric = (metric: MetricName): boolean => {
        if (skillFloorSkipReason !== null && (metric === 'skill_count' || metric === 'skill_description_tokens')) {
            skippedMetrics.push({ metric, reason: skillFloorSkipReason });
            return true;
        }
        if (skillTokenSkipReason !== null && metric === 'skill_description_tokens') {
            skippedMetrics.push({ metric, reason: skillTokenSkipReason });
            return true;
        }
        return false;
    };

    const over: GrowthFinding[] = [];
    if (floor !== null) {
        for (const metric of METRICS) {
            if (skipMetric(metric)) continue;
            const live = counts[metric];
            const allowed = floor[metric] + allowance[metric];
            if (live > allowed) {
                over.push({ metric, floor: floor[metric], live, allowance: allowance[metric] });
            }
        }
    }
    // A claim authorises the growth in THIS change and nothing beyond it. It is
    // read from the patch, so it cannot be inherited; see `growthClaims`.
    const authorisedGrowth = claims.length > 0 ? over : [];
    const growth = claims.length > 0 ? [] : over;

    return {
        counts,
        floor,
        floorRef: baseRef ?? null,
        floorSkipReason,
        growth,
        authorisedGrowth,
        claims,
        skippedMetrics,
        offsets,
        offsetSkipReason,
        unpaid,
        provisionalPromotion,
        // No floor is a FAILURE, not a skip, and it is the one place this gate
        // convicts on a missing input. The other halves can report "unproven" and
        // still leave a meaningful verdict behind; the count half IS the verdict,
        // so with no floor a green here would assert something nothing measured.
        // A shrink-only gate whose floor is absent passes every possible tree.
        withinBudget: floorSkipReason === null && growth.length === 0 && unpaid === 0,
    };
}

/** Floors for `--self-test`, declared here so a truncation is a visible diff. */
const SELF_TEST_MIN_CASES = 12;
const SELF_TEST_MIN_REJECT = 8;

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

    /**
     * The budget body — POLICY ONLY since ADR-243.
     *
     * There is no number in it any more, which is why the raise cases the old
     * self-test carried are gone rather than ported: with nothing stored, "raise
     * the baseline with no reason" is not a state a change can reach.
     */
    const budgetJson = (): string =>
        `${JSON.stringify(
            {
                one_in_one_out: { applies_above_active: null },
                // Required since the path was specified and declined: the gate
                // refuses a budget that carries no `provisional_promotion`, so a
                // fixture without it exits 2 on every case rather than on the one
                // case testing that refusal.
                provisional_promotion: { status: 'declined', max_live: null, expires_after_days: null },
            },
            null,
            4,
        )}\n`;

    const roadmap = (name: string, extra = ''): string =>
        `# Roadmap: ${name}\n\n## Phase 1\n\n- [ ] **1.1** s\n${extra}`;

    /** A `status: carrier` roadmap — excluded from the active count and never an offset. */
    const CARRIER = `---\nstatus: carrier\n---\n# Roadmap: carrier\n\n## Phase 1\n\n- [~] **1.1** s\n`;

    /** An open blocker — no `Status: resolved` prefix, so it counts as open. */
    const BLOCKER = '\n## Blockers\n\n### Blocker: fixture\n\n- **Status:** open\n';

    const fixture = (opts: {
        roadmaps: number;
        after: (dir: string) => void;
        base?: string;
        /**
         * Build the repo with NO trunk branch, which is the only way to reach the
         * no-floor case: `resolveBaseRef` falls back to a LOCAL `main` after
         * origin/main, so merely omitting `--base` still resolves one. Measured —
         * the first version of this case expected a reject and got exit 0.
         */
        trunkless?: boolean;
        /** Runs before the BASE commit, so a case can seed the base tree. */
        before?: (dir: string) => void;
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
        g('init', '-q', '-b', opts.trunkless === true ? 'wip' : 'main');
        g('config', 'user.email', 'selftest@local');
        g('config', 'user.name', 'selftest');
        g('config', 'commit.gpgsign', 'false');
        for (let i = 0; i < opts.roadmaps; i++) {
            put(`agents/roadmaps/road-to-${String(i)}.md`, roadmap(`R${String(i)}`));
        }
        put('src/config/estate-count-budget.json', budgetJson());
        opts.before?.(dir);
        g('add', '-A');
        g('commit', '-qm', 'base');
        g('checkout', '-qb', 'feat/x');
        opts.after(dir);
        g('add', '-A');
        g('commit', '-qm', 'change');
        const argv = opts.base === undefined ? [] : ['--base', opts.base];
        return runGateCli(repo, script, argv, dir);
    };

    const write = (dir: string, rel: string, body: string): void => {
        fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), body, 'utf-8');
    };

    const mv = (dir: string, from: string, to: string): void => {
        fs.mkdirSync(path.join(dir, path.dirname(to)), { recursive: true });
        spawnSync('git', ['mv', from, to], { cwd: dir, encoding: 'utf-8' });
    };

    const cases: SelfTestCase[] = [
        {
            name: 'estate unchanged against the base tree → accept',
            expect: 'accept',
            run: () => fixture({ roadmaps: 3, base: 'main', after: () => undefined }),
        },
        {
            // The concern axis, both directions. Seeded into the BASE tree so
            // the floor is a real reading of the fixture's own manifest rather
            // than this repository's -- the whole point of measuring the floor
            // from the base ref.
            name: 'concern count grows above the base-tree floor → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    before: (dir) =>
                        write(dir, CONCERN_MANIFEST_POSIX, 'concerns:\n  one:\n    severity: advisory\n'),
                    after: (dir) =>
                        write(
                            dir,
                            CONCERN_MANIFEST_POSIX,
                            'concerns:\n  one:\n    severity: advisory\n  two:\n    severity: advisory\n',
                        ),
                }),
        },
        {
            // AC-3's explicit clause, and it corrects the first implementation
            // of this metric: an unreadable manifest at the base ref must FAIL,
            // never read as 0. A floor of 0 makes the ratchet inert on that
            // path while still printing a green line, which is the shape this
            // repository calls "a gate that read nothing has not passed".
            name: 'base ref carries no manifest → reject (a 0 floor is not a floor)',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) =>
                        write(dir, CONCERN_MANIFEST_POSIX, 'concerns:\n  one:\n    severity: advisory\n'),
                }),
        },
        {
            // The half that proves the parser is SCOPED rather than a grep: a
            // top-level map gaining members at the same two-space indent is not
            // concern growth, and the roadmap's own reproduce command would
            // have counted it as such.
            name: 'a non-concern top-level map growing is not concern growth → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    before: (dir) =>
                        write(dir, CONCERN_MANIFEST_POSIX, 'concerns:\n  one:\n    severity: advisory\nroles:\n  dev:\n'),
                    after: (dir) =>
                        write(
                            dir,
                            CONCERN_MANIFEST_POSIX,
                            'concerns:\n  one:\n    severity: advisory\nroles:\n  dev:\n  ops:\n  sre:\n',
                        ),
                }),
        },
        {
            // The floor is now exact, so this case no longer depends on anyone
            // having typed the right number at the base commit.
            name: 'active count grows above the base-tree floor → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) => write(dir, 'agents/roadmaps/road-to-new.md', roadmap('N')),
                }),
        },
        {
            // Isolating the one-in-one-out half needs the COUNT half satisfied,
            // and under an exact floor the only way to add a roadmap and stay at
            // the floor is a claim. So the claim is what buys the isolation the
            // old fixture bought with a pre-raised baseline.
            name: 'addition with a growth claim but no offset → reject (one-in-one-out)',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) =>
                        write(
                            dir,
                            'agents/roadmaps/road-to-new.md',
                            '---\nestate_growth_exempt: fixture — isolates one-in-one-out from the count half\n---\n\n' +
                                roadmap('N'),
                        ),
                }),
        },
        {
            name: 'addition carrying estate_offset_exempt → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) =>
                        write(
                            dir,
                            'agents/roadmaps/road-to-new.md',
                            '---\nestate_offset_exempt: fixture — the addition that cannot be offset\n---\n\n' + roadmap('N'),
                        ),
                }),
        },
        {
            name: 'addition paid for by an archive move → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) => {
                        write(dir, 'agents/roadmaps/road-to-new.md', roadmap('N'));
                        mv(dir, 'agents/roadmaps/road-to-2.md', 'agents/roadmaps/archive/road-to-2.md');
                    },
                }),
        },
        {
            // Parking is the case an exact floor would otherwise forbid outright:
            // active falls by one and later rises by one, and without the parking
            // allowance the sanctioned drawdown action fails the gate.
            name: 'parking a roadmap into later/ → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) => mv(dir, 'agents/roadmaps/road-to-2.md', 'agents/roadmaps/later/road-to-2.md'),
                }),
        },
        {
            // The other side of that allowance, and the reason it is keyed on
            // parking rather than on "any offset": a later/ file that nothing was
            // parked into is estate arriving for free.
            name: 'a later/ roadmap appearing from nowhere → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) => write(dir, 'agents/roadmaps/later/road-to-parked.md', roadmap('P')),
                }),
        },
        {
            // A carrier holds obligations lifted out of an already-archived
            // parent. Paying an offset for removing one rewards the loss, so the
            // deletion buys nothing and the added roadmap stays unpaid.
            name: 'deleting a carrier does not offset a new roadmap → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    before: (dir) =>
                        write(dir, 'agents/roadmaps/road-to-carrier.md', CARRIER),
                    after: (dir) => {
                        fs.rmSync(path.join(dir, 'agents/roadmaps/road-to-carrier.md'));
                        write(dir, 'agents/roadmaps/road-to-new.md', roadmap('N'));
                    },
                }),
        },
        {
            // The control, and it is the half that proves the case above tests
            // the carrier status rather than the deletion: an ordinary roadmap
            // deleted in the same shape still offsets, so the gate accepts.
            name: 'deleting an ordinary roadmap still offsets a new one → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) => {
                        fs.rmSync(path.join(dir, 'agents/roadmaps/road-to-2.md'));
                        write(dir, 'agents/roadmaps/road-to-new.md', roadmap('N'));
                    },
                }),
        },
        {
            name: 'a new open blocker with no claim → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) => write(dir, 'agents/roadmaps/road-to-1.md', roadmap('R1', BLOCKER)),
                }),
        },
        {
            name: 'a new open blocker WITH a growth claim → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) =>
                        write(
                            dir,
                            'agents/roadmaps/road-to-1.md',
                            '---\nestate_growth_exempt: fixture — a blocker discovered while doing the work\n---\n\n' +
                                roadmap('R1', BLOCKER),
                        ),
                }),
        },
        {
            // An exemption whose reason is blank is the silent exception the key
            // exists to replace, so a bare marker must not authorise anything.
            name: 'a growth claim with an empty reason → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    after: (dir) =>
                        write(dir, 'agents/roadmaps/road-to-1.md', '---\nestate_growth_exempt:\n---\n\n' + roadmap('R1', BLOCKER)),
                }),
        },
        {
            // The anti-banking property, and the reason claims are read from the
            // PATCH rather than from the file. A claim sitting in a roadmap at the
            // base commit authorises nothing here: a stored baseline could be
            // over-raised once and spent by every later change, and the whole
            // point of reading the diff is that this shape has no equivalent.
            name: 'a claim already present at base authorises nothing → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    before: (dir) =>
                        write(
                            dir,
                            'agents/roadmaps/road-to-1.md',
                            '---\nestate_growth_exempt: fixture — banked at base, must not carry over\n---\n\n' +
                                roadmap('R1'),
                        ),
                    after: (dir) =>
                        write(
                            dir,
                            'agents/roadmaps/road-to-1.md',
                            '---\nestate_growth_exempt: fixture — banked at base, must not carry over\n---\n\n' +
                                roadmap('R1', BLOCKER),
                        ),
                }),
        },
        {
            // The class that replaces the old "raise with no reason" case: with no
            // stored number, the way to silence this gate is to deny it a floor.
            name: 'no base ref resolvable → reject (no floor is not a pass)',
            expect: 'reject',
            run: () => fixture({ roadmaps: 3, trunkless: true, after: () => undefined }),
        },
        {
            name: 'emptied roadmap root → reject (dead scope, not a pass)',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 1,
                    base: 'main',
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

    // A ratchet over an empty estate always passes. Move `agents/roadmaps/` and  code-comment-allow provenance-comment -- the path is this script's operand, not where the code came from
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
    ledger.plan([...METRICS, 'floor', 'one_in_one_out']);
    for (const metric of METRICS) {
        // Round 2 finding 3, kept: a metric is recorded ONCE here, for whichever
        // way it actually failed, so the ledger cannot show a green completeness
        // record beside a red exit. With no floor there is no per-metric verdict
        // to record at all, which is a skip rather than a completion.
        const bad = verdict.growth.find((g) => g.metric === metric);
        if (verdict.floor === null) ledger.skip(metric, 'precondition_unmet');
        else if (bad !== undefined) ledger.fail(metric, `${metric} grew ${bad.floor} → ${bad.live}`);
        else ledger.complete(metric);
    }
    if (verdict.floorSkipReason !== null) ledger.fail('floor', verdict.floorSkipReason);
    else ledger.complete('floor');
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
        const base = verdict.floor?.[metric];
        if (base === undefined) {
            process.stdout.write(`  ${metric.padEnd(18)} ${String(live).padStart(5)}  (floor unmeasured)\n`);
            continue;
        }
        const delta = live - base;
        const sign = delta >= 0 ? '+' : '';
        process.stdout.write(
            `  ${metric.padEnd(18)} ${String(live).padStart(5)}  (floor ${String(base)} at ${verdict.floorRef ?? '?'}, ${sign}${String(delta)})\n`,
        );
    }
    if (verdict.offsets !== null) {
        const o = verdict.offsets;
        process.stdout.write(
            `  ${'this change'.padEnd(18)}  +${String(o.added.length)} active / -${String(o.offsets.length)} disposed` +
                `${o.parked.length > 0 ? `, ${String(o.parked.length)} parked` : ''}` +
                `${o.exempt.length > 0 ? `, ${String(o.exempt.length)} exempt` : ''}\n`,
        );
    } else if (verdict.offsetSkipReason !== null) {
        process.stdout.write(`  ⚠️  ${verdict.offsetSkipReason}\n`);
    }
    // Printed unconditionally so the state is visible without `--json`. It never
    // changes the exit code — a declined path and a registered one both leave
    // the ratchet exactly as it was, and the allowance a registered path would
    // grant is deliberately unwired (the owner registers the numbers; wiring
    // what they buy is a separate, separately authorised change).
    process.stdout.write(
        `  ${'provisional'.padEnd(18)} ${verdict.provisionalPromotion.padStart(5)}` +
            `${verdict.provisionalPromotion === 'declined' ? '  (specified and declined 2026-09-01 — path inactive by decision)' : ''}` +
            `${verdict.provisionalPromotion === 'unregistered' ? '  (no numbers registered — path inactive)' : ''}` +
            `${verdict.provisionalPromotion === 'registered' ? '  (numbers registered by the owner; this gate grants no allowance for them)' : ''}\n`,
    );
    for (const c of verdict.claims) {
        process.stdout.write(`  ↑ growth claimed in ${c.file}: ${c.reason.slice(0, 120)}\n`);
    }
    for (const g of verdict.authorisedGrowth) {
        process.stdout.write(
            `  ↑ ${g.metric} grew ${String(g.floor)} → ${String(g.live)}, authorised by the claim above\n`,
        );
    }

    if (verdict.floorSkipReason !== null) {
        process.stderr.write(
            `❌  no floor: ${verdict.floorSkipReason}.\n` +
                "    This gate compares the estate against the base ref's own tree, so with no base\n" +
                '    ref there is nothing to compare against — and a shrink-only gate with no floor\n' +
                '    passes every possible tree, which is why this is a failure and not a warning.\n' +
                '    Fetch the base (`git fetch origin main`) or name it explicitly:\n' +
                '        ./scripts-run src/scripts/check_estate_count --base origin/main\n',
        );
    }

    for (const g of verdict.growth) {
        const allow = g.allowance > 0 ? ` (+${String(g.allowance)} allowed here)` : '';
        // Two corpora share this gate, so the line names which one grew. It used
        // to say "the roadmap estate" unconditionally, which was already the
        // wrong noun for `skill_count` the moment that metric landed.
        const corpus = g.metric.startsWith('skill_') ? 'the skill estate' : 'the roadmap estate';
        process.stderr.write(
            `❌  ${corpus} grew: ${g.metric} ${String(g.floor)} → ${String(g.live)}${allow}.\n` +
                `    The floor is the measurement at ${verdict.floorRef ?? 'the base ref'}, not a number in a\n` +
                '    config — so there is no number to edit and nothing to walk. The estate does not\n' +
                '    walk down by itself, which is the defect this ratchet exists for. Either close,\n' +
                '    park or archive enough to get back to the floor, or claim the growth where it\n' +
                '    happened: add `estate_growth_exempt: <reason>` to the frontmatter of a roadmap\n' +
                '    this change touches. The claim is read from the diff, so it authorises this\n' +
                '    change and no later one, and the reason is a real sentence or it does not count.\n',
        );
    }

    // A dropped metric is REPORTED, never silent: a reader must be able to tell
    // "within its ratchet" from "within the ratchet of the metrics that could be
    // measured". This is the same distinction the floor-skip reason above keeps.
    for (const s of verdict.skippedMetrics) {
        process.stdout.write(`  ⏭️  ${s.metric} not compared — ${s.reason}\n`);
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
