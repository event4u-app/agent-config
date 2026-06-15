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
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_missions.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_missions.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const MISSION_SCHEMA = path.join(REPO_ROOT, 'src', 'scripts', 'schemas', 'mission.schema.json');
const CATALOG_SCHEMA = path.join(
    REPO_ROOT,
    'src',
    'scripts',
    'schemas',
    'mission-catalog.schema.json',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

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

const py3 = hasPython3();

// Wrappers are written to disk (not passed via -c / -e) so prog-name and the
// "cjs top-level await" limitation do not interfere.
const PY_WRAPPER = [
    'import importlib.util, os, sys, pathlib, json',
    'spec = importlib.util.spec_from_file_location("lm", os.environ["LM_PY"])',
    'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
    'm.MISSIONS_ROOT = pathlib.Path(os.environ["LM_ROOT"])',
    'm.MISSION_SCHEMA_PATH = pathlib.Path(os.environ["LM_MS"])',
    'm.CATALOG_SCHEMA_PATH = pathlib.Path(os.environ["LM_CS"])',
    'sys.exit(m.main(json.loads(os.environ["LM_ARGV"])))',
    '',
].join('\n');

const TS_WRAPPER = [
    'import(process.env.LM_TS).then((m) => {',
    '    m._setMissionsRootForTest(process.env.LM_ROOT);',
    '    m._setMissionSchemaPathForTest(process.env.LM_MS);',
    '    m._setCatalogSchemaPathForTest(process.env.LM_CS);',
    '    process.exitCode = m.main(JSON.parse(process.env.LM_ARGV));',
    '});',
    '',
].join('\n');

describe.skipIf(!py3)('lint_missions — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    let root: string;
    let pyWrap: string;
    let tsWrap: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-parity-'));
        root = path.join(tmp, 'missions');
        fs.mkdirSync(root);
        pyWrap = path.join(tmp, 'wrap.py');
        tsWrap = path.join(tmp, 'wrap.mjs');
        fs.writeFileSync(pyWrap, PY_WRAPPER, 'utf-8');
        fs.writeFileSync(tsWrap, TS_WRAPPER, 'utf-8');
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function mkMission(name: string, manifest: string, catalog?: string): void {
        const dir = path.join(root, name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'mission.yaml'), manifest, 'utf-8');
        if (catalog !== undefined) {
            fs.writeFileSync(path.join(dir, 'catalog.yml'), catalog, 'utf-8');
        }
    }

    function env(argv: string[]) {
        return {
            ...process.env,
            LM_PY: PY_SCRIPT,
            LM_TS: pathToFileURL(TS_SCRIPT).href,
            LM_ROOT: root,
            LM_MS: MISSION_SCHEMA,
            LM_CS: CATALOG_SCHEMA,
            LM_ARGV: JSON.stringify(argv),
        };
    }

    function expectMatch(argv: string[]) {
        const e = env(argv);
        const py = spawnSync('python3', [pyWrap], { env: e, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [tsWrap], { env: e, encoding: 'utf8' });
        const label = JSON.stringify(argv);
        expect(ts.stdout, label).toBe(py.stdout);
        expect(ts.stderr, label).toBe(py.stderr);
        expect(ts.status, label).toBe(py.status);
    }

    it('valid mission + catalog: clean run byte-identical', () => {
        mkMission('upgrade', VALID_MANIFEST + 'catalog: catalog.yml\n', VALID_CATALOG);
        expectMatch([]);
    });

    it('schema-invalid manifest (pattern/enum/minProperties): findings byte-identical', () => {
        mkMission(
            'bad',
            ['mission: Bad Name', 'inputs: {}', 'phases:', '  - nope', '  - plan', 'size_tier: huge', ''].join('\n'),
        );
        expectMatch([]);
    });

    it('schema-invalid catalog (maxLength/required + nested $ref): byte-identical', () => {
        mkMission(
            'badcat',
            VALID_MANIFEST + 'catalog: catalog.yml\n',
            [
                'version: bad',
                'framework: Laravel',
                'from: x',
                'to: y',
                'breaking_changes:',
                '  - id: foo',
                '    title: ""',
                '    severity: meh',
                '    detection: {}',
                '    fix:',
                '      description: d',
                '    verification:',
                '      description: d',
                '',
            ].join('\n'),
        );
        expectMatch([]);
    });

    it('unsafe-command catalog: byte-identical', () => {
        mkMission(
            'unsafe',
            VALID_MANIFEST + 'catalog: catalog.yml\n',
            [
                'version: "1.0"',
                'framework: laravel',
                'from: "10"',
                'to: "11"',
                'breaking_changes:',
                '  - id: foo',
                '    title: T',
                '    severity: low',
                '    detection:',
                '      description: d',
                '      command: rm -rf /',
                '    fix:',
                '      description: d',
                '    verification:',
                '      description: d',
                '',
            ].join('\n'),
        );
        expectMatch([]);
    });

    it('missing manifest + missing catalog: byte-identical', () => {
        fs.mkdirSync(path.join(root, 'empty'));
        mkMission('nocat', VALID_MANIFEST + 'catalog: nope.yml\n');
        expectMatch([]);
    });

    it('--strict over errors exits 1 identically', () => {
        mkMission('bad', ['mission: Bad Name', 'inputs: {}', 'phases:', '  - plan', ''].join('\n'));
        expectMatch(['--strict']);
    });

    it('--quiet suppresses output identically', () => {
        mkMission('bad', ['mission: Bad Name', 'inputs: {}', 'phases:', '  - plan', ''].join('\n'));
        expectMatch(['--quiet']);
    });

    it('multiple missions sorted identically', () => {
        mkMission('zeta', VALID_MANIFEST);
        mkMission('alpha', ['mission: Bad Name', 'inputs: {}', 'phases:', '  - plan', ''].join('\n'));
        fs.mkdirSync(path.join(root, '.hidden'));
        fs.writeFileSync(path.join(root, '.hidden', 'mission.yaml'), 'mission: nope\n', 'utf-8');
        expectMatch([]);
    });

    it('--check-precondition stub byte-identical', () => {
        expectMatch(['--check-precondition', 'up', '/tmp']);
    });

    it('unknown arg exits 2 identically (direct invocation — prog name)', () => {
        // Run the scripts directly so the argparse prog name in the usage
        // banner is `lint_missions.py`.
        const py = spawnSync('python3', [PY_SCRIPT, '--bogus'], { encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], { encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
