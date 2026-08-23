/**
 * Tests for `src/scripts/check_no_automerge_key.ts` — the settings-key ratchet
 * that keeps an auto-merge policy key out of the settings namespace.
 *
 * SENSITIVITY IS PROVEN HERE, NOT BY A CANARY. The gate's corpus is two tracked
 * files that always exist, so the create-only canary shape `gate-coverage.yml`
 * supports cannot reach it: a planted file lands outside the corpus and the gate
 * correctly stays green. That was measured on a previous attempt and the gate was
 * mis-reported as dead. `tests/fixtures/automerge-key/` is the replacement — a
 * committed violating root the gate must refuse.
 *
 * SABOTAGE PROBE, run 2026-08-23 before this file was trusted. Both guards were
 * neutralised in turn and the observed counts are recorded rather than asserted:
 *   - emptying `FORBIDDEN` → **4 of 9 red**;
 *   - widening the matcher from a key to every identifier on the line (the
 *     word-sense failure the gate exists to avoid) → **6 of 9 red**.
 * Restoring each gives 9/9, and `git diff --stat` over the gate path is empty.
 *
 * The first attempt at the second probe was INEFFECTIVE and is recorded because
 * an ineffective probe reads exactly like a proven guard: replacing the key
 * regex with `/([A-Za-z_][A-Za-z0-9_-]*)/` left all 9 green, because that regex
 * returns the FIRST identifier on the line (`description`), which is not a
 * forbidden name. A probe that does not go red has proven nothing about the
 * guard — only about the probe.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CORPUS, FORBIDDEN, check, keyOccurrences, main } from '../../src/scripts/check_no_automerge_key.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = join(REPO_ROOT, 'tests', 'fixtures', 'automerge-key');

describe('check_no_automerge_key', () => {
    it('passes on the real tree', () => {
        const { code, findings } = check(REPO_ROOT);
        expect(findings).toEqual([]);
        expect(code).toBe(0);
    });

    it('scans a real corpus, not an empty one', () => {
        // The floor guards the collapse case: a renamed corpus file would make
        // the gate read nothing and report clean. 200 is well below the live
        // count (304 at the time of writing) and far above a collapse.
        const { scanned } = check(REPO_ROOT);
        expect(scanned).toBeGreaterThan(200);
    });

    it('refuses the committed violating fixture, naming both shapes', () => {
        const { code, findings } = check(FIXTURE);
        expect(code).toBe(1);
        expect(findings.map((f) => f.key).sort()).toEqual(['autoMerge', 'mergePolicy']);
        // One finding per corpus shape — YAML template and JSON schema — so a
        // regex that only handles one of the two cannot pass this.
        expect(new Set(findings.map((f) => f.file)).size).toBe(2);
    });

    it('exits 1 through the CLI entry point against the fixture', () => {
        expect(main(['--root', FIXTURE, '--quiet'])).toBe(1);
    });

    it('exits 0 through the CLI entry point under the CI-identical argv', () => {
        expect(main(['--quiet'])).toBe(0);
    });

    it('exits 2 when the corpus is missing rather than reporting clean', () => {
        // A gate that treats a moved root as "nothing to check" is the defect
        // class `gate-coverage.yml` exists for.
        expect(main(['--root', join(FIXTURE, 'does-not-exist'), '--quiet'])).toBe(2);
    });

    it('matches a key, never the bare word — it must not refuse its own docstring', () => {
        // This gate's own source contains `autoMerge` in prose. A word-matching
        // gate over the tree would refuse the decision it protects.
        const prose = keyOccurrences('description: forbids autoMerge and mergePolicy\n');
        expect(prose.filter((o) => (FORBIDDEN as readonly string[]).includes(o.key))).toEqual([]);

        const comment = keyOccurrences('# autoMerge: never\n');
        expect(comment.filter((o) => (FORBIDDEN as readonly string[]).includes(o.key))).toEqual([]);
    });

    it('self-test passes', () => {
        expect(main(['--self-test'])).toBe(0);
    });

    it('keeps the forbidden set closed at the three council-scoped names', () => {
        // The 2026-08-23 council verdict (Q1 (a)) is scoped to exactly these
        // three names. Widening the set is a policy change and reopens the
        // owner-reserved question; this assertion makes that visible in a diff.
        expect([...FORBIDDEN]).toEqual(['autoMerge', 'auto_merge', 'mergePolicy']);
        expect([...CORPUS]).toEqual([
            'src/config/agent-settings.template.yml',
            'src/scripts/schemas/agent-settings.schema.json',
        ]);
    });
});
