/**
 * Pure-dispatch goldens for the local stdio-lite MCP server (ADR-207).
 *
 * Pins the wire shapes (mirrored from the hosted Worker) + the read-only
 * boundary: tools/list empty, tools/call → not_implemented, unknown method →
 * -32601. Pure — a synthetic tree, no disk.
 */
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import {
    dispatch,
    wireNameOf,
    liteToolsTokenCost,
    LITE_TOOLS_TOKEN_CAP,
    PROTOCOL_VERSION,
    RPC_METHOD_NOT_FOUND,
    RPC_INVALID_PARAMS,
    INLINE_BODY_CHAR_CAP,
} from './dispatch.js';
import { DEFAULT_SUGGEST_LIMIT } from '../../shared/skillRanking.js';
import type { ContentTree, ContentEntry } from './content.js';
import type { JsonRpcRequest, JsonRpcSuccess, JsonRpcError } from './dispatch.js';

function entry(p: Partial<ContentEntry> & Pick<ContentEntry, 'name' | 'kind'>): ContentEntry {
    const scheme = p.kind === 'command' ? 'command' : p.kind === 'rule' ? 'rule' : p.kind === 'guideline' ? 'guideline' : 'skill';
    return {
        uri: p.uri ?? `${scheme}://${p.name}`,
        name: p.name,
        description: p.description ?? `desc of ${p.name}`,
        body: p.body ?? `body of ${p.name}`,
        source: p.source ?? 'package',
        kind: p.kind,
        ...(p.kind === 'rule' || p.kind === 'guideline' ? { mime_type: 'text/markdown' } : {}),
    };
}

const TREE: ContentTree = {
    uris: Object.fromEntries(
        [
            entry({ name: 'verify-completion-evidence', kind: 'skill' }),
            entry({ name: 'research:report', kind: 'command' }),
            entry({ name: 'commit-policy', kind: 'rule' }),
            entry({ name: 'php/php-coding-patterns', kind: 'guideline' }),
        ].map((e) => [e.uri, e]),
    ),
};
const ID = { name: 'agent-config-mcp', version: '9.9.9' };

const req = (method: string, params?: unknown, id: number | string | null = 1): JsonRpcRequest => ({
    jsonrpc: '2.0', id, method, ...(params !== undefined ? { params } : {}),
});
const ok = (r: ReturnType<typeof dispatch>): JsonRpcSuccess => r as JsonRpcSuccess;
const err = (r: ReturnType<typeof dispatch>): JsonRpcError => r as JsonRpcError;

describe('dispatch — handshake', () => {
    it('initialize returns the protocol version + serverInfo + capabilities', () => {
        const r = ok(dispatch(TREE, ID, req('initialize')));
        const result = r.result as Record<string, unknown>;
        expect(result.protocolVersion).toBe(PROTOCOL_VERSION);
        expect(result.serverInfo).toEqual({ name: 'agent-config-mcp', version: '9.9.9' });
        expect(result.capabilities).toMatchObject({ prompts: {}, resources: {}, tools: {} });
    });
    it('ping returns {}', () => {
        expect(ok(dispatch(TREE, ID, req('ping'))).result).toEqual({});
    });
});

describe('dispatch — prompts', () => {
    it('prompts/list uses wire names (skill. / command.) sorted', () => {
        const result = ok(dispatch(TREE, ID, req('prompts/list'))).result as { prompts: { name: string }[] };
        const names = result.prompts.map((p) => p.name);
        expect(names).toContain('skill.verify-completion-evidence');
        expect(names).toContain('command.research.report'); // colon → dot
        expect(names).toEqual([...names].sort());
    });
    it('prompts/get returns the body as a user message', () => {
        const r = ok(dispatch(TREE, ID, req('prompts/get', { name: 'skill.verify-completion-evidence' })));
        const result = r.result as { messages: { content: { text: string } }[]; _meta: { kind: string } };
        expect(result.messages[0]!.content.text).toBe('body of verify-completion-evidence');
        expect(result._meta.kind).toBe('skill');
    });
    it('prompts/get unknown → invalid params', () => {
        expect(err(dispatch(TREE, ID, req('prompts/get', { name: 'skill.nope' }))).error.code).toBe(RPC_INVALID_PARAMS);
    });
    it('prompts/get missing name → invalid params', () => {
        expect(err(dispatch(TREE, ID, req('prompts/get', {}))).error.code).toBe(RPC_INVALID_PARAMS);
    });
});

