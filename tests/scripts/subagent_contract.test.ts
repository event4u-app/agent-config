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

    it('rejects a tool outside the Claude Code tool set', () => {
        const data = _frontmatterOf(_UNIT);
        data.tools = ['Read', 'curl'];
        const errors = validate(data, schema);
        expect(errors.some((e) => e.rule === 'enum' && e.path.startsWith('$.tools['))).toBe(true);
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
