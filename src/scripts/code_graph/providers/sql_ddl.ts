/**
 * Raw SQL schema files: `schema.sql` / `structure.sql` and numbered `*.sql`
 * migrations under a `migrations` or `migrate` directory. Their statements are
 * replayed in path order into tables, columns and foreign keys; a test,
 * fixture or benchmark tree is never read as the project's schema.
 */
import { readSqlSchema } from '../../_lib/schema/readers/sql_ddl.js';
import { replay } from '../../_lib/schema/replay.js';
import { isFixturePath } from '../scope.js';
import { schemaGraph } from './shared/schema_graph.js';
import type { ConventionProvider } from './types.js';

const SQL_SCHEMA = /(^|\/)(?:(?:schema|structure)\.sql|(?:migrations?|migrate)\/[^/]+\.sql)$/i;
const VENDORED = /(^|\/)(?:vendor|node_modules)\//i;

export const isSqlSchemaPath = (p: string): boolean => SQL_SCHEMA.test(p) && !VENDORED.test(p) && !isFixturePath(p);

export const sqlDdlProvider: ConventionProvider = {
    id: 'sql-ddl',
    reads: SQL_SCHEMA,
    detect: (probe) => ([...probe.manifests.keys()].some(isSqlSchemaPath) ? [''] : []),
    build: ({ manifests, baseNodes }) => {
        const files = [...manifests].filter(([p]) => isSqlSchemaPath(p)).map(([p, source]) => ({ path: p, source }));
        const read = readSqlSchema(files);
        const model = replay({ ops: read.ops, engines: new Map([['', read.engine]]) });
        return schemaGraph(model, new Set(baseNodes.map((n) => n.id)));
    },
};