describe('dispatch — prompt arguments from declared inputs', () => {
    const tree: ContentTree = {
        uris: Object.fromEntries(
            [
                {
                    ...entry({ name: 'declares-one', kind: 'skill' }),
                    inputs: [{ name: 'source', description: 'the document', required: true }],
                },
                entry({ name: 'declares-none', kind: 'skill' }),
            ].map((e) => [e.uri, e]),
        ),
    };
    const listed = (): { name: string; arguments: unknown[] }[] =>
        (ok(dispatch(tree, ID, req('prompts/list'))).result as { prompts: { name: string; arguments: unknown[] }[] })
            .prompts;

    it('lists exactly the declared argument', () => {
        const p = listed().find((x) => x.name === 'skill.declares-one')!;
        expect(p.arguments).toEqual([{ name: 'source', description: 'the document', required: true }]);
    });
    it('serves [] for an entry that declares nothing', () => {
        expect(listed().find((x) => x.name === 'skill.declares-none')!.arguments).toEqual([]);
    });
});

describe('dispatch — resources', () => {
    it('resources/list returns rule:// + guideline:// uris, markdown mime', () => {
        const result = ok(dispatch(TREE, ID, req('resources/list'))).result as {
            resources: { uri: string; mimeType: string }[];
        };
        const uris = result.resources.map((r) => r.uri);
        expect(uris).toContain('rule://commit-policy');
        expect(uris).toContain('guideline://php/php-coding-patterns');
        expect(result.resources.every((r) => r.mimeType === 'text/markdown')).toBe(true);
    });
    it('resources/read returns the body', () => {
        const r = ok(dispatch(TREE, ID, req('resources/read', { uri: 'rule://commit-policy' })));
        const result = r.result as { contents: { text: string }[] };
        expect(result.contents[0]!.text).toBe('body of commit-policy');
    });
    it('resources/read unknown → invalid params', () => {
        expect(err(dispatch(TREE, ID, req('resources/read', { uri: 'rule://nope' }))).error.code).toBe(RPC_INVALID_PARAMS);
    });
    it('resources/read refuses a prompt uri (kind guard)', () => {
        expect(err(dispatch(TREE, ID, req('resources/read', { uri: 'skill://verify-completion-evidence' }))).error.code).toBe(RPC_INVALID_PARAMS);
    });
});

describe('dispatch — read-only boundary (ADR-085)', () => {
    // Phase 1.1 of `road-to-skill-delivery-over-mcp` moved this boundary by
    // exactly two READ-ONLY discovery tools. The boundary itself is unchanged:
    // nothing here shells out, writes, or executes. Full surface contract lives
    // in `tests/scripts/mcp_lite_tools.test.ts`.
    it('tools/list is the two discovery tools and nothing else', () => {
        const tools = (ok(dispatch(TREE, ID, req('tools/list'))).result as { tools: { name: string }[] })
            .tools;
        expect(tools.map((t) => t.name).sort()).toEqual(['read_skill', 'suggest_skill_for_task']);
    });
    it('tools/call returns the not_implemented envelope in error.data', () => {
        const e = err(dispatch(TREE, ID, req('tools/call', { name: 'memory_store' })));
        expect(e.error.code).toBe(RPC_METHOD_NOT_FOUND);
        expect((e.error.data as { code: string }).code).toBe('not_implemented');
    });
    it('unknown method → method not found', () => {
        expect(err(dispatch(TREE, ID, req('does/not/exist'))).error.code).toBe(RPC_METHOD_NOT_FOUND);
    });
});

describe('wireNameOf', () => {
    it('skill keeps name, command maps colons to dots', () => {
        expect(wireNameOf(entry({ name: 'x', kind: 'skill' }))).toBe('skill.x');
        expect(wireNameOf(entry({ name: 'a:b:c', kind: 'command' }))).toBe('command.a.b.c');
    });
});

