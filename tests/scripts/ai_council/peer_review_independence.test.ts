// road-to-inbox-harvest-2026-08-e-council-topology-evidence — Phase 3, steps 3.1 + 3.2.
//
// The two steps are one file because they are one property of one function:
// what `run_peer_review` puts in front of a reviewer. 3.1 is about the ORDER of
// that payload, 3.2 about its MEMBERSHIP, and both are asserted on the payload
// itself rather than on prompt wording.
//
// ── 3.1 — the property, stated so it can fail ────────────────────────────────
// The step's verify is not "a shuffle exists"; it is "the property test fails
// when the shuffle is replaced by identity". Three assertions carry that, and
// only the third can:
//
//   (i)  DETERMINISTIC REPLAY — identical inputs give identical labels. True
//        under identity too, so it is a regression guard, never the red.
//   (ii) SELF-EXCLUSION + DISTINCT MAPPINGS — each reviewer's label→source map
//        differs from every other reviewer's. Also true under identity, because
//        self-filtering alone guarantees it: each reviewer sees a different
//        SUBSET. Worth pinning, and worth saying plainly that it is not the red.
//   (iii) CONFIG ORDER NOT INFERABLE — across distinct seeds, more than one
//        permutation is observed. Under identity, `Response-A` is always the
//        first non-self member in config order, so the observed set collapses to
//        one and this assertion fails. THIS is the red the step asks for.
//
// N=2 is deliberately excluded from (iii) and only from (iii): a reviewer in a
// two-member council sees exactly one other answer, one permutation of one
// element exists, and no shuffle can be distinguished from identity. Asserting
// variance there would be asserting something arithmetically impossible. It is
// stated rather than silently skipped, because a range written as 2..8 and
// tested as 3..8 without a reason reads as an off-by-one.
//
// ── A recorded decision this test does NOT override ──────────────────────────
// The roadmap says "reviewer-specific ordering". The shipped seed is
// RUN-scoped, not reviewer-scoped, and `orchestrator.ts:1533-1543` records that
// as deliberate: "The reviewer is deliberately NOT in the seed: one shuffle per
// run, so a reader comparing two reviewers' critiques of the same member is
// comparing the same label." That is a lock with a stated reason, so this test
// pins the property that actually holds — per-reviewer mappings ARE distinct,
// via self-filtering — and does not quietly re-seed the shuffle to make a
// different sentence true. Changing it is a decision-revisit-gate matter, not a
// test edit.
import { describe, expect, it } from 'vitest';

import { CouncilResponse, ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { run_peer_review } from '../../../src/scripts/ai_council/orchestrator.js';

/** Council sizes the steps name. */
const SIZES = [2, 3, 4, 5, 6, 7, 8] as const;
/** Sizes where more than one permutation of the reviewed subset can exist. */
const SIZES_WITH_ORDER_FREEDOM = SIZES.filter((n) => n - 1 >= 2);

/** A member that records every user_prompt it was handed. */
class Capturing extends ExternalAIClient {
    readonly prompts: string[] = [];
    constructor(name: string, model: string) {
        super();
        this.name = name;
        this.model = model;
        this.billable = false;
        this.transport = 'manual';
    }
    override ask(_system: string, user_prompt: string): CouncilResponse {
        this.prompts.push(user_prompt);
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text: `critique from ${this.name}`,
            latency_ms: 1,
        });
    }
}

const providerName = (i: number): string => `provider-${String(i)}`;
const modelName = (i: number): string => `model-${String(i)}`;
/** Unique enough that a payload containing it is unambiguous evidence. */
const bodyOf = (i: number, salt: string): string =>
    `deliberation body of member ${String(i)} :: unique-marker-${String(i)}-${salt}`;

function members(n: number): Capturing[] {
    return Array.from({ length: n }, (_, i) => new Capturing(providerName(i), modelName(i)));
}
function deliberation(n: number, salt: string): CouncilResponse[] {
    return Array.from(
        { length: n },
        (_, i) => new CouncilResponse({ provider: providerName(i), model: modelName(i), text: bodyOf(i, salt) }),
    );
}

/** `reviewer -> "A=src|B=src|…"`, the observable label assignment. */
function mappings(n: number, salt: string, ask: string): Map<string, string> {
    const r = run_peer_review(members(n), deliberation(n, salt), { original_ask: ask });
    const out = new Map<string, string>();
    for (const [reviewer, m] of r.label_to_source_by_reviewer) {
        out.set(
            reviewer,
            [...m.entries()].map(([label, src]) => `${label}=${src}`).join('|'),
        );
    }
    return out;
}

