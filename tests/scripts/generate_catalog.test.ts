// Tests for src/scripts/generate_catalog.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// public renderers (parse_skill, collect_skills, render_llms_txt,
// render_catalog_md) plus a golden-parity layer (python3 vs tsx) on the REAL
// REPO asserting the generated llms.txt + docs/skills-catalog.md are
// byte-identical AND that the tsx writer reproduces the committed output with
// ZERO git drift. The working tree is restored afterwards. Skipped without
// python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    collect_skills,
    parse_skill,
    render_catalog_md,
    render_llms_txt,
} from '../../src/scripts/generate_catalog.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_catalog.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_catalog.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const LLMS_TXT = path.join(REPO_ROOT, 'llms.txt');
const CATALOG_MD = path.join(REPO_ROOT, 'docs', 'skills-catalog.md');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

let tmpDir: string;
beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gencat-'));
});
afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('parse_skill', () => {
    it('extracts name + description from frontmatter', () => {
        const p = path.join(tmpDir, 'SKILL.md');
        fs.writeFileSync(p, '---\nname: foo\ndescription: "Use when X — Y, Z."\n---\nbody\n', 'utf-8');
        expect(parse_skill(p)).toEqual(['foo', 'Use when X — Y, Z.']);
    });
    it('returns null when frontmatter is absent', () => {
        const p = path.join(tmpDir, 'SKILL.md');
        fs.writeFileSync(p, 'no frontmatter\n', 'utf-8');
        expect(parse_skill(p)).toBeNull();
    });
    it('returns null when description missing', () => {
        const p = path.join(tmpDir, 'SKILL.md');
        fs.writeFileSync(p, '---\nname: foo\n---\nbody\n', 'utf-8');
        expect(parse_skill(p)).toBeNull();
    });
});

describe('renderers', () => {
    const skills: Array<[string, string]> = [
        ['alpha', 'Use when alpha.'],
        ['beta', 'Use when beta.'],
    ];
    it('render_llms_txt has the index header + one line per skill', () => {
        const out = render_llms_txt(skills);
        expect(out.startsWith('# agent-config — Skill Index')).toBe(true);
        expect(out).toContain('alpha: Use when alpha.');
        expect(out).toContain('beta: Use when beta.');
        expect(out.endsWith('\n')).toBe(true);
    });
    it('render_catalog_md has the count + a markdown row per skill', () => {
        const out = render_catalog_md(skills);
        expect(out).toContain('All **2 skills**');
        expect(out).toContain('| [`alpha`](../dist/agent-src/skills/alpha/SKILL.md) | Use when alpha. |');
        expect(out).toContain('← [Back to README](../README.md)');
    });
    it('collect_skills finds the real repo skills', () => {
        // Sort order follows pathlib component order; the parity layer asserts
        // byte-identity with python3 — that is the real ordering contract. Here
        // we only check the collection is non-trivial and well-formed.
        const found = collect_skills();
        expect(found.length).toBeGreaterThan(50);
        for (const [name, desc] of found) {
            expect(typeof name).toBe('string');
            expect(typeof desc).toBe('string');
            expect(name.length).toBeGreaterThan(0);
        }
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('generate_catalog — golden parity (python3 vs tsx)', () => {
    it('python3 and tsx produce byte-identical outputs with zero git drift; tree restored', () => {
        const origLlms = fs.readFileSync(LLMS_TXT, 'utf-8');
        const origCatalog = fs.readFileSync(CATALOG_MD, 'utf-8');
        try {
            const p = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
            expect(p.status).toBe(0);
            const pyLlms = fs.readFileSync(LLMS_TXT, 'utf-8');
            const pyCatalog = fs.readFileSync(CATALOG_MD, 'utf-8');
            // python3 baseline reproduces the committed output (zero drift).
            expect(pyLlms).toBe(origLlms);
            expect(pyCatalog).toBe(origCatalog);

            const t = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
            expect(t.status).toBe(0);
            const tsLlms = fs.readFileSync(LLMS_TXT, 'utf-8');
            const tsCatalog = fs.readFileSync(CATALOG_MD, 'utf-8');
            // tsx reproduces the committed output (zero drift) — identical to py.
            expect(tsLlms).toBe(pyLlms);
            expect(tsCatalog).toBe(pyCatalog);
            expect(tsLlms).toBe(origLlms);
            expect(tsCatalog).toBe(origCatalog);
            expect(t.stdout).toBe(p.stdout);
            expect(t.stderr).toBe(p.stderr);
        } finally {
            fs.writeFileSync(LLMS_TXT, origLlms, 'utf-8');
            fs.writeFileSync(CATALOG_MD, origCatalog, 'utf-8');
        }
    });
});
