import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { run as reviewRun } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/review.js';
import {
    POLISH_CEILING,
    TOKEN_VIOLATION_KIND,
    partition_artifact_covered,
    run as polishRun,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/polish.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const FIX = path.join(REPO_ROOT, 'tests', 'design-artifacts', 'fixtures', 'token-detector');

type Dict = Record<string, unknown>;

function loadFixture(name: string): Dict {
    return JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8')) as Dict;
}

/** Run the review directive over a fixture and return the findings it left behind. */
function reviewFindings(fixture: string): Dict[] {
    const payload = loadFixture(fixture);
    const st = new DeliveryState(payload as never);
    reviewRun(st);
    const review = (st.ui_review ?? {}) as Dict;
    return ((review['findings'] as Dict[] | undefined) ?? []).slice();
}

function tokenFindings(fixture: string): Dict[] {
    return reviewFindings(fixture).filter((f) => f['kind'] === TOKEN_VIOLATION_KIND);
}

describe('Phase 3.1 — token_violation comes from a detector, not from judgement', () => {
    it('the seeded raw-literal fixture emits at least one token_violation', () => {
        const found = tokenFindings('seeded-raw-literal.json');
        expect(found.length).toBeGreaterThanOrEqual(1);
    });

    it('the paired clean fixture emits zero', () => {
        expect(tokenFindings('clean.json')).toHaveLength(0);
    });

    it('F4-unscoped: only values the audit holds a token for are emitted', () => {
        // The seeded fixture carries three violations; #FF00AA is in no audit
        // bucket, so a correctly scoped detector emits two, never three.
        const found = tokenFindings('seeded-raw-literal.json');
        expect(found.map((f) => f['value']).sort()).toEqual(['#2563EB', '12px']);
        expect(found.map((f) => f['value'])).not.toContain('#FF00AA');
    });

    it('every emitted finding names the audit category the value was found in', () => {
        const byValue = new Map(
            tokenFindings('seeded-raw-literal.json').map((f) => [f['value'], f['category']]),
        );
        expect(byValue.get('#2563EB')).toBe('color');
        expect(byValue.get('12px')).toBe('spacing');
    });

    it('a detector finding carries the file:line it was measured at', () => {
        const hex = tokenFindings('seeded-raw-literal.json').find((f) => f['value'] === '#2563EB');
        expect(hex?.['file']).toBe('src/components/Button.tsx');
        expect(hex?.['line']).toBe(12);
    });

    it('emitting a finding takes the review off clean', () => {
        const payload = loadFixture('seeded-raw-literal.json');
        const st = new DeliveryState(payload as never);
        reviewRun(st);
        expect(((st.ui_review ?? {}) as Dict)['review_clean']).toBe(false);
    });

    it('the clean fixture stays clean', () => {
        const payload = loadFixture('clean.json');
        const st = new DeliveryState(payload as never);
        reviewRun(st);
        expect(((st.ui_review ?? {}) as Dict)['review_clean']).toBe(true);
    });

    it('synthesis is idempotent — a second pass adds no duplicate', () => {
        const payload = loadFixture('seeded-raw-literal.json');
        const st = new DeliveryState(payload as never);
        reviewRun(st);
        const first = (((st.ui_review ?? {}) as Dict)['findings'] as Dict[]).length;
        reviewRun(st);
        const second = (((st.ui_review ?? {}) as Dict)['findings'] as Dict[]).length;
        expect(second).toBe(first);
    });
});

describe('Phase 3.2 — the channel is recorded on the finding', () => {
    it('a detector-produced finding declares channel: detector', () => {
        for (const f of tokenFindings('seeded-raw-literal.json')) {
            expect(f['channel']).toBe('detector');
        }
    });

    it('a judgement finding already in the envelope keeps its own channel', () => {
        const payload = loadFixture('seeded-raw-literal.json');
        const review = (payload['ui_review'] as Dict);
        review['findings'] = [
            {
                kind: TOKEN_VIOLATION_KIND,
                category: 'color',
                value: '#64748B',
                channel: 'judgement',
            },
        ];
        const st = new DeliveryState(payload as never);
        reviewRun(st);
        const all = ((st.ui_review as Dict)['findings'] as Dict[]).filter(
            (f) => f['kind'] === TOKEN_VIOLATION_KIND,
        );
        const channels = new Set(all.map((f) => f['channel']));
        expect(channels).toEqual(new Set(['judgement', 'detector']));
        // The judgement finding survives untouched — the detector is additive.
        expect(all.find((f) => f['value'] === '#64748B')?.['channel']).toBe('judgement');
    });
});

describe('Phase 5.1 — a measured delta drives a round through the existing path', () => {
    /** Review, then polish, over one fixture. Returns the polish outcome. */
    function reviewThenPolish(fixture: string, markCovered = false): string {
        const payload = loadFixture(fixture);
        const st = new DeliveryState(payload as never);
        reviewRun(st);
        const review = st.ui_review as Dict;
        const findings = review['findings'] as Dict[];
        if (markCovered) {
            for (const f of findings) {
                f['artifact_covered'] = true;
            }
        }
        return String(polishRun(st).outcome);
    }

    it('one detector-produced token_violation opens a polish round', () => {
        // BLOCKED is how the polish gate opens a round: it delegates to the
        // stack polish skill. SUCCESS means no round was opened.
        expect(reviewThenPolish('seeded-raw-literal.json')).not.toBe('success');
    });

    it('the same fixture marked artifact_covered opens zero rounds', () => {
        expect(reviewThenPolish('seeded-raw-literal.json', true)).toBe('success');
    });

    it('artifact_covered partitioning is the mechanism, not a new gate', () => {
        const findings = tokenFindings('seeded-raw-literal.json').map((f) => ({
            ...f,
            artifact_covered: true,
        }));
        const { actionable, informational } = partition_artifact_covered(findings);
        expect(actionable).toHaveLength(0);
        expect(informational).toHaveLength(findings.length);
    });

    it('the polish ceiling is untouched by this phase', () => {
        expect(POLISH_CEILING).toBe(2);
    });
});

describe('Phase 6 — the ad-hoc loop has a declared ceiling and a null stop', () => {
    const ADHOC = path.join(REPO_ROOT, 'tests', 'design-artifacts', 'fixtures', 'adhoc-convergence');

    function polishOutcome(name: string): string {
        const payload = JSON.parse(fs.readFileSync(path.join(ADHOC, name), 'utf8')) as Dict;
        const st = new DeliveryState(payload as never);
        return String(polishRun(st).outcome);
    }

    it('daf-adhoc-converges — a round producing no new finding ends the loop', () => {
        expect(polishOutcome('converges.json')).toBe('success');
    });

    it('daf-adhoc-ceiling — findings open at the ceiling hand back, never a third pass', () => {
        expect(polishOutcome('ceiling.json')).not.toBe('success');
    });

    it('the number in fe-design prose IS the number the engine enforces', () => {
        const skill = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'skills', 'fe-design', 'SKILL.md'),
            'utf8',
        );
        // The ceiling is stated as a number in the text, not implied.
        expect(skill).toMatch(/at most \*\*2 rounds\*\*/);
        expect(skill).toMatch(/The ceiling is \*\*2\*\*/);
        expect(POLISH_CEILING).toBe(2);
    });

    it('the ceiling and the stop condition are in the same paragraph', () => {
        const skill = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'skills', 'fe-design', 'SKILL.md'),
            'utf8',
        );
        const para = skill
            .split(/\n\s*\n/)
            .find((b) => b.includes('at most **2 rounds**'));
        expect(para).toBeDefined();
        expect(para).toContain('no new finding');
    });

    it('both fixture ids are named in the skill that owns the loop', () => {
        const skill = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'skills', 'fe-design', 'SKILL.md'),
            'utf8',
        );
        expect(skill).toContain('daf-adhoc-converges');
        expect(skill).toContain('daf-adhoc-ceiling');
    });
});