describe('run_peer_review — reviewer independence, N=2..8 (3.1)', () => {
    it.each(SIZES)('N=%i — deterministic replay: identical inputs give identical labels', (n) => {
        const a = mappings(n, 'salt', 'the ask');
        const b = mappings(n, 'salt', 'the ask');
        expect([...a.entries()]).toEqual([...b.entries()]);
        expect(a.size, 'every member reviews').toBe(n);
    });

    it.each(SIZES)('N=%i — every reviewer gets a distinct label→source mapping', (n) => {
        const m = mappings(n, 'salt', 'the ask');
        expect(new Set(m.values()).size, `N=${String(n)} produced a shared mapping`).toBe(n);
    });

    it.each(SIZES)('N=%i — no reviewer is handed its own answer to review', (n) => {
        const r = run_peer_review(members(n), deliberation(n, 'salt'), { original_ask: 'the ask' });
        expect(r.label_to_source_by_reviewer.size).toBe(n);
        for (const [reviewer, m] of r.label_to_source_by_reviewer) {
            expect([...m.values()], `reviewer ${reviewer} saw itself`).not.toContain(reviewer);
            expect(m.size, 'a reviewer sees exactly the other N-1 answers').toBe(n - 1);
        }
    });

    it.each(SIZES_WITH_ORDER_FREEDOM)(
        'N=%i — config order is not inferable from position (fails under an identity shuffle)',
        (n) => {
            // Sixteen distinct seeds. The assertion is on the SET of observed
            // permutations of the FIRST reviewer's mapping, never on a run count:
            // a count passes against a constant, which is exactly the defect.
            const seen = new Set<string>();
            for (let i = 0; i < 16; i += 1) {
                const first = [...mappings(n, `salt-${String(i)}`, `ask-${String(i)}`).values()][0];
                if (first !== undefined) seen.add(first);
            }
            expect(
                seen.size,
                `N=${String(n)}: only one permutation across 16 seeds (${[...seen][0] ?? '(none)'}) — ` +
                    'label assignment is a pure function of config order',
            ).toBeGreaterThan(1);
        },
    );

    it('N=2 carries no order freedom, and that is arithmetic, not a gap', () => {
        // One reviewed answer per reviewer → exactly one possible ordering. The
        // guard below fails if someone ever widens SIZES_WITH_ORDER_FREEDOM to
        // include a size where the variance assertion cannot hold.
        expect(SIZES_WITH_ORDER_FREEDOM).not.toContain(2);
        for (const n of SIZES_WITH_ORDER_FREEDOM) {
            expect(n - 1).toBeGreaterThanOrEqual(2);
        }
    });
});

describe('run_peer_review — self-review is structurally impossible (3.2)', () => {
    // The step is explicit that no prompt instruction is the protection: the
    // payload must not be able to CONTAIN the reviewer's own answer. So these
    // assertions read the string that reached `ask()`, not the derived map and
    // not `PEER_REVIEW_PROMPT`'s "You may NOT see your own response" sentence.
    it.each(SIZES)('N=%i — the payload handed to each reviewer omits that reviewer body', (n) => {
        const ms = members(n);
        run_peer_review(ms, deliberation(n, 'salt'), { original_ask: 'the ask' });
        ms.forEach((m, i) => {
            expect(m.prompts.length, `member ${String(i)} was consulted exactly once`).toBe(1);
            const payload = m.prompts[0] as string;
            expect(payload, `member ${String(i)} was shown its own body`).not.toContain(bodyOf(i, 'salt'));
            // …and it did receive every other body, so the omission is
            // self-filtering and not an empty payload passing by accident.
            for (let j = 0; j < n; j += 1) {
                if (j !== i) {
                    expect(payload, `member ${String(i)} was not shown member ${String(j)}`).toContain(
                        bodyOf(j, 'salt'),
                    );
                }
            }
        });
    });

    it('the protection survives a prompt that no longer says so', () => {
        // The point of asserting the payload: strip the sentence and the
        // structural guarantee is unchanged. This test would still pass with
        // `PEER_REVIEW_PROMPT`'s self-review line deleted — which is why it is
        // the assertion the step asks for.
        const ms = members(3);
        run_peer_review(ms, deliberation(3, 's'), { original_ask: 'a' });
        const withoutInstruction = (ms[0] as Capturing).prompts[0]!.replace(
            'You may NOT see your own response in the list — that is by design.',
            '',
        );
        expect(withoutInstruction).not.toContain(bodyOf(0, 's'));
    });

    it('CHARACTERISATION — a member with no deliberation answer still reviews, and sees everything', () => {
        // Written expecting the opposite and corrected against the code, which
        // is why it is labelled a characterisation rather than a guarantee.
        //
        // `by_source` skips a member whose deliberation errored or came back
        // empty (`orchestrator.ts:1468-1475`), but the reviewer loop iterates
        // `members`, so that member is still consulted and its self-filter
        // (`src !== scorer`) matches nothing — it receives the FULL set and
        // costs a paid call.
        //
        // This is NOT a 3.2 violation: self-review means a reviewer seeing its
        // OWN answer, and a member with no answer in the set cannot see one. It
        // is a spend observation, and changing it would change which paid calls
        // fire — outside this step, and reported rather than silently patched.
        const ms = members(3);
        const stranger = new Capturing('stranger', 'model-x');
        const r = run_peer_review([...ms, stranger], deliberation(3, 's'), { original_ask: 'a' });
        expect(r.label_to_source_by_reviewer.has('stranger:model-x')).toBe(true);
        expect(stranger.prompts.length).toBe(1);
        // The 3.2 property still holds for it vacuously: it is shown no answer
        // of its own, because it has none.
        expect([...r.label_to_source_by_reviewer.get('stranger:model-x')!.values()]).not.toContain(
            'stranger:model-x',
        );
    });
});