// The search ANSWER, as opposed to the search. A name is not a choosing
// criterion: a caller handed five names either guesses or opens five bodies,
// and a handoff clause written into a description ("use X instead when …")
// can only act on a reader. These pin that the description reaches the caller,
// that the default depth is the pre-registered one, and that no body does.
describe('suggest_skill_for_task — the row a model chooses from', () => {
    const CHOOSABLE: ContentTree = {
        uris: Object.fromEntries(
            [
                entry({
                    name: 'merge-conflicts',
                    kind: 'skill',
                    description: 'Resolve merge conflicts; use git-workflow for rebase strategy.',
                    body: 'a long body nobody should have to read to choose',
                }),
                entry({
                    name: 'git-workflow',
                    kind: 'skill',
                    description: 'Branching, rebase and merge strategy.',
                }),
                entry({ name: 'commit-policy', kind: 'rule' }),
            ].map((e) => [e.uri, e]),
        ),
    };

    function call(args: Record<string, unknown>): Record<string, unknown> {
        const r = ok(dispatch(CHOOSABLE, ID, req('tools/call', {
            name: 'suggest_skill_for_task',
            arguments: args,
        })));
        return (r.result as { structuredContent: Record<string, unknown> }).structuredContent;
    }

    it('carries each row\'s own description, and no body at any depth', () => {
        const out = call({ task: 'resolve merge conflicts' });
        expect(out.status).toBe('ok');
        const rows = out.suggestions as Record<string, unknown>[];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0]).toMatchObject({
            skill: 'merge-conflicts',
            description: 'Resolve merge conflicts; use git-workflow for rebase strategy.',
        });
        // Every row carries the four fields and nothing resembling a body.
        for (const row of rows) {
            expect(Object.keys(row).sort()).toEqual([
                'description',
                'personas',
                'score',
                'skill',
            ]);
            expect(String(row.description)).not.toContain('a long body');
        }
    });

    it('a row\'s description is ITS own, never the top row\'s', () => {
        const rows = call({ task: 'merge conflicts rebase strategy' })
            .suggestions as { skill: string; description: string }[];
        const byName = new Map(rows.map((r) => [r.skill, r.description]));
        expect(byName.get('git-workflow')).toBe('Branching, rebase and merge strategy.');
        expect(byName.get('merge-conflicts')).toBe(
            'Resolve merge conflicts; use git-workflow for rebase strategy.',
        );
    });

    it('defaults to the pre-registered depth, and an explicit limit still wins', () => {
        const schema = ((ok(dispatch(CHOOSABLE, ID, req('tools/list'))).result as {
            tools: { name: string; inputSchema: { properties: { limit: { default: number } } } }[];
        }).tools.find((t) => t.name === 'suggest_skill_for_task'))!;
        expect(schema.inputSchema.properties.limit.default).toBe(DEFAULT_SUGGEST_LIMIT);
        expect(DEFAULT_SUGGEST_LIMIT).toBe(8);
        // The handler's own fallback must agree with the schema it published —
        // two numbers for one default is how a caller that omits the field gets
        // a different depth from the one the tool advertises.
        expect((call({ task: 'merge conflicts' }).suggestions as unknown[]).length).toBeLessThanOrEqual(
            DEFAULT_SUGGEST_LIMIT,
        );
        expect((call({ task: 'merge conflicts', limit: 1 }).suggestions as unknown[]).length).toBe(1);
    });

    it('the tool definition tells the caller to read the rows and open at most two', () => {
        const tool = (ok(dispatch(CHOOSABLE, ID, req('tools/list'))).result as {
            tools: { name: string; description: string }[];
        }).tools.find((t) => t.name === 'suggest_skill_for_task')!;
        expect(tool.description).toMatch(/read/i);
        expect(tool.description).toMatch(/at most two bodies/i);
        // The tool definition is standing cost in every session; the row payload
        // is paid only when it is called. The cap is on the first.
        expect(liteToolsTokenCost()).toBeLessThanOrEqual(LITE_TOOLS_TOKEN_CAP);
    });
});

