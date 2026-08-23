---
complexity: structural
status: draft
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

`agents/roadmaps/archive/road-to-frontend-fidelity-calibration.md` is **active**
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

- [ ] **0.1 `frontend_revalidation` matrix.** Every ADR and contract touching
      runtime, process lifetime, MCP, rules/skills, projection, hooks, token
      budget, work-engine topology, subagents, browser tooling, persistent
      state, frontend/UI, artifact fidelity, packs or host portability gets a
      record: `mechanism_match`, `population_match`, `epoch_match`,
      `evidence_state`, `disposition`, `reason`. An old null transfers only on
      exact mechanism **and** population **and** epoch.
      verify: `agents/evidence/analysis/frontend-revalidation.md` exists and no
      row has an empty `disposition`
      (`grep -c '| *|' agents/evidence/analysis/frontend-revalidation.md` is 0).
- [ ] **0.2 Frontend benchmark corpus, hashed before any fix.** Cases: React
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
- [ ] **0.3 Pre-register metrics and falsifiers.** Routing (frontend recall,
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
- [ ] **0.4 Freeze the baseline on the current tree** against 0.2 and 0.3, per
      host, with carrier capability recorded — Grade A enforced, B guided and
      state-gated, C static — decided by the `hook_manifest.yaml` rows for that
      host, never by the host's name.
      verify: the baseline file names the corpus hash and exactly one grade per
      host, and its `verification:` reads `verified` or carries a
      `degradation_reason`.
- [ ] **0.5 Resolve the Inter contradiction.**
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
- [ ] **0.6 Re-state the detector-status counts from the table itself.** The
      source drafts carried "24 backed / 4 floor / 16 judgment-only / 2
      deferred". Counted at `f6703b78a` from the table under
      `docs/guidelines/design-antipatterns.md` § Detector status: **21 backed /
      3 floor / 14 judgment-only / 2 deferred**, 40 rows total.
      `corrected-from-reproduction`.
      verify: `lint_design_antipattern_parity` is green and the AC-5 baseline in
      this file equals the count that table yields.

**Exit criteria.** 0.1–0.6 closed; the corpus hash and the prereg file
committed before any lane commit. **Rollback.** Phase 0 is additive
documentation and fixtures; reverting it reverts no behaviour.

## Lane E — Enforcement that does not depend on the model

### Phase E1 — Delivery that fires by default

- [ ] **E1.1 `post_tool_use` design pass** on UI-surface writes, deciding the
      surface from `src/scripts/_lib/ui_surface.ts`, delivering findings as
      additional context, exiting 0 for P1–P3.
      verify: a seeded side-stripe fixture yields exactly one finding on write
      and zero on a clean rewrite of the same file.
- [ ] **E1.2 `stop` deep pass** over the files touched this session, deduped
      against E1.1; its cost is recorded in the hook-economy work before this
      step binds.
      verify: a session touching two UI files and one non-UI file emits one
      block naming exactly the two.
- [ ] **E1.3 P0 blocks at stop** — Q1 contrast, Q2 font size, Q5 heading skip,
      Q6 focus, plus text-overflow and viewport-edge once E3 lands — through
      the existing continuation shape in `turn_end_gate_hook.ts`. **Graft 2
      binds here:** a pass that could not run reports
      `verification: degraded|unverified` with a `degradation_reason`; it never
      silently passes.
      verify: the Q1 fixture blocks once with a continuation, the fixed file
      passes, a P2-only fixture never blocks, and a pass with the render
      artefact absent emits `verification: degraded`.
- [ ] **E1.4 Pack-scoped default-ON** for the carriers, after E1.5 produces its
      number. This is the intervention arm the 0.0 % measurement never had.
      verify: `agent-config hooks:status` reports the design concern ON in a
      store carrying `frontend-design` and OFF in a bare store.
- [ ] **E1.5 Tiering by experiment** — all-per-edit, immediate-plus-stop, or
      stop-only — on the 0.2 corpus. Source A's 13-rule immediate set
      (Apache-2.0, pinned `56f44523f`, path `scripts/hook-lib.mjs:113-131`) is
      one labelled candidate; its stated rationale is unbacked and is not
      adopted with it.
      verify: results published with the corpus hash, and the shipped default
      cites the row it came from.
- [ ] **E1.6 Retire the `pre_tool_use` `design_slop` concern** once E1.1 covers
      it, leaving one design hook key.
      verify: `grep -c 'design_slop' src/scripts/hook_manifest.yaml` equals 1.

**Exit criteria.** A UI write on a Grade-A host produces a finding with no
skill consultation, and the tiering choice cites a measured row.
**Rollback.** Flip the pack-scoped default back to OFF; P1–P3 are warn-only by
construction, so nothing is left blocking.

### Phase E2 — The audit becomes an artefact

- [ ] **E2.1 `agent-config ui:audit <path>`** as a Class-A command writing
      `agents/runtime/state/ui-audit.json` — components, tokens, primitives,
      design-system markers — in the shape the work engine already expects for
      `state.ui_audit`, sharing one constant (including `COVERAGE_BUCKETS`,
      retiring the copied vocabulary in `fe-design` step 3). No such command
      exists today: no hit in `.claude/commands/`, `dist/agent-src/commands/`
      or `src/scripts/`.
      verify: the command exists, returns non-empty on the 0.2 fixtures, leaves
      an empty process tree, and deleting the artefact changes only speed.
- [ ] **E2.2 The gate reads the file.** `ui-audit-gate`'s `enforced_by:` names
      the script; a non-trivial UI write with no artefact newer than the target
      warns at E1.1 and blocks at stop. The `ui-trivial` allow-list is
      unchanged.
      verify: a new component with no artefact blocks with "run ui:audit"; a
      fresh artefact passes; a three-line edit stays silent.
- [ ] **E2.3 Tier-1 staleness of DESIGN.md and PRODUCT.md** inside `ui:audit`,
      on data the command already opened; `CONTEXT_STALE` is reported and
      repaired only on request.
      verify: a token deleted from the tree but still named in DESIGN.md yields
      exactly one stale line, and the command's file-open count is unchanged.

**Exit criteria.** `enforced_by:` on `ui-audit-gate` names a script a gate
actually runs. **Rollback.** Restore `enforced_by: none` and the warn-only
path; the artefact stays readable and harmless.

### Phase E3 — Own the render

- [ ] **E3.1 `agent-config ui:render <path|url>`**: headless Playwright
      (`@playwright/test` is already a devDependency, `package.json:97`),
      capturing desktop, 375 px and 320 px — DOM, computed styles and
      screenshots into `agents/runtime/state/render/<slug>/` — then exiting.
      Class A; no process survives the command. Live-browser iteration stays
      prohibited in core as Class B.
      verify: the process tree is empty after exit and artefacts exist for all
      three viewports.
- [ ] **E3.2 Resolve the fidelity roadmap's `b-page-capture-primitive`**
      (`road-to-frontend-fidelity-calibration.md:293`) as option (a) and un-skip
      `daf-source-over-screenshot` against E3.1. That roadmap's AC-6 (`:379`)
      becomes measurable rather than withdrawn.
      verify: the previously skipped fixture runs and scores with no skip
      reason, and that blocker's `Status:` field reads `resolved`.
- [ ] **E3.3 Browser-engine rules, one at a time,** each on a new epoch at
      M1 = 0: L7, text-overflow, clipped-overflow, content-hidden-at-rest,
      edge-flush-cards, gray-on-color. Implemented against computed styles; any
      adapted shape carries a borrows row.
      verify: § Detector status shows the promotion with its epoch hash, and
      each promoted row has either a `provenance/borrows.jsonl` entry or an
      explicit own-analysis label.

**Exit criteria.** The render primitive exists, is Class A, and both fidelity
blockers have a disposition. **Rollback.** Delete the command; nothing depends
on a resident process, so there is nothing to unwind.

### Phase E4 — Own the cascade

- [ ] **E4.1 Dependency ADR** per `ADR-124:118`: `css-tree`, `css-select`,
      `domutils`, exact-pinned, each with a why-not-lighter note, approved in
      that ADR rather than in a feature PR. The header of
      `src/scripts/design_slop_rules.ts:13-18` is amended to cite it.
      verify: the ADR exists, is dated, its status is accepted, and its commit
      precedes E4.2.
- [ ] **E4.2 Vendor the static-html cascade engine** from Source A
      (Apache-2.0, pinned `56f44523f`, path `cli/engine/engines/static-html/`)
      under a borrows row with a real transformation note. This resolves the
      fidelity roadmap's `b-detector-license-verification` (`:324`) as option
      (a).
      verify: `provenance/borrows.jsonl` carries the row, `LICENSES/` carries
      the notice, and the credits lint is green.
- [ ] **E4.3 Promote the structural rows** V7, L2, T3, L6, each on its own
      epoch at M1 = 0.
      verify: each promoted row reads `backed` in § Detector status and
      `lint_design_antipattern_parity` is green.
- [ ] **E4.4 Copy rules, measured (A10).** Run Source A's four copy rules
      against the clean corpus; adopt only those at M1 = 0 and publish the rest
      as nulls. The prior council rejection was made without a number; this
      supplies one.
      verify: each of the four has either a `backed` row or a named null with
      its M1 count.
- [ ] **E4.5 Design-system drift rules** as the deterministic
      `token_violation` producer — landed in the fidelity roadmap's Phase 3 and
      cited from here, not duplicated.
      verify: this branch adds no `token_violation` producer of its own —
      `grep -c 'token_violation' src/scripts/design_slop_rules.ts` is unchanged.

**Exit criteria.** The cascade dependency is justified in an accepted ADR, and
at least eight formerly judgment-only rows are `backed` or recorded as nulls.
**Rollback.** Revert the vendored engine and the dependency; the regex pass is
unchanged underneath it.

## Lane A — Authority semantics the gates consume

### Phase A1 — One `ui_authority` contract

- [ ] **A1.1 Schema.** One object, produced once before design and read by every
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
- [ ] **A1.2 Explicit user authority wins** over an inferred mode or intent
      unless a registered hard constraint applies; example text quoted inside a
      document is not authorisation.
      verify: the direct-instruction fixture resolves to the user's authority
      and the quoted-text fixture does not.
- [ ] **A1.3 A missing DESIGN.md is not `new-world`.** A coherent incumbent
      detected by E2.1 resolves to `extend` with incumbent authority.
      verify: the no-DESIGN.md-but-coherent-incumbent fixture resolves
      `extend`.
- [ ] **A1.4 Surface-local stays local.** A surface brief may differ from
      DESIGN.md without mutating it; promotion requires the user.
      verify: after a run whose brief differs, DESIGN.md is byte-identical.
- [ ] **A1.5 The gate is intent-aware.** Under `preserve`, E1.3 additionally
      blocks on a visual-world change the E3 render detects — a palette or
      type-family delta against the incumbent snapshot; under `redesign` it does
      not. The delta threshold is pre-registered in 0.3, never chosen after the
      first result.
      verify: `refine-preserves-world` blocks and `explicit redesign` passes,
      both against the threshold named in the prereg file.

### Phase A2 — Surface job beside register

- [ ] **A2.1** `docs/guidelines/design-modes.md` gains the four surface jobs as
      a second axis; register stays. Per-surface, persisted in the surface
      brief, never in PRODUCT.md.
      verify: `surface-mode-not-product-mode` routes persuade and operate
      correctly, and PRODUCT.md is unchanged by the run.
- [ ] **A2.2** `fe-design` and `design-review` read `surface_mode` for density,
      hierarchy and expressiveness defaults; quality floors do not vary by mode.
      verify: the Q1–Q6 floor set is identical across all four surface modes in
      the fixture output.

### Phase A3 — Source-led, comp-led, system-led, brief-led

- [ ] **A3.1** The resolver names the path and `apply` consumes it. Source-led:
      artifact mechanics `honoured|translated|flagged`, plus compatible styling
      adapted rather than re-derived.
      verify: `artifact-source-not-rederived` passes and the corpus reports zero
      silent drops.
- [ ] **A3.2** Comp-led defers to the fidelity roadmap's Phases 0 and 2 for
      maturity and per-value provenance; this roadmap adds nothing there.
      verify: no file under `src/` gains a second maturity discriminator in this
      branch.

### Phase A4 — Intervention verbs without command sprawl

- [ ] **A4.1** Six operations as values of one field rather than six commands:
      `polish|quieter|bolder|distill|harden|clarify`, each declaring which
      `ui_authority` dimensions it may touch. `bolder` under `preserve`
      surfaces a conflict instead of mutating.
      verify: the conflict fixture emits a `conflicts[]` entry and performs no
      file write.

### Phase A5 — Entry, floor, and independence

- [ ] **A5.1 Token delta first.** Standing-context cost before and after; a
      rising number rejects A5.2, per the 0.3 falsifier.
      verify: `check_always_budget` reports both numbers with its method and
      the after-number is not higher than the before-number.
- [ ] **A5.2 `/design` router command** — a command, not a skill (A11) — under
      `src/domains/<pack>/design/command.md`: `audit|render|review` routing to
      E2, E3 and `design-review`; the six A4 verbs routing to `fe-design` with
      the operation set; and no argument yielding a menu built from the audit
      artefact, the last review and the changed UI files. No `/design` command
      exists today — `.claude/commands/` carries `design-system` only.
      verify: the skill count is unchanged, the command resolves, and each verb
      has a near-miss eval that stays silent.
- [ ] **A5.3 Craft floor loaded late.** A `references/craft-floor.md` of at most
      600 words carrying universal floors only — taste heuristics stay
      mode-scoped in `fe-design` — loaded immediately before the write, with
      `fe-design/SKILL.md` shrinking by at least that amount.
      verify: `wc -w` on the new file is ≤ 600 and `fe-design/SKILL.md` is
      shorter in the same commit.
- [ ] **A5.4 Review independence.** In `design-review`, the judgement pass (A)
      and the detector-plus-render pass (B) are isolated, A runs before B, and
      inline execution is permitted only when no spawn primitive exists — and
      then line 1 reads `DEGRADED: single-context (<reason>)`.
      verify: output carries either two assessment ids or the banner; there is
      no third state.
- [ ] **A5.5 Trace-asserted behaviour tests**, provider-neutral and skipping on
      absent keys: an audit artefact exists before a non-trivial write; no audit
      on `ui-trivial`; the floor is loaded before the first write; a P0 block is
      fixed on the next turn; a `preserve` request does not change the visual
      world.
      verify: the suite exists under `tests/eval/` and is registered in the CI
      plan. <!-- carve-out: new-gate-verification -->

### Phase A6 — Reach, not just enforcement

- [ ] **A6.1 Write the pack-reach ADR.** `frontend-design` is only `suggests:`
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

**Exit criteria (lane A).** One `ui_authority` object exists, `preserve`
requests provably do not change the visual world, `wireframe` never resolves to
a pixel mandate, and the reach question is on the record as an ADR.
**Rollback.** The schema is additive; deleting the resolver restores the
current inference path with no data loss.

## Lane R — Runtime, only what earns it

### Phase R1 — Resolver, gated on ADR-212

- [ ] **R1.1** Run the layer-1 resolver prereg (T1–T4, `ADR-212:87-90`) on the
      0.2 frontend population, with the current declarative pipeline as the
      control and a multi-signal treatment (prompt, touched paths, audit
      artefact, `ui_authority`). A dated population note is added to the
      prereg; the thresholds themselves are unchanged.
      verify: numbers published with the corpus hash. **If the treatment is
      below T1–T4, lane R closes here with a published null and the declarative
      pipeline stays.**
- [ ] **R1.2 (conditional on R1.1)** Ship the frontend resolver as Class A,
      producing the A1.1 `ui_authority` object — it is A1's resolver, not a
      second one.
      verify: exactly one resolver produces `ui_authority`, and the process tree
      is empty after the command exits.

### Phase R2 — JIT capability loading, gated on measurement

- [ ] **R2.1** Measure the catalogue-delivery failure on the 0.2 corpus, per
      host, carrying the archive roadmap's observations as the prior rather than
      as the result.
      verify: one delivery number per host, published with the corpus hash.
- [ ] **R2.2 (conditional on R2.1)** Local file transport first; stdio-lite MCP
      stays read-only and hosted transport is out of scope.
      verify: the transport-equivalence test passes and no execution path runs
      over MCP.

### Phase R3 — Recorded nulls

- [ ] **R3.1** Live variant mode is Class B and therefore prohibited in core;
      recorded out of scope. The in-scope substitute is a turn-scoped
      `/design variants` built on E3.1.
      verify: the null record names it, and no binding in `hook_manifest.yaml`
      and no command added in this branch keeps a browser open.
- [ ] **R3.2** Execution-graph v2 and the `STEP_ORDER` generalisation are
      deferred with A9, with the re-open condition named: a measured step-order
      defect.
      verify: the null record names the re-open condition, and
      `grep -c 'STEP_ORDER' src/agent-src/templates/scripts/work_engine/intent/classify.ts`
      is unchanged by this branch.

**Exit criteria (lane R).** Either the resolver cleared T1–T4 on the frontend
population and shipped, or the lane is closed with a published null.
**Rollback.** R1.2 and R2.2 are the only shipping steps and both are
conditional; not shipping is a declared outcome, not a failure.

## Phase Z — Publish, then flip

- [ ] **Z.1** Every 0.3 metric published with its corpus hash, per host; every
      failed prereg recorded as a null beside its falsifier.
      verify: the published set covers every metric named in
      `internal/bench/frontend-power-PREREG.md`, with none missing and none
      present that the prereg does not name.
- [ ] **Z.2 Blind A/B** — the baseline against lanes E and A (and R if it
      shipped) on the 0.2 corpus, with the margin committed before any result is
      read, plus a human spot-check.
      verify: the commit recording the margin precedes the commit recording the
      results.
- [ ] **Z.3** Default-ON follows Z.2's margin; it does not precede it.
      verify: the commit flipping the pack default is later than Z.2's results
      commit and cites its number.

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

### blocker: b-pack-reach-weight

- **Status:** open
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

- [ ] AC-1 — On a Grade-A host with the pack enabled, a UI write yields
      deterministic findings with no skill consultation, and the delivery rate
      is published per host with its carrier grade.
- [ ] AC-2 — No new component reaches completion without an audit artefact; the
      block is deterministic and its cost is measured.
- [ ] AC-3 — P0 floors block at stop with a continuation, P1–P3 never block,
      and a pass that could not run reports `verification: degraded|unverified`
      with a `degradation_reason` rather than passing.
- [ ] AC-4 — The render primitive exists, is Class A, and the fidelity
      roadmap's `b-page-capture-primitive` and
      `b-detector-license-verification` each carry a resolved disposition
      traceable to a step here.
- [ ] AC-5 — Measured against the 0.6 baseline of 21 backed / 3 floor /
      14 judgment-only / 2 deferred, at least eight formerly `judgment-only`
      rows are `backed` with epoch hashes, and every failure is a recorded null.
- [ ] AC-6 — Exactly one `ui_authority` object exists; a `preserve` request
      does not change the visual world and a `wireframe` never resolves to a
      pixel mandate, both pinned by fixtures authored before the behaviour.
- [ ] AC-7 — `design-review` output shows two assessment ids or the DEGRADED
      banner, and no third state.
- [ ] AC-8 — `/design` exists as a command, the skill count is unchanged, and
      standing context did not rise — with both numbers recorded here.
- [ ] AC-9 — Lane R shipped only after clearing T1–T4 on the frontend
      population, or closed with a published null naming its falsifier.
- [ ] AC-10 — The Z.2 blind-comparison margin was committed before any result
      was read, and the default-ON flip cites it.
- [ ] AC-11 — The reach question is on the record: the A6.1 ADR names the
      chosen option and its standing-context cost, and every Phase Z number
      states whether it holds for an `engineering-base`-only install.
- [ ] AC-12 — Every claim carried over from the four inbox drafts is either
      verified at a named `file:line`, corrected with a
      `corrected-from-reproduction` tag, or listed in § Rejected with the line
      that refutes it — none is carried unmarked.
