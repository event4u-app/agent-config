<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: structural
---

# Road to source-first frontend — when the code is available, the code is the data basis; a screenshot is validation

> **The ask (2026-08-12, second operator report):** when implementing a
> frontend from a provided Claude-Design artifact (HTML + scripts included),
> the agent takes screenshots and rebuilds from pixels instead of reading the
> code. Observed damage: inconsistent design, different design, the artifact's
> HTML not adopted (worse markup written from scratch), missing JavaScript.
> The operator's principle, adopted verbatim as this roadmap's title claim:
> **whenever source is reachable — as archive, provided files, or through the
> browser (DevTools / Playwright / etc.) — the source is the data basis;
> screenshots are for validation and for genuinely dynamic content.**

> **Standing on shipped work.** The archived
> [`road-to-provided-artifact-honesty`](archive/road-to-provided-artifact-honesty.md)
> closed the routing, refusal, coverage, and precedence gaps — **on the engine
> path**. This roadmap starts from the finding that the operator's failure
> reproduces anyway, and confirms why: every shipped guarantee is keyed on
> engine state that ad-hoc runs never set, the source-over-pixels principle is
> prose in one skill with no deterministic carrier, and one shipped reference
> actively teaches the screenshot-first workflow. Pinned commit for all repo
> claims: `ed76d224` (v10.1.0). *(proposal)* markers denote this roadmap's own
> suggestions, never adopted foundations (ADR-211 C/D).

> **Re-verified at adoption against tip `1432c7a45`** (81 commits past the pin).
> Every W-claim held; three anchors drifted and one sibling-state claim was wrong
> — corrected inline below, verdict table in
> [`road-to-august-program`](road-to-august-program.md) § Verification at adoption.
> Program sequencing: **Phase 1 Step 2 runs in Wave 0** (it is spike-shaped and
> X2 needs its result beside the `agent_id` spike), and **Phase 3 depends on
> `road-to-subagent-lifecycle-integrity` Phase 0 Step 4 + Phase 4** (X2).

> **Process note.** This roadmap is the second run of the loop codified in
> [`road-to-symptom-driven-harvest-loop`](archive/road-to-symptom-driven-harvest-loop.md)
> and therefore doubles as that roadmap's Phase-2 falsifier test: if this
> document is rejected as duplicate or unfounded, that is the null to record
> there.

> **Execution status (2026-08-13).** Phases 1, 2 and 5 are closed — 10 of 18
> steps. Phase 4 Step 3 was attempted and **withdrawn**: the completion review
> showed the trigger form available without guessing a vendor's share path
> fires on the vendor's documentation pages, which is the failure the rule's own
> `claude.ai` precedent exists to avoid. Withdrawing it is the step's own
> standard applied, not a shortfall.
> The remaining eight are **blocked on named dependencies, not on effort**, and
> each is recorded at its own phase:
>
> - **Phase 3** (`source-first-gate`) — its verifier exemption keys on a payload
>   field that `road-to-subagent-lifecycle-integrity` Phase 0 Step 4 spikes and
>   its Phase 4 binds; both are open. The roadmap already calls this "a hard
>   dependency, not a nicety": shipping the gate first means warning the one
>   actor doing it right. Step 2 additionally cites the program X3 activation
>   policy note, which does not exist yet.
> - **Phase 4 Steps 1–2** (browser handover) — cite the import adapter and the
>   persistence discipline owned by `road-to-design-system-onramp` Phases 1–2,
>   neither of which exists. Writing the section now would define a second
>   artifact shape, which program X4 exists to prevent.
> - **Phase 6** — a post-landing re-measurement window. Its instrument now
>   exists and **has no population in this repo** (0 UI-write turns over 40
>   sessions); it needs a consumer repo with real UI writes to mean anything.
>   That is a change to what Phase 6 can promise, and it is recorded in the
>   evidence file rather than discovered at re-measurement time.

## Context / What is verified

