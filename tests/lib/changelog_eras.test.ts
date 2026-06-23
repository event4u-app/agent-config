
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
        // The cap bounds *accumulated prior* releases in the current era; the
        // newest released section is exempt and instead forces the era split on
        // the next bump (see current_era_accumulated_body_size). This keeps a
        // single large catch-up release from tripping a gate no split can clear.
        const accumulated = eras.current_era_accumulated_body_size(lines);
        expect(
            accumulated,
            `Current era accumulated body (excluding the newest release) is ${accumulated} lines ` +
                `(cap ${eras.CURRENT_ERA_BODY_CAP}). An era split is due — \`task release\` ` +
                'performs it on the next bump.',
        ).toBeLessThanOrEqual(eras.CURRENT_ERA_BODY_CAP);
    });

    it('accumulated body excludes the newest released section', () => {
        const lines = [
            '# Era: 7.0.x — current',
            '',
            '> Started at `7.0.0`. Full entries live inline below.',
            '',
            '## [7.0.0](https://example/compare/6.1.0...7.0.0) (2026-06-21)',
            '',
            ...Array<string>(400).fill('* **scope:** a real entry line'),
            '## [6.9.0](https://example/compare/6.8.0...6.9.0) (2026-06-01)',
            '',
            ...Array<string>(40).fill('* **scope:** a prior entry line'),
            '# Era: pre-6.0.0 — archived',
            '',
        ];
        const total = eras.current_era_body_size(lines);
        const accumulated = eras.current_era_accumulated_body_size(lines);
        // The newest (7.0.0, 400+ lines) alone busts the cap…
        expect(total).toBeGreaterThan(eras.CURRENT_ERA_BODY_CAP);
        // …but it is exempt, so only the prior 6.9.0 (~40) accumulates → under cap.
        expect(accumulated).toBeLessThan(total);
        expect(accumulated).toBeLessThanOrEqual(eras.CURRENT_ERA_BODY_CAP);
    });

    it('single-release era accumulates ~nothing (only the era intro)', () => {
        const lines = [
            '# Era: 8.0.x — current',
            '',
            '> Started at `8.0.0`. Full entries live inline below.',
            '',
            '## [8.0.0](https://example/compare/7.0.0...8.0.0) (2026-07-01)',
            '',
            ...Array<string>(500).fill('* **scope:** sole-release entry line'),
            '# Era: pre-7.0.0 — archived',
        ];
        // A single oversized release section is fully exempt; only the few
        // header/intro lines before the version heading remain counted.
        expect(eras.current_era_accumulated_body_size(lines)).toBeLessThanOrEqual(
            eras.CURRENT_ERA_BODY_CAP,
        );
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
