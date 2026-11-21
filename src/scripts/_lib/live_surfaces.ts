/**
 * The reachability map's reader: every surface a repo can run, derived from its
 * files. See `derive_live_surfaces.ts` for why the list is derived and never
 * hand-kept.
 *
 * Split from that CLI so detector G (`_lib/coverage_claim.ts`) carries only the
 * read into the hook dispatch bundle, and not the cache writer or the CLI.
 *
 * Read: `package.json` scripts `dev|start|preview|serve`, `tauri.conf.json`
 * windows (repo root or `src-tauri/`), `playwright.config.*` `baseURL`,
 * `docker-compose*.yml` / `compose*.yml` service ports, and Taskfile tasks
 * `dev|run|serve`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

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

/** Inputs are small config files; anything larger is not one, and is not read. */
const MAX_INPUT_BYTES = 1024 * 1024;

/**
 * A regular file of bounded size, or null. The hook runs this on a Stop event
 * in a repo it does not control, so a FIFO or device named `package.json`
 * would block a synchronous read that no `try` can recover from.
 */
export function readText(file: string): string | null {
    try {
        const st = fs.statSync(file);
        if (!st.isFile() || st.size > MAX_INPUT_BYTES) return null;
        return fs.readFileSync(file, 'utf8');
    } catch {
        return null;
    }
}

export function rel(root: string, file: string): string {
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

export function derive(root: string): { surfaces: LiveSurface[]; inputs: string[] } {
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
