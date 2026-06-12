// Tests for src/scripts/generate_index.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (_parse_frontmatter, _truncate, _to_shipped_path) plus a
// golden-parity layer that runs python3 vs tsx on the REAL repo — both the
// `--check` summary AND byte-exact generated agents/index.md + docs/catalog.md
// via a snapshot+restore harness (skipped without python3). Writers must
// leave zero on-disk drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as gi from '../../src/scripts/generate_index.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_index.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_index.py');
const INDEX_PATH = path.join(REPO_ROOT, 'agents', 'index.md');
const CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'catalog.md');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('generate_index — pure helpers', () => {
    it('_parse_frontmatter reads top-level keys, strips quotes, skips indented lines', () => {
        const fm = gi._parse_frontmatter('---\nname: "foo"\ntype: always\n  nested: skip\n---\nbody');
        expect(fm).toEqual({ name: 'foo', type: 'always' });
    });
    it('_parse_frontmatter returns {} without frontmatter', () => {
        expect(gi._parse_frontmatter('no frontmatter here')).toEqual({});
    });
    it('_truncate escapes pipes, flattens newlines, caps at the limit with an ellipsis', () => {
        expect(gi._truncate('a | b\nc')).toBe('a \\| b c');
        const long = 'x'.repeat(250);
        const out = gi._truncate(long);
        expect(out.endsWith('…')).toBe(true);
        expect(out.length).toBe(200);
    });
    it('_to_shipped_path rewrites source paths and passes non-source paths through', () => {
        expect(gi._to_shipped_path('.agent-src.uncondensed/skills/x/SKILL.md')).toBe(
            'dist/agent-src/skills/x/SKILL.md',
        );
        expect(gi._to_shipped_path('docs/guidelines/php/general.md')).toBe('docs/guidelines/php/general.md');
    });
    it('_render_table builds a markdown table with the kind / link / extra / description row', () => {
        const t = gi._render_table(
            [{ kind: 'skill', name: 'x', description: 'd', extra: 'e', path: 'p.md' }],
            ['kind', 'name', 'extra', 'description'],
            '../',
        );
        expect(t).toContain('| skill | [`x`](../p.md) | e | d |');
    });
});

describe('generate_index — collectors run against the real repo', () => {
    it('skills / rules / commands / guidelines are non-empty and sorted', () => {
        const skills = gi._collect_skills();
        const rules = gi._collect_rules();
        const guidelines = gi._collect_guidelines();
        expect(skills.length).toBeGreaterThan(0);
        expect(rules.length).toBeGreaterThan(0);
        expect(guidelines.length).toBeGreaterThan(0);
        const names = skills.map((s) => s.name);
        expect([...names].sort()).toEqual(names);
    });
});

describe.runIf(hasPython3())('generate_index — golden parity (python3 vs tsx)', () => {
    let indexBak: string | null = null;
    let catalogBak: string | null = null;

    afterEach(() => {
        // Restore on-disk files to leave zero git drift.
        if (indexBak !== null) fs.writeFileSync(INDEX_PATH, indexBak, 'utf-8');
        if (catalogBak !== null) fs.writeFileSync(CATALOG_PATH, catalogBak, 'utf-8');
        indexBak = null;
        catalogBak = null;
    });

    it('--check: identical stdout + exit code', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('write: byte-identical agents/index.md + docs/catalog.md, zero drift after restore', () => {
        indexBak = fs.existsSync(INDEX_PATH) ? fs.readFileSync(INDEX_PATH, 'utf-8') : null;
        catalogBak = fs.existsSync(CATALOG_PATH) ? fs.readFileSync(CATALOG_PATH, 'utf-8') : null;

        const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(0);
        const pyIndex = fs.readFileSync(INDEX_PATH, 'utf-8');
        const pyCatalog = fs.readFileSync(CATALOG_PATH, 'utf-8');

        // Reset to the original bytes before the TS run so each writes fresh.
        if (indexBak !== null) fs.writeFileSync(INDEX_PATH, indexBak, 'utf-8');
        if (catalogBak !== null) fs.writeFileSync(CATALOG_PATH, catalogBak, 'utf-8');

        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(0);
        const tsIndex = fs.readFileSync(INDEX_PATH, 'utf-8');
        const tsCatalog = fs.readFileSync(CATALOG_PATH, 'utf-8');

        expect(tsIndex).toBe(pyIndex);
        expect(tsCatalog).toBe(pyCatalog);
        // stdout differs only in the leading emoji-status lines, which are
        // identical between implementations.
        expect(ts.stdout).toBe(py.stdout);
    });
});
