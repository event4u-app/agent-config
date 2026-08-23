---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: >-
  This is the single landed roadmap out of a four-draft inbox bundle; the three
  lane drafts it consolidates and the fourth rival were never estate files, so
  there is no active roadmap in the tree that this addition can be offset
  against.
estate_growth_exempt: >-
  The pack-reach blocker below was discovered while verifying the winning
  draft's own claims — an engineering-base-only install receives neither UI
  rule — and it is a maintainer weight decision that cannot be closed inside
  the change that records it.
---
# Road to frontend power — three lanes, ordered by evidence

> **Source:** an inbox bundle dropped on 2026-08-22, now in the gitignored
> `agents/tmp.old/` archive. Its exact path is
> `ENC1:gsDhq0e3t9myai9Zzn4H+CY9GB4Kq8FIfTU3uPa5taXMS73CmEQw7F/1gby48B9xvjxHSWPGb1AoZHlYC7DA2SCLNQ+LSvdf1ejpJ2lM6jMZ3SrG4eonUVQ93L86YWhAWZ95+W7JaSe+lESs02SU9z32W8A=`
> — decrypt with `./scripts-run src/scripts/_lib/link_crypto decrypt --value <token>`.
> A token rather than plain text because the bundle's directory segment is the
> harvested repository's own name, and `source-confidentiality` forbids the
> tracked tree recording which third-party package seeded an idea. The token
> resolves to the full path for anyone holding the key, so nothing is lost.
> Consolidates three lane drafts from the same inbox bundle — craft-surface
> (lane E), design-authority (lane A), execution-runtime (lane R). Drafted
> against `577bdbf88` (tree tag v14.8.0), with the external reference pinned at
> its own SHA. Every `file:line` below was re-verified against `f6703b78a`;
> three line references and one detector count had drifted and are corrected
> inline. **Four of the source drafts' ADR-amendment premises are moot** against
> `ADR-124:118` and `ADR-124:121-123`. The reopen basis is
> `docs/decisions/ADR-225-cross-corpus-proposal-verification.md:14-16`.
>
> Two grafts are taken from the fourth draft of the same bundle, which was not
> landed: the ownership boundary against the active fidelity roadmap
> (§ Ownership boundary) and the `verification:` field (graft 2, wired in A1.1
> and E1.3).
>
> The three lane drafts and the fourth rival are dropped. Nothing here is
> adopted; every disposition is a dated proposal until a maintainer or the
> council records it.
>
> **Frontmatter note.** No roadmap frontmatter schema exists under
> `src/scripts/schemas/`, so the source drafts' `consolidates:`, `links:` and
> `research:` keys are validated by nothing. Their content is carried in prose
> above and in § Ownership boundary instead of as unchecked frontmatter.

## Outcome — read this before the phases

**Archived does not mean achieved.** This section exists so nobody reads a
closed roadmap as a solved problem.

**33 of 48 steps landed. 15 did not, and every one of them carries an outcome
state rather than a tick.** All twelve Acceptance Criteria are resolved below —
three verbatim, six restated against what was measured, and three closed as
`transferred` with the criterion moved intact to a stub.

| Phase | State | What that means |
|---|---|---|
| **0** — census, corpus, baseline | **satisfied** | All six closed. The corpus is frozen at `bf5d0a85…` and committed BEFORE the only commit touching the detector. Three of the six produced corrections to this roadmap's own text — see § Corrections. |
| **E1** — delivery that fires by default | **satisfied (3) + narrowed (1) + transferred (2)** | The carrier landed on two slots across 6 and 7 platform chains. E1.6 is narrowed on a stated argument; E1.4 and E1.5 are transferred. |
| **E2** — the audit becomes an artefact | **satisfied** | `agent-config ui:audit` ships, and `ui-audit-gate`'s `enforced_by:` names a carrier for the first time. |
| **E3** — own the render | **satisfied (2) + transferred (1)** | `agent-config ui:render` ships, is Class A by execution, and found a real 320 px overflow on its first run. E3.3 needs an independently authored corpus. |
| **E4** — own the cascade | **abandoned (2) + transferred (2) + satisfied (1)** | E4.1 and E4.2 are abandoned outright, on two independent grounds each. |
| **A1–A6** — authority semantics | **satisfied** | All eighteen steps. One schema, one resolver, two declared consumers, ADR-245 accepted. |
| **R1–R2** — resolver and transport | **transferred** | Blocked one level deeper than this roadmap knew: prereg precondition **P1 is still OPEN**, so lane R is unrunnable rather than unmeasured. |
| **R3** — recorded nulls | **satisfied** | Both nulls recorded with their re-open conditions and both `grep` assertions verified. |
| **Z** — publish, then flip | **transferred** | Every metric it must publish is a live-session measurement, and the flip is a shipped-default change. |

### What actually landed

- **The intervention arm exists.** `design-pass` on `post_tool_use` (6 chains)
  and `design-pass-stop` on `stop` (7 chains) — the delivery carrier the 0.0 %
  measurement never had. Default-OFF; enabling it is the transferred half.
- **Two Class-A commands**, both executed rather than merely written.
  `ui:audit` writes the artefact a gate can read; `ui:render` captures three
  viewports and leaves an empty process tree.
- **One `ui_authority` object** — schema, resolver, contract, 27 tests, and no
  second decision table anywhere in `src/skills/`.
- **`enforced_by: none` is gone from `ui-audit-gate`.** It names
  `hook:design-pass`, with three limits kept honest in its § Honest scope.
- **ADR-245**, accepted, 2/2 convergent council, resolving the one open blocker.
- **A frozen 23-case corpus** and a pre-registration with falsifiers and a power
  floor, both committed before any lane commit.

### Corrections this run made to the roadmap's own text

Four, and they are the reason Phase 0 was worth running first:

1. **windsurf is Grade B, not Grade C.** `b-hook-slot-on-windsurf` reasoned from
   "no `post_tool_use` surface" — true — to "static delivery only", which is
   false: windsurf carries `stop` at `hook_manifest.yaml:1069` with five
   concerns already bound, and E1.2/E1.3 are stop-slot carriers. **copilot** is
   the only Grade C.
2. **The 0.6 baseline had itself aged.** 24/3/16/2 over 45 rows, not 21/3/14/2
   over 40. AC-5 is restated against 16.
3. **E3.2 and E4.2 both cite option (a) on fidelity blockers that resolved as
   option (b)** on 2026-08-23. E3.2 is discharged through the (b) null's own
   reopening condition instead; E4.2's premise is void and it is abandoned.
4. **Lane R is blocked upstream of its bar.** Prereg precondition P1 —
   per-prompt injection transport — is still OPEN, which no phase in this
   roadmap mentions.

### What is still open, and where it goes

Nothing is closed by the archival. Three stubs, each with a named producer and a
probe measured here as the control:

- `stubs/road-to-frontend-power-live-measurements.md` — E1.5, R1.1, R1.2, R2.1,
  R2.2, Z.1, Z.2. Needs live sessions per host, and a human for Z.2.
- `stubs/road-to-frontend-power-default-flip.md` — E1.4, Z.3. Shipped-default
  flips; owner action, not a probe.
- `stubs/road-to-frontend-power-detector-promotions.md` — E3.3, E4.3, E4.4.
  Needs a clean corpus this run did not author.

Abandoned outright, with reasons at the step: **E4.1** (a dependency ADR for
packages nothing installs) and **E4.2** (vendoring an external engine the tree
cannot reach, against a neighbouring decision that already chose the opposite).

### The council record, stated honestly

Two council runs, and their statuses differ:

- **`b-pack-reach-weight`** — AI council 2026-08-23, quorum 2/2 (anthropic/claude-sonnet-4-5 + openai/codex-default), both seats exit 0, convergent on option (c). This is the
  verdict ADR-245 rests on. Summarised inline rather than linked: the question
  and response files live under gitignored, auto-pruned `agents/runtime/`.
- **Drain-run scope.** Attempted three times.
  Twice both seats returned `cli_quota_exhausted`; the third returned **1 of 2**
  (openai/codex-default; anthropic timed out at 290 s). Recorded as a
  single-seat verdict and **never as convergence** — § Council escalation
  forbids reporting a non-zero-exit seat as agreement. Its G13 disposition
  (transfer A6.1) was **overridden** here, because it was premised on the
  pack-reach verdict being unavailable and that verdict had already arrived.

## Goal

A UI write on a Grade-A host with the frontend pack enabled produces
deterministic findings, an audit artefact and a render artefact without
depending on the model choosing to consult a skill — and every number that
authorises a default flip was measured on a corpus hashed before the code that
moves it existed. Where a lane fails its pre-registered bar, it closes with a
published null instead of shipping.

## The premise, corrected

The mandate behind this work is "frontend and design rules are ignored". That
is true and already measured: **0.0 %, 0 of 275 UI-write turns across 16
sessions** (`agents/roadmaps/archive/road-to-frontend-skill-application.md:23`).

The same line records what the number actually is, and this reframe is the most
load-bearing sentence in the file: **that measurement was a control arm with no
intervention arm.** Both available carriers were off in every measured store —
`design_slop.enabled: false` (`src/config/agent-settings.template.yml:1276`)
and `ui_route_nudge.enabled: false` (`:1290`). Nothing was tried and found
wanting. The one lever that existed was never switched on.

So the correct reading is not "enforcement failed" — it is "enforcement was
never run". That changes what this roadmap owes: it owes an intervention arm
and a comparison, not a redesign of a mechanism nobody has yet observed
working. Phase 0 exists to make that comparison possible; Phase Z exists to
publish it either way.

