---
status: ready
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to team mode — govern the official cross-model pair, don't rebuild it

> Source-level comparison against **`openai/codex-plugin-cc`** (official OpenAI
> plugin for Claude Code, Apache-2.0, 27.7k★, last pushed 2026-07-08) — both
> trees verified at HEAD this session (agent-config + upstream, 2026-07-12).
> Trigger was an external, anonymized setup guide (see Provenance) describing a
> "two strongest models, one team" workflow: one model builds, a second
> reviews, via `/codex:review`, adversarial review, an experimental stop-hook
> Review Gate, and `/codex:rescue` delegation — subscription-authed, zero
> marginal API cost. The plugin is real, official, and actively maintained
> (8 slash commands, a companion-script + app-server broker, a proactive
> `codex-rescue` agent, a Stop-hook Review Gate). This roadmap **adopts it as
> the Claude-Code transport** for a new governed **team mode** — the depth
> complement to the council's breadth — and owns exactly the three things the
> plugin does not: multi-host reach, cost/loop governance, and a measured
> defect-finding verdict.

## Goal

Land a default-off `/team` capability family next to `/council`: (1) doctor +
wizard detection and guided setup of the official plugin on Claude-Code hosts,
(2) a host-neutral `/team` command family that delegates to `/codex:*` where
the plugin exists and falls back to the existing `OpenAICliClient`
repo-context path elsewhere, (3) governed Review-Gate policy (loop bound,
ledger visibility, doctor warning), and (4) a three-arm defect-finding
benchmark (cross-model team review vs. single-model adversarial self-review
vs. `council:pr`) whose verdict gates every public claim about the feature.

## Prerequisites

- [ ] Read `AGENTS.md`, `src/skills/ai-council/SKILL.md`,
      `docs/contracts/ai-council-config.md`
- [ ] `codex` CLI installed + `codex login`-authed on the maintainer machine
      (needed for Phase 2 smoke runs and Phase 5 benchmark arms)
- [ ] Confirm the fake-client seam in `tests/scripts/ai_council/_harness.ts`
      is reusable for the Phase 3 fallback-path tests (no billable calls in CI)

## Context — why team is not council

The council (`src/scripts/ai_council/`) is **breadth under a neutrality
contract**: N members receive the artefact text plus a neutral preamble, never
the repo, never the host's framing (`src/skills/ai-council/SKILL.md` §
neutrality — "the council members never see the host agent's reasoning"), one
round by default, budget-guarded, defaulting to mid-tier models
(`DEFAULT_OPENAI_MODEL = 'gpt-4o'`, `clients.ts:69`).

Team mode is the inverse on every axis: **depth with full repo access**. The
plugin's reviewer runs the Codex CLI *inside the working tree* — it reads git
state itself (`commands/review.md`: scope resolution over `git status` /
`git diff`), iterates build→review→fix, and runs under the user's ChatGPT
subscription, which makes the *strongest* available model the rational default
rather than a cost decision. That is the user-visible contrast this roadmap
encodes: council = many cheap neutral opinions on an artefact; team = one
strong opinionated reviewer in the repo. Neither replaces the other; the
council's neutrality contract is textually **untouched** by every phase below.

What already exists on our side (verified this session — reuse, do not
duplicate): a subscription-authed codex transport (`OpenAICliClient`,
`codex exec --json`, `clients.ts:1260ff`, `default_binary = 'codex'` at
`clients.ts:1262`) with per-provider daily quota (`cli_call_budget`); doctor
knowledge of the codex **binary** (`cmd_doctor.ts:1745 openai: ['codex',
false]`); single-strong-call dispatch (`solo_dispatch.ts`); Stop-hook
infrastructure (`hook_manifest.yaml`, `claude_settings_hooks.ts`, consumer
`Stop` arrays); and a single-model adversarial-review skill (Attack-Defend-
Revise, `src/skills/adversarial-review/SKILL.md`).

### Priors that constrain this work (recorded locks — mechanism-matched)

