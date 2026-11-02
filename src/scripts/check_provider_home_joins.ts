#!/usr/bin/env node
/**
 * Provider-home join ratchet (`road-to-the-profile-the-session-runs-in` 1.7).
 *
 * A runtime file that joins the user home with `.claude` / `.codex` / `.gemini`
 * reads the DEFAULT account even when the session runs under a profile
 * (`CLAUDE_CONFIG_DIR` / `CODEX_HOME`). New code resolves through
 * `src/scripts/_lib/provider_home.ts`. The sites in the baseline are install
 * targets (AC's user scope is written to the default dirs, the share source a
 * profile links to) or read an injected home — they may only go down.
 *
 *   (default)  fail when a file has more joins than its baseline entry
 *   --write    lower each entry to the live count (never raises, drops zeros)
 *   --list     print every counted line as file:line
 *
 * Exit codes: 0 at or under the baseline · 1 above it · 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseGateArgs } from './_lib/gate_args.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const BASELINE_REL = 'src/config/provider-home-joins-baseline.json';
export const RUNTIME_ROOTS = ['src/install', 'src/scripts/_lib', 'src/scripts/_cli', 'src/scripts/hooks'];
const RESOLVER_REL = 'src/scripts/_lib/provider_home.ts';

/** `homedir(), '.claude'` · `home, '.codex'` · `env['HOME'], '.gemini'` and kin. */
export const JOIN = /(homedir\(\)|home[A-Za-z]*|HOME'\][^,]*)\s*,\s*'\.(claude|codex|gemini)'/;

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
        else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && !e.name.endsWith('.d.ts')) out.push(p);
    }
}

/** The runtime source files the ratchet reads, sorted. */
export function runtimeFiles(root: string): string[] {
    const files: string[] = [];
    for (const r of RUNTIME_ROOTS) walk(path.join(root, r), files);
    return files.sort();
}

/** Every counted join as `file:line`, repo-relative, sorted. */
export function joinSites(root: string): string[] {
    const out: string[] = [];
    for (const f of runtimeFiles(root)) {
        const rel = path.relative(root, f).split(path.sep).join('/');
        if (rel === RESOLVER_REL) continue;
        fs.readFileSync(f, 'utf-8')
            .split('\n')
            .forEach((l, i) => {
                if (JOIN.test(l) && !l.includes('CLAUDE_CONFIG_DIR')) out.push(`${rel}:${i + 1}`);
            });
    }
    return out;
}

/** `["file:3", …]` → `{ file: 3 }`; a malformed entry throws, so the gate reports a usage error. */
export function parseHeld(held: readonly string[]): Record<string, number> {
    if (!Array.isArray(held)) throw new Error('held is not a list');
    const out: Record<string, number> = {};
    for (const h of held) {
        const at = h.lastIndexOf(':');
        const n = Number(h.slice(at + 1));
        if (at <= 0 || !Number.isInteger(n) || n <= 0) throw new Error(`malformed entry ${h}`);
        out[h.slice(0, at)] = n;
    }
    return out;
}

export function countsByFile(sites: readonly string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of sites) {
        const file = s.slice(0, s.lastIndexOf(':'));
        counts[file] = (counts[file] ?? 0) + 1;
    }
    return counts;
}

export function main(argv: readonly string[] = process.argv.slice(2), root: string = REPO_ROOT): number {
    const args = parseGateArgs('check_provider_home_joins', argv, {
        list: { type: 'boolean' },
        write: { type: 'boolean' },
    });
    if (!args.ok) {
        process.stderr.write(`${args.message}\n`);
        return 2;
    }
    const listMode = args.values.list === true;
    const writeMode = args.values.write === true;
    try {
        assertScanned({ gate: 'check_provider_home_joins', scanned: runtimeFiles(root).length, units: 'file(s)', roots: RUNTIME_ROOTS });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`${err.message}\n`);
            return 2;
        }
        throw err;
    }
    const sites = joinSites(root);
    if (listMode) {
        for (const s of sites) process.stdout.write(`${s}\n`);
        return 0;
    }
    const file = path.join(root, BASELINE_REL);
    let baseline: Record<string, number>;
    try {
        baseline = parseHeld((JSON.parse(fs.readFileSync(file, 'utf-8')) as { held: string[] }).held);
    } catch {
        process.stderr.write(`check_provider_home_joins: cannot read ${BASELINE_REL} (expects { held: ["<file>:<count>", …] })\n`);
        return 2;
    }
    const live = countsByFile(sites);
    if (writeMode) {
        const next: Record<string, number> = {};
        for (const [f, n] of Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b))) {
            const v = Math.min(n, live[f] ?? 0);
            if (v > 0) next[f] = v;
        }
        const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
        fs.writeFileSync(file, `${JSON.stringify({ ...raw, held: Object.entries(next).map(([f, n]) => `${f}:${n}`) }, null, 1)}\n`);
        process.stdout.write(`provider-home joins baseline lowered to ${Object.values(next).reduce((a, b) => a + b, 0)}\n`);
        return 0;
    }
    const over = Object.entries(live).filter(([f, n]) => n > (baseline[f] ?? 0));
    if (over.length > 0) {
        for (const [f, n] of over) {
            process.stdout.write(`❌  ${f}: ${n} provider-home join(s) > baseline ${baseline[f] ?? 0}\n`);
        }
        process.stdout.write(
            `   Resolve through ${RESOLVER_REL} (claudeHome / codexHome / geminiHome) so a profile session reads its own dir. Run --list to see the lines.\n`,
        );
        return 1;
    }
    process.stdout.write(`✅  provider-home joins: ${sites.length} across ${Object.keys(live).length} file(s), none above baseline\n`);
    return 0;
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(_HERE)) process.exit(main());
