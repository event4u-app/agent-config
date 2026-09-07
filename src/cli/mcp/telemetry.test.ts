/**
 * Roadmap step 4.1 — one collector row per `tools/call`, and none when off.
 *
 * Drives the REAL transport (`runStdioServer`) rather than a stand-in, because
 * the property under test is a property of the dispatch path: `dispatch` stays
 * pure, so a test that called it directly would prove nothing about whether a
 * row is ever written.
 */
import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PassThrough } from 'node:stream';
import type { ContentTree, ContentEntry } from './content.js';
import { runStdioServer } from './stdio.js';
import {
    HOST_OTHER,
    HOST_UNKNOWN,
    KNOWN_HOSTS,
    LITE_TRANSPORT,
    classifyLiteOutcome,
    liteTelemetryEnabled,
    normalizeHost,
    normalizeToolName,
    recordLiteCall,
    TOOL_OTHER,
} from './telemetry.js';

const SINK_REL = path.join('agents', 'runtime', 'mcp-telemetry', 'calls.jsonl');

function entry(name: string): ContentEntry {
    return {
        uri: `skill://${name}`,
        name,
        description: `desc of ${name}`,
        body: `body of ${name}`,
        source: 'package',
        kind: 'skill',
    };
}
const TREE: ContentTree = { uris: { [`skill://alpha`]: entry('alpha') } };
const IDENTITY = { name: 'agent-config-mcp', version: '9.9.9' };

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-lite-tel-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

function settingsFile(dir: string, enabled: boolean): string {
    const p = path.join(dir, '.agent-settings.yml');
    fs.writeFileSync(
        p,
        `personal:\n  autonomy: auto\ntelemetry:\n  artifact_engagement:\n    enabled: ${enabled}\n    granularity: task\n`,
    );
    return p;
}

function rows(root: string): Record<string, unknown>[] {
    const p = path.join(root, SINK_REL);
    if (!fs.existsSync(p)) return [];
    return fs
        .readFileSync(p, 'utf-8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

/** The n-th row, asserted to exist — keeps the assertions free of `!`. */
function row(root: string, i = 0): Record<string, unknown> {
    const all = rows(root);
    expect(all.length).toBeGreaterThan(i);
    return all[i] as Record<string, unknown>;
}

/** Feed a sequence of JSON-RPC requests through the real transport. */
async function drive(
    lines: Record<string, unknown>[],
    opts: { consumerRoot: string; settingsPath: string },
): Promise<void> {
    const input = new PassThrough();
    const output = new PassThrough();
    output.resume();
    const done = runStdioServer(TREE, IDENTITY, {
        input,
        output,
        consumerRoot: opts.consumerRoot,
        settingsPath: opts.settingsPath,
    });
    for (const l of lines) input.write(`${JSON.stringify(l)}\n`);
    input.end();
    await done;
}

const init = (clientName?: string) => ({
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: clientName === undefined ? {} : { clientInfo: { name: clientName, version: '1.0' } },
});
const call = (name: string, id = 1) => ({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: name === 'read_skill' ? { name: 'alpha' } : { task: 'anything' } },
});

describe('lite telemetry — the gate', () => {
    it('writes NOTHING when the setting is off', async () => {
        const root = mkTmp();
        await drive([init('claude-code'), call('suggest_skill_for_task')], {
            consumerRoot: root,
            settingsPath: settingsFile(root, false),
        });
        expect(rows(root)).toEqual([]);
        expect(fs.existsSync(path.join(root, SINK_REL))).toBe(false);
    });

    it('writes NOTHING when there is no settings file at all', async () => {
        const root = mkTmp();
        await drive([init('claude-code'), call('suggest_skill_for_task')], {
            consumerRoot: root,
            settingsPath: path.join(root, 'absent.yml'),
        });
        expect(rows(root)).toEqual([]);
    });

    it('reads the EXISTING engagement key, not a new one', () => {
        const dir = mkTmp();
        expect(liteTelemetryEnabled(settingsFile(dir, true))).toBe(true);
        expect(liteTelemetryEnabled(settingsFile(dir, false))).toBe(false);
    });

    it('an `enabled` under a DIFFERENT telemetry section does not switch it on', () => {
        const dir = mkTmp();
        const p = path.join(dir, '.agent-settings.yml');
        fs.writeFileSync(p, 'telemetry:\n  remote:\n    enabled: true\n');
        expect(liteTelemetryEnabled(p)).toBe(false);
    });

    it('an `enabled` outside `telemetry:` does not switch it on', () => {
        const dir = mkTmp();
        const p = path.join(dir, '.agent-settings.yml');
        fs.writeFileSync(p, 'analytics:\n  artifact_engagement:\n    enabled: true\n');
        expect(liteTelemetryEnabled(p)).toBe(false);
    });
});

describe('lite telemetry — exactly one row per call', () => {
    it('one call, one row', async () => {
        const root = mkTmp();
        await drive([init('claude-code'), call('suggest_skill_for_task')], {
            consumerRoot: root,
            settingsPath: settingsFile(root, true),
        });
        const r = rows(root);
        expect(r).toHaveLength(1);
        expect(row(root).tool_name).toBe('suggest_skill_for_task');
        expect(row(root).transport).toBe(LITE_TRANSPORT);
        expect(row(root).outcome).toBe('implemented');
        expect(row(root).host).toBe('claude-code');
        expect(typeof row(root).client_id_hash).toBe('string');
    });

    it('three calls, three rows — one per call, in order', async () => {
        const root = mkTmp();
        await drive(
            [
                init('cursor'),
                call('suggest_skill_for_task', 1),
                call('read_skill', 2),
                call('run_migration', 3),
            ],
            { consumerRoot: root, settingsPath: settingsFile(root, true) },
        );
        const r = rows(root);
        expect(r.map((x) => x.tool_name)).toEqual([
            'suggest_skill_for_task',
            'read_skill',
            'run_migration',
        ]);
        expect(r.map((x) => x.outcome)).toEqual(['implemented', 'implemented', 'stub']);
        expect(new Set(r.map((x) => x.host))).toEqual(new Set(['cursor']));
    });

    it('a non-`tools/call` method writes no row', async () => {
        const root = mkTmp();
        await drive(
            [
                init('claude-code'),
                { jsonrpc: '2.0', id: 1, method: 'tools/list' },
                { jsonrpc: '2.0', id: 2, method: 'prompts/list' },
                { jsonrpc: '2.0', id: 3, method: 'ping' },
            ],
            { consumerRoot: root, settingsPath: settingsFile(root, true) },
        );
        expect(rows(root)).toEqual([]);
    });

    it('a `tools/call` with no tool name writes no row — nothing to attribute', async () => {
        const root = mkTmp();
        await drive([init('claude-code'), { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} }], {
            consumerRoot: root,
            settingsPath: settingsFile(root, true),
        });
        expect(rows(root)).toEqual([]);
    });
});

