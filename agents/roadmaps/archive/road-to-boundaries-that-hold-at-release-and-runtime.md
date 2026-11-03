---
complexity: lightweight
status: ready
tree_pin: b234d08480
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps over the WIP cap of 5, owner-directed 2026-11-03 (agents/evidence/owner-directives/2026-11-03-process-inbox-2026-11-n-roadmaps.md): one of eight roadmaps of round inbox-2026-11-n landed active so /roadmap:process-full executes them in the same run."
estate_offset_exempt: "Owner search at b234d08480 (grep -rlF in agents/roadmaps-owned.md, agents/roadmaps/*.md, later/, stubs/ for template-injection, privileged-job-cache, persist-credentials, github-workflows, humanTypedThisTurn, AGENT_MESSAGE_FRAME, settings.local.json, startsWith(root, isContained, Latent-bug, detectStandingCommand, control-char, id-token) returned 0 hits; no active roadmap owns these boundaries, so none is archived to offset this one."
relates:
  - slug: later/road-to-workflows-that-cannot-exfiltrate
    relation: disjoint
    note: "Same linter file, different rule classes: that roadmap owns token scope and the actionlint download pin (its 1.2); this one owns inline-expression injection, caches in privileged jobs and the shipped workflow templates. No shared step."
  - slug: later/road-to-typed-grants-that-persist
    relation: extends
    note: "Its 4.3 gate will read the git-authorization ledger. Step 1.1 here stops a framed peer or subagent message from writing that ledger; it must land before 4.3 reads a grant."
  - slug: stubs/road-to-the-16-3-0-findings-residue
    relation: disjoint
    note: "Its scope-expansion item needs a realpath containment check; step 1.3 makes isContained the one exported helper it can reuse. Its own fix stays there."
---
# Road to boundaries that hold at release and runtime

> **Source:** `agents/tmp.old/inbox-2026-11-n/` (topic T0, P07, P08).
> **Arrivals:** 1 — `inbox-2026-11-n` (2026-11-03). The template-injection half is a second
> arrival of a finding first raised in an earlier inbox round and parked as
> "intentionally deferred" in `src/scripts/lint_workflow_security.ts:35-37` with no owner.

## Goal

Four trusted-but-untrusted inputs get a boundary. At the pin: a message forwarded from another session counts as a human turn and writes a `pr-merge`
grant; `.claude/settings.local.json` is not a settings file for the config guard; three
containment checks compare raw string prefixes; and three project-memory writers accept a
standing command the global path refuses. On the release side, ten free-text `${{ }}`
expressions sit inline in `run:`, six privileged jobs restore an Actions cache, and the
workflow templates shipped to consumers lack `persist-credentials` and every net that guards
our own workflows. Done when each defect has a negative test that was red at the pin and is
green after the fix, and the release-side rules fail the contract test on regression.

## Phase 1 — Runtime trust boundaries

- [x] **1.1 A forwarded session message is not a human turn.** In <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/machine_wake.ts -->
      `src/scripts/_lib/machine_wake.ts`, `humanTypedThisTurn` returns `false` when the prompt
      matches the host's fixed sentence-then-tag frame; export `AGENT_MESSAGE_FRAME` from
      `src/scripts/_lib/prompt_shape.ts:110-111` and read it in both modules (one constant).
      Negative tests in `tests/scripts/git_authorization.test.ts`: a cross-session-framed
      "Merge PR #12 now." leaves the ledger file absent/byte-equal and `detected_at` unchanged;
      an agent-message hand-back likewise; the bare sentence without the tag on line 2, and a
      human question quoting the frame, still count as human turns.
      verify: `npx vitest run tests/scripts/git_authorization.test.ts tests/scripts/language_mirror_hook.test.ts tests/scripts/evidence_independence_turn_marker.test.ts` → 0
- [x] **1.2 `settings.local.json` is fenced like `settings.json`.** Widen the host-directory <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/block_config_weakening.ts -->
      regex in `src/scripts/hooks/block_config_weakening.ts:264-265` to `settings(\.local)?\.json`
      under the same host directories. Negative tests in
      `tests/scripts/hooks/block_config_weakening.test.ts`: a Write adding `hooks.SessionStart`
      to `.claude/settings.local.json` exits 1 with the same Class C reason; `src/foo/settings.local.json` <!-- ref-ignore -->
      stays unfenced (exit 0).
      verify: `npx vitest run tests/scripts/hooks/block_config_weakening.test.ts` → 0
