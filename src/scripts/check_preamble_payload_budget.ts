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
import { HOST_SURFACES } from './_lib/host_projection_reach.js';
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
 * THE HOST READING — additive, and deliberately not the ratchet's surface.
 *
 * `measureDeterministicPayload` above measures `dist/agent-src/rules`: the
 * projection SOURCE. That is the right surface for the shrink-only ratchet,
 * because the source is what every host tree is written FROM and what a pull
 * request actually edits. It is the wrong surface for one question: how many
 * standing tokens does a session on host X start with? Under a per-host
 * `delivery` projection the two answers diverge by design — measured 2026-09-07,
 * `.claude/rules` went 99,598 tok to 24,166 tok while the source stayed at
 * 138,200 either side of the flip.
 *
 * So this adds a SECOND reading and changes nothing about the first. AI council
 * of 2026-09-09 (2/2 present, converged on option 1A):
 *
 *   - the no-argument source measurement, the blocking CI invocation, the
 *     `task ci` invocation and the base-ref ratchet are untouched, so no
 *     existing baseline or history entry is reinterpreted;
 *   - the host reading is reported alongside and NEVER changes the exit code —
 *     an informational census, not a second gate.
 *
 * Both seats were explicit that the host id must resolve through the existing
 * projection registry rather than a path map invented here, which is why the
 * roots come from `HOST_SURFACES` in `_lib/host_projection_reach.ts` — the same
 * committed constant `check_host_projection_reach` walks.
 */
export interface HostPayload {
    /** The host id as given, or `null` when a raw rules-dir override was used. */
    host: string | null;
    /** Repo-relative rules root actually measured. */
    rules_path: string;
    buckets: Array<{ name: string; tokens: number; files: number }>;
    total: number;
    /**
     * Rule files in the host tree, against rule files in the projection source.
     *
     * A maintainer checkout is NOT a consumer install and its host tree is
     * routinely smaller for reasons that have nothing to do with a projection
     * mode: the installer deduplicates a project rule against the same rule
     * already present at user scope, and a dev tree may hold a partial
     * projection. Measured in this repository 2026-09-09: 13 files under
     * `.claude/rules` against 119 in `dist/agent-src/rules`.
     *
     * A bare token total cannot tell a genuine saving from a tree that was never
     * fully written, and those two send a reader to completely different places.
     * So the counts travel with the number, and `complete` is false whenever the
     * host tree holds fewer rule files than the source.
     */
    completeness: { host_rule_files: number; source_rule_files: number; complete: boolean };
}

/** Every host id this reading accepts, in registry order. */
export function hostPayloadIds(): string[] {
    return HOST_SURFACES.map((h) => h.id);
}

/**
 * Split a host declared projections into the standing-payload buckets.
 *
 * Classification is derived from the registry rather than restated: a projection
 * ending in `/skills` is the skills catalogue, one ending in `/commands` is
 * EXCLUDED because a command is invoked rather than standing, and whatever
 * remains is the rules surface — a directory on the per-rule hosts, a single
 * `.md` file on the single-surface hosts, which is also that host root
 * instruction file.
 *
 * The one conditional is `claude-code`, and it is a conditional rather than a
 * map row: the `CLAUDE.md` / `CLAUDE.local.md` pair is already declared in
 * `PREFIX_STABLE_SURFACES` as `project-claude-md` and `project-claude-local-md`,
 * it is that host root instruction file, and no other host reads it.
 */
export function hostPayloadRoots(hostId: string): {
    rules: string;
    skills: string | null;
    claudeMd: boolean;
} {
    const surface = HOST_SURFACES.find((h) => h.id === hostId);
    if (surface === undefined) {
        throw new Error(
            `unknown host '${hostId}' — known ids: ${hostPayloadIds().join(', ')}. ` +
                'The set is HOST_SURFACES in _lib/host_projection_reach.ts; a host absent there has no ' +
                'declared projection for this reading to measure.',
        );
    }
    const skills = surface.projections.find((r) => r.endsWith('/skills')) ?? null;
    const rules = surface.projections.find(
        (r) => !r.endsWith('/skills') && !r.endsWith('/commands'),
    );
    if (rules === undefined) {
        throw new Error(
            `host '${hostId}' declares no rules-bearing projection in HOST_SURFACES ` +
                `(projections: ${surface.projections.join(', ') || 'none'}) — nothing to measure`,
        );
    }
    return { rules, skills, claudeMd: hostId === 'claude-code' };
}

/** Char count for one root, whether it is a rules directory or a single file. */
function charsAtRoot(abs: string): { chars: number; files: number } {
    let st: fs.Stats;
    try {
        st = fs.statSync(abs);
    } catch {
        return { chars: 0, files: 0 };
    }
    if (st.isFile()) return { chars: fs.readFileSync(abs, 'utf-8').length, files: 1 };
    const c = censusRuleDir(abs);
    return { chars: c.chars, files: c.files };
}

/**
 * Measure the standing payload of the tree ONE host loads.
 *
 * `rulesDirOverride` is the low-level escape for a tree no host id names — a
 * fixture, a consumer-shaped root, a comparison against a never-flipped tree.
 * It is mutually exclusive with `host` at the CLI layer.
 */
