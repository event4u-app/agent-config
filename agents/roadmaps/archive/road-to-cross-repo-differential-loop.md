---
complexity: lightweight
execution:
  mode: autonomous
---

# Road to the cross-repo differential loop — the reference-analysis command stops contradicting its own doctrine

> Fold the five mechanisms a real differential analysis had to run by hand into
> `/analyze:reference-repo` itself, so adoption rows anchor on verified
> own-defects, bound claims are checked before adoption, interop schemas are
> probed mechanically, and the verdict table is iterated to convergence — by
> editing one existing command file, adding no command, rule, or skill.

## Context

A differential analysis against an external reference was run in 2026-08. Its
most reusable by-product was not the comparison: it was the observation that the
*procedure the analyst had to improvise* is not the procedure
`src/domains/analysis-workbench/analyze/reference-repo/command.md` (207 lines)
describes. Five deltas, each verified against the command as it stands at
`97e29376`:

- **D1 — the direction contradicts binding doctrine.** ADR-211 C/D makes the
  inverted harvest binding for maintainer analysis work: a confirmed defect at
  home is the anchor, the external source is the second half. The command runs
  the additive direction — Step 3 records facts *about the reference*, and this
  repo first appears in Step 4 as a comparison column. Nothing requires an
  own-repo anchor before the first fetch. Verified: `grep -in "anchor"` over
  `command.md` → **0 hits**.
- **D2 — no bound-claim collision check.** `docs/CLAIMS.md` holds claims whose
  *consequence* is bound (a default pinned, a deprecation clock running). An
  ADOPT row can propose exactly the surface such a claim binds, and nothing in
  the command looks. `check_claims` guards the ledger's own integrity; no gate
  guards an adoption proposal against it. Verified: `grep -in "CLAIMS.md"` over
  `command.md` → **0 hits**.
- **D3 — no interop probe.** Step 3's one-line-per-axis fact table can record
  "the reference ships a graph artifact". It structurally cannot express "our
  own consumer-path list does not contain their artifact's path" or "our
  validator rejects their schema on four axes" — the two highest-value findings
  of the session, both produced by mechanically diffing their schema against
  *our* consumer gate. Verified: `grep -in "schema"` over `command.md` → **0
  hits**.
- **D4 — single pass.** The command has no iteration concept. The session's
  verdict table flipped twice under self-critique: a port proposal died against
  solution-minimalism, then a default-touching proposal was re-gated behind
  evidence. A single-pass run would have shipped pass 1. Verified:
  `grep -in "iteration\|converg"` over `command.md` → **0 hits**.
- **D5 — the depth ceiling excludes the decisive fact.** Step 2 caps at 40
  fetches and § Safety forbids cloning. The single fact that made the session's
  central proposal legitimate sat ~770 lines into one implementation file that
  40 top-level fetches would never have reached. The no-execute posture is a
  real security stance, not an accident — the fix is a bounded tier, never a
  deletion.

This roadmap edits one file. It re-proposes nothing the command already carries.

## Gap table (rule 19a — audited against the existing surface before drafting)

| Item | Verdict | Evidence |
|---|---|---|
| D1 anchor-table-before-fetch | **KEEP** | 0 anchor hits in `command.md`; ADR-211 C/D carries the doctrine the command contradicts |
| D2 bound-claim collision gate | **KEEP** | 0 `CLAIMS.md` hits in `command.md` |
| D3 interop probe step | **KEEP** | Step 3's axis table cannot express consumer-path or schema-gate incompatibility |
| D4 convergence requirement | **KEEP** | 0 iteration/convergence hits in `command.md` |
| D5 bounded deep tier | **KEEP** | Step 2 fetch ceiling + § Safety no-clone; no depth tier exists |
| Anchor discipline for dropped artifacts | **FOLD** | `/analyze:inbox` already verifies every claim against the tree — D1 is discharged there for inbox inputs; this roadmap covers the reference-repo path only |
| Commit pinning, per-row citation duty, five-label classification, fetch ceiling, no-execute posture | **CUT** | already in `command.md` Steps 2 / 5 / 6 and § Safety — re-proposing them is the failure this table exists to prevent |

## Prerequisites

- [x] **P1:** Confirm the five deltas are still deltas at the working HEAD —
      `grep -in "anchor\|CLAIMS.md\|iteration\|converg\|schema" src/domains/analysis-workbench/analyze/reference-repo/command.md`
      returns no hit that already discharges D1–D5. Any hit that does → strike
      that phase with a pointer and shrink the roadmap. The check reads the
      **base commit**, not the working tree: a delta-is-a-delta check that reads
      the tree inverts the moment the work lands and could then only be flipped
      before it was true.
      <!-- verify: bash -c 'test "$(git show HEAD:src/domains/analysis-workbench/analyze/reference-repo/command.md | grep -ic "anchor table\|bound-claim\|interop probe\|iteration record")" = "0"' -->

