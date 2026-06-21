// Parity tests for the src/scripts/mcp_server/tools.ts twin.
//
// Ported 1:1 from the Phase 4 tools layer + Phase 3 L2/L3 handler tests +
// the dispatch-telemetry tests of tests/test_mcp_server.py (the cases that
// do NOT require the `mcp` SDK — the loader-layer tools surface). The
// server-layer (`@requires_mcp`) tools/list + tools/call cases live in
// mcp_server_server.test.ts.
//
// Plus a golden-parity block: python3 tools-layer output vs the TS twin on
// hermetic fixtures + the real repo, compared on canonicalized structure.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { REPO_ROOT, hasPython3, makeTmpDir, runPyInline } from './_mcp_server.js';

import {
    ALLOWLIST,
    CATALOG_STUBS,
    REGISTRY,
    STUB_NAMES,
    ToolCache,
    boot_log_line,
    to_mcp_tool_meta,
} from '../../src/scripts/mcp_server/tools.js';

const tmpDirs: string[] = [];
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop()!;
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});
function tmp(): string {
    const d = makeTmpDir('mcp-tools-');
    tmpDirs.push(d);
    return d;
}

// ----------------------------------------------------------------------
// Allowlist + registry shape (D1 / L2 / J2)
// ----------------------------------------------------------------------

describe('tools — allowlist + registry', () => {
    it('allowlist holds the 9 implemented tools', () => {
        expect(new Set(Object.keys(ALLOWLIST))).toEqual(
            new Set([
                'lint_skills',
                'chat_history_append',
                'chat_history_read',
                'memory_lookup',
                'memory_status',
                'list_skills',
                'list_commands',
                'list_rules',
                'read_resource_body',
            ]),
        );
        for (const tool of Object.values(ALLOWLIST)) {
            expect(tool.description.trim()).toBeTruthy();
            expect(tool.input_schema.type).toBe('object');
            expect(tool.input_schema.additionalProperties).toBe(false);
        }
    });

    it('implemented-only tool cache lists the allowlist', () => {
        const cache = new ToolCache({ ...ALLOWLIST });
        expect(cache.names()).toEqual(Object.keys(ALLOWLIST).sort());
        expect(cache.list().map((t) => t.name)).toEqual(cache.names());
    });

    it('default tool cache lists catalog + allowlist (J2)', () => {
        const cache = new ToolCache();
        const names = cache.names();
        expect(names).toContain('chat_history_append');
        expect(names).toContain('lint_skills');
        expect(names).toContain('memory_lookup');
        expect(names).toEqual(Object.keys(REGISTRY).sort());
        expect(cache.implemented_names()).toEqual(Object.keys(ALLOWLIST).sort());
    });

    it('catalog stubs exclude the allowlist', () => {
        for (const name of Object.keys(ALLOWLIST)) {
            expect(name in CATALOG_STUBS).toBe(false);
        }
        expect(new Set(STUB_NAMES)).toEqual(new Set(Object.keys(CATALOG_STUBS)));
    });

    it('to_mcp_tool_meta shape', () => {
        const tool = ALLOWLIST.lint_skills!;
        const meta = to_mcp_tool_meta(tool);
        expect(meta.name).toBe('lint_skills');
        expect((meta.description as string).trim()).toBeTruthy();
        expect(meta.inputSchema).toEqual(tool.input_schema);
    });

    it('boot_log_line enumerates tools', () => {
        const line = boot_log_line(new ToolCache());
        const total = Object.keys(REGISTRY).length;
        const implementedCount = Object.keys(ALLOWLIST).length;
        const stubCount = total - implementedCount;
        expect(line).toContain(`registered ${total} tools`);
        expect(line).toContain(`${implementedCount} implemented`);
        expect(line).toContain(`${stubCount} stubs`);
        expect(line).toContain('chat_history_append');
        expect(line).toContain('lint_skills');
    });

    it('every catalog stub is marked as a stub', () => {
        const cache = new ToolCache();
        for (const name of STUB_NAMES) {
            expect(cache.is_stub(name)).toBe(true);
        }
        expect(cache.is_stub('lint_skills')).toBe(false);
        expect(cache.is_stub('nope')).toBe(false);
    });
});

// ----------------------------------------------------------------------
// Dispatch (J2 / J4)
// ----------------------------------------------------------------------

describe('tools — dispatch', () => {
    it('dispatch rejects an unknown tool', async () => {
        const cache = new ToolCache();
        await expect(cache.dispatch('nope', {})).rejects.toThrow(/Unknown tool/);
    });

    it('stub dispatch returns the not_implemented envelope', async () => {
        const cache = new ToolCache();
        const result = await cache.dispatch('memory_signal', {
            type: 'ownership',
            path: 'x',
            body: 'y',
        });
        expect(result.code).toBe('not_implemented');
        expect(result.tool).toBe('memory_signal');
        expect(result.transport).toBe('stdio');
        expect(result.alternative).toBe('stdio');
        expect(result.install_hint).toBeTruthy();
        expect(result.message as string).toContain('discovery catalog');
    });
});

