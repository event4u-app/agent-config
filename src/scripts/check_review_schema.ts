#!/usr/bin/env tsx
/**
 * Gate — every committed review-findings ledger conforms to its schema AND
 * declares its own independence consistently.
 *
 * The defect this closes is not a malformed file. It is a well-formed one that
 * SAYS NOTHING: a ledger produced by a single-model pass was byte-
 * indistinguishable from one backed by independent models, so a consumer read
 * "no findings" as cross-model acceptance. Silence defaulted to the strongest
 * possible reading, which is the wrong direction for an integrity field.
 *
 * Two checks, and the second is the one with teeth:
 *   1. schema conformance against review-findings.schema.json;
 *   2. `acceptance_status` and `assurance` must be the values
 *      `review_independence` derives — so a hand-set `accepted` beside a
 *      same-family reviewer set is caught rather than trusted.
 *
 * Exit codes:
 *   0 — every ledger conforms and declares consistently
 *   1 — one or more violations
 *   2 — the gate could not run (no ledger directory)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { independenceViolations } from './_lib/review_independence.js';
import { load_schema, validate, type YamlValue } from './validate_frontmatter.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const LEDGER_DIR = path.join(process.cwd(), 'agents', 'evidence', 'release-findings');

function selfTest(): number {
    const mk = (name: string, body: unknown): string => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'crs-selftest-'));
        const dir = path.join(root, 'agents', 'evidence', 'release-findings');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, name), JSON.stringify(body, null, 2) + '\n', 'utf-8');
        return root;
    };
    const run = (root: string): number =>
        runGateCli(REPO_ROOT, 'src/scripts/check_review_schema.ts', ['--quiet'], root);

    const base = {
        schema_version: 1,
        release: '1.0.0',
        reviewers: ['anthropic', 'openai'],
        findings: [],
    };

    return runSelfTest({
        gate: 'check_review_schema',
        minCases: 4,
        minRejectCases: 3,
        cases: [
            {
                name: 'a cross-family ledger declaring accepted passes',
                expect: 'accept',
                run: () =>
                    run(
                        mk('1.0.0.json', {
                            ...base,
                            review_independence: 'cross-family',
                            acceptance_status: 'accepted',
                            assurance: 'independent',
                        }),
                    ),
            },
            {
                name: 'a same-family ledger claiming accepted is rejected — the whole point of the pair',
                expect: 'reject',
                run: () =>
                    run(
                        mk('1.0.0.json', {
                            ...base,
                            reviewers: ['anthropic', 'anthropic'],
                            review_independence: 'same-family',
                            acceptance_status: 'accepted',
                            assurance: 'independent',
                        }),
                    ),
            },
            {
                name: 'a ledger that declares no independence at all is rejected — silence read as acceptance is the defect',
                expect: 'reject',
                run: () => run(mk('1.0.0.json', base)),
            },
            {
                name: 'a ledger whose assurance contradicts its independence is rejected',
                expect: 'reject',
                run: () =>
                    run(
                        mk('1.0.0.json', {
                            ...base,
                            reviewers: ['anthropic'],
                            review_independence: 'single-member',
                            acceptance_status: 'provisional',
                            assurance: 'independent',
                        }),
                    ),
            },
        ],
    });
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.includes('--self-test')) return selfTest();
    const quiet = args.includes('--quiet');

    if (!fs.existsSync(LEDGER_DIR)) {
        process.stderr.write(
            `❌  check_review_schema: ledger directory absent (${LEDGER_DIR}) — the gate cannot run\n`,
        );
        return 2;
    }

    const files = fs.readdirSync(LEDGER_DIR).filter((n) => n.endsWith('.json')).sort();
    if (files.length === 0) {
        process.stderr.write(
            `❌  check_review_schema: 0 ledgers under ${LEDGER_DIR} — a gate that scanned nothing has verified nothing\n`,
        );
        return 2;
    }

    const ledger = new GateLedger('check_review_schema');
    ledger.plan(files);
    const schema = load_schema('review-findings');
    const problems: string[] = [];

    for (const name of files) {
        const before = problems.length;
        let doc: Record<string, unknown>;
        try {
            doc = JSON.parse(fs.readFileSync(path.join(LEDGER_DIR, name), 'utf-8')) as Record<string, unknown>;
        } catch (exc) {
            problems.push(`${name}: unparseable JSON — ${String(exc)}`);
            ledger.fail(name, 'unparseable');
            continue;
        }
        for (const e of validate(doc as YamlValue, schema).filter((x) => x.severity !== 'warning')) {
            problems.push(`${name}: schema — ${e.format()}`);
        }
        for (const v of independenceViolations(doc)) {
            problems.push(`${name}: independence — ${v}`);
        }
        if (problems.length > before) ledger.fail(name, `${String(problems.length - before)} violation(s)`);
        else ledger.complete(name);
    }

    // SECOND SURFACE — step 2.2 of road-to-review-independence. Until it existed, this
    // gate scanned one directory with one producer in it, so `scanned: 1` meant "the only
    // producer of this record agrees with itself". `dispatch_r2_reviewer` now emits the
    // same record into its findings artefact, and those are checked here on the same
    // terms: the independence pair must be internally consistent wherever it is written,
    // or the derivation rule is advice rather than a contract.
    //
    // Only the independence check runs over this surface, not the release-findings schema
    // — an R2 artefact is a different document and validating it against the ledger
    // schema would report violations that are not violations.
    const REVIEWS_DIR = path.join(process.cwd(), 'agents', 'evidence', 'reviews');
    let reviewScanned = 0;
    if (fs.existsSync(REVIEWS_DIR)) {
        for (const name of fs.readdirSync(REVIEWS_DIR).filter((n) => n.endsWith('.md')).sort()) {
            const text = fs.readFileSync(path.join(REVIEWS_DIR, name), 'utf-8');
            const m = /<!--\s*(\{"review-independence".*?\})\s*-->/su.exec(text);
            if (m === null) continue;
            reviewScanned += 1;
            let rec: Record<string, unknown>;
            try {
                rec = (JSON.parse(m[1]!) as { 'review-independence': Record<string, unknown> })[
                    'review-independence'
                ];
            } catch (exc) {
                problems.push(`${name}: unparseable review-independence block — ${String(exc)}`);
                continue;
            }
            for (const v of independenceViolations(rec)) {
                problems.push(`${name}: independence — ${v}`);
            }
        }
    }

    ledger.finalize();
    process.stderr.write(`scanned: ${String(files.length + reviewScanned)}\n`);

    if (problems.length > 0) {
        process.stdout.write(
            `❌  check_review_schema: ${problems.length} violation(s) across ${files.length} ledger(s)\n\n`,
        );
        for (const p of problems) process.stdout.write(`  ${p}\n`);
        process.stdout.write(
            `\nA review artifact that does not declare its independence reads as cross-model\n` +
                `acceptance to every consumer. Derive the fields with _lib/review_independence.ts.\n`,
        );
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  check_review_schema: ${files.length} ledger(s) conform and declare independence consistently.\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { main };
