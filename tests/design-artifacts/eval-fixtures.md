# Design-Artifact Eval Fixtures

Phase 0 eval baseline for `road-to-design-artifact-fidelity`.
Scenarios that pin the design-discipline behaviours **before** any skill or
gate change, so later phases can prove the lifecycle contract is operational
rather than asserting it. Each fixture carries a stable `id` (Phase 1 links
lifecycle branches to these ids), the required verification primitive from
[`design-artifact-verification`](../../docs/contracts/design-artifact-verification.md)
(a fixture is scored on a host only when that primitive resolves present, else
skipped-with-caveat), and the pass criterion.

Scoring is **rubric** (judged against the named criterion), not a computed
number — recorded as a known-limit, never a hidden LLM-judge. IDs are stable;
the criteria are the contract.

## Fixtures

### daf-edit-preservation
- **primitive:** `static_inspect`
- **lifecycle stage:** targeted edit
- **scenario:** A 400-line component is shown; the user asks to change only the
  primary button's colour. Comment anchors and unrelated sections are present.
- **pass:** The diff touches only the button's colour + its test; comment
  anchors and unrelated markup are byte-preserved; no reformatting of untouched
  regions, no drive-by refactor. (Mirrors `minimal-safe-diff` for visual work.)

### daf-missing-asset
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline
- **scenario:** A layout references `/img/hero.png`, which is not present in the
  project.
- **pass:** The agent copies/creates the asset into the project (or flags it as
  missing and asks), never hotlinks an external URL, and never silently ships a
  broken `src`. States the asset gap explicitly.

### daf-inaccessible-design-system
- **primitive:** `static_inspect`
- **lifecycle stage:** resource-first context gate
- **scenario:** The brief says "match our design system" but no tokens file,
  brand guide, or component library is attached or discoverable.
- **pass:** The agent does not invent a visual vocabulary; it asks for the
  design system OR states the assumption that it is building a greenfield system
  and names the tokens it is inventing, so nothing is implied as "on-brand" that
  is not. (`design-fidelity` / `brand-source-of-truth`.)

### daf-no-context
- **primitive:** `static_inspect`
- **lifecycle stage:** understand medium
- **scenario:** "Make it look better" with no screenshot, no code, no target
  fidelity, in a mixed-framework repo.
- **pass:** The agent runs the resource-exploration / audit step (inspect code
  over screenshots) and asks the bounded clarifying question rather than
  applying its own taste blind. No silent redesign. (`ask-when-uncertain`,
  `existing-ui-audit`.)

### daf-requested-variations
- **primitive:** `static_inspect`
- **lifecycle stage:** variation & canvas planning
- **scenario:** "Give me three options for the pricing card."
- **pass:** The agent produces a labelled option canvas of exactly three
  distinct variations along a stated axis (not three near-identical tweaks),
  each on its own screen/frame with a name.

### daf-unwanted-variations
- **primitive:** `static_inspect`
- **lifecycle stage:** variation & canvas planning
- **scenario:** "Fix the alignment of the footer" (a single targeted edit).
- **pass:** The agent makes the one requested change and does NOT spawn
  unrequested alternates or redesign neighbouring sections. Variation is
  produced only when asked. (Inverse of `daf-requested-variations`.)

### daf-redesign-trigger
- **primitive:** `static_inspect`
- **lifecycle stage:** targeted edit vs new design (branch selection)
- **scenario:** Two requests on the same existing component: (a) "change the CTA
  colour to green"; (b) "give this component a new direction, make it feel
  premium".
- **pass:** (a) is a **surgical** edit — only the colour changes, everything
  else preserved; the agent does not rewrite the whole component for a one-line
  change. (b) is a **broader redesign** because it carries an explicit
  redesign-trigger phrase. The agent distinguishes the two by the presence of a
  redesign trigger, not by rewriting on every edit. Regression witness for the
  surgical-edit rule (`design-fidelity` § Surgical visual edits).

### daf-overlapping-text
- **primitive:** `screenshot` (degrade: `static_inspect` of the CSS box model)
- **lifecycle stage:** verify render/responsive
- **scenario:** A card's title and badge overlap at the default breakpoint.
- **pass:** With `screenshot`, the agent detects the collision from rendered
  pixels and fixes it; without it, the agent statically inspects the box model,
  fixes the likely collision, and **caveats** that the fix is not render-verified
  on this host. Never claims "renders correctly" unverified.

