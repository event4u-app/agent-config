# ADR-219 — `MERGEABLE_KEYS` follows the key migration it was left behind by

- **Status:** Accepted
- **Date:** 2026-08-08
- **Context roadmap:** capability answerability, step 4.3

## Context

`MERGEABLE_KEYS` in `src/scripts/_lib/agent_settings.ts` is the exact allowlist
of dotted paths that may cascade from the user-global settings file into the
merged settings. Everything not on it is **silently discarded** by
`_filter_whitelist`. Its own comment states that adding a key requires an ADR,
which is why this record exists.

Three of its entries name keys the settings template does not have:

| Whitelist entry | Template key | Readers of the whitelisted spelling |
|---|---|---|
| `ide` | `personal.ide` | none |
| `personal.bot_icon` | `personal.pr_comment_bot_icon` | none |
| `name` | *(absent — user identity lives in `settings/.agent-user.yml` as `identity.name`)* | none |

The cause is visible in `src/scripts/install.ts`, which carries a migration map
including `ide: 'personal.ide'` and `pr_comment_bot_icon: …`. The keys moved
into their `personal.` home; the whitelist stayed at the pre-migration
spellings. So the allowlist has been protecting names that no longer exist while
filtering out the names that do.

The user-visible consequence is the failure mode this roadmap exists to close:
setting `personal.ide` or `personal.pr_comment_bot_icon` in the user-global file
produces no error, no warning, and no effect. `personal.pr_comment_bot_icon` is
documented in the settings reference as *"Personal preference — each developer
decides"* — precisely the shape that is supposed to be user-global, and the one
shape it could not be.

## Decision

Add `personal.ide` and `personal.pr_comment_bot_icon` to `MERGEABLE_KEYS`, and
**keep** the three legacy spellings.

Additive, not a replacement. A user-global file still using a pre-migration
name keeps resolving exactly as before, so no install changes behaviour except
by starting to honour a key it was always meant to honour. `name` is retained
despite having no reader and no template key: removing it would be a narrowing
change, and this ADR is deliberately not a cleanup.

## Consequences

- The user-global surface widens by **two** keys, from 14 to 16. Both are
  per-developer preferences (which IDE, whether to prefix bot replies), neither
  governs spend, authority, egress, or a gate.
- A developer who set either key user-globally and concluded the feature was
  broken will find it starts working. That is the intended repair and it is a
  behaviour change; it is called out here rather than left to be discovered.
- The whitelist now carries duplicate spellings for two settings. That is the
  cost of staying additive, and the comment in the code says which spelling is
  current.
- Not fixed here: the migration map and the whitelist remain two lists that can
  drift apart again. A gate asserting that every `MERGEABLE_KEYS` entry either
  exists in the template or is explicitly marked legacy would prevent the next
  occurrence, and is not built by this record.

## Alternatives considered

- **Replace the legacy spellings.** Rejected: it would silently stop honouring a
  user-global file that still uses them, which is a regression for exactly the
  users who configured the feature earliest.
- **Remove `name`.** Rejected here as out of scope — correct, but a narrowing
  change bundled into an additive one, and it needs its own look at whether
  `identity.name` should be the whitelisted key instead.
- **Leave it and document the gap.** Rejected: the roadmap's finding is that
  documentation of an unanswerable state is what produced the defect class in the
  first place. A key that cannot work should be made to work or removed, not
  annotated.

## References

- `src/scripts/_lib/agent_settings.ts` — `MERGEABLE_KEYS`, `_filter_whitelist`
- `src/scripts/install.ts` — the migration map that moved the keys
- `docs/contracts/capability-answerability.md` — the carry-vs-name decision table
- `agent-config settings:get <key>` — reports the silent user-global drop this ADR removes for two keys