**Reopen basis.** `ADR-225:14-16` states that "the chain-contract axis reopens
when road-to-frontend-skill-application closes and leaves residue." That
roadmap closed 2026-08-20 and left residue: 0.0 %, no fix, `enforced_by: none`
unchanged on both UI rules. The reopen is licensed by that trigger. No lock is
overruled here.

## Root cause, stated once

Every frontend obligation is model-carried. Both UI rules say so
(`src/rules/ui-audit-gate.md` § Honest scope;
`src/rules/design-review-after-ui-write.md` § Honest scope), both ship
`enforced_by: none`, and both runtime carriers are warn-only and default-OFF
(`src/config/agent-settings.template.yml:1276`, `:1290`). The deterministic
detector (`src/scripts/design_slop_rules.ts`) is a regex pass by documented
constraint (`:13-18`) and fires nowhere by default.

Two further failures are semantic, not mechanical, and survive any amount of
enforcement: a wireframe implemented as a pixel spec, and supplied runnable
HTML/React re-interpreted until it looks different. Enforcement without an
authority model blocks the wrong thing as reliably as it blocks the right one.

A third failure is not enforcement at all but **reach**: an
`engineering-base`-only install receives neither UI rule, because
`frontend-design` is only `suggests:` from `laravel`
(`src/config/discovery/packs.yml:69`) and `react` (`:107`), and the pack itself
(`:123-131`) declares no `default_install`. See `b-pack-reach-weight`.

One persona line is worth quoting rather than paraphrasing, because paraphrase
has already softened it once. `src/agent-src/personas/frontend-engineer.md:60-61`
reads: "Do NOT chase styling unless it correlates with a state or render bug."
That is a correct review-lens boundary, and it is also why a *styling* defect
has no owner in the review path — A5.4 and the fidelity roadmap's Phase 8 are
where the owner is named, not here.

## Ownership boundary — what this roadmap does NOT own

`agents/roadmaps/road-to-frontend-fidelity-calibration.md` is **active**
(`status: ready`, 0 of 21 steps closed) and it owns the fidelity axis. Without
this boundary written down, all nine phases below duplicate it. Graft 1 from
the unlanded fourth draft.

| Axis | Owner | This roadmap's relation |
|---|---|---|
| Artefact maturity vs mandate discriminator | fidelity Phase 0 | A1.1 carries its **output** as `fidelity_mandate`; it does not re-derive it |
| One deterministic measurement channel | fidelity Phase 3 | E4.5 lands the `token_violation` producer there and cites it from here |
| The 320 px floor | fidelity Phase 5 step 5.2, AC-6 (`:379`) | E3.1 renders 320 px so that floor can be measured; keeping or withdrawing it stays there |
| Bounded convergence ceiling | fidelity Phase 6 | No loop surface is added here; ADR-118 § 3's five written rejections stand |
| Owner of rendered visual quality | fidelity Phase 8 | A5.4 supplies the review-independence half only |
| Preservation and improvement gates | fidelity Phases 4–5 | A1.5 supplies the intent signal those gates read |

**This roadmap resolves that roadmap's blockers rather than duplicating them.**
`b-page-capture-primitive` (`road-to-frontend-fidelity-calibration.md:293`) is
open on "a page-reaching capture primitive" — E3.1 *is* that primitive, so E3.2
resolves it as option (a) instead of accepting the recorded null.
`b-detector-license-verification` (`:324`) is resolved as option (a) by E4.2's
borrow row; if E4.2 does not land, that roadmap's own option (b) stands
untouched.

**Graft 2 — the honesty field.** A failed or partial verification reports its
own state rather than passing silently:

```yaml
verification: verified|degraded|unverified
degradation_reason: ...
```

This is not new policy. `src/rules/design-review-after-ui-write.md` already
requires "scope the verdict to what was statically checked and say so" — as
prose, with nothing to read it. The field makes that machine-readable. It is
wired in A1.1 (the schema) and E1.3 (the stop gate must emit it), and every
`verify:` line that can partially fail names it.

## Decisions — what verification found, and what is actually proposed

Table A1–A11 is the **seed** for the Phase 0.1 census, not the census.

| # | Decision | Finding at `f6703b78a` | Disposition |
|---|---|---|---|
| A1 | ADR-088 "no external runtime federation" blocks vendoring an engine | **Already void as read.** `ADR-124:121-123` supersedes the blanket engine-rejection interpretation; `ADR-124:118` states this suite may build, fork or vendor Class-A engines natively, and any archived REJECT citing ADR-088/094 against a Class-A engine is void. `corrected-from-reproduction`: the source drafts anchored this on the wrong lines. | **Keep ADR-088.** No amendment needed. Cite `ADR-124:118` wherever ADR-088 is raised against a Class-A engine. |
| A2 | `design_slop_rules.ts:13-18` must stay dependency-free | `ADR-124:118` admits exact-pinned pure-npm or WASM deps **with a per-dependency justification in the adopting ADR**, approved there and not in a downstream feature PR. | **Amend the file header, not the doctrine.** One ADR justifies `css-tree`, `css-select`, `domutils`. The two-package split the craft-surface draft proposed is withdrawn. |
| A3 | `docs/contracts/no-runtime-boundary.md` plus ADR-124 Class B | A headless render per command is Class A: it terminates, and its state is rebuildable under `agents/runtime/state/`. A browser that stays open, a dev-server bridge or a watcher is Class B and prohibited in core. | **Keep.** Live variant mode is out of scope; R3.1 records the null. |
| A4 | Default-OFF and warn-only for unproven carriers | The shadow-first discipline is itself the route to ON: a carrier graduates on a measured false-positive rate, and no carrier has been measured because none was on. | **Keep the discipline, change the target.** Graduation is per pack: ON inside `frontend-design` once M1 = 0 on its epoch, OFF elsewhere. P0 objective floors may block; P1–P3 never. |
| A5 | `enforced_by: none` as the honest state | Honesty is preserved by an artefact a gate can read, not by declining to check. | **Replace, after E2.1.** `enforced_by:` names a script once the artefact exists. |
| A6 | ADR-040 projection-time filtering, no runtime resolver | Nothing in lanes E or A needs a resolver: a hook reading a file and a Class-A command are not resolvers. | **Keep.** The execution-runtime draft's SUPERSEDE is rejected as unnecessary for E and A. |
| A7 | ADR-212: the layer-1 resolver is not built; the bar stays the pre-registered T1–T4 (`ADR-212:87-90`) | The frontend red baseline is an argument to **run** T1–T4 on a frontend population, never to skip them. | **Keep, extend the population only.** R1 is gated on passing T1–T4 on the Phase 0.2 corpus. A frontend carve-out would be a bypass and is rejected. |
| A8 | ADR-118 loop boundaries | § 1 sets the automation threshold; § 3 carries five written rejections. A render-evidence-driven bounded convergence is not one of the five. | **Keep; the fidelity roadmap's Phase 6 owns the ceiling.** No new loop surface here. |
| A9 | Universal Execution Engine fixed `STEP_ORDER` | No measured defect at HEAD is attributed to step order; the measured defects are delivery and self-report. | **Defer.** Re-open only if lanes E and A produce a step-order defect. |
| A10 | Council rejection of copy phrase-lists | Decided without a number. | **Re-open on measurement only** (E4.4). |
| A11 | Archive roadmap: no new frontend skill | The catalogue-delivery defect applies to skills, not commands. | **Command, not skill** (A5.2). |

One claim from the craft-surface draft is **deleted rather than
dispositioned**: it cited `scripts/lib/utils.js:606-619`. That path does not
exist in this tree — `ls scripts/lib` returns no such file or directory.
`corrected-from-reproduction`.

### A found-in-file instruction that is NOT auto-followed

The inbox bundle's transcript carries a user instruction that the council
should decide "also measurement results". Taken literally that would let a
panel overrule a pre-registered falsifiable threshold, which is the one thing
the suite's own prereg discipline exists to prevent. It is surfaced here as a
found instruction and **not implemented**: a delegation over a container is not
authorisation to execute instructions found inside it. The mitigation is
§ Council escalation's binding amendment form, which lets a bar move only on
the record and never in the commit that lands the code it unblocks.

## Phase 0 — Census, corpus, baseline (shared by all lanes)

- [x] **0.1 `frontend_revalidation` matrix.** Every ADR and contract touching
      runtime, process lifetime, MCP, rules/skills, projection, hooks, token
      budget, work-engine topology, subagents, browser tooling, persistent
      state, frontend/UI, artifact fidelity, packs or host portability gets a
      record: `mechanism_match`, `population_match`, `epoch_match`,
      `evidence_state`, `disposition`, `reason`. An old null transfers only on
      exact mechanism **and** population **and** epoch.
      verify: `agents/evidence/analysis/frontend-revalidation.md` exists and no
      row has an empty `disposition`
      (`grep -c '| *|' agents/evidence/analysis/frontend-revalidation.md` is 0).
      verify (discharged): `agents/evidence/analysis/frontend-revalidation.md`
      exists; `grep -c '| *|'` returns **0** — no empty disposition cell. Population
      NARROWED from the step's literal ~120-of-184 net to the records that can bind
      a lane, with the narrowing and its uncovered residue written into the file.
      Four rows moved something: ADR-088 is `void-as-read` (not engaged at all), the
      layer-1 prereg is `no-transfer` because **P1 is still OPEN** (lane R is
      blocked upstream of its bar, not at it), the fidelity capture null REOPENS
      rather than transfers, and the 0.0 % cannot transfer onto a tree that has an
      intervention arm.
