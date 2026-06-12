// Tests for src/scripts/skill_overlap.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public helpers (parse_frontmatter, tokenize, symbol_set,
// jaccard, analyse) plus a golden-parity layer that runs python3 vs tsx on
// the REAL REPO with --quiet and against a tmp --out, comparing stdout +
// the written report byte-for-byte (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as so from '../../src/scripts/skill_overlap.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_overlap.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_overlap.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('skill_overlap — behavioural spec', () => {
    it('parse_frontmatter reads description + body', () => {
        const [fm, body] = so.parse_frontmatter(
            '---\nname: x\ndescription: "Use when foo"\n---\nbody line\n',
        );
        expect(fm['name']).toBe('x');
        expect(fm['description']).toBe('Use when foo');
        expect(body).toBe('\nbody line\n');
    });

    it('parse_frontmatter joins continuation lines only for a bare key', () => {
        // Inline value → continuation lines are NOT appended (matches Python).
        const [inlineFm] = so.parse_frontmatter(
            '---\ndescription: line one\n  line two\nname: y\n---\nb\n',
        );
        expect(inlineFm['description']).toBe('line one');
        expect(inlineFm['name']).toBe('y');
        // Bare key (no inline value) → continuation lines join with a space.
        const [bareFm] = so.parse_frontmatter(
            '---\ndescription:\n  line one\n  line two\nname: y\n---\nb\n',
        );
        expect(bareFm['description']).toBe('line one line two');
        expect(bareFm['name']).toBe('y');
    });

    it('parse_frontmatter returns [{}, text] without fence', () => {
        const [fm, body] = so.parse_frontmatter('no fence here\n');
        expect(fm).toEqual({});
        expect(body).toBe('no fence here\n');
    });

    it('tokenize drops stopwords, digits, short tokens', () => {
        const toks = so.tokenize('Use the Laravel Eloquent model 123 ab');
        expect(toks.has('laravel')).toBe(true);
        expect(toks.has('eloquent')).toBe(true);
        expect(toks.has('model')).toBe(true);
        expect(toks.has('the')).toBe(false); // stopword
        expect(toks.has('use')).toBe(false); // stopword
        expect(toks.has('123')).toBe(false); // digit
        expect(toks.has('ab')).toBe(false); // < 3 (regex requires 3+ chars)
    });

    it('symbol_set extracts cited paths, strips backticks', () => {
        const syms = so.symbol_set('see `scripts/foo.py` and agents/bar/baz.md plus docs/x/y.md');
        expect(syms.has('scripts/foo.py')).toBe(true);
        expect(syms.has('agents/bar/baz.md')).toBe(true);
        expect(syms.has('docs/x/y.md')).toBe(true);
    });

    it('jaccard math', () => {
        expect(so.jaccard(new Set(), new Set())).toBe(0.0);
        expect(so.jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1.0);
        expect(so.jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBe(1 / 3);
    });

    it('analyse tiers strong vs candidate, stable order', () => {
        const skills = [
            { slug: 'a', tokens: new Set(['alpha', 'beta', 'gamma']), symbols: new Set<string>() },
            { slug: 'b', tokens: new Set(['alpha', 'beta', 'gamma']), symbols: new Set<string>() }, // identical → strong
            { slug: 'c', tokens: new Set(['alpha', 'delta', 'epsilon']), symbols: new Set<string>() }, // partial → candidate vs a/b
        ];
        const pairs = so.analyse(skills);
        // a/b is a perfect token match → strong, sorts first.
        expect(pairs[0]!.skill_a).toBe('a');
        expect(pairs[0]!.skill_b).toBe('b');
        expect(pairs[0]!.tier).toBe('strong');
        expect(pairs[0]!.description_jaccard).toBe(1.0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('skill_overlap — golden parity (python3 vs tsx)', () => {
    // The non-quiet stdout line uses `Path.relative_to(REPO)` (raises on an
    // out-of-repo path — a faithfully-replicated Python quirk), so the
    // default-run fixture out dir lives UNDER the repo root and is removed
    // in `finally` (fresh tmp dir → zero git drift).
    // NOTE: skill_overlap hard-binds the legacy `.agent-src.uncondensed/skills`
    // source root. In this worktree the skills live under `src/skills`, so
    // BOTH runtimes hit the "no skills under …" path (exit 1, no file). The
    // parity assertion holds regardless of which state the repo is in: same
    // stdout, stderr, exit, and — when a report IS written — same bytes.
    it('default run matches stdout/stderr/exit byte-for-byte (+ report when written)', () => {
        const dir = fs.mkdtempSync(path.join(REPO_ROOT, '.so-par-'));
        try {
            const pyOut = path.join(dir, 'py.md');
            const tsOut = path.join(dir, 'ts.md');
            const py = spawnSync('python3', [PY_SCRIPT, '--out', pyOut], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--out', tsOut], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            expect(ts.status).toBe(py.status);
            const norm = (s: string): string => s.replace(/(ts|py)\.md/, '<out>.md');
            expect(norm(ts.stdout)).toBe(norm(py.stdout));
            expect(ts.stderr).toBe(py.stderr);
            const pyWrote = fs.existsSync(pyOut);
            expect(fs.existsSync(tsOut)).toBe(pyWrote);
            if (pyWrote) {
                expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
            }
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('--quiet run matches stdout/stderr/exit (+ report when written)', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'so-q-'));
        try {
            const pyOut = path.join(dir, 'py.md');
            const tsOut = path.join(dir, 'ts.md');
            const py = spawnSync('python3', [PY_SCRIPT, '--quiet', '--out', pyOut], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--quiet', '--out', tsOut], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            const pyWrote = fs.existsSync(pyOut);
            expect(fs.existsSync(tsOut)).toBe(pyWrote);
            if (pyWrote) {
                expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
            }
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
