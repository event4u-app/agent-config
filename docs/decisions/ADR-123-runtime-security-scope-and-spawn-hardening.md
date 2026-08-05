---
adr: 123
status: accepted
date: 2026-07-20
decision: runtime-security-scope-and-spawn-hardening
supersedes: —
superseded_by: —
phase: road-to-runtime-security-hardening
type: structural
---

# ADR-123 — Runtime-security scope: harden subprocess spawn-env, keep behavioural enforcement out of scope

- **Status:** Accepted (2026-07-20)
- **Closes:** `agents/roadmaps/archive/road-to-runtime-security-hardening.md`
- **Related:** `docs/threat-model.md` row (d) (lethal-trifecta); `src/rules/tool-safety.md` (Least Agency); `src/rules/lethal-trifecta-guard.md`; `src/rules/untrusted-input-defense.md`.

## Context

A user-supplied source-level analysis compared agent-config's security stack
against an external reference plugin (referred to only as **Source A** per
`source-confidentiality`; © the third party, all-rights-reserved — concept
adoption only, no code/regex/prompt port). It surfaced two distinct things that
were repeatedly conflated:

1. **A real shipped bug.** `src/scripts/ai_council/clients.ts::_runSubprocess`
   built its `spawnSync` options with no `env:` key, so every spawned provider
   CLI (`codex` / `claude` / `gemini`) — and any `git` those CLIs invoke
   internally — inherited the full parent `process.env`. An attacker-influenced
   `GIT_EXTERNAL_DIFF` / `core.pager` / `NODE_OPTIONS` / `LD_PRELOAD` /
   `DYLD_INSERT_LIBRARIES` in the parent environment is remote code execution
   (CWE-426 untrusted search path, CWE-88 argument injection). This is our own
   transport violating the Least-Agency its `tool-safety` rule preaches.

2. **A proposed scope reversal.** The analysis argued that because
   `injection_scan_hook.ts` already scans **inbound** tool responses, the
   threat-model's "runtime enforcement out of scope" decision (row (d)) is
   already void, so we should also scan **outbound** — the content the agent
   writes — with a pattern guard, a turn-diff baseline, and eventually an LLM
   diff-review.

A two-round council (2026-07-20, anthropic/claude-sonnet-4-5 + openai/gpt-4o)
was decisive: round 1 leaned toward building the outbound guard; **round 2 both
members pivoted skeptical** on the load-bearing distinction below.

## Decision

**1. Fix the spawn-env RCE (accepted, shipped in this roadmap).** A shared
`src/scripts/_lib/spawn_env.ts::hardenedSpawnEnv(overrides?)` scrubs the
code-execution-injection env families **by family, not by allowlist** — the
provider CLIs legitimately need arbitrary env (API keys, config paths), so an
allowlist would break them and rot; deny-by-family removes the known vectors
(dynamic-loader `LD_*`/`DYLD_*`/`GCONV_PATH`, git `*_COMMAND`/`GIT_EXTERNAL_DIFF`/
`GIT_SSH_COMMAND`/`PAGER`, runtime hooks `NODE_OPTIONS`/`BASH_ENV`/`ENV`/
`PYTHON*`/`PERL5*`/`RUBYOPT`, and `IFS`) and preserves everything else. It is
wired into the council transport and the two consumer-runtime hook spawn sites
(`roadmap_progress_hook`, `hot_context_hook`), and guarded by a falsifiable
regression test (proven RED without the fix — 8 vectors leaked into the child —
GREEN with it).

**2. Input sanitization ≠ runtime behavioural enforcement — row (d) stands.**
The inbound `injection_scan_hook` is **self-defence**: it hardens AC's own
handling of data it *receives* from external tools. It does **not** commit AC to
*governing what the agent writes*. An outbound command guard requires
interpreting intent from content (`rm -rf ./build` vs `rm -rf /`) — that is a
runtime **enforcement** layer, a categorically different mechanism, and the one
threat-model row (d) places out of scope. AC ships the *rules*
(`lethal-trifecta-guard`, `untrusted-input-defense`, `tool-safety`); the
consumer's tool-execution layer is the enforcement boundary. The inbound/outbound
"asymmetry" is a defensible separation of concerns, not security theatre.

**3. The outbound guard / turn-diff baseline / LLM diff-review are deferred, not
rejected.** They remain `## Blockers` on the roadmap with a `revisit-if`: a real
outbound-injection incident, a consumer demand signal, or utilization evidence —
at which point they must also pass the six-question complexity budget
(`artifact-drafting-protocol-mechanics` § Complexity budget), given PR #983 just
consolidated surface and `surface-consolidation-restraint` holds new modes until
the pending benchmarks land. This ADR records the deferral so the decision is
surfaced, not silently dropped (`decision-revisit-gate`).

> **Corrected 2026-08-05 by [ADR-216](ADR-216-restraint-reanchored-to-capacity.md).**
> The clause above originally read "freezes new modes pending the first external
> adopter". External adoption is not a project goal and is not a valid gate
> anywhere in this tree, so that half is struck. The restraint's real condition —
> the pending benchmarks — is unchanged and reachable, and the three named
> deferrals keep their own revisit triggers untouched: a real outbound-injection
> incident, a demand signal, or utilization evidence. None of those three depends
> on an external adopter, so this deferral was never actually adoption-gated; the
> citation was.

**4. Rejected:** a consumer-supplied-pattern ReDoS/trust-framing layer (Source A
P5) — `security_lint.ts` has no consumer-pattern surface, so guarding it would
build a defence for a feature that does not exist. Global env/pattern allowlists
are also rejected: per-file pragma containment (`security_lint.ts`) only.

## Consequences

- The council transport and consumer-runtime hooks can no longer be turned into
  an RCE vector by a poisoned parent environment; the fix is falsifiably tested.
