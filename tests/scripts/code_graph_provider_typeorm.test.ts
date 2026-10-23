import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { typeormTableName } from '../../src/scripts/code_graph/providers/typeorm.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/typeorm');
const E = 'src/entities';
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const out = (from: string, relation: string): string[] =>
    graph.edges.filter((e) => e.source === from && e.relation === relation).map((e) => e.target).sort();

describe('typeorm provider', () => {
    it('detects typeorm from package.json', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['typeorm']);
    });

    it('persists an entity to the table its decorator names, string or options form', () => {
        expect(out(`${E}/user.ts#User`, 'persists')).toEqual(['table:app_users']);
        expect(out(`${E}/post.ts#Post`, 'persists')).toEqual(['table:blog_posts']);
    });

    it('gives a bare @Entity() the snake_case class name, TypeORM default naming', () => {
        expect(out(`${E}/user-profile.ts#UserProfile`, 'persists')).toEqual(['table:user_profile']);
        expect(out(`${E}/user-profile.ts#HTTPLog`, 'persists')).toEqual(['table:http_log']);
        expect(typeormTableName('UserProfile')).toBe('user_profile');
    });

    it('relates an entity to the class its relation decorator names, not a same-named class elsewhere', () => {
        expect(out(`${E}/user.ts#User`, 'relates')).toEqual([`${E}/post.ts#Post`]);
        expect(out(`${E}/post.ts#Post`, 'relates')).toEqual([`${E}/user.ts#User`]);
        expect(out(`${E}/user-profile.ts#UserProfile`, 'relates')).toEqual([`${E}/user.ts#User`]);
        expect(graph.edges.some((e) => e.relation === 'relates' && e.target === 'src/other/user.ts#User')).toBe(false);
    });

    it('ignores an @Entity from another ORM', () => {
        expect(out('src/other/mikro.ts#Invoice', 'persists')).toEqual([]);
        expect(out('src/other/mikro.ts#Invoice', 'relates')).toEqual([]);
        expect(graph.nodes.some((n) => n.id === 'table:invoice')).toBe(false);
    });

    it('draws migrates for a migration creating a table', () => {
        expect(out('src/migrations/1700000000000-init.ts', 'migrates')).toEqual(['table:app_users', 'table:audit_log']);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => ['persists', 'relates', 'migrates'].includes(e.relation));
        expect(mine.length).toBe(9);
        expect(mine.every((e) => e.provider_id === 'typeorm')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});

describe('typeorm provider without a manifest', () => {
    it('stays inactive', async () => {
        const { graph: g } = await buildFromRepo(path.join(FIXTURE, 'src'), null);
        expect(g.providers ?? []).toEqual([]);
        expect(g.edges.some((e) => e.provider_id === 'typeorm')).toBe(false);
    });
});
