#!/usr/bin/env tsx
/**
 * What the `estate_offset_exempt` population actually says — the producing command.
 *
 * THIS IS A READER, NOT A GATE. It exits 0 on every corpus, including one where
 * no reason names anything. The refusal lives in `check_estate_count`, applies
 * to ADDED files only, and is grandfathered precisely because of what this
 * script measures: 43 of the 221 reasons in the tree on 2026-10-01 name no
 * alternative disposition, so a check that re-read them would land red on a
 * fifth of its corpus.
 *
 * WHAT IT BUYS. Two numbers nobody could produce before: how many exemptions
 * name a rejected alternative, and how many repeat another file's reason
 * verbatim. Both are the inputs to whether the refusal vocabulary is the right
 * one, and both move as the estate moves — so the NEXT reading is a delta
 * rather than a re-derivation, which is the same bargain `roadmap_verify_share`
 * makes for the verify grammar.
 *
 * THE VOCABULARY IS NOT THIS SCRIPT'S. It imports the lemma list the gate
 * refuses on, so the report and the refusal cannot drift. A drifted pair fails
 * silently and in the worst direction: the report says the tree conforms while
 * the gate rejects it.
 *
 * CLI:
 *   ./scripts-run src/scripts/estate_exemption_shape
 *   ./scripts-run src/scripts/estate_exemption_shape --json
 *   ./scripts-run src/scripts/estate_exemption_shape --root <dir>
 *
 * Exit codes: 0 always, except 2 for bad argv or a scan root that holds nothing.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { exemptionReason } from './check_estate_count.js';
import { DISPOSITION_LEMMAS, lemmasNamed, namesDisposition, reasonKey } from './_lib/exemption_shape.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'estate_exemption_shape';
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The three trees an exemption can sit in. `stubs/` and `skipped/` carry none. */
const TREES: readonly { readonly label: string; readonly dir: string }[] = [
    { label: 'active', dir: 'agents/roadmaps' },
    { label: 'later', dir: 'agents/roadmaps/later' },
    { label: 'archive', dir: 'agents/roadmaps/archive' },
];

export interface ExemptionRow {
    readonly tree: string;
    readonly file: string;
    readonly reason: string;
    /** The disposition lemmas this reason names; empty means it names none. */
    readonly lemmas: readonly string[];
}

export interface ShapeReport {
    readonly rows: readonly ExemptionRow[];
    readonly shaped: number;
    readonly shapeless: number;
    /** Per-lemma hit counts, in the gate's own lemma order. */
    readonly byLemma: Readonly<Record<string, number>>;
    /** Groups of two or more files sharing one reason, largest first. */
    readonly duplicates: readonly (readonly string[])[];
}

/** Read every exemption under `root`, in a stable order. */
export function collectExemptions(root: string): ExemptionRow[] {
    const rows: ExemptionRow[] = [];
    for (const tree of TREES) {
        const abs = path.join(root, tree.dir);
        let names: string[];
        try {
            names = fs.readdirSync(abs);
        } catch {
            continue;
        }
        for (const name of [...names].sort()) {
            if (!name.endsWith('.md')) continue;
            const file = path.join(abs, name);
            let text: string;
            try {
                if (!fs.statSync(file).isFile()) continue;
                text = fs.readFileSync(file, 'utf-8');
            } catch {
                continue;
            }
            const reason = exemptionReason(text);
            if (reason === null) continue;
            rows.push({ tree: tree.label, file: `${tree.dir}/${name}`, reason, lemmas: lemmasNamed(reason) });
        }
    }
    return rows;
}

/** Summarise the population against the gate's vocabulary. */
export function report(rows: readonly ExemptionRow[]): ShapeReport {
    const byLemma: Record<string, number> = {};
    for (const l of DISPOSITION_LEMMAS) {
        byLemma[l.name] = rows.filter((r) => r.lemmas.includes(l.name)).length;
    }
    const groups = new Map<string, string[]>();
    for (const r of rows) {
        const key = reasonKey(r.reason);
        const list = groups.get(key) ?? [];
        list.push(r.file);
        groups.set(key, list);
    }
    const duplicates = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
    return {
        rows,
        shaped: rows.filter((r) => namesDisposition(r.reason)).length,
        shapeless: rows.filter((r) => !namesDisposition(r.reason)).length,
        byLemma,
        duplicates,
    };
}

function render(rep: ShapeReport): string {
    const out: string[] = [];
    const total = rep.rows.length;
    out.push(`${_PROG}: ${String(total)} exemption(s)`);
    for (const tree of TREES) {
        out.push(`  ${tree.label.padEnd(10)} ${String(rep.rows.filter((r) => r.tree === tree.label).length).padStart(4)}`);
    }
    out.push(`  names a rejected alternative  ${String(rep.shaped).padStart(4)}`);
    out.push(`  names none                    ${String(rep.shapeless).padStart(4)}`);
    out.push('  per lemma:');
    for (const l of DISPOSITION_LEMMAS) {
        out.push(`    ${l.name.padEnd(12)} ${String(rep.byLemma[l.name] ?? 0).padStart(4)}`);
    }
    const dupFiles = rep.duplicates.reduce((n, g) => n + g.length, 0);
    out.push(`  verbatim duplicate groups     ${String(rep.duplicates.length).padStart(4)} covering ${String(dupFiles)} file(s)`);
    for (const g of rep.duplicates) {
        out.push(`    (${String(g.length)}x) ${g.join(', ')}`);
    }
    if (rep.shapeless > 0) {
        out.push('  naming no rejected alternative:');
        for (const r of rep.rows.filter((x) => !namesDisposition(x.reason))) {
            out.push(`    ${r.file}: ${r.reason.slice(0, 120)}`);
        }
    }
    return out.join('\n') + '\n';
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const json = argv.includes('--json');
    const rootIdx = argv.indexOf('--root');
    let root = REPO_ROOT;
    if (rootIdx !== -1) {
        const next = argv[rootIdx + 1];
        if (next === undefined || next.startsWith('-')) {
            process.stderr.write(`usage: ${_PROG} [--root <dir>] [--json]\n`);
            return 2;
        }
        root = path.resolve(next);
    }
    const unknown = argv.filter((a) => a.startsWith('-') && a !== '--json' && a !== '--root');
    if (unknown.length > 0) {
        process.stderr.write(`${_PROG}: unknown argument(s) ${unknown.join(', ')}\n`);
        return 2;
    }

    const rows = collectExemptions(root);
    try {
        // A root holding no roadmap at all is a dead scope, never an estate with
        // nothing to report: this reader would otherwise print a confident zero
        // over a path that does not exist.
        assertScanned({
            gate: _PROG,
            scanned: TREES.reduce((n, t) => {
                try {
                    return n + fs.readdirSync(path.join(root, t.dir)).filter((f) => f.endsWith('.md')).length;
                } catch {
                    return n;
                }
            }, 0),
            units: 'roadmap file(s)',
            roots: TREES.map((t) => t.dir),
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${_PROG}: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    const rep = report(rows);
    if (json) {
        process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
        return 0;
    }
    process.stdout.write(render(rep));
    return 0;
}

if (path.resolve(process.argv[1] ?? '') === _HERE) {
    process.exit(main());
}
