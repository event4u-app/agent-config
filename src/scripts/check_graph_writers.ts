#!/usr/bin/env tsx
/**
 * check_graph_writers — every graph, map or cache write lands in one of the two
 * layouts (ADR-303 § 5): a project's `agents/map/` (with `.build/` for the cache,
 * twin, lock and opt-in) or the machine-wide hub in the user-global `map/`.
 *
 * A write is a call to a file-writing primitive (`writeFileSync`,
 * `write_atomic`, `appendFileSync`, `copyFileSync`, `cpSync`, `renameSync`,
 * `mkdirSync`, `createWriteStream`, a writable `DatabaseSync`). Its target
 * expression is expanded through the `const`/`let` initialisers of the same
 * file, up to a few levels, and the expanded text is then checked twice:
 *
 *   1. does it name a graph artefact (the graph cache, its twin and sidecar,
 *      the refresh lock and opt-in, a map's `map.json`, render check or
 *      outcomes log, the estate index, the hub's facts)?
 *   2. does it place it in a location outside both layouts — the pre-ADR-303
 *      `agents/runtime/state/`, `runtime/graphs/`, `runtime/estate/`, the
 *      registry directory, a `legacy…` path, or an `agents/<x>` that is not
 *      `agents/map`?
 *
 * Both → a finding. The layout resolvers themselves (`graph_home.ts`'s path
 * constants, `hubDir`, `graphsRoot`, `indexPath`, …) are held to the second
 * test on their own definitions, since every other writer inherits their
 * location. A temp directory is neither layout nor a persistent home,
 * so a benchmark copying a graph into one passes; reading an old path (the
 * one-release fallback) is not a write and passes.
 *
 * What this cannot see, stated rather than implied: a target built in another
 * file and passed in as a bare parameter, or assembled at runtime from data.
 * The two layout resolvers (`graph_home.ts`, `estate_index.ts indexPath`) are
 * the single place a location is chosen; this gate keeps a second one from
 * appearing beside them.
 *
 * Usage: check_graph_writers [--root <dir>] [--json]   (exit 0 clean · 1 finding · 2 usage)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

import { reportScanned } from './_lib/scan_scope.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Calls whose first argument is the written path. */
const WRITE_FIRST = new Set(['writeFileSync', 'writeFile', 'write_atomic', 'appendFileSync', 'appendFile', 'mkdirSync', 'mkdir', 'createWriteStream']);
/** Calls whose second argument is the written path. */
const WRITE_SECOND = new Set(['copyFileSync', 'copyFile', 'cpSync', 'cp', 'renameSync', 'rename']);

