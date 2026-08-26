#!/usr/bin/env tsx
/**
 * CI guard: every candidate row in an ADR evidence sweep carries a route AND a
 * dated follow-up.
 *
 * `road-to-evidence-based-adr-governance` 3.4 asks for exactly this, and the
 * step was once marked `[x]` on the adjudication pass it DID run rather than on
 * the half its own `verify:` named — "zero candidate rows without both a route
 * and a dated follow-up; a lint over sweep artifacts red on a dateless
 * candidate row". Neither the columns nor the lint existed. That is the
 * "prose lifecycle enforcement is satisfied by its weakest honest reading"
 * defect the roadmap cites as its third motivating measurement, so the fix is a
 * gate rather than another sentence.
 *
 * WHAT A CANDIDATE IS. A table row whose disposition cell carries `REVIEW-NOW`
 * or `SUPERSEDE (candidate)` — the two dispositions that assert the record needs
 * further action. Every other disposition in the vocabulary is terminal for the
 * sweep (`KEEP`, `HISTORICAL-ONLY`, …) or names its own mechanism, and a
 * follow-up requirement on those would be noise.
 *
 * WHY A DATE AND NOT A PROMISE. The three accepted follow-up forms are a linked
 * roadmap step, an ADR draft, or an explicit dated defer on the ADR-134 pattern.
 * All three are checkable only through the date: without one, a lapse is a
 * silent extension instead of a compliance finding, which is the property the
 * step was specified to buy.
 *
 * HONEST SCOPE. This gate checks that a route and a date are PRESENT and that
 * the routing section covers every candidate. It cannot check that the route is
 * the right venue or that the date is met — the first is a judgement and the
 * second is a calendar. Read a green run as "every candidate is routed and
 * dated", never as "every follow-up happened".
 *
 * Exit codes: 0 = clean, 1 = violations found, 2 = internal error.
 *
 * Usage:
 *     ./scripts-run src/scripts/lint_adr_sweep_routing
 *     ./scripts-run src/scripts/lint_adr_sweep_routing --json
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

let SWEEP_DIR = path.join(REPO_ROOT, 'docs', 'decisions');

/** Test seam, mirroring the sibling roadmap lints. */
export function _setSweepDirForTest(p: string): void {
    SWEEP_DIR = p;
}

/** Sweep artifacts: `adr-evidence-sweep-*.md` under docs/decisions/. */
const SWEEP_NAME = /^adr-evidence-sweep-.*\.md$/;

const CANDIDATE = /REVIEW-NOW|SUPERSEDE \(candidate\)/;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;
const ROUTING_HEADING = /^##+\s+Candidate routing\b/;
const NEXT_HEADING = /^##\s+/;

export interface Violation {
    file: string;
    line: number;
    key: string;
    msg: string;
}

/**
 * The record identity a candidate row and its routing row must agree on.
 *
 * Sweep tables label the same record four ways — `208`, `ADR-239`,
 * `ADR-016 installer-architecture`, `docs/adrs/router/0001 three-tier-routing`
 * — so a literal string match would report every row as unrouted. Normalising
 * to the numeric identity is what makes the two sections comparable at all.
 */
