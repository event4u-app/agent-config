---
complexity: structural
status: ready
---

# Road to inbox harvest 2026-08

> Twelve inbox artifacts triaged against the tree at `bb8360bfa`. The headline
> is not what survived — it is how little did: **roughly 60–80% of every
> substantive file is already built, already planned, or forbidden by a lock the
> file never read.** Two files are worth roadmap items, three were fixable in
> one commit, three are spent artifacts, and two are parked behind gates that
> already exist.

> Source (consumed inbox): see the per-item `Source:` lines below; each names
> its file under [`agents/tmp.old/`](../tmp.old/).
> Produced by [`/analyze:inbox`](../../src/domains/analysis-workbench/analyze/inbox/command.md),
> which this harvest also created.

## Iron Law of this harvest

```
AN INBOX FILE IS A CLAIM, NOT A FACT.
"ALREADY FIXED" AND "FORBIDDEN BY A LOCK" ARE THE MOST VALUABLE FINDINGS —
THEY PREVENT THE WHOLE ITEM. NEVER PLAN WORK OFF AN UNVERIFIED SNAPSHOT.
```

## Triage result

| Source | Genre | Disposition | Why |
|---|---|---|---|
| `feedback-9.18.1-1.txt` | 6 external release reviews | **roadmap (small)** | ~60% already built or planned; its most-repeated ask is struck by ADR-216 |
| `loops-feature.txt` | drafted 5-phase roadmap | **roadmap** | Real gap verified in code; ~90% drafted |
| `optimize-plan.txt` | drafted roadmap | **roadmap (Phase 1 only)** | Closes two named residuals; rest unproven |
| `better-handoff.txt` | competitor read | **DONE this PR** | Contradicted our own honest-null doctrine |
| `honest-critic-2.txt` | consumer-boundary audit | **DONE this PR** | Broken flag in the flagship install example |
| `cross-artifact-contradictions.txt` | PR #1150 review | **extend-existing** | 2 one-liners in one linter; unverified, see P3 |
| `claude-design.txt` | chat transcript, 4 draft versions | **3 small items only** | ~80% shipped; 2 named deps never existed; rest lock-forbidden |
| `council-q-renewal-foundation-p1.md` | consumed council question | **spent — user deletes** | Shipped verbatim; roadmap archived |
| `council-q-always-budget-reveal.md` | consumed council question | **spent — user deletes** | Option B shipped verbatim |
| `bench-local/` | bench ground truth + raw output | **spent — user deletes** | Null published, report committed, roadmap archived |
| `packages-1.txt` | 40 bare GitHub URLs | **park** | Both harvest slots occupied; cap is gate-enforced |
| `memory-mcp/` | complete unfiled roadmap pkg | **park** | Builds on the code-graph engine whose claim is a published null |

The four large chat-log audits (`better-video.txt`, `hermes.txt`,
`better-frontend.txt`, `crytical-analysis.txt`) are triaged in P5 — one narrow
roadmap slice each, and a block of cancellations where they argue against locks.

## Phase 1 — The release-review harvest (from `feedback-9.18.1-1.txt`)

Source: `agents/tmp.old/feedback-9.18.1-1.txt`. Six reviewers, one convergent
ask, and a large already-built fraction.

- [ ] **P1.1 JSON as the binding R1/R2 findings format.** The only item all six
  reviewers converge on and the only one still fully unbuilt:
  `check_completion_review.ts` parses `*.findings.md`, with `unbalanced-fence`
  and `malformed-row` as first-class violation kinds — i.e. it hand-parses
  Markdown and has defect classes *for its own parser*. **Reuse, do not invent:**
  a JSON findings shape already exists on the other track
  (`self_review_gate.ts` `{schema_version, findings[]}` with a stable sha256
  `findingId()`, plus the `check_finding_dispositions` ledger). One format, not
  a second one.
  - Acceptance: `src/scripts/schemas/review-findings.schema.json` exists and
    both tracks validate against it; Markdown becomes a rendering of the JSON.
