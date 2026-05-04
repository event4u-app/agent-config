---
type: "auto"
description: "Keeping .augment/ contexts, counts, and cross-references in sync when creating, renaming, or deleting skills, commands, rules, guidelines, templates, or any agent infrastructure files"
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/docs-sync-mechanics.md
---

# Docs Sync

## Rule

**CRITICAL — ZERO TOLERANCE:** When a file in `.augment/` is **created, renamed, or deleted**,
or its **name, description, scope, or counts change**, all related files **must be updated
in the same response** — not later, not in a follow-up, not when reminded.

A new rule/skill/command without its index entry, count update, and context update is **incomplete work**.

**Mandatory sequence when creating/deleting any `.augment/` file:**
1. Create/delete the file
2. **Immediately** update `contexts/augment-infrastructure.md` (counts + category tables)
3. Check cross-references in contexts and routing hints (inline "see X skill" references)
4. If a **skill** was added/renamed/deleted: update distribution manifests
5. If a **hook** was added/renamed/deleted: update hook registries
6. If **content** changed: run the consistency grep across other artefacts

Steps 2–6 are NOT optional. Do NOT present the result to the user until all steps are done.

**Two modes:**
- **Reactive** (automatic): Triggered by add/remove/rename or scope/description/count changes → sync counts, contexts, cross-references, manifests, registries.
- **Proactive** (on demand): Full audit → find duplicates, thin skills, redundancy, stale content → fix or merge. Ask before destructive actions.

## Settings template sync

When a skill, rule, or command **reads a new setting** from `.agent-settings.yml` that does not yet
exist in `.augment/templates/agent-settings.md`:

1. **Add the key** with its default value to the template block.
2. **Add a row** to the Settings Reference table.
3. **Add a comment** above the key explaining what it does.
4. **Update the local `.agent-settings.yml`** — add the new key with its default value.
   Preserve all existing values, apply template order and comments. Follow the
   [section-aware merge rules](../../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)
   so the user benefits immediately without running a separate command.

**This step is mandatory.** If the template gains a new key but the local `.agent-settings.yml`
is not updated, the user cannot discover the new setting exists.

## Lookup tables and details — see mechanics

The exact "what to update" tables, cross-reference targets,
distribution-manifest update tables (`marketplace.json` etc.), hook
registry update tables (`__init__.py`, consumer-settings JSON), the
failure mode that motivated the manifest section, and the content
consistency `grep` snippet all live in
[`contexts/communication/rules-auto/docs-sync-mechanics.md`](../contexts/communication/rules-auto/docs-sync-mechanics.md).
Pull it whenever a sync trigger fires.

## Do NOT

- Do NOT rewrite entire files — only update the affected entries.
- Do NOT ask the user for permission — this is an automatic maintenance step, like updating imports.
- Do NOT skip cross-reference updates — stale links are worse than no links.
- Do NOT present a new `.augment/` file to the user without having completed all sync steps first.
- Do NOT defer sync to a "follow-up" — it must happen in the same response as the creation/deletion.
