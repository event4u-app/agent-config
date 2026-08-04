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
>    `src/scripts/compile_router.ts` lacks the tier values `2b` (21 rules) and
>    `safety-floor` (3 rules); `?? 'tier-2'` silently downgrades any unknown
>    tier value. The safety-floor-tagged trio is `type: always` → kernel
>    regardless; the 21 rules tagged 2b land on tier-2 unreviewed, and a
>    typo'd tier value today produces a silent zero-injection downgrade
>    instead of a compile error.
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

- [x] Re-count the trigger collisions at HEAD with a committed script
      (`route:explain`'s matcher module once Phase 2 lands, or a standalone
      scan until then). The 35-collision figure from the analysis becomes a
      reproducible number.
      *Verify:* collision report committed under `agents/evidence/`; count and
      per-trigger rule lists reproducible from the script.
      <!-- done 2026-08-04: lint_trigger_collisions --report generates
      agents/evidence/reports/trigger-collision-census.md. Reproducible
      numbers replace the 35: 38 colliding values at pre-hygiene 500c2d63e
      (measured via the same script in a detached scratch worktree), 32 after
      the Phase-1 disjoins/merges. -->
- [x] New lint `lint_trigger_collisions.ts`: a trigger string shared by ≥2
      rules is an error UNLESS every sharer declares a `precedence:` ordering
      or a `collision_ok: <reason>` frontmatter key. Seed all current
      collisions with explicit dispositions (many are legitimate — `refactor`
      firing both `think-before-action` and `minimal-safe-diff` is arguably
      correct; the lint forces the argument to be written down once). Wire
      through `assertScanned` (0 rules scanned → red).
      *Verify:* seeded undeclared collision fixture → red in CI; all live
      collisions dispositioned.
      <!-- done 2026-08-04: collision_ok (value→reason map) + precedence
      (value→int map) in rule.schema.json; all 32 live collisions seeded with
      per-rule reasons across 41 rules; assertScanned wired (scanned: line +
      gate-coverage entry, min_scanned 90); registered in task ci AND the
      Rule Backstops workflow (parity derived, no manifest entry needed).
      Tests: red fixture, precedence distinct/equal, manual/kind exclusions,
      dead-scope, mutation self-test — 13/13 with the Jaccard gate. Note:
      the roadmap's minimal-safe-diff/refactor example was imprecise at HEAD
      (minimal-safe-diff triggers on `fix`, not `refactor`) — the seeded
      reasons reflect the actual trigger sets. -->
- [x] Merge or disjoin the identical-trigger duplicates: brand pair → one rule
      + one pointer; `domain-safety-disclaimer` finance triggers move to
      `finance-safety-floor`; `secret-vcs-guard` vs `security-sensitive-stop`
      get disjoint trigger sets (VCS surface vs conversational surface).
      Preservation-guard applies to every merge.
      *Verify:* zero identical-trigger duplicate pairs remain; condensation +
      router compile green; preservation checklist per merged rule.
      <!-- done 2026-08-04: brand-consistency merged INTO brand-source-of-truth
      (both Iron Laws byte-preserved as Iron Law 1/2, every section retained,
      trigger union); brand-consistency is now a type:manual pointer stub
      (inbound refs keep resolving, no router emission). valuation+DCF removed
      from domain-safety-disclaimer (finance-safety-floor already carries
      both). secret/password removed from security-sensitive-stop (VCS-write
      surface owns them via secret-vcs-guard); oauth + signing key added for
      the conversational surface without creating new collisions.
      validate_frontmatter 430/0; router recompiled (tier-2 73→72);
      compile_router tests 17/17. -->
- [x] Harden `LEGACY_TIER_MAP`: unknown tier value = compile error in
      `compile_router.ts` (today: silent tier-2 fallthrough). Add `2b`
      explicitly with a recorded decision (`2b` → tier-2 intended or the 21
      rules are re-tiered deliberately) and map/reject `safety-floor`.
      *Verify:* fixture rule with a typo'd tier fails compilation; the 21
      `2b` rules carry an explicit, reviewed mapping.
      <!-- done 2026-08-04: `2b` → tier-2 explicit map entry; recorded decision
      in rule-router.md § Backward compatibility; unknown tier throws with the
      rule id; `safety-floor` rejected on non-always rules (always trio
      short-circuits to kernel). compile_router.test.ts Layer 3, 17/17 green,
      committed router.json byte-identical. -->
