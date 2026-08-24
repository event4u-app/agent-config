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
 * Exit codes: 0 within budget · 1 over budget · 2 misuse / unreadable budget.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { censusClaudeMdHierarchy, censusRuleDir, censusSkillsCatalog } from './preamble_byte_census.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BUDGET_FILE = path.join(REPO_ROOT, 'src', 'config', 'preamble-payload-budget.json');

interface Budget {
    baseline_tokens: number;
    headroom_pct: number;
    target_tokens: { median: number; p95: number };
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
    return {
        baseline_tokens: baseline,
        headroom_pct: headroom,
        target_tokens: { median: Number(target['median']), p95: Number(target['p95']) },
    };
}

/** Measure only what the repo tree determines — no `~`, no transcripts, no network. */
export function measureDeterministicPayload(
    repoRoot: string = REPO_ROOT,
): Array<{ name: string; tokens: number; files: number }> {
    const projectRules = censusRuleDir(path.join(repoRoot, 'dist', 'agent-src', 'rules'));
    const skills = censusSkillsCatalog(path.join(repoRoot, 'dist', 'agent-src', 'skills'));
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

export function main(argv: string[] = process.argv.slice(2)): number {
    const json = argv.includes('--format=json') || argv.includes('--json');
    // `--ceiling <n>`: the grace ceiling the CI step reads out of
    // `ci_delivery.grace_ceiling`. Read from the budget file there, never written
    // in the workflow, so the number has exactly one home. A non-numeric or
    // tighter-than-design value is IGNORED rather than honoured — see `evaluate`.
    const ci = argv.indexOf('--ceiling');
    const override = ci !== -1 && argv[ci + 1] !== undefined ? Number(argv[ci + 1]) : undefined;
    let verdict: BudgetVerdict;
    try {
        verdict = evaluate(undefined, undefined, override);
    } catch (err) {
        process.stderr.write(`❌  preamble-payload budget: ${(err as Error).message}\n`);
        return 2;
    }

    // A ratchet over a measurement of nothing always passes: move
    // `dist/agent-src/` and every census returns zero, which is trivially under
    // any ceiling. Exit 2 (misuse / unreadable budget — the could-not-run
    // code), never 1, which asserts the payload actually grew.
    try {
        assertScanned({
            gate: 'check_preamble_payload_budget',
            scanned: verdict.buckets.reduce((n, b) => n + b.files, 0),
            units: 'payload source file(s)',
            roots: ['dist/agent-src/rules', 'dist/agent-src/skills', 'CLAUDE.md'],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  preamble-payload budget: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    if (json) {
        process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
        return verdict.withinBudget ? 0 : 1;
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
    if (!verdict.withinBudget) {
        process.stderr.write(
            `❌  per-spawn preamble payload grew past the ratchet: ${verdict.measured} > ${verdict.ceiling} tok.\n` +
                `    Every rule and skill description here is re-written on EVERY subagent spawn, so growth\n` +
                `    is paid per spawn, not once. Either shrink the addition, or raise baseline_tokens in\n` +
                `    src/config/preamble-payload-budget.json with the reason in the same commit.\n`,
        );
        return 1;
    }
    process.stdout.write('✅  per-spawn preamble payload within the ratchet.\n');
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
