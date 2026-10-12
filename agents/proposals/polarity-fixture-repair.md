---
proposal_id: polarity-fixture-repair
type: skill
scope: package
stage: proposed
author: claude/drain-self-modification-20261012
created: 2026-10-12
last_updated: 2026-10-12
changed_files:
  - src/skills/testing-anti-patterns/SKILL.md
ratification_record: agents/evidence/ratifications/drain-self-modification-20261012.md
---

# Proposal: a negative fixture is a claim about a boundary

The worked example step 6.2 of
`road-to-self-modification-that-a-council-must-pass` asks for, and the
criterion an archived roadmap left open: *"one real learning from this repo's
own history is walked through the pipeline as a worked example."*

## 1. Learning

Widening a gate's path set makes its **negative** fixtures go red, and the red
is correct. A test that names a specific path as *out of scope* is asserting
where a boundary ends; when the boundary moves, that assertion has expired —
it has not become wrong about testing, it has become wrong about the world.

The cheap repair is to delete the two failing cases, and it is the wrong one.
A gate with only positive fixtures passes its own suite while reaching too far,
because nothing left in the suite tests the direction over-reach travels in.
The right repair is to move the example to a path that is genuinely still out
of scope, and to record in the test why the old one stopped qualifying.

## 2. Classification

- **Type:** skill — an 8th Iron Law plus one Gotcha in `testing-anti-patterns`.
- **Scope:** package. It is a lesson about how this suite's own gates are
  tested, and it generalises to any consumer who gates on a path set.
- **Why not a rule:** it fires only while writing or repairing tests, which is
  exactly the surface `testing-anti-patterns` already owns. A rule would be
  always-loaded for an obligation that applies on one kind of edit.
- **Nearest existing law:** law 7, *never game the green*. Law 8 is its other
  half and needs its own line, because deleting an expired fixture does not
  look like gaming the green: the fixture really is wrong, and the deletion
  really is the smallest diff.

## 3. Evidence

```yaml
evidence:
  - kind: test-run
    ref: https://github.com/event4u-app/agent-config/blob/main/tests/scripts/ratification_subject.test.ts
    summary: >
      Two cases named docs/contracts/ratification-artifact.md as the ungated
      example. Step 4.1 of the self-modification roadmap put that file on the
      gate's reviewer list on 2026-10-12 and both cases failed. Repaired by
      moving the example to docs/architecture.md with a comment saying the
      claim expired; the assertions were kept.
  - kind: skill
    ref: https://gitlab.com/event4u/agent-config/-/blob/main/src/skills/testing-anti-patterns/SKILL.md
    summary: >
      The skill already carries the positive half of the discipline — law 6 on
      overfit assertions and law 7 on gaming the green — and carried nothing
      about a fixture whose claim has expired, which is why the instance above
      had no law to cite while it was being repaired.
```

## 4. Proposed artefact

In `src/skills/testing-anti-patterns/SKILL.md`:

- **Iron Law 8** — *never repair a polarity fixture by dropping its claim; a
  test naming a path as OUT of scope asserts where a boundary ends; when the
  boundary moves, move the example and say why, never delete the assertion* —
  followed by the two sentences that explain why it is not a restatement of
  law 7.
- One **Gotcha** entry carrying the dated instance, so the law has a measured
  case behind it rather than an assertion.

## 5. Quality gate expectations

`skill_linter.ts` passes on the edited skill (run: 1 pass, 0 warn, 0 fail), the
file stays inside its size budget, and `task sync` re-emits the projection
byte-identically. No new gate script, so the gate-script count is unchanged.

## 6. Replacement justification

Nothing is replaced. Laws 1 to 7 and every existing Gotcha stay as they are;
this is an addition whose nearest neighbour (law 7) is explicitly distinguished
rather than absorbed.

## 7. Success signal

- Metric: polarity fixtures deleted rather than re-pointed when a gate's path
  set widens, counted per quarter over the gate suites under `tests/scripts/`
- Baseline: 1 (the 2026-10-12 instance, caught by a human reading the red)
- Target: 0
- Evaluation date: 2027-04-12

## 8. Risks and alternatives rejected

- **Risk: an 8th law dilutes a list that is read as a unit.** Accepted. The
  alternative — folding it into law 7 — was rejected because the two failures
  look nothing alike at the moment of the edit, and a law nobody recognises
  themselves in does not fire.
- **Alternative rejected: a lint that detects deleted negative fixtures.** A
  deletion is indistinguishable from a legitimate removal without knowing why
  the case existed, and a gate that guesses at intent produces exactly the
  false positives that get it disabled.
- **Alternative rejected: making it a rule.** Always-loaded cost for an
  obligation that applies while editing tests.

## 9. Gate verdict

Reviewed as part of the modification review recorded in
`agents/evidence/ratifications/drain-self-modification-20261012.md`, which
covers the gated content of the change this proposal ships in and carries the
`subject` digest of that content.

**Why this proposal stops at `stage: proposed` and not at `gated`.** Since the
owner's amendment of 2026-10-07 (ADR-281) a council verdict is the **review**
and the owner's authorization is the **approval**, and `proposal:check` now
requires a package-scoped `gated` proposal to name an `owner_authorization:`
bound to the same digest. That authorization does not exist: ADR-281 § 5 makes
the owner's route his own recorded act on the forge, and the hold that must
precede the first authority-expanding merge to this surface is an open,
owner-owned blocker. Writing `stage: gated` here would be an agent asserting
the owner's approval, which is the single thing ADR-268 § 4 forbids. The lane
is walked as far as it reaches, and it stops where it genuinely stops.

## 10. Upstream PR

Pending. The change ships in the same pull request as the steps that produced
the learning, which is why there is no separate upstream branch for it.
