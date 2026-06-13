// Parity tests for the src/scripts/mcp_server/ foundation twins
// (catalog.ts, metadata.ts, telemetry.ts, prompts.ts, resources.ts).
//
// Ported 1:1 from the loader / metadata / telemetry / catalog / resource
// layers of tests/test_mcp_server.py. The server layer (mcp SDK, build_server)
// belongs to server.ts and is out of scope here.
//
// Plus a golden-parity block: python3 loader output vs the TS twin on the
// REAL repo, compared on canonicalized structure. OS-order-sensitive fields
// are NOT excluded here because both sides apply the same pathlib
// component-wise sort + wire-name / uri sort, so the merged order is
// deterministic and comparable.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    REPO_ROOT,
    bumpMtime,
    hasPython3,
    makeTmpDir,
    runPyInline,
    writeFile,
} from './_mcp_server.js';

import {
    NOT_IMPLEMENTED_CODE,
    install_hint,
    load_catalog,
    load_raw,
    not_implemented_envelope,
} from '../../src/scripts/mcp_server/catalog.js';
import {
    boot_log_line,
    compute_skill_set_signature,
    read_package_version,
} from '../../src/scripts/mcp_server/metadata.js';
import {
    build_record,
    hash_client_id,
    record_call,
} from '../../src/scripts/mcp_server/telemetry.js';
import {
    PHASE_1_SKILLS,
    PromptCache,
    type SkillPrompt,
    load_all_prompts,
    load_phase_1_prompts,
    load_skill,
    scan_commands,
    scan_skills,
    to_mcp_prompt_meta,
} from '../../src/scripts/mcp_server/prompts.js';
import {
    MIME_MARKDOWN,
    ResourceCache,
    load_all_resources,
    scan_contexts,
    scan_guidelines,
    scan_rules,
    to_mcp_resource_meta,
} from '../../src/scripts/mcp_server/resources.js';

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
    const d = makeTmpDir();
    tmpDirs.push(d);
    return d;
}

function mkPrompt(over: Partial<SkillPrompt>): SkillPrompt {
    return {
        name: '',
        description: '',
        body: '',
        source: 'package',
        kind: 'skill',
        recommended_for_user_types: [],
        user_type_match: '',
        ...over,
    };
}

// ----------------------------------------------------------------------
// Loader layer — Phase 1 A4
// ----------------------------------------------------------------------

describe('prompts loader — Phase 1 A4', () => {
    it('PHASE_1_SKILLS constant is 5', () => {
        expect(PHASE_1_SKILLS.length).toBe(5);
        expect(new Set(PHASE_1_SKILLS).size).toBe(5);
    });

    it('load_phase_1_prompts returns 5 entries', () => {
        const prompts = load_phase_1_prompts();
        expect(prompts.length).toBe(5);
        expect(new Set(prompts.map((p) => p.name))).toEqual(new Set(PHASE_1_SKILLS));
    });

    it('each prompt has non-empty body + description', () => {
        for (const prompt of load_phase_1_prompts()) {
            expect(prompt.description.trim()).toBeTruthy();
            expect(prompt.body.trim()).toBeTruthy();
            expect(prompt.body.startsWith('---\n')).toBe(false);
        }
    });

    it('load_skill strips frontmatter', () => {
        const prompt = load_skill('verify-completion-evidence');
        expect(prompt.name).toBe('verify-completion-evidence');
        expect(prompt.body.split('\n')[0]).not.toContain('name:');
        expect(prompt.body.split('\n')[0]).not.toContain('stability:');
        expect(['package', 'project']).toContain(prompt.source);
    });

    it('load_skill missing raises', () => {
        expect(() => load_skill('definitely-not-a-skill-12345')).toThrow();
    });

    it('to_mcp_prompt_meta shape for skill', () => {
        const meta = to_mcp_prompt_meta(
            mkPrompt({ name: 'example', description: 'desc', body: 'body' }),
        );
        expect(meta.name).toBe('skill.example');
        expect(meta.title).toBe('example');
        expect(meta.description).toBe('desc');
        expect(meta.arguments).toEqual([]);
        expect(meta._meta).toEqual({ source: 'package', kind: 'skill' });
    });

    it('to_mcp_prompt_meta shape for command (hyphen slug)', () => {
        const meta = to_mcp_prompt_meta(
            mkPrompt({ name: 'research-report', description: 'desc', body: 'body', kind: 'command' }),
        );
        expect(meta.name).toBe('command.research-report');
        expect(meta.title).toBe('research-report');
        expect(meta._meta).toEqual({ source: 'package', kind: 'command' });
    });

    it('to_mcp_prompt_meta tolerates legacy colon names', () => {
        const meta = to_mcp_prompt_meta(
            mkPrompt({ name: 'research:report', description: 'desc', body: 'body', kind: 'command' }),
        );
        expect(meta.name).toBe('command.research.report');
    });
});

