// Tests for src/scripts/generate_capability_matrix.ts (py2ts, ADR-096).
//
// No pytest suite exists, so this is a focused differential suite: the
// derivation guard (`parse_dispatcher_generators` reads the live condense.ts
// dispatcher) + `build_matrix` / `coverage_guard` / `render_json` purity
// (including the `ensure_ascii` `†` escape of the `†` cell), plus a
// golden-parity layer that runs python3 vs tsx on the real tree — byte-exact
// docs/capability-matrix.md AND dist/discovery/capability-matrix.json, plus
// identical stdout/stderr/exit for --check and the argparse-error path
// (skipped without python3). Writers leave zero on-disk drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as gen from '../../src/scripts/generate_capability_matrix.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_capability_matrix.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_capability_matrix.py');
const OUT_MD = path.join(REPO_ROOT, 'docs', 'capability-matrix.md');
const OUT_JSON = path.join(REPO_ROOT, 'dist', 'discovery', 'capability-matrix.json');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    path.join(
        REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('generate_capability_matrix — derivation + matrix purity', () => {
    it('the dispatcher derivation is fully covered by _FN_SPEC (empty guard)', () => {
        // Every generate_* call in condense.ts _generate_tools_inner is mapped.
        expect(gen.coverage_guard()).toEqual([]);
        const gens = gen.parse_dispatcher_generators();
        expect(gens.size).toBeGreaterThan(0);
        expect(gens.has('generate_rule_symlinks')).toBe(true);
        expect(gens.has('generate_plugin_hooks')).toBe(true);
    });

    it('build_matrix fills native/adapter cells and the install-time † cell', () => {
        const m = gen.build_matrix();
        // rules: claude-code native, cursor adapter, copilot install-time adapter†.
        expect(m['rules']?.['claude-code']).toBe('native');
        expect(m['rules']?.['cursor']).toBe('adapter');
        expect(m['rules']?.['copilot']).toBe('adapter†');
        // hooks only on claude-plugin; nothing on copilot.
        expect(m['hooks']?.['claude-plugin']).toBe('native');
        expect(m['hooks']?.['copilot']).toBe('none');
        // every artifact row carries every host.
        for (const a of Object.keys(m)) {
            expect(Object.keys(m[a] as Record<string, string>).length).toBe(9);
        }
    });

    it('render_md emits the host header table + glyph cells', () => {
        const md = gen.render_md(gen.build_matrix());
        expect(md.startsWith('# Capability matrix — what works on which host\n')).toBe(true);
        expect(md).toContain('| Artifact | claude-code | claude-plugin |');
        expect(md).toContain('🔁 adapter †'); // copilot install-time cell
        expect(md).toContain('✅ native');
        expect(md).toContain('— none');
        expect(md.endsWith('\n')).toBe(true);
        expect(md.endsWith('\n\n')).toBe(false);
    });

    it('render_json escapes the non-ASCII † to \\u2020 (ensure_ascii) and carries a checksum', () => {
        const js = gen.render_json(gen.build_matrix());
        expect(js).toContain('\\u2020'); // † escaped, never raw
        expect(js).not.toContain('†');
        expect(js).toMatch(/"checksum": "sha256:[0-9a-f]{64}"/);
        // sorted keys, 2-space indent, trailing newline.
        expect(js.startsWith('{\n  "artifacts": [')).toBe(true);
        expect(js.endsWith('}\n')).toBe(true);
    });
});

describe.runIf(hasPython3())('generate_capability_matrix — golden parity (python3 vs tsx)', () => {
    let mdBak: string | null = null;
    let jsonExisted = false;
    let jsonBak: string | null = null;

    afterEach(() => {
        if (mdBak !== null) fs.writeFileSync(OUT_MD, mdBak, 'utf-8');
        if (jsonExisted) {
            if (jsonBak !== null) fs.writeFileSync(OUT_JSON, jsonBak, 'utf-8');
        } else if (fs.existsSync(OUT_JSON)) {
            fs.rmSync(OUT_JSON);
        }
        mdBak = null;
        jsonBak = null;
    });

    it('--check: identical stdout + stderr + exit code', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('--check --quiet: silent OK, identical across engines', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--check', '--quiet'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check', '--quiet'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('argparse error (--bogus): exit 2, identical usage/error on stderr', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--bogus'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(2);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('write: byte-identical capability-matrix.md + .json, zero drift after restore', () => {
        mdBak = fs.existsSync(OUT_MD) ? fs.readFileSync(OUT_MD, 'utf-8') : null;
        jsonExisted = fs.existsSync(OUT_JSON);
        jsonBak = jsonExisted ? fs.readFileSync(OUT_JSON, 'utf-8') : null;

        const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(0);
        const pyMd = fs.readFileSync(OUT_MD, 'utf-8');
        const pyJson = fs.readFileSync(OUT_JSON, 'utf-8');

        // Reset to original bytes before the TS run so each writes fresh.
        if (mdBak !== null) fs.writeFileSync(OUT_MD, mdBak, 'utf-8');
        if (fs.existsSync(OUT_JSON)) fs.rmSync(OUT_JSON);

        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(0);
        const tsMd = fs.readFileSync(OUT_MD, 'utf-8');
        const tsJson = fs.readFileSync(OUT_JSON, 'utf-8');

        expect(tsMd).toBe(pyMd);
        expect(tsJson).toBe(pyJson);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
});
