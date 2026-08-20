---
complexity: structural
status: ready
parent_roadmap: road-to-rule-coherence
---

# Roadmap: Follow-up to road-to-rule-coherence

> The rule layer's transport, scoping and arbitration defects are fixed; what
> remains is the one class an agent may not decide — what a consumer install
> receives by default — plus the measurement that should precede it.

> **Closed 2026-08-20 by transfer, not by achievement.** The default flip and
> its benchmark left for a maintainer-owned stub; the `thin` strand stayed with
> its existing owner; the read-cap strand left for a dated stub. What the run
> *did* produce is a census — read § Outcome before citing anything here as
> done. The line below is kept as history because it was the roadmap's operating
> premise for four months.
>
> **Blocked until** the maintainer rules on the default-flip gate — for
> Phases 1 and 2, which is what that gate covers.
>
> **Correction, 2026-08-16.** This line used to end "None is agent-startable",
> and that was false when it was written. F4.1 changes nothing a consumer
> receives, needs no spend, and is owned here rather than elsewhere; it was
> executable the whole time and has now landed. The blanket claim survived
> three screens as a reason not to look, which is the cost of writing a
> roadmap-wide disposition from the phase that happens to be blocked. Phases
> 1–2 remain maintainer-gated, F3.1 remains owned by
> `road-to-thin-flip-under-anchor-scoring`, and F5.1 waits on its own stated
> trigger — those three are the real gates, named individually.

## Outcome

**Closed 2026-08-20 by an autonomous drain run. Archived does not mean
achieved.** Nine of eleven boxes were open at the start; **none of them was
executed**, because every one is a shipped-default flip, a paid human-judged
measurement, work owned by another roadmap, or a decision behind a date that has
not arrived. Two boxes closed on evidence produced during the run, and the run's
real product is a census the flip decision needed and did not have.

