/**
 * Spring Boot: the links a Spring application makes by annotation.
 *
 *   @GetMapping("/x") · @RequestMapping(value = "/x", method = RequestMethod.GET)
 *       under a class-level @RequestMapping("/api")     route --routes-to--> the method
 *   @Entity class, @Table(name = "t") or the default      class --persists--> table:t
 *   interface R extends JpaRepository<E, Id>              R     --relates-->  E
 *   @Autowired field · constructor parameter              class --injects-->  the in-repo type
 *
 * The Java extractor spans a method or class from its first annotation, so a
 * mapping annotation belongs to the method whose span holds it; one outside
 * every method span (on the class) is never a route. With no table named, the
 * table is Spring Boot's default physical name: the entity class in snake_case
 * (`OrderLine` → `order_line`); `@Entity(name = "X")` is not read. A method-level
 * `@RequestMapping` without `method =` and a constructor of a class carrying no
 * stereotype annotation are not followed.
 */
import { jvmRoots } from './shared/detect.js';
import { joinRoute, tableMapping } from './shared/extractors.js';
import { type Kit, lineIndex, makeKit, packageSymbol } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const VERB_MAPPING = /@(?<verb>Get|Post|Put|Delete|Patch)Mapping\b(?:\s*\(\s*(?:(?:value|path)\s*=\s*)?(?:\{\s*)?"(?<path>[^"]*)")?/g;
const REQUEST_MAPPING = /@RequestMapping\s*\((?<args>[^)]*)\)/g;
const STEREOTYPE = /@(?:Component|Service|Repository|Controller|RestController|Configuration)\b/;
const AUTOWIRED_FIELD = /@Autowired\s+(?:(?:private|protected|public|final|static|transient)\s+)*(?<type>[A-Z]\w*)(?:<[^>;]*>)?\s+\w+\s*[;=]/g;
const REPOSITORY =
    /\binterface\s+(?<repo>\w+)\s+extends\s+(?:[\w.]+\.)?(?:JpaRepository|CrudRepository|ListCrudRepository|PagingAndSortingRepository|ReactiveCrudRepository|MongoRepository)\s*<\s*(?<entity>[A-Z]\w*)/g;

function snakeCase(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase();
}

/** An in-repo class or interface named `name` as `file` sees it: same file, an import, or the same package. */
function resolveType(kit: Kit, file: string, name: string): string | null {
    const id = kit.resolveName(file, name);
    const n = id ? kit.nodeById.get(id) : undefined;
    if (n && (n.kind === 'class' || n.kind === 'interface')) return n.id;
    return packageSymbol(kit, file, name, ['class', 'interface']);
}

/** The method whose span holds `line`, or null — never the file. */
function methodAt(kit: Kit, file: string, line: number) {
    const id = kit.enclosing(file, line);
    const n = kit.nodeById.get(id);
    return n && n.kind === 'method' ? n : null;
}

