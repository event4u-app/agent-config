#!/usr/bin/env tsx
/**
 * Flag a UI value that lies outside a Consistency Lock declared in `DESIGN.md`
 * (road-to-a-canvas-the-code-owns step 8.2). The logic and its reasons live in
 * `_lib/design_lock.ts`.
 *
 * Usage:
 *   npx tsx design_lock.ts [--design-md DESIGN.md] [--baseline <json>]
 *                          [--write-baseline <json>] [--json] <file|dir>...
 *
 * Exit codes: 0 — scanned (findings are flags, never a failure) · 2 — argument
 * error. Pass the changed UI files to see only what this change introduced; a
 * brownfield project records its existing drift once with `--write-baseline`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { type LockFinding, checkFile, newDrift, parseLocks } from './_lib/design_lock.js';

const _HERE = fileURLToPath(import.meta.url);
const UI_FILE = /\.(css|scss|sass|less|html|htm|vue|svelte|astro|jsx|tsx)$/i;

function collect(target: string, out: string[]): void {
    const st = fs.lstatSync(target);
    if (st.isDirectory()) {
        for (const n of fs.readdirSync(target).sort()) if (n !== 'node_modules' && !n.startsWith('.')) collect(path.join(target, n), out);
    } else if (st.isFile() && UI_FILE.test(target)) out.push(target);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let designMd = 'DESIGN.md';
    let baseline: string | null = null;
    let writeBaseline: string | null = null;
    let json = false;
    const targets: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        const take = (): string => {
            const v = argv[++i];
            if (v === undefined) throw new Error(`argument ${a}: expected one argument`);
            return v;
        };
        if (a === '--design-md') designMd = take();
        else if (a === '--baseline') baseline = take();
        else if (a === '--write-baseline') writeBaseline = take();
        else if (a === '--json') json = true;
        else if (a.startsWith('-')) {
            process.stderr.write(`design_lock: unrecognized argument: ${a}\n`);
            return 2;
        } else targets.push(a);
    }
    let md = '';
    try {
        md = fs.readFileSync(designMd, 'utf-8');
    } catch {
        process.stdout.write(`design_lock: no ${designMd} — no Lock is declared, nothing to check\n`);
        return 0;
    }
    const locks = parseLocks(md);
    const files: string[] = [];
    for (const t of targets) if (fs.existsSync(t)) collect(t, files);
    let findings: LockFinding[] = files.flatMap((f) => checkFile(path.relative(process.cwd(), f), fs.readFileSync(f, 'utf-8'), locks));
    if (writeBaseline !== null) {
        fs.writeFileSync(writeBaseline, `${JSON.stringify(findings.map((f) => ({ file: f.file, value: f.value })), null, 2)}\n`);
        process.stdout.write(`design_lock: recorded ${findings.length} existing finding(s) as the baseline\n`);
        return 0;
    }
    if (baseline !== null) {
        const known = JSON.parse(fs.readFileSync(baseline, 'utf-8')) as Array<{ file: string; value: string }>;
        findings = newDrift(findings, known);
    }
    if (json) process.stdout.write(`${JSON.stringify({ findings }, null, 2)}\n`);
    else {
        for (const f of findings) process.stdout.write(`• ${f.file}:${f.line} [${f.lock} lock] ${f.message}\n`);
        process.stdout.write(`design_lock: ${findings.length} value(s) outside a declared Lock in ${files.length} file(s) — rebuttable: state why in the diff, or record it in a baseline.\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) process.exit(main());