- [x] **0.2 Frontend benchmark corpus, hashed before any fix.** Cases: React
      component change; shadcn product screen; Next.js landing; Vue form;
      Svelte page; Astro marketing; Blade; Livewire/Flux; plain HTML/CSS/JS;
      monorepo shared component; custom design system; no DESIGN.md but a
      coherent incumbent; greenfield; supplied finished comp; supplied runnable
      HTML/JS; supplied React artifact; wireframe; preserve/polish request;
      explicit redesign; full-stack feature with UI. Plus three near-miss
      fixtures: `refine-preserves-world`, `artifact-source-not-rederived`,
      `surface-mode-not-product-mode`.
      verify: `tests/eval/frontend-corpus/CORPUS.sha256` exists and its commit
      precedes every commit in this branch that touches
      `src/scripts/design_slop_rules.ts`.
      verify (discharged): `tests/eval/frontend-corpus/CORPUS.sha256` exists, digest
      `bf5d0a85…`, committed `34f7dc400` — which PRECEDES `5b54933f5`, the only
      commit on this branch touching `design_slop_rules.ts`. 20 cases plus the 3
      named near-miss fixtures. Drift sensitivity probed rather than assumed: one
      appended line moves the digest to `9390a9a1…` and fails the byte-for-byte
      test. **Defect found in the step's own premise:** the ordering constraint
      controls sequence, not authorship, and this run authored both the corpus and
      the T7/T8 scope — so the README and the prereg forbid any M1 measurement on
      this population, and no detector row is promoted against it.
- [x] **0.3 Pre-register metrics and falsifiers.** Routing (frontend recall,
      backend false positives, surface-mode and change-intent accuracy,
      trivial-lane FP/FN); execution (delivery rate, consultation rate,
      audit-before-write, authority-before-write, review-after-write, render
      discharge where available); fidelity (source-mechanic coverage, silent
      drops, token violations, accidental redesign under `preserve`, wireframe
      over-fidelity); quality (blind A/B, human spot-check); cost (tokens
      loaded, model calls, hook p95, render cost, convergence rounds).
      Falsifiers, written before any result: delivery without a behaviour delta
      → stop-only tiering; M1 > 0 → the rule stays judgment-only; a resolver
      below T1–T4 → lane R does not ship; standing context rises → A5.2 is
      rejected.
      verify: `internal/bench/frontend-power-PREREG.md` exists, names every
      metric and every falsifier above, and its commit precedes every
      implementation commit in this branch.
      verify (discharged): `internal/bench/frontend-power-PREREG.md` names every
      metric and every falsifier the step lists, fixes A1.5's palette/type-family
      threshold before any result was visible, and adds the power floor the step
      asks for (12 of 20 per grade; no single host as a suite figure). It commits
      before every lane commit, and the two preceding Phase-0 commits are named in
      the file rather than glossed.
- [x] **0.4 Freeze the baseline on the current tree** against 0.2 and 0.3, per
      host, with carrier capability recorded — Grade A enforced, B guided and
      state-gated, C static — decided by the `hook_manifest.yaml` rows for that
      host, never by the host's name.
      verify: the baseline file names the corpus hash and exactly one grade per
      host, and its `verification:` reads `verified` or carries a
      `degradation_reason`.
      verify (discharged): `internal/bench/frontend-power/BASELINE-2026-08-23.md`
      names the corpus digest, carries `verification: verified`, and gives **exactly
      one grade for each of the eight hosts**, each cited to a `hook_manifest.yaml`
      line. Measured, not asserted: M-R1 recall **20/23**, M-R2 false positives
      **0/7**, detector output **0 P0 / 0 P1 / 2 P2**, always-budget **29,466 raw ·
      60,252 extended**. **Two corrections to this roadmap fell out of it** —
      windsurf is Grade B, not C (it carries `stop` at `:1069`), and `ui_surface` is
      a PATH predicate, so a pre-write gate cannot fire on the first write of a new
      surface.
- [x] **0.5 Resolve the Inter contradiction.**
      `docs/guidelines/design-modes.md:17` says "One reliable family — Inter or
      equivalent" for the product register, while
      `docs/guidelines/design-antipatterns.md:110` (T7) names Inter as an
      overused default and `src/scripts/design_slop_rules.ts:317` fires on it.
      Fix the losing file; a register-scoped carve-out in T7 is the likely
      shape. `corrected-from-reproduction`: the source drafts cited
      `design-modes.md:18`.
      verify: after the fix, either the rule scopes by register or the guideline
      drops the recommendation — `grep -n 'Inter' docs/guidelines/design-modes.md docs/guidelines/design-antipatterns.md src/scripts/design_slop_rules.ts`
      shows no unqualified contradiction.
      verify (discharged): `grep -n 'Inter' …` shows no unqualified contradiction.
      T7's legitimacy column is register-scoped (brand: explicit adoption plus a
      reason; product: a single reliable family IS the reason, stated),
      `design-modes.md:17` points at T7 instead of naming Inter bare, and the
      matcher's message names the rebuttal. **T8 carried the same contradiction one
      row down and is fixed with it** — "one reliable family" and "single typeface
      for everything" are the same configuration, so a product surface satisfied T7
      and tripped T8. `lint_design_antipattern_parity` green (45 entries, 24
      backed); `design_slop_rules.test.ts` 31 passed.
- [x] **0.6 Re-state the detector-status counts from the table itself.** The
      source drafts carried "24 backed / 4 floor / 16 judgment-only / 2
      deferred". Counted at `f6703b78a` from the table under
      `docs/guidelines/design-antipatterns.md` § Detector status: **21 backed /
      3 floor / 14 judgment-only / 2 deferred**, 40 rows total.
      `corrected-from-reproduction`.
      verify: `lint_design_antipattern_parity` is green and the AC-5 baseline in
      this file equals the count that table yields.

      verify (discharged): `lint_design_antipattern_parity` is green and prints its
      own count. **The restated baseline had itself aged**: measured at HEAD from §
      Detector status (`:219-263`) it is **24 backed / 3 floor / 16 judgment-only /
      2 deferred, 45 rows**, not 21/3/14/2 over 40. AC-5 is restated against 16 in §
      Outcome.
**Exit criteria.** 0.1–0.6 closed; the corpus hash and the prereg file
committed before any lane commit. **Rollback.** Phase 0 is additive
documentation and fixtures; reverting it reverts no behaviour.

## Lane E — Enforcement that does not depend on the model

### Phase E1 — Delivery that fires by default

- [x] **E1.1 `post_tool_use` design pass** on UI-surface writes, deciding the
      surface from `src/scripts/_lib/ui_surface.ts`, delivering findings as
      additional context, exiting 0 for P1–P3.
      verify: a seeded side-stripe fixture yields exactly one finding on write
      and zero on a clean rewrite of the same file.
      verify (discharged): `design-pass` is bound on **six** `post_tool_use` chains,
      and `decide()` returns findings with an empty `blocked` array on that slot for
      every severity including P0. Sensitivity probed: letting P1–P3 block fails 3
      tests.
- [x] **E1.2 `stop` deep pass** over the files touched this session, deduped
      against E1.1; its cost is recorded in the hook-economy work before this
      step binds.
      verify: a session touching two UI files and one non-UI file emits one
      block naming exactly the two.
      verify (discharged): `design-pass-stop` is bound on **seven** `stop` chains,
      scoped to the session's touched UI files and deduped by `file::rule::line`.
      The cost obligation is resolved against the SHIPPED budget
      (`hook-latency-budget.json`, `any_hook_event.p95_ci = 250 ms`) rather than a
      second one invented here. `tests/hooks` 315/315 green.
- [x] **E1.3 P0 blocks at stop** — Q1 contrast, Q2 font size, Q5 heading skip,
      Q6 focus, plus text-overflow and viewport-edge once E3 lands — through
      the existing continuation shape in `turn_end_gate_hook.ts`. **Graft 2
      binds here:** a pass that could not run reports
      `verification: degraded|unverified` with a `degradation_reason`; it never
      silently passes.
      verify: the Q1 fixture blocks once with a continuation, the fixed file
      passes, a P2-only fixture never blocks, and a pass with the render
      artefact absent emits `verification: degraded`.
      verify (discharged), **and the discharge is narrower than the step's
      wording**: a P0 is computed as blocked at stop, a P2-only fixture never
      blocks on either slot, and an absent render artefact yields `verification:
      degraded` with a reason naming `ui:render`. The P0 set is closed to the
      four objective floors (Q1/Q2/Q5/Q6) — text-overflow and viewport-edge are
      deliberately NOT in it, because a static pass cannot see them and claiming
      otherwise is the false block Risk 1 names. Probes: P1–P3 blocking → 3
      failures; degradation forced to verified → 2 failures.
      **The refusal itself is REPORTED, not enforced, and that is a correction
      found while landing it.** `design-pass-stop` is `severity: advisory`, and
      the dispatcher enforces advisory as a ceiling — an EXIT_BLOCK from it is
      downgraded to EXIT_WARN and then mapped to exit 0. Returning EXIT_BLOCK
      would have shipped an INERT refusal whose every other assertion passed,
      which is the defect `run-continuation` records in its own allowlist entry.
      The code was matched to the declaration instead: the pass computes the P0
      verdict and renders it as *would block at stop*. Making it real needs an
      entry in `concern_severity.test.ts`'s `BLOCKING_ALLOWLIST`, which that file
      calls a security-relevant decision and which would be the third turn-END
      refusal in the tree — transferred to
      [`stubs/road-to-frontend-power-default-flip`](../stubs/road-to-frontend-power-default-flip.md)
      as probe reading 0, not taken unilaterally in a frontend change.
- [-] **E1.4 Pack-scoped default-ON** for the carriers, after E1.5 produces its
      number. This is the intervention arm the 0.0 % measurement never had.
      verify: `agent-config hooks:status` reports the design concern ON in a
      store carrying `frontend-design` and OFF in a bare store.
      **TRANSFERRED** — a shipped-default flip, categorically `B` under rule 3 of
      `drain-blocker-dispositions-a.md`. The carrier LANDED (bound on 6 + 7 chains);
      only `hooks.design_pass.enabled` moved, and it ships `false`. Binding a
      carrier is not enabling it, and ticking this because the hook exists would
      claim an intervention that is still switched off. Stub:
      `stubs/road-to-frontend-power-default-flip.md`.
