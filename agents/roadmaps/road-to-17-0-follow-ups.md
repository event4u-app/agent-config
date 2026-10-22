---
complexity: lightweight
status: draft
estate_offset_exempt: "Tracks the 37 findings the AI council ruled FOLLOW-UP in the 17.0.0 self-review plus ten residue items the fix agents reported. rg -F for the 37 finding ids over agents/roadmaps returned no hits, so no active, later/ or stub roadmap owns them. Merging into road-to-hook-guards-that-hold-17-findings was rejected because that file holds the release-blocking findings and closes with the cut, so folding accepted-for-release work into it would keep the cut gate open on items the council ruled acceptable. Archiving or parking an unrelated roadmap to make room would be a disposition taken for the gate rather than for its work."
execution:
  mode: phase-checkpoints
---
# Road to the 17.0.0 follow-ups

> **Source:** the local self-review of the 17.0.0 release span and the AI
> council's accepted-risk round over its findings (2026-10-21/22). Every
> finding the council ruled **FOLLOW-UP** — acceptable for 17.0.0, but tracked —
> is one step below, keyed by its finding id, with the condition the council
> attached. Where the two seats split, the stricter reading was taken and is
> what the step asks for. The last items of each phase are residue the fix
> agents reported while closing the release-blocking findings; they carry no
> finding id. The release-blocking findings themselves live in
> `road-to-hook-guards-that-hold-17-findings` and are not repeated here.

## Goal

Every FOLLOW-UP finding of the 17.0.0 self-review is either fixed with a test or
recorded decision that shows the council's condition holds, or closed by an
explicit owner or council disposition — none is left as a sentence in the
release ledger. The residue items are closed the same way.

## Phase 1 — hook plumbing and hook guards

- [ ] **1.1 `894038a77728` — give `block-credential-reads` a measured latency
      budget.** `src/config/hook-latency-budget.json` registers the guard with a
      `null` budget. Denial correctness is unaffected, but the guard must carry a
      measured, tracked budget like every other `pre_tool_use` guard.
      verify: the budget row for `block-credential-reads` is a number taken from a
      recorded latency measurement, and the latency gate fails when it is removed.
- [ ] **1.2 `f27c22569567` — document and bound the PreToolUse crash-loop.**
      `src/scripts/_lib/claude_settings_hooks.ts` refuses every tool call on any
      dispatcher exit other than 0 or 2, and the escape from that state is
      undocumented. The fix changes hook plumbing, so it lands through a
      ratification round.
      verify: a test drives the dispatcher to exit 1 and sees the refusal name
      the repair path; the ratification artifact for the plumbing change exists.
- [ ] **1.3 `9783c5cdb462` — match handover prefixes as prefixes.**
      `src/scripts/_lib/ui_surface.ts` uses `includes` where the carrier declares
      path-prefix semantics. Align it to project-relative prefix matching.
      verify: a test where the declared prefix appears mid-path no longer fires,
      and one where it leads the project-relative path still fires.
- [ ] **1.4 `8074f67fd6ed` — backfill byte deltas in concern admissions.**
      `agents/decisions/concern-admissions.jsonl` leaves each concern's hook-bundle
      impact unquantified with about 6 KB of headroom left. CI enforces the
      ceiling; the audit trail needs the per-admission delta.
      verify: every admission row carries a bundle byte delta that sums to the
      measured bundle growth since the first row.
- [ ] **1.5 `7d816db40a7e` — state the egress chunk sidecar's limit
      accurately.** The integrity sidecar beside the engine chunk detects
      corruption but is not tamper-resistant
      (`tests/scripts/hooks/egress_engine_chunk.test.ts`). The tracked
      documentation must say so rather than imply tamper resistance.
      verify: the contract or docstring for the sidecar names corruption
      detection as its scope and tampering as out of scope.
