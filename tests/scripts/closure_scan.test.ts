import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    OWNERSHIP_BY_KIND,
    OWNER_ROUTED,
    ownerQuestionCount,
    renderRows,
    scan,
    units,
} from '../../src/scripts/closure_scan.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'decision-closure');

function fixture(name: string): string {
    return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

describe('closure_scan — fixture F1, the twelve seeded ambiguities', () => {
    const findings = scan(fixture('F1-technical-ambiguities.md'));

    it('finds exactly twelve open decisions', () => {
        expect(findings).toHaveLength(12);
    });

    it('asks the owner none of them — every one is technical', () => {
        expect(ownerQuestionCount(findings)).toBe(0);
        for (const f of findings) {
            expect(OWNER_ROUTED.has(f.ownership)).toBe(false);
        }
    });

    it('emits twelve `## Decisions` rows', () => {
        const body = renderRows(findings);
        const rows = body.split('\n').filter((l) => /^\| C\d+ \|/.test(l));
        expect(rows).toHaveLength(12);
    });

    it('every row carries a valid ownership class', () => {
        const valid = new Set(Object.values(OWNERSHIP_BY_KIND));
        for (const f of findings) expect(valid.has(f.ownership)).toBe(true);
    });

    it('finds an ambiguity that straddles a line wrap', () => {
        // Step 1.1's "either … or" spans two physical lines. A per-line
        // detector misses exactly this shape, which is the one an author is
        // least likely to notice.
        expect(findings.some((f) => f.line === 19 && f.kind === 'unpicked-alternative')).toBe(true);
    });
});

describe('closure_scan — fixture F2, the owner-question mirror', () => {
    const findings = scan(fixture('F2-product-semantics.md'));

    it('emits exactly one owner question', () => {
        // F1 and F2 together are the discrimination: zero owner questions for
        // twelve technical ambiguities, exactly one for a single product fork.
        // A detector scoring zero on both is inert; one scoring owner questions
        // on both puts a technical decision in front of a person.
        expect(ownerQuestionCount(findings)).toBe(1);
    });

    it('the question is the product fork, and it is product-owned', () => {
        expect(findings).toHaveLength(1);
        expect(findings[0]?.kind).toBe('product-semantics');
        expect(findings[0]?.ownership).toBe('product-owned');
    });

    it('the fork is found on the STEP, not on the prose that describes it', () => {
        expect(findings[0]?.excerpt).toContain('2.1 Partial sync result');
    });
});

describe('closure_scan — fixture F0, the other direction', () => {
    it('reports zero open decisions on an already-closed plan', () => {
        // Without this, a detector weakened until it finds nothing passes F1's
        // sibling assertion by scoring zero everywhere.
        expect(scan(fixture('F0-closed-plan.md'))).toEqual([]);
    });
});

describe('closure_scan — fixture F4, mid-run residue', () => {
    const findings = scan(fixture('F4-midrun-architecture-choice.md'));

    it('the mid-run architecture choice resolves without an owner question', () => {
        expect(findings).toHaveLength(1);
        expect(findings[0]?.ownership).toBe('contested-technical');
        expect(ownerQuestionCount(findings)).toBe(0);
    });

    it('the decision planning already closed is not re-found', () => {
        // `## Decisions` is a discharge section: a row in it is closed, and
        // re-finding it would be the re-derivation the process loop forbids.
        expect(findings.every((f) => f.line > 30)).toBe(false);
        expect(findings.map((f) => f.excerpt).join(' ')).not.toContain('newline-delimited JSON on disk');
    });

    it('"two equal strategies" is an unpicked alternative', () => {
        // The phrasing an author reaches for when the choice is genuinely open:
        // no `either`, no `or`, no `option A`, and previously undetected.
        expect(scan('- [ ] **X** Two equal approaches exist.\n      verify: t\n')[0]?.kind).toBe(
            'unpicked-alternative',
        );
    });
});

describe('closure_scan — ownership classification', () => {
    it('routes product semantics to the owner', () => {
        const f = scan('- [ ] **X** Two valid product semantics here.\n      verify: t\n');
        expect(f[0]?.ownership).toBe('product-owned');
        expect(ownerQuestionCount(f)).toBe(1);
    });

    it('routes a typed op to the owner', () => {
        const f = scan('- [ ] **X** Then deploy the result.\n      verify: t\n');
        expect(f[0]?.ownership).toBe('destructive-owned');
    });

    it('routes a crossed ceiling to spend-exhaustion, which reaches nobody', () => {
        const f = scan('- [ ] **X** The API rung goes above the configured ceiling.\n      verify: t\n');
        expect(f[0]?.ownership).toBe('spend-exhaustion');
        expect(ownerQuestionCount(f)).toBe(0);
    });

    it('no kind maps to business-owned — a plan cannot detect a deadline', () => {
        expect(Object.values(OWNERSHIP_BY_KIND)).not.toContain('business-owned');
    });
});

describe('closure_scan — unit boundaries', () => {
    it('a step with two hedges is ONE open decision, not two', () => {
        const f = scan('- [ ] **X** Assuming it holds, presumably.\n      verify: t\n');
        expect(f).toHaveLength(1);
    });

    it('acceptance criteria are criteria, not steps — no missing-verify there', () => {
        const text = '## Acceptance Criteria\n\n- [ ] AC-1 — the thing works.\n';
        expect(scan(text)).toEqual([]);
    });

    it('an open step outside acceptance with no verify line IS a finding', () => {
        expect(scan('## Phase 1\n\n- [ ] **1.1 Do the thing.**\n')).toHaveLength(1);
    });

    it('a closed step needs no verify line', () => {
        expect(scan('## Phase 1\n\n- [x] **1.1 Done.**\n')).toEqual([]);
    });

    it('a fenced block is not prose', () => {
        expect(scan('```\nconst TBD = 1;\n```\n')).toEqual([]);
    });

    it('the `## Decisions` and `## Blockers` sections are discharges', () => {
        expect(scan('## Decisions\n\nTBD\n')).toEqual([]);
        expect(scan('## Blockers\n\nTBD\n')).toEqual([]);
    });

    it('the explicit ignore marker is respected', () => {
        expect(scan('Pick one: TBD <!-- closure: ignore -->\n')).toEqual([]);
    });

    it('units() joins a wrapped step into one text and keeps its first line', () => {
        const u = units(['- [ ] **A** one', '      two', '- [ ] **B** three']);
        expect(u).toHaveLength(2);
        expect(u[0]?.line).toBe(1);
        expect(u[0]?.text).toContain('two');
    });
});
