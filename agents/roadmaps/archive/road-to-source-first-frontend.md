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
> [`road-to-august-program`](archive/road-to-august-program.md) § Verification at adoption.
> Program sequencing: **Phase 1 Step 2 runs in Wave 0** (it is spike-shaped and
> X2 needs its result beside the `agent_id` spike), and **Phase 3 depends on
> `road-to-subagent-lifecycle-integrity` Phase 0 Step 4 + Phase 4** (X2).

> **Process note.** This roadmap is the second run of the loop codified in
> [`road-to-symptom-driven-harvest-loop`](archive/road-to-symptom-driven-harvest-loop.md)
> and therefore doubles as that roadmap's Phase-2 falsifier test: if this
> document is rejected as duplicate or unfounded, that is the null to record
> there.

> **Execution status (2026-08-20) — NO OPEN STEPS. 16 done, 1 deferred, 1
> cancelled, of 18.** Phases 2, 3, 5 and 6 are closed; Phase 4 is 2/3 with its
> Step 3 now recorded `[-]`; Phase 1 is closed except its multi-host census
> half, which stays `[~]` with a recorded resolution and a named closing
> condition. The 2026-08-13 status block below is left in place rather than
> rewritten, so the stale claim stays auditable — read it as history, not as
> state.
>
> **What unblocked Phase 3, since the block below says it was blocked on two
> dependencies:** neither dependency was satisfied and neither was waited on.
> The concern ships in **shadow** — bound, always-on, emitting nothing — and
> under that posture both dependencies stop being preconditions and become
> recorded fields. The verifier-exemption risk is a harm of *emission*, so a
> concern with no emission cannot realise it; the unfinished matcher census is a
> false-positive problem, so a concern that cannot produce a false positive
> measures the census instead of needing it. The two open SLI steps
> (`agent_id` on a PreToolUse payload) were re-verified open on 2026-08-20, and
> Phase 3 Step 1 records their state rather than assuming it.
>
> **What Phase 6 could and could not earn.** Three of its four dimensions moved
> and are measured; the screenshot dimension is still unreachable on this host
> for Phase 1's reason. The roadmap's own "Not claimed" clause below therefore
> still stands in full: the operator's *symptom* is not claimed fixed, because
> the conditions under which it occurs (a page-reaching capture primitive, a URL
> handover) are still absent from every measurement this repository can run.
>
> **Execution status (2026-08-13) — HISTORICAL.** Phase 2 and Phase 5 are closed; Phase 1 is
> closed except its multi-host census half — **9 done, 1 deferred** of 18.
> Phase 4 Step 3 was attempted and **withdrawn**: the completion review
> showed the trigger form available without guessing a vendor's share path
> fires on the vendor's documentation pages, which is the failure the rule's own
> `claude.ai` precedent exists to avoid. Withdrawing it is the step's own
> standard applied, not a shortfall.
> That leaves eight open: **seven blocked on named dependencies rather than on
> effort**, plus the withdrawn Step 3 above. The seven, each recorded at its own
> phase:
>
> **Correction (2026-08-16) — it is six, not seven.** The Phase 4 Steps 1–2
> bullet below was true when written and is now false: it says the import
> adapter and the persistence discipline do not exist. Both do.
> `road-to-design-system-onramp` closed and archived (`c4e95d36a`,
> `agents/roadmaps/archive/road-to-design-system-onramp.md`, zero open steps);
> the adapter ships as `src/scripts/design_system_import.ts` plus
> `src/scripts/_lib/design_system_import.ts` behind `/design-system:import`, and
> the persistence discipline ships in `/design-system:generate`'s own body
> (*"never overwrite a confirmed `DESIGN.md`"*, *"Never persist silently."*).
> The contract Step 1 must cite —
> `src/skills/design-system-capture/references/design-system-json.md` — and the
> `path_prefix: ".claude/design-system/"` route both exist. Steps 1–2 were
> therefore executable, and are closed on this branch. The bullet is left in
> place with this correction above it rather than rewritten, so the stale claim
> stays auditable.
>
> **Correction (2026-08-17) — the Phase 3 bullet's second dependency is also
> gone.** It says Step 2 "cites the program X3 activation policy note, which
> does not exist yet". It exists:
> `docs/contracts/concern-activation-policy.md`, and that file names this exact
> situation as its reason for being — three roadmaps cited a policy that was
> only ever roadmap prose, so the contract was written to be the artefact they
> cite. Phase 3 therefore has **one** open dependency (the SLI payload field),
> not two. The dependency that remains is the blocking one, so the step's
> takeability does not change — but the count in the bullet does, and a screen
> reading "two open dependencies" over-states how far Phase 3 is from
> executable. Worth knowing before citing it: the contract does not merely
> supply the missing note, it **contradicts** Step 2's proposal — Step 2 asks
> for default-ON warn-only, the contract's Iron Law reads *"a new concern that
> would block starts in shadow, never in advisory"*. Step 2 needs re-arguing
> against it, not a citation.
>
> - **Phase 3** (`source-first-gate`) — **two** open dependencies, not one. Its
>   verifier exemption keys on a payload field that
>   `road-to-subagent-lifecycle-integrity` Phase 0 Step 4 spikes and its Phase 4
>   binds; both are open, and the roadmap calls this "a hard dependency, not a
>   nicety" — shipping the gate first means warning the one actor doing it
>   right. **And its matcher list comes from Phase 1 Step 2's census, which is
>   `[~]`: one host was censused, and that host's only capture tool photographs
>   the display rather than a page.** A matcher built from it would watch the
>   wrong surface. Step 2 additionally cites the program X3 activation policy
>   note, which does not exist yet.
> - **Phase 4 Steps 1–2** (browser handover) — cite the import adapter and the
>   persistence discipline owned by `road-to-design-system-onramp` Phases 1–2,
>   neither of which exists. Writing the section now would define a second
>   artifact shape, which program X4 exists to prevent.
> - **Phase 6** — a post-landing re-measurement window. Its instrument now
>   exists and **has no population in this repo** (0 UI-write turns over 40
>   sessions); it needs a consumer repo with real UI writes to mean anything.
>   That is a change to what Phase 6 can promise, and it is recorded in the
>   evidence file rather than discovered at re-measurement time.

