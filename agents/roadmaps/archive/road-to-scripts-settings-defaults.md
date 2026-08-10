---
complexity: lightweight
status: ready
parent_roadmap: road-to-zero-ceremony-settings
---

# Road to scripts settings defaults — give the SCRIPTS read path the defaults layer the server already has

> **Source:** the one genuine `[~]` deferral in
> [`archive/road-to-zero-ceremony-settings.md`](archive/road-to-zero-ceremony-settings.md)
> (Phase 3, "Effective-value resolution"), disposed 2026-08-09 with maintainer
> approval via the Iron-Law-3 resolution menu — the cancel-with-successor path
> the 2026-08-07 AI council recommended for exactly this moment ("whoever
> closes Phase 3 must dispose of this item in the same change").

## Context

The sparse-user-file design rests on "absent means default in both directions" —
and only the SERVER settings family actually delivers that: it resolves absent
keys from the template defaults layer, pinned by
`tests/server/schemas/parity.test.ts`. The SCRIPTS family
(`load_agent_settings`) has **no defaults layer at all** — `_DEFAULTS` is `{}`,
and the tree is sparse-tolerant only because every consumer supplies its own
fallback at the read site. That is not the same guarantee: a consumer that
forgets its fallback breaks on a sparse file, and nothing pins that the
fallbacks which do exist agree with the template default. (The nine documented
absent-≠-default keys are NOT scripts-family evidence — they belong to the
wizard-materialised file's own readers, the server/installer family, and are
already carved out there; the parent roadmap proves the scripts family never
read that file. The scripts-family divergences are unaudited — auditing them
is exactly Phase 1.)

Why this is its own roadmap rather than a step in the parent: giving the
scripts family a template-defaults layer means touching `load_agent_settings`,
whose precedence is the **inverse** of the server's and whose user-global layer
is whitelist-filtered through `MERGEABLE_KEYS` under an ADR. That is the
filename/precedence convergence — a different change class from the parent's
first-run scope.

## Goal

A key absent from every settings layer resolves to the template default on the
scripts read path exactly as it does on the server read path — without changing
the resolved value of any key that is present today, and without weakening the
`MERGEABLE_KEYS` whitelist or its ADR.

## Phase 1 — Map the divergence before touching it

- [x] Inventory the two read paths side by side: `load_agent_settings`
  (scripts) vs the server resolver — layer order, `MERGEABLE_KEYS` filtering,
  and the governing ADR. Emit the comparison as an Evidence Report in
  `agents/evidence/analysis/` (per `source-discovery-gate`) so the convergence
  decision is made on cited lines, not memory.
  <!-- done 2026-08-10: agents/evidence/analysis/scripts-vs-server-settings-read-paths.md § 1 —
  scripts `_DEFAULTS = {}` (agent_settings.ts:289) vs the template-as-base server
  family pinned by tests/server/schemas/parity.test.ts; layer order, MERGEABLE_KEYS
  (:255-287, ADR-219), and the already-existing-but-display-only templateDefault()
  seam at cmd_settings_get.ts:129 all cited at line level. -->
- [x] Enumerate every scripts-family read site with its own fallback; classify
  which fallbacks agree with the template default and which silently diverge
  (those are the live defects this roadmap exists to catch — the scripts-family
  divergence set is unaudited; the nine keys the parent documented belong to
  the server/installer family and are only the shape to look for, not the list).
  <!-- done 2026-08-10: § 2 of the Evidence Report — 167 reads across 28 files;
  48 AGREE, 102 NO-TEMPLATE-KEY, 9 NO-FALLBACK, 8 DIVERGE rows over 5 distinct keys
  (projection.mode, projection.rule_workspaces, chat_history.enabled,
  chat_history.frequency, rule_loading_tier). FOUR of the five ARE carve-out rows
  already — so a naive layer would break the documented upgrade contract, and the
  layer must exclude the carve-out set plus every placeholder-valued leaf. § 3
  records the 47-file bypass reader class (readFileSync without the loader) this
  change cannot reach, including three carve-out readers.
  Context correction: this step's own parenthetical claimed the documented
  absent-≠-default keys are NOT scripts-family evidence. Measured, four of them
  are exactly the scripts-family divergences; the claim held only for the three
  that live in the bypass class. -->

## Phase 2 — The defaults layer, behind the existing read path

- [x] Give `load_agent_settings` a template-defaults resolution layer so every
  consumer stays oblivious — same contract the server half already honours.
  Precedence and `MERGEABLE_KEYS` filtering stay exactly as the ADR fixes
  them; the defaults layer sits below every real layer, never above one.
  *Verify:* a parity-style test pinning that an absent key resolves to the
  template default on BOTH families, and that every key present in a populated
  file resolves to the same value before and after the change.
  <!-- done 2026-08-10: template_defaults() in src/scripts/_lib/agent_settings.ts —
  reads src/config/agent-settings.template.yml (shipped via package.json files[]),
  prunes the carve-out set + every placeholder-valued leaf, memoised, and sits as
  the BASE below user-global and the project cascade. New tests/lib/settings_defaults_layer.test.ts
  (11) pins absent→default, the whole-layer claim, both exclusions, precedence in
  both directions, the tolerance path, and no-change-for-present-keys.
  Mutation-checked: removing the carve-out exclusion, removing the placeholder
  exclusion, or moving the layer above user-global each reds exactly one test.
  A `template_path` caller override was added (same contract as project_path /
  user_global_path) so the 19 exact-equality cascade tests keep asserting the union
  of the FILES rather than restating the template.
  DEFECT FOUND AND FIXED BY THE SUITE: the first draft returned _deep_copy_defaults(),
  which is _deep_merge onto {} and therefore shares every sub-tree by reference —
  the cascade then wrote through into the cache and the FIRST settings file read in
  a process became the defaults every later read saw (caught by
  command_suggester "partial keeps defaults"). Now a full _deepcopy, with a
  regression test that mutates a nested leaf and an array element. -->
- [x] Retire read-site fallbacks that merely restate the template default;
  keep (and comment) the ones that intentionally diverge, each with the reason
  — a silent divergence is the defect, an explained one is a decision.
  *Verify:* the Phase-1 classification table has zero unexplained divergences
  left; the full test suite stays green.
  <!-- done 2026-08-10, differentiated on evidence rather than wholesale (§ 5 of the
  Evidence Report). Inspected, the 48 AGREE fallbacks are NOT redundant: every one is
  a type/enum guard with an embedded default (_coerce_bool, _deep_default_merge, an
  enum whitelist), several also cover a read error or a non-dict block, and several
  receive a dict that did not come from load_agent_settings at all. Retiring them
  would delete input validation — Risk 4 of this roadmap's own register. They stay;
  their ROLE changes (guard, no longer source), and that is recorded.
  Retired: `_DEFAULTS`, the empty defaults slot this roadmap is named after — a
  second, misleading answer to the question the template now answers.
  Explained: rule_loading_tier at _cli/explain_last/inputs.ts:127, the only DIVERGE
  row without a settingsCarveOut entry, now carries the reason inline including the
  honest note that a literal placeholder in a settings file still reports as a
  healthy `source: default`. Zero UNEXPLAINED divergences remain — which was the
  exit condition; zero divergences never was. -->
  <!-- scope note: § 3 of the Evidence Report records a second reader class this
  change cannot reach — 47 files that read .agent-settings.yml directly with
  readFileSync, never through the loader, including three of the eight carve-out
  readers (quality.local_auto_run, onboarding.onboarded, profile.id). The Goal
  sentence is met for the cascade class only. Named, not absorbed. -->
  <!-- test-suite evidence: full run 12655 passed / 34 failed in 7 files, all
  accounted for — 4 files (cli-e2e, mcp-server.e2e, settings.e2e, ui/build) assert
  on dist/cli/, gitignored build output absent in a fresh worktree by construction
  and built by CI before these run; council_cli + reach_doctor are the pre-existing
  environment reds measured on the untouched baseline (reach_doctor:769 is the
  documented depth-≥8 artefact); check_artefact_count_messaging is a 10 s timeout
  under parallel load and passes alone. Zero reds attributable to this diff. -->


## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-09 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Silent behaviour change on existing installs | implementation | A read-site fallback that disagrees with the template default answers differently once the defaults layer exists below it — the consumer sees a new value with no code change of its own. | Phase 1 classifies every fallback as agree/diverge BEFORE the layer lands; the Phase-2 test pins that every key present in a populated file resolves identically before and after. | Phase 1 — Map the divergence |
| 2 | Defaults layer wired at the wrong precedence end | implementation | `load_agent_settings` precedence is the inverse of the server's; a layer inserted at the wrong end silently outranks a real user layer instead of sitting below everything. | The Evidence Report maps both chains side by side before any edit; the parity-style test asserts a populated layer always beats the default on both families. | Phase 2 — The defaults layer |
| 3 | `MERGEABLE_KEYS` whitelist weakened as a side effect | implementation | The whitelist and its ADR are exactly the kind of constraint a convergence change finds inconvenient; loosening it in passing would be a recorded-failure-class gate weakening. | Acceptance criterion pins untouched-or-own-recorded-decision; any change there is a separate ADR, never a hunk in this diff. | Acceptance criteria |
| 4 | A deliberate divergence retired as if it were drift | product | Some read-site fallbacks may intentionally differ from the template default; deleting them uniformly converts a decision into a regression. | Phase 2 keeps intentional divergences with an inline reason; the exit condition is zero UNEXPLAINED divergences, not zero divergences. | Phase 2 — The defaults layer |

## Acceptance criteria

- An absent key resolves identically on the scripts and server read paths,
  pinned by tests on both families.
- No key that is present in a populated settings file changes its resolved
  value — zero behaviour change for existing installs, pinned in the same
  change.
- `MERGEABLE_KEYS` and its ADR are untouched, or any change to them is its own
  recorded decision rather than a side effect here.
- All quality gates pass — see `quality-tools`.