// ----------------------------------------------------------------------
// chat_history_append (D3)
// ----------------------------------------------------------------------

describe('tools — chat_history_append', () => {
    it('dry_run does not write', async () => {
        const root = tmp();
        const cache = new ToolCache();
        const result = await cache.dispatch(
            'chat_history_append',
            { text: 'hello', entry_type: 'note', dry_run: true },
            root,
        );
        expect(result.dry_run).toBe(true);
        const target = result.target_path as string;
        expect(target).toBe(
            fs.realpathSync(root) + path.sep + path.join('agents', 'runtime', '.agent-chat-history'),
        );
        expect(fs.existsSync(target)).toBe(false);
        expect(result.entry).toEqual({ t: 'note', text: 'hello' });
    });

    it('absolute path escape raises before any I/O', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch(
                'chat_history_append',
                { text: 'x', path: '/etc/passwd', dry_run: true },
                root,
            ),
        ).rejects.toThrow(/escapes consumer_root/);
    });

    it('unlisted filename raises', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch(
                'chat_history_append',
                { text: 'x', path: 'agents/evidence/notes.md', dry_run: true },
                root,
            ),
        ).rejects.toThrow(/not in write allowlist/);
    });

    it('rejects empty text', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch('chat_history_append', { text: '   ', dry_run: true }, root),
        ).rejects.toThrow(/non-empty string/);
    });

    it("rejects 'header' entry_type", async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch(
                'chat_history_append',
                { text: 'x', entry_type: 'header', dry_run: true },
                root,
            ),
        ).rejects.toThrow(/must not be 'header'/);
    });

    it('writes when not dry_run', async () => {
        const root = tmp();
        const cache = new ToolCache();
        const result = await cache.dispatch(
            'chat_history_append',
            { text: 'real entry', entry_type: 'note' },
            root,
        );
        expect(result.dry_run).toBe(false);
        const target = result.target_path as string;
        expect(fs.existsSync(target)).toBe(true);
        const lines = fs.readFileSync(target, 'utf-8').split('\n').filter((l) => l.length > 0);
        expect(lines.length).toBeGreaterThanOrEqual(2);
        const last = JSON.parse(lines[lines.length - 1]!) as Record<string, unknown>;
        expect(last.text).toBe('real entry');
        expect(last.t).toBe('note');
    });
});

// ----------------------------------------------------------------------
// lint_skills (D2)
// ----------------------------------------------------------------------

describe('tools — lint_skills', () => {
    it('rejects path escape', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch('lint_skills', { paths: ['/etc/passwd'] }, root),
        ).rejects.toThrow(/escapes consumer_root/);
    });

    it('rejects non-list paths', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch('lint_skills', { paths: 'not-a-list' }, root),
        ).rejects.toThrow(/must be a list/);
    });

    it('returns the JSON payload for a subset', async () => {
        const cache = new ToolCache();
        const target = path.join(
            REPO_ROOT,
            'dist/agent-src',
            'skills',
            'verify-completion-evidence',
            'SKILL.md',
        );
        if (!fs.existsSync(target)) {
            return; // repo invariant — skip if the fixture skill is absent
        }
        const rel = path.relative(REPO_ROOT, target);
        const result = await cache.dispatch('lint_skills', { paths: [rel] }, REPO_ROOT);
        expect(typeof result).toBe('object');
        expect('results' in result || 'files' in result || Object.keys(result).length > 0).toBe(
            true,
        );
    });
});

// ----------------------------------------------------------------------
// Dispatch telemetry (J4)
// ----------------------------------------------------------------------