## Phase 1 — D1: the anchor table runs before the fetch

- [x] **Step 1:** Insert a new step between "Confirm scope" and "Fetch the
      reference surface" — **Anchor table first**. Before any fetch, the analyst
      records the own-repo anchors this comparison serves: verified defects with
      `file:line`, bound-claim row ids from `docs/CLAIMS.md`, and open roadmap
      findings — each verified at the current own-tree SHA, which is recorded
      alongside the reference's pinned commit.
      <!-- verify: grep -q "Anchor table first" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 2:** Add the downgrade rule to the classification step: an
      ADOPT/ADAPT row citing **no anchor** is automatically reclassified
      UNCLEAR. Unanchored discoveries remain allowed but land in a separate
      "unanchored observations" appendix in the output document — never in the
      adoption plan.
      <!-- verify: grep -q "unanchored observations" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 3:** Add the `## Anchor table` and `## Unanchored observations`
      sections to the document skeleton in the write-the-analysis step, so the
      output shape carries the obligation rather than the prose alone. State in
      the same place that the appendix is **optional** — an analysis with zero
      unanchored observations is a success, not an incomplete document. Without
      that sentence the appendix becomes a drawer analysts feel obliged to fill.
      <!-- verify: grep -q "## Unanchored observations" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 4:** State the anchor-persistence rule: an anchor survives the
      reclassification of the row it supported. A REJECT row that keeps its
      anchor documents why the rejection was considered — a dangling anchor is
      evidence, not an error state.
      <!-- verify: grep -q "anchor survives" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 5:** Cite ADR-211 as the doctrine this step enforces — the command
      stops contradicting a record that already binds, so no new rule file is
      created.
      <!-- verify: grep -q "ADR-211" src/domains/analysis-workbench/analyze/reference-repo/command.md -->

## Phase 2 — D2: bound-claim collision gate

- [x] **Step 1:** Extend the classification step: for every ADOPT/ADAPT row,
      extract the **concrete surface identifier** the row would touch — a file
      path, a config key, a schema field, a settings key — and match it against
      the `consequence` field of every `docs/CLAIMS.md` entry. On a hit the row
      must cite the claim id and either route through that claim's own reopen /
      amendment clause — saying so in the row — or be reclassified REJECT.
      **A shared topic word is not a collision:** matching on identifiers rather
      than prose is what keeps the gate from firing on every row that mentions a
      word the ledger also uses, which is how a check earns being ignored.
      <!-- verify: grep -q "concrete surface identifier" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 2:** State the enforcement honestly in the command: this is an
      analyst checklist obligation, **not** a CI gate — the analysis document is
      analyst-produced prose, and `check_claims` guards the ledger itself, not a
      proposal against it.
      <!-- verify: grep -q "checklist obligation" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 3:** Add a `Bound claims touched` column to the comparison-matrix
      skeleton so a row that silently skips the check is visible as an empty
      cell rather than an absent thought.
      <!-- verify: grep -q "Bound claims touched" src/domains/analysis-workbench/analyze/reference-repo/command.md -->

## Phase 3 — D3: the interop probe step

- [x] **Step 1:** Add a step after fact extraction: when the reference ships a
      consumable artifact (index, graph, manifest, lockfile, generated config),
      diff its concrete schema against **this** repo's actual consumer gate —
      the validator or parser at `file:line` — and record path-discovery
      compatibility separately from schema compatibility.
      <!-- verify: grep -q "Interop probe" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 2:** Resolve the probe's central under-specification — *which*
      consumer. The step names the consumer explicitly, in one of two ways, and
      never assumes one is discoverable: the analyst declares it
      (`artifact → consumer at file:line`), **or** the probe records
      `consumer not locatable` as its result. "Our validator" is not an address;
      a probe that cannot name the gate it diffed against produces no finding,
      and saying so is the honest outcome rather than a silent skip.
      <!-- verify: grep -q "consumer not locatable" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 3:** Pin the probe's output shape as one table:
      `artifact → our consumer (file:line) → discovered? → validates? → exact failing axes or error`.
      A probe that reports "incompatible" without naming the failing axes is not
      a finding; a probe that **crashes** on an unexpected format records the
      error in the same cell — a failed probe is itself a result, never an empty
      row.
      <!-- verify: grep -q "exact failing axes or error" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 4:** Bound the cost explicitly: the probe is read-only and fits the
      existing fetch budget when targeted — one schema document or one sample
      artifact from the reference; our own validator is read locally at zero
      fetch cost.
      <!-- verify: grep -q "read locally at zero fetch cost" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 5:** Place the probe **before** the convergence step in the
      command's own step order, and say so where both are defined. Convergence
      reclassifies rows on solution-minimalism and necessity grounds, and
      necessity depends on compatibility — a row killed in pass 1 before its
      probe ran was judged without the evidence the probe exists to produce.
      <!-- verify: grep -q "runs before the convergence" src/domains/analysis-workbench/analyze/reference-repo/command.md -->

