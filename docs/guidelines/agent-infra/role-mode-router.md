# Role Mode Router

Maps common entry signals to the correct role mode defined in
[`role-contracts`](role-contracts.md). The router is advisory —
it proposes a mode, the user can veto with `/mode none`.

## Entry signal → mode

| Signal pattern | Inferred mode |
|---|---|
| "implement X", "add feature", `/jira-ticket`, `/bug-fix` | `developer` |
| `/review-changes`, `/judge`, "review this PR", PR open on active branch | `reviewer` |
| "add tests", "why does X fail", test output pasted in context | `tester` |
| "I want a feature", `/feature-explore`, `/feature-plan`, "what should it do" | `po` |
| "production is down", `break-glass: true`, hotfix branch, live incident framing | `incident` |
| "what's the strategy", `/feature-roadmap`, multi-step work with unclear order | `planner` |

The signals are **non-exclusive**. When two patterns match, prefer the
narrower one (`incident` > `developer`; `reviewer` > `tester`).

## Surfacing the inferred switch

Before doing any work, the agent emits **one line** in the user's
language (per `language-and-tone`):

```
> entering {mode} mode — contract: {goal-field} / {constraints-field} / {output-field}
```

This is the only announcement. Do not narrate the reasoning for the
mode choice. If the user is silent, proceed; if they reply
`/mode none` or `/mode <other>`, switch immediately.

## When NOT to infer

- `roles.active_role` is already non-empty in `.agent-settings.yml` —
  respect the explicit setting; do not second-guess it.
- `roles.default_role` is set and matches the inferred mode — still
  surface the announcement (it reassures the user the frame loaded).
- No signal matches — **do NOT guess**. Stay mode-less and let
  `ask-when-uncertain` handle the scope question.

## Precedence

1. Explicit `/mode <name>` in the current message — wins absolutely.
2. `roles.active_role` from `.agent-settings.yml` — sticky within session.
3. Router inference from the entry signal table above.
4. `roles.default_role` fallback — only when no signal matches.
5. No mode — rule `role-mode-adherence` stays inert.

## Veto path

```
> 1. Switch to {mode-b} — run /mode {mode-b}
> 2. Stay in {mode-a}
> 3. Clear mode — run /mode none
```

The agent MUST use numbered options (per `user-interaction`) and accept
both the number and the spelled-out slash command.

## Interactions

- [`role-contracts`](role-contracts.md) — the contracts this router targets.
- [`role-mode-adherence`](../../rules/role-mode-adherence.md) — enforces
  the contract once a mode is active.
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — the
  fallback when no signal matches.
- [`/mode`](../../commands/mode.md) — user-facing override.

## Signal table maintenance

The table lives here, not in `role-contracts.md`. Commands and rules
reference modes by slug only — the routing layer is the single place
that maps free-form intent to a slug. Add a signal only when:

- ≥3 real sessions in `agents/sessions/` have surfaced the same pattern.
- The pattern does not collide with an existing row (check neighbours).
- The inferred mode is one of the six — never invent a seventh.

Signals captured but not yet promoted live in a scratch list at the
bottom of this file (delete when promoted).

## Scratch list (candidates)

<!-- Add `{signal} → {mode}` lines here; promote to the table above
     only after the criteria in the previous section are met. -->

_None yet._
