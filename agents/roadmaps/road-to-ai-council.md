# Road to AI Council

**Status:** Phase 1 COMPLETE (A1.1–A8.5 + A1.2 landed 2026-05-02 via Q44). Phase 2+ remain capture-only.
**Started:** 2026-05-02
**Trigger:** Maintainer asked for an `/optimize`-style command that lets the agent consult external AIs (ChatGPT, Claude.ai) outside its own session — to evaluate PRs, score planned changes, propose optimizations, and cross-check ideas without polluting them with the host agent's framing. Pattern the maintainer currently runs by hand in chat.
**Mode:** Phase 1 (A1–A8) is the visible plate (MVP); Phase 2+ stay capture-only until Phase 1 ships a working stdio round-trip in at least one consumer project.

## Purpose

Give the agent **a small council of external AIs** it can poll for second opinions on:

- A free-form optimization prompt ("does this caching strategy hold up?")
- A drafted roadmap (so we can ask GPT and Claude to challenge the plan before execution)
- A PR diff or commit range
- A design idea before implementation
- A change request before merging

Council members are **neutrally framed** — they do not see the host agent's reasoning, only the artefact (roadmap, diff, prompt) plus a pinned system prompt that asks them to think independently. The host agent then summarises the divergent + convergent points back to the user.

## Design anchors (locked, not open for renegotiation)

These are **not** open questions — they are decisions inherited from existing patterns in this repo.

| Anchor | Source | Decision |
|---|---|---|
| Token storage | `scripts/install_anthropic_key.sh` + `skill_trigger_eval.py` | Tokens live in `~/.config/agent-config/<provider>.key` mode 0600. **Never** in `.agent-settings.yml`. **No** env-var fallback. Each provider gets its own `install_<provider>_key.sh` with `/dev/tty` enforcement. |
| Settings layer | `.agent-settings.yml` § cost_profile | Settings file holds **model names + feature flags only**. Project setting overrides personal setting overrides built-in default. |
| Client abstraction | `AnthropicRouter` class in `skill_trigger_eval.py` | New `scripts/ai_council/clients.py` with `ExternalAIClient` ABC + `OpenAIClient`, `AnthropicClient` impls. Tests inject mock clients, never hit the real API. |
| Cost profile gating | `cost_profile` in `.agent-settings.yml` | Council is a **`full` profile** feature (opt-in). `minimal` and `balanced` ship the docs and CLI, but the runtime hooks are inactive until a council member is configured. |
| Hard Floor | `non-destructive-by-default.md` | Council can **read** project files and produce text. It **never** edits files, opens PRs, or merges. Output is always advisory, presented to the user, who decides. |

## Horizon (6-week visible plate)

**Inside the plate (this 6-week window):**

- Phase 1 (A1–A8) — MVP: OpenAI key script, `ai_council` Python module (clients · orchestrator · context bundler), `/council` command with prompt + roadmap + diff input modes, supporting skill, mock-based test suite. Estimated 2–3 dev days.

**Outside the plate (capture-only, gated on Phase 1 evidence):**

- Phase 2 (B1–B4) — Hooks into existing commands (`/roadmap-create`, `/create-pr`, `/review-changes`, `/feature-plan`).
- Phase 3 (C1–C4) — Specialised council modes (`/council-pr`, `/council-design`, `/council-optimize`, neutrality prompts library).
- Phase 4 (D1–D4) — Multi-round debate, council session persistence, cost-budget guard, smart diff-context selection.

Phase 2+ stay capture-only until Phase 1 lands a working round-trip — no scope creep before evidence.

## Why this is a separate roadmap

`subagent-orchestration` skill already covers **internal** multi-agent workflows (Augment-as-implementer + Augment-as-judge). This roadmap addresses the **external** case: networked calls to OpenAI / Anthropic APIs from inside the agent's session. Different trust boundary, different cost model (real money per call), different failure modes (network, rate limit, refusals), different security posture (secrets handling, redaction). Folding this into `subagent-orchestration` would conflate the two.

## Phase 1 — MVP (visible plate)

> Granularity: F-step level, each row is a single PR-able commit. All `[ ]` until executed.

### A1 — OpenAI key install script