**W1 — The principle exists as prose, in one skill, with no carrier.**
`existing-ui-audit/SKILL.md:54-57` states it exactly: *"Source priority —
code beats screenshots. … Never read pixel values off a screenshot when the
source is available."* `fe-design/SKILL.md:118-123` cites it. But: (a) zero
deterministic enforcement — `grep -rn screenshot src/scripts --include=*.ts`
finds no hook, no concern, no tool matcher (three hits at adoption, none of them
a matcher: a skill-linter keyword bucket `skill_linter.ts:3170`, a comment noting
`screenshots.data_bearing_gate` is itself unread `_lib/agent_settings.ts:920`,
and the comment in `_lib/reddit_thread_parse.ts:6` the draft named as the sole
hit); (b) the sentence is scoped to *exact values*
during the audit, not to the artifact as the *implementation source*; and
(c) whether the prose even reaches the model is the open catalogue-delivery
question of [`road-to-frontend-skill-application`](road-to-frontend-skill-application.md)
(Phase 2 steps 2–4 open, verdict `no-selector`). Prose with an unverified
delivery channel and no runtime carrier is the reliability gap this package
has already named elsewhere.

**W2 — A shipped reference teaches the failure.**
`design-review/references/verification-automation.md:30-39`, § Mockup-to-code
verification: *"1. Open the mockup — use the provided image/screenshot.
2. Implement …"* — no branch for the case where the "mockup" is code. An agent
that reaches this reference is instructed into image-first implementation,
in direct contradiction with W1's prose. Same tree, opposite duties.

**W3 — Every honesty guarantee is engine-gated; ad-hoc runs bypass all of
them.** The refusal halt and loss inventory key on the brief pipeline
(`directives/ui/design.ts:67` `UNCARRIED_BY_THE_BRIEF`, `:93`
`design_provided_without_contract` — full path
`src/agent-src/templates/scripts/work_engine/directives/ui/design.ts`, verified
unmoved at adoption); the coverage report lives in the engine's
apply step (`coverage_gaps`, defined `apply.ts:139`, sole production consumer
`apply.ts:105`); the review-side protection keys on
`state.ui_design.provided_artifact` (`design-review/SKILL.md:218-228`). A
Claude-Code-direct ("ad-hoc") run sets none of that state. The `fe-design`
ad-hoc loop (§ Ad-hoc mode) carries **no** interaction-inventory or coverage
duty — `grep -n "interaction\|coverage\|handler\|keyframe" fe-design/SKILL.md`
returns nothing in the loop. The operator's "missing JavaScript" report is this
hole: the duty
that would catch a dropped handler exists only where the engine runs. This is
the same engine-only ownership shape `road-to-frontend-skill-application`
Phase 3 already tracks for design quality generally; here it is the honesty
machinery specifically.

**W4 — No adopt-the-code duty exists.** `design-fidelity` and its mechanics
guideline govern *decisions* (fonts, controls, layout, colours, elements) and
assets (`design-fidelity-mechanics.md:34-37`). Nothing anywhere states that
when the artifact's own markup/CSS/JS is stack-compatible, **adapting that
code is the default and re-derivation is itself a deviation** requiring the
same confirmation as a swapped font. The operator's third report — the
artifact's HTML not adopted, worse markup written from scratch — is currently
not a rule violation at all.

