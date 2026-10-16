#!/usr/bin/env tsx
/**
 * How many of this package's gates run on a CONSUMER's machine.
 *
 * A gate here is a top-level `src/scripts/` module named `check_*`, `lint_*` or
 * `audit_*` — the same prefix census `ls src/scripts | grep -cE` returns, minus
 * the allowlist data files and test files that census also counts. Most of them
 * run only in this repository's CI. This report names the ones a consumer's
 * install can actually execute, so a figure about "consumer-path gates" is a
 * reading rather than a recollection.
 *
 * REACHABLE means statically reachable from an entry point a consumer runs:
 *
 *   - the hook dispatcher entry and every `script:` the hook manifest binds;
 *   - the node CLI entry, every delegated `src/scripts/_cli/cmd_*.ts` verb, the
 *     installer and the MCP server;
 *   - every `src/**` `.ts` path the bash dispatcher names literally.
 *
 * Edges are relative value imports (static and dynamic) plus a literal
 * `src/scripts/<gate>.ts` string inside a reached module, which is how a module
 * spawns a gate as a child process. Type-only imports are not edges: they are
 * erased before anything runs.
 *
 * What this does NOT see: a gate a consumer runs by typing its path by hand, and
 * a spawn whose path is assembled at runtime. Both make the figure a LOWER bound
 * on reach through a supported surface, never a census of what a determined
 * consumer could execute. Named `report_` because it publishes a reading and
 * gates nothing — whether the figure becomes a ratchet is the open
 * `consumer-gate-denominator` blocker, not this script's decision.
 *
 * Inputs:  --root DIR (default: this repository) · --json
 * Exit 0 with a reading; 1 when an entry point the reading depends on is absent,
 * because a count over a tree with no dispatcher is not a reading.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

export const GATE_PREFIX_RE = /^(check_|lint_|audit_)/;
export const HOOK_MANIFEST = 'src/scripts/hook_manifest.yaml';
export const BASH_DISPATCHER = 'src/scripts/_dispatch.bash';

/** Entry points that must exist for the reading to mean anything. */
export const FIXED_ENTRIES: readonly string[] = [
    'src/scripts/hooks/dispatch_entry.ts',
    'src/cli/agent-config.ts',
    'src/scripts/install.ts',
    'src/scripts/mcp_server/__main__.ts',
];
const REQUIRED_ENTRIES: readonly string[] = ['src/scripts/hooks/dispatch_entry.ts', HOOK_MANIFEST];

export interface Reading {
    /** Every top-level `src/scripts/` entry with a gate prefix, data files included. */
    prefixEntries: number;
    /** Gate modules: `.ts`, not a test. */
    gates: string[];
    /** Gate modules statically reachable from a consumer entry point. */
    reachable: string[];
    /** Entry points the walk started from, repo-relative. */
    entries: string[];
}

function strip(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Relative VALUE specifiers: static imports, re-exports, side-effect and dynamic imports. */
export function valueSpecifiers(source: string): string[] {
    const s = strip(source);
    const out: string[] = [];
    const staticRe = /\b(?:import|export)\s+(?!type\b)(?:[\s\S]*?\bfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/g;
    const dynamicRe = /\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
    for (const re of [staticRe, dynamicRe]) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(s)) !== null) {
            if (m[1] !== undefined) out.push(m[1]);
        }
    }
    return out;
}

/** Literal `src/scripts/<gate>.ts` paths — the spawn edge. */
export function spawnedGatePaths(source: string): string[] {
    const out: string[] = [];
    const re = /src\/scripts\/((?:check|lint|audit)_[A-Za-z0-9_]+)(?:\.ts)?\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) out.push(`src/scripts/${m[1] as string}.ts`);
    return out;
}

function resolveSpec(root: string, fromRel: string, spec: string): string | null {
    const base = path.posix.join(path.posix.dirname(fromRel), spec);
    for (const c of [base.replace(/\.js$/, '.ts'), base, `${base}.ts`, `${base}/index.ts`]) {
        const norm = path.posix.normalize(c);
        const abs = path.join(root, norm);
        if (norm.endsWith('.ts') && fs.existsSync(abs) && fs.statSync(abs).isFile()) return norm;
    }
    return null;
}

