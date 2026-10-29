<!-- evidence-type: analysis -->

## Response-B

*tokens: 10 in / 3645 out · 84047 ms*

Matze, reviewing round 1 outputs as an independent examiner in round 2.

## 1. Prior points I agree with

**Agree with both A and B:**
- The empty-ledger assertion is **intentionally relaxed** (policy shift from "no grants" to "grants with documented authorization"). Not a test bug.
- Unverified-path refusal correctly asserted red (line 300/302, both reviewers cite it).
- The directive-existence assertion can fail (pattern-not-found, file-missing).

**Agree with A:**
- Dynamic `LIVE_GRANTS` derivation **hides grant additions from test review**. Adding a grant + directive makes tests pass without visible change in test code.
- Explicit expected-grant list forces test updates → reviewer visibility.

**Agree with B:**
- File existence doesn't validate **directive content** (token amount, whether directive actually authorizes this ID). The test title "backed by" overstates what's checked.
- `LIVE_GRANTS` auto-includes any grant citing an existing directive → **test suite cannot independently detect an unexpected grant**.
- Need deterministic wrong-ID/correct-ID cases, not just adaptive integration tests.

## 2. Disagreements

**Disagree with A's null-safety concern (minor):**
```typescript
const cited = /agents\/evidence\/owner-directives\/[\w.-]+\.md/.exec(e.reason)?.[0];
```

A suggests `e.reason ? /pattern/.exec(...) : undefined` for clarity. But `e.reason` is schema-typed; if the schema doesn't guarantee it exists, schema validation should fail, not the test. The regex handles undefined implicitly (converts to string `"undefined"`, doesn't match, returns `null`). First `expect` would fail with message `"${e.id} names no owner directive"`. Not a real issue — the failure mode is clear.

**Partially disagree with B's "diff does not demonstrate that an unverified run now passes":**
Lines 300-302 explicitly demonstrate both:
```typescript
expect(main(APPROVED_ARGS)).toBe(0);  // verified → green
expect(main([])).toBe(LIVE_GRANTS.length > 0 ? 1 : 0);  // unverified → red when grants exist
```
Both branches shown. Maybe B meant "doesn't show a new false-positive was introduced" — but the conditional ensures correct behavior.

## 3. New points / refinements

