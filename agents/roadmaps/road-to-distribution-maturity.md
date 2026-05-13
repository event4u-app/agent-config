---
complexity: lightweight
---

# Road to distribution maturity (post-2.2.2 evaluation follow-ups)

> Close the five gaps surfaced by the 2.2.2 evaluation (Gesamt 9.4 / 10):
> MCP contract ↔ README auth-surface drift, missing Enterprise / offline
> story for the npx-only runtime, architecture docs that conflate four
> pipelines, an unbounded command surface, and a noisy changelog that
> hides what shipped when.

## Prerequisites

- [ ] Read `AGENTS.md`, `docs/architecture.md`,
      `docs/contracts/mcp-cloud-scope.md`, `README.md`,
      `docs/decisions/ADR-007-agent-discovery-scopes.md`.
- [ ] Branch `roadmap/distribution-maturity` checked out (this file lives there).
- [ ] AI Council `anthropic` + `openai` enabled in `.agent-settings.yml`,
      keys installed under `~/.config/agent-config/` (token spend authorised).
- [ ] `task ci` green on baseline (record commit SHA in Notes).

## Context

The 2.2.2 evaluation rates the package **9.4 / 10** but flags five
structural follow-ups. Three are documentation-sync issues (MCP auth
surface, architecture pipelines, MCP Lite/Full marking), one is a
real product-shape question (Enterprise / offline fallback for the
npx-only runtime), and one is hygiene (changelog noise, command
surface). None of them justify reverting the 2.2.2 npx-only shift —
they harden the shift instead.

