// Tests for src/scripts/install.ts (py2ts ADR-200 — the consumer installer).
//
// Two layers:
//
//   1. Pure-helper unit tests on the exported functions (arg parsing, tool
//      parsing, scope validation, legacy-settings parse, template render,
//      packs injection, JSON byte-parity dumpers, source-repo detect,
//      bridge-marker formatting, deploy-target verification).
//   2. A golden-parity layer that runs `python3 src/scripts/install.py` vs
//      `tsx src/scripts/install.ts` on the SAFE, deterministic surfaces and
//      byte-compares stdout/stderr/exit:
//        - `--help` / arg-error exit codes (exit + usage token, NOT byte help
//          prose — argparse re-wraps the body to terminal width),
//        - `--dry-run` plan path (temp project root),
//        - `--apply-payload --dry-run` (wizard-v2 / installer-v1 / bad schema),
//        - `--scope` conflict errors.
//      Non-determinism (tmp paths, abs paths) is normalized with inline
//      reasons. The suite NEVER actually installs, opens a browser, hits the
//      network, or mutates the real repo — every exercised path is guarded
//      behind --dry-run / temp dirs / a non-existent project root.
//
//   What is inherently NOT golden-tested here (documented in the porting
//   report): the real install write path, the wizard subprocess handoff
//   (`_wizard_spawn` — spawns `node dist/cli`, opens a browser), the
//   `_run_migrate_to_global` python3 spawn, the global deploy + reaper, and
//   the interactive TTY prompts. Those are network/subprocess/TTY-bound and
//   are exercised only via their pure sub-helpers above.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as inst from '../../src/scripts/install.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'install.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'install.py');
// Resolve TSX_BIN to an ABSOLUTE path: golden-parity runs spawn with cwd set
// to a temp dir, and a relative binary path would resolve against that cwd
// (→ ENOENT → status:null). The env override is honored but absolutized.
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPy(args: string[], cwd: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src') },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], cwd: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Normalize machine-specific tmp paths so the differential stays stable. */
function norm(text: string, tmp: string): string {
    return text.split(tmp).join('<TMP>').split(path.resolve(tmp)).join('<TMP>');
}

// ---------------------------------------------------------------------------
// Pure-helper unit tests
// ---------------------------------------------------------------------------

describe('install — pure helpers', () => {
    it('_merge_tools_aliases unions order-preserving + dedups, defaults to all', () => {
        expect(inst._merge_tools_aliases('a,b', 'b,c')).toBe('a,b,c');
        expect(inst._merge_tools_aliases('x', null)).toBe('x');
        expect(inst._merge_tools_aliases(null, 'y')).toBe('y');
        expect(inst._merge_tools_aliases(null, null)).toBe('all');
        expect(inst._merge_tools_aliases('', '')).toBe('all');
    });

    it('_tools_was_all detects the implicit/explicit all set', () => {
        expect(inst._tools_was_all('x,all')).toBe(true);
        expect(inst._tools_was_all('all')).toBe(true);
        expect(inst._tools_was_all('x,y')).toBe(false);
        expect(inst._tools_was_all('')).toBe(false);
    });

    it('_parse_tools expands all and rejects unknown / empty (via fail→SystemExit)', () => {
        const parsed = inst._parse_tools('claude-code,cursor');
        expect(parsed.has('claude-code')).toBe(true);
        expect(parsed.has('cursor')).toBe(true);
        const all = inst._parse_tools('all');
        expect(all.has('all')).toBe(false);
        expect(all.size).toBe(inst._VALID_TOOLS.size - 1);
        expect(() => inst._parse_tools('nope')).toThrow(inst.SystemExitError);
        expect(() => inst._parse_tools('')).toThrow(inst.SystemExitError);
    });

    it('_is_tool_enabled membership', () => {
        const s = new Set(['cursor']);
        expect(inst._is_tool_enabled(s, 'cursor')).toBe(true);
        expect(inst._is_tool_enabled(s, 'cline')).toBe(false);
    });

    it('_yaml_scalar quoting rules match the .py', () => {
        expect(inst._yaml_scalar('')).toBe('""');
        expect(inst._yaml_scalar('true')).toBe('true');
        expect(inst._yaml_scalar('false')).toBe('false');
        expect(inst._yaml_scalar('42')).toBe('42');
        expect(inst._yaml_scalar('per_turn')).toBe('per_turn');
        expect(inst._yaml_scalar('Mixed Case')).toBe('"Mixed Case"');
        expect(inst._yaml_scalar('a"b\\c')).toBe('"a\\"b\\\\c"');
    });

    it('_parse_legacy_settings splits k=v, skips comments/blanks, tracks unknown', () => {
        const [values, unknown] = inst._parse_legacy_settings(
            '# comment\ncost_profile=full\nide=phpstorm\nnonsense\nbogus_key=1\n',
        );
        expect(values).toEqual({ cost_profile: 'full', ide: 'phpstorm', bogus_key: '1' });
        expect(unknown).toEqual(['bogus_key']);
    });

    it('_render_template substitutes __UPPER__ and fails on leftover placeholder', () => {
        expect(inst._render_template('x: __FOO__\n', { foo: 'bar' })).toBe('x: bar\n');
        expect(() => inst._render_template('x: __MISSING__\n', {})).toThrow(inst.SystemExitError);
    });

    it('_replace_template_value_raw replaces only the matching nested leaf', () => {
        const tmpl = 'a:\n  b:\n    c: old\n  d: keep\n';
        expect(inst._replace_template_value_raw(tmpl, 'a.b.c', 'new')).toBe(
            'a:\n  b:\n    c: new\n  d: keep\n',
        );
        // Non-existent path leaves the template untouched.
        expect(inst._replace_template_value_raw(tmpl, 'a.z.c', 'new')).toBe(tmpl);
    });

    it('_inject_packs inserts after rule_loading_tier; no-op when empty', () => {
        const body = 'rule_loading_tier: balanced\nother: x\n';
        expect(inst._inject_packs(body, [])).toBe(body);
        expect(inst._inject_packs(body, ['p1', 'p2'])).toBe(
            'rule_loading_tier: balanced\npacks:\n  - p1\n  - p2\nother: x\n',
        );
    });

    it('deep_merge recurses dicts, replaces leaves/lists', () => {
        expect(inst.deep_merge({ a: { x: 1 }, b: 2 }, { a: { y: 3 }, c: 4 })).toEqual({
            a: { x: 1, y: 3 },
            b: 2,
            c: 4,
        });
        // Lists replace, not merge.
        expect(inst.deep_merge({ l: [1, 2] }, { l: [3] })).toEqual({ l: [3] });
    });

    it('jsonDumpsIndent (4 / 2) preserve insertion order + ensure_ascii=False', () => {
        const obj = { z: 1, a: [1, 2], s: 'ä' };
        expect(inst.jsonDumpsIndent(obj, 4)).toBe('{\n    "z": 1,\n    "a": [\n        1,\n        2\n    ],\n    "s": "ä"\n}');
        expect(inst.jsonDumpsIndent(obj, 2)).toBe('{\n  "z": 1,\n  "a": [\n    1,\n    2\n  ],\n  "s": "ä"\n}');
    });

    it('jsonDumpsCompact mirrors separators=(",",":")', () => {
        expect(inst.jsonDumpsCompact({ type: 'done', n: 1 })).toBe('{"type":"done","n":1}');
        expect(inst.jsonDumpsCompact([1, 'a', true, null])).toBe('[1,"a",true,null]');
    });

    it('_bridge_marker resolves project vs global anchors', () => {
        expect(inst._bridge_marker('windsurf', 'global')).toBe('~/.codeium/windsurf/');
        expect(inst._bridge_marker('windsurf', 'project')).toBe('.windsurf/hooks.json');
        expect(inst._bridge_marker('unknown-tool', 'project')).toBe('');
    });

    it('_validate_scope silent-filters on all, hard-rejects explicit incompatibles', () => {
        // copilot is "both"; cursor is "global" — under project scope, all=silent filter.
        const filtered = inst._validate_scope(new Set(['copilot', 'cursor']), 'project', true);
        expect(filtered.has('copilot')).toBe(true);
        expect(filtered.has('cursor')).toBe(false);
        // Explicit list with an incompatible → fail.
        expect(() => inst._validate_scope(new Set(['cursor']), 'project', false)).toThrow(
            inst.SystemExitError,
        );
    });

    it('_canonical_settings_target / _resolve_settings_read paths', () => {
        const root = '/x/proj';
        expect(inst._canonical_settings_target(root)).toBe(
            path.join('/x/proj', 'agents', 'settings', '.agent-settings.yml'),
        );
        // No file present → canonical is returned.
        expect(inst._resolve_settings_read('/nonexistent/proj')).toBe(
            path.join('/nonexistent/proj', 'agents', 'settings', '.agent-settings.yml'),
        );
    });

    it('detect_package_type by node_modules membership', () => {
        expect(inst.detect_package_type('/a/node_modules/@event4u/agent-config')).toBe('npm');
        expect(inst.detect_package_type('/a/local/pkg')).toBe('local');
    });

    it('_verify_deploy_targets flags missing/empty subpaths', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-'));
        try {
            fs.mkdirSync(path.join(tmp, 'rules'), { recursive: true });
            fs.writeFileSync(path.join(tmp, 'rules', 'a.md'), 'x');
            fs.mkdirSync(path.join(tmp, 'empty'), { recursive: true });
            const missing = inst._verify_deploy_targets(tmp, [
                ['src/rules', 'rules'],
                ['src/empty', 'empty'],
                ['src/missing', 'missing'],
            ]);
            expect(missing).toEqual(['empty', 'missing']);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe('install — source-repo detect + legacy migration detect', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'srcrepo-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('detects the source repo via package.json name', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: '@event4u/agent-config' }));
        const [isSrc, sig] = inst._is_agent_config_source_repo(tmp);
        expect(isSrc).toBe(true);
        expect(sig).toBe('package.json:name');
    });

    it('detects the source repo via .agent-src.uncondensed/', () => {
        fs.mkdirSync(path.join(tmp, '.agent-src.uncondensed'), { recursive: true });
        const [isSrc, sig] = inst._is_agent_config_source_repo(tmp);
        expect(isSrc).toBe(true);
        expect(sig).toBe('.agent-src.uncondensed/');
    });

    it('a plain consumer project is not the source repo', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'my-app' }));
        const [isSrc] = inst._is_agent_config_source_repo(tmp);
        expect(isSrc).toBe(false);
    });

    it('_detect_legacy_for_migration finds legacy artefacts in a consumer dir', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'my-app' }));
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'x: 1\n');
        fs.mkdirSync(path.join(tmp, '.augment'), { recursive: true });
        const found = inst._detect_legacy_for_migration(tmp);
        expect(found).toContain('.agent-settings.yml');
        expect(found).toContain('.augment/');
        // sorted output
        expect([...found].sort()).toEqual(found);
    });
});

