#!/usr/bin/env tsx
/**
 * The placeholder-drift ratchet — foreign placeholder syntaxes in prose may
 * shrink, never grow.
 *
 * road-to-an-invocation-contract-that-reaches-the-wire 1.2.
 *
 * WHAT IT GATES, AND WHAT IT DELIBERATELY DOES NOT
 *
 * It fails on GROWTH of the foreign forms only. It never fails on the absolute
 * number, and it never fails on the plurality form — so holding at the seeded
 * counts is permanently green, and nothing here asks for a rewrite of a working
 * body. That is the whole of Risk 2's mitigation: a committed number naming two
 * syntaxes as foreign reads like a canon ruling whose obvious next move is
 * rewriting those bodies, and a gate that is green at the seed removes the
 * pressure to do it.
 *
 * THE SEED IS MEASURED, NOT COPIED
 *
 * The roadmap's step text says "seeded at the measured 4 and 2". The operative
 * word is MEASURED: under the census's published unit — a token in PROSE,
 * outside fenced blocks, indented blocks and inline code spans — the corpus
 * carries different numbers, because the source figures counted tokens inside
 * demonstrated code (JS template literals in `playwright-testing`, HCL in
 * `terragrunt`, a table-cell marker the prose is talking ABOUT in
 * `livewire-architect`). The seed below is this tree's own reading. The
 * reasoning lives in `report_invocation_surface.ts`'s module header, and the
 * per-file breakdown is in the census artifact, so the definition is arguable
 * rather than merely asserted.
 *
 * A NOTE ON WHAT A ZERO SEED MEANS. `{{…}}` seeds at zero. That is not "the
 * check has nothing to do" — a zero-seeded ratchet is the strictest form of
 * this gate, because the first occurrence is growth. It is also the cheapest
 * possible moment to hold a line: no existing body has to change for it.
 *
 * Exit codes: 0 within the ratchet · 1 growth · 2 the corpus could not be read.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { reportScanned } from './_lib/scan_scope.js';
import { SYNTAXES, type SyntaxId, census } from './report_invocation_surface.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const GATE = 'check_placeholder_drift';

/** Where the seed lives, so a deliberate change is a reviewable diff. */
export const BUDGET_REL = path.join('src', 'config', 'placeholder-drift-budget.json');

export interface Budget {
    readonly seeded_at: string;
    readonly note: string;
    readonly ceilings: Readonly<Partial<Record<SyntaxId, number>>>;
}

export function readBudget(root: string): Budget | null {
    const p = path.join(root, BUDGET_REL);
    if (!fs.existsSync(p)) return null;
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8')) as Budget;
    } catch {
        return null;
    }
}

export interface Finding {
    readonly syntax: SyntaxId;
    readonly ceiling: number;
    readonly measured: number;
}

/** Which foreign syntaxes exceed their ceiling. Plurality forms are skipped. */
export function findings(
    occurrences: Readonly<Record<SyntaxId, number>>,
    budget: Budget,
): Finding[] {
    const out: Finding[] = [];
    for (const s of SYNTAXES) {
        if (s.canonical) continue;
        const ceiling = budget.ceilings[s.id];
        if (ceiling === undefined) continue;
        const measured = occurrences[s.id] ?? 0;
        if (measured > ceiling) out.push({ syntax: s.id, ceiling, measured });
    }
    return out;
}

export function main(argv: readonly string[]): number {
    const rootIdx = argv.indexOf('--root');
    const root = rootIdx === -1 ? ROOT : (argv[rootIdx + 1] ?? ROOT);

    const budget = readBudget(root);
    if (budget === null) {
        process.stderr.write(
            `❌  ${GATE}: ${BUDGET_REL} is missing or unreadable. A ratchet that cannot read ` +
                'its own seed must not pass — it would be a green nobody earned.\n',
        );
        return 2;
    }

    const c = census(root);
    const foreign = SYNTAXES.filter((s) => !s.canonical);
    const ledger = new GateLedger(GATE);
    ledger.plan(foreign.map((s) => s.id));

    const found = findings(c.occurrences, budget);
    for (const s of foreign) {
        const f = found.find((x) => x.syntax === s.id);
        if (f === undefined) ledger.complete(s.id);
        else ledger.fail(s.id, `${String(f.measured)} occurrence(s) against a ceiling of ${String(f.ceiling)}`);
    }

    reportScanned({
        gate: GATE,
        scanned: c.rows.length,
        units: 'artifact(s)',
        roots: [BUDGET_REL],
    });
    ledger.report();

    if (found.length > 0) {
        for (const f of found) {
            const label = SYNTAXES.find((s) => s.id === f.syntax)?.label ?? f.syntax;
            process.stdout.write(
                `❌  ${GATE}: \`${label}\` grew to ${String(f.measured)} prose occurrence(s), ceiling ${String(f.ceiling)}.\n`,
            );
        }
        process.stdout.write(
            '\nThe ratchet walks DOWN only. Use the plurality form instead, or — if the new ' +
                `occurrence is genuinely right — lower nothing and raise the ceiling in ` +
                `\`${BUDGET_REL}\` in the same change, with the reason in the diff.\n` +
                'Counting unit and the per-file breakdown: ' +
                '`./scripts-run src/scripts/report_invocation_surface --write`.\n',
        );
        return 1;
    }

    process.stdout.write(
        `✅  ${GATE}: foreign placeholder syntaxes within their ratchet ` +
            `(${foreign.map((s) => `${s.label} ${String(c.occurrences[s.id])}/${String(budget.ceilings[s.id] ?? 0)}`).join(' · ')}).\n`,
    );
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
