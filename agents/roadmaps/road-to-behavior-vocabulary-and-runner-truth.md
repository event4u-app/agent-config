---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Nothing in the active estate can be archived to pay for this one, and the two neighbours that look like payers are not. The stub it extends holds a stack-and-rig decision that is still owner-reserved, so archiving it would delete that decision rather than settle it; the sibling stub on proposal adoptability holds a different owner-reserved decision and would take the same loss. What is here is the residue neither holds: three places where this tree states one thing and does another, each re-verified at 20bfb1f53 and each fixable without settling either owner-reserved decision."
relates:
  - slug: road-to-executable-specification-adapter
    relation: extends
    note: >
      That stub holds the stack-specific and rig-shaped half behind an
      owner-gated promotion condition. This takes only the detection and
      vocabulary residue, which needs no runner chosen and no dependency pushed
      into a consumer repository.
  - slug: road-to-a-proposal-that-can-be-adopted
    relation: disjoint
    note: >
      That stub asks what makes a prepared proposal adoptable at all. This
      roadmap deliberately carries none of the proposal's architecture, only the
      tree facts that were independently re-verified here.
  - slug: road-to-trigger-eval-freshness-has-no-writer
    relation: disjoint
    note: >
      That roadmap owns whether a trigger suite's freshness is evidenced. This
      one adds rows to a suite; neither waits on the other.
---

