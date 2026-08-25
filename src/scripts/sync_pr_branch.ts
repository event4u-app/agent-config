#!/usr/bin/env tsx
/**
 * Bring the branch up to its PR base before a push, so the PR never goes stale.
 *
 * `check_branch_freshness` already DETECTS "behind the base" and refuses the
 * push. What did not exist was the other half: doing something about it. So the
 * documented sequence — freshness → merge the base in → regenerate → verify →
 * push (`/create-pr` § 1b-ii) — was entirely model-carried, and a step carried
 * only by prose is a step that gets skipped under time pressure. Measured on
 * PR #1391: the base moved three times during one run, the push was rejected
 * twice for it, and the PR reached `CONFLICTING` before anyone noticed.
 *
 * Deliberately NOT wired into the pre-push hook. This MUTATES the working tree —
 * a merge commit, possibly regenerated files — and a hook that rewrites the tree
 * mid-push turns one rejected push into an unreviewed commit. Detection belongs
 * in the hook (and is already there); resolution belongs to a step the agent runs
 * with the result in front of it.
 *
 * A conflict is NOT auto-resolved and never will be by this script. It stops,
 * names the conflicted paths, and says which of them are generated (regenerate,
 * do not hand-merge) versus authored (a human decision). Auto-resolving a
 * content conflict is how a parallel session's work disappears.
 *
 * Classification changes the ADVICE, not the conflict. A path stays a hotspot by
 * frequency while becoming mechanical to resolve, so a class added here is never
 * conflict-count reduction and must not be banked as drawdown (AI council
 * 2026-08-21, both seats; roadmap road-to-merge-hotspot-drawdown).
 *
 * Exit codes: 0 = already current, or merged cleanly · 1 = conflict, or the base
 * could not be resolved · 2 = internal error. `scanned:` on every path.
 */

import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { reportScanned } from './_lib/scan_scope.js';

const NETWORK_TIMEOUT_MS = 8_000;

/** Paths that are GENERATED — a conflict here is regenerated, never hand-merged. */
const GENERATED = [
    // Untracked in THIS repository since 2026-08-21 (it was the #1 conflict
    // path: 830 commits/60d, in the conflict set of every open CONFLICTING PR).
    // The entry STAYS anyway, and the retirement criterion is a declared window
    // rather than "one release" — the AI council flagged the release count as
    // arbitrary and unverifiable. Remove this entry once no open branch predates
    // the untrack commit, which is checkable:
    //
    //   git branch -r --contains <untrack-commit>   # must list every open branch
    //
    // Until then a straggler branch created before the untrack still carries the
    // tracked file, and a conflict on it is still resolved by regeneration.
    'agents/roadmaps-progress.md',
    'agents/index.md',
    'docs/catalog.md',
    'dist/agent-src/',
    // Written by `src/scripts/adr/regenerate_index.ts`, which takes the decisions
    // directory as an ARGUMENT — so the path literal appears nowhere in the
    // generator and every grep-based audit of this list missed it. Found instead
    // by measurement: 4 of the last 50 sessions resolved a conflict here, and
    // its only correct resolution is `task regenerate-adr-index`, never a hunk
    // merge of two append-shaped indexes.
    'docs/decisions/INDEX.md',
    // Compiled by `compile_router.ts`. The `dist/agent-src/` prefix above does
    // NOT match a sibling one level up under `dist/`, so this file was routed to
    // a human decision despite being pure build output.
    'dist/router.json',
    '.augment/',
    // Compiled from `hook_manifest.yaml` by `task build-ts`, never hand-written.
    // It was classified AUTHORED until 2026-08-20, so this tool told the reader
    // to "read both sides" on a file where mixing hunks yields a concern table
    // matching NEITHER branch. One session resolved this same conflict three
    // times and named it structural: main adds a concern and recompiles, so
    // every open branch collides here. Regenerate; never merge.
    'src/scripts/hook_manifest.json',
    // Written together by one `build_archive_index.ts` call (`:409-410`) from the
    // archived roadmap tree, so neither is ever hand-authored. They were
    // classified AUTHORED until 2026-08-21, which made this tool ask for a human
    // decision about a file whose only correct resolution is regeneration --
    // the identical defect the hook_manifest.json comment above records, on two
    // more paths at 47 commits/60d each. They conflict in 2 of the 7 open PRs
    // measured for road-to-merge-hotspot-drawdown. Regenerate; never merge.
    'agents/roadmaps/archive/INDEX.md',
    'agents/roadmaps/archive/index.json',
    // ── Added 2026-08-25 (road-to-merge-surface-zero 1.1). Each carries its
    // write site, because this list tells a human to DISCARD one side, and an
    // entry added on a conflict count alone would tell them to discard hand
    // work. Counts are from `pr_conflict_census --limit 2000` over 60 days.
    //
    // Written by `build_proof.ts:500` from `docs/CLAIMS.md`. 26 resolutions, and
    // it fails in pairs: a CLAIMS.md edit leaves it stale, which reds both the
    // drift-guard test and `demo-commands-still-pass`.
    'docs/proof.md',
    // Both written by `generate_catalog.ts` (`:166` for llms.txt) from SKILL.md
    // frontmatter. Neither has ever been hand-authored.
    'docs/skills-catalog.md',
    'llms.txt',
    // Written by `lint_originality.ts:340`. Named by step 1.1 and included
    // although the census found ZERO conflicts on it in either window — it is
    // genuinely generated and classifying it costs nothing. Recorded rather than
    // quietly dropped: the step named it on conflict frequency, and that premise
    // does not hold.
    'agents/reports/originality.json',
    'agents/reports/originality.md',
];

