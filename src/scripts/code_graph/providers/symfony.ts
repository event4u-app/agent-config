/**
 * Symfony: the links a Symfony application makes by attribute or convention.
 *
 *   #[Route('/x', methods: ['GET'])] · @Route("/x")   route --routes-to--> the method below it,
 *                                                       under the class-level `#[Route('/prefix')]`
 *   $this->render('a/b.html.twig')                     method --renders--> templates/a/b.html.twig
 *   #[ORM\Entity] (+ #[ORM\Table(name: 't')])          entity --persists--> table:t (default: snake_case short name)
 *   #[ORM\ManyToOne(targetEntity: X::class)] …          entity --relates--> X (else the property's type)
 *   migrations/*.php  $this->addSql('CREATE TABLE t')   migration --migrates--> table:t
 *   __construct(private Mailer $m)                     class --injects--> Mailer (an in-repo class only)
 *
 * Class references resolve through the file's `use` aliases and the PSR-4
 * map, so a same-named class in another namespace is never the target. A route
 * with several `methods` is declared once, under the first. Twig's own
 * `{% include %}` / `{% extends %}` are not followed: a provider reads only
 * code files, and `.twig` is not one.
 */
import * as path from 'node:path';

import type { FileRole } from '../map_model.js';
import { composerRoots } from './shared/detect.js';
import { annotationRoutes, tableMapping, templateRoots } from './shared/extractors.js';
import { type Kit, lineIndex, makeKit } from './shared/kit.js';
import { classNode, matchingClose, phpScope, qualify } from './shared/php.js';
import type { ConventionProvider } from './types.js';
import type { ResolutionConfig } from '../resolution_tiers.js';

/** Arguments of an attribute or annotation, one level of nested brackets deep. */
const ARGS = String.raw`(?<args>(?:[^()\[\]{}]|\[[^\]]*\]|\{[^}]*\})*)`;
/** The next declaration after the match is a method, not a class (`Post::class` is no declaration). */
const BEFORE = (decl: string): string =>
    String.raw`(?=(?:(?!(?<!::)\bclass\s+[A-Za-z_]|\bfunction\b)[\s\S]){0,800}${decl})`;
const ROUTE_HEAD = String.raw`(?:#\[|@)Route\(\s*(?:path\s*[:=]\s*)?(['"])(?<path>[^'"]*)\1${ARGS}\)`;
const METHOD_ROUTE = new RegExp(ROUTE_HEAD + BEFORE(String.raw`\bfunction\b`), 'g');
const CLASS_ROUTE = new RegExp(ROUTE_HEAD + BEFORE(String.raw`(?<!::)\bclass\s+[A-Za-z_]`), 'g');

