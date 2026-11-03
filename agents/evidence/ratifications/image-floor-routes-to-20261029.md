---
proposed_by: the repository owner, answer OQ-42 (a) in session on 2026-10-29
implemented_by: claude-opus-5.5 session on feat/oq-42-image-floor-grant
reviewed_by: ai-council
subject: e2ddae32ca4e2354dd06eeab28b62fed083f51b96d252f8dd87ccd42ad85a43b
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

image-likeness-and-rights routes_to its six image skills, so hosts that ship every skill also ship the rights check those skills invoke; the 43-token preamble cost is an owner grant

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/image-floor-routes-to-ratification-r3-20261029.question.md`, committed at `f615794bdb712c2a8670571b354d4c61f6060388` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
Matze, examining this as an independent reviewer for round 3.

## Defect scan

**Skill names**: The six entries (`image-generation`, `image-editing`, `image-provider-routing`, `logo-generation`, `brand-asset-generation`, `prompt-engineering-image`) are verified bidirectionally by the test — it scans `SKILL.md` files for `'image-likeness-and-rights'` mentions, then asserts that set exactly matches what `guardedSkills()` parses from `routes_to`. A misspelled skill or missing reference fails the test. The existing test "names only skills that exist" confirms each skill directory exists.

**Frontmatter shape**: YAML flow syntax `[skill:a, skill:b, ...]` is spec-compliant and parses to an array. Standard YAML parsers accept it.

**Grant ledger**:
- `granted_tokens: 43` matches the stated flow-list savings (+43 vs +57 block-list)
- `watermark: 135824` yields ceiling 135,867 per the formula
- Expiry 2027-01-27 is 90 days from approval 2026-10-29
- References `OQ-42` evidence file for owner approval
- Approval event tied to independent review on this PR

Numbers are internally consistent.

**Test quality**: Three assertions — (1) rule ships with `NO_PACKS`, (2) at least one skill references it, (3) `routes_to` exactly matches the set of skills whose `SKILL.md` contains the rule name. This test CAN fail if any invariant breaks. One weakness: text search (`includes('image-likeness-and-rights')`) could match a comment mention rather than an invocation, but the bidirectional structure (routes_to → skills, skills → routes_to) makes accidental mismatch unlikely and deliberate mismatch visible in code review.

**No blocking defect found in the diff.**

## Authority / gate analysis

**Rule body**: Unchanged — same prohibitions, same `consequence_class: irreversible-external`.

**Effect**: Before this change, hosts shipping all skills with no packs active (claude-code, codex) got six skills that invoke the rights check without the check itself. After, the floor routes with the skills. This **closes a gap** — a conservative direction for an irreversible-external rule.

**Grant relaxation**: The grant does relax a token budget constraint, but that constraint governs preamble size, not agent authority. The grant has expiry (90 days) and repayment tracking. This is procedural overhead, not a weakening of the rights floor.

**Blast radius**: The change affects rule *routing*, not rule *content*. No new powers granted; existing gate strengthened by broader delivery.

## Skeptic's lens

**Weakest assumption**: That text-search alignment (`includes('image-likeness-and-rights')`) accurately represents invocation dependency. A skill could mention the rule in a comment without invoking it. However, to pass the test, someone would have to add both the mention AND the `routes_to` entry — visible in code review.

**Most-likely-overlooked failure mode**: **Grant expiry enforcement.** The ledger says "the base is PINNED to the watermark while a grant is live" to prevent the 43-token growth becoming permanent. What happens on 2027-01-27 if repayment hasn't occurred? Does CI reject merges? The diff documents the contract but doesn't show enforcement code. This is the likeliest path to the exceptional tokens outliving their justification.

Second risk: **token count verification.** The diff claims +43 tokens but doesn't show measured before/after preamble sizes. Independent verification of the token count would confirm the grant amount is accurate.

---

## Response to prior round critiques

### Agreement with Reviewer A (round 1):
- Defect scan is thorough and correct — I concur on all findings
- Grant expiry enforcement as key procedural risk — correct, and still the highest-leverage gap
- Update path question (do existing installs pick up the rule?) — valid but outside this diff's scope
- Stance (ratified | high | no) — appropriate

### Agreement with Reviewer B (round 1):
- No blocking defect — correct
- Installation-level test suggestion (verify a NO_PACKS host with all skills actually gets the rule in final output) — **strongest improvement proposed**, more valuable than verifying YAML parser support (which is guaranteed by spec)
- Grant relaxes a budget constraint separate from gate logic — precise distinction
- Stance (confirmed-non-expanding | med | no) — reasonable, though I'd rate confidence high given the test coverage

### Disagreement:
None substantive. Reviewer B's "med confidence" appears driven by not independently measuring the token count or verifying installer behavior — both outside the diff itself. Given what's *in* the diff, the assertions hold.

### New points not raised in round 1:
1. **Dense flow list readability**: Six skills on one line could slip past a tired reviewer, but the test provides mechanical verification — human review confirms *intent*, test confirms *correctness*. Not a defect, but worth noting.

2. **Grant approval event is self-referential**: The grant's `approval_event` is "an approving review...on the pull request that adds this entry." The ledger honoring the grant is contingent on this review approving it — a correct bootstrap, but the grant is not "active" until this PR merges with approval. Not a defect, but the grant's existence in the diff doesn't mean it's in effect yet.

---

**STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no**

The diff is correct, non-expanding, and closes a safety gap. The tests have teeth. The grant machinery is properly documented with expiry tracking. Highest-leverage pre-merge action: add an installation-level test proving a NO_PACKS host configured with all six skills actually receives `image-likeness-and-rights.md` in its installed rule set (as Reviewer B recommended) — this verifies the end-to-end path, not just the selection logic.
```