/**
 * Generated paths a literal cannot express.
 *
 * `isGenerated` matches on equality or a trailing-slash prefix, so a per-pack
 * manifest needs a pattern. Kept as a separate named list rather than by
 * loosening the literal matcher: a glob inside the array above would make every
 * future entry ambiguous about which kind of match it asks for.
 */
const GENERATED_PATTERNS: readonly { readonly re: RegExp; readonly why: string }[] = [
    {
        // `generate_pack_manifests.ts:427`, and the file's own first line reads
        // "Generated by scripts/generate_pack_manifests.ts — DO NOT EDIT BY
        // HAND". 12 resolutions over 60 days across two packs.
        re: /^src\/domains\/[^/]+\/pack\.yaml$/,
        why: 'per-pack manifest written by generate_pack_manifests.ts',
    },
];

/**
 * Paths that are MEASURED BASELINES -- a conflict here is neither regenerated
 * nor hand-merged. It is RE-MEASURED on the merged tree, and the number that
 * measurement produces is the resolution.
 *
 * Why this is a third class and not a variant of GENERATED: a generated file has
 * one correct content given the tree, so "regenerate" is a complete instruction.
 * A ratchet baseline records what a tree MEASURED at a point in time, and two
 * branches legitimately measured two different trees -- so there is no side to
 * take and no file to re-render. Picking a side on a ratchet number is how the
 * ratchet silently loosens, and mixing hunks yields a baseline matching neither
 * branch.
 *
 * Why this tool never performs the re-measurement itself (AI council 2026-08-21,
 * both seats): "re-measure instead of merge" delegates conflict resolution to a
 * script and its execution environment, and a wrong or environment-dependent
 * measurement would overwrite a deliberate tightening with nothing objecting,
 * because the result looks measured either way. So this class NAMES the
 * resolution and stops. The human runs it, with the result in front of them.
 *
 * `gate-violation-baselines.json` conflicted in 7 of the 7 open PRs measured for
 * road-to-merge-hotspot-drawdown, and it is not gitignorable: its counts are not
 * a function of the tree, so the committed number is the only "before" side that
 * exists.
 *
 * `estate-count-budget.json` USED to be the other member and is deliberately not
 * listed any more (ADR-243). Its metrics ARE a function of the tree, so
 * `check_estate_count` measures the floor at the base ref instead of storing it,
 * and the file now carries policy only. A conflict in it is an ordinary AUTHORED
 * one — two humans editing the same policy sentence — and telling the reader to
 * "re-run the measurement" for that would name a resolution the file no longer
 * has. Removing the row is the point of the change, not an oversight: the row
 * described a conflict that no longer occurs.
 */
