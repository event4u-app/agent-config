---
type: "auto"
tier: "1"
description: "telegraph.speak_scope != off — telegraph the prose; carve-outs (options, Iron-Law, code, paths) stay byte-stable"
triggers:
  - intent: "any reply"
workspaces: [agent-config-maintainer]
packs: [meta]
enforced_by:
  - "observer:maintainer-review"
---

# Telegraph Speak

Condense reply prose to telegraph grammar per `telegraph.speak_scope`. Body
prose only — carve-outs preserved byte-for-byte.

## Scope

Read `telegraph.speak_scope` from `.agent-settings.yml`:

- `off` (**default**) — rule inactive.
- `prose_only` — telegraph in body prose; carve-outs preserved.
- `aggressive` — telegraph everywhere except Iron-Law literals.

> **Default corrected 2026-07-29.** This section previously claimed `prose_only`
> was the default, contradicting `docs/adrs/telegraph/0001-default-off-until-bench.md`
> (`Status: accepted`, 2026-05-16), which locks `off`, and
> `docs/contracts/condensation-default-kill-criterion.md`, which calls the feature
> "non-promoted". Two sources said `off`, one said `prose_only`, and the key
> existed in **no** config file, **no** loader default, and **no** schema property —
> so the runtime default lived only in prose, and the prose disagreed. The accepted
> ADR wins. The measured basis: median `vs_terse` is **−9.27%** (API counts) /
> **−5.47%** (exact `cl100k_base` re-analysis of the same 30 replies) — telegraph
> emits *more* tokens than a plain "be terse" instruction, so the kill-criterion
> table lands on "criterion not met — defer" and the telemetry multiplier stays
> suspended at 0.9155 < 1.0. Flipping this to `prose_only` or `aggressive` requires
> a passing output-side bench first, not a preference.
>
> **`off` does NOT stop the token cost** — verified 2026-07-29:
> `compile_router.ts` gates this rule on `telegraph.enabled` / `telegraph.speak`
> and never reads `speak_scope` (0 hits across the projector). Under
> `lean_projection.mode: eager-all` the ~982-token body is injected regardless.
> The zero-cost dormancy lever is **`telegraph.speak: false`**, which omits the
> rule from `dist/router.json` entirely.

Compile-time toggle `telegraph.speak`: `false` → rule omitted from
`dist/router.json` (zero runtime cost). `telegraph.enabled: false` forces all
sub-switches off regardless.

## Carve-outs — byte-for-byte preserved

Mangling these breaks Iron Laws. Apply regardless of `speak_scope`:

1. **Triple-backtick ALL-CAPS blocks** — Iron-Law literal fences in
   `commit-policy`, `non-destructive-by-default`, `direct-answers`, etc.
2. **Numbered-options blocks** — lines matching `^>?\s*\d+\.\s` plus
   the `**Recommendation:**` / `**Empfehlung:**` label
   (`user-interaction` Iron Law 1).
3. **Code blocks** — any triple-backtick fence, any language.
4. **Backtick spans** — file paths, command names, identifiers
   (`direct-answers` Iron Law 2 — no invented facts).
5. **Status / error markers** — lines prefixed `❌`, `⚠️`, `✅`.
6. **Mode markers** per `role-mode-adherence`.
7. **Deliverables** — PR titles / bodies, commit messages, ticket
   summaries, articles, single-question prompts asked to the user.
   These are written **for** the user, not chat-prose.

## Enforcement mechanism

Post-rewrite validator runs on every reply when `speak_scope != off`:

1. **Snapshot** — before condensation, hash each line in carve-out
   regions (1–7 above).
2. **Rewrite** — condense body prose to telegraph grammar.
3. **Validate** — re-scan; for each carve-out region whose line hash
   differs from the snapshot, **restore the original prose**.
4. **Emit** — the validated reply.

The rule documents the algorithm; agents apply it inline before
sending. The mechanism is the rule, not a hidden script.

- Optional CI-side regression lock: [`scripts/validate_telegraph_carveouts.ts`](../../scripts/validate_telegraph_carveouts.ts) — pre/post reply pair, byte-identical preservation across all seven carve-out categories; runtime mechanism stays algorithmic, script is the offline check.

## Telegraph grammar

- Drop articles (`the`, `a`, `an`).
- Drop linking auxiliaries (`is`, `are`, `was`, `be`) where
  unambiguous.
- Drop pronouns when context is clear.
- Keep nouns, verbs, key adjectives, negation, numbers.

Example: *"I will now check the file and see if it exists"* →
*"Check file. Exists?"*

## Settings

| Key | Default | Effect |
|---|---|---|
| `telegraph.enabled` | `true` | Master — `false` forces all sub-switches off. |
| `telegraph.speak` | `true` | Compile-time include in `dist/router.json`. |
| `telegraph.speak_scope` | `off` | Runtime scope of telegraph grammar. `off` per ADR 0001 (accepted) until an output-side bench passes. Does NOT remove the token cost — see § Scope. |

- Input-side memory condensation (shrinking always-loaded memory files like `AGENTS.md` / `CLAUDE.md` / `.cursorrules` rather than the reply stream) runs independently of `speak_scope` — see [`condense-memory`](../skills/condense-memory/SKILL.md) for the script wrapper, sensitive-path refusal contract, and `.original.md` round-trip.
- Skills marked `token_budget_class: rich` are **exempt** from telegraph condensation + thin-projector trimming (gated by `tokens.rich_skills`, default `on`) — full model in [`token-budget-discipline`](token-budget-discipline.md).
- Any telegraph/trim decision that would drop a net-positive change purely on budget grounds routes to [`token-budget-discipline § Value-over-budget escalation`](token-budget-discipline.md#value-over-budget-escalation) — surface the trade-off, don't auto-reject.

Cross-rule index: [`frugality-charter § cross-references`](../contexts/contracts/frugality-charter.md#cross-references--frugality-canon-rules).
