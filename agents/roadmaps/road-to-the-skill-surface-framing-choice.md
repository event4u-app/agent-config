---
complexity: structural
status: ready
parent_roadmap: road-to-the-activation-census-consequence
---

# Road to the skill-surface framing choice

> **Receiver, and a decision packet.** This file exists so the one `[~]` item
> deferred out of `road-to-the-activation-census-consequence` (step 3.1) has a
> live destination `deferralProblems`
> (`src/agent-src/scripts/archive_completed_roadmaps.ts`) can verify from both
> ends, and so the choice that item was written to surface is stated somewhere a
> reader meets it. Being a deferral destination is a property of the edges, not
> of this file's status — see ADR-262, which deleted the `status: carrier` this
> file used to carry.
>
> **Its own work is done.** Phase 1 is `[x]` and both acceptance criteria are
> met: Option C was recorded on 2026-09-07. What keeps the file open is the
> blocker below, not a status.
>
> **The remaining decision is owner-reserved, and that reservation stands.** It
> changes what the package claims to be for its consumers, which is a public
> commitment under `decision-revisit-gate`'s reserved set — a genuine Class-1
> dimension that ADR-262 does not touch. What ADR-262 changes is only where the
> reservation lives: in a `## Blockers` entry a gate reads, not in a status
> value nothing reads. An AI council dispositioned the
> parent's blocker on 2026-09-06 and its verdict was unanimous DESCOPE — the
> parent closes without the choice, the choice does not close. That verdict is
> about roadmap scope only; it settles nothing about the surface.

## The measurement this decision sits on

Three counts, from `agents/evidence/metrics/skill-activation-census.json` and
reproduced in `agents/evidence/analysis/skill-activation-populations-2026-09-06.md`:

| Population | Count |
|---|---|
| Skills shipped | 299 |
| Declare a machine-matchable trigger key in frontmatter | 12 |
| Carry an `evals/triggers.json` corpus (a test fixture; no host reads it at routing time) | 100 |
| In both of the two above | 2 |
| Reachable only by a human naming them | 189 |

Over 30 sessions and 11,338 assistant turns the census records 0 Skill
invocations and 0 of 299 distinct skills. The reading is one machine's store
and bounds nothing beyond it.

## The options

### Option A — build a host-side activation path for the 12

Commit to a selection mechanism for the skills that declare a machine-matchable
trigger key, name the host it is built against, and measure it.

- **Affects:** 12 skills (2 of them also in the 100).
- **Costs, in surfaces rather than in time:** a host integration this repository
  does not own; a measurement that can distinguish a fired selection from a
  human naming the same skill; and a second census reading over a store taken
  after the mechanism exists.
- **Falsifies the option:** the mechanism ships and a census over a comparable
  store still records 0 invocations of those 12 — which would move the cause
  somewhere the trigger key is not.

### Option B — reframe the remainder as human-named reference material

Declare the 189 reference material by design, and bring `docs/CLAIMS.md` and the
consumer-facing surfaces into line with that.

- **Affects:** 189 skills.
- **Costs, in surfaces rather than in time:** the claims ledger; the four
  surfaces that described skills as topic-matched, already corrected by the
  parent roadmap's 2.3; and any consumer-facing prose that a reader could take
  as a selection promise.
- **Falsifies the option:** a host is shown selecting one of the 189 without a
  human naming it, which would make "reference material by design" a false
  description of what the package ships.

### Option C — record a reason beside the claim

The parent's blocker offers a third: leave the surface as it is and record the
reason next to the census claim in `docs/proof.md`, so the next review round
meets an answer rather than re-deriving the argument. This is a decision about
what to publish, not a decision that anything about the surface is settled.

- **Affects:** the published claim; the 299 are untouched.
- **Falsifies the option:** the recorded reason stops holding — for instance if
  the store the census reads stops being the only one available.

## Phase 1 — the owner chooses

- [x] **1.1 Record the choice.** One of A, B or C, written into `docs/decisions/`
      or beside the claim in `docs/proof.md`.
      verify: `./scripts-run src/scripts/check_claims` passes against the resulting
      text, and `adr_cite_check` on any ADR the choice produces reports a live status.
      Done 2026-09-07 — **Option C**, recorded beside the claim rather than in
      `docs/decisions/`. The reason recorded is appended to the
      `skill-activation-census-zero` entry at `docs/CLAIMS.md:245`, which is the only
      writable route to "beside the claim in `docs/proof.md`": that page is generated
      (`src/scripts/build_proof.ts:13`, "Generated, never hand-maintained") and its
      claim column renders the ledger's `claim:` field, while `non_inference` renders
      nowhere. `docs/proof.md:98` carries the text after `build_proof` re-ran.
      The choice produced **no ADR**, so the `adr_cite_check` half of the verify is
      vacuous by construction rather than skipped.

## Decision, 2026-09-07 — what was recorded and what was NOT

Recorded: **Option C**, in the narrowest form the option describes — the surface is
left as it is and the zero is published with its reason, so a later review meets an
answer instead of re-deriving the argument a fourth time.

