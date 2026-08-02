/**
 * Regression witness for road-to-reproducible-artefact-counts.
 *
 * The defect: two count gates that agreed only because a maintainer ran both
 * and reconciled them by hand. The scanner could flag positions the generator
 * could not rewrite (the README Commands badge and the getting-started browse
 * line had drifted to 191 against a canonical 192 exactly there), and the
 * scoped-projection figure the claims ledger publishes was hand-typed, so it
 * had drifted 2 from the benchmark doc the claim named as its own method.
 *
 * These tests assert the three properties that make that impossible again:
 *
 *   1. ANCHOR COVERAGE — every position the scanner can flag is a position
 *      the generator can rewrite (or a generated file whose source is).
 *   2. ONE PREDICATE — the published projection count comes from the same
 *      function `install.ts` prunes with, over the same walk the canonical
 *      total is derived from, so the pair cannot become incoherent.
 *   3. THE GATES MOVE TOGETHER — add a skill in a fixture and both the total
 *      and the projected count respond; the scanner's expectations follow.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    compute_active_pack_ids,
    is_pruned_under_scoped,
    load_packs_registry,
    scoped_projection_stats,
} from '../../src/scripts/_lib/scoped_projection.js';
import {
    anchor_coverage_gaps,
    GENERATED_DOWNSTREAM,
    ROOT,
} from '../../src/scripts/check_artefact_count_messaging.js';
import { count, iter_skills } from '../../src/scripts/update_counts.js';

// --- 1. Anchor coverage ----------------------------------------------------

describe('anchor coverage — the two gates agree by construction', () => {
    it('leaves no position the scanner checks and the generator cannot write', () => {
        const gaps = anchor_coverage_gaps();
        // Named in the failure so a regression says WHICH sentence broke it.
        expect(gaps.map((g) => `${g.file}:${g.line} [${g.kind}]`)).toEqual([]);
    });

    it('exempts only generated files, and names the generator for each', () => {
        for (const [file, reason] of Object.entries(GENERATED_DOWNSTREAM)) {
            expect(fs.existsSync(path.join(ROOT, file)), `${file} missing`).toBe(true);
            // An exemption without a named generator is a place to hide drift.
            expect(reason).toMatch(/src\/scripts\/\w+\.ts/);
        }
    });

    it('detects a gap when a new unanchored count sentence appears', () => {
        // Proves the gate can FAIL — a coverage check that only ever passes is
        // indistinguishable from one that scans nothing. Run against a throwaway
        // root: a test that edits a tracked file corrupts the tree if it dies
        // between write and restore.
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repro-counts-gap-'));
        try {
            const surface = path.join(root, 'docs', 'command-flows.md');
            fs.mkdirSync(path.dirname(surface), { recursive: true });
            // `docs/command-flows.md` anchors ONLY commands; a skills sentence
            // there is exactly the uncovered-position shape.
            fs.writeFileSync(surface, 'A newly hand-typed sentence about 288 skills.\n', 'utf-8');

            const gaps = anchor_coverage_gaps(root);
            expect(gaps).toEqual([
                {
                    file: 'docs/command-flows.md',
                    line: 1,
                    kind: 'skills',
                    text: 'A newly hand-typed sentence about 288 skills.',
                },
            ]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('accepts the same sentence once an anchor covers it', () => {
        // The other half of the falsifiability pair: an ANCHORED count position
        // must NOT be reported, or the gate would just ban count-shaped prose.
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repro-counts-ok-'));
        try {
            const surface = path.join(root, 'docs', 'command-flows.md');
            fs.mkdirSync(path.dirname(surface), { recursive: true });
            // The real anchored shape: `**N commands**` → `commands_active`.
            fs.writeFileSync(surface, '**192 commands** across 10 surfaces.\n', 'utf-8');

            expect(anchor_coverage_gaps(root)).toEqual([]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

// --- 2. One predicate ------------------------------------------------------

describe('scoped-projection count — derived, never typed', () => {
    it('partitions exactly the catalog the canonical total counts', () => {
        const stats = scoped_projection_stats(ROOT, iter_skills());
        expect(stats.total).toBe(count('skills'));
        expect(stats.projected + stats.pruned).toBe(stats.total);
    });

    it('exposes the projected figure as an anchorable canonical kind', () => {
        const stats = scoped_projection_stats(ROOT, iter_skills());
        expect(count('skills_scoped')).toBe(stats.projected);
        expect(stats.projected).toBeGreaterThan(0);
        expect(stats.projected).toBeLessThan(stats.total);
    });

    it('publishes the pair the claims ledger states', () => {
        const claims = fs.readFileSync(path.join(ROOT, 'docs', 'CLAIMS.md'), 'utf-8');
        const stats = scoped_projection_stats(ROOT, iter_skills());
        // The exact sentence the drift lived in, now re-derived rather than read.
        expect(claims).toContain(`ships ${stats.projected} of ${stats.total} skills`);
    });

    it('keeps active-command mentions on their own canonical, not the raw total', () => {
        // The hazard the council flagged against naive unification: prose "N
        // commands" means ACTIVE. The two coincide only while no command is a
        // shim, so they must stay separate kinds even when the numbers match.
        expect(count('commands_active')).toBeLessThanOrEqual(count('commands'));
    });
});

// --- 3. The gates move together --------------------------------------------

describe('regression witness — adding a skill moves both gates', () => {
    /** Build a throwaway package root: real packs.yml, two fixture skills. */
    function fixtureRoot(): { root: string; untagged: string; tagged: string } {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repro-counts-'));
        const discovery = path.join(root, 'src', 'config', 'discovery');
        fs.mkdirSync(discovery, { recursive: true });
        fs.copyFileSync(
            path.join(ROOT, 'src', 'config', 'discovery', 'packs.yml'),
            path.join(discovery, 'packs.yml'),
        );

        const skills = path.join(root, 'skills');
        const untagged = path.join(skills, 'fixture-core', 'SKILL.md');
        const tagged = path.join(skills, 'fixture-inactive', 'SKILL.md');
        fs.mkdirSync(path.dirname(untagged), { recursive: true });
        fs.mkdirSync(path.dirname(tagged), { recursive: true });
        fs.writeFileSync(untagged, '---\nname: fixture-core\n---\n\nbody\n', 'utf-8');
        fs.writeFileSync(
            tagged,
            // A pack that exists in packs.yml but is NOT in an active workspace.
            '---\nname: fixture-inactive\npacks:\n  - finance-basic\n---\n\nbody\n',
            'utf-8',
        );
        return { root, untagged, tagged };
    }

    it('counts a new untagged skill into BOTH the total and the projection', () => {
        const { root, untagged, tagged } = fixtureRoot();
        try {
            const before = scoped_projection_stats(root, [tagged]);
            const after = scoped_projection_stats(root, [tagged, untagged]);

            expect(after.total).toBe(before.total + 1);
            // Untagged = core = always kept: the projected figure moves too.
            expect(after.projected).toBe(before.projected + 1);
            expect(after.pruned).toBe(before.pruned);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('counts a new inactive-pack skill into the total ONLY', () => {
        const { root, untagged, tagged } = fixtureRoot();
        try {
            const before = scoped_projection_stats(root, [untagged]);
            const after = scoped_projection_stats(root, [untagged, tagged]);

            expect(after.total).toBe(before.total + 1);
            // Tagged with an inactive pack: pruned, so the projection holds.
            expect(after.projected).toBe(before.projected);
            expect(after.pruned).toBe(before.pruned + 1);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('uses the installer predicate itself, not a re-implementation', () => {
        const { root, untagged, tagged } = fixtureRoot();
        try {
            const active = compute_active_pack_ids(load_packs_registry(root), []);
            // The same call `install.ts` makes when it prunes a real tree.
            expect(is_pruned_under_scoped(untagged, active)).toBe(false);
            expect(is_pruned_under_scoped(tagged, active)).toBe(true);

            // …and the stats function agrees with it, file for file.
            const stats = scoped_projection_stats(root, [untagged, tagged]);
            expect(stats.projected).toBe(1);
            expect(stats.pruned).toBe(1);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('honours a runtime overlay that activates the otherwise-pruned pack', () => {
        const { root, untagged, tagged } = fixtureRoot();
        try {
            const stats = scoped_projection_stats(root, [untagged, tagged], [
                'finance-basic',
            ]);
            expect(stats.projected).toBe(2);
            expect(stats.pruned).toBe(0);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
