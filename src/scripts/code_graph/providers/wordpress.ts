/**
 * WordPress: hooks and theme parts, which no import or call states.
 *
 *   add_action('init', 'cb') · add_filter(…)       route `HOOK init` --routes-to--> the callback
 *   add_shortcode('card', 'cb')                    route `SHORTCODE card` --routes-to--> the callback
 *   get_template_part('parts/card'[, 'wide'])       caller --renders--> parts/card(-wide).php
 *
 * A hook name is no URL, so its route path is the name as written, without the
 * leading slash an HTTP route carries. A callback resolves as a function of the
 * same file, else the one function of that name in the tree; `[$this, 'm']`
 * resolves to the enclosing class's method, `[X::class, 'm']` to X's method
 * only when X is the class the file's namespace names. A closure, a dynamic
 * hook name or an ambiguous function gets no edge. `do_action` fires a hook and
 * declares nothing.
 *
 * Detection: a `wp-config.php` marker, a composer manifest requiring a
 * WordPress core package or a wpackagist plugin/theme, or a composer manifest
 * whose `type` is a WordPress plugin, theme or must-use plugin. A plugin or theme
 * shipping no composer manifest carries no signal and stays undetected.
 */
import * as path from 'node:path';

import type { CodeNode } from '../types.js';
import { markerRoots, union } from './shared/detect.js';
import { type Kit, lineIndex, makeKit } from './shared/kit.js';
import { classNode, phpScope, qualify, shortName } from './shared/php.js';
import type { ConventionProvider, ProjectProbe } from './types.js';
import type { ResolutionConfig } from '../resolution_tiers.js';

const CORE = /^(?:johnpbloch\/wordpress(?:-core)?|roots\/wordpress(?:-no-content)?|roots\/bedrock|wpackagist-(?:plugin|theme)\/.+)$/;
const TYPES = new Set(['wordpress-plugin', 'wordpress-theme', 'wordpress-muplugin']);

function detectWordpress(probe: ProjectProbe): string[] {
    const roots: string[] = [];
    for (const [p, text] of probe.manifests) {
        if (path.posix.basename(p) !== 'composer.json') continue;
        try {
            const j = JSON.parse(text) as { name?: string; type?: string; require?: Record<string, string>; 'require-dev'?: Record<string, string> };
            const deps = [...Object.keys(j.require ?? {}), ...Object.keys(j['require-dev'] ?? {})];
            if (TYPES.has(j.type ?? '') || j.name === 'roots/bedrock' || deps.some((d) => CORE.test(d))) {
                const d = path.posix.dirname(p);
                roots.push(d === '.' ? '' : d);
            }
        } catch {
            continue;
        }
    }
    return union(roots, markerRoots(probe, 'wp-config.php'));
}

const REGISTRATION = /\b(?<fn>add_action|add_filter|add_shortcode)\(\s*(['"])(?<name>[\w\-/.:]+)\2\s*,\s*/g;

function callback(kit: Kit, file: string, src: string, at: number, line: number, functions: Map<string, CodeNode[]>, resolution: ResolutionConfig): string | null {
    const rest = src.slice(at, at + 300);
    const fn = /^(['"])\\?(?:[\w\\]+\\)?(?<name>\w+)\1/.exec(rest)?.groups?.['name'];
    if (fn) {
        const local = (functions.get(fn) ?? []).filter((n) => n.source_file === file);
        if (local.length === 1) return (local[0] as CodeNode).id;
        const all = functions.get(fn) ?? [];
        return all.length === 1 ? (all[0] as CodeNode).id : null;
    }
    const pair = /^(?:\[|array\()\s*(?<recv>\$this|self::class|static::class|__CLASS__|[\\\w]+::class|(['"])[\\\w]+\2)\s*,\s*(['"])(?<member>\w+)\3/.exec(rest);
    if (!pair?.groups) return null;
    const recv = pair.groups['recv'] as string;
    const member = pair.groups['member'] as string;
    let cls: string | null = null;
    if (/^(?:\$this|self::class|static::class|__CLASS__)$/.test(recv)) cls = kit.classAt(file, line)?.id ?? null;
    else {
        const ref = recv.replace(/::class$/, '').replace(/^['"]|['"]$/g, '');
        const fq = /^['"]/.test(recv) ? ref.replace(/^\\/, '') : qualify(ref, phpScope(src));
        cls = classNode(kit, fq, resolution) ?? classByNamespace(kit, fq);
    }
    return cls ? kit.methodOf(cls, member) : null;
}

/** The one class node whose short name and declaring file's namespace spell `fq`. */
function classByNamespace(kit: Kit, fq: string): string | null {
    const short = shortName(fq);
    const hits = [...kit.nodeById.values()].filter((n) => {
        if (n.kind !== 'class' || n.label !== short) return false;
        const f = kit.files.find((x) => x.path === n.source_file);
        const ns = f ? phpScope(f.source).namespace : '';
        return (ns ? `${ns}\\${short}` : short) === fq;
    });
    return hits.length === 1 ? (hits[0] as CodeNode).id : null;
}

/** `slug[-name].php`, preferring a part under a directory that holds the calling file (its theme). */
function templatePart(kit: Kit, caller: string, slug: string, name: string | undefined): string | null {
    for (const rel of name ? [`${slug}-${name}.php`, `${slug}.php`] : [`${slug}.php`]) {
        const hits = kit.paths.filter((p) => p === rel || p.endsWith(`/${rel}`));
        const own = hits.filter((p) => caller.startsWith(p.slice(0, p.length - rel.length)));
        if (own.length === 1) return own[0] as string;
        if (own.length === 0 && hits.length === 1) return hits[0] as string;
    }
    return null;
}

export const wordpressProvider: ConventionProvider = {
    id: 'wordpress',
    markers: ['wp-config.php'],
    detect: detectWordpress,
    build: (input) => {
        const kit = makeKit(input);
        const functions = new Map<string, CodeNode[]>();
        for (const n of input.baseNodes) {
            if (n.kind !== 'function' || !n.source_file.endsWith('.php')) continue;
            functions.set(n.label, [...(functions.get(n.label) ?? []), n]);
        }
        for (const f of kit.filesWithExt('.php')) {
            const at = lineIndex(f.source);
            for (const m of f.source.matchAll(REGISTRATION)) {
                const line = at(m.index as number);
                const verb = m.groups?.['fn'] === 'add_shortcode' ? 'SHORTCODE' : 'HOOK';
                const id = kit.route(f.path, verb, m.groups?.['name'] as string, line);
                const target = callback(kit, f.path, f.source, (m.index as number) + m[0].length, line, functions, input.resolution);
                if (target) kit.emit(id, target, 'routes-to', 'route-table');
            }
            for (const m of f.source.matchAll(/\bget_template_part\(\s*(['"])(?<slug>[\w\-/]+)\1\s*(?:,\s*(['"])(?<name>[\w-]+)\3)?/g)) {
                const target = templatePart(kit, f.path, m.groups?.['slug'] as string, m.groups?.['name']);
                if (!target) continue;
                kit.fileNode(target);
                kit.emit(kit.enclosing(f.path, at(m.index as number)), target, 'renders', 'directive-scan');
            }
        }
        return kit.result();
    },
};
