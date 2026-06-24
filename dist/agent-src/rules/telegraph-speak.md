---
type: "auto"
tier: "1"
description: "When telegraph.speak_scope != off — condense prose to telegraph grammar with carve-outs for numbered options, Iron-Law, code, paths, error markers"
triggers:
  - intent: "any reply"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Telegraph Speak

Condense reply prose to telegraph grammar per `telegraph.speak_scope`. Body
prose only — carve-outs preserved byte-for-byte.

## Scope

Read `telegraph.speak_scope` from `.agent-settings.yml`:

- `off` — rule inactive.
- `prose_only` (default) — telegraph in body prose; carve-outs preserved.
- `aggressive` — telegraph everywhere except Iron-Law literals.

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

- Optional CI-side regression lock: [`scripts/validate_telegraph_carveouts.py`](../../scripts/validate_telegraph_carveouts.py) — pre/post reply pair, byte-identical preservation across all seven carve-out categories; runtime mechanism stays algorithmic, script is the offline check.

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
| `telegraph.speak_scope` | `prose_only` | Runtime scope of telegraph grammar. |

- Input-side memory condensation (shrinking always-loaded memory files like `AGENTS.md` / `CLAUDE.md` / `.cursorrules` rather than the reply stream) runs independently of `speak_scope` — see [`condense-memory`](../skills/condense-memory/SKILL.md) for the script wrapper, sensitive-path refusal contract, and `.original.md` round-trip.

## Amendment — `token_budget_class: rich` skills are exempt

Skills marked `token_budget_class: rich` in their frontmatter are **exempt**
from telegraph-speak condensation and thin-projector trimming. Their prose,
examples, tables, and code blocks load and render in full, regardless of
`telegraph.speak_scope`. This exemption is gated by `tokens.rich_skills` in
`.agent-settings.yml` (default `on`). See `token-budget-discipline` rule for
the full governance model and the ≤15% cap.

Cross-rule index: [`frugality-charter § cross-references`](../contexts/contracts/frugality-charter.md#cross-references--frugality-canon-rules).