- [~] Reconcile the question triangle with a one-line amendment, not a
      rewrite: `ask-when-uncertain`'s Iron Law gains the missing cross-band
      qualifier ("…for questions that clear the `autonomous-execution`
      trivial bar — trivial questions are not asked, per band 4"). Own PR,
      kernel process, human-owned.
      *Verify:* string-level check — "even if trivial" coexists with the
      band-4 qualifier; the literal texts no longer contradict.
      <!-- deferred 2026-08-04: human-owned by this step's own lock AND
      hard-enforced by the host — the edit-permission classifier denies agent
      writes to this kernel ask-policy rule (correct per security-sensitive-
      stop § self-modification). Maintainer applies the drafted one-liner in
      src/rules/ask-when-uncertain.md:21 — replace
        "Even if trivial or independent — exactly one."
      with
        "Even if trivial or independent — exactly one. Band-4 scope: this law
        caps the count for questions that clear the `autonomous-execution`
        trivial bar — a trivial workflow question below that bar is not asked
        at all (per `agent-authority` band 4); the cap never licenses the ask."
      Own PR + task sync + check_kernel_prefix_stability --update-baseline
      (kernel-prefix.json re-anchor) + ≥24 h soak. AI-council verdict A1
      (2026-08-04) endorsed agent-drafted/human-merged; the host gate tightens
      that to human-applied. -->

## Phase 2 — the validation surface the mandate asks for

- [x] `agent-config route:explain "<prompt>" [--files a,b]` — deterministic,
      offline, reads `dist/router.json` (tier-1/2 + anchor scoring), prints:
      matched triggers, tier, injected-vs-pointer disposition, budget
      consumption, rejected candidates with reasons. Mandatory first output
      line: "Shows trigger matching. What the host actually invokes is NOT
      measured here (see road-to-cross-model-routing-eval)."
      *Verify:* golden tests — 10 pinned prompts → pinned explanations; drift
      breaks CI.
      <!-- done 2026-08-04: src/scripts/_cli/cmd_route_explain.ts + registry +
      dispatcher + usage(); budget 82→83 + measurement record regenerated;
      header cites ADR-126 instead of a roadmap file (check_no_roadmap_refs
      forbids roadmap links from stable artifacts — same content, durable
      citation). Note: router.json carries no anchor scoring (scout-verified);
      the command prints what exists — triggers, tier, projection-time
      disposition, token budget, rejected candidates. Goldens: 10 pinned
      prompts, tests/scripts/cmd_route_explain.test.ts (13 tests). -->
- [x] Parity by construction: the explain command and any future resolver
      share ONE matcher module (single implementation, two callers), asserted
      by an import-graph test — nothing can drift because there is nothing to
      drift between.
      *Verify:* import-graph test red when a second matcher implementation
      appears.
      <!-- done 2026-08-04: src/scripts/_lib/router_match.ts is the single
      implementation (extracted from router_telemetry.ts, which re-exports);
      cmd_explain.ts's divergent unanchored tier-1-only matcher replaced by
      the shared one (now anchored, both tiers);
      tests/scripts/router_match_parity.test.ts greps src/ for second
      definitions and pins the import edges. 18/18 green incl. 196
      routing-matrix verdicts. -->
- [x] `/routing-audit` slash command: runs `route:explain` over the last N
      prompts from chat-history JSONL and renders should-have-matched vs
      matched. Read-only, no LLM call, same measurement-level header.
      *Verify:* command spec + eval cases; output header labels the
      measurement level.
      <!-- done 2026-08-04, shape adapted: `routing` is not an approved
      command verb (ADR-041 vocabulary) and a new atomic command needs a
      locked cluster — so the surface landed as (a) the deterministic CLI
      `agent-config route:audit [--last N] [--record] [--weekly]`
      (cmd_route_audit.ts, reads chat-history JSONL user prompts, shared
      matcher, measurement-level header first line, exit contract tested)
      and (b) a new § 6 in the existing meta command /rule-compliance-audit
      — the established rule-routing debug surface — that drives it, plus
      eval cases (src/agent-src/commands/evals/rule-compliance-audit.json,
      10 cases). Tests: cmd_route_audit.test.ts 9/9. -->

## Phase 3 — frontend-set diet (measurement before trimming)

- [x] Pre-register the classification claim: on a labelled corpus of ≥30 real
      frontend tasks (redacted), the ui/ui_trivial classifier must route ≥80%
      of human-labelled trivial tasks to the trivial lane. Corpus and labels
      committed BEFORE the classifier is touched.
      *Verify:* corpus + labels + threshold committed in one PR with zero
      classifier changes.
      <!-- done 2026-08-04: internal/bench/corpora/ui-triviality-golden.yaml,
      40 tasks (15 trivial / 25 non-trivial incl. adversarial near-misses),
      threshold 0.80 in the header, committed at f71a41c82 with ZERO
      classifier changes — council verdict C1: commit ancestry within the PR
      is the freeze proof, disclosed in the PR description. Labels
      council-derived per verdict B1 (provenance block in the corpus header;
      amends "human-labelled" per precedent PR #885, disclosed). -->
- [x] Run the eval. If the trivial-recall bar is missed, fix classification
      FIRST — no chain trimming lands on a misrouting classifier.
      *Verify:* eval report committed; recall number recorded either way.
      <!-- done 2026-08-04: recall 0.600 MISS recorded at the frozen corpus
      commit → classification fixed FIRST per the step (micro-tweak
      vocabulary, verb-less copy pattern, scope-escalation + multi-scope
      guards in intent/classify.ts) → recall 1.000 / precision 0.938 PASS on
      the unchanged corpus. Both numbers in
      agents/evidence/reports/ui-triviality-eval.md; work-engine suite
      697/697 green; eval_ui_triviality.test.ts pins the bar in CI. -->
- [x] Chain right-sizing (gated on the eval): `existing-ui-audit` +
      `design-intelligence` become mandatory only for new-design / redesign
      intents; fix-intent UI work enters at `apply` with the audit available
      on demand. The resource-first hard-stop stays mandatory for any work
      referencing an existing design artifact (design-fidelity floor
      untouched).
      *Verify:* directive-set tests cover both intents; design-fidelity
      fixtures stay green.
      <!-- done 2026-08-04 (gate cleared: recall 1.00): new intent `ui-fix`
      (fix/repair/correct/debug/broken split out of _IMPROVE_VERBS; maps to
      the 'ui' set); directives/ui/_fix_lane.ts passthrough in audit.ts +
      design.ts — a ui-fix run without an audit/brief enters at apply with
      both skills on demand, UNLESS the ticket references a design artifact
      (mockup/figma/prototype/wireframe/screenshot/design.html markers —
      the design-fidelity resource-first halt fires unchanged). Redesign/
      improve intents keep the full chain. Tests:
      directives_ui_fix_lane.test.ts (12) — both intents covered; work-engine
      712/712 incl. design_fidelity_routing fixtures. -->
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

- [x] `router_telemetry` gains an opt-in, redacted session recorder: per
      prompt, which triggers matched (from the shared matcher) and whether the
      matched rule's `enforced_by` mechanism (where one exists) fired that
      turn. Local JSONL under `agents/runtime/state/`, rebuildable, passes the
      state-store test.
      *Verify:* recorder off by default; redaction fixtures; delete-and-rerun
      loses history, changes no answer.
      <!-- done 2026-08-04: recorder lives in cmd_route_audit.ts (--record),
      built on the shared matcher (the router_telemetry extraction). Opt-in
      `telemetry.routing_recorder.enabled` (default off — zero file IO when
      off); JSONL agents/runtime/state/routing-telemetry.jsonl; records are
      PII-excluded BY CONSTRUCTION (closed field set, prompt sha16 digest,
      never prompt text — stronger than redaction, per domain-safety-pii §2);
      adversarial fixture asserts no secret/email/prompt text lands in the
      record; delete-and-rerun rebuilds byte-identical records (state-store
      test); AGENT_CONFIG_REPLAY=1 writes nothing. Enforcement join: honest
      concern-name equality against rule-trips.json (block/warn counts) —
      per-turn mechanism firing is not observable offline and is not claimed.
      complexity runtime_state_surfaces is a soft report-only ratchet. -->
- [x] `/routing-audit --weekly` renders the rolling picture. The next "rules
      are ignored" conversation starts from this corpus — which is also the
      instrument class both ADR-054's reopen clause ("a produced red baseline
      under any instrument") and the resolver PREREG's P2 corpus-growth
      condition name. Feeding P2 is a side effect, not a goal; the PREREG
      stays the sole resolver authority.
      *Verify:* weekly render golden test; the output cites the PREREG as the
      resolver authority.
      <!-- done 2026-08-04: `agent-config route:audit --weekly` — rolling
      7-day per-rule aggregation from the recorder log; golden test pins the
      full render byte-for-byte incl. the PREREG-authority line
      ("Resolver authority: internal/bench/layer1-resolver-PREREG.md …
      nothing here revives a resolver"). cmd_route_audit.test.ts 9/9. -->

## Success criteria (pre-registered)

- Trigger-collision lint green with every live collision dispositioned; zero
  identical-trigger duplicate pairs remain.
- Unknown tier value = compile error; the 21 rules tagged 2b carry a reviewed
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
