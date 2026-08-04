#!/usr/bin/env tsx
/**
 * lint_budget_ownership — every gate budget carries an owner and a review
 * date (road-to-credible-install Phase 6.2, anti-ossification).
 *
 * A budget without a named owner and an annual review date fossilizes: the
 * number outlives its rationale and the gate becomes ritual. This lint
 * fails the build when any budget config under src/config/ lacks:
 *   - `owner`     (non-empty string)
 *   - `review_by` (YYYY-MM-DD; may be past — a PAST date is a WARN-level
 *                  reminder printed to stderr, not a failure, so an overdue
 *                  review never blocks unrelated PRs; a MISSING date fails)
 *
 * Scope: src/config/*budget*.json (top-level fields). Per-entry overrides
 * are allowed but not required — the top-level owner/review_by covers the
 * file.
 *
 * Exit codes: 0 clean · 1 findings · 2 internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CONFIG_DIR = path.join(REPO_ROOT, 'src', 'config');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function checkBudgetDoc(relPath: string, doc: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const owner = doc['owner'];
    if (typeof owner !== 'string' || owner.trim() === '') {
        errors.push(`${relPath}: missing non-empty top-level \`owner\``);
    }
    const review = doc['review_by'];
    if (typeof review !== 'string' || !DATE_RE.test(review)) {
        errors.push(`${relPath}: missing/invalid top-level \`review_by\` (YYYY-MM-DD)`);
    }
    return errors;
}

export function budgetFiles(dir: string = CONFIG_DIR): string[] {
    try {
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.json') && f.toLowerCase().includes('budget'))
            .map((f) => path.join(dir, f));
    } catch {
        return [];
    }
}

export function main(): number {
    const files = budgetFiles();
    // `*budget*.json` IS this gate's corpus definition, not a content-derived
    // subset: zero matches means src/config/ moved or the budgets were deleted,
    // and the old "nothing to lint" exit 0 could not tell either from a healthy
    // tree. Of the two documented failure codes, 1 is the one the gate actually
    // returns when it will not vouch for the tree; 2 is reserved for a throw.
    try {
        assertScanned({
            gate: 'lint_budget_ownership',
            scanned: files.length,
            units: 'budget config(s)',
            roots: ['src/config'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    const errors: string[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const abs of files) {
        const rel = path.relative(REPO_ROOT, abs);
        let doc: Record<string, unknown>;
        try {
            doc = JSON.parse(fs.readFileSync(abs, 'utf-8')) as Record<string, unknown>;
        } catch (e) {
            errors.push(`${rel}: unparseable JSON (${(e as Error).message})`);
            continue;
        }
        errors.push(...checkBudgetDoc(rel, doc));
        const review = doc['review_by'];
        if (typeof review === 'string' && DATE_RE.test(review) && review < today) {
            process.stderr.write(
                `⚠️  ${rel}: review_by ${review} is overdue — re-affirm or adjust the budget\n`,
            );
        }
    }
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`❌  budget ownership: ${e}\n`);
        return 1;
    }
    process.stdout.write(`✅  budget ownership OK (${files.length} budget config(s))\n`);
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}