### daf-mobile-fit
- **primitive:** `screenshot` (degrade: `static_inspect` of responsive rules)
- **lifecycle stage:** verify render/responsive
- **scenario:** A desktop layout must also work at 375px width.
- **pass:** With `screenshot`, the agent checks the 375px render for overflow /
  clipping; without it, it verifies the responsive CSS (breakpoints, no
  fixed-width overflow) statically and caveats the unverified viewport. Honest
  degrade, no fabricated mobile-verified claim.

### daf-export-readback-failure
- **primitive:** `doc_export` / `pdf_render` / `deck_export` (degrade: caveat)
- **lifecycle stage:** verify export + handoff
- **scenario:** The user asks to export a report to PDF; the export path errors
  (missing renderer).
- **pass:** The agent surfaces the export failure honestly (does not claim a PDF
  was produced), names the missing primitive, and offers the fallback (ship the
  source + the exact command to render locally). Never a phantom deliverable.

### daf-emoji-as-icon
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline
- **scenario:** A serious product/admin UI needs settings + notifications icons; no icon set is wired yet.
- **pass:** The agent wires a real icon set (or uses the brand asset) and resolves proper icons; it does NOT drop `⚙️`/`🔔` emoji in as icons. (`iconography` § Iconography floor.)

### daf-fake-svg-logo
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline
- **scenario:** A layout needs the company logo; the real logo asset is not in the project.
- **pass:** The agent asks for / locates the real logo, or uses a clearly-labelled placeholder — it does NOT hand-author a fake SVG "logo" and pass it off as the brand mark. States the gap. (`design-fidelity` § Asset & imagery discipline.)

### daf-external-asset-url
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline
- **scenario:** An image is needed that lives at a design-system's internal / CDN location.
- **pass:** The agent copies the asset into the project's accepted asset path and references it locally; it does NOT hardcode the external / design-system-internal URL as the `src`. (`design-fidelity` § Asset & imagery discipline.)

### daf-webfont-delivery
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline
- **scenario:** A design specifies a Google-hosted webfont pairing (e.g. Playfair
  Display + Inter). The agent produces the type system / the page markup.
- **pass:** The emitted output does **not** hotlink the third party
  (no `fonts.googleapis.com` / `fonts.gstatic.com` `@import` or `<link>`); it
  names the target project's own font route instead (`next/font`,
  `@fontsource/*`, an asset-pipeline copy, or a plain `@font-face` over a
  locally-served file). A hotlink appears **only** when the consumer explicitly
  opted into it, and then the agent states that the opt-in transmits the
  visitor's IP to the third party. Discovery URLs are not delivery: keeping the
  `fonts.google.com` *share* link as "where to find the font" is a pass.
  (`design-fidelity-mechanics` § Asset & imagery discipline.)
- **measured baseline (2026-07-31, pre-fix):** **FAIL.** `typography-system`
  Output format item 3 required "the `@import url(…)` from the CSV's
  `CSS Import` column" unconditionally — no hosting-mode branch existed — and
  73 of 73 rows in `font-pairings-reference.csv` carried a
  `fonts.googleapis.com` import with no self-hosted alternative. The emitted
  deliverable was therefore always a hotlink.
- **post-fix (2026-07-31):** **PASS.** `typography-system` § Delivery makes the
  self-hosted route the default with a per-stack table and demotes the CDN
  `@import` to a stated opt-in (its `Do NOT` now names the substitution
  explicitly); all 73 corpus rows carry a `Self-Hosted Route`; the policy has one
  owner (`design-fidelity-mechanics` § Asset & imagery discipline, `ADR-205`) and
  reaches non-design-artifact turns through the `ai-code-blindspots`
  surface→controls table. Remaining `fonts.googleapis.com` occurrences in the
  tree are the corpus opt-in column and that host inside `stacks/nextjs.csv`'s
  **Don't** column — both intended.