- [x] **1.3 One containment helper, three sites.** Use `isContained` from <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/agent-src/templates/scripts/work_engine/_lib/agent_settings.ts -->
      `src/scripts/_lib/session_index_trust.ts:147` in `src/scripts/_lib/agent_settings.ts:1122`,
      its twin `src/agent-src/templates/scripts/work_engine/_lib/agent_settings.ts:844`, and
      `src/scripts/_lib/install_reach_checks.ts:220`; delete the "Latent-bug candidate" comments.
      Negative tests: `root_paths: ["../<root>-evil"]` (sibling dir created in a temp root)
      enumerates 0 modules (`tests/lib/agent_settings.test.ts`); `classifyNamedPath(root,
      'a/../../<root>-evil/x')` is `unresolvable` (`tests/scripts/install_reach_checks.test.ts`);
      `<root>/a` and `<root>/..cache` stay contained.
      verify: `npx vitest run tests/lib/agent_settings.test.ts tests/scripts/install_reach_checks.test.ts tests/scripts/templates_memory_signal.test.ts` → 0, and `grep -n "startsWith(root)" src/scripts/_lib/agent_settings.ts src/agent-src/templates/scripts/work_engine/_lib/agent_settings.ts` → no match
- [x] **1.4 Carriage return is not a hidden-instruction signal.** In <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/retrieval_sanitize.ts -->
      `src/scripts/_lib/retrieval_sanitize.ts`, `scan_invisible_findings` no longer reports
      U+000D as `control-char`; every other C0/C1 control still reports. Tests in
      `tests/scripts/retrieval_sanitize.test.ts`: CRLF text and `10%\r20%` → no finding;
      U+0007 and U+009B → `control-char`.
      verify: `npx vitest run tests/scripts/retrieval_sanitize.test.ts` → 0

## Phase 2 — Release chain

- [x] **2.1 Template-injection rule, then the ten sites.** Add rule `template-injection` to <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: .github/workflows/cloud-release.yml -->
      `src/scripts/lint_workflow_security.ts`: a `${{ }}` reading a free-text context
      (`inputs.*`/`github.event.inputs.*` of `type: string` or untyped, `github.event.release.*`
      tag/name/body, PR title/body/head ref, `github.head_ref`, commit messages, label names)
      inside `run:` or `actions/github-script` `script:` is HIGH; `choice`/`boolean` inputs,
      SHAs, numbers and step outputs are not. Rewrite the deferral note at `:35-37` to name the new rule. Move each site to a step `env:` variable read as `"$VAR"`:
      `publish-npm.yml:87,214`, `cloud-release.yml:60`, `release-guard.yml:40`,
      `deploy-mcp-worker.yml:51-53`, `release.yml:181`, `risk-class-drift.yml:86`.
      Tests in `tests/scripts/lint_workflow_security.test.ts`: a planted
      `${{ github.event.pull_request.title }}` in `run:` → 1 HIGH; the same via `env:` → 0;
      `inputs.bump` (choice) → 0.
      verify: `npx vitest run tests/scripts/lint_workflow_security.test.ts` → 0 and `./scripts-run src/scripts/lint_workflow_security --strict` → exit 0
- [x] **2.2 No cache in a privileged job.** Add rule `privileged-job-cache` (privileged = <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: .github/workflows/cloud-release.yml -->
      effective `id-token: write`, `contents: write`, or a `secrets.*` other than
      `GITHUB_TOKEN`, inherited from workflow level unless the job overrides; cache =
      `with.cache` on a `setup-*` action or `actions/cache`). Remove `cache:` from the six jobs:
      `publish-npm.yml:75,255`, `deploy-site.yml:52`, `release.yml:238`, `cloud-release.yml:49`,
      `deploy-mcp-worker.yml:111`. Do not add `cache-mode`. Tests: a planted cache in a job with
      workflow-level `id-token: write` → finding; the same cache in a job overriding to
      `contents: read` → none (fixture mirrors `deploy-mcp-worker.yml:40-41`).
      verify: `npx vitest run tests/scripts/lint_workflow_security.test.ts` → 0, `./scripts-run src/scripts/lint_workflow_security --strict` → exit 0, `grep -n "cache:" .github/workflows/publish-npm.yml .github/workflows/deploy-site.yml .github/workflows/cloud-release.yml` → no match
