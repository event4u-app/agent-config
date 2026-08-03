---
complexity: structural
status: ready
---

# Road to routing correctness — the rule set stops fighting itself, and a command proves what routes

> **Source:** operator performance report (2026-08-02, local transcript
> `agents/tmp.old/performance-and-rules.txt`) — maintainer mandate: "routing
> for rules must be genuinely active; rules must demonstrably bind; a command
> must exist to validate and test the routing. Rules are intermittently
> ignored; a colleague attributes errors to the frontend sets."
> Council disposition 2026-08-03 (claude-sonnet-4-5 + gpt-4o, 2 rounds):
> land rule hygiene + `route:explain` as their own roadmap; **cut the
> runtime-resolver phase entirely** — `internal/bench/layer1-resolver-PREREG.md`
> keeps sole authority over any resolver revival (its reopen terms P1–P3 are a
> falsification filter, not a revival path; the maintainer mandate does not
> substitute for them). Sequenced AFTER `road-to-hook-latency-repair.md` and
> the renewal set's open work.
>
> **Verified findings (re-checked against HEAD 2026-08-03 where marked):**
>
> 1. *Question triangle (all three always-loaded):* `ask-when-uncertain`
>    ("ONE QUESTION PER TURN … Even if trivial — exactly one") vs
>    `autonomous-execution` ("Trivial workflow questions are noise — just
>    act") vs `no-cheap-questions` IL4. `agent-authority` orders the bands but
>    does not amend the literal "even if trivial" text — the model holds two
>    absolute imperatives that disagree on trivial questions.
> 2. *35 trigger collisions* across the 111 source-rule frontmatters
>    (`refactor` and `migration` fire 5 rules each; `implement` 4; `fix`,
>    `debug`, `controller`, `endpoint` 2–3 each) — reported by the analysis
>    at v9.14.0; re-counted as a first step below.
> 3. *Semantic duplicates with overlapping triggers:* `brand-consistency` vs
>    `brand-source-of-truth`; `domain-safety-disclaimer` vs
>    `finance-safety-floor` (`valuation`, `dcf`); `secret-vcs-guard` vs
>    `security-sensitive-stop` (`secret`, `password`).
> 4. *Tier fallthrough (VERIFIED at HEAD):* `LEGACY_TIER_MAP` in
>    `src/scripts/compile_router.ts` lacks `2b` (21 rules) and `safety-floor`
>    (3 rules); `?? 'tier-2'` silently downgrades any unknown tier value. The
>    `safety-floor` rules are `type: always` → kernel regardless; the 21 `2b`
>    rules land on tier-2 unreviewed, and a typo'd tier value today produces a
>    silent zero-injection downgrade instead of a compile error.
> 5. *Frontend-set weight:* the UI track's mandatory chain
>    (audit → design → apply → review → polish) fronts ~100 KB of reference
>    skills; a `ui_trivial` lane exists but nothing measures whether trivial
>    fixes route there.

## Locks honored (do not relitigate here)

- **`internal/bench/layer1-resolver-PREREG.md`** — the resolver spike stays
  parked on its own reopen terms (P1 stdout-contract extension as its own
  change + decision record; P2 corpus ≥50 labelled rules or a power analysis;
  P3 superseding ADR for ADR-040). This roadmap builds NO resolver and adds no
  second threshold set. Phase 4's telemetry is corpus-growth raw material for
  P2, nothing more.
- **ADR-054 (rejected)** — no adherence-justified restatement mechanism.
- **Thin-flip honest null (TERMINAL)** — untouched.
- **ADR-126 / cross-model-routing-eval** — every routing-introspection surface
  here labels its measurement level (trigger match ≠ in-host invocation) in
  the tool output itself.
- **Kernel-edit slow-rollout** — the question-triangle amendment ships as its
  own PR through the kernel process, human-owned, ≥24 h soak.

## Phase 1 — rule hygiene: stop the set from fighting itself

- [ ] Re-count the trigger collisions at HEAD with a committed script
      (`route:explain`'s matcher module once Phase 2 lands, or a standalone
      scan until then). The 35-collision figure from the analysis becomes a
      reproducible number.
      *Verify:* collision report committed under `agents/evidence/`; count and
      per-trigger rule lists reproducible from the script.
- [ ] New lint `lint_trigger_collisions.ts`: a trigger string shared by ≥2
      rules is an error UNLESS every sharer declares a `precedence:` ordering
      or a `collision_ok: <reason>` frontmatter key. Seed all current
      collisions with explicit dispositions (many are legitimate — `refactor`
      firing both `think-before-action` and `minimal-safe-diff` is arguably
      correct; the lint forces the argument to be written down once). Wire
      through `assertScanned` (0 rules scanned → red).
      *Verify:* seeded undeclared collision fixture → red in CI; all live
      collisions dispositioned.
- [ ] Merge or disjoin the identical-trigger duplicates: brand pair → one rule
      + one pointer; `domain-safety-disclaimer` finance triggers move to
      `finance-safety-floor`; `secret-vcs-guard` vs `security-sensitive-stop`
      get disjoint trigger sets (VCS surface vs conversational surface).
      Preservation-guard applies to every merge.
      *Verify:* zero identical-trigger duplicate pairs remain; condensation +
      router compile green; preservation checklist per merged rule.
- [ ] Harden `LEGACY_TIER_MAP`: unknown tier value = compile error in
      `compile_router.ts` (today: silent tier-2 fallthrough). Add `2b`
      explicitly with a recorded decision (`2b` → tier-2 intended or the 21
      rules are re-tiered deliberately) and map/reject `safety-floor`.
      *Verify:* fixture rule with a typo'd tier fails compilation; the 21
      `2b` rules carry an explicit, reviewed mapping.
- [ ] Reconcile the question triangle with a one-line amendment, not a
      rewrite: `ask-when-uncertain`'s Iron Law gains the missing cross-band
      qualifier ("…for questions that clear the `autonomous-execution`
      trivial bar — trivial questions are not asked, per band 4"). Own PR,
      kernel process, human-owned.
      *Verify:* string-level check — "even if trivial" coexists with the
      band-4 qualifier; the literal texts no longer contradict.

## Phase 2 — the validation surface the mandate asks for

- [ ] `agent-config route:explain "<prompt>" [--files a,b]` — deterministic,
      offline, reads `dist/router.json` (tier-1/2 + anchor scoring), prints:
      matched triggers, tier, injected-vs-pointer disposition, budget
      consumption, rejected candidates with reasons. Mandatory first output
      line: "Shows trigger matching. What the host actually invokes is NOT
      measured here (see road-to-cross-model-routing-eval)."
      *Verify:* golden tests — 10 pinned prompts → pinned explanations; drift
      breaks CI.
- [ ] Parity by construction: the explain command and any future resolver
      share ONE matcher module (single implementation, two callers), asserted
      by an import-graph test — nothing can drift because there is nothing to
      drift between.
      *Verify:* import-graph test red when a second matcher implementation
      appears.
- [ ] `/routing-audit` slash command: runs `route:explain` over the last N
      prompts from chat-history JSONL and renders should-have-matched vs
      matched. Read-only, no LLM call, same measurement-level header.
      *Verify:* command spec + eval cases; output header labels the
      measurement level.

## Phase 3 — frontend-set diet (measurement before trimming)

- [ ] Pre-register the classification claim: on a labelled corpus of ≥30 real
      frontend tasks (redacted), the ui/ui_trivial classifier must route ≥80%
      of human-labelled trivial tasks to the trivial lane. Corpus and labels
      committed BEFORE the classifier is touched.
      *Verify:* corpus + labels + threshold committed in one PR with zero
      classifier changes.
- [ ] Run the eval. If the trivial-recall bar is missed, fix classification
      FIRST — no chain trimming lands on a misrouting classifier.
      *Verify:* eval report committed; recall number recorded either way.
- [ ] Chain right-sizing (gated on the eval): `existing-ui-audit` +
      `design-intelligence` become mandatory only for new-design / redesign
      intents; fix-intent UI work enters at `apply` with the audit available
      on demand. The resource-first hard-stop stays mandatory for any work
      referencing an existing design artifact (design-fidelity floor
      untouched).
      *Verify:* directive-set tests cover both intents; design-fidelity
      fixtures stay green.
- [ ] Progressive disclosure for the four heavy reference skills (`fe-design`,
      `design-intelligence`, `existing-ui-audit`, `design-review`):
      section-level entry points so an invocation loads the needed section,
      not the full body. Tokens-per-UI-task measured before/after; threshold
      pre-registered before the first cut. Preservation-guard applies.
      *Verify:* before/after token numbers committed; no Iron-Law section
      dropped (preservation checklist).
- [ ] Output-quality judgment routes to `road-to-ui-track-integrity-followup.md`'s
      `bench:ui` — no second UI harness.

## Phase 4 — standing adherence telemetry (the anti-anecdote layer)

- [ ] `router_telemetry` gains an opt-in, redacted session recorder: per
      prompt, which triggers matched (from the shared matcher) and whether the
      matched rule's `enforced_by` mechanism (where one exists) fired that
      turn. Local JSONL under `agents/runtime/state/`, rebuildable, passes the
      state-store test.
      *Verify:* recorder off by default; redaction fixtures; delete-and-rerun
      loses history, changes no answer.
- [ ] `/routing-audit --weekly` renders the rolling picture. The next "rules
      are ignored" conversation starts from this corpus — which is also the
      instrument class both ADR-054's reopen clause ("a produced red baseline
      under any instrument") and the resolver PREREG's P2 corpus-growth
      condition name. Feeding P2 is a side effect, not a goal; the PREREG
      stays the sole resolver authority.
      *Verify:* weekly render golden test; the output cites the PREREG as the
      resolver authority.

## Success criteria (pre-registered)

- Trigger-collision lint green with every live collision dispositioned; zero
  identical-trigger duplicate pairs remain.
- Unknown tier value = compile error; the 21 `2b` rules carry a reviewed
  mapping.
- The question-triangle amendment lands through the kernel process; the
  literal texts no longer contradict.
- `route:explain` golden tests green; parity-by-construction asserted by an
  import-graph test.
- Trivial-lane recall ≥80% on the labelled corpus before any chain trim;
  tokens-per-trivial-UI-task reduced by the pre-registered threshold after.
- No resolver code exists in this roadmap's diff; the PREREG file is
  unmodified by this work.

## Non-goals (so nobody relitigates them into scope)

- No runtime resolver, no per-prompt injection transport change, no corpus
  labelling drive "for the spike" — all owned by
  `internal/bench/layer1-resolver-PREREG.md` and its reopen terms.
- No semantic/embedding trigger matching.
- No per-turn kernel restatement, no decay timers (ADR-054's rejected shape).
- No thin-projection default flip.
- No new UI harness, no model-tier flip (owned elsewhere).