// ----------------------------------------------------------------------
// Phase 2 — scan_skills, scan_commands, load_all_prompts, PromptCache
// ----------------------------------------------------------------------

describe('prompts loader — Phase 2', () => {
    it('scan_skills finds all SKILL.md', () => {
        const [prompts, errors] = scan_skills();
        expect(errors).toEqual([]);
        expect(prompts.length).toBeGreaterThan(100);
        for (const prompt of prompts) {
            expect(prompt.kind).toBe('skill');
            expect(prompt.description.trim()).toBeTruthy();
            expect(prompt.body.trim()).toBeTruthy();
        }
    });

    it('scan_commands finds nested commands', () => {
        const [prompts, errors] = scan_commands();
        expect(errors).toEqual([]);
        expect(prompts.length).toBeGreaterThan(50);
        const names = new Set(prompts.map((p) => p.name));
        expect(names.has('fix-ci')).toBe(true);
        expect([...names].some((n) => n.includes(':'))).toBe(false);
        for (const prompt of prompts) {
            expect(prompt.kind).toBe('command');
        }
    });

    it('load_all_prompts returns sorted unique', () => {
        const [prompts] = load_all_prompts();
        const wire = prompts.map((p) => to_mcp_prompt_meta(p).name as string);
        expect(wire).toEqual([...wire].sort());
        expect(new Set(wire).size).toBe(wire.length);
    });

    it('load_all_prompts skips malformed (B3)', () => {
        const root = tmp();
        const skills = path.join(root, 'dist/agent-src', 'skills');
        writeFile(
            path.join(skills, 'good-skill', 'SKILL.md'),
            '---\nname: good-skill\ndescription: "OK"\n---\nbody\n',
        );
        writeFile(
            path.join(skills, 'no-description', 'SKILL.md'),
            '---\nname: no-description\n---\nbody\n',
        );
        const [prompts, errors] = load_all_prompts(root);
        expect(prompts.map((p) => p.name)).toEqual(['good-skill']);
        expect(errors.some((e) => e.includes('missing frontmatter description'))).toBe(true);
    });

    it('PromptCache hot-reloads on mtime change (B5)', () => {
        const root = tmp();
        const skillMd = path.join(root, 'dist/agent-src', 'skills', 'demo', 'SKILL.md');
        writeFile(skillMd, '---\nname: demo\ndescription: "v1"\n---\nbody-v1\n');
        const cache = new PromptCache(root);
        const [p1] = cache.get();
        expect(p1[0]!.description).toBe('v1');
        writeFile(skillMd, '---\nname: demo\ndescription: "v2"\n---\nbody-v2\n');
        bumpMtime(skillMd);
        const [p2] = cache.get();
        expect(p2[0]!.description).toBe('v2');
    });

    it('PromptCache lookup uses wire name', () => {
        const root = tmp();
        writeFile(
            path.join(root, 'dist/agent-src', 'skills', 'demo', 'SKILL.md'),
            '---\nname: demo\ndescription: "desc"\n---\nbody\n',
        );
        const cache = new PromptCache(root);
        expect(cache.lookup('skill.demo')).not.toBeNull();
        expect(cache.lookup('skill.missing')).toBeNull();
    });
});

// ----------------------------------------------------------------------
// Phase 3 (step-9 user-type axis) — runtime filter
// ----------------------------------------------------------------------

function seedUserTypeTree(root: string): void {
    const skills = path.join(root, 'dist/agent-src', 'skills');
    writeFile(
        path.join(skills, 'match-skill', 'SKILL.md'),
        '---\nname: match-skill\ndescription: "matches"\n' +
            'recommended_for_user_types: [developer, founder]\n---\nbody\n',
    );
    writeFile(
        path.join(skills, 'universal-skill', 'SKILL.md'),
        '---\nname: universal-skill\ndescription: "no filter"\n---\nbody\n',
    );
    writeFile(
        path.join(skills, 'outside-skill', 'SKILL.md'),
        '---\nname: outside-skill\ndescription: "other axis"\n' +
            'recommended_for_user_types: [consultant]\n---\nbody\n',
    );
}