- [ ] **1.6 Residue — verify live-host delivery of `update-notice`.** The concern
      is not in `src/scripts/hook_manifest.yaml`; it was removed on the
      authority-expansion refusal tracked as blocker
      `concerns-refused-as-authority-expansion` in
      `road-to-an-update-that-installs-itself-only-when-it-is-safe`, so delivery
      on a live host cannot be verified. Once it is registered, verify it.
      verify: a live-host probe transcript shows the `update-notice` concern
      firing on `session_start` from the installed manifest.
- [ ] **1.7 Residue — correct the stale dispatcher order in
      `docs/contracts/hook-architecture-v1.md`.** Around line 1110 the contract
      still says the hook command tries the project-local binary first, which has
      been false since #2573.
      verify: the section describes the staged-runtime-first order that the
      installer writes, and names project-local resolution only where it still
      applies.

## Phase 2 — council, review and billing

- [ ] **2.1 `f583fa0b084c` — unpredictable audit sampling before activation.**
      `src/scripts/_lib/depth_flip.ts` seeds audit sampling from a value the
      author controls and can predict. Dormant in shadow mode; unpredictable
      entropy is an explicit prerequisite for activation.
      verify: activation of depth-flip enforcement refuses while the seed is
      author-derived, shown by a test.
- [ ] **2.2 `36f191f7c2b2` — reconcile `SAFE_PATH_PATTERNS` with its
      rationale.** In `src/scripts/_lib/depth_flip.ts` roadmaps are listed as
      safe paths, which contradicts the module's own stated reason. Either exclude
      roadmap acceptance criteria or rewrite the rationale to the intended design.
      verify: the comment and the pattern list agree, and a test pins whichever
      behaviour was chosen.
- [ ] **2.3 `0238d86d3ff1` — record council dissent without a caller flag.**
      `src/scripts/analysis_validate.ts` checks council dissent only when the
      caller passes `--council-dissent`. Recording it properly needs a schema
      change.
      verify: an analysis with a recorded dissent fails validation when the
      dissent is dropped, with no flag passed.
- [ ] **2.4 `07b24f12480a` — re-wire billing-grant revocation at run end.** The
      revocation may have been lost with the deleted `run_continuation_hook.ts`.
      The 24 h TTL bounds the exposure; proper run-end wiring must follow.
      verify: a run that ends normally leaves no live billing grant, shown by a
      test that reads the grant store after run end.
- [ ] **2.5 `145947bbc6c2` — make the billing-cliff test exercise run end.**
      `tests/scripts/ai_council/billing_cliff_gate.test.ts` reflects today's
      state honestly but no longer drives the run-end path. Restore that once 2.4
      lands.
      verify: the test fails when the run-end revocation from 2.4 is removed.
- [ ] **2.6 `cd1ec8125782` — resolve the token-explainer rule/step conflict.**
      `agents/evidence/analysis/token-explainer-fidelity-2026-10-20.md` measured
      no benefit (20/20 in both arms) for a line the rule keeps. The cost is
      bounded; the contradiction between rule and step needs an owner decision.
      verify: a recorded owner decision exists and the rule and step agree with it.
- [ ] **2.7 `3c91b85b8d25` — treat an infinite `Retry-After` as binding.** The
      reference code in
      `agents/evidence/council/cold-start-steering-review-r9-20261020.question.md`
      treats `Infinity` as absent instead of parking. Reference-only today with no
      callers; any implementation taken from it must park.
      verify: wherever the parser is implemented, a test feeds an infinite
      `Retry-After` and sees the request parked.
- [ ] **2.8 Residue — record review head and base in review run files.** The
      17.0.0 review run files lacked head and base, so the merged ledger reads
      `range_source: asserted-reproduced`. The review must write both.
      verify: a fresh review run file names its head and base commits and the
      merged ledger reads a measured range source.
- [ ] **2.9 Residue — re-enable the CLI council analysts once reads are
      confined.** They stay disabled until the reads-confined probe shows a CLI
      seat cannot read outside the review scope
      (`src/scripts/analysis_analysts.ts`).
      verify: the reads-confined probe passes for each CLI seat and the analysts
      are enabled behind it.

## Phase 3 — install, upgrade and supply chain