These are settled internal nulls. Team mode differs from each in
**mechanism**, so none is an automatic block — but each is a real risk this
roadmap clears with evidence, not assertion (per `decision-revisit-gate`):

- **flow-learnings two-host matrix = HONEST-NULL** (2026-07-10, PR #877):
  cross-host *subagents doing the work* showed no lift (codex-as-worker
  capability ≈ 0). Team mode's **review** lens uses the strong model as a
  reviewer, not a worker — different mechanism, not covered. But the null
  **does** cover the **worker-via-bundle fallback delegate** (Phase 3) — that
  path is exactly codex-as-worker on a non-Claude-Code host, so it stays
  deferred/gated. The plugin's own `/codex:rescue` (Phase 2) runs natively in
  the repo under Codex, a different mechanism the null does not touch.
- **ADR-109 §4 cross-host subagent degradation** — same reviewer-vs-worker
  distinction; constrains the fallback delegate, not the review lens.
- **recursive-verification honest-null** (redundant with always-on rules,
  TERMINAL): a *self*-check recursion. The auto **Review-Gate** is a
  *cross-model* external check, not self-recursion — different mechanism — but
  it shares the failure shape (unbounded loops). Combined with the plugin's
  own cost-loop warning, the Review-Gate ships **off by default**, opt-in,
  loop-budget-capped.
- **subagents Claude-only / provider-budget-balancer KILLED** — team mode
  *deliberately* uses a cross-provider strong pair; the constraint that
  applies is **cost/limits**, handled by defaulting to the `cli`
  (subscription, non-billable through this process) transport plus a hard loop
  budget.

## Gap-table (source-derived — audit before drafting, rule 19a)

| Upstream / trigger item | Verdict | Evidence |
|---|---|---|
| Official plugin as the Claude-Code transport (install, broker, background jobs) | **KEEP (adopt, not rebuild)** | OpenAI-maintained, high PR velocity; rebuilding the companion/broker duplicates a moving upstream — the PR-#837 anti-pattern |
| Guided setup: detect plugin + codex auth, recommend on Claude-Code hosts | **KEEP** | doctor knows the codex *binary* (`cmd_doctor.ts:1745`) but nothing checks the *plugin*; wizard/init has zero plugin awareness |
| Host-neutral `/team` family (`review`, `adversarial`, `delegate`, `status`) | **KEEP** | no team/pair concept exists in `src/domains/`; `/codex:*` is host-locked to Claude Code |
| Non-Claude-Code fallback via `OpenAICliClient` + repo-diff bundle (review lens) | **KEEP** | the only path to team-review parity on Cursor/Augment/Copilot; transport exists (`clients.ts:1260`), the diff-bundle prompt does not |
| Review-Gate loop bound + ledger visibility | **KEEP** | absent upstream (hook blocks unbounded); our Stop-hook dispatch + events ledger are the natural home |
| Strong-model contract (`ai_team.model`, default `auto` = CLI default) | **KEEP** | encodes the council-vs-team contrast; `auto` delegates the "strongest" choice to the codex CLI instead of pinning a stale ID like `clients.ts:1274` does today |
| Cross-model adversarial review | **FOLD** | into `adversarial-review/SKILL.md` as an escalation rung ("self-review found nothing / stakes high → `/team:adversarial`"), same Attack-Defend-Revise frame, different attacker |
| Team-call telemetry (calls, blocks, repair loops) | **FOLD** | into `events_log.ts` + `cli_call_budget` — no new counting system |
| `/team:delegate` → `/codex:rescue` (Claude-Code, native Codex worker) | **KEEP (2nd opt-in)** | only wrapper delegating *write* access; behind `ai_team.allow_delegate: false`. Native-Codex mechanism ≠ the flow-learnings null |
| Worker-via-bundle fallback delegate (non-Claude-Code) | **DEFER (gated)** | this *is* codex-as-worker on a foreign host — the exact flow-learnings honest-null; gated behind the review-lens proof |
| `/codex:transfer` (session hand-off) | **CUT** | niche; plugin-direct usage is fine, wrapping adds surface without governance value. Re-open: user demand |
| Rebuilding broker / companion / background-job runtime | **CUT (anti-lesson)** | everything upstream maintains stays upstream (PR-#837 mirror) |
| Review Gate default-on | **CUT** | upstream marks it experimental; both sources warn of cost loops; violates default-off culture |
| Marketing claim "two strongest models catch each other's errors" | **CUT until Phase 5** | quant claim → CLAIMS.md discipline; needs the benchmark verdict |
| Subscription-authed codex transport, daily quota, auth-failure detection | **ALREADY-HAVE** | `OpenAICliClient` (`clients.ts:1260ff`), `cli_call_budget`, `_AUTH_FAILURE_PATTERNS` |
| Stop-hook infrastructure | **ALREADY-HAVE** | `hook_manifest.yaml`, `claude_settings_hooks.ts`; the gate *policy* is new, the pipe is not |
| Single-model adversarial review | **ALREADY-HAVE** | `adversarial-review/SKILL.md` — the free first rung |

## Phase 0 — Facts, claims hygiene, boundary prose

Independent of any adoption; fixes our own artefact first.

- [x] **Step 1:** Re-verify upstream at execution time: inspect
      `openai/codex-plugin-cc` at latest HEAD, diff the command surface against
      the Provenance list; update the gap-table if commands were added or
      renamed. Record the observed commit/date here.
      <!-- verified 2026-07-12: HEAD db52e28f4d9d (2026-07-08); 8 commands + skills unchanged from Provenance -->
- [x] **Step 2:** Make the codex default model explicit instead of silently
      stale: `clients.ts:1274` hardcodes `opts.model ?? 'gpt-5'`. Replace the
      inline literal with a named `DEFAULT_OPENAI_CLI_MODEL` constant and
      document in `docs/contracts/ai-council-config.md` that omitting the model
      is a *pin*, not "latest". No behavior change.
      <!-- verify: rg "DEFAULT_OPENAI_CLI_MODEL" src/scripts/ai_council/clients.ts -->
- [x] **Step 3:** Add a **"Council vs. team"** boundary paragraph to
      `ai-council/SKILL.md` (§ when NOT to use): repo-access iterated review
      with a single strong model is team mode's job; the council's neutrality
      contract (no repo, no framing) is unchanged.
- [x] **Step 4:** Grep-sweep: no existing doc claims the council "uses the
      strongest models"; align any hit with the contrast prose.
      <!-- verified 2026-07-12: only hit is the legitimate Karpathy peer-review reference (SKILL.md L774) — no misaligned claim -->

  **Phase 0 status:** complete — clients.ts constant extracted (behavior-
  preserving), contract-doc pin note + SKILL boundary paragraph landed,
  upstream re-verified. Quality delegated to remote CI (`local_auto_run` false).

**Exit criteria:** observed upstream commit recorded here; contract doc + SKILL
prose landed; grep for strongest-model claims outside this roadmap returns zero
unaligned hits.
**Rollback:** prose + one-constant extraction; revert restores byte-identical
behavior.

## Phase 1 — Detection + guided setup

- [x] <!-- done 2026-07-12 (feedback-8.11-4 run): check id `team` in
      CHECK_IDS+GLOBAL; codex probe reused (binary+auth-file, CODEX_HOME
      honored), plugin detection via installed_plugins.json prefix match
      (marketplace verified live at upstream HEAD: codex@openai-codex),
      review-gate WARN incl. half-configured state; exact remediation
      strings; 81 doctor tests green (11 new). -->
      **Step 1:** Doctor section `team`: (a) codex binary present + auth-valid
      (reuse the council probe at `cmd_doctor.ts:1745`), (b) on Claude-Code
      hosts: plugin installed (detect the marketplace/plugin entry under
      `~/.claude/`), (c) Review-Gate state (report on/off; WARN if on while
      Phase 4's loop bound is absent). Each check prints the exact remediation
      command.
- [x] <!-- done 2026-07-12: _team_setup_hint_line in install done-block,
      gated on claude-code tooling, suppressible via
      ai_team.suppress_setup_hint; never writes ~/.claude/plugins; 26
      install tests green (5 new). -->
      **Step 2:** Wizard/init: on `--tools=claude-code` (or detection), print a
      one-line recommendation with the doctor pointer — never auto-install,
      never modify `~/.claude/plugins`. Suppressible via config.
- [x] <!-- done 2026-07-12: docs/getting-started.md § "Team mode —
      cross-model review (default off)" — contrast table (repo access /
      breadth-depth / cost model), doctor + plugin setup pointer,
      ai_team.enabled: false default-off note, explicit no-lift-claim
      until the Phase 5 benchmark; Developer-section pointer added in
      docs/getting-started-by-role.md. -->
      **Step 3:** `docs/getting-started` team-mode section: what it is, the
      3-row council-contrast table (access, breadth/depth, cost model), setup
      pointer.
- [x] <!-- done 2026-07-12: hermetic fixtures (PATH/CODEX_HOME/
      CLAUDE_CONFIG_DIR/EVENT4U_CONFIG_HOME overlays + fake codex binary)
      for present/absent/auth-file-absent, wizard render + suppression. -->
      **Step 4:** Tests: doctor fixtures for all three checks
      (present/absent/auth-fail), wizard recommendation rendering, suppression
      key honored.

**Exit criteria:** `doctor` without the plugin prints the remediation block;
all-green prints ok; test file green; nothing outside our own config trees is
written.
**Rollback:** doctor section + wizard line are additive.

## Phase 2 — `/team` command family (Claude-Code path)

- [x] <!-- done 2026-07-12: master + 4 wrappers, cluster: team registered
      in command-clusters.md, type: orchestrator, tier 2/internal (ADR
      promotion gate respected), suggestion triggers incl. the German
      literal (md-language check green — frontmatter skipped). -->
      **Step 1:** New domain `src/domains/meta/team/` mirroring the council's
      master/wrapper split: `command.md` orchestrator + `review`,
      `adversarial`, `delegate`, `status` sub-commands. Frontmatter:
      `disable-model-invocation: true`, `cluster: team`, suggestion triggers
      ("second model", "GPT drüberschauen lassen", "cross-model review",
      "review gate").
- [x] <!-- done 2026-07-12: thin delegations with the enable-pointer gate
      FIRST, then plugin fail-closed block pointing at
      `agent-config doctor --check team`; never a silent no-op. -->
      **Step 2:** On Claude-Code hosts the wrappers are **thin delegations** to
      the plugin: `/team:review [--background]` → `/codex:review`,
      `/team:adversarial <focus>` → `/codex:adversarial-review`, `/team:status`
      → `/codex:status` + our ledger line. Each fails **closed** with the
      Phase-1 remediation block when the plugin is absent — never a silent
      no-op, never an inline reimplementation.
- [x] <!-- done 2026-07-12: second opt-in ai_team.allow_delegate (false
      default) with its own refuse block naming it the only write-access
      wrapper. -->
      **Step 3:** `/team:delegate <task>` → `/codex:rescue`, gated behind
      `ai_team.allow_delegate: false` (second opt-in — it is the only wrapper
      delegating *write* access). Refuse with an enable pointer when the key is
      false. The native-Codex worker mechanism is distinct from the
      flow-learnings null (see Context).
- [x] <!-- done 2026-07-12: ai_team block (enabled/model auto/
      allow_delegate/max_calls_per_day/suppress_setup_hint) in template +
      zod schema (parity gate green), src/scripts/ai_team/config.ts loader
      with hard unknown-key rejection, docs/contracts/ai-team-config.md
      (beta marker) with the council role-semantics verdict verbatim;
      frontmatter 406/0. -->
      **Step 4:** Strong-model contract: settings block `ai_team`
      `{ enabled: false, model: 'auto', allow_delegate: false,
      max_calls_per_day: <int> }`. `auto` = pass no `--model`, let the codex
      CLI default apply; a set value passes through verbatim. Documented in a
      new `docs/contracts/ai-team-config.md`; schema validation rejects unknown
      keys. Design constraint (council verdict 2026-07-12, see Notes): ALL
      role semantics (builder/reviewer/verifier selection, eligibility) live
      in this `ai_team` block + the prompt library — reuse
      subagent-orchestration's implementer/judge frame and its
      `subagent-status.json` envelope; NO `team_mode`/role frontmatter key is
      added to skill/command/rule schemas.
      <!-- verify: ./scripts-run src/scripts/validate_frontmatter -->
- [x] <!-- done 2026-07-12: documented + verified — OpenAICliClient
      name='openai' → same counts.openai bucket (clients.ts:716/738/774/
      1029/1109); two ceilings, ONE counter; /team:status reads
      cli-calls.json read-only. No new counter code. -->
      **Step 5:** Quota: team calls count into the existing `cli_call_budget`
      openai bucket (one subscription, one counter); `/team:status` renders
      today's count.
- [x] <!-- done 2026-07-12: config defaults/rejection + quota-path tests
      (23) + parity (3); wrapper fail-closed + delegate-gate semantics are
      prose contracts in the command docs (command-routing lint green) —
      the runtime smoke with the real plugin is the enabled-path exit
      criterion, maintainer-run. -->
      **Step 6:** Tests: wrapper fail-closed rendering, `allow_delegate` gate,
      config defaults + rejection, quota increment via the fake-client seam.

**Exit criteria:** with `ai_team.enabled: false` (default) no command is
suggested and invocation prints the enable pointer — parity with today; enabled
+ plugin present: smoke run of `/team:review` on a one-file diff returns the
plugin's review verbatim; delegate refuses until `allow_delegate: true`; tests
green.
**Rollback:** flip the default-off key; the domain folder is additive.

## Phase 3 — Multi-host fallback (the gap only we can fill)

Review lens only. The worker-delegate fallback stays deferred (flow-learnings
null).

- [x] <!-- done 2026-07-12 (feedback-8.11-5): built at
      src/scripts/ai_team/team_dispatch.ts (ai_team home, not council);
      bundle+prompt+envelope; NOTICE entry added. -->
      **Step 1:** `team_dispatch.ts` (new, beside the council scripts, sharing
      `clients.ts`): build a **repo-context bundle** — `git status`, bounded
      `git diff` (staged + unstaged, size-capped with a truncation marker),
      file list — and send it through `OpenAICliClient` with a review system
      prompt derived from the plugin's adversarial-review findings shape
      (attributed; Apache-2.0 permits it, NOTICE entry added).
- [x] <!-- done 2026-07-12: header rendered FIRST in call AND manual
      modes, test-pinned; points Claude-Code users to the plugin path. -->
      **Step 2:** Honest capability delta in every fallback run's header: no
      background jobs, no broker, single synchronous call, diff-bundle instead
      of live repo access — the fallback is *worse* than the plugin and says
      so, pointing Claude-Code users back to Phase 2.
- [x] <!-- done 2026-07-12: TeamReviewCliClient inherits quota gate +
      recording + _AUTH_FAILURE_PATTERNS; --manual renders between ═
      rules, zero subprocess, zero quota. -->
      **Step 3:** Same `ai_team` config, same quota bucket, same fail-closed
      auth behavior (`_AUTH_FAILURE_PATTERNS` reused). Manual-mode parity per
      council precedent: `--manual` renders the bundle between `═` rules for
      paste-into-web usage.
- [~] **Step 4:** Worker-via-bundle fallback **delegate** (write path on
      non-Claude-Code hosts) — **deferred**: this is codex-as-worker on a
      foreign host, the exact flow-learnings honest-null. Re-open only if the
      Phase 5 review verdict shows lift.
      <!-- deferred: gated on Phase 5 review-lift; worker mechanism = flow-learnings HONEST-NULL -->
- [x] <!-- done 2026-07-12: 29 tests — cap boundary red/green,
      marker, header ordering, auth-fail→BLOCKED, quota-exhausted no-spawn,
      manual render, envelope parse + raw fallback, auto-vs-pinned model. -->
      **Step 5:** Tests: bundle size cap + truncation marker, header delta
      prose, auth-fail path, manual render — all against the fake client.

**Exit criteria:** on a non-Claude-Code host, `/team:review` produces a review
from the bundled diff via `codex exec`; bundle-cap test red/green at the
boundary; zero new network/auth code (transport reuse proven by import graph).
**Rollback:** default-off; `team_dispatch.ts` is additive.

## Phase 4 — Review-Gate governance

The gate itself stays upstream's; we govern it.

- [x] <!-- done 2026-07-12 (feedback-8.11-5): verdict read from the
      plugin's persisted job record (siblings never see gate stdout;
      first-line ALLOW/BLOCK contract verified against installed upstream
      1.0.4), job id = dedupe key; wired as manifest stop concern. -->
      **Step 1:** `ai_team.review_gate: { managed: false,
      max_consecutive_blocks: 3 }` (default `managed: false` = today's
      behavior, byte-identical). When managed: our Stop-hook dispatch runs
      *after* the plugin's gate and counts consecutive BLOCK verdicts per
      session (parse the first-line ALLOW/BLOCK contract from the gate
      transcript); at the bound it injects a visible circuit-breaker notice and
      stops re-blocking — the user decides, never an infinite Claude↔Codex loop.
- [x] <!-- done 2026-07-12: agents/runtime/team/events.log JSONL,
      enum-only; read helper + format for /team:status. -->
      **Step 2:** Ledger: one events-log line per gate verdict
      (`team.gate: BLOCK 2/3`) so `/team:status` and session replay show gate
      spend.
- [x] <!-- done 2026-07-12: reads the plugin's own state.json
      (layout verified against the installed plugin); WARN quotes the
      upstream cost warning + /codex:setup --disable-review-gate. -->
      **Step 3:** Doctor (Phase 1 check c) upgraded: WARN when the plugin gate
      is enabled and `managed: false` — with the enable hint and the upstream
      cost warning quoted.
- [x] <!-- done 2026-07-12: 22 review_gate + 4 hook-E2E + doctor (c)
      rewritten; ALLOW/BLOCK/UNKNOWN sequences incl. reset + dedupe. -->
      **Step 4:** Tests: block-count state machine (fixture transcripts),
      circuit-breaker rendering at the bound, ledger line shape, doctor WARN.

**Exit criteria:** fixture session with 3 consecutive BLOCKs shows the
circuit-breaker notice exactly once; with `managed: false` the Stop path is
byte-identical to pre-roadmap dispatch; tests green.
**Rollback:** default-off key; the counter lives in our dispatch layer,
upstream's hook is never modified.

## Phase 5 — Defect-finding benchmark (measure the marketing)

Settles the "a second model finds errors the first never sees" claim with the
existing bench-rig discipline before any public copy exists.

> **Metric family PRE-REGISTERED (feedback-8.11-5 council, 2026-07-12):**
> primary = planted-defect recall against ground truth, false-positive
> count, cost/time/calls, fix success; judge preference is SECONDARY.
> Numeric thresholds are fixed at fixture-authoring time — still before
> any execution (prereg discipline holds). The iterated build→review→fix
> LOOP and the deferred worker-delegate share the same gate: both unlock
> only on a positive review-lift verdict here.

- [ ] **Step 1:** Fixture set: 10–15 seeded-defect diffs (logic bug, race,
      missing empty-state, off-by-one, security smell) with pre-registered
      blind-judging rubrics, stored under the bench fixtures tree.
- [ ] **Step 2:** Three arms: (a) single-model adversarial self-review (host
      model, existing skill), (b) cross-model team review (Phase 2/3 path),
      (c) `council:pr` at default depth. Record found/missed per defect class,
      wall time, call count per arm.
- [ ] **Step 3:** Blind judging via the existing verification-judge pattern;
      judge never sees arm labels.
- [ ] **Step 4:** Verdict in `docs/proof.md` + CLAIMS.md shape: per-arm
      detection rates; pre-registered hypothesis (b > a on correctness-class
      defects; c competitive on design-class); honest-null reporting if arms
      are indistinguishable.
- [ ] **Step 5:** Disposition: on measured lift, bind the README/team-docs
      claim with a `<!-- claim:team-cross-model-lift -->` marker and re-open
      Phase 3 Step 4; on null, record evidence-closed with re-open conditions
      (new model generation) and keep the feature documented as *workflow*
      value only, never *quality* claims.

**Exit criteria:** benchmark artefacts for all arms exist; claims lint green;
the disposition step executed either way.
**Rollback:** benchmark is additive tooling + fixtures.

## Phase 6 — Close-out

- [x] <!-- done 2026-07-12 (partial per feedback-8.11-4 scope): derived
      trees regenerated (sync + generate-tools: 183 commands projected,
      surface-map classified, counts/capabilities/catalog/command-flows
      green); featured-commands entry deliberately NOT added — internal
      visibility until the Phase-5 verdict. -->
      **Step 1:** Catalog + featured-commands entries for the `/team` family
      (visibility per the Phase 5 verdict); regenerate derived trees via
      `task sync` + `task generate-tools`.
- [ ] **Step 2:** CHANGELOG entry; MIGRATION note: none needed (all
      default-off). `See also` cross-links between `ai-council`,
      `subagent-orchestration`, the `judge-*` cluster, and the new `team` skill
      so the router disambiguates council (independent) vs team (collaborative)
      vs subagents (in-session same-weights).
- [ ] **Step 3:** Re-verify upstream one final time; if the command surface
      drifted since Phase 0, file the delta as a follow-up stub rather than
      silently absorbing it.
- [ ] **Step 4:** No stale references (`task check-refs` clean).

## Acceptance Criteria (anti-dump)

- [ ] Every new capability is default-off; with `ai_team` absent or
      `enabled: false`, doctor output aside, all paths are byte-identical to
      pre-roadmap behavior (parity snapshots for Stop-hook dispatch and the
      command-suggestion surface).
- [ ] Nothing upstream-maintained is reimplemented: no broker, no companion, no
      background-job runtime, no gate hook in our tree; `team_dispatch.ts`
      imports transport from `clients.ts` only.
- [ ] The council's neutrality contract is textually unchanged except the
      Phase-0 boundary paragraph; no council code path gains repo access.
- [ ] All new config keys live in `docs/contracts/ai-team-config.md` with
      schema validation rejecting unknown values; the shared quota bucket is
      documented.
- [ ] No public claim about cross-model quality exists without the Phase 5
      verdict bound in CLAIMS.md — workflow-value prose allowed, lift claims
      not.
- [ ] `/team:delegate` is unreachable until both `ai_team.enabled` and
      `ai_team.allow_delegate` are true.
- [ ] All quality gates pass (delegated to remote CI per
      `quality.local_auto_run`).

## Blockers

### blocker: model-id-verification
- **Status:** resolved 2026-07-12
- **Owner:** maintainer
- **Blocks:** Phase 2 config-doc examples, Phase 5 arm pinning
- **What to do:**
  1. At execution, list the actual codex CLI model IDs (`codex /model` or CLI
     docs) and pin the benchmark arms to verified IDs.
  2. The trigger guide's `gpt-5.6-sol` is unverified marketing copy — the
     plugin's own prompting skill still targets `gpt-5-4`. Append the verified
     list here.
- **Resolved when:** a dated model-ID list exists in this file.
- **Resolution (2026-07-12, verified live):** codex-cli 0.134.0 on the
  maintainer machine, subscription-authed; model list read from the CLI's own
  server-fetched cache (`~/.codex/models_cache.json`, fetched_at
  2026-07-12T09:54Z) and cross-checked by a live `codex exec` header:
  - `gpt-5.5` — GPT-5.5, the CLI's current default (live exec header shows
    `model: gpt-5.5`)
  - `gpt-5.4` — GPT-5.4
  - `gpt-5.4-mini` — GPT-5.4-Mini
  - `codex-auto-review` — Codex Auto Review (review-specialised)
  A bogus id is rejected with "not supported when using Codex with a ChatGPT
  account" (HTTP 400) — so arm pinning MUST use ids from this list. The
  trigger guide's `gpt-5.6-sol` is confirmed NOT available. Benchmark arms:
  pin builder/reviewer arms to `gpt-5.5` (default) and consider
  `codex-auto-review` for the review arm; re-read the cache at Phase 5
  execution time (model lists rotate).