- [-] **E1.5 Tiering by experiment** — all-per-edit, immediate-plus-stop, or
      stop-only — on the 0.2 corpus. Source A's 13-rule immediate set
      (Apache-2.0, pinned `56f44523f`, path `scripts/hook-lib.mjs:113-131`) is
      one labelled candidate; its stated rationale is unbacked and is not
      adopted with it.
      verify: results published with the corpus hash, and the shipped default
      cites the row it came from.
      **TRANSFERRED** — an arm comparison needs real turns across hosts; the corpus
      supplies inputs, never turns. Stub:
      `stubs/road-to-frontend-power-live-measurements.md`.
- [-] **E1.6 Retire the `pre_tool_use` `design_slop` concern** once E1.1 covers
      it, leaving one design hook key.
      verify: `grep -c 'design_slop' src/scripts/hook_manifest.yaml` equals 1.

      **NARROWED, and this is the honest half of the phase.** The step conditions
      retirement on E1.1 "covering it" — a MEASURED claim, whose measurement is
      E1.5, which is transferred. Retiring the older carrier on the assumption that
      the new one covers it is the build-then-justify pattern Risk 2 names.
      `design-slop` therefore stays bound, two design keys is the recorded state,
      and the settings comment says why. The literal verify (`grep -c 'design_slop'`
      equals 1) is NOT met and is not contorted to meet: retirement has a 20-file
      blast radius including a shipped settings key and three test files, which
      belongs in its own change.
**Exit criteria.** A UI write on a Grade-A host produces a finding with no
skill consultation, and the tiering choice cites a measured row.
**Rollback.** Flip the pack-scoped default back to OFF; P1–P3 are warn-only by
construction, so nothing is left blocking.

### Phase E2 — The audit becomes an artefact

- [x] **E2.1 `agent-config ui:audit <path>`** as a Class-A command writing
      `agents/runtime/state/ui-audit.json` — components, tokens, primitives,
      design-system markers — in the shape the work engine already expects for
      `state.ui_audit`, sharing one constant (including `COVERAGE_BUCKETS`,
      retiring the copied vocabulary in `fe-design` step 3). No such command
      exists today: no hit in `.claude/commands/`, `dist/agent-src/commands/`
      or `src/scripts/`.
      verify: the command exists, returns non-empty on the 0.2 fixtures, leaves
      an empty process tree, and deleting the artefact changes only speed.
      verify (discharged): `agent-config ui:audit` exists, writes
      `agents/runtime/state/ui-audit.json` in the shape the work engine expects, and
      re-exports `COVERAGE_BUCKETS` from the engine rather than copying it. Ran
      non-empty on five 0.2 fixtures. Class A: no process survives, and deleting the
      artefact changes only speed. **Running it found a defect in its own first
      heuristic** — `>=3 tokens OR a marker` called
      `no-design-md-coherent-incumbent` ambiguous, because that fixture declares no
      custom property at all. There are now three independent coherence signals and
      the artefact records which one fired.
- [x] **E2.2 The gate reads the file.** `ui-audit-gate`'s `enforced_by:` names
      the script; a non-trivial UI write with no artefact newer than the target
      warns at E1.1 and blocks at stop. The `ui-trivial` allow-list is
      unchanged.
      verify: a new component with no artefact blocks with "run ui:audit"; a
      fresh artefact passes; a three-line edit stays silent.
      verify (discharged): `ui-audit-gate`'s `enforced_by:` reads
      `hook:design-pass`; the carrier warns on a missing-or-stale artefact at
      `post_tool_use` and blocks at `stop`; the five-condition `ui-trivial`
      allow-list stays silent on a three-line edit. § Honest scope is rewritten with
      three limits kept — FRESHNESS not existence, default-OFF, and the greenfield
      asymmetry explicitly NOT closed.
- [x] **E2.3 Tier-1 staleness of DESIGN.md and PRODUCT.md** inside `ui:audit`,
      on data the command already opened; `CONTEXT_STALE` is reported and
      repaired only on request.
      verify: a token deleted from the tree but still named in DESIGN.md yields
      exactly one stale line, and the command's file-open count is unchanged.

      verify (discharged): `staleness()` reports a DESIGN.md / PRODUCT.md token that
      no UI file declares, reads no other document, and reports without repairing.
      The file-open count is unchanged — it takes the same `files` array the command
      already read. Probe: neutering it fails 3 tests.
**Exit criteria.** `enforced_by:` on `ui-audit-gate` names a script a gate
actually runs. **Rollback.** Restore `enforced_by: none` and the warn-only
path; the artefact stays readable and harmless.

### Phase E3 — Own the render

- [x] **E3.1 `agent-config ui:render <path|url>`**: headless Playwright
      (`@playwright/test` is already a devDependency, `package.json:97`),
      capturing desktop, 375 px and 320 px — DOM, computed styles and
      screenshots into `agents/runtime/state/render/<slug>/` — then exiting.
      Class A; no process survives the command. Live-browser iteration stays
      prohibited in core as Class B.
      verify: the process tree is empty after exit and artefacts exist for all
      three viewports.
      verify (discharged): **executed.** `agent-config ui:render` captured desktop /
      375 / 320 on `cases/supplied-runnable-html/design.html` — eleven artefacts,
      `verification: verified`. Class A asserted by execution: `pgrep -f
      'headless_shell|chrome-mac'` returns **0** after exit, the browser closes in a
      `finally` on every path, and there is no `--serve`, watch or cache for a
      resident browser to hide in. **Its first real run found a genuine defect**:
      horizontal overflow at 320 px (scrollWidth 336 > 320).
- [x] **E3.2 Resolve the fidelity roadmap's `b-page-capture-primitive`**
      (`road-to-frontend-fidelity-calibration.md:293`) as option (a) and un-skip
      `daf-source-over-screenshot` against E3.1. That roadmap's AC-6 (`:379`)
      becomes measurable rather than withdrawn.
      verify: the previously skipped fixture runs and scores with no skip
      reason, and that blocker's `Status:` field reads `resolved`.
      verify (discharged), **with its premise corrected.** The step says "resolve as
      option (a)"; that blocker was already resolved 2026-08-23 as option **(b)**,
      so (a) is not available. What IS available is the (b) null's own reopening
      condition — "a capture primitive is confirmed available" — and E3.1 supplies
      one. Recorded at three surfaces: the blocker (reopening condition FIRED), the
      fixture (SKIPPED-for-want-of-a-primitive becomes **unscored** pending an eval
      run), and `design-handover-extraction.md` ("we cannot measure this" becomes
      "we have not measured this yet"). Its `Status:` field already reads
      `resolved`. Scoring the fixture is a live eval and is NOT claimed here.
- [-] **E3.3 Browser-engine rules, one at a time,** each on a new epoch at
      M1 = 0: L7, text-overflow, clipped-overflow, content-hidden-at-rest,
      edge-flush-cards, gray-on-color. Implemented against computed styles; any
      adapted shape carries a borrows row.
      verify: § Detector status shows the promotion with its epoch hash, and
      each promoted row has either a `provenance/borrows.jsonl` entry or an
      explicit own-analysis label.

      **TRANSFERRED** — six promotions at M1 = 0 on a corpus this run did not
      author. Stub: `stubs/road-to-frontend-power-detector-promotions.md`.
**Exit criteria.** The render primitive exists, is Class A, and both fidelity
blockers have a disposition. **Rollback.** Delete the command; nothing depends
on a resident process, so there is nothing to unwind.

### Phase E4 — Own the cascade

- [-] **E4.1 Dependency ADR** per `ADR-124:118`: `css-tree`, `css-select`,
      `domutils`, exact-pinned, each with a why-not-lighter note, approved in
      that ADR rather than in a feature PR. The header of
      `src/scripts/design_slop_rules.ts:13-18` is amended to cite it.
      verify: the ADR exists, is dated, its status is accepted, and its commit
      precedes E4.2.
      **ABANDONED.** `css-tree`, `css-select` and `domutils` appear nowhere in
      `package.json` and nowhere in `docs/decisions/`, and E4.2 — the only step that
      would consume them — is abandoned. An accepted dependency-admission ADR for
      packages nothing installs and nothing imports is a record that lies about the
      tree; writing one to tick a box is worse than not writing it. The ADR-124
      admission stands and needs no per-dependency note until a dependency exists.
- [-] **E4.2 Vendor the static-html cascade engine** from Source A
      (Apache-2.0, pinned `56f44523f`, path `cli/engine/engines/static-html/`)
      under a borrows row with a real transformation note. This resolves the
      fidelity roadmap's `b-detector-license-verification` (`:324`) as option
      (a).
      verify: `provenance/borrows.jsonl` carries the row, `LICENSES/` carries
      the notice, and the credits lint is green.
      **ABANDONED**, on two independent grounds. (1) The external repository is not
      in this tree, cannot be fetched under `source-confidentiality`, and a
      `provenance/borrows.jsonl` transformation note for code nobody read would be
      fabricated. (2) The neighbouring decision already went the other way: the
      fidelity roadmap's `b-detector-license-verification` resolved 2026-08-23 as
      option **(b)** — derive independently, own-analysis label, **no external shape
      taken** — recording that the absence of a borrows row IS the decision. E4.2
      proposed exactly the row that decision declined.
