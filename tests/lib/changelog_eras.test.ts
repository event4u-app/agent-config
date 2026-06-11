/**
 * Vitest twin of `tests/test_changelog_eras.py` (drift gate, live
 * CHANGELOG.md) + `tests/test_changelog_split.py` (split machinery on a
 * tmpdir), plus a differential suite asserting the TS port and the
 * Python original (`src/scripts/_lib/changelog_eras.py`) produce
 * identical era segmentation over the repo's real CHANGELOG.md and
 * byte-identical `perform_split` output on a synthetic changelog
 * (ADR-088 parity gate 2, golden replay via `python3 -c` driver).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as eras from '../../src/scripts/_lib/changelog_eras.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

// ─── drift gate (mirror of tests/test_changelog_eras.py) ──────────────────────

describe('changelog era drift gate (live CHANGELOG.md)', () => {
    it('test_changelog_has_current_era', () => {
        const lines = eras.read_changelog_lines();
        const spans = eras.era_spans(lines);
        const current = spans.filter((s) => s.state === 'current');
        expect(
            current.length,
            "CHANGELOG.md must declare exactly one '# Era: X.Y.x — current' section. " +
                'See docs/contracts/CHANGELOG-conventions.md § Era splits.',
        ).toBeGreaterThan(0);
        expect(
            current.length,
            `CHANGELOG.md must declare exactly ONE current era, found ${current.length}: ` +
                `${JSON.stringify(current.map((c) => c.label))}`,
        ).toBe(1);
    });

    it('test_current_era_body_under_cap', () => {
        const lines = eras.read_changelog_lines();
        const body_size = eras.current_era_body_size(lines);
        expect(
            body_size,
            `Current era body is ${body_size} lines (cap ${eras.CURRENT_ERA_BODY_CAP}). ` +
                'Run `task release` — `scripts/release.py` will split the era ' +
                'automatically before bumping.',
        ).toBeLessThanOrEqual(eras.CURRENT_ERA_BODY_CAP);
    });

    it('test_archived_eras_point_at_existing_files', () => {
        const lines = eras.read_changelog_lines();
        const spans = eras.era_spans(lines);
        const archived = spans.filter((s) => s.state === 'archived');
        for (const span of archived) {
            // Look ahead a small window after the era header for the archive
            // link in the form (docs/archive/CHANGELOG-pre-X.Y.Z.md).
            const window = lines.slice(span.line_index, span.line_index + 8).join('\n');
            const matches = [...window.matchAll(eras.ARCHIVE_LINK_RE)].map((m) => m[1]!);
            expect(
                matches.length,
                `Archived era '${span.label}' at line ${span.line_index + 1} must ` +
                    'link to a file under docs/archive/CHANGELOG-pre-*.md within ' +
                    'the next few lines of its header.',
            ).toBeGreaterThan(0);
            for (const archive_name of matches) {
                const archive_path = path.join(eras.ARCHIVE_DIR, archive_name);
                expect(
                    fs.existsSync(archive_path),
                    `Era '${span.label}' links to ${archive_path} but the archive ` +
                        'file does not exist. Create the archive or update the link.',
                ).toBe(true);
            }
        }
    });

    it('test_conventions_doc_linked_from_changelog', () => {
        const lines = eras.read_changelog_lines();
        const header = lines.slice(0, 30).join('\n');
        expect(
            header,
            'CHANGELOG.md header (first 30 lines) must link to ' +
                'docs/contracts/CHANGELOG-conventions.md so the entry-shape ' +
                'contract is discoverable from the file it governs.',
        ).toContain('docs/contracts/CHANGELOG-conventions.md');
    });

    it('test_conventions_doc_exists', () => {
        expect(
            fs.existsSync(eras.CONVENTIONS),
            `${path.relative(ROOT, eras.CONVENTIONS)} must exist — it is the ` +
                'normative source for CHANGELOG.md entry shape and era discipline.',
        ).toBe(true);
    });
});

// ─── split machinery (mirror of tests/test_changelog_split.py) ────────────────

const SAVED_CHANGELOG = eras.CHANGELOG;
const SAVED_ARCHIVE_DIR = eras.ARCHIVE_DIR;

let tmp_path: string;

function _write_changelog(body: string): string {
    // Stage a CHANGELOG.md inside tmp_path and rewire module paths.
    const changelog = path.join(tmp_path, 'CHANGELOG.md');
    fs.writeFileSync(changelog, body, 'utf-8');
    const archive_dir = path.join(tmp_path, 'docs', 'archive');
    fs.mkdirSync(archive_dir, { recursive: true });
    eras._set_changelog_path(changelog);
    eras._set_archive_dir(archive_dir);
    return changelog;
}

function _era_3_2_body(extra_entry_lines = 0): string {
    const extra = Array.from({ length: extra_entry_lines }, (_, i) => `- entry line ${i}`).join('\n');
    return (
        '# Changelog\n\n' +
        'Conventions live in [`docs/contracts/CHANGELOG-conventions.md`]' +
        '(docs/contracts/CHANGELOG-conventions.md).\n\n' +
        '# Era: 3.2.x — current\n\n' +
        '> Started at `3.2.0`. Full entries live inline below.\n' +
        '> Cap 250 lines.\n\n' +
        '## [3.2.5](https://example/compare/3.2.4...3.2.5) (2026-05-20)\n\n' +
        '### Bug Fixes\n\n* fix something\n' +
        `${extra}\n\n` +
        '# Era: pre-3.2.0 — archived\n\n' +
        '> All entries before `3.2.0` live in\n' +
        '> [`docs/archive/CHANGELOG-pre-3.2.0.md`](docs/archive/CHANGELOG-pre-3.2.0.md).\n'
    );
}

describe('changelog split machinery (tmpdir)', () => {
    beforeEach(() => {
        tmp_path = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-eras-'));
    });

    afterEach(() => {
        // Snapshot + restore the rewired module constants.
        eras._set_changelog_path(SAVED_CHANGELOG);
        eras._set_archive_dir(SAVED_ARCHIVE_DIR);
        fs.rmSync(tmp_path, { recursive: true, force: true });
    });

    it('test_plan_split_minor_bump_crosses_boundary', () => {
        _write_changelog(_era_3_2_body());
        const plan = eras.plan_split('3.3.0');
        expect(plan).not.toBeNull();
        expect(plan!.boundary).toBe('3.3.0');
        expect(plan!.new_era_label).toBe('3.3.x');
        expect(plan!.old_era_label).toBe('3.2.x');
        expect(path.basename(plan!.archive_path)).toBe('CHANGELOG-pre-3.3.0.md');
        expect(plan!.commit_subject).toContain('split era 3.2.x → pre-3.3.0');
    });

    it('test_plan_split_major_bump_crosses_boundary', () => {
        _write_changelog(_era_3_2_body());
        const plan = eras.plan_split('4.0.0');
        expect(plan).not.toBeNull();
        expect(plan!.boundary).toBe('4.0.0');
        expect(plan!.new_era_label).toBe('4.0.x');
    });

    it('test_plan_split_patch_within_era_returns_none', () => {
        _write_changelog(_era_3_2_body());
        expect(eras.plan_split('3.2.6')).toBeNull();
    });

    it('test_plan_split_backwards_release_refuses', () => {
        _write_changelog(_era_3_2_body());
        expect(() => eras.plan_split('3.1.0')).toThrow(/older than current era/);
    });

    it('test_plan_split_rejects_non_semver', () => {
        _write_changelog(_era_3_2_body());
        expect(() => eras.plan_split('3.3.0-rc1')).toThrow(/not a bare semver/);
    });

    it('test_perform_split_moves_entries_and_collapses_era', () => {
        _write_changelog(_era_3_2_body(5));
        const plan = eras.plan_split('3.3.0');
        expect(plan).not.toBeNull();

        eras.perform_split(plan!);

        expect(fs.existsSync(plan!.archive_path)).toBe(true);
        const archive_text = fs.readFileSync(plan!.archive_path, 'utf-8');
        expect(archive_text).toContain('Changelog Archive — pre-3.3.0');
        expect(archive_text).toContain('## [3.2.5]');
        expect(archive_text).toContain('entry line 0');

        const changelog = fs.readFileSync(eras.CHANGELOG, 'utf-8');
        expect(changelog).toContain('# Era: 3.3.x — current');
        expect(changelog).toContain('# Era: pre-3.3.0 — archived');
        expect(changelog).not.toContain('## [3.2.5]'); // moved to archive
        // Pre-existing pre-3.2.0 pointer must survive the split.
        expect(changelog).toContain('# Era: pre-3.2.0 — archived');
    });

    it('test_perform_split_refuses_existing_archive', () => {
        _write_changelog(_era_3_2_body());
        const plan = eras.plan_split('3.3.0');
        expect(plan).not.toBeNull();
        fs.mkdirSync(path.dirname(plan!.archive_path), { recursive: true });
        fs.writeFileSync(plan!.archive_path, 'already here\n', 'utf-8');
        expect(() => eras.perform_split(plan!)).toThrow(/archive already exists/);
    });

    it('test_current_era_insertion_point_with_existing_heading', () => {
        const changelog = _write_changelog(_era_3_2_body());
        const lines = fs.readFileSync(changelog, 'utf-8').split('\n');
        lines.pop(); // splitlines() parity: no trailing empty element
        const idx = eras.current_era_insertion_point(lines);
        expect(idx).not.toBeNull();
        expect(lines[idx!]!.startsWith('## [3.2.5]')).toBe(true);
    });

    it('test_current_era_insertion_point_in_fresh_era', () => {
        const body =
            '# Changelog\n\n' +
            '# Era: 3.3.x — current\n\n' +
            '> Started at `3.3.0`. Full entries live inline below.\n' +
            '> Cap 250 lines.\n\n' +
            '# Era: pre-3.3.0 — archived\n\n' +
            '> Pointer.\n';
        const changelog = _write_changelog(body);
        const lines = fs.readFileSync(changelog, 'utf-8').split('\n');
        lines.pop(); // splitlines() parity
        const idx = eras.current_era_insertion_point(lines);
        expect(idx).not.toBeNull();
        const next_era_idx = lines.findIndex((ln) => ln.includes('pre-3.3.0'));
        // Insertion point lands AT-OR-BEFORE the next era header so the new
        // entry slots into the current era block (insertion is before lines[idx]).
        expect(idx!).toBeLessThanOrEqual(next_era_idx);
        // Insertion point must NOT land inside the intro blockquote.
        expect(!lines[idx! - 1]!.startsWith('>') || lines[idx! - 1] === '').toBe(true);
    });
});

// ─── differential parity vs the Python original ────────────────────────────────

function run_python(code: string, input?: string): string {
    return execFileSync('python3', ['-c', code], {
        cwd: ROOT,
        input: input ?? '',
        maxBuffer: 32 * 1024 * 1024,
        encoding: 'utf-8',
    });
}

function python_available(): boolean {
    try {
        execFileSync('python3', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

const PY_SEGMENTATION_DRIVER = `
import json, sys, pathlib
sys.path.insert(0, "src")
from scripts._lib import changelog_eras as eras
lines = eras.read_changelog_lines()
spans = eras.era_spans(lines)
print(json.dumps({
    "spans": [{"line_index": s.line_index, "label": s.label, "state": s.state} for s in spans],
    "current_index": eras.current_era_index(spans),
    "body_size": eras.current_era_body_size(lines),
    "insertion_point": eras.current_era_insertion_point(lines),
    "line_count": len(lines),
}))
`;

const PY_SPLIT_DRIVER = `
import json, sys, pathlib
sys.path.insert(0, "src")
from scripts._lib import changelog_eras as eras
workdir = pathlib.Path(sys.argv[1])
release = sys.argv[2]
eras.CHANGELOG = workdir / "CHANGELOG.md"
eras.ARCHIVE_DIR = workdir / "docs" / "archive"
plan = eras.plan_split(release)
assert plan is not None
eras.perform_split(plan)
print(json.dumps({
    "changelog": eras.CHANGELOG.read_text(encoding="utf-8"),
    "archive_name": plan.archive_path.name,
    "archive": plan.archive_path.read_text(encoding="utf-8"),
    "commit_subject": plan.commit_subject,
}))
`;

describe.skipIf(!python_available())('differential: TS twin vs Python original', () => {
    it('era segmentation over the real CHANGELOG.md is identical', () => {
        const py = JSON.parse(run_python(PY_SEGMENTATION_DRIVER)) as {
            spans: Array<{ line_index: number; label: string; state: string }>;
            current_index: number | null;
            body_size: number;
            insertion_point: number | null;
            line_count: number;
        };

        const lines = eras.read_changelog_lines();
        const spans = eras.era_spans(lines);
        const ts = {
            spans: spans.map((s) => ({ line_index: s.line_index, label: s.label, state: s.state })),
            current_index: eras.current_era_index(spans),
            body_size: eras.current_era_body_size(lines),
            insertion_point: eras.current_era_insertion_point(lines),
            line_count: lines.length,
        };

        expect(JSON.stringify(ts)).toBe(JSON.stringify(py));
    });

    it('perform_split output is byte-identical on a synthetic changelog', () => {
        const body = _era_3_2_body(7);
        const release = '3.3.0';

        // Python reference run in its own tmpdir.
        const py_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eras-diff-py-'));
        const ts_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eras-diff-ts-'));
        try {
            fs.writeFileSync(path.join(py_dir, 'CHANGELOG.md'), body, 'utf-8');
            fs.mkdirSync(path.join(py_dir, 'docs', 'archive'), { recursive: true });
            const py = JSON.parse(
                execFileSync('python3', ['-c', PY_SPLIT_DRIVER, py_dir, release], {
                    cwd: ROOT,
                    maxBuffer: 32 * 1024 * 1024,
                    encoding: 'utf-8',
                }),
            ) as { changelog: string; archive_name: string; archive: string; commit_subject: string };

            // TS run in a second tmpdir on the same input.
            fs.writeFileSync(path.join(ts_dir, 'CHANGELOG.md'), body, 'utf-8');
            fs.mkdirSync(path.join(ts_dir, 'docs', 'archive'), { recursive: true });
            eras._set_changelog_path(path.join(ts_dir, 'CHANGELOG.md'));
            eras._set_archive_dir(path.join(ts_dir, 'docs', 'archive'));
            const plan = eras.plan_split(release);
            expect(plan).not.toBeNull();
            eras.perform_split(plan!);

            expect(path.basename(plan!.archive_path)).toBe(py.archive_name);
            expect(plan!.commit_subject).toBe(py.commit_subject);
            expect(fs.readFileSync(eras.CHANGELOG, 'utf-8')).toBe(py.changelog);
            expect(fs.readFileSync(plan!.archive_path, 'utf-8')).toBe(py.archive);
        } finally {
            eras._set_changelog_path(SAVED_CHANGELOG);
            eras._set_archive_dir(SAVED_ARCHIVE_DIR);
            fs.rmSync(py_dir, { recursive: true, force: true });
            fs.rmSync(ts_dir, { recursive: true, force: true });
        }
    });
});