- [ ] **3.1 `fab645fae47b` — pin the type-design toolchain's transitive
      dependencies.** `src/skills/type-design/references/toolchain.md` installs
      unpinned transitive dependencies at first run without required hashes. The
      primary pins and committed lock mitigate it; close the remainder.
      verify: the first-run install uses a lockfile with integrity hashes and
      refuses an unhashed resolution.
- [ ] **3.2 `703b5e844cd3` — drop the misleading shebang from the tokens
      bundle.** `src/skills/design-tokens/scripts/tokens.mjs` is generated with an
      executable shebang that does not match the supported invocation. Correct it
      in the build step, not by hand.
      verify: the generated bundle carries no shebang, or one matching the
      documented invocation, and the build test pins it.
- [ ] **3.3 `a82fa905940c` — tell an existing config it exceeds the new
      cap.** `src/server/schemas/settings.ts` now caps `subagents.max_parallel`
      at 64, which invalidates existing values above it. Add an install notice.
      verify: a settings file with `max_parallel: 100` produces a notice naming
      the key and the new cap on install.
- [ ] **3.4 `54124ff3302a` — align the stale Node-floor workflow comments.** The
      substantive floor in `CHANGELOG.md` is settled; workflow comments still
      name the old floor.
      verify: no workflow comment names a Node version below the floor stated in
      `package.json` engines.
- [ ] **3.5 `2cf54c4c8118` — heartbeat the skill lease before
      materialisation.** `src/scripts/_lib/skill_materialisation.ts` never
      refreshes the lease, so a live session's skill can be collected. No
      production caller exposes the race today; heartbeat support is a hard
      prerequisite for activating materialisation.
      verify: a test holds a lease past its TTL with a heartbeat and the collector
      leaves it alone; activation refuses without heartbeat support.
- [ ] **3.6 `9c1049f15f9e` — route the uncovered media adapters through
      egress.** Fourteen adapters, including `src/scripts/ai-video/adapters/fal.sh`,
      are bulk-marked `session-content uncovered` with no compensating control.
      verify: each adapter is either routed through the egress engine or carries
      a per-adapter reason, and the bulk marker is gone.
- [ ] **3.7 `0166efc59f80` — enforce the `egress-content: fixed-corpus`
      claim.** `src/scripts/second_brain_run.ts` asserts the marker, and nothing
      checks it. The claim is accurate today; a data-flow check across the
      mechanism must keep it so.
      verify: a check fails when a marked call site is fed session content.
- [ ] **3.8 `4802c8993227` — route the bench's credential mutation through the
      engine.** `internal/bench/egress-engine/run.ts` excludes generic-assignment
      rows from credential precision; the exclusion is documented, but the weak
      mutation should go through the engine.
      verify: the bench report's credential rows are produced by the engine's own
      detector, shown by a bench test.
- [ ] **3.9 Residue — pin a trust root before unattended upgrade.** Unattended
      upgrade stays blocked until a Fulcio trust root is pinned
      (`src/scripts/_cli/upgrade_unattended.ts`). The choice is the open blocker
      `dsse-trust-root` in
      `road-to-an-update-that-installs-itself-only-when-it-is-safe`; this step
      tracks the 17.0.0 consequence and does not decide it twice.
      verify: unattended upgrade runs only when the trust-root-pinned check
      passes, and a self-signed certificate is refused by a test.

## Phase 4 — gates and lints

- [ ] **4.1 `2f29280f40bf` — replace the date-only risk-register freshness
      gate.** `tests/scripts/lint_plan_risk_register.test.ts` passes a substantial
      change committed on the same day as its review stamp. A digest or a finer
      timestamp should replace the date comparison.
      verify: a test commits a change after a same-day stamp and the gate reds.
- [ ] **4.2 `0d0c49b6934c` — cap a skill's first landing in the body-budget
      ratchet.** A skill with no recorded ceiling is unbounded
      (`tests/scripts/check_skill_body_budget.test.ts`). Decide and enforce a
      first-landing cap.
      verify: a new skill above the chosen cap reds the ratchet in a test.