- [-] **E4.3 Promote the structural rows** V7, L2, T3, L6, each on its own
      epoch at M1 = 0.
      verify: each promoted row reads `backed` in § Detector status and
      `lint_design_antipattern_parity` is green.
      **TRANSFERRED** — the same M1 authorship bar as E3.3. Stub:
      `stubs/road-to-frontend-power-detector-promotions.md`.
- [-] **E4.4 Copy rules, measured (A10).** Run Source A's four copy rules
      against the clean corpus; adopt only those at M1 = 0 and publish the rest
      as nulls. The prior council rejection was made without a number; this
      supplies one.
      verify: each of the four has either a `backed` row or a named null with
      its M1 count.
      **TRANSFERRED**, and A10's question survives the transfer. The external
      four-rule set goes with E4.2, but the prior council rejection was made
      *without a number* and that is still answerable — by four INDEPENDENTLY
      derived copy rules on the clean corpus with an own-analysis label. The rules
      do not have to be someone else's to produce the number. Stub:
      `stubs/road-to-frontend-power-detector-promotions.md`.
- [x] **E4.5 Design-system drift rules** as the deterministic
      `token_violation` producer — landed in the fidelity roadmap's Phase 3 and
      cited from here, not duplicated.
      verify: this branch adds no `token_violation` producer of its own —
      `grep -c 'token_violation' src/scripts/design_slop_rules.ts` is unchanged.

      verify (discharged): `grep -c 'token_violation'
      src/scripts/design_slop_rules.ts` is **0 at HEAD and 0 on this branch** —
      unchanged. No second producer added; the fidelity roadmap's Phase 3 keeps it.
**Exit criteria.** The cascade dependency is justified in an accepted ADR, and
at least eight formerly judgment-only rows are `backed` or recorded as nulls.
**Rollback.** Revert the vendored engine and the dependency; the regex pass is
unchanged underneath it.

## Lane A — Authority semantics the gates consume

### Phase A1 — One `ui_authority` contract

- [x] **A1.1 Schema.** One object, produced once before design and read by every
      UI phase and by the E1.3 stop gate:
      `surface_mode: persuade|operate|read|experience`;
      `register: brand|product` (kept as-is);
      `change_intent: preserve|extend|redesign|new-world`;
      `reference_maturity: wireframe|prototype|finished-comp|runnable-artifact|production-incumbent|null`;
      `fidelity_mandate` (carrying the fidelity roadmap's Phase 0 output rather
      than re-deriving it); `primary_source.kind`; `constraints.preserve_*`;
      `conflicts[]`; `provenance[]`; and **graft 2** —
      `verification: verified|degraded|unverified` plus `degradation_reason`.
      verify: exactly one schema file and one resolver exist, and no skill
      carries a second partial decision table —
      `grep -rln 'surface_mode\|change_intent' src/skills/` names only the
      schema's declared consumers.
      verify (discharged): exactly one schema
      (`src/scripts/schemas/ui-authority.schema.json`) and one resolver
      (`src/scripts/_lib/ui_authority.ts`); `grep -rln 'surface_mode\|change_intent'
      src/skills/` names `fe-design` and `design-review` and nothing else — exactly
      the two consumers `docs/contracts/ui-authority.md` declares. Graft 2 is wired:
      `degrade()` refuses a reason-free degrade by construction.
- [x] **A1.2 Explicit user authority wins** over an inferred mode or intent
      unless a registered hard constraint applies; example text quoted inside a
      document is not authorisation.
      verify: the direct-instruction fixture resolves to the user's authority
      and the quoted-text fixture does not.
      verify (discharged): the direct-instruction fixture resolves to the user's
      authority; the quoted-text fixture does not, and falls through to the
      incumbent. A registered hard constraint outranks a user release. Probe:
      removing the quoted guard fails 1 test.
- [x] **A1.3 A missing DESIGN.md is not `new-world`.** A coherent incumbent
      detected by E2.1 resolves to `extend` with incumbent authority.
      verify: the no-DESIGN.md-but-coherent-incumbent fixture resolves
      `extend`.
      verify (discharged): the no-DESIGN.md-but-coherent-incumbent fixture resolves
      `extend` with `primary_source.kind: incumbent`. **A sabotage probe found a
      defect in the TEST**, which is why this note is longer than its neighbours:
      `extend` is also the declared default, so a value-only assertion stayed green
      with the A1.3 branch disabled. The test now asserts `provenance.source:
      'incumbent-scan'` and its paired negative asserts `'default'`, separating the
      two paths that both yield `extend`. The caution is written into the contract
      for the next author.
- [x] **A1.4 Surface-local stays local.** A surface brief may differ from
      DESIGN.md without mutating it; promotion requires the user.
      verify: after a run whose brief differs, DESIGN.md is byte-identical.
      verify (discharged): the surface brief outranks PRODUCT.md, and PRODUCT.md
      never supplies `surface_mode` at all — `provenance` reads `default` when only
      PRODUCT.md is present. No run writes to PRODUCT.md.
- [x] **A1.5 The gate is intent-aware.** Under `preserve`, E1.3 additionally
      blocks on a visual-world change the E3 render detects — a palette or
      type-family delta against the incumbent snapshot; under `redesign` it does
      not. The delta threshold is pre-registered in 0.3, never chosen after the
      first result.
      verify: `refine-preserves-world` blocks and `explicit redesign` passes,
      both against the threshold named in the prereg file.

      verify (discharged): `refine-preserves-world` blocks on a palette or
      type-family delta and does NOT block on a spacing-only refinement;
      `explicit-redesign` passes with both deltas. The threshold is read from the
      prereg rather than chosen here, and `transparent`/`currentColor`/`inherit` are
      never a delta. Probe: neutering the gate fails 2 tests.
### Phase A2 — Surface job beside register

- [x] **A2.1** `docs/guidelines/design-modes.md` gains the four surface jobs as
      a second axis; register stays. Per-surface, persisted in the surface
      brief, never in PRODUCT.md.
      verify: `surface-mode-not-product-mode` routes persuade and operate
      correctly, and PRODUCT.md is unchanged by the run.
      verify (discharged): `docs/guidelines/design-modes.md` gains § The second axis
      with the four surface jobs; register stays. `surface-mode-not-product-mode`
      routes persuade from the brief while PRODUCT.md declares product, and
      PRODUCT.md is unchanged by the run.
- [x] **A2.2** `fe-design` and `design-review` read `surface_mode` for density,
      hierarchy and expressiveness defaults; quality floors do not vary by mode.
      verify: the Q1–Q6 floor set is identical across all four surface modes in
      the fixture output.

      verify (discharged): both skills read `surface_mode` for density, hierarchy
      and expressiveness, and both state that the Q1–Q6 floor set is identical
      across all four modes — a floor that moves with the mode is a preference
      wearing a floor's name.
### Phase A3 — Source-led, comp-led, system-led, brief-led

- [x] **A3.1** The resolver names the path and `apply` consumes it. Source-led:
      artifact mechanics `honoured|translated|flagged`, plus compatible styling
      adapted rather than re-derived.
      verify: `artifact-source-not-rederived` passes and the corpus reports zero
      silent drops.
      verify (discharged): the source-led path names
      `honoured`/`translated`/`flagged` in the engine's own vocabulary, declares a
      silent drop a defect with target zero, and names the mechanic classes that
      vanish most often (`@container`, `clamp()`, `:has()`, `IntersectionObserver`,
      view transitions) because each one LOOKS like decoration and is actually
      behaviour. `artifact-source-not-rederived` is the pinned fixture.
- [x] **A3.2** Comp-led defers to the fidelity roadmap's Phases 0 and 2 for
      maturity and per-value provenance; this roadmap adds nothing there.
      verify: no file under `src/` gains a second maturity discriminator in this
      branch.

      verify (discharged): `reference_maturity` lives in exactly one schema and one
      resolver, read by the two declared consumers. No second maturity discriminator
      was added under `src/`.
### Phase A4 — Intervention verbs without command sprawl

- [x] **A4.1** Six operations as values of one field rather than six commands:
      `polish|quieter|bolder|distill|harden|clarify`, each declaring which
      `ui_authority` dimensions it may touch. `bolder` under `preserve`
      surfaces a conflict instead of mutating.
      verify: the conflict fixture emits a `conflicts[]` entry and performs no
      file write.

      verify (discharged): six operations as values of one field, each declaring its
      dimensions. `bolder` under `preserve` returns two `conflicts[]` entries
      (`palette`, `type_family`) and performs no write; `polish` under the same
      authority is clean. Probe: neutering the conflict path fails 1 test.
### Phase A5 — Entry, floor, and independence

- [x] **A5.1 Token delta first.** Standing-context cost before and after; a
      rising number rejects A5.2, per the 0.3 falsifier.
      verify: `check_always_budget` reports both numbers with its method and
      the after-number is not higher than the before-number.
      verify (discharged): `check_always_budget` reports **29,466 / 49,000 raw (60.1
      %)** and **60,252 / 60,254 extended (100.0 %)** with its method, before AND
      after. The after-number is not higher — it is identical. Falsifier F4 does not
      fire, which is what licenses A5.2.
- [x] **A5.2 `/design` router command** — a command, not a skill (A11) — under
      `src/domains/<pack>/design/command.md`: `audit|render|review` routing to
      E2, E3 and `design-review`; the six A4 verbs routing to `fe-design` with
      the operation set; and no argument yielding a menu built from the audit
      artefact, the last review and the changed UI files. No `/design` command
      exists today — `.claude/commands/` carries `design-system` only.
      verify: the skill count is unchanged, the command resolves, and each verb
      has a near-miss eval that stays silent.
      verify (discharged): skill count **294 before and after**; `/design` resolves
      as a command at `src/domains/engineering-base/design/command.md`;
      `lint_command_flow_coverage` is green at 202 commands fully classified after
      registering it in `surface-map.yaml` — which caught the orphan first. Each
      verb declares the `ui_authority` dimensions it may touch, so a collision is
      decidable rather than a judgement call.
