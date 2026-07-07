// Parity tests for the src/scripts/mcp_server/tools.ts twin.
//
// Ported 1:1 from the Phase 4 tools layer + Phase 3 L2/L3 handler tests +
// the dispatch-telemetry tests of tests/test_mcp_server.py (the cases that
// do NOT require the `mcp` SDK — the loader-layer tools surface). The
// server-layer (`@requires_mcp`) tools/list + tools/call cases live in
// mcp_server_server.test.ts.
//
// Plus a golden-structure block (converted from the retired python-parity
// suite): registry partitioning, per-tool meta envelopes, and stub-dispatch
// determinism asserted on the TS side alone.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { REPO_ROOT, makeTmpDir } from './_mcp_server.js';

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
    it('allowlist holds the 18 implemented tools', () => {
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
                // Phase 4 write/exec cut (2026-07-07 council verdict).
                'memory_signal',
                'roadmap_progress',
                'roadmap_archive',
                'capabilities_index',
                'doctor_report',
                'conformance_check',
                'telemetry_report',
                'council_estimate',
                // Phase 5 shell-exec pilot (same verdict, one tool only).
                'run_tests',
            ]),
        );
        expect(Object.keys(ALLOWLIST).length).toBe(18);
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
        // `run_quality_checks` is still a catalog stub after the Phase 5
        // pilot cut (shell-exec tier — not in the 2026-07-07 council cut).
        const cache = new ToolCache();
        const result = await cache.dispatch('run_quality_checks', {
            tool: 'x',
        });
        expect(result.code).toBe('not_implemented');
        expect(result.tool).toBe('run_quality_checks');
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
            'skill_trigger_eval',
            { message: 'hello' },
            root,
        );
        const records = readTelemetryJsonl(root);
        expect(records.length).toBe(1);
        expect(records[0]!.tool_name).toBe('skill_trigger_eval');
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
            'skill_trigger_eval',
            { message: 'secret', context: 'secret' },
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
// Phase 4 — write/exec cut handlers (2026-07-07 council verdict)
// ----------------------------------------------------------------------

const PHASE_4_NAMES = [
    'memory_signal',
    'roadmap_progress',
    'roadmap_archive',
    'capabilities_index',
    'doctor_report',
    'conformance_check',
    'telemetry_report',
    'council_estimate',
] as const;

describe('tools — Phase 4 registration', () => {
    it('the 8 Phase 4 tools are implemented, not stubs', () => {
        const cache = new ToolCache();
        for (const name of PHASE_4_NAMES) {
            expect(cache.is_stub(name)).toBe(false);
            expect(cache.implemented_names()).toContain(name);
        }
    });

    it('description + input_schema are verbatim catalog copies', async () => {
        const { load_catalog } = await import('../../src/scripts/mcp_server/catalog.js');
        const byName = new Map(load_catalog().map((e) => [e.name, e]));
        for (const name of PHASE_4_NAMES) {
            const entry = byName.get(name)!;
            expect(entry).toBeTruthy();
            expect(entry.implemented_on).toEqual(['stdio']);
            const tool = ALLOWLIST[name]!;
            expect(tool.description).toBe(entry.description);
            expect(canonical(tool.input_schema)).toEqual(canonical(entry.input_schema));
        }
    });
});

