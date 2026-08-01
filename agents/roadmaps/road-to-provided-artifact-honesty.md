---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---

# Road to provided-artifact honesty — a handed-over design is either honoured or refused, never silently regenerated

> Scope is deliberately smaller than the defect. A standing council lock forbids
> the obvious fix (an HTML extractor + a Playwright ground-truth diff), and the
> re-verification did not produce evidence that clears the bar to reopen it. What
> remains inside the lock is still worth building: today the package takes a
> finished design artifact and quietly rebuilds it from a five-key abstraction,
> and nothing tells the user that happened.
>
> Source: `agents/tmp.old/frontend-fix.txt` (external analysis, re-verified).
> Council cut + the lock's exact wording:
> [`frontend-fidelity-cut`](../settings/contexts/frontend-fidelity-cut.md).
> Lane/routing defects: `road-to-ui-track-integrity`. Webfonts:
> `road-to-webfont-delivery-ownership`.

## Goal

Close the honesty gap on provided design artifacts along three lines that all fit
inside the lock:

1. **Route.** A prompt that hands over a finished artifact reaches the fidelity
   rule instead of the generative default — including when the prompt is German
   or carries no keyword at all.
2. **Refuse or honour, never silently regenerate.** If the package cannot carry
   the artifact faithfully, it says so and names what it would lose. If an
   external tool supplied a `design-system.json`, the package honours it rather
   than re-deriving values from taste.
3. **Stop correcting the spec.** A faithful port must survive review and polish
   without being edited back toward the package's house taste.

## Context (verified in-tree 2026-07-31, do not relitigate)

- **The brief is the only channel, and it has five keys.**
  `design.ts:21-27` fixes `REQUIRED_BRIEF_KEYS = [layout, components, states,
  microcopy, a11y]`. There is no channel anywhere in the UI directives for a
  source artifact, token map, interaction inventory, keyframes, or asset
  manifest (grep: 0 hits). Extra keys survive structurally — the brief is a plain
  dict and `design.ts:141` iterates only the required list — so the bottleneck is
  **not schema rejection**; it is that nothing downstream reads anything else.
- **Apply never sees the design state at all.** `apply.ts` reads
  `envelope.rendered`, `files`, `summary` and runs a placeholder-substring scan
  (`apply.ts:108-135`). It does not read `state.ui_design` — so it validates
  neither against the artifact nor, verbatim, against the brief's microcopy.
  ("The brief is the lock" is `design.ts:8`, not apply's contract.)
- **No lifecycle branch covers the case.**
  `docs/contracts/design-artifact-lifecycle.md:57-63` lists five branches;
  "Handoff to production code" runs stages 5→6 only, skipping Build. A provided
  artifact therefore classifies as "New design" and runs the full generative
  route including variation planning. The contract self-declares advisory
  (`:15-16`), so this is a documentation gap, not a blocked path.
- **The rule that forbids this does not fire.** `src/rules/design-fidelity.md`
  carries ten triggers, all English keyword/phrase (`prototype`, `mockup`,
  `wireframe`, `design system`, `design spec`, `Figma`, "match the design",
  "build this design", "design fidelity", "stick to the design"). Missing:
  "Claude Design", "handoff", "artifact", "design.html", any path or
  file-attachment trigger, and every German phrasing. It is also
  `packs: [frontend-design]`, so it never loads for a `laravel`- or `react`-only
  consumer — the pack half is fixed in `road-to-ui-track-integrity` Phase 4.
- **The bundle format is unknown, but less absolutely than reported.**
  `design.html`, `.claude/design-system`, `design-notes.md` → 0 hits each. Two
  reported-zero tokens are not zero and are unrelated: `design-sync` (2 hits, a
  Claude-Code builtin-name collision list at
  `src/scripts/_lib/claude_builtin_names.ts:51`) and `screenshots/` (6 hits, all
  wizard docs). `Claude Design` appears twice, both in an archived roadmap that
  explicitly puts it out of scope.
- **The audit inventories the project, never the artifact.** The token-detection
  table (`existing-ui-audit/SKILL.md:101-106`) lists four sources —
  `tailwind.config.*`, `:root` blocks, `theme.json`/`tokens.json`, SCSS. Prose at
  `:43-47` does mention "supplied screenshots or exported design context", so the
  intent exists; it is backed by no path, format, or table row.
- **Anti-slop flags the Claude-Design palette by construction.**
  `design_slop_rules.ts:247-260` — `slop-c5-cream-palette` fires when a cream hex
  (`#f7f5f1|#f5f1ea|…`) **and** `terracotta|clay|brass|oxblood` co-occur; that is
  precisely the aesthetic Anthropic's own frontend-design skill names as its
  default. Also `slop-c2-gradient-text` (`:229`), `slop-t4-eyebrow-overuse`
  (`:264`), `slop-l4-numbered-markers` (`:322`).
- **A provided artifact is not a suppression source.** The linter has exactly six
  suppression code paths across three sources: the DESIGN.md context gate
  (`lint_design_slop.ts:149`), three inline-ignore forms (`:123-130`), and
  `.design-quality.json` `ignoreRules`/`ignoreFiles` (`:192-205`).
  `grep design-fidelity src/scripts/` → 0 hits.
- **But the pressure is behavioural, not a gate.** `lint_design_slop` defaults to
  exit 0 (`:35-36`) — advisory unless `--fail-on`. The mechanism that edits a port
  away from its source is `design-review § Anti-slop scan` feeding `polish.ts`
  (`POLISH_CEILING = 2`, `polish.ts:20`), i.e. an agent acting on findings.
- **The package tells the agent to consider *correcting* an inspected source.**
  `existing-ui-audit/SKILL.md:248-257`: an existing anti-pattern is surfaced as a
  design-debt finding, then "whether to continue the existing pattern (for
  consistency) or introduce a corrective direction change". There is a
  precedence sentence nearby — `fe-design/SKILL.md:397`, "audit-pinned tokens and
  components always take precedence" — but it is scoped to the consumer's own
  existing UI, not to a provided external artifact. No fidelity-beats-anti-slop
  precedence exists.