## Phase 4 — D4: convergence requirement

- [x] **Step 1:** Add an `## Iteration record` section to the output contract:
      minimum two critique passes over the verdict table, where pass 2
      explicitly applies solution-minimalism and the Phase-2 bound-claim check
      to pass 1's ADOPT rows. Every verdict flip is recorded with its reason.
      <!-- verify: grep -q "## Iteration record" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 2:** Define DONE: the run is complete only when a pass produces
      **zero** verdict changes. Cap at four passes; a table still flipping at
      four is itself a finding — recorded as `contested — needs maintainer
      judgement`, never hidden by stopping.
      <!-- verify: grep -q "contested — needs maintainer judgement" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 3:** Give `contested` a terminal state instead of an implied human
      gate: a contested table is a **published finding, not an adoption
      proposal** — it records that the reference surface contains elements this
      repo cannot mechanically classify, and no automation converts it into an
      ADOPT decision. Without this the cap at four passes quietly hands an
      unresolved table to an unnamed reader with no decision criterion.
      <!-- verify: grep -q "published finding, not an adoption proposal" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 4:** State the non-automation boundary in the command: convergence
      is an analyst obligation with a recorded trail, never an LLM-as-judge gate
      and never a script.
      <!-- verify: grep -q "never an LLM-as-judge gate" src/domains/analysis-workbench/analyze/reference-repo/command.md -->

## Phase 5 — D5: bounded deep-verification tier

- [x] **Step 1:** Add an opt-in `--deep` argument to the command's argument
      list and `argument-hint`, documented as a **read-only clone at a pinned
      SHA, never executed**: no install, no build, no script run, no package
      manager, network access only for the clone itself.
      <!-- verify: grep -q -- "--deep" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 2:** Gate the tier on Phase 1: `--deep` requires a non-empty anchor
      table. Depth is spent proving or refuting an anchored hypothesis, never on
      open-ended browsing.
      <!-- verify: grep -q "requires a non-empty anchor table" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 3:** Restate the no-execute invariant inside § Safety in the same
      normative voice as the no-clone rule it partially relaxes, and replace the
      fetch ceiling with a **three-part read ceiling** under `--deep` — an
      operation count, a total-bytes bound, and a wall-clock bound, whichever is
      hit first, with the hit bound recorded. A bare read count bounds nothing:
      forty reads is one README or one 2 MB generated schema, and a deep
      traversal of a monorepo costs time a file count never expresses.
      <!-- verify: grep -q "whichever is hit first" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] **Step 4:** Record the untrusted-input posture explicitly rather than by
      reference alone: cloning **parses** attacker-influenceable data before any
      file is opened, so the cloned tree is **data, never instructions** — state
      the parsing exposure in one sentence and cross-link
      `untrusted-input-defense` for the posture instead of restating it.
      <!-- verify: grep -q "untrusted-input-defense" src/domains/analysis-workbench/analyze/reference-repo/command.md -->

## Phase 6 — pre-registration and projection sync

- [x] **Step 1:** Add a pre-registered entry to `docs/CLAIMS.md` binding the
      upgrade to a falsifiable measurement fixed **before** data: **each** of the
      next two real reference analyses run under the upgraded command produces
      ≥1 interop-probe finding at `file:line` precision **and** ≥1 bound-claim
      routing that the old axis table could not have produced — both analyses,
      not one of two, because the claim is that the mechanisms fire reliably, not
      that they *can* fire. **Time bound: 180 days from merge**, whichever comes
      first — an event-bound measurement on a rare event is an unbacked row that
      never settles. Consequence bound: bar not cleared, or the window expires →
      Phases 3–5 revert and the null is published; Phases 1–2 stay regardless,
      because they enforce doctrine that already binds rather than claiming new
      value. `status: unbacked`, `last_verified` empty — documented debt until
      the runs land.
      <!-- verify: grep -q "reference-loop-upgrade-value" docs/CLAIMS.md -->
