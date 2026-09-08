#!/usr/bin/env tsx
/**
 * Ratchet gate for the per-spawn preamble payload (road-to-cache-economy
 * Phase 3, unblocked by C-3 measuring 38.0% against a 15% bar).
 *
 * WHY A RATCHET AND NOT THE ROADMAP'S LITERAL NUMBERS
 * ---------------------------------------------------
 * The roadmap's candidate ceiling (median 40k / p95 50k) is anchored to an
 * upstream ~37k cold start. This package's own deterministic in-repo payload is
 * ~102.8k tokens, so a hard 40k gate would be red the day it lands — and a gate
 * that is always red trains the reader to ignore it, which is precisely the
 * failure the gates-that-can-fail work exists to prevent. So this fails on
 * GROWTH: the number can only walk down, and the 40k/50k target stays recorded
 * in the budget file as the destination.
 *
 * Only deterministic, in-repo buckets are gated. User-scope rules depend on what
 * the developer happens to have installed globally, and the tool-definition
 * bucket has no local source at all — the census reports that one as an explicit
 * residual rather than pretending to measure it.
 *
 * THE BOUND IS SHRINK-ONLY, AND NOW CHECKED
 * ------------------------------------------
 * `ci_delivery.why_a_grace_ceiling` says of the grace ceiling *"It may never
 * move UP"*, and `grace_ceiling_history` in the same file records it moving up
 * twice. ADR-264 resolved that against the practice — the sentence stands — and
 * left the sentence unenforced, which is exactly the state that produced both
 * raises. `_lib/standing_bound_ratchet.ts` is the enforcement: the effective
 * ceiling is compared against the one at the base ref and a rise refuses the run,
 * whether it arrived by editing the config or by passing a bigger `--ceiling`.
 *
 * It is also ALL that `road-to-a-standing-budget-with-headroom` step 1.3 ships.
 * That step designed a 128-token Iron Law reserve; an AI council refused to
 * activate it 2/2 on 2026-09-08 because the verifier is inside the change under
 * review, so a protected approval record grants nothing. ADR-265 carries the
 * verdict and the activation prerequisites.
 *
 * Exit codes: 0 within budget · 1 over budget or the bound rose · 2 misuse /
 * unreadable budget.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { censusClaudeMdHierarchy, censusRuleDir, censusSkillsCatalog } from './preamble_byte_census.js';
import { PREFIX_STABLE_SURFACES, prefixStableRoots } from './_lib/prefix_stable_surfaces.js';
import { attributeGrowth, buildLedger, renderAttribution } from './_lib/asset_delivery_ledger.js';
import { resolveBaseRef } from './_lib/ratchet_base_ref.js';
import {
    assertBoundsDidNotRise,
    type BoundsRatchetVerdict,
    type GitRunner,
    realGit,
} from './_lib/standing_bound_ratchet.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BUDGET_FILE = path.join(REPO_ROOT, 'src', 'config', 'preamble-payload-budget.json');

interface Budget {
    baseline_tokens: number;
    headroom_pct: number;
    target_tokens: { median: number; p95: number };
    /**
     * `ci_delivery.grace_ceiling`, or `null` when the file carries none.
     *
     * Read here only so the shrink-only ratchet has a head-side value on a local
     * run that passes no `--ceiling`. The number the payload is COMPARED against
     * still arrives through the flag, so this does not become a second home for
     * the ceiling.
     */
    grace_ceiling: number | null;
}

export interface BudgetVerdict {
    measured: number;
    baseline: number;
    ceiling: number;
    withinBudget: boolean;
    buckets: Array<{ name: string; tokens: number; files: number }>;
}

function tokens(chars: number): number {
    return Math.round(chars / 4);
}

export function readBudget(file: string = BUDGET_FILE): Budget {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    const baseline = Number(raw['baseline_tokens']);
    const headroom = Number(raw['headroom_pct']);
    if (!Number.isFinite(baseline) || !Number.isFinite(headroom)) {
        throw new Error(`${file}: baseline_tokens and headroom_pct must both be numbers`);
    }
    const target = (raw['target_tokens'] ?? {}) as Record<string, unknown>;
    const delivery = (raw['ci_delivery'] ?? {}) as Record<string, unknown>;
    const grace = Number(delivery['grace_ceiling']);
    return {
        baseline_tokens: baseline,
        headroom_pct: headroom,
        target_tokens: { median: Number(target['median']), p95: Number(target['p95']) },
        grace_ceiling: Number.isFinite(grace) ? grace : null,
    };
}

