#!/usr/bin/env tsx
/**
 * The reachability map: every surface a repo can run, derived from its files.
 *
 * A completion claim over a change to an app is only as good as the check that
 * drove the app. Before an agent can say what it did NOT verify, it needs to
 * know what there was to verify, and that list must not depend on anyone
 * writing it down: a hand-kept list goes stale the day a script is renamed,
 * and the owner asked for none (2026-11-21). So every entry here is read off a
 * file the repo already keeps, and names the file and line it came from.
 *
 * Read: `package.json` scripts `dev|start|preview|serve`, `tauri.conf.json`
 * windows (repo root or `src-tauri/`), `playwright.config.*` `baseURL`,
 * `docker-compose*.yml` / `compose*.yml` service ports, and Taskfile tasks
 * `dev|run|serve`. A repo whose app starts some other way reads as having no
 * surface, which is a miss the verify skill names rather than a pass.
 *
 * Writes `agents/state/live-surfaces.json` (gitignored) and regenerates it when
 * any input file is newer than the map.
 *
 * Usage:
 *   agent-config verify:surfaces [--root DIR] [--json] [--quiet]
 *
 * Exit 0 always on a readable root; 2 on a usage error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'derive_live_surfaces';

export const LIVE_SURFACES_REL = path.join('agents', 'state', 'live-surfaces.json');

export type SurfaceKind = 'npm-script' | 'tauri' | 'playwright' | 'compose' | 'taskfile';

export interface LiveSurface {
    kind: SurfaceKind;
    name: string;
    /** The command that starts it, as the repo spells it. */
    start: string | null;
    url?: string;
    /** `WIDTHxHEIGHT` for a desktop window. */
    size?: string;
    /** Directory, relative to the root, whose files this surface runs. */
    root: string;
    /** `file:line` the entry was read from. */
    derived_from: string;
}

export interface LiveSurfaceMap {
    generated_at: string;
    inputs: string[];
    surfaces: LiveSurface[];
}

const NPM_SURFACE_SCRIPTS: readonly string[] = ['dev', 'start', 'preview', 'serve'];
const TASK_SURFACE_NAMES: ReadonlySet<string> = new Set(['dev', 'run', 'serve']);

/** 1-based line of the first line matching `re`, or 1. */
function lineOf(text: string, re: RegExp): number {
    const idx = text.split('\n').findIndex((l) => re.test(l));
    return idx === -1 ? 1 : idx + 1;
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readText(file: string): string | null {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return null;
    }
}

function rel(root: string, file: string): string {
    return path.relative(root, file).split(path.sep).join('/');
}

function npmScripts(root: string, inputs: string[]): { surfaces: LiveSurface[]; scripts: Record<string, string> } {
    const file = path.join(root, 'package.json');
    const text = readText(file);
    if (text === null) return { surfaces: [], scripts: {} };
    inputs.push(file);
    let scripts: Record<string, string> = {};
    try {
        const json = JSON.parse(text) as { scripts?: Record<string, string> };
        scripts = json.scripts ?? {};
    } catch {
        return { surfaces: [], scripts: {} };
    }
    const surfaces: LiveSurface[] = [];
    for (const name of NPM_SURFACE_SCRIPTS) {
        if (typeof scripts[name] !== 'string') continue;
        surfaces.push({
            kind: 'npm-script',
            name,
            start: `npm run ${name}`,
            root: '.',
            derived_from: `package.json:${String(lineOf(text, new RegExp(`"${escapeRe(name)}"\\s*:`)))}`,
        });
    }
    return { surfaces, scripts };
}

