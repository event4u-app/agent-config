/**
 * Tests for `src/scripts/lint_major_migration_sections.ts`.
 *
 * The gate reports an ABSENCE — "every breaking major has a section" — so the
 * failure mode worth testing is a green run that compared nothing. The suite
 * pins both directions and the vacuity guard:
 *
 *   1. a breaking major with no heading is refused, and the message NAMES the
 *      version (the acceptance criterion is the naming, not just the exit),
 *   2. the same fixture passes once the heading exists — the pair is what
 *      proves the heading is what clears it,
 *   3. a heading for a different major does not satisfy it,
 *   4. the floor forgives older majors, and a major with no BREAKING entries
 *      owes nothing,
 *   5. a tree with no changelog reds rather than reading as clean,
 *   6. the REAL tree carries a section for every in-scope major, and reds when
 *      one is taken away.
 *
 * Case 6 is the one that keeps this honest against the live corpus: a gate
 * whose sensitivity is only ever shown on synthetic fixtures has unknown
 * sensitivity on the tree it actually guards.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    FLOOR_MAJOR,
    findMajorSections,
    migrationVersions,
    pendingMajorFinding,
} from '../../src/scripts/lint_major_migration_sections.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_major_migration_sections.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function run(args: string[] = []) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function changelog(version: string, breaking: readonly string[]): string {
    return [
        '# Changelog',
        '',
        `## [${version}](https://example.invalid/compare) (2026-01-01)`,
        '',
        ...(breaking.length > 0
            ? ['### BREAKING CHANGES', '', ...breaking.map((b) => `* ${b}`), '']
            : []),
        '### Features',
        '',
        '* something additive',
        '',
    ].join('\n');
}

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lmms-test-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function fixture(changelogText: string | null, migrationHeadings: readonly string[]): string {
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    if (changelogText !== null) {
        fs.writeFileSync(path.join(root, 'CHANGELOG.md'), changelogText, 'utf8');
    }
    fs.writeFileSync(
        path.join(root, 'docs', 'MIGRATION.md'),
        ['# Migration Guide', '', ...migrationHeadings.flatMap((h) => [h, '', 'body', ''])].join('\n'),
        'utf8',
    );
    return root;
}

describe('lint_major_migration_sections — the fixture pair', () => {
    it('refuses a breaking major with no MIGRATION heading, and names the version', () => {
        const dir = fixture(changelog('17.0.0', ['**x:** drop y']), []);
        const r = run(['--root', dir]);
        expect(r.status).toBe(1);
        expect(`${r.stdout}${r.stderr}`).toContain('17.0.0');
    });

    it('passes once the heading exists', () => {
        const dir = fixture(changelog('17.0.0', ['**x:** drop y']), ['## 17.0.0 — what to do']);
        expect(run(['--root', dir]).status).toBe(0);
    });

    it('refuses again when the heading is taken away — sensitivity, not a one-way check', () => {
        const dir = fixture(changelog('17.0.0', ['**x:** drop y']), ['## 17.0.0 — what to do']);
        expect(run(['--root', dir]).status).toBe(0);
        fs.writeFileSync(path.join(dir, 'docs', 'MIGRATION.md'), '# Migration Guide\n', 'utf8');
        expect(run(['--root', dir]).status).toBe(1);
    });
});

describe('lint_major_migration_sections — what is and is not in scope', () => {
    it('does not accept a heading naming a different major', () => {
        const dir = fixture(changelog('17.0.0', ['**x:** drop y']), ['## 16.0.0 — what to do']);
        expect(run(['--root', dir]).status).toBe(1);
    });

    it('accepts the arrow heading form the file already uses', () => {
        const dir = fixture(changelog('17.0.0', ['**x:** drop y']), [
            '## 16.x → 17.0.0 — what to do',
        ]);
        expect(run(['--root', dir]).status).toBe(0);
    });

    it('forgives a major below the floor', () => {
        const dir = fixture(changelog(`${String(FLOOR_MAJOR - 1)}.0.0`, ['**x:** drop y']), []);
        expect(run(['--root', dir]).status).toBe(0);
    });

    it('asks nothing of a major with no BREAKING entries', () => {
        const dir = fixture(changelog('17.0.0', []), []);
        expect(run(['--root', dir]).status).toBe(0);
    });

    it('reds on a tree with no changelog rather than reading as clean', () => {
        const dir = fixture(null, []);
        expect(run(['--root', dir]).status).toBe(1);
    });

    it('reds when MIGRATION.md itself is missing', () => {
        fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
        fs.writeFileSync(path.join(root, 'CHANGELOG.md'), changelog('17.0.0', ['**x:** drop']), 'utf8');
        expect(run(['--root', root]).status).toBe(1);
    });
});

describe('findMajorSections / migrationVersions', () => {
    it('counts only BREAKING bullets, and only for X.0.0 sections', () => {
        const text = [
            '## [17.0.0](l) (2026-01-01)',
            '### BREAKING CHANGES',
            '* one',
            '* two',
            '### Features',
            '* three',
            '',
            '## [17.1.0](l) (2026-01-02)',
            '### BREAKING CHANGES',
            '* four',
        ].join('\n');
        const found = findMajorSections(text, 'CHANGELOG.md');
        expect(found.map((s) => s.version)).toEqual(['17.0.0']);
        expect(found[0]?.breaking).toBe(2);
    });

    it('stops a section at the next heading rather than swallowing the file', () => {
        const text = [
            '## [17.0.0](l) (2026-01-01)',
            '### Features',
            '* additive',
            '',
            '# Era: pre-17.0.0 — archived',
            '',
            '## [16.0.0](l) (2025-12-01)',
            '### BREAKING CHANGES',
            '* not 17s',
        ].join('\n');
        const found = findMajorSections(text, 'CHANGELOG.md');
        expect(found.find((s) => s.version === '17.0.0')?.breaking).toBe(0);
        expect(found.find((s) => s.version === '16.0.0')?.breaking).toBe(1);
    });

    it('reads a version out of any `## ` heading shape, and only whole tokens', () => {
        const v = migrationVersions(
            ['## 16.0.0 — a', '## 8.x → 9.0.0 — b', '## 14.22.x — c', '### 15.0.0 — sub'].join('\n'),
        );
        expect([...v].sort()).toEqual(['16.0.0', '9.0.0']);
    });
});

describe('pendingMajorFinding — the cut-time seam release.ts uses', () => {
    it('refuses a pending major entry with BREAKING and no section, naming the version', () => {
        const finding = pendingMajorFinding('17.0.0', changelog('17.0.0', ['**x:** drop']), '# M\n');
        expect(finding).not.toBeNull();
        expect(finding as string).toContain('17.0.0');
    });

    it('clears once the section exists', () => {
        expect(
            pendingMajorFinding('17.0.0', changelog('17.0.0', ['**x:** drop']), '## 17.0.0 — x\n'),
        ).toBeNull();
    });

    it('is silent for a minor target, whatever the entry says', () => {
        expect(
            pendingMajorFinding('17.1.0', changelog('17.1.0', ['**x:** drop']), '# M\n'),
        ).toBeNull();
    });
});

describe('the real tree', () => {
    it('has a migration section for every in-scope major', () => {
        const r = run(['--quiet']);
        expect(r.stderr).not.toContain('carries no');
        expect(r.status).toBe(0);
    });

    it('compares at least one major — a green run here is not vacuous', () => {
        const changelogText = fs.readFileSync(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');
        const archiveDir = path.join(REPO_ROOT, 'docs', 'archive');
        const sections = [
            ...findMajorSections(changelogText, 'CHANGELOG.md'),
            ...fs
                .readdirSync(archiveDir)
                .filter((n) => n.startsWith('CHANGELOG-') && n.endsWith('.md'))
                .flatMap((n) =>
                    findMajorSections(fs.readFileSync(path.join(archiveDir, n), 'utf8'), n),
                ),
        ];
        const inScope = sections.filter((s) => s.major >= FLOOR_MAJOR && s.breaking > 0);
        expect(inScope.length).toBeGreaterThan(0);
    });
});