- `docs/threat-model.md` gains a row for the (now-mitigated)
  subprocess-env-inheritance vector, and row (d)'s "no additional mitigation
  planned" cell cites this ADR for the input-sanitization-vs-enforcement
  distinction and the deferred-guard decision.
- AC's security posture stays **authoring-time rules + input hygiene + our own
  Least-Agency spawn discipline** — it does not become a runtime sandbox
  supervising every agent tool call.
- Maintainer-only CI/git-helper spawn sites (~15) are a deferred mechanical
  sweep (`maintainer-ci-spawn-sweep` blocker): they run in trusted CI with lower
  attacker-control of the environment.

## Alternatives considered

- **Complete the runtime layer (build the outbound guard now).** Council round 1
  position. Rejected in round 2: conflates input sanitization with behavioural
  enforcement; adds net-new enforcement surface with a false-positive burden,
  right after a consolidation roadmap, with no demand signal.
- **Delete `injection_scan_hook.ts` for symmetry.** Architecturally consistent
  but operationally worse — inbound sanitization is legitimate self-defence and
  costs nothing to keep.
- **Env allowlist instead of deny-by-family.** Rejected — would strip env the
  provider CLIs need and rot as new good vars appear.

## Follow-up (2026-07-21) — `road-to-spawn-env-completion`

The 9.6.0 external review reproduced a working exploit against the fix this ADR
shipped: `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_<n>` / `GIT_CONFIG_VALUE_<n>` (and
`GIT_CONFIG_GLOBAL` / `_SYSTEM`) survived the deny-by-family scrub — the
`GIT_*_COMMAND` family missed them (no `_COMMAND` suffix) — letting an attacker
set arbitrary git config (`core.fsmonitor` runs shell on every `git status`,
which the consumer-runtime hooks trigger). `GIT_ALTERNATE_OBJECT_DIRECTORIES`
and `HOSTALIASES` also leaked. **Confirmed empirically (all 5) and closed:**
`hardenedSpawnEnv` now denies the whole `GIT_CONFIG`/`GIT_CONFIG_*` family by
prefix plus the two exact vars, with falsifiable test vectors (red without the
fix, green with it).

**`maintainer-ci-spawn-sweep` blocker — resolved by classification, not mass
migration.** Rather than migrate ~15 low-risk maintainer/CI sites, all spawn
sites are now classified in `docs/spawn-site-policy.md` (Consumer Runtime /
Maintainer CLI / trusted CI / install-time). The consumer-runtime dispatcher
(`hooks/dispatch_hook.ts`) — missed in PR #984 — now routes through
`hardenedSpawnEnv`; the maintainer/CI/install sites are documented exempt with
rationale (env is maintainer- or workflow-controlled, not attacker-influenced).

**Secure-spawn lint — rejected (council 2026-07-21, claude-sonnet-4-5 +
gpt-4o).** A CI lint forbidding raw spawn in runtime paths was proposed (P0 in
the review) but rejected: it is net-new governance surface (a CI gate +
allowlist + exemption-adjudication + false-positive triage), which the folded
complexity-budget lock (PR #983) forbids — the lock text explicitly lists
"linter". The "retires ad-hoc review" justification failed the retirement test
(no such review gate exists to retire). `docs/spawn-site-policy.md` is the
self-enforcing substitute: its completeness claim is checked by git-diff
visibility at review time, not a build gate.

## Follow-up (2026-07-31) — the config-pointer class is scoped OUT, on evidence

`road-to-zero-ceremony-detection` Phase 5 examined a second class the
deny-by-family scrub does not cover: **instruction-bearing config pointers**.
`CLAUDE_CONFIG_DIR` and `CODEX_HOME` tell a provider CLI which directory to load
its configuration from — rules, settings, floors — and neither matches a deny
family. (Near miss worth naming: the `GIT_CONFIG_` check is a *prefix* test;
`CLAUDE_CONFIG_DIR` merely *contains* `CONFIG_`.) So both are inherited by every
spawned child, and nothing asserted that either way.

**Decision: accepted risk. Deny-by-family stands unchanged; no variable is
added to the deny set.** This is NOT a reversal of this ADR — it is a scope
statement for it, plus a pinned test so the behaviour can no longer change
silently.

Two things drove it:

1. **A strip has a measured cost.** `src/install/agentSwitchProfile.ts` declares
   `PROVIDER_ENV_VARS = ['CLAUDE_CONFIG_DIR', 'CODEX_HOME']` — a shipped
   integration with `@event4u/agent-switch`, which isolates multiple accounts
   into per-account profiles through exactly these variables *"so switching
   accounts never requires a re-login"*. Stripping them sends a spawned CLI to
   the DEFAULT profile: the wrong account, or an unauthenticated one, silently.
   That is the concrete legitimate workflow an external review of this question
   asked for and did not have.
2. **The precondition already grants more.** An actor who can set the
   orchestrator's environment can also set `PATH` (binary substitution) or
   `ANTHROPIC_API_KEY` (transport switch). Residual risk after a strip is not
   materially lower.

The third option — strip inherited, permit only an assignment validated against
the agent-switch root — remains the only one that closes the gap without
breaking (1), and its validation predicate already exists in
`agentSwitchProfile.ts`. It is deferred, not rejected: revisit if a second
instruction-bearing pointer variable appears, or if the behavioural-steering
path becomes concrete in a real incident.

Pinned in `tests/scripts/ai_council/spawn_env.test.ts`
(`hardenedSpawnEnv — CLAUDE_CONFIG_DIR is inherited (pinned)`) and recorded as
`docs/threat-model.md` row i. **If a later change denies these variables, those
tests must flip — and flipping them is the signal that this decision is being
reversed deliberately rather than by accident.**
