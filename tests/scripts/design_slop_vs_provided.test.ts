/**
 * `daf-slop-vs-provided` — the Phase-3 re-measurement, end to end.
 *
 * The other port tests feed the polish gate hand-written findings. This one
 * does not: it runs the **real** anti-slop scanner over the **real** fixture
 * artifact and pipes its actual output into the **real** polish gate. That is
 * the only version of this measurement that can catch the two ways the fix
 * could be hollow — a scanner that stopped flagging the palette (so the
 * carve-out is untested), or a carve-out that only works on findings shaped
 * the way a test author imagined.
 *
 * The roadmap's Phase-3 exit asks whether the polish loop still edits a port
 * away from its source. Answered here, mechanically, for the half a machine
 * can answer; the half it cannot is stated rather than implied (see the last
 * test).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadDesignContext, scanFile } from '../../src/scripts/lint_design_slop.js';
import { DeliveryState } from '../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    POLISH_CEILING,
    run as polishRun,
} from '../../src/agent-src/templates/scripts/work_engine/directives/ui/polish.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'design-artifacts', 'fixtures');
const FIXTURE = path.join(FIXTURE_DIR, 'design.html');
const REL = 'tests/design-artifacts/fixtures/design.html';

/** The scanner's real findings for a faithful port of the fixture. */
function scanFixture(): Array<Record<string, unknown>> {
    const content = fs.readFileSync(FIXTURE, { encoding: 'utf-8' });
    const ctx = loadDesignContext(FIXTURE_DIR);
    return scanFile(content, REL, ctx) as unknown as Array<Record<string, unknown>>;
}

/** Wrap findings in the state shape the polish gate reads. */
function polishOn(findings: Array<Record<string, unknown>>, rounds = 0): DeliveryState {
    return new DeliveryState({
        ticket: { id: 'T-1' } as never,
        stack: { frontend: 'plain' } as never,
        ui_review: { findings, review_clean: false } as never,
        ui_polish: { rounds } as never,
    });
}

describe('daf-slop-vs-provided — a faithful port survives review and polish', () => {
    it('the fixture still trips the tells the carve-out has to cover', () => {
        const rules = scanFixture().map((f) => f['rule']);
        // Both are load-bearing and were chosen, not stumbled into: C5 is the
        // palette (a colour decision), CP1 is the artifact's own copy (a prose
        // decision). A carve-out that only handled colour would pass on one
        // and fail the user on the other.
        expect(rules).toContain('slop-c5-cream-palette');
        expect(rules).toContain('slop-cp1-em-dash');
    });

    it('unmarked, those findings send a polish round at the user\'s own design', () => {
        // The pre-fix behaviour, still reachable — which is why the review
        // step marking them is an obligation and not a nicety.
        const r = polishRun(polishOn(scanFixture()));
        expect(r.outcome).toBe('blocked');
    });

    it('marked as artifact-covered, the port is finished with nothing to fix', () => {
        const marked = scanFixture().map((f) => ({ ...f, artifact_covered: true }));
        expect(polishRun(polishOn(marked)).outcome).toBe('success');
        // …and still finished at the ceiling: a port must not be halted for
        // findings it was never allowed to act on.
        expect(polishRun(polishOn(marked, POLISH_CEILING)).outcome).toBe('success');
    });

    it('the carve-out does not leak to a real defect found in the same run', () => {
        const marked = scanFixture().map((f) => ({ ...f, artifact_covered: true }));
        const generative = {
            kind: 'a11y_violation',
            severity: 'serious',
            note: 'invented empty state has 3.1:1 contrast',
        };
        expect(polishRun(polishOn([...marked, generative])).outcome).toBe('blocked');
    });

    it('honest scope: the gate is mechanical, the marking is not', () => {
        // Deliberately asserting the boundary rather than papering over it.
        // Nothing in the tree can decide whether a finding is *genuinely*
        // covered by the artifact — that judgment is the review step's, and it
        // is carried by prose (design-review § Anti-slop scan step 4). What IS
        // mechanical: an unmarked finding keeps full authority to drive a
        // round, so the default failure direction is "we asked", never "we
        // silently kept the tell".
        const unmarked = scanFixture();
        expect(unmarked.every((f) => f['artifact_covered'] === undefined)).toBe(true);
        expect(polishRun(polishOn(unmarked)).outcome).toBe('blocked');
    });
});