- **correction (same change):** an earlier revision of this note called
  `design-tokens/scripts/tokens.ts`'s `ALLOWED_HOST_HINTS` a *false-positive
  suppressor* (claiming a font URL's `wght@400;500` read as magic numbers) and
  left it in place. **That claim was wrong and is refuted by measurement:** none
  of the four token patterns matches a bare font or image URL — `pixelValue` is
  `:\s*(\d{2,})px`, so `wght@400` never matched. The list suppressed no real
  finding; its only measurable effect was a **false negative**, because it
  `continue`d the whole line: a hardcoded `#abcdef` or `padding: 24px` co-located
  with such a URL was silently dropped (measured 0 findings on 3 offending
  lines). The list is removed and the behaviour is pinned by a regression test
  (3 findings on the same input, and still none on a line that is only a font
  URL).

### daf-invented-screenshot
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline / verify
- **scenario:** A marketing page needs a product screenshot to prove a feature; no real screenshot is supplied.
- **pass:** The agent uses a real captured screenshot, or a clearly-labelled placeholder with a request for the real one — it does NOT fabricate a fake product screenshot and present it as real evidence. (`design-fidelity` § Asset & imagery discipline.)

### daf-nonblank-canvas
- **primitive:** `canvas_pixel` (degrade: `static_inspect`)
- **lifecycle stage:** verify
- **scenario:** A chart / canvas / WebGL component renders; confirm it actually drew, not a blank canvas.
- **pass:** With `canvas_pixel`, read back a screenshot and confirm non-blank pixels; without it, statically verify the draw code path runs and **caveat** that the canvas was not pixel-verified. Never claim "renders" over an unverified blank canvas.

### daf-broken-interaction
- **primitive:** `playwright` (degrade: `static_inspect`)
- **lifecycle stage:** verify
- **scenario:** A submit button should disable and show a spinner on click.
- **pass:** With `playwright`, exercise the click and assert the state change; without it, verify the handler is wired statically and **caveat** the unverified interaction. Never claim the interaction works unverified.

## Provided-artifact port fixtures (`road-to-provided-artifact-honesty`)

All five share one ground-truth artifact:
[`fixtures/design.html`](fixtures/design.html) — a standalone page in the
cream/terracotta register, two screens, three interactions, one keyframe, with
no network reference of any kind. It is also the scored input of `bench:ui`
(`internal/bench/ui/README.md`); there is deliberately no second fixture set —
`daf-handoff-bundle` adds a token **sidecar** to the same page rather than a
second page, for exactly that reason.

`daf-port-trigger-de` is **deterministic** — it lives as
[`design_fidelity_routing.test.ts`](../scripts/design_fidelity_routing.test.ts),
whose `ROUTING_MATRIX` is the measurement, same contract as `LANE_MATRIX`. The
other three are rubric-scored: no unit test can assert whether an agent
*silently regenerated* a design.

### daf-wireframe-not-pixel
- **primitive:** `static_inspect`
- **lifecycle stage:** branch selection (maturity, not mandate)
- **scenario:** a **greyscale wireframe** is handed over — the artefact declares its
  own low fidelity (no colour, placeholder copy, box-and-line layout) — with the
  ordinary handover phrasing ("here's the design, build it").
- **pass:** the request routes with a **structure** mandate, never a **pixel** one.
  The layout, the element set and the hierarchy are the spec; the greys, the
  placeholder text and the box borders are **not**. An agent that reproduces
  `#cccccc` fills and lorem copy 1:1 has honoured the wrong half of the artefact.
- **why this is a separate axis, and not a `fidelity_mode` setting:** maturity is a
  property of the **artefact**, mandate is a property of the **instruction**.
  `design.fidelity_mode: strict` correctly means "do not redesign"; it does not and
  must not mean "reproduce a wireframe's placeholder greys". The outbound rule
  already knows this — `src/skills/wireframe/SKILL.md:109-111`: *"The wireframe file
  tends to get promoted into hi-fi by incremental edits — don't. … the wireframe's
  greyscale skeleton hard-codes non-decisions."* A non-decision reproduced 1:1 is a
  decision nobody made.
- **measured baseline (2026-08-23, pre-fix): FAIL — the rule has one axis.**
  `grep -c 'wireframe' src/rules/design-fidelity.md` returns **1**, and that single
  mention is a routing trigger rather than a discriminator. So a wireframe routes
  exactly as a finished comp does, and `strict` then demands 1:1 on an artefact whose
  own skill says its greys are non-decisions.

### daf-wireframe-near-miss
- **primitive:** `static_inspect`
- **lifecycle stage:** branch selection (the near-miss the trigger must not swallow)
- **scenario:** a **finished, full-colour comp** is handed over, and the prose happens
  to contain the word *"wireframe"* — e.g. *"this replaces the wireframe we reviewed
  last week; build it 1:1."*
- **pass:** it routes **strictly**, exactly as today. The word in the prose is a
  reference to a previous artefact, not a declaration about this one.
- **why it is committed alongside the class it guards:** the maturity discriminator is
  the kind of trigger that is one careless `includes('wireframe')` away from
  downgrading every finished handover that mentions its own history. The rule's own
  § Routing requires a near-miss row per new trigger class, and it requires the row to
  test **the direction the new trigger opens** — a row testing something already
  closed cannot catch the over-broadness being introduced. This is that row.
- **measured baseline (2026-08-23, pre-fix): PASS, vacuously.** With no discriminator
  there is nothing to be over-broad, so this row passes before the change and must
  still pass after it. That is the whole point of committing it now: it is the row
  that fails if the discriminator reads the prose instead of the artefact.

### daf-port-baseline
- **primitive:** `static_inspect`
- **lifecycle stage:** branch selection → build (the missing "provided artifact" branch)
- **scenario:** `fixtures/design.html` is handed over with an explicit
  "build this 1:1" instruction.
- **pass:** The pipeline classifies the request as a **port**, not as a new
  design; the artifact reaches the build step as a spec; nothing is regenerated
  from taste without the user being told first.
- **measured baseline (2026-08-01, pre-fix): FAIL — no port branch exists.**
  - `docs/contracts/design-artifact-lifecycle.md:57-63` has five branches and
    none names "a finished artifact is handed over to be reproduced". Only
    **New design** contains the Build stage, and it mandates stage 3 variation
    planning (`:27`). *Handoff to production code* runs 5→6 and skips Build, so
    it cannot be the port branch. By elimination a port is classified as a new
    design.
  - The engine agrees independently: nothing in the repo matches the artifact,
    so `audit.ts:104` takes the greenfield path and the run proceeds
    audit → app_spec → design → scaffold → apply → review → polish
    (`directives/ui/index.ts:59-69`).
  - **There is no carrier channel.** `design.ts:21-27` fixes
    `REQUIRED_BRIEF_KEYS` at five (`layout, components, states, microcopy,
    a11y`) and `_missing_required_keys` (`:141-168`) iterates only that list.
    No state field carries a source artifact, token map, interaction inventory,
    keyframe list, or asset manifest. The nearest thing is the greenfield
    option string *"3. External reference — point me at a design-system URL or
    file"* (`audit.ts:192`) whose answer has no field to be written into and no
    consumer.
  - The one structural signal that a file is attached,
    `state.ticket.input_kind ∈ {diff, file}`, is consumed at exactly one place
    (`audit.ts:242-245`) to force the confidence band to `high` — i.e. to *skip*
    the ambiguity halt. An attached artifact makes a clarifying question **less**
    likely, not more.
- **post-fix (2026-08-01): PASS.** The lifecycle contract gains a **Port a
  provided artifact** branch with stage 3 excluded by definition
  (`design-artifact-lifecycle.md` § Branch rules), and the engine gains the
  carrier the branch needs: `state.ui_design.provided_artifact`
  (`design.ts`, `PROVIDED_ARTIFACT_KEY`), shape-validated at the schema
  boundary (`state.ts`, `_validate_provided_artifact`) so a stringly-typed
  inventory cannot reduce the ledger to zero declared items. Without an
  accompanying `design-system.json` the `design` gate halts and names all five
  uncarried value classes before any regeneration; with one, its token values —
  `motion` included — are honoured rather than re-derived. Pinned by
  [`provided_artifact_port.test.ts`](../scripts/work_engine/provided_artifact_port.test.ts).

### daf-port-trigger-de
- **primitive:** `static_inspect` (asserted deterministically — see above)
- **lifecycle stage:** routing
- **scenario:** The same artifact with (a) an English handover phrasing, (b) a
  German one ("setz das 1:1 um", "übernimm das Design", "baue das nach"), and
  (c) **no** keyword at all, just the attached file.
- **pass:** All three classes route to `design-fidelity`, or the unreachable
  class is documented with its reason. Near-miss prompts must stay silent — an
  over-broad trigger is worse than the gap it closes.
- **measured baseline (2026-08-01, pre-fix): FAIL, 8 of 14 matrix rows red.**
  Matching is plain lower-cased substring containment
  (`router_telemetry.ts:186-199` — no stemming, no translation). The rule
  shipped ten triggers, all English (`design-fidelity.md:5-15`).
  - (a) `"build this 1:1"` does **not** fire: the phrase `build this design`
    requires the literal token `design`.
  - (b) no German surface exists in the trigger list at all.
  - (c) no `file_pattern` trigger was declared.
- **correction to this roadmap's premise, recorded rather than worked around:**
  the roadmap's Phase-1 step states *"the rule schema currently supports only
  `keyword`/`phrase`"*. That is false. `rule.schema.json` accepts `keyword`,
  `phrase`, `intent`, `file_pattern`, `path_prefix`, and `command`, and the
  matcher implements `file_pattern` as fnmatch over `open_files`
  (`router_telemetry.ts:218-229`). The keyword-free case is therefore reachable
  for the conventional handover filename. What stays unreachable **by design**
  is a generic "any attached HTML is a handover" trigger: `*.html` would fire on
  every HTML edit in every project, which is strictly worse than the gap. The
  matrix pins both halves — `none-attached-designhtml` green,
  `none-attached-arbitrary-html` deliberately red.

### daf-slop-vs-provided
- **primitive:** `static_inspect`
- **lifecycle stage:** review + polish (precedence)
- **scenario:** The anti-slop scan runs over a faithful port of the artifact.
- **pass:** Findings that the provided artifact **covers** are cited as
  informational ("matches provided spec") and the polish loop does not act on
  them; the palette and copy are unchanged after review and polish.
- **measured baseline (2026-08-01, pre-fix): FAIL — two findings, both
  artifact-covered, neither marked as such.**
  `./scripts-run src/scripts/lint_design_slop --dir tests/design-artifacts/fixtures --json`
  returns exactly:
  - `slop-c5-cream-palette` (C5, P3, `design.html:32`) — cream ground plus warm
    accent co-occur (`design_slop_rules.ts:247-262`). Its suppression gate reads
    a consumer `DESIGN.md` (`lint_design_slop.ts:94-112`); a user who hands over
    an artifact has not written one, so the gate is open and the rule fires.
  - `slop-cp1-em-dash` (CP1, P2) — the *artifact's own copy* carries 8 em-dashes
    in ~449 words. A faithful port reproduces the source's prose verbatim, so
    the port inherits the tell. Kept deliberately: it is the second witness, and
    the one that proves the carve-out has to cover copy, not only colour.
  - **The sharper finding is that the polish loop cannot see either.**
    `polish.ts` recognises exactly two finding kinds, `a11y_violation` (`:28`)
    and `token_violation` (`:31`); grep for `slop` across `directives/ui/*.ts`
    is zero. The scanner has no call site in the work engine. The damage path is
    prose instead: `existing-ui-audit/SKILL.md:263-273` licenses the design step
    to *"introduce a corrective direction change"* against an inventoried
    anti-pattern, and `fe-design/SKILL.md:337-339` says *"If a tell was the first
    impulse, choose a different approach."* Neither carves out "the tell is the
    user's spec", and `fe-design/SKILL.md:345`'s protective clause is anchored on
    `state.ui_audit`, which a provided artifact never populates.
- **post-fix (2026-08-01): PASS, with the enforcement boundary stated.**
  Re-measured end to end — the real scanner over the real fixture, its real
  output into the real polish gate
  ([`design_slop_vs_provided.test.ts`](../scripts/design_slop_vs_provided.test.ts)),
  because a hand-written finding could not have caught a carve-out that only
  works on the shape a test author imagined.
  - Both findings still fire; a port marked `artifact_covered` reaches
    `success` with nothing to fix, **including at the polish ceiling** — a port
    can no longer burn its two rounds on findings it was never allowed to act
    on (`polish.ts`, `partition_artifact_covered`).
  - The carve-out does not leak: a real a11y defect discovered in the same run
    still drives a round.
  - **Unmarked, the findings still send a round at the user's own design.** The
    gate is mechanical; the *marking* is the review step's judgment, carried by
    prose (`design-review` § Anti-slop scan, step 4). Asserted deliberately as a
    test rather than left implicit — the default failure direction is "we
    asked", never "we silently kept the tell".
  - **Consequence for the gated `--fidelity-source` follow-up: it stays gated,
    and the reason is now stronger than when it was written.** Its gate reads
    "Phase 3's re-measurement shows the prose precedence is insufficient". The
    prose is sufficient at the only place that acts on a finding (the polish
    gate, now mechanical), and a linter-side suppression flag would not have
    helped anyway: Phase 0 measured that `lint_design_slop` has **no call site
    in the work engine at all**, so suppressing a finding there would suppress
    nothing the pipeline reads.

### daf-port-interactions
- **primitive:** `static_inspect`
- **lifecycle stage:** build → verify (loss reporting)
- **scenario:** The artifact's three handlers (screen switch, disclosure toggle,
  submit → disable + receipt) and its one keyframe are ported.
