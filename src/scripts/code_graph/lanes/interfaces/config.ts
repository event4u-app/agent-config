/**
 * Configuration NAMES the interface lane binds services to.
 *
 * Reads `config/*.php` (`'url' => env('PARTNER_URL')`), Spring
 * `application.{yml,yaml,properties}` placeholders (`${PARTNER_URL}`) and the
 * variable names of `.env.example`-style files, whose witness hashes the name
 * alone because the name is all that was kept. A value is never kept: an env
 * default, a property's literal value and everything right of `=` in an
 * example file are dropped where they are read. `.env` itself is never opened.
 */
import { spanHash, type Witness } from '../lane_fact.js';
import { SourceText } from './text.js';

export interface ConfigEntry {
    /** dotted key as code reads it: `services.partner.url` */
    key: string;
    env: string;
    witness: Witness;
}

export interface ConfigIndex {
    byKey: Map<string, ConfigEntry>;
    /** names declared in `.env.example` and siblings */
    exampleNames: Map<string, Witness>;
}

export const EXAMPLE_ENV_FILE = /(^|\/)\.env\.(?:example|dist|sample|template)$/;

/** True for a file this lane must never open: `.env`, `.env.local`, `.env.production`, … */
export function isSecretEnvFile(rel: string): boolean {
    const base = rel.slice(rel.lastIndexOf('/') + 1);
    return /^\.env(?:\..+)?$/.test(base) && !EXAMPLE_ENV_FILE.test(rel);
}

export function emptyConfig(): ConfigIndex {
    return { byKey: new Map(), exampleNames: new Map() };
}

export function readLaravelConfig(rel: string, text: string, into: ConfigIndex): void {
    const m = /(?:^|\/)config\/([\w-]+)\.php$/.exec(rel);
    if (!m) return;
    const src = new SourceText(rel, text);
    const stack: string[] = [m[1] as string];
    const opened: boolean[] = [];
    src.lines.forEach((line, i) => {
        const t = line.replace(/\/\/.*$|#.*$/, '');
        const group = /['"]([\w.-]+)['"]\s*=>\s*(?:\[|array\s*\()\s*$/.exec(t.trim());
        if (group) {
            stack.push(group[1] as string);
            opened.push(true);
            return;
        }
        const leaf = /['"]([\w.-]+)['"]\s*=>\s*env\(\s*['"]([A-Z][A-Z0-9_]*)['"]/.exec(t);
        if (leaf) {
            const key = [...stack, leaf[1] as string].join('.');
            into.byKey.set(key, { key, env: leaf[2] as string, witness: src.witnessAtLine(i + 1) });
        }
        const closes = (t.match(/^\s*[\])]\s*,?\s*$/) ?? []).length;
        for (let c = 0; c < closes && opened.length; c++) {
            opened.pop();
            stack.pop();
        }
    });
}

export function readSpringConfig(rel: string, text: string, into: ConfigIndex): void {
    if (!/(?:^|\/)application(?:-[\w]+)?\.(?:ya?ml|properties)$/.test(rel)) return;
    const src = new SourceText(rel, text);
    const path: { indent: number; key: string }[] = [];
    src.lines.forEach((line, i) => {
        if (/^\s*(?:#|$)/.test(line)) return;
        let key: string;
        let rest: string;
        if (rel.endsWith('.properties')) {
            const m = /^\s*([\w.-]+)\s*[=:]\s*(.*)$/.exec(line);
            if (!m) return;
            key = m[1] as string;
            rest = m[2] as string;
        } else {
            const m = /^(\s*)([\w.-]+)\s*:\s*(.*)$/.exec(line);
            if (!m) return;
            const indent = (m[1] as string).length;
            while (path.length && (path[path.length - 1] as { indent: number }).indent >= indent) path.pop();
            path.push({ indent, key: m[2] as string });
            key = path.map((p) => p.key).join('.');
            rest = m[3] as string;
        }
        const env = /\$\{([A-Z][A-Z0-9_]*)(?::[^}]*)?\}/.exec(rest);
        if (env) into.byKey.set(key, { key, env: env[1] as string, witness: src.witnessAtLine(i + 1) });
    });
}

export function readExampleEnvNames(rel: string, text: string, into: ConfigIndex): void {
    if (!EXAMPLE_ENV_FILE.test(rel)) return;
    text.split('\n').forEach((line, i) => {
        const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
        if (!m) return;
        const name = m[1] as string;
        if (!into.exampleNames.has(name)) {
            into.exampleNames.set(name, { file: rel, line: i + 1, hash: spanHash(name) });
        }
    });
}

/** Service a config key points at: `services.partner.url` → `partner`, `erp.url` → `erp`. */
export function serviceFromConfigKey(key: string): string {
    const parts = key.split('.');
    if (parts[0] === 'services' && parts.length >= 2) return parts[1] as string;
    if (parts.length >= 2) return parts.slice(0, -1).join('.');
    return parts[0] as string;
}

/** Every config entry in the same group as `key` (`services.partner.*`). */
export function siblingEntries(index: ConfigIndex, key: string): ConfigEntry[] {
    const prefix = key.slice(0, key.lastIndexOf('.') + 1);
    return [...index.byKey.values()].filter((e) => e.key.startsWith(prefix) && !e.key.slice(prefix.length).includes('.'));
}