- [ ] **P1.2 Wire the existing `risk_class` into the plan gates.** The
  adaptive-ceremony complaint ("too much ceremony for a one-file change") is
  real, and the classifier **already exists** at
  `work_engine/scoring/decision_engine.ts` — it is simply not connected to
  `planning.risk_review` / `completion_review`. An adapter, not a subsystem, and
  explicitly not a new `plan:doctor` command: the CLI budget has zero headroom.
- [ ] **P1.3 Ratchet `gate_self_test` adoption.** It exists with 4 adopters
  against 27 registered gates. Add adoption as a column in `gate-coverage.yml`
  and ratchet it. No new gate — a column on the existing one.
- [~] **P1.4 Deferred-finding owner + expiry.** Deferred. The stable-id index
  this needs was **explicitly declined** with a named revisit trigger at
  `check_review_dispositions.ts:16-22`, so this reopens a recorded decision —
  `decision-revisit-gate` applies and that is a maintainer call, not an agent's.
- [-] **P1.5 Adoption items — CANCELLED, contradicts a lock.** "Adoption is the
  only work that counts", the `first-session` concierge as P0, and re-triggering
  the harvest freeze are all struck by
  [`ADR-216`](../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
  (accepted 2026-08-05, the day *after* these reviews): external adoption is
  explicitly not a project goal, and the ADR's own `review_trigger` says do NOT
  reopen on an external-adoption signal. Also cancelled: unified findings store,
  governance-ROI dashboard, retirement engine, routing shadow mode — net-new
  governance layers the same reviews forbid elsewhere, against a capacity cap.

## Phase 2 — The self-fix loop (from `loops-feature.txt`)

Source: `agents/tmp.old/loops-feature.txt`. A finished roadmap in house style;
its central gap is verified in code.

- [ ] **P2.1 Phase 0 null-scope check first.** `recursive-verification` carries a
  TERMINAL honest null. The file's deterministic-vs-critic distinction is a
  legitimate reason the null may not bind here — but that argument is made
  *before* building, not after.
- [ ] **P2.2 Executable DoD + bounded self-fix loop.** Verified gap: the work
  engine halts to `Outcome.BLOCKED` on a red check with **no attempt counter**,
  so every red costs a user round-trip. Needs `dod.schema.json`, a `dod[]` slot
  on `refine`, an attempts/no-progress floor, and a PARTIAL honest exit.
  - Pre-registered: ≥50% halt reduction, or the loop is reverted rather than
    narrated.
- [-] **P2.3 Host-primitive phase — CANCELLED on a false premise.** It asserts
  the host ships `/goal`, `/loop` and `/schedule`. `/loop` and `/schedule` exist;
  **`/goal` does not.** Reduce to a one-line ADR noting the host overlap.

## Phase 3 — Small verified fixes

- [ ] **P3.1 `lint_abstraction_thresholds` regex + site count.** Reported: the
  cardinal branch cannot match "duplicated twice", and a header says "six
  deliberate sites" while `SITES` holds more. **Both unverified by me** — the
  site count depends on what the header counts, which I could not pin down. Two
  one-liners at most; verify before touching.
- [ ] **P3.2 Three `design-fidelity` additions** (from `claude-design.txt`, the
  only survivors of that file): capability-URL trigger pattern,
  `.claude/design-system/` trigger path, and one acceptance fixture for a
  handoff bundle on the existing "port a provided artifact" branch. Add a
  near-miss row to `ROUTING_MATRIX` with each trigger — extending that set
  without one is how an over-broad trigger lands.
- [~] **P3.3 Level A/B/C snapshot preference order** into
  `design-system-capture` — the one genuinely new idea in `claude-design.txt`,
  and independent of any bridge. Deferred: worth doing, not urgent.

## Phase 4 — The review-mechanization residuals (from `optimize-plan.txt`)

Source: `agents/tmp.old/optimize-plan.txt`. Phase 1 only; the rest is unproven.

- [ ] **P4.1 Dispatcher-owned review prompt + `prompt_hash`.** Closes a residual
  named verbatim in `docs/contracts/plan-review-gates.md`. Provider-independent.
- [ ] **P4.2 `author ≠ reviewer` in the marker grammar.** The grammar carries
  `reviewer` only; the second named residual.
- [-] **P4.3 Risk routing, council-CLI-as-R2, plan-QA pass — CANCELLED for
  now.** Unproven, and the direction-asymmetry evidence behind them is not
  verifiable here; the draft itself says to treat it as a prior only.

## Phase 5 — The four large chat-log audits

All four triaged. Same shape as the rest: heavy already-shipped fraction, and in
two cases a flagship recommendation that argues against a lock accepted *days
before the file was written*.

- [ ] **P5.1 Fix `stitch.sh --crossfade` — an advertised flag that lies.**
  `src/scripts/ai-video/stitch.sh:152` prints "not yet implemented" and then
  **silently falls through to plain concat**, so a caller who asked for a
  crossfade gets a hard cut and no error. That is worse than an unimplemented
  flag: it is a correctness bug on a shipped surface. Implement `xfade` +
  `acrossfade`, or make the flag fail loudly. Two-pass `loudnorm` is absent too.
  - The single highest-value item in the whole inbox: smallest diff, real
    user-visible wrongness, no new subsystem.
- [ ] **P5.2 `design-review-after-ui-write` rule** (from `better-frontend.txt`).
  **Zero rules currently route to `skill:design-review`** — the write-side loop
  is open, while the read-side (`ui-audit-gate`) is closed. Build it as that
  rule's twin: tier 2b, `packs: [frontend-design]`, same diff-decidable
  `ui-trivial` allowlist. Cheapest real capability gain here.
- [ ] **P5.3 Per-concern `tools:` matcher in the hook manifest** (from
  `crytical-analysis.txt`). **13 concerns fire on every single tool call.**
  A `tools:` field per concern plus a generator change is the one latency lever
  the shipped hook-repair work left open — and it matches the measured finding
  that transport dominates hook cost.
- [ ] **P5.4 `check_corpus_staleness.ts`** (from `better-frontend.txt`). The
  design corpus pins a commit last checked **2026-06-07** and declares
  `refresh_cadence: quarterly` with **zero enforcement**. Clone
  `check_reach_staleness.ts`. Pair it with a CSV integrity gate in
  `corpus-grounding/scripts/schema_validator.ts`, which today never opens a CSV
  — that gate must land *before* any re-vendor, not after.
- [ ] **P5.5 `agents/proposals/` does not exist** (from `hermes.txt`). Two
  artefacts name it as an output path. One directory closes a dangling contract.
- [~] **P5.6 God-file LOC ratchet** (from `crytical-analysis.txt`). Seven files
  confirmed oversized, plus `chat_history.ts` (2397) and `orchestrator.ts`
  (2106), with no ratchet and no roadmap. Deferred, and deliberately
  **ratchet-before-split**: splitting first is how a refactor becomes
  unreviewable.
- [-] **P5.7 CANCELLED — items that argue against locks they never read.**
  - `crytical-analysis.txt`'s **flagship** B1 ("retire tracked `dist/agent-src`")
    contradicts [`ADR-208`](../../docs/decisions/ADR-208-dist-agent-src-keep-forever.md),
    accepted **2026-08-03 — the day before the audit**, which explicitly closes
    the question ADR-201 left open.
  - Its Part D (hook latency) is **already shipped**: 164→82 ms p95, published;
    the audit's baseline is ~2× pessimistic. Part E is a **recorded rejection**
    (quota accounting is agent-switch territory). It also cites ADR-054 as a
    solution — ADR-054 is `rejected`.
  - `better-frontend.txt`'s google-fonts import is a **recorded skip**
    (ADR-061 §8, council 2026-06-07) **and** would breach the pack-size cap —
    `design-intelligence` sits at 22.63% against a 23.0% ceiling.
  - `better-video.txt` Phases 2–3 re-propose **shipped code**: `whisperx.sh`
    ships word-level transcription with diarization, and `ingest-song.sh` is a
    shipped yt-dlp wrapper. Both phases also already have owners
    (`road-to-gated-reach-followup`, `later/road-to-reach-transcribe`). Its
    ADR-126 supersede rests on a mischaracterisation: ADR-126 cancels a *router
    skill* on a null; the YouTube parking is a later amendment whose stated
    reason is "unexercised", not "absent by design".

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-06 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A cancelled item gets re-adopted from the source file | product | Five items are cancelled because a lock forbids them or their premise is false, but the source files still argue for them persuasively and will outlive this roadmap in `tmp.old/` | Every cancellation names the lock or the false premise inline (ADR-216, the missing `/goal`, ADR-088 §1) rather than saying "descoped", so a re-reader meets the reason before the argument | Phase 1 — The release-review harvest (from `feedback-9.18.1-1.txt`) |
| 2 | P1.1 invents a second findings format | implementation | The obvious implementation writes a fresh JSON schema for the review track, leaving two incompatible findings shapes — the exact fragmentation the reviewers complained about | P1.1 names the existing `self_review_gate` shape and its `findingId()` as the thing to reuse, and the acceptance criterion is that BOTH tracks validate against one schema | Phase 1 — The release-review harvest (from `feedback-9.18.1-1.txt`) |
| 3 | P2.2 ships a loop that hides failures | product | A self-fix loop that retries silently converts a visible red into an invisible one, which is worse than the round-trip it removes | Pre-registered ≥50% halt reduction with revert-not-narrate, plus a mandatory PARTIAL honest exit and a no-progress floor, all named in P2.2 | Phase 2 — The self-fix loop (from `loops-feature.txt`) |
| 4 | P3.1 acts on an unverified report | implementation | Both halves of P3.1 come from a subagent report I could NOT confirm; acting on them would repeat the failure this whole harvest exists to prevent | P3.1 states the unverified status in the step text itself and requires verification before the edit | Phase 3 — Small verified fixes |

## Blockers

### blocker: deferred-finding-decision-reopen
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1
- **What to do:** P1.4 needs a stable-finding-id index that was explicitly
  declined at `check_review_dispositions.ts:16-22` with a named revisit
  trigger. Reopening a recorded decision is a maintainer call under
  `decision-revisit-gate`, not something an agent does because a reviewer asked.
- **Resolved when:** the decision is reopened with the trigger cited, or P1.4 is
  cancelled against it.

### blocker: spent-inbox-artifacts-await-deletion
- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing
- **What to do:** four items are spent and should be removed by a human, since
  the agent reports rather than deletes: both `council-q-*.md` files (answered
  and shipped verbatim), `bench-local/` (null published, roadmap archived), and
  the byte-identical `(1).md` duplicate plus `chat.txt` inside `memory-mcp/`.
  Related finding worth a separate look: `check_council_layout` prints these as
  findings and **exits 0** — an advisory gate nobody sees, currently carrying
  ~18 permanent findings, which is the allowlist-fatigue shape this repo's own
  rules warn about.
- **Resolved when:** the files are deleted, or a reason to keep them is recorded.

## Explicitly parked

- `packages-1.txt` — a 41-repo harvest would breach the two-slot concurrency cap
  that survived ADR-216 and is mechanically enforced by
  `lint_roadmap_family_cap`. Both slots are occupied. Also: naming 40 sources in
  a tracked file runs against `source-confidentiality` — anonymize or keep local.
- `memory-mcp/` — a complete, well-built roadmap package that depends on the
  code-graph engine whose retrieval claim is a **published null**. Filing it
  without first overturning that null is a beweisrichtung error. Unparks only if
  the null is overturned.
