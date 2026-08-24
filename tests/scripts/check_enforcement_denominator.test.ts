/**
 * Tests for `src/scripts/check_enforcement_denominator.ts` — the gate that keeps
 * exactly one enforcement denominator quotable.
 *
 * RED BEFORE GREEN, recorded because the gate was written before the fix it
 * demands. Run against the unmodified tree on 2026-08-23 it exited **1** with
 * exactly one finding — `docs/CLAIMS.md:203`, the hand-written
 * `enforcement-coverage-resolved` entry that carried its own snapshot of the
 * figures (`15 of 120 governed rules (12.8%) … 86 rules declare nothing`) and,
 * through `build_proof`, projected them into `docs/proof.md`. That entry now
 * cites the generated projection and states no figure, and the same command
 * exits 0 — which is what the first case below pins.
 *
 * THE DESIGN CHOICE THE SECOND BLOCK PINS. The gate does not compare values
 * against the resolver, and that is deliberate rather than lazy: a hand-written
 * figure that happens to be correct today is exactly how the plurality returned
 * each previous time the tree corrected one number and left the mechanism alone.
 * A correct restatement is therefore still a finding.
 *
 * SABOTAGE PROBE, run 2026-08-23 before this file was trusted. Observed, not
 * asserted:
 *   - dropping the `ENFORCEMENT_KEYWORDS` guard (matching on the count shape
 *     alone) → **2 of 12 red**, and the pair is the finding: the real tree turns
 *     red on a benchmark table row and on a tool-loop table row, and "2 rules" in
 *     a concepts page becomes a violation. That is the false-positive class that
 *     would make the gate unlandable, and it is measured rather than argued;
 *   - dropping the `isGenerated` exemption → **2 of 12 red**, the real tree and
 *     the projection case, i.e. the gate refuses the one file that is allowed to
 *     carry the number.
 * Restoring each gives 12/12 and `git diff --stat` over the gate is empty.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    MARKER,
    check,
    corpus,
    isGenerated,
    main,
    scanText,
} from '../../src/scripts/check_enforcement_denominator.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function fixtureRoot(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(join(os.tmpdir(), 'enf-denom-test-'));
    for (const [rel, body] of Object.entries(files)) {
        const abs = join(dir, rel);
        fs.mkdirSync(dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body);
    }
    return dir;
}

describe('check_enforcement_denominator — the real tree', () => {
    it('passes: no published doc restates the denominator', () => {
        const { code, findings } = check(REPO_ROOT);
        expect(findings).toEqual([]);
        expect(code).toBe(0);
    });

    it('scans a real corpus, not an empty one', () => {
        // `docs/` was flattened once already (ADR-051); a walk rooted at a moved
        // directory reads zero files and prints a green over nothing.
        expect(corpus(REPO_ROOT).length).toBeGreaterThan(350);
    });

    it('exits 2 on a dead scan root rather than reporting clean', () => {
        expect(main(['--quiet', '--root', join(REPO_ROOT, 'no-such-root')])).toBe(2);
    });
});

describe('check_enforcement_denominator — detection', () => {
    it('flags an "N of M governed rules … backstop" restatement', () => {
        const found = scanText(
            'docs/a.md',
            '15 of 120 governed rules carry a backstop that fails a CI build.\n',
        );
        expect(found).toHaveLength(1);
        expect(found[0]?.kind).toBe('raw');
    });

    it('flags an undeclared count', () => {
        expect(scanText('docs/a.md', '86 rules are undeclared today.\n')).toHaveLength(1);
    });

    it('flags a CORRECT figure — the restatement is the finding, not the disagreement', () => {
        // This is the property that separates this gate from a value-checker. A
        // figure that matches the resolver today drifts silently tomorrow, and
        // "fix the number" is what left the plurality standing every previous time.
        const found = scanText('docs/a.md', 'Exactly 120 rules, 86 undeclared, as resolved.\n');
        expect(found).toHaveLength(1);
    });

    it('reds end to end on a planted published doc', () => {
        const root = fixtureRoot({ 'docs/a.md': '86 rules are undeclared.\n' });
        try {
            expect(main(['--quiet', '--root', root])).toBe(1);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('check_enforcement_denominator — what must NOT be a finding', () => {
    it('a rule count with no enforcement sense', () => {
        expect(scanText('docs/a.md', 'The kernel splits into 2 rules and a router.\n')).toEqual([]);
    });

    it('enforcement prose with no count', () => {
        expect(
            scanText('docs/a.md', 'Every rule declares `enforced_by:` and the check resolves it.\n'),
        ).toEqual([]);
    });

    it("the resolver's own generated projection", () => {
        const body =
            '<!-- GENERATED by src/scripts/build_proof.ts -->\n\n' +
            '120 rules · 15 blocking · 86 undeclared (no enforced_by yet).\n';
        expect(isGenerated(body)).toBe(true);
        const root = fixtureRoot({ 'docs/proof.md': body });
        try {
            expect(main(['--quiet', '--root', root])).toBe(0);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('a marker carrying a reason — and a bare marker is still a finding', () => {
        const reasoned = `86 rules are undeclared. <!-- ${MARKER} dated record -->\n`;
        expect(scanText('docs/a.md', reasoned)).toEqual([]);
        const bare = `86 rules are undeclared. <!-- ${MARKER} -->\n`;
        const found = scanText('docs/a.md', bare);
        expect(found).toHaveLength(1);
        expect(found[0]?.kind).toBe('bare-marker');
    });

    it('a dated ADR record — docs/decisions/ is excluded, not exempted case by case', () => {
        expect(corpus(REPO_ROOT).some((p) => p.startsWith('docs/decisions/'))).toBe(false);
    });
});