export function recordKey(cell: string): string | null {
    const text = cell.replace(/[`*[\]]/g, '').trim();
    const area = /^docs\/adrs\/([a-z-]+)\/0*(\d+)/.exec(text);
    if (area) return `${area[1]}/${String(Number(area[2]))}`;
    const numbered = /^(?:ADR-)?0*(\d{1,4})\b/.exec(text);
    if (numbered) return `adr/${String(Number(numbered[1]))}`;
    return null;
}

function cells(line: string): string[] {
    return line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());
}

/** Is this a table body row (not a header or a `|---|` separator)? */
function isBodyRow(line: string): boolean {
    return line.startsWith('|') && !/^\|[\s:-]+\|/.test(line);
}

export interface SweepScan {
    /** key -> first line number the candidate was seen on */
    candidates: Map<string, number>;
    /** key -> { route, followUp, line } */
    routed: Map<string, { route: string; followUp: string; line: number }>;
    /** true when the artifact has a `## Candidate routing` section at all */
    hasRoutingSection: boolean;
}

export function scanSweep(text: string): SweepScan {
    const lines = text.split('\n');
    const candidates = new Map<string, number>();
    const routed = new Map<string, { route: string; followUp: string; line: number }>();
    let inRouting = false;
    let hasRoutingSection = false;
    let inFence = false;

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (/^\s*```/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;

        if (ROUTING_HEADING.test(line)) {
            inRouting = true;
            hasRoutingSection = true;
            continue;
        }
        if (inRouting && NEXT_HEADING.test(line) && !ROUTING_HEADING.test(line)) {
            inRouting = false;
        }
        if (!isBodyRow(line)) continue;

        const c = cells(line);
        const key = recordKey(c[0] ?? '');
        if (key === null) continue;

        if (inRouting) {
            // | Record | Disposition | Route | Dated follow-up |
            routed.set(key, {
                route: (c[2] ?? '').trim(),
                followUp: (c[3] ?? '').trim(),
                line: i + 1,
            });
            continue;
        }
        if (CANDIDATE.test(line) && !candidates.has(key)) {
            candidates.set(key, i + 1);
        }
    }
    return { candidates, routed, hasRoutingSection };
}

export function lintSweep(rel: string, text: string): [Violation[], number] {
    const { candidates, routed, hasRoutingSection } = scanSweep(text);
    const out: Violation[] = [];
    if (candidates.size > 0 && !hasRoutingSection) {
        out.push({
            file: rel,
            line: 1,
            key: '—',
            msg:
                `${candidates.size} candidate row(s) and no \`## Candidate routing\` section. ` +
                'Every REVIEW-NOW / SUPERSEDE (candidate) row needs a route and a dated follow-up ' +
                '(road-to-evidence-based-adr-governance 3.4).',
        });
        return [out, candidates.size];
    }
    for (const [key, line] of [...candidates].sort((a, b) => a[1] - b[1])) {
        const row = routed.get(key);
        if (row === undefined) {
            out.push({
                file: rel,
                line,
                key,
                msg: `candidate ${key} has no row in \`## Candidate routing\` — unrouted.`,
            });
            continue;
        }
        if (row.route === '' || row.route === '—') {
            out.push({ file: rel, line: row.line, key, msg: `candidate ${key} has an empty route cell.` });
        }
        if (!ISO_DATE.test(row.followUp)) {
            out.push({
                file: rel,
                line: row.line,
                key,
                msg:
                    `candidate ${key} carries no YYYY-MM-DD in its follow-up cell — a dateless ` +
                    'follow-up makes a lapse a silent extension rather than a compliance finding.',
            });
        }
    }
    return [out, candidates.size];
}

/** Floors for `--self-test`, declared here so a truncation is a visible diff. */
const SELF_TEST_MIN_CASES = 6;
const SELF_TEST_MIN_REJECT = 4;

const SCRIPT_REL = 'src/scripts/lint_adr_sweep_routing.ts';

/**
 * Build a one-artifact sweep in a temp dir and run the REAL CLI against it.
 *
 * The candidate table and the routing table are supplied separately because
 * every rejection this gate can make is a disagreement between the two.
 */
function _selfTestFixture(name: string, candidateRows: string, routingSection: string): number {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `adr-sweep-${name}-`));
    const docs = path.join(dir, 'docs', 'decisions');
    fs.mkdirSync(docs, { recursive: true });
    fs.writeFileSync(
        path.join(docs, 'adr-evidence-sweep-fixture.md'),
        `# fixture\n\n## Tranche dispositions\n\n| ADR | Disposition |\n|---|---|\n${candidateRows}\n${routingSection}\n`,
        'utf8',
    );
    return runGateCli(REPO_ROOT, SCRIPT_REL, ['--dir', docs], dir);
}

const _GOOD_ROUTING =
    '## Candidate routing\n\n| Record | Disposition | Route | Dated follow-up |\n|---|---|---|---|\n' +
    '| ADR-016 | REVIEW-NOW | council | disposition by **2026-10-03** |\n';