**W5 — The URL/live-page handover class is uncovered, and the lock chilled
the accept-side answer.** `design-fidelity.md` triggers cover `Claude Design`,
`claude.site/artifacts`, `*design.html`, `.claude/design-system/` — no
`lovable.dev`, `v0.dev`, `bolt.new`, no staging/localhost class
(`grep -i lovable src/rules/` → 0 hits; Lovable appears only as an
inspiration reference in `docs/contracts/adr-product-ui-track.md:75,158`).
And no text anywhere says what to do when the artifact is reachable **in a
browser**: the 2026-06-28 council lock forbids *shipping* a crawler /
Playwright runtime (`design-system-capture/references/design-system-json.md:7`,
restated `:72-73` — the draft's `reference/…:64-65` anchor drifted; the lock did not),
but extracting DOM/styles/scripts **through the user's own connected browser
tools** is on the accept side of the lock's own sharpened reading
(`archive/road-to-provided-artifact-honesty.md` § Design constraints) — and
that permission is written down nowhere the agent reads.

**W6 — A co-installed generative skill pushes the other way.**
**Source C** — the upstream of this tree's own vendored design corpus (its real
identity and pin live in `src/skills/design-intelligence/ATTRIBUTION.md`, the one
place license attribution belongs), @ `97eb2a20`, fetched + cloned
2026-08-12: its `SKILL.md` Step 2 — *"Generate Design System (REQUIRED for new
pages/projects). Always start with `--design-system`"*. Installed next to
agent-config, it instructs regeneration with no provided-artifact carve-out
of its own. No precedence clause in this tree says a provided artifact
outranks third-party generative design tooling. (What the repo does well and
is worth borrowing: file-persisted `design-system/MASTER.md` + `pages/*.md`
overrides with an explicit retrieval order, skip-if-exists-unless-`--force`
discipline, and a pre-delivery checklist — harvest verdicts in Phase 4/5.)

## Symptom → defect map

| Reported symptom | Confirmed defect(s) | Phase |
|---|---|---|
| Screenshots instead of source as the data basis | W1 (no carrier), W2 (contradicting reference), W5 (browser handover unwritten) | 1, 2, 3, 4 |
| Design inconsistent / different from the artifact | W1+W3 (guarantees bypassed ad-hoc) | 2 |
| HTML not adopted, worse code written from scratch | W4 (no adopt-the-code duty) | 2 |
| Missing JavaScript | W3 (coverage duty engine-only) | 2 |
| (latent) third-party skill regenerates despite the artifact | W6 | 5 |

## External sources drawn in (per defect)

> Named inspiration sources are anonymized per
> [`source-confidentiality`](../../src/rules/source-confidentiality.md): a
> tracked artifact may name a tool it recommends **integrating**, but not a repo
> it learned a design from. Tool references below stay named; the two
> derivation sources are Source A and Source B.

- **Source A** — a web-cloning product whose thesis states the operator's
  principle verbatim as its differentiator: it clones from CSS and structured
  blocks rather than screenshots, on the argument that guessing from pixels is
  the competing approach it beats. Extraction runs before any builder. → W1, W5.
- **Source B** — two independent cloner pipelines converging on one shape:
  reconnaissance → extraction **written to files** (tokens, component specs) →
  builders consume the files; screenshots live in a separate references
  directory carrying QA duty only, and the screenshotter and the extractor are
  **separate roles**. → Phase 4 design.
- **Playwright MCP docs + ecosystem** (playwright.dev/mcp, microsoft/playwright-mcp):
  the a11y/DOM snapshot is the agent's data channel, screenshots are for
  visual verification of what the tree cannot capture; reported 10–100×
  token reduction and determinism gains. The industry default already matches
  the operator's rule. → W5, Phase 3 rationale.
- **Source C** @ `97eb2a20` — Master+overrides persistence with an
  explicit retrieval order; skip-if-exists; pre-delivery checklist. Adopt the
  persistence/retrieval pattern for the extraction artifact; **reject** its
  generative-first default for the port case. → W6, Phase 4/5.

## Phase 1: Measure — reproduce ad-hoc, census the screenshot tools

- [x] **Step 1:** Run the existing `daf-port-baseline` artifact
      (`tests/design-artifacts/fixtures/design.html`) through an **ad-hoc**
      session (no engine) with "setz das 1:1 um". Record: was the artifact
      file read before any write; was a screenshot/vision path used; did the
      three handlers and the keyframe survive; was any loss stated. This is
      the ad-hoc twin of the honesty roadmap's Phase-0 measurement, which
      only ever ran the engine path.
      **Done 2026-08-13, run TWICE (with and without a trigger phrase), result
      INCONCLUSIVE with a named cause** —
      [`source-first-frontend-phase1`](../evidence/analysis/source-first-frontend-phase1.md).
      Both arms read the source, kept 3/3 handlers and 1/1 keyframe, and stated
      their deviations. The screenshot dimension **could not vary**: Step 2
      measured zero browser-capable capture tools on the host. The falsifier's
      literal condition is met and is deliberately **not** honoured — a null
      produced by a setting that excludes the failure mode is not a null.
