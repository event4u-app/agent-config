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
 * THE CEILING IS MEASURED AT THE BASE REF, NOT STORED
 * ----------------------------------------------------
 * It used to be a stored `ci_delivery.grace_ceiling`, whose own text said *"It
 * may never move UP"* while `grace_ceiling_history` recorded it moving up
 * twice. ADR-264 resolved that against the practice and left the sentence
 * unenforced; `_lib/standing_bound_ratchet.ts` became the enforcement.
 *
 * `road-to-delivery-for-every-host` 4.4 retires the stored number entirely. An
 * AI council (2/2, 2026-09-10, under a written owner delegation) converged on
 *
 *     ceiling = max(design_ceiling, payload_at_base_ref + active grants)
 *
 * for one reason: a measured ceiling captures every merged reduction
 * automatically, where a stored one stays at its last hand-written number — so
 * payload a merge removed can be added straight back into the space it freed.
 * The ordinary path is therefore ZERO NET GROWTH while the tree is over design,
 * and the design ceiling once it is at or below. No per-PR headroom: both seats
 * refused one because a percentage or a fixed allowance against a moving base
 * authorises cumulative growth (138,413 × 1.05^10 ≈ 225,000).
 *
 * Three prerequisites came with the verdict and all three are in the pipeline
 * below. The base measurement FAILS CLOSED under `--require-base`, because a
 * base that cannot be read would otherwise grant an unbounded budget. The
 * shrink-only ratchet moved with the ceiling: `design_ceiling` and every
 * existing exception grant and watermark are now the bounded numbers. And the
 * catalogue exhaustiveness audit refuses payload sitting outside every measured
 * bucket, which defeats a stored ceiling exactly as it would defeat this one.
 *
 * A change whose offsetting reduction is genuinely unsafe takes a recorded,
 * human-approved, dated grant in `src/config/preamble-payload-exceptions.json`.
 * 96.8 % of the last 250 merged pull requests moved this payload by zero or
 * less, so the ordinary path stays autonomous and only the tail reaches a
 * person. `_lib/measured_payload_ceiling.ts` carries the mechanism and the
 * reasoning, including why no numeric cap is enforced.
 *
 * ADR-265 still holds for what this does NOT do: the 128-token Iron Law reserve
 * stays unshipped, because a mechanism that GRANTS budget cannot rest on a
 * verifier the change under review can edit.
 *
 * Exit codes: 0 within budget · 1 over budget, a bound rose, the ceiling could
 * not be measured under `--require-base`, or payload sits outside the catalogue
 * · 2 misuse / unreadable budget.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { censusClaudeMdHierarchy, censusRuleDir, censusSkillsCatalog } from './preamble_byte_census.js';
import { PREFIX_STABLE_SURFACES, prefixStableRoots } from './_lib/prefix_stable_surfaces.js';
import { HOST_SURFACES } from './_lib/host_projection_reach.js';
import { attributeGrowth, buildLedger, renderAttribution } from './_lib/asset_delivery_ledger.js';
import { resolveBaseRef } from './_lib/ratchet_base_ref.js';
import { extractSurfacesAtRef, measurePayloadAtRef } from './_lib/base_ref_payload.js';
import {
    type CeilingReading,
    computeCeiling,
    EXCEPTIONS_CONFIG_PATH,
    readExceptions,
    renderCeiling,
} from './_lib/measured_payload_ceiling.js';
import { auditCatalogue, type CatalogueAudit } from './_lib/payload_catalogue_completeness.js';
import {
    assertBoundsDidNotRise,
    type BoundsRatchetVerdict,
    boundsFrom,
    type GitRunner,
    realGit,
} from './_lib/standing_bound_ratchet.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
/**
 * Where this SCRIPT lives — the default tree to measure, and nothing more.
 *
 * Under prerequisite 3 of the measured-ceiling verdict, CI runs this file as it
 * exists at the BASE ref against the HEAD tree, so that a pull request cannot
 * edit the code that measures it. There the two diverge and `--repo-root`
 * carries the tree; everywhere else they are the same directory.
 */
const REPO_ROOT = path.resolve(HERE, '..', '..');

/** The budget config inside a given tree. */
function budgetFileIn(repoRoot: string): string {
    return path.join(repoRoot, 'src', 'config', 'preamble-payload-budget.json');
}
const BUDGET_FILE = budgetFileIn(REPO_ROOT);

