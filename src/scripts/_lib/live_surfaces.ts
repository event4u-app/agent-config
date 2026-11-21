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
    /** npm-script only: the root playwright configs (repo-relative) whose `webServer` starts this script. */
    webServerOf?: string[];
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
export function readText(file: string, root?: string): string | null {
    let fd: number | null = null;
    try {
        // A symlinked parent directory (`src-tauri -> /elsewhere`) is not caught
        // by O_NOFOLLOW, which guards the last component only.
        let target = file;
        if (root !== undefined) {
            const base = fs.realpathSync(root);
            target = fs.realpathSync(file);
            if (target !== base && !target.startsWith(base + path.sep)) return null;
        }
        // Non-blocking open, then check the OPENED file: a path swapped between a
        // stat and a read cannot slip a FIFO or a large file past the check.
        // O_NOFOLLOW: a symlinked input could point out of the repo.
        fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK | fs.constants.O_NOFOLLOW);
        const st = fs.fstatSync(fd);
        if (!st.isFile() || st.size > MAX_INPUT_BYTES) return null;
        // A parent directory swapped between the check and the open shows as a different file.
        // Residual, stated: Node has no openat, so a directory swapped again between this
        // re-check and the stat cannot be excluded by path checks. A process that can swap
        // directories inside the workspace mid-Stop already controls the files the agent
        // runs, and what is read here becomes surface names in a local record-only counter.
        if (root !== undefined) {
            const base = fs.realpathSync(root);
            const againPath = fs.realpathSync(file);
            if (againPath !== base && !againPath.startsWith(base + path.sep)) return null;
            const again = fs.statSync(againPath);
            if (again.ino !== st.ino || again.dev !== st.dev) return null;
        }
        const buf = Buffer.alloc(MAX_INPUT_BYTES + 1);
        const n = fs.readSync(fd, buf, 0, buf.length, 0);
        return n > MAX_INPUT_BYTES ? null : buf.toString('utf8', 0, n);
    } catch {
        return null;
    } finally {
        if (fd !== null) fs.closeSync(fd);
    }
}

/** Compose files read per derivation; with the per-file bound this caps the whole read. */
const MAX_COMPOSE_FILES = 8;
/** Directory entries looked at when finding compose files. */
const MAX_DIR_ENTRIES = 4096;
/**
 * `//` and `/* *\/` comments removed in one linear pass that skips string literals,
 * so neither a comment opener inside a string nor an unclosed one costs a rescan.
 */
function stripJsComments(text: string): string {
    let out = '';
    let i = 0;
    let quote: string | null = null;
    while (i < text.length) {
        const c = text[i] as string;
        if (quote !== null) {
            out += c;
            if (c === '\\' && i + 1 < text.length) {
                out += text[i + 1];
                i += 2;
                continue;
            }
            if (c === quote) quote = null;
            i += 1;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            quote = c;
            out += c;
            i += 1;
            continue;
        }
        if (c === '/' && text[i + 1] === '/') {
            const nl = text.indexOf('\n', i);
            i = nl === -1 ? text.length : nl;
            continue;
        }
        if (c === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            i = end === -1 ? text.length : end + 2;
            continue;
        }
        out += c;
        i += 1;
    }
    return out;
}

/** `text` with every string literal's contents replaced by spaces; quotes and length kept. */
function maskStringInteriors(text: string): string {
    let out = '';
    let quote: string | null = null;
    for (let i = 0; i < text.length; i += 1) {
        const c = text[i] as string;
        if (quote === null) {
            if (c === '"' || c === "'" || c === '`') quote = c;
            out += c;
            continue;
        }
        if (c === '\\' && i + 1 < text.length) {
            out += '  ';
            i += 1;
            continue;
        }
        if (c === quote) {
            quote = null;
            out += c;
            continue;
        }
        out += c === '\n' ? '\n' : ' ';
    }
    return out;
}

/** Surfaces per derivation, enforced while building as well as at the end. */
const MAX_SURFACES = 64;

export function rel(root: string, file: string): string {
    return path.relative(root, file).split(path.sep).join('/');
}