- **Source evaluation:** captured inline below (Phase 0 records the
  five priority bullets verbatim from the user's brief).
- **Council:** two passes required by the user — one on the Composer
  fallback feasibility (gates Phase 2 design), one on this roadmap
  before execution begins.

- **Feature:** none (distribution / docs hardening).
- **Jira:** none.

## Locked decisions (this turn)

- **Scope:** five priority gaps from the evaluation. Other lower-rated
  items (UX for Enterprise/Offline 7.8, Architektur-Klarheit 8.8) feed
  in through Phases 2 and 3 — they are not their own phases.
- **No release-version pinning in roadmap prose.** This roadmap
  describes work, not the package release it lands in. Tagging /
  semver-bump decisions belong to the user at merge time (per
  `scope-control` § Git operations). **Consumer-side npm pinning**
  (`.npmrc`, `agent_config_version` in `.agent-settings.yml`) is a
  documentation deliverable inside Phase 2 — that is not a roadmap
  release pin, that is the npx fallback surface itself.
- **Branch:** all five phases run on `roadmap/distribution-maturity`.
  Spike branches are only spawned if a phase explicitly justifies one
  during execution (per `scope-control` § Decline = silence).
- **Composer fallback rejected (council verdict 2026-05-13).**
  Anthropic `recommend-reject` — `installed.lock` is npm-shaped, dual
  distribution doubles SBOM / CVE / signing infrastructure. Phase 2
  Step 5 now scaffolds `scripts/hermetic-install.sh` (Option 4 from
  the council question) instead. OpenAI o1 returned empty output
  (reasoning-token saturation at `max_tokens=1024`) — single-voice
  verdict recorded in `## Council verdicts` with that caveat.

## Phase 0: Council passes (gate the rest of the roadmap)

> **Status:** Steps 1–3 + 5 done (2026-05-13). Phase 0 is closed before
> Phase 1 starts — convergent findings are folded into Phases 1–5
> below, not into a future revision.

- [x] **Step 1:** Capture the evaluation's five priority items at
      `agents/contexts/evaluation-2-2-2-followups.md` (verbatim user
      brief, no editorialising). Phase 1+ cite this file instead of
      re-paraphrasing.
- [x] **Step 2:** Run `/council default` on
      `agents/council-questions/composer-fallback-feasibility.md`
      **before** finalising Phase 2. Session
      `20260513T090143Z-composer-fallback.json` written. Anthropic
      verdict: `recommend-reject`. o1 returned empty (reasoning-token
      saturation). Single-voice verdict folded into the
      `Locked decisions` block above and Phase 2 Step 5.
- [x] **Step 3:** Run `/council design` on this roadmap **before**
      finalising any phase. Session
      `20260513T090314Z-distribution-maturity.json` written. Both
      members returned. Convergent + divergent findings folded into
      the phase rewrites + `## Council verdicts` below.
- [ ] **Step 4:** Render both council reports inline in the PR
      description when the roadmap-implementation PR opens — not as
      links into `agents/council-sessions/` (that directory is
      gitignored per `ai-council` § Output path convention).
- [x] **Step 5:** Mark the council verdicts in this file's
      `## Council verdicts` section (below) before Phase 1 starts.
- [ ] **Step 6:** Council-verdict ambiguity handling. If a future
      council pass on a phase yields a `maybe` / partial verdict (not
      hard yes/no), the phase author records the ambiguity under
      `## Council verdicts` with a `needs-input` host verdict and
      **stops** until the user resolves. No silent host paraphrase of
      partial verdicts — per `ai-council` skill § Critical evaluation.

## Phase 1: MCP contract ↔ README auth-surface sync

- [ ] **Step 1:** Diff `README.md` (MCP section) against
      `docs/contracts/mcp-cloud-scope.md` and Invariant 8. Record every
      claim mismatch in Notes (auth modes, MVP-1 vs MVP-2 boundary,
      tool-execution scope, rate-limit/cache surrogates).
- [ ] **Step 2:** Define explicit auth-surface modes in
      `mcp-cloud-scope.md`: `public`, `bearer-auth`, `hmac-deferred`,
      `cf-access-deferred`. Each mode states: what protects ingress,
      what the README is allowed to recommend, what is out-of-scope.
- [ ] **Step 3:** Update the README MCP section to cite the contract
      modes by name (`bearer-auth mode per
      docs/contracts/mcp-cloud-scope.md § Auth surface`). No claims
      that the contract does not authorise.
- [ ] **Step 4:** Add a **bidirectional** contract-drift test under
      `tests/test_mcp_contract_readme_sync.py` — fails if the README
      MCP section mentions an auth mode the contract has not declared
      **or** if the contract declares a mode the README does not
      mention (catches both drift directions, per council finding o1).
- [ ] **Step 5:** Verify Invariant 8 still describes auth-less ingress
      protection correctly after the mode split; reword if Phase 1
      narrowed the auth-less surface.
- [ ] **Step 6:** Tag every MCP-related doc, ADR, and code path
      touched in Steps 1–5 with `mcp_scope: lite|full|deferred` in
      frontmatter or a leading comment. Pulled forward from the
      original Phase 5 to avoid retroactive Phase-1 rework (per
      council finding Anthropic).

## Phase 2: Enterprise / offline fallback story

> **Composer rejected** by Phase 0 council. Step 5 below scaffolds
> the hermetic-install.sh alternative (Option 4 from the question
> file).

- [ ] **Step 1:** Author `docs/setup/enterprise-and-offline.md` —
      states the four documented paths (pinned-npx, offline cache,
      CI-safe install, hermetic-install.sh) and **why Composer was
      rejected** (one paragraph citing the council session).
- [ ] **Step 2:** Document **pinned-npx via internal registry** —
      `.npmrc` config snippet, `agent_config_version` interaction in
      `.agent-settings.yml`, registry-mirror caveat. This is consumer
      npm-pinning, not roadmap release-pinning (see Locked decisions).
- [ ] **Step 3:** Document **offline cache strategy** —
      `npm cache add @event4u/agent-config@<pin>` workflow, corepack
      pinning, `agent_config_version` cross-check.
- [ ] **Step 4:** Document **CI-safe install pattern** — what a
      hermetic build agent needs (cached tarball, `--offline`, no
      registry hit, `validate` instead of `init`).
- [ ] **Step 5:** Scaffold `scripts/hermetic-install.sh` per the
      council's Option 4 recommendation. Acceptance criteria:
      (a) runs `npm pack @event4u/agent-config@<pinned-version>`,
      (b) verifies `sha256sum` against a signed checksum manifest
      shipped in the tarball, (c) invokes `scripts/install.py` with
      a yet-undefined `--offline --package-dir=<staging>` flag,
      (d) writes `installed.lock` with `installation_mode: hermetic`,
      `package_checksum: sha256:…`, `signature_verified: true`. Each
      sub-criterion is its own test in
      `tests/test_hermetic_install.py`. Lock-manifest schema
      extension (point d) is `needs-input` — captured as ADR
      candidate in Notes, not silently added here.
- [ ] **Step 6:** Add a "no-internet developer" runbook section to
      `docs/setup/enterprise-and-offline.md` — checklist + recovery
      from a broken `npx` cache, no new code.
- [ ] **Step 7:** Outcome check — a developer in a sandboxed VM with
      no internet access can run the documented Enterprise path
      end-to-end. Manual verification on a Docker container with
      blocked egress; record the SHA + container image in Notes.


## Phase 3: Architecture-docs split (four-pipeline clarity)

- [ ] **Step 1:** Inventory the four pipelines `docs/architecture.md`
      currently conflates: (a) `.agent-src.uncompressed/` → `.agent-src/`
      compression, (b) `.agent-src/` → `.augment/` projection, (c)
      `.agent-src/` → multi-tool stubs (`.claude/`, `.cursor/`,
      `.clinerules/`, `.windsurfrules`, `GEMINI.md`), (d) Claude.ai
      bundle (ZIP) pipeline.
- [ ] **Step 2:** Split `docs/architecture.md` into a top-level overview
      + four sub-pages under `docs/architecture/` (`compression.md`,
      `augment-projection.md`, `multi-tool-projection.md`,
      `claude-bundle.md`). Each page owns one pipeline end-to-end:
      input, transform, output, invariants, failure modes.
- [ ] **Step 3:** Each sub-page cites the script (`scripts/...`),
      the Taskfile target, and the test file that proves the pipeline.
      No prose without a file:line citation.
- [ ] **Step 4:** Update `AGENTS.md` Pointers section to link the four
      sub-pages individually — the Thin-Root contract caps prose, so
      pointers carry the weight.
- [ ] **Step 5:** Add a `tests/test_architecture_docs_pipelines.py`
      drift check — fails if a pipeline sub-page exists without the
      cited script / Taskfile target, or vice versa.

## Phase 4: Command-surface tiering

- [ ] **Step 1:** Snapshot the current command surface (`./agent-config
      --help` + slash-command catalogue). Record total counts in Notes.
      No hard Tier-0 cap — "target lean" is a qualitative goal: a new
      user can grok the Tier-0 list in one glance. Quantitative cap is
      `needs-input` (per council finding Anthropic).
- [ ] **Step 2:** Define tier criteria in
      `docs/contracts/command-surface-tiers.md`: Tier-0 = daily-driver
      (init, sync, generate-tools, validate, keys:install-*,
      council:*, work, commit, /onboard), Tier-1 = power-user (audit,
      optimize, roadmap:*, /review-changes, /create-pr), Tier-2 =
      maintenance / internal (everything else, including dev-only
      scripts). Tier-2 is the **default for new commands** — Phase 2
      Step 5's hermetic-install commands land Tier-2 unless explicitly
      promoted (closes the Phase 2 → Phase 4 coupling raised by o1).
- [ ] **Step 3:** Tag every command file with `tier: 0|1|2` in
      frontmatter (`.agent-src.uncompressed/commands/**`). Default to
      Tier-2 when in doubt; promotion is the harder direction.
- [ ] **Step 4:** Filter `./agent-config --help` to Tier-0 by default;
      add `./agent-config --help --tier=1` and `--tier=all`. Slash
      command listing in `/agents audit` mirrors the same filter.
- [ ] **Step 5:** Add a lint rule (`scripts/lint_command_tiers.py`)
      — fails if a command file lacks `tier:` frontmatter. Tier-0
      growth is gated by an ADR (no numeric cap; the ADR is the gate).
- [ ] **Step 6:** Outcome check — a new contributor running
      `./agent-config --help` sees ≤ Tier-0 commands and can complete
      `init → sync → validate → work` without reading docs. Manual
      verification, recorded in Notes.

## Phase 5: MCP Lite vs Full boundary + Changelog hygiene

> Step 2 (the original `mcp_scope:` tagging) moved to Phase 1 Step 6
> to avoid retroactive rework of Phase 1's MCP docs (per council
> finding Anthropic). Phase 5 keeps the **boundary definition** and
> the changelog work.