- [x] **Step 2:** Census the screenshot-capable tool names actually present
      across the supported hosts (Claude Code browser tools, Playwright MCP
      `browser_take_screenshot`, Chrome MCP equivalents, `Bash` screencapture
      shapes) — the matcher list for Phase 3 comes from this census, never
      from memory.
      **Done 2026-08-13 for THIS host only, and it returns one entry:**
      `screencapture` (`/usr/sbin/screencapture`) via `Bash`. Playwright MCP,
      Chrome-DevTools-MCP and `mcp__claude-in-chrome__*` are all absent from the
      session tool surface; the package registry carries only read-only github
      and jira. The one present tool photographs the display, not a page.
      A Phase-3 matcher built from this census alone would watch the wrong
      surface — the multi-host half of this step stays open by host limitation.
- [x] **Step 3:** Extend the `ui-route-nudge` consultation latch definition so
      that reading a provided artifact file (the handover classes
      `design-fidelity` already routes) counts as consultation — capture-only
      in this phase; publish the "artifact read before first UI write" rate
      alongside the existing consultation-rate instrument, same event stream
      (the shared-population discipline `ui_route_nudge_hook.ts:20-27`
      already states).
      **Done 2026-08-13, with one deliberate departure from the step's letter.**
      The step says "counts as consultation"; this phase's own rollback line
      says `nothing behavioural`. Folding the read into the `consulted` latch
      would **silence the nudge** for any session that opened a `design.html` —
      a behaviour change — so the two cannot both be honoured. The read is a
      shared predicate (`isArtifactRead`) that `decide()` never branches on; a
      test asserts the warn outcome is identical with and without a read.
      Whether an artifact read *should* latch consultation is a real question
      and now a separate decision — it wants this rate to answer it.
      **Corrected after the completion review:** the first pass also latched two
      session fields in the hook, which nothing read — the named metric was
      computed and discarded while the published one was unnamed. The
      measurement now lives in the analyzer alone, and it publishes
      `READ BEFORE FIRST WRITE` over **handover sessions**, not over every UI
      write, because a session with no handover cannot fail to read one.
      **The rate has no population in this repo:** 0 UI-write turns over 40
      sessions, because a governed instruction suite has almost no UI surface
      for the predicate to match. It also carries a stated blind spot — a
      handover that is never read leaves no transcript trace, so the rate is a
      ceiling on the defect rather than a measurement of it. Consequence for
      Phase 6 recorded in the evidence file.

**Falsifier.** Step 1 shows the ad-hoc run reading the source, adopting the
markup, and reporting losses without any of the changes below → the symptom
is not reproducible on current main; publish the null, park Phases 2–4, and
hand the operator report back with the measurement.

**Rollback.** Fixtures and telemetry only; nothing behavioural.

## Phase 2: One data-basis ladder, written where the agent reads, engine-independent

- [x] **Step 1:** Add § *Data-basis ladder* to
      `docs/guidelines/design-fidelity-mechanics.md` *(proposal)*, one table,
      cited by both `fe-design` and `design-review`: **(1) provided source
      files/archive → (2) repository/source read via any channel, including
      the user's connected browser tools (DOM, stylesheets, scripts) → (3)
      structured snapshot (a11y tree) → (4) screenshot — screenshots are
      legitimate for visual validation and for content only reachable
      dynamically, never as the data basis while a higher rung is reachable.**
      Analyzing/improving the source stays explicitly allowed — the ladder
      governs where data comes from, not whether defects may be fixed.
