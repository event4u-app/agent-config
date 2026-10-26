/**
 * Prisma schema files: each model becomes a table (its `@@map` name), each
 * scalar field a column, and each `@relation(fields, references)` a foreign
 * key, witnessed at the model's or field's own line.
 */
import { readPrismaSchema } from '../../_lib/schema/readers/prisma_schema.js';
import { replay } from '../../_lib/schema/replay.js';
import { isFixturePath } from '../fixture_paths.js';
import { schemaGraph } from './shared/schema_graph.js';
import type { ConventionProvider } from './types.js';

const PRISMA_SCHEMA = /(^|\/)(?:schema\.prisma|prisma\/schema\/[^/]+\.prisma)$/;
const VENDORED = /(^|\/)(?:vendor|node_modules)\//i;

const isPrismaSchema = (p: string): boolean => PRISMA_SCHEMA.test(p) && !VENDORED.test(p) && !isFixturePath(p);

export const prismaProvider: ConventionProvider = {
    id: 'prisma',
    reads: PRISMA_SCHEMA,
    detect: (probe) => {
        const roots = new Set<string>();
        for (const p of probe.manifests.keys()) {
            if (isPrismaSchema(p)) roots.add(p.replace(/(?:^|\/)(?:prisma\/schema\/[^/]+|prisma\/schema\.prisma|schema\.prisma)$/, ''));
        }
        return [...roots].sort();
    },
    build: ({ manifests, baseNodes }) => {
        const reads = [...manifests]
            .filter(([p]) => isPrismaSchema(p))
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([p, source]) => readPrismaSchema({ path: p, source }));
        const engine = reads.find((r) => r.engine !== 'unknown')?.engine ?? 'unknown';
        const model = replay({ ops: reads.flatMap((r) => r.ops), engines: new Map([['', engine]]) });
        return schemaGraph(model, new Set(baseNodes.map((n) => n.id)));
    },
};
