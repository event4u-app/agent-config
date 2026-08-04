---
complexity: structural
---

# Roadmap: Plan-gate fence grammar — close the live fail-open, make archived dispositions machine-checked

> Two open items the plan-governance work left on `main`, both carried here
> because they were otherwise recorded only in a review artefact and two code
> comments: **(F)** a confirmed `critical` fail-open in the R2 findings parser —
> an `open` finding can be hidden from the gate — and **(D)** the fact that **no validator reads
> archived round records at all** — they sit outside the `*.findings.md` glob, so
> a finding recorded `open` after being fixed is caught by nothing. F is a live
> defect; D is why F's own bookkeeping drifted unnoticed for a day.

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
- **D — archived round records are read by nothing.** They sit outside the
  `*.findings.md` glob (§ 2.7), so the validator never selects them, and R2 runs
  `--advisory` during Stage A. A row left `open` after its finding was fixed is
  therefore caught by no layer — which is exactly what happened to the blind-pass
  artefact for a day (see its `### Correction`).

  **The originally-assumed cause was measured and refuted.** The plan assumed
  archived rounds *carry* `open` rows whose terminal disposition lives elsewhere
  (a closure commit, a follow-up roadmap), and that reconciling them needed a
  stable-id index because rows are numbered per round and `round3 #5` collides
  with `round4 #5`. Measured across every review artefact on `main`: **zero open
  rows.** Rounds 6, 7 and 8 are terminal *in place*, each `deferred` row naming
  `road-to-plan-gates-measurement.md` with a real reason. So the collision
  problem is real but not yet load-bearing, and the index it would justify is not
  built — see the Phase 3 decision.
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

## Phase 2: Pin the IS-behaviour FIRST, then migrate

> **Sequencing requirement (maintainer, 2026-08-04) — not negotiable.** This
> change touches the exact code that has shipped four fail-opens in a row, so the
> fixtures and the characterization assertions land **before** the row-grammar
> edit, in an earlier commit. Pinning first makes the behaviour change visible as
> a test diff instead of invisible; a grammar edit that arrives before its
> fixtures proves nothing about what it changed. The original ordering here had
> Step 1 implementing the rule and Step 5 adding fixtures — that is the inversion
> this section corrects.

- [ ] **Step 1 (pin — its own commit, no production edit):** Extend the fixture
      set to cover **every** fail-open shape in the § 2.2 history, each asserting
      CURRENT behaviour so the suite is green before anything migrates:
      the odd-count `inFence` toggle, the mis-paired positional pairing, the
      stray-closed labelled opener (the live reproduction), and the nearest miss
      of the incoming grammar. Alongside them, a non-regression fixture per
      legitimate shape that must KEEP working: a properly-closed labelled block,
      a nested ```` ```` ````-wrapped fence, and the dispatcher's generated
      skeleton verbatim.
- [ ] **Step 2:** Implement the Candidate-B rule in `check_completion_review.ts`
      (rows live by default, explicit illustrative marker, `v2` discriminator).
- [ ] **Step 3:** In the SAME commit as Step 2, flip the pinned assertions from
      Step 1 to their post-change expectations. The diff of that commit is then
      the exact, reviewable list of behaviours that changed — and any fixture
      that flips unexpectedly is a defect found before merge, not after.
- [ ] **Step 4:** Update `dispatch_r2_reviewer.ts` so its generated skeleton is
      valid under the new grammar — the skeleton is the highest-traffic artefact
      and a grammar that reds it is wrong by construction. Its verbatim fixture
      from Step 1 must stay green.
- [ ] **Step 5:** Fix the `unbalanced-fence` remediation string so it cannot
      describe the arrangement that produced finding 1.
- [ ] **Step 6:** Remove the `KNOWN HOLE` notes (contract § 2.2 and the
      `scanFences` JSDoc) — in the same change that removes the hole, never
      before, and never while any Step-1 fixture still asserts the old
      behaviour. (Moved here from Phase 1: the notes describe a hole Phase 2
      closes, so removing them in Phase 1 would have documented a fix that did
      not exist yet.)

## Phase 3: Status-completeness on archived round records

