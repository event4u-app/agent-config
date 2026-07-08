---
complexity: lightweight
---

# Road to orchestration-and-memory harvest

> Fold the subagent-handoff and memory-quality mechanisms harvested from a frontier-host dispatch prompt into existing skills — a worker-prompt contract, four memory upgrades, and an instructions-verbatim-first handoff template — and record the reminder drift-audit disposition (rejected now, revisit-if).

## Goal

Adopt the worker-prompt contract into `subagent-orchestration`, four memory upgrades into `memory-consolidation` / `memory:add`, and the lossless-handoff template into `agent-handoff`; record the reminder drift-audit as rejected-now with a concrete revisit trigger.

## Prerequisites

- [ ] Read `AGENTS.md` and the subagent contracts (`docs/contracts/subagent-boundary.md`, `src/agent-src/contexts/execution/subagent-spawn-contract.md`, `subagent-steering.md`).
- [ ] Read `src/skills/subagent-orchestration`, `memory-consolidation`, `agent-handoff`, `src/rules/delegation-policy.md`, `source-discovery-gate.md`, and the reminder-injection verdict context note before editing.

## Context

- These are quality mechanics for the delegation + memory layers we already own the *authority* model for — they improve fidelity, not scope.
- The memory upgrades sit beside `source-discovery-gate`'s read-fresh discipline (staleness = verify) and `domain-safety-pii` (persist-time PII exclusion); they extend, not duplicate.

## Phase 1 — Worker-prompt contract

`subagent-orchestration` owns the authority model but not handoff quality. Frontier dispatch encodes a three-part worker-prompt contract that prevents the two classic failures: lossy re-summarization dropping the user's requirements, and over-scripted prompts that break on first contingency.

- [ ] Add a worker-prompt contract to `subagent-orchestration`: (a) pass the user's constraints/exclusions/preferences **verbatim** into the worker prompt — never a paraphrase (paraphrase silently drops requirements); (b) **describe the goal, don't script the approach** (over-scripting breaks on contingencies); (c) **translate environment paths** — orchestrator-local paths do not exist in the worker's sandbox; (d) **pre-declared check-in conditions** — the worker names the conditions under which it will halt and ask (e.g. "if login required", "if multiple candidates found") at spawn time, so interrupts are predictable.
- [ ] Cross-link `delegation-policy` (when to delegate) and the spawn-contract context so the boundary is explicit.
- [ ] Verify: `./scripts-run src/scripts/skill_linter`.

**Exit criteria:** the four-part worker-prompt contract is live in `subagent-orchestration`.
**Rollback:** revert the section.

## Phase 2 — Memory upgrades (save-successes, reference-type, verify-then-repair)

Three clean memory-quality gains for `memory-consolidation` / `memory:add`.

- [ ] **Save validated successes, not only corrections.** Correction-only memory drifts the agent toward over-caution over time — record approaches the user has explicitly validated too (watch for quiet confirmations: "yes exactly", an unusual choice accepted without pushback).
- [ ] **Add a `reference` memory shape** — a pointer to *where* truth lives in an external system (not the truth itself), matching the `source-discovery-gate` cache-vs-source philosophy. (Check the existing memory `type` set first; extend the schema only if genuinely absent.)
- [ ] **Staleness = verify-THEN-repair.** A memory naming a file/function/flag is a claim it existed *when written*; before recommending, confirm it still exists; on conflict, trust the current observation AND update/remove the stale memory (repair, don't just ignore).
- [ ] Verify: `./scripts-run src/scripts/skill_linter`.

**Exit criteria:** the three upgrades are live; the `reference` shape either exists or is added with schema note.
**Rollback:** revert each independently.

## Phase 3 — Derivability-exclusion (ADAPT)

The source's "never store what git/repo answers" is correct but the static form is tricky (the agent can't know what git will answer without asking). Adopt the *adapted* form.

- [ ] Add a derivability check to `memory:add` / `memory:propose`: before persisting a fact that could be derived from the repo/git/config, consult the authoritative source; if the source answers it, don't persist — instead capture "what was *surprising* or non-obvious" about it. Applies even when the user explicitly asks to "remember this" (redirect to the surprising part).
- [ ] Cross-link `source-discovery-gate` (the read-fresh twin) so the two live together.
- [ ] Verify: `./scripts-run src/scripts/skill_linter`.

**Exit criteria:** the consult-source-before-persist check is live (not a static exclusion list).
**Rollback:** revert the check.

