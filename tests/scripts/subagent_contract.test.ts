/**
 * Tests for the `subagent-v1` contract (ADR-109).
 *
 * Locks two things:
 *   1. The shipped source unit `src/subagents/production-validator.md` conforms
 *      to `src/scripts/schemas/subagent.schema.json` (positive gate).
 *   2. The schema rejects the enum / required violations the determinism guard
 *      exists to catch (negative gates).
 *
 * Uses the validator's own exported library surface (the same one the CI
 * `validate_frontmatter` sweep runs), so this test tracks the real gate.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    apply_schema_defaults,
    load_schema,
    parse_frontmatter,
    validate,
    type YamlValue,
} from '../../src/scripts/validate_frontmatter.js';
import { nativeFieldLines } from '../../src/scripts/_lib/subagent_native_fields.js';
import { render_floor } from '../../src/scripts/generate_subagent_floor.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const _REPO = path.resolve(_HERE, '..', '..');
const _UNIT = path.join(_REPO, 'src', 'subagents', 'production-validator.md');

function _frontmatterOf(file: string): Record<string, YamlValue> {
    const text = fs.readFileSync(file, 'utf-8');
    const [data] = parse_frontmatter(text);
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(`no frontmatter parsed from ${file}`);
    }
    return data as Record<string, YamlValue>;
}

describe('subagent-v1 contract', () => {
    const schema = load_schema('subagent');

    it('the shipped production-validator source unit conforms', () => {
        const data = _frontmatterOf(_UNIT);
        apply_schema_defaults(data, schema);
        const errors = validate(data, schema);
        expect(errors.map((e) => `${e.path}: ${e.message}`)).toEqual([]);
    });

    it('rejects a model_tier outside the enum', () => {
        const data = _frontmatterOf(_UNIT);
        data.model_tier = 'gpt-ultra';
        const errors = validate(data, schema);
        expect(errors.some((e) => e.path === '$.model_tier' && e.rule === 'enum')).toBe(true);
    });

    // The base name is still closed — a typo must fail CI rather than reach a
    // user's `.claude/agents/` YAML. What changed is HOW: the field moved from
    // a bare enum to a pattern, so the scoped-grant syntax `tool-safety`
    // prescribes became expressible at all. These assert the BEHAVIOUR (is it
    // rejected, is it accepted) rather than which keyword did the rejecting,
    // so the next representation change cannot red a test whose subject has
    // not moved.
    it('rejects a tool outside the Claude Code tool set', () => {
        const data = _frontmatterOf(_UNIT);
        data.tools = ['Read', 'curl'];
        const errors = validate(data, schema);
        expect(errors.some((e) => e.path.startsWith('$.tools['))).toBe(true);
    });

    it('accepts a scoped grant — the syntax tool-safety asks for', () => {
        const data = _frontmatterOf(_UNIT);
        data.tools = ['Read', 'Bash(npm test:*)', 'Bash(git status:*)'];
        const errors = validate(data, schema);
        expect(errors.filter((e) => e.path.startsWith('$.tools['))).toEqual([]);
    });

    it('rejects a scope on a tool name that does not exist', () => {
        // Scoping must not become a hole in the closed base-name set.
        const data = _frontmatterOf(_UNIT);
        data.tools = ['Frobnicate(anything:*)'];
        const errors = validate(data, schema);
        expect(errors.some((e) => e.path.startsWith('$.tools['))).toBe(true);
    });

    it('rejects a malformed scope', () => {
        for (const bad of ['Bash(', 'Bash()', 'Bash(a)(b)', 'Bash (npm:*)']) {
            const data = _frontmatterOf(_UNIT);
            data.tools = [bad];
            expect(
                validate(data, schema).some((e) => e.path.startsWith('$.tools[')),
                `expected ${bad} to be rejected`,
            ).toBe(true);
        }
    });

    it('rejects a missing required governance field', () => {
        const data = _frontmatterOf(_UNIT);
        delete data.trust;
        const errors = validate(data, schema);
        expect(errors.some((e) => e.rule === 'required' && e.path === '$.trust')).toBe(true);
    });

    it('schema_version is pinned to subagent-v1', () => {
        const data = _frontmatterOf(_UNIT);
        expect(data.schema_version).toBe('subagent-v1');
    });
});

// road-to-a-cold-start-paid-once, Phase 2. The schema opens the host's reuse
// and loading knobs under vendor-neutral names; only the projector knows the
// host spelling, the way it already does for `model_tier`.
describe('subagent-v1 reuse and loading fields', () => {
    const schema = load_schema('subagent');
    const _AGENTS = path.join(_REPO, 'src', 'subagents');
    const _definitions = (): string[] =>
        fs
            .readdirSync(_AGENTS)
            .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
            .map((f) => path.join(_AGENTS, f));

    it('reuse-field-projects-to-host-spelling', () => {
        const data = _frontmatterOf(_UNIT);
        Object.assign(data, {
            reuse: 'continuity',
            max_turns: 12,
            background: true,
            preload_skills: ['quality-tools'],
            omit_project_instructions: true,
            cache_ttl: '1h',
        });
        data.tools = ['Read', 'SendMessage'];
        expect(validate(data, schema).map((e) => `${e.path}: ${e.message}`)).toEqual([]);

        const lines = nativeFieldLines(data as Record<string, unknown>);
        expect(lines).toContain('maxTurns: 12\n');
        expect(lines).toContain('background: true\n');
        expect(lines).toContain('skills: [quality-tools]\n');
        expect(lines).toContain('omitClaudeMd: true\n');
        // No neutral spelling leaks into the native file, and the two fields
        // with no per-definition host key stay with their readers.
        for (const neutral of ['reuse', 'max_turns', 'preload_skills', 'omit_project_instructions', 'cache_ttl']) {
            expect(lines).not.toMatch(new RegExp(`^${neutral}:`, 'm'));
        }
        expect(nativeFieldLines({ reuse: 'never' })).toBe('');
    });

    it('rejects a reuse class outside continuity / never', () => {
        const data = _frontmatterOf(_UNIT);
        data.reuse = 'sometimes';
        expect(validate(data, schema).some((e) => e.path === '$.reuse')).toBe(true);
    });

    it('package-workers-preload-nothing', () => {
        const floor = render_floor();
        for (const name of ['ac-worker', 'ac-researcher']) {
            const file = path.join(_AGENTS, `${name}.md`);
            const data = _frontmatterOf(file);
            apply_schema_defaults(data, schema);
            expect(validate(data, schema).map((e) => `${name} ${e.path}: ${e.message}`)).toEqual([]);
            expect(data.name).toBe(name);
            expect(data.reuse).toBe('continuity');
            // Ships empty: a preload is paid on every cold start (2.3).
            expect(data.preload_skills ?? []).toEqual([]);
            // D7: the host default TTL until Phase 1's gap reading says otherwise.
            expect(data.cache_ttl).toBeUndefined();
            expect(fs.readFileSync(file, 'utf-8')).toContain(floor);
        }
        const researcher = _frontmatterOf(path.join(_AGENTS, 'ac-researcher.md'));
        for (const tool of researcher.tools as string[]) {
            expect(tool).not.toMatch(/^(Write|Edit|NotebookEdit|Bash)\b/);
        }
    });

    it('no package subagent holds repository reads and a web leg together (lethal trifecta)', () => {
        for (const file of _definitions()) {
            const tools = ((_frontmatterOf(file).tools as string[] | undefined) ?? []).map((t) => t.split('(')[0]);
            const reads = tools.some((t) => ['Read', 'Grep', 'Glob', 'Bash'].includes(t as string));
            const web = tools.some((t) => ['WebFetch', 'WebSearch'].includes(t as string));
            expect(reads && web, `${path.basename(file)} combines repository reads with web access`).toBe(false);
        }
    });

    it('judges-are-never-reusable', () => {
        // Judge Iron Law (subagent-orchestration): no judge on the same model and
        // context. Every definition that judges, reviews or validates declares
        // `reuse: never`, so the law is a field the decision function reads.
        const judging = /judge|review|validat|audit/i;
        let seen = 0;
        for (const file of _definitions()) {
            const data = _frontmatterOf(file);
            expect(data.reuse, `${path.basename(file)} must declare reuse`).toBeDefined();
            if (judging.test(String(data.name)) || judging.test(String(data.description))) {
                expect(data.reuse, path.basename(file)).toBe('never');
                seen++;
            }
        }
        expect(seen).toBeGreaterThan(0);
    });
});