describe('tools — memory_signal', () => {
    it('happy path appends to the monthly intake JSONL', async () => {
        const root = tmp();
        const cache = new ToolCache();
        const result = await cache.dispatch(
            'memory_signal',
            { type: 'ownership', path: 'src/x.ts', body: 'billing owner is team-pay' },
            root,
        );
        expect(result.recorded).toBe(true);
        const signal = result.signal as Record<string, unknown>;
        expect(signal.entry_type).toBe('ownership');
        expect(signal.path).toBe('src/x.ts');
        expect(signal.body).toBe('billing owner is team-pay');
        expect(String(signal.id)).toMatch(/^sig-[0-9a-f]{12}$/);

        const now = new Date();
        const ym = `${now.getUTCFullYear().toString().padStart(4, '0')}-${(now.getUTCMonth() + 1)
            .toString()
            .padStart(2, '0')}`;
        const target = path.join(
            fs.realpathSync(root),
            'agents',
            'memory',
            'intake',
            `signals-${ym}.jsonl`,
        );
        expect(fs.existsSync(target)).toBe(true);
        const lines = fs
            .readFileSync(target, 'utf-8')
            .split('\n')
            .filter((l) => l.length > 0);
        expect(lines.length).toBe(1);
        const row = JSON.parse(lines[0]!) as Record<string, unknown>;
        expect(row.entry_type).toBe('ownership');
        expect(row.body).toBe('billing owner is team-pay');
    });

    it('rate-limited duplicate returns recorded: false without erroring', async () => {
        const root = tmp();
        const cache = new ToolCache();
        const argsIn = { type: 'ownership', path: 'src/x.ts', body: 'dup' };
        const first = await cache.dispatch('memory_signal', { ...argsIn }, root);
        expect(first.recorded).toBe(true);
        const second = await cache.dispatch('memory_signal', { ...argsIn }, root);
        expect(second.recorded).toBe(false);
        expect(second.skipped).toBe(true);
    });

    it('rejects missing / empty args', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch('memory_signal', { type: 'ownership', path: 'x' }, root),
        ).rejects.toThrow(/'body' must be a non-empty string/);
        await expect(
            cache.dispatch('memory_signal', { type: 'ownership', path: '  ', body: 'y' }, root),
        ).rejects.toThrow(/'path' must be a non-empty string/);
    });

    it('rejects an unknown memory type', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch('memory_signal', { type: 'nope', path: 'x', body: 'y' }, root),
        ).rejects.toThrow(/unknown memory type/);
        // Nothing written on the refused call.
        expect(fs.existsSync(path.join(root, 'agents', 'memory', 'intake'))).toBe(false);
    });
});

function seedRoadmap(root: string): void {
    const dir = path.join(root, 'agents', 'roadmaps');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'road-to-sample.md'),
        [
            '# Roadmap: Sample',
            '',
            '## Phase 1 — First',
            '',
            '- [x] step one',
            '- [ ] step two',
            '- [ ] step three',
            '',
        ].join('\n'),
        'utf-8',
    );
}

describe('tools — roadmap_progress', () => {
    it('dry_run computes counts without writing', async () => {
        const root = tmp();
        seedRoadmap(root);
        const cache = new ToolCache();
        const result = await cache.dispatch('roadmap_progress', { dry_run: true }, root);
        expect(result.written).toBe(false);
        expect(result.roadmaps).toBe(1);
        expect(result.steps_done).toBe(1);
        expect(result.steps_total).toBe(3);
        expect(fs.existsSync(path.join(root, 'agents', 'roadmaps-progress.md'))).toBe(false);
    });

    it('default run writes the dashboard file', async () => {
        const root = tmp();
        seedRoadmap(root);
        const cache = new ToolCache();
        const result = await cache.dispatch('roadmap_progress', {}, root);
        expect(result.written).toBe(true);
        const target = path.join(root, 'agents', 'roadmaps-progress.md');
        expect(fs.existsSync(target)).toBe(true);
        expect(fs.readFileSync(target, 'utf-8')).toContain('# Roadmap Progress');
    });

    it('no roadmaps directory is a clean no-op', async () => {
        const root = tmp();
        const cache = new ToolCache();
        const result = await cache.dispatch('roadmap_progress', {}, root);
        expect(result.written).toBe(false);
        expect(result.roadmaps).toBe(0);
    });
});

describe('tools — roadmap_archive', () => {
    it('returns an empty archive list on a root without roadmaps', async () => {
        const root = tmp();
        const cache = new ToolCache();
        const result = await cache.dispatch('roadmap_archive', {}, root);
        expect(result.archived).toEqual([]);
        expect(result.count).toBe(0);
        expect(result.dashboard_regenerated).toBe(false);
    });
});

describe('tools — capabilities_index', () => {
    it('check mode is read-only and reports drift as a boolean', async () => {
        const cache = new ToolCache();
        const out = path.join(REPO_ROOT, 'CAPABILITIES.yaml');
        const before = fs.existsSync(out) ? fs.readFileSync(out, 'utf-8') : null;
        const result = await cache.dispatch('capabilities_index', { check: true }, REPO_ROOT);
        expect(result.check).toBe(true);
        expect(result.written).toBe(false);
        expect(typeof result.drift).toBe('boolean');
        expect(String(result.path).endsWith('CAPABILITIES.yaml')).toBe(true);
        const after = fs.existsSync(out) ? fs.readFileSync(out, 'utf-8') : null;
        expect(after).toBe(before);
    });

    it('refuses to write outside the consumer root', async () => {
        const root = tmp(); // canonical CAPABILITIES.yaml is NOT under this tmp root
        const cache = new ToolCache();
        await expect(
            cache.dispatch('capabilities_index', {}, root),
        ).rejects.toThrow(/escapes consumer_root/);
    });
});

