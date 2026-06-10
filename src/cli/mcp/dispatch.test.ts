/**
 * Pure-dispatch goldens for the local stdio-lite MCP server (ADR-085).
 *
 * Pins the wire shapes (mirrored from the hosted Worker) + the read-only
 * boundary: tools/list empty, tools/call → not_implemented, unknown method →
 * -32601. Pure — a synthetic tree, no disk.
 */
import { describe, expect, it } from 'vitest';
import { dispatch, wireNameOf, PROTOCOL_VERSION, RPC_METHOD_NOT_FOUND, RPC_INVALID_PARAMS } from './dispatch.js';
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
    it('tools/list is empty', () => {
        expect((ok(dispatch(TREE, ID, req('tools/list'))).result as { tools: unknown[] }).tools).toEqual([]);
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