// A failed tool call is an ERROR in the MCP result contract, not a success whose
// payload happens to say so. `structuredContent.status` stays for readers that use it.
describe('tools/call — an error path answers isError: true, status unchanged', () => {
    const MANY: ContentTree = {
        uris: Object.fromEntries(
            Array.from({ length: 60 }, (_, i) =>
                entry({ name: `merge-helper-${String(i)}`, kind: 'skill', description: `merge conflicts helper number ${String(i)}` }),
            ).map((e) => [e.uri, e]),
        ),
    };
    const result = (tree: ContentTree, name: string, args: Record<string, unknown>) =>
        ok(dispatch(tree, ID, req('tools/call', { name, arguments: args }))).result as {
            isError: boolean;
            structuredContent: Record<string, unknown>;
        };

    it.each([
        ['suggest_skill_for_task with no task', TREE, 'suggest_skill_for_task', {}, 'error'],
        ['read_skill with no name', TREE, 'read_skill', {}, 'error'],
        ['read_skill with a path separator', TREE, 'read_skill', { name: '../x' }, 'error'],
        ['read_skill on an unknown name', TREE, 'read_skill', { name: 'nope' }, 'not_found'],
        ['suggest_skill_for_task on an empty tree', { uris: {} }, 'suggest_skill_for_task', { task: 'x' }, 'no_catalogue'],
    ] as const)('%s', (_label, tree, name, args, status) => {
        const r = result(tree as ContentTree, name, args as Record<string, unknown>);
        expect(r.isError).toBe(true);
        expect(r.structuredContent.status).toBe(status);
    });

    it('a successful call stays isError: false', () => {
        expect(result(TREE, 'read_skill', { name: 'verify-completion-evidence' }).isError).toBe(false);
        expect(result(MANY, 'suggest_skill_for_task', { task: 'merge conflicts' }).isError).toBe(false);
    });

    it('limit 100000 returns at most 20 rows and reports what it was clamped from', () => {
        const out = result(MANY, 'suggest_skill_for_task', { task: 'merge conflicts helper', limit: 100000 }).structuredContent;
        expect((out.suggestions as unknown[]).length).toBeLessThanOrEqual(20);
        expect((out.suggestions as unknown[]).length).toBe(20);
        expect(out.clamped_from).toBe(100000);
    });

    it('a limit inside the bound is not reported as clamped', () => {
        const out = result(MANY, 'suggest_skill_for_task', { task: 'merge conflicts helper', limit: 3 }).structuredContent;
        expect((out.suggestions as unknown[]).length).toBe(3);
        expect(out).not.toHaveProperty('clamped_from');
    });

    it('the published schema carries the same maximum the server enforces', () => {
        const tool = (ok(dispatch(TREE, ID, req('tools/list'))).result as {
            tools: { name: string; inputSchema: { properties: { limit: { maximum: number } } } }[];
        }).tools.find((t) => t.name === 'suggest_skill_for_task')!;
        expect(tool.inputSchema.properties.limit.maximum).toBe(20);
    });
});

