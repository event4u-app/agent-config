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

- [ ] Fixture `daf-port-baseline`: a standalone `design.html` (Claude-Design-style
      cream/terracotta palette, two screens, three interactions, one keyframe) is
      handed over with an explicit "build this 1:1" instruction. Record what the
      pipeline actually does — which branch it classifies as, whether
      `design-fidelity` fired, what survived, what was regenerated.
- [ ] Fixture `daf-port-trigger-de`: the same artifact with a German prompt
      ("setz das 1:1 um", "übernimm das Design") and, separately, with **no**
      keyword at all — just the attached HTML. Expected today: the rule does not
      fire. This measures the routing half independently of the port half.
- [ ] Fixture `daf-slop-vs-provided`: run the anti-slop scan over a faithful port
      of that artifact. Expected today: `slop-c5-cream-palette` fires and the
      polish loop is free to act on it. This is the regression witness for
      Phase 3.
- [ ] Fixture `daf-port-interactions`: assert whether the three handlers and the
      keyframe survive, and whether anything reports the ones that did not.
      Expected today: no inventory exists, so losses are silent.
- [ ] Run all four against the current tree and write the baseline into this
      roadmap. If any shows the pipeline already behaves acceptably, that lane's
      later phase is cut rather than built.

**Exit:** the port failure is a measured before-value, not an anecdote.

## Phase 1 — Routing: the rule fires for the prompts people actually write

- [ ] Extend `design-fidelity` triggers: keywords `handoff`, `artifact`,
      `Claude Design`; phrase `design.html`. Keep the set tight — a trigger that
      fires on every mention of "artifact" is worse than the gap.
- [ ] Add German trigger phrases ("setz … um", "baue … nach", "übernimm das
      Design", "1:1"). Note the general gap while you are here: the package's
      trigger vocabulary is English-only across the board, and the maintainer
      prompts in German. Do **not** solve that globally in this roadmap — record
      it as the gated follow-up below.
- [ ] Decide whether an attached standalone HTML file can itself be a trigger.
      The rule schema currently supports only `keyword`/`phrase`; if a path or
      attachment trigger does not exist, say so plainly rather than pretending
      the keyword list covers the no-keyword case.
- [ ] `daf-port-trigger-de` flips to green for all three prompt classes
      (English, German, keyword-free-with-attachment) — or the keyword-free class
      is documented as unreachable with the current trigger schema.

**Exit:** the three prompt classes route measurably, or the unreachable one is
named.

## Phase 2 — Refuse honestly, or honour a supplied contract

- [ ] Add the missing lifecycle branch to
      `docs/contracts/design-artifact-lifecycle.md:57-63` — trigger "finished
      artifact provided as spec" — and state plainly what the package does and
      does not do on it. Variation planning is excluded by definition on this
      branch.
- [ ] Ship the honest refusal: when an artifact is provided and no
      `design-system.json` accompanies it, the pipeline surfaces **what it will
      lose** (exact spacing, easing, hover behaviour, handlers, asset manifest)
      and asks before regenerating, instead of regenerating silently. This is the
      minimum viable fix and it is entirely inside the lock.
- [ ] Consume the contract the package already owns: when a
      `design-system.json` **is** supplied (any external extractor produced it),
      read it — including the `motion` block at
      `design-system-json.md:25-26` that nothing currently consumes — and honour
      its token values instead of re-deriving them. Accepting is on the allowed
      side of the lock; producing is not.
- [ ] Extend the audit's token-detection table
      (`existing-ui-audit/SKILL.md:101-106`) with a supplied-artifact source, and
      keep artifact-sourced tokens distinguishable from project tokens in the
      audit output so the mapping between them stays visible.
- [ ] Remove the bottleneck rather than routing around it: `apply.ts` does not
      read `state.ui_design` at all. Where a supplied contract exists, apply must
      read it. No parallel track — the same step, one more input.
- [ ] Report coverage: the apply envelope states how much of the supplied
      contract was honoured verbatim, translated, or flagged. Without this the
      user cannot tell a faithful port from a lucky one.
- [ ] `daf-port-baseline` and `daf-port-interactions` flip to green, or produce a
      documented honest-null for the lanes that cannot.

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