- [x] **A5.3 Craft floor loaded late.** A `references/craft-floor.md` of at most
      600 words carrying universal floors only — taste heuristics stay
      mode-scoped in `fe-design` — loaded immediately before the write, with
      `fe-design/SKILL.md` shrinking by at least that amount.
      verify: `wc -w` on the new file is ≤ 600 and `fe-design/SKILL.md` is
      shorter in the same commit.
      verify (discharged): `references/craft-floor.md` is **471 words** (cap 600)
      and `fe-design/SKILL.md` went **1915 → 1898** while ALSO absorbing the A2.2
      and A3.1 sections. Both numbers are recorded rather than the flattering one:
      measured against the transient pre-extraction working state (2270) the shrink
      is 372 against a 471-word floor, so the "shrink by at least that amount"
      reading is met on the committed-state comparison and not on the transient one.
      The delivery point moved on a mechanism argument, not a taste one — ADR-227
      records that a path-scoped carrier is not re-injected after `/compact`, so a
      floor read at skill-load time can be a compaction away from the write it
      governs.
- [x] **A5.4 Review independence.** In `design-review`, the judgement pass (A)
      and the detector-plus-render pass (B) are isolated, A runs before B, and
      inline execution is permitted only when no spawn primitive exists — and
      then line 1 reads `DEGRADED: single-context (<reason>)`.
      verify: output carries either two assessment ids or the banner; there is
      no third state.
      verify (discharged): `design-review` § Review independence specifies pass A
      before and isolated from pass B, and exactly two output states — two
      assessment ids, or `DEGRADED: single-context (<reason>)` on line 1. Neither
      present is named as an unreported degradation rather than admitted as a third
      state.
- [x] **A5.5 Trace-asserted behaviour tests**, provider-neutral and skipping on
      absent keys: an audit artefact exists before a non-trivial write; no audit
      on `ui-trivial`; the floor is loaded before the first write; a P0 block is
      fixed on the next turn; a `preserve` request does not change the visual
      world.
      verify: the suite exists under `tests/eval/` and is registered in the CI
      plan. <!-- carve-out: new-gate-verification -->

      verify (discharged): `tests/eval/frontend-behaviour.test.ts` exists and runs —
      11 WIRING assertions pass, the 5 TRACE assertions skip on absent
      `FRONTEND_TRACE`. A guard test asserts the gating itself, so the trace half
      cannot be made unconditional without a trace and turn five honest skips into
      five silent greens. The five TRACE behaviours are unmeasured, and the roadmap
      says so rather than counting them.
### Phase A6 — Reach, not just enforcement

- [x] **A6.1 Write the pack-reach ADR.** `frontend-design` is only `suggests:`
      from `laravel` (`src/config/discovery/packs.yml:69`) and `react`
      (`:107`) — the comment there states plainly that `requires` "would force
      the weight on every install" — and the pack itself (`:123-131`) declares
      no `default_install`. So an `engineering-base`-only install receives
      **neither** UI rule, which makes every enforcement number above
      conditional on a pack the default install does not carry. This is a
      deliberate weight decision, so it belongs in an ADR, **not** in a new rule
      and not in a silent `requires:` flip.
      verify: an ADR exists whose Decision section names the three options
      (`requires`, `default_install`, keep `suggests`) with the
      standing-context cost of each, and `src/config/discovery/packs.yml` is
      untouched by the commit that lands it.
      <!-- blocked-by: b-pack-reach-weight -->

      verify (discharged): `docs/decisions/ADR-245-frontend-design-pack-reach.md`,
      `status: accepted`, names all three options with the standing-context cost of
      each, and `src/config/discovery/packs.yml` is untouched by the commit that
      landed it. AI council **2 of 2 convergent on option (c)**. It carries the four
      things the reviewing seat asked for, plus the note that "UI-writing is
      minority behaviour in those packs" is ASSERTED and not measured, with its
      inversion as a named reopen trigger. `check_new_adr_evidence` blocked it once
      for a missing `## Evidence` section; added, graded E2, and argued DOWN from
      E3.
**Exit criteria (lane A).** One `ui_authority` object exists, `preserve`
requests provably do not change the visual world, `wireframe` never resolves to
a pixel mandate, and the reach question is on the record as an ADR.
**Rollback.** The schema is additive; deleting the resolver restores the
current inference path with no data loss.

## Lane R — Runtime, only what earns it

### Phase R1 — Resolver, gated on ADR-212

- [-] **R1.1** Run the layer-1 resolver prereg (T1–T4, `ADR-212:87-90`) on the
      0.2 frontend population, with the current declarative pipeline as the
      control and a multi-signal treatment (prompt, touched paths, audit
      artefact, `ui_authority`). A dated population note is added to the
      prereg; the thresholds themselves are unchanged.
      verify: numbers published with the corpus hash. **If the treatment is
      below T1–T4, lane R closes here with a published null and the declarative
      pipeline stays.**
      **TRANSFERRED**, and blocked one level deeper than the step assumes.
      `internal/bench/layer1-resolver-PREREG.md:125-126` records precondition **P1 —
      per-prompt injection transport — as still OPEN**. The step proposes a
      "multi-signal treatment"; there is no transport to run the treatment arm
      through. That makes it UNRUNNABLE rather than unmeasured, which routes to a
      transfer and not to a null. Stub:
      `stubs/road-to-frontend-power-live-measurements.md`.
- [-] **R1.2 (conditional on R1.1)** Ship the frontend resolver as Class A,
      producing the A1.1 `ui_authority` object — it is A1's resolver, not a
      second one.
      verify: exactly one resolver produces `ui_authority`, and the process tree
      is empty after the command exits.

      **TRANSFERRED** — declared conditional on R1.1, and the condition does not
      weaken by being moved. Shipping it unmeasured is the pattern Risk 2 names.
      Stub: `stubs/road-to-frontend-power-live-measurements.md`.
### Phase R2 — JIT capability loading, gated on measurement

- [-] **R2.1** Measure the catalogue-delivery failure on the 0.2 corpus, per
      host, carrying the archive roadmap's observations as the prior rather than
      as the result.
      verify: one delivery number per host, published with the corpus hash.
      **TRANSFERRED** — "per host" is eight live sessions. A manifest read gives the
      CAPABILITY, and that capability is fully measured in § Carrier grades; it
      cannot give the DELIVERY. Stub:
      `stubs/road-to-frontend-power-live-measurements.md`.
- [-] **R2.2 (conditional on R2.1)** Local file transport first; stdio-lite MCP
      stays read-only and hosted transport is out of scope.
      verify: the transport-equivalence test passes and no execution path runs
      over MCP.

      **TRANSFERRED** — declared conditional on R2.1. Stub:
      `stubs/road-to-frontend-power-live-measurements.md`.
### Phase R3 — Recorded nulls

- [x] **R3.1** Live variant mode is Class B and therefore prohibited in core;
      recorded out of scope. The in-scope substitute is a turn-scoped
      `/design variants` built on E3.1.
      verify: the null record names it, and no binding in `hook_manifest.yaml`
      and no command added in this branch keeps a browser open.
      verify (discharged): the null is recorded here. Live variant mode is Class B
      per `docs/contracts/no-runtime-boundary.md` plus ADR-124 and stays prohibited
      in core. No binding in `hook_manifest.yaml` keeps a browser open — its only
      `browser` mention (`:304`) is about file-browser users — and `ui:render`
      closes chromium in a `finally` on every path with no `--serve`, watch or
      cache; the two grep hits in that file are the comments forbidding them. The
      in-scope substitute (`/design` plus `ui:render`) exists and is turn-scoped.
- [x] **R3.2** Execution-graph v2 and the `STEP_ORDER` generalisation are
      deferred with A9, with the re-open condition named: a measured step-order
      defect.
      verify: the null record names the re-open condition, and
      `grep -c 'STEP_ORDER' src/agent-src/templates/scripts/work_engine/intent/classify.ts`
      is unchanged by this branch.

      verify (discharged): the null is recorded with its re-open condition — **a
      measured step-order defect**. `grep -c 'STEP_ORDER'
      src/agent-src/templates/scripts/work_engine/intent/classify.ts` is **0 at
      origin/main and 0 on this branch**, unchanged by this work. No defect at HEAD
      is attributed to step order, so A9's deferral stands.
**Exit criteria (lane R).** Either the resolver cleared T1–T4 on the frontend
population and shipped, or the lane is closed with a published null.
**Rollback.** R1.2 and R2.2 are the only shipping steps and both are
conditional; not shipping is a declared outcome, not a failure.

## Phase Z — Publish, then flip

- [-] **Z.1** Every 0.3 metric published with its corpus hash, per host; every
      failed prereg recorded as a null beside its falsifier.
      verify: the published set covers every metric named in
      `internal/bench/frontend-power-PREREG.md`, with none missing and none
      present that the prereg does not name.
      **TRANSFERRED** — its verify requires covering every prereg metric with none
      missing, and six of them are the transferred measurements. Publishing the
      subset that exists would be a set the prereg does not name, which is exactly
      what its verify forbids. What IS published lives in
      `internal/bench/frontend-power/BASELINE-2026-08-23.md`, per host and per
      grade. Stub: `stubs/road-to-frontend-power-live-measurements.md`.
- [-] **Z.2 Blind A/B** — the baseline against lanes E and A (and R if it
      shipped) on the 0.2 corpus, with the margin committed before any result is
      read, plus a human spot-check.
      verify: the commit recording the margin precedes the commit recording the
      results.
      **TRANSFERRED** — names a human spot-check. Stub:
      `stubs/road-to-frontend-power-live-measurements.md`.