describe('lite telemetry — the host is a closed vocabulary', () => {
    it('records `unknown` when the client never introduced itself', async () => {
        const root = mkTmp();
        await drive([init(), call('read_skill')], {
            consumerRoot: root,
            settingsPath: settingsFile(root, true),
        });
        expect(row(root).host).toBe(HOST_UNKNOWN);
    });

    it('records `unknown` when a call precedes `initialize`', async () => {
        const root = mkTmp();
        await drive([call('read_skill')], {
            consumerRoot: root,
            settingsPath: settingsFile(root, true),
        });
        expect(row(root).host).toBe(HOST_UNKNOWN);
    });

    it('never stores an unrecognised client name — it stores `other`', async () => {
        const root = mkTmp();
        const secret = 'acme-internal-tool-/Users/someone/private';
        await drive([init(secret), call('read_skill')], {
            consumerRoot: root,
            settingsPath: settingsFile(root, true),
        });
        const raw = fs.readFileSync(path.join(root, SINK_REL), 'utf-8');
        expect(row(root).host).toBe(HOST_OTHER);
        expect(raw).not.toContain('acme');
        expect(raw).not.toContain('/Users/');
    });

    it('folds decorated client names onto the vocabulary', () => {
        expect(normalizeHost('Claude Code')).toBe('claude-code');
        expect(normalizeHost('claude_code')).toBe('claude-code');
        expect(normalizeHost('Cursor (0.42)')).toBe('cursor');
        expect(normalizeHost('claude-desktop')).toBe('claude-desktop');
        expect(normalizeHost('')).toBe(HOST_UNKNOWN);
        expect(normalizeHost(undefined)).toBe(HOST_UNKNOWN);
        expect(normalizeHost(42)).toBe(HOST_UNKNOWN);
    });

    it('every resolved host is a member of the closed set', () => {
        const allowed = new Set<string>([...KNOWN_HOSTS, HOST_OTHER, HOST_UNKNOWN]);
        for (const probe of ['zed-editor', 'Windsurf', 'nothing-like-it', '', 'GEMINI-CLI']) {
            expect(allowed.has(normalizeHost(probe))).toBe(true);
        }
    });
});

describe('lite telemetry — outcome classification', () => {
    it('a lite tool is `implemented`, anything else is `stub` — never a guessed `latent_demand`', () => {
        expect(classifyLiteOutcome(true)).toBe('implemented');
        expect(classifyLiteOutcome(false)).toBe('stub');
    });

    it('recordLiteCall returns null and writes nothing for an empty tool name', () => {
        const root = mkTmp();
        expect(
            recordLiteCall({
                toolName: '',
                isLiteTool: false,
                host: 'claude-code',
                consumerRoot: root,
                settingsPath: settingsFile(root, true),
            }),
        ).toBeNull();
        expect(rows(root)).toEqual([]);
    });
});

describe('lite telemetry — the tool name is clamped, not stored verbatim', () => {
    it('a caller-supplied name carrying a path never reaches the store', async () => {
        const root = mkTmp();
        const nasty = 'x/../../Users/someone/.ssh/id_rsa';
        await drive(
            [init('claude-code'), { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: nasty } }],
            { consumerRoot: root, settingsPath: settingsFile(root, true) },
        );
        const raw = fs.readFileSync(path.join(root, SINK_REL), 'utf-8');
        expect(row(root).tool_name).toBe(TOOL_OTHER);
        expect(raw).not.toContain('id_rsa');
        expect(raw).not.toContain('/Users/');
    });

    it('an identifier-shaped unknown name IS kept — that is the latent-demand signal', () => {
        expect(normalizeToolName('run_migration', false)).toBe('run_migration');
        expect(normalizeToolName('memory.signal', false)).toBe('memory.signal');
    });

    it('anything not identifier-shaped becomes the bucket', () => {
        expect(normalizeToolName('has space', false)).toBe(TOOL_OTHER);
        expect(normalizeToolName('a'.repeat(200), false)).toBe(TOOL_OTHER);
        expect(normalizeToolName('{"json":true}', false)).toBe(TOOL_OTHER);
        expect(normalizeToolName('-leading-dash', false)).toBe(TOOL_OTHER);
        expect(normalizeToolName('', false)).toBe('');
        expect(normalizeToolName(undefined, false)).toBe('');
    });
});