/** Names of graph, map and cache artefacts, as they appear in source. */
const ARTEFACT = [
    /code-graph-v1/,
    /code-graph-refresh/,
    /code-graph-auto-refresh/,
    /map-outcomes/,
    /map-render\.json/,
    /['"`]map\.json['"`]/,
    /index-v1\.sqlite3/,
    /estate-index/,
    /hub\.json/,
    /NATIVE_CACHE_REL|LOCK_REL|AUTO_REFRESH_REL/,
    /\.(?:cachePath|buildCachePath|lockPath|autoRefreshPath|mapDir|buildDir)\b|\b(?:sqliteTwinPath|sidecarPath|outcomesPath|graphGeneration)\s*\(/,
];

/** Locations outside both layouts that a graph artefact was, or could plausibly be, written to. */
const OUTSIDE = [
    /runtime\/state|['"]runtime['"]\s*,\s*['"]state['"]/,
    /runtime\/graphs|['"]runtime['"]\s*,\s*['"]graphs['"]/,
    /runtime\/estate|['"]runtime['"]\s*,\s*['"]estate['"]/,
    /\bregistryDir\s*\(|\bprojectsDir\s*\(/,
    /\blegacy\w*|\bLEGACY_\w+/,
    /agents\/(?!map\b)[\w.-]+|['"]agents['"]\s*,\s*['"](?!map['"])[\w.-]+['"]/,
];

/**
 * The constants and functions every writer takes its location from. Their own
 * definitions are checked too: a writer that goes through `home.cachePath` is
 * only inside a layout while these resolve into one. Pre-ADR-303 fallbacks are
 * named `legacy…` and are read, never written, so they are not in these sets.
 */
const LAYOUT_CONSTANTS = new Set(['MAP_DIR_REL', 'BUILD_DIR_REL', 'NATIVE_CACHE_REL', 'LOCK_REL', 'AUTO_REFRESH_REL']);
const LAYOUT_RESOLVERS = new Set(['hubDir', 'graphsRoot', 'indexPath', 'estateMapDir', 'outcomesPath']);

export interface WriterFinding {
    file: string;
    line: number;
    call: string;
    /** The target expression after expansion, cut to a readable length. */
    target: string;
}

function calleeName(expr: ts.Expression): string | null {
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
    return null;
}

/** `name → initialiser text` for every variable declared in the file; a name declared twice keeps both. */
function initialisers(sf: ts.SourceFile): Map<string, string> {
    const out = new Map<string, string>();
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
            const prior = out.get(node.name.text);
            const text = node.initializer.getText(sf);
            out.set(node.name.text, prior ? `${prior} | ${text}` : text);
        }
        if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.initializer) {
            out.set(node.name.text, `${out.get(node.name.text) ?? ''} | ${node.initializer.getText(sf)}`);
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

/** The expression with every identifier that has an initialiser in this file replaced by it, a few levels deep. */
function expand(text: string, inits: Map<string, string>, depth = 3): string {
    let out = text;
    for (let i = 0; i < depth; i++) {
        const next = out.replace(/\b[A-Za-z_$][\w$]*\b/g, (id) => (inits.has(id) ? `(${inits.get(id) as string})` : id));
        if (next === out) break;
        out = next;
    }
    return out;
}

/** True when a `new DatabaseSync(...)` opens its file writable. */
function writableDb(node: ts.NewExpression, sf: ts.SourceFile): boolean {
    const opts = node.arguments?.[1];
    return !(opts && /readOnly\s*:\s*true/.test(opts.getText(sf)));
}

export function scanSource(rel: string, text: string): WriterFinding[] {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const inits = initialisers(sf);
    const out: WriterFinding[] = [];
    const check = (node: ts.Node, call: string, target: ts.Expression | undefined, isLocation = false): void => {
        if (!target) return;
        const expanded = expand(target.getText(sf), inits);
        if (!(isLocation || ARTEFACT.some((r) => r.test(expanded))) || !OUTSIDE.some((r) => r.test(expanded))) return;
        out.push({ file: rel, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, call, target: expanded.replace(/\s+/g, ' ').slice(0, 200) });
    };
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && LAYOUT_CONSTANTS.has(node.name.text)) {
            check(node, `${node.name.text} =`, node.initializer);
        }
        if (ts.isFunctionDeclaration(node) && node.name && LAYOUT_RESOLVERS.has(node.name.text) && node.body) {
            for (const st of node.body.statements) if (ts.isReturnStatement(st)) check(st, `${node.name.text}()`, st.expression, true);
        }
        if (ts.isCallExpression(node)) {
            const name = calleeName(node.expression);
            if (name && WRITE_FIRST.has(name)) check(node, name, node.arguments[0]);
            else if (name && WRITE_SECOND.has(name)) check(node, name, node.arguments[1]);
        } else if (ts.isNewExpression(node) && calleeName(node.expression) === 'DatabaseSync' && writableDb(node, sf)) {
            check(node, 'new DatabaseSync', node.arguments?.[0]);
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

function walk(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.isFile() && /\.(ts|mts)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
    }
}

export function scanTree(root: string): { findings: WriterFinding[]; scanned: number } {
    const files: string[] = [];
    walk(path.join(root, 'src'), files);
    const findings: WriterFinding[] = [];
    for (const abs of files.sort()) {
        const rel = path.relative(root, abs).split(path.sep).join('/');
        findings.push(...scanSource(rel, fs.readFileSync(abs, 'utf-8')));
    }
    return { findings, scanned: files.length };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const at = argv.indexOf('--root');
    if (at >= 0 && argv[at + 1] === undefined) {
        process.stderr.write('usage: check_graph_writers [--root <dir>] [--json]\n');
        return 2;
    }
    const root = at >= 0 ? path.resolve(argv[at + 1] as string) : REPO_ROOT;
    const { findings, scanned } = scanTree(root);
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ scanned, findings }, null, 2)}\n`);
        return findings.length ? 1 : 0;
    }
    reportScanned({ gate: 'check_graph_writers', scanned, units: 'source files', roots: [path.join(root, 'src')] });
    if (!findings.length) {
        process.stdout.write('✅  graph writers: every graph, map and cache write lands in agents/map/ or the hub\n');
        return 0;
    }
    for (const f of findings) process.stdout.write(`❌  ${f.file}:${f.line} ${f.call} → ${f.target}\n`);
    process.stdout.write(
        `\n${findings.length} write(s) of a graph, map or cache outside the two layouts (ADR-303 § 5). ` +
            'Resolve the location through graph_home.ts (projectHome / graphHome / hubDir) or estate_index.ts indexPath.\n',
    );
    return 1;
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) process.exit(main());