- [ ] **Step 1:** Define the MCP Lite vs Full boundary in
      `docs/contracts/mcp-cloud-scope.md` — Lite = read-only knowledge
      surfaces (skills / rules / docs index, no tool execution, no
      writes), Full = MVP-2+ (tool execution, auth, write paths). Cite
      Invariant 8 explicitly. README MCP section calls out the active
      scope (the per-file tagging itself lives in Phase 1 Step 6).
- [ ] **Step 2:** Split `CHANGELOG.md` into eras: `## Era: pre-2.2.0`
      (collapsed, link to history), `## Era: 2.2.x` (current, full
      entries). Future eras are added at the next major shift.
- [ ] **Step 3:** Add a `CHANGELOG-conventions.md` under
      `docs/contracts/` — entry shape, what counts as breaking, link
      back from CHANGELOG header. No retroactive rewrite of older
      entries; only the split + future discipline.
- [ ] **Step 4:** Drift test — `tests/test_changelog_eras.py` fails
      if the current era grows past 200 lines without a new era split
      (forces the conversation; no auto-rotation).

## Council verdicts

### Composer fallback (2026-05-13)

- **Session:** `agents/council-sessions/20260513T090143Z-composer-fallback.json` (gitignored).
- **Members:** anthropic/claude-opus-4-1, openai/o1.
- **Caveat:** o1 returned empty text — `max_tokens=1024` was consumed
  by reasoning tokens. Single-voice verdict (Anthropic only).