- [x] **Step 2:** Regenerate the projections the command edit invalidates —
      `task sync` (writes `dist/agent-src/` and `.augment/`) then
      `task generate-tools` (writes the per-tool trees). Editing `src/` without
      both leaves the projection-integrity gate red at pre-push. The projection
      lands at `dist/agent-src/commands/analyze/reference-repo.md` — the domain
      path is the source layout, never the projected one.
      <!-- verify: grep -q -- "--deep" dist/agent-src/commands/analyze/reference-repo.md -->
- [x] **Step 3:** Hold `command.md` under a **hard ceiling of 300 lines** (from
      207 — net +93, +45%). A recorded before/after number without a threshold is
      an observation, not a constraint; the ceiling is what forces an added step
      to displace or tighten the sentence it overlaps. Breaching it is a real
      signal — the mechanisms are too heavyweight for a single-file edit and the
      scope must be re-cut, never the ceiling raised silently.
      <!-- verify: bash -c 'test "$(wc -l < src/domains/analysis-workbench/analyze/reference-repo/command.md)" -le 300' -->

## Acceptance Criteria

- [x] All five deltas are discharged inside
      `src/domains/analysis-workbench/analyze/reference-repo/command.md` — no
      new command, rule, or skill file exists in the diff.
      <!-- verify: bash -c 'test -z "$(git diff --name-only --diff-filter=A HEAD -- src/rules src/skills | head -1)"' -->
- [x] The command's own frontmatter `argument-hint` advertises `--deep`.
      <!-- verify: grep -q "argument-hint.*--deep" src/domains/analysis-workbench/analyze/reference-repo/command.md -->
- [x] `docs/CLAIMS.md` carries the pre-registered `reference-loop-upgrade-value`
      entry with `status: unbacked`.
      <!-- verify: grep -q "reference-loop-upgrade-value" docs/CLAIMS.md -->
- [x] The source-confidentiality gate is green — no external source name appears
      in any tracked file this roadmap touches.
      <!-- verify: npx tsx src/scripts/check_no_external_sources.ts -->
- [x] The roadmap-family and complexity gates accept the file.
      <!-- verify: npx tsx src/scripts/lint_roadmap_complexity.ts --quiet -->
- [x] Remaining quality gates are delegated to remote CI on the PR
      (`quality.local_auto_run` default).

## Notes

**Non-goals.**

- No new command, rule, or skill file — this is edits to one existing command
  plus one ledger row.
- No automation of the critique passes into a script; convergence is an analyst
  obligation with a recorded trail.
- No relaxation of the no-execute posture under any mode, `--deep` included.
- No adoption of anything from the reference beyond the *process* deltas — the
  substantive harvest is a separate question and is deliberately not carried
  here (see Provenance).

**Why the sibling draft is not in this file.** The same session produced a
second roadmap draft proposing a consumer adapter plus a re-test of a bound
honest null. Its load-bearing phase needs an external toolchain and graph builds
on three benchmark repositories, which cannot be honestly closed inside an
autonomous run — so it is not folded in here. One task per file (rule 11); the
adapter question stays open and unstarted rather than half-shipped.

## Iteration record

A roadmap whose subject is convergence has no standing to ship unconverged, so
its own verdict table was put through the critique it proposes.

**Pass 1 → pass 2** (AI council, deep, 2026-08-12, members `anthropic` +
`openai`; verdict **conditional reject — structural revision required**). Eight
findings adopted, one rejected with reason:

| # | Finding | Disposition |
|---|---|---|
| 1 | The interop probe never says *which* consumer it diffs against; "our validator" is not an address | **ADOPTED** — Phase 3 Step 2: the analyst declares the consumer, or `consumer not locatable` is the recorded result |
| 2 | The probe must run before convergence — necessity depends on compatibility, so a row killed on minimalism grounds in pass 1 was judged without the probe's evidence | **ADOPTED** — Phase 3 Step 5 pins the command's step order |
| 3 | A crashing probe leaves an empty row | **ADOPTED** — Phase 3 Step 3: the error goes in the cell; a failed probe is a result |
| 4 | `contested` at the four-pass cap is an implied human gate with no named reader and no decision criterion | **ADOPTED** — Phase 4 Step 3 gives it a terminal state: published finding, never an adoption proposal |
| 5 | The measurement is satisfied by one positive in two tries, and is event-bound on a rare event | **ADOPTED** — Phase 6 Step 1: both analyses, `and` not `or`, plus a 180-day window |
| 6 | Growth is recorded but not bounded | **ADOPTED** — Phase 6 Step 3: hard ceiling of 300 lines, mechanically verified |
| 7 | A prose grep over `docs/CLAIMS.md` false-positives on shared topic words and trains analysts to wave the gate through | **ADOPTED** — Phase 2 Step 1 matches concrete surface identifiers, not prose |
| 8 | A bare read count bounds nothing under `--deep` | **ADOPTED** — Phase 5 Step 3: three bounds, first hit recorded |
| 9 | Phase 2 must run before Phase 1, because an anchor can cite a bound claim whose collision check has not run | **REJECTED** — the finding conflates roadmap phase order with command step order, and conflates *an anchor that is a claim* with *a row that collides with a claim*. Collision checking applies to ADOPT rows, which exist only after classification; the anchor table is pre-fetch by design. The useful residue was adopted instead as Phase 1 Step 4 (anchors persist through reclassification) |

