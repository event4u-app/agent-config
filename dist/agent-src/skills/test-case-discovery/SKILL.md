---
model_tier: medium
name: test-case-discovery
description: "Use BEFORE writing any test — enumerate cases per behavior (happy / boundary / error / abuse), prioritize by likelihood × impact, cross-check via subagent — even if the user just says 'add tests'."
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
---

# test-case-discovery

AI-written test suites default to **too few tests, mostly happy path**. This skill is the discovery step that runs *before* the first test is written: enumerate what could break, pick the most important cases, then hand the list to [`test-driven-development`](../test-driven-development/SKILL.md) or the stack skill. The goal is **breadth AND quality** — happy path AND boundaries AND error paths — with a hard cap so the output is never a pile of trivial tests.

This is the **before** layer. Assertion quality is [`testing-anti-patterns`](../testing-anti-patterns/SKILL.md); after-the-fact coverage review is [`judge-test-coverage`](../judge-test-coverage/SKILL.md).

## When to use

- About to write tests for new or changed behavior — the `test-driven-development` RED phase and `/tests create` route here as a mandatory first step.
- A test task arrives as "add tests" / "write tests for this branch" with no case list.
- Reviewing a plan whose testing section only names the happy path.

Do NOT use when:

- The diff is trivial (< 10 lines, pure rename/refactor, no new behavior) — write 1 happy + 1 boundary case and move on; no matrix.
- The problem is assertion quality (overfit, tautology, mock-the-mock) → [`testing-anti-patterns`](../testing-anti-patterns/SKILL.md).
- A test is failing for non-obvious reasons → [`systematic-debugging`](../systematic-debugging/SKILL.md).
- The tests already exist and the question is "are they enough?" → [`judge-test-coverage`](../judge-test-coverage/SKILL.md).

## The Iron Law

```
NO TEST IS WRITTEN BEFORE THE CASE LIST EXISTS.
ENUMERATE → PRIORITIZE → THEN WRITE. NEVER HAPPY-PATH-ONLY.
FLOOR PER BEHAVIOR: 1 HAPPY + 1 BOUNDARY + 1 ERROR (+1 ABUSE ON SECURITY PATHS).
CAP PER BEHAVIOR: 5–8 CASES — EACH MUST FAIL FOR A DISTINCT REASON.
```

## Does this change owe an executable behavior contract?

Cases and contracts are not the same artifact. A **case** is something you assert
in the project's unit runner. An **executable behavior contract** — a
specification written in the language of whoever asked for the change, and run
by a tool that reads it — is a heavier thing, and most changes do not owe one.
Ask for one everywhere and it degrades into a second, slower unit suite; ask for
one nowhere and behavior nobody can read stays unstated.

### The observable-behavior test

> **Does this change alter behavior someone outside the code can observe, and
> would that person describe it in their own words?**

Both halves have to hold: observable behavior with no outside audience is
still only a case. *Observable* rules out anything a caller cannot see. *In their own
words* rules out behavior that is real but has no audience outside the codebase —
if the only person who can state the rule is the person reading the
implementation, a case in the unit runner states it better and cheaper.

**Yes → a contract is owed.** A refund is issued when an order is cancelled
within 14 days; a member on a lapsed plan is denied the export; a rejected
upload tells the uploader which rule it broke.

**No → cases, not a contract.** At least these:

- **A refactor with no behavior change.** Nothing outside the code can observe
  it, by definition. If something can, it was not a refactor.
- **An internal invariant with no external vocabulary.** Cache key derivation,
  retry backoff, connection-pool sizing, a query plan. Real behavior, no
  audience — the failure is stated as a case, not as a sentence somebody outside
  the code would say.
- **A pure boundary or error path with no business reading.** Rejecting a
  malformed UTF-8 sequence is a case; *"we do not accept expired coupons"* is a
  contract.
- **A change whose only observer is another part of this system.** A consumer
  written by the same team is a caller, not an audience. Contract tests between
  services are a different tool and a different question.

When the answer is yes, the ordering is unchanged: the contract fails before the
implementation exists and passes after — see
[`test-driven-development`](../test-driven-development/SKILL.md). A contract
first seen green has the same unknown sensitivity as any other test never seen
red.

### The anti-script rule

```
A CONTRACT STEP NAMING A SELECTOR, A TIMEOUT, OR A KEYSTROKE IS A DEFECT
IN THE CONTRACT — NOT AN IMPLEMENTATION DETAIL THAT HAPPENS TO BE THERE.
WRITE WHAT IS TRUE, NEVER WHAT IS CLICKED.
```

A contract that scripts the interface is pinned to the interface: it goes red on
every redesign that changes nothing anyone cares about, and stays green through
the redesign that breaks the rule. It also stops being readable by the person
whose words it was supposed to be in — which was the only reason to pay for it.

**Wrong** — this is a click script wearing Given-When-Then:

```gherkin
Given I open "/cart?id=42"
When I click #apply-coupon
And I type "SUMMER" into input[name=code]
And I wait 2 seconds
Then .cart-total should contain "€45.00"
```

Every line is about the page. Change the button id and it fails; move the
discount rule and it passes.

**Right** — same behavior, stated as the rule it is:

```gherkin
Given a cart of €50
When the customer applies a valid 10% coupon
Then the order total is €45
```

The rule survives the redesign, and the person who asked for it can read it.

**The test for a step:** could it still be true if the product were a CLI, an
API, and a web page? If not, it belongs in the implementation the contract calls
into, not in the contract.

## Procedure — the five-step funnel

### 1. Behavior inventory (30 seconds)

