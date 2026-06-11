/**
 * Tests for `src/scripts/validate_frontmatter.ts` — the TS twin of
 * `src/scripts/validate_frontmatter.py` (ADR-088 Phase 4 / Wave 4a).
 *
 * Ports, 1:1, the three pytest suites that exercise the validator's library
 * surface:
 *   - tests/test_frontmatter_defaults.py    → schema-default injection
 *   - tests/test_frontmatter_strict_yaml.py → strict-YAML gate (both paths)
 *   - tests/test_model_tier_schema.py       → model_tier / context enum
 *
 * Plus a real-repo golden-parity test: run the Python and TS CLIs the way CI
 * invokes them (no args) and assert byte-identical stdout / stderr / exit.
 *
 * Not ported here:
 *   - tests/test_frontmatter_roundtrip.py — a condensation invariant that
 *     imports `check_condensation` (no TS twin yet); it tests the condenser,
 *     not this module.
 *   - test_checksum_stable_between_explicit_and_omitted_forms — depends on
 *     `build_discovery_manifest._artefact_checksum` (no TS twin yet). The
 *     `apply_schema_defaults` half it relies on is covered below by
 *     `omitted-form injection equals the explicit form`.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _reset_yaml,
    _set_yaml,
    apply_schema_defaults,
    load_schema,
    strict_yaml_error,
    validate,
    type YamlValue,
} from '../../src/scripts/validate_frontmatter.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Frontmatter dict shape, matching the validator's `YamlValue` recursive type.
type FM = Record<string, YamlValue>;

// ---------------------------------------------------------------------------
// Port of tests/test_frontmatter_defaults.py
// ---------------------------------------------------------------------------

// (artefact_type, dotted-path, default value) — one row per safe-to-default field.
const SAFE_DEFAULTS: Array<[string, string, unknown]> = [
    ['skill', 'source', 'package'],
    ['skill', 'lifecycle', 'active'],
    ['skill', 'trust.level', 'core'],
    ['skill', 'trust.confidence', 'high'],
    ['skill', 'trust.human_review_required', false],
    ['skill', 'install.default', true],
    ['skill', 'install.removable', false],
    ['rule', 'source', 'package'],
    ['rule', 'lifecycle', 'active'],
    ['rule', 'trust.level', 'core'],
    ['rule', 'trust.confidence', 'high'],
    ['rule', 'trust.human_review_required', false],
    ['rule', 'install.default', true],
    ['rule', 'install.removable', false],
    ['command', 'disable-model-invocation', true],
    ['command', 'lifecycle', 'active'],
    ['command', 'trust.level', 'core'],
    ['command', 'trust.confidence', 'high'],
    ['command', 'trust.human_review_required', false],
    ['command', 'install.default', true],
    ['command', 'install.removable', false],
    ['persona', 'version', '1.0'],
    ['persona', 'source', 'package'],
];

function dig(data: FM, dotted: string): unknown {
    let cur: unknown = data;
    for (const part of dotted.split('.')) {
        expect(typeof cur === 'object' && cur !== null && !Array.isArray(cur)).toBe(true);
        const obj = cur as FM;
        expect(part in obj).toBe(true);
        cur = obj[part];
    }
    return cur;
}

function minimal(artefactType: string): FM {
    const table: Record<string, FM> = {
        skill: { name: 'x', description: 'd', domain: 'quality' },
        rule: { type: 'auto', description: 'd' },
        command: { name: 'x', description: 'd' },
        persona: { id: 'x', role: 'r', description: 'd', tier: 'core', mode: 'developer' },
    };
    return { ...(table[artefactType] as FM) };
}

describe('schema-default injection (test_frontmatter_defaults.py)', () => {
    it.each(SAFE_DEFAULTS)('absent %s.%s reads back default', (artefactType, dotted, def) => {
        const data = minimal(artefactType);
        apply_schema_defaults(data, load_schema(artefactType));
        expect(dig(data, dotted)).toEqual(def);
    });

    it.each(SAFE_DEFAULTS)('present %s.%s not overwritten', (artefactType, dotted, def) => {
        let sentinel: YamlValue;
        if (typeof def === 'boolean') {
            sentinel = !def;
        } else if (dotted.endsWith('source')) {
            sentinel = 'project';
        } else if (dotted.endsWith('level')) {
            sentinel = 'advisory';
        } else if (dotted.endsWith('confidence')) {
            sentinel = 'low';
        } else if (dotted.endsWith('lifecycle')) {
            sentinel = 'deprecated';
        } else if (dotted.endsWith('version')) {
            sentinel = '2.0';
        } else if (dotted === 'disable-model-invocation') {
            sentinel = true; // enum-locked to true; "present" still means not-injected
        } else {
            sentinel = 'sentinel';
        }
        const data = minimal(artefactType);
        const parts = dotted.split('.');
        let cur: FM = data;
        for (const part of parts.slice(0, -1)) {
            if (!(part in cur) || typeof cur[part] !== 'object') {
                cur[part] = {};
            }
            cur = cur[part] as FM;
        }
        cur[parts[parts.length - 1] as string] = sentinel;
        apply_schema_defaults(data, load_schema(artefactType));
        expect(dig(data, dotted)).toEqual(sentinel);
    });

    it('omitted artefact still validates', () => {
        for (const artefactType of ['skill', 'rule', 'command', 'persona']) {
            const data = minimal(artefactType);
            const schema = load_schema(artefactType);
            apply_schema_defaults(data, schema);
            const fatal = validate(data, schema).filter((e) => e.severity === 'error');
            expect(fatal, `${artefactType}: ${JSON.stringify(fatal)}`).toEqual([]);
        }
    });

    it('kept-explicit fields never fabricated', () => {
        // skill.execution is optional and has no sub-defaults → never injected.
        const skill = minimal('skill');
        apply_schema_defaults(skill, load_schema('skill'));
        expect('execution' in skill).toBe(false);
        // command.type (orchestrator) carries no default → never injected.
        const cmd = minimal('command');
        apply_schema_defaults(cmd, load_schema('command'));
        expect('type' in cmd).toBe(false);
    });

    it('partial trust block is filled, not replaced', () => {
        const rule = minimal('rule');
        rule['trust'] = { level: 'advisory', human_review_required: true };
        apply_schema_defaults(rule, load_schema('rule'));
        expect(rule['trust']).toEqual({
            level: 'advisory',
            human_review_required: true,
            confidence: 'high', // filled from default
        });
    });

    it('omitted-form injection equals the explicit form (apply_schema_defaults half of the checksum invariant)', () => {
        // The Python test_checksum_stable test asserts the discovery checksum is
        // identical between the explicit-on-disk form and the omitted form (after
        // injection). The cross-module checksum (build_discovery_manifest) has no
        // TS twin yet; the load-bearing half this module owns is that injecting
        // defaults into the omitted form reconstructs the explicit form.
        const explicitFm: FM = {
            name: 'demo',
            description: 'd',
            domain: 'quality',
            workspaces: ['engineering'],
            packs: ['engineering-base'],
            source: 'package',
            lifecycle: 'active',
            trust: { level: 'core', confidence: 'high', human_review_required: false },
            install: { default: true, removable: false },
        };
        const omittedFm: FM = {
            name: 'demo',
            description: 'd',
            domain: 'quality',
            workspaces: ['engineering'],
            packs: ['engineering-base'],
        };
        apply_schema_defaults(omittedFm, load_schema('skill'));
        expect(omittedFm).toEqual(explicitFm);
    });
});

// ---------------------------------------------------------------------------
// Port of tests/test_frontmatter_strict_yaml.py
// ---------------------------------------------------------------------------

const BROKEN_INNER_QUOTES = '---\nname: x\ndescription: "say "hi" now"\n---\nbody\n';
const BROKEN_BARE_COLON = '---\nname: x\ndescription: outside DE:/EN: blocks\n---\nbody\n';
const OK_ESCAPED_QUOTES = '---\nname: x\ndescription: "say \\"hi\\" now"\n---\nbody\n';
const OK_QUOTED_COLON = '---\nname: x\ndescription: "outside DE:/EN: blocks"\n---\nbody\n';
const OK_PLAIN = '---\nname: x\ndescription: a plain description\n---\nbody\n';

const STRICT_CASES: Array<[string, string, boolean]> = [
    ['broken_inner_quotes', BROKEN_INNER_QUOTES, true],
    ['broken_bare_colon', BROKEN_BARE_COLON, true],
    ['ok_escaped_quotes', OK_ESCAPED_QUOTES, false],
    ['ok_quoted_colon', OK_QUOTED_COLON, false],
    ['ok_plain', OK_PLAIN, false],
];

describe('strict-YAML gate (test_frontmatter_strict_yaml.py)', () => {
    afterEach(() => {
        _reset_yaml();
    });

    it.each(STRICT_CASES)('yaml-parser path: %s', (_label, text, expectError) => {
        const err = strict_yaml_error(text);
        expect(err !== null).toBe(expectError);
    });

    it.each(STRICT_CASES)('structural fallback path: %s', (_label, text, expectError) => {
        // Force the no-parser branch so the structural fallback is covered even
        // where the yaml package is installed (mirrors monkeypatch _yaml=None).
        _set_yaml(null);
        const err = strict_yaml_error(text);
        expect(err !== null).toBe(expectError);
    });

    it('missing frontmatter is not an error', () => {
        expect(strict_yaml_error('no frontmatter here\n')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Port of tests/test_model_tier_schema.py
// ---------------------------------------------------------------------------

function validateFatal(artefactType: string, fm: FM): string[] {
    const schema = load_schema(artefactType);
    apply_schema_defaults(fm, schema);
    return validate(fm, schema)
        .filter((e) => e.severity === 'error')
        .map((e) => `${e.rule}@${e.path}`);
}

function validateErrors(artefactType: string, fm: FM): Array<{ rule: string; path: string }> {
    const schema = load_schema(artefactType);
    apply_schema_defaults(fm, schema);
    return validate(fm, schema).filter((e) => e.severity === 'error');
}

function skillFm(extra: FM = {}): FM {
    return { name: 'x', description: 'd', domain: 'quality', ...extra };
}

function commandFm(extra: FM = {}): FM {
    return { name: 'x', description: 'd', ...extra };
}

describe('model_tier / context enum (test_model_tier_schema.py)', () => {
    it.each(['lite', 'medium', 'high', 'inherit'])('valid tier %s passes', (value) => {
        for (const [at, fm] of [
            ['skill', skillFm({ model_tier: value })],
            ['command', commandFm({ model_tier: value })],
        ] as Array<[string, FM]>) {
            expect(validateFatal(at, fm), `${at} model_tier=${value}`).toEqual([]);
        }
    });

    it.each(['opus', 'sonnet', 'gpt', 'haiku', 'frontier', '', 'High'])(
        'vendor name / unknown %s rejected',
        (value) => {
            for (const [at, fm] of [
                ['skill', skillFm({ model_tier: value })],
                ['command', commandFm({ model_tier: value })],
            ] as Array<[string, FM]>) {
                const errs = validateErrors(at, fm);
                expect(
                    errs.some((e) => e.rule === 'enum' && e.path.includes('model_tier')),
                    `${at} model_tier=${JSON.stringify(value)} should fail enum, got ${JSON.stringify(errs)}`,
                ).toBe(true);
            }
        },
    );

    it('context modifier', () => {
        for (const [at, mk] of [
            ['skill', skillFm],
            ['command', commandFm],
        ] as Array<[string, (e?: FM) => FM]>) {
            expect(validateFatal(at, mk({ model_tier: 'high', context: 'large' }))).toEqual([]);
            const bad = validateErrors(at, mk({ model_tier: 'high', context: 'huge' }));
            expect(bad.some((e) => e.rule === 'enum' && e.path.includes('context')), JSON.stringify(bad)).toBe(true);
        }
    });

    it('both fields optional', () => {
        for (const [at, fm] of [
            ['skill', skillFm()],
            ['command', commandFm()],
        ] as Array<[string, FM]>) {
            expect(validateFatal(at, fm), `${at} without model_tier/context`).toEqual([]);
        }
    });
});

// ---------------------------------------------------------------------------
// Real-repo golden parity — Python vs TS CLI, byte-identical (ADR-088 §5.2)
// ---------------------------------------------------------------------------

const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_frontmatter.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_frontmatter.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function pythonAvailable(): boolean {
    const r = spawnSync('python3', ['--version'], { encoding: 'utf-8' });
    return r.status === 0;
}

function runPy(args: readonly string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf-8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function runTs(args: readonly string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf-8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

describe('golden parity vs the Python CLI on the real repo', () => {
    const skipIfNoPython = pythonAvailable() ? it : it.skip;

    // The way CI invokes it (taskfiles/ci-fast.yml): no args → artefact_roots().
    skipIfNoPython('no-args run is byte-identical (stdout + stderr + exit)', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    skipIfNoPython('--root src run is byte-identical', () => {
        const py = runPy(['--root', 'src']);
        const ts = runTs(['--root', 'src']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    skipIfNoPython('error-path parity: unknown flag', () => {
        const py = runPy(['--bogus']);
        const ts = runTs(['--bogus']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('--help exits 0 with a usage line (argparse help text is not a parity contract)', () => {
        // argparse's --help banner is Python-version-dependent (3.9 prints
        // "optional arguments:", 3.12 prints "options:"), so a byte-for-byte
        // python-vs-TS comparison is brittle across runtimes — and CI never
        // invokes --help in production. Assert the stable surface only.
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('usage:');
    });

    skipIfNoPython('error-path parity: missing --root dir', () => {
        const py = runPy(['--root', '/nonexistent/xyz']);
        const ts = runTs(['--root', '/nonexistent/xyz']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});

// ---------------------------------------------------------------------------
// Synthetic-root finding-message parity (one valid + each failure class)
// ---------------------------------------------------------------------------

describe('synthetic-root finding messages', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vfm-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function runTsRoot(root: string): { stdout: string; status: number | null } {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--root', root], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
        });
        return { stdout: r.stdout, status: r.status };
    }

    it('reports required / enum / readme-skip and counts', () => {
        fs.mkdirSync(path.join(tmp, 'skills', 'a-skill'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'rules'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'personas'), { recursive: true });
        // valid skill
        fs.writeFileSync(
            path.join(tmp, 'skills', 'a-skill', 'SKILL.md'),
            '---\nname: a\ndescription: d\ndomain: quality\n---\nbody\n',
        );
        // skill missing required domain → required error
        fs.mkdirSync(path.join(tmp, 'skills', 'z-skill'), { recursive: true });
        fs.writeFileSync(
            path.join(tmp, 'skills', 'z-skill', 'SKILL.md'),
            '---\nname: z\ndescription: d\n---\nbody\n',
        );
        // rule with bad enum
        fs.writeFileSync(
            path.join(tmp, 'rules', 'b-rule.md'),
            '---\ntype: bogus\ndescription: d\n---\nbody\n',
        );
        // persona + README (README must be skipped)
        fs.writeFileSync(
            path.join(tmp, 'personas', 'p1.md'),
            '---\nid: p\nrole: r\ndescription: d\ntier: core\nmode: developer\n---\nbody\n',
        );
        fs.writeFileSync(path.join(tmp, 'personas', 'README.md'), 'readme\n');

        const { stdout, status } = runTsRoot(tmp);
        const norm = stdout.split(tmp).join('ROOT');
        expect(norm).toContain(
            "❌ [skill] ROOT/skills/z-skill/SKILL.md: required at $.domain – Missing required property 'domain'",
        );
        expect(norm).toContain(
            "❌ [rule] ROOT/rules/b-rule.md: enum at $.type – Value 'bogus' is not one of ['always', 'auto', 'manual']",
        );
        // 4 artefacts: 2 skills + 1 rule + 1 persona (README skipped)
        expect(norm).toContain('== Frontmatter schema: 4 artefacts, 2 failing, 0 with warnings ==');
        expect(status).toBe(1);
    });
});
