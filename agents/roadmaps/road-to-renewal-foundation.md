---
complexity: structural
status: ready
parent: road-to-package-renewal.md
---

# Road to renewal — Foundation (CI oracle, dead tree, token quick wins)

> Sub-roadmap of [`road-to-package-renewal.md`](road-to-package-renewal.md).
> Council-locked ordering: Phase 1 gates every other renewal track — a broken
> validator cannot validate its own fix. Evidence base + locks honored live in
> the central roadmap; do not restate or relitigate here.

## Phase 1 — CI becomes a trustworthy oracle

- [x] Dead-root gate sweep: enumerated all 24 gate scripts carrying the literal
      and classified each — **5 were DEAD-EXECUTABLE**, the rest are intentional
      denylists (`check_no_new_legacy_path`, `check_public_catalog_links`,
      `check_condensed_paths`, `check_source_pointer_freshness`,
      `lint_load_context`), defensive fallbacks that already guard existence, or
      comment-only. All 5 repaired and each verified green afterwards:
      1. **`check_always_budget`** — the worst. `load_context` entries are
         relative to the declaring file (`../contexts/...`); the resolver joined
         them to the REPO ROOT, so every context failed `existsSync` and the
         walker silently skipped it. The whole transitive-context dimension
         counted ZERO while the gate printed a confident `60.1%`. Repaired →
         the real number is **60,254 chars, 123% of the 49,000 cap**. See the
         two-budget split below.
      2. **`check_portability`** — `SCAN_DIRS` still named the retired root, so
         the entire `src/` authoring tree was skipped; an identifier was caught
         only after a condense run projected it. Revealed 8 violations, all in
         `src/templates/` (never projected into `dist/`, so never scanned).
         All 8 are the package's OWN published identifiers — the marketplace
         install command and a real shipped anchor filename — allowlisted with
         that reason, not "fixed"
      3. **`check_references`** — `src/` was absent from every candidate list,
         so a reference resolvable only under the source of truth was reported
         BROKEN
      4. **`lint_framework_leakage`** — the inventory-README exemption compared
         against a retired root AND against `'dist/agent-src'` as a single
         path segment, which a `/`-split can never yield; it fired for no file
      5. **`lint_agents_md`** — dead fallback candidates; harmless only while
         `dist/agent-src/` happens to be materialised
      Ratchet: `check_no_new_legacy_path:hardcoded-scan-roots` lowered 56 → 51
- [x] **Two-budget split for `check_always_budget`** (council 2026-08-02,
      option B, 2/2 — added as scope by the repair above): `TOTAL_CAP` now
      governs the **raw** dimension it was actually calibrated for
      (29,466/49,000 = 60.1%, green); the **extended** dimension gets its own
      hard-gated cap seeded at the first real measurement (60,254) plus reseeded
      per-rule and top-3 ratchets. The seed is a baseline of revealed debt, not
      an approval, and moves DOWN only — Phase 2's token work pays it down.
      Rejected: raising `TOTAL_CAP` to swallow it (silently doubles the kernel
      budget and removes exactly the pressure Phase 2 applies). Deferred: the
      lazy-vs-eager `load_context` split — real, but narrowing an aggregate on a
      semantic argument is a separate decision from repairing its measurement.
      Verified the ratchet bites: +107 chars into a lazily-loaded context flips
      it red, growth that was previously invisible
- [x] Make an empty scan set exit RED — delivered via the **stronger existing
      mechanism** rather than by retrofitting `assertScanned` into ~200 gates.
      PR #1108 already shipped `check_gate_coverage` + `src/config/gate-coverage.yml`:
      each listed gate emits a machine-readable `scanned: <N>`, is invoked
      CI-identically, and is asserted against a **floor** — which strictly
      dominates `assertScanned`, since that can only tell 0 from 1 while a floor
      also catches the 1,566 → 3 collapse a `> 0` check reports as healthy.
      The gap was coverage of the manifest, not the mechanism: it listed 8 gates
      and none of the 5 repaired above. Added `check_portability` (floor 1,200 /
      1,566 measured), `check_references` (800 / 1,043) and
      `lint_framework_leakage` (350 / 431), each emitting a `scanned:` line —
      census now 8 → 11 enforced, all green. Note recorded in the manifest that
      `lint_framework_leakage`'s human summary counts files WITH HITS (0 on a
      clean run), which is exactly how a blind gate looks healthy