# Road to behavior vocabulary and runner truth

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t02/` — an externally prepared
> proposal set (four plan revisions plus the chat that commissioned them),
> delivered as finished roadmaps. Its architecture is not adopted here; only the
> defects it named that were independently re-verified against this tree are.

## Goal

Three surfaces in this tree assert a capability they do not have, and each
assertion is falsifiable in one command. A prompt written in behaviour-driven
vocabulary reaches no skill; two commands describe themselves as stack-adaptive
while loading one stack's skill unconditionally; and the toolchain resolver's
runner vocabulary omits three native runners and every behaviour-driven runner,
so a repository that has one is indistinguishable from one that has none. When
this roadmap closes, each of the three either does what it says or says what it
does — and no new skill, verb, dependency or contract format has been added to
get there.

## Context — three measured facts, re-verified at `20bfb1f53` (2026-09-28)

1. **Behaviour vocabulary routes nowhere.**
   `grep -rliE 'gherkin|bdd|cucumber|behat' src/skills/*/evals/*.json` returns
   **0** files across the 101 skills that carry a trigger suite. The tree does
   own the decision this vocabulary should reach — `Does this change owe an
   executable behavior contract?` at `src/skills/test-case-discovery/SKILL.md:40`
   with its anti-script rule at `:98–116` — so the gap is routing, not knowledge.
2. **Two commands' frontmatter contradicts their own body.**
   `src/domains/engineering-base/tests/create/command.md:8` binds
   `skills: [test-case-discovery, pest-testing, quality-tools]` and `:9` describes
   the command as `stack-adaptive (pest / phpunit / vitest / jest / pytest / …)`;
   `tests/execute/command.md:8` binds `[pest-testing, quality-tools]` with the
   same description. Both bodies already resolve correctly — `create/command.md:25`
   and `execute/command.md:26` route through the toolchain resolver and
   `create:26` says "never a hard-coded one". The defect is therefore narrower
   than the source claimed: the instructions are right and the static binding is
   wrong. `ls src/skills | grep -iE 'jest|vitest|pytest|rspec|junit'` is empty, so
   there is no per-stack skill to bind instead — the binding has to become
   resolver-driven or drop to the neutral pair.
3. **The resolver's runner vocabulary is short by three natives and all
   behaviour-driven runners.** `KNOWN_RUNNERS` at
   `src/agent-src/templates/scripts/work_engine/stack/runner.ts:46–56` holds nine
   labels — pest, phpunit, vitest, jest, playwright, cypress, pytest, go-test,
   cargo-test. No rspec, no junit, no dotnet-test, and no behaviour-driven runner
   of any ecosystem. The resolver is already list-shaped and carries `ecosystem`,
   `confidence`, `basis` and speed per runner (`runner.ts:103–123`), and the
   frontend detector already has a refusal vocabulary for a genuine conflict
   (`detect.ts:48–56`, two mutually exclusive workspaces produce `unknown` plus
   both names). So the seam exists; only the labels and one second axis are missing.

## Phase 1 — Make behaviour vocabulary reach the decision that already exists

- [ ] **1.1 Add behaviour-driven trigger rows to `test-case-discovery`'s suite.**
      `src/skills/test-case-discovery/evals/triggers.json` is 52 lines and 10
      queries, none of which use the vocabulary a person asking for this actually
      types. Add at least 8 should-trigger rows spanning EN and DE phrasings, and
      at least 4 should-not-trigger near-misses: a refactor with no behaviour
      change, "one scenario per unit case", a selector-and-click step script, and
      "install a behaviour runner we do not have". The near-misses matter more
      than the positives — the discriminator's four no-cases at `SKILL.md:40` are
      what they protect.
      verify: `./scripts-run src/scripts/description_route_check` green; the
      grep in Fact 1 returns ≥ 1 file where it returned 0.
- [ ] **1.2 State in the skill which vocabulary it answers to.**
      One sentence in `test-case-discovery/SKILL.md` naming the terms the new
      rows route on, so a later reader can tell an intentional trigger from a
      lucky keyword. No new section, no new skill — the word count is 1,842 and
      ADR-225's tripwire is 3,000, and this roadmap is not the change that should
      spend that headroom.
      verify: `wc -w src/skills/test-case-discovery/SKILL.md` ≤ 1,900.
- [~] **1.3 Register the canonical spellings.** Deferred behind the blocker
      below: `lint_canonical_terms` ratchets, so adding terms is a maintainer
      decision and not an execution step.

## Phase 2 — Make the two commands' frontmatter match their own instructions

- [ ] **2.1 Resolve the `skills:` binding against the toolchain, or drop it.**
      Either the binding becomes resolver-driven, or `pest-testing` leaves the
      static list and the body's existing resolver step is the only stack
      authority. Pick one and say which in the command, because the present state
      is that a React-only repository loads PHP testing guidance before reading
      the instruction telling it not to.
      verify: `grep -n 'skills:' src/domains/engineering-base/tests/{create,execute}/command.md`
      shows no unconditional single-stack skill, or the description no longer
      claims stack-adaptive.
- [ ] **2.2 Re-check the three other places that repeat the claim.**
      `src/domains/engineering-base/tests/command.md:32–33` and
      `src/domains/meta/README.md:151,154` carry the same wording and are
      generated or hand-maintained copies; whichever resolution 2.1 picks has to
      reach them in the same change.
      verify: `grep -rn 'stack-adaptive' src/ | wc -l` matches the count the
      change intends, and `task sync` leaves the tree clean.

## Phase 3 — Give the resolver the labels and the second axis it is missing

- [ ] **3.1 Add the three missing native runner labels.**
      `rspec`, `junit`, `dotnet-test` into `KNOWN_RUNNERS`, each with a
      presence fixture and an absence fixture, because the set is the single
      source of truth the state schema and tests validate against
      (`runner.ts:40–45`).
      verify: the resolver's own test file asserts each new label on its
      presence fixture and asserts its absence on a repository without it.
- [ ] **3.2 Add a behaviour-runner axis, scoped and list-shaped — not a scalar.**
      The axis mirrors the existing per-runner record: ecosystem, runner,
      command, scope root, confidence, basis. A scalar is wrong here for the
      reason the existing resolver is already a list: one repository can carry a
      behaviour runner in one workspace and native tests in another, and a
      repository-wide answer erases which. Two behaviour runners in one scope
      resolve to a refusal naming both, exactly as `detect.ts:48–56` refuses
      between conflicted workspaces.
      verify: a monorepo fixture with a behaviour runner in one package and none
      in another returns two scoped rows, not one; a conflict fixture returns the
      refusal with both names.
- [ ] **3.3 Record detection only — never adoption.**
      No table row, no output line and no skill may recommend installing a
      behaviour runner. Detection answers what a repository has; choosing one is
      the owner-gated question the related stub holds.
      verify: `grep -rniE 'composer require|npm i |pip install|gem install' `
      over every file this phase touches returns nothing.

### blocker: canonical-behaviour-wording-ratchet

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 1.3
- **What to do:** pick exactly one — (a) register `behavior contract` and
  `acceptance scenario` in `src/config/canonical-terms.yml` now, accepting that
  `lint_canonical_terms` ratchets and every later variant spelling becomes a
  build failure; or (b) leave the terms unregistered for this roadmap and let
  Phase 1 route on the vocabulary without pinning its spelling, revisiting once a
  second surface uses the terms.
- **Resolved when:** `grep -n 'behavior contract' src/config/canonical-terms.yml`
  returns a line, or this blocker carries a dated note recording choice (b).
- **Recommendation:** (b). Phase 1 needs the routing, not the spelling, and one
  skill is not yet the two consumers that make a ratcheted term worth its cost.
- **If you do nothing:** step 1.3 stays deferred and Phases 1–3 close without it;
  the risk is a second surface later spelling the terms differently, which is
  cheap to fix while there is one consumer and expensive once there are several.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The trigger rows make the vocabulary route to a skill that then has nothing to say | product | Phase 1 routes behaviour-driven prompts to a discriminator that decides whether a contract is owed, but the tree still has no guidance on how to write one well. A person who gets routed and then gets nothing is worse off than one who was never routed | 1.2 states which vocabulary the skill answers to, which bounds the promise to the decision the skill actually makes; the formulation half stays with the related stub rather than being half-built here | Phase 1 — Make behaviour vocabulary reach the decision that already exists |
| 2 | The second resolver axis grows into the adapter the stub is holding back | implementation | Detection and adoption sit one commit apart: once a repository's behaviour runner is a known label, wiring a step-definition path looks like the obvious next line | 3.3 makes recommend-an-install a verifiable failure, and the axis records scope and basis only — it emits no command a consumer must adopt | Phase 3 — Give the resolver the labels and the second axis it is missing |
| 3 | 2.1 is resolved by editing the description instead of the binding | implementation | Deleting the words "stack-adaptive" makes the contradiction disappear without making any repository better served, and it is the one-line fix | 2.1 names both resolutions explicitly so whichever lands is a recorded choice; 2.2 forces the same choice through three further copies, which makes the cheap edit visible as a decision | Phase 2 — Make the two commands' frontmatter match their own instructions |

## Acceptance Criteria

- [ ] AC-1 — `grep -rliE 'gherkin|bdd|cucumber|behat' src/skills/*/evals/*.json`
      returns at least one file, and `description_route_check` is green.
- [ ] AC-2 — No command in `src/` describes itself as stack-adaptive while its
      frontmatter binds a single stack's skill unconditionally.
- [ ] AC-3 — `KNOWN_RUNNERS` contains `rspec`, `junit` and `dotnet-test`, each
      asserted by a presence fixture and an absence fixture.
- [ ] AC-4 — The behaviour-runner axis returns per-scope rows; a monorepo fixture
      returns more than one row and a conflict fixture returns a refusal naming
      both runners.
- [ ] AC-5 — No file this roadmap touches recommends installing a dependency, and
      `src/skills` gains no new skill.
- [ ] AC-6 — The blocker above is resolved or carries a dated note recording
      option (b); step 1.3 is not silently closed.