function tauriWindows(root: string, scripts: Record<string, string>, inputs: string[]): LiveSurface[] {
    const out: LiveSurface[] = [];
    for (const candidate of ['tauri.conf.json', path.join('src-tauri', 'tauri.conf.json')]) {
        const file = path.join(root, candidate);
        const text = readText(file);
        if (text === null) continue;
        inputs.push(file);
        let conf: { app?: { windows?: unknown }; tauri?: { windows?: unknown }; build?: { devUrl?: unknown } };
        try {
            conf = JSON.parse(text) as typeof conf;
        } catch {
            continue;
        }
        const windows = conf.app?.windows ?? conf.tauri?.windows;
        const list = Array.isArray(windows) && windows.length > 0 ? windows : [{}];
        const start = typeof scripts['tauri'] === 'string' ? 'npm run tauri dev' : 'npx tauri dev';
        list.forEach((w, i) => {
            const win = (typeof w === 'object' && w !== null ? w : {}) as Record<string, unknown>;
            const width = win['width'];
            const height = win['height'];
            const entry: LiveSurface = {
                kind: 'tauri',
                name: typeof win['title'] === 'string' ? win['title'] : `window ${String(i + 1)}`,
                start,
                root: '.',
                derived_from: `${rel(root, file)}:${String(lineOf(text, typeof width === 'number' ? /"width"\s*:/ : /"windows"\s*:/))}`,
            };
            if (typeof width === 'number' && typeof height === 'number') {
                entry.size = `${String(width)}x${String(height)}`;
            }
            if (typeof conf.build?.devUrl === 'string') entry.url = conf.build.devUrl;
            out.push(entry);
        });
    }
    return out;
}

function playwrightBaseUrls(root: string, inputs: string[]): LiveSurface[] {
    const out: LiveSurface[] = [];
    for (const ext of ['ts', 'js', 'mjs', 'cjs', 'mts']) {
        const file = path.join(root, `playwright.config.${ext}`);
        const text = readText(file);
        if (text === null) continue;
        inputs.push(file);
        const m = /baseURL\s*:\s*['"`]([^'"`]+)['"`]/.exec(text);
        if (m === null) continue;
        out.push({
            kind: 'playwright',
            name: 'baseURL',
            start: 'npx playwright test',
            url: m[1] as string,
            root: '.',
            derived_from: `${rel(root, file)}:${String(lineOf(text, /baseURL\s*:/))}`,
        });
    }
    return out;
}

function composePorts(root: string, inputs: string[]): LiveSurface[] {
    const out: LiveSurface[] = [];
    let names: string[] = [];
    try {
        names = fs.readdirSync(root).filter((n) => /^(docker-)?compose[\w.-]*\.ya?ml$/.test(n)).sort();
    } catch {
        return out;
    }
    for (const name of names) {
        const file = path.join(root, name);
        const text = readText(file);
        if (text === null) continue;
        inputs.push(file);
        let doc: { services?: Record<string, { ports?: unknown }> };
        try {
            doc = (parseYaml(text) ?? {}) as typeof doc;
        } catch {
            continue;
        }
        for (const [service, spec] of Object.entries(doc.services ?? {})) {
            const ports = Array.isArray(spec?.ports) ? spec.ports : [];
            for (const p of ports) {
                const host = /^(?:[\d.]+:)?(\d+):\d+/.exec(String(p));
                if (host === null) continue;
                out.push({
                    kind: 'compose',
                    name: service,
                    start: `docker compose -f ${name} up ${service}`,
                    url: `http://localhost:${host[1] as string}`,
                    root: '.',
                    derived_from: `${name}:${String(lineOf(text, new RegExp(`^\\s+${escapeRe(service)}\\s*:`)))}`,
                });
            }
        }
    }
    return out;
}

function taskfileTasks(root: string, inputs: string[]): LiveSurface[] {
    const out: LiveSurface[] = [];
    for (const name of ['Taskfile.yml', 'Taskfile.yaml']) {
        const file = path.join(root, name);
        const text = readText(file);
        if (text === null) continue;
        inputs.push(file);
        let doc: { tasks?: Record<string, unknown> };
        try {
            doc = (parseYaml(text) ?? {}) as typeof doc;
        } catch {
            continue;
        }
        for (const task of Object.keys(doc.tasks ?? {})) {
            if (!TASK_SURFACE_NAMES.has(task)) continue;
            out.push({
                kind: 'taskfile',
                name: task,
                start: `task ${task}`,
                root: '.',
                derived_from: `${name}:${String(lineOf(text, new RegExp(`^\\s+${escapeRe(task)}\\s*:`)))}`,
            });
        }
    }
    return out;
}