- [x] Add CI ban on new `.agent-src.uncondensed` references — **already shipped**
      by PR #1108 as `check_no_new_legacy_path` + the
      `check_no_new_legacy_path:hardcoded-scan-roots` ratchet in
      `src/config/gate-violation-baselines.json`; it runs in `ci` via `preflight`
      (and now in `ci-strict` too, which previously skipped `preflight`
      entirely). Verified live: it caught this run's own explanatory comments as
      new references and was only satisfied after they were reworded. Baseline
      lowered 56 → 51 by this phase's sweep, per its own "every repair is a
      lowering commit" contract
- [x] Deduplicate `ci` / `ci-strict` into ONE shared gate list with a strict
      flag — done via **delegation** (council 2026-08-02 decision A1, 2/2):
      `ci-strict` is now `- task: ci` + 4 strict-only entries, so the superset
      property is tautological rather than asserted. 205 duplicated lines
      deleted. Confirmed the 6 missing gates exactly: `preflight` (fans out to
      11 scripts incl. `check_no_new_legacy_path`, `check_kernel_rule_bundle`),
      `check-ci-local-parity`, `check-gitignore-freshness`,
      `check-generator-output-coverage`, `check-tracked-but-ignored`,
      `check-generated-artefact-headers` — ~16 concrete script runs the
      "release-tag gate" did not prove. New gate
      `check_ci_strict_superset` (wired into `ci`, therefore into `ci-strict`)
      asserts the single invariant; verified red (exit 1) on a mutated
      delegation and green (exit 0) restored.
      Two adjacent findings fixed in the same change: (1)
      `check_ci_local_parity` was RED on trunk — `check_evaluator_budgets` and
      `resolve_lint_scope` ran in CI reachable from no local chain; both now
      declared under `ci_only:` with reasons (gate now green: 233 CI / 212
      local / 22 declared CI-only). (2) `task ci-fast` does not exist —
      `taskfiles/ci-fast.yml` is `flatten: true`, so no aggregate is created,
      yet the tier comment and `check_enforcement_coverage.ts:52` both name it;
      recorded as a named finding in the Taskfile, not silently invented
- [x] Reconcile the required-check matrix, split by surface: ✅ (a) doc-shrink —
      `branch-protection-policy.md` rewritten against live state; ⏸️ (b) enforce
      — maintainer-gated, tracked in `### blocker: required-check-enforcement`.
      Findings: enforcement is a **ruleset** (`main protection`, id `17749383`),
      NOT classic branch protection — `GET /branches/main/protection` returns
      404, so this step's original `gh api -X PUT .../branches/main/protection`
      command was aimed at the wrong endpoint. Live: **one** required check
      (`Sync + Generate Tools Consistency`) vs 19 documented. The doc's
      `python2ts` addendum named three workflows that are all deleted.
      `task ci:required-checks` DOES exist (`taskfiles/ci-fast.yml:204` — an
      earlier root-only grep of `Taskfile.yml` missed it, corrected on
      verification), but it is a pure offline preview, never a gate, and its
      own check-name lists had drifted to the same fiction — including a
      `Tests / python-tests` entry that cannot exist post-migration, pinned
      byte-for-byte by its snapshot test. Doc, script and test were reconciled
      together against `gh pr checks 1108`; the preview now marks with `!` the
      single check that actually blocks a merge.
      Disposition per council 2026-08-02 (C1, 2/2)