/** Look one surface root up by id. Throws on an unknown id — a renamed surface
 *  must fail loudly here rather than degrade this gate to measuring nothing. */
function surfaceRoot(id: string): string {
    const s = PREFIX_STABLE_SURFACES.find((x) => x.id === id);
    if (s === undefined) {
        throw new Error(
            `prefix-stable surface '${id}' is not declared in _lib/prefix_stable_surfaces.ts — ` +
                `the payload census cannot measure a bucket whose root it cannot resolve`,
        );
    }
    return s.root;
}

/** Measure only what the repo tree determines — no `~`, no transcripts, no network. */
export function measureDeterministicPayload(
    repoRoot: string = REPO_ROOT,
): Array<{ name: string; tokens: number; files: number }> {
    // Roots come from the canonical prefix-stable surface registry, never from a
    // literal here: `check_prefix_stable_mutation` guards the same boundary, and
    // two independent lists of one boundary is the drift shape this repository
    // has already paid for. `surfaceRoot` throws rather than silently measuring
    // nothing if an id is renamed out from under it.
    const projectRules = censusRuleDir(path.join(repoRoot, surfaceRoot('project-scope-rules')));
    const skills = censusSkillsCatalog(path.join(repoRoot, surfaceRoot('preloaded-skills-catalog')));
    // Only the PROJECT half of the CLAUDE.md hierarchy is deterministic — the
    // user file and its @-imports live on whatever machine runs this.
    const claudeMd = censusClaudeMdHierarchy(repoRoot, path.join(repoRoot, '.no-such-home'));
    const projectClaudeMdChars =
        claudeMd.project_claude_md_chars + claudeMd.project_claude_local_md_chars;
    // `files` carries the count of sources each census actually read. A token
    // total cannot tell "the root moved" from "the payload is genuinely tiny",
    // so the scope assertion in `main` needs the count, not the bytes.
    const claudeMdFiles =
        (claudeMd.project_claude_md_present ? 1 : 0) +
        (claudeMd.project_claude_local_md_present ? 1 : 0);
    return [
        { name: 'project-scope rules', tokens: tokens(projectRules.chars), files: projectRules.files },
        { name: 'preloaded skills catalog', tokens: tokens(skills.chars), files: skills.skills },
        {
            name: 'CLAUDE.md hierarchy (project only)',
            tokens: tokens(projectClaudeMdChars),
            files: claudeMdFiles,
        },
    ];
}

/**
 * A caller-supplied ceiling, and the one direction it may go.
 *
 * road-to-standing-payload-truth 1.1 arms this gate in CI behind a GRACE ceiling
 * equal to the 2026-08-24 measurement, because HEAD is 28.4 % over the design
 * ceiling and blocking at the design number would fail every pull request from
 * the moment the workflow lands — nobody can shed 30,566 tokens inside the PR
 * that arms the gate.
 *
 * **An override may only be LOOSER than the design ceiling, and it is refused if
 * it is tighter.** That sounds backwards for one line and is the whole point: a
 * tighter override would let a caller silently *lower* the bar this file owns,
 * which is the config-weakening shape in reverse — the design ceiling stays the
 * authority, and the override is a dated, expiring concession recorded in
 * `ci_delivery`. Tightening happens by lowering `baseline_tokens`, in the file,
 * with a reason, where a reviewer sees it.
 */
export function evaluate(repoRoot?: string, budgetFile?: string, overrideCeiling?: number): BudgetVerdict {
    const budget = readBudget(budgetFile);
    const buckets = measureDeterministicPayload(repoRoot);
    const measured = buckets.reduce((sum, b) => sum + b.tokens, 0);
    const design = Math.round(budget.baseline_tokens * (1 + budget.headroom_pct / 100));
    const ceiling =
        overrideCeiling !== undefined && Number.isFinite(overrideCeiling) && overrideCeiling > design
            ? overrideCeiling
            : design;
    return { measured, baseline: budget.baseline_tokens, ceiling, withinBudget: measured <= ceiling, buckets };
}

/**
 * The measurement plus the shrink-only bound check.
 *
 * `evaluate` above answers "how big is the tree" and touches no ref;
 * this answers "may this tree ship" and needs the base one. They stay separate
 * because a census that silently depended on a remote ref would behave
 * differently in a shallow clone, and the census is the half other callers use.
 */
export interface Decision {
    verdict: BudgetVerdict;
    bounds: BoundsRatchetVerdict;
    /** False when the payload is over the ceiling, or the ceiling itself rose. */
    ok: boolean;
}