- [x] **Step 2:** Fix the W2 contradiction in
      `design-review/references/verification-automation.md:30-39`: the
      mockup-to-code section branches on artifact kind — *code artifact →
      read the code, screenshot for after-the-fact visual diff only; image
      artifact → current workflow.* One near-miss note that an HTML file
      opened in a browser is still a code artifact.
- [x] **Step 3:** Add the adopt-the-code duty (W4) to the mechanics guideline
      and the `design-fidelity` Iron-Law block *(proposal)*: where the
      artifact's markup/CSS/JS is stack-compatible, adaptation of that code is
      the default; a from-scratch re-derivation is a **deviation** requiring
      the same explicit confirmation as a swapped control. Stack translation
      (Blade/JSX) translates the artifact's structure; it does not license a
      new one.
      **Mandatory scope line (program X8) — without it this duty is
      unshippable:** [`code-provenance`](../../src/rules/code-provenance.md)
      opens with `NEVER ADOPT EXTERNAL CODE VERBATIM` and routes any conscious
      borrow through a license check plus a ledger entry, so as drafted the two
      rules contradict each other on the same act. The resolution weakens
      neither: a **user-supplied design artifact is the user's own material**,
      not third-party external code — the same carve-out
      [`content-quoting-floor`](../../src/rules/content-quoting-floor.md)
      already makes for user-owned text. Third-party code that merely *arrives*
      through a design handover (a vendored component, a licensed template)
      stays under `code-provenance` in full. Both rules gain the cross-link in
      the same change, so the boundary is readable from either side.
- [x] **Step 4:** De-gate the coverage duty for ad-hoc runs: a step in
      `fe-design` § Ad-hoc mode — inventory the artifact's interactions,
      keyframes, and script includes **before building**; every item lands in
      exactly one bucket (adopted verbatim / translated / dropped-with-stated-
      reason), mirroring the engine's `coverage_gaps` buckets by name so the
      two surfaces cannot drift. Prose duty first; a deterministic ad-hoc
      checker is a gated follow-up, opened only if Phase 6 re-measurement
      shows the prose alone did not move the number.
- [x] **Step 5:** One fixture per new duty (`daf-adhoc-port-coverage`,
      `daf-source-over-screenshot`, `daf-rederive-is-deviation`), wired into
      the `daf-*` set.
      **Done 2026-08-13.** All three carry their measured-or-skipped state
      rather than an assumed pass: `daf-adhoc-port-coverage` PASS on both arms
      with the setting stated, `daf-source-over-screenshot` **SKIPPED —
      primitive absent** (no capture tool on the host, per the § Notes
      skip-with-caveat rule), `daf-rederive-is-deviation` unmeasured because
      both arms were same-stack and its question is cross-stack.
      Also repaired in passing: `daf-handoff-bundle` was cited by no scanned
      surface, so `lint-eval-fixture-citations` was **red before this branch**;
      one citation line in the guideline fixes it.

**Falsifier.** Owned per-duty by Phase 6's re-measurement.

**Rollback.** Guideline sections and skill steps revert by file; fixtures stay.

## Phase 3: The deterministic carrier — a source-first gate on screenshot tools

- [ ] **Step 1:** `source-first-gate` PreToolUse concern *(proposal)*, matcher
      = the Phase-1 Step-2 census list. Fires only when ALL hold: the session
      has a routed design handover (the same trigger event `design-fidelity`
      records) AND the consultation latch shows the source **unread** AND the
      called tool is screenshot-shaped. Then: exit 2 warn — *"source
      available and unread — the data basis is the code; screenshot is for
      validation"* — never a block (a screenshot is a judgement call, the
      ui-route-nudge argument verbatim). Valve: ≤2 per session, then silent
      (`MAX_NUDGES` shape, `ui_route_nudge_hook.ts:53`). Reuses the
      `ui_surface.ts` / latch state machinery; no new subsystem.
      **Verifier exemption (program X2) — a hard dependency, not a nicety:** a
      verifier subagent screenshotting for QA is the *sanctioned* use of a
      screenshot, so the gate must not fire on it. The clean exemption key is the
      payload `agent_id` / `agent_type` field that
      [`road-to-subagent-lifecycle-integrity`](road-to-subagent-lifecycle-integrity.md)
      Phase 0 Step 4 spikes and its Phase 4 binds the role axis on. **This step
      therefore lands after SLI Phase 4** — shipping the gate earlier means
      warning the one actor doing it right.
