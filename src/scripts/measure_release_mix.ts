#!/usr/bin/env tsx
/**
 * Release governance-vs-product mix — measured from changed paths, published as
 * two views, with no threshold.
 *
 * Why this exists, and what it deliberately is not.
 *
 * An external reviewer asked twice for a per-PR rule: "no meta/governance
 * feature without a user-facing artefact in the same PR". The AI council
 * DECLINED that proposal (2026-09-04, anthropic/claude-sonnet-4-5 +
 * openai/codex-default, 2 rounds, quorum 2/2, $0.00 — both seats
 * subscription-authed) on two grounds: a same-PR gate measures packaging rather
 * than progress, since one token consumer-file edit legitimises an otherwise
 * governance-only pull request; and it rejects legitimate work by construction,
 * since a CI fix, a dependency bump and an analysis round producing only
 * roadmaps are all real work with no consumer surface. The decline is recorded
 * in `docs/decisions/ADR-253-per-pr-user-artefact-gate-declined.md`.
 *
 * This script is the replacement both seats specified: classify at RELEASE
 * level, publish two views, attach a response obligation, and refuse to pick a
 * threshold until at least two readings exist. It therefore **enforces
 * nothing about the ratio**. It measures and it publishes. The one enforced
 * consequence lives in `check_release_highlights.ts` and is about the
 * completeness of the written response, never about the number.
 *
 * The two views.
 *
 * - **Commit view** — exclusive counts per category, plus `mixed`, plus
 *   `unclassified`. A commit is classified from the files it touches.
 * - **Diff view** — added/deleted lines per category over the whole range.
 *
 * Generated projections and lockfiles (`dist/`, `.augment/`, `.claude/`,
 * `package-lock.json`, …) are removed from BOTH views by name. In this
 * repository `dist/` is a byte-exact projection of `src/`, so leaving it in
 * would let a mechanical regeneration dominate every reading. A commit left
 * with no path after that exclusion lands in the `generated_only` diagnostic
 * rather than in maintenance — otherwise the ratio would depend on whether the
 * regeneration was committed separately from the source edit that caused it.
 *
 * Classification reads paths, never subjects.
 *
 * Commit subjects are mutable, inconsistently formatted, and can contradict the
 * files a commit touches. Nothing in this file reads `%s`, `%b` or any other
 * message field; the only git output consumed is a name list and a numstat.
 * `tests/scripts/measure_release_mix.test.ts` pins that by rewriting a
 * subject with `git commit --amend` and asserting the reading is byte-identical.
 *
 * `mixed` is never collapsed into a category.
 *
 * Collapsing `mixed` into product would recreate the exact gaming the declined
 * rule permits. A commit touching two classified categories is `mixed` and is
 * reported as its own bucket in both views.
 *
 * `unclassified` is separate from `mixed` and does not cause it. A commit whose
 * paths are all unmatched is `unclassified`; a commit with one classified
 * category plus unmatched paths keeps that category and carries
 * `has_unclassified`. Conflating taxonomy uncertainty with genuine
 * cross-category work would hide both.
 *
 * Usage.
 *
 *   measure_release_mix --from <ref> --to <ref> [--label <tag>] [--json <path>] [--quiet]
 *   measure_release_mix --audit          # every top-level tracked path resolves
 *
 * Exit codes: 0 clean · 1 an unresolved path in `--audit` · 2 usage or git error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const TAXONOMY_PATH = path.join(_HERE, '..', 'release_mix_taxonomy.json');

export type Category = 'consumer' | 'governance' | 'maintenance' | 'unclassified';
export const CLASSIFIED: readonly Category[] = ['consumer', 'governance', 'maintenance'];

export interface Taxonomy {
    taxonomy_version: string;
    excluded_generated: string[];
    rules: { prefix: string; category: Category }[];
    governance_contracts: string[];
}

export function loadTaxonomy(file = TAXONOMY_PATH): Taxonomy {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Taxonomy;
    if (!raw.taxonomy_version) throw new Error('taxonomy carries no taxonomy_version');
    return raw;
}

/** True when the path is a generated projection or a lockfile — dropped from both views. */
export function isExcluded(p: string, tax: Taxonomy): boolean {
    return tax.excluded_generated.some((pre) => (pre.endsWith('/') ? p.startsWith(pre) : p === pre));
}