const REMEASURED = ['src/config/gate-violation-baselines.json'];

function sh(cmd: string, args: readonly string[], cwd: string): { ok: boolean; out: string; err: string } {
    const r = spawnSync(cmd, [...args], {
        cwd,
        encoding: 'utf-8',
        timeout: NETWORK_TIMEOUT_MS,
        maxBuffer: 32 * 1024 * 1024,
    });
    return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '').trim() };
}

/** True when `rel` is a generated artefact rather than an authored one. */
/**
 * The subset of GENERATED that this repository no longer commits at all
 * (`road-to-generated-artifacts-out-of-index`, 2026-08-22). They are still
 * generated, so they stay in `GENERATED` and keep being reported — a straggler
 * branch created before the untrack still carries them, which is exactly when
 * the reader needs to be told something.
 *
 * What changes is the INSTRUCTION. A branch that predates the cutover hits a
 * `modify/delete` conflict here, not a content conflict, and `git checkout
 * --ours` has no side to check out: the correct resolution is to take the
 * deletion. Printing the generic advice would send the reader to re-add the
 * file, which is precisely how PR #1505 put the dashboard back on `main` a day
 * after it was first untracked.
 */
const UNTRACKED_BY_DESIGN: readonly string[] = [
    'agents/roadmaps-progress.md',
    'agents/roadmaps/archive/INDEX.md',
    'agents/roadmaps/archive/index.json',
];

/** Is this a generated path this repository deliberately does not commit? */
export function isUntrackedByDesign(rel: string): boolean {
    return UNTRACKED_BY_DESIGN.includes(rel);
}

export function isGenerated(rel: string): boolean {
    const norm = rel.replace(/\\/g, '/');
    if (GENERATED.some((g) => (g.endsWith('/') ? norm.startsWith(g) : norm === g))) return true;
    return GENERATED_PATTERNS.some((p) => p.re.test(norm));
}

/**
 * True when `rel` is listed as a measured ratchet baseline.
 *
 * This does NOT assert exclusivity against `GENERATED` — it only reads its own
 * array. `classifyConflicts` establishes the precedence (generated first), so a
 * path added to both arrays would route as generated while this predicate also
 * returned true, and no test would catch it. Keep the arrays disjoint; the
 * per-path exclusivity assertions in the test file cover today's two members
 * only.
 */
export function isRemeasured(rel: string): boolean {
    const norm = rel.replace(/\\/g, '/');
    return REMEASURED.some((g) => (g.endsWith('/') ? norm.startsWith(g) : norm === g));
}

export interface Plan {
    /** 0 = nothing to do or merged · 1 = needs a human · 2 = internal. */
    exit: 0 | 1 | 2;
    message: string;
    /** Conflicted paths, split so the caller knows which to regenerate. */
    generated: string[];
    /** Conflicted measured baselines — re-measure on the merged tree, never merge. */
    remeasured: string[];
    authored: string[];
    scanned: number;
}

/**
 * Classify a conflicted file list.
 *
 * Pure, so the split is testable without producing a real merge conflict — and
 * the split is the useful part: a generated conflict has one correct resolution
 * (regenerate) and an authored one has none that a script may choose.
 */
export function classifyConflicts(files: readonly string[]): Pick<Plan, 'generated' | 'remeasured' | 'authored'> {
    const generated: string[] = [];
    const remeasured: string[] = [];
    const authored: string[] = [];
    for (const f of files) {
        const rel = f.trim();
        if (rel === '') continue;
        if (isGenerated(rel)) generated.push(rel);
        else if (isRemeasured(rel)) remeasured.push(rel);
        else authored.push(rel);
    }
    return { generated, remeasured, authored };
}