- [ ] **4.3 `6123246ba388` — stop counting trigger-less routed rules as
      exercised.** `src/scripts/check_token_quality_golden.ts` counts them as
      exercised by every golden task. An explicit `unconditional` schema field is
      the fix.
      verify: a routed rule without triggers and without the field is reported
      as unexercised.
- [ ] **4.4 `700860b8b627` — fail, or refresh, the expired host key lists.**
      `src/scripts/validate_frontmatter.ts` only warns after the 2027-01-14
      expiry, so the collision gate weakens silently. Track a refresh, or turn the
      warning into a failure after a grace period.
      verify: a test with a list past expiry and grace sees the gate red.
- [ ] **4.5 `281cb44fc5cd` — make probe evidence resolvable.**
      `src/config/skill-lifecycle-probes.json` cites evidence that is not a
      resolvable transcript pointer, because transcripts are machine-local by
      design. Commit redacted excerpts, or relax the schema for committed
      analysis.
      verify: every probe row's evidence resolves to a tracked file.
- [ ] **4.6 `9abb8add6010` — match witness rules by declaration.**
      `tests/scripts/lint_design_antipattern_parity.test.ts` accepts a witness
      when the rule name appears anywhere in its source. Tighten it to the
      declaration.
      verify: a witness that mentions the rule only in a comment fails the lint.
- [ ] **4.7 `484840da8e62` — diagnose a dead rule-inject carrier again before
      thinning.** `tests/scripts/rule_inject_hook.test.ts` was rewritten so a dead
      carrier is silent. Inert today; restoring the diagnosis is a prerequisite
      to enabling thinning.
      verify: the test sees a diagnostic for a dead carrier, and thinning refuses
      to enable while that diagnostic is absent.
- [ ] **4.8 Residue — stop the commit-subject blocklist flagging temp-dir
      subjects.** The whole-word blocklist in `src/scripts/lint_commit_subjects.ts`
      flags accurate subjects about temp directories (`tmp`, `temp`) with no
      override.
      verify: a subject describing a temp-directory fix passes, while a bare
      `tmp` placeholder subject still fails.

## Phase 5 — test hermeticity and coverage

- [ ] **5.1 `159380b3d1ff` — inject HOME and git state into the layer baseline
      test.** `tests/scripts/layer_baseline_report.test.ts` reads the real HOME
      and git state with a 5-minute timeout.
      verify: the test runs against a fixture HOME and commit, with the default
      timeout.
- [ ] **5.2 `35571c6d9522` — replace the wall-clock p95 assertion.**
      `tests/scripts/update_notice_hook.test.ts` asserts an unsupported wall-clock
      threshold; its policy and provenance need tracking.
      verify: the assertion is removed or bound to a recorded measurement and
      a stated policy.
- [ ] **5.3 `3932ad9717f1` — exercise the fork rung against real git.**
      `tests/scripts/self_repair_release.test.ts` stubs the fork-rung push as
      success.
      verify: the test pushes to a bare repository standing in as the fork remote.
- [ ] **5.4 `46ea603140ac` — accept a lock refusal in the reservation test.**
      `tests/scripts/ai_council/budget_guard.test.ts` can flake when the
      cross-process reservation is refused by the lock, which is a legitimate
      outcome.
      verify: the assertion accepts a lock refusal as a valid result and still
      fails on a double reservation.
- [ ] **5.5 `65114f0184cc` — prove the sealed-holdout loader never opens the
      file.** `tests/scripts/layer_form_corpus.test.ts` passes a loader that opens
      the file and swallows the error. An injectable reader seam lets it prove no
      attempt was made.
      verify: a loader that attempts the open fails the tripwire.
- [ ] **5.6 `c3d3e3260947` — explain the bundle start exit and prove no
      network.** `tests/scripts/skill_script_bundle.test.ts` accepts an
      unexplained non-zero exit and claims no network without asserting it.
      verify: the test asserts the specific exit code with its cause, and fails
      when the bundle opens a socket.