function npmScripts(root: string, inputs: string[]): { surfaces: LiveSurface[]; scripts: Record<string, string> } {
    const file = path.join(root, 'package.json');
    const text = readText(file, root);
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
        const text = readText(file, root);
        if (text === null) continue;
        inputs.push(file);
        let conf: { app?: { windows?: unknown }; tauri?: { windows?: unknown }; build?: { devUrl?: unknown } };
        try {
            conf = JSON.parse(text) as typeof conf;
        } catch {
            continue;
        }
        if (typeof conf !== 'object' || conf === null || Array.isArray(conf)) continue;
        const windows = conf.app?.windows ?? conf.tauri?.windows;
        // Cut before building: a sub-1 MiB config can list hundreds of thousands of windows.
        const list = (Array.isArray(windows) && windows.length > 0 ? windows : [{}]).slice(0, MAX_SURFACES);
        const start = typeof scripts['tauri'] === 'string' ? 'npm run tauri dev' : 'npx tauri dev';
        // Each line once per file, not one full-file scan per window.
        const widthLine = lineOf(text, /"width"\s*:/);
        const windowsLine = lineOf(text, /"windows"\s*:/);
        list.forEach((w, i) => {
            const win = (typeof w === 'object' && w !== null ? w : {}) as Record<string, unknown>;
            const width = win['width'];
            const height = win['height'];
            const entry: LiveSurface = {
                kind: 'tauri',
                name: typeof win['title'] === 'string' ? win['title'] : `window ${String(i + 1)}`,
                start,
                root: '.',
                derived_from: `${rel(root, file)}:${String(typeof width === 'number' ? widthLine : windowsLine)}`,
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

function playwrightBaseUrls(root: string, inputs: string[], texts: Array<{ config: string; text: string }>): LiveSurface[] {
    const out: LiveSurface[] = [];
    for (const ext of ['ts', 'js', 'mjs', 'cjs', 'mts']) {
        const file = path.join(root, `playwright.config.${ext}`);
        const text = readText(file, root);
        if (text === null) continue;
        inputs.push(file);
        texts.push({ config: rel(root, file), text });
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
        // A bounded directory walk: at most MAX_DIR_ENTRIES names are looked at.
        const dirHandle = fs.opendirSync(root);
        try {
            for (let i = 0; i < MAX_DIR_ENTRIES; i += 1) {
                const entry = dirHandle.readSync();
                if (entry === null) break;
                if (/^(docker-)?compose[\w.-]*\.ya?ml$/.test(entry.name)) names.push(entry.name);
            }
        } finally {
            dirHandle.closeSync();
        }
        names = names.sort().slice(0, MAX_COMPOSE_FILES);
    } catch {
        return out;
    }
    for (const name of names) {
        const file = path.join(root, name);
        const text = readText(file, root);
        if (text === null) continue;
        inputs.push(file);
        let doc: { services?: Record<string, { ports?: unknown }> };
        try {
            doc = (parseYaml(text) ?? {}) as typeof doc;
        } catch {
            continue;
        }
        // One pass over the file for every service's line, not one scan per service.
        const lineOfService = new Map<string, number>();
        text.split('\n').forEach((l, i) => {
            // A linear scan, no regex: an indented `key:` line.
            if (l === '' || (l[0] !== ' ' && l[0] !== '\t')) return;
            const colon = l.indexOf(':');
            if (colon < 0) return;
            const key = l.slice(0, colon).trim();
            if (key === '' || key.includes('#') || key.includes(' ')) return;
            if (!lineOfService.has(key)) lineOfService.set(key, i + 1);
        });
        for (const [service, spec] of Object.entries(doc.services ?? {})) {
            const ports = Array.isArray(spec?.ports) ? spec.ports : [];
            const line = lineOfService.get(service) ?? 1;
            for (const p of ports.slice(0, MAX_SURFACES)) {
                if (out.length >= MAX_SURFACES) break;
                const host = /^(?:[\d.]+:)?(\d+):\d+/.exec(String(p));
                if (host === null) continue;
                out.push({
                    kind: 'compose',
                    name: service,
                    start: `docker compose -f ${name} up ${service}`,
                    url: `http://localhost:${host[1] as string}`,
                    root: '.',
                    derived_from: `${name}:${String(line)}`,
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
        const text = readText(file, root);
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
    const playwrightTexts: Array<{ config: string; text: string }> = [];
    const npm = npmScripts(root, inputs);
    const surfaces = [
        ...npm.surfaces,
        ...tauriWindows(root, npm.scripts, inputs),
        ...playwrightBaseUrls(root, inputs, playwrightTexts),
        ...composePorts(root, inputs),
        ...taskfileTasks(root, inputs),
    ].slice(0, MAX_SURFACES);
    // The npm script a root playwright config starts as its webServer is driven by a playwright run.
    // The `command:` of each config's `webServer: { … }` entry, comments removed; any other
    // `command:` property (metadata, projects) does not start a server.
    const webServers = playwrightTexts.flatMap(({ config, text }) => {
        const code = stripJsComments(text);
        // Find the keys on a copy whose string interiors are blanked (same length), so a
        // `webServer: { command: … }` written inside a string literal is not a key.
        const masked = maskStringInteriors(code);
        const m = /webServer\s*:\s*\{([^{}]*)\}/.exec(masked);
        if (m === null) return [];
        const bodyAt = m.index + m[0].indexOf('{') + 1;
        const cmd = /command\s*:\s*(['"`])/.exec(m[1] as string);
        if (cmd === null) return [];
        const open = bodyAt + cmd.index + cmd[0].length;
        const close = code.indexOf(cmd[1] as string, open);
        return close < 0 ? [] : [{ config, command: code.slice(open, close).trim() }];
    });
    for (const s of surfaces) {
        if (s.kind !== 'npm-script') continue;
        const run = new RegExp(`(?:^|[;&|]\\s*)(?:npm run|pnpm(?: run)?|yarn|bun run) ${escapeRe(s.name)}(?:$|\\s)`);
        const of = webServers.filter((w) => run.test(w.command)).map((w) => w.config);
        if (of.length > 0) s.webServerOf = of;
    }
    return { surfaces, inputs };
}

/** Every runnable surface the repo at `root` declares. Pure read. */
export function deriveLiveSurfaces(root: string): LiveSurface[] {
    return derive(root).surfaces;
}
