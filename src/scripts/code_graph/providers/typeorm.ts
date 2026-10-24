/**
 * TypeORM, in files that import from `typeorm` (MikroORM shares `@Entity`):
 *
 *   @Entity('t') · @Entity({ name: 't' }) · @Entity()   class --persists--> table:t
 *                                                       (bare: snake_case of the class, TypeORM's default naming)
 *   @ManyToOne(() => X) · @OneToMany(() => X, …)        class --relates-->  X
 *   queryRunner.createTable(new Table({ name: 't' }))   migration --migrates--> table:t
 *
 * A custom naming strategy, `@ViewEntity`, string-named relation targets and
 * `EntitySchema` definitions are not followed.
 */
import { npmRoots } from './shared/detect.js';
import { scopeKit } from './shared/js.js';
import { lineIndex, makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const EXTS = ['.ts', '.js'];

/** TypeORM's DefaultNamingStrategy table name: `UserProfile` → `user_profile`, `HTTPLog` → `http_log`. */
export function typeormTableName(className: string): string {
    return className
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase();
}

export const typeormProvider: ConventionProvider = {
    id: 'typeorm',
    detect: (probe) => npmRoots(probe, ['typeorm']),
    build: (input) => {
        const kit = scopeKit(makeKit(input), (src) => /\bfrom\s+['"]typeorm['"]|require\(\s*['"]typeorm['"]\s*\)/.test(src));
        for (const f of kit.filesWithExt(...EXTS)) {
            const at = lineIndex(f.source);
            for (const m of f.source.matchAll(/@Entity\(\s*(?:(['"`])(?<name>[^'"`]+)\1|\{(?<opts>[^}]*)\})?/g)) {
                const cls = kit.nextSymbol(f.path, at(m.index as number), ['class']);
                if (!cls || cls.kind !== 'class') continue;
                const fromOpts = /\bname\s*:\s*(['"`])([^'"`]+)\1/.exec(m.groups?.['opts'] ?? '')?.[2];
                const name = m.groups?.['name'] ?? fromOpts ?? typeormTableName(cls.label);
                kit.emit(cls.id, kit.table(name, f.path, cls.source_location[0] as number), 'persists', 'schema-call');
            }
            const relation = /@(?:ManyToOne|OneToMany|OneToOne|ManyToMany)\(\s*(?:\(\s*\w*\s*\)|\w+)\s*=>\s*([A-Za-z_$][\w$]*)/g;
            for (const m of f.source.matchAll(relation)) {
                const owner = kit.classAt(f.path, at(m.index as number));
                const target = kit.resolveName(f.path, m[1] as string);
                if (!owner || !target || target === owner.id || kit.nodeById.get(target)?.kind !== 'class') continue;
                kit.emit(owner.id, target, 'relates', 'orm-relation');
            }
            const create = /new\s+Table\(\s*\{\s*name\s*:\s*(['"`])(?<name>[^'"`]+)\1|CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(?<raw>\w+)/gi;
            if (/\bMigrationInterface\b/.test(f.source)) {
                for (const m of f.source.matchAll(create)) {
                    const name = m.groups?.['name'] ?? m.groups?.['raw'];
                    if (name) kit.emit(f.path, kit.table(name, f.path, at(m.index as number)), 'migrates', 'schema-call');
                }
            }
        }
        return kit.result();
    },
};