- [-] Record the current local `task ci` wall-clock on the reference machine
      into this file BEFORE the umbrella spike starts <!-- skipped: quality.local_auto_run=false → remote CI is the gate; council 2026-08-02 decision B3 (2/2) additionally rejects a local full-pipeline number AS a baseline — the same environment whose false-red history motivated the policy cannot produce a trustworthy reference, and remote CI runs different hardware/parallelism so it can never validate one. The dependent target is retargeted in the next step instead of being left unfalsifiable. -->
- [x] Umbrella gate runner spike: run N gates in-process (worker pool) instead
      of ~200 sequential tsx cold-starts.
      **Pre-registered target (revised 2026-08-02 per council B3, BEFORE any
      measurement — replaces the unfalsifiable "local `task ci` under 5 min"):**
      on a fixed sample of N=20 gate scripts (10 fastest, 10 slowest by
      single-run wall-clock), the in-process runner cuts total wall-clock by
      **≥30%** versus the same 20 gates run as sequential `tsx` subprocesses,
      measured on the same machine in the same session, both numbers recorded
      inline here. Abort criterion: if the import-safety audit finds >25% of
      the sample cannot be imported without side effects, record NO-GO with
      the count instead of forcing decomposition inside this PR.
      Constraint: in-process execution requires every pooled gate script to be
      importable without top-level CLI-guard side effects (`process.exit` at
      import — the documented bundled-CLI-entry-guard/esbuild landmine class);
      the spike scope INCLUDES an import-safety audit of the gate scripts —
      this is where the monolith-script finding re-enters if decomposition
      proves necessary <!-- carve-out: new-gate-verification -->
      ---
      **RESULT — import-safety GO, timing arm LOSS. Measured 2026-08-02.**
      *Import-safety audit (the abort gate): PASS.* 200 gate scripts
      (`src/scripts/{lint_,check_}*.ts`); **194 safe to import**, **6 unsafe**
      (unconditional top-level `main()`/`process.exit`) = **3.0%**, far under
      the >25% abort criterion. The six: `check_release_adjacent_health`,
      `lint_design_quality`, `lint_eval_fixture_citations`, `lint_glama_drift`,
      `lint_output_slop`, `lint_ui_stack_bundles`. 175/200 export `main`.
      *Timing arm: LOSS against the pre-registered ≥30%.* Sample = 10 fastest +
      10 slowest of the 188 gates that run without args (12 need args and were
      excluded, named in the spike log). Sequential subprocess baseline: 85,570 /
      81,086 / 77,316 ms → **median 81,086 ms**. In-process: 110,947 / 102,581 ms
      → **−26.5% (slower)** on the best run. All 20/20 gates really executed in
      both arms; nothing was dropped to flatter the number.
      **Why it lost, and the part that is worth more than the verdict:** the
      target was *structurally unreachable on this sample* and the
      pre-registration is what exposed that. Empirical cold-start floor is
      ~342 ms/gate, so 20 gates × 342 ms = ~6.8 s = **8.4%** of an 81 s baseline —
      no amount of cold-start elimination could reach 30% here, because the
      sample deliberately includes the 10 SLOWEST gates. The hypothesis "most of
      `task ci` is tsx cold-start" is **false for the slow half and true for the
      fast half**: the 18-gate subset excluding the two regressions ran
      30,360 → 22,559 ms = **−25.7%**.
      Two gates regressed hard, and the harness is a confound on both:
      `check_backstop_debt` 5,789 → 10,599 ms (it *spawns* other gates as
      subprocesses, so in-process nesting is pathological for it) and
      `check_enforcement_coverage` 33,794 → 69,423 ms. Diagnostic: that gate is
      36.4 s as a direct tsx entry, 69.8–72.8 s via `import()` from a tsx
      harness, but **35.3 s inside a `worker_threads` Worker** — so a real
      worker-pool runner would not carry the penalty. The measured number is a
      FLOOR on the in-process arm, not its ceiling; a pooled arm was not measured.
      Also: 2 of 20 exit codes diverged in-process, so the arm is not yet
      semantically equivalent — a correctness blocker before any adoption.
      **The actionable finding is elsewhere:** one gate,
      `check_enforcement_coverage`, is **33.8 s of the 151.1 s** it takes to run
      all 200 gates once — **22% of the entire suite in a single script**. That
      is where `task ci` wall-clock actually lives, and it is a targeted fix, not
      an architecture change. Recorded here as the successor lead; NOT pursued in
      this PR (out of this step's scope, and the pre-registered target must not
      be retro-fitted to whatever the data happened to support)
