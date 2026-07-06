// Tests for the runtime registry — 1:1 port of tests/test_runtime_registry.py
// (py2ts Phase 8 / Wave 8h), plus CLI intent tests exercising the tsx CLI on
// the real repo. The CLI output is cross-checked against the in-process
// `build_registry()` (deterministic — discover_skills sorts), so the tests
// stay green as the repo's skill inventory evolves.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    SkillRuntime,
    build_registry,
    discover_skills,
    parse_skill_runtime,
    validate_registry,
} from '../../src/scripts/runtime_registry.js';
import { REPO_ROOT, runTs } from './_wave8h.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-registry-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** Helper mirroring write_skill() in the pytest suite. */
function writeSkill(tmpPath: string, name: string, frontmatter: string): string {
    const skillDir = path.join(tmpPath, '.agent-src.uncondensed', 'skills', name);
    fs.mkdirSync(skillDir, { recursive: true });
    const p = path.join(skillDir, 'SKILL.md');
    const content = `---
name: ${name}
description: "Test skill for ${name}"
${frontmatter}---

# ${name}

## When to use

* Testing

## Procedure

1. Inspect current state
2. Apply change
3. Validate result

## Output format

1. Result
2. Next step

## Gotchas

* Test gotcha

## Do NOT

* Do NOT skip
`;
    fs.writeFileSync(p, content, 'utf-8');
    return p;
}

describe('runtime_registry — 1:1 port of test_runtime_registry.py', () => {
    it('test_discover_finds_skills', () => {
        writeSkill(tmp, 'skill-a', '');
        writeSkill(tmp, 'skill-b', 'execution:\n  type: manual\n');
        const found = discover_skills(tmp);
        expect(found.length).toBe(2);
    });

    it('test_parse_skill_without_execution_returns_none', () => {
        const p = writeSkill(tmp, 'no-exec', '');
        const result = parse_skill_runtime(p);
        expect(result).toBeNull();
    });

    it('test_parse_skill_with_manual_execution', () => {
        const p = writeSkill(tmp, 'manual-skill', 'execution:\n  type: manual\n');
        const result = parse_skill_runtime(p);
        expect(result).not.toBeNull();
        expect(result?.execution_type).toBe('manual');
        expect(result?.handler).toBe('none');
        expect(result?.is_executable).toBe(false);
    });

    it('test_parse_skill_with_assisted_execution', () => {
        const p = writeSkill(
            tmp,
            'assisted-skill',
            'execution:\n  type: assisted\n  handler: internal\n  allowed_tools:\n    - github\n',
        );
        const result = parse_skill_runtime(p);
        expect(result).not.toBeNull();
        expect(result?.execution_type).toBe('assisted');
        expect(result?.handler).toBe('internal');
        expect(result?.is_executable).toBe(true);
        expect(result?.allowed_tools).toEqual(['github']);
    });

    it('test_parse_skill_with_automated_execution', () => {
        const p = writeSkill(
            tmp,
            'auto-skill',
            'execution:\n  type: automated\n  handler: shell\n  timeout_seconds: 60\n  safety_mode: strict\n  allowed_tools: []\n',
        );
        const result = parse_skill_runtime(p);
        expect(result).not.toBeNull();
        expect(result?.execution_type).toBe('automated');
        expect(result?.handler).toBe('shell');
        expect(result?.timeout_seconds).toBe(60);
        expect(result?.safety_mode).toBe('strict');
        expect(result?.is_automated).toBe(true);
    });

    it('test_build_registry_only_includes_execution_skills', () => {
        writeSkill(tmp, 'no-exec', '');
        writeSkill(tmp, 'manual', 'execution:\n  type: manual\n');
        writeSkill(tmp, 'assisted', 'execution:\n  type: assisted\n  handler: internal\n');
        const registry = build_registry(tmp);
        expect(registry.length).toBe(2);
        const names = new Set(registry.map((s) => s.name));
        expect(names.has('manual')).toBe(true);
        expect(names.has('assisted')).toBe(true);
        expect(names.has('no-exec')).toBe(false);
    });

    it('test_validate_registry_passes_for_valid', () => {
        writeSkill(
            tmp,
            'valid-auto',
            'execution:\n  type: automated\n  handler: shell\n  safety_mode: strict\n  allowed_tools: []\n',
        );
        const registry = build_registry(tmp);
        const errors = validate_registry(registry);
        expect(errors.length).toBe(0);
    });

    it('test_validate_registry_catches_automated_without_handler', () => {
        const skill = new SkillRuntime({
            name: 'bad-auto',
            path: 'test',
            description: '',
            execution_type: 'automated',
            handler: 'none',
            timeout_seconds: 30,
            safety_mode: 'strict',
            allowed_tools: [],
        });
        const errors = validate_registry([skill]);
        expect(errors.some((e) => e.includes("handler 'none'"))).toBe(true);
    });

    it('test_validate_registry_catches_automated_without_safety', () => {
        const skill = new SkillRuntime({
            name: 'bad-safety',
            path: 'test',
            description: '',
            execution_type: 'automated',
            handler: 'shell',
            timeout_seconds: 30,
            safety_mode: null,
            allowed_tools: [],
        });
        const errors = validate_registry([skill]);
        expect(errors.some((e) => e.includes('safety_mode'))).toBe(true);
    });
});

describe('runtime_registry — CLI (real repo, tsx)', () => {
    it('--format json matches the in-process build_registry()', () => {
        const r = runTs('runtime_registry', ['--root', REPO_ROOT, '--format', 'json']);
        expect(r.status).toBe(0);
        const emitted = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
        const registry = build_registry(REPO_ROOT);
        expect(emitted.length).toBe(registry.length);
        expect(emitted.length).toBeGreaterThan(0);
        // discover_skills() sorts the paths → deterministic order.
        expect(emitted.map((e) => e.name)).toEqual(registry.map((s) => s.name));
        for (const entry of emitted) {
            for (const key of [
                'name',
                'path',
                'description',
                'execution_type',
                'handler',
                'timeout_seconds',
                'safety_mode',
                'allowed_tools',
            ]) {
                expect(Object.keys(entry), String(entry.name)).toContain(key);
            }
        }
    });

    it('--format text lists the registry count + every skill name', () => {
        const r = runTs('runtime_registry', ['--root', REPO_ROOT]);
        expect(r.status).toBe(0);
        const registry = build_registry(REPO_ROOT);
        expect(r.stdout.startsWith(`Runtime-capable skills: ${registry.length}\n`)).toBe(true);
        for (const s of registry) {
            expect(r.stdout).toContain(`\n  ${s.name}\n`);
        }
    });

    it('--validate reports a valid registry with the correct count', () => {
        const r = runTs('runtime_registry', ['--root', REPO_ROOT, '--validate']);
        expect(r.status).toBe(0);
        expect(r.stderr).toBe('');
        const registry = build_registry(REPO_ROOT);
        expect(r.stdout).toBe(`Registry valid: ${registry.length} runtime-capable skills\n`);
    });
});