interface Budget {
    baseline_tokens: number;
    headroom_pct: number;
    target_tokens: { median: number; p95: number };
    /**
     * `ci_delivery.grace_ceiling`, the RETAINED stored allowance — stage 1.
     *
     * It enters the ceiling through a `max`, so it can only ever widen the
     * bound and never tighten it. It is retained rather than deleted in the
     * change that introduces the measured ceiling because the gate runs at the
     * base ref and cannot validate its own introduction; stage 2 removes this
     * term from a base that already carries the measured code. `null` once it
     * is gone, and the formula then has one term fewer.
     */
    stored_ceiling: number | null;
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
    const stored = Number(delivery['grace_ceiling']);
    return {
        baseline_tokens: baseline,
        headroom_pct: headroom,
        target_tokens: { median: Number(target['median']), p95: Number(target['p95']) },
        stored_ceiling: Number.isFinite(stored) ? stored : null,
    };
}

/** The raw budget JSON, for the bound derivation that must see head and base
 *  through the SAME function. `readBudget` narrows; this does not. */
function readBudgetRaw(file: string): unknown {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
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
    /** How the ceiling was arrived at, and whether it may be trusted. */
    ceiling: CeilingReading;
    /** Payload the census does not enumerate. Empty findings = complete. */
    catalogue: CatalogueAudit;
    /** False when the payload is over the ceiling, a bound rose, the ceiling
     *  could not be measured under `--require-base`, or payload escaped the
     *  catalogue. */
    ok: boolean;
}

export interface DecideOptions {
    repoRoot?: string;
    budgetFile?: string;
    env?: NodeJS.ProcessEnv;
    git?: GitRunner;
    /** Test seam: pin the base ref instead of resolving it. `null` = none resolved. */
    baseRef?: string | null;
    /** Refuse instead of skipping when the base ref cannot be read. */
    requireBase?: boolean;
    /** Test seam: pin today's date for the exception-expiry branch. */
    today?: string;
    /** Test seam: supply the base payload instead of measuring the ref. */
    basePayload?: number | null;
    /**
     * Exception ids whose approval event was VERIFIED against the platform.
     *
     * Empty by default, which is the safe reading: a grant nobody confirmed is
     * a grant the diff asserted about itself. Only a caller with platform
     * access can populate this, which is why it is not read from the tree.
     */
    verifiedApprovals?: readonly string[];
}

/**
 * The measurement, the ceiling it is compared against, and everything that can
 * refuse independently of the size question.
 *
 * `evaluate` above answers "how big is the tree" and touches no ref; this
 * answers "may this tree ship" and needs the base one. They stay separate
 * because a census that silently depended on a remote ref would behave
 * differently in a shallow clone, and the census is the half other callers use.
 *
 * ORDER MATTERS ONLY IN ONE PLACE: the ceiling is established BEFORE the size
 * comparison, because a run that could not measure its ceiling has no
 * business reporting a tree as within one.
 */
export function decide(opts: DecideOptions = {}): Decision {
    const repoRoot = opts.repoRoot ?? REPO_ROOT;
    const git = opts.git ?? realGit;
    const budgetFile = opts.budgetFile ?? budgetFileIn(repoRoot);
    const budget = readBudget(budgetFile);
    const design = Math.round(budget.baseline_tokens * (1 + budget.headroom_pct / 100));

    const baseRef =
        opts.baseRef !== undefined ? opts.baseRef : resolveBaseRef(repoRoot, opts.env ?? process.env, git);

    // The base payload goes through THIS file's own census, so base and head
    // cannot be measured by two different definitions — the property that keeps
    // a measured ceiling from drifting against the number it bounds.
    const sumPayload = (root: string): number =>
        measureDeterministicPayload(root).reduce((n, b) => n + b.tokens, 0);
    let basePayload: number | null;
    let baseNote: string | null;
    if (opts.basePayload !== undefined) {
        basePayload = opts.basePayload;
        baseNote = basePayload === null ? 'the base payload was pinned to null by the caller' : null;
    } else if (baseRef === null || baseRef.trim() === '') {
        basePayload = null;
        baseNote = 'no base ref resolved';
    } else {
        const reading = measurePayloadAtRef({ repoRoot, ref: baseRef, measure: sumPayload });
        basePayload = reading.tokens;
        baseNote = reading.note;
    }

    const exceptionsFile = path.join(repoRoot, EXCEPTIONS_CONFIG_PATH);
    const ex = readExceptions(exceptionsFile);
    const ceiling = computeCeiling({
        designCeiling: design,
        basePayload,
        baseNote,
        headPayload: sumPayload(repoRoot),
        exceptions: ex.exceptions,
        exceptionErrors: ex.errors,
        verifiedApprovals: opts.verifiedApprovals ?? [],
        storedCeiling: budget.stored_ceiling,
        today: opts.today ?? new Date().toISOString().slice(0, 10),
        requireBase: opts.requireBase === true,
    });

    const verdict = evaluate(repoRoot, budgetFile, ceiling.ceiling);

    // The head-side bounds go through `boundsFrom` exactly as the base-side
    // ones do, from the raw configs rather than the narrowed ones — one
    // derivation for both sides, which is what the grace ceiling never had.
    let headBounds: Record<string, number> = { design_ceiling: design };
    try {
        const raw = readBudgetRaw(budgetFile);
        let rawEx: unknown = null;
        try {
            rawEx = JSON.parse(fs.readFileSync(exceptionsFile, 'utf-8'));
        } catch {
            /* absent ledger contributes no bounds */
        }
        headBounds = boundsFrom(raw, rawEx) ?? headBounds;
    } catch {
        /* readBudget above already threw on an unusable file */
    }
    const bounds = assertBoundsDidNotRise({
        repoRoot,
        baseRef,
        git,
        headBounds,
        requireBase: opts.requireBase === true,
    });

    const catalogue = auditCatalogue(repoRoot);

    return {
        verdict,
        bounds,
        ceiling,
        catalogue,
        ok: bounds.ok && ceiling.ok && catalogue.findings.length === 0 && verdict.withinBudget,
    };
}

