/**
 * Does an override file placed in the tree get discovered, resolve to the rule it
 * overrides, and appear with a truthful `cited` flag?
 *
 * Step 1.2 of `road-to-override-efficacy-proof`. The distinction the whole phase
 * rests on: this is a **delivery** check, not an efficacy claim. It proves the
 * audit sees the file. Whether the agent then behaves differently is Phase 2, and
 * conflating the two is how a reachability check ends up quoted as proof that
 * overrides work.
 *
 * SENSITIVITY, observed rather than assumed (step 1.3, run 2026-08-23). Restoring
 * the `> Overrides:` citation line on `token-efficiency.md` — the deliberately
 * broken twin — and re-running this file produced:
 *
 *   × override reachability — the broken twin > reports cited: false
 *     → AssertionError: expected true to be false // Object.is equality
 *   × override reachability — the broken twin > raises a missing-citation violation
 *     → AssertionError: expected '' to contain 'missing-citation'
 *
 *   Tests  2 failed | 5 passed (7)
 *
 * Both messages are quoted as OBSERVED. The second one was predicted here as
 * `expected [] to include 'missing-citation'` before the probe ran and is corrected
 * to what actually printed — the violations array is joined to a string by the
 * assertion, so an empty list reads as `''` rather than `[]`. The difference is
 * trivial and the correction is not: a recorded failure message nobody ran is
 * indistinguishable from one that was, which is the whole reason step 1.3 asks for
 * the message rather than for the fact of a failure.
 *
 * The line was reverted and the file is green again (7/7). A check never observed
 * failing has unknown sensitivity; this one has now been observed.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { audit } from '../../src/scripts/lint_override_kernel_guard.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'override-reachability');

const rows = audit(FIXTURES);

describe('override reachability — the valid fixture', () => {
    it('is discovered at all', () => {
        // The weakest and most important assertion in the file: an audit that
        // stopped walking its directory would return [] and every richer
        // assertion below would never run.
        expect(rows.length).toBe(2);
        expect(rows.map((r) => r.rule).sort()).toEqual([
            'code-comment-discipline',
            'token-efficiency',
        ]);
    });

    it("resolves `rule` to the rule it overrides, from the filename", () => {
        const row = rows.find((r) => r.rule === 'code-comment-discipline');
        expect(row).toBeDefined();
        expect(row!.file).toContain('override-reachability');
        expect(row!.mode).toBe('extend');
    });

    it('reports cited: true, with no violations', () => {
        const row = rows.find((r) => r.rule === 'code-comment-discipline')!;
        expect(row.cited).toBe(true);
        expect(row.violations).toEqual([]);
    });

    it('classifies a non-kernel, non-floor subject as ordinary', () => {
        // Deliberate fixture choice: a kernel subject would exercise the
        // registration branch and prove something else. The ordinary-override
        // shape is what the reachability check needs to cover.
        const row = rows.find((r) => r.rule === 'code-comment-discipline')!;
        expect(row.kernel).toBe(false);
        expect(row.safety_floor).toBe(false);
    });
});

describe('override reachability — the broken twin', () => {
    it('reports cited: false', () => {
        const row = rows.find((r) => r.rule === 'token-efficiency');
        expect(row).toBeDefined();
        expect(row!.cited).toBe(false);
    });

    it('raises a missing-citation violation', () => {
        const row = rows.find((r) => r.rule === 'token-efficiency')!;
        expect(row.violations.join(' ')).toContain('missing-citation');
    });

    it('is otherwise identical in shape to its valid sibling', () => {
        // If the twin differed in mode or kernel status, a failure could be
        // attributed to that difference rather than to the missing citation —
        // which would make the sensitivity probe above prove nothing.
        const bad = rows.find((r) => r.rule === 'token-efficiency')!;
        const good = rows.find((r) => r.rule === 'code-comment-discipline')!;
        expect(bad.mode).toBe(good.mode);
        expect(bad.kernel).toBe(good.kernel);
        expect(bad.safety_floor).toBe(good.safety_floor);
    });
});
