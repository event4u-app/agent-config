---
complexity: structural
---

# Roadmap: Plan-gate fence grammar — close the live fail-open, make dispositions machine-checkable

> Two open items the plan-governance work left on `main`, both carried here
> because they were otherwise recorded only in a review artefact and two code
> comments: **(F)** a confirmed `critical` fail-open in the R2 findings parser —
> an `open` finding can be hidden from the gate — and **(D)** the absence of any
> machine-checkable link between an archived round's `open` rows and the terminal
> disposition recorded elsewhere. F is a live defect; D is why F's own
> bookkeeping drifted unnoticed for a day.

## Prerequisites

- [ ] Read `docs/contracts/plan-review-gates.md` § 2.2 (fence rule + the
      `KNOWN HOLE` note) and § 2.7 (superseded-round convention)
- [ ] Read `agents/evidence/reviews/postmerge-blindpass-review.md` — findings
      1, 2, 4 are the F items; its `### Correction` section is the D case study
- [ ] Read the `KNOWN HOLE` characterization block in
      `tests/scripts/check_completion_review.test.ts` — it pins current behaviour
      and states what to do when it starts failing

## Context

- **F — the fail-open, reproduced.** A labelled fence opener is closed by the
  first later **bare** fence anywhere in the artefact, including one the author
  never meant as its closer. Lines between them are skipped, so a live
  `| … | open | |` row disappears from the parsed rows; because the opener was
  consumed, `strays` stays empty and no `unbalanced-fence` fires; an earlier
  well-formed row keeps the neither-table-nor-honest-null fallback quiet. The
  gate exits 0 on an unreviewed finding. The triggering arrangement is the one
  `markdown-safe-codeblocks` itself prescribes (`~~~` outer wrapping ```` ``` ````
  inner), and the remediation string the validator prints for
  `unbalanced-fence` leads an author into it.
- **Why it was not patched on discovery.** The obvious guard — "a
  findings-shaped row inside a fenced region is a violation" — fires on every
  artefact that legitimately quotes the six-column template, **including the
  skeleton `dispatch_r2_reviewer` generates**, which ships an example row whose
  Status is literally `open`. A guard that reds every future artefact would
  repeat the failure class the plan-governance work exists to remove.
- **Three prior attempts all failed open**, which is why this is a grammar
  decision and not a fourth arithmetic patch: a single `inFence` toggle made
  everything after an odd fence count invisible; positional pairing detected
  parity but mis-paired; the current labelled-opener rule is defeated by a stray
  bare fence.
- **D — dispositions are not reconcilable.** Archived rounds are a frozen audit
  trail (§ 2.7) and must not be edited in place, so their `open` rows stay
  `open` while the terminal status lives in a closure commit or a follow-up
  roadmap. The advisory bot parses the artefacts, sees the `open` rows, and
  reports a contradiction that is not one. Round records also carry **no stable
  identifiers** — rows are numbered per round, so `round3 #5` and `round4 #5`
  collide, and any index must key on a composite or on real `R-NNN` ids (the
  still-open advisory finding on stable ids called this out first).
- **Direction for F was routed to the AI council** (2026-08-04) rather than
  chosen unilaterally: candidate A = explicitly declared illustrative regions;
  candidate B = move the safety property off fence pairing entirely (a row is
  live unless explicitly neutralised). The convergence lands in Phase 1.

## Non-goals

- No change to the R2 advisory posture: Stage A stays `--advisory` until its
  window closes on its own terms. This roadmap fixes correctness, not rollout.
- No in-place edits to archived round records. They are the audit trail whose
  immutability is the only detection floor § 5 has.
- No retro-application to artefacts already merged — migration is explicit
  (Phase 1 Step 3), never silent.

## Council verdict (2026-08-04)

Deep-tier run, members anthropic/claude-sonnet-4-5 + openai/gpt-4o. **Convergent
on Candidate B — the safety property moves into the data model and out of
presentation parsing.** The three fence failures are read as symptoms of one
mistake: treating markdown layout as a security boundary.

**Accepted, with the load-bearing refinement:** rows are **live by default**; an
illustrative row must be **explicitly marked**. This inverts the current default
and is what makes it fail-closed — forgetting a marker blocks, it never passes.

**Explicitly rejected — the pure structured-data-block variant** (findings move
into a ```` ```findings-table ```` block, everything outside is ignored). One
member killed it on a false-*negative*: an author who forgets the wrapper leaves
a `| … | open | |` row sitting in prose, and the gate passes while the author
believes a blocker was filed. "Manual review will notice" is the assumption that
created the need for the gate. Structured data stays a long-term option to
evaluate, not this change.

**Also rejected:** blocking on a malformed table *inside* a declared block — an
author adding a row would be blocked by someone else's older formatting glitch,
with no indication which row or what the parser wanted. That is the confusing-
block category the FP budget exists to prevent.

**Migration:** version-marker based. The header already carries
`completion-review: v1`, so `v2` is the discriminator; a transitional window
accepts both and emits a deprecation warning for old-style illustrative content.
Frozen records are never edited to comply.

**What this sacrifices:** every existing illustrative row must be marked, the
dispatcher's skeleton included; markdown authors gain one more piece of syntax to
remember. Accepted because the alternative keeps a security property in a text
layer that has now failed open four times.

## Phase 1: Decide the grammar

- [x] **Step 1:** Read the council convergence and record the verdict in this
      roadmap (accept / accept-with-modification / reject per finding), naming
      what the chosen direction sacrifices.
      <!-- executed 2026-08-04 — verdict recorded above: Candidate B, rows live by default, explicit illustrative marker, v2 header discriminator; pure data-block and malformed-in-block blocking both rejected with the reason. -->

- [ ] **Step 2:** Write the chosen rule into `docs/contracts/plan-review-gates.md`
      § 2.2 as a deterministic parser contract, covering explicitly: an
      undeclared labelled fence, an unterminated fence, nested fences
      (```` ```` ```` wrapping ```` ``` ````), and a findings-shaped row whose
      Status is an unknown token.
- [ ] **Step 3:** Decide and document migration for artefacts authored under the
      old grammar — the header already carries `completion-review: v1`, so a
      `v2` marker is available as the discriminator. Grandfathering must not
      require editing a frozen record.
- [ ] **Step 4:** Remove the `KNOWN HOLE` notes (contract § 2.2 and the
      `scanFences` JSDoc) in the same change that removes the hole — never
      before.

## Phase 2: Implement and prove it

- [ ] **Step 1:** Implement the rule in `check_completion_review.ts`.
- [ ] **Step 2:** Replace the `KNOWN HOLE` characterization block in
      `tests/scripts/check_completion_review.test.ts` with the positive
      assertion: the reproduction artefact (earlier terminal row, labelled
      opener, live `open` row, later bare fence) now yields a blocking
      violation. Deleting the block without that replacement is not allowed.
- [ ] **Step 3:** Update `dispatch_r2_reviewer.ts` so its generated skeleton is
      valid under the new grammar — the skeleton is the highest-traffic artefact
      and a grammar that reds it is wrong by construction.
- [ ] **Step 4:** Fix the `unbalanced-fence` remediation string so it cannot
      describe the arrangement that produced finding 1.
- [ ] **Step 5:** Verify: the four fail-open shapes from the § 2.2 history
      (odd-count toggle, mis-paired positional, stray-closed labelled opener,
      and the new grammar's own nearest miss) each have a fixture that blocks.

## Phase 3: Disposition index with stable ids

- [ ] **Step 1:** Choose the identifier scheme — composite `round<N>#<M>` or
      real `R-NNN` ids minted per finding — and state why the other was rejected.
      Rows are currently numbered per round and collide across rounds.
- [ ] **Step 2:** Define the index artefact in the contract: one tracked file
      keyed by finding id, carrying the terminal status plus its reference
      (commit sha, reason, or carrier), and the rule that every `open` row in an
      archived round MUST have an index entry.
- [ ] **Step 3:** Implement the reconciliation in `check_completion_review.ts`:
      an archived round's `open` row without a terminal index entry is a
      violation; an index entry for an id no round contains is also a violation
      (both directions, or the index rots).
- [ ] **Step 4:** Backfill the index for the existing rounds 1–8 plus the
      post-merge blind pass, from the closure commits already on `main`.
- [ ] **Step 5:** Exempt archived rounds from the § 2.4 status-completeness rule
      *only* where the index covers them, so "all terminal" becomes machine-
      checkable instead of PR prose.
- [ ] **Step 6:** Verify with fixtures: missing entry blocks, orphan entry
      blocks, complete index passes, and the advisory bot's contradiction on
      rounds 6/7/8 no longer reproduces.

## Phase 4: Projections + docs

- [ ] **Step 1:** `task sync` — regenerate `dist/agent-src/`.
- [ ] **Step 2:** `task generate-tools` for any touched command/skill surface.
- [ ] **Step 3:** Register any new validator entry point in
      `src/config/gate-coverage.yml` with a real `min_scanned` floor, or state
      why the existing entry covers it.

## Acceptance Criteria

- [ ] The reproduction artefact from the blind pass (earlier terminal row,
      labelled opener, live `open` row, later bare fence) produces a **blocking**
      violation; the characterization test is replaced by that positive
      assertion, not deleted.
- [ ] The dispatcher's generated skeleton passes the new grammar unchanged by a
      human.
- [ ] Every fail-open shape in the § 2.2 history has a fixture that blocks.
- [ ] Both `KNOWN HOLE` notes are gone, removed in the same change as the hole.
- [ ] Migration is explicit: an artefact authored under the old grammar either
      passes by a documented discriminator or is named as requiring re-issue —
      never silently red, never silently green, never edited in place.
- [ ] An archived round's `open` row without a terminal index entry blocks; an
      orphan index entry blocks; rounds 1–8 plus the blind pass are backfilled
      and pass.
- [ ] `check_completion_review` still emits `scanned: <N>` on every exit path
      including exit 2, and the exit-code contract of § 6 is unchanged.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Fourth fail-open | implementation | A new grammar introduces its own hiding arrangement, as each of the three previous attempts did | Every historical fail-open shape gets a blocking fixture, plus a fixture for the new grammar's nearest miss | Phase 2 Step 5 |
| 2 | Guard reds every artefact | product | The safety rule fires on legitimate template quoting, starting with the dispatcher's own skeleton | The skeleton is a first-class acceptance criterion, updated in the same change as the grammar | Phase 2 Step 3, Phase 1 Step 2 |
| 3 | Frozen audit trail edited | implementation | Migration or backfill rewrites archived rounds in place, destroying the only detection floor § 5 has | Non-goal stated; migration keyed on a header version marker, backfill writes only the new index file | Phase 1 Step 3, Phase 3 Step 4 |
| 4 | Index rots | implementation | The index drifts from the rounds it indexes and silently stops covering them | Reconciliation blocks in BOTH directions — missing entry and orphan entry | Phase 3 Step 3, Phase 3 Step 6 |
| 5 | Hole outlives its note | product | The `KNOWN HOLE` notes are removed for tidiness before the hole is closed, or survive after | Removal is tied to the same change as the fix, and the characterization test fails loudly when behaviour changes | Phase 1 Step 4, Phase 2 Step 2 |
| 6 | Id scheme churn | implementation | Stable ids are chosen without covering the cross-round collision, forcing a second renumbering | Scheme choice is an explicit step that must state why the alternative was rejected | Phase 3 Step 1 |

## Notes

- Full-pipeline CI stays off locally (`quality.local_auto_run: false`); the
  targeted probes named in the steps run, remote CI on the PR is the gate.
- Phase 3 was scoped as its own PR when the work was agreed; Phases 1–2 (the
  live `critical`) may ship first and independently.