- [-] Share the build artifact across CI jobs <!-- declined 2026-08-02: premise falsified by measurement, not skipped for cost -->
      **Declined — the step's premise does not survive measurement.** Numbers
      taken this session, both local and from the last `tests.yml` run on `main`
      (run 30751418089):
      * `npm run build` locally: **3 seconds**. `dist/` is **16 MB / 1,144
        tracked files**.
      * CI jobs run **in parallel**, so pipeline wall-clock ≈ the slowest job
        (Node Tests ubuntu shard 3/4 at **286s**), not the sum. Observed job
        spread: 47s–286s.
      * A `needs: build` barrier therefore ADDS one job's checkout +
        setup-node + `npm ci` + build (~40–60s) to the FRONT of every
        dependent's critical path, in order to remove **3s** of build from
        each. Plus 16 MB upload once and 16 MB download per dependent job
        (there are 20+, incl. 2×4 sharded matrices).
      * The step assumes artifact sharing also removes the repeated `npm ci`.
        It cannot: the dependents need `node_modules` to run at all, and
        `actions/setup-node@v4` already has `cache: 'npm'` configured in every
        job, so the download half is cached today.
      Net: strictly worse wall-clock for a maintenance gain. Recorded rather
      than implemented, per the same evidence discipline applied to the
      dependency-audit premise and the `task ci` baseline in this phase.
      **Surviving follow-up (not done here — no measured win, real CI risk):**
      the six near-identical setup blocks in `tests.yml` could collapse into a
      composite action for readability. That is a maintenance change, not a
      wall-clock one, and editing a workflow newly subjects it to `actionlint`
      (which lints only CHANGED workflow files), so it belongs in its own PR
- [x] Dependency-audit gap: `.github/dependabot.yml` added — weekly grouped
      `npm` + `github-actions` version updates (plus GitHub's ungrouped
      security updates), monthly for the two non-shipped manifests
      (`site/`, `deploy/telemetry-worker/`); Conventional-Commit prefixes so
      `lint commit subjects` passes on dependabot's own PRs.
      **Correction to this step's premise:** "no lockfile scanner exists" was
      wrong — `npm audit --omit=dev --audit-level=high` already runs on every
      PR as a step inside the `Static Checks` job (`tests.yml:330`) and again
      as a release-PR job (`release-validation.yml:242`). The real gap was the
      quiet week: an advisory published against an already-installed version
      is invisible until someone opens a PR. That is what the schedule closes

## Phase 2 — token quick wins (no lock touched)

- [x] Record the `audit_initial_context` baseline figure into the central
      roadmap's Success criteria section BEFORE any Phase 2 change lands —
      recorded 2026-08-02T15:12:25Z, no Phase 2 change had landed:
      **85,880 GPT tok** always-on across 110 files (`.claude` / `.augment` /
      `.cursor`), 69,582 for the `.windsurfrules` single blob, 4,839 for the
      31 MCP tool schemas. Target on the primary surface: ≤ 75,880
