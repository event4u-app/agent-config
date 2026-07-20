---
complexity: structural
execution:
  mode: autonomous
---

# Road to runtime-security hardening — fix the subprocess-env RCE, hold the scope line

> **LICENSE IRON LAW.** The source analysis compared against `anthropics/claude-code`'s
> `security-guidance` plugin — © Anthropic PBC, **all rights reserved** (Commercial
> Terms), **NOT open source**. agent-config is MIT. **Concept adoption only**: no
> verbatim port of code, regex-sets, or prompt text. The env-hijack knowledge
> (`LD_PRELOAD` / `DYLD_INSERT_LIBRARIES` / `NODE_OPTIONS` / `GIT_EXTERNAL_DIFF` /
> `core.pager` RCE) is standard, publicly-documented OWASP/CWE material (CWE-426
> untrusted-search-path, CWE-88 argument-injection, CWE-427) re-derived in our own
> words. Attribution as "concept inspiration, independent implementation" only —
> attribution ≠ license.

## Goal

Close the real shipped RCE in the AI-council subprocess transport (parent-env
inheritance) with a shared, deny-by-family `hardenedSpawnEnv` helper applied
across the consumer-runtime spawn surface plus a falsifiable env-injection test,
and record the runtime-scope boundary as an ADR — **without** adding the
contested outbound-pattern-guard mechanism the council's second round argued
against.

## Context (verified 2026-07-20, do not relitigate)

Source: a user-supplied source-level analysis (`agents/tmp/feat-security.txt`,
local/gitignored) comparing agent-config's security stack to an external
reference plugin (referred to as **Source A** per `source-confidentiality`).
Web-confirmed that the env-hardening knowledge is license-safe public material.

Verified in the repo:

- **The real shipped bug (P4):** `src/scripts/ai_council/clients.ts::_runSubprocess`
  (~L1099) builds `spawnOpts` with only `encoding`/`timeout`/`input` — **no `env:`
  key** — so `spawnSync` inherits the full parent `process.env`. When the council
  CLI (`codex` / `claude` / `gemini`) shells out to `git` internally, an
  attacker-influenced `GIT_EXTERNAL_DIFF` / `core.pager` / `NODE_OPTIONS` /
  `LD_PRELOAD` in the parent env is RCE. The council transport violates the
  Least-Agency its own `tool-safety` rule preaches. This is a **fix, not a
  feature** — net-negative risk, no new surface. There is no existing env-scrub
  helper (repo-wide grep = 0 hits); `dispatch_hook.ts:503` is the only prior
  "spread process.env + one override" precedent.
- **The documented gap:** `injection_scan_hook.ts` scans inbound
  (`tool_response`/`tool_output`); nothing scans what the agent WRITES.
  `docs/threat-model.md` row (d) states "no runtime enforcement layer exists …
  runtime layer out of scope for AC."
- **security_lint.ts has no consumer-supplied patterns** — its `check` ids are
  fixed string constants (also pragma keys). So the analysis's "ReDoS-validate
  consumer patterns / consumers ADD-never-SUPPRESS" hardening guards a feature
  that does not exist → CUT (building it would be speculative surface).

### Council notes (2026-07-20, anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds)

- **Round 1** both leaned "reverse row d, build the outbound guard default-off."
  **Round 2 both pivoted skeptical** — the decisive distinction: the inbound
  `injection_scan_hook` is **input sanitization** (AC defending its own runtime
  from corrupted tool output), **not runtime behavioral enforcement** (governing
  what the agent writes). The inbound/outbound "asymmetry" is a defensible
  separation of concerns: AC ships the *rules*; the consumer's tool-execution
  layer is the enforcement boundary. An outbound *command guard* requires
  interpreting intent from content (`rm -rf ./build` vs `rm -rf /`) — that is
  net-new runtime-enforcement surface, not "completing" the inbound hook.
- **Unanimous, both rounds:** **P4 (spawn-env hardening) ships first and alone**,
  release-blocking, as a fix. Bundling the contested P0/P1 with the uncontested
  fix was named "architectural sleight-of-hand."
- **Hardening details:** adopt **deny-by-family env scrub** (not an allowlist —
  the CLIs legitimately need many env vars like `ANTHROPIC_API_KEY`; an allowlist
  would break them), a **falsifiable env-injection test**, and (where applicable)
  frozen check-ids. **Reject global allowlists** — per-file pragma only, reuse
  `security_lint.ts` containment. The outbound guard, turn-diff baseline, and
  LLM diff-review are **deferred** (contested + complexity-budget + honest-null
  risk + no demand signal).