- [ ] **Step 2:** Ship **default-ON, warn-only** *(proposal — maintainer
      call)*. The estate's own evidence cuts both ways: `design-slop` and
      `ui-route-nudge` shipped default-OFF and the symptom shipped with them;
      the turn-end-gate's round-6→round-7 history records why "a concern
      which is off cannot soak" (`hook_manifest.yaml:477-481` at adoption). If
      OFF is chosen, pre-register the flip condition now. **Decided by the
      concern activation policy (program X3), which this step cites rather than
      re-arguing** — the same argument was being made independently in three
      roadmaps, which is how activation postures drift apart.
- [ ] **Step 3:** Snapshot tests: fires / latched-silent / valve-exhausted /
      no-handover-silent, under `tests/hooks/`.

**Falsifier.** One measurement window with the gate armed shows zero fires
while Phase-1 telemetry still shows screenshot-first behaviour → the matcher
census missed the real tool surface; fix the census before touching the
concern logic.

**Rollback.** One manifest line.

## Phase 4: The browser handover — extraction into files, inside the lock

- [ ] **Step 1:** § *URL / live-page handover* in the mechanics guideline
      *(proposal)*: when the artifact is handed over as a URL (Claude Design
      share, Lovable, v0, bolt, staging/localhost), extract **through the
      user's connected browser tools** — DOM, stylesheets, scripts, assets —
      into **`design-system.json`** under `.claude/design-system/` (the
      `path_prefix` the fidelity rule already routes), **before any UI write**.
      **Program X4 — the extraction artifact IS `design-system.json`**, not a
      second shape: this step cites the existing contract
      (`design-system-capture/references/design-system-json.md`) and the import
      adapter from
      [`road-to-design-system-onramp`](road-to-design-system-onramp.md) Phase 1,
      and defines no format of its own. Raw source files land beside it. Screenshots taken during extraction land in a references
      directory and carry QA duty only (the cloner-pipeline shape: extraction
      files feed the builder, images feed review). State the lock boundary in
      the section itself: the package ships instructions and validation, never
      the crawler/runtime — accept-side, per the council's sharpened reading.
- [ ] **Step 2:** State the **retrieval order** in this section — project
      `design-system.json` → extraction artifact → live page — so the source
      survives sessions instead of being re-screenshotted next time. The
      **persistence discipline itself** (skip-if-exists unless explicitly forced;
      never silently discard prior decisions, borrowed from Source C) is
      owned by [`road-to-design-system-onramp`](road-to-design-system-onramp.md)
      Phase 2, where it already lives — cited here, stated once there (program
      X4). This section owns the **producer sentence**: the documented easy path
      is a connected extractor MCP, with the manual Chrome-DevTools-MCP channel
      as fallback.
- [ ] **Step 3:** Extend `design-fidelity` triggers with `lovable.dev`,
      `v0.dev`, `bolt.new` URL phrases — each with its near-miss row in
      `ROUTING_MATRIX` per the rule's own extension discipline
      (`design-fidelity.md` § Routing). A bare-domain chat mention stays
      silent, same as the `claude.ai` precedent.
      **ATTEMPTED AND WITHDRAWN 2026-08-13 — the available trigger form is
      over-broad, and shipping it would fail this step's own standard.**
      `https://v0.dev/` was tried; matching is plain substring containment, so
      it also fires on `https://v0.dev/docs`, a pricing page or a changelog
      link — every mention of the vendor's own site becomes a spec handover.
      That is exactly the `claude.ai` failure the capability-URL trigger was
      written to avoid. The completion review caught it: the near-miss row
      shipped alongside tested a **protocol-less** mention, which was already
      silent before the change and therefore could not detect the
      over-broadness the change introduced.
      Left behind so a retry cannot repeat it: `near-bare-host-mention` and
      `near-builder-host-non-handover-url` pin both directions silent.
      **What would close this step:** a verified share-path segment per vendor
      (not a guessed one), or a matcher that can express handover-word
      co-occurrence. Neither is available from the repo.

