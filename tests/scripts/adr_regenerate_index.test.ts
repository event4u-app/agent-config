// Tests for src/scripts/adr/regenerate_index.ts (py2ts Phase 8).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (fm, scan duplicate/mismatch/supersedes detection, row
// title-casing + label, render) plus a golden-parity layer that runs
// python3 vs tsx and compares stdout + stderr + exit code byte-for-byte.
//
// The write path (--report) would overwrite the live docs/decisions/INDEX.md,
// so the golden-parity layer copies the real ADR-*.md set into two throwaway
// tmp dirs (one for python3, one for tsx) and asserts the generated INDEX.md
// is byte-identical. The error paths (duplicate number, adr/filename
// mismatch, dangling supersedes) and the empty-dir / not-found paths use
// synthetic fixtures. Everything is deterministic — zero git drift; the live
// tree is never written.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import * as rgi from '../../src/scripts/adr/regenerate_index.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'adr', 'regenerate_index.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'adr', 'regenerate_index.py');
const DECISIONS = path.join(REPO_ROOT, 'docs', 'decisions');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-idx-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

/** Write a minimal ADR file with the given frontmatter fields. */
function writeAdr(dir: string, name: string, fm: Record<string, string>): void {
    const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
    fs.writeFileSync(path.join(dir, name), `---\n${lines.join('\n')}\n---\nbody\n`);
}

describe('regenerate_index — pure helpers', () => {
    it('scan splits numbered vs legacy and parses frontmatter', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-001-first-thing.md', { adr: '1', status: 'accepted', date: '2026-01-01', decision: 'first-thing' });
        fs.writeFileSync(path.join(d, 'ADR-legacy-note.md'), '---\nstatus: draft\n---\nbody\n');
        const [num, leg, errs] = rgi.scan(d);
        expect(errs).toEqual([]);
        expect(num).toHaveLength(1);
        expect(num[0]!.num).toBe('001');
        expect(num[0]!.slug).toBe('first-thing');
        expect(num[0]!.path).toBe('ADR-001-first-thing.md');
        expect(num[0]!.status).toBe('accepted');
        expect(leg).toHaveLength(1);
        expect(leg[0]!.path).toBe('ADR-legacy-note.md');
    });

    it('scan skips INDEX.md and ignores non-ADR files', () => {
        const d = mkTmp();
        fs.writeFileSync(path.join(d, 'INDEX.md'), 'whatever');
        fs.writeFileSync(path.join(d, 'README.md'), 'whatever');
        writeAdr(d, 'ADR-002-x.md', { adr: '2', decision: 'x' });
        const [num, leg] = rgi.scan(d);
        expect(num).toHaveLength(1);
        expect(leg).toHaveLength(0);
    });

    it('scan flags an adr/filename mismatch', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-008-mismatch.md', { adr: '7', decision: 'mismatch' });
        const [, , errs] = rgi.scan(d);
        expect(errs).toContain('ADR-008-mismatch.md: adr=7 != filename 008');
    });

    it('scan accepts a zero-padded adr matching the filename number', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-008-ok.md', { adr: '008', decision: 'ok' });
        const [, , errs] = rgi.scan(d);
        expect(errs).toEqual([]);
    });

    it('scan flags a duplicate number (second filename listed against the first)', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-005-first.md', { adr: '5', decision: 'first' });
        writeAdr(d, 'ADR-005-second.md', { adr: '5', decision: 'second' });
        const [, , errs] = rgi.scan(d);
        expect(errs).toContain('ADR-005 duplicate: ADR-005-second.md and ADR-005-first.md');
    });

    it('scan flags a dangling supersedes link', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-009-dangling.md', { adr: '9', decision: 'dangling', supersedes: 'ADR-042' });
        const [, , errs] = rgi.scan(d);
        expect(errs).toContain('ADR-009-dangling.md: supersedes ADR-042 not found');
    });

    it('scan resolves a valid supersedes link (no error)', () => {
        const d = mkTmp();
        writeAdr(d, 'ADR-001-base.md', { adr: '1', decision: 'base' });
        writeAdr(d, 'ADR-002-super.md', { adr: '2', decision: 'super', supersedes: 'ADR-001' });
        const [, , errs] = rgi.scan(d);
        expect(errs).toEqual([]);
    });

    it('row title-cases the decision and emits the ADR-NNN label', () => {
        const out = rgi.row({ num: '001', slug: 'foo-bar', path: 'ADR-001-foo-bar.md', decision: 'python-to-ts-migration', status: 'accepted', date: '2026-01-01' });
        expect(out).toBe('| [ADR-001](ADR-001-foo-bar.md) | Python To Ts Migration | accepted | 2026-01-01 | — |');
    });

    it('row falls back to the slug, then to dashes, when decision is absent', () => {
        const out = rgi.row({ num: '003', slug: 'just-the-slug', path: 'ADR-003-just-the-slug.md' });
        expect(out).toBe('| [ADR-003](ADR-003-just-the-slug.md) | Just The Slug | — | — | — |');
    });

    it('row for a legacy entry strips .md for the label and renders em-dash placeholders', () => {
        const out = rgi.row({ path: 'ADR-rule-kernel.md' });
        expect(out).toBe('| [ADR-rule-kernel](ADR-rule-kernel.md) | — | — | — | — |');
    });

    it('render emits the No-ADRs body when empty', () => {
        expect(rgi.render([], [])).toBe(
            '# ADR Index\n\n_Auto-generated by `scripts/adr/regenerate_index.py`. Do not edit._\n\nNo ADRs yet.\n',
        );
    });

    it('render appends the Unnumbered (legacy) section only when legacy rows exist', () => {
        const out = rgi.render(
            [{ num: '001', slug: 'a', path: 'ADR-001-a.md', decision: 'a' }],
            [{ path: 'ADR-legacy.md' }],
        );
        expect(out).toContain('## Unnumbered (legacy)');
        const noLegacy = rgi.render([{ num: '001', slug: 'a', path: 'ADR-001-a.md', decision: 'a' }], []);
        expect(noLegacy).not.toContain('## Unnumbered (legacy)');
    });
});