List the 1–3 **distinct observable behaviors** the change introduces or modifies — one sentence each: *"When X happens, the system should do Y."* Each behavior gets its own case list. If you cannot state a behavior in one sentence, split it.

### 2. Dimension scan (per behavior)

Walk the dimensions below; mark **3–5 as HIGH** (most likely to occur × highest impact when wrong). Skip dimensions the behavior structurally cannot hit — but say so, don't silently omit.

- **Input validity** — null/undefined, empty string/array, zero, negative, max bounds/overflow, type mismatch, malformed format, Unicode/whitespace, off-by-one.
- **State** — missing prerequisites, invalid state transitions, idempotency/double-submit, duplicates and ordering.
- **Collaborator failure** — timeout, 4xx/5xx, partial or malformed response, thrown exceptions, empty result sets.
- **Concurrency & time** — races, retries, timezone/DST, clock skew (only when the surface touches them).
- **Security surface** (authz / tenant / data access) — missing/expired credentials, not-owner, cross-tenant, privilege escalation, injection payload. On data-returning endpoints the three negative tests from `broken-access-control` (unauthenticated → 401, not-owner → 403/404, cross-tenant → 403/404) are the floor, not optional extras.

### 3. Case synthesis

Generate ≥ 1 concrete case per HIGH dimension, plus the happy path. Enforce the floor: **1 happy + 1 boundary + 1 error per behavior, +1 abuse case when the behavior is security-relevant.** Name each case like a test (`it rejects an expired token`), not like a category ("error handling").

### 4. Subagent cross-check (gated, with mandatory fallback)

Widen the list with a second pair of eyes:

- **Subagent path** — when the host supports subagent spawn and no emergency halt is set (always-on orchestration: there is no more per-layer on/off setting): spawn **one** subagent with an adversarial lens — *"Behavior: {sentence}. Case list so far: {list}. As a security researcher / SRE / chaos engineer: which non-obvious failure mode or abuse vector is missing?"* On security-critical surfaces a **second** subagent with a different lens is allowed; more is waste. Merge only novel cases.
- **Degraded path (mandatory when no subagent runs)** — a self-review pass with an explicit lens shift: re-walk step 2 asking *"what breaks in production? what would an attacker try?"* and emit the same output shape (1–2 additional cases, or explicitly "none found").

Unavailability of subagents never skips this step — it only switches the path.

### 5. Prioritize and cap

If a behavior collected more than 8 cases: rank by likelihood × blast radius, keep the top 5–8. Quality gate: **each surviving case must be able to fail for a distinct reason** (different code path / exception / assertion). The same assertion fed two interchangeable input values is ONE case — use a data provider, not a second test. Record dropped cases in one line each so the discovery work is not lost.

Then hand the list to [`test-driven-development`](../test-driven-development/SKILL.md) — every case runs its own RED → GREEN cycle — or to the stack skill ([`pest-testing`](../pest-testing/SKILL.md), [`api-testing`](../api-testing/SKILL.md), [`playwright-testing`](../playwright-testing/SKILL.md)).

## Output format

1. The **case matrix** per behavior — case name → category (happy / boundary / error / abuse) → one-line why — in the reply or as a comment block atop the test file.
2. The **floor check**, stated explicitly: `floor met: happy ✓ boundary ✓ error ✓ (abuse: n/a — no security surface)`.
3. The **cross-check result**: which path ran (subagent + lens, or degraded self-review) and which cases it added — or explicitly "none".
4. **Dropped/deferred cases** with a one-line reason each.

## Gotcha

- Line coverage lies — 100 % of lines with happy-path inputs still misses every boundary. Count **cases**, not lines.
- The floor is per **behavior**, not per file — one boundary test in a 5-behavior file does not clear four other behaviors.
- Enumeration is not an implementation license: the cap and [`testing-anti-patterns`](../testing-anti-patterns/SKILL.md) Anti-Pattern 6 still apply — 6 meaningful tests beat 20 trivial ones.
- "No subagent available" is not "skip step 4" — the degraded self-review is mandatory and cheap.
- A case list written *after* the tests is decoration — the funnel runs before the first RED.

## Do NOT

- Do NOT write the first test before the case list exists.
- Do NOT stop after the happy-path case — the floor is 1 happy + 1 boundary + 1 error per behavior.
- Do NOT pad the list with cases that fail for the same reason — data providers cover value variations.
- Do NOT skip the step-4 cross-check because subagents are unavailable — run the degraded self-review.
- Do NOT run the full funnel on trivial diffs — 1 happy + 1 boundary suffices there.
- Do NOT drop enumerated cases silently — record them with a reason.

## Auto-trigger keywords

- test case discovery
- what to test
- test coverage plan
- edge cases
- boundary cases
- happy path only
- broad test coverage
- case matrix
- negative tests

## See also

- [`test-driven-development`](../test-driven-development/SKILL.md) — consumes the case list; one RED → GREEN cycle per case.
- [`testing-anti-patterns`](../testing-anti-patterns/SKILL.md) — assertion-quality floor (overfit, tautology, gaming the green).
- [`judge-test-coverage`](../judge-test-coverage/SKILL.md) — after-the-fact coverage review.
- [`pest-testing`](../pest-testing/SKILL.md) · [`api-testing`](../api-testing/SKILL.md) · [`playwright-testing`](../playwright-testing/SKILL.md) — stack-specific execution.
- Rule `senior-engineering-discipline` — the Iron-Law floor this procedure operationalizes.
- Rule `broken-access-control` — the three negative tests on data-returning endpoints.