**1. Test-poisoning vector, not production bypass:**
Both reviewers noted `LIVE_GRANTS.flatMap` makes approved-ID args a function of ledger state. If a malicious grant is added with a directive file (that exists but doesn't authorize), these tests will auto-verify it. The **gate itself** would still refuse in production (proper verification required), but **tests would pass**. This is test poisoning, not a production hole — but it's the core risk.

**2. B's content-validation point is critical but overstated:**
Yes, the test doesn't validate token amounts or directive authorization. But that's not `measured_payload_ceiling.test.ts`'s job — it tests **ledger schema**, not **approval decision logic**. Validating directive content matches grant is a *different* invariant (should be tested in gate/decision tests, not schema tests). Not a dealbreaker for this diff.

**3. Neither reviewer addressed comment evolution:**
- **Old:** "is empty — the ordinary path needs no grant" (statement of fact: ledger IS empty)
- **New:** "The ordinary path needs no grant; a recorded one is the owner's break-glass" (policy: ordinary path DOESN'T NEED one, but MAY have one)

This is good — documents the policy shift. But subtle.

**4. Test title drift (cosmetic):**
"parses, and is empty" → "parses, and every grant in it is backed by a committed owner directive"

The title now matches what's tested, but "backed by" overstates validation (per B). Better: "parses, and every grant cites an existing owner directive" (accurate to what's checked).

**5. Minimum forcing function missed by both:**
Reviewer A's explicit list is good, but there's a simpler signal: add a separate assertion counting total grants. Example:

```typescript
expect(r.exceptions.filter(e => e.repaid_at === null).length).toBe(1);
```

If grants change, this fails. Doesn't require listing IDs, but forces acknowledgment. Still, A's approach is better (shows *which* grants are expected).

## Synthesis

Both reviewers landed on the same core issue: **dynamic approval list hides grant additions**. Their fixes differ:

- **A:** Explicit expected list → forces test update visibility
- **B:** Keep adaptive tests + add deterministic wrong-ID/correct-ID cases

**A's fix is minimum viable** (prevents silent additions). **B's fix is defense-in-depth** (validates refusal logic). Combined is best:

1. **In `measured_payload_ceiling.test.ts`:** Pin expected grants explicitly (A's approach).
2. **In `check_preamble_payload_budget.test.ts`:** Add deterministic wrong-ID case (B's approach) — currently only tests correct-ID (green) and no-ID (red when grants exist).

**Single highest-leverage change:** Pin expected grants explicitly:

```typescript
const EXPECTED_LIVE_GRANTS = ['oq-42-image-floor-routes-to'];
expect(ACTUAL_LIVE_GRANTS).toStrictEqual(EXPECTED_LIVE_GRANTS);
```

This prevents the test-poisoning vector (auto-verification of unexpected grants) and makes grant additions visible in test diffs.

## Operational cost observation

Both reviewers noted maintenance trade-offs (A: explicit list requires updates; B: dynamic is flexible but opaque). Neither mentioned **the temporal drift risk**: if `oq-42` is repaid later (`repaid_at` set), `LIVE_GRANTS` becomes empty and tests behave differently again. The conditional `LIVE_GRANTS.length > 0 ? 1 : 0` handles this, but it's invisible to future readers. Explicit list + assertion makes temporal state changes visible.

---

**REQUEST_CHANGES** — The diff correctly implements verified-grant handling and properly refuses unverified grants, but `LIVE_GRANTS` auto-includes any grant with an existing directive file, hiding grant additions from test review and creating a test-poisoning vector. Pin expected grants explicitly in `measured_payload_ceiling.test.ts` (`const EXPECTED_LIVE_GRANTS = ['oq-42-...']` with strict equality check) to force test updates and reviewer visibility when grants change. Optionally add deterministic wrong-ID refusal test in budget check (currently only correct-ID and no-ID cases).

**STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no**

---

## Response-A

*tokens: 110746 in / 883 out · 38271 ms*

1. **I agree with Reviewer B’s distinction between a changed assertion and a weakened authorization contract.** At `measured_payload_ceiling.test.ts:438`, a documented nonempty ledger now passes where the old empty-array assertion failed. Given the stated owner authorization, that is an intentional change of expected repository state. It does not demonstrate an unauthorized run passing.

   I agree with both reviewers that deriving `APPROVED_ARGS` from `LIVE_GRANTS` cannot independently detect an unexpected grant. However, I disagree with Reviewer A that this alone warrants **REQUEST_CHANGES**: simulated approvals are reasonable setup for testing approved behavior. Grant additions remain visible in the ledger diff; they are not invisible to review.

2. **Yes, the unverified path is still asserted red.** The changed unchanged-tree test explicitly expects `main([])` to return `1` whenever `LIVE_GRANTS.length > 0`.

   **Yes, the directive assertion can fail.** Removing the cited file makes `existsSync` false. The reported mutation result is consistent with the code, although I did not reproduce it. As Reviewer B observes, existence does not establish that the document authorizes this ID or 43-token amount. “Backed by” overstates the assertion.

3. **The best improvement separates repository state from gate behavior.** Keep the adaptive integration setup, reuse `readExceptions` instead of introducing a second unchecked JSON representation, and use deterministic fixtures to assert unverified, wrong-ID, and exact-ID behavior. Independently pin the authorized shipped grant’s ID, amount, and directive if unexpected ledger expansion is a policy violation.

   A new refinement: the advisory test passes `today: '2026-09-11'` while importing a grant associated with October 29. Whether this matters depends on grant date validation, which is absent from the supplied diff. A fixed approval fixture would prevent future ledger changes from altering this historical test’s prerequisites.

The weakest assumption is that every live ledger entry is suitable for simulated verification. The most easily overlooked failure is an unintended grant citing an unrelated existing directive: both new checks can pass without establishing authorization.

The diff stays within one testing concern, introduces no unnecessary OO structure, and shows no production authorization bypass. Coverage: both pasted file hunks reviewed closely; implementation and surrounding tests unverified; tests not run.

**APPROVE** — the change accommodates the stated authorized grant while retaining explicit unverified refusal; the highest-leverage improvement is an independent assertion of the shipped grant’s authorized identity, amount, and directive.

STANCE: confirmed-non-expanding | CONFIDENCE: med | DEALBREAKER: no

---

## Convergence / Divergence

Summarise the council with the PR-review shape below.

### Consensus
Findings where two or more reviewers agreed, each one a single line.

### Conflicts
Findings where reviewers disagreed. State both sides with reviewer
labels; do not pick a winner here — that lives in the recommendation.

### Must-fix before merge
Items at least one reviewer marked `REQUEST_CHANGES` or `REJECT`
and the host agent confirms are load-bearing. Maximum five.

### Recommendation
APPROVE / REQUEST_CHANGES / REJECT and a single sentence justifying
the verdict, anchored on the strongest consensus or must-fix line.

### Resolving evidence
One line per unresolved disagreement above, in this shape:
`<clash> — strongest minority evidence: <what the losing side actually
showed> · resolved by: <the observation that would settle it>`.
Name a measurement, an artefact or a run — never a further opinion. Write
`no resolving evidence identified — <why>` when nothing observable would
settle it: an unanswerable disagreement is a finding, and silence is not.

### Kill criteria
Observable conditions that would falsify this verdict without re-convening
the council (a failing check, a missing test, a regression signal). Each
entry names a threshold or a specific event. Omit only if genuinely none
exist, and say so.

### Concrete next step
Exactly one artefact-producing action the author can take in their current
turn.

---

### De-anonymization map

- Response-A → openai · codex-default
- Response-B → anthropic · claude-sonnet-4-5

---

**Quorum:** 2/2 present, needed 1 — concluded.