function manifestScripts(root: string): string[] {
    const doc = YAML.parse(fs.readFileSync(path.join(root, HOOK_MANIFEST), 'utf8')) as unknown;
    const out = new Set<string>();
    const visit = (v: unknown): void => {
        if (Array.isArray(v)) {
            v.forEach(visit);
        } else if (v !== null && typeof v === 'object') {
            for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
                if (k === 'script' && typeof val === 'string' && val.endsWith('.ts')) out.add(val);
                else visit(val);
            }
        }
    };
    visit(doc);
    return [...out].sort();
}

function bashNamedSources(root: string): string[] {
    const abs = path.join(root, BASH_DISPATCHER);
    if (!fs.existsSync(abs)) return [];
    const text = fs.readFileSync(abs, 'utf8');
    return [...new Set(text.match(/\bsrc\/[A-Za-z0-9_/.-]+\.ts\b/g) ?? [])].sort();
}

function delegatedVerbs(root: string): string[] {
    const dir = path.join(root, 'src/scripts/_cli');
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => /^cmd_.*\.ts$/.test(f) && !f.endsWith('.test.ts'))
        .map((f) => `src/scripts/_cli/${f}`)
        .sort();
}

export function listGates(root: string): { prefixEntries: number; gates: string[] } {
    const names = fs.readdirSync(path.join(root, 'src/scripts')).filter((n) => GATE_PREFIX_RE.test(n));
    const gates = names
        .filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))
        .map((n) => `src/scripts/${n}`)
        .sort();
    return { prefixEntries: names.length, gates };
}

export function read(root: string): Reading {
    for (const req of REQUIRED_ENTRIES) {
        if (!fs.existsSync(path.join(root, req))) {
            throw new Error(`no ${req} under ${root}`);
        }
    }
    const entries = [
        ...new Set([
            ...FIXED_ENTRIES,
            ...manifestScripts(root),
            ...delegatedVerbs(root),
            ...bashNamedSources(root),
        ]),
    ]
        .filter((e) => fs.existsSync(path.join(root, e)))
        .sort();
    const { prefixEntries, gates } = listGates(root);
    const gateSet = new Set(gates);
    const visited = new Set<string>();
    const queue = [...entries];
    while (queue.length > 0) {
        const rel = queue.shift() as string;
        if (visited.has(rel)) continue;
        visited.add(rel);
        const source = fs.readFileSync(path.join(root, rel), 'utf8');
        for (const spec of valueSpecifiers(source)) {
            const target = resolveSpec(root, rel, spec);
            if (target !== null && !visited.has(target)) queue.push(target);
        }
        for (const g of spawnedGatePaths(strip(source))) {
            if (gateSet.has(g) && !visited.has(g)) queue.push(g);
        }
    }
    return { prefixEntries, gates, reachable: gates.filter((g) => visited.has(g)), entries };
}

export function render(r: Reading): string[] {
    const lines = [
        `prefix entries under src/scripts/: ${r.prefixEntries}`,
        `gate modules (.ts, not a test):    ${r.gates.length}`,
        `reachable from a consumer entry:   ${r.reachable.length} (${r.entries.length} entry point(s) walked)`,
        '',
    ];
    for (const g of r.reachable) lines.push(`  ${g}`);
    return lines;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let root = REPO;
    let json = false;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--root') {
            root = path.resolve(argv[i + 1] ?? root);
            i += 1;
        } else if (argv[i] === '--json') {
            json = true;
        }
    }
    let reading: Reading;
    try {
        reading = read(root);
    } catch (e) {
        process.stderr.write(`report_consumer_gate_reach: ${e instanceof Error ? e.message : String(e)}\n`);
        return 1;
    }
    const out = json
        ? JSON.stringify(
              {
                  prefix_entries: reading.prefixEntries,
                  gates: reading.gates.length,
                  reachable: reading.reachable,
                  entries: reading.entries.length,
              },
              null,
              2,
          )
        : render(reading).join('\n');
    process.stdout.write(`${out}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