- [x] **A1.1** Add `scripts/install_openai_key.sh` mirroring `install_anthropic_key.sh` exactly: `/dev/tty` enforcement, 0600 mode, atomic write, format check (`sk-` prefix), overwrite confirmation. **No** `--force`, **no** `--yes`, **no** env-var bypass.
- [x] **A1.2** Add `tests/test_install_openai_key.sh` **and** `tests/test_install_anthropic_key.sh` — contract-grep matrix (mode 0600, `/dev/tty` enforcement, atomic write, format check, no env-var bypass, post-install opt-in hint) + a `setsid`-gated no-tty behaviour test. Wired into `task test`, `task test-install`, and `.github/workflows/tests.yml`. *(Q44 resolved 2026-05-02 → both written together; mirroring made sense once the tests covered an Iron-Law security surface.)*
- [x] **A1.3** Update `docs/customization.md` and the new council docs section with the install path.

### A2 — `ai_council` Python module skeleton

- [x] **A2.1** Create `scripts/ai_council/__init__.py`, `clients.py`, `orchestrator.py`, `bundler.py`, `prompts.py`.
- [x] **A2.2** `clients.py`: `ExternalAIClient` ABC with `name`, `model`, `ask(system_prompt, user_prompt, max_tokens) -> CouncilResponse`. Concrete `OpenAIClient` and `AnthropicClient`. Real SDKs are **soft** dependencies (same pattern as `skill_trigger_eval.py`).
- [x] **A2.3** Key loaders: `load_openai_key()`, reuse `load_anthropic_key()`. Both refuse anything outside the 0600 contract; fail loud.
- [x] **A2.4** `CouncilResponse` dataclass: `provider`, `model`, `text`, `input_tokens`, `output_tokens`, `latency_ms`, `error: str | None`.

### A3 — Settings schema extension

- [x] **A3.1** Extend `config/agent-settings.template.yml` with an `ai_council` section: `enabled: bool`, `members: { anthropic: { model, enabled }, openai: { model, enabled } }`, `cost_budget: { max_tokens_per_session, max_calls_per_session }`. **No tokens** in this section — it would be a security regression.
- [x] **A3.2** Update `scripts/sync_agent_settings.py` to merge the new section without clobbering user values. *(No code change needed — the existing generic deep-merge picks up new template sections automatically; verified via `--dry-run`.)*
- [x] **A3.3** Document the section in `docs/customization.md` and link from `docs/getting-started.md`.

### A4 — Context bundler

- [x] **A4.1** `bundler.py` API: `bundle_prompt(text)`, `bundle_roadmap(path)`, `bundle_diff(base_ref, head_ref)`, `bundle_files(paths)`. Each returns a `CouncilContext` dataclass with the artefact text + a manifest of what was included.
- [x] **A4.2** Redaction pass: strip `~/.config/agent-config/*.key` paths, env vars matching `*TOKEN*`/`*SECRET*`/`*KEY*`, and any line containing `Authorization:`. Tests cover each pattern.
- [x] **A4.3** Size guard: if bundle > 50 KB, refuse and ask the user to narrow scope. No silent truncation (would mislead council members).

### A5 — Orchestrator

- [x] **A5.1** `orchestrator.py`: `consult(context, question, members) -> list[CouncilResponse]`. Fans out in parallel using `concurrent.futures`, normalises errors per member, never lets one provider's failure block the others.
- [x] **A5.2** Neutrality system prompt template in `prompts.py`: "You are an independent reviewer. You have NOT seen any prior agent reasoning on this artefact. Critique on its own merits. Disagree if warranted." Plus per-mode system-prompt variants (roadmap, diff, prompt).
- [x] **A5.3** Cost-budget enforcement: hard cap from settings, abort run if next call would exceed.

### A6 — `/council` command

- [x] **A6.1** `.agent-src.uncompressed/commands/council.md` with frontmatter, four input modes:
      `prompt:"…"`, `roadmap:agents/roadmaps/foo.md`, `diff:base..head`, `files:path,path`.
- [x] **A6.2** Step list: load settings → check at least one member enabled (else exit gracefully with the install instructions) → bundle context → call orchestrator → render comparison report (per-member columns: agreements, divergences, suggested actions) → ask user how to act.
- [x] **A6.3** Hard Floor restated in command frontmatter: command produces text only, never edits or pushes.

### A7 — Supporting skill

