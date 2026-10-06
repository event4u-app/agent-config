/**
 * `mcp-usage-observation` concern
 * (road-to-neighbours-that-pull-their-weight step 3.3, decision D12).
 *
 * Three properties are load-bearing and each has its own case. It fires on an
 * install that never opted into telemetry, because the census it feeds is a
 * local report. It never fires on a tool that is not `mcp__…`. And the store
 * holds tool NAMES only — the owner's condition for a default-on collector —
 * which is asserted on the file's bytes, with arguments, a response and a
 * session id all present in the envelope that produced it.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { mcpToolName, run } from '../../src/scripts/hooks/mcp_usage_observation_hook.js';

const roots: string[] = [];

afterEach(() => {
    while (roots.length > 0) {
        fs.rmSync(roots.pop() as string, { recursive: true, force: true });
    }
});

// A real settings file with no telemetry section: telemetry is OFF, and the
// walk-up stops here rather than at some ancestor of the temp dir.
function makeRoot(): string {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'mcp-usage-'));
    roots.push(dir);
    fs.writeFileSync(path.join(dir, '.agent-settings.yml'), 'quality:\n  local_auto_run: false\n', 'utf-8');
    return dir;
}

function storePath(root: string): string {
    return path.join(root, 'agents', 'runtime', 'neighbour-tool-use.json');
}

function readStore(root: string): Record<string, string> {
    return JSON.parse(fs.readFileSync(storePath(root), 'utf-8')) as Record<string, string>;
}

function toolEnvelope(toolName: string, payloadExtra: Record<string, unknown> = {}): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'post_tool_use',
        session_id: 'host-session-token',
        payload: { tool_name: toolName, tool_input: {}, ...payloadExtra },
    });
}

describe('mcp-usage-observation records foreign MCP tool names', () => {
    it('records a foreign MCP tool name on an install that never enabled telemetry', () => {
        const root = makeRoot();

        expect(run(toolEnvelope('mcp__linear-server__create_issue'), { consumer_root: root })).toBe(0);

        const store = readStore(root);
        expect(Object.keys(store)).toEqual(['mcp__linear-server__create_issue']);
        expect(store['mcp__linear-server__create_issue']).toBe(new Date().toISOString().slice(0, 10));
    });

    it('records one entry per distinct tool', () => {
        const root = makeRoot();

        run(toolEnvelope('mcp__acme__alpha'), { consumer_root: root });
        run(toolEnvelope('mcp__acme__alpha'), { consumer_root: root });
        run(toolEnvelope('mcp__acme__beta'), { consumer_root: root });

        expect(Object.keys(readStore(root)).sort()).toEqual(['mcp__acme__alpha', 'mcp__acme__beta']);
    });

    it('does not republish the file on a repeat of the same tool on the same day', () => {
        // `update_json_under_lock` republishes via a rename, so a rewrite
        // changes the inode even when the bytes are identical — compared across
        // the repeat alone, so the assertion fails if the skip is deleted.
        const root = makeRoot();
        run(toolEnvelope('mcp__acme__alpha'), { consumer_root: root });

        const before = fs.statSync(storePath(root));
        run(toolEnvelope('mcp__acme__alpha'), { consumer_root: root });
        const after = fs.statSync(storePath(root));

        expect(after.ino).toBe(before.ino);
        expect(after.mtimeMs).toBe(before.mtimeMs);
    });

    it('NEGATIVE — a Skill call, a plain host tool and a bare prefix leave no store behind', () => {
        for (const tool of ['Skill', 'Bash', 'mcp__']) {
            const root = makeRoot();
            expect(run(toolEnvelope(tool), { consumer_root: root })).toBe(0);
            expect(fs.existsSync(storePath(root))).toBe(false);
        }
    });

    it('roots the store at the settings directory, never at a session subdirectory', () => {
        const root = makeRoot();
        const nested = path.join(root, 'packages', 'web');
        fs.mkdirSync(nested, { recursive: true });

        expect(run(toolEnvelope('mcp__acme__alpha'), { consumer_root: nested })).toBe(0);

        expect(fs.existsSync(storePath(root))).toBe(true);
        expect(fs.existsSync(storePath(nested))).toBe(false);
    });

    it('a malformed or empty envelope exits 0 and writes nothing', () => {
        const root = makeRoot();
        for (const raw of ['', '{ not json', '[]', 'null', '{"payload": 7}']) {
            expect(run(raw, { consumer_root: root })).toBe(0);
        }
        expect(fs.existsSync(storePath(root))).toBe(false);
    });
});

describe('the store holds tool names only — the owner condition of D12', () => {
    it('no argument, response, session id or host reaches the file', () => {
        const root = makeRoot();
        const env = toolEnvelope('mcp__acme__alpha', {
            tool_input: { query: 'SECRET-ARGUMENT-VALUE' },
            tool_response: { content: 'SECRET-RESPONSE-BODY' },
            session_id: 'SECRET-SESSION-ID',
        });

        expect(run(env, { consumer_root: root })).toBe(0);

        const bytes = fs.readFileSync(storePath(root), 'utf-8');
        // Positive control first, so the negatives below are about content and
        // not about a file that was never written.
        expect(bytes).toContain('mcp__acme__alpha');
        for (const leaked of ['SECRET-ARGUMENT-VALUE', 'SECRET-RESPONSE-BODY', 'SECRET-SESSION-ID', 'host-session-token', 'claude']) {
            expect(bytes).not.toContain(leaked);
        }
        const store = readStore(root);
        expect(Object.keys(store)).toEqual(['mcp__acme__alpha']);
        expect(Object.values(store)).toEqual([new Date().toISOString().slice(0, 10)]);
    });

    it('mcpToolName reads the name from the dispatcher envelope or a bare payload', () => {
        expect(mcpToolName({ payload: { tool_name: 'mcp__a__b' } })).toBe('mcp__a__b');
        expect(mcpToolName({ toolName: 'mcp__a__b' })).toBe('mcp__a__b');
        expect(mcpToolName({ payload: { tool_name: 'Read' } })).toBeNull();
        expect(mcpToolName('mcp__a__b')).toBeNull();
    });
});
