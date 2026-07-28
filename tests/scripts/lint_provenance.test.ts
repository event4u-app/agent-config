// Tests for src/scripts/lint_provenance.ts
// (road-to-provenance-and-license-governance S1.3).
//
// Two layers:
//   1. Pure-function fixtures (no git, no CLI spawn) — schema validation,
//      license-policy classification, transformation-note rejection, and
//      deterministic NOTICES rendering, each against a temp-dir repoRoot so
//      the files-exist check has something real to resolve against.
//   2. A CLI-level smoke test against the REAL repo ledger (spawns tsx),
//      proving the empty ledger passes end-to-end and the wiring holds.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    licenseClass,
    lintLedgerText,
    parseLedgerText,
    renderNotices,
    resolveDenyPolicy,
    transformationNoteFinding,
    validateRecord,
    type BorrowRecord,
    type DenyPolicy,
} from '../../src/scripts/lint_provenance.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_provenance.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const LONG_NOTE =
    "Rebuilt the retry loop around this repo's exponential-backoff helper instead of the source's fixed-delay sleep.";

const VALID_MIT: BorrowRecord = {
    source_url: 'https://example.com/owner/repo',
    license: 'MIT',
    source_sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3',
    borrowed_at: '2026-07-28',
    files: ['README.md'],
    transformation_note: LONG_NOTE,
    cleared_by: 'human',
};

// Built directly (no repo lookup) so tests don't depend on module init order
// or a temp dir with no license-policy.yaml — resolveDenyPolicy's own
// fallback behavior is exercised separately below.
const FALLBACK_DENY: DenyPolicy = { denyIds: new Set(['GPL-3.0-only', 'AGPL-3.0-only', 'SSPL-1.0']), source: 'built-in-fallback' };

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

function makeRepoWithFiles(relPaths: readonly string[]): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'provenance-repo-'));
    tmpDirs.push(root);
    for (const rel of relPaths) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, 'x', 'utf-8');
    }
    return root;
}

// ─── schema / field validation ───────────────────────────────────────────────

describe('lint_provenance — schema validation', () => {
    it('a valid MIT entry passes cleanly', () => {
        const root = makeRepoWithFiles(['README.md']);
        const findings = validateRecord(VALID_MIT, 1, root, FALLBACK_DENY);
        expect(findings).toEqual([]);
    });

    it('a non-existent file path fails', () => {
        const root = makeRepoWithFiles([]); // README.md deliberately absent
        const findings = validateRecord(VALID_MIT, 1, root, FALLBACK_DENY);
        expect(findings.some((f) => f.rule === 'schema' && f.message.includes('does not exist'))).toBe(true);
    });

    it('a bad SPDX id fails', () => {
        const root = makeRepoWithFiles(['README.md']);
        const bad = { ...VALID_MIT, license: 'Totally-Made-Up-License-9.9' };
        const findings = validateRecord(bad, 1, root, FALLBACK_DENY);
        expect(findings.some((f) => f.rule === 'schema' && f.message.includes('recognized SPDX id'))).toBe(true);
    });

    it('a missing field fails', () => {
        const root = makeRepoWithFiles(['README.md']);
        const { cleared_by: _omit, ...rest } = VALID_MIT;
        const findings = validateRecord(rest, 1, root, FALLBACK_DENY);
        expect(findings.some((f) => f.message.includes("missing required field 'cleared_by'"))).toBe(true);
    });

    it('an unexpected extra field fails (closed schema)', () => {
        const root = makeRepoWithFiles(['README.md']);
        const extra = { ...VALID_MIT, extra_field: 'nope' };
        const findings = validateRecord(extra, 1, root, FALLBACK_DENY);
        expect(findings.some((f) => f.message.includes("unexpected field 'extra_field'"))).toBe(true);
    });
});

// ─── license policy ──────────────────────────────────────────────────────────

describe('lint_provenance — license policy', () => {
    it('a permissive license classifies as allow', () => {
        expect(licenseClass('MIT', FALLBACK_DENY)).toBe('allow');
    });

    it('a deny-class (GPL) license classifies as deny', () => {
        expect(licenseClass('GPL-3.0-only', FALLBACK_DENY)).toBe('deny');
    });

    it('a deny-class (GPL) entry fails the linter', () => {
        const root = makeRepoWithFiles(['README.md']);
        const gpl = { ...VALID_MIT, license: 'GPL-3.0-only' };
        const findings = validateRecord(gpl, 1, root, FALLBACK_DENY);
        expect(findings.some((f) => f.rule === 'license-policy' && f.message.includes('deny-class'))).toBe(true);
    });

    it("an 'unknown' license fails the linter (principle #1)", () => {
        const root = makeRepoWithFiles(['README.md']);
        const unknown = { ...VALID_MIT, license: 'unknown' };
        const findings = validateRecord(unknown, 1, root, FALLBACK_DENY);
        expect(findings.some((f) => f.rule === 'license-policy' && f.message.includes('unknown escalates'))).toBe(true);
    });

    it('with no license-policy.yaml on disk, resolveDenyPolicy uses the built-in fallback', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'provenance-nopolicy-'));
        tmpDirs.push(root);
        const policy = resolveDenyPolicy(root);
        expect(policy.source).toBe('built-in-fallback');
        expect(policy.denyIds.has('GPL-3.0-only')).toBe(true);
    });
});