- **`fe-design`'s first-impulse rule has an escape, not a carve-out.**
  `fe-design/SKILL.md:329-331`: "If a tell was the first impulse, choose a
  different approach **or explicitly justify why this brief calls for it**." A
  justification burden, not a provided-artifact exemption.
- **Zero of 16 `daf-*` fixtures covers the port case.** The nearest are
  verification fixtures (`daf-overlapping-text`, `daf-mobile-fit`,
  `daf-export-readback-failure`) and `daf-broken-interaction`, which asserts that
  **one** handler is wired — nothing requires that all of an artifact's
  interactions survive. Per house method: no eval, no proof — this behaviour was
  never measured, which is why prior reviews did not see it.
- **The lock, verbatim.** `design-system-capture/reference/design-system-json.md:3-7`
  — *"This is the consumer-side contract: any external static-extraction tool …
  emits this shape; the skill READS it … We own the contract, not the crawler
  (council 2026-06-28)"* — and `:64-65`: *"the package **owns this contract**; it
  does **not** ship the crawler, the Playwright runtime, or a font-bundler."*
  `design-system.json` already carries a `motion: { durations, easings }` block
  (`:25-26`) — an interaction channel the package defined and never consumes.

## Design constraints

- **The lock holds.** No crawler, no Playwright runtime, no font-bundler, no new
  binary dependency. Round 2 of the council sharpened the reading and this
  roadmap adopts it: the lock forbids **shipping the extraction machinery**, not
  **accepting and honouring** a `design-system.json` an external tool produced.
  Everything below lives on the accept-side of that line.
- **Honest refusal outranks a partial port.** If the package cannot carry an
  artifact faithfully, saying so is a shipped feature. Silent regeneration is the
  defect.
- **No parallel pipeline.** The council rejected a second generative track. Where
  a change is needed it extends the existing steps or removes a bottleneck; it
  does not fork the machine.
- **`--fidelity-source` is out until measured.** Given the linter is advisory, a
  precedence sentence plus one regression fixture is the first attempt. A
  machine-readable suppression channel is a gated follow-up, not a Phase-1 item.

## Phase 0 — Measure the failure before changing behaviour (blocking)

- [x] Fixture `daf-port-baseline`: a standalone `design.html` (Claude-Design-style
      cream/terracotta palette, two screens, three interactions, one keyframe) is
      handed over with an explicit "build this 1:1" instruction. Record what the
      pipeline actually does — which branch it classifies as, whether
      `design-fidelity` fired, what survived, what was regenerated.
      <!-- tests/design-artifacts/fixtures/design.html + fixture entry in eval-fixtures.md. -->
- [x] Fixture `daf-port-trigger-de`: the same artifact with a German prompt
      ("setz das 1:1 um", "übernimm das Design") and, separately, with **no**
      keyword at all — just the attached HTML. Expected today: the rule does not
      fire. This measures the routing half independently of the port half.
      <!-- Deterministic, not rubric: tests/scripts/design_fidelity_routing.test.ts, ROUTING_MATRIX (14 rows) over the shipped matcher `router_telemetry.trigger_matches`. -->
