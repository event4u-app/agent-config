---
complexity: lightweight
status: ready
---

# Road to dead-surface removal — apply the package's own null rule to the package's own code

> Every 9.9.0 and 9.10.0 review converges on one sentence: *null results must
> produce physical removal, not just a disabled flag.* Three surfaces currently
> fail that rule inside this repository. Council cut:
> [`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md).

## Goal

Delete three dead or half-removed surfaces. No new mechanism, no new gate, no
replacement. Every phase is a deletion whose success criterion is that something
is smaller afterwards.

## Context (verified 2026-08-01, do not relitigate)

- **Code-intelligence engine:** permanently `enabled: false` (measured recall
  0.365 vs grep 0.797 — −43.2 pp against a +10 pp threshold), deprecation recorded
  for the next major, removal after. Yet `web-tree-sitter` (0.24.7) and
  `tree-sitter-wasms` (0.1.13) **still ship as core dependencies today**, so every
  consumer installs a parser stack for an engine that cannot run.
- **`intent:` trigger:** present in the schema, declared by rule authors, and
  documented in `router_telemetry.ts` as *"informational only — never
  auto-matches."* It does nothing at runtime and no planned mechanism would change
  that. Its only effect is giving rule authors false confidence that an activation
  path exists.
- **Per-pack `version:`:** **28** pack manifests still carry a `version:` line —
  12 under `src/domains/*/pack.yaml` and 16 under `src/packs/*/pack.yaml`. The
  release-time lockstep bump was reported as fixed for the *release PR's own
  diff*, but the duplicated field it bumped was never removed, and the bump still
  happens upstream of the release cut: the 9.11.x fan-out merged into this branch
  on 2026-08-01 touched all 16 `src/packs` manifests plus their READMEs in
  lockstep. Half a fix, and the half that remains is still firing.

> **Scope boundary.** This roadmap removes; it does not redesign. The engine's
> re-open condition stays exactly as recorded (a consumer case the graph answers
> and grep cannot). Removing `intent:` is not a decision about activation
> architecture — that question is owned by
> [`road-to-activation-evidence-or-refusal`](road-to-activation-evidence-or-refusal.md),
> which independently refuses to *implement* the trigger.

## Phase 1 — Code-intelligence engine out of core

- [x] Move `web-tree-sitter` and `tree-sitter-wasms` out of `dependencies`.
      Engine, CLI leaves, cache, twin, and the routing skill go to an optional
      package/plugin per the classification already recorded for it.
      *Verify:* a fresh consumer install resolves neither parser package; the
      install-payload delta is measured and stated in the PR body. **Pin the ABI
      pair (`web-tree-sitter@0.24.7` / `tree-sitter-wasms@0.1.13`) in the optional
      package** — this pair is version-coupled and has a known teardown trap.
      <!-- council 2026-08-02 (sonnet-4-5 + gpt-4o, 2 rounds): NOT
      optionalDependencies (npm installs those by default, so the criterion
      would fail) and NOT a second published package (prohibitive for one
      maintainer). Landed as `devDependencies` — npm does not install those for
      consumers, so the criterion holds while the engine's own 49 tests keep
      running in CI. The council's mechanism D (no entry at all) would have
      silently deleted that coverage; CI caught it and this is the amendment.
      Scope narrowed in R2 to the deps only:
      removing the CLI leaf / nudge hook / skill / rule now would ship a
      breaking change in a minor and retroactively void the MIGRATION.md
      deprecation window, which promises removal "the major after next". The
      ABI pin moved to loader.ts's install hint + CREDITS + the settings key,
      since check_dependency_floors scans only `dependencies`. Measured delta:
      ~51 MB unpacked (50.6 MB of it tree-sitter-wasms). -->
- [x] Keep the disabled-by-default settings key and the recorded re-open condition
      intact; the flag is not what is being deleted.
      *Verify:* the template still carries the key with its permanent `false`,
      and the deprecation note points at the optional package.
- [x] Confirm nothing in the always-loaded surface still routes to the engine.
      *Verify:* grep for the engine's skill id and CLI leaf names returns only
      the optional package and the deprecation note.
      <!-- verified: zero `always`-type rules reference the engine; the routing
      rule is type auto / tier 2a; not in kernel-membership. -->

> **Deviation from the phase text, recorded.** The phase says engine + CLI +
> cache + twin + skill move to an optional package. The council refused that
> scope for this change (semver + deprecation-window breakage) and refused a
> second published package outright. What ships: the dependency removal, which
> is what the phase's own *Verify* criterion measures. The runtime paths are
> already scheduled for removal in `docs/MIGRATION.md`; that schedule is the
> mechanism, and this change does not accelerate it.

## Phase 2 — Remove the `intent:` trigger type

- [x] Delete `intent:` from the trigger schema and from every rule that declares
      it; the surrounding prose keeps whatever the rule actually needed to say.
      *Verify:* schema validation fails on an `intent:` trigger; a repo-wide grep
      for the trigger key in rule frontmatter returns zero.
      <!-- 106 declarations across 44 rules removed; grep returns 0. Reintroducing
      one fails validate_frontmatter: "Unknown property 'intent' not allowed"
      (additionalProperties:false). 3 intents on think-before-action became
      `phrase:` — each is a literal substring of the coverage-corpus prompt. -->
- [x] Update the offline tooling that counted `intent` separately, and the router
      contract's trigger-type table.
      *Verify:* `trigger_coverage` and the router contract no longer document a
      trigger type that does not exist; both stay green.
      <!-- trigger_coverage 26/26 · golden set 110 tasks / 106 rules complete ·
      check-router green · validate_frontmatter 429/0 · lint-skills 429 pass.
      trigger_coverage never implemented `phrase` — it now does, replacing the
      looser word-set proxy `intent` provided. audit_auto_rules' `intents`
      bucket became `phrases` (it never counted phrases, so trigger_count was
      undercounting); audit_overlap + audit_likelihood follow. -->
- [x] State the removal in the contract in one line, so a future author does not
      reintroduce it as a "missing" feature.
      *Verify:* the line names why (never auto-matched at runtime, gave authors
      false confidence).
      <!-- rule-router.md § "Intent-trigger semantics — superseded by removal
      (2026-08-02)" replaces the locked two-gate section, and the triggers block
      says so inline. The dangling docs/contracts/router-intents.md citation
      (never written) is retired with it. -->

> **Council note (2026-08-02, sonnet-4-5 + gpt-4o, 2 rounds — SPLIT).** Both
> members agreed the "dead schema" premise was incomplete: `intent` was dead in
> `router_telemetry` but **live** in `trigger_coverage`, the falsifiability
> floor. Sonnet argued for narrowing the removal to runtime-only and keeping
> `intent` as a CI-only matcher; gpt-4o argued for full removal with real
> triggers. The split was resolved by measurement, not by picking a side:
> stripping every intent trigger from the router left **25 of 26** coverage
> cases passing on `keyword` alone, so the floor does not collapse. The one
> failure and six golden-set failures were repaired with triggers that are
> **verified literal substrings of the corpus prompts** (`long conversation`,
> `fetching logs`, `autonomy mode`, `reporting progress`, `status comment`) —
> Sonnet's actual objection was to inventing phrasings nobody types, which this
> avoids. The decorative-emoji rule got its own universal blacklist as keywords:
> the exact characters it exists to forbid, not a phrasing tailored to a test.

## Phase 3 — Per-pack `version:` removal

- [x] Remove the `version:` field from all 28 pack manifests — both
      `src/domains/*/pack.yaml` (12) and `src/packs/*/pack.yaml` (16); the package
      version is the single version. Check the pack READMEs that are bumped in the
      same lockstep for a rendered version string with the same problem.
      *Verify:* pack schema validation passes without the field, any consumer of
      it reads the package version instead, and a release cut touches zero
      `pack.yaml` files.
- [x] Confirm the field cannot come back silently.
      *Verify:* the pack schema rejects `version:` rather than ignoring it.

## Non-goals (recorded refusals)

- **No engine deletion.** The re-open condition stands; extraction is what the
  recorded disposition asks for.
- **No `intent:` implementation.** Removal is the decision; token-overlap matching
  would be a fourth activation instrument in a family that has produced three
  consecutive nulls.
- **No per-pack independent versioning.** The question "individually versioned or
  not" is answered here as *not* — the removal is the answer, not a deferral.

## Surface delta

**−2 core dependencies, −1 schema trigger type, −28 duplicated version fields,
−1 dead fallback path.** Zero additions. This is the only roadmap in this batch
whose delta is unconditionally negative.

## Provenance

Sources: `agents/tmp.old/feedback-9.9.0-1.txt`,
`agents/tmp.old/feedback-9.10.0-1.txt`, `agents/tmp.old/feedback-9.9.0-2.txt`,
`agents/tmp.old/skill-rule-routing.txt` (all operator-owned). Disposition: council
2026-08-01 (`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`, 2 rounds) —
[`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md). All
three surfaces were confirmed still present in the working tree on 2026-08-01.