/**
 * Longest-prefix-wins. A path matching no rule is `unclassified` — a reported
 * state, never a silent default into some category.
 */
export function classifyPath(p: string, tax: Taxonomy): Category {
    return classifyPathDetailed(p, tax).category;
}

/**
 * The same decision, with the rule that made it. `matched: false` is the
 * failure `--audit` looks for: a path that fell through every rule, which is
 * not the same thing as a path the taxonomy deliberately calls unclassified.
 */
export function classifyPathDetailed(
    p: string,
    tax: Taxonomy,
): { category: Category; matched: boolean; rule: string } {
    if (tax.governance_contracts.includes(p)) {
        return { category: 'governance', matched: true, rule: `governance_contracts:${p}` };
    }
    let best: { len: number; category: Category; rule: string } | null = null;
    for (const rule of tax.rules) {
        if (!p.startsWith(rule.prefix)) continue;
        if (best === null || rule.prefix.length > best.len) {
            best = { len: rule.prefix.length, category: rule.category, rule: rule.prefix };
        }
    }
    return best === null
        ? { category: 'unclassified', matched: false, rule: '' }
        : { category: best.category, matched: true, rule: best.rule };
}

export interface CommitVerdict {
    /** The bucket the commit lands in. `generated_only` is a diagnostic, not a view bucket. */
    bucket: Category | 'mixed' | 'generated_only';
    categories: Category[];
    has_unclassified: boolean;
}

/** Classify ONE commit from its changed paths. Nothing here reads the subject. */
export function classifyCommit(paths: readonly string[], tax: Taxonomy): CommitVerdict {
    const kept = paths.filter((p) => !isExcluded(p, tax));
    if (kept.length === 0) {
        return { bucket: 'generated_only', categories: [], has_unclassified: false };
    }
    const seen = new Set<Category>();
    for (const p of kept) seen.add(classifyPath(p, tax));
    const has_unclassified = seen.has('unclassified');
    const classified = [...seen].filter((c) => c !== 'unclassified').sort();
    if (classified.length === 0) return { bucket: 'unclassified', categories: [], has_unclassified: true };
    if (classified.length === 1) return { bucket: classified[0]!, categories: classified, has_unclassified };
    return { bucket: 'mixed', categories: classified, has_unclassified };
}

function git(args: string[], cwd = REPO_ROOT): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
    return r.stdout;
}

export interface Reading {
    schema_version: 1;
    taxonomy_version: string;
    classifier_version: string;
    label: string;
    range: { from: string; to: string; from_sha: string; to_sha: string };
    merge_handling: 'no-merges';
    rename_handling: 'git-default';
    commit_view: Record<string, number>;
    diff_view: Record<string, { added: number; deleted: number }>;
    diagnostics: {
        generated_only_commits: number;
        commits_with_unclassified: number;
        unclassified_paths: string[];
        mixed_combinations: Record<string, number>;
        largest_contributors: Record<string, [string, number][]>;
    };
    response_obligation: { triggered: boolean; rule: string; governance_only: number; consumer_only: number };
}

/** The classifier's own version, bumped independently of the taxonomy's. */
export const CLASSIFIER_VERSION = '1.0.0';

/**
 * The response obligation's trigger, stated once so the gate and the report
 * cannot drift: governance-only commits STRICTLY outnumber consumer-only
 * commits over the span. Strict inequality is the literal reading of the
 * roadmap's own wording and both council seats named it explicitly.
 */
export const OBLIGATION_RULE = 'governance-only commits > consumer-only commits';