- **Anthropic verdict:** `recommend-reject`. `installed.lock` is
  npm-shaped (flat dep model). Composer would require either a
  parallel manifest (breaks "lock is canonical" from ADR-007) or
  translation logic (defeats "minimal" claim). Dual distribution
  doubles SBOM / CVE / signing infrastructure.
- **Anthropic recommendation:** Option 4 (CI-safe install pattern)
  via `scripts/hermetic-install.sh` — `npm pack` → checksum verify →
  `install.py --offline`. Extend `installed.lock` with
  `installation_mode: hermetic`, `package_checksum`,
  `signature_verified`.

| # | Finding | Host verdict | Lands in |
|---|---|---|---|
| 1 | Reject Composer fallback | `accept` | Locked decisions block + Phase 2 prose |
| 2 | Replace with `hermetic-install.sh` | `accept-with-modification` | Phase 2 Step 5 |
| 3 | Extend `installed.lock` schema | `needs-input` | Phase 2 Step 5 (d) flagged ADR-candidate |

### Roadmap review (2026-05-13)

- **Session:** `agents/council-sessions/20260513T090314Z-distribution-maturity.json` (gitignored).
- **Members:** anthropic/claude-opus-4-1, openai/o1. Both returned.

**Convergent findings (both members):**

- "No version pinning" language contradicts Phase 2 pinned-npx
  documentation.
- Council verdict ambiguity (`maybe` / partial) not covered by
  Phase 0.