// The output contract a client can check: one zod source per tool, shipped as
// `outputSchema`, open so a later field does not break a strict client.
describe('tools/list — outputSchema, and every structuredContent conforms to it', () => {
    const tools = (ok(dispatch(TREE, ID, req('tools/list'))).result as {
        tools: { name: string; outputSchema?: Record<string, unknown> }[];
    }).tools;
    const validator = (name: string) => {
        const schema = tools.find((t) => t.name === name)?.outputSchema;
        expect(schema, `${name} ships an outputSchema`).toBeDefined();
        return new Ajv({ allErrors: true }).compile(schema!);
    };
    const MANY: ContentTree = {
        uris: Object.fromEntries(
            Array.from({ length: 30 }, (_, i) => entry({ name: `merge-helper-${String(i)}`, kind: 'skill' })).map((e) => [e.uri, e]),
        ),
    };
    const sc = (tree: ContentTree, name: string, args: Record<string, unknown>) =>
        (ok(dispatch(tree, ID, req('tools/call', { name, arguments: args }))).result as { structuredContent: unknown })
            .structuredContent;

    it('both lite tools ship an object outputSchema that never closes the object', () => {
        for (const t of tools) {
            expect([t.name, t.outputSchema?.type]).toEqual([t.name, 'object']);
            expect(JSON.stringify(t.outputSchema)).not.toContain('"additionalProperties":false');
        }
    });

    it.each([
        ['suggest ok', MANY, 'suggest_skill_for_task', { task: 'merge helper' }],
        ['suggest clamped', MANY, 'suggest_skill_for_task', { task: 'merge helper', limit: 500 }],
        ['suggest error', TREE, 'suggest_skill_for_task', {}],
        ['suggest no_catalogue', { uris: {} }, 'suggest_skill_for_task', { task: 'x' }],
        ['read ok', TREE, 'read_skill', { name: 'verify-completion-evidence' }],
        ['read not_found', TREE, 'read_skill', { name: 'nope' }],
        ['read error', TREE, 'read_skill', { name: '../x' }],
    ] as const)('%s conforms', (_label, tree, name, args) => {
        const validate = validator(name);
        const out = sc(tree as ContentTree, name, args as Record<string, unknown>);
        expect([validate(out), validate.errors ?? null]).toEqual([true, null]);
    });

    it('the schema rejects a payload whose field drifts in type', () => {
        const validate = validator('suggest_skill_for_task');
        expect(validate({ status: 'ok', suggestions: [{ skill: 'x', score: 'high', personas: [], description: '' }] })).toBe(false);
        expect(validator('read_skill')({ status: 'maybe' })).toBe(false);
    });

    it('a field the schema does not name is still accepted — the contract is open', () => {
        expect(validator('read_skill')({ status: 'ok', name: 'x', later_field: 1 })).toBe(true);
    });

    it('tools/list stays under its standing token cap with the schemas in it', () => {
        expect(liteToolsTokenCost()).toBeLessThanOrEqual(LITE_TOOLS_TOKEN_CAP);
    });
});

// road-to-routing-assurance-live-floors 4.4: the MCP path named the skill but
// never called read_skill. On a UNIQUE top hit the answer can carry the body so
// no second call is needed — default-off until the 4.2 parity gate passes on it.
describe('suggest_skill_for_task — inline top body (4.4, default-off)', () => {
    const long = 'x'.repeat(INLINE_BODY_CHAR_CAP + 50);
    const T: ContentTree = {
        uris: Object.fromEntries(
            [
                entry({ name: 'merge-conflicts', kind: 'skill', description: 'Resolve merge conflicts in git.', body: 'MERGE BODY' }),
                entry({ name: 'git-workflow', kind: 'skill', description: 'Branching strategy.', body: 'GIT BODY' }),
                entry({ name: 'twin-a', kind: 'skill', description: 'Lint markdown tables.', body: long }),
                entry({ name: 'twin-b', kind: 'skill', description: 'Lint markdown tables.', body: 'B' }),
                entry({ name: 'huge', kind: 'skill', description: 'Render huge sparkline glyphs.', body: long }),
            ].map((e) => [e.uri, e]),
        ),
    };
    const call = (args: Record<string, unknown>, inlineTopBody?: boolean): Record<string, unknown> =>
        (ok(dispatch(T, ID, req('tools/call', { name: 'suggest_skill_for_task', arguments: args }), inlineTopBody === undefined ? {} : { inlineTopBody })).result as {
            structuredContent: Record<string, unknown>;
        }).structuredContent;

    it('off by default: no body field at all', () => {
        expect(call({ task: 'resolve merge conflicts' })).not.toHaveProperty('top_body');
    });

    it('on: a unique top hit carries its body and id', () => {
        expect(call({ task: 'resolve merge conflicts' }, true).top_body).toEqual({ skill: 'merge-conflicts', body: 'MERGE BODY', truncated: false });
    });

    it('on: a tied top score carries no body — the choice stays with the caller', () => {
        expect(call({ task: 'lint markdown tables' }, true)).not.toHaveProperty('top_body');
    });

    it('on: the body is bounded and says so', () => {
        const tb = call({ task: 'render huge sparkline glyphs' }, true).top_body as { body: string; truncated: boolean };
        expect(tb.body.length).toBe(INLINE_BODY_CHAR_CAP);
        expect(tb.truncated).toBe(true);
    });
});