**Falsifier.** The extraction-artifact path goes unused across two release
cycles of real handovers (telemetry from Phase 1 Step 3) → the browser
handover class is rarer than the report suggests; fold the section into the
existing handover prose and drop the persistence step.

**Rollback.** Guideline section + trigger rows; the contract is untouched.

## Phase 5: Interop precedence — a provided artifact outranks generative tooling

- [x] **Step 1:** One clause in the mechanics § Provided-artifact precedence
      *(proposal)*: the precedence chain gains a fourth member — *provided
      artifact > anti-slop > house taste **> any generative design-system
      tooling, first- or third-party***. A co-installed skill instructing
      "always generate a design system first" does not apply to a port; its
      output may inform decisions the artifact leaves open, nothing more.
- [x] **Step 2:** Harvest verdicts on **Source C** recorded where
      harvest verdicts live: **adopt** (persist + retrieval order,
      skip-if-exists, checklist-as-predelivery-gate — consumed in Phase 4),
      **reject** (generative-first default for the port case, `--design-system`
      REQUIRED step), **parked** (BM25 CSV search as a corpus-grounding
      alternative — overlaps the existing 16-stack corpus; compare only if
      the corpus roadmap asks).
      **Done 2026-08-13** — `agents/settings/contexts/design-corpus-upstream-harvest.md`,
      anonymised per `source-confidentiality` with the real identity left where
      licence attribution belongs. The park carries an explicit un-park
      condition so it is a decision rather than a backlog entry.

**Falsifier.** None needed beyond Phase 6 — the clause is one sentence; if it
never binds, it costs nothing.

**Rollback.** One clause, one verdict file.

## Phase 6: Close the loop — re-measure ad-hoc, decide the gated follow-ups

- [ ] **Step 1:** Re-run Phase 1 Step 1 (ad-hoc port) after Phases 2–4 land;
      publish before/after on the four recorded dimensions (source read
      first, screenshot role, interaction survival, loss statement).