/**
 * Per-asset attribution for a refusal, against the base tree.
 *
 * Every failure mode returns `null` — the caller treats attribution as an
 * explanation, never as a precondition for refusing. A gate that failed to
 * refuse because it could not explain itself would be strictly worse than one
 * that refuses without the explanation.
 *
 * It reads the base tree through `_lib/base_ref_payload`, the same
 * materialisation the ceiling uses. It used to shell `git archive` directly,
 * which silently drops `export-ignore` paths — harmless for the two roots this
 * ledger reads, and a live 746-token defect for the ceiling. Both now go
 * through the one reader rather than through two that differ in a way nobody
 * would notice until the numbers disagreed.
 */
function attributeGrowthAgainstBase(repoRoot: string, baseRef: string | null): string[] | null {
    if (baseRef === null || baseRef.trim() === '') return null;
    const t = extractSurfacesAtRef({ repoRoot, ref: baseRef });
    if (t.tree === null) return null;
    try {
        const [rulesRel, skillsRel] = prefixStableRoots();
        const before = buildLedger(
            path.join(t.tree, rulesRel ?? ''),
            path.join(t.tree, skillsRel ?? ''),
            t.tree,
        );
        const after = buildLedger(
            path.join(repoRoot, rulesRel ?? ''),
            path.join(repoRoot, skillsRel ?? ''),
            repoRoot,
        );
        if (before.rows.length === 0) return null;
        return renderAttribution(attributeGrowth(before.rows, after.rows));
    } catch {
        return null;
    } finally {
        t.dispose();
    }
}

/** The stderr header for a refused bound. Exported so both refusals are testable. */
export function boundsRefusalHeader(b: BoundsRatchetVerdict): string {
    return b.verified
        ? '❌  a shrink-only standing-payload bound rose in this change:\n'
        : '❌  the standing-payload bounds could not be VERIFIED, and this run requires it:\n';
}

/**
 * The bound check, rendered for a human — on BOTH paths, green and red.
 *
 * A check that only speaks when it fails is a check nobody audits until it is
 * already load-bearing. Printing the compared ref and the earlier bound on the
 * passing path is also the only way a reader can tell "verified and unchanged"
 * from "skipped because no base ref resolved", which are different facts.
 *
 * THREE STATES, not two, and the third is why this was rewritten. An
 * unverifiable bound and a risen one are both `ok: false` and need opposite
 * actions — repair the checkout, or lower the addition. The first cut of the
 * enforcing posture rendered both as `ROSE`, which a completion review caught:
 * it sends an operator to shrink a rule over a fetch problem. `SKIPPED` is
 * reserved for the ADVISORY skip, where nothing was refused at all.
 */
