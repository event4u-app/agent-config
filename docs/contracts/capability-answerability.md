---
stability: beta
keep-beta-until: 2026-11-24
---

# Capability answerability — carry it, or name the check

An agent repeatedly has to decide whether a capability is available. Two
mechanisms exist and they trade against each other:

- **Carry the fact** — a `session_start` concern puts the answer in context
  before anything asks. Costs tokens on every session, including the many that
  never touch the capability. Cannot be missed.
- **Name the check** — the rule that depends on the capability names the verb
  that answers it. Costs nothing until the rule is read, and costs an inference
  the agent may not make.

The wrong default is to pick one and apply it everywhere. Carrying everything
turns `session_start` into a second rule corpus; naming everything reproduces
the failure this contract exists to prevent, because the agent that needed the
fact is exactly the agent that did not know to ask.

So the choice is recorded **per capability**, with its reason.

## The decision table

| Capability | Choice | Probe | Why this side of the trade |
|---|---|---|---|
| **AI council configured** | **carry** | `council:status` | Already shipped as a `session_start` concern. It earned the carry the expensive way: an agent announced the council absent and substituted a weaker path, repeatedly, while it was configured the whole time. The failure is silent, the wrong answer is plausible, and the agent has no reason to suspect it — the three conditions that justify paying every session. |
| **Packs active** | **conditional carry** — not built here | `packs:active` | Five safety floors say "auto-activates when pack X is installed". The healthy case needs no line, but the DEGRADED case (a settings file with no `profile.id`, so zero packs load) is silent and makes every pack-gated rule inert. The right shape is a concern that emits **only** when resolution is degraded: nothing in the common case, loud exactly when wrong. Recorded as the decision; the concern is not implemented here and its absence leaves `packs:active` as a named check. |
| **Settings key resolution** | **name** | `settings:get <key>` | Unbounded by construction — there are ~140 leaves and no session needs more than a few. Carrying them is not a trade-off, it is impossible. The rules that read settings name the verb instead (see the resolution-chain pointers added to the rules that name `.agent-settings.yml`). |
| **MCP servers / tools** | **name** | `mcp:available` | The live session already receives its actual tool list from the host, which is a better answer than any file. The gap the verb closes is an AUTHORING question — what is declared versus what could launch — asked while writing a skill, not while using one. A carried line would restate what the session already knows and still not answer the authoring question. |
| **Brand layer present** | **name** | `brand:status` | Only relevant while building or reviewing UI, copy, or assets. `brand-source-of-truth` is where that work starts and now states both the canonical paths and the verb, so the check is named at the only moment it matters. |
| **Hook binding on this host** | **name** | `hooks:status` | Relevant only when a rule makes an enforcement claim. Those rules now name the verb (seven of them), which puts the check exactly where the claim is read. Carrying a per-host hook matrix every session would be a large, mostly-unread table. |
| **Host subagent-spawn** | **name** | `routing:doctor` | The semantics this row waited on were settled elsewhere: the `subagents.host_capabilities` settings key was **removed**, and capability now resolves from a committed host registry plus a live environment probe — a fact about the host, never a setting. That removes the dependency that made the carry undecidable. It lands on `name` for the same reason as hook-binding: it matters only inside `delegation-policy`, which now states the check. The verb reports **per-field provenance**, because five of the six fields come from a committed table and `false` on an unrecognized host means "nobody answered", not "the host cannot". |

## How to read a "name" decision

`name` is not "do nothing". It means a specific rule states the answer is not
free, names the verb, and says what to do when the answer is unavailable. A
capability whose rule does neither is unanswerable in practice however many
verbs exist — which is the failure `hooks:status` demonstrated by existing for
months while **zero** rules mentioned it.

## When to revisit

Flip a `name` to a `carry` when the same wrong guess is observed twice. That is
the bar the council case cleared, and it is deliberately empirical: the cost of
carrying is certain and paid every session, so it should be bought with evidence
rather than with the suspicion that somebody might one day guess wrong.

## See also

- [`council-availability`](../../src/rules/council-availability.md) — the shipped carry, and the incident that bought it.
- [`brand-source-of-truth`](../../src/rules/brand-source-of-truth.md) — the canonical brand paths and `brand:status`.
- [`settings-classes`](settings-classes.md) — the A/B/C class contract `settings:get` reports against.
- [`src/shared/settingsCarveOut.ts`](../../src/shared/settingsCarveOut.ts) — the keys where absent is not the template default.
