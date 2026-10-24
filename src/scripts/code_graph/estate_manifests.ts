/**
 * What a project's manifests declare and publish, for the estate index
 * (ADR-299, step 4.2). Read from the same manifest set the providers detect a
 * stack by (`readProjectProbe`), plus `Cargo.toml`. Line-level parsing on
 * purpose: the index needs package names, not a resolver, and a malformed
 * manifest costs its own rows rather than the refresh.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { readProjectProbe } from './build.js';

export type Ecosystem = 'npm' | 'composer' | 'pypi' | 'go' | 'cargo' | 'rubygems';

export interface Declared {
    ecosystem: Ecosystem;
    package: string;
    manifest: string;
}

export interface Published {
    ecosystem: Ecosystem;
    package: string;
}

export interface ManifestFacts {
    declares: Declared[];
    publishes: Published[];
}

const PY_NAME = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/;

/** PEP 503 normalisation, so `Foo_Bar` and `foo-bar` are one package. */
function pyName(n: string): string {
    return n.toLowerCase().replace(/[-_.]+/g, '-');
}

function json(text: string): Record<string, unknown> | null {
    try {
        const v = JSON.parse(text) as unknown;
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function keys(v: unknown): string[] {
    return v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : [];
}

/** `[section]` → its lines, for the flat TOML tables manifests use. */
function tomlSections(text: string): Map<string, string[]> {
    const out = new Map<string, string[]>();
    let cur = '';
    out.set(cur, []);
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, '').trimEnd();
        const head = /^\s*\[\s*([^\]]+?)\s*\]\s*$/.exec(line);
        if (head) {
            cur = head[1] as string;
            if (!out.has(cur)) out.set(cur, []);
            continue;
        }
        out.get(cur)?.push(line);
    }
    return out;
}

function tomlKeys(lines: readonly string[] | undefined): string[] {
    const out: string[] = [];
    for (const l of lines ?? []) {
        const m = /^\s*([A-Za-z0-9_.-]+|"[^"]+")\s*=/.exec(l);
        if (m) out.push((m[1] as string).replace(/^"|"$/g, ''));
    }
    return out;
}

function tomlString(lines: readonly string[] | undefined, key: string): string | null {
    for (const l of lines ?? []) {
        const m = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`).exec(l);
        if (m) return m[1] as string;
    }
    return null;
}

/** The quoted entries of a TOML array that may span lines (`dependencies = [ … ]`). */
function tomlArray(lines: readonly string[] | undefined, key: string): string[] {
    const body = (lines ?? []).join('\n');
    const m = new RegExp(`^\\s*${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm').exec(body);
    if (!m) return [];
    return [...(m[1] as string).matchAll(/["']([^"']+)["']/g)].map((x) => x[1] as string);
}

function parse(rel: string, text: string, facts: ManifestFacts): void {
    const name = path.posix.basename(rel);
    const dec = (ecosystem: Ecosystem, pkg: string): void => {
        if (pkg) facts.declares.push({ ecosystem, package: pkg, manifest: rel });
    };
    const pub = (ecosystem: Ecosystem, pkg: unknown): void => {
        if (typeof pkg === 'string' && pkg) facts.publishes.push({ ecosystem, package: pkg });
    };
    if (name === 'package.json') {
        const j = json(text);
        if (!j) return;
        pub('npm', j['name']);
        for (const f of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) for (const k of keys(j[f])) dec('npm', k);
    } else if (name === 'composer.json') {
        const j = json(text);
        if (!j) return;
        pub('composer', typeof j['name'] === 'string' ? j['name'].toLowerCase() : null);
        for (const f of ['require', 'require-dev']) {
            for (const k of keys(j[f])) if (k !== 'php' && !k.startsWith('ext-') && !k.startsWith('lib-')) dec('composer', k.toLowerCase());
        }
    } else if (name === 'pyproject.toml') {
        const s = tomlSections(text);
        const own = tomlString(s.get('project'), 'name') ?? tomlString(s.get('tool.poetry'), 'name');
        if (own) pub('pypi', pyName(own));
        for (const d of tomlArray(s.get('project'), 'dependencies')) {
            const m = PY_NAME.exec(d);
            if (m) dec('pypi', pyName(m[1] as string));
        }
        for (const sec of ['tool.poetry.dependencies', 'tool.poetry.dev-dependencies', 'tool.poetry.group.dev.dependencies']) {
            for (const k of tomlKeys(s.get(sec))) if (k !== 'python') dec('pypi', pyName(k));
        }
    } else if (/^requirements[\w.-]*\.txt$/.test(name)) {
        for (const line of text.split(/\r?\n/)) {
            const l = line.replace(/#.*$/, '').trim();
            if (!l || l.startsWith('-')) continue;
            const m = PY_NAME.exec(l);
            if (m) dec('pypi', pyName(m[1] as string));
        }
    } else if (name === 'go.mod') {
        let block = false;
        for (const raw of text.split(/\r?\n/)) {
            const l = raw.replace(/\/\/.*$/, '').trim();
            const mod = /^module\s+(\S+)/.exec(l);
            if (mod) pub('go', mod[1]);
            if (/^require\s*\($/.test(l)) {
                block = true;
                continue;
            }
            if (block && l === ')') {
                block = false;
                continue;
            }
            const req = block ? /^(\S+)\s+\S+/.exec(l) : /^require\s+(\S+)\s+\S+/.exec(l);
            if (req) dec('go', req[1] as string);
        }
    } else if (name === 'Cargo.toml') {
        const s = tomlSections(text);
        pub('cargo', tomlString(s.get('package'), 'name'));
        for (const sec of ['dependencies', 'dev-dependencies', 'build-dependencies']) for (const k of tomlKeys(s.get(sec))) dec('cargo', k);
    } else if (name === 'Gemfile') {
        for (const m of text.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)) dec('rubygems', m[1] as string);
    }
}

function dedupe<T>(rows: T[]): T[] {
    const seen = new Set<string>();
    return rows.filter((r) => {
        const k = JSON.stringify(r);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

export function manifestFacts(root: string): ManifestFacts {
    const facts: ManifestFacts = { declares: [], publishes: [] };
    const probe = readProjectProbe(root);
    const texts = new Map(probe.manifests);
    for (const rel of probe.paths) {
        if (path.posix.basename(rel) !== 'Cargo.toml') continue;
        try {
            texts.set(rel, fs.readFileSync(path.join(root, rel), 'utf-8'));
        } catch {
            /* unreadable: no rows */
        }
    }
    for (const [rel, text] of [...texts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) parse(rel, text, facts);
    return { declares: dedupe(facts.declares), publishes: dedupe(facts.publishes) };
}
