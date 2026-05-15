# Step 9 — PR #150 Follow-up Hardening

**Status:** open · **Owner:** Matze · **Depends on:** PR #150 merged (✓), Step 8 (parallel, no hard dep)

## Goal

Address the six Claude+GPT follow-up findings from PR #150 plus three user-requested settings-shape changes (CLI-default, preferred single council, low-impact dispatch) in a single sequenced roadmap so implementation can start immediately: docs clarity, CLI-binary UX, doctor-CLI checks, corpus parser hardening, fuzzy matching with safety vetoes, host-agent transparency rule, `/memory learn-low-impact` preview, plus the three settings-shape changes with Anthropic-mandated safeguards (shadow mode, SLO, Iron-Law config validator, airgap detection). Pre-existing `check-no-roadmap-refs` debt cleared in Phase 0 so CI starts green.

## Why

- **C1 (Claude · UX)** `mode: cli` with missing binary silently skips the member. Pre-flight needs an explicit install hint.
- **C2 (Claude · tech debt)** 27 `check-no-roadmap-refs` violations on main — fifth PR mentioning them without cleanup.
- **G1 (GPT · P0 docs)** Default `low_impact.mode = agent`; opt-in to council fast-path is not discoverable.
- **G2 (GPT · P0 corpus robustness)** Markdown corpus parser is fragile against anchor / heading / bullet / timestamp drift.
- **G3 (GPT · P1 matching)** Exact-match misses near-paraphrases (`array_map vs foreach` example).
- **G4 (GPT · P1 transparency)** Fast-path markers can be swallowed by the host agent.
- **G5 (GPT · P1 doctor)** `doctor` ignores CLI transport (binary / auth / parse / quota / billable).
- **G6 (GPT · P2 preview)** `/memory learn-low-impact` has no diff/preview before promotion.
- **U1 (User · settings)** Today every member defaults to `mode: api`. With CLI Transport shipped, the easier onboarding path is CLI-first (subscription-auth, no API key). New global default `defaults.member_mode: cli`, backward-compat preserved via explicit per-member overrides.
- **U2 (User · settings)** No way to designate a preferred single member for cost-efficient routing. Add ordered fallback chain `routing.solo_member_fallback_chain` used by single-mode invocations and (opt-in) low-impact dispatch.
- **U3 (User · settings)** `low_impact.mode = council` always dispatches the full council. Add `low_impact.dispatch: full | single` so users can opt in to cost-efficient single-member dispatch for low-impact decisions, with shadow-mode + SLO safeguards before the choice goes live.

## Non-goals

