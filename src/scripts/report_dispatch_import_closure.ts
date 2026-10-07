#!/usr/bin/env tsx
/**
 * Print the static import closure of the hook dispatcher, one module per line
 * with its class — `verdict`, `payload`, `neither` or `concern`.
 *
 * The reading behind `check_kernel_edit_ratified`'s derived watched set: the
 * `verdict` rows are what the gate adds to its hand-written plumbing pattern.
 * Named `report_` because it publishes a reading and gates nothing.
 *
 * Inputs:
 *   --root DIR   tree to read (default: this script's repository)
 *   --markdown   emit a Markdown table instead of plain lines
 *
 * Exit 0 always, unless the dispatcher is absent under `--root` (exit 1): an
 * empty closure from a tree with no dispatcher is not a reading.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    DISPATCHER_PATH,
    dispatchImportClosure,
    type ClosureEntry,
    type ModuleClass,
} from './_lib/dispatch_import_closure.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

const ORDER: readonly ModuleClass[] = ['verdict', 'payload', 'neither', 'concern'];

export function render(entries: readonly ClosureEntry[], markdown: boolean): string[] {
    const sorted = [...entries].sort(
        (a, b) => ORDER.indexOf(a.class) - ORDER.indexOf(b.class) || a.path.localeCompare(b.path),
    );
    const counts = ORDER.map((c) => `${c} ${entries.filter((e) => e.class === c).length}`).join(' · ');
    const lines: string[] = [];
    if (markdown) {
        lines.push('| Class | Module |', '|---|---|');
        for (const e of sorted) {
            lines.push(`| ${e.class} | \`${e.path}\` |`);
        }
        lines.push('', `Totals: ${counts}.`);
        return lines;
    }
    for (const e of sorted) {
        lines.push(`${e.class.padEnd(8)} ${e.path}`);
    }
    lines.push(`totals: ${counts}`);
    return lines;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let root = REPO;
    let markdown = false;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--root') {
            root = path.resolve(argv[i + 1] ?? root);
            i += 1;
        } else if (argv[i] === '--markdown') {
            markdown = true;
        }
    }
    if (!fs.existsSync(path.join(root, DISPATCHER_PATH))) {
        process.stderr.write(`report_dispatch_import_closure: no ${DISPATCHER_PATH} under ${root}\n`);
        return 1;
    }
    process.stdout.write(`${render(dispatchImportClosure(root), markdown).join('\n')}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
