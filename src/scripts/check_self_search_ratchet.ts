#!/usr/bin/env node
/**
 * Self-search ratchet: the number of places shipped content tells the agent to
 * search the code by hand — an inline `rg`/`grep -rn` sweep line, or a tool name
 * a host may not have (`codebase-retrieval`) — may only go down. A sweep
 * belongs in `code-graph scan`, a question in `code-graph ask`.
 *
 *   (default)     fail when the live count exceeds the baseline
 *   --write       lower the baseline to the live count (never raises it)
 *   --list        print every counted line as file:line
 *
 * Exit codes: 0 at or under the baseline · 1 above it · 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const BASELINE_REL = 'src/config/self-search-ceiling.json';
export const CONTENT_ROOTS = ['src/skills', 'src/rules', 'src/domains', 'src/agent-src', 'docs/guidelines'];

const SWEEP = /^\s*(?:rg|grep -r[a-zA-Z]*) /;
const FOREIGN_TOOL = /codebase-retrieval/;

function walk(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.md')) out.push(p);
    }
}

/** The Markdown files the ratchet reads, sorted. */
export function contentFiles(root: string): string[] {
    const files: string[] = [];
    for (const r of CONTENT_ROOTS) walk(path.join(root, r), files);
    return files.sort();
}

export function selfSearchLines(root: string): string[] {
    const files = contentFiles(root);
    const out: string[] = [];
    for (const f of files) {
        const rel = path.relative(root, f).split(path.sep).join('/');
        fs.readFileSync(f, 'utf-8')
            .split('\n')
            .forEach((l, i) => {
                if (SWEEP.test(l) || FOREIGN_TOOL.test(l)) out.push(`${rel}:${i + 1}`);
            });
    }
    return out;
}

export function main(argv: readonly string[] = process.argv.slice(2), root: string = REPO_ROOT): number {
    const lines = selfSearchLines(root);
    if (argv.includes('--list')) {
        for (const l of lines) process.stdout.write(`${l}\n`);
        return 0;
    }
    const file = path.join(root, BASELINE_REL);
    let baseline: number;
    try {
        baseline = (JSON.parse(fs.readFileSync(file, 'utf-8')) as { count: number }).count;
    } catch {
        process.stderr.write(`check_self_search_ratchet: cannot read ${BASELINE_REL}\n`);
        return 2;
    }
    if (argv.includes('--write')) {
        const next = Math.min(baseline, lines.length);
        fs.writeFileSync(file, `${JSON.stringify({ count: next, note: 'Shrink-only. Lower with --write after moving a sweep into code-graph scan or a search into code-graph ask.' }, null, 1)}\n`);
        process.stdout.write(`self-search baseline: ${baseline} → ${next}\n`);
        return 0;
    }
    reportScanned({ gate: 'check_self_search_ratchet', scanned: contentFiles(root).length, units: 'file(s)', roots: CONTENT_ROOTS });
    if (lines.length > baseline) {
        process.stdout.write(`❌  self-search lines: ${lines.length} > baseline ${baseline} — move the sweep into \`code-graph scan\` (run --list to see them)\n`);
        return 1;
    }
    process.stdout.write(`✅  self-search lines: ${lines.length} (baseline ${baseline})\n`);
    return 0;
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(_HERE)) process.exit(main());