function routes(kit: Kit): void {
    for (const f of kit.filesWithExt('.java')) {
        const at = lineIndex(f.source);
        const lines = f.source.split('\n');
        const hits: Array<{ line: number; verb: string; path: string | undefined }> = [];
        const prefixes: Array<{ line: number; path: string }> = [];
        for (const m of f.source.matchAll(VERB_MAPPING)) {
            hits.push({ line: at(m.index as number), verb: m.groups?.['verb'] as string, path: m.groups?.['path'] });
        }
        for (const m of f.source.matchAll(REQUEST_MAPPING)) {
            const args = m.groups?.['args'] ?? '';
            const line = at(m.index as number);
            const p = /^\s*(?:(?:value|path)\s*=\s*)?(?:\{\s*)?"(?<path>[^"]*)"/.exec(args)?.groups?.['path']
                ?? /\b(?:value|path)\s*=\s*(?:\{\s*)?"(?<path>[^"]*)"/.exec(args)?.groups?.['path'];
            const verb = /\bmethod\s*=\s*(?:\{\s*)?RequestMethod\.(?<verb>[A-Z]+)/.exec(args)?.groups?.['verb'];
            if (methodAt(kit, f.path, line)) {
                if (verb) hits.push({ line, verb, path: p });
            } else if (p !== undefined) prefixes.push({ line, path: p });
        }
        for (const hit of hits) {
            const handler = methodAt(kit, f.path, hit.line);
            if (!handler) continue;
            const cls = kit.classAt(f.path, handler.source_location[0] as number);
            let prefix: string | undefined;
            if (cls) {
                const start = cls.source_location[0] as number;
                const decl = lines.findIndex((l, i) => i >= start - 1 && new RegExp(`\\bclass\\s+${cls.label}\\b`).test(l)) + 1;
                prefix = prefixes.filter((p) => p.line >= start && p.line <= decl).pop()?.path;
            }
            const id = kit.route(f.path, hit.verb.toUpperCase(), joinRoute(prefix, hit.path), hit.line);
            kit.emit(id, handler.id, 'routes-to', 'route-table');
        }
    }
}

function repositories(kit: Kit): void {
    for (const f of kit.filesWithExt('.java')) {
        for (const m of f.source.matchAll(REPOSITORY)) {
            const repo = resolveType(kit, f.path, m.groups?.['repo'] as string);
            const entity = resolveType(kit, f.path, m.groups?.['entity'] as string);
            if (repo && entity) kit.emit(repo, entity, 'relates', 'orm-relation');
        }
    }
}

function injections(kit: Kit): void {
    for (const f of kit.filesWithExt('.java')) {
        const at = lineIndex(f.source);
        const lines = f.source.split('\n');
        for (const m of f.source.matchAll(AUTOWIRED_FIELD)) {
            const cls = kit.classAt(f.path, at(m.index as number));
            const target = resolveType(kit, f.path, m.groups?.['type'] as string);
            if (cls && target && target !== cls.id) kit.emit(cls.id, target, 'injects', 'di-binding');
        }
        for (const n of kit.nodeById.values()) {
            if (n.source_file !== f.path || n.kind !== 'class') continue;
            const ctorId = kit.methodOf(n.id, n.label);
            const ctor = ctorId ? kit.nodeById.get(ctorId) : undefined;
            if (!ctor) continue;
            const start = n.source_location[0] as number;
            const head = lines.slice(start - 1, (ctor.source_location[0] as number) - 1).join('\n');
            const ctorText = lines.slice((ctor.source_location[0] as number) - 1, ctor.source_location[2] as number).join('\n');
            if (!STEREOTYPE.test(head.split(new RegExp(`\\bclass\\s+${n.label}\\b`))[0] ?? '') && !/@Autowired\b/.test(ctorText)) continue;
            const params = new RegExp(`\\b${n.label}\\s*\\((?<params>[^)]*)\\)`).exec(ctorText)?.groups?.['params'] ?? '';
            for (const param of params.split(',')) {
                const type = /(?:^|\s)(?<type>[A-Z]\w*)(?:<[^>]*>)?\s+\w+\s*$/.exec(param.replace(/@\w+(?:\([^)]*\))?/g, '').trim())?.groups?.['type'];
                const target = type ? resolveType(kit, f.path, type) : null;
                if (target && target !== n.id) kit.emit(n.id, target, 'injects', 'di-binding');
            }
        }
    }
}

export const springProvider: ConventionProvider = {
    id: 'spring',
    detect: (probe) => jvmRoots(probe, /spring-boot|org\.springframework\.boot/),
    build: (input) => {
        const kit = makeKit(input);
        routes(kit);
        tableMapping(kit, {
            exts: ['.java'],
            entity: /@Entity\b/g,
            tableName: /@Table\s*\(\s*(?:name\s*=\s*)?"(?<name>[^"]+)"/,
            convention: snakeCase,
        });
        repositories(kit);
        injections(kit);
        return kit.result();
    },
};