- [ ] **Step 2:** Decide the two gated follow-ups on the numbers, not before:
      (a) a deterministic ad-hoc coverage checker (Phase 2 Step 4's follow-up)
      if interaction survival did not move; (b) flipping `source-first-gate`
      from warn toward the ladder's stronger enforcement if the read-first
      rate did not move while the gate fired.

**Falsifier.** All four dimensions green with prose + warn-gate alone → the
deterministic follow-ups stay closed; record it as the second data point for
the estate-wide "when is prose enough" question.

## Acceptance Criteria

> Added 2026-08-13 after the completion review found the roadmap had none: the
> phase-level Falsifiers state when a phase is **wrong**, which is not the same
> as stating when it is **done**. A review over closed steps had nothing to
> check against. Each criterion below is checkable from the tree.

| # | Criterion | Met? |
|---|---|---|
| A1 | The data-basis ladder exists as one table in the mechanics guideline, cited by name from both the rule's Iron-Law block and `design-review`'s verification reference | yes |
| A2 | `verification-automation.md` § Mockup-to-code branches on artifact kind; the code branch reads the code and the image branch survives unchanged | yes |
| A3 | The adopt-the-code duty exists AND its `code-provenance` scope line is present, with the cross-link readable from both rules | yes |
| A4 | `fe-design` § Ad-hoc mode carries an inventory step whose buckets are the engine's own `COVERAGE_BUCKETS` names, and it renders as a step of the loop | yes |
| A5 | Three `daf-*` fixtures exist, each carrying its measured / skipped / unmeasured state rather than an assumed pass, and each cited by a scanned surface | yes |
| A6 | The precedence chain names generative design-system tooling as its fourth member | yes |
| A7 | The Source-C harvest verdicts are recorded anonymised, with the park carrying an un-park condition | yes |
| A8 | The read-before-write rate is published over a denominator its own prose endorses, and its blind spot is stated in the output | yes |
| A9 | No new trigger ships without a near-miss row testing the direction that trigger opens | yes — enforced by withdrawing the builder-URL class rather than shipping it |
| A10 | Every Iron-Law line added to `design-fidelity` is consistent with that rule's own § What counts as the spec | yes — the screenshot line carries its scope clause |

**Not claimed:** that the operator's symptom is fixed. Phase 1 could not
reproduce it under conditions where it can occur (no capture tool, no URL
handover), so these criteria cover the *defects verified in the tree*, not the
symptom. Phase 6 is where the symptom claim would be earned, and it needs a
consumer repo.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The adopt-the-code duty contradicts an existing Iron Law | implementation | `code-provenance` opens with `NEVER ADOPT EXTERNAL CODE VERBATIM` and routes any conscious borrow through a license check plus a ledger entry. Phase 2 Step 3 instructs the opposite for a provided artifact. Two Iron Laws giving opposite instructions on the same act is worse than either gap alone: whichever the agent follows, it is violating a rule, and no gate can arbitrate | Phase 2 Step 3 carries a mandatory scope line — a user-supplied artifact is the user's own material, not third-party external code, mirroring the carve-out `content-quoting-floor` already makes — and both rules gain the cross-link in the same change so the boundary is readable from either side | Phase 2 Step 3 |
| 2 | More prose into a delivery channel already measured as broken | product | Every duty in Phase 2 is prose in a skill, and whether skill prose reaches the model at all is the open catalogue-delivery question with a `no-selector` verdict against it. Adding four duties to an unverified channel produces the appearance of a fix with no mechanism, which is precisely how the shipped `road-to-provided-artifact-honesty` guarantees ended up bypassed | Phase 1 Step 3 instruments the artifact-read-before-write rate on the existing event stream first, and Phase 6 re-measures the same four dimensions after the prose lands; the deterministic follow-ups are opened only if the numbers did not move | Phase 6 |
| 3 | The gate warns the one actor doing it right | implementation | A verifier subagent screenshotting for QA is the sanctioned use. A `source-first-gate` matched on screenshot tools with no exemption fires on exactly that actor, which teaches the reader to ignore the warning and burns the valve on false positives | The verifier exemption keys on the payload `agent_id` / `agent_type`, and this phase is sequenced after `road-to-subagent-lifecycle-integrity` Phase 4 establishes that binding — stated as a hard dependency, not a note | Phase 3 Step 1 |
| 4 | Phase 1 refutes the premise after the plan is written | product | The measurement that decides whether the symptom reproduces ad-hoc on current main runs first, and it may come back green — in which case five phases of enforcement design were authored against a symptom the tree no longer has | That outcome is the pre-registered falsifier: publish the null, park Phases 2–4, hand the operator report back with the measurement; the roadmap is written so the null is a clean stop rather than a sunk cost | Phase 1 |
| 5 | Extraction into files goes unused and the section rots | product | The browser-handover class rests on one operator report. If real handovers rarely arrive as URLs, the extraction artifact path, the persistence discipline, and three new trigger rows are maintained for a case that does not occur | Phase 4's falsifier folds the section into the existing handover prose and drops the persistence step if the path goes unused across two release cycles, measured by the Phase-1 telemetry rather than by impression | Phase 4 |

## Non-goals

- No crawler, no Playwright runtime, no font-bundler shipped — the
  2026-06-28 lock holds; everything here is instruction, validation, and
  hooks over the user's own tools.
- No prohibition of screenshots — validation, dynamic content, and image-only
  mockups keep them; the ladder orders data sources, it does not ban rungs.
- No re-litigation of the shipped engine-path honesty work — this roadmap
  extends its guarantees to where the operator actually runs.
- No second generative track, no new subsystem — one guideline section, one
  concern on existing machinery, trigger rows, and skill-step amendments.