- [x] Pack-gate the domain safety floors: finance/legal/strategy/media +
      history-discipline + scale-discipline floors (~8-9k GPT tokens combined)
      state "auto-activates when pack-X is installed" but ship in every
      projection unconditionally — make the projection honor the pack
      condition. Surface first: the consumer-scoping audit
      (`agents/settings/contexts/consumer-scoping-audit-2026-07-07.md`,
      "runtime-governance rules ship to consumers; unsure → ship it")
      deliberately kept these floors shipping — cite it and confirm the
      pack-condition mechanism differs from what that record rejected before
      editing.
      **The audit check, run first (as the step demands).** That record's
      classification principle is a WORKSPACE-axis ruling: it decides
      maintainer-vs-consumer ("a rule stays exclusively-maintainer iff it is a
      specification rule"), and its "unsure → ship it" tie-breaker answers
      *does this rule belong to consumers at all*. The pack axis answers a
      different question — *is the surface this floor guards even installed* —
      and the rule declares that condition in its own body. It is also
      pre-existing: under `projection.mode: scoped` a consumer without
      `finance-basic` ALREADY loses the finance skills, so shipping the finance
      floor to them guards nothing. So the mechanism differs from what the
      audit rejected. **The audit's caution still binds the DEFAULT**, which is
      why the flip is a recorded blocker below, not part of this commit.
      **The mechanism was already wired end-to-end and merely inactive** —
      `rule_in_scope()` (`src/install/ruleInScope.ts:107`) is a three-axis
      predicate whose `packs` axis both pipelines already pass
      (`condense.ts:1036`, `src/install/rule_scope.ts:99`); the setting shipped
      as `rule_packs: []`. Nothing needed inventing, so this step is a
      dead-switch repair, the same shape as Phase 1's `condense.ts` thin-mode
      wiring.
      **What landed:** `projection.rule_packs: auto` — a sentinel resolved by
      `resolve_rule_pack_scope()` (`_lib/scoped_projection.ts`) to the
      ACTIVE-PACK set via the existing `compute_active_pack_ids`, i.e. the same
      set the skill/command prune uses, so the rule axis cannot drift from the
      artefact axis. A hand-typed id list was rejected: it would need re-typing
      on every added pack, which is the two-counting-paths failure that module
      exists to prevent. Fail-safe preserved — a derivation failure returns
      "axis inactive", never an empty set (an empty set would prune every
      pack-tagged rule, inverting the contract). Explicit lists still win.
      21 new assertions in `tests/install/rule_packs_auto.test.ts` run against
      the real `packs.yml` + `dist/agent-src/rules` tree, not fixtures.
      **Measured on this repo:** `auto` drops 8 rules / **8,110 GPT tok**
      (85,880 → 77,770): `legal-safety-floor`, `media-governance-routing`,
      `strategy-safety-floor`, `finance-safety-floor`, `media-sync-ground-truth`,
      `provider-lifecycle-discipline`, `image-likeness-and-rights`,
      `spreadsheet-source-quality`. `history-discipline` and `scale-discipline`
      — both named in this step — correctly SURVIVE: their packs carry
      `workspaces: [engineering]` in `packs.yml`, so they are active. That is
      the mechanism working, and the test pins it so a later `packs.yml` edit
      cannot silently drop an engineering floor.
      **Council (2026-08-02, 2 members, $0.07)** ruled Q1→"port
      `_resolve_active_predicates` and attach the gate to `scoped` mode".
      Departed, with the reason recorded: the port's stated benefit was making
      the number measurable, and checking that premise against the tree
      falsifies it — `condense.ts:1462` throws on `scoped`, AND `mode: scoped`
      can only be set via `.agent-settings.yml`, which is gitignored
      (`.gitignore:275`), so the port does not make anything reproducible on
      its own. Porting a different subsystem's prune is its own change under
      `minimal-safe-diff`; the throw stays. Council Q2 (human gate for the
      consumer default) and Q4 are honored as ruled.
- [x] Trim the MCP server below the 25-tool soft cap (currently 31 tools,
      flagged over-subscribed by `audit_initial_context`); demotion candidates
      = the tools that audit report flags, candidate list named in the PR
      description; ~~verify: tool count ≤ 25 in the audit re-run~~
      **verify RESTATED — the original conflated two clients that cannot be
      the same client** (council 2026-08-02, unanimous Option 4):
      `verify: stdio 19 ≤ 25 (cap satisfied) · worker 31 = full catalog by
      contract · stub input_schema emptied`.
      **Why restated, not chased.** There is no single tool count. stdio
      (`mcp_server/tools.ts:1857`) registers 19 — the 12 discovery stubs are
      deliberately unregistered (ADR-132). The Worker
      (`internal/workers/mcp/src/stubs.ts:33`) maps EVERY catalog entry into
      `tools/list`, tagging stubs `_meta.stub` and answering calls with the
      `not_implemented` envelope carrying `install_hint` + `alternative:
      stdio` — that IS the Phase-1 discovery contract
      (`docs/contracts/mcp-tool-stub-envelope.md`). The audit priced the
      catalog once and labelled it `agent-config`, i.e. it reported a hybrid
      client that does not exist and fired the over-subscription flag on a
      count no local install pays. Deleting the 12 stubs would have satisfied
      the original wording (31 → 19) by deleting a shipped contract — a
      passing number bought with a capability loss, which this package's
      evidence discipline rejects.
      **What landed:** (a) `audit_initial_context` prices per TRANSPORT,
      keyed `agent-config (stdio)` / `agent-config (worker)`, deriving the
      served set from each entry's `implemented_on`; (b) `build_mcp_catalog`
      emits `input_schema: {}` for stub entries — a schema tells a client how
      to CALL a tool and no transport permits that for a stub, so it was
      always-loaded context that could never be acted on. `STUB_TOOLS` keeps
      the schema as the design record for the day the tool is wired.
      (c) Both aggregators that fold the MCP surface into a gate —
      `audit_initial_context`'s `mcp_schemas.gpt` budget and
      `check_token_regression`'s gated metric — switched from Σ to **max**
      across entries: a client connects over ONE transport, so summing would
      bill the 19 shared tools twice and read the split itself as a
      regression.
      **Measured:** stdio **19 tools / 3,074 GPT tok — under the cap, flag
      off**; worker **31 tools / 4,174 GPT tok** (was 4,839 as one conflated
      row), still flagged and correctly so — the excess IS the discovery
      contract. Net −665 GPT tok on the worst-case client.
      `check_token_regression`: `mcp_schemas 4174 vs baseline 4839 (-13.7%)`,
      whole gate green.
- [x] De-duplicate the host projection's double command listing (hyphen skill +
      colon command for every command) to one naming scheme — respect the
      single-surface and install-path-convergence council locks when choosing
      which one survives.
      **The double was maintainer-repo-only, which changes the risk.**
      `generate_claude_commands` short-circuits when `src/domains/` is absent
      (`condense.ts`), so the hyphen wrappers have never existed in a consumer
      project — the colon form there comes from the user-global tree
      `install.ts` writes. So this touches no consumer surface and the
      single-surface / install-path-convergence locks are not in tension.
      **Council 2026-08-02 chose Option 1 (both members): drop the twinned
      wrappers AND add a project-scope colon projection**, rather than drop
      the wrappers and lean on a global deploy having run — reachability
      inside a fresh clone must not depend on machine state.
      **What landed:** `generate_claude_project_commands()` writes
      `.claude/commands/<cluster>/<sub>.md` symlinks (134 of them, the nested
      commands); `generate_claude_commands` now skips any command with a
      nested path, so it emits **47** wrappers instead of 178 — exactly the
      flat commands, whose wrapper is their ONLY access path (Claude Code
      does not register flat command FILES, probed ≤ 2.1.204 — the
      flat-command mitigation in `install.ts`). Claude Code dedupes project
      and user scope by name, so the two `/cluster:sub` copies collapse.
      ADR-003 (colon canonical for clusters) and ADR-044 (flat commands stay
      hyphenated) both continue to hold — neither had to be superseded.
      `.claude/commands/` registered in the `GENERATOR_OUTPUT_ROOTS` registry
      and in `.gitignore` in the same commit (the coverage gate demands both;
      the consumer gitignore block already listed it).
      **Measured:** `skills_projected` **466 → 335 entries, 17,992 → 13,779
      GPT tok (−4,213)** — the largest single lever in this phase.
      7 assertions in `tests/scripts/claude_command_dedup.test.ts` via the
      condense test-state seam, including a dangling-symlink guard: the first
      implementation hand-counted the `../` run and produced links that
      resolve nowhere while looking correct in `ls -l`; `path.relative`
      replaced the arithmetic and the test pins it.