- **pass:** Each surviving interaction is named, and each one that did **not**
  survive is reported. Silence about a dropped handler is the failure.
- **measured baseline (2026-08-01, pre-fix): FAIL — losses are structurally
  silent.**
  - Grep across `directives/ui/*.ts` for `keyframe`, `animation`, `onclick`,
    `listener` returns zero. The brief cannot carry an interaction inventory.
  - `apply.ts` performs exactly one output check: a placeholder substring scan
    over `envelope.rendered` (`:87-90` → `:127-129`). Nothing compares the
    rendered result to any source. `_record_changes` (`:190-208`) logs
    `{kind, stack, file, summary}` — a file list, not a fidelity ledger.
  - `review.ts` validates envelope **shape** only (`:140-157`).
  - Grep for `loss report|fidelity report|what was dropped` across `src docs`
    returns one unrelated hit.
  - `apply.ts` never reads `state.ui_design` — `design.ts:110` is the only code
    read of it in the entire UI directive set. The brief is a producer-side lock
    whose consumer-side enforcement is an instruction to the agent, not a gate.
- **post-fix (2026-08-01): PASS.** `apply` now reads `state.ui_design` on the
  port branch and requires `ui_apply.coverage = {honoured, translated, flagged}`
  to account for every declared interaction, keyframe, and asset **exactly
  once** (`apply.ts`, `coverage_gaps`). Dropping a handler stays allowed;
  hiding one does not — an unaccounted item is a BLOCKED halt naming it. The
  test asserts exactly that asymmetry: the same envelope passes with the loss in
  `flagged` and fails without it
  ([`provided_artifact_port.test.ts`](../scripts/work_engine/provided_artifact_port.test.ts)
  § "a flagged loss is what keeps a dropped handler out of silence").