- Phase 2 Step 5 was untestable as drafted ("scaffold with hard-floor
  scope" — no acceptance criteria).

**Divergent findings:**

- **Anthropic:** Phase 0 Council loop was circular — council reviewed
  a roadmap with frozen decisions, "fold convergent findings in"
  created a version fork.
- **o1:** Phase 1 contract-drift test was one-directional
  (README → contract only).

**Unique findings (Anthropic):**

- Phase 5 `mcp_scope:` tagging would retroactively force rework of
  Phase 1 MCP doc edits.
- Tier-0 ≤ 12 cap was arbitrary, no rationale.
- Acceptance criteria tested table-stakes (`task ci` green), not
  outcomes ("Enterprise can work offline").
- No cross-phase integration test.

**Unique findings (o1):**

- Phase 2 hermetic-install may generate new commands → Phase 4
  Tier-targets need an extension path.

| # | Finding | Host verdict | Lands in |
|---|---|---|---|
| 1 | Phase 0 council loop circular | `accept` | Phase 0 restructured (steps 1–3 + 5 marked done; this revision IS the fold-in) |
| 2 | Phase 5 MCP tagging breaks Phase 1 retroactively | `accept` | `mcp_scope:` tagging pulled forward to Phase 1 Step 6 |
| 3 | "No version pinning" language unclear | `accept` | Locked decisions block reworded (release vs consumer pinning) |
| 4 | Phase 2 Step 5 untestable | `accept` | Step 5 now has four sub-acceptance criteria + Step 7 outcome check |
| 5 | Council "maybe" handling missing | `accept` | New Phase 0 Step 6 (ambiguity handling) |
| 6 | Contract-drift test one-directional | `accept` | Phase 1 Step 4 now bidirectional |
| 7 | Tier-0 ≤ 12 arbitrary | `accept-with-modification` | Numeric cap removed; ADR gates growth |
| 8 | Acceptance criteria too weak | `accept-with-modification` | Outcome criteria added in Phases 2 + 4 + Acceptance criteria block |
| 9 | Cross-phase integration test gap | `needs-input` | Open question recorded in Notes |
| 10 | Baseline CI SHA fillable now | `accept` | Filled in Notes |
| 11 | Phase 2 → Phase 4 tier extension | `accept` | Phase 4 Step 2 now states Tier-2 is default for new commands |

## Acceptance criteria

- [x] Phase 0 council sessions saved + verdicts recorded in this file.
- [ ] All five phases checked off OR explicitly marked
      `[~]` deferred / `[-]` cancelled with a one-line rationale.
- [ ] `task ci` green on the final commit (record SHA in Notes).
- [ ] `task lint-skills`, `task sync`, `task generate-tools` clean
      — no drift between `.agent-src.uncompressed/` and generated
      trees.
- [ ] `agents/roadmaps-progress.md` regenerated, dashboard reflects
      this roadmap's completion.
- [ ] No new always-active rule added (kernel membership unchanged).
- [ ] PR description inlines the two council reports per Phase 0 Step 4.
- [ ] **Outcome — Enterprise/offline:** sandboxed VM with blocked
      egress completes the hermetic-install path end-to-end (Phase 2
      Step 7).
- [ ] **Outcome — Command surface:** a new contributor running
      `./agent-config --help` reads only Tier-0 and completes
      `init → sync → validate → work` without docs (Phase 4 Step 6).
- [ ] **Outcome — MCP claims:** README MCP section makes no claim the
      contract does not authorise; bidirectional drift test green
      (Phase 1 Steps 3–4).
- [ ] **Outcome — Architecture clarity:** the four pipelines each
      have an owning sub-page; pipeline-drift test green (Phase 3
      Step 5).

## Notes

_Filled during execution._

- Baseline CI SHA: `686e4b2d784864caa4066facecc22af23f506ba5` (main @
  2.6.1 merge, 2026-05-13 — fork point for this roadmap branch).
- Final CI SHA: _tbd_.
- Council session (composer): `agents/council-sessions/20260513T090143Z-composer-fallback.json` (gitignored).
- Council session (roadmap): `agents/council-sessions/20260513T090314Z-distribution-maturity.json` (gitignored).
- Convergent findings folded in: see `## Council verdicts` host
  verdict tables (all `accept` rows are folded into the phase prose
  above this section).
- Divergent / unresolved findings:
  - **Cross-phase integration test (council finding #9):**
    `needs-input` — what would the test assert? Candidates: (a) a
    smoke command that exercises one Tier-0 + hermetic-install +
    bidirectional MCP drift + pipeline-drift in one job; (b) a
    per-phase integration test that calls the next phase's gate. Not
    deciding here.
  - **`installed.lock` schema extension (composer finding #3):**
    `needs-input` — adding `installation_mode`, `package_checksum`,
    `signature_verified` is ADR-007-adjacent. Owner: Phase 2 Step 5
    author opens an ADR candidate before scaffolding the new fields.
- o1 caveat (composer call): empty text response at
  `max_tokens=1024`. If a future composer-adjacent question is
  re-posed, raise `--max-tokens` to ≥ 4096 to leave room for output
  after reasoning tokens.