function selfTest(): number {
    const cases: SelfTestCase[] = [
        {
            name: 'a candidate with a route and a date is accepted',
            expect: 'accept',
            run: () => _selfTestFixture('ok', '| ADR-016 | REVIEW-NOW |', _GOOD_ROUTING),
        },
        {
            name: 'a candidate with no routing section at all is refused',
            expect: 'reject',
            run: () => _selfTestFixture('nosection', '| ADR-016 | REVIEW-NOW |', ''),
        },
        {
            name: 'a candidate absent from the routing table is refused',
            expect: 'reject',
            run: () =>
                _selfTestFixture(
                    'unrouted',
                    '| ADR-016 | REVIEW-NOW |\n| ADR-044 | REVIEW-NOW |',
                    _GOOD_ROUTING,
                ),
        },
        {
            name: 'a dateless follow-up is refused',
            expect: 'reject',
            run: () =>
                _selfTestFixture(
                    'dateless',
                    '| ADR-016 | REVIEW-NOW |',
                    '## Candidate routing\n\n| Record | Disposition | Route | Dated follow-up |\n|---|---|---|---|\n' +
                        '| ADR-016 | REVIEW-NOW | council | disposition soon |\n',
                ),
        },
        {
            name: 'an empty route cell is refused',
            expect: 'reject',
            run: () =>
                _selfTestFixture(
                    'noroute',
                    '| ADR-016 | REVIEW-NOW |',
                    '## Candidate routing\n\n| Record | Disposition | Route | Dated follow-up |\n|---|---|---|---|\n' +
                        '| ADR-016 | REVIEW-NOW | — | disposition by **2026-10-03** |\n',
                ),
        },
        {
            // The label-shape case. Sweep tables spell the same record four
            // ways, so a literal match would report every row unrouted; this
            // pins the normalisation rather than trusting it.
            name: 'a bare number in the sweep matches an ADR-NNN routing row',
            expect: 'accept',
            run: () => _selfTestFixture('bare', '| 016 | SUPERSEDE (candidate) |', _GOOD_ROUTING),
        },
    ];
    return runSelfTest({
        gate: 'lint_adr_sweep_routing',
        cases,
        minCases: SELF_TEST_MIN_CASES,
        minRejectCases: SELF_TEST_MIN_REJECT,
    });
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const json = argv.includes('--json');
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write('usage: lint_adr_sweep_routing [-h] [--json] [--dir DIR] [--self-test]\n');
        return 0;
    }
    if (argv.includes('--self-test')) return selfTest();
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--json') continue;
        if (a === '--dir') {
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write('lint_adr_sweep_routing: --dir requires a path\n');
                return 2;
            }
            SWEEP_DIR = path.resolve(next);
            i += 1;
            continue;
        }
        process.stderr.write(`lint_adr_sweep_routing: unrecognized argument: ${a}\n`);
        return 2;
    }

    let names: string[] = [];
    try {
        names = fs.readdirSync(SWEEP_DIR).filter((n) => SWEEP_NAME.test(n)).sort();
    } catch {
        names = [];
    }

    // Per-artifact accounting. `scanned` counts candidate ROWS, so a sweep
    // artifact whose table the parser walked past contributes zero rows and is
    // indistinguishable from one with no candidates — exactly the "looked at
    // almost nothing" reading the ledger exists to separate from "found
    // nothing".
    const ledger = new GateLedger('lint_adr_sweep_routing');
    ledger.plan(names);
    const violations: Violation[] = [];
    let scanned = 0;
    for (const name of names) {
        const abs = path.join(SWEEP_DIR, name);
        const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
        const [v, n] = lintSweep(rel, fs.readFileSync(abs, 'utf-8'));
        violations.push(...v);
        scanned += n;
        if (v.length > 0) ledger.fail(name, `${String(v.length)} unrouted candidate row(s)`);
        else if (n === 0) ledger.skip(name, 'no_applicable_files');
        else ledger.complete(name);
    }
    ledger.report(json ? () => undefined : undefined);

    process.stdout.write(`scanned: ${scanned}\n`);
    try {
        assertScanned({
            gate: 'lint_adr_sweep_routing',
            scanned,
            units: 'candidate row(s)',
            roots: ['docs/decisions'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌ ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (json) {
        process.stdout.write(`${JSON.stringify({ violations }, null, 2)}\n`);
    } else {
        for (const v of violations) {
            process.stderr.write(`❌ ${v.file}:${v.line}: ${v.msg}\n`);
        }
    }
    if (violations.length > 0) {
        process.stderr.write(`lint_adr_sweep_routing: ${violations.length} violation(s)\n`);
        return 1;
    }
    process.stdout.write(
        `✅ lint_adr_sweep_routing: every candidate row across ${names.length} sweep artifact(s) carries a route and a dated follow-up\n`,
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
