#!/usr/bin/env tsx
/**
 * Every design-artifact eval fixture id must be cited by some surface.
 *
 * The fixtures file used to assert that the lifecycle contract's branch table
 * "references these ids". It cites nine of them; the rest are gated elsewhere
 * (the design-fidelity mechanics guideline, the lane-matrix test) — and a
 * handful were cited by nothing at all. An uncited fixture is an eval nobody
 * runs and no contract depends on, which is exactly the shape of coverage that
 * looks real in a count and is absent in practice.
 *
 * This checks citation, not correctness: an id must appear outside its own
 * definition. Which surface cites it is the author's call.
 *
 * Exit codes: 0 every id cited, 1 one or more uncited.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const QUIET = process.argv.includes('--quiet');

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'design-artifacts', 'eval-fixtures.md');

/** Surfaces allowed to satisfy a citation. */
const SCAN_ROOTS: readonly string[] = [
    path.join(REPO, 'docs', 'contracts'),
    path.join(REPO, 'docs', 'guidelines'),
    path.join(REPO, 'src', 'skills'),
    path.join(REPO, 'src', 'rules'),
    path.join(REPO, 'tests', 'scripts'),
];

const SCAN_EXTS: ReadonlySet<string> = new Set(['.md', '.ts']);

function walk(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(p, out);
        } else if (SCAN_EXTS.has(path.extname(entry.name))) {
            out.push(p);
        }
    }
}

function main(): number {
    let fixtureText: string;
    try {
        fixtureText = fs.readFileSync(FIXTURES, { encoding: 'utf-8' });
    } catch {
        process.stderr.write(`lint-eval-fixture-citations: cannot read ${FIXTURES}\n`);
        return 1;
    }

    // Ids are declared as `### daf-...` headings or as leading table cells.
    const ids = new Set<string>();
    for (const m of fixtureText.matchAll(/^###\s+(daf-[a-z0-9-]+)\s*$/gm)) {
        ids.add(m[1] as string);
    }
    for (const m of fixtureText.matchAll(/^\|\s*`(daf-[a-z0-9-]+)`\s*\|/gm)) {
        ids.add(m[1] as string);
    }
    if (ids.size === 0) {
        process.stderr.write('lint-eval-fixture-citations: no fixture ids found — parser drift.\n');
        return 1;
    }

    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
        walk(root, files);
    }
    // The citation haystack is the scanned unit. A vanished SCAN_ROOTS tree
    // still fails — as "N of N uncited" — but names the fixtures as the
    // culprit; asserting the walk here reports the real cause instead.
    try {
        assertScanned({
            gate: 'lint_eval_fixture_citations',
            scanned: files.length,
            units: 'citation-surface file(s)',
            roots: SCAN_ROOTS.map((r) => path.relative(REPO, r)),
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    const haystack = files
        .map((f) => {
            try {
                return fs.readFileSync(f, { encoding: 'utf-8' });
            } catch {
                return '';
            }
        })
        .join('\n');

    const uncited = [...ids].filter((id) => !haystack.includes(id)).sort();
    if (uncited.length > 0) {
        for (const id of uncited) {
            process.stdout.write(
                `lint-eval-fixture-citations: \`${id}\` is cited by no contract, ` +
                    'guideline, skill, rule, or test — an eval nobody runs.\n',
            );
        }
        process.stderr.write(
            `lint-eval-fixture-citations: ${uncited.length} of ${ids.size} fixture id(s) uncited.\n`,
        );
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(
            `lint-eval-fixture-citations: ${ids.size} fixture id(s), all cited.\n`,
        );
    }
    return 0;
}

process.exit(main());
