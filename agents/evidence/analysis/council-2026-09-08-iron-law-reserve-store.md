<!-- evidence-type: analysis -->

# Council 2026-09-08 — where an Iron Law reserve approval record may live

> **Why this file exists.** Council artefacts under `agents/runtime/council/` are
> gitignored and auto-pruned after seven days, so the verdicts below would
> otherwise survive only as the compressed quotes in
> [`ADR-265`](../../../docs/decisions/ADR-265-iron-law-reserve-refused-verifier-inside-the-change.md).
> Several findings that record carries in one clause are argued at length here —
> the authorization-versus-allocation split, the concurrency failure that
> survives the first merge, and both seats' lists of what a checker must refuse
> to infer. That is worth keeping in the tracked tree.

## Run facts, so a later reader can price the verdict

| Field | Value |
|---|---|
| Members present | 2 of 2 — `anthropic/claude-sonnet-4-5`, `openai/codex-default` |
| Quorum | 2 of 2, threshold 1 — `concluded` |
| Absent seats | none |
| Mode | `design` · prompt-mode `design` · depth deep · peer review off |
| Errors returned | None, None |
| Cost | $0 estimated / $0 actual — both seats subscription transport, nothing billed |
| Question artefact | the topic-anchored question file for this roadmap (gitignored; its content is reproduced in ADR-265 § Context and § Why) |

**No degradation.** Both seats answered, neither returned an error, and
`absent_members` is empty. This is convergence, not a single-member review
reported as a quorum — a distinction this repository has recorded a failure on
before.

## The verdict, in one line each

- **anthropic/claude-sonnet-4-5** — *"reject the reserve mechanism entirely
  (Option A). If required, ship advisory-only (Option B) with honest disclosure
  that the trust root is code review, not cryptographic proof."*
- **openai/codex-default** — *"keep the reserve unshipped; record placement is
  secondary to protecting the entire authorization, verification, and allocation
  chain."*

Both selected **Option 6 — do not ship the reserve**. The decision, its
consequences and the five activation prerequisites live in ADR-265; what follows
is the raw material, unedited, so that compression can be checked.

## Seat verdict — `anthropic/claude-sonnet-4-5`

Matze,

My greenlight verdict: **reject Option 1 as specified, and challenge the premise that a reserve mechanism should exist at all.**

## 1. Points I agree with (by reviewer)

**Reviewer B:**
- **The verifier trust boundary is the architectural blocker.** Protecting only the approval record is necessary but insufficient. The consuming PR can modify `check_preamble_payload_budget.ts`, the tokenizer, the census logic, or create a competing required check with the same name. A protected record read by an unprotected verifier provides no independent authorization.
- **The precedent contradicts the proposal.** Fact 6 explicitly documents that the `honest_limit` check is informational, not enforced. Using this as precedent to ship an "enforced" reserve is incoherent.
- **Concurrent spending is unresolved.** Base-ref validation gives each PR a consistent snapshot, not serialized allocation. PRs A and B can each see 120 tokens available and both pass independently.
- **Option 1's trust root is false under current configuration.** With `required_approving_review_count: 0`, temporal separation of PRs does not create authority separation.

**Reviewer C:**
- **The question is backwards.** The constraint isn't record placement but whether "the PR author cannot grant themselves budget" - and under current configuration, they can by modifying the verifier.
- **Advisory-only with documented delegation is honest.** If the trust model is code review (which it is), document that explicitly rather than pretending automation enforces what it cannot.
- **Reviewer B's five controls are necessary for enforcement.** Verifier protection, required check status, atomic accounting, approval-source protection, and verifier pinning must all exist. Missing any one leaves you back at advisory-only.

**Reviewer A:**
- **Fail-closed is correct.** Unreadable approval source = zero reserve.
- **Hash binding is necessary.** Content hash establishes approved material; commit SHA prevents transplanting across contexts.
- **The refusal-to-infer conditions are sound.** Fence syntax and author-written justification cannot imply approval.

## 2. Points I disagree with and why

