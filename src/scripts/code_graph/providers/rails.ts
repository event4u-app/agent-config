/**
 * Ruby on Rails: the links a Rails application makes by convention.
 *
 *   config/routes.rb   get '/x', to: 'users#index' · post 'x' => 'users#create'
 *                      · root 'pages#home' · resources :users, only:/except:
 *                      · namespace :admin do … end         route --routes-to--> the action
 *   app/models         class User < ApplicationRecord     class --persists--> table:users
 *                      self.table_name = "t" wins; a subclass of a model shares its table (STI)
 *   app/models         has_many / has_one / belongs_to (class_name: wins)   class --relates--> model
 *   db/migrate         create_table :t                    file  --migrates--> table:t
 *   a controller action  app/views/<controller>/<action>.*   action --renders--> the view
 *
 * `resources` expands into the seven REST actions the controller actually
 * defines, within `only:` / `except:`; an explicit route keeps its node when
 * the action is missing. The table name is the class in snake_case, pluralised
 * by the common English rules plus Rails' irregulars; an `inflections` file is
 * not read. Not followed: `resource` (singular), nested `resources` blocks,
 * `scope` / `constraints`, `concerns`, an explicit `render`, and a model
 * outside `app/models`.
 */
import * as path from 'node:path';

import type { CodeNode } from '../types.js';
import { gemRoots } from './shared/detect.js';
import { joinRoute } from './shared/extractors.js';
import { type Kit, lineIndex, makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const REST: ReadonlyArray<[action: string, verb: string, suffix: string]> = [
    ['index', 'GET', ''],
    ['new', 'GET', 'new'],
    ['create', 'POST', ''],
    ['show', 'GET', ':id'],
    ['edit', 'GET', ':id/edit'],
    ['update', 'PATCH', ':id'],
    ['destroy', 'DELETE', ':id'],
];
const IRREGULAR: Readonly<Record<string, string>> = { person: 'people', man: 'men', woman: 'women', child: 'children', mouse: 'mice' };
const VERB_ROUTE = /^\s*(get|post|put|patch|delete)\s+['"]([^'"]*)['"]\s*(?:,\s*to:\s*|=>\s*)['"](\w[\w/]*)#(\w+)['"]/;
const ROOT_ROUTE = /^\s*root\s+(?:to:\s*)?['"](\w[\w/]*)#(\w+)['"]/;
const RESOURCES = /^\s*resources\s+:(\w+)(.*)$/;
const NAMESPACE = /^\s*namespace\s+:(\w+)\s+do\b/;
const OPENS_BLOCK = /\bdo(\s*\|[^|]*\|)?\s*$/;

function snake(name: string): string {
    return name.replace(/([a-z\d])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase();
}

function pluralize(word: string): string {
    const head = word.slice(0, word.lastIndexOf('_') + 1);
    const last = word.slice(head.length);
    if (IRREGULAR[last]) return head + IRREGULAR[last];
    if (/[^aeiou]y$/.test(last)) return head + last.slice(0, -1) + 'ies';
    if (/(s|x|z|ch|sh)$/.test(last)) return head + last + 'es';
    return head + last + 's';
}

function singularize(word: string): string {
    for (const [one, many] of Object.entries(IRREGULAR)) if (word === many) return one;
    if (/ies$/.test(word)) return word.slice(0, -3) + 'y';
    if (/(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
    return word.endsWith('s') ? word.slice(0, -1) : word;
}

function camel(snakeName: string): string {
    return snakeName.replace(/(^|_)([a-z\d])/g, (_m, _s, c: string) => c.toUpperCase());
}

/** The action method of the controller `ctrl` (`admin/reports`) under `root`, if the controller defines it. */
function action(kit: Kit, root: string, ctrl: string, name: string): CodeNode | null {
    const file = path.posix.join(root, 'app/controllers', `${ctrl}_controller.rb`);
    return kit.nodesInFile(file).find((n) => n.kind === 'method' && n.label === name) ?? null;
}

function routes(kit: Kit, root: string): void {
    const file = path.posix.join(root, 'config/routes.rb');
    const src = kit.files.find((f) => f.path === file)?.source;
    if (src === undefined) return;
    // One frame per open `do` block: a namespace adds a path and a controller
    // directory; any other block only keeps `end` balanced.
    const frames: Array<string | null> = [];
    const ns = (): string[] => frames.filter((f): f is string => f !== null);
    const declare = (verb: string, routePath: string, ctrl: string, act: string, line: number, keepWithoutAction: boolean): void => {
        const target = action(kit, root, [...ns(), ctrl].join('/'), act);
        if (!target && !keepWithoutAction) return;
        const id = kit.route(file, verb, joinRoute(...ns(), routePath), line);
        if (target) kit.emit(id, target.id, 'routes-to', 'route-table');
    };
    src.split('\n').forEach((raw, i) => {
        const line = i + 1;
        // Whole-line comments only: `#` is also the controller#action separator.
        if (/^\s*#/.test(raw)) return;
        const text = raw;
        if (/^\s*end\b/.test(text)) {
            frames.pop();
            return;
        }
        let m = NAMESPACE.exec(text);
        if (m) {
            frames.push(m[1] as string);
            return;
        }
        if ((m = ROOT_ROUTE.exec(text))) declare('GET', '/', m[1] as string, m[2] as string, line, true);
        else if ((m = VERB_ROUTE.exec(text))) declare((m[1] as string).toUpperCase(), m[2] as string, m[3] as string, m[4] as string, line, true);
        else if ((m = RESOURCES.exec(text))) {
            const name = m[1] as string;
            const opts = m[2] as string;
            const list = (key: string): string[] | null => {
                const hit = new RegExp(`\\b${key}:\\s*\\[([^\\]]*)\\]`).exec(opts) ?? new RegExp(`\\b${key}:\\s*:(\\w+)`).exec(opts);
                return hit ? [...(hit[1] as string).matchAll(/:?(\w+)/g)].map((x) => x[1] as string) : null;
            };
            const only = list('only');
            const except = list('except') ?? [];
            for (const [act, verb, suffix] of REST) {
                if ((only && !only.includes(act)) || except.includes(act)) continue;
                declare(verb, joinRoute(name, suffix), name, act, line, false);
            }
        }
        if (OPENS_BLOCK.test(text)) frames.push(null);
    });
}

function models(kit: Kit, root: string): void {
    const dir = path.posix.join(root, 'app/models') + '/';
    const files = kit.filesWithExt('.rb').filter((f) => f.path.startsWith(dir));
    const classes = files.flatMap((f) =>
        kit.nodesInFile(f.path).filter((n): n is CodeNode => n.kind === 'class').map((node) => {
            const head = f.source.split('\n')[(node.source_location[0] as number) - 1] ?? '';
            const parent = /<\s*([\w:]+)/.exec(head)?.[1]?.split('::').pop() ?? '';
            const span = f.source.split('\n').slice((node.source_location[0] as number) - 1, node.source_location[2] as number).join('\n');
            return { node, file: f, parent, span };
        }),
    );
    const byName = new Map(classes.map((c) => [c.node.label, c] as const));
    const tableOf = new Map<string, string | null>();
    const resolveTable = (name: string, seen: Set<string> = new Set()): string | null => {
        if (tableOf.has(name)) return tableOf.get(name) as string | null;
        const c = byName.get(name);
        if (!c || seen.has(name)) return null;
        seen.add(name);
        const explicit = /self\.table_name\s*=\s*['"]([^'"]+)['"]/.exec(c.span)?.[1];
        const abstract = /self\.abstract_class\s*=\s*true/.test(c.span);
        let table: string | null = null;
        if (explicit) table = explicit;
        else if (abstract) table = null;
        else if (c.parent === 'ApplicationRecord' || c.parent === 'Base') table = pluralize(snake(name));
        else if (byName.has(c.parent)) table = resolveTable(c.parent, seen);
        tableOf.set(name, table);
        return table;
    };
    for (const c of classes) {
        const table = resolveTable(c.node.label);
        if (table) kit.emit(c.node.id, kit.table(table, c.file.path, c.node.source_location[0] as number), 'persists', 'schema-call');
        for (const m of c.span.matchAll(/^\s*(has_many|has_one|belongs_to|has_and_belongs_to_many)\s+:(\w+)([^\n]*)/gm)) {
            const named = /class_name:\s*['"]([\w:]+)['"]/.exec(m[3] as string)?.[1]?.split('::').pop();
            const assoc = m[2] as string;
            const target = byName.get(named ?? camel(m[1] === 'has_many' || m[1] === 'has_and_belongs_to_many' ? singularize(assoc) : assoc));
            if (target && target.node.id !== c.node.id) kit.emit(c.node.id, target.node.id, 'relates', 'orm-relation');
        }
    }
}

function migrations(kit: Kit, root: string): void {
    const dir = path.posix.join(root, 'db/migrate') + '/';
    for (const f of kit.filesWithExt('.rb').filter((x) => x.path.startsWith(dir))) {
        const at = lineIndex(f.source);
        for (const m of f.source.matchAll(/\bcreate_table\s+(?::(\w+)|['"]([^'"]+)['"])/g)) {
            const table = (m[1] ?? m[2]) as string;
            kit.emit(f.path, kit.table(table, f.path, at(m.index as number)), 'migrates', 'schema-call');
        }
    }
}

function views(kit: Kit, root: string): void {
    const ctrlDir = path.posix.join(root, 'app/controllers') + '/';
    const viewDir = path.posix.join(root, 'app/views');
    for (const f of kit.filesWithExt('.rb').filter((x) => x.path.startsWith(ctrlDir) && x.path.endsWith('_controller.rb'))) {
        const ctrl = f.path.slice(ctrlDir.length, -'_controller.rb'.length);
        for (const n of kit.nodesInFile(f.path)) {
            if (n.kind !== 'method') continue;
            const prefix = `${viewDir}/${ctrl}/${n.label}.`;
            const hits = kit.paths.filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'));
            if (hits.length !== 1) continue;
            const target = hits[0] as string;
            kit.fileNode(target);
            kit.emit(n.id, target, 'renders', 'directive-scan');
        }
    }
}

export const railsProvider: ConventionProvider = {
    id: 'rails',
    detect: (probe) => gemRoots(probe, 'rails'),
    build: (input) => {
        const kit = makeKit(input);
        for (const root of kit.roots) {
            routes(kit, root);
            models(kit, root);
            migrations(kit, root);
            views(kit, root);
        }
        return kit.result();
    },
};