- [x] Fixture `daf-slop-vs-provided`: run the anti-slop scan over a faithful port
      of that artifact. Expected today: `slop-c5-cream-palette` fires and the
      polish loop is free to act on it. This is the regression witness for
      Phase 3.
- [x] Fixture `daf-port-interactions`: assert whether the three handlers and the
      keyframe survive, and whether anything reports the ones that did not.
      Expected today: no inventory exists, so losses are silent.
- [x] Run all four against the current tree and write the baseline into this
      roadmap. If any shows the pipeline already behaves acceptably, that lane's
      later phase is cut rather than built.

### Measured baseline — 2026-08-01, `origin/main` @ `4840318af`

Full per-fixture evidence with file:line citations lives with the fixtures
([`eval-fixtures.md` § Provided-artifact port fixtures](../../tests/design-artifacts/eval-fixtures.md));
the four headline before-values:

| lane | before-value | measured how |
|---|---|---|
| **branch** | No port branch exists. A handed-over artifact is classified as a **new design** by elimination (only that branch contains Build, and it mandates variation planning) and the engine independently takes the greenfield path. | `design-artifact-lifecycle.md:57-63`, `audit.ts:104`, `index.ts:59-69` |
| **carrier** | Zero channels. The brief is five fixed keys; no state field carries a source artifact, token map, interaction inventory, or asset manifest. `apply.ts` never reads `state.ui_design` at all. | `design.ts:21-27`, `:141-168`, `apply.ts:81-94` |
| **routing** | 8 of 14 matrix rows red. `"build this 1:1"` misses because the phrase `build this design` needs the literal token `design`; no German surface exists; no `file_pattern` trigger was declared. | `ROUTING_MATRIX`, `router_telemetry.ts:186-199` |
| **slop** | Two artifact-covered findings, neither marked as such: `slop-c5-cream-palette` (P3) and `slop-cp1-em-dash` (P2, the artifact's own copy). The polish loop cannot see either — it knows only `a11y_violation` and `token_violation`. | `lint_design_slop --json`, `polish.ts:28`, `:31` |

**No lane came back acceptable, so no phase is cut.** Two roadmap premises were
falsified by the measurement and are corrected in place rather than worked
around:

1. **The rule schema does support a path trigger.** Phase 1's third step
   assumed "only `keyword`/`phrase`". `rule.schema.json` also accepts
   `file_pattern`, `path_prefix`, `intent`, and `command`, and the matcher
   implements `file_pattern` as fnmatch over `open_files`
   (`router_telemetry.ts:218-229`). The keyword-free class is therefore
   reachable for the conventional handover filename; what stays unreachable
   **by design** is a generic "any attached HTML" trigger.
2. **The damage path is not the linter.** The anti-slop scanner has no call
   site in the work engine, so Phase 3's target is the *prose* that authorises
   a corrective direction change (`existing-ui-audit/SKILL.md:263-273`,
   `fe-design/SKILL.md:337-339`), not a suppression flag. This is the evidence
   the "`--fidelity-source` flag" gated follow-up asked for, and it points the
   other way: keep the flag gated.

**Exit:** the port failure is a measured before-value, not an anecdote.

## Phase 1 — Routing: the rule fires for the prompts people actually write

- [x] Extend `design-fidelity` triggers: keywords `handoff`, `artifact`,
      `Claude Design`; phrase `design.html`. Keep the set tight — a trigger that
      fires on every mention of "artifact" is worse than the gap.
      <!-- `handoff` + `Claude Design` land as keywords. `artifact` deliberately does NOT: the near-miss row `near-artifacts-plural-unrelated` ("the CI build artifact is 40 MB") is exactly the failure the step warns about, so it ships as the phrases `attached artifact` / `provided artifact` instead. -->
- [x] Add German trigger phrases ("setz … um", "baue … nach", "übernimm das
      Design", "1:1"). Note the general gap while you are here: the package's
      trigger vocabulary is English-only across the board, and the maintainer
      prompts in German. Do **not** solve that globally in this roadmap — record
      it as the gated follow-up below.
      <!-- Shipped: `1:1 um`, `1:1 nach`, `übernimm das design`, `baue das nach`, `bau das nach`. Bare `1:1` was rejected — it collides with one-on-one meetings, which this package has a skill for (`one-on-one-cadence`). Global gap measured and left to the gated follow-up, with the roadmap's "English-only across the board" framing corrected: of 102 rules carrying a `triggers:` block, 3 already ship German surfaces (`question-not-instruction`, `user-interrupt-priority`, `artifact-drafting-protocol`) — this rule makes 4. The gap is real but partial, and the three precedents are the shape a global pass would generalise. -->
- [x] Decide whether an attached standalone HTML file can itself be a trigger.
      The rule schema currently supports only `keyword`/`phrase`; if a path or
      attachment trigger does not exist, say so plainly rather than pretending
      the keyword list covers the no-keyword case.
      <!-- The premise is false and is corrected in Phase 0's baseline: the schema also accepts `file_pattern` (fnmatch over `open_files`, `router_telemetry.ts:218-229`). Shipped `file_pattern: "*design.html"` — anchored `^(?:…)$`, so it matches any path ending in the conventional handover filename. `*.html` was rejected: it fires on every HTML edit in every project. A handover under another filename still needs one word in the prompt, and that limit is stated in the rule body rather than papered over. -->
- [x] `daf-port-trigger-de` flips to green for all three prompt classes
      (English, German, keyword-free-with-attachment) — or the keyword-free class
      is documented as unreachable with the current trigger schema.
      <!-- 17/17 green (was 9/17). All three classes route; the two near-miss rows and `none-attached-arbitrary-html` stay deliberately red-by-design. -->

**Exit:** the three prompt classes route measurably, or the unreachable one is
named.

## Phase 2 — Refuse honestly, or honour a supplied contract

- [x] Add the missing lifecycle branch to
      `docs/contracts/design-artifact-lifecycle.md:57-63` — trigger "finished
      artifact provided as spec" — and state plainly what the package does and
      does not do on it. Variation planning is excluded by definition on this
      branch.
      <!-- Branch **Port a provided artifact**: 1 (delta) → 2 (deep, on the artifact) → 4 → 5 → 6, stage 3 excluded by definition. The absence was not neutral — with no branch naming it, a handover fell to New design by elimination, the only other branch containing Build, which mandates the variation planning a port must not do. -->
- [x] Ship the honest refusal: when an artifact is provided and no
      `design-system.json` accompanies it, the pipeline surfaces **what it will
      lose** (exact spacing, easing, hover behaviour, handlers, asset manifest)
      and asks before regenerating, instead of regenerating silently. This is the
      minimum viable fix and it is entirely inside the lock.
      <!-- `UNCARRIED_BY_THE_BRIEF` (design.ts) + the `design_provided_without_contract` halt. Fires BEFORE the sign-off gate, not after — pinned by a test, because stating the loss after the user confirms the brief would be the same silence one step later. Recommendation is "supply the contract", not "abort". -->
- [x] Consume the contract the package already owns: when a
      `design-system.json` **is** supplied (any external extractor produced it),
      read it — including the `motion` block at
      `design-system-json.md:25-26` that nothing currently consumes — and honour
      its token values instead of re-deriving them. Accepting is on the allowed
      side of the lock; producing is not.
      <!-- Carried on `provided_artifact.design_system`; presence closes the refusal branch. `motion` gains its first consumer since the schema shipped — recorded in the reference doc's field rules so the next reader is not told again that nothing reads it. -->
- [x] Extend the audit's token-detection table
      (`existing-ui-audit/SKILL.md:101-106`) with a supplied-artifact source, and
      keep artifact-sourced tokens distinguishable from project tokens in the
      audit output so the mapping between them stays visible.
      <!-- Two rows added (a supplied design-system.json; the artifact's own :root/inline style as the fallback), plus a per-group `source: project|artifact` requirement and a conflict-surfacing clause that defers to brand-source-of-truth. -->
- [x] Remove the bottleneck rather than routing around it: `apply.ts` does not
      read `state.ui_design` at all. Where a supplied contract exists, apply must
      read it. No parallel track — the same step, one more input.
      <!-- apply.ts imports `provided_artifact` / `has_design_system` from design.ts rather than re-deciding "is this a port?" — the same shared-walker discipline the placeholder gate already uses, for the same reason (two copies of one predicate drifted before). -->
- [x] Report coverage: the apply envelope states how much of the supplied
      contract was honoured verbatim, translated, or flagged. Without this the
      user cannot tell a faithful port from a lucky one.
      <!-- `coverage_gaps()`: every declared interaction / keyframe / asset must appear in exactly one bucket, else BLOCKED naming each unaccounted item. Dropping a handler stays allowed; hiding one does not. -->
- [x] `daf-port-baseline` and `daf-port-interactions` flip to green, or produce a
      documented honest-null for the lanes that cannot.
      <!-- Both green, with post-fix notes on the fixtures. 19/19 in provided_artifact_port.test.ts, including the non-port regressions: the slot is optional and a brief without it behaves exactly as before. -->

**Correction to this phase's premise.** The step above says apply must read the
brief "where a supplied contract exists". Implemented one notch stricter: apply
reads it wherever a **provided artifact** exists, contract or not. A port whose
losses were merely acknowledged still owes the coverage report — otherwise
picking "proceed" at the refusal gate would buy silence for the rest of the run,
which is the failure this roadmap is named after.

**Exit:** no provided artifact is silently regenerated; either it is honoured or
the loss is stated before the work happens.

## Phase 3 — Precedence: a provided spec is not an impulse

- [ ] Write the precedence chain down where the agent reads it — provided
      artifact > anti-slop > house taste — and scope it strictly: the exemption
      covers only decisions the artifact actually covers, never generative work.
- [ ] Give `fe-design § Anti-Default Discipline` (`SKILL.md:329-331`) the missing
      carve-out sentence: a supplied artifact is the spec, not a first impulse,
      so the justify-or-change burden does not apply to artifact-covered choices.
- [ ] Resolve the contradiction in `existing-ui-audit/SKILL.md:248-257`, which
      currently invites the agent to treat an inspected anti-pattern as a
      candidate for corrective direction change. Distinguish the consumer's own
      legacy UI (correctable) from a supplied spec (not correctable).
- [ ] `design-review § Anti-slop scan` and `polish.ts`: findings covered by the
      supplied artifact are informational and never fix-worthy; polish rounds do
      not touch them.
- [ ] `daf-slop-vs-provided` flips to green — the finding is cited as
      "matches provided spec" and the palette is unchanged after review + polish.
- [ ] Re-measure after the prose change. If the polish loop still edits the port
      away from its source, that is the evidence that promotes the machine-readable
      suppression channel from gated follow-up to open work — and only then.

**Exit:** a port carrying the Claude-Design house aesthetic survives review and
polish unchanged.

## Phase 4 — `bench:ui`: the diff machinery, maintainer-side

> Authorised 2026-08-01. The measurements in
> `road-to-ui-track-integrity-followup` are blocked on a harness that scores
> generated UI; this roadmap needs the same diff machinery for its own port
> fixtures. Building it once, here, serves both — which is precisely the
> "if such a harness lands for another reason, this roadmap unblocks for free"
> clause, taken up rather than worked around.

**The lock is not engaged, and that is a finding, not a permission.** The
2026-06-28 lock forbids the package *shipping* a crawler, a Playwright runtime,
or a font-bundler. `@playwright/test ^1.60.0` is already a **devDependency**, and
`package.json` `files[]` ships neither `tests/` nor `internal/` — so a bench that
lives beside `bench:ab` and `bench-quality-run` distributes nothing to a
consumer. No reopening was required; the maintainer offered to lift the lock and
the lift turned out to be unnecessary. The consumer-side verify stage stays
gated, unchanged (see below).

- [ ] `bench:ui` under `internal/bench/`, alongside the two existing benches.
      Scores a produced UI against a provided `design.html` as ground truth.
- [ ] **No model in the scoring path.** Four deterministic components, weights
      **pre-registered before the first run**:
      1. perceptual screenshot diff per breakpoint (375 / 768 / 1280) — SSIM or
         pixelmatch **with a threshold**, never raw pixel equality, which would
         measure font antialiasing rather than fidelity;
      2. DOM-structure comparison of the component inventory;
      3. token-mapping score (parseable — hex/spacing/radius resolved to tokens
         or flagged);
      4. interaction checklist driven by Playwright.
- [ ] Rationale recorded with the harness, because it is the reason it exists in
      this shape: an LLM judge for "is this frontend better" imports judge
      variance and **circularity** — Opus grading Opus — into the one measurement
      that has to decide Opus vs Sonnet. The port case is the single place a
      ground truth already exists, so the question can be measured instead of
      adjudicated.
- [ ] Feed it from this roadmap's Phase-0 port fixtures; no second fixture set.
- [ ] **Freeze the fixtures before the first scored run.** Commit them and
      SHA-pin the set; record the pin next to the weights. A fixture set nudged
      after a first bad run contaminates both measurements exactly the way a
      threshold chosen after seeing the distribution does — the pre-registration
      is worthless if the *inputs* stay editable while the outputs are watched.
      Extensions are allowed and are a **new set, scored separately**, never a
      revision of the pinned one.
- [ ] **Make the fixtures render deterministically.** A screenshot diff is only
      reproducible if the render environment is:
      - **Browser pinned** — use the version the existing `@playwright/test`
        devDependency resolves, and record it with the run. A browser bump is a
        new scoring epoch, not a free upgrade.
      - **Fonts embedded in the fixture, never hotlinked.** A
        `fonts.googleapis.com` `@import` inside a `design.html` makes the SSIM
        score a function of the CI runner's network and font fallback — the
        harness would be measuring the runner, not the port. Self-host or
        base64-embed the faces in the fixture itself.
      - Animations and transitions disabled at capture; fixed viewport per
        breakpoint; no `Date`/random content in the fixture markup.
      The self-hosted route this needs already exists: the corpus carries a
      `Self-Hosted Route` column (`font-pairings-reference.csv`) from the
      completed webfont-delivery work, so the fixtures consume it rather than
      waiting on it.
- [ ] Wire as `bench:ui` so it is invocable the way the sibling benches are.

**Exit:** a port produces a diff-distance score from four deterministic
components, reproducibly, with no model in the scoring path.

## Gated follow-ups (not open work — do not start these)

- **`--fidelity-source` suppression flag for `lint_design_slop`.**
  **Gate:** Phase 3's re-measurement shows the prose precedence is insufficient.
  Rationale for the gate: the linter is advisory (exit 0 by default), so a
  machine-readable channel may buy nothing over a sentence the agent already
  reads.
- **An in-package HTML → `design-system.json` extractor.** **Gate:** reopening
  the 2026-06-28 lock, which requires evidence this roadmap does not have — more
  than one consumer, and a demonstration that the accept-side fix (Phase 2) left
  material value unclaimed.
- **Consumer-side Playwright verify stage** — the agent rendering and diffing a
  port inside the *consumer's* project. **Gate: unchanged.** This is what the
  2026-06-28 lock excludes: it needs a browser runtime at the consumer, and the
  package's honest-degrade pattern for browser-dependent verification stays the
  answer. Not to be confused with the maintainer-side bench below, which the
  lock does not touch.
- **Tailwind v4→v3 translation, inline-CSS → scoped component CSS, standalone-JS
  → framework idiom.** Verified thin: total v4 knowledge is three CSV rows plus
  one parenthetical in `tailwind-engineer/SKILL.md:47`. **Gate:** Phase 2 ships
  and the coverage report shows translation — not extraction — is the binding
  constraint.
- **A second-language axis for the package's whole trigger vocabulary.**
  **Gate:** Phase 1 confirms the German gap costs real routing, and the fix
  generalises beyond this one rule.

## Non-goals (decided, with reasons)

> **Amended 2026-08-01 — the one-question-harness objection is discharged, not
> bypassed.** The predecessor's non-goal was "do not build a UI-quality harness
> to answer one frontmatter question". `bench:ui` has three customers: this
> roadmap's own acceptance criteria, the two parked measurements, and — after the
> session — a standing regression watch for every future change to the UI skills,
> which becomes diff-measurable instead of arguable. That is the verify stage of
> a shipped feature, reused as a bench; the non-goal was aimed at a
> single-purpose benchmark subsystem and still holds against one.

- **No design runtime, no reimplementation of any external design tool.**
- **No parallel generative pipeline** for the port case — the council rejected
  forking the machine; extend or remove, do not duplicate.
- **No relaxation of anti-slop for generative work.** The Phase-3 carve-out is
  strictly artifact-covered decisions.
- **No Figma integration.** Different format, different roadmap, no evidence of
  demand here.
- **Not the lane/routing defects** (`road-to-ui-track-integrity`) — those bite
  every frontend and ship first.

## Acceptance criteria

- The Phase-0 baseline exists; every later phase cites a before-value from it.
- All three prompt classes route to the fidelity rule, or the unreachable class
  is documented with its reason.
- A provided artifact is never silently regenerated: the pipeline either honours
  a supplied contract or states what it will lose and asks first.
- The apply envelope reports honoured-verbatim / translated / flagged coverage.
- A port in the Claude-Design palette survives review and polish unchanged, with
  the anti-slop finding cited as informational.
- Every change in this roadmap sits on the accept-side of the 2026-06-28 lock; no
  crawler, no browser runtime, no font-bundler, no new binary dependency.