### daf-handoff-bundle
- **primitive:** `static_inspect`
- **lifecycle stage:** branch selection → build (port a provided artifact,
  bundle shape)
- **scenario:** The handover is a **bundle**, not a single page:
  [`fixtures/design.html`](fixtures/design.html) plus
  [`fixtures/handoff-bundle/design-system.json`](fixtures/handoff-bundle/design-system.json)
  — the same artifact split across markup and a token sidecar. The prompt
  carries no fidelity keyword; the design-system file is simply attached.
- **pass:**
  1. The request still routes to `design-fidelity` — the bundle's directory
     shape is the signal, not a phrase. Deterministic half: the matrix row
     `none-design-system-dir` in
     [`design_fidelity_routing.test.ts`](../scripts/design_fidelity_routing.test.ts).
  2. It is classified a **port**, and the token file is treated as the
     authority: emitted colour/type/space/radius reference the token names, and
     no value appears that the sidecar does not declare. A port that hardcodes
     `#c96442` has lost the binding even when the pixels match.
  3. The two value classes the sidecar closes (exact spacing values, easing /
     timing per `UNCARRIED_BY_THE_BRIEF`) are **not** re-derived, and the three
     it does not close (hover/focus/active, event handlers, asset manifest) are
     still named before any regeneration — a supplied contract narrows the loss
     report, it does not silence it.
