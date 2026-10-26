#!/usr/bin/env node
/**
 * design-slop render bench (road-to-tells-a-near-miss-can-refute 2.5).
 *
 * The render-engine rules read what `ui:render` captured, so their near-misses
 * and positives are rendered here, every viewport, and the rules run over the
 * rows. A near-miss (written from the catalog by an agent that did not see the
 * rules, `LABELS.json`) that any rule fires on is M1 > 0; a positive (written
 * with the rule) that its own rule misses is a recall gap.
 *
 * Needs Chromium; without one it exits 1 and says so, never a pass.
 *
 * Usage: task bench:design-slop-render (runs under vitest). Under `tsx` the
 * capture fails with `__name is not defined`: tsx injects a naming helper into
 * the functions `page.evaluate` ships to the browser, where it does not exist.
 * The published CLI is compiled by tsc and is not affected.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runUiRender } from '../../../src/cli/commands/uiRender.js';
import { scanRender } from '../../../src/scripts/design_slop_render_rules.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const CORPUS = path.join(REPO, 'internal', 'bench', 'corpora', 'design-slop-render');

const NO_CTX = { raw: '', has: () => false };

export interface RenderBenchResult {
    near_miss: Record<string, string[]>;
    recall: Record<string, { file: string; fired: boolean }>;
    rendered: number;
    unrendered: string[];
}

/** Rule ids that fire on any viewport of one page, or null when it did not render. */
export async function rulesFiredOn(file: string, viewports?: readonly string[]): Promise<string[] | null> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-render-'));
    try {
        fs.copyFileSync(file, path.join(root, 'index.html'));
        const write = process.stdout.write.bind(process.stdout);
        process.stdout.write = (() => true) as typeof process.stdout.write;
        try {
            await runUiRender({ target: 'index.html', projectRoot: root, slug: 'page' });
        } finally {
            process.stdout.write = write;
        }
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'agents', 'runtime', 'state', 'render', 'page', 'manifest.json'), 'utf8'));
        if (manifest.verification !== 'verified') return null;
        const fired = new Set<string>();
        for (const c of manifest.captures as Array<{ styles: string; viewport: string }>) {
            if (viewports && !viewports.includes(c.viewport)) continue;
            const rows = JSON.parse(fs.readFileSync(path.join(root, c.styles), 'utf8'));
            for (const f of scanRender(rows, c.styles, NO_CTX)) fired.add(f.rule);
        }
        return [...fired].sort();
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

const RULE_FOR: Record<string, string> = {
    l7: 'slop-l7-overflow',
    l6: 'slop-l6-clipped-popover',
    v7: 'slop-v7-nested-cards',
    l2: 'slop-l2-identical-cards',
    l1: 'slop-l1-hero-metric',
};

export async function runBench(): Promise<RenderBenchResult> {
    const result: RenderBenchResult = { near_miss: {}, recall: {}, rendered: 0, unrendered: [] };
    // A near-miss authored for one viewport is a near-miss at that viewport;
    // LABELS.json scopes it and says why (adjudication).
    const labels = (JSON.parse(fs.readFileSync(path.join(CORPUS, 'LABELS.json'), 'utf8')) as {
        files: Record<string, { viewports?: string[] }>;
    }).files;
    for (const dir of ['nearmiss', 'positive'] as const) {
        const abs = path.join(CORPUS, dir);
        for (const name of fs.readdirSync(abs).filter((f) => f.endsWith('.html')).sort()) {
            const rel = `${dir}/${name}`;
            const label = dir === 'nearmiss' ? labels[rel] : undefined;
            const fired = await rulesFiredOn(path.join(abs, name), label?.viewports);
            if (fired === null) {
                result.unrendered.push(rel);
                continue;
            }
            result.rendered += 1;
            if (dir === 'nearmiss') {
                for (const r of fired) (result.near_miss[r] ??= []).push(rel);
            } else {
                const want = RULE_FOR[name.split('-')[0]!];
                if (want) result.recall[want] = { file: rel, fired: fired.includes(want) };
            }
        }
    }
    return result;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const r = await runBench();
    if (r.rendered === 0) {
        process.stderr.write('design-slop render bench: nothing rendered — no Chromium, so nothing was measured\n');
        return 1;
    }
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        return 0;
    }
    process.stdout.write(`design-slop render bench · ${r.rendered} page(s) rendered\n`);
    const fp = Object.entries(r.near_miss);
    process.stdout.write(fp.length === 0 ? 'near-miss: M1 = 0 for every render rule\n' : '');
    for (const [rule, files] of fp) process.stdout.write(`near-miss: ${rule} — ${files.join(', ')}\n`);
    for (const [rule, v] of Object.entries(r.recall)) process.stdout.write(`recall: ${rule} — ${v.fired ? 'fires' : 'MISSES'} on ${v.file}\n`);
    if (r.unrendered.length) process.stdout.write(`unrendered: ${r.unrendered.join(', ')}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().then((c) => process.exit(c));
}