- No new runtime dependencies. Stdlib only (`difflib.SequenceMatcher`).
- No retroactive edits to PR #150 commits.
- No replacement of the heuristic classifier with an LLM judge.
- No YAML migration of the corpus in this step (deferred to Step 9.1 — see **D2**).
- No new CLI providers, no external service integration.
- Telemetry stays local-only (`agents/council-shadow-log.jsonl`) — no upstream reporting.
- No batch-mode dispatch for low-impact decisions (Anthropic's alternative-to-Q3 proposal). Deferred to Step 9.3 — single-member dispatch with shadow-mode gating ships first per user direction; batching evaluated against measured SLO data afterwards.
- No auto-flip of `low_impact.dispatch` default to `single`. Default stays `full` regardless of shadow results — flip is a separate user decision (Step 9.4).

## Acceptance criteria

- [ ] `check-no-roadmap-refs` reports 0 violations on `main` after Phase 0 lands.
- [ ] `docs/contracts/ai-council-config.md` documents the explicit `low_impact.mode: council` + `participate_low_impact: true` opt-in pattern with a worked example.
- [ ] Pre-flight cost disclosure prints `member X skipped: binary not found, install via <hint>` for every CLI member whose binary is missing.
- [ ] `agent-config doctor` reports per-CLI-member: binary present · auth probe · parse fixture · quota remaining · billable flag.
- [ ] Corpus parser test suite covers: missing anchor, renamed heading, bullet without quotes, duplicate entry, anti-example wrongly under Validated, malformed ISO timestamp, redactor-bypass attempt. Each case has a deterministic error message.
- [ ] Fuzzy matching opt-in via `low_impact.fuzzy_match.enabled: true` (default off). Threshold default `0.92`, configurable. High-impact-trigger veto + anti-example-veto enforced and tested.
- [ ] New rule `.agent-src.uncompressed/rules/fast-path-marker-visibility.md` (Iron-Law) prevents host agents from swallowing `Resolved via low-impact council fast-path: …` markers.
- [ ] `/memory learn-low-impact` accepts `--preview` (default) and `--apply`; preview prints promoted · refused · redaction reasons · source-project-stripped diff · upstream PR body draft.
- [ ] New setting `defaults.member_mode: cli | api` (default `cli`) flips the global default transport. Per-member explicit `mode:` continues to override. Airgapped installs auto-set `api` via installer detection (no DNS resolution to provider hosts).
- [ ] New setting `routing.solo_member_fallback_chain: [provider, ...]` selects the preferred single member for solo-mode dispatch. Disabled members skipped; duplicates rejected at config-load time; all-invalid escalates to full council (does not fail the decision).
- [ ] New setting `low_impact.dispatch: full | single` (default `full`). When `single`, dispatch uses `routing.solo_member_fallback_chain`. Iron Law: `high_impact.dispatch` and `user_required.dispatch` rejected by config validator with explicit error.
- [ ] Shadow-mode logger `agents/council-shadow-log.jsonl` records single-vs-full disagreement rate when `low_impact.dispatch: single` is active. SLO threshold `5%` over 7-day rolling window; above threshold prints warning in pre-flight disclosure.
- [ ] Env var `AGENT_CONFIG_FORCE_FULL_COUNCIL=1` kill-switch overrides `low_impact.dispatch: single` for the current invocation.
- [ ] Migration script `scripts/_cli/cmd_migrate_council_dispatch.py` scans existing `.agent-settings.yml` / `agents/.ai-council.yml`, adds explicit `dispatch: full` where `low_impact.mode: council` is set without `dispatch`. Idempotent.
- [ ] All new tests pass; `task ci` green; no Iron-Law regression.

## Phases

### Phase 0 — Tech-debt cleanup (C2)

- [ ] Audit the 27 `check-no-roadmap-refs` violations on main; categorise (legit reference to archived roadmap · stale pointer · false positive).
- [ ] Replace stale pointers with stable artefact references per `.augment/rules/no-roadmap-references.md`; whitelist any legit archived-roadmap references in the linter.
- [ ] Single commit on main: `chore(lint): clear pre-existing check-no-roadmap-refs violations`.
- [ ] CI gate: linter `check-no-roadmap-refs` now blocks PRs (was reporting-only).

### Phase 1 — Docs clarity (G1)

- [ ] Add `docs/contracts/ai-council-config.md` section "Low-impact council opt-in" with the full snippet (`decision_resolution.classes.low_impact.mode = council` + per-member `participate_low_impact: true`).
- [ ] Update `.agent-src.uncompressed/skills/ai-council/SKILL.md` to cross-reference the opt-in pattern.
- [ ] `agents/.ai-council.yml` example header gets a comment block calling out the default-agent vs opt-in-council distinction.

### Phase 2 — CLI-binary UX hint (C1)

- [x] In `scripts/council_cli.py` pre-flight (`cmd_estimate` / `cmd_ask` / `cmd_debate`), detect `binary_missing` skips via the `build_members` `skipped` list and print one line per skipped CLI member with install hint sourced from `scripts/ai_council/cli_hints.py`.
- [x] Install-hint table lives in `scripts/ai_council/cli_hints.py` (new, small): `{provider: (binary, docs_url, install_one_liner)}`.
- [x] Unit tests in `tests/test_cli_install_hints.py`.

### Phase 3 — Doctor CLI checks (G5)

- [ ] `scripts/_cli/cmd_doctor.py` (or equivalent) gains `_check_cli_council()`: per provider with `mode: cli`, run binary `--version`, auth probe (cached), parse a stored fixture, read `cli-calls.json` for quota state, surface `billable` flag from config.
- [ ] Output one table row per CLI member with status icons (✅ / ⚠️ / ❌) and short reason.
- [ ] Integration test `tests/test_doctor_cli_council.py`.

### Phase 4 — Corpus parser hardening (G2)

- [ ] New test file `tests/test_low_impact_corpus_robustness.py` — seven failure-mode fixtures under `tests/fixtures/corpus-robust/` (one per case in AC).
- [ ] Harden `scripts/ai_council/low_impact_corpus.py` (or wherever the parser lives) to raise typed errors (`CorpusParseError` with `reason` field), not silent skip.
- [ ] Document the contract in `docs/contracts/low-impact-corpus-format.md` (parser-visible invariants).

### Phase 5 — Fuzzy matching with safety vetoes (G3)

- [ ] Add `classify_impact_with_corpus_fuzzy()` in `scripts/ai_council/low_impact.py` using `difflib.SequenceMatcher.ratio()`.
- [ ] Opt-in config `low_impact.fuzzy_match.{enabled,threshold}` (defaults `false`, `0.92`).
- [ ] High-impact-veto: any token from `HIGH_IMPACT_TRIGGERS` in the query short-circuits to `high_impact` regardless of similarity (Iron Law preserved).
- [ ] Anti-example-veto: if `max_similarity(anti_examples) >= max_similarity(validated)`, reject the match.
- [ ] Tests in `tests/test_fuzzy_corpus_match.py` — including the `array_map vs foreach` example.

### Phase 6 — Host-agent transparency Iron-Law rule (G4)

- [ ] New rule `.agent-src.uncompressed/rules/fast-path-marker-visibility.md` (always-active, kernel-tier).
- [ ] Iron Law: host agent MUST surface the fast-path marker verbatim in the reply opening.
- [ ] Mirror to `.agent-src/`, regenerate `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` via `task sync && task generate-tools`.

### Phase 7 — `/memory learn-low-impact --preview` (G6)

- [ ] Default invocation switches to `--preview`; `--apply` required to actually promote.
- [ ] Preview output: promoted entries · refused entries with redaction reason · source-project-stripped diff · upstream PR body draft.
- [ ] Tests in `tests/test_learn_low_impact_preview.py`.

### Phase 8 — Config schema for the three new settings (U1 · U2 · U3)

- [ ] Extend `scripts/ai_council/config.py` (or equivalent loader) with three new typed sections:
  - `defaults.member_mode: Literal["cli", "api"]` (default `cli`).
  - `routing.solo_member_fallback_chain: list[str]` (default `[]`; empty = solo-mode unavailable).
  - `low_impact.dispatch: Literal["full", "single"]` (default `full`).
- [ ] Config validator additions (fail at load time, do not silent-skip):
  - **Iron Law:** reject `high_impact.dispatch` and `user_required.dispatch` keys with explicit error message ("dispatch is not configurable for high-impact / user-required decisions — always full council").
  - Reject duplicates in `routing.solo_member_fallback_chain`.
  - Reject `low_impact.dispatch: single` if `routing.solo_member_fallback_chain` is empty or contains only disabled members.
  - Warn (not error) if `defaults.member_mode: cli` is set but no CLI binary is detectable for any configured member.
- [ ] Migration script `scripts/_cli/cmd_migrate_council_dispatch.py` — idempotent; backs up the edited file with `.bak` suffix; logs every change to stdout.
- [ ] Docs: extend `docs/contracts/ai-council-config.md` with the full three-setting matrix (default value · constraint · interaction with existing keys).
- [ ] Tests `tests/test_config_dispatch_validation.py` — every reject path has a fixture, every warn path has a fixture.

### Phase 9 — Solo-member dispatch logic (U2)

- [ ] New module `scripts/ai_council/solo_dispatch.py`:
  - `select_solo_member(chain, enabled_members, auth_cache)` returns first chain entry where `enabled=True` and auth is cached-valid; `None` if none.
  - Auth check: lazy (first invocation per session), cached 15 minutes, timeout `routing.auth_check_timeout_seconds` (default `3`).
  - All-invalid → escalate to full council, log `WARN: solo dispatch unavailable, escalating to full council`. **Do not fail the decision.**
- [ ] Wire `select_solo_member` into `scripts/ai_council/orchestrator.py` for single-mode invocations and (when `low_impact.dispatch: single`) for the low-impact path.
- [ ] CLI flag `--single` for `python3 scripts/council_cli.py run` — forces solo dispatch regardless of `low_impact.dispatch`.
- [ ] Env var `AGENT_CONFIG_FORCE_FULL_COUNCIL=1` overrides every solo-dispatch path back to full council for the current invocation.
- [ ] Tests `tests/test_solo_dispatch.py` covering: happy path · first-member auth-invalid → fallback · all-invalid → full-council escalation · disabled-member skip · timeout · env-var override.

### Phase 10 — Shadow-mode + SLO enforcement (U3 safety net)

- [ ] When `low_impact.dispatch: single` is active and shadow mode opt-in `low_impact.shadow_sample_rate: 0.0–1.0` (default `0.1`) fires, dispatch the same decision to both solo member and full council. Log to `agents/council-shadow-log.jsonl` (one JSONL row per shadowed decision: timestamp · query-hash · solo-verdict · full-verdict · agreed: bool · source-project-stripped).
- [ ] Privacy: shadow log is subject to the same `low-impact-corpus-privacy-floor.md` rules — redactor-refused entries are dropped, not softened.
- [ ] New CLI `python3 scripts/council_cli.py shadow-report` reads `council-shadow-log.jsonl`, computes 7-day rolling disagreement rate, prints SLO status (`OK <5%` / `WARN 5–8%` / `BREACH >8%`).
- [ ] Pre-flight cost disclosure surfaces SLO status when `low_impact.dispatch: single` is active. `WARN` and `BREACH` both print a one-line recommendation.
- [ ] **No auto-flip back to `full`.** Default flip / revert is a user decision, scheduled separately in Step 9.4. This phase delivers the data; humans decide.
- [ ] Tests `tests/test_shadow_dispatch.py`: shadow-log writes · disagreement-rate computation · SLO threshold transitions · pre-flight banner rendering · privacy-redactor integration.

### Phase 11 — Iron-Law config validator + airgap detection (U1 · U3 safeguards)

- [ ] Iron-Law tests `tests/test_iron_law_config.py`:
  - `high_impact.dispatch: single` → config-load rejects with explicit error.
  - `user_required.dispatch: single` → rejects.
  - `decision_resolution.classes.high_impact.dispatch` (nested form) → rejects.
  - Smuggled-in dispatch via `!include` / `<<:` YAML anchors → rejects.
- [ ] Airgap detection in installer / first-run: probe DNS for `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com` with 1s timeout per host. All fail → auto-set `defaults.member_mode: api` in generated config with banner: `airgapped environment detected — defaulting to mode: api`.
- [ ] Tests `tests/test_airgap_detection.py` covering: all-reachable → `cli` · all-unreachable → `api` · partial-reachable → `cli` (single working CLI is enough).
- [ ] Update `scripts/audit_cloud_compatibility.py` to flag any new code path that bypasses the Iron-Law validator.

### Phase 12 — Final wire-up

- [ ] Regenerate `.agent-src/`, `.augment/`, multi-tool projections.
- [ ] `agents/roadmaps-progress.md` regenerated.
- [ ] `CHANGELOG.md` entry under the 2.13.x current era — call out the three new settings with the explicit "Iron Law: high-impact dispatch not configurable" line.
- [ ] `task ci` green.

## Decisions (resolved via AI Council, analysis lens)

Council artefacts: PR-#150 review (two rounds, OpenAI both, Anthropic 529 both) and a settings-shape round (both members responded — Anthropic detailed pushback in Round 2) under `agents/council-sessions/` (gitignored).

**D1 — Single Step 9 roadmap, twelve phases (Q1=A + user addendum).** Two roadmaps would split tightly-coupled work (G2 parser hardening and G3 fuzzy match share the corpus surface; U1/U2/U3 share the config-validator surface). C2 lands as Phase 0 prerequisite, not standalone — so CI starts green for the rest. User-requested settings (U1/U2/U3) fold into Phases 8–11, not a separate Step 10, because they share the same config-loader edit window and would otherwise touch the same files twice.

**D2 — G2 = MD + hard parser tests in Step 9; YAML migration deferred to Step 9.1 (Q2=A, with B queued).** Full YAML migration is heavy (existing Validated entries, MD-as-view generator, redactor re-wiring). Parser hardening + typed errors + fixture suite eliminates the immediate fragility; YAML can land later without breaking consumers.

**D3 — G3 = `difflib.SequenceMatcher` ≥ 0.92, opt-in, with high-impact-veto + anti-example-veto (Q3=B).** Stdlib (no new dep), bounded extension of current logic, Iron Law preserved by veto. Default `false` so behaviour is unchanged for existing users.

**D4 — C2 folded as Phase 0, not standalone micro-roadmap.** GPT verdict: integrate tech debt into regular cycles, not separate procedures. Phase 0 single commit on main is the cleanest landing.

**D5 — Anthropic cross-validation for PR-#150 round deferred to Step 9.2 follow-up.** PR-#150 council runs hit `OverloadedError 529`. Settings-shape round (Anthropic Round 2 detailed review) is captured and folded in below (D7–D12). Step 9 is not blocked by either.

**D6 — G4 (fast-path marker visibility) lands as kernel-tier Iron-Law rule, not soft convention.** Otherwise host agents will swallow it. Mirrors the pattern of `ask-when-uncertain`, `non-destructive-by-default`.

**D7 — U1 (CLI-default) flips immediately to `cli` in Step 9 Phase 8 (user-direction over Anthropic's "defer to Step 10").** User explicitly stated CLI-first onboarding is the goal of this round. Anthropic's risk callouts (airgapped envs, wrong-GCP-project routing) are absorbed via Phase 11 airgap detection and the Phase 8 config-load warning, not by deferring the flip. Backward compat preserved via explicit per-member `mode:` override path documented in Phase 1.

**D8 — U2 (preferred single member) = Anthropic Round 2 verdict adopted verbatim — `routing.solo_member_fallback_chain` ordered list, escalate-to-full-council on all-invalid, duplicates rejected at load time, 15-minute auth cache, 3s timeout per probe.** Naming chosen over `solo_member_priority` because "fallback chain" conveys both ordering and graceful degradation. `--single` CLI flag added for ad-hoc invocations so the same setting serves both routing.solo and ad-hoc paths.

**D9 — U3 (low-impact dispatch) ships with default `full`, not `single` (Anthropic + GPT both insisted, user goal preserved via opt-in path).** Default `single` would be a silent backward-compat break for every existing `low_impact.mode: council` user. Migration script (Phase 8) adds explicit `dispatch: full` to existing configs so the new key never appears implicit. User cost-efficiency goal is achieved via opt-in `dispatch: single`, gated by shadow-mode telemetry (Phase 10).

**D10 — Shadow-mode is mandatory when `low_impact.dispatch: single` is active, but DOES NOT auto-revert (Anthropic asked for auto-revert, rejected here).** Shadow log + SLO report give the user evidence; the flip back to `full` is a human decision, not an automated one. Reason: auto-revert in the dispatch layer creates a third operational mode at runtime that's hard to debug. Visibility-first, action-second matches the rest of the agent-config safety model.

**D11 — Batch-mode dispatch (Anthropic's alternative-to-Q3 proposal) deferred to Step 9.3 follow-up.** Anthropic argued batching is a strict-better cost optimisation than single-member dispatch (`3× / 10 = 0.3×` per decision vs `1×` per decision). Valid argument, but: (a) user explicitly asked for single-member dispatch, not batching; (b) batching requires orchestrator changes well beyond the scope of this step; (c) shadow-mode data from Phase 10 will inform whether single-member quality is good enough or batching is needed. Re-opened in Step 9.3 with measured data, not speculation.

**D12 — Iron-Law-test phase (Phase 11) is non-negotiable, even though user did not explicitly ask for it.** Anthropic Round 2: "If this test doesn't exist, the Iron Law is a hope, not a guarantee." Config validator must reject `high_impact.dispatch` / `user_required.dispatch` with the same hardness as `non-destructive-by-default` rejects bulk-deletion in autonomous mode. Tests live in `tests/test_iron_law_config.py` and `task ci` blocks on them.