- [ ] **5.7 `c6e84084b90b` — give the replay tests history.**
      `tests/scripts/classify_merge_risk.test.ts` asserts nothing on a shallow
      clone. The CI workflow needs the fetch depth, or the test must skip loudly.
      verify: on a shallow clone the test reports a skip with a reason instead of
      passing silently.
- [ ] **5.8 `ccb6d42c50e5` — replace the run-time URL assembly.**
      `tests/scripts/source_shape.test.ts` builds a repo URL at run time to avoid
      the leak scanner; use an explicitly allowlisted fixture.
      verify: the fixture is a literal covered by the scanner's allowlist entry.
- [ ] **5.9 `ceaf1c346ed0` — cover URLs in the path normaliser.**
      `tests/scripts/installed_layer_normalise.test.ts` has no URL case, and the
      undercounting by design is undocumented.
      verify: a URL case exists and the undercount is stated in the normaliser's
      docstring.
- [ ] **5.10 `9dd88c0d56d3` — wire or remove `collectPaintedFamilies`.** In
      `src/cli/commands/uiRenderAssetFonts.ts` the new function has no caller,
      and the face-state findings may false-positive.
      verify: the function has a production caller with a unicode-range fixture,
      or it is removed.

## Phase 6 — consumer-facing docs and evidence

- [ ] **6.1 Residue — make shipped skills stop linking into `docs/`.** About 90
      shipped `SKILL.md` files link into `docs/`, which is not projected to a
      consumer, so the links are dead there. `lint_consumer_internal_refs` does
      not scan `SKILL.md`, and the `agent-config-maintainer`-only carve-out is a
      hole because scoped installs deploy that workspace.
      verify: the lint scans `SKILL.md`, the carve-out no longer exempts a
      workspace that scoped installs deploy, and it reports zero findings.
- [ ] **6.2 Residue — give consumers a runnable form of script invocations in
      contexts.** Contexts tell the reader to run scripts that have no
      `agent-config` verb, so a consumer cannot run them.
      verify: every script invocation in a shipped context either names an
      `agent-config` verb or is marked maintainer-only.
- [ ] **6.3 Residue — re-run the setup-layer baseline report redacted.**
      `agents/evidence/analysis/setup-layer-baseline.md` still holds unredacted
      hook lines.
      verify: the re-run report holds no absolute home path and no unredacted
      hook command line.
- [ ] **6.4 Residue — retire "zero runtime" from the docs site.**
      `site/astro.config.mjs`, `site/src/content/docs/index.mdx`,
      `site/src/content/docs/getting-started/introduction.md` and
      `site/src/content/docs/architecture/overview.md` still say "zero runtime",
      and `check_claims` does not scan `site/`.
      verify: the claims gate scans `site/`, and the phrase appears there zero times.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Accepted risk read as closed | product | A FOLLOW-UP ruling reads like a resolution, so steps here are left open indefinitely while the ledger looks dispositioned | Each step names its finding id, so the ledger and this file can be joined; a step closes only on its own check | Phase 2 — council, review and billing |
| 2 | A prerequisite becomes a silent activation | implementation | Several steps (2.1, 3.5, 4.7) are prerequisites for activating a dormant mechanism; activation could land first | Each such step's check includes a refusal to activate while the prerequisite is missing | Phase 3 — install, upgrade and supply chain |
| 3 | Plumbing steps stall on ratification | implementation | Steps touching hook plumbing need a two-seat round, and a seat being down has held such work before | Run the ratification as the step's first act and record a degraded round rather than waiting | Phase 1 — hook plumbing and hook guards |

## Acceptance Criteria

- [ ] AC-1 — Each of the 37 FOLLOW-UP finding ids from the 17.0.0 self-review
      maps to a closed step here whose check passed, or to a recorded owner or
      council disposition.
- [ ] AC-2 — No dormant mechanism named in Phases 2–4 can be activated while its
      stated prerequisite is missing.
- [ ] AC-3 — Shipped skills, contexts and the docs site carry no dead
      maintainer-only reference and no retired claim, and a gate scans each.