export function measureHostPayload(
    repoRoot: string,
    opts: { host?: string; rulesDirOverride?: string },
): HostPayload {
    const roots = opts.rulesDirOverride === undefined ? hostPayloadRoots(opts.host ?? '') : null;
    const rulesRel = opts.rulesDirOverride ?? (roots as { rules: string }).rules;
    const rulesAbs = path.isAbsolute(rulesRel) ? rulesRel : path.join(repoRoot, rulesRel);
    if (!fs.existsSync(rulesAbs)) {
        throw new Error(
            `rules root '${rulesRel}' does not exist under ${repoRoot} — a host tree that was never ` +
                'projected reads as zero tokens, which is indistinguishable from a tiny one, so this ' +
                'refuses rather than reporting a green nothing',
        );
    }
    const buckets: Array<{ name: string; tokens: number; files: number }> = [];
    const rulesCensus = charsAtRoot(rulesAbs);
    buckets.push({
        name: `rules (${rulesRel})`,
        tokens: tokens(rulesCensus.chars),
        files: rulesCensus.files,
    });

    if (roots !== null && roots.skills !== null) {
        const sk = censusSkillsCatalog(path.join(repoRoot, roots.skills));
        buckets.push({
            name: `skills catalog (${roots.skills})`,
            tokens: tokens(sk.chars),
            files: sk.skills,
        });
    }
    if (roots !== null && roots.claudeMd) {
        const md = censusClaudeMdHierarchy(repoRoot, path.join(repoRoot, '.no-such-home'));
        const chars = md.project_claude_md_chars + md.project_claude_local_md_chars;
        const files =
            (md.project_claude_md_present ? 1 : 0) + (md.project_claude_local_md_present ? 1 : 0);
        buckets.push({ name: 'CLAUDE.md hierarchy (project only)', tokens: tokens(chars), files });
    }
    const sourceRules = censusRuleDir(path.join(repoRoot, surfaceRoot('project-scope-rules')));
    return {
        host: opts.rulesDirOverride === undefined ? (opts.host ?? null) : null,
        rules_path: rulesRel,
        buckets,
        total: buckets.reduce((n, b) => n + b.tokens, 0),
        completeness: {
            host_rule_files: rulesCensus.files,
            source_rule_files: sourceRules.files,
            complete: rulesCensus.files >= sourceRules.files,
        },
    };
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

    // `--host <id>` / `--project-rules-dir <path>`: the additive host reading
    // (AI council 2026-09-09, option 1A). Mutually exclusive on purpose — a call
    // passing both is asking two different questions and would silently get one
    // answer, so it is a usage error rather than a precedence rule nobody reads.
    const hi = argv.indexOf('--host');
    const hostArg = hi !== -1 ? argv[hi + 1] : undefined;
    const pi = argv.indexOf('--project-rules-dir');
    const rulesDirArg = pi !== -1 ? argv[pi + 1] : undefined;
    if (hostArg !== undefined && rulesDirArg !== undefined) {
        process.stderr.write(
            '❌  preamble-payload budget: --host and --project-rules-dir are mutually exclusive. ' +
                'Pass a host id to measure a declared projection, or a path to measure an ' +
                'undeclared tree — never both.\n',
        );
        return 2;
    }
    if (hi !== -1 && (hostArg === undefined || hostArg.startsWith('--'))) {
        process.stderr.write(
            `❌  preamble-payload budget: --host needs an id — one of ${hostPayloadIds().join(', ')}.\n`,
        );
        return 2;
    }
    if (pi !== -1 && (rulesDirArg === undefined || rulesDirArg.startsWith('--'))) {
        process.stderr.write('❌  preamble-payload budget: --project-rules-dir needs a path.\n');
        return 2;
    }
    let host: HostPayload | null = null;
    if (hostArg !== undefined || rulesDirArg !== undefined) {
        try {
            host = measureHostPayload(
                REPO_ROOT,
                hostArg !== undefined
                    ? { host: hostArg }
                    : { rulesDirOverride: rulesDirArg as string },
            );
        } catch (err) {
            process.stderr.write(`❌  preamble-payload budget: ${(err as Error).message}\n`);
            return 2;
        }
    }

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
                    // `source_corpus` and `host_payload` are structurally
                    // separate, and both seats of the 2026-09-09 council asked
                    // for exactly that: until the two are named apart, every
                    // ceiling discussion risks comparing unlike quantities. The
                    // legacy top-level fields stay so no existing reader breaks.
                    measurement_scope: host === null ? 'source-corpus' : 'source-corpus+host-payload',
                    source_corpus: {
                        measured: verdict.measured,
                        baseline: verdict.baseline,
                        ceiling: verdict.ceiling,
                        buckets: verdict.buckets,
                    },
                    host_payload: host,
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

    // The host reading prints AFTER the source verdict and never touches the
    // exit code below. The label says which surface each number describes,
    // because the whole defect this reading fixes was two different quantities
    // sharing one name.
    if (host !== null) {
        const label = host.host === null ? host.rules_path : host.host;
        process.stdout.write(`\n  host payload — ${label} (informational, not gated)\n`);
        for (const b of host.buckets) {
            process.stdout.write(`  ${('· ' + b.name).padEnd(38)} ${String(b.tokens).padStart(8)} tok\n`);
        }
        process.stdout.write(`  ${'· host total'.padEnd(38)} ${String(host.total).padStart(8)} tok\n`);
        const c = host.completeness;
        if (!c.complete) {
            process.stdout.write(
                `  ${'· PARTIAL TREE'.padEnd(38)} ${c.host_rule_files} rule file(s) vs ` +
                    `${c.source_rule_files} in the source.\n` +
                    '    This total is NOT a consumer reading. A maintainer checkout deduplicates a\n' +
                    '    project rule against the same rule at user scope, and a dev tree may hold a\n' +
                    '    partial projection — both shrink this number for reasons unrelated to the\n' +
                    '    projection mode. Measure a clean consumer-shaped root with\n' +
                    '    --project-rules-dir <path> to get the number a consumer would load.\n',
            );
        }
    }

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