Not recorded, and deliberately: **A and B stay open.** Both change what the package
claims to be for its consumers, which is a public commitment and owner-reserved under
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md); an autonomous lane
may not take either. The routing unit there is the transition, not the document, and
the three transitions differ: A commits the package to building and measuring a
host-side mechanism, B reclassifies 189 shipped artifacts in consumer-facing prose,
and C adds a reversible explanatory sentence to an already-published claim while
narrowing neither of the other two. Only the third is inside an agent's authority, and
recording it does not consume the owner's choice — the menu is unchanged.

**C's falsifier, as stated in the option and now in the ledger:** the recorded reason
stops holding the moment the store the census reads stops being the only one available.
A consumer install, a second host, or a CI-visible corpus each ends it, and the choice
returns.

This file remains the live destination the parent's `[~]` step 3.1 and AC-6 carry to,
which `deferralProblems` (`src/agent-src/scripts/archive_completed_roadmaps.ts:414`)
verifies from both ends; archiving it would make that destination dead. That is why it
stays live — not a status, and not a flip anyone is waiting for. The open A/B decision
is filed as `blocker: skill-surface-framing-ab-choice` below, where a gate can read it.

## Acceptance Criteria

- [x] AC-1 — One of the three options is recorded, with the count it affects and its falsifier.
      Option C, recorded 2026-09-07 at `docs/CLAIMS.md:245`. Affected count: the published
      claim only; the 299 are untouched, which is the count Option C names above. Falsifier
      recorded verbatim beside the claim.
- [x] AC-2 — `./scripts-run src/scripts/check_claims` passes against the resulting text.
      Green 2026-09-07: `check_claims: 9 markered claim(s) bound · ledger 99 entries
      (60 backed, 31 unbacked inventory)`, exit 0. `check_skill_activation_claim` also
      re-run and green — the appended prose does not shadow the figure regexes it parses.

## Blockers

### blocker: skill-surface-framing-ab-choice

- **Status:** open
- **Owner:** owner
- **Blocks:** Options A and B; the file stays live as a deferral destination until
  one is taken up or the menu is closed
- **What to do:** choose A (build a host-side activation path for the 12 skills that
  declare a machine-matchable trigger key), B (declare the 189 reference material by
  design and bring `docs/CLAIMS.md` into line), or close the menu. Each option's
  affected count and falsifier are stated above; the measurement they sit on is
  `agents/evidence/metrics/skill-activation-census.json`.
- **Recommendation:** B, and it is a recommendation rather than a decision because
  the transition is yours. The census reads 0 invocations of 0 of 299 skills over
  11,338 turns, and 189 of them declare no machine-matchable trigger at all — so
  "reference material a human names" already describes what ships. A costs a host
  integration this repository does not own and would then have to measure. But B
  reclassifies 189 shipped artifacts in consumer-facing prose, which is exactly the
  public commitment reserved to you.
- **If you do nothing:** Option C holds and is honest, so nothing breaks. What
  accumulates is a gap between what the surface implies and what it does — and C's
  own falsifier ends it without warning the moment a second store exists (a consumer
  install, a second host, or a CI-visible corpus), at which point the menu returns
  with the same three options and one more round of re-derivation behind it.
- **Resolved when:** a decision record exists for A or B, or this blocker is closed
  with the menu withdrawn.

**Why this is genuinely owner-reserved and not a self-imposed gate.** A and B each
change what the package claims to be for its consumers. That is a public commitment —
a named Class-1 dimension in `decision-revisit-gate`'s reserved set
(`src/rules/decision-revisit-gate.md:146`), and one that
[`maintainer-intent-over-repo-rules`](../../src/rules/maintainer-intent-over-repo-rules.md)
explicitly does not lift. C, by contrast, was a reversible explanatory sentence beside
an already-published claim, which is why an agent took it on 2026-09-07 without asking.
The routing unit is the transition, not the document.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The zero is published with a reason and then read as settled | product | Option C records why 0 of 299 skills were invoked over 11,338 turns. A recorded reason next to a claim reads as a resolved question, and the surface question stays open behind it. | The blocker keeps A and B live rather than closed; C's own falsifier is recorded beside the claim and ends the option the moment a second store exists. | Blockers |
| 2 | The census generalises from one machine's store | implementation | The reading is one local transcript store over 30 sessions. It bounds nothing beyond that store, and a consumer install or a second host would be a different population. | The falsifier is stated in the option and in the ledger entry: the reason stops holding the moment the store stops being the only one available. | The measurement this decision sits on |
| 3 | The file is archived because its own checkboxes are complete | implementation | Phase 1 and both ACs are `[x]`. An archival sweep reading progress alone would move it, stranding the parent's `[~]` step 3.1 and AC-6 carries. | `lint_deferral_integrity` reds on a destination archived with the carry unresolved; the open blocker keeps the file out of a completed-roadmap sweep. | Decision, 2026-09-07 — what was recorded and what was NOT |