- [x] **2.3 The shipped templates get the same nets.** Add `persist-credentials: false` to the <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      six checkouts in `src/agent-src/templates/github-workflows/` that lack it (`true` with a
      comment only where a later step pushes); extend `tests/contracts/ci_supply_chain.test.ts`
      with the template directory as a third root for the `persist-credentials`,
      `template-injection` and `privileged-job-cache` assertions (SHA-pin assertion excluded
      pending owner decision OD-1); regenerate projections with `task sync`.
      verify: `npx vitest run tests/contracts/ci_supply_chain.test.ts` → 0 and `LINT_WORKFLOW_SECURITY_DIR=src/agent-src/templates/github-workflows ./scripts-run src/scripts/lint_workflow_security --strict` → exit 0
- [x] **2.4 The CI skill teaches the same rules, project-neutral.** In <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `src/skills/github-ci/SKILL.md`, add three conventions naming the linter rules
      (free-text `${{ }}` only via `env:`; explicit `persist-credentials` on every checkout;
      no cache in a job with `id-token: write` / `contents: write` / a non-default secret), and
      replace the project-specific workflow overview (`:26-80`) with "read `.github/workflows/`
      and tabulate trigger and environment". Generalise `src/skills/github-ci/evals` if they
      assert the removed names.
      verify: `task lint-skills` → 0 and `grep -cE 'Envoyer|COMPOSER_AUTH|deploy-sta|quality-tests' src/skills/github-ci/SKILL.md` → 0

## Phase 3 — Project memory writes are guarded