### openai — `confirmed-non-expanding`

```text
No blocking defect is evident in the supplied diff. My confidence is medium because I have not verified the installer, grant enforcement, token measurement, or subject digest.

- **Agree with Reviewer B:** both rule projections add the same six distinct routes using valid YAML flow-list syntax (`routes_to`, rule line 22). Actual installer compatibility still depends on its parser.
- **Agree with both reviewers:** the added test can fail. It detects exclusion of the floor and mismatches between routes and skills mentioning it. The existing “names only skills that exist” assertion checks route targets.
- **Disagree with Reviewer A’s numerical certainty:** `granted_tokens: 43` and `watermark: 135824` are declarations, not measurement evidence. Their sum is **135,867**, but the diff cannot establish that the increase actually costs 43 tokens.
- **Agree with Reviewer B’s gate distinction:** broader delivery does not visibly expand image authority or change the rights checks. The grant does relax a separate payload constraint; describing the entire PR as changing no gate would be inaccurate.

Two refinements matter:

1. **Coverage limitation — nonblocking:** the new test checks rule selection through `excludedRuleBasenames`, not final host output. A no-pack installation regression test should establish that a host shipping the invoking skills actually receives the floor.
2. **Review scope limitation:** the stated subject digest covers the two rule files, while the grant is a separate changed file. Ratifying that subject must not silently count as verifying the grant’s measurement, owner authorization, or independent-approval enforcement.

The substring dependency scan is adequate for the stated “skills that name the rule” contract, though it cannot distinguish an operative instruction from an incidental mention. No injection, secret exposure, authorization defect, or unnecessary abstraction is visible. Routing, its payload allowance, and regression coverage are sufficiently related to ship together.

**APPROVE** — the supplied diff is a narrow delivery fix with meaningful assertions; the highest-leverage pre-merge change is an installation-level regression test proving the floor reaches a no-pack host that ships these skills.

STANCE: confirmed-non-expanding | CONFIDENCE: med | DEALBREAKER: no
```