> **Decision (maintainer, 2026-08-04): the disposition index with stable ids is
> NOT built. Archived round records get a status-completeness check instead.**
>
> The premise the index rested on did not survive measurement. It assumed
> archived rounds carry `open` rows whose terminal disposition lives elsewhere.
> Measured across every review artefact on `main`: **zero open rows.** Rounds 6,
> 7 and 8 are terminal *in place*, each `deferred` row naming
> `road-to-plan-gates-measurement.md` with a real reason.
>
> The maintainer's argument, recorded because it is the reusable part: the only
> failure mode actually observed — the agent's own bookkeeping slip, two `fixed`
> findings left recorded `open` for a day — **would have been caught by a
> status-completeness check on the round records.** The index protects against a
> mode that has not occurred (dispositions needing reference from outside the
> rounds). Until that happens the index is backdoor debt in waiting: a second
> artefact that must be kept in sync with the rounds, and therefore itself a new
> drift source. It can still be built later if dispositions genuinely migrate out
> of the rounds; the reverse rollback would cost more.
>
> Root cause restated: the gap was never "dispositions live outside the rounds",
> it was that **no validator reads those files at all** — they sit outside the
> `*.findings.md` glob (§ 2.7) so nothing selects them.

- [ ] **Step 1:** Define the rule in the contract: every findings-shaped row in
      an archived round record (`*-review.md` outside the `*.findings.md` glob)
      MUST carry a terminal status, and each status its required reference —
      `fixed` a commit-ish, `accepted-risk` a reason, `deferred` a carrier. An
      `open` row in an archived record is a violation by definition: archiving is
      what asserts the round is closed.
- [ ] **Step 2:** Implement it as its own validator
      (`check_review_dispositions.ts`) rather than inside
      `check_completion_review`. Keeping it separate preserves § 2.6's
      scope-selection — folding a corpus-wide sweep into the scope-selecting
      validator is exactly the directory-wide coupling § 2.6 removed — and gives
      the new check its own `scanned:` floor.
- [ ] **Step 3:** Reference-shape validation, deliberately narrow: a `fixed` ref
      must resolve via `rev-parse`, a `deferred` ref must name an existing file.
      No prose grading. Getting stricter than "the reference resolves" invites
      the confusing-block failure the council named.
- [ ] **Step 4:** Run it against the existing corpus (rounds 1–8 plus the blind
      pass) and fix whatever it legitimately flags. Expect it to pass on the
      first run — the corpus is already terminal — so a failure here is a
      finding about the checker, not the corpus.
- [ ] **Step 5:** Register in `src/config/gate-coverage.yml` with a real
      `min_scanned` floor derived from the current record count, and wire into
      `task preflight` + CI with the § 6 exit-code contract (exit 2 →
      warn-and-allow, dead scan scope → exit 1).
- [ ] **Step 6:** Verify with fixtures: an `open` row in an archived record
      blocks; `fixed` without a resolvable ref blocks; `deferred` without a
      carrier blocks; `accepted-risk` without a reason blocks; the real corpus
      passes. Plus the regression that motivated this phase — the exact shape of
      the blind-pass slip (a `fixed` finding still recorded `open`) must block.
- [ ] **Step 7:** Note in the contract that the stable-id index remains an
      option, with the trigger that would justify it: a disposition that cannot
      be recorded in the round record itself. Recording the trigger prevents both
      re-litigating the decision and forgetting it was conditional.

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
| 4 | Ref-shape check too strict | product | Reference validation grows past "the ref resolves" into grading prose, producing the confusing blocks the council warned about | Scope fixed in the step itself: `fixed` resolves via rev-parse, `deferred` names an existing file, nothing more | Phase 3 Step 3 |
| 5 | Hole outlives its note | product | The `KNOWN HOLE` notes are removed for tidiness before the hole is closed, or survive after | Removal is tied to the same change as the fix, and the characterization test fails loudly when behaviour changes | Phase 1 Step 4, Phase 2 Step 2 |
| 6 | Corpus-wide sweep re-couples the gate | implementation | Folding the archived-record check into `check_completion_review` re-introduces the directory-wide coupling § 2.6 removed | Shipped as its own validator with its own scanned floor, never inside the scope-selecting one | Phase 3 Step 2 |

## Notes

- Full-pipeline CI stays off locally (`quality.local_auto_run: false`); the
  targeted probes named in the steps run, remote CI on the PR is the gate.
- Phase 3 was scoped as its own PR when the work was agreed; Phases 1–2 (the
  live `critical`) may ship first and independently.
- Phase 2's pin-then-migrate ordering is a maintainer requirement, not a
  preference: fixtures land in an earlier commit than the grammar edit, so the
  behaviour change is reviewable as a test diff.
