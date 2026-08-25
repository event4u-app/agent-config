// Tests for the drafting channel registry (src/config/drafting-channels.yml)
// — road-to-channel-contract-and-profile-drift Phase 1.2 and 1.3.
//
// Four layers, and the reason each exists is stated because three of them
// would look redundant otherwise:
//
//   1. The REAL registry validates clean against its schema.
//   2. Each negative fixture fails for the RIGHT reason — the assertion pins
//      the JSON path AND the schema rule, never merely a non-zero finding
//      count. A fixture that failed because an unrelated required key was
//      missing would otherwise score as a pass.
//   3. The registry AGREES WITH `docs/contracts/write-engine.md`. This is the
//      layer that earns its keep: the contract is the human-facing statement
//      of the same four values and the same four length defaults, and a data
//      file that silently disagreed with it would be worse than no data file,
//      because two truths for one word is exactly what this roadmap's Risk
//      Register row 2 names.
//   4. The three `--channel` command surfaces accept exactly the schema's
//      values. 1.3's verify clause names `linkedin-post` and `never linkedin`,
//      so the short form is pinned as a separate case from an invented
//      platform: it is the plausible typo, and a surface that documented it
//      would teach the wrong flag value.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import { validate, type YamlValue } from '../../src/scripts/validate_frontmatter.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'config', 'drafting-channels.yml');
const SCHEMA = path.join(REPO_ROOT, 'src', 'scripts', 'schemas', 'drafting-channels.schema.json');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'drafting-channels');
const CONTRACT = path.join(REPO_ROOT, 'docs', 'contracts', 'write-engine.md');

/** The three surfaces 1.3 names. Kept as data so a fourth is a visible diff. */
const CHANNEL_SURFACES = [
    'src/domains/gtm-marketing/ghostwriter/write/command.md',
    'src/domains/gtm-marketing/post-as/me/command.md',
    'src/domains/gtm-marketing/post-as/ghostwriter/command.md',
];

function loadSchema(): Record<string, YamlValue> {
    return JSON.parse(fs.readFileSync(SCHEMA, 'utf-8')) as Record<string, YamlValue>;
}

function loadYaml(file: string): YamlValue {
    return parseYaml(fs.readFileSync(file, 'utf-8')) as YamlValue;
}

interface Channel {
    id: string;
    length_default: number;
    cadence: string;
}

function channels(): Channel[] {
    const data = loadYaml(REGISTRY) as { channels: Channel[] };
    return data.channels;
}

describe('drafting-channels.yml validates against its schema', () => {
    it('the real registry is clean', () => {
        const errors = validate(loadYaml(REGISTRY), loadSchema());
        expect(errors.map((e) => e.format(REGISTRY))).toEqual([]);
    });

    it('carries exactly the four contract channels, and no fifth', () => {
        expect(channels().map((c) => c.id).sort()).toEqual(
            ['blog', 'freeform', 'linkedin-post', 'tweet'],
        );
    });
});

describe('negative fixtures fail for the right reason', () => {
    const cases = [
        {
            file: 'fifth-channel.yml',
            path: '$.channels[0].id',
            rule: 'enum',
            why: 'a fifth channel invented outside the four-value contract',
        },
        {
            file: 'short-channel-form.yml',
            path: '$.channels[0].id',
            rule: 'enum',
            why: 'the short form `linkedin`, which is the plausible typo and not a flag value',
        },
    ];

    for (const c of cases) {
        it(`${c.file} — rejects ${c.why}`, () => {
            const errors = validate(loadYaml(path.join(FIXTURES, c.file)), loadSchema());
            const match = errors.find((e) => e.path === c.path && e.rule === c.rule);
            expect(
                match,
                `expected a ${c.rule} finding at ${c.path}; got ${JSON.stringify(
                    errors.map((e) => `${e.rule} at ${e.path}`),
                )}`,
            ).toBeDefined();
        });
    }
});

describe('the registry agrees with docs/contracts/write-engine.md', () => {
    const contract = fs.readFileSync(CONTRACT, 'utf-8');

    it('the contract still declares the same four-value enum', () => {
        // Pinned as a literal because the contract line IS the shared statement
        // of the enum; if it is reworded, this test is the thing that notices.
        expect(contract).toContain('`linkedin-post | tweet | blog | freeform`');
    });

    for (const ch of channels()) {
        it(`${ch.id} — the contract's length default is ${ch.length_default}`, () => {
            // The contract's § Per-channel defaults renders one table row per
            // channel: | `<id>` | <n> words | <cadence> |. Matching the row
            // rather than the bare number keeps a coincidental digit
            // elsewhere in the document from satisfying this.
            const row = new RegExp(
                `\\|\\s*\`${ch.id}\`\\s*\\|\\s*${ch.length_default} words\\s*\\|`,
            );
            expect(row.test(contract), `no row for ${ch.id} with ${ch.length_default} words`).toBe(
                true,
            );
        });
    }
});

describe('the three --channel surfaces accept exactly the schema values', () => {
    const ids = channels().map((c) => c.id);

    it('1.3 still names the same three files', () => {
        const found = CHANNEL_SURFACES.filter((f) =>
            fs.existsSync(path.join(REPO_ROOT, f)),
        );
        expect(found).toEqual(CHANNEL_SURFACES);
    });

    for (const surface of CHANNEL_SURFACES) {
        const text = fs.readFileSync(path.join(REPO_ROOT, surface), 'utf-8');

        it(`${surface} — documents no channel value outside the enum`, () => {
            // Every `--channel=<...>` enumeration in the file must be a subset
            // of the registry. An enumeration listing a value the schema
            // rejects is the drift this whole phase exists to close.
            const enumerations = [...text.matchAll(/--channel=<([^>]+)>/g)].map((m) => m[1]);
            for (const e of enumerations) {
                const listed = e.split('|').map((v) => v.trim());
                expect(listed.sort()).toEqual([...ids].sort());
            }
        });

        it(`${surface} — never uses the bare short form as a flag value`, () => {
            expect(text).not.toMatch(/--channel=linkedin(?![-\w])/);
        });
    }
});