describe.runIf(hasPython3())('regenerate_index — golden parity (python3 vs tsx)', () => {
    it('--check matches on the real docs/decisions tree (read-only)', () => {
        const args = ['--check', '--dir', DECISIONS];
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('default dir (docs/adr/ missing) prints the same not-found message + exit 2', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('--report writes a byte-identical INDEX.md from the real ADR set', () => {
        const real = fs
            .readdirSync(DECISIONS)
            .filter((n) => n.startsWith('ADR-') && n.endsWith('.md'));
        const pyDir = mkTmp();
        const tsDir = mkTmp();
        for (const n of real) {
            fs.copyFileSync(path.join(DECISIONS, n), path.join(pyDir, n));
            fs.copyFileSync(path.join(DECISIONS, n), path.join(tsDir, n));
        }
        const py = spawnSync('python3', [PY_SCRIPT, '--dir', pyDir], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--dir', tsDir], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        // stdout embeds the dir path; normalise that one token, compare the rest.
        expect(ts.stdout.replace(tsDir, 'DIR')).toBe(py.stdout.replace(pyDir, 'DIR'));
        expect(ts.stderr).toBe(py.stderr);
        const pyIdx = fs.readFileSync(path.join(pyDir, 'INDEX.md'), 'utf8');
        const tsIdx = fs.readFileSync(path.join(tsDir, 'INDEX.md'), 'utf8');
        expect(tsIdx).toBe(pyIdx);
    });

    it('--report on an empty dir writes the same No-ADRs INDEX.md', () => {
        const pyDir = mkTmp();
        const tsDir = mkTmp();
        spawnSync('python3', [PY_SCRIPT, '--dir', pyDir], { encoding: 'utf8', cwd: REPO_ROOT });
        spawnSync(TSX_BIN, [TS_SCRIPT, '--dir', tsDir], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(fs.readFileSync(path.join(tsDir, 'INDEX.md'), 'utf8')).toBe(
            fs.readFileSync(path.join(pyDir, 'INDEX.md'), 'utf8'),
        );
    });

    it('duplicate ADR number → byte-identical error + exit 2 (the orchestrator path)', () => {
        const dir = mkTmp();
        writeAdr(dir, 'ADR-005-first.md', { adr: '5', status: 'accepted', date: '2026-01-01', decision: 'first' });
        writeAdr(dir, 'ADR-005-second.md', { adr: '5', status: 'draft', date: '2026-01-02', decision: 'second' });
        const py = spawnSync('python3', [PY_SCRIPT, '--dir', dir], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--dir', dir], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.stderr).toContain('ADR-005 duplicate');
    });

    it('adr/filename mismatch + dangling supersedes → byte-identical errors + exit 2', () => {
        const dir = mkTmp();
        writeAdr(dir, 'ADR-008-mismatch.md', { adr: '7', decision: 'mismatch' });
        writeAdr(dir, 'ADR-009-dangling.md', { adr: '9', decision: 'dangling', supersedes: 'ADR-042' });
        const py = spawnSync('python3', [PY_SCRIPT, '--dir', dir], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--dir', dir], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
});