describe('prompts loader — Phase 3 user-type axis', () => {
    it('no filter keeps alpha order', () => {
        const root = tmp();
        seedUserTypeTree(root);
        const cache = new PromptCache(root);
        const [prompts] = cache.get();
        expect(cache.active_user_type).toBe('');
        expect(prompts.map((p) => p.name)).toEqual([
            'match-skill',
            'outside-skill',
            'universal-skill',
        ]);
        for (const p of prompts) {
            expect(p.user_type_match).toBe('');
            expect('user_type_match' in (to_mcp_prompt_meta(p)._meta as object)).toBe(false);
        }
    });

    it('active user_type sorts match first', () => {
        const root = tmp();
        seedUserTypeTree(root);
        writeFile(path.join(root, '.agent-settings.yml'), 'personal:\n  user_type: developer\n');
        const cache = new PromptCache(root);
        const [prompts] = cache.get();
        expect(cache.active_user_type).toBe('developer');
        expect(prompts.map((p) => p.name)).toEqual([
            'match-skill',
            'universal-skill',
            'outside-skill',
        ]);
        const labels = Object.fromEntries(prompts.map((p) => [p.name, p.user_type_match]));
        expect(labels).toEqual({
            'match-skill': 'match',
            'universal-skill': 'universal',
            'outside-skill': 'outside',
        });
        for (const p of prompts) {
            const meta = to_mcp_prompt_meta(p)._meta as Record<string, unknown>;
            expect(meta.user_type_match).toBe(p.user_type_match);
        }
    });

    it('placeholder disables filter', () => {
        const root = tmp();
        seedUserTypeTree(root);
        writeFile(
            path.join(root, '.agent-settings.yml'),
            'personal:\n  user_type: "__USER_TYPE__"\n',
        );
        const cache = new PromptCache(root);
        cache.get();
        expect(cache.active_user_type).toBe('');
    });

    it('settings flip invalidates cache', () => {
        const root = tmp();
        seedUserTypeTree(root);
        const settings = path.join(root, '.agent-settings.yml');
        writeFile(settings, 'personal:\n  user_type: developer\n');
        const cache = new PromptCache(root);
        const [first] = cache.get();
        expect(first[0]!.name).toBe('match-skill');
        writeFile(settings, 'personal:\n  user_type: consultant\n');
        bumpMtime(settings);
        const [second] = cache.get();
        expect(cache.active_user_type).toBe('consultant');
        expect(second[0]!.name).toBe('outside-skill');
    });
});

// ----------------------------------------------------------------------
// Resources (C1–C4)
// ----------------------------------------------------------------------

describe('resources loader', () => {
    it('discovers three kinds with stable URIs', () => {
        const [resources, errors] = load_all_resources();
        expect(errors).toEqual([]);
        expect(resources.length).toBeGreaterThan(0);
        expect(new Set(resources.map((r) => r.kind))).toEqual(
            new Set(['rule', 'guideline', 'context']),
        );
        const [rules] = scan_rules();
        const [guidelines] = scan_guidelines();
        const [contexts] = scan_contexts();
        expect(rules.every((r) => r.uri.startsWith('rule://'))).toBe(true);
        expect(guidelines.every((r) => r.uri.startsWith('guideline://'))).toBe(true);
        expect(contexts.every((r) => r.uri.startsWith('context://'))).toBe(true);
        expect(rules.length + guidelines.length + contexts.length).toBe(resources.length);
    });

    it('URIs unique and sorted', () => {
        const [resources] = load_all_resources();
        const uris = resources.map((r) => r.uri);
        expect(uris).toEqual([...uris].sort());
        expect(new Set(uris).size).toBe(uris.length);
    });

    it('meta shape for MCP', () => {
        const [resources] = load_all_resources();
        const sample = resources[0]!;
        const meta = to_mcp_resource_meta(sample);
        expect(meta.mimeType).toBe(MIME_MARKDOWN);
        expect(meta.uri).toBe(sample.uri);
        expect(meta.name).toBeTruthy();
        expect(meta.description).toBeTruthy();
        expect((meta._meta as Record<string, unknown>).kind).toBe(sample.kind);
    });

    it('ResourceCache invalidates on mtime (C4)', () => {
        const root = tmp();
        const ruleMd = path.join(root, 'dist/agent-src', 'rules', 'demo.md');
        writeFile(ruleMd, '---\ndescription: "v1"\n---\n# Demo\n\nbody v1\n');
        const cache = new ResourceCache(root);
        const [first] = cache.get();
        expect(first.map((r) => r.description)).toEqual(['v1']);
        writeFile(ruleMd, '---\ndescription: "v2"\n---\n# Demo\n\nbody v2\n');
        bumpMtime(ruleMd);
        const [second] = cache.get();
        expect(second.map((r) => r.description)).toEqual(['v2']);
    });

    it('signature property exposes tracked files', () => {
        const cache = new ResourceCache();
        cache.get();
        const sig = cache.signature;
        expect(Array.isArray(sig)).toBe(true);
        expect(sig.length).toBeGreaterThan(0);
        for (const entry of sig) {
            expect(entry.length).toBe(2);
            expect(typeof entry[0]).toBe('string');
            expect(typeof entry[1]).toBe('number');
        }
    });
});

