import type { ConfirmState, MapAreas, Witness } from '../../src/scripts/code_graph/map_areas.js';

let n = 0;
/** A witness with a distinct, valid hash per call. */
export function wit(file: string, line: number, confirm: ConfirmState = 'unconfirmed'): Witness {
    n += 1;
    return { file, line, hash: (0xabc000 + n).toString(16).padStart(16, '0'), confirm, rung: 'T1' };
}

/**
 * One payload per knowledge area, small and witness-carrying. Runtime is a
 * reader that ran and found nothing; Impact has no reader, so it stays absent.
 */
export function sampleAreas(): MapAreas {
    const mig = 'database/migrations/0003_create_comments.php';
    return {
        data: {
            reader: 'migration replay',
            completeness: 'partial',
            engine: 'mysql',
            tables: [
                {
                    name: 'users',
                    connection: 'default',
                    models: ['app/Models/User.php'],
                    witness: wit('database/migrations/0001_create_users.php', 12, 'confirmed'),
                    columns: [
                        { name: 'id', type: 'bigint', nullable: false, key: 'pk', witness: wit('database/migrations/0001_create_users.php', 13, 'confirmed') },
                        { name: 'email', type: 'varchar(255)', nullable: false, key: 'uk', witness: wit('database/migrations/0001_create_users.php', 14, 'changed') },
                    ],
                },
                {
                    name: 'comments',
                    connection: 'default',
                    models: [],
                    witness: wit(mig, 9),
                    columns: [{ name: 'post_id', type: 'bigint', nullable: false, witness: wit(mig, 11, 'gone') }],
                },
            ],
            foreignKeys: [{ from: { table: 'comments', column: 'user_id' }, to: { table: 'users', column: 'id' }, onDelete: 'cascade', witness: wit(mig, 15) }],
            relations: [{ kind: 'n:1', from: 'Comment', to: 'Post', key: 'post_id', witness: wit('app/Models/Comment.php', 20, 'moved') }],
            findings: [
                {
                    id: 'DR-1',
                    severity: 'medium',
                    subject: 'comments.post_id',
                    message: 'ORM relation without a foreign key',
                    completeness: 'partial',
                    witnesses: [wit('app/Models/Comment.php', 20, 'moved'), wit(mig, 11, 'gone')],
                },
            ],
        },
        interfaces: {
            reader: 'http clients',
            completeness: 'complete',
            findings: [],
            services: [
                {
                    name: 'partner',
                    protocol: 'soap',
                    direction: 'outbound',
                    configNames: ['PARTNER_URL'],
                    witness: wit('app/Clients/Partner.php', 8),
                    operations: [
                        {
                            name: 'GetStock',
                            method: 'POST',
                            params: [{ name: 'sku', type: 'string', required: true }],
                            callers: [wit('app/Http/Controllers/StockController.php', 31, 'confirmed')],
                            witness: wit('app/Clients/Partner.php', 22),
                        },
                    ],
                },
            ],
        },
        runtime: { reader: 'compose', completeness: 'complete', empty: 'no compose file in this tree', findings: [], environments: [], resources: [], services: [] },
        delivery: {
            reader: 'workflows',
            completeness: 'complete',
            findings: [
                { id: 'DL-1', severity: 'low', subject: 'ci.yml#test', message: 'action not pinned to a commit', completeness: 'complete', witnesses: [wit('.github/workflows/ci.yml', 14)] },
            ],
            workflows: [{ file: '.github/workflows/ci.yml', name: 'ci', triggers: ['push'], witness: wit('.github/workflows/ci.yml', 1) }],
            jobs: [
                { id: '.github/workflows/ci.yml#test', workflow: '.github/workflows/ci.yml', name: 'test', needs: [], uses: ['actions/checkout@v4'], witness: wit('.github/workflows/ci.yml', 10) },
                {
                    id: '.github/workflows/ci.yml#deploy',
                    workflow: '.github/workflows/ci.yml',
                    name: 'deploy',
                    needs: ['test'],
                    environment: 'staging',
                    uses: [],
                    witness: wit('.github/workflows/ci.yml', 30),
                },
            ],
            environments: ['staging'],
            chain: [{ kind: 'deploy', name: 'deploy to staging', environment: 'staging', job: '.github/workflows/ci.yml#deploy', witness: wit('.github/workflows/ci.yml', 35) }],
        },
        agent: {
            reader: 'graph verbs',
            completeness: 'complete',
            findings: [],
            verbs: [{ name: 'explain', answers: 'what is around a seed, two hops out', cli: 'agent-config code-graph explain <seed>', mcp: 'graph_query' }],
        },
        tours: [
            {
                id: 'first-look',
                title: 'First look',
                steps: [
                    { area: 'data', item: 'table/users', text: 'Start at the users table', inputHash: '00aa', state: 'fresh' },
                    { area: 'interfaces', item: 'service/partner', text: 'Then the partner service', inputHash: '00bb', state: 'stale' },
                ],
            },
        ],
    };
}
