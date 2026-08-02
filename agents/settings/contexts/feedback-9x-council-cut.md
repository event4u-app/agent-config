# Feedback-9x disposition — council cut (2026-08-01)

Council: `anthropic/claude-sonnet-4-5` + `openai/gpt-4o`, 2-round debate,
actual cost $0.14. Artefact: a neutral disposition question built from four
operator-supplied review documents (two release reviews of 9.9.0 / 9.10.0, one
six-review consolidation, one source-level routing analysis against four public
reference suites). All load-bearing claims in the question were verified against
the repository first; the verified findings are restated below because several
review claims were already stale.

## Verified repository state (2026-08-01, do not re-verify from the reviews)

- `docs/contracts/rule-router.md:120` states verbatim: **"no runtime resolver."**
- **No hook consumes `dist/router.json`.** `user_prompt_submit` runs
  `[chat-history, verify-before-complete, minimal-safe-diff]` — state recorders only.
- Trigger-match logic exists only in `router_telemetry.ts` (corpus replay) and
  `trigger_coverage.ts` (CI floor) — offline simulation, never applied live.
- ADR-054 (decay-triggered re-state + per-prompt pointers) is **`status: proposed`**
  and unimplemented.
- `intent:` is dead schema — `router_telemetry.ts` documents it as
  "informational only — never auto-matches."
- `audit_skill_overlap.ts` still roots at `.agent-src.uncondensed/skills`, a
  directory ADR-051 emptied and which **does not exist**. No scan-scope
  assertion, not wired into CI → it scans 0 skills and reports no overlap.
  **A live silent-green gate of exactly the class `road-to-gates-that-can-fail`
  exists to kill.**
- `web-tree-sitter` + `tree-sitter-wasms` still ship as **core dependencies**
  for a permanently `enabled: false` engine.
- 28 pack manifests still carry a `version:` line — 12 under `src/domains/` and
  16 under `src/packs/`. The release-time lockstep bump was fixed for the release
  PR's own diff; the duplicated field was not removed and still bumps upstream of
  the cut (the 9.11.x fan-out touched all 16 `src/packs` manifests).
- 287 skills.
- `road-to-gates-that-can-fail`: 22 open / 3 done.

## The load-bearing verdict — D1 (runtime resolver) is barred pending evidence

Both members, both rounds, converged: the operator's stated problem ("skills and
rules do not always fire") is an **unmeasured claim**, and the prior
reminder-injection null (Δ=0 pp on both hosts, teardown pre-committed and
executed, third null in the family) **holds until a red baseline is produced**.

The written revisit condition is *"someone **produces** a scenario corpus where
the kernel-only baseline demonstrably FAILS"* — not *"someone claims"*. The
operator's complaint does describe the one shape the pilot could not test
(genuine multi-turn, >3K-token distance vs. the pilot's single-turn ~600-word
probes), so the condition is **eligible**, not satisfied.

Pre-registered evidence bar, adopted verbatim from the council:

- ≥ 5 anonymised session logs, ≥ 8 turns each;
- a kernel/tier-2 rule declared early and **manually verified as still in-context**
  at the failing turn;
- turn-by-turn token accounting proving ≥ 3K tokens of distance at the failure;
- host tier identified (if failures are weak-host-only, revisit path 2 already
  covers it and the resolver is still not the answer).

**Consequence if the corpus cannot be produced:** D1 is refused **permanently**,
ADR-054 is moved to `rejected` with the evidence attempt recorded, and the
offline matcher's fate is decided in the same pass. Building the resolver on an
assertion would set the precedent that an honest null can be overridden by
claim — the one thing the pre-committed teardown exists to prevent.

### Executed 2026-08-02 — the corpus was not produced, D1 is refused

The bar above was registered verbatim in its own commit before any data was
read, then run against 1,158 recorded sessions. 67 cleared the ≥ 8-turn gate;
547 detector hits in 12 sessions cleared both the ≥ 3K-token distance gate and
the in-context gate; independent adjudication of 67 of them — reviewers given
the verbatim rule text and the surrounding turns, not told which verdict was
wanted — confirmed **0**. **0 of a required 5 qualifying sessions.** Distances
ran from 9,464 to 727,537 tokens, so the bar's own binding condition was cleared
by a factor of three at the narrowest.

Consequently, and per the pre-commitment above:

- **D1 (the runtime resolver) is refused as designed.** No resolver code exists
  anywhere in the tree; no hook reads `dist/router.json`. The refusal is
  design-scoped, not epistemic closure — two of the three detectors were blunt,
  and the council (2026-08-02) was unanimous that "permanent" would overstate
  what a 0/67 null earns. What it *does* close is the path from a **restated
  complaint** to a built resolver. Re-opening needs a materially weaker host
  tier in the consumer set (this corpus has **no** weak-host session, so that
  path is untouched), an explicitly funded n ≈ 50/arm run, or a produced red
  baseline under any instrument.
- **ADR-054 is `rejected`**, unedited below its new Status block.
- **The two contested items gated on this same corpus fall with it.** The
  stop-event consumer for the recorded verification state was gated on a found
  gap — no gap, no consumer. The generated file→skill table was kept as the
  cheapest non-runtime answer *if* a gap appeared — no gap, not shipped. Neither
  is refused on its merits; both simply lost the evidence that would have
  justified them.