/**
 * Render the conflict report for a plan that needs a human.
 *
 * Pure and exported so the WORDING is testable without producing a real merge
 * conflict. That matters more than it looks: the per-class instruction is the
 * entire value of the classification, and while this lived inline in `main()`
 * the whole block could be deleted and every test stayed green — the header
 * still counted the conflict, and the paths went unnamed with no instruction.
 */
export function renderConflictReport(plan: Plan): string {
    const out: string[] = [`❌  ${plan.message}\n`];
    const untracked = plan.generated.filter(isUntrackedByDesign);
    const regenerable = plan.generated.filter((f) => !isUntrackedByDesign(f));
    if (regenerable.length > 0) {
        out.push(`\n  GENERATED (${String(regenerable.length)}) — resolve by REGENERATING, never by mixing hunks:\n`);
        for (const f of regenerable) out.push(`    · ${f}\n`);
        out.push('    → git checkout --ours <file> && task sync && task generate-tools\n');
    }
    if (untracked.length > 0) {
        out.push(
            `\n  UNTRACKED BY DESIGN (${String(untracked.length)}) — this repository does not commit these; TAKE THE DELETION:\n`,
        );
        for (const f of untracked) out.push(`    · ${f}\n`);
        out.push('    → git rm --cached -- <file>   (the working-tree copy stays; regenerate it locally)\n');
    }
    if (plan.remeasured.length > 0) {
        out.push(
            `\n  REMEASURED (${String(plan.remeasured.length)}) — RE-RUN THE MEASUREMENT on the merged tree; never merge, never pick a side:\n`,
        );
        for (const f of plan.remeasured) out.push(`    · ${f}\n`);
        out.push('    → resolve the tree, then re-run the gate that owns the baseline and record its number\n');
    }
    if (plan.authored.length > 0) {
        out.push(`\n  AUTHORED (${String(plan.authored.length)}) — a human decision, read both sides:\n`);
        for (const f of plan.authored) out.push(`    · ${f}\n`);
    }
    return out.join('');
}

/** Resolve the base this branch will actually merge into. */
export function resolveBase(repo: string, override: string | null): { base: string | null; how: string } {
    if (override !== null && override.trim() !== '') {
        return { base: override.trim(), how: 'given by --base' };
    }
    const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repo).out.trim();
    if (branch !== '' && branch !== 'HEAD') {
        // The forge knows the REAL base, which matters for a stacked or
        // release-line PR: measuring against the repo default would compare
        // against a branch this PR never merges into.
        const pr = sh('gh', ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'baseRefName', '--limit', '1'], repo);
        if (pr.ok) {
            try {
                const rows = JSON.parse(pr.out || '[]') as Array<{ baseRefName?: string }>;
                const b = rows[0]?.baseRefName;
                if (typeof b === 'string' && b !== '') {
                    return { base: `origin/${b}`, how: `the open PR base (${b})` };
                }
            } catch {
                /* fall through to the default-branch probe */
            }
        }
    }
    const head = sh('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], repo);
    if (head.ok && head.out.trim() !== '') {
        return { base: head.out.trim(), how: 'the repo default branch' };
    }
    return { base: null, how: 'unresolvable — no open PR and no origin/HEAD' };
}

