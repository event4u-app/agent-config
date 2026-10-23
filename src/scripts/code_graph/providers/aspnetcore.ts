/**
 * ASP.NET Core, read by its conventions:
 *
 *   routing     `[HttpGet("x")]` / `[HttpPost]` / `[Route("x")]` on an action,
 *               under a class `[Route("api/[controller]")]` → route --routes-to--> the action;
 *               `app.MapGet("/x", Handler)` → the handler when it is a method group
 *   EF Core     `DbSet<User> Users` in a `DbContext` → User --persists--> table:Users
 *               (`[Table("x")]` on the entity wins)
 *   views       `View()` / `View("Name")` in a controller action
 *               → `Views/<Controller>/<Name or action>.cshtml`, else `Views/Shared/`
 *   DI          a constructor parameter typed as an in-repo class or interface → injects
 *
 * Not followed: conventional routing tables (`MapControllerRoute`), a view named
 * by a variable or `View(model)`, primary constructors, and a type name two
 * in-repo declarations share — each gets no edge rather than a guess.
 */
import * as path from 'node:path';

import type { CodeNode } from '../types.js';
import { dotnetRoots } from './shared/detect.js';
import { callRoutes, joinRoute, lastArgName } from './shared/extractors.js';
import { escapeRe, type Kit, lineIndex, makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const ATTR =
    /[[,]\s*(?<attr>Http(?:Get|Post|Put|Patch|Delete|Head|Options)|Route)(?:Attribute)?\b(?:\s*\(\s*(?:template\s*:\s*)?"(?<path>[^"]*)"[^)]*\))?/g;

/** In-repo types by simple name, kept only when the name is declared once. */
function uniqueTypes(kit: Kit): Map<string, CodeNode> {
    const seen = new Map<string, CodeNode | null>();
    for (const n of kit.nodeById.values()) {
        if (!n.source_file.endsWith('.cs') || (n.kind !== 'class' && n.kind !== 'interface')) continue;
        seen.set(n.label, seen.has(n.label) ? null : n);
    }
    const out = new Map<string, CodeNode>();
    for (const [k, v] of seen) if (v) out.set(k, v);
    return out;
}

const controllerName = (cls: CodeNode): string => cls.label.replace(/Controller$/, '');

function attributeRoutes(kit: Kit): void {
    for (const f of kit.filesWithExt('.cs')) {
        const at = lineIndex(f.source);
        const prefixes = new Map<string, string>();
        const actions = new Map<string, { node: CodeNode; line: number; verbs: Array<{ verb: string; path?: string }>; routes: string[] }>();
        for (const m of f.source.matchAll(ATTR)) {
            const line = at(m.index as number);
            const attr = m.groups?.['attr'] as string;
            const tpl = m.groups?.['path'];
            const owner = kit.enclosing(f.path, line);
            const method = owner === f.path ? null : kit.nodeById.get(owner);
            if (!method) {
                const cls = kit.classAt(f.path, line);
                if (cls && attr === 'Route' && tpl !== undefined) prefixes.set(cls.id, tpl);
                continue;
            }
            const a = actions.get(method.id) ?? { node: method, line, verbs: [], routes: [] };
            if (attr === 'Route') {
                if (tpl !== undefined) a.routes.push(tpl);
            } else a.verbs.push({ verb: attr.slice(4).toUpperCase(), ...(tpl !== undefined ? { path: tpl } : {}) });
            actions.set(method.id, a);
        }
        for (const a of actions.values()) {
            const cls = kit.classAt(f.path, a.node.source_location[0] as number);
            const prefix = cls ? prefixes.get(cls.id) : undefined;
            const pairs: Array<[string, string | undefined]> = [];
            for (const v of a.verbs) {
                if (v.path !== undefined) pairs.push([v.verb, v.path]);
                else if (a.routes.length > 0) for (const r of a.routes) pairs.push([v.verb, r]);
                else pairs.push([v.verb, undefined]);
            }
            if (a.verbs.length === 0) for (const r of a.routes) pairs.push(['ANY', r]);
            for (const [verb, tpl] of pairs) {
                const absolute = tpl !== undefined && /^~?\//.test(tpl);
                const raw = absolute ? joinRoute(tpl.replace(/^~/, '')) : joinRoute(prefix, tpl);
                const routePath = raw
                    .replace(/\[controller\]/gi, cls ? controllerName(cls) : '[controller]')
                    .replace(/\[action\]/gi, a.node.label);
                kit.emit(kit.route(f.path, verb, routePath, a.line), a.node.id, 'routes-to', 'route-table');
            }
        }
    }
}

function minimalApi(kit: Kit, types: Map<string, CodeNode>): void {
    callRoutes(kit, {
        exts: ['.cs'],
        call: /\b\w+\s*\.\s*Map(?<verb>Get|Post|Put|Patch|Delete)\(\s*"(?<path>[^"]*)"\s*,(?=(?<rest>[\s\S]{0,300}))/g,
        handler: (_k, file, rest) => {
            const name = lastArgName(rest);
            if (!name) return null;
            const [head, member] = name.split('.') as [string, string | undefined];
            if (member) {
                const cls = types.get(head);
                return cls ? kit.methodOf(cls.id, member) : null;
            }
            const local = kit.nodesInFile(file).filter((n) => n.label === head && (n.kind === 'method' || n.kind === 'function'));
            return local.length === 1 ? (local[0] as CodeNode).id : null;
        },
    });
}

function entities(kit: Kit, types: Map<string, CodeNode>): void {
    const sourceOf = new Map(kit.files.map((f) => [f.path, f.source] as const));
    for (const f of kit.filesWithExt('.cs')) {
        if (!/\bclass\s+\w+[^{;]*:\s*[^{;]*\bDbContext\b/.test(f.source)) continue;
        const at = lineIndex(f.source);
        for (const m of f.source.matchAll(/\bDbSet<\s*(?:[\w.]+\.)?(?<entity>\w+)\s*>\s+(?<prop>\w+)/g)) {
            const entity = types.get(m.groups?.['entity'] as string);
            if (!entity || entity.kind !== 'class') continue;
            const lines = (sourceOf.get(entity.source_file) ?? '').split('\n');
            const start = entity.source_location[0] as number;
            const head = lines.slice(start - 1, start + 5).join('\n').split(/\bclass\b/)[0] ?? '';
            const explicit = /\[\s*Table\s*\(\s*"(?<name>[^"]+)"/.exec(head)?.groups?.['name'];
            const table = kit.table(explicit ?? (m.groups?.['prop'] as string), f.path, at(m.index as number));
            kit.emit(entity.id, table, 'persists', 'schema-call');
        }
    }
}

function views(kit: Kit): void {
    const inventory = new Set(kit.paths);
    for (const f of kit.filesWithExt('.cs')) {
        const at = lineIndex(f.source);
        for (const m of f.source.matchAll(/\b(?:Partial)?View\(\s*(?:"(?<name>[^"]+)"\s*)?[,)]/g)) {
            const line = at(m.index as number);
            const owner = kit.enclosing(f.path, line);
            const action = owner === f.path ? null : kit.nodeById.get(owner);
            const cls = action ? kit.classAt(f.path, line) : null;
            if (!action || !cls || !cls.label.endsWith('Controller')) continue;
            const name = m.groups?.['name'] ?? action.label;
            const candidates: string[] = [];
            for (const root of kit.roots) {
                if (/^~?\//.test(name)) candidates.push(path.posix.join(root, name.replace(/^~?\//, '')));
                else {
                    const file = name.endsWith('.cshtml') ? name : `${name}.cshtml`;
                    candidates.push(path.posix.join(root, 'Views', controllerName(cls), file), path.posix.join(root, 'Views', 'Shared', file));
                }
            }
            const target = candidates.find((c) => inventory.has(c));
            if (!target) continue;
            kit.fileNode(target);
            kit.emit(action.id, target, 'renders', 'directive-scan');
        }
    }
}

function injection(kit: Kit, types: Map<string, CodeNode>): void {
    const sourceOf = new Map(kit.files.map((f) => [f.path, f.source] as const));
    for (const n of kit.nodeById.values()) {
        if (n.kind !== 'method' || !n.source_file.endsWith('.cs')) continue;
        const clsId = n.id.split('::').slice(0, -1).join('::');
        const cls = kit.nodeById.get(clsId);
        if (!cls || cls.kind !== 'class' || cls.label !== n.label) continue;
        const lines = (sourceOf.get(n.source_file) ?? '').split('\n');
        const start = n.source_location[0] as number;
        const decl = lines.slice(start - 1, (n.source_location[2] as number) ?? start).join('\n');
        const params = new RegExp(`\\b${escapeRe(n.label)}\\s*\\(([^)]*)\\)`).exec(decl)?.[1] ?? '';
        for (const p of params.split(',')) {
            const t = /(?:^|\s)(?:[\w.]+\.)?(?<type>[A-Za-z_]\w*)\s*(?:<[^>]*>)?\??\s+\w+\s*(?:=.*)?$/.exec(p.trim())?.groups?.['type'];
            const target = t ? types.get(t) : undefined;
            if (target && target.id !== cls.id) kit.emit(cls.id, target.id, 'injects', 'di-binding');
        }
    }
}

export const aspnetcoreProvider: ConventionProvider = {
    id: 'aspnetcore',
    detect: (probe) => dotnetRoots(probe, /Sdk\s*=\s*"Microsoft\.NET\.Sdk\.Web"|Include\s*=\s*"Microsoft\.AspNetCore\./),
    build: (input) => {
        const kit = makeKit(input);
        const types = uniqueTypes(kit);
        attributeRoutes(kit);
        minimalApi(kit, types);
        entities(kit, types);
        views(kit);
        injection(kit, types);
        return kit.result();
    },
    roleOf: (p) => (p.endsWith('.cshtml') ? 'view' : path.posix.basename(p) === 'Program.cs' ? 'entry' : undefined),
};