- [x] **A7.1** `.agent-src.uncompressed/skills/ai-council/SKILL.md`: when to invoke, neutrality guidelines, anti-patterns (e.g. "do NOT paste the host agent's analysis into the system prompt"), redaction expectations, cost awareness.
- [x] **A7.2** Cross-link from `subagent-orchestration` skill ("for the external/networked variant, see `ai-council`").

### A8 — Tests + CI

- [x] **A8.1** `tests/ai_council/test_clients.py` — ABC contract, mock SDK responses, error normalisation.
- [x] **A8.2** `tests/ai_council/test_bundler.py` — redaction matrix, size guard, manifest correctness.
- [x] **A8.3** `tests/ai_council/test_orchestrator.py` — parallel fan-out, partial-failure handling, cost-budget abort.
- [x] **A8.4** `tests/ai_council/test_prompts.py` — neutrality prompt covers all four modes; system prompt does **not** leak the host agent's identity.
- [x] **A8.5** Wire into `task ci` — the council suite must run with mocks, never the real API. *(`task test` already discovers `tests/ai_council/`; added dedicated `task test-ai-council` for parity with sibling targets.)*

## Phase 2 — Integration hooks (capture-only)

- [ ] **B1** Hook `/roadmap-create`: after writing the roadmap file, if any council member is enabled, ask "Möchtest du diese Roadmap mit dem Council abgleichen? (1 ja / 2 nein)". User picks; if yes, run `/council roadmap:<path>` and append findings to the roadmap as a "Council review" section.
- [ ] **B2** Hook `/create-pr`: after the PR body is drafted, offer council review of the diff before posting.
- [ ] **B3** Hook `/review-changes`: parallel external review alongside the four internal judges.
- [ ] **B4** Hook `/feature-plan`: idea-validation prompt before writing the plan.

## Phase 3 — Specialised council modes (capture-only)

- [ ] **C1** `/council-pr <number>` — pulls PR via gh CLI, runs council with PR-specific neutrality prompt, posts a comment summary (read-only by default; user opts in to post).
- [ ] **C2** `/council-design <doc>` — design-pattern critique with architecture-focused system prompt.
- [ ] **C3** `/council-optimize <target>` — brainstorming mode (lower temperature constraint, broader prompt).
- [ ] **C4** Library of neutrality system prompts under `scripts/ai_council/prompts/` — versioned, testable.

## Phase 4 — Advanced (capture-only)

- [ ] **D1** Multi-round debate: host agent as moderator; council members see each other's responses on round 2 with explicit instructions to either defend or update.
- [ ] **D2** Council session persistence under `agents/council-sessions/<timestamp>/` — full replay log + audit trail.
- [ ] **D3** Cost-budget guard with per-day rolling limit (in addition to per-session cap).
- [ ] **D4** Smart diff-context selection — only files referenced in the diff plus their direct dependencies, never whole-repo dumps.

## Decisions (resolved 2026-05-02)

All five Phase-1 design questions are closed. Trace: `agents/roadmaps/archive/open-questions-3.md` Q45–Q49.

1. **Council member roster for v1.** ✅ Anthropic + OpenAI only. `ExternalAIClient` ABC stays open for a third provider; no extra client lands until evidence demands it. *(Q45)*
2. **Default `enabled` state in settings.** ✅ Explicit opt-in. Key install is infrastructure, not permission to spend. Each `install_<provider>_key.sh` prints a hint pointing the user at `ai_council.members.<provider>.enabled` in `.agent-settings.yml`. *(Q46)*
3. **Phase-2 hook UX.** ✅ Always-Ask after every hookable event, suppressed under `personal.autonomy: on` (council is billable; autonomy must not silently spend tokens). Implemented when Phase 2 unblocks. *(Q47)*
4. **Output rendering format.** ✅ Stacked sections per member + final "Convergence / Divergence" summary written by the host agent. Robust across terminal widths, preserves per-member wording for audit. *(Q48)*
5. **Roadmap-mode behaviour.** ✅ Roadmap-only with a manifest listing what was *not* included. Users opt in to expansion via `/council files:<paths>`. More context = more cost + more bias surface. *(Q49)*

## Why now

The maintainer is already running this pattern manually (copy roadmap into ChatGPT, paste reply back). Automating it captures the workflow before it calcifies into 17 different ad-hoc prompts and turns the "neutral second opinion" into a first-class artefact the agent can request. Phase 1 ships the smallest version that proves the round-trip; Phase 2+ wait for evidence.
