// Step 8.1 of road-to-a-graph-that-follows-you — the tracked, source-free decision ledger.
//
// The schema's job that matters most is what it REFUSES: council O5 keeps every
// link between a source and a mechanism on the owner's machine, so a row that
// carries a source id, a pin or a locator must not validate. Each negative
// fixture is pinned to the JSON path and rule it fails on, so a fixture failing
// for an unrelated reason cannot score as a pass.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validate, type YamlValue } from '../../src/scripts/validate_frontmatter.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCHEMA = path.join(REPO_ROOT, 'src', 'scripts', 'schemas', 'provenance-mechanism.schema.json');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'provenance-mechanism');

const schema = (): Record<string, YamlValue> => JSON.parse(fs.readFileSync(SCHEMA, 'utf-8')) as Record<string, YamlValue>;
const fixture = (name: string): YamlValue => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf-8')) as YamlValue;

describe('provenance-mechanism.schema.json — positive fixtures', () => {
    for (const name of ['valid-adapt.json', 'valid-reject.json', 'valid-gap.json']) {
        it(`${name} validates clean`, () => {
            expect(validate(fixture(name), schema()).map((e) => `${e.rule} at ${e.path}`)).toEqual([]);
        });
    }

    it('names exactly the six verdicts, rejections and gaps included', () => {
        const props = schema().properties as Record<string, { enum?: string[] }>;
        expect(props.verdict?.enum).toEqual(['adopt', 'adapt', 'reject', 'already', 'gap', 'deferred']);
    });

    it('declares no source, pin or locator field at all', () => {
        const keys = Object.keys(schema().properties as Record<string, unknown>);
        expect(keys.filter((k) => /source|pin|locator/.test(k))).toEqual([]);
    });
});

describe('provenance-mechanism.schema.json — negative fixtures fail for the right reason', () => {
    const cases = [
        { file: 'invalid-source-id.json', path: '$.source_id', rule: 'additionalProperties' },
        { file: 'invalid-pin.json', path: '$.pin', rule: 'additionalProperties' },
        { file: 'invalid-verdict.json', path: '$.verdict', rule: 'enum' },
        { file: 'invalid-missing-verdict.json', path: '$.verdict', rule: 'required' },
    ];
    for (const c of cases) {
        it(`${c.file} — ${c.rule} at ${c.path}`, () => {
            const errors = validate(fixture(c.file), schema());
            expect(
                errors.find((e) => e.path === c.path && e.rule === c.rule),
                JSON.stringify(errors.map((e) => `${e.rule} at ${e.path}`)),
            ).toBeDefined();
        });
    }
});
