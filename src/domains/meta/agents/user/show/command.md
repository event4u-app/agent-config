---
model_tier: medium
name: agents-user-show
pack: meta
tier: 2
visibility: internal
cluster: agents
sub: user
skills: [agents]
description: Read-only render of the effective (merged) user profile — global profile.md plus project .agent-user.md. --audit renders the global layer raw for delete/revoke decisions.
argument-hint: "[--audit]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agents user show

Read-only render of the **effective, merged** user profile — the
global `~/.event4u/agent-config/user/profile.md` layer plus the
project-root `.agent-user.md` layer — per
[`docs/contracts/agent-user-schema.md`](../../../../docs/contracts/agent-user-schema.md)
and its Loader contract / merge rule (ADR-138).

Use when:

- You want to see what persona the host agent currently loads.
- You want to confirm the **effective** `last_updated` is fresh (≤90 days).
- You want a paste-ready summary for handoff or onboarding.

Does **not** edit, observe, or buffer anything. Pure read.

Called with `--audit` (road-to-global-user-memory Phase 4): renders the
GLOBAL layer's raw holdings instead of the merged effective profile —
see [§ Audit mode](#audit-mode---audit) below. Use `--audit` when
deciding what to delete via [`/agents user delete`](delete.md).

## Steps

### 1. Locate both layers

```bash
ls .agent-user.md 2>/dev/null
ls ~/.event4u/agent-config/user/profile.md 2>/dev/null
ls ~/.config/agent-config/user/profile.md 2>/dev/null   # legacy fallback
```

| Project file | Global file | Action |
|---|---|---|
| Present | Present or absent | Proceed — project layer wins per field it declares |
| Missing | Present | Proceed — render sourced entirely from the global layer |
| Missing | Missing | Print "No `.agent-user.md` and no global profile found. Run `/agents user init` to create one, or set up the global profile." and stop |

### 2. Parse frontmatter — per layer

Parse each present layer's YAML frontmatter and body (everything after
the second `---`) independently. Per layer:

- `version` is `1`.
- File is ≤100 lines total — the cap applies **per layer**, never as a
  shared total across both files.

Any violation → print a one-line warning identifying the layer, the
missing/malformed field, and continue with the render (so the user can
fix it via `/agents user update`).

### 3. Merge

Apply the deepest-wins merge rule per
[`agent-user-schema.md § Global profile layer`](../../../../docs/contracts/agent-user-schema.md#global-profile-layer-adr-138):
for each field (`identity.name`, `language`, `role`, `style.pace`,
`voice_sample`, `last_updated`), the project layer's value wins when
present, otherwise the global layer's value is used. `# Notes`
concatenates both layers' text under `[global]` / `[project]` markers
when both carry content.

### 4. Render

Print the merged persona in this exact shape:

```
Effective user profile  ({staleness_marker})
  sources: identity.name={global|project}, style.pace={global|project}, …

  Identity   : {nickname or name}  ({name} if nickname is set)
  Language   : {language}
  Role       : {role}
  Style      : {pace}

  Voice sample
  ─────────────
  {voice_sample, indented 2 spaces}

  Notes
  ─────────────
  {merged notes, indented 2 spaces; "(empty)" if neither layer has notes}
```

Where `{staleness_marker}` reflects the **effective** `last_updated`
(the merged value, not necessarily the project file's own date):

- empty when within 90 days.
- ` ⚠️  >90 days` when older (per the schema staleness rule).

The `sources:` line lists only the fields that resolved to a
non-default value, so a project-only or global-only user sees a
single-source line and is not confused by an empty cascade.

### 5. Loader hint

If the host-agent loader has NOT yet picked up the file this session
(detect via session memory if available), print one line:

```
ℹ️  Host agent will load this on next session start. Restart your chat to apply.
```

Otherwise omit — agent already knows.

### 6. Stop

Do NOT chain to other `/agents user *` commands. Do NOT commit.

## Audit mode (`--audit`)

Road-to-global-user-memory Phase 4. Renders what the GLOBAL layer
currently holds — `profile.md`'s fields, the observation buffer's entry
count and per-field counts, promotion candidates, and the revocation
ledger's tombstone count — without the user reading raw JSONL. This is
the global layer only; the project-local `.agent-user.md` never leaves
the project it lives in, so there is nothing to audit for it here.

1. Call
   [`renderGlobalMemoryAudit()`](../../../../../src/scripts/_lib/user_global_memory_audit.ts).
2. Print its `text` verbatim — every value it contains already passed
   the same
   [`knowledge_global_redaction.redaction_scan`](../../../../../src/scripts/_lib/knowledge_global_redaction.ts)
   gate the write path runs; nothing here needs a second scan.
3. If `revocationCount > 0`, add one line: "Run `/agents user delete
   --show-revoked` to see what was deleted and why." (a stub for a
   future `--show-revoked` flag; today the count is sufficient — the
   full ledger is inspectable via
   [`user_global_revocations.loadTombstones`](../../../../../src/scripts/_lib/user_global_revocations.ts)
   for a maintainer who needs it).
4. Stop. Do NOT chain to `--audit`'s own delete follow-up — hand the
   user to [`/agents user delete`](delete.md) explicitly if they name
   something to remove.

## Rules

- Read-only. Never write `.agent-user.md` or the global `profile.md`
  from this command — including `--audit` mode.
- Never print fields the schema does not define — even if they exist
  in the file. (Forward-compat: an unexpected field is a warning, not
  a render target.)
- Mirror the user's language for the rendered labels (`Identity` /
  `Identität`, `Language` / `Sprache`, etc.) per
  [`language-and-tone`](../../../../dist/agent-src/rules/language-and-tone.md).

## See also

- Schema: [`agent-user-schema`](../../../../docs/contracts/agent-user-schema.md) — see § Global profile layer for the merge rule this command renders, and § Delete, revoke, and audit for `--audit`'s contract.
- Parent: [`/agents user`](../user.md).
- Sibling: [`/agents user init`](init.md), [`/agents user update`](update.md), [`/agents user delete`](delete.md) — the delete/revoke counterpart `--audit` informs.
