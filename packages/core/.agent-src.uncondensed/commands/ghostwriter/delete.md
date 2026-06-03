---
model_tier: inherit
name: ghostwriter:delete
pack: gtm-marketing
tier: 2
cluster: ghostwriter
sub: delete
skills: [ghostwriter]
description: Hard-delete a ghostwriter profile at agents/reference/ghostwriter/<slug>.md after a two-step confirmation. No backup, no soft delete — the file is gone after acceptance.
suggestion:
  eligible: true
  trigger_description: "delete ghostwriter profile, remove public-figure voice, drop ghostwriter, retire captured profile"
  trigger_context: "user wants to permanently remove a captured ghostwriter profile from agents/reference/ghostwriter/"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /ghostwriter:delete

Hard-delete a single `agents/reference/ghostwriter/<slug>.md` profile after a
**two-step confirmation**. The file is gone after acceptance — no
backup, no soft delete, no trash directory. Mirrors the destructive
posture of `/agents:user:delete`.

## Steps

### 1. Resolve target

Argument shapes:

- `/ghostwriter:delete <slug>` → positional slug.
- `/ghostwriter:delete` → interactive: print the same numbered table
  as [`/ghostwriter:list`](list.md) and ask the user to pick one by
  number or slug. One question per turn.

| State | Action |
|---|---|
| File missing | Abort. Print: *"No profile at `agents/reference/ghostwriter/<slug>.md`. Run `/ghostwriter:list` to see what exists."* |
| File present, `fictional: true` | Abort. Print: *"`<slug>.md` is a package-side fixture. Delete it via the source tree, not this command."* |
| File present, real | Proceed to Step 2 |

### 2. Print a minimal summary

Show the user **exactly** what is about to disappear, sourced from
the file's frontmatter (do not render the full profile body):

```
About to delete agents/reference/ghostwriter/<slug>.md
  identity.name:       <name>
  role:                <role_or_title>
  category:            <public_figure_category>
  confidence:          <low|med|high>
  source count:        <source_provenance.count>
  last_fetched_at:     <ISO date>
  verification:        <fetched|user-asserted>
```

This is the only summary surface — the full profile is one
`/ghostwriter:show <slug>` away if the user wants to re-inspect
before answering.

### 3. First confirmation (intent)

Ask, verbatim, one question per turn:

> *"Delete this ghostwriter profile? `<slug>.md` will be hard-deleted
> with no backup. Type `delete` to continue, anything else to cancel."*

Anything other than the literal token `delete` (case-insensitive,
trimmed) → abort with: *"Cancelled. No file was deleted."*

### 4. Second confirmation (irreversibility)

Ask, verbatim:

> *"Last chance. This is hard-delete — no `.bak`, no trash, no undo
> from this command. Type the slug `<slug>` exactly to confirm."*

User must type the slug literally (case-sensitive, trimmed). Any
other input → abort with the same cancel line as Step 3.

### 5. Delete + print confirmation

Remove the file. Then print:

```
✅  agents/reference/ghostwriter/<slug>.md deleted.
    /ghostwriter:list now shows N profiles.
```

`N` reflects the post-delete count under `agents/reference/ghostwriter/`
(excluding `README.md`).

### 6. Stale-warning surface (optional)

After the delete, if any remaining profile is stale (>90 days), print
the standard stale-warning lines (one per stale slug). Mirrors the
post-write surface in `/ghostwriter:fetch` Step 7. Non-blocking.

## Rules

- **Hard-delete only.** No `.bak`, no soft delete, no trash directory.
  Mirrors `/agents:user:delete`.
- **Two-step confirmation is mandatory.** Skipping either step is a
  contract violation. The two prompts must be distinct turns; do not
  batch them into one numbered-options block.
- **Do NOT commit, push, or open a PR.** The user owns the git surface;
  consumer ghostwriter files are gitignored by default.
- **Do NOT delete package-side fixtures.** `fictional: true` files
  belong to the source tree and are out of scope for this command.
- **Do NOT delete `agents/reference/ghostwriter/README.md`.** The directory
  anchor is not a profile.
- **Do NOT bulk-delete.** One slug per invocation, even when the user
  passes a glob.

## See also

- [`/ghostwriter`](../ghostwriter.md) — parent cluster.
- [`/ghostwriter:list`](list.md) — pick a slug to delete.
- [`/ghostwriter:show`](show.md) — re-inspect before deleting.
- [`/ghostwriter:fetch`](fetch.md) — re-create a profile from scratch (no recovery from this command).
- [`/agents:user:delete`](../agents/user/delete.md) — sibling destructive command this one mirrors.
