---
type: "auto"
tier: "1"
description: "telegraph.speak_scope != off — telegraph the prose; carve-outs (options, Iron-Law, code, paths) stay byte-stable"
self_contained: true
workspaces: [agent-config-maintainer]
packs: [meta]
enforced_by:
  - "observer:maintainer-review"
# obligation: "Post-rewrite validator runs on every reply when `speak_scope != off`" — src/rules/telegraph-speak.md:66
obligation_frequency: "per-turn"
---

# Telegraph Speak

## The Iron Law

```
CONDENSE BODY PROSE ONLY. THE SEVEN CARVE-OUTS ARE PRESERVED BYTE-FOR-BYTE.
MANGLING A CARVE-OUT BREAKS ANOTHER RULE'S IRON LAW — VALIDATE AFTER REWRITING
AND RESTORE ANY REGION WHOSE BYTES MOVED.
THIS RULE IS DORMANT BY DEFAULT. FLIPPING IT ON NEEDS A PASSING OUTPUT-SIDE
BENCH, NEVER A PREFERENCE.
```

## Scope

Two independent switches, and only one of them removes the cost:

| Key | Default | Effect |
|---|---|---|
| `telegraph.enabled` | `true` | Master — `false` forces every sub-switch off. |
| `telegraph.speak` | `false` | **Compile-time.** `false` omits this rule from `dist/router.json` entirely — the only lever that stops the ~982-token body from shipping. |
| `telegraph.speak_scope` | `off` | **Runtime** scope of telegraph grammar. Does NOT remove the token cost: `compile_router` never reads it. |

`speak_scope` values: `off` (rule inactive) · `prose_only` (telegraph in body
prose, carve-outs preserved) · `aggressive` (everywhere except Iron-Law literals).

Both defaults are evidence-locked, not stylistic: telegraph measured **−9.27%**
(API counts) / **−5.47%** (`cl100k_base` re-analysis, same 30 replies) against a
plain "be terse" instruction — it emits *more* tokens than the cheaper
alternative, so the kill-criterion lands on "defer". The reasoning, the
superseded `prose_only` claim, and the dormancy authorization live in
[`0001-default-off-until-bench`](../../docs/adrs/telegraph/0001-default-off-until-bench.md),
[`0002-dormant-by-default-removal-authorized`](../../docs/adrs/telegraph/0002-dormant-by-default-removal-authorized.md),
and [`condensation-default-kill-criterion`](../../docs/contracts/condensation-default-kill-criterion.md).

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

## See also

- Input-side memory condensation (shrinking always-loaded memory files like `AGENTS.md` / `CLAUDE.md` / `.cursorrules` rather than the reply stream) runs independently of `speak_scope` — see [`condense-memory`](../skills/condense-memory/SKILL.md) for the script wrapper, sensitive-path refusal contract, and `.original.md` round-trip.
- Skills marked `token_budget_class: rich` are **exempt** from telegraph condensation + thin-projector trimming (gated by `tokens.rich_skills`, default `on`) — full model in [`token-budget-discipline`](token-budget-discipline.md).
- Any telegraph/trim decision that would drop a net-positive change purely on budget grounds routes to [`token-budget-discipline § Value-over-budget escalation`](token-budget-discipline.md#value-over-budget-escalation) — surface the trade-off, don't auto-reject.

Cross-rule index: [`frugality-charter § cross-references`](../contexts/contracts/frugality-charter.md#cross-references--frugality-canon-rules).