The council also split on whether to defer Phases 3–5 and ship 1–2 first. Both
members ultimately argued against deferral for the same reason — checklist
fatigue is cumulative and cannot be measured from a partial shipment, while the
pre-registration already supplies the accountability deferral was meant to buy.
Not deferred.

A pass over the revised table produced no further flips.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Checklist bloat turns the command into a form nobody completes | product | Five added mechanisms on a 207-line command is a large relative growth, and a procedure long enough to skim is a procedure that gets skimmed. The failure is not the length itself but that the added steps become ritual — an anchor table pencil-whipped to unblock the fetch is worse than no anchor table, because it launders an unanchored proposal as an anchored one | Phase 6 Step 3 binds a hard 300-line ceiling with a mechanical check, so growth is a constraint rather than a recorded observation and an added step must displace or tighten the sentence it overlaps. The anchor rows carry `file:line` at a pinned SHA under the citation duty the command already enforces, so a pencil-whipped anchor is a visibly uncited one | Phase 6 |
| 2 | `--deep` scope creep from read-only clone into execution | implementation | A checked-out tree invites "just run their test suite to see". The no-execute invariant is normative text with no mechanical enforcement, which is exactly the class of obligation this suite has repeatedly found decays first, and the blast radius is arbitrary code execution from an attacker-influenceable source | The tier is opt-in, gated on a non-empty anchor table so it cannot be entered for browsing, restated inside § Safety in the same voice as the rule it relaxes, and cross-linked to `untrusted-input-defense` so the cloned tree is framed as data. Phase 5 Step 3 keeps a read ceiling so the cost bound survives the fetch-count removal | Phase 5 |
| 3 | The measurement never runs and the value claim stands unfalsified | product | The pre-registration binds to "the next two real reference analyses", and reference analyses are rare in this repo. An unbacked ledger row that nothing ever settles is documented debt that reads as diligence | The consequence is bound asymmetrically on purpose: Phases 1–2 stay regardless because they enforce already-binding doctrine, so a measurement that never arrives cannot leave the command in a worse state than today. Only Phases 3–5 carry the revert obligation | Phase 6 |
| 4 | The bound-claim gate produces false collisions and trains analysts to ignore it | implementation | A grep over `docs/CLAIMS.md` for a surface name will hit claims whose consequence is unrelated, and a check that mostly fires wrongly is a check that gets waved through | The gate's output is a routing decision, not a block: a hit forces the row to either name the reopen clause it travels through or be reclassified — both are one sentence of analyst work, and the `Bound claims touched` column makes a skipped check visible as an empty cell rather than a silent pass | Phase 2 |
| 5 | Editing the command without regenerating projections leaves the tree red | implementation | `src/` is the single source of truth and three separate generators project from it; a command edit that skips `task sync` and `task generate-tools` fails the projection-integrity gate at pre-push, after the work looks finished | Phase 6 Step 2 makes the regeneration an explicit step with its own verification rather than an assumed reflex | Phase 6 |

## Provenance

- Source: an external multi-language code-graph reference, analysed in a 2026-08
  differential session (anonymized per
  [`source-confidentiality`](../../../src/rules/source-confidentiality.md)); link
  via `src/scripts/_lib/link_crypto.ts decrypt`:
  ENC1:xEHB1IgcSIGyLj10uJszfEebQIXT2gBvFUdhBoJzMWuCZFZXitJQwUbzmubiiiAqr7/nJk5cx93EFoUUkik5f7dfousCQU4Bt+JagwKmI2bHg1oyng5oh0Vng1UH8+w0TWF3+0xcOSC6
- The five deltas are process observations about **this** repo's command, not
  capabilities adopted from the reference; the substantive adoption question is
  deliberately out of scope here (§ Notes).
- Council: `anthropic` + `openai`, 2026-08-12, depth `deep`, input-mode
  `roadmap`. Verdict conditional-reject; convergence inlined in § Iteration
  record above (eight findings adopted, one rejected with reason).