const RELATION = /(?:#\[|@)ORM\\(?:ManyToOne|OneToMany|ManyToMany|OneToOne)\b(?<args>\((?:[^()]|\([^()]*\))*\))?/g;
const TARGET_ENTITY = /targetEntity\s*[:=]\s*(?:(?<cls>[\\\w]+)::class|(['"])(?<str>[\\\w]+)\2)/;
const PROPERTY = /(?:public|protected|private|var)\s+(?:readonly\s+)?(?:(?<type>\??[\\\w]+)\s+)?\$\w+/;

const snake = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

function verbOf(m: RegExpMatchArray): string {
    const args = m.groups?.['args'] ?? '';
    return /methods\s*[:=]\s*[[{]\s*['"](\w+)['"]/.exec(args)?.[1] ?? 'ANY';
}

function relations(kit: Kit, resolution: ResolutionConfig): void {
    for (const f of kit.filesWithExt('.php')) {
        const at = lineIndex(f.source);
        const scope = phpScope(f.source);
        for (const m of f.source.matchAll(RELATION)) {
            const line = at(m.index as number);
            const cls = kit.classAt(f.path, line);
            if (!cls) continue;
            const t = TARGET_ENTITY.exec(m.groups?.['args'] ?? '');
            let fq: string | null = null;
            if (t?.groups?.['cls']) fq = qualify(t.groups['cls'], scope);
            else if (t?.groups?.['str']) {
                const s = t.groups['str'];
                fq = s.includes('\\') ? s.replace(/^\\/, '') : qualify(s, { namespace: scope.namespace, uses: new Map() });
            } else {
                const type = PROPERTY.exec(f.source.slice((m.index as number) + m[0].length))?.groups?.['type'];
                if (type) fq = qualify(type.replace(/^\?/, ''), scope);
            }
            const target = fq ? classNode(kit, fq, resolution) : null;
            if (target && target !== cls.id) kit.emit(cls.id, target, 'relates', 'orm-relation');
        }
    }
}

/** Top-level comma split of a parameter list. */
function params(list: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of list) {
        if (ch === '(' || ch === '[' || ch === '{') depth += 1;
        else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
        if (ch === ',' && depth === 0) {
            out.push(cur);
            cur = '';
        } else cur += ch;
    }
    out.push(cur);
    return out;
}

function injections(kit: Kit, resolution: ResolutionConfig): void {
    for (const f of kit.filesWithExt('.php')) {
        const at = lineIndex(f.source);
        const scope = phpScope(f.source);
        for (const m of f.source.matchAll(/\bfunction\s+__construct\s*\(/g)) {
            const open = (m.index as number) + m[0].length - 1;
            const cls = kit.classAt(f.path, at(m.index as number));
            if (!cls) continue;
            for (const p of params(f.source.slice(open + 1, matchingClose(f.source, open)))) {
                const type = /^\s*(?:#\[[^\]]*\]\s*)*(?:(?:public|protected|private|readonly)\s+)*(?<type>\??[\\\w|]+)\s+&?(?:\.\.\.)?\$\w+/.exec(p)?.groups?.['type'];
                for (const ref of (type ?? '').replace(/^\?/, '').split('|').filter(Boolean)) {
                    const target = classNode(kit, qualify(ref, scope), resolution);
                    if (target && target !== cls.id) kit.emit(cls.id, target, 'injects', 'di-binding');
                }
            }
        }
    }
}

function symfonyRole(p: string): FileRole | undefined {
    if (p.startsWith('templates/')) return 'view';
    if (p === 'public/index.php' || p === 'bin/console') return 'entry';
    if (p.startsWith('migrations/')) return 'migration';
    return undefined;
}

export const symfonyProvider: ConventionProvider = {
    id: 'symfony',
    detect: (probe) => composerRoots(probe, ['symfony/framework-bundle', 'symfony/symfony']),
    build: (input) => {
        const kit = makeKit(input);
        annotationRoutes(kit, { exts: ['.php'], route: METHOD_ROUTE, verb: verbOf, prefix: CLASS_ROUTE, prefixReach: 12 });
        templateRoots(kit, {
            exts: ['.php'],
            call: /\$this->render(?:View|Block)?\(\s*(['"])(?<name>[\w./@-]+)\1/g,
            roots: ['templates'],
            extensions: ['.html.twig', '.twig'],
        });
        tableMapping(kit, {
            exts: ['.php'],
            entity: /(?:#\[|@)ORM\\Entity\b/g,
            tableName: /(?:#\[|@)ORM\\Table\(\s*(?:name\s*[:=]\s*)?(['"])(?<name>\w+)\1/,
            convention: snake,
            migration: {
                files: (p) => /(?:^|\/)migrations\/[^/]+\.php$/.test(p),
                create: /addSql\(\s*(['"])\s*(?:CREATE|ALTER)\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(?<name>\w+)/gi,
            },
        });
        relations(kit, input.resolution);
        injections(kit, input.resolution);
        return kit.result();
    },
    roleOf: (p) => symfonyRole(path.posix.normalize(p)),
};