| Phase | State | What actually happened |
|---|---|---|
| Prerequisites | **satisfied** | Both verified against the tree: the parent merged 2026-08-06 in `bb8360bfa` (PR #1186), Phases 0–2 carry 14 `[x]` and zero open boxes, 14 days soaked. |
| 1 — the default flip | **transferred** | F1.1–F1.4 → [`stubs/road-to-discipline-default-flip.md`](../stubs/road-to-discipline-default-flip.md) Transfer 1. The census this phase asked the agent for was produced first and is attached. |
| 2 — the A/B bench | **narrowed, then transferred** | The **method** is now pre-registered in F2.1 below (council `D — satisfied`); the **run** → Transfer 2 of the same stub. The two independent human judges are the gap, and they are load-bearing rather than procedural. |
| 3 — `thin` viability | **transferred** | Ownership confirmed live: [`later/road-to-thin-flip-under-anchor-scoring.md`](../later/road-to-thin-flip-under-anchor-scoring.md). Nothing forked here, which was the step's instruction. |
| 4 — re-adjudication | **satisfied** | Already closed 2026-08-16, before this run: all twelve findings declared, `rule-interactions.yml` 23/30 → 29/38, no rule body edited. |
| 5 — the two provisional numbers | **F5.2 satisfied · F5.1 transferred** | F5.2 closed in ADR-218. F5.1 → [`stubs/road-to-declared-protocol-cap.md`](../stubs/road-to-declared-protocol-cap.md): the dated branch fires 2026-11-04 and the counting branch has no working instrument. |

### What the run produced

[`discipline-default-flip-census-2026-08-20.md`](../../evidence/analysis/discipline-default-flip-census-2026-08-20.md)
— all figures exact BPE (`cl100k_base`), each next to the command that read it.
Three findings are worth reading before this roadmap is cited:

1. **F1.1's pre-registered criterion is ambiguous, and the flip cannot pass it
   on the "fresh install" reading.** No per-tool rule-projection surface reads
   `discipline_profile` at all — `condense.ts`, `generate_*.ts` and
   `install/*.ts` contain no reference to the key. On the router's
   *always-honoured* reading (`compile_router.ts:283`, `essential = kernel +
   downstream-changes`) `essential` measures **8,909 tok** and passes ≤ 30k with
   3.4× headroom; on the what-a-host-receives reading a fresh install carries
   **111,035 tok** and the key does not move it. The maintainer has to name the
   reading. This is the measurement F1.1's own note said nothing had done.
2. **F1.3 survives re-measurement**: exactly 8 rules, identical membership,
   8,523 tok (+2.6 % drift). The claim holds.
3. **F1.4 is weaker than this roadmap recorded.** The dedup is FIXTURE-ONLY
   (`src/config/preamble-payload-budget.json:69`): `install.ts` stamps
   `package:` / `source_path:` into every installed rule while the in-repo
   projection stamps nothing, so **0 of 118** twins are byte-identical and
   **107 of 118** differ *only* in that stamp. Reachability was closed with a
   **maintainer refusal** on 2026-07-31
   ([`dedup-reachability-refusal`](../../settings/contexts/dedup-reachability-refusal.md)).
   Flipping this default today changes nothing any consumer receives. Surfaced
   per `decision-revisit-gate` rather than dropped: reopening that refusal is a
   maintainer call, and F1.4 should be read as blocked behind it.

### What was NOT done, plainly

No default was flipped. No benchmark was run. No rule body was edited. The
`thin` strand was not touched. The read cap is still 8 with its provisional note
intact. Anyone reading a 100 %-closed roadmap as evidence that the discipline
default is now the measured one would be wrong, and the four `[-]` boxes in
Phase 1 say so at the point of citation.

## Context

This roadmap collects the items deferred from
[`agents/roadmaps/archive/road-to-rule-coherence.md`](road-to-rule-coherence.md).
See the parent's archive entry for the original rationale and the two council
rounds behind it.

The parent closed 14 of 20 steps and cancelled 2 on measurement. It did **not**
close these four, and the reason is uniform: this repo treats a
projection-default flip as a human release gate, and the settings template says
of the relevant key, verbatim, **"Do not set this from automation."** An agent
preparing the evidence is in scope; an agent flipping the default is not.

## Prerequisites

- [x] Read `AGENTS.md` and the parent archive entry. Done 2026-08-20; the
      archive entry is [`road-to-rule-coherence.md`](road-to-rule-coherence.md),
      read in full for the P0–P2 verification below.
- [x] Confirm the parent's P0–P2 work is merged and has soaked — the whole point
      of the sequencing the council imposed was validate-then-flip.
      **Verified 2026-08-20.** Merged: the parent's archive entry reached `main`
      in `bb8360bfa` (PR #1186) on 2026-08-06 — `git log --first-parent -1 --
      agents/roadmaps/archive/road-to-rule-coherence.md`. Complete: Phases 0–2
      carry 14 `[x]` and **zero** open boxes across the whole file, with P0.5 and
      P2.3 cancelled `[-]` on measurement. Soaked: 14 days elapsed, with the
      transport and scoping surfaces (`src/rules/context-hygiene.md`,
      `src/scripts/generate_claude_rules.ts`) still live and edited since
      without a revert.

## Phase 1 — The default flip (human release gate)

- [-] **F1.1 Flip the shipped `discipline_profile` default to the measured
  configuration.** — **transferred** 2026-08-20 to
  [`stubs/road-to-discipline-default-flip.md`](../stubs/road-to-discipline-default-flip.md)
  Transfer 1, council disposition `default-flip-release-gate` **B**, outcome
  state `transferred`. The census half — this step's own stated agent job — was
  produced first and is attached there; see § Outcome for what it changed. The template already documents the evidence: `essential`
  carries a significant discipline lift (+0.458, p=0.0135) while `full`'s
  residual over it is **not** significant (p=0.37) — and `full` is what ships.
  The agent's job is the diff plus the census; the decision is the
  maintainer's.
  - Acceptance: fresh-install census — always-on rule prose ≤ 30k tok
    (pre-registered; measured ~163k as loaded at audit time).
  <!-- THE FLIP IS BARRED, AND A THIRD ROUTE SHIPPED INSTEAD — 2026-08-14.
  Put to an outside opinion as a two-option question (flip on the measurement /
  drop the step). The seat rejected BOTH framings, and the rejection is
  checkable rather than a preference. Provenance: 1 seat, 2 rounds; the second
  seat failed to start, so this is a single-model judgement admitted on its
  merit and NOT a convergence.

  Two independent bars, either of which is sufficient:

    1. `discipline_profile` carries "do not set this from automation". That
       reads as ABSOLUTE for the key family — a prohibition on automated CHOICE
       of the default, not merely on a script rewriting a user's file. Under
       that reading no measurement, however clean, licenses the flip. The
       evidence tells you the better configuration exists; the prohibition says
       shipping it as the default needs human deliberation.
    2. The pre-registered acceptance criterion on this very step fails on its
       own terms: ~163k measured against a ≤30k target is 5.4x. Even reading
       bar 1 charitably, the step cannot pass what it registered.

  What landed instead (the seat's third route, and the reason this step is not
  simply dropped): `src/config/agent-settings.template.yml` now carries
  `essential` as a **commented-out preset with its token factor stated inline**,
  directly under the key, with both bars written out. The default is untouched.
  Users see the better-evidenced option and can uncomment it; nothing automated
  chose for them.

  This step therefore stays OPEN and is not agent-executable. It closes when a
  human either flips the default deliberately or retires the step — and if the
  ≤30k criterion is to survive, something must first measure what `essential`
  actually costs at fresh install, which nothing yet has. F1.2 (`essential-plus`)
  is downstream of a landing F1.1 and is unaffected by this note. -->
  <!-- verify: grep -c "OPT-IN PRESET" src/config/agent-settings.template.yml returns 1, and the `discipline_profile:` assignment above it is still `__DISCIPLINE_PROFILE__` -->

- [-] **F1.2 `essential-plus` preset, if F1.1 lands.** — **transferred**
  2026-08-20 with F1.1 (same stub, Transfer 1, outcome state `transferred`); its
  own text makes it downstream of a landing F1.1, so it cannot precede it. The 30-rule whitelist
  formalized and versioned, diffable against `essential`. **Mandatory
  addition: `agent-authority`** — the whitelist as used excludes the only
  conflict arbiter while loading conflicting absolutes.
- [-] **F1.3 `projection.rule_packs: auto`.** — **transferred** 2026-08-20
  (same stub, Transfer 1, outcome state `transferred`). Re-measured before the
  transfer and **confirmed**: exactly 8 rules, the same 8 the template names,
  **8,523 exact-BPE tok** (+2.6 % against this step's 8,308), § 2 of the
  census. Verified by the parent's P1.6
  sweep to drop **exactly the 8 rules** the template names (~8,308 GPT tok
  measured today vs the archived 8,110 — ~3% drift, directionally confirmed).
  This is also what pack-scopes `ui-audit-gate`, and it is what the parent's
  three self-claimed-pack-gated safety floors need
  (`finance-safety-floor`, `legal-safety-floor`, `strategy-safety-floor`).
- [-] **F1.4 `projection.scope_dedup: true`.** — **transferred** 2026-08-20
  (same stub, Transfer 1, outcome state `transferred`), and it is the one item
  the re-measurement **weakened rather than confirmed**: the flip would be inert
  for every consumer today, and its enabling condition is closed by a standing
  maintainer refusal. Details in § Outcome and § 3 of the census; surfaced
  rather than dropped, per `decision-revisit-gate`. Mechanism, measurement and a
  doctor health check all already exist; only the default is off. Verified live
  at audit time: **109 shared basenames** between the user-global and project
  rule scopes on a real install.

## Phase 2 — Measure, with the comparison that is actually open

- [-] **F2.1 A/B bench: zero vs `essential-plus`.** The **method is now
  pre-registered here in full** (below) — that half is done, and the council
  recorded it `bench-spend-and-methodology` **D — satisfied**. The **run** is
  **transferred** 2026-08-20 to
  [`stubs/road-to-discipline-default-flip.md`](../stubs/road-to-discipline-default-flip.md)
  Transfer 2, outcome state `transferred`, because the two independent human
  judges the method requires are not something repository automation supplies.
  Explicitly **not** `essential` vs `full` — the council killed that as
  already-measured (p=0.37) and `full` will never ship.

  **Pre-registered method — fixed 2026-08-20, before any run** (AI council 2/2,
  anthropic + openai;
  [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)).
  Registered as a whole: changing any line after a run has started voids it.

  | # | Registered condition | Fixed value |
  |---|---|---|
  | 1 | Arms | zero vs `essential-plus` — never `essential` vs `full` |
  | 2 | n per arm | **100 paired tasks**, randomised |
  | 3 | Blinding | **double-blind** — neither judge sees the arm |
  | 4 | Corpus and rubric | the **same frozen** task corpus and rubric for both arms |
  | 5 | Judging | **two independent human judges**, adjudication on disagreement |
  | 6 | Validity floor | **≥ 95 %** valid completions |
  | 7 | Quality guard | no primary-quality regression **> 5 percentage points** |
  | 8 | Efficiency result | positive, with a **95 % bootstrap CI excluding zero** |
  | 9 | Token ceiling (inherited) | non-inferiority Δ ≥ −0.05 at **≤ 1.4× tokens** |

  - Honest-null clause: if `essential-plus` is not non-inferior, it is demoted
    to documentation rather than narrated as a win. Conditions 6–8 are
    **conjunctive** — any one missing is a null, not a partial win.
  - No lift language may attach to any LLM-judged probe set of the size the
    parent considered — that was ruled smoke-test-only. This is also why the run
    transferred instead of being approximated: an LLM-judged substitute has no
    power against the human-judged production measurement the claim must be
    comparable with, so it would be a **different** method reported in this
    one's name.
  - Falsifiability check, stated because a registration nobody can fail is
    theatre: this method fails if the judges disagree past adjudication, if valid
    completions fall under 95 %, if quality regresses more than 5 pp, or if the
    bootstrap interval spans zero. Three of the four are readings a reader can
    take off the report without trusting its conclusion.

## Phase 3 — Architecture, owned elsewhere

- [-] **F3.1 `thin` projection viability.** — **not forked here**, which is
  this step's own instruction, and verified live 2026-08-20: the owner exists as
  [`later/road-to-thin-flip-under-anchor-scoring.md`](../later/road-to-thin-flip-under-anchor-scoring.md),
  parked under the `later/` disposition. Outcome state `transferred` — to that
  existing roadmap, not to a stub. Nothing was written to it from here. Do **not** fork it here; it is owned
  by `road-to-thin-flip-under-anchor-scoring.md`. The parent flagged it as the
  only plausible path to restoring subagent delegation (a spawn failed at
  ~207,664 tokens against a 200,000 limit while `delegation-policy` mandates
  delegating). If `thin` cannot restore delegation for a validated set, the
  rule-count ceiling is a hard architectural cap — and that finding deserves a
  real multi-provider council, not subagents.

## Phase 4 — Re-adjudicate what the audit left open

- [x] **F4.1 Re-adjudicate the 9 remaining `real-conflict` pairs** from
  [`agents/evidence/analysis/rule-conflict-audit-2026-08-06.md`](../../evidence/analysis/rule-conflict-audit-2026-08-06.md).
  Four of them are `context-hygiene`'s read-loop against a mandated multi-read
  protocol and were materially reduced by the parent's declared-protocol cap of
  8 — re-run them against the **new** rule text before writing any further
  rewrite. Two more share the reply-position root cause already declared for
  the other two.
  - **Done 2026-08-16** —
    [`rule-conflict-readjudication-2026-08-16.md`](../../evidence/analysis/rule-conflict-readjudication-2026-08-16.md).
    The step's own count was stale: two more pairs had been declared since it
    was written, so the live number was **seven**, not nine. All twelve
    original findings are now declared —
    `docs/contracts/rule-interactions.yml` goes 23 rules / 30 pairs → 29 / 38,
    linter clean. **No rule body was edited**, which is the step's own
    instruction and also the correct shape: each of the seven had a resolution
    derivable from text that already shipped, so the defect was a missing
    declaration rather than a missing decision. The four read-loop pairs are
    reduced but not closed by the cap of 8 — the ceiling exists and neither
    side tells the agent how to unlock it, which is what the rows now say.

## Phase 5 — Retire the two provisional numbers

Both are plausible figures without a reproducible derivation — the failure class
the parent roadmap exposed in the "17 rules carry absolutes" claim and then
committed twice more itself.

- [-] **F5.1 Set the declared-protocol read cap from data, not from n=1.** —
  **transferred** 2026-08-20 to
  [`stubs/road-to-declared-protocol-cap.md`](../stubs/road-to-declared-protocol-cap.md),
  outcome state `transferred`, on two independent grounds: the 90-day branch
  fires **2026-11-04** (14 days elapsed at transfer), and the session-counting
  branch has **no working instrument** — the obvious transcript grep matches the
  rule's own prose, so it measures its own delivery. § 4 of the census; the stub
  states what a working counter would have to be. The
  cap of 8 in `context-hygiene` comes from a single observed run and is marked
  provisional in the rule body with a revisit trigger. Record declared-protocol
  read counts across real sessions, then set the cap at p95 and drop the note.
  - **Trigger, whichever first** (round 3 rejected "once a distribution exists"
    as unfalsifiable — gradual, never urgent, and absence of complaints reads
    identically to absence of measurement): **≥ 10 declared-protocol sessions**
    → set the cap from their p95; or **90 days with fewer than 10** → that is
    itself the answer, declared protocols are rare, the cap is not load-bearing
    and drops back to the undeclared 5.
  - Acceptance: the cap cites a distribution and an n, or the 90-day branch
    fired; either way the provisional note is removed in the same change.
- [x] **F5.2 What the absoluta figure is FOR — answered, and the answer is
  "nothing ongoing".** Council round 3's kill question named the census as the
  weaker of the two fixes, both members converging on the same reason: it is a
  write-only diagnostic. It answered one question, that answer killed the
  precedence lattice, and the question is closed. Recorded as
  [`ADR-218`](../../../docs/decisions/ADR-218-absoluta-census-is-a-closed-decision-input.md):
  cite the range plus the structural figure, never a point estimate; the script
  stays only so those figures are re-derivable rather than quoted from a commit
  message; and a future "did this PR add an absolute?" check is a **different**
  tool that watches diffs, built when there is intent to enforce that boundary.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-16 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Flip lands without the soak | product | F1.1–F1.4 change what every consumer receives. Shipping them before the parent's transport and scoping fixes have soaked reproduces exactly the sequencing the council rejected — ship-then-patch | The blocked-until line gates the whole roadmap on the maintainer ruling, and the prerequisite step requires the parent merged AND soaked before Phase 1 opens | Phase 1 — The default flip (human release gate) |
| 2 | Bench runs without pre-registered thresholds | implementation | A post-hoc threshold turns a null result into a narrated win, which is the failure the honest-null discipline exists to stop | Thresholds are written into F2.1 in this file before any run, with the demotion path stated in the same bullet | Phase 2 — Measure, with the comparison that is actually open |
| 3 | thin gets forked here | implementation | Two roadmaps editing one projection mode diverge silently, and the existing owner already carries the measured honest-null | F3.1 states the ownership and forbids the fork rather than restating the work | Phase 3 — Architecture, owned elsewhere |
| 4 | Stale re-adjudication | implementation | Re-running the 9 open pairs against the OLD rule text would re-derive conflicts the parent already fixed, wasting the audit and possibly reverting good changes | F4.1 names the changed text explicitly as the input, not the audit's original quotes | Phase 4 — Re-adjudicate what the audit left open |

## Blockers

### blocker: default-flip-release-gate
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** Phase 1
- **What to do:** rule on whether the measured configuration becomes the shipped
  default. The evidence is prepared and cited in F1.1–F1.4; the settings
  template's own comment on `rule_packs` — "Do not set this from automation" —
  is why this cannot be an agent decision.
- **Resolved when:** the maintainer merges the flip with the census attached, or
  records a decision to keep the current default and ship the preset as opt-in.
- **Resolution (2026-08-20) — outcome state `transferred`, NOT satisfied.** The
  AI council (2/2, anthropic + openai) decided this **B — transferred** under
  its categorical Rule 3: changing a shipped default and merging it are
  externally visible release actions regardless of which choice is preferred, so
  the council may record a preference and may not enact one. Record:
  [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md).
  **Preferred choice, recorded and deliberately not enacted:** keep the current
  default and ship the preset as opt-in until the human benchmark passes.
  Neither branch of the criterion above has fired — the token reads `resolved`
  because that is the only closed token
  [`lint_roadmap_blockers`](../../../src/scripts/lint_roadmap_blockers.ts)
  accepts, and the outcome state in this line is what says what actually
  happened. Transferred to
  [`stubs/road-to-discipline-default-flip.md`](../stubs/road-to-discipline-default-flip.md)
  Transfer 1, which carries the verbatim criterion, the complete moved-step list
  (F1.1–F1.4), a named producer (`matze4u`, verified `admin: true`) and probes
  measured at transfer. The census half — this roadmap's own stated agent job —
  was produced first:
  [`discipline-default-flip-census-2026-08-20.md`](../../evidence/analysis/discipline-default-flip-census-2026-08-20.md).

### blocker: bench-spend-and-methodology
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 2
- **What to do:** authorize the A/B run and confirm the methodology. The council
  was explicit that an LLM-judged probe has no power against the original
  human-judged production measurement, so a real claim needs human judging at
  adequate N.
- **Resolved when:** thresholds are pre-registered here and the run is
  authorized, or F2.1 is cancelled and the preset ships documentation-only.
- **Resolution (2026-08-20) — split: the method `satisfied`, the run
  `transferred`.** The AI council decided this **D — satisfied** and named the
  method: 100 paired tasks per arm, randomised and double-blind; the same frozen
  corpus and rubric; two independent human judges with adjudication on
  disagreement; ≥ 95 % valid completions; no primary-quality regression above 5
  percentage points; and a positive efficiency result whose 95 % bootstrap
  confidence interval excludes zero. That method is now **pre-registered in F2.1
  above as a fixed table**, which discharges the criterion's first leg — spend
  was already authorized. What a council decision cannot supply is the **two
  independent human judges**, so the *run* is transferred to
  [`stubs/road-to-discipline-default-flip.md`](../stubs/road-to-discipline-default-flip.md)
  Transfer 2. Read this as a **registered method, never a completed
  measurement**: no arm has been run, `essential-plus` appears zero times in
  `docs/benchmark.md` and zero times under `agents/evidence/`, and any claim of
  lift from this roadmap would be fabrication.
