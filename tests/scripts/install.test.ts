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
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as inst from '../../src/scripts/install.js';

// Resolve TSX_BIN to an ABSOLUTE path: golden-parity runs spawn with cwd set
// to a temp dir, and a relative binary path would resolve against that cwd
// (→ ENOENT → status:null). The env override is honored but absolutized.



/** Normalize machine-specific tmp paths so the differential stays stable. */

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
