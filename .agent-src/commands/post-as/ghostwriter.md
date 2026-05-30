---
recommended_model: inherit
name: post-as:ghostwriter
tier: 2
cluster: post-as
sub: ghostwriter
description: Thin alias for /ghostwriter:write — drafts a copyable markdown post in a captured public-figure voice with the mandatory non-removable disclosure footer.
suggestion:
  eligible: true
  trigger_description: "post as ghostwriter, draft as a public figure, write in style of X, post-as alias for ghostwriter:write"
  trigger_context: "user invokes /post-as:ghostwriter as a discoverable alias for /ghostwriter:write — same flags, same output, same mandatory disclosure footer"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /post-as:ghostwriter

**Thin alias** for [`/ghostwriter:write`](../ghostwriter/write.md).
Same flags, same output, same procedural contract, same **mandatory
non-removable disclosure footer**.

This command exists so the `/post-as:*` cluster is discoverable as a
single consumer-facing surface (`/post-as:me` for self,
`/post-as:ghostwriter` for public figures). It does not introduce
new behaviour.

## Steps

### 1. Forward to `/ghostwriter:write`

Invoke [`/ghostwriter:write`](../ghostwriter/write.md) with **every
argument and flag passed through verbatim**:

- `/post-as:ghostwriter` → `/ghostwriter:write`
- `/post-as:ghostwriter --as=<slug>` → `/ghostwriter:write --as=<slug>`
- `/post-as:ghostwriter <slug> --tone=casual --length=180 --channel=linkedin-post --audience="early-stage founders"`
  → `/ghostwriter:write <slug> --tone=casual --length=180 --channel=linkedin-post --audience="early-stage founders"`

Follow the routed file's `## Steps` section verbatim. Do not
re-implement, do not skip, do not add steps.

### 2. Disclosure footer (mandatory — inherited from `/ghostwriter:write`)

The footer is appended by `/ghostwriter:write`'s output template (per
[`write-engine § 5`](../../../docs/contracts/write-engine.md)). This
alias inherits the footer unconditionally — no `--no-disclosure`
flag, no `--internal` flag, no opt-out. Any flag that would suppress
it is forbidden by design.

## Rules

- **Do NOT diverge from `/ghostwriter:write`.** This file is a thin
  alias; behavioural drift is forbidden. If a new flag lands on
  `/ghostwriter:write`, it is automatically available here via the
  pass-through.
- **Do NOT add new steps, prompts, or output sections.** They belong
  on `/ghostwriter:write` (the canonical file).
- **Do NOT commit, push, or open a PR.** The user owns the git surface.
- **Do NOT consume `.agent-user.md`** — that is `/post-as:me`'s
  source. This alias only fronts the ghostwriter primitive.

## See also

- [`/ghostwriter:write`](../ghostwriter/write.md) — canonical implementation; this file is a thin alias.
- [`/post-as`](../post-as.md) — parent cluster.
- [`/post-as:me`](me.md) — sibling consumer, user-self voice, no footer.
- [`write-engine`](../../../docs/contracts/write-engine.md) — shared procedural contract.
- [`ghostwriter-schema`](../../../docs/contracts/ghostwriter-schema.md) — locked v1 frontmatter.