**Reviewer A's conclusion** that Option 1 becomes viable "once configured" understates the gap:
- "Configured" requires **five controls** (Reviewer C's list), not just CODEOWNERS
- Even with those, Reviewer A doesn't address concurrent spending
- The phrase "once configured" implies a single toggle, but the required changes span rulesets, CODEOWNERS, workflow requirements, and merge-queue setup

**Reviewer C's framing** that advisory-only is "the simplest resolution" makes it sound like a fallback. It's not - it's the **only resolution that matches the repository's actual trust model**. The repository enforces mergeability through code review, not through cryptographic proof. Advisory-only is the honest version of that, not a compromise.

**Reviewer B's Option 5 (composite)** as necessary for enforcement. One independently writable approval store plus a trusted verifier is sufficient **if** you solve verifier protection and merge serialization. Two authorization mechanisms only add complexity if the first one is already trusted and atomic. The threat model here is "can the PR author grant themselves budget," not "can an approved PR be impersonated." Signatures don't help if the verifier checking them is PR-controlled.

**All three reviewers accept the premise** that a reserve mechanism should exist. I don't.

## 3. New points and architectural pushback

### The hardest architectural call: the reserve shouldn't exist

Iron Laws are meant to be **immutable constraints**. A "reserve" that can be consumed by "independently authorized additions" already admits that some Iron Laws are more fungible than others. That undermines their purpose.

If a rule genuinely deserves Iron Law status:
- Budget impact is irrelevant - make room by condensing or removing other standing rules
- If the budget makes it impractical, that's evidence the rule doesn't need to be standing

The 128-token reserve is solving a **political problem** (how to add rules without removing others) by pretending it's a **technical one** (independent authorization). The honest solution is: either condense something else, or don't make it an Iron Law.

From ADR-264 itself (dissenting seat, fact 8): syntax checking "cannot tell whether prose genuinely deserves standing Iron Law status, whether an author fenced ordinary guidance to consume the reserve, or whether a loose guideline was retroactively elevated."

This is admitting that **importance is subjective** and **status can be gamed**. A reserve that can be consumed through fence-syntax manipulation doesn't solve that - it codifies it.

### What's actually enforceable here

The repository has exactly one trust root: **human code review of PRs to `main`**. That's what facts 4-7 establish:
- Zero required approvals
- CODEOWNERS not enforced
- Only one required check (unrelated to this)
- PR author can push to feature branches
- No merge queue

Every "enforcement" proposal requires changing multiple pieces of that configuration. At that point, you're not designing a record store - you're redesigning the repository's governance model.

**If you're willing to redesign governance:** why not just require human approval for PRs that add fenced rules, rather than building an elaborate approval-record + verifier-protection + merge-serialization mechanism?

### The three options that actually exist

**A. Strict mechanical ceiling (Option 6, improved)**
- Keep the ceiling at `max(design, grace_ceiling)`
- When a fenced Iron Law addition exceeds it: condense existing standing rules first
- Document that Iron Law status means "worth displacing something else"
- Honest, zero configuration changes, aligns incentives correctly

**B. Advisory reserve with documented delegation (Reviewer C's proposal)**
- 128 tokens above ceiling available via maintainer discretion
- Checker reports consumption but doesn't block
- Approval record in `agents/approvals/iron-law-reserve.jsonl` read via base-ref
- Human reviewers verify legitimacy
- Honest about trust model, minimal configuration changes

**C. Actual enforcement (Reviewer B's conditions + merge serialization)**
- Protect verifier code via CODEOWNERS with required review
- Make `check_preamble_payload_budget` a required check
- Protect approval-record directory via CODEOWNERS
- Add merge-time serialization (merge queue or atomic allocator)
- Pin verifier version in workflow
- Fail closed on any missing component
- Requires substantial repository-configuration changes not in scope for an autonomous agent

Option A is architecturally cleanest. Option B is honest about current state. Option C is technically sound but questions whether the complexity is justified.

### The sequencing claim is worse than Reviewer B stated

Reviewer B notes concurrent PRs can overspend. But there's a deeper problem:

1. Land approval record to `main` (PR #1)
2. PR #2 opens based on new `main`, sees record via base-ref, passes check
3. PR #3 also opens based on same `main`, sees same record via base-ref, passes check
4. **PR #2 merges first**
5. PR #3's base-ref read is now stale - the record was consumed by #2
6. But PR #3 already passed its required checks

Even with merge serialization, you need **check-at-merge-time** against the newly updated `main`, not just check-at-PR-time against the base.

### The honest-limit precedent proves too much

Fact 6's `ci_delivery.honest_limit` says: "Editing this workflow makes it FAIL; it does not make it REQUIRED. Whether a failing check blocks a merge is branch-protection configuration."

If the reserve uses the same model (fail but don't block), then:
- It's self-documenting (clear from the check status)
- It doesn't require verifier protection (failure is informational)
- It doesn't require approval-record protection (failure is still informational)
- It doesn't require merge serialization (overspend is reported but not prevented)

That's Reviewer C's advisory-only proposal. Using the precedent to justify Option 1 while claiming Option 1 is **enforced** contradicts the precedent.

### What the acceptance condition doesn't specify

"A PR adding ~120 authorized tokens passes with no budget-config edit" - but authorized **by whom, how binding?**

The roadmap assumes this can be answered mechanically. It can't. The authorization question is:
- Did a human with authority review this specific addition?
- Did they judge it worthy of displacing other Iron Laws?
- Are they willing to stake their judgment on it?

Those are not properties a record schema can encode. They're properties of a human decision process that the record merely documents.

## What must be decided

**Question 1: Should the reserve exist?**

If **no**: Option A (strict ceiling + condense-to-make-room). Cleanest architecturally.

If **yes**: requires answering "why is relaxing the Iron Law ceiling via authorization better than just being more selective about what gets Iron Law status?"

**Question 2: If yes, what's the trust model?**

If **code review** (matches current configuration): Option B (advisory-only). The record documents maintainer approval, checker reports consumption, human reviewers verify.

If **cryptographic/mechanical** (requires substantial reconfiguration): Option C (actual enforcement with all five controls). But question whether complexity justifies the benefit.

**Question 3: What changes my mind about "reserve shouldn't exist"?**

Evidence I'd need:
1. **A requirement that the Iron Law set must grow** - specific mandated additions that cannot fit under current ceiling and cannot displace existing rules
2. **The reserve is temporary** - explicitly a one-time 128-token allowance for a specific migration, after which it's removed
3. **Proof that selective Iron Law status is insufficient** - why we can't just have fewer standing Iron Laws

Without that evidence, the reserve is solving "we want to add rules without removing any" - and the correct answer to that is "no."

## My answer to the five numbered questions

**1. Which option ships, and its trust root?**

**Recommend Option A (strict ceiling, no reserve).** Trust root: mechanical check against a ratcheting ceiling. When additions exceed capacity, condense existing rules first.

**If Option A is rejected:** Option B (advisory-only). Trust root: code review by maintainers on PRs to `main`. The approval JSONL is read-only to the consuming PR (via base-ref), so the PR cannot create its own approval. But a complicit reviewer could approve without checking, or the PR could modify the verifier. Same trust model as every other aspect of mergeability.

**Not Option 1 as specified:** the trust claim doesn't hold under current configuration.

**2. Fail closed or fallback?**

**Fail closed.** Unreadable approval source = zero reserve. But this only matters if you're actually blocking on it (Option C enforcement model). Under Option B advisory-only, "fail closed" just means "report zero reserve available" - the PR doesn't block anyway.

**3. What must the checker refuse to infer?**

**Do not infer approval from:**
- Fence syntax or heading level
- Author-written justification or rationale
- Delta magnitude (large ≠ important)
- Temporal proximity to prior approvals
- Record age (old ≠ invalid, but also doesn't imply perpetual validity)
- Record presence in the approval directory (must be readable, well-formed, non-revoked, and authorized)

**4. Hash vs SHA binding?**

**Both are needed if doing Option C enforcement:**
- Content hash binds the approved material (prevents unauthorized changes)
- Commit SHA binds the context (prevents transplanting across rebases/squashes)

But Reviewer A is right that commit-SHA binding creates operational friction. A middle ground: require content hash always, but allow SHA binding to be refreshed on content-preserving rebases.

**If doing Option B advisory-only:** content hash is still valuable for audit trail, but SHA binding is less critical since the check isn't blocking.

**5. Is honest-limit disclosure sufficient?**

**Not for Option 1's claimed trust model.** Honest-limit documents that a check is informational. Option 1 claims to provide independent authorization. Those are incompatible.

**Yes for Option B advisory-only** - that's literally what honest-limit means: "this check reports a condition but doesn't prevent merge; humans decide."

**No for Option C enforcement** - if you're actually blocking, you need verifier protection and merge serialization, not just disclosure that you're trying.

---

**End summary: reject the reserve mechanism entirely (Option A). If required, ship advisory-only (Option B) with honest disclosure that the trust root is code review, not cryptographic proof. The architectural call I push back on hardest: Iron Laws with an authorized-growth reserve undermine what "Iron Law" means - if it needs budget flexibility, it's not iron. Evidence that changes my mind: proof that the standing rule set must grow and cannot condense.**

## Seat verdict — `openai/codex-default`

Matze, my greenlight verdict is **reject activation and ship Option 6 for now**. The design has not established that either the approval authority or the verifier is outside the PR author’s control.

## Agreement with prior critiques

I agree with **Reviewer B** on the central architectural defect: “Option 1” protects only the record’s temporal location, not the trust chain that interprets it.

- Under “Option 1,” the asserted trust root—“reaching `main` requires a PR”—does not imply independent human authorization. The stated ruleset requires zero approvals and no code-owner review. A two-PR sequence separates time, not authority.
- The checker, its imports, token census, workflow, and status context are all part of the trusted computing base. A PR author who can change any of them may bypass a perfectly protected approval record.
- “Everything downstream of that choice is mechanical” is incorrect. Reserve ownership, canonicalization, approval lifecycle, concurrency, and merge-time accounting remain architectural decisions.
- The reserve should fail closed: an absent, malformed, stale, incompatible, conflicting, revoked, or unreachable approval grants zero reserve. The ordinary ceiling check must still run.
- The 128-token allowance needs explicit accounting semantics. Reviewer B’s monotonic lifetime ledger is the safest interpretation of “aggregate reserve”; deletion should not silently replenish it.
- Base-ref reads do not prevent concurrent overspending. Two PRs can independently observe the same available capacity and both pass.

I also agree with **Reviewer A** that the real question is not principally where the JSON lives, but whether the author can grant themselves capacity by influencing any link in the chain.

Reviewer A is also right that Option 4 is the only candidate with an existing identity-level separation: GitHub prevents self-approval. However, that fact alone does not establish that the reviewer belongs to the authorized approver set or that the verifier is trustworthy.

## Disagreement with prior critiques

### Reviewer A’s advisory-only proposal does not satisfy the acceptance condition

Reviewer A proposes that the five negative fixtures “fail as warnings.” That changes the meaning of “fail.” The source requirement says those cases must fail `check_preamble_payload_budget`; an advisory message followed by a successful status is not a gate and does not resolve the blocker.

It also conflicts with ADR-264’s explicit requirement that neither authors nor reviewing agents may create approval metadata. Calling the record “documentation” does not make author-created metadata independently authorized.

An advisory implementation could be useful observability, but it must not be described as shipping or consuming the reserve. At most, it is preparatory instrumentation under Option 6.

### A protected in-tree store is not inherently insufficient

Reviewer A leans toward the view that an in-tree record remains merely social. That is true under the current rules, but not universally. An in-tree append-only ledger can become a legitimate authorization store if:

- its changes require approval from a designated human team;
- authors cannot satisfy that approval themselves;
- the consuming PR cannot modify the verifier path;
- a trusted required check evaluates the latest merge base; and
- merge serialization prevents double spending.

Cryptographic signatures or a second store are not automatically necessary. I agree with Reviewer B that Option 5 should be driven by a concrete additional threat, not treated as mandatory ceremony.

### Commit-SHA binding should not be mandatory for Option 1

The prompt asks whether records should bind content, commit SHA, or both. For a record that must land on `main` before consumption, binding to the future consuming commit creates a circular and brittle workflow. Every rebase changes the commit without changing the approved substance, while squash merge necessarily produces another SHA.

The security property should instead be:

- mandatory canonical block-content hash;
- structural-context or destination hash;
- approved delta;
- canonical proposed-change/manifest hash; and
- optionally the observed head SHA when approval occurs directly against a PR.

A head SHA is useful freshness evidence for Option 4, where approval occurs on the consuming PR. It is the wrong universal identity for Option 1. The merged squash SHA should be recorded as audit evidence, not treated as retroactively invalidating approval.

## New findings and refinements

### Authorization and allocation are different records

The proposal conflates permission to add a block with consumption of finite capacity.

An approval answers: “May this exact change consume at most N tokens?”  
A ledger entry answers: “This capacity was actually committed and is no longer available.”

Pre-landed approvals alone cannot serialize consumption. The design needs either:

- a merge queue that reruns trusted accounting against the latest protected base; or
- an external allocator that atomically converts an approval into a consumption entry.

Approval records should not reduce capacity until the corresponding content lands, but two outstanding approvals must not both be able to spend the same remaining capacity.

### The trust-root claim must cover identities, not repository roles in general

“Repo admin,” “maintainer,” or “non-author reviewer” is too broad. The falsifiable claim should name an allowlisted GitHub team or immutable identity set and state that:

> No actor able to author or push the consuming change can create a valid approval, alter the trusted verifier, or produce the required success status without approval from that set.

This claim must be continuously testable. Merely checking a username embedded in JSON is insufficient; the store or forge must attest who performed the protected action.

### CODEOWNERS is policy input, not verifier isolation

Even enabled CODEOWNERS allows the file to be changed; it requires another party to approve that change. A stronger verifier design would run a pinned implementation from outside the consuming revision—for example, a protected reusable workflow or immutable action reference—and supply the PR tree only as data.

Protection must cover the workflow entry point and status identity as well. Otherwise a PR may remove the invocation or produce a misleadingly equivalent status.

### Kill-switch detection cannot depend solely on mutable PR code

The proposed kill switches include ruleset drift, missing required status, unknown tokenizer versions, and verifier provenance failure. If the code detecting those conditions is itself supplied by the consuming PR, the kill switch shares the original vulnerability.

The control-plane check must run from trusted code. On any trust failure, reserve availability becomes zero while the plain ceiling remains enforced.

### Relabelling needs a historical semantic identity

The negative fixture “relabelling existing prose into a fence fails” cannot be enforced merely by hashing the resulting block. The checker must compare canonical content across base and head and recognize moved or newly fenced pre-existing text.

It must refuse to infer novelty from:

- a new fence or heading;
- relocation between files;
- whitespace or formatting changes;
- splitting or joining blocks;
- renamed identifiers;
- an author-declared “new” flag;
- small delta size;
- temporal proximity between approval and consumption.

## Required decision

1. **Ship Option 6.** No reserve is consumable under the current repository controls.

2. **Failure behavior:** approval resolution fails closed to zero reserve. The ordinary ceiling still runs, preserving today’s behavior for changes that do not require reserve.

3. **Bindings:** require canonical content, structural context, delta, and proposed-change/manifest hashes. Require an exact head SHA only when authorization is issued against that head, such as a PR review. Do not make commit SHA a universal requirement for pre-landed records.

4. **Disclosure:** the existing “honest limit” is necessary but insufficient. It accurately admits that CI configuration lies outside the code change, but it does not create the independent authorization promised by ADR-264.

5. **Activation prerequisites:** a repo administrator must install a required, trusted verifier path; protect an approval store or configure an authorized review mechanism; establish named approvers; and provide merge-time serialization. Only then should implementation switch from Option 6 to Option 1 or Option 4.

The architectural call I would push back on hardest is the claim that a base-ref record becomes independently authorized merely by first reaching `main`. Evidence that would change my mind is an enforced ruleset showing that only a named human approver group can land records, together with a required verifier whose code and success status the consuming PR cannot influence and a merge-time test demonstrating that two concurrent consumers cannot overspend the reserve.

**End summary: keep the reserve unshipped; record placement is secondary to protecting the entire authorization, verification, and allocation chain.**