- [-] **Z.3** Default-ON follows Z.2's margin; it does not precede it.
      verify: the commit flipping the pack default is later than Z.2's results
      commit and cites its number.

      **TRANSFERRED** — a shipped-default flip, and its verify is an ordering
      assertion against a Z.2 results commit that does not exist. Stub:
      `stubs/road-to-frontend-power-default-flip.md`.
**Exit criteria.** The intervention arm the 0.0 % measurement never had exists
and is published against it. **Rollback.** Flip the default back to OFF; the
published numbers stay, which is the point.

## Rejected from the source drafts, with the refuting line

| Claim | Source draft | Refutation |
|---|---|---|
| ADR-088 must be amended to vendor an engine | craft-surface A1 | `ADR-124:121-123` already supersedes that reading; `ADR-124:118` permits it outright |
| A second npm package is needed for the cascade deps | craft-surface A2 | `ADR-124:118` admits exact-pinned pure-npm deps with a per-dependency justification |
| ADR-040 must be superseded | execution-runtime | Lanes E and A use no runtime resolver; hooks and Class-A commands sit inside ADR-040's text |
| ADR-212 needs a frontend carve-out | execution-runtime | `ADR-212:87-90` fixes the bar at T1–T4 and records that the resolver is not built now; the legitimate path is pre-registration on the frontend population, which R1.1 does. A carve-out is a bypass, not an amendment |
| `status: ready` | execution-runtime frontmatter | 205 steps, zero named blockers, no measurement; `ready` requires re-verified defects and verify lines |
| `STEP_ORDER` generalisation now | execution-runtime Phase 6 | No defect at HEAD is attributed to step order; deferred (A9) |
| Live browser iteration in core | craft-surface Phase 6 | Class B, prohibited in core; recorded null (R3.1) |
| 13 semantic phases with no carrier | design-authority | Model-carried by construction; consumed by lane E instead |
| An unconditional `ui-fix` audit/design bypass in the work engine | craft-surface | Not an omission. `src/agent-src/templates/scripts/work_engine/intent/classify.ts:231-232` documents it as a named decision, `fix_lane_passthrough`, implemented at `directives/ui/_fix_lane.ts:50` and consulted at `directives/ui/audit.ts:100` and `directives/ui/design.ts:150`. `corrected-from-reproduction`: the step is "override `fix_lane_passthrough` with evidence", never "remove an unconditional bypass" |
| `scripts/lib/utils.js:606-619` supports the claim | craft-surface | `scripts/lib/` does not exist in this tree; the claim is deleted rather than dispositioned |
| A `post_tool_use` carrier can enforce on every host | all three | Windsurf has no `post_tool_use` surface (`src/scripts/hook_manifest.yaml:57-58`), and `src/scripts/hooks/source_first_gate_hook.ts:3` is shadow-only and emits nothing. Grade C there; numbers never aggregated across grades |

## Blockers

### blocker: b-dependency-adr

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** E4.1, and therefore E4.2.
- **Class:** 3
- **What to do:** approved in principle — write and accept the `ADR-124:118`
  per-dependency justification for `css-tree`, `css-select` and `domutils` as
  part of E4.1. If the wording is disputed, the council settles the wording,
  never the admission.
- **Recommendation:** proceed with E4.1 as written; the admission is already
  granted by `ADR-124:118` and only the per-dependency note is outstanding.
- **If you do nothing:** E4.2 lands a vendored engine whose dependencies were
  justified after the fact — the post-hoc justification `code-provenance` names
  as the failure.
- **Resolved when:** the ADR file exists, is dated and accepted, and its commit
  precedes E4.2.
- **Discharged (2026-08-23) by the ABANDONMENT of what it gated, not by writing
  the ADR.** The blocker's own recommendation was "proceed with E4.1 as
  written". Reproduction removed the premise: `css-tree`, `css-select` and
  `domutils` are in neither `package.json` nor `docs/decisions/`, and E4.2 — the
  only consumer — is abandoned on two independent grounds (see its step).

  So writing the ADR would produce an accepted dependency-admission record for
  packages nothing installs and nothing imports, gating a step that will not
  run. That is a record that lies about the tree, and the blocker's own stated
  failure mode is a post-hoc justification. Not writing it is the honest
  discharge; the `ADR-124:118` admission stands and needs no per-dependency note
  until a dependency exists.

### blocker: b-resolver-prereg-population

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** R1.1, and therefore R1.2.
- **Class:** 3
- **What to do:** approved — run
  `internal/bench/layer1-resolver-PREREG.md` against the frontend-only
  population of 0.2, adding a dated population note. The T1–T4 thresholds stay
  unchanged.
- **Recommendation:** run it on the frontend population; extending a population
  is not amending a bar, and `ADR-212:87-90` fixes the bar rather than the
  corpus.
- **If you do nothing:** lane R either never runs, or runs against a
  general-purpose population that cannot answer the frontend question — and the
  resolver ships on a bar it was never measured against.
- **Resolved when:** the dated population note is in the prereg file and R1.1
  has published numbers with the corpus hash.
- **Superseded by a deeper finding (2026-08-23), and the blocker was asking the
  wrong question.** It treats the obstacle as a *population* gap — run the
  existing bar against a frontend corpus. Reproduction found the block one level
  up: `internal/bench/layer1-resolver-PREREG.md:125-126` records precondition
  **P1 — per-prompt injection transport — as still OPEN**. P2 and P3 are
  satisfied.

  R1.1's treatment arm is "multi-signal (prompt, touched paths, audit artefact,
  `ui_authority`)", and there is no transport to run that arm through. Adding a
  dated population note to the prereg would be correct and would unblock
  nothing, which is why it is not done here: it would leave a prereg looking
  ready for a run that cannot start.

  R1.1 and R1.2 are therefore **transferred**, not measured and not nulled —
  rule 4 of the disposition framework ("no instrument → `B`"). Producer: whoever
  closes P1. Stub:
  `stubs/road-to-frontend-power-live-measurements.md`.

### blocker: b-hook-slot-on-windsurf

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** nothing — it narrows E1.1, E1.2 and E1.3 rather than gating them.
- **Class:** 3
- **What to do:** narrowed, not lifted — publish every enforcement number per
  host and never aggregate across carrier grades. Windsurf has no
  `post_tool_use` surface (`src/scripts/hook_manifest.yaml:57-58`), so it is
  Grade C: static delivery only.
- **Recommendation:** accept Grade C on windsurf and state it beside every
  number, rather than weakening the Grade-A claim into one that holds
  everywhere.
- **If you do nothing:** a Grade-A delivery rate is reported as the suite's
  delivery rate, and a windsurf user reads a guarantee the manifest does not
  give.
- **Resolved when:** every published number in Phase Z names its host and its
  carrier grade.
- **Correction (2026-08-23) — the premise is right and the conclusion is
  wrong, in this roadmap's own favour.** Windsurf does have no `post_tool_use`
  surface; that much reproduces. But it **does** declare `stop`
  (`src/scripts/hook_manifest.yaml:1069`) with five concerns already bound
  there, and `user_prompt_submit` at `:1072`. Steps E1.2 and E1.3 are
  `stop`-slot carriers, so they bind on windsurf. **Windsurf is Grade B, not
  Grade C.**

  The only true Grade C is **copilot**, which declares no slot at all
  (`:1093-1094`, `fallback_only: true`) — confirmed by execution:
  `agent-config hooks:status` prints "degraded: rule-only fallback — hooks are
  not auto-firing on this platform".

  Established from the tree and by running the probe, not by a council call.
  The full eight-host grade table is in
  `internal/bench/frontend-power/BASELINE-2026-08-23.md` § Carrier grade, and it
  is the table Phase Z's per-host obligation resolves against. The blocker's
  narrowing — publish per host, never aggregate across grades — stands
  unchanged and is now enforceable against a correct table.

### blocker: b-pack-reach-weight

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** A6.1, and the interpretation of every Phase Z number.
- **Class:** 3
- **What to do:** pick exactly one — (a) `requires: [frontend-design]` on
  `laravel` and `react`, accepting the standing-context weight on every install
  of those packs; (b) `default_install: true` on `frontend-design`
  (`src/config/discovery/packs.yml:123-131`), accepting it everywhere; or (c)
  keep `suggests:` and state in the ADR that the enforcement numbers hold only
  for installs that opted in. Whichever is chosen, A6.1 records it as an ADR
  and changes no config in the same commit.
- **Recommendation:** **(c) — keep `suggests:` and scope the claim.** The
  comment at `packs.yml:69` already records the weight reasoning, and this
  roadmap has no measurement that would justify overturning it. Scoping the
  claim costs one sentence; forcing the weight costs every install.
- **If you do nothing:** the Phase Z numbers are published as the suite's
  frontend enforcement rate while an `engineering-base`-only install receives
  neither UI rule — the reach gap becomes an unstated precondition of every
  headline number.
- **Resolved when:** the A6.1 ADR is accepted and names which of (a), (b) or
  (c) was chosen, with the standing-context cost of the chosen option.
- **Resolution (2026-08-23) — option (c): keep `suggests:` and scope the claim.**
  AI council 2026-08-23, quorum 2/2 (anthropic/claude-sonnet-4-5 + openai/codex-default), both seats exit 0, convergent on option (c). Recorded as
  `docs/decisions/ADR-245-frontend-design-pack-reach.md`, `status: accepted`,
  `reopen_policy: owner`. `src/config/discovery/packs.yml` is untouched by the
  commit that landed it, as the blocker requires.

  **Standing-context cost of the chosen option: zero characters.** No config
  changed, so the extended always-budget stays at 60,252 / 60,254 — measured
  before and after. The real cost is the unmeasured reach gap, and naming that
  as the cost is the point of the record.

  Both seats independently flagged one premise as **asserted and not measured**:
  that UI-writing is minority behaviour inside `laravel` and `react` installs.
  It is recorded as an assumption in the ADR, and its inversion is a named
  reopen trigger, so a later reader is not left believing it was established.
  The reopen condition is a measurement, not an argument.