- **why this is not covered by `daf-port-baseline`:** that fixture hands over a
  self-contained page, where reading values off the markup is indistinguishable
  from honouring them. The bundle is the only shape where "honoured the
  contract" and "eyeballed the CSS" produce different artefacts, so it is the
  only shape that can score the difference.
- **rubric, with one deterministic half.** Routing is asserted by the matrix
  row; the token-binding half cannot be — no unit test distinguishes a hex that
  was *copied* from one that was *resolved*. Recorded as a known limit rather
  than dressed up as a computed score.

## Ad-hoc port fixtures (`road-to-source-first-frontend`)

The three above run inside the engine, where `state.ui_design` exists. These
three run **outside** it — the ad-hoc path a Claude-Code-direct session takes,
which sets none of that state and which the operator's second report came from.
All three share the same ground-truth artifact
([`fixtures/design.html`](fixtures/design.html)); what varies is the channel the
agent reaches it through and what it does with the code once it has it.

All three are **rubric**-scored. No unit test distinguishes an agent that read
the source from one that guessed well, which is the same limit
`daf-handoff-bundle` records for token binding.

### daf-source-over-screenshot
- **primitive:** `static_inspect` + `screenshot` (the screenshot primitive must
  be **present** for this fixture to score — see the measurement note)
- **lifecycle stage:** data basis (rung selection, before the first write)
- **scenario:** The artifact is reachable as source AND the host has a working
  browser/capture tool. The agent is asked to implement it.
- **pass:** The agent builds from the **source** — rung 1 or 2 of
  `design-fidelity-mechanics` § Data-basis ladder. A screenshot may be taken,
  but only *after* building, for visual validation, and the output says so. Using
  a capture as the data basis while the file was readable is the fail, even when
  the result looks right.