export function measureRange(from: string, to: string, tax: Taxonomy, label = '', cwd = REPO_ROOT): Reading {
    const shas = git(['log', '--no-merges', '--format=%H', `${from}..${to}`], cwd)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

    const commit_view: Record<string, number> = {
        consumer: 0, governance: 0, maintenance: 0, unclassified: 0, mixed: 0,
    };
    const mixed_combinations: Record<string, number> = {};
    const unclassified_paths = new Set<string>();
    let generated_only_commits = 0;
    let commits_with_unclassified = 0;

    for (const sha of shas) {
        const paths = git(['show', '--name-only', '--format=', sha], cwd)
            .split('\n').map((s) => s.trim()).filter(Boolean);
        const v = classifyCommit(paths, tax);
        if (v.bucket === 'generated_only') { generated_only_commits += 1; continue; }
        commit_view[v.bucket] = (commit_view[v.bucket] ?? 0) + 1;
        if (v.has_unclassified) commits_with_unclassified += 1;
        if (v.bucket === 'mixed') {
            const key = v.categories.join('+');
            mixed_combinations[key] = (mixed_combinations[key] ?? 0) + 1;
        }
        for (const p of paths) {
            if (!isExcluded(p, tax) && classifyPath(p, tax) === 'unclassified') unclassified_paths.add(p);
        }
    }

    const diff_view: Record<string, { added: number; deleted: number }> = {
        consumer: { added: 0, deleted: 0 },
        governance: { added: 0, deleted: 0 },
        maintenance: { added: 0, deleted: 0 },
        unclassified: { added: 0, deleted: 0 },
    };
    const touchCount: Record<string, Record<string, number>> = {
        consumer: {}, governance: {}, maintenance: {}, unclassified: {},
    };

    for (const line of git(['diff', '--numstat', `${from}..${to}`], cwd).split('\n')) {
        const parts = line.split('\t');
        if (parts.length < 3) continue;
        const [addRaw, delRaw, pathRaw] = parts as [string, string, string];
        // `git diff --numstat` renders a rename as `old => new`; take the new path.
        const p = pathRaw.includes('=>') ? pathRaw.replace(/^.*=>\s*/, '').replace(/[{}]/g, '') : pathRaw;
        if (isExcluded(p, tax)) continue;
        const cat = classifyPath(p, tax);
        // A binary file renders as `-`; it contributes a touch, not a line count.
        diff_view[cat]!.added += addRaw === '-' ? 0 : Number(addRaw);
        diff_view[cat]!.deleted += delRaw === '-' ? 0 : Number(delRaw);
        const top = p.split('/').slice(0, 2).join('/');
        touchCount[cat]![top] = (touchCount[cat]![top] ?? 0) + 1;
    }

    const largest_contributors: Record<string, [string, number][]> = {};
    for (const cat of Object.keys(touchCount)) {
        largest_contributors[cat] = Object.entries(touchCount[cat]!)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5) as [string, number][];
    }

    const governance_only = commit_view.governance ?? 0;
    const consumer_only = commit_view.consumer ?? 0;

    return {
        schema_version: 1,
        taxonomy_version: tax.taxonomy_version,
        classifier_version: CLASSIFIER_VERSION,
        label: label || `${from}..${to}`,
        range: {
            from, to,
            from_sha: git(['rev-parse', from], cwd).trim(),
            to_sha: git(['rev-parse', to], cwd).trim(),
        },
        merge_handling: 'no-merges',
        rename_handling: 'git-default',
        commit_view,
        diff_view,
        diagnostics: {
            generated_only_commits,
            commits_with_unclassified,
            unclassified_paths: [...unclassified_paths].sort().slice(0, 50),
            mixed_combinations,
            largest_contributors,
        },
        response_obligation: {
            triggered: governance_only > consumer_only,
            rule: OBLIGATION_RULE,
            governance_only,
            consumer_only,
        },
    };
}

export function renderReading(r: Reading): string {
    const cv = r.commit_view;
    const lines: string[] = [];
    lines.push(`release-mix · ${r.label} · taxonomy ${r.taxonomy_version} · classifier ${r.classifier_version}`);
    lines.push(`  range            ${r.range.from_sha.slice(0, 9)}..${r.range.to_sha.slice(0, 9)} (${r.merge_handling})`);
    lines.push(`  commit view      consumer ${cv.consumer} · governance ${cv.governance} · maintenance ${cv.maintenance} · mixed ${cv.mixed} · unclassified ${cv.unclassified}`);
    for (const cat of ['consumer', 'governance', 'maintenance', 'unclassified'] as const) {
        const d = r.diff_view[cat]!;
        lines.push(`  diff view        ${cat.padEnd(13)} +${d.added} / -${d.deleted}`);
    }
    lines.push(`  diagnostics      generated-only commits ${r.diagnostics.generated_only_commits} · commits carrying unclassified paths ${r.diagnostics.commits_with_unclassified}`);
    lines.push(`  response owed    ${r.response_obligation.triggered ? 'YES' : 'no'} (${r.response_obligation.rule}: ${r.response_obligation.governance_only} vs ${r.response_obligation.consumer_only})`);
    lines.push('  NOTE             a level, not a verdict — no threshold is committed to this repository.');
    return lines.join('\n');
}