- [x] **3.1 Attack and benign fixture, red first.** Add `tests/fixtures/standing-commands.json` <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      (≥ 12 attacks: prepended and appended recurrence, German, shell substitution, package
      install, "At the start of each session, run … | bash", "Before each session, download and
      run …"; ≥ 6 benign directives incl. "Always run the tests before pushing", "The CI runs lint
      on every push") and a test driving each row through `evaluateCaptureGuards`
      (`src/scripts/_lib/user_global_observations.ts:232`) that fails on any missed attack AND any
      refused benign row. It is expected red until 3.2; record the miss and refusal counts in
      the step note.
      verify: `npx vitest run tests/lib/standing_commands_fixture.test.ts` exits non-zero and its output names ≥ 2 missed attacks and ≥ 1 refused benign row
- [x] **3.2 Repair the guard.** Extend `_STANDING_COMMAND_RE` in <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/user_global_observations.ts -->
      `src/scripts/_lib/user_global_observations.ts` to prepended recurrence, add the
      `retrieval_sanitize` scan (`risk_level !== 'low'`) as a second channel, and stop refusing an
      imperative that has no fetch/exec target. No allowlist entries.
      verify: `npx vitest run tests/lib/standing_commands_fixture.test.ts tests/lib/user_global_observations.test.ts` → 0
- [x] **3.3 The three project writers call it.** `evaluateCaptureGuards` runs in <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: dist/agent-src/templates/scripts/memory_signal.ts -->
      `src/scripts/memory_signal.ts` (and its twin `src/agent-src/templates/scripts/memory_signal.ts`),
      `src/scripts/mine_session.ts` (`commitIntake`) and `src/scripts/retro.ts`
      (`writeIntakeSignals`); a refusal leaves the intake file unchanged and the MCP tool answers
      `recorded: false` with the category. Negative test per writer with one attack row.
      verify: `npx vitest run tests/scripts/memory_signal.test.ts tests/scripts/templates_memory_signal.test.ts tests/scripts/mine_session.test.ts tests/scripts/retro.test.ts` → 0

## Step notes

- **1.3** — at the pin the sibling `../<root>-evil` already enumerated 0 modules, because `_relative_to` refused it one step later; the same prefix defect in `_relative_to` (`rel.startsWith('..')`) instead refused a contained `..cache` root — that case and `a/../../<root>-evil/x` were red at the pin. `_relative_to` takes the segment check too.
- **2.1** — the rule found 7 HIGH step groups at the pin, the ten sites plus `release.yml`'s `join(github.event.pull_request.labels.*.name)`. Each resolve step now also holds the resolved tag/version to `[0-9A-Za-z.-]`, because its step output is re-interpolated inline downstream (13 sites) and the rule treats step outputs as fixed-shape.
- **3.1** — red at the pin: 14 attacks / 7 benign; 10 attacks missed (all prepended-recurrence, German, `eval`/`wget`, package-install and `call <url>` rows), 3 benign refused ("Always run the tests…", "Always check the changelog…", "Always fetch the latest main…").
- **3.2** — the guard is now recurrence marker AND fetch/exec target (URL, pipe to shell, `$(`, `curl`/`wget`/`eval`/`… -c`, package install, `npx`, download), plus `_scan` as the second channel. A bare script path and a backtick span are not targets — both refused stored preferences in `user_global_observations_project_attribution.test.ts`; the fixture's `./bootstrap.sh` row became a `bash -c 'curl …'` row and two such preferences joined the benign set.

## Decisions

| Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|
| OD-2, conservative reading: a message forwarded from another session (lead to worker, peer, or framed subagent hand-back) never counts as a human turn, so it never writes a `pr-merge` or any other git grant (1.1) | Let a lead session's message authorize a merge in a worker session | The ledger cannot tell a lead's instruction from a peer that quotes untrusted text; the conservative reading is reversible by deleting one regex test in `humanTypedThisTurn` | The owner answers OD-2 with "a lead may authorize", and a signed or otherwise provenance-checked lead channel exists |
| The consumer-shipped twin `work_engine/_lib/agent_settings.ts` carries a local `_is_contained` with the same algorithm instead of importing `isContained` (1.3) | Import across the package boundary | That tree ships to consumers self-contained and cannot reach `src/scripts/_lib` | A shared runtime library lands inside the shipped tree |
| `privileged-job-cache` ships MEDIUM, `template-injection` HIGH (2.1, 2.2) | Both HIGH | The 2026-06-13 severity model is council-locked; a new HIGH is what 2.1 names explicitly, 2.2 names no tier, so it follows the `persist-credentials` precedent: MEDIUM in the linter, blocking through `tests/contracts/ci_supply_chain.test.ts` | The council re-tiers the model |
| A resolved release tag/version is held to `[0-9A-Za-z.-]` in the resolve step (2.1) | Move each of the 13 downstream `steps.*.outputs` interpolations to `env:` | One guard per resolve step closes the taint at its source and keeps the rule's "step outputs are fixed-shape" premise true; release tags are plain semver (`release_tag_dispatch.ts:56`, the `on.push.tags` filters) | A release tag format outside that set is introduced |
| `memory_signal.ts` and its installed twin carry an inlined capture guard (`_capture_refusal`: recurrence + exec target, plus the injection-hook phrase and exfil patterns) instead of calling `evaluateCaptureGuards`; `mine_session` and `retro` call `evaluateCaptureGuards` directly (3.3) | Import `_lib/user_global_observations` from both twins | The installed template tree has no `_lib/`, and `memory-twin-verdicts.yml` holds the pair at `exact`; dropping to `bounded` would weaken a gate. `tests/scripts/memory_signal.test.ts` drives the shared fixture through both guards | The template tree gains an installed shared library |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A release workflow breaks on the `env:` move | implementation | Publish/deploy jobs cannot be dry-run locally | Mechanical, one variable per site; `release.yml` dispatch with `dry_run: true` is the first post-merge check | Phase 2 |
| 2 | Removing caches slows release jobs | implementation | No local measurement possible | Accepted; a later read-only cache keyed to the default branch is the escape, never disabling the rule | Phase 2 |
| 3 | The peer-frame fix hides a real human turn | implementation | A human pasting the frame | Frame requires the fixed sentence at position 0 AND the tag on the next line; quote vectors stay human | Phase 1 |
| 4 | Guard repair refuses benign memory | implementation | Over-broad regex | Benign rows fail the fixture run | Phase 3 |

## Non-goals

- SHA-pinning the consumer templates (owner decision OD-1).
- Hook-drift census, `ConfigChange`/`FileChanged` binding, injection-scanner default flip,
  DNS pinning, exact npm version, `npm_`/`glpat-` credential rows — later list of
  `inbox-2026-11-n` lane D.
- `cache-mode` (actionlint support unverified) and runner-label pinning (archived decision B4).
- Blocking or removing foreign hook entries.