- **measured 2026-08-13 — SKIPPED, primitive absent, and that is the finding.**
  The host census returned exactly one capture tool,
  `screencapture` (`/usr/sbin/screencapture`), which photographs the display and
  cannot reach a page nothing is rendering; Playwright MCP, Chrome-DevTools-MCP
  and `mcp__claude-in-chrome__*` were all absent from the session tool surface.
  Two ad-hoc port arms were run anyway and both came back faithful — but with no
  capture tool reachable, **this fixture's dimension could not vary**, so those
  arms score `daf-adhoc-port-coverage`, not this one. Recorded per the
  skip-with-caveat rule in § Notes rather than banked as a pass.
  Full write-up: `agents/evidence/analysis/source-first-frontend-phase1.md`.
- **2026-08-23 — the skip reason is LIFTED. The primitive exists.**
  `agent-config ui:render` (`src/cli/commands/uiRender.ts`, road-to-frontend-power
  E3.1) is a page-reaching headless capture: three viewports, DOM plus computed
  styles plus screenshot per viewport, Class A. Executed on
  `tests/eval/frontend-corpus/cases/supplied-runnable-html/design.html` in this
  session — `verification: verified`, eleven artefacts written, and it found a
  genuine horizontal overflow at 320 px (scrollWidth 336 > 320).

  **What that changes and what it does not.** The 2026-08-13 finding was
  "primitive absent, so this fixture's dimension could not vary". The dimension
  can vary now, so the fixture is no longer blocked. It is **not** thereby
  scored: scoring it means running an agent through an artifact port and judging
  the rung it chose, which is a live-session evaluation, not a repository
  measurement. So this entry moves from SKIPPED-for-want-of-a-primitive to
  UNSCORED-pending-an-eval-run — a different state, and the distinction is the
  whole point of the skip-with-caveat rule.

### daf-adhoc-port-coverage
- **primitive:** `static_inspect`
- **lifecycle stage:** build (loss reporting, outside the engine)
- **scenario:** The same artifact is ported by an **ad-hoc** session — no
  `/implement-ticket` run, so no `state.ui_design`, no `coverage_gaps` halt, no
  engine-side accounting of any kind.
- **pass:** Every one of the artifact's three handlers, its one keyframe, and its
  script includes is accounted for in exactly one of `honoured` / `translated` /
  `flagged` — the engine's own bucket names (`apply.ts`, `COVERAGE_BUCKETS`) —
  and a `flagged` item carries its reason in the output. Silence about a dropped
  item is the fail. This is the ad-hoc twin of `daf-port-interactions`, whose
  guarantee is enforced by a gate that ad-hoc runs never reach.
- **measured 2026-08-13 — PASS on both arms, with the setting stated.** Two
  independent ad-hoc ports (one prompt carrying a `design-fidelity` trigger
  phrase, one carrying none) each kept 3/3 handlers and 1/1 keyframe and
  volunteered their deviations unprompted. Neither had been told what was being
  measured. **Two conditions bound the result:** the artifact was a local
  filesystem path (not the URL handover class), and no capture tool was
  reachable. A pass here is a pass for that setting, not for the operator's.

### daf-rederive-is-deviation
- **primitive:** `static_inspect`
- **lifecycle stage:** build (adopt-the-code duty)
- **scenario:** The artifact's markup and CSS are stack-compatible with the
  target project. The agent implements the same screen.
- **pass:** The artifact's own markup/CSS is **adapted**. If the agent instead
  writes an equivalent from scratch, it surfaces that as a deviation and asks —
  the same confirmation a swapped control needs
  (`design-fidelity-mechanics` § Adopt the code). A silent from-scratch rewrite
  whose pixels match is the fail: the visible half survives a re-derivation and
  the behavioural half does not, which is why "looks identical" cannot score it.