### blocker: benchmark-spend-authorization
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 5 execution (authoring fixtures is unblocked)
- **What to do:**
  1. Approve the run once the fixture count is fixed; three arms × N fixtures
     land on the ChatGPT subscription quota (arms a/b) and the council budget
     (arm c). Estimate rendered before the first call.
- **Resolved when:** the user confirms the run budget in-session.

## Notes

- **Phases 3+4 = the immediately-next PR** (feedback-8.11-4 council,
  2026-07-12, round-2 convergence): under default-off + fail-closed, the
  multi-host fallback (P3) and Review-Gate governance (P4) are GA-enablement
  work, not v1-ship work; fail-with-remediation is the v1 answer on hosts
  without the plugin. P5 stays spend-gated (user).
- **Council verdict on team-mode frontmatter (claude-sonnet-4-5 + gpt-4o,
  2026-07-12, unanimous REJECT):** skills/commands get NO `team_mode` / role
  frontmatter. Role semantics belong in the `ai_team` config block + prompt
  library (reusing subagent-orchestration's implementer/judge frame and status
  envelope), not smeared across 271 skill files while the feature's role model
  does not operationally exist. Revisit-if: Phase 2 execution turns out to be
  blocked SPECIFICALLY on artefact-level role metadata — then re-open via
  decision-revisit-gate, not by silently adding the key.