export interface DecideOptions {
    repoRoot?: string;
    budgetFile?: string;
    overrideCeiling?: number;
    env?: NodeJS.ProcessEnv;
    git?: GitRunner;
    /** Test seam: pin the base ref instead of resolving it. `null` = none resolved. */
    baseRef?: string | null;
}

export function decide(opts: DecideOptions = {}): Decision {
    const repoRoot = opts.repoRoot ?? REPO_ROOT;
    const git = opts.git ?? realGit;
    const budget = readBudget(opts.budgetFile);
    const verdict = evaluate(repoRoot, opts.budgetFile, opts.overrideCeiling);
    const baseRef =
        opts.baseRef !== undefined ? opts.baseRef : resolveBaseRef(repoRoot, opts.env ?? process.env, git);
    const bounds = assertBoundsDidNotRise({
        repoRoot,
        baseRef,
        git,
        headGraceCeiling: opts.overrideCeiling ?? budget.grace_ceiling ?? 0,
    });
    return { verdict, bounds, ok: bounds.ok && verdict.withinBudget };
}

/**
 * Per-asset attribution for a refusal, against the merge-base tree.
 *
 * Reads the base tree through `git worktree`-free plumbing: the ledger is built
 * over a temporary checkout of `git merge-base HEAD origin/main`. Every failure
 * mode returns an empty list — the caller treats attribution as an explanation,
 * never as a precondition for refusing.
 */