/**
 * AC-2 — every tracked path resolves to exactly one category, or to a rule that
 * says `unclassified` on purpose. A path that matches NO rule is the failure:
 * it would otherwise be counted as taxonomy uncertainty when it is really a
 * taxonomy hole. Reported grouped by the level at which the taxonomy actually
 * decides, so `src/` shows its subdirectories rather than one aggregate row.
 */
export function auditTree(tax: Taxonomy, cwd = REPO_ROOT): {
    rows: { unit: string; category: Category; files: number }[];
    unmatched: string[];
} {
    const byUnit = new Map<string, { category: Category; files: number }>();
    const unmatched: string[] = [];
    for (const f of git(['ls-files'], cwd).split('\n')) {
        const file = f.trim();
        if (!file || isExcluded(file, tax)) continue;
        const d = classifyPathDetailed(file, tax);
        if (!d.matched) {
            unmatched.push(file);
            continue;
        }
        const unit = d.rule.startsWith('governance_contracts:') ? 'docs/contracts/ (exception list)' : d.rule;
        const cur = byUnit.get(unit);
        if (cur) cur.files += 1;
        else byUnit.set(unit, { category: d.category, files: 1 });
    }
    const rows = [...byUnit.entries()]
        .map(([unit, v]) => ({ unit, category: v.category, files: v.files }))
        .sort((a, b) => a.unit.localeCompare(b.unit));
    return { rows, unmatched };
}

function usage(msg: string): never {
    process.stderr.write(`measure_release_mix: ${msg}\n`);
    process.stderr.write('usage: measure_release_mix --from <ref> --to <ref> [--label <tag>] [--json <path>] [--quiet]\n');
    process.stderr.write('       measure_release_mix --audit\n');
    process.exit(2);
}

export function main(argv: readonly string[]): number {
    const args = [...argv];
    const flag = (name: string): string | undefined => {
        const i = args.indexOf(name);
        return i === -1 ? undefined : args[i + 1];
    };
    const tax = loadTaxonomy();

    if (args.includes('--audit')) {
        const { rows, unmatched } = auditTree(tax);
        for (const r of rows) {
            process.stdout.write(`  ${r.category.padEnd(13)} ${String(r.files).padStart(5)}  ${r.unit}\n`);
        }
        if (unmatched.length > 0) {
            process.stderr.write(`\nmeasure_release_mix: ${unmatched.length} tracked path(s) match no rule:\n`);
            for (const u of unmatched.slice(0, 20)) process.stderr.write(`  ${u}\n`);
            return 1;
        }
        const files = rows.reduce((n, r) => n + r.files, 0);
        process.stdout.write(
            `\nOK — ${files} tracked paths over ${rows.length} classification units, all resolved (taxonomy ${tax.taxonomy_version}).\n`,
        );
        return 0;
    }

    const from = flag('--from');
    const to = flag('--to');
    if (!from || !to) usage('--from and --to are required');
    const reading = measureRange(from, to, tax, flag('--label') ?? '');
    const jsonPath = flag('--json');
    if (jsonPath) {
        fs.mkdirSync(path.dirname(path.resolve(jsonPath)), { recursive: true });
        fs.writeFileSync(path.resolve(jsonPath), `${JSON.stringify(reading, null, 2)}\n`, 'utf8');
    }
    if (!args.includes('--quiet')) process.stdout.write(`${renderReading(reading)}\n`);
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (e) {
        process.stderr.write(`measure_release_mix: ${(e as Error).message}\n`);
        process.exit(2);
    }
}