- [x] Finish the `condense.ts` thin-mode port so `lean_projection.mode: thin`
      stops THROWING (dead-switch repair only — the default stays `eager-all`
      per the thin-projection honest null; flipping remains parked).
      The port was smaller than the comment implied: `build_thin()` had been
      ported and present the whole time; only the wiring was missing, and the
      branch threw "requires project_thin_rules (not ported)". Wired via
      `build_thin(RULES_SOURCE, _read_rule_workspaces())`.
      Import-safety verified BEFORE wiring, not assumed — `condense.ts` is
      bundled into the installer, so importing a module with a bare top-level
      `process.exit` would fire at consumer runtime (the documented
      bundled-CLI-entry-guard landmine). `project_thin_rules` guards its CLI
      entry; `check_installer_import_purity` green after the change.
      Verified the switch now produces output instead of throwing: 110 rules,
      62,999 chars. `--measure` reads eager 85,880 → thin 15,106 GPT tok
      (82.4% of the rule layer) — the number the parked flip decision would
      act on, which could not even be re-measured while the mode crashed
- [x] Re-run `audit_initial_context` — including the `.windsurfrules`
      single-blob projection in the before/after — and record the new
      footprint in the central roadmap's Success criteria section.
      Recorded in `road-to-package-renewal.md` § Success criteria as an
      AFTER block with BOTH figures: the shipped default (**−4,878**) and the
      one-gated-flip figure (**−12,988**), so neither is presented as the
      other. `.windsurfrules` included as the step demands: 69,582 → 63,251
      under the flip, unchanged on the default.
      The flip figure is measured END-TO-END — settings written, `task
      generate-tools` run, audit re-read (`.claude` 110 → 102 files, 85,880 →
      77,770) — not summed from the predicate, then the temporary settings
      file removed and the projection regenerated so the tree is back on the
      shipped default. `.agent-settings.yml` is gitignored, so a measurement
      that depended on it silently would not be reproducible; the procedure
      is written down instead.
      Two misses recorded rather than engineered away: the ≥10k floor is
      cleared only WITH the flip, and the `≤ 75,880` single-surface
      sub-target is missed either way (77,770). The sub-target was
      unreachable by the levers the criterion itself names — the MCP lever
      does not touch the rule row and `.augment` is unfilterable by design.