function derive(root: string): { surfaces: LiveSurface[]; inputs: string[] } {
    const inputs: string[] = [];
    const npm = npmScripts(root, inputs);
    const surfaces = [
        ...npm.surfaces,
        ...tauriWindows(root, npm.scripts, inputs),
        ...playwrightBaseUrls(root, inputs),
        ...composePorts(root, inputs),
        ...taskfileTasks(root, inputs),
    ];
    return { surfaces, inputs };
}

/** Every runnable surface the repo at `root` declares. Pure read. */
export function deriveLiveSurfaces(root: string): LiveSurface[] {
    return derive(root).surfaces;
}

function mtime(file: string): number {
    try {
        return fs.statSync(file).mtimeMs;
    } catch {
        return Number.NaN;
    }
}

/**
 * The map, regenerated when it is missing, unreadable, or older than any input
 * it was derived from (or any input that now exists and did not then).
 */
export function ensureLiveSurfaces(root: string, force = false): LiveSurfaceMap {
    const out = path.join(root, LIVE_SURFACES_REL);
    if (!force) {
        const outAt = mtime(out);
        const cached = readText(out);
        if (cached !== null && Number.isFinite(outAt)) {
            try {
                const map = JSON.parse(cached) as LiveSurfaceMap;
                const fresh = derive(root).inputs;
                const stale = fresh.some((f) => !(mtime(f) <= outAt))
                    || fresh.length !== (map.inputs ?? []).length;
                if (!stale && Array.isArray(map.surfaces)) return map;
            } catch {
                // Unreadable map: regenerate below.
            }
        }
    }
    const { surfaces, inputs } = derive(root);
    const map: LiveSurfaceMap = {
        generated_at: new Date().toISOString(),
        inputs: inputs.map((f) => rel(root, f)),
        surfaces,
    };
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`);
    return map;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    // The dispatcher strips a global `--root` and exports it here, so
    // `agent-config verify:surfaces --root X` reaches this default, not argv.
    let root = process.env['AGENT_CONFIG_PROJECT_ROOT'] || process.cwd();
    let quiet = false;
    let asJson = false;
    let force = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--root') {
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write(`${_PROG}: --root needs a path\n`);
                return 2;
            }
            root = path.resolve(next);
            i += 1;
        } else if (a === '--quiet') {
            quiet = true;
        } else if (a === '--json') {
            asJson = true;
        } else if (a === '--force') {
            force = true;
        } else {
            process.stderr.write('usage: verify:surfaces [--root DIR] [--json] [--force] [--quiet]\n');
            return 2;
        }
    }
    const map = ensureLiveSurfaces(root, force);
    if (quiet) return 0;
    if (asJson) {
        process.stdout.write(`${JSON.stringify(map, null, 2)}\n`);
        return 0;
    }
    if (map.surfaces.length === 0) {
        process.stdout.write(
            `no runnable surface derived under ${root} — a change here has no live check to owe, ` +
                'or the repo starts its app in a way this reader does not know (list it as not verified)\n',
        );
        return 0;
    }
    for (const s of map.surfaces) {
        const where = s.url ?? s.size ?? '';
        process.stdout.write(`${s.kind}\t${s.name}\t${s.start ?? '—'}\t${where}\t${s.derived_from}\n`);
    }
    return 0;
}

// Detector G imports this module into the hook bundle, where every module
// shares the bundle's `import.meta.url`; the bundle flag keeps `main()` from
// running on a hook dispatch.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (!process.argv[1]) return false;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
