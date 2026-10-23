/**
 * SQLAlchemy (and Flask-SQLAlchemy, SQLModel): a declarative class with
 * `__tablename__ = "x"` --persists--> `table:x`; a SQLModel class declared with
 * `table=True` and no `__tablename__` gets SQLModel's default, its lowercased
 * class name. `relationship("Other")` / `relationship(Other)` inside a mapped
 * class --relates--> the mapped class named: a string resolves to the one mapped
 * class of that name in the project, a bare name the way the file imports it.
 *
 * Not drawn: imperative `Table("x", metadata, ...)` mappings, Flask-SQLAlchemy's
 * implicit table names (a `db.Model` without `__tablename__`), a
 * `relationship(lambda: X)` or a target named only in a `Mapped[...]` annotation,
 * and SQLModel's `Relationship(...)`.
 */
import type { CodeNode } from '../types.js';
import { pythonRoots } from './shared/detect.js';
import { lineIndex, makeKit } from './shared/kit.js';
import { balanced, spanText, splitArgs, stringLiteral } from './shared/python.js';
import type { ConventionProvider } from './types.js';

export const sqlalchemyProvider: ConventionProvider = {
    id: 'sqlalchemy',
    detect: (probe) => pythonRoots(probe, ['sqlalchemy', 'flask-sqlalchemy', 'sqlmodel']),
    build: (input) => {
        const kit = makeKit(input);
        const mapped = new Map<string, { node: CodeNode; source: string }>();
        for (const f of kit.filesWithExt('.py')) {
            const at = lineIndex(f.source);
            for (const m of f.source.matchAll(/^[ \t]+__tablename__\s*(?::[^=\n]+)?=\s*(['"])(\w+)\1/gm)) {
                const cls = kit.classAt(f.path, at(m.index as number));
                if (!cls || mapped.has(cls.id)) continue;
                mapped.set(cls.id, { node: cls, source: f.source });
                kit.emit(cls.id, kit.table(m[2] as string, f.path, cls.source_location[0] as number), 'persists', 'schema-call');
            }
            for (const n of kit.nodeById.values()) {
                if (n.source_file !== f.path || n.kind !== 'class' || mapped.has(n.id)) continue;
                const head = /^\s*class\s+\w+\s*\(([^)]*)\)/.exec(spanText(f.source, n))?.[1] ?? '';
                if (!/\btable\s*=\s*True\b/.test(head)) continue;
                mapped.set(n.id, { node: n, source: f.source });
                kit.emit(n.id, kit.table(n.label.toLowerCase(), f.path, n.source_location[0] as number), 'persists', 'schema-call');
            }
        }
        const byLabel = (label: string): string | null => {
            const hits = [...mapped.values()].filter((x) => x.node.label === label);
            return hits.length === 1 ? (hits[0]?.node.id ?? null) : null;
        };
        for (const { node, source } of mapped.values()) {
            const region = spanText(source, node);
            for (const r of region.matchAll(/\brelationship\s*\(/g)) {
                const first = splitArgs(balanced(region, (r.index as number) + r[0].length - 1))[0] ?? '';
                const lit = stringLiteral(first);
                let target: string | null = null;
                if (lit !== null) target = byLabel(lit.slice(lit.lastIndexOf('.') + 1));
                else if (/^\w+$/.test(first)) {
                    const resolved = kit.resolveName(node.source_file, first);
                    target = resolved && mapped.has(resolved) ? resolved : null;
                }
                if (target && target !== node.id) kit.emit(node.id, target, 'relates', 'orm-relation');
            }
        }
        return kit.result();
    },
};