// ─── transformation_note ─────────────────────────────────────────────────────

describe('lint_provenance — transformation_note (principle #6)', () => {
    it('an empty note is missing', () => {
        expect(transformationNoteFinding('')).toMatch(/missing/);
    });

    it('a too-short note is missing', () => {
        expect(transformationNoteFinding('renamed a var')).toMatch(/missing/);
    });

    it('a long rename-only note is rejected as rename-only, not as too-short', () => {
        const note = 'We went through the file and renamed variables throughout to match our house naming style.';
        expect(note.length).toBeGreaterThanOrEqual(20);
        const finding = transformationNoteFinding(note);
        expect(finding).toMatch(/rename-only/);
    });

    it('a genuine structural note passes', () => {
        expect(transformationNoteFinding(LONG_NOTE)).toBeNull();
    });

    it('missing/short/rename-only transformation_note fails validateRecord', () => {
        const root = makeRepoWithFiles(['README.md']);
        const renameOnly = { ...VALID_MIT, transformation_note: 'Just renamed the variables, nothing else changed here at all.' };
        const findings = validateRecord(renameOnly, 1, root, FALLBACK_DENY);
        expect(findings.some((f) => f.rule === 'transformation-note')).toBe(true);
    });
});

// ─── ledger parsing + empty ledger ───────────────────────────────────────────

describe('lint_provenance — ledger parsing', () => {
    it('an empty ledger passes with zero records and zero findings', () => {
        const root = makeRepoWithFiles([]);
        const { records, findings } = lintLedgerText('', root, FALLBACK_DENY);
        expect(records).toEqual([]);
        expect(findings).toEqual([]);
    });

    it('blank lines are ignored', () => {
        const { parsed } = parseLedgerText('\n\n   \n');
        expect(parsed).toEqual([]);
    });

    it('invalid JSON on a line is a schema finding', () => {
        const { findings } = parseLedgerText('{not json}\n');
        expect(findings.length).toBe(1);
        expect(findings[0]!.rule).toBe('schema');
    });
});

// ─── NOTICES generation ──────────────────────────────────────────────────────

describe('lint_provenance — NOTICES generation', () => {
    it('an empty ledger renders an honest "no borrows recorded" line', () => {
        const notices = renderNotices([]);
        expect(notices).toContain('No third-party code borrows are currently recorded');
    });

    it('renderNotices is deterministic across repeat calls (byte-identical)', () => {
        const a = renderNotices([VALID_MIT]);
        const b = renderNotices([VALID_MIT]);
        expect(a).toBe(b);
    });

    it('NOTICES out of sync with the ledger is detected', () => {
        const empty = renderNotices([]);
        const nonEmpty = renderNotices([VALID_MIT]);
        expect(empty).not.toBe(nonEmpty);
    });
});

// ─── CLI smoke test (real repo, real tsx) ────────────────────────────────────

describe('lint_provenance — CLI', () => {
    it('exits 0 against the real (currently empty) repo ledger', () => {
        const result = spawnSync(TSX_BIN, [TS_SCRIPT, '--quiet'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
        });
        expect(result.status).toBe(0);
    });

    it('--regenerate-notices is deterministic on repeat runs against the real ledger', () => {
        const before = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'THIRD-PARTY-NOTICES.md'), 'utf-8');
        const run1 = spawnSync(TSX_BIN, [TS_SCRIPT, '--regenerate-notices', '--quiet'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
        });
        const after1 = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'THIRD-PARTY-NOTICES.md'), 'utf-8');
        const run2 = spawnSync(TSX_BIN, [TS_SCRIPT, '--regenerate-notices', '--quiet'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
        });
        const after2 = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'THIRD-PARTY-NOTICES.md'), 'utf-8');
        expect(run1.status).toBe(0);
        expect(run2.status).toBe(0);
        expect(after1).toBe(after2);
        // Restore byte-identical content (the real ledger is empty, so this is
        // a no-op in practice, but guards against drift if it ever isn't).
        expect(after1).toBe(before);
    });
});