function attributeGrowthAgainstBase(): string[] | null {
    try {
        const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        if (base.length === 0) return null;

        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-base-'));
        try {
            for (const rel of prefixStableRoots()) {
                // `git archive` of one subtree, extracted into the scratch root.
                // A root absent at the base ref simply yields nothing.
                try {
                    const tar = execFileSync('git', ['archive', base, '--', rel], {
                        cwd: REPO_ROOT,
                        maxBuffer: 256 * 1024 * 1024,
                        stdio: ['ignore', 'pipe', 'ignore'],
                    });
                    // `-f -` is not optional: without it BSD tar reads its
                    // default device rather than stdin, and the extraction
                    // silently produces nothing — which reads downstream as
                    // "the base tree was unavailable" rather than as a bug.
                    execFileSync('tar', ['-x', '-f', '-', '-C', tmp], {
                        input: tar,
                        stdio: ['pipe', 'ignore', 'ignore'],
                    });
                } catch {
                    /* root absent at base — nothing to extract */
                }
            }
            const [rulesRel, skillsRel] = prefixStableRoots();
            const before = buildLedger(
                path.join(tmp, rulesRel ?? ''),
                path.join(tmp, skillsRel ?? ''),
                tmp,
            );
            const after = buildLedger(
                path.join(REPO_ROOT, rulesRel ?? ''),
                path.join(REPO_ROOT, skillsRel ?? ''),
                REPO_ROOT,
            );
            if (before.rows.length === 0) return null;
            return renderAttribution(attributeGrowth(before.rows, after.rows));
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    } catch {
        return null;
    }
}

/**
 * The bound check, rendered for a human — on BOTH paths, green and red.
 *
 * A check that only speaks when it fails is a check nobody audits until it is
 * already load-bearing. Printing the compared ref and the earlier bound on the
 * passing path is also the only way a reader can tell "verified and unchanged"
 * from "skipped because no base ref resolved", which are different facts.
 */
function renderBounds(b: BoundsRatchetVerdict): string {
    if (b.note !== null) {
        return `  ${'grace ceiling ratchet'.padEnd(38)} ${'SKIPPED'.padStart(8)} — ${b.note}\n`;
    }
    const base = b.baseGraceCeiling === null ? 'n/a' : String(b.baseGraceCeiling);
    const state = b.ok ? 'ok' : 'ROSE';
    return (
        `  ${'grace ceiling ratchet'.padEnd(38)} ${state.padStart(8)} — ` +
        `${base} at ${b.baseRef ?? 'n/a'}, shrink-only (ADR-264)\n`
    );
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const json = argv.includes('--format=json') || argv.includes('--json');
    // `--ceiling <n>`: the grace ceiling the CI step reads out of
    // `ci_delivery.grace_ceiling`. Read from the budget file there, never written
    // in the workflow, so the number has exactly one home. A non-numeric or
    // tighter-than-design value is IGNORED rather than honoured — see `evaluate`.
    const ci = argv.indexOf('--ceiling');
    const override = ci !== -1 && argv[ci + 1] !== undefined ? Number(argv[ci + 1]) : undefined;
    let decision: Decision;
    try {
        decision = decide(override === undefined ? {} : { overrideCeiling: override });
    } catch (err) {
        process.stderr.write(`❌  preamble-payload budget: ${(err as Error).message}\n`);
        return 2;
    }
    const verdict = decision.verdict;

    // A ratchet over a measurement of nothing always passes: move
    // `dist/agent-src/` and every census returns zero, which is trivially under
    // any ceiling. Exit 2 (misuse / unreadable budget — the could-not-run
    // code), never 1, which asserts the payload actually grew.
    try {
        assertScanned({
            gate: 'check_preamble_payload_budget',
            scanned: verdict.buckets.reduce((n, b) => n + b.files, 0),
            units: 'payload source file(s)',
            roots: prefixStableRoots(),
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  preamble-payload budget: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    if (json) {
        process.stdout.write(
            JSON.stringify(
                {
                    ...verdict,
                    ok: decision.ok,
                    bound_ratchet: {
                        ok: decision.bounds.ok,
                        base_ref: decision.bounds.baseRef,
                        base_grace_ceiling: decision.bounds.baseGraceCeiling,
                        note: decision.bounds.note,
                        violations: decision.bounds.violations,
                    },
                },
                null,
                2,
            ) + '\n',
        );
        return decision.ok ? 0 : 1;
    }

    for (const b of verdict.buckets) {
        process.stdout.write(`  ${b.name.padEnd(38)} ${String(b.tokens).padStart(8)} tok\n`);
    }
    const delta = verdict.measured - verdict.baseline;
    const sign = delta >= 0 ? '+' : '';
    process.stdout.write(
        `  ${'measured total'.padEnd(38)} ${String(verdict.measured).padStart(8)} tok ` +
            `(baseline ${verdict.baseline}, ${sign}${delta}; ceiling ${verdict.ceiling})\n`,
    );
    process.stdout.write(renderBounds(decision.bounds));

    // The bound is checked BEFORE the size question and independently of it. A
    // change that lifts its own ceiling has already defeated the gate, and
    // reporting that as "within budget" would be the config-weakening move
    // wearing a green checkmark.
    if (!decision.bounds.ok) {
        process.stderr.write(
            '❌  the standing-payload ceiling rose in this change:\n' +
                decision.bounds.violations.map((v) => `      · ${v}\n`).join(''),
        );
        return 1;
    }

    if (!verdict.withinBudget) {
        // road-to-delivered-cost-truth 2.2 — a gate names its own "no". The
        // ceiling message alone states a fact and leaves the reader to find the
        // cause; naming the assets and their token deltas makes the refusal
        // actionable, which is the difference between a refusal that gets fixed
        // and one that gets suppressed.
        //
        // Attribution is BEST-EFFORT and never changes the verdict: the
        // comparison needs the merge-base tree, and a shallow clone, a detached
        // build or a first commit legitimately has none. A gate that failed to
        // refuse because it could not explain itself would be strictly worse
        // than one that refuses without the explanation.
        const attribution = attributeGrowthAgainstBase();
        process.stderr.write(
            `❌  per-spawn preamble payload grew past the ratchet: ${verdict.measured} > ${verdict.ceiling} tok.\n` +
                `    Every rule and skill description here is re-written on EVERY subagent spawn, so growth\n` +
                `    is paid per spawn, not once. Shrink the addition, or migrate the prose out of the\n` +
                `    standing rule. The grace ceiling may NOT be raised to fit it: ADR-264, enforced by\n` +
                `    the shrink-only ratchet above.\n`,
        );
        // Three distinct states, and conflating the last two is a diagnostic
        // defect rather than a cosmetic one: "I could not look" and "I looked
        // and nothing changed" send a reader to completely different places.
        if (attribution === null) {
            process.stderr.write(
                '\n    (no per-asset attribution: the merge-base tree could not be read here, so the\n' +
                    '     growth cannot be traced to specific assets. The refusal stands regardless.)\n',
            );
        } else if (attribution.length === 0) {
            process.stderr.write(
                '\n    Per-asset attribution: NO standing asset changed against the merge base — this\n' +
                    '    diff did not cause the overage, it inherited it.\n',
            );
        } else {
            process.stderr.write('\n' + attribution.join('\n') + '\n');
        }
        return 1;
    }
    process.stdout.write('✅  per-spawn preamble payload within the ratchet.\n');
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
