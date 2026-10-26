#!/usr/bin/env node
/**
 * Attribution replay (road-to-tells-a-near-miss-can-refute 3.2).
 *
 * The frontend corpus carries incumbent files and a prompt, not diffs, so each
 * UI file is replayed through two synthetic writes the hook would see:
 *
 *   keep     — the file as committed plus one neutral line (an "operate" edit)
 *   inject   — the same plus one side-stripe, a P1 the edit introduced
 *
 * Counted per write: the P0/P1 findings the hook surfaces without attribution
 * (everything in the file) and with it (introduced only). The bar from the
 * roadmap: attribution must never hide an introduced finding — `inject` keeps
 * at least one surfaced finding on every file the probe can reach.
 *
 * Usage: npx tsx internal/bench/design-slop-attribution/run.ts [--json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { attribute } from '../../../src/scripts/_lib/finding_baseline.js';
import { scanFile } from '../../../src/scripts/lint_design_slop.js';
import { UI_EXT } from '../../../src/scripts/_lib/ui_surface.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// The corpus incumbents carry no P0/P1 finding, so they show attribution
// cannot hide anything but not that it removes anything; this repository's own
// UI does carry incumbent findings, and is replayed the same way.
const ROOTS = [
    path.join(REPO, 'tests', 'eval', 'frontend-corpus', 'cases'),
    path.join(REPO, 'src', 'ui'),
    path.join(REPO, 'site'),
];
const NO_CTX = { raw: '', has: () => false };

/** One introduced P1 per file shape; null where no shipped rule reads that shape. */
function probe(ext: string): { neutral: string; stripe: string } | null {
    if (ext === '.css' || ext === '.scss') {
        return { neutral: '\n.probe-neutral { margin: 0; }\n', stripe: '\n.probe-stripe { border-left: 4px solid #7c3aed; padding: 8px; }\n' };
    }
    if (['.html', '.vue', '.svelte', '.astro', '.php'].includes(ext) || ext === '.jsx' || ext === '.tsx') {
        return {
            neutral: '\n<!-- probe -->\n',
            stripe: '\n<style>\n.probe-stripe { border-left: 4px solid #7c3aed; padding: 8px; }\n</style>\n',
        };
    }
    return null;
}

const high = (content: string, file: string) =>
    scanFile(content, file, NO_CTX).filter((f) => f.severity === 'P0' || f.severity === 'P1');

export interface Row {
    file: string;
    keep_without: number;
    keep_with: number;
    inject_without: number;
    inject_with: number;
    probe_reached: boolean;
}

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...walk(abs));
        else if (UI_EXT.test(e.name)) out.push(abs);
    }
    return out;
}

export function replay(): Row[] {
    const rows: Row[] = [];
    for (const abs of ROOTS.filter((r) => fs.existsSync(r)).flatMap(walk).sort()) {
        const rel = path.relative(REPO, abs);
        const p = probe(path.extname(abs));
        if (!p) continue;
        const base = fs.readFileSync(abs, 'utf8');
        const baseline = high(base, rel);
        const keep = high(base + p.neutral, rel);
        const inject = high(base + p.stripe, rel);
        const injectWith = attribute(inject, baseline).introduced.length;
        rows.push({
            file: rel,
            keep_without: keep.length,
            keep_with: attribute(keep, baseline).introduced.length,
            inject_without: inject.length,
            inject_with: injectWith,
            probe_reached: inject.length > keep.length,
        });
    }
    return rows;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const rows = replay();
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
        return 0;
    }
    const sum = (k: keyof Row) => rows.reduce((n, r) => n + Number(r[k]), 0);
    process.stdout.write('| file | keep: without | keep: with | inject: without | inject: with |\n|---|---|---|---|---|\n');
    for (const r of rows) {
        process.stdout.write(`| ${r.file} | ${r.keep_without} | ${r.keep_with} | ${r.inject_without} | ${r.probe_reached ? r.inject_with : 'n/a'} |\n`);
    }
    process.stdout.write(`| **total (${rows.length} files)** | ${sum('keep_without')} | ${sum('keep_with')} | ${sum('inject_without')} | ${sum('inject_with')} |\n`);
    const hidden = rows.filter((r) => r.probe_reached && r.inject_with === 0);
    process.stdout.write(hidden.length ? `❌ attribution hid an introduced finding in: ${hidden.map((r) => r.file).join(', ')}\n` : '✅ no introduced finding hidden\n');
    return hidden.length ? 1 : 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