## Phase 4 — Instructions-verbatim-first handoff template

Upgrade `agent-handoff` with the lossless-compaction shape: the failure it prevents is compaction dropping the user's constraints/corrections and causing post-handoff drift.

- [ ] Add to `agent-handoff`: preserve ALL user instructions **verbatim** (not summarized) as the highest-priority section; a repeatable-workflow template (atomic unit, per-iteration steps, decision criteria) when the work is iterative; an exact resume pointer ("continue with X"); an errors+fixes and feedback-history section.
- [ ] Cross-link `chat-history-import` and `memory-consolidation` so handoff, import, and durable memory are distinguished.
- [ ] Verify: `./scripts-run src/scripts/skill_linter`.

**Exit criteria:** the verbatim-first handoff template is live in `agent-handoff`.
**Rollback:** revert the template section.

## Phase 5 — Record the reminder drift-audit disposition

The drift-audit reflection (long-session self-audit: fresh-instance test, caring-observer test, licensed silent correction) is mechanism-distinct from the torn-down naive/blocking reminder injection (that tested rule-restatement / blocking projections — a ceiling; this is a discretionary salience self-audit). Per `decision-revisit-gate` mechanism-match it is *eligible* for a fresh eval — but the council converged that it is **not worth the eval cost now** (one prior null in the reminder family; the mechanism is subjective/discretionary).

- [ ] Append the disposition to the existing reminder-injection verdict context note (`agents/settings/contexts/reminder-injection-verdict.md`): reminder drift-audit = **rejected-now, revisit-if** — revisit only if salience-drift (long-session sycophancy ratchet / persona degradation) is observed in production after the other harvest items ship. Record scope + revisit-if per the convergence-summary contract; no eval scheduled.
- [ ] Verify: `./scripts-run src/scripts/check_refs` on the touched note.

**Exit criteria:** the drift-audit disposition (rejected-now + concrete revisit trigger) is recorded; no eval built.
**Rollback:** revert the note append.

## Acceptance Criteria

- Worker-prompt contract in `subagent-orchestration`; four memory upgrades in the memory pipeline; verbatim-first handoff in `agent-handoff`; drift-audit disposition recorded.
- No new always-on rule; no kernel change; no eval apparatus built (drift-audit stays recorded-only).
- All touched skills pass `./scripts-run src/scripts/skill_linter`; remote CI is the authoritative gate.
- No tracked artifact names the external source; provenance link remains ENC1-only.

## Provenance

- **Source D** — a frontier-host multi-agent dispatch prompt: worker-prompt contract, four memory-type spec + save-successes / reference-type / derivability-exclusion / verify-then-repair, index/content separation.
- **Source A** — a frontier-host consumer chat prompt: memory-application context (already largely shipped); the drift-audit reflection block.
- **Source C** — a frontier-host browser-agent prompt: instructions-verbatim-first compaction template.

Deep-dive per `external-reference-deep-dive`: raw prompts fetched and read in full; raw named evidence stays local-only.

Retained links (maintainer-recoverable):
`ENC1:OkDMSw1H8riL2IYYW/e3LT2hIqXkBbkG3LMCx80RM7pKgvKYGp51LJB+EynSrmJQv3HrBVd7D7+WPGM2VJaIRGCfvaXw8hJ13jBKVM1hdDMKWZxhA5C5O2eRS//M8eitODHDKZ7utWJRSJy453Hbg1WPNYnCcEaQbNY85P9G/kR8uI6IrSYOJdyAr9Ejep2YEr0xOWoK`
`ENC1:uxlQJvY++PkFMuFwkTjv4htKleoZ8e5ijZzs0R4EKPiR/WiF0T/XR8tIgDceKNQCksWsxzm+SITdZAjDUh5wadgepGfQ7R73Wz8l2ZTGCVcxBorS0+nvEGiPYBEchtwcLGFy3Y/LudSYTyvxJRHUcSO0dj0AAqWEVdgWzBs6GQerWXbl`

Council (claude-sonnet-4-5 + gpt-4o, 2 rounds, 2026-07-08) converged: ADOPT worker-prompt contract, memory upgrades (save-successes, reference-type, verify-then-repair), verbatim-first handoff; ADAPT derivability-exclusion to consult-source-before-persist; REJECT the reminder drift-audit as an eval now (record rejected-now + revisit-if on production salience-drift).