// ----------------------------------------------------------------------
// Metadata — Phase 6 F1
// ----------------------------------------------------------------------

describe('metadata', () => {
    it('read_package_version returns a semver string', () => {
        const version = read_package_version(REPO_ROOT);
        expect(version).not.toBe('unknown');
        expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('read_package_version missing returns unknown', () => {
        const root = tmp();
        expect(read_package_version(root)).toBe('unknown');
        fs.writeFileSync(path.join(root, 'package.json'), 'not json');
        expect(read_package_version(root)).toBe('unknown');
        fs.writeFileSync(path.join(root, 'package.json'), '{}');
        expect(read_package_version(root)).toBe('unknown');
    });

    it('skill_set_signature is deterministic + 12 hex', () => {
        const sigA: ReadonlyArray<readonly [string, number]> = [
            ['a.md', 1.0],
            ['b.md', 2.5],
        ];
        const sigB: ReadonlyArray<readonly [string, number]> = [['c.md', 3.0]];
        const first = compute_skill_set_signature(sigA, sigB);
        const second = compute_skill_set_signature(sigA, sigB);
        expect(first).toBe(second);
        expect(first.length).toBe(12);
        expect(first).toMatch(/^[0-9a-f]{12}$/);
    });

    it('skill_set_signature changes on mtime', () => {
        const base = compute_skill_set_signature([['a.md', 1.0]], [['b.md', 2.0]]);
        const drifted = compute_skill_set_signature([['a.md', 1.1]], [['b.md', 2.0]]);
        expect(base).not.toBe(drifted);
    });

    it('skill_set_signature changes on path set', () => {
        const base = compute_skill_set_signature([['a.md', 1.0]], [['b.md', 2.0]]);
        const added = compute_skill_set_signature(
            [
                ['a.md', 1.0],
                ['new.md', 3.0],
            ],
            [['b.md', 2.0]],
        );
        expect(base).not.toBe(added);
    });

    it('skill_set_signature group framing matters', () => {
        const merged = compute_skill_set_signature([
            ['a.md', 1.0],
            ['b.md', 2.0],
        ]);
        const split = compute_skill_set_signature([['a.md', 1.0]], [['b.md', 2.0]]);
        expect(merged).not.toBe(split);
    });

    it('boot_log_line shape', () => {
        const line = boot_log_line({
            server_version: '0.1.0',
            package_version: '1.36.1',
            skill_set_signature: 'abc123def456',
        });
        expect(line).toContain('serverVersion=0.1.0');
        expect(line).toContain('packageVersion=1.36.1');
        expect(line).toContain('skillSetSignature=abc123def456');
        expect(line.startsWith('mcp-server: identity ')).toBe(true);
    });

    it('PromptCache signature property exposes tracked files', () => {
        const cache = new PromptCache();
        cache.get();
        const sig = cache.signature;
        expect(Array.isArray(sig)).toBe(true);
        expect(sig.length).toBeGreaterThan(0);
        for (const entry of sig) {
            expect(entry.length).toBe(2);
            expect(typeof entry[0]).toBe('string');
            expect(typeof entry[1]).toBe('number');
        }
    });
});

// ----------------------------------------------------------------------
// Telemetry — Phase 1 J4 / J5
// ----------------------------------------------------------------------

function readTelemetry(consumerRoot: string): Array<Record<string, unknown>> {
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
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('telemetry', () => {
    it('record_call writes JSONL under consumer_root', () => {
        const root = tmp();
        const record = record_call({
            tool_name: 'memory_lookup',
            outcome: 'stub',
            transport: 'stdio',
            consumer_root: root,
            client_id_hash_value: 'abc123abc123',
        });
        expect(record).not.toBeNull();
        const target = path.join(root, 'agents', 'runtime', 'mcp-telemetry', 'calls.jsonl');
        expect(fs.existsSync(target)).toBe(true);
        const lines = fs.readFileSync(target, 'utf-8').split('\n').filter((l) => l.length > 0);
        expect(lines.length).toBe(1);
        expect(JSON.parse(lines[0]!)).toEqual({
            tool_name: 'memory_lookup',
            client_id_hash: 'abc123abc123',
            ts: record!.ts,
            transport: 'stdio',
            outcome: 'stub',
        });
    });

    it('record_call appends without overwriting', () => {
        const root = tmp();
        for (const name of ['memory_lookup', 'lint_skills', 'nope']) {
            record_call({
                tool_name: name,
                outcome: 'stub',
                transport: 'stdio',
                consumer_root: root,
                client_id_hash_value: 'abc123abc123',
            });
        }
        const records = readTelemetry(root);
        expect(records.map((r) => r.tool_name)).toEqual(['memory_lookup', 'lint_skills', 'nope']);
    });

    it('record_call swallows write errors', () => {
        const root = tmp();
        // Block the `agents` path with a file so mkdir of a subdir fails.
        fs.writeFileSync(path.join(root, 'agents'), 'not a directory');
        const errs: string[] = [];
        const orig = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((chunk: unknown): boolean => {
            errs.push(String(chunk));
            return true;
        }) as typeof process.stderr.write;
        let record: Record<string, unknown> | null;
        try {
            record = record_call({
                tool_name: 'memory_lookup',
                outcome: 'stub',
                transport: 'stdio',
                consumer_root: root,
                client_id_hash_value: 'abc123abc123',
            });
        } finally {
            process.stderr.write = orig;
        }
        expect(record).toBeNull();
        expect(errs.join('')).toContain('telemetry write failed');
    });

    it('hash_client_id deterministic + truncated', () => {
        const a = hash_client_id('user|host|/repo');
        const b = hash_client_id('user|host|/repo');
        const c = hash_client_id('user|host|/other-repo');
        expect(a).toBe(b);
        expect(a).not.toBe(c);
        expect(a.length).toBe(12);
        expect(a).toMatch(/^[0-9a-f]{12}$/);
    });

    it('build_record produces the five-field envelope, compact JSON, no body', () => {
        const record = build_record({
            tool_name: 'memory_signal',
            outcome: 'stub',
            transport: 'stdio',
            client_id_hash_value: 'abc123abc123',
            ts: '2026-06-13T00:00:00Z',
        });
        expect(Object.keys(record)).toEqual([
            'tool_name',
            'client_id_hash',
            'ts',
            'transport',
            'outcome',
        ]);
        // Compact JSON, no spaces (separators=(",", ":")).
        expect(JSON.stringify(record)).toBe(
            '{"tool_name":"memory_signal","client_id_hash":"abc123abc123",' +
                '"ts":"2026-06-13T00:00:00Z","transport":"stdio","outcome":"stub"}',
        );
    });
});

// ----------------------------------------------------------------------
// Catalog — Phase 1 J3/J5 source-of-truth
// ----------------------------------------------------------------------

describe('catalog', () => {
    it('load_catalog returns entries in file order with the expected shape', () => {
        const entries = load_catalog();
        expect(entries.length).toBeGreaterThan(0);
        for (const e of entries) {
            expect(typeof e.name).toBe('string');
            expect(typeof e.description).toBe('string');
            expect(['ro', 'fs-write', 'shell']).toContain(e.side_effect);
            expect(Array.isArray(e.implemented_on)).toBe(true);
            expect(typeof e.input_schema).toBe('object');
        }
    });

    it('load_raw validates and returns schema_version 1', () => {
        const raw = load_raw();
        expect(raw.schema_version).toBe(1);
        expect(Array.isArray(raw.tools)).toBe(true);
    });

    it('install_hint returns a string', () => {
        expect(typeof install_hint()).toBe('string');
    });

    it('not_implemented_envelope shape', () => {
        const env = not_implemented_envelope('compile_router', {
            transport: 'worker',
            install_hint_value: 'npx foo',
        });
        expect(env.code).toBe(NOT_IMPLEMENTED_CODE);
        expect(env.tool).toBe('compile_router');
        expect(env.transport).toBe('worker');
        expect(env.install_hint).toBe('npx foo');
        expect(env.alternative).toBe('stdio');
        expect(env.message).toContain('discovery catalog');
    });

    it('_validate rejects bad schema_version', () => {
        const root = tmp();
        const bad = path.join(root, 'cat.json');
        fs.writeFileSync(bad, JSON.stringify({ schema_version: 2, tools: [] }));
        expect(() => load_raw(bad)).toThrow(/unsupported schema_version/);
    });

    it('_validate rejects empty tools', () => {
        const root = tmp();
        const bad = path.join(root, 'cat.json');
        fs.writeFileSync(bad, JSON.stringify({ schema_version: 1, tools: [] }));
        expect(() => load_raw(bad)).toThrow(/non-empty list/);
    });

    it('_validate rejects bad side_effect', () => {
        const root = tmp();
        const bad = path.join(root, 'cat.json');
        fs.writeFileSync(
            bad,
            JSON.stringify({
                schema_version: 1,
                tools: [{ name: 'x', description: 'd', side_effect: 'bogus', input_schema: {} }],
            }),
        );
        expect(() => load_raw(bad)).toThrow(/invalid side_effect/);
    });
});

// ----------------------------------------------------------------------
// Golden parity — python3 loaders vs TS twin on the REAL repo.
// Both sides apply the same pathlib component-wise sort + wire-name / uri
// sort, so the merged order is deterministic and directly comparable.
// ----------------------------------------------------------------------

describe.runIf(hasPython3())('golden parity vs python3', () => {
    it('load_all_prompts: structure byte-identical', () => {
        const py = runPyInline(
            'import json,sys; sys.path.insert(0,"src"); ' +
                'from scripts.mcp_server.prompts import load_all_prompts, to_mcp_prompt_meta; ' +
                'p,e=load_all_prompts(); ' +
                'print(json.dumps({"errors":e,"metas":[to_mcp_prompt_meta(x) for x in p]}, sort_keys=True))',
            { cwd: REPO_ROOT },
        );
        expect(py.status).toBe(0);
        const pyObj = JSON.parse(py.stdout);
        const [prompts, errors] = load_all_prompts(REPO_ROOT);
        const tsObj = { errors, metas: prompts.map((p) => to_mcp_prompt_meta(p)) };
        // Canonicalize via JSON round-trip with sorted keys on both sides.
        expect(canonical(tsObj)).toEqual(canonical(pyObj));
    });

    it('load_all_resources: structure byte-identical', () => {
        const py = runPyInline(
            'import json,sys; sys.path.insert(0,"src"); ' +
                'from scripts.mcp_server.resources import load_all_resources, to_mcp_resource_meta; ' +
                'r,e=load_all_resources(); ' +
                'print(json.dumps({"errors":e,"metas":[to_mcp_resource_meta(x) for x in r]}, sort_keys=True))',
            { cwd: REPO_ROOT },
        );
        expect(py.status).toBe(0);
        const pyObj = JSON.parse(py.stdout);
        const [resources, errors] = load_all_resources(REPO_ROOT);
        const tsObj = { errors, metas: resources.map((r) => to_mcp_resource_meta(r)) };
        expect(canonical(tsObj)).toEqual(canonical(pyObj));
    });

    it('catalog: load_catalog names + side_effects + implemented_on match', () => {
        const py = runPyInline(
            'import json,sys; sys.path.insert(0,"src"); ' +
                'from scripts.mcp_server.catalog import load_catalog; ' +
                'print(json.dumps([[c.name,c.side_effect,list(c.implemented_on)] for c in load_catalog()]))',
            { cwd: REPO_ROOT },
        );
        expect(py.status).toBe(0);
        const pyArr = JSON.parse(py.stdout);
        const tsArr = load_catalog().map((c) => [c.name, c.side_effect, [...c.implemented_on]]);
        expect(tsArr).toEqual(pyArr);
    });

    it('compute_skill_set_signature: identical hash on identical input', () => {
        const py = runPyInline(
            'import sys; sys.path.insert(0,"src"); ' +
                'from scripts.mcp_server.metadata import compute_skill_set_signature; ' +
                'print(compute_skill_set_signature(((\"a.md\",1.0),(\"b.md\",2.5)),((\"c.md\",3.0),)))',
            { cwd: REPO_ROOT },
        );
        expect(py.status).toBe(0);
        const ts = compute_skill_set_signature(
            [
                ['a.md', 1.0],
                ['b.md', 2.5],
            ],
            [['c.md', 3.0]],
        );
        expect(ts).toBe(py.stdout.trim());
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