function readTelemetryJsonl(consumerRoot: string): Record<string, unknown>[] {
    const target = path.join(
        consumerRoot,
        'agents',
        'runtime',
        'mcp-telemetry',
        'calls.jsonl',
    );
    if (!fs.existsSync(target)) {
        return [];
    }
    return fs
        .readFileSync(target, 'utf-8')
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('tools — dispatch telemetry', () => {
    it('logs implemented for an allowlist tool', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await cache.dispatch(
            'chat_history_append',
            { text: 'hi', entry_type: 'note', dry_run: true },
            root,
        );
        const records = readTelemetryJsonl(root);
        expect(records.length).toBe(1);
        expect(records[0]!.tool_name).toBe('chat_history_append');
        expect(records[0]!.outcome).toBe('implemented');
        expect(records[0]!.transport).toBe('stdio');
    });

    it('logs stub for a catalog entry', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await cache.dispatch(
            'memory_signal',
            { type: 'ownership', path: 'x', body: 'y' },
            root,
        );
        const records = readTelemetryJsonl(root);
        expect(records.length).toBe(1);
        expect(records[0]!.tool_name).toBe('memory_signal');
        expect(records[0]!.outcome).toBe('stub');
    });

    it('logs latent_demand for an unknown tool BEFORE the error', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(cache.dispatch('nope', {}, root)).rejects.toThrow(/Unknown tool/);
        const records = readTelemetryJsonl(root);
        expect(records.length).toBe(1);
        expect(records[0]!.tool_name).toBe('nope');
        expect(records[0]!.outcome).toBe('latent_demand');
    });

    it('records carry the five-field envelope, no payload body', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await cache.dispatch(
            'memory_signal',
            { type: 'ownership', path: 'secret', body: 'secret' },
            root,
        );
        const records = readTelemetryJsonl(root);
        expect(records.length).toBe(1);
        const record = records[0]!;
        expect(new Set(Object.keys(record))).toEqual(
            new Set(['tool_name', 'client_id_hash', 'ts', 'transport', 'outcome']),
        );
        expect(JSON.stringify(record)).not.toContain('secret');
    });
});

// ----------------------------------------------------------------------
// Phase 3 L3 — per-tool shape contracts for the RO handlers
// ----------------------------------------------------------------------

function seedChatHistory(root: string): string {
    const target = path.join(root, 'agents', 'runtime', '.agent-chat-history');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const header = { v: 4, started: '2026-05-12T00:00:00Z', freq: 'per_phase' };
    const rows = [
        { t: 'phase', s: 'abc1234567890def', text: 'row-1' },
        { t: 'tool', s: 'abc1234567890def', text: 'row-2' },
        { t: 'phase', s: 'ffff000011112222', text: 'row-3' },
    ];
    fs.writeFileSync(
        target,
        JSON.stringify(header) + '\n' + rows.map((r) => JSON.stringify(r)).join('\n') + '\n',
        'utf-8',
    );
    return target;
}

describe('tools — L3 handler shapes', () => {
    it('chat_history_read returns path / entries / count', async () => {
        const root = tmp();
        const cache = new ToolCache();
        seedChatHistory(root);
        const result = await cache.dispatch('chat_history_read', { last: 2 }, root);
        expect(new Set(Object.keys(result))).toEqual(new Set(['path', 'entries', 'count']));
        expect(result.count).toBe(2);
        expect((result.entries as unknown[]).every((e) => typeof e === 'object')).toBe(true);
    });

    it('chat_history_read filters by entry_type', async () => {
        const root = tmp();
        const cache = new ToolCache();
        seedChatHistory(root);
        const result = await cache.dispatch('chat_history_read', { entry_type: 'tool' }, root);
        expect(result.count).toBe(1);
        expect((result.entries as Record<string, unknown>[])[0]!.t).toBe('tool');
    });

    it('memory_status returns the file-backend status envelope keys', async () => {
        // Memory is entirely file-backed now (no external backend): the
        // handler returns asdict(Result()) → {status, backend, reason,
        // elapsed_ms}, all constant; `status` is always "file".
        const root = tmp();
        const cache = new ToolCache();
        const result = await cache.dispatch('memory_status', {}, root);
        for (const key of ['status', 'backend', 'reason', 'elapsed_ms']) {
            expect(key in result).toBe(true);
        }
        expect(result.status).toBe('file');
        expect(result.backend).toBe('file');
    });

    it('memory_lookup returns the v1 retrieval envelope', async () => {
        const root = tmp();
        const cache = new ToolCache();
        fs.mkdirSync(path.join(root, 'agents', 'memory', 'ownership'), { recursive: true });
        const result = await cache.dispatch(
            'memory_lookup',
            { types: ['ownership'], limit: 5 },
            root,
        );
        for (const key of ['contract_version', 'status', 'entries', 'slices']) {
            expect(key in result).toBe(true);
        }
    });

    it('memory_lookup rejects empty types', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch('memory_lookup', { types: [] }, root),
        ).rejects.toThrow(/non-empty/);
    });

    it('list_skills shape', async () => {
        const cache = new ToolCache();
        const result = await cache.dispatch('list_skills', {}, REPO_ROOT);
        expect(new Set(Object.keys(result))).toEqual(new Set(['count', 'skills', 'errors']));
        expect(result.count as number).toBeGreaterThanOrEqual(1);
        const sample = (result.skills as Record<string, unknown>[])[0]!;
        for (const key of ['name', 'description', 'source', 'wire_name']) {
            expect(key in sample).toBe(true);
        }
    });

    it('list_commands shape', async () => {
        const cache = new ToolCache();
        const result = await cache.dispatch('list_commands', {}, REPO_ROOT);
        expect(new Set(Object.keys(result))).toEqual(new Set(['count', 'commands', 'errors']));
        expect(result.count as number).toBeGreaterThanOrEqual(1);
    });

    it('list_rules shape', async () => {
        const cache = new ToolCache();
        const result = await cache.dispatch('list_rules', {}, REPO_ROOT);
        expect(new Set(Object.keys(result))).toEqual(new Set(['count', 'rules', 'errors']));
        expect(result.count as number).toBeGreaterThanOrEqual(1);
        const sample = (result.rules as Record<string, unknown>[])[0]!;
        expect((sample.uri as string).startsWith('rule://')).toBe(true);
    });

    it('read_resource_body shape', async () => {
        const cache = new ToolCache();
        const listing = await cache.dispatch('list_rules', {}, REPO_ROOT);
        const sampleUri = (listing.rules as Record<string, unknown>[])[0]!.uri as string;
        const body = await cache.dispatch('read_resource_body', { uri: sampleUri }, REPO_ROOT);
        expect(body.uri).toBe(sampleUri);
        for (const key of ['name', 'description', 'mime_type', 'kind', 'source', 'body']) {
            expect(key in body).toBe(true);
        }
        expect(typeof body.body).toBe('string');
        expect((body.body as string).length).toBeGreaterThan(0);
    });

    it('read_resource_body raises on an unknown URI', async () => {
        const cache = new ToolCache();
        await expect(
            cache.dispatch('read_resource_body', { uri: 'rule://does-not-exist' }, REPO_ROOT),
        ).rejects.toThrow(/resource not found/);
    });
});

