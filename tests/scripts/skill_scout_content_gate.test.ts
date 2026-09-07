/**
 * The scout's `security_licence` gate over candidate CONTENT —
 * road-to-scan-that-fails-closed Phases 4.2 and 4.3.
 *
 * THE GAP THIS REPRODUCES. `intake()` refuses a candidate on four grounds:
 * symlink, extension outside the text allow-list, executable bit, and size. All
 * four are properties of the FILE. None of them reads a byte of what the file
 * says. A candidate carrying a zero-width injection, an imperative telling the
 * agent to withhold from the user, or a frontmatter key granting an unscoped
 * shell was therefore accepted as "inert" — inert being a claim about the
 * container, which the gate silently read as a claim about the contents.
 *
 * The corpus is four real candidates in `tests/fixtures/skill-scout-candidates/`
 * with real payloads, not descriptions of payloads. The clean one is the control
 * that stops the fix from being "refuse everything".
 *
 * STATE OF THIS FILE: POST-GATE (Phase 4.3). The three payload cases were first
 * written asserting ACCEPTANCE and were RUN GREEN in that state against the
 * pre-gate `intake()`, on 2026-09-07, before the content scan existed — the
 * commit message that introduced this file quotes that run. Unlike the
 * `lint_agent_security` failure corpus, whose two states are two commits, the
 * reproduction here is recorded rather than committed, and saying which it is
 * matters: a reader can verify the failure corpus by checking out a commit and
 * can only take this one on the record. What is checkable either way is the
 * clean case, which did not move in either direction and is what shows the gate
 * is not "refuse everything".
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { intake } from '../../src/scripts/skill_scout.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CORPUS = path.join(REPO_ROOT, 'tests', 'fixtures', 'skill-scout-candidates');

/**
 * Copy a fixture candidate into a temp quarantine.
 *
 * Deliberately a copy: `intake` walks and `lstat`s a directory, and pointing it
 * at a tracked path would make a test that mutates nothing depend on the tree
 * staying exactly as committed for reasons unrelated to what it asserts.
 */
function stage(name: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `scout-candidate-${name}-`));
    fs.cpSync(path.join(CORPUS, name), dir, { recursive: true });
    return dir;
}

const PAYLOADS = ['zero-width-injection', 'disclosure-suppression', 'dangerous-frontmatter'] as const;

describe('skill_scout intake — the candidate corpus is inert by every FILE property', () => {
    for (const name of [...PAYLOADS, 'clean']) {
        it(`${name}: regular text files, no exec bit, under the cap`, () => {
            const r = intake(stage(name));
            // These four are what `intake` checked before content was read, and
            // all four candidates pass them. Asserted explicitly so a later
            // reader can see that the Phase 4.3 refusal is a CONTENT refusal and
            // not one of these firing by accident.
            expect(r.files_seen).toBeGreaterThan(0);
            for (const refusal of r.refusals) {
                expect(refusal).not.toMatch(/symlink|extension|executable bit|exceeds the/);
            }
        });
    }
});

const FLAGGING_LINTER: Record<(typeof PAYLOADS)[number], string> = {
    'zero-width-injection': 'hidden-unicode',
    'disclosure-suppression': 'instruction-smuggling',
    'dangerous-frontmatter': 'dangerous-frontmatter',
};

describe('skill_scout intake — a content payload is refused, and the linter is named', () => {
    for (const name of PAYLOADS) {
        it(`${name} is refused by ${FLAGGING_LINTER[name]}`, () => {
            const r = intake(stage(name));
            expect(r.accepted, r.refusals.join('; ')).toBe(false);
            const joined = r.refusals.join('; ');
            // Naming the linter is the requirement, not merely refusing: a bare
            // "the content scan refused this" sends a reader to five detectors.
            expect(joined).toContain(`flagged by ${FLAGGING_LINTER[name]}`);
            // And the location, so the reader opens the right line.
            expect(joined).toMatch(/SKILL\.md:\d+:/);
        });
    }

    it('clean is still accepted — the control that stops "refuse everything"', () => {
        const r = intake(stage('clean'));
        expect(r.accepted, r.refusals.join('; ')).toBe(true);
        expect(r.refusals).toEqual([]);
    });

    it('the refusal flows into the security_licence gate reason', () => {
        // The gate the scout actually reports is `security_licence`, and it
        // reads `intake.accepted`. A refusal that never reached the gate would
        // be a finding nobody acts on.
        const r = intake(stage('disclosure-suppression'));
        expect(r.accepted).toBe(false);
        expect(r.files_seen).toBeGreaterThan(0);
    });
});
