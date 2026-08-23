/**
 * Tests for the pack-conformance fixture harness.
 *
 * SABOTAGE PROBES, run 2026-08-23 before this file was trusted. Each mutated the
 * committed fixture, observed the harness exit 1 with the right attribution, and
 * restored from a backup copy (never `git checkout`, which would have discarded
 * the whole uncommitted fixture):
 *
 *   1. drop the requires edge in `conformant/packs.yml`
 *      -> `[conformant] lint_pack_boundaries exited 1 on the CONFORMANT fixture`
 *   2. re-add the cross-pack link to the `unreachable-route` twin
 *      -> `[unreachable-route] lint_pack_boundaries exited 1 — this twin should
 *          only red lint_rule_skill_pack_reach`  (the orthogonality half)
 *   3. downgrade the high-risk twin to `risk_class: low`
 *      -> `[high-risk-default-install] lint_pack_risk_class exited 0 — the
 *          seeded violation did not fire`
 *
 * Real exit codes were captured directly (`cmd > file; echo $?`), never through
 * a pipe: a pipeline returns the LAST command's status and showed a false 0 on
 * the first attempt at probe 3.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    DOC_REL,
    FIXTURE_REL,
    GATES,
    PROVABLE,
    TWINS,
    renderDoc,
    runConformance,
    selfTest,
} from '../../src/scripts/check_pack_conformance_fixture.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('check_pack_conformance_fixture — the run', () => {
    it('the committed fixture set passes: conformant clean, every twin isolated', async () => {
        const { code, findings, scanned } = await runConformance();
        expect(findings).toEqual([]);
        expect(code).toBe(0);
        // 3 provable gates × (1 conformant + 3 twins) = 12 assertions.
        expect(scanned).toBe(PROVABLE.length * (1 + TWINS.length));
    }, 120_000);

    it('every twin targets a gate the harness can actually drive', () => {
        for (const t of TWINS) expect(PROVABLE).toContain(t.reds);
    });

    it('each twin targets a DIFFERENT gate — two twins on one gate leave one unproven', () => {
        expect(new Set(TWINS.map((t) => t.reds)).size).toBe(TWINS.length);
    });

    it('self-test passes', () => {
        expect(selfTest()).toBe(0);
    }, 120_000);
});

describe('check_pack_conformance_fixture — the generated document', () => {
    it('states the partial count in the title and carries no pass badge', () => {
        const doc = renderDoc();
        const proven = GATES.filter((g) => g.mechanism !== 'real-tree-only').length;
        expect(doc).toContain(`partial: ${String(proven)} of ${String(GATES.length)} gates independently fixture-proven`);
        expect(doc).toContain('no overall pass badge');
        // The council's requirement is that "partial" cannot be misread as
        // "complete". A green tick anywhere on the page defeats that.
        expect(doc).not.toContain('✅');
    });

    it('names the blocking contract for every gate a fixture cannot drive', () => {
        for (const g of GATES.filter((x) => x.mechanism === 'real-tree-only')) {
            expect(g.blockedBy ?? '', g.id).not.toBe('');
            expect(renderDoc()).toContain(g.blockedBy as string);
        }
    });

    it('distinguishes design-level from effort-level blocks', () => {
        // "three of these do not work" is not an answer a pack author can act
        // on; whether a contract forbids the seam or nobody built it is.
        const doc = renderDoc();
        expect(doc).toContain('Design-level');
        expect(doc).toContain('effort-level');
    });

    it('the committed page matches what the harness renders', () => {
        const p = join(REPO_ROOT, DOC_REL);
        expect(existsSync(p), `${DOC_REL} must be committed`).toBe(true);
        expect(readFileSync(p, 'utf-8')).toBe(renderDoc());
    });
});

describe('check_pack_conformance_fixture — the fixture corpus', () => {
    it('carries no org-pack provenance (ADR-233 D3)', () => {
        // Asserted here rather than by grep in a roadmap step, so it keeps
        // holding after the roadmap archives.
        const doc = readFileSync(join(REPO_ROOT, FIXTURE_REL, 'README.md'), 'utf-8');
        expect(doc).toContain('ADR-233');
    });
});
