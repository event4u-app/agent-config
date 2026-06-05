---
adr: 054
status: proposed
date: 2026-06-05
decision: rule-adherence-decay-triggered-restate
supersedes: —
superseded_by: —
phase: v6.x · governance-loading reliability
type: structural
---

# ADR-054 — Counter "the model ignores ALL rules" with decay-triggered re-state, not per-turn injection

## Status

**Proposed** · 2026-06-05. Drafted for maintainer review (design-first). Routed
through the AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, design
mode, 2-round debate, 2026-06-05). Round 1 was split (per-turn injection vs.
decay-triggered + kernel discipline); the round-2 adversarial pass **converged**
both members against per-turn injection. Two council inaccuracies are corrected
below under *Context* rather than carried forward.

## Context

**The narrow problem (operator-stated):** Claude *sometimes ignores the whole
rule/skill layer at once* — the governance block silently drops out for a turn.
The goal is narrow: **Always-rules respected always; Auto-rules respected when
their trigger fires; do not force everything** (no blanket injection, no forcing
Skill invocation).

This is **not** a presence gap (in the default `eager-all` projection the kernel
+ rules are already in context every turn) and **not** a routing-coverage gap
(`dist/router.json` maps triggers fine). It is an **attention/adherence**
problem: the content is present but intermittently dismissed.

**Verified mechanism facts:**

- The 10-rule Always-kernel is ~25,590 **characters** (≤ 26k char cap, ~98%
  full). *Correcting the council's "25k tokens":* that is ≈ 6–7k tokens, not 25k
  — so the failure is **not** "the kernel fills 60% of the window". It is that a
  large, invariant, governance-toned block in a long conversation reads as
  low-information-density boilerplate and gets actively deprioritised as the
  user's turn-by-turn history grows.
- `context-hygiene` is an **Auto** rule (trigger-routed, with a `PostToolUse`
  hook), **not** part of the kernel. *Correcting the council's claim* that it is
  kernel — but its premise (long-context decay is real and tracked) is exactly
  why it is the right state source for the trigger below.
- The 7 shipped hooks are **state-only**; none re-surface or remind.
- Claude Code hooks can **inject** context (`UserPromptSubmit` / `SessionStart`,
  stdout or `hookSpecificOutput.additionalContext`, exit 0) but **cannot force**
  the model to apply a rule or invoke a Skill (verified). The ceiling is real.

## Decision

Adopt a **decay-triggered compact re-state**, not a per-turn injection.

1. **Trigger on decay, reuse existing state — do not fire every turn.** Hook into
   the freshness signal `context-hygiene` already maintains
   (`agents/runtime/state/context-hygiene.json`: turn count + the 20/40/60
   milestones). A `UserPromptSubmit` hook injects the re-state **only** when a
   decay threshold is crossed (and on `SessionStart`). Per-turn firing is
   rejected (see *Alternatives*): an identical reminder every turn habituates the
   model to dismiss it within 3–4 turns and worsens the signal-to-noise ratio
   that caused the dismissal.

2. **Payload = salience, not content.**
   - **Always:** a compact roster of the kernel by Iron-Law heading (one line
     each), not full bodies — the bodies are already projected.
   - **Auto:** for each rule the *current prompt* matches in `dist/router.json`,
     a one-line pointer ("in force this turn: `<rule>` — apply it"). Never inject
     unmatched Auto-rules; never escalate an Auto-rule to always-on.
   - Never inject skill bodies; never attempt to force a Skill call.

3. **Always unconditional, Auto only on router match.** The re-state re-surfaces
   the Always layer whenever it fires, and Auto pointers only for prompts that
   match a trigger — preserving the always/auto contract exactly.

4. **Claude Code first; graceful no-op elsewhere.** The hook writes to stdout /
   `additionalContext` and exits 0. Tools without a context-injecting hook
   ignore it; no new contract, no per-tool branching beyond the existing
   dispatchers (Cursor/Cline already have them).

5. **Honest ceiling, stated in-band.** The re-state counters decay-driven
   *dismissal*; it cannot *force* adherence. The roster is phrased as a
   directive the model is told to re-read, not as a guarantee.

6. **Root-cause follow-up (separate gate, not bundled):** the deeper lever is
   **kernel discipline** — keep the Always-kernel small and high-signal enough
   that dropping it creates obvious incoherence (the council's "shrink to the
   load-bearing Iron-Laws" argument). That touches the **contract-locked**
   `kernel-membership` surface and must run as its own ADR + slow-rollout PR. It
   is recorded here as the cure; this ADR ships the mitigation.

## Consequences

- **Positive.** Targets the actual failure (decay-driven total dismissal) with
  the cheapest reversible lever, reusing machinery the package already runs
  (context-hygiene state, `dist/router.json`). No per-turn token tax; no new
  always-on surface; the always/auto split is preserved.
- **Positive.** Delta-based, infrequent injection stays novel (avoids the
  habituation that sinks per-turn injection).
- **Negative / accepted.** It cannot guarantee adherence — a model can still
  ignore an injected reminder. The honest mitigation, not a fix.
- **Negative / accepted.** Adds a runtime evaluation of `dist/router.json` in the
  `UserPromptSubmit` path; must stay fast and exit 0 on any error (hooks never
  block the loop).
- **Deferred.** The kernel-shrink cure is not executed here.

## Alternatives considered

- **Per-turn salience injection (round-1 minority, then rejected).** Inject the
  kernel roster + matched-Auto pointers on *every* prompt. Rejected: an invariant
  per-turn reminder trains the model to filter it as boilerplate within a few
  turns and adds 500–1000 tokens/turn of governance text on top of an already
  governance-heavy context — accelerating the very dismissal it tries to cure.
  "Reliable firing" ≠ "reliable efficacy".
- **Do nothing / rely on `eager-all` presence.** Rejected: presence is already
  high; the failure is dismissal, which presence alone does not fix.
- **Shrink the kernel now, in this ADR.** Deferred, not rejected: it is the
  root-cause cure but edits a contract-locked surface (`kernel-membership`) and
  needs its own slow-rollout gate — bundling it here would violate the
  one-kernel-rule-per-PR discipline.

## Inversion check

This verdict flips if a measurement shows the model ignores a *small,
decay-triggered* re-state just as readily as the projected block — in which case
the only remaining lever is kernel-shrink (the follow-up), and the hook is
dropped as theatre. The cheap way to find out: a trigger-adherence probe
(does a known-trigger prompt produce rule-consistent behaviour with vs. without
the re-state) before investing in per-tool rollout.

## References

- `docs/contracts/rule-router.md` — `dist/router.json` trigger→rule mapping the
  re-state reads.
- `docs/contracts/kernel-membership.md` — the contract-locked Always-kernel the
  follow-up cure would touch.
- `.agent-src/rules/context-hygiene.md` + `scripts/context_hygiene_hook.py` —
  the freshness/turn-count state the decay trigger reuses.
- AI council, design mode, 2-round debate, 2026-06-05 (anthropic/claude-sonnet-4-5
  + openai/gpt-4o) — round-1 split, round-2 convergence on decay-triggered +
  kernel discipline over per-turn injection.
