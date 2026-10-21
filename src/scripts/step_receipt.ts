#!/usr/bin/env tsx
/**
 * The receipt a roadmap step carries: its change class and what that class's
 * row in the depth table would skip, and whether the step runs at that lower depth.
 *
 * The class is `classify_change_risk` over the step's paths — deterministic,
 * unknown resolves upward — and `--raise` can only move it up, so an agent can
 * ask for more ceremony and never for less. While the table's `mode` is
 * `shadow`, the receipt is a measurement: every ceremony still runs at full
 * depth, and `would-skip` is what a lowered depth would have dropped, so a
 * finding those ceremonies produce on an R0/R1 step is a would-have-escape.
 * Once the table is `active`, the receipt reads `active` only inside the flip
 * scope (`_lib/depth_flip.ts`) and only for a class its audit samples have not
 * rolled back; every other step still reads `shadow` and runs at full depth.
 *
 * Usage:
 *   ./scripts-run src/scripts/step_receipt --range <base>..HEAD [--raise R0|R1|R2|R3]
 *   ./scripts-run src/scripts/step_receipt --paths a,b,c [--raise …]
 *
 * Prints one line, the marker the step's Done note carries. Exit 2 on a usage
 * error, otherwise 0.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { changedPaths, classifyPaths, higher, type RiskClass } from './classify_change_risk.js';
import { effectiveMode, rolledBackClasses, type AuditSample, type FlipBlock } from './_lib/depth_flip.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const DEPTH_TABLE_REL = 'src/config/step-depth-table.json';
export const AUDIT_SAMPLES_REL = 'src/config/depth-audit-samples.json';

type Ceremony = 'review' | 'council' | 'evidence' | 'retro' | 'revalidation';

export interface DepthTable {
    mode: 'shadow' | 'active';
    flip: FlipBlock;
    full: Record<Ceremony, string>;
    classes: Record<RiskClass, Record<Ceremony, string>>;
}

export function loadDepthTable(root = REPO_ROOT): DepthTable {
    return JSON.parse(fs.readFileSync(path.join(root, DEPTH_TABLE_REL), 'utf8')) as DepthTable;
}

export function loadAuditSamples(root = REPO_ROOT): AuditSample[] {
    return (JSON.parse(fs.readFileSync(path.join(root, AUDIT_SAMPLES_REL), 'utf8')) as { samples: AuditSample[] }).samples;
}

/** Ceremonies whose row for `cls` is anything other than full depth, sorted. */
export function wouldSkip(cls: RiskClass, table: DepthTable): string[] {
    const row = table.classes[cls];
    return (Object.keys(table.full) as Ceremony[]).filter((c) => !row[c].startsWith('full')).sort();
}

export function receiptFor(
    paths: readonly string[],
    raise: RiskClass | null,
    table: DepthTable,
    samples: readonly AuditSample[] = [],
): { cls: RiskClass; mode: 'shadow' | 'active'; line: string } {
    const computed = classifyPaths(paths);
    const cls = raise === null ? computed.cls : higher(computed.cls, raise);
    const bound = cls === computed.cls ? computed.reason : `raised to ${cls} from ${computed.cls}`;
    const skip = wouldSkip(cls, table);
    const mode = effectiveMode(table.mode, cls, paths, table.flip, rolledBackClasses(samples, table.flip.requires));
    const line = `<!-- receipt: class=${cls} · ${mode} · would-skip=${skip.length === 0 ? 'none' : skip.join(',')} · bound=${bound} -->`;
    return { cls, mode, line };
}

export function main(argv: readonly string[]): number {
    const value = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const raiseArg = value('--raise');
    if (raiseArg !== undefined && !['R0', 'R1', 'R2', 'R3'].includes(raiseArg)) {
        process.stderr.write('step_receipt: --raise takes R0, R1, R2 or R3\n');
        return 2;
    }
    const pathsArg = value('--paths');
    const range = value('--range');
    if ((pathsArg === undefined) === (range === undefined)) {
        process.stderr.write('usage: step_receipt (--range <base>..HEAD | --paths a,b,c) [--raise R0|R1|R2|R3]\n');
        return 2;
    }
    const paths =
        pathsArg !== undefined
            ? pathsArg.split(',').map((s) => s.trim()).filter((s) => s !== '')
            : changedPaths(range as string, REPO_ROOT);
    process.stdout.write(`${receiptFor(paths, (raiseArg as RiskClass | undefined) ?? null, loadDepthTable(), loadAuditSamples()).line}\n`);
    return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    process.exit(main(process.argv.slice(2)));
}
