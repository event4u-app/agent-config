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
 * live number. A count BELOW the baseline is green and prints the free
 * tightening, in the shape `check_preamble_payload_budget` already uses: a lower
 * measurement becomes the new ceiling rather than becoming unused headroom.
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
    is_roadmap_candidate as isRoadmapCandidate,
    parse_frontmatter as parseFrontmatter,
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

export interface EstateVerdict {
    counts: EstateCounts;
    baseline: EstateCounts;
    growth: GrowthFinding[];
    /** Counts strictly below their baseline — the walk-down the ratchet wants. */
    tightened: GrowthFinding[];
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
 * Count the estate, three ways.
 *
 * `active_roadmaps` and `open_blockers` come from `collect()` so they cannot
 * disagree with the dashboard; `later_roadmaps` is a directory listing because
 * parked files are outside that corpus by design.
 */
export function countEstate(repoRoot: string): EstateCounts {
    const roadmapRoot = path.join(repoRoot, ROADMAPS_REL);
    const stats = collect(roadmapRoot);
    const laterDir = path.join(roadmapRoot, 'later');
    let later = 0;
    try {
        later = fs.readdirSync(laterDir).filter((n) => n.endsWith('.md')).length;
    } catch {
        later = 0;
    }
    return {
        active_roadmaps: stats.length,
        later_roadmaps: later,
        open_blockers: stats.reduce((n, r) => n + r.open_blockers.length, 0),
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

/** A disposition directory — where an offset sends a roadmap. */
function isDisposed(rel: string): boolean {
    const norm = rel.split(path.sep).join('/');
    return /^agents\/roadmaps\/(archive|later|skipped)\//.test(norm);
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

    // The diff half. A missing base ref is REPORTED rather than assumed empty:
    // guessing "nothing changed" is the same silent-pass this file's own header
    // argues against, and the count half above still ran.
    let offsets: OffsetLedger | null = null;
    let offsetSkipReason: string | null = null;
    const baseRef = opts.baseRef ?? resolveBaseRef(repoRoot);
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

    return {
        counts,
        baseline: budget.baseline,
        growth,
        tightened,
        offsets,
        offsetSkipReason,
        unpaid,
        withinBudget: growth.length === 0 && unpaid === 0,
    };
}

/** Floors for `--self-test`, declared here so a truncation is a visible diff. */
const SELF_TEST_MIN_CASES = 5;
const SELF_TEST_MIN_REJECT = 3;

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
        put(
            'src/config/estate-count-budget.json',
            `${JSON.stringify(
                {
                    baseline: {
                        active_roadmaps: opts.baseline.active,
                        later_roadmaps: opts.baseline.later,
                        open_blockers: 0,
                    },
                    one_in_one_out: { applies_above_active: null },
                },
                null,
                4,
            )}\n`,
        );
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
                    // Baseline raised to 4 so the ratchet half passes and only the
                    // offset half can fail — otherwise this case would pass for
                    // the other check's reason.
                    roadmaps: 3,
                    baseline: { active: 4, later: 0 },
                    after: (dir) => write(dir, 'agents/roadmaps/road-to-new.md', '# Roadmap: N\n\n## Phase 1\n\n- [ ] **1.1** s\n'),
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
    const baseRef = baseIdx === -1 ? undefined : argv[baseIdx + 1];
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
        reportScanned({
            gate: GATE,
            scanned: verdict.counts.active_roadmaps + verdict.counts.later_roadmaps,
            units: 'roadmap file(s)',
            roots: [ROADMAPS_REL, path.join(ROADMAPS_REL, 'later')],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${GATE}: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    const ledger = new GateLedger(GATE);
    ledger.plan([...METRICS, 'one_in_one_out']);
    for (const metric of METRICS) {
        const bad = verdict.growth.find((g) => g.metric === metric);
        if (bad !== undefined) ledger.fail(metric, `${metric} grew ${bad.baseline} → ${bad.live}`);
        else ledger.complete(metric);
    }
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

    for (const t of verdict.tightened) {
        process.stdout.write(
            `  ↓ free tightening: ${t.metric} measured ${String(t.live)} under a baseline of ${String(t.baseline)}.\n` +
                `    Walk the baseline down in ${BUDGET_REL} — a lower measurement is the new ceiling,\n` +
                '    not headroom to spend later.\n',
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
