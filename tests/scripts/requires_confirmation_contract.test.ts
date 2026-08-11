/**
 * `requires_confirmation` — the declaration half of the confirmation primitive
 * (dispatch-safety Phase 2.1).
 *
 * The flag is additive and schema-backed on two surfaces, so the gate that has
 * to hold is symmetric: both schemas accept a boolean, both reject a non-boolean
 * (a string `"true"` is the plausible authoring slip), and neither has stopped
 * rejecting unknown keys — `additionalProperties: false` is what makes a typo in
 * this key fail CI rather than silently declaring nothing.
 *
 * Runs through the validator's own exported surface, the same one the CI
 * `validate_frontmatter` sweep uses, so the test tracks the real gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { load_schema, validate, type YamlValue } from '../../src/scripts/validate_frontmatter.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const _REPO = path.resolve(_HERE, '..', '..');
const _SCHEMAS = path.join(_REPO, 'src', 'scripts', 'schemas');

/** `load_schema` takes the artefact type, not a path — it derives the filename. */
function schema(artefactType: 'skill' | 'command'): Record<string, YamlValue> {
    return load_schema(artefactType) as Record<string, YamlValue>;
}

/** Minimal frontmatter each schema accepts, used as the fixture base. */
function minimalSkill(): Record<string, YamlValue> {
    return {
        name: 'confirmation-fixture',
        description:
            'Fixture skill for the requires_confirmation contract test — declares that its execution stages rather than performs.',
    } as unknown as Record<string, YamlValue>;
}

/**
 * Findings for the execution block only. `validate` returns objects with a
 * `path` / `rule` / `message` shape, and the fixture omits unrelated required
 * keys on purpose — this test is about one property, not about a whole
 * conforming skill, so it reads the findings at that path rather than the
 * error count.
 */
function executionFindings(exec: unknown): { path: string; rule: string }[] {
    const doc = minimalSkill();
    doc.execution = exec as YamlValue;
    return validate(doc, schema('skill')).filter((e) =>
        String((e as { path?: string }).path ?? '').startsWith('$.execution.'),
    ) as unknown as { path: string; rule: string }[];
}

describe('requires_confirmation — skill execution block', () => {
    it('accepts a boolean declaration', () => {
        expect(executionFindings({ type: 'manual', requires_confirmation: true })).toEqual([]);
    });

    it('rejects a stringly-typed "true" — the plausible authoring slip', () => {
        const findings = executionFindings({ type: 'manual', requires_confirmation: 'true' });
        expect(findings).toHaveLength(1);
        expect(findings[0]?.path).toBe('$.execution.requires_confirmation');
        expect(findings[0]?.rule).toBe('type');
    });

    it('rejects a misspelled key — additionalProperties still closed', () => {
        // The reason a typo in this key is a CI failure rather than a silent
        // no-op: without the closed object, `require_confirmation` would parse
        // as a declaration that declares nothing.
        const findings = executionFindings({ type: 'manual', require_confirmation: true });
        expect(findings).toHaveLength(1);
        expect(findings[0]?.rule).toBe('additionalProperties');
    });
});

/**
 * Findings for one command key. The command surface is exercised through
 * `validate()` for the same reason the skill surface is: a shape read of the
 * JSON proves the property is DECLARED, never that the validator enforces it —
 * and "pinned rather than assumed" was the whole claim of roadmap step 2.1.
 */
function commandFindings(value: unknown, key = 'requires_confirmation'): { rule: string }[] {
    const doc = {
        name: 'confirmation-fixture',
        description: 'Fixture command for the requires_confirmation contract test.',
        [key]: value,
    } as unknown as Record<string, YamlValue>;
    return validate(doc, schema('command')).filter((e) =>
        String((e as { path?: string }).path ?? '').includes(key),
    ) as unknown as { rule: string }[];
}

describe('requires_confirmation — command frontmatter', () => {
    const commandSchema = (): Record<string, YamlValue> => schema('command');

    it('is declared on the command schema under the same key', () => {
        const props = (commandSchema().properties ?? {}) as Record<string, YamlValue>;
        expect(props.requires_confirmation).toBeDefined();
        expect((props.requires_confirmation as Record<string, unknown>).type).toBe('boolean');
    });

    it('accepts a boolean declaration', () => {
        expect(commandFindings(true)).toEqual([]);
    });

    it('rejects a stringly-typed "true"', () => {
        const findings = commandFindings('true');
        expect(findings).toHaveLength(1);
        expect(findings[0]?.rule).toBe('type');
    });

    it('rejects the misspelled key — additionalProperties closed here too', () => {
        const findings = commandFindings(true, 'require_confirmation');
        expect(findings).toHaveLength(1);
        expect(findings[0]?.rule).toBe('additionalProperties');
    });

    it('the two surfaces agree on the key name', () => {
        const skillProps = (
            ((schema('skill').properties as Record<string, YamlValue>)
                .execution as Record<string, YamlValue>).properties ?? {}
        ) as Record<string, YamlValue>;
        expect(Object.keys(skillProps)).toContain('requires_confirmation');
    });
});

describe('the schema files stay parseable JSON', () => {
    it('both edited schemas round-trip', () => {
        for (const name of ['skill.schema.json', 'command.schema.json']) {
            const raw = fs.readFileSync(path.join(_SCHEMAS, name), 'utf-8');
            expect(() => JSON.parse(raw)).not.toThrow();
        }
    });
});