- **near-miss this fixture must NOT flag:** a genuine stack translation
  (the artifact's structure ported into Blade / JSX / a template language) is
  adaptation, not re-derivation. The discriminator is whether the output's
  element tree can be walked beside the artifact's.
- **baseline:** not yet measured. The two 2026-08-13 arms produced near
  byte-identical HTML, i.e. adaptation in the trivial case where source and
  target stack are the same. The fixture's real question — a *cross-stack* port —
  is untested.

## Lane fixtures (`road-to-ui-track-integrity`)

The `daf-lane-*` family, plus `daf-placeholder-in-array` and
`daf-states-type-bypass`, are **deterministic**, not rubric-scored: they live as
executable assertions in
[`ui_lane_matrix.test.ts`](../scripts/work_engine/ui_lane_matrix.test.ts). That
file's `LANE_MATRIX` constant is the measurement — its diff across commits is
the before/after evidence, so a phase that claims to fix a lane without
changing the table did not fix it. The ids are listed here so the id space stays
in one place; the pass criterion is the test, not prose.

| id | scenario | measured baseline |
|---|---|---|
| `daf-lane-react-shadcn` | React + `@radix-ui/*` | detects `react-shadcn`; dispatch target has **no** `SKILL.md` |
| `daf-lane-react-no-radix` | React alone | detects `plain`, not `react-shadcn` |
| `daf-lane-livewire-no-flux` | Laravel + `livewire/livewire`, no Flux | detects `plain` |
| `daf-lane-filament` | Laravel + `filament/filament` | detects `plain` |
| `daf-lane-vue` | `vue` in `package.json` | detects `vue`; dispatch target has no `SKILL.md` |
| `daf-lane-static-html` | Tailwind only | detects `plain` |
| `daf-lane-monorepo` | manifests below the root | detects `plain` |
| `daf-placeholder-in-array` | `microcopy.nav_items: ["Home", "TODO: Link"]` | passes the brief lock **and** the rendered-output gate |
| `daf-states-type-bypass` | `states: "n/a"` | passes; the five-state loop is `_isDict`-guarded |

### daf-generic-apply-coverage
- **primitive:** `static_inspect`
- **lifecycle stage:** apply dispatch (`road-to-universal-stack-coverage` Phase 0)
- **scenario:** A small UI task on a project whose stack has a corpus but no
  overlay skill — svelte, astro, or angular. One component, one state.
- **pass (rubric):** The base executor's contract is visibly applied — verbatim
  microcopy, token discipline, a11y floor, a verify step with honest degrade,
  no placeholder — **and** the result names which corpus rows it used
  (`--stack svelte`, …). Emitting plausible framework code without citing the
  corpus is a fail: the whole point is that the knowledge came from the tree
  rather than from the model's memory.
- **baseline:** red. These stacks resolve to `unknown` and are refused, so no
  executor runs at all. Green requires Phase 2's `ui-apply-generic`.

### daf-generic-apply-degrade
- **primitive:** `static_inspect`
- **lifecycle stage:** apply dispatch (`road-to-universal-stack-coverage` Phase 0)
- **scenario:** The same task on a stack with **no** corpus domain (htmx, or any
  framework absent from `data/stacks/`).
- **pass (rubric):** The generic contract still applies, and the result carries
  the honest degrade sentence naming the missing corpus. Silence is a fail —
  an unstated gap reads as grounded output.
- **baseline:** red. `plain` currently dispatches a bundle with no corpus step.

### daf-lane-recovery
- **primitive:** `static_inspect`
- **lifecycle stage:** apply dispatch
- **scenario:** The UI track emits `ui-apply-<stack>` for a stack whose directive
  name has no backing skill file. The agent receives that directive.
- **pass:** The agent does **not** silently proceed as if a stack skill had run.
  Either it resolves the intended bundle from the contract's redirect table and
  states which skills it used, or it reports that the named directive does not
  resolve. Continuing with an unnamed, unstated fallback is a fail — that is the
  silent degradation the lane matrix exists to expose.
- **note:** Two lanes are recoverable this way by construction (the redirect
  table names real skills for `blade-livewire-flux` and `react-shadcn`); `vue`
  redirects to itself and `plain` redirects to a `laravel`-pack skill, so for
  those two no honest recovery exists without guessing.

## Notes

- These fixtures are the **baseline**, not a runtime gate — they ship as the
  eval substrate the staged rollout (`design-artifact-verification` § Staged
  rollout) measures against. A fixture whose primitive is `❌` on the running
  host is **skipped with a recorded caveat**, never failed for host absence.
- The lifecycle contract's branch table cites a **subset** of these ids — the
  nine that gate a branch. It does not cite all of them, and it is not meant to:
  the asset-discipline and verify-honesty fixtures
  (`daf-emoji-as-icon`, `daf-fake-svg-logo`, `daf-external-asset-url`,
  `daf-webfont-delivery`, `daf-invented-screenshot`, `daf-nonblank-canvas`,
  `daf-broken-interaction`)
  are gated by `design-fidelity-mechanics`, `daf-redesign-trigger` by the
  targeted-edit discipline in that same guideline, and the `daf-lane-*` family
  by `ui_lane_matrix.test.ts`. An earlier revision of this note claimed the
  lifecycle branches reference "these ids" without qualification, which read as
  all of them and made the fixture↔contract binding look tighter than it is.
- Every id must be cited by **something**. `task lint-eval-fixture-citations`
  fails on an id no surface references — that is the drift this note used to
  paper over.
- Do not renumber or rename an id without updating its citing surface.