- **Complexity-budget check (PR #983 thesis, `surface-consolidation-restraint`):**
  the helper REPLACES ad-hoc env-inheritance at each spawn site (names what it
  retires), adds **no** new rule / lint / hook / command / mode, is default-behaviour
  (no gate needed — hardening is always-on), removable by reverting one import,
  and is owned by the same maintainer as the transport. The deferred guard is
  **surfaced as a blocker with a revisit-if**, not silently dropped
  (`decision-revisit-gate`).

### Gap-table (KEEP / FOLD / DEFER / CUT — feat-security.txt P0–P7)

| Analysis item | Verdict | Where |
|---|---|---|
| P4 — subprocess spawn-env hardening (the shipped RCE) | **KEEP** | Phase 1 — shared `hardenedSpawnEnv` + `clients.ts` + falsifiable test |
| Generalize the helper across the consumer-runtime spawn surface | **KEEP** | Phase 2 — hook spawn sites (roadmap/hot-context) |
| P0 — record the runtime-scope decision | **KEEP (clarify, not blanket-reverse)** | Phase 3 — ADR + threat-model row (d) clarification |
| Deny-by-family scrub · falsifiable env-injection test | **KEEP** | Phase 1 |
| P1 — outbound pattern guard (agent-written content) | **DEFER** | Blocker `outbound-guard-demand` (council round-2 skeptical; net-new enforcement surface; no demand signal) |
| P2 — turn-diff behavioural baseline | **DEFER** | Blocker `outbound-guard-demand` (experimental, field-validation-gated) |
| P3 — LLM diff-review | **DEFER** | Blocker `outbound-guard-demand` (honest-null risk: an LLM reviewer is itself injectable; spend) |
| P5 — ReDoS-validate consumer patterns / consumers ADD-never-SUPPRESS | **CUT** | security_lint has no consumer-pattern surface — guarding a non-existent feature is speculative |
| P6/P7 — maintainer-only CI-script spawn sweep | **DEFER** | Blocker `maintainer-ci-spawn-sweep` (CI runs on trusted env; lower attacker-control; mechanical follow-up) |
| Global env/pattern allowlist | **CUT** | per-file pragma only (council: "the 12th way to suppress findings") |

## Phase 1 — Fix the RCE: shared hardened-spawn helper + council transport

- [x] Create `src/scripts/_lib/spawn_env.ts` exporting
      `hardenedSpawnEnv(overrides?: Record<string, string>): NodeJS.ProcessEnv` —
      start from `process.env`, **scrub by family** the code-execution-injection
      vectors (exact names + prefix families): dynamic-loader (`LD_PRELOAD`,
      `LD_LIBRARY_PATH`, `LD_*`, `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH`,
      `DYLD_*`), git-command-injection (`GIT_EXTERNAL_DIFF`, `GIT_SSH`,
      `GIT_SSH_COMMAND`, `GIT_PROXY_COMMAND`, any `GIT_*_COMMAND`, `GIT_PAGER`,
      `PAGER`), runtime-hook (`NODE_OPTIONS`, `BASH_ENV`, `ENV`, `PYTHONPATH`,
      `PYTHONSTARTUP`, `PYTHONINSPECT`, `PERL5OPT`, `PERL5LIB`, `RUBYOPT`),
      and `GCONV_PATH` / `IFS`. Deny-by-family (prefix + exact), then apply
      `overrides`. Preserve everything else (the CLIs need `ANTHROPIC_API_KEY`,
      config paths, etc.). <!-- done 2026-07-20: src/scripts/_lib/spawn_env.ts — DENY_EXACT set + LD_/DYLD_/GIT_*_COMMAND family prefixes; verified scrub+preserve+override -->
      <!-- verify: cd ../agent-config-security && npx tsx -e "import {hardenedSpawnEnv} from './src/scripts/_lib/spawn_env.ts'; process.env.GIT_EXTERNAL_DIFF='x'; process.env.LD_PRELOAD='y'; process.env.HOME='/h'; const e=hardenedSpawnEnv(); if(e.GIT_EXTERNAL_DIFF||e.LD_PRELOAD) throw new Error('leak'); if(e.HOME!=='/h') throw new Error('over-scrub'); console.log('ok')" -->
- [x] Wire `hardenedSpawnEnv()` into `clients.ts::_runSubprocess` —
      `spawnOpts.env = hardenedSpawnEnv()` before the `spawnSync` call. <!-- done 2026-07-20: import + spawnOpts.env at the transport seam -->
      <!-- verify: grep -n "hardenedSpawnEnv" src/scripts/ai_council/clients.ts -->
- [x] Add a falsifiable env-injection regression test under
      `tests/scripts/ai_council/` — the real `_runSubprocess` spawns `/bin/sh`
      with the injection vars present in the parent; the child prints them back
      and none must survive. <!-- done 2026-07-20: tests/scripts/ai_council/spawn_env.test.ts (5 tests) — proven RED without the fix (8 vectors leaked), GREEN with it; unit + e2e + GIT_ASKPASS-preserved control -->
      <!-- verify: cd ../agent-config-security && npx vitest run tests/scripts/ai_council/spawn_env.test.ts 2>&1 | tail -5 -->

Exit: `hardenedSpawnEnv` exists, is imported by the council transport, and the
env-injection test passes red-without-fix / green-with-fix. Rollback: revert the
one-line `spawnOpts.env` wiring (helper is inert if unused).

## Phase 2 — Generalize: the consumer-runtime hook spawn sites

- [x] Apply `hardenedSpawnEnv()` to the hook-dispatched spawn sites that run on
      the consumer's machine with inherited env: `src/scripts/roadmap_progress_hook.ts`
      (git spawn ~L413) and `src/scripts/hot_context_hook.ts` (spawn ~L84). These
      run in the consumer repo via the hook dispatcher, so the same
      attacker-influenced-env vector applies. Do NOT touch the maintainer-only CI
      scripts (deferred — trusted env). <!-- done 2026-07-20: both hook spawn sites wired; no agent-src twins exist (hooks live only in src/scripts/); both import-smoke green -->
      <!-- verify: for f in src/scripts/roadmap_progress_hook.ts src/scripts/hot_context_hook.ts; do grep -q "hardenedSpawnEnv" "$f" && echo "$f ok"; done -->

Exit: both consumer-runtime hook spawn sites route env through the helper.
Rollback: per-file revert of the import + `env:` argument.

## Phase 3 — Record the scope boundary (ADR) — clarify, don't blanket-reverse

- [x] Create an ADR (via the numbering flow) recording: (a) the subprocess-env
      inheritance RCE and its fix (deny-by-family `hardenedSpawnEnv`); (b) the
      council's decisive distinction — **input sanitization ≠ runtime behavioral
      enforcement**, so threat-model row (d)'s "runtime out of scope" stands for
      *behavioral enforcement*; (c) the outbound pattern guard / turn-diff /
      LLM-review are **deferred** with a `revisit-if` (a real outbound-injection
      incident, or a consumer demand signal, or utilization evidence). Status:
      Accepted. <!-- done 2026-07-20: docs/decisions/ADR-123-runtime-security-scope-and-spawn-hardening.md; INDEX regenerated (--dir docs/decisions) -->
      <!-- verify: ls docs/decisions/ADR-*runtime-security* docs/adr/ADR-*runtime-security* 2>/dev/null | head -1 -->
- [x] Update `docs/threat-model.md`: add a row for the subprocess-env-inheritance
      vector (now mitigated by the hardened-spawn helper), and add a one-line
      clarification to row (d)'s "no additional mitigation planned" cell pointing
      to the new ADR for the input-sanitization-vs-enforcement distinction and the
      deferred-guard decision. Do NOT re-describe the trifecta rules (row (d)
      already cites them). <!-- done 2026-07-20: new row (g) subprocess spawn-env inheritance (mitigated) + row (d) mitigation cell cites ADR-123 -->
      <!-- verify: grep -n "spawn\|subprocess env\|hardenedSpawnEnv\|ADR" docs/threat-model.md | head -5 -->

Exit: ADR merged into the index; threat-model reflects the fixed vector + the
deferred-guard decision. Rollback: revert the ADR + threat-model edits.

## Acceptance criteria (anti-dump)

- [x] **Net-positive-security, minimal-surface:** the diff fixes a real RCE and
      adds exactly one reusable helper; it adds **no** new rule, lint, hook,
      command, or council/review mode.
- [x] **License line held:** no verbatim port of Source A code/regex/prompt text;
      env-hardening re-derived from public OWASP/CWE knowledge; CREDITS notes
      "concept inspiration, independent implementation" if attribution is added.
- [x] **Falsifiable, not vibes:** the env-injection test fails without the fix and
      passes with it (deny-by-family verified, not an incomplete denylist).
- [x] **Deferred, not silently dropped:** the outbound guard / turn-diff /
      LLM-review live as `## Blockers` entries with a `revisit-if`, per
      `decision-revisit-gate` — the council's contested items are surfaced, not
      buried.
- [x] **No speculative hardening:** the consumer-pattern ReDoS/trust-framing (P5)
      is NOT built (guards a non-existent feature).

## Blockers

### blocker: outbound-guard-demand
- **Status:** open
- **Owner:** user / maintainer
- **Blocks:** P1 (outbound pattern guard), P2 (turn-diff baseline), P3 (LLM diff-review)
- **What to do:** the council's second round argued these are net-new
  runtime-*enforcement* surface (distinct from the inbound input-sanitization
  hook), contested under the just-merged complexity budget, with no demand
  signal. Build only on evidence.
- **Resolved when:** a real outbound-injection incident is recorded, OR a consumer
  demand signal exists, OR utilization data justifies the enforcement layer — then
  re-open per the ADR's `revisit-if` and pass the six-question complexity budget.

### blocker: maintainer-ci-spawn-sweep
- **Status:** open
- **Owner:** maintainer
- **Blocks:** applying `hardenedSpawnEnv` to the ~15 maintainer-only CI/git-helper
  spawn sites (`check_trunk_drift`, `evidence_report`, `print_required_checks`, …)
- **What to do:** these run in trusted CI/maintainer context (lower attacker
  control of env). Mechanical follow-up sweep once the helper has soaked on the
  consumer-runtime surface.
- **Resolved when:** the helper is proven on the consumer-runtime path and a
  maintainer authorizes the mechanical sweep.

## Provenance

Source: a user-supplied source-level security analysis (`agents/tmp/feat-security.txt`,
local, gitignored) comparing agent-config to one external reference plugin
(referred to only as **Source A** per `source-confidentiality`; © the third party,
all-rights-reserved — concept adoption only, no code port). Council convergence
recorded inline above (date + members), no session-file path cited.
