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
 * ROW-LEVEL schema, opt-in (road-to-cost-parity-0-program § 1.2b/1.3): a
 * budget file that declares a `row_schema` block additionally has every row
 * of every top-level array checked for the fields it names — in practice
 * `source` (so a baseline figure without a traceable origin cannot enter the
 * file) plus the three honest-null fields. The honest-null contract is the
 * part that binds: a row that records a `revised_from` without a
 * `revision_evidence` pointer fails the file, because a target that moved
 * without published evidence is precisely the drift the clause exists to
 * refuse. Files that declare no `row_schema` are untouched by this half.
 *
 * Exit codes: 0 clean · 1 findings · 2 internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { asOf } from './_lib/as_of.js';
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

const DEFAULT_ROW_FIELDS = [
    'id',
    'unit',
    'baseline',
    'source',
    'revisable',
    'revision_evidence',
    'revised_from',
];

function isRow(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Row-level checks for budget files that opt in via a `row_schema` block.
 * Returns [] for every file that does not declare one.
 */
export function checkBudgetRows(relPath: string, doc: Record<string, unknown>): string[] {
    const schema = doc['row_schema'];
    if (!isRow(schema)) return [];

    const declared = schema['required_row_fields'];
    const required =
        Array.isArray(declared) && declared.every((f) => typeof f === 'string')
            ? (declared as string[])
            : DEFAULT_ROW_FIELDS;

    const errors: string[] = [];
    if (typeof doc['schema_version'] !== 'number') {
        errors.push(`${relPath}: \`row_schema\` declared but no numeric top-level \`schema_version\``);
    }
    if (typeof doc['registered_at'] !== 'string' || !DATE_RE.test(doc['registered_at'])) {
        errors.push(`${relPath}: \`row_schema\` declared but no valid top-level \`registered_at\` (YYYY-MM-DD)`);
    }

    for (const [key, value] of Object.entries(doc)) {
        if (!Array.isArray(value)) continue;
        value.forEach((row, index) => {
            if (!isRow(row)) return;
            const id = typeof row['id'] === 'string' ? row['id'] : `#${index}`;
            const where = `${relPath}: ${key}[${index}] (${id})`;

            for (const field of required) {
                if (!(field in row)) errors.push(`${where}: missing \`${field}\``);
            }
            if ('source' in row) {
                const source = row['source'];
                if (typeof source !== 'string' || source.trim() === '') {
                    errors.push(`${where}: empty \`source\` — a baseline figure needs a traceable origin`);
                }
            }
            if ('revisable' in row && row['revisable'] !== true) {
                errors.push(`${where}: \`revisable\` must be true — an unrevisable target is not honest-null`);
            }
            // The honest-null contract: a moved target must publish what moved it.
            const revisedFrom = row['revised_from'];
            if (revisedFrom !== null && revisedFrom !== undefined) {
                const evidence = row['revision_evidence'];
                if (typeof evidence !== 'string' || evidence.trim() === '') {
                    errors.push(
                        `${where}: sets \`revised_from\` without a \`revision_evidence\` pointer — a revision without published evidence`,
                    );
                }
            }
        });
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
    const today = asOf().toISOString().slice(0, 10);
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
        errors.push(...checkBudgetRows(rel, doc));
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
