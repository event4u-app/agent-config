#!/usr/bin/env tsx
/**
 * compute_skill_tiers — which skills the host will describe, and which it won't.
 *
 * Phase 2.1 of `road-to-skill-delivery-over-mcp`. Tier A is the set predicted to
 * survive the host's listing budget; Tier B is everything else, which reaches
 * the model only through the turnkey server's `suggest_skill_for_task` /
 * `read_skill`.
 *
 * THE OUTPUT'S REAL JOB IS `model_inputs`, not the split. A tier assignment
 * without the order that produced it is unexplainable and unreproducible, and
 * risk 5 of the roadmap is precisely that a skill flips tiers between installs
 * and nobody can tell why. So every run records the context window, the
 * fraction, the per-entry cap, how many usage rows it actually had, and which
 * fallback it used when it had none.
 *
 * IT WILL USUALLY BE A FALLBACK. `agents/runtime/metrics/skill-usage.jsonl` was
 * last written 2026-05-16 and does not exist in a fresh checkout, so the
 * honest common case is `fallback: "alphabetical"` — and the pinned observation
 * in `tests/scripts/host_listing_model.test.ts` shows that fallback disagreeing
 * with the one real host observation on four of eight sampled entries. A Tier B
 * verdict from a fallback order is therefore a PREDICTION, not a measurement.
 * The `tiered` projection stays opt-in for exactly that reason.
 *
 * Output goes to `agents/runtime/state/skill-tiers.json` (gitignored, per-machine).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    CLAUDE_CODE_LISTING_DEFAULTS,
    modelListingBudget,
    type CatalogueEntry,
    type ModelAssumption,
} from './_lib/host_listing_model.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO = path.resolve(path.dirname(_HERE), '..', '..');
export const DEFAULT_SKILLS_DIR = path.join(REPO, 'src', 'skills');
export const USAGE_PATH = path.join(REPO, 'agents', 'runtime', 'metrics', 'skill-usage.jsonl');
export const TIERS_PATH = path.join(REPO, 'agents', 'runtime', 'state', 'skill-tiers.json');

export type Fallback = 'alphabetical' | 'pack-scope' | null;

export interface ModelInputs {
    context_window_tokens: number;
    fraction: number;
    per_entry_cap_chars: number;
    chars_per_token: number;
    budget_chars: number;
    usage_rows_used: number;
    fallback: Fallback;
    fill_order: string;
}

export interface TierSplit {
    schema: 1;
    computed_at: string;
    skills_dir: string;
    catalogue_count: number;
    model_inputs: ModelInputs;
    model_assumptions: readonly ModelAssumption[];
    tier_a: string[];
    tier_b: string[];
}

/** `description:` length in characters, or 0 when the file carries none. */
function descriptionChars(file: string): number {
    const raw = fs.readFileSync(file, 'utf8');
    const fm = /^---\n([\s\S]*?)\n---/.exec(raw);
    if (!fm) return 0;
    const line = /^description:[ \t]*(.*)$/m.exec(fm[1]!);
    if (!line) return 0;
    return line[1]!.replace(/^["']|["']$/g, '').length;
}

/** The projected catalogue, alphabetically. Missing dir → empty, never a throw. */
export function readCatalogue(skillsDir: string): CatalogueEntry[] {
    if (!fs.existsSync(skillsDir)) return [];
    return fs
        .readdirSync(skillsDir)
        .filter((slug) => fs.existsSync(path.join(skillsDir, slug, 'SKILL.md')))
        .map((slug) => ({
            name: slug,
            descriptionChars: descriptionChars(path.join(skillsDir, slug, 'SKILL.md')),
        }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Invocation-frequency order from the usage ledger, most-invoked first.
 *
 * A malformed line is skipped rather than fatal: the ledger is appended by a
 * collector reading host session files, and one bad line must not turn the whole
 * order into a silent empty — which would look identical to "no usage yet" and
 * send every skill to Tier B.
 */
export function usageOrderFrom(usagePath: string = USAGE_PATH): string[] {
    if (!fs.existsSync(usagePath)) return [];
    const counts = new Map<string, number>();
    for (const line of fs.readFileSync(usagePath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let rec: unknown;
        try {
            rec = JSON.parse(trimmed);
        } catch {
            continue;
        }
        if (!rec || typeof rec !== 'object') continue;
        const slug = (rec as Record<string, unknown>).slug;
        if (typeof slug !== 'string' || !slug) continue;
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([slug]) => slug);
}

export interface ComputeOptions {
    skillsDir?: string;
    /** Explicit order; omit to read the ledger. */
    usageOrder?: readonly string[];
    contextWindowTokens?: number;
    fraction?: number;
}

export function computeTiers(opts: ComputeOptions = {}): TierSplit {
    const skillsDir = opts.skillsDir ?? DEFAULT_SKILLS_DIR;
    const catalogue = readCatalogue(skillsDir);
    const usageOrder = opts.usageOrder ?? usageOrderFrom();
    const contextWindowTokens = opts.contextWindowTokens ?? 200_000;
    const fraction = opts.fraction ?? CLAUDE_CODE_LISTING_DEFAULTS.fraction;

    const result = modelListingBudget(catalogue, { contextWindowTokens, fraction, usageOrder });

    return {
        schema: 1,
        computed_at: new Date().toISOString().slice(0, 10),
        skills_dir: skillsDir,
        catalogue_count: catalogue.length,
        model_inputs: {
            context_window_tokens: contextWindowTokens,
            fraction,
            per_entry_cap_chars: CLAUDE_CODE_LISTING_DEFAULTS.perEntryCapChars,
            chars_per_token: CLAUDE_CODE_LISTING_DEFAULTS.charsPerToken,
            budget_chars: result.budgetChars,
            usage_rows_used: usageOrder.length,
            // `pack-scope` is reserved for the day a pack-ordered fallback is
            // wired; today the only fallback that exists is alphabetical, and
            // naming a fallback that never runs would be worse than naming none.
            fallback: usageOrder.length > 0 ? null : 'alphabetical',
            fill_order: result.fillOrder,
        },
        model_assumptions: result.assumptions,
        tier_a: result.surviving,
        tier_b: result.bare,
    };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const split = computeTiers({
        skillsDir: argv.includes('--skills-dir') ? argv[argv.indexOf('--skills-dir') + 1] : undefined,
    });
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(split, null, 2)}\n`);
        return 0;
    }
    fs.mkdirSync(path.dirname(TIERS_PATH), { recursive: true });
    fs.writeFileSync(TIERS_PATH, `${JSON.stringify(split, null, 2)}\n`, 'utf8');
    process.stdout.write(
        `✅  skill tiers → ${path.relative(REPO, TIERS_PATH)}\n` +
            `    Tier A ${split.tier_a.length} · Tier B ${split.tier_b.length} ` +
            `of ${split.catalogue_count}\n` +
            `    order: ${split.model_inputs.fill_order}` +
            `${split.model_inputs.fallback ? ` (fallback: ${split.model_inputs.fallback})` : ''}, ` +
            `${split.model_inputs.usage_rows_used} usage row(s)\n`,
    );
    return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    process.exit(main());
}