// ---------------------------------------------------------------------------
// Golden parity (python3 vs tsx) — deterministic, side-effect-free surfaces
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('install — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'install-gp-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('--help: same exit code + usage token (body prose is a documented divergence)', () => {
        const p = runPy(['--help'], tmp);
        const t = runTs(['--help'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        // Both emit the argparse `usage:` block (load-bearing token).
        expect(p.stdout.startsWith('usage: install.py')).toBe(true);
        expect(t.stdout.startsWith('usage: install.py')).toBe(true);
    });

    it('unknown flag: exit 2 + byte-identical usage + error', () => {
        const p = runPy(['--bogus'], tmp);
        const t = runTs(['--bogus'], tmp);
        expect(p.status).toBe(2);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    it('--scope invalid choice: exit 2 + byte-identical error', () => {
        const p = runPy(['--scope=nope'], tmp);
        const t = runTs(['--scope=nope'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    it('--scope=global + --custom-path conflict: byte-identical fail + exit 1', () => {
        const p = runPy(['--scope=global', '--custom-path=/x'], tmp);
        const t = runTs(['--scope=global', '--custom-path=/x'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(1);
        expect(t.stderr).toBe(p.stderr);
    });

    it('--dry-run plan: byte-identical stdout/stderr/exit', () => {
        const p = runPy(['--dry-run', '--project', tmp, '--no-ui'], tmp);
        const t = runTs(['--dry-run', '--project', tmp, '--no-ui'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        expect(norm(t.stdout, tmp)).toBe(norm(p.stdout, tmp));
        expect(norm(t.stderr, tmp)).toBe(norm(p.stderr, tmp));
    });

    it('--apply-payload wizard-v2 --dry-run: byte-identical preview', () => {
        const payload = path.join(tmp, 'wiz.json');
        fs.writeFileSync(
            payload,
            JSON.stringify({
                schema_version: 'wizard-v2',
                tools: ['claude-code', 'cursor'],
                packs: ['pack-a'],
                settings: { rule_loading_tier: 'full', personal: { user_type: 'developer' } },
                scope_to_project_only: true,
                dry_run: true,
            }),
        );
        const p = runPy(['--apply-payload', payload, '--project', tmp], tmp);
        const t = runTs(['--apply-payload', payload, '--project', tmp], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        expect(norm(t.stdout, tmp)).toBe(norm(p.stdout, tmp));
        expect(norm(t.stderr, tmp)).toBe(norm(p.stderr, tmp));
    });

    it('--apply-payload installer-v1 --dry-run: byte-identical preview', () => {
        const payload = path.join(tmp, 'inst.json');
        fs.writeFileSync(
            payload,
            JSON.stringify({
                schema_version: 'installer-v1',
                ai_tools: ['augment', 'codex'],
                configs: { x: 1 },
                dry_run: true,
            }),
        );
        const p = runPy(['--apply-payload', payload, '--project', tmp], tmp);
        const t = runTs(['--apply-payload', payload, '--project', tmp], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        expect(norm(t.stdout, tmp)).toBe(norm(p.stdout, tmp));
        expect(norm(t.stderr, tmp)).toBe(norm(p.stderr, tmp));
    });

    it('--apply-payload bad schema: byte-identical fail + exit 1', () => {
        const payload = path.join(tmp, 'bad.json');
        fs.writeFileSync(payload, JSON.stringify({ schema_version: 'nope' }));
        const p = runPy(['--apply-payload', payload, '--project', tmp], tmp);
        const t = runTs(['--apply-payload', payload, '--project', tmp], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(1);
        expect(norm(t.stderr, tmp)).toBe(norm(p.stderr, tmp));
    });

    it('--minimal install into a temp dir: byte-identical stdout/stderr/exit + same files', () => {
        // Minimal init writes only the project-local override scaffold (no
        // network, no browser, no global writes). Run both into separate temp
        // dirs and compare the emitted text + the produced file tree.
        const pdir = fs.mkdtempSync(path.join(os.tmpdir(), 'min-py-'));
        const tdir = fs.mkdtempSync(path.join(os.tmpdir(), 'min-ts-'));
        try {
            const env = { ...process.env, AGENT_CONFIG_DEV_MODE: '1', AGENT_CONFIG_NO_UI: '1' };
            const p = spawnSync('python3', [PY_SCRIPT, '--minimal', '--project', pdir, '--quiet'], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
                env: { ...env, PYTHONPATH: path.join(REPO_ROOT, 'src') },
            });
            const t = spawnSync(TSX_BIN, [TS_SCRIPT, '--minimal', '--project', tdir, '--quiet'], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
                env,
            });
            expect(t.status).toBe(p.status);
            expect(p.status).toBe(0);
            // --quiet silences stdout; the produced file tree is the contract.
            const treeOf = (root: string): string[] => {
                const out: string[] = [];
                const walk = (d: string, prefix: string): void => {
                    for (const name of fs.readdirSync(d).sort()) {
                        const full = path.join(d, name);
                        const rel = prefix ? `${prefix}/${name}` : name;
                        if (fs.statSync(full).isDirectory()) {
                            out.push(rel + '/');
                            walk(full, rel);
                        } else {
                            out.push(rel);
                        }
                    }
                };
                walk(root, '');
                return out;
            };
            expect(treeOf(tdir)).toEqual(treeOf(pdir));
            // Spot-check a deployed file is byte-identical.
            const readme = 'agents/overrides/README.md';
            expect(fs.readFileSync(path.join(tdir, readme), 'utf8')).toBe(
                fs.readFileSync(path.join(pdir, readme), 'utf8'),
            );
        } finally {
            fs.rmSync(pdir, { recursive: true, force: true });
            fs.rmSync(tdir, { recursive: true, force: true });
        }
    });
});
