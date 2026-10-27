/**
 * Composer's autoload maps and PHP `use` statements, read as data (K6: nothing
 * is executed, no package manager runs). `vendor/composer/autoload_*.php` and
 * `installed.json` say which class or namespace a package provides; a file maps
 * to a package by the package's install path.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface ComposerAutoload {
    /** fully qualified class → package name (classmap) */
    classOwner: Map<string, string>;
    /** namespace prefix with trailing `\` → package name (PSR-4 and PSR-0) */
    namespaces: Array<[string, string]>;
    /** packages that register autoload files */
    files: Set<string>;
    /** `complete` read from `vendor/`; `partial` when there is no `vendor/` to read */
    state: 'complete' | 'partial';
}

const unescape = (s: string): string => s.replace(/\\\\/g, '\\');

function readText(root: string, rel: string): string | null {
    try {
        return fs.readFileSync(path.join(root, rel), 'utf-8');
    } catch {
        return null;
    }
}

/** The autoload maps of `root`'s `vendor/composer/`, or `null` when there is no `installed.json`. */
export function readComposerAutoload(root: string): ComposerAutoload | null {
    const installed = readText(root, 'vendor/composer/installed.json');
    if (installed === null) return null;
    let doc: { packages?: Array<{ name?: string; 'install-path'?: string }> } | Array<{ name?: string; 'install-path'?: string }>;
    try {
        doc = JSON.parse(installed);
    } catch {
        return null;
    }
    const list = Array.isArray(doc) ? doc : (doc.packages ?? []);
    // An install path is relative to vendor/composer/; a composer 1 list without one sits at vendor/<name>.
    const dirs: Array<[string, string]> = list
        .filter((p): p is { name: string; 'install-path'?: string } => typeof p?.name === 'string')
        .map((p) => [path.posix.normalize(path.posix.join('vendor/composer', p['install-path'] ?? `../${p.name}`)), p.name] as [string, string])
        .sort((a, b) => b[0].length - a[0].length);
    const owner = (file: string): string | undefined => dirs.find(([d]) => file === d || file.startsWith(`${d}/`))?.[1];
    const vendorPath = (expr: string): string | null => {
        const m = /\$vendorDir\s*\.\s*'([^']*)'/.exec(expr);
        return m ? path.posix.normalize(`vendor${m[1]}`) : null;
    };
    const out: ComposerAutoload = { classOwner: new Map(), namespaces: [], files: new Set(), state: 'complete' };
    for (const line of (readText(root, 'vendor/composer/autoload_classmap.php') ?? '').split('\n')) {
        const m = /^\s*'((?:[^'\\]|\\.)+)'\s*=>\s*(.+?),?\s*$/.exec(line);
        const file = m ? vendorPath(m[2] as string) : null;
        const pkg = file ? owner(file) : undefined;
        if (m && pkg) out.classOwner.set(unescape(m[1] as string), pkg);
    }
    for (const map of ['autoload_psr4.php', 'autoload_namespaces.php']) {
        for (const line of (readText(root, `vendor/composer/${map}`) ?? '').split('\n')) {
            const m = /^\s*'((?:[^'\\]|\\.)*)'\s*=>\s*array\((.+)\),?\s*$/.exec(line);
            const file = m ? vendorPath(m[2] as string) : null;
            const pkg = file ? owner(file) : undefined;
            if (m && pkg) out.namespaces.push([unescape(m[1] as string), pkg]);
        }
    }
    for (const line of (readText(root, 'vendor/composer/autoload_files.php') ?? '').split('\n')) {
        const file = /=>\s*(.+?),?\s*$/.exec(line) ? vendorPath(line) : null;
        const pkg = file ? owner(file) : undefined;
        if (pkg) out.files.add(pkg);
    }
    out.namespaces.sort((a, b) => b[0].length - a[0].length);
    return out;
}

export interface PhpClassRef {
    /** fully qualified, without a leading `\` */
    name: string;
    line: number;
}

/**
 * The classes a PHP file names outside its own namespace: every `use` import
 * (aliases and group uses resolved to the imported name; `function` and `const`
 * imports left out) and every fully qualified `\Name` in code. A root-namespace
 * `use Dompdf;` is a class name, never a package specifier.
 */
export function phpClassRefs(text: string): PhpClassRef[] {
    const out: PhpClassRef[] = [];
    const lineAt = (i: number): number => text.slice(0, i).split('\n').length;
    for (const m of text.matchAll(/^\s*use\s+(?!function\b|const\b)([^;]+);/gm)) {
        const body = (m[1] as string).trim();
        const at = lineAt(m.index ?? 0);
        const group = /^([\w\\]+)\\\{([^}]*)\}$/.exec(body);
        const parts = group ? (group[2] as string).split(',').map((p) => `${group[1]}\\${p.trim()}`) : body.split(',');
        for (const p of parts) {
            const name = p.trim().replace(/\s+as\s+\w+$/i, '').replace(/^\\/, '');
            if (/^[A-Za-z_][\w\\]*$/.test(name)) out.push({ name, line: at });
        }
    }
    const code = text.replace(/^\s*(?:use|namespace)\s[^;]+;/gm, '');
    for (const m of code.matchAll(/(?<![\w\\$])\\([A-Za-z_]\w*(?:\\[A-Za-z_]\w*)*)(?=\s*(?:\(|::|\s+\$|\)))/g)) {
        out.push({ name: m[1] as string, line: lineAt(text.indexOf(m[0])) });
    }
    return out;
}

/** The package a fully qualified class comes from: its classmap entry, else the longest namespace prefix. */
export function phpOwner(name: string, a: Pick<ComposerAutoload, 'classOwner' | 'namespaces'>): string | undefined {
    return a.classOwner.get(name) ?? a.namespaces.find(([ns]) => `${name}\\`.startsWith(ns) && ns !== '')?.[1];
}