export function renderBounds(b: BoundsRatchetVerdict): string {
    const label = 'shrink-only bound ratchet';
    if (b.note !== null && b.ok) {
        return `  ${label.padEnd(38)} ${'SKIPPED'.padStart(8)} — ${b.note}\n`;
    }
    if (!b.verified) {
        return (
            `  ${label.padEnd(38)} ${'UNVERIFIED'.padStart(8)} — ` +
            `${b.note ?? 'the bounds could not be read'} (this run requires it)\n`
        );
    }
    const n = b.baseBounds === null ? 0 : Object.keys(b.baseBounds).length;
    const state = b.ok ? 'ok' : 'ROSE';
    return (
        `  ${label.padEnd(38)} ${state.padStart(8)} — ` +
        `${String(n)} bound(s) at ${b.baseRef ?? 'n/a'}, shrink-only (ADR-264)\n`
    );
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const json = argv.includes('--format=json') || argv.includes('--json');

    // `--ceiling <n>` is GONE. It existed to hand the gate the stored grace
    // ceiling, and the ceiling is measured now. Refusing loudly rather than
    // ignoring it is the point: a caller still passing a number believes it is
    // setting the bound, and silently measuring something else would be the
    // most expensive kind of no-op. The replacement for a deliberate, bounded
    // widening is an approved entry in the exceptions ledger.
    if (argv.includes('--ceiling')) {
        process.stderr.write(
            '❌  preamble-payload budget: --ceiling was removed. The ceiling is now MEASURED as\n' +
                '    max(design_ceiling, payload at the base ref + active grants), so a caller-supplied\n' +
                `    number cannot set it. To widen it deliberately, record an approved grant in\n` +
                `    ${EXCEPTIONS_CONFIG_PATH} — it carries an approver, a reason, a watermark and an\n` +
                '    expiry, which a flag never did.\n',
        );
        return 2;
    }

    // `--require-base`: refuse instead of skipping when the base ref cannot be
    // read. An AI council (2/2, 2026-09-10) made this blocking for the move to
    // a base-measured ceiling, because an unreadable base costs a comparison
    // under a stored ceiling and grants an unbounded budget under a measured
    // one. Opt-in rather than the default, and rather than derived from
    // `GITHUB_ACTIONS`: a shallow clone, a first commit and a detached build
    // all legitimately have no base, and a gate that reds on a developer's
    // machine gets switched off.
    const requireBase = argv.includes('--require-base');

    // `--approved <id>` (repeatable): this caller VERIFIED that exception's
    // approval event against the platform. Nothing in the tree can establish
    // that — an `approved_by` field in the diff requesting the grant is
    // self-asserted data, which was the 2026-09-11 council's hardest pushback
    // in both seats. So the fact arrives from outside, from a caller that
    // queried the platform, and a grant nobody confirmed contributes zero
    // tokens and refuses the run.
    const verifiedApprovals: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] !== '--approved') continue;
        const id = argv[i + 1];
        if (id === undefined || id.startsWith('--')) {
            process.stderr.write('❌  preamble-payload budget: --approved needs an exception id.\n');
            return 2;
        }
        verifiedApprovals.push(id);
    }

    // `--repo-root <path>`: measure THIS tree, rather than the one this script
    // happens to sit in. Prerequisite 3 of the measured-ceiling verdict — CI
    // runs the gate as it exists at the BASE ref against the HEAD tree, so a
    // pull request cannot edit the code that measures it. Both seats chose this
    // over code-owner review on the gate, which would put the sole maintainer
    // in the path of every gate-editing pull request. Its honest limit,
    // anthropic's words: "the mechanism does not prevent the exploit; it makes
    // the exploit auditable" — a weakening merged first and exploited second is
    // visible in `git log` and is not blocked.
    const ri = argv.indexOf('--repo-root');
    const repoRootArg = ri !== -1 ? argv[ri + 1] : undefined;
    if (ri !== -1 && (repoRootArg === undefined || repoRootArg.startsWith('--'))) {
        process.stderr.write('❌  preamble-payload budget: --repo-root needs a path.\n');
        return 2;
    }
    const repoRoot = repoRootArg === undefined ? REPO_ROOT : path.resolve(repoRootArg);
    if (!fs.existsSync(budgetFileIn(repoRoot))) {
        process.stderr.write(
            `❌  preamble-payload budget: ${repoRoot} carries no ${'src/config/preamble-payload-budget.json'} — ` +
                'that is not a tree this gate can measure.\n',
        );
        return 2;
    }

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
                repoRoot,
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
        decision = decide({ repoRoot, requireBase, verifiedApprovals });
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
                    measured_ceiling: {
                        ceiling: decision.ceiling.ceiling,
                        design_ceiling: decision.ceiling.designCeiling,
                        base_payload: decision.ceiling.basePayload,
                        effective_base: decision.ceiling.effectiveBase,
                        active_grants: decision.ceiling.activeGrants,
                        active_exception_ids: decision.ceiling.activeIds,
                        verified: decision.ceiling.verified,
                        ok: decision.ceiling.ok,
                        note: decision.ceiling.note,
                        violations: decision.ceiling.violations,
                    },
                    catalogue_completeness: {
                        ok: decision.catalogue.findings.length === 0,
                        trees_seen: decision.catalogue.treesSeen,
                        files_scanned: decision.catalogue.filesScanned,
                        findings: decision.catalogue.findings,
                    },
                    bound_ratchet: {
                        ok: decision.bounds.ok,
                        base_ref: decision.bounds.baseRef,
                        base_bounds: decision.bounds.baseBounds,
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
    process.stdout.write(renderCeiling(decision.ceiling));
    process.stdout.write(renderBounds(decision.bounds));
    process.stdout.write(
        `  ${'catalogue completeness'.padEnd(38)} ` +
            `${(decision.catalogue.findings.length === 0 ? 'ok' : 'GAPS').padStart(8)} — ` +
            `${String(decision.catalogue.treesSeen)} projected tree(s), ` +
            `${String(decision.catalogue.filesScanned)} file(s) scanned for stray rule payload\n`,
    );

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

    // THE CEILING IS ESTABLISHED BEFORE THE SIZE QUESTION. A run that could not
    // measure its own ceiling has no business reporting a tree as within one,
    // and an expired grant is a refusal whatever the payload does.
    if (!decision.ceiling.ok) {
        process.stderr.write(
            (decision.ceiling.verified
                ? '❌  the standing-payload exception ledger refuses this run:\n'
                : '❌  the standing-payload ceiling could not be MEASURED, and this run requires it:\n') +
                decision.ceiling.violations.map((v) => `      · ${v}\n`).join(''),
        );
        return 1;
    }

    // Payload the census cannot see is payload no ceiling bounds. Refused
    // BEFORE the size comparison for the same reason: a green "within budget"
    // over an incomplete catalogue is a measurement of the wrong set.
    if (decision.catalogue.findings.length > 0) {
        process.stderr.write(
            '❌  standing payload sits outside every measured bucket:\n' +
                decision.catalogue.findings.map((v) => `      · ${v}\n`).join(''),
        );
        return 1;
    }

    // The bound is checked BEFORE the size question and independently of it. A
    // change that lifts its own ceiling has already defeated the gate, and
    // reporting that as "within budget" would be the config-weakening move
    // wearing a green checkmark.
    if (!decision.bounds.ok) {
        // Two refusals, two different fixes. `verified: false` means the bound
        // could not be READ under `--require-base`; the header must not send the
        // reader to lower a ceiling that never moved.
        process.stderr.write(
            boundsRefusalHeader(decision.bounds) +
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
        const attribution = attributeGrowthAgainstBase(repoRoot, decision.bounds.baseRef);

        // REJECTION INSTRUMENTATION — prerequisite 4a's converged floor.
        //
        // Both council seats refused to derive an exception cap from the 250-PR
        // delta distribution, for one reason: the sample is CENSORED by the very
        // ratchet a cap would relax, so every percentile describes what got
        // through rather than what was attempted. The thing that uncensors it is
        // recording the deltas that were BLOCKED, which nothing did.
        //
        // This line is that record, and its limits are worth stating rather than
        // implying: it is a log line in a CI job, not a database. It captures
        // attempts that reached this gate and failed; it cannot see a change
        // nobody pushed. It is deliberately machine-greppable from a workflow
        // log so the distribution can be rebuilt later without a schema anybody
        // has to maintain today.
        process.stdout.write(
            'payload-rejection: ' +
                JSON.stringify({
                    measured: verdict.measured,
                    ceiling: verdict.ceiling,
                    attempted_delta: decision.ceiling.effectiveBase === null
                        ? null
                        : verdict.measured - decision.ceiling.effectiveBase,
                    design_ceiling: decision.ceiling.designCeiling,
                    base_payload: decision.ceiling.basePayload,
                    base_ref: decision.bounds.baseRef,
                    active_grants: decision.ceiling.activeGrants,
                    buckets: verdict.buckets.map((b) => ({ name: b.name, tokens: b.tokens })),
                }) +
                '\n',
        );

        process.stderr.write(
            `❌  per-spawn preamble payload grew past the ratchet: ${verdict.measured} > ${verdict.ceiling} tok.\n` +
                `    Every rule and skill description here is re-written on EVERY subagent spawn, so growth\n` +
                `    is paid per spawn, not once. Shrink the addition, or migrate the prose out of the\n` +
                `    standing rule. The ceiling may NOT be widened to fit it — it is MEASURED at the base\n` +
                `    ref, so there is no number to edit. A change whose offsetting reduction is genuinely\n` +
                `    unsafe takes an approved, dated grant in ${EXCEPTIONS_CONFIG_PATH}.\n`,
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