export function sync(repo: string, baseOverride: string | null, dryRun: boolean): Plan {
    const { base, how } = resolveBase(repo, baseOverride);
    if (base === null) {
        return { exit: 1, message: `cannot resolve a base to update against — ${how}.`, generated: [], remeasured: [], authored: [], scanned: 0 };
    }

    const fetched = sh('git', ['fetch', 'origin', '--prune'], repo);
    if (!fetched.ok) {
        // Unreachable remote is not "already current" — saying so is the whole
        // point, since a silent pass here reproduces the staleness this closes.
        return {
            exit: 0,
            message: `unverified — could not fetch origin (${fetched.err.split('\n')[0] ?? '?'}). Base freshness NOT checked.`,
            generated: [],
            remeasured: [],
            authored: [],
            scanned: 0,
        };
    }

    const behind = sh('git', ['rev-list', '--count', `HEAD..${base}`], repo).out.trim();
    if (behind === '' || behind === '0') {
        return { exit: 0, message: `already current with ${base} (${how}).`, generated: [], remeasured: [], authored: [], scanned: 1 };
    }
    if (dryRun) {
        return {
            exit: 0,
            message: `${behind} commit(s) behind ${base} (${how}) — would merge it in. Dry run, nothing changed.`,
            generated: [],
            remeasured: [],
            authored: [],
            scanned: 1,
        };
    }

    const merge = sh('git', ['merge', base, '--no-edit'], repo);
    if (merge.ok) {
        return {
            exit: 0,
            message:
                `merged ${base} in (${how}, was ${behind} behind). REGENERATE derived files now — a clean ` +
                'auto-merge of a generated file is still wrong.',
            generated: [],
            remeasured: [],
            authored: [],
            scanned: 1,
        };
    }

    const conflicted = sh('git', ['diff', '--name-only', '--diff-filter=U'], repo).out.split('\n');
    const split = classifyConflicts(conflicted);
    return {
        exit: 1,
        message:
            `merge of ${base} (${how}) hit ${String(split.generated.length + split.remeasured.length + split.authored.length)} conflict(s). ` +
            'NOT auto-resolved: a content conflict is where a parallel session\'s work disappears.',
        ...split,
        scanned: 1,
    };
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let repo = process.cwd();
    let base: string | null = null;
    let dryRun = false;
    let quiet = false;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        const val = (): string | null => {
            const v = args[++i];
            return v === undefined || v.startsWith('--') ? null : v;
        };
        if (a === '--repo') {
            const v = val();
            if (v === null) {
                process.stderr.write('❌  sync_pr_branch: --repo requires a value\n');
                reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'argument error' });
                return 1;
            }
            repo = v;
        } else if (a === '--base') {
            const v = val();
            if (v === null) {
                process.stderr.write('❌  sync_pr_branch: --base requires a value\n');
                reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'argument error' });
                return 1;
            }
            base = v;
        } else if (a === '--dry-run') {
            dryRun = true;
        } else if (a === '--quiet') {
            quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: sync_pr_branch [--repo PATH] [--base REF] [--dry-run] [--quiet]\n' +
                    '  Merges the PR base into the current branch so the PR does not go stale.\n' +
                    '  Resolves the base from the open PR when there is one. A conflict is\n' +
                    '  reported and never auto-resolved; generated and authored conflicts are\n' +
                    '  listed separately because only the first has one correct resolution;\n' +
                    '  measured ratchet baselines are a third class, re-measured not merged.\n',
            );
            reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'help output' });
            return 0;
        } else {
            process.stderr.write(`❌  sync_pr_branch: unknown argument \`${a}\`\n`);
            reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'argument error' });
            return 1;
        }
    }

    let plan: Plan;
    try {
        plan = sync(repo, base, dryRun);
    } catch (exc) {
        reportScanned({ gate: 'sync_pr_branch', scanned: 0, units: 'base ref(s)', roots: ['origin'], allowEmpty: 'internal error' });
        process.stderr.write(`❌  sync_pr_branch: internal error: ${exc instanceof Error ? exc.message : String(exc)}\n`);
        return 2;
    }

    if (plan.exit === 1) {
        process.stdout.write(renderConflictReport(plan));
    } else if (plan.message.startsWith('unverified')) {
        // Loud even under --quiet: unverified reported silently is
        // indistinguishable from verified, which is the defect being closed.
        process.stdout.write(`⚠️  sync_pr_branch: ${plan.message}\n`);
    } else if (!quiet || plan.scanned > 0) {
        process.stdout.write(`✅  ${plan.message}\n`);
    }
    reportScanned({
        gate: 'sync_pr_branch',
        scanned: plan.scanned,
        units: 'base ref(s)',
        roots: ['origin'],
        ...(plan.scanned === 0 ? { allowEmpty: 'base unresolvable or remote unreachable — stated above' } : {}),
    });
    return plan.exit;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href || process.argv[1] === _HERE;
}
if (_isCliEntry()) {
    process.exit(main());
}