// ----------------------------------------------------------------------
// Golden parity — python3 tools layer vs the TS twin (deterministic only).
// ----------------------------------------------------------------------

describe.runIf(hasPython3())('golden parity vs python3', () => {
    it('ALLOWLIST keys + REGISTRY keys + STUB_NAMES match', () => {
        const py = runPyInline(
            'import json,sys; sys.path.insert(0,"src"); ' +
                'from scripts.mcp_server.tools import ALLOWLIST, REGISTRY, STUB_NAMES; ' +
                'print(json.dumps({"allow":sorted(ALLOWLIST),"reg":sorted(REGISTRY),"stubs":sorted(STUB_NAMES)}))',
            { cwd: REPO_ROOT },
        );
        expect(py.status).toBe(0);
        const pyObj = JSON.parse(py.stdout) as {
            allow: string[];
            reg: string[];
            stubs: string[];
        };
        expect(Object.keys(ALLOWLIST).sort()).toEqual(pyObj.allow);
        expect(Object.keys(REGISTRY).sort()).toEqual(pyObj.reg);
        expect([...STUB_NAMES].sort()).toEqual(pyObj.stubs);
    });

    it('to_mcp_tool_meta envelope is byte-identical for every allowlist tool', () => {
        const py = runPyInline(
            'import json,sys; sys.path.insert(0,"src"); ' +
                'from scripts.mcp_server.tools import ALLOWLIST, to_mcp_tool_meta; ' +
                'print(json.dumps({n:to_mcp_tool_meta(t) for n,t in ALLOWLIST.items()}, sort_keys=True))',
            { cwd: REPO_ROOT },
        );
        expect(py.status).toBe(0);
        const pyObj = JSON.parse(py.stdout) as Record<string, unknown>;
        const tsObj: Record<string, unknown> = {};
        for (const [n, t] of Object.entries(ALLOWLIST)) {
            tsObj[n] = to_mcp_tool_meta(t);
        }
        expect(canonical(tsObj)).toEqual(canonical(pyObj));
    });

    it('stub dispatch envelope JSON is byte-identical', async () => {
        const py = runPyInline(
            'import asyncio,json,sys; sys.path.insert(0,"src"); ' +
                'from scripts.mcp_server.tools import ToolCache; ' +
                'r=asyncio.run(ToolCache().dispatch("compile_router", {})); ' +
                'print(json.dumps(r, separators=(",",":"), sort_keys=True))',
            { cwd: tmp() },
        );
        expect(py.status).toBe(0);
        const cache = new ToolCache();
        const ts = await cache.dispatch('compile_router', {}, tmp());
        // Both emit the same envelope keys/values; compare canonicalized.
        expect(canonical(ts)).toEqual(canonical(JSON.parse(py.stdout)));
    });
});

/** Stable, key-sorted JSON round-trip for structural comparison. */
function canonical(obj: unknown): unknown {
    return JSON.parse(JSON.stringify(sortKeys(obj)));
}
function sortKeys(v: unknown): unknown {
    if (Array.isArray(v)) {
        return v.map(sortKeys);
    }
    if (v && typeof v === 'object') {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(v as Record<string, unknown>).sort()) {
            out[k] = sortKeys((v as Record<string, unknown>)[k]);
        }
        return out;
    }
    return v;
}
