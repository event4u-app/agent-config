---
model_tier: inherit
name: post-as
pack: gtm-marketing
tier: 2
description: Consumer-facing write entry points — :me drafts in the maintainer's own voice from .agent-user.md (no disclosure); :ghostwriter is a thin alias for /ghostwriter:write (mandatory disclosure footer).
cluster: post-as
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "write as me, post as me, draft in my voice, draft as ghostwriter, post-as alias"
  trigger_context: "user wants a copyable draft in their own voice (.agent-user.md) or in a captured public-figure voice (/ghostwriter:write alias)"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /post-as

Consumer-facing write cluster. Two thin entry points over the shared
[`write-engine`](../../docs/contracts/write-engine.md):

- `/post-as:me` — read `.agent-user.md`, draft in the **maintainer's
  own voice**, no disclosure footer (the user is the author).
- `/post-as:ghostwriter` — alias for `/ghostwriter:write`, mandatory
  disclosure footer.

## Sub-commands

| Sub-command | Routes to | Footer |
|---|---|---|
| `/post-as:me` | `commands/post-as/me.md` | **Omitted** |
| `/post-as:ghostwriter` | `commands/post-as/ghostwriter.md` (alias → `/ghostwriter:write`) | **Mandatory** |

Cluster locked in
[`command-clusters`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/post-as:<sub> [args]` or
   `/post-as <sub> [args]`.
2. Look up the sub-command in the table above.
3. Load the routed file and follow its `## Steps` section verbatim.
4. Unknown or missing sub-command → print the table and ask which
   one. **One sub-command per turn**; do not chain.

## Rules

- **Do NOT commit, push, or open a PR.** The user owns the git surface.
- **Do NOT consume `personas/*.md`** — those are review-lens voices,
  not author voices.
- **Do NOT omit the disclosure footer from `:ghostwriter`** — it is
  mandatory on every invocation. `:me` omits it because the user is
  the author.
- **Edit `.agent-src.uncondensed/` only.** `dist/agent-src/` and
  `.augment/` regenerate from source.

## See also

- [`write-engine`](../../docs/contracts/write-engine.md) — shared procedural contract.
- [`/ghostwriter`](ghostwriter.md) — producer side for public-figure profiles.
- [`agent-user-schema`](../../docs/contracts/agent-user-schema.md) — `.agent-user.md` source for `:me`.