describe('tools — doctor_report', () => {
    it(
        'returns the structured report shape against the repo root',
        async () => {
            const cache = new ToolCache();
            const result = await cache.dispatch('doctor_report', {}, REPO_ROOT);
            expect(typeof result.project_root).toBe('string');
            expect(Array.isArray(result.checks)).toBe(true);
            const checks = result.checks as Record<string, unknown>[];
            expect(checks.length).toBeGreaterThan(0);
            for (const check of checks) {
                expect(typeof check.id).toBe('string');
                expect(['ok', 'warn', 'fail', 'skipped']).toContain(check.status);
            }
            for (const key of ['missing', 'modified', 'foreign', 'tag_drift']) {
                expect(Array.isArray(result[key])).toBe(true);
            }
            // Tolerate failing checks — assert shape, not pass.
            expect(['ok', 'fail']).toContain(result.status);
        },
        120_000,
    );
});

describe('tools — telemetry_report', () => {
    it('returns the parsed empty-but-valid report on a bare root', async () => {
        const root = tmp();
        const cache = new ToolCache();
        const result = await cache.dispatch('telemetry_report', { window_days: 7 }, root);
        expect(result.schema_version).toBe(1);
        const summary = result.summary as Record<string, unknown>;
        expect(summary.parsed_events).toBe(0);
        expect(summary.since_label).toBe('last 7d');
        expect(typeof result.buckets).toBe('object');
        expect(typeof result.outcomes).toBe('object');
    });

    it('rejects a non-positive window', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch('telemetry_report', { window_days: 0 }, root),
        ).rejects.toThrow(/'window_days' must be a positive integer/);
    });
});

describe('tools — council_estimate', () => {
    it(
        'returns a cost-shaped object for a small temp file',
        async () => {
            const root = tmp();
            fs.writeFileSync(
                path.join(root, '.agent-settings.yml'),
                [
                    'ai_council:',
                    '  enabled: true',
                    '  min_rounds: 2',
                    '  members:',
                    '    anthropic:',
                    '      enabled: true',
                    '      mode: manual',
                    '      model: manual-only',
                    '',
                ].join('\n'),
                'utf-8',
            );
            fs.writeFileSync(
                path.join(root, 'question.md'),
                '# Question\n\nShould we ship the thing?\n',
                'utf-8',
            );
            // Pin the council config resolution to a nonexistent path so the
            // seeded project settings stay authoritative regardless of any
            // user-global ~/.event4u council config on the host.
            const prevEnv = process.env.AI_COUNCIL_CONFIG;
            process.env.AI_COUNCIL_CONFIG = path.join(root, 'no-such-council.yml');
            let result: Record<string, unknown>;
            try {
                const cache = new ToolCache();
                result = await cache.dispatch(
                    'council_estimate',
                    { input_path: 'question.md' },
                    root,
                );
            } finally {
                if (prevEnv === undefined) {
                    delete process.env.AI_COUNCIL_CONFIG;
                } else {
                    process.env.AI_COUNCIL_CONFIG = prevEnv;
                }
            }
            expect(typeof result.mode).toBe('string');
            expect(result.rounds).toBe(2);
            for (const key of ['low_usd', 'expected_usd', 'high_usd']) {
                expect(typeof result[key]).toBe('number');
            }
            expect(Array.isArray(result.per_member)).toBe(true);
            expect(Array.isArray(result.subscription_members)).toBe(true);
            // The manual member is subscription-tier (billable=false).
            const subs = result.subscription_members as Record<string, unknown>[];
            expect(subs.some((m) => m.name === 'anthropic')).toBe(true);
        },
        60_000,
    );

    it('rejects a missing input_path', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(
            cache.dispatch('council_estimate', { input_path: 'nope.md' }, root),
        ).rejects.toThrow(/input_path not found/);
    });

    it('rejects an invalid depth', async () => {
        const root = tmp();
        fs.writeFileSync(path.join(root, 'q.md'), 'x\n', 'utf-8');
        const cache = new ToolCache();
        await expect(
            cache.dispatch('council_estimate', { input_path: 'q.md', depth: 'max' }, root),
        ).rejects.toThrow(/'depth' must be 'shallow' or 'deep'/);
    });
});

// ----------------------------------------------------------------------
// Golden structure — the TS tools layer alone (python-free intent
// conversion of the retired python3 parity block).
// ----------------------------------------------------------------------