## Outcome

> **Closed 2026-08-20. Outcome state: `transferred`.** Recorded here rather
> than only in the body, because a reader who sees this file in `archive/`
> later must not be able to read "archived" as "achieved". Framework of record
> for the dispositions below:
> `agents/evidence/council/drain-blocker-dispositions-a.md` <!-- ref-ignore -->
> — on `origin/drain/council-records` (PR #1463), not yet on `main`, hence the
> ignore marker.

**Census: 18 steps — 16 satisfied, 2 cancelled (1 of them transferred), 0 open.**

| Phase | Outcome | What that means here |
|---|---|---|
| 1 — Measure | **narrowed** (2/3 satisfied, 1 transferred) | Steps 1 and 3 landed. Step 2's multi-host census is **transferred** to [`stubs/road-to-multi-host-screenshot-census`](stubs/road-to-multi-host-screenshot-census.md): gated on a host capability, not on effort. Its closing condition was **narrowed** on the way out — flip condition (d), an observation, replaces a census campaign. |
| 2 — One data-basis ladder | **satisfied** (5/5) | Ladder, W2 contradiction, adopt-the-code duty with its `code-provenance` scope line, the ad-hoc coverage step, three fixtures. |
| 3 — The deterministic carrier | **satisfied, narrowed in posture** (3/3) | `source-first-gate` ships, tested, and verified end-to-end through the real dispatcher. Narrowed from the drafted `exit 2` warn to **shadow** — the concern emits nothing. That narrowing is what made the phase takeable without its two open dependencies. |
| 4 — The browser handover | **narrowed** (2/3), 1 **cancelled** | Steps 1–2 landed as one guideline section reusing the existing `design-system.json` contract. Step 3 is **cancelled**: the only trigger form reachable from this repo is the over-broad one its own completion review rejected. The W5 URL / live-page handover class it serves is **transferred** to the stub, unscored by any fixture. |
| 5 — Interop precedence | **satisfied** (2/2) | Precedence clause and the anonymised Source-C harvest verdicts. |
| 6 — Close the loop | **satisfied on what it could reach** (2/2) | Step 1 re-measured three of four dimensions; the fourth is **transferred** (no page-reaching capture primitive). Step 2 closed both gated follow-ups — (a) on the numbers, (b) as structurally undecidable while the gate cannot fire. |

**Transferred — the complete list**, all three to the one stub: Phase 1 Step 2
(the census), the screenshot dimension of Phase 6 Step 1, and the W5 URL /
live-page handover class. Every one is gated on the same single fact: no
page-reaching capture primitive exists on this host. The stub names the producer,
the probe, and today's measured reading.

**Cancelled:** Phase 4 Step 3 (builder-URL triggers), withdrawn 2026-08-13 on
its own standard and recorded `[-]` on 2026-08-20.

**Not claimed:** that the operator's symptom is fixed. Phase 1 could not
reproduce it under conditions where it can occur (no capture tool, no URL
handover), so these criteria cover the *defects verified in the tree*, not the
symptom. Phase 6 is where the symptom claim would be earned, and it needs a
consumer repo.

*(That clause is carried verbatim from § Acceptance Criteria, where it was
written before Phase 6 ran. Phase 6 has now run and it still stands unchanged:
the re-measurement moved three dimensions and could not reach the fourth, and
the two conditions it names — a capture tool, a URL handover — are exactly what
the transfer is about.)*

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
- [-] **Step 2:** Census the screenshot-capable tool names actually present
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
      **Marked `[~]`, not `[x]`:** the step says "across the supported hosts"
      and one host was censused. A third review round caught the checkbox
      claiming more than the note underneath it delivered. Phase 3 Step 1 takes
      its matcher list from this census, so the deferral is a real dependency
      and is listed as one below, not a bookkeeping detail.
      **Re-examined 2026-08-20 and still `[~]`, but no longer on Phase 3's
      critical path.** Nothing about the host changed: this environment still
      has exactly one capture tool and it still photographs the display, so
      "across the supported hosts" is still unsatisfiable here. What changed is
      what the deferral blocks. Phase 3 ships in **shadow**, and under shadow an
      over-broad matcher costs a log line instead of a false warning — so the
      unfinished census became the thing being measured (`capture_kind` on every
      record) rather than a precondition. The multi-host half is now flip
      condition (d) of Phase 3 Step 2: the shipped matcher is narrowed to the
      entries that actually appeared, which closes this step **by observation**
      rather than by a second census campaign.
      **Deferred-resolution disposition, recorded per `roadmap-progress-sync`
      Iron Law 3:** this roadmap reached `count_open == 0` with this one `[~]`,
      which armed the no-silent-archive gate. Resolution, in its final form:
      **the item is transferred to a stub and this roadmap's outcome state is
      `transferred`, not `achieved`.** That is a preserving disposition (the
      criterion remains live in the active estate, in the stub), so it is
      council-decidable rather than owner-reserved under that rule's
      preservation test. What closes it: the flip-condition (d) observation
      above, or a census run on a second host — both now recorded in the stub.
      Nothing about it is dropped, weakened, or accepted as lost.
      *(The first-pass resolution recorded here was "stays `[~]`, roadmap stays
      active". Superseded below, and left visible rather than rewritten.)*
      Missing, precisely: a session on a second supported host with a
      page-reaching capture primitive connected.
      <!-- decision 2026-08-20: kept [~] and kept the roadmap active rather than archiving with an unresolved deferral. Conservative and reversible: no information is buried, and the item acquires a named closing condition (Phase 3 Step 2 flip condition (d)) instead of an open-ended one. -->
      **SUPERSEDED the same day — `[~]` -> `[-]`, disposition TRANSFERRED.**
      The paragraph above is left standing because its reasoning is still
      sound and its conclusion is not: keeping `[~]` *is* a preserving
      disposition, but it is not the only one, and it left this roadmap active
      on a condition this environment cannot reach — an active roadmap whose
      only open item is unreachable is a roadmap nobody can close honestly.
      **Transferred**, per the drain-run framework of record
      (`agents/evidence/council/drain-blocker-dispositions-a.md` <!-- ref-ignore -->
      — on `origin/drain/council-records`, PR #1463, not yet on `main`): work
      gated on a **host capability** rather than on effort or judgement moves to
      a stub carrying a named re-entry probe, and the parent records
      `transferred` as its outcome state so that "archived" can never read as
      "achieved".
      Successor: [`stubs/road-to-multi-host-screenshot-census`](stubs/road-to-multi-host-screenshot-census.md),
      which carries this criterion verbatim, the re-scoped flip condition (d),
      the two further transferred items (the screenshot dimension of Phase 6
      Step 1 and the W5 URL / live-page handover class), the named producer and
      probe with today's measured reading, and the two observable proxies from
      Phase 3 Step 1 so that reasoning does not die with this file.
      Nothing is dropped, weakened, or accepted as lost — the item is live in
      the stub, with a cheaper closing condition than it had here.
      <!-- decision 2026-08-20: [-] with outcome state TRANSFERRED to stubs/road-to-multi-host-screenshot-census.md, superseding the keep-[~] decision above. Reversible: the stub carries the criterion verbatim and promotion moves it back. Conservative on the load-bearing axis - the item is preserved and the closure cannot be misread as the symptom being fixed, which is what the Outcome section states in the parent. -->
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

- [x] **Step 1:** `source-first-gate` PreToolUse concern *(proposal)*, matcher
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
      **Done 2026-08-20, in SHADOW posture rather than the drafted `exit 2
      warn` — which is what makes the step takeable at all.** Both stated
      dependencies were re-examined rather than waited on, and both dissolve
      under a posture that emits nothing:
      (1) **the verifier exemption.** Risk 3 is *"the gate warns the one actor
      doing it right"*, and the harm in it lives entirely in the emission. A
      concern that emits nothing warns nobody, correctly or otherwise. So
      `agent_id` / `agent_type` are recorded as **fields** on every shadow
      record (`agent_id_present`, `agent_type`, `verifier_exemption_decidable`)
      instead of being branched on — which measures how large the exemption
      would have to be rather than guessing it. SLI Phase 0 Step 4 and Phase 4
      Step 1 are both still `[ ]`, verified this run, so the field reads false
      today and that is the expected reading.
      (2) **the matcher census.** Phase 1 Step 2 is `[~]` and its one censused
      host contributes a tool that photographs the display rather than a page,
      so "a matcher built from this census alone would watch the wrong
      surface". Under a warn posture that is a false-positive generator; under
      shadow it is the measurement — `capture_kind` (`page` / `display` /
      `unknown`) separates the two on every record, which is precisely the
      datum the census lacks. The matcher itself is **tree-sourced, not
      recalled**: `browser_take_screenshot` from `src/skills/mcp/SKILL.md`,
      `claude-in-chrome` from `src/skills/screenshot-hygiene/SKILL.md` and
      `docs/decisions/ADR-125-doc-screenshot-anonymization.md`, `screencapture`
      from the census note in `tests/design-artifacts/eval-fixtures.md`.
      **One condition of this step could not be honoured as written and is
      recorded rather than faked.** "The session has a routed design handover
      (the same trigger event `design-fidelity` records)" names an event that
      does not exist — `design-fidelity` is a rule with no runtime carrier.
      Two observable proxies are therefore recorded side by side (a handover
      path named by any tool this session; a handover artifact present on disk)
      and the candidate spread is what tells them apart. Promoting one now
      would be the pick-then-measure mistake the activation policy names.
      Files: `src/scripts/hooks/source_first_gate_hook.ts`,
      `src/scripts/hook_manifest.yaml` (concern `source-first-gate`),
      `src/scripts/hooks/concern_registry.ts`. Bound where
      `spawn-guard-shadow` binds — claude and cowork — rather than on all three
      `pre_tool_use` rows, following that concern's precedent exactly.
      <!-- decision 2026-08-20: shipped SHADOW (emits nothing, exit 0 on every path) instead of the drafted exit-2 warn. Conservative and reversible - rollback is one manifest line, and no session can be warned by a concern with no warn path. This is also what makes the step's two open dependencies non-blocking rather than deferred. -->
      **Verified end-to-end through the real dispatcher, not only as pure
      functions** — the wiring is the part a unit test cannot prove. A
      `pre_tool_use` envelope for `browser_take_screenshot` driven through
      `dispatch_hook.ts --platform claude` returned exit 0 with **0 bytes on
      stdout** and the concern's record on disk, which is the shadow contract
      demonstrated rather than asserted: the record exists, and nothing reached
      the model.
      <!-- verified 2026-08-20: `npx vitest run tests/hooks/source_first_gate.test.ts` -> "Test Files 1 passed (1) / Tests 23 passed (23)"; `./scripts-run src/scripts/lint_hook_manifest` -> exit=0; `task typecheck-ts` -> EXIT=0 -->
      <!-- verified 2026-08-20: end-to-end `echo <envelope> | npx tsx src/scripts/hooks/dispatch_hook.ts --platform claude --event pre_tool_use --native-event PreToolUse --project-dir <probe>` -> "dispatcher exit=0  stdout bytes=0", and agents/runtime/state/source-first-gate.jsonl written with tool_matcher=playwright-mcp posture=shadow handover_present_on_disk=true -->
- [x] **Step 2:** Ship **default-ON, warn-only** *(proposal — maintainer
      call)*. The estate's own evidence cuts both ways: `design-slop` and
      `ui-route-nudge` shipped default-OFF and the symptom shipped with them;
      the turn-end-gate's round-6→round-7 history records why "a concern
      which is off cannot soak" (`hook_manifest.yaml:477-481` at adoption). If
      OFF is chosen, pre-register the flip condition now. **Decided by the
      concern activation policy (program X3), which this step cites rather than
      re-arguing** — the same argument was being made independently in three
      roadmaps, which is how activation postures drift apart.
      **Done 2026-08-20 — re-argued against the policy, and the policy wins:
      SHADOW, not default-ON warn-only.** The 2026-08-17 correction above is
      right that a citation is not enough here, so the argument is made rather
      than deferred. `docs/contracts/concern-activation-policy.md` reports two
      measurements pointing the same way — `session-canary`, a verified-firing
      per-turn injection whose compliance miss rate did not move (24 of 29 task
      starts), and conformance round 5, where both blocking carriers reached
      zero violations and neither advisory carrier did. A warn rung would pay
      this concern's full per-call cost and, on that evidence, buy nothing
      measurable. Shadow pays the same cost and buys the false-positive
      distribution a warn needs anyway.
      **The step's own counter-evidence is answered, not ignored.**
      `design-slop` and `ui-route-nudge` shipped default-OFF and the symptom
      shipped with them, and "a concern which is off cannot soak" is true. This
      concern is therefore **not** default-OFF: it carries no
      `hookSectionEnabled` gate and runs on every bound dispatch, exactly as
      `spawn-guard-shadow` does. Shadow is the opposite of off — it soaks
      without emitting.
      **Flip condition pre-registered now**, as the step requires, in the hook
      header: shadow -> advisory when (a) >= 100 capture-shaped records or >= 2
      weeks, whichever comes first, including at least one record with
      `handover_seen_in_session: true`; (b) one candidate rule's
      false-positive share (would-warn on a non-`page` `capture_kind`) is
      <= 1 %; (c) `verifier_exemption_decidable` reads true, i.e. SLI Phase 4
      Step 1 landed; (d) the shipped matcher is narrowed to the entries that
      actually appeared, which closes Phase 1 Step 2's multi-host half by
      observation instead of by a second census. Reverse trigger: no records in
      8 weeks -> evaluate removal.
      **Intended terminal posture is advisory, and that does not license
      skipping shadow.** Phase 3 Step 1 says "never a block", so advisory is
      this concern's destination rather than a waiting room — the policy's
      objection to the advisory *rung* is about concerns on their way to
      blocking. The measurement debt is identical either way: without a shadow
      window there is no false-positive rate for a warn either.
      <!-- decision 2026-08-20: posture = shadow (bound, always-on, emits nothing), NOT the drafted default-ON warn and NOT default-OFF. Conservative, reversible in one manifest line, and it is the option the concern-activation-policy Iron Law prescribes. Flip condition and reverse trigger are pre-registered in the hook header as this step demands. -->
      <!-- verified 2026-08-20: `npx vitest run tests/hooks/concern_severity.test.ts tests/hooks/concern_registry_parity.test.ts tests/hooks/concern_block_exit_parity.test.ts tests/hooks/hook_manifest_compiled.test.ts` -> "Test Files 4 passed (4) / Tests 23 passed (23)" -->
- [x] **Step 3:** Snapshot tests: fires / latched-silent / valve-exhausted /
      no-handover-silent, under `tests/hooks/`.
      **Done 2026-08-20** — `tests/hooks/source_first_gate.test.ts`, 23 cases.
      All four named paths are covered, translated into the shadow posture the
      concern ships in: "fires" is a candidate reading `would_warn: true`,
      "silent" is that candidate reading false. The load-bearing case is the
      negative one — no input makes the concern warn, deny, or emit.
      **Verified sensitive rather than assumed sensitive.** Three sabotage
      probes were run against the mechanism and each turned the suite red:
      ignoring the source-read latch (2 failed), adding a `return 2` warn path
      (1 failed), and leaking the raw `agent_id` into the record (1 failed).
      The restore was by file copy, not `git checkout`, and verified
      byte-identical before the final green run.
      <!-- verified 2026-08-20: `npx vitest run tests/hooks/source_first_gate.test.ts` -> "Tests 23 passed (23)"; sabotage probes -> "Tests 2 failed | 21 passed", "Tests 1 failed | 22 passed", "Tests 1 failed | 22 passed"; restore `diff` silent then "Tests 23 passed (23)" -->

**Falsifier.** One measurement window with the gate armed shows zero fires
while Phase-1 telemetry still shows screenshot-first behaviour → the matcher
census missed the real tool surface; fix the census before touching the
concern logic.

**Rollback.** One manifest line.

## Phase 4: The browser handover — extraction into files, inside the lock

> **Landed 2026-08-16 — Steps 1–2.** Both are one section,
> `docs/guidelines/design-fidelity-mechanics.md` § *URL / live-page handover*,
> placed directly after § Data-basis ladder because it operationalises that
> ladder's rung 2. It defines no format: the extraction artifact is the existing
> `design-system.json` contract at the `.claude/design-system/` prefix the
> fidelity rule already routes, consumed by the existing three-lane
> `/design-system:import` adapter (program X4 satisfied by citation, not by a
> second shape). The lock boundary is stated in the section — contract, adapter
> and instructions ship; crawler, Playwright runtime and font-bundler do not.
> Step 2's retrieval order is a three-row table (project `design-system.json` →
> extraction artifact → live page); the persistence discipline is **cited**, not
> restated, because `/design-system:generate` owns it. The section closes with an
> honest coverage line: no fixture scores the URL-handover class yet, and the
> reason is the same absent page-reaching capture primitive that made
> `daf-source-over-screenshot` skip. **Step 3 stays withdrawn**, so Phase 4 is
> 2/3, not closed.

- [x] **Step 1:** § *URL / live-page handover* in the mechanics guideline
      *(proposal)*: when the artifact is handed over as a URL (Claude Design
      share, Lovable, v0, bolt, staging/localhost), extract **through the
      user's connected browser tools** — DOM, stylesheets, scripts, assets —
      into **`design-system.json`** under `.claude/design-system/` (the
      `path_prefix` the fidelity rule already routes), **before any UI write**.
      **Program X4 — the extraction artifact IS `design-system.json`**, not a
      second shape: this step cites the existing contract
      (`design-system-capture/references/design-system-json.md`) and the import
      adapter from
      [`road-to-design-system-onramp`](archive/road-to-design-system-onramp.md) Phase 1,
      and defines no format of its own. Raw source files land beside it. Screenshots taken during extraction land in a references
      directory and carry QA duty only (the cloner-pipeline shape: extraction
      files feed the builder, images feed review). State the lock boundary in
      the section itself: the package ships instructions and validation, never
      the crawler/runtime — accept-side, per the council's sharpened reading.
- [x] **Step 2:** State the **retrieval order** in this section — project
      `design-system.json` → extraction artifact → live page — so the source
      survives sessions instead of being re-screenshotted next time. The
      **persistence discipline itself** (skip-if-exists unless explicitly forced;
      never silently discard prior decisions, borrowed from Source C) is
      owned by [`road-to-design-system-onramp`](archive/road-to-design-system-onramp.md)
      Phase 2, where it already lives — cited here, stated once there (program
      X4). This section owns the **producer sentence**: the documented easy path
      is a connected extractor MCP, with the manual Chrome-DevTools-MCP channel
      as fallback.
- [-] **Step 3:** Extend `design-fidelity` triggers with `lovable.dev`,
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
      **Box moved `[ ]` -> `[-]` on 2026-08-20.** The withdrawal has been the
      recorded state since 2026-08-13 and the prose above says so, but the box
      still read open, so a reader screening this roadmap counted an executable
      step that nobody may execute. Missing, precisely: a per-vendor share-path
      segment observed from a real handover URL — this environment has no such
      URL, and guessing one is the defect the step was withdrawn over.
      <!-- decision 2026-08-20: recorded as [-] cancelled rather than reopened. The conservative reading of the step's own standard - the only trigger form reachable from this repo is the over-broad one the completion review rejected, and shipping it would fail the step's own test. `near-bare-host-mention` and `near-builder-host-non-handover-url` remain as the pins a retry must clear. -->

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

- [x] **Step 1:** Re-run Phase 1 Step 1 (ad-hoc port) after Phases 2–4 land;
      publish before/after on the four recorded dimensions (source read
      first, screenshot role, interaction survival, loss statement).
      **Done 2026-08-20** —
      [`source-first-frontend-phase6`](../evidence/analysis/source-first-frontend-phase6.md).
      Method re-run verbatim: same fixture, same two arms (one prompt carrying
      a `design-fidelity` trigger, one carrying none), same four dimensions.
      **Three dimensions moved, one is still unreachable.** Both arms read the
      artifact before writing, kept 3/3 handlers and 1/1 keyframe, and stated
      their deviations. Port fidelity improved on both: Arm A 11 lines -> **0
      (byte-identical)**, Arm B 39 -> 33 lines, and every Arm-B hunk sits above
      line 29 — the `<title>` and the head comment — with a `shasum` over
      `<style>`-onward identical to the fixture on **both** arms.
      Counts were **re-derived from the files rather than taken from the arms'
      self-reports**, per `evaluator-independence`.
      **The screenshot dimension is still not a measurement**, for Phase 1's
      reason unchanged: no page-reaching capture primitive exists on this host,
      so neither arm declined a screenshot — the option was absent. What *is*
      new, and is reported as a separate finding rather than folded into that
      row: both arms gave **the ladder's own argument** as their reason for not
      using pixels, unprompted. That is evidence the Phase 2 prose reaches the
      model on this host (Risk 2's open question) and **not** evidence the
      trigger set works — Claude Code loads the projected rule tree as project
      instructions regardless of triggers, so the router is still not the
      delivery channel here.
      <!-- verified 2026-08-20: independent re-derivation, not self-report - `grep -c addEventListener` -> 3 and 3 (fixture 3); `grep -c '@keyframes'` -> 1 and 1 (fixture 1); `diff fixture arm | grep -c '^[<>]'` -> 0 and 33; `diff fixture armB | grep -E '^[0-9]'` -> "6c6 8,11c8,9 13,16c11,13 18,28c15,21" (all above line 29); shasum of `<style>`-onward -> IDENTICAL for both arms -->
- [x] **Step 2:** Decide the two gated follow-ups on the numbers, not before:
      (a) a deterministic ad-hoc coverage checker (Phase 2 Step 4's follow-up)
      if interaction survival did not move; (b) flipping `source-first-gate`
      from warn toward the ladder's stronger enforcement if the read-first
      rate did not move while the gate fired.
      **Decided 2026-08-20 — both stay closed, on the numbers.**
      **(a) closed.** Interaction survival did not fail: 3/3 handlers and 1/1
      keyframe on both arms, in both measurement rounds. The condition the
      follow-up was gated on ("if interaction survival did not move") reads
      against a dimension that was already at ceiling, so there is no failure
      for a checker to catch. Opening it would build a gate whose population is
      as empty as the read-before-write rate's — the failure this estate
      already carries elsewhere.
      **(b) closed as undecidable, recorded rather than answered.** Its
      condition is "the read-first rate did not move **while the gate fired**".
      The gate ships in shadow, so it has fired zero times because it *cannot*
      fire — not because the behaviour is absent. A flip decision taken on that
      silence would be a threshold picked and then measured, which the
      activation policy forbids. The successor of this decision is the gate's
      own pre-registered flip condition (Phase 3 Step 2), which names the
      record floor that has to exist before the question is answerable.
      <!-- decision 2026-08-20: both gated follow-ups remain closed. (a) on the measurement - the dimension is at ceiling in both rounds. (b) as structurally undecidable under shadow, deferred to the gate's own flip condition rather than resolved by preference. Conservative in both cases: no new deterministic gate ships, no posture is strengthened. -->

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
| A11 | `source-first-gate` exists, is registered in `concern_registry.ts`, bound in `hook_manifest.yaml`, and has **no code path that can warn or deny** | yes — asserted by the negative test case, and re-checked by a sabotage probe that added a warn path and turned the suite red |
| A12 | The concern's posture carries a pre-registered flip condition AND a reverse trigger in the artefact itself, not only in this roadmap | yes — both in the hook header; `concern-activation-policy` requires the reverse trigger from day one |
| A13 | Every dependency the concern could not satisfy is a recorded FIELD on the shadow record rather than an assumption in code | yes — `verifier_exemption_decidable`, `capture_kind`, and the two handover proxies side by side |
| A14 | Phase 6's before/after numbers are re-derived from the artefacts, never taken from the producing agent's self-report | yes — the commands and their output are in the evidence file |
| A15 | A dimension that could not vary is reported as unmeasured, never as a pass | yes — the screenshot row reads "not a measurement" in both rounds, with the absent primitive named |

**Not claimed:** that the operator's symptom is fixed. Phase 1 could not
reproduce it under conditions where it can occur (no capture tool, no URL
handover), so these criteria cover the *defects verified in the tree*, not the
symptom. Phase 6 is where the symptom claim would be earned, and it needs a
consumer repo.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

> **Re-reviewed 2026-08-13** after 10 steps closed, the Acceptance Criteria
> section landed, and Phase 4 Step 3 was withdrawn. Two of the five risks have
> **fired** and are re-stated with what actually happened; one is closed by its
> own mitigation; a sixth is added because it fired and no row predicted it.
>
> - **Risk 1 (adopt-the-code vs `code-provenance`) — CLOSED by its mitigation.**
>   The scope line shipped, both rules carry the cross-link, and the boundary is
>   authorship rather than delivery.
> - **Risk 2 (prose into a delivery channel measured as broken) — FIRED, and
>   worse than written.** The instrument that was to check it has **no
>   population in this repo** (0 UI-write turns / 40 sessions), and it carries a
>   blind spot by construction: a handover that is never read leaves no
>   transcript trace. The mitigation as written — "Phase 6 re-measures" — cannot
>   run here at all.
> - **Risk 4 (Phase 1 refutes the premise) — FIRED SIDEWAYS.** It did not come
>   back green; it came back **inconclusive**, which the row did not anticipate.
>   The pre-registered response ("publish the null, park Phases 2–4") was
>   therefore *not* taken, and the reason is recorded at the step rather than
>   resolved by preference.
> - **Risks 3 and 5 — unchanged**, both attached to phases that stay open.
>
> **Re-reviewed again 2026-08-20**, after Phase 3 and Phase 6 closed and Phase 4
> Step 3's box was moved to `[-]`:
>
> - **Risk 3 (the gate warns the one actor doing it right) — CLOSED BY
>   CONSTRUCTION, not by its stated mitigation.** The mitigation as written
>   sequenced the phase after SLI Phase 4, which is still open. What actually
>   removed the risk is that the shipped concern has no emission at all: the
>   harm in the row is a *warning* delivered to a verifier, and a concern that
>   emits nothing delivers none. The `agent_id` key the row names is now a
>   recorded field, so the exemption's size will be measured before it is
>   designed. The risk re-opens the day the concern flips to advisory, which is
>   why flip condition (c) names exactly this.
> - **Risk 2 (prose into a delivery channel measured as broken) — PARTIALLY
>   ANSWERED, in the direction the row did not expect.** The row predicted the
>   instrument would be unable to check it, and that half held (0 UI-write turns
>   / 40 sessions). But Phase 6's two arms both reproduced the data-basis
>   ladder's own argument unprompted, which is direct evidence the prose reaches
>   the model — on a host that delivers it unconditionally. So the channel is
>   not broken here; whether the *router* delivers it anywhere remains
>   untested, and that is now the narrower open question.
> - **Risk 6 (an over-broad trigger whose near-miss cannot catch it) —
>   discharged as far as this roadmap can.** Its step is `[-]`, the two pins
>   remain, and the extension discipline is written into
>   `design-fidelity` § Routing with this as the worked example.
>
> **Third re-read 2026-08-20, at closure**, after merging `origin/main`
> (`1d2f73c40`) and transferring Phase 1 Step 2. The `reviewed:` date moves to
> 2026-08-20 on the strength of this pass, not as a restamp — what was actually
> re-read is named, including the checks that came back "no change":
>
> - **The merge delta is orthogonal to every row, checked rather than assumed.**
>   `git diff --name-only 206ab4f16..origin/main` over `src/rules/design-fidelity.md`,
>   `docs/guidelines/design-fidelity-mechanics.md`,
>   `road-to-subagent-lifecycle-integrity.md`, `src/skills/fe-design/`,
>   `src/skills/design-review/` returns **nothing**, and the same diff filtered
>   for `hook_manifest`, `concern_registry`, `dispatch_hook`, `ui_route_nudge`,
>   `ui_surface`, `state_io`, `subagent_ledger` also returns **nothing**. The 10
>   commits the merge brought (a CI-settle helper, a roadmap skeleton emitter, an
>   md-section library, a `block_no_verify` tokeniser fix, council CLI help)
>   touch no surface any row depends on.
> - **Risk 3's dependency re-verified open, not recalled.** SLI Phase 0 Step 4
>   and Phase 4 Step 1 both still read `[ ]` in the merged tree. So the row's
>   closure still rests on construction (no emission) rather than on its stated
>   mitigation, exactly as the second re-read recorded.
> - **Risk 5 — CHANGED, and this is the one substantive movement.** It was
>   "unchanged" an hour earlier; the transfer moves it. Its mitigation measures
>   the extraction path's use "by the Phase-1 telemetry rather than by
>   impression" — but the W5 URL / live-page handover class is now **transferred
>   to [`stubs/road-to-multi-host-screenshot-census`](stubs/road-to-multi-host-screenshot-census.md)**,
>   so the instrument that would have falsified this row travels with it. The
>   risk is real, still unscored by any fixture, and **no longer carried by this
>   roadmap**: it is carried by the stub's own probe. Recorded rather than
>   silently inherited, because a falsifier whose instrument left the building
>   is the shape that rots.
> - **Risks 1, 2, 4 and 6 — unchanged by this pass**, and each for its own
>   reason already recorded above: 1 closed by its mitigation, 2 partially
>   answered by Phase 6's two arms, 4 fired sideways and is resolved at the
>   step, 6 discharged as far as a `[-]` step and two silent pins can discharge
>   it.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The adopt-the-code duty contradicts an existing Iron Law | implementation | `code-provenance` opens with `NEVER ADOPT EXTERNAL CODE VERBATIM` and routes any conscious borrow through a license check plus a ledger entry. Phase 2 Step 3 instructs the opposite for a provided artifact. Two Iron Laws giving opposite instructions on the same act is worse than either gap alone: whichever the agent follows, it is violating a rule, and no gate can arbitrate | Phase 2 Step 3 carries a mandatory scope line — a user-supplied artifact is the user's own material, not third-party external code, mirroring the carve-out `content-quoting-floor` already makes — and both rules gain the cross-link in the same change so the boundary is readable from either side | Phase 2 Step 3 |
| 2 | More prose into a delivery channel already measured as broken | product | Every duty in Phase 2 is prose in a skill, and whether skill prose reaches the model at all is the open catalogue-delivery question with a `no-selector` verdict against it. Adding four duties to an unverified channel produces the appearance of a fix with no mechanism, which is precisely how the shipped `road-to-provided-artifact-honesty` guarantees ended up bypassed | Phase 1 Step 3 instruments the artifact-read-before-write rate on the existing event stream first, and Phase 6 re-measures the same four dimensions after the prose lands; the deterministic follow-ups are opened only if the numbers did not move | Phase 6 |
| 3 | The gate warns the one actor doing it right | implementation | A verifier subagent screenshotting for QA is the sanctioned use. A `source-first-gate` matched on screenshot tools with no exemption fires on exactly that actor, which teaches the reader to ignore the warning and burns the valve on false positives | The verifier exemption keys on the payload `agent_id` / `agent_type`, and this phase is sequenced after `road-to-subagent-lifecycle-integrity` Phase 4 establishes that binding — stated as a hard dependency, not a note | Phase 3 Step 1 |
| 4 | Phase 1 refutes the premise after the plan is written | product | The measurement that decides whether the symptom reproduces ad-hoc on current main runs first, and it may come back green — in which case five phases of enforcement design were authored against a symptom the tree no longer has | That outcome is the pre-registered falsifier: publish the null, park Phases 2–4, hand the operator report back with the measurement; the roadmap is written so the null is a clean stop rather than a sunk cost | Phase 1 |
| 5 | Extraction into files goes unused and the section rots | product | The browser-handover class rests on one operator report. If real handovers rarely arrive as URLs, the extraction artifact path, the persistence discipline, and three new trigger rows are maintained for a case that does not occur | Phase 4's falsifier folds the section into the existing handover prose and drops the persistence step if the path goes unused across two release cycles, measured by the Phase-1 telemetry rather than by impression | Phase 4 |
| 6 | A new trigger ships over-broad and its near-miss row cannot catch it | implementation | Added 2026-08-13 because it FIRED and no row above predicted it. Phase 4 Step 3 shipped three builder-URL triggers whose near-miss row tested a direction that was **already silent** before the change, so it could not detect the over-broadness the change introduced: `https://v0.dev/` is a substring of `https://v0.dev/docs`, and the vendor's documentation, pricing and changelog pages all began routing as spec handovers. The rule's extension discipline was satisfied in letter while the failure mode it exists to catch stayed untested; only the completion review found it | The step is withdrawn rather than shipped. `design-fidelity` § Routing now states that a near-miss must test the direction the NEW trigger opens, with this as the worked example, and `near-builder-host-non-handover-url` pins that direction silent so a retry has to clear it first | Phase 4 Step 3 |

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
