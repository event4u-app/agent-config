/**
 * Runtime drift classes RT-1 … RT-6, as data for the one drift engine (`../../drift.ts`). All are
 * `advice`: none gates until its precision on planted fixtures is recorded.
 *
 * RT-2 compares against the data lane: it expects a data-lane fact of kind
 * `connection` carrying the engine the schema is written for in `engine`.
 */
import type { DriftRule } from '../../drift.js';

export const RUNTIME_RULES: readonly DriftRule[] = [
    {
        id: 'RT-1',
        title: 'host port collision',
        tier: 'advice',
        match: 'collision',
        select: { lane: 'runtime', rung: ['T1'], kind: 'port', where: { is_published: true } },
        key: ['published', 'protocol'],
        distinct: 'service',
        message: 'host port {attr.published}/{attr.protocol} is published by both {attr.service} and {other.attr.service}',
    },
    {
        id: 'RT-2',
        title: 'database image engine differs from the data lane',
        tier: 'advice',
        match: 'mismatch',
        select: { lane: 'data', kind: 'connection' },
        key: 'engine',
        against: { lane: 'runtime', kind: 'service', key: 'db_engine' },
        aliases: { pgsql: 'postgres', postgresql: 'postgres', mariadb: 'mysql', sqlsrv: 'sqlserver', mssql: 'sqlserver', sqlite3: 'sqlite' },
        message: 'the schema targets {attr.engine}, but the runtime database service {other.name} runs {other.attr.db_engine}',
    },
    {
        id: 'RT-3',
        title: 'environment name read in code but not declared',
        tier: 'advice',
        match: 'missing',
        select: { lane: 'runtime', kind: 'env-var', where: { source: 'code', platform: false } },
        key: 'name',
        against: { lane: 'runtime', kind: 'env-var', where: { source: { in: ['compose', 'example'] } }, key: 'name' },
        message: '{attr.name} is read in code but appears in no compose environment or example env file',
    },
    {
        id: 'RT-4',
        title: 'database port published beyond localhost',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'runtime', rung: ['T1'], kind: 'port', where: { is_published: true, local_only: false, db_engine: { exists: true } } },
        counter: 'context',
        counter_required: true,
        message: 'the {attr.db_engine} port {attr.published} of {attr.service} is published on every host interface',
    },
    {
        id: 'RT-5',
        title: 'image on the latest tag',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'runtime', rung: ['T1'], kind: 'image', where: { tag: 'latest' } },
        counter: 'context',
        counter_required: true,
        message: '{attr.repo} runs on `latest` for {other.name}; the image can change under the same configuration',
    },
    {
        id: 'RT-6',
        title: 'resource referenced but undeclared',
        tier: 'advice',
        match: 'dangling',
        lane: 'runtime',
        relation: ['depends-on', 'references', 'configured-by', 'routes-to', 'owned-by', 'uses-image', 'mounts', 'on-network'],
        message: '{other.name} references {name}, which no file in the project declares',
    },
];