## Phase 3 — runtime activation spike (phase-gated; go/no-go recorded first)

> Gate: run only after Phase 2's re-measure. If the footprint is already at
> target, record no-go and close this phase as `[-]` with the measurement.
> Optional input: the kernel/router value re-baseline (ADR-hygiene § Blockers, blocker: kernel-router-value-rebaseline)
> feeds this go/no-go if it has landed; the gate does NOT wait on it.
> Scope line: semantic retrieval (embedding-based trigger matching) is OUT of
> scope — the resolver uses keyword/phrase matching only. Reopen condition:
> the trigger-precision pass caps below the pre-registered injection-precision
> threshold, indicating the keyword-mechanism ceiling rather than an
> implementation gap.

- [ ] Pre-register the spike: thresholds written BEFORE any code — token
      delta, injection precision on the 678-trigger set, AND a non-kernel
      quality arm using a NEW instrument: a non-kernel missed-load (recall)
      threshold on a labelled prompt corpus, with the verdict mechanism named
      in the pre-registration. The ADR-202 anchor-scoring instrument is a
      FINAL HONEST NULL (κ=0.472 < 0.800 floor; its reopen term is "a
      different instrument, not a third attempt") — its anchors may serve as
      raw material only, never as the verdict mechanism; corpus and abort
      criteria named in the same record
- [ ] Trigger-precision pass: 459/678 triggers are bare keywords — promote the
      noisiest to phrases or add a precision budget, else the resolver injects
      everything and measures nothing (precondition for the spike)
- [ ] Layer-1 resolver spike: SessionStart/UserPromptSubmit hook matches prompt
      + touched paths against `dist/router.json` triggers and injects only
      matched non-kernel rule bodies (kernel always full); never-block shim
      (resolver failure → eager fallback, never a blocked turn)
- [ ] Run the pre-registered measurement; record win/loss in the central
      roadmap; a loss parks this permanently next to ADR-054 with the numbers.
      A WIN flips nothing by itself: it produces its own decision record
      (council pass + explicit maintainer sign-off) in a SEPARATE PR from the
      measurement — no default changes ride with the numbers
- [ ] Reconcile `rule-router.md` with reality either way: today it documents a
      runtime loader that does not exist — after the spike it documents either
      the resolver or the explicit absence

## Blockers

### blocker: required-check-enforcement

- **Status:** gated
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap (the doc-shrink half shipped; this is
  the enforcement half of the required-check-matrix step)
- **What to do:** extend the required-status-check list on the repository
  **ruleset** — NOT classic branch protection, which returns 404 for this
  repo:

  ```bash
  gh api repos/event4u-app/agent-config/rulesets/17749383 > ruleset-before.json
  # edit required_status_checks, then:
  gh api -X PUT repos/event4u-app/agent-config/rulesets/17749383 \
    --input ruleset-after.json
  ```

  Recommended minimum additions (all already run and pass on every feature
  PR): `Smoke — kernel`, `Smoke — router`, `Smoke — schema`, `Smoke — skills`,
  `Static Checks (ESLint · typecheck · prepack)`, `skill-lint`,
  `Rule backstops`. Sharded / OS-matrixed check names are deliberately
  excluded — their names encode shard counts and runner labels, so a matrix
  change silently breaks a pinned required-check name.
- **Why not the agent:** an admin API write on the production trunk is a
  Hard Floor action under `non-destructive-by-default` — explicit this-turn
  maintainer confirmation, never an autonomous roadmap step.
- **Resolved when:** the maintainer executes the PUT and records the
  resulting `ruleset-after.json` as the verification artifact, and
  `docs/contracts/branch-protection-policy.md` § "What is actually enforced"
  is updated from that JSON.

### blocker: rule-packs-auto-consumer-default

- **Status:** gated
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — the mechanism shipped in Phase 2 and
  the measurement is recorded; this is only the default flip.
- **What to do:** change `projection.rule_packs` in
  `src/config/agent-settings.template.yml` from `[]` to `auto`, then re-run
  `./scripts-run src/scripts/check_consumer_scope_flip` and record the new
  consumer figure next to the existing workspace-axis one.
- **Why not the agent:** flipping it changes what a consumer install
  RECEIVES, which is the same class of change as the workspace-axis flip of
  2026-07-13 — recorded there as "the default flip stays a human gate"
  (`agents/settings/contexts/consumer-scoping-audit-2026-07-07.md:70-73`).
  The AI council (2026-08-02, both members) ruled the gate applies to the
  pack axis too, even though the axis itself answers a different question.
- **Evidence for the decision, already measured:** on this repo `auto` drops
  8 rules / 8,110 GPT tok, none of them kernel, none of them an
  engineering-workspace floor. On the consumer surface the workspace axis
  alone already yields 95 rules / 75,737 tok (`check_consumer_scope_flip`,
  2026-08-02); `auto` composes with it as a second AND-constraint.
- **Counter-case to weigh:** the audit's "unsure → ship it" tie-breaker. A
  consumer who later works on a finance question WITHOUT the finance pack
  installed would no longer receive `finance-safety-floor`. The pack-axis
  answer is that such a consumer also has no finance skills, so the floor
  guards nothing — but that reasoning is exactly what the gate exists to have
  a human confirm.
- **Resolved when:** the maintainer records accept-or-reject here with the
  reason; on accept, the template default and the `check_consumer_scope_flip`
  report land in the same commit.

## Verification

- Each phase re-runs only the gates it touched plus `audit_initial_context`
  for token claims; full-pipeline runs stay on the remote PR CI per
  roadmap-ci-steps-policy.
