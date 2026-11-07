/**
 * road-to-a-link-with-agent-switch 2.3 — the link client and its CLI fallback.
 *
 * A real executable named `agent-switch` sits on an injected PATH, so the probe
 * and the SDK client spawn a process exactly as they do in production; only its
 * answers are scripted (FAKE_AS_LINK / FAKE_AS_MCP).
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { agentSwitchCall, cliArgsFor, linkStatus } from '../../src/scripts/_lib/agent_switch_client.js';

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake_agent_switch.mjs');
const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** A PATH holding a working `agent-switch`, plus the env that scripts it. */
function env(extra: Record<string, string> = {}): Record<string, string> {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'as-link-'));
    dirs.push(bin);
    const exe = path.join(bin, 'agent-switch');
    fs.writeFileSync(exe, `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "$@"\n`, 'utf-8');
    fs.chmodSync(exe, 0o755);
    return { PATH: `${bin}${path.delimiter}${path.dirname(process.execPath)}`, ...extra };
}

function emptyPath(): Record<string, string> {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'as-none-'));
    dirs.push(bin);
    return { PATH: bin };
}

describe('2.3 linkStatus', () => {
    it('is the status only when the link is present', () => {
        expect(linkStatus({ env: env() })?.contract).toBe(1);
        expect(linkStatus({ env: env({ FAKE_AS_LINK: 'off' }) })).toBeNull();
        expect(linkStatus({ env: env({ FAKE_AS_LINK: 'contract2' }) })).toBeNull();
        expect(linkStatus({ env: env({ FAKE_AS_LINK: 'garbled' }) })).toBeNull();
        expect(linkStatus({ env: emptyPath() })).toBeNull();
    });
});

describe('2.3 agentSwitchCall', () => {
    it('calls the tool over MCP and returns its JSON result', async () => {
        const r = await agentSwitchCall('switch_status', { id: 'r1' }, { env: env() });
        expect(r).toEqual({ via: 'mcp', tool: 'switch_status', args: { id: 'r1' } });
    });

    it('returns an array result unwrapped', async () => {
        expect(await agentSwitchCall('switch_list', {}, { env: env() })).toEqual([{ id: 'r1', via: 'mcp' }]);
    });

    it('falls back to the CLI verb when the MCP server fails', async () => {
        const r = await agentSwitchCall('limits_get', { provider: 'claude' }, { env: env({ FAKE_AS_MCP: 'broken' }) });
        expect(r).toEqual({ via: 'cli', argv: ['limits', 'claude', '--json'] });
    });

    it('falls back to the CLI verb when the tool reports an error', async () => {
        const r = await agentSwitchCall('limits_get', { provider: 'antigravity' }, { env: env() });
        expect(r).toEqual({ via: 'cli', argv: ['limits', 'antigravity', '--json'] });
    });

    it('returns null with the link off, absent, or on an unknown contract', async () => {
        expect(await agentSwitchCall('limits_get', {}, { env: env({ FAKE_AS_LINK: 'off' }) })).toBeNull();
        expect(await agentSwitchCall('limits_get', {}, { env: emptyPath() })).toBeNull();
        expect(await agentSwitchCall('limits_get', {}, { env: env({ FAKE_AS_LINK: 'contract2' }) })).toBeNull();
    });

    it('returns null when both MCP and the CLI fail', async () => {
        // session_whoami has no CLI verb, so a broken server leaves nothing to fall back to.
        expect(await agentSwitchCall('session_whoami', {}, { env: env({ FAKE_AS_MCP: 'broken' }) })).toBeNull();
    });
});

describe('2.3 cliArgsFor — the CLI fallback mapping', () => {
    it('maps every tool with a CLI verb as the contract tabulates it', () => {
        expect(cliArgsFor('link_status', {})).toEqual(['link', 'status', '--json']);
        expect(cliArgsFor('limits_get', {})).toEqual(['limits', '--json']);
        expect(cliArgsFor('switch_list', { all: true })).toEqual(['switch', 'list', '--all', '--json']);
        expect(cliArgsFor('switch_status', { id: 'abc' })).toEqual(['switch', 'show', 'abc', '--json']);
        expect(cliArgsFor('switch_request', { account: 'claude/work' })).toEqual([
            'switch', 'request', '--account', 'claude/work', '--by', 'ac', '--json',
        ]);
        expect(cliArgsFor('switch_decide', { id: 'abc', decision: 'approve', target: 'claude/home', how: 'after-turn' })).toEqual([
            'switch', 'decide', 'abc', 'approve', '--to', 'claude/home', '--how', 'after-turn', '--by', 'ac', '--json',
        ]);
        expect(cliArgsFor('switch_decide', { id: 'abc', decision: 'decline' })).toEqual([
            'switch', 'decide', 'abc', 'decline', '--by', 'ac', '--json',
        ]);
    });

    it('refuses what the CLI cannot express rather than guessing', () => {
        expect(cliArgsFor('session_whoami', {})).toBeNull();
        // "this session" needs the server's whoami; the CLI has none.
        expect(cliArgsFor('switch_request', {})).toBeNull();
        expect(cliArgsFor('switch_decide', { id: 'abc', decision: 'maybe' })).toBeNull();
        expect(cliArgsFor('switch_status', {})).toBeNull();
    });

    it('refuses a value that would read as a flag', () => {
        // `--executed` on `switch decide` records an approval as already carried out.
        expect(cliArgsFor('switch_status', { id: '--executed' })).toBeNull();
        expect(cliArgsFor('switch_decide', { id: 'abc', decision: 'approve', target: '--executed' })).toBeNull();
        expect(cliArgsFor('limits_get', { provider: '--all' })).toBeNull();
    });
});