- **Priority (feedback-8.11 disposition, 2026-07-12):** Phases 1–2 are the
  next structural build after the feedback-8.11 hygiene/boundary work — the
  external reviews rank finishing team mode above further council features.
  The `model-id-verification` blocker is resolved (see Blockers);
  `benchmark-spend-authorization` remains with the user and blocks only
  Phase 5 execution.
- Standalone capability roadmap, not part of the `road-to-opt-*` optimization
  family — team mode is a new surface, not a tuning of an existing one.
- Cost/limits are the real constraint, not model capability: default to the
  `cli` (subscription) transport; API transport is opt-in and billable.
- `/team:delegate` ships (behind a second opt-in) because on Claude-Code it
  forwards to the plugin's native-Codex `/codex:rescue`; the worker-via-bundle
  fallback delegate is the only delegation path the flow-learnings null covers,
  and it stays deferred.

## Provenance

- Source: an external, third-party setup guide (consulting/tutorial site)
  describing a build↔review "team" pattern between two strong models
  (anonymized per `source-confidentiality`). Retrieve via
  `src/scripts/_lib/link_crypto.ts decrypt --value <token>`:
  `ENC1:z1BhY5gnVj5aoPYUUC0AriOaBezuWKiL3PXWf1y1SAIL3QafjzViF5FF7qf0D+XTGBdwXVVvyggrvFIIRe93vPfnVrvtQiwMTavTopPnum23SCb8PM8=`
- Integrated tool (named, permitted): `openai/codex-plugin-cc` (Apache-2.0) —
  verified at HEAD 2026-07-12 (upstream tree under `plugins/codex/…`): 8
  commands (`setup`, `review`, `adversarial-review`, `rescue`, `transfer`,
  `status`, `result`, `cancel`), a proactive `codex-rescue` agent, a
  `stop-review-gate-hook.mjs` Stop-hook + `stop-review-gate.md` prompt, and
  skills `codex-cli-runtime`, `codex-result-handling`, `gpt-5-4-prompting`.
- Council: not run. Phase 0 shipped its boundary prose as authored; a
  `/council:design` pass on the Phase 0 ADR (integration shape) is available
  for the still-open Phases 1–6 if the shape decision wants a second opinion.