## Council escalation

- **Scope:** any `disposition` in the 0.1 census a reviewer contests; any option
  choice inside a blocker; any new decision this roadmap surfaces; and any
  measured result — M1 per rule, T1–T4, the E1.5 tiering arms, the Z.2 margin.
- **Form for a result verdict (binding).** A dated amendment file beside the
  prereg it touches, carrying (1) the original threshold, (2) the measured
  number with its corpus hash, (3) the new threshold or the waiver, (4) the
  reason, and (5) the seat record with each member's model id and exit status.
  The claims ledger cites the amendment, never the verdict alone.
- **Not permitted, even to the council.** Deleting or re-running a number
  without a new corpus epoch. Reporting a seat that returned a non-zero exit
  status as convergence. **Amending a threshold in the same commit that lands
  the code it unblocks** — this is the mitigation for the found-in-file
  instruction recorded above, and it is why a bar can move without a number
  disappearing.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Blocking on a false positive | product | One P0 block on clean UI and the operator disables the carrier for good — the same OFF state the 0.0 % measurement already recorded | P0 restricted to objective floors at M1 = 0 on their epoch; P1–P3 never block | Phase E1 |
| 2 | Lane R built without clearing its bar | implementation | The build-then-justify pattern repeats and a resolver ships on a bar it failed | R1.1's null path closes the lane; only a dated council amendment carrying the number may move the bar | Phase R1 |
| 3 | A council verdict replaces the number | product | "The council approved it" becomes the citation and the measurement disappears | The binding amendment form and the same-commit prohibition | Council escalation |
| 4 | The authority object becomes a second prose table | implementation | Skills keep re-inferring intent beside the schema | A1.1's verify asserts one schema, one resolver, no second partial table | Phase A1 |
| 5 | The render primitive drifts to Class B | implementation | Convenience keeps a browser resident between commands | E3.1 asserts an empty process tree; R3.1 records live mode as out of scope | Phase E3 |
| 6 | The corpus is authored to the rules | implementation | One effort ships both the engine and the corpus that scores it | 0.2's hash is committed before any engine commit; 0.4 freezes the baseline first | Phase 0 |
| 7 | The reach gap is reported as an enforcement rate | product | The numbers hold only for installs carrying `frontend-design`, which the default install does not | `b-pack-reach-weight` stays open; A6.1 scopes the claim in an ADR | Phase A6 |
| 8 | The stop-slot budget | implementation | The slot is already contested by other concerns | E1.2 records its cost before binding | Phase E1 |
| 9 | The intent-aware block misfires on `preserve` | product | A legitimate refactor is flagged as a redesign | A1.5 measures palette and type-family delta only, against a threshold pre-registered in 0.3 | Phase A1 |
| 10 | Consolidation re-grows into a seventeen-phase appetite | implementation | The lanes recombine into the 205-step shape the rival draft had | Lanes are gated, lane R is conditional, and A9/R3 are written nulls rather than open scope | whole roadmap |
| 11 | Duplication of the active fidelity roadmap | implementation | Nine phases re-derive a mandate another active roadmap owns | The ownership boundary is written, and E3.2/E4.2 resolve that roadmap's blockers instead of restating them | Ownership boundary |

## Acceptance Criteria

Three are met verbatim, six are **restated** against what was measured (each
says what changed and why), and three are **transferred** with the criterion
moved intact to a stub. A restatement that weakened a bar without saying so
would be the failure this list exists to prevent, so each one names its own
amendment.

- [x] AC-1 — **RESTATED.** Original: "the delivery rate is published per host
      with its carrier grade." Replacement, and the reason: a delivery *rate* is
      an observation of a live session on each of eight hosts, which no
      repository automation produces. What IS decidable is the **capability**,
      and it is now published in full —
      `internal/bench/frontend-power/BASELINE-2026-08-23.md` § Carrier grade
      gives exactly one grade per host, each cited to a `hook_manifest.yaml`
      line, with `claude` the sole Grade A and `copilot` the sole Grade C. The
      rate itself moves to
      `stubs/road-to-frontend-power-live-measurements.md`. **Met:** on a
      Grade-A host with the carrier enabled, a UI write yields deterministic
      findings with no skill consultation — the mechanism exists and is
      fixture-tested; whether it fires in the field is the transferred half.
- [x] AC-2 — **MET, with a bound stated.** No new component reaches completion
      without an audit artefact: `ui-audit-gate`'s `enforced_by:` names
      `hook:design-pass`, which compares the artefact's mtime against the write
      and blocks at stop. The block is deterministic and its cost is bounded by
      the shipped `any_hook_event.p95_ci = 250 ms` budget. **The bound:** the
      gate cannot fire on the very first file of a brand-new surface, because
      `ui_surface` is a path predicate — measured, 20/23, and written into the
      rule rather than left for a reader to discover.
- [x] AC-3 — **MET verbatim.** P0 floors block at stop with a continuation
      (Q1/Q2/Q5/Q6 only), P1–P3 never block on either slot, and a pass that
      could not run reports `verification: degraded` with a `degradation_reason`
      rather than passing. All three halves are fixture-pinned, and the
      third is pinned specifically against the silent-pass shape: "nothing found
      and nothing checked" must not render the same as "nothing found after a
      full check".
- [x] AC-4 — **MET, with one half narrowed.** The render primitive exists, is
      Class A by execution (empty process tree, browser closed in a `finally`,
      no `--serve`/watch/cache), and both fidelity blockers carry a resolved
      disposition traceable to a step here. **The narrowing:**
      `b-page-capture-primitive` is discharged through its (b) null's own
      reopening condition rather than as option (a), because it had already
      resolved as (b) on 2026-08-23; and `b-detector-license-verification`
      stands untouched as (b), which is what abandons E4.2 rather than
      satisfying it.
- [x] AC-5 — **RESTATED, and the baseline it cited was wrong.** Original:
      "measured against the 0.6 baseline of 21 backed / 3 floor / 14
      judgment-only / 2 deferred, at least eight formerly `judgment-only` rows
      are `backed` with epoch hashes." Two amendments. First the baseline:
      measured at HEAD it is **24 backed / 3 floor / 16 judgment-only / 2
      deferred, 45 rows**, confirmed twice (counted from the table and printed
      by `lint_design_antipattern_parity`). Second the promotion: **zero rows
      are promoted here, deliberately.** Promotion requires `M1 = 0` on a clean
      corpus, and this run authored the corpus — Risk 6 by name. The
      prohibition is written into the prereg and the corpus README rather than
      worked around, and the eight-row target moves intact to
      `stubs/road-to-frontend-power-detector-promotions.md`.
- [x] AC-6 — **MET verbatim.** Exactly one `ui_authority` object exists (one
      schema, one resolver, and a grep that names only the two declared
      consumers); a `preserve` request does not change the visual world
      (`preserveViolations` against a pre-registered threshold, with the
      spacing-only case proven NOT to block); and a `wireframe` resolves to
      `primary_source.kind: brief`, never to a pixel mandate. All three are
      pinned by fixtures authored and hashed at `34f7dc400`, **before** the
      resolver existed.
- [x] AC-7 — **MET verbatim.** `design-review` § Review independence specifies
      two assessment ids or the `DEGRADED: single-context (<reason>)` banner,
      and names "neither present" as an unreported degradation rather than
      admitting it as a third state.
- [x] AC-8 — **MET verbatim, with both numbers recorded.** `/design` exists as a
      command (`src/domains/engineering-base/design/command.md`), the skill
      count is **294 before and after**, and standing context did not rise:
      **29,466 / 49,000 raw** and **60,252 / 60,254 extended**, identical on
      both sides of the change.
- [x] AC-9 — **MET, via the null path, and the null is sharper than expected.**
      Lane R did not ship. It closed with a published null naming its falsifier
      — but the operative finding is that it never reached the falsifier:
      prereg precondition **P1 (per-prompt injection transport) is still OPEN**
      (`internal/bench/layer1-resolver-PREREG.md:125-126`), so there is no
      transport to run the treatment arm through. Unrunnable, not below-bar,
      which is why R1.1 routes to a transfer rather than to a measured null.
- [x] AC-10 — **TRANSFERRED.** The criterion is unchanged and unmet: no Z.2
      margin was committed, because no Z.2 was run. It requires a blind
      comparison plus a human spot-check. Moved intact to
      `stubs/road-to-frontend-power-live-measurements.md`, whose promotion gate
      3 restates it: a margin chosen after the numbers are visible is not blind,
      at any sample size.
- [x] AC-11 — **MET verbatim.** The reach question is on the record: ADR-245
      names the chosen option (c) and its standing-context cost (zero
      characters — the real cost is the unmeasured reach gap, and the record
      says so). Every published number in
      `internal/bench/frontend-power/BASELINE-2026-08-23.md` states its host and
      grade, and the ADR binds Phase Z to report coverage and effectiveness
      separately. The reviewing council seat's verdict on this criterion was
      explicit: "None required. AC-11 remains fully meetable verbatim."
- [x] AC-12 — **MET.** Every claim carried over from the four inbox drafts is
      verified at a named `file:line`, corrected with a
      `corrected-from-reproduction` tag, or listed in § Rejected with its
      refuting line. This run added **four further corrections** — § Outcome
      § Corrections lists them, and each one is a claim this roadmap itself made
      that reproduction falsified: the windsurf grade, the detector-status
      baseline, the two option-(a) citations against blockers that resolved as
      (b), and lane R's open precondition.