- **The offline matcher stays**, on a criterion that is not "it was nearby":
  `trigger_coverage` asserts a MUST-LOAD floor at 100% against `dist/router.json`
  and is gated in CI via `task test`; `router_telemetry` feeds the value
  dashboard. Both serve the **projection-time** router this package actually
  ships. Neither was resolver scaffolding, so rejecting the resolver does not
  reach them.

Report: [`activation-red-baseline`](../../evidence/analysis/activation-red-baseline.md).
Bar: [`activation-red-baseline-preregistration`](../../evidence/analysis/activation-red-baseline-preregistration.md).

One finding worth carrying forward beyond this decision: the out-of-scope-edit
detector, which tried to make *"every modified file must be directly required by
the task"* mechanically checkable, scored a **100% false-positive rate**. Its
proxy could not represent the task, and no string-matching test that cannot
represent the task will do better. Any future gate built on "detect the
out-of-scope edit" should expect the same result.

## Adopted

| Item | Disposition | Note |
|---|---|---|
| Fix `audit_skill_overlap` root + scan assertion | **Defect, not feature** | Both members; gpt-4o flipped in R2 to agree it must precede any skill merge |
| Physical removal of the dead engine's core deps | Adopt | "Apply the operator's own rule to the operator's own code" |
| Remove `intent:` from the schema | Adopt — **remove, do not implement** | Both members chose removal over building a fourth activation instrument |
| Per-pack `version:` removal | Adopt | completes a half-fix |
| Scan-scope assertions for every checker | Adopt (already owned by `road-to-gates-that-can-fail`) | no new roadmap |
| Skill merges + description disambiguation | Adopt, **hard-gated** on the overlap tool being fixed and the pairs re-confirmed by the canonical tool | the external report selects; the canonical tool confirms |
| Tag-aware release lint | Adopt | a 179-commit release lint-checked 0 skills and reported INCONCLUSIVE |

## Refused (recorded refusals — do not re-plan without the named trigger)

- **Fact-forcing gate** (first Edit/Write per file blocked until investigation
  facts are presented). Judged *enforcement-first architecture wearing a
  settings-knob disguise* — the locked refusal against replacing rule prose with
  compiled enforcement applies. Two sibling blocking gates already shipping is
  technical debt, not a licence for a third.
- **Implementing `intent:` matching.** Removal instead.
- **The full memory default-on checklist** (list/inspect/forget/export commands,
  per-entry provenance + confidence + TTL, observed→candidate→confirmed→
  contradicted state model, adversarial pass). Council: that checklist is what a
  **public API** requires; for an internal-only, single-maintainer package the
  operator inspects the store directly. Re-open trigger: the external-adoption
  question being explicitly re-opened (currently out of scope by operator
  decision).
  - **Checked before accepting the refusal:** the one checklist item that would
    have been a safety floor regardless of adoption — a secret/PII write-gate on
    memory intake — **already ships**. `_lib/user_global_observations.ts` runs
    `redaction_scan` on every capture and *refuses outright* rather than
    redacting-then-storing (the low-impact-corpus discipline applied to memory),
    and `mine_session.ts` carries its own redaction gate. No carve-out from the
    refusal is needed; the whole checklist stays refused.
- **Machine-readable gate manifest + gate mutation tests.** "Governance about
  governance"; the scan-scope assertion already kills the class.
- **Anything justified by external adoption** — launch, taster plugins, registry
  submissions, recruiting external testers, adoption deadlines. Several review
  documents make an adoption deadline their top phase; the operator ruled this
  out of scope. Two of the four documents' Phase 0 is therefore dropped wholesale.

## The R2 self-correction worth keeping

The strongest round-2 argument was against round 1's own adoption list: a plan
that "removes 14 items and adopts 5" claims net −9 only against a fictional
baseline of *adopt-everything*. **The real baseline is the current repository.**
Refusing to build something is staying at zero, not shrinking. Only physical
deletion shrinks. Every roadmap below therefore states its surface delta as
components **added minus components deleted**, against today's tree.

The same round also produced the best alternative to a runtime resolver: the
zero-hook reference suite solves "the agent forgot" by **writing the next
obligation into a file in the project**, not by injecting a reminder at prompt
time. If a red baseline is ever found, written-down state is the first candidate
and the resolver is the second.

## Contested, resolved by the maintainer

- **Stop-event consumer for the recorded verification state** (the state file is
  written today and nothing reads it). R1 adopted it as the highest
  effort/value item; R2 argued it fails the *same* evidence standard it applies
  to D1 — a warning built on an unmeasured belief that agents claim done without
  verifying, with the same habituation failure mode. Resolved: **gated on the
  same corpus** as D1, and if a gap is found the written-down-state variant is
  tried before a new hook concern.
- **Generated file→skill table in the projected root files.** Static text, no
  hook, no host support needed, derived from the router's path-shaped triggers
  (~44 raw rows → ~12 at consumer scope). R1 did not adopt it; gpt-4o deferred it
  on complexity-vs-need. Resolved: **kept in the same evidence-gated roadmap** as
  the cheapest non-runtime answer, not shipped speculatively.