describe('golden structure — registry + envelopes', () => {
    it('REGISTRY is the disjoint union of ALLOWLIST and CATALOG_STUBS', () => {
        const allow = Object.keys(ALLOWLIST).sort();
        const stubs = [...STUB_NAMES].sort();
        expect(allow.filter((n) => stubs.includes(n))).toEqual([]);
        expect(Object.keys(REGISTRY).sort()).toEqual([...allow, ...stubs].sort());
    });

    it('to_mcp_tool_meta emits exactly the wire envelope for every allowlist tool', () => {
        for (const [name, tool] of Object.entries(ALLOWLIST)) {
            const meta = to_mcp_tool_meta(tool);
            expect(Object.keys(meta).sort()).toEqual(['description', 'inputSchema', 'name']);
            expect(meta.name).toBe(name);
            expect((meta.description as string).trim()).toBeTruthy();
            expect(meta.inputSchema).toEqual(tool.input_schema);
            // Canonical JSON round-trip is lossless (wire-safe values only).
            expect(canonical(meta)).toEqual(JSON.parse(JSON.stringify(meta)));
        }
    });

    it('stub dispatch envelope is deterministic across roots', async () => {
        const cache = new ToolCache();
        const first = await cache.dispatch('compile_router', {}, tmp());
        const second = await cache.dispatch('compile_router', {}, tmp());
        expect(canonical(first)).toEqual(canonical(second));
        expect(Object.keys(first).sort()).toEqual([
            'alternative',
            'code',
            'install_hint',
            'message',
            'tool',
            'transport',
        ]);
        expect(first.code).toBe('not_implemented');
        expect(first.tool).toBe('compile_router');
    });
});

// ----------------------------------------------------------------------
// run_tests — Phase 5 shell-exec pilot (compiled safety envelope)
// ----------------------------------------------------------------------

describe('tools — run_tests (shell-exec pilot)', () => {
    /** Seed a fake vitest entry in a tmp consumer root so the pilot's
     * fixed argv (`node node_modules/vitest/vitest.mjs run …`) executes a
     * hermetic script instead of a real (slow, nested) vitest run. */
    function seedFakeVitest(root: string, body: string): void {
        const dir = path.join(root, 'node_modules', 'vitest');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'vitest.mjs'), body, 'utf8');
    }

    it('runs the project vitest entry via fixed argv and reports success', async () => {
        const root = tmp();
        seedFakeVitest(
            root,
            'console.log("argv:", JSON.stringify(process.argv.slice(2)));\n' +
                'process.exit(0);\n',
        );
        const cache = new ToolCache();
        const result = await cache.dispatch('run_tests', { filter: 'my test' }, root);
        expect(result.runner).toBe('vitest');
        expect(result.passed).toBe(true);
        expect(result.exit_code).toBe(0);
        expect(result.timed_out).toBe(false);
        // Caller strings arrive as literal argv elements — never shell-parsed.
        expect(result.stdout as string).toContain('"run"');
        expect(result.stdout as string).toContain('"--testNamePattern"');
        expect(result.stdout as string).toContain('"my test"');
    });

    it('surfaces a failing suite as passed=false with the exit code', async () => {
        const root = tmp();
        seedFakeVitest(root, 'console.error("1 test failed");\nprocess.exit(1);\n');
        const cache = new ToolCache();
        const result = await cache.dispatch('run_tests', {}, root);
        expect(result.passed).toBe(false);
        expect(result.exit_code).toBe(1);
        expect(result.stderr as string).toContain('1 test failed');
    });

    it('rejects a path escaping the consumer root', async () => {
        const root = tmp();
        seedFakeVitest(root, 'process.exit(0);\n');
        const cache = new ToolCache();
        await expect(
            cache.dispatch('run_tests', { path: '../outside' }, root),
        ).rejects.toThrow(/escapes consumer_root/);
    });

    it('refuses non-vitest projects with a structured error', async () => {
        const root = tmp();
        const cache = new ToolCache();
        await expect(cache.dispatch('run_tests', {}, root)).rejects.toThrow(
            /vitest projects only/,
        );
    });

    it('catalog entry is implemented on stdio and mirrors the allowlist description', async () => {
        const { load_catalog } = await import('../../src/scripts/mcp_server/catalog.js');
        const entry = load_catalog().find((e) => e.name === 'run_tests');
        expect(entry).toBeDefined();
        expect(entry!.implemented_on).toEqual(['stdio']);
        expect(entry!.description).toBe(ALLOWLIST.run_tests!.description);
        expect(canonical(entry!.input_schema)).toEqual(
            canonical(ALLOWLIST.run_tests!.input_schema),
        );
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
