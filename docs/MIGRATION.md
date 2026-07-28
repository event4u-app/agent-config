# Migration Guide

How to move existing checkouts forward when `event4u/agent-config`
ships breaking layout changes. Each section is self-contained: read
only the version you are upgrading to.

> Symbol legend — 🔄 automatic, ✋ manual, 💡 advisory.

## Scheduled deprecations (forward-looking — read before cutting a major)

Every section below this one records a change that **already shipped**. This
table is the opposite: commitments made now, due at a **future** major. It
exists so a "deprecate at the next major, remove the major after" promise
cannot decay into folklore — the release runbook's pre-flight (§ 1) sends the
releaser here on every `release:major`.

| Surface | Committed | Deprecation notice due | Removal due | Reversal condition |
|---|---|---|---|---|
| `code_graph` native code-graph engine (`code_graph.enabled`, the `code-intelligence` skill's native arm, `code_graph_nudge_hook`) | 2026-07-28 | next major after 9.x | the major after that | A consumer case the graph answers and disciplined grep cannot. Measured null: recall 0.365 vs grep 0.797 (`docs/CLAIMS.md` `code-graph-retrieval-null`). Until then `enabled: false` is permanent. |

**Adding a row:** any change that ships a capability as default-off-pending-removal,
or that promises a future breaking removal, gets a row here in the same commit
that makes the promise. A promise with no row is not tracked and will be missed.

## 8.x → 9.0.0 — consumer rule projection scoped by default

9.0.0 flips the consumer rule-projection default to **scoped**: fresh
installs ship `projection.rule_workspaces` pre-filled with every consumer
workspace, dropping the 16 exclusively-maintainer specification rules from
what consumers receive — **103 → 88 rules** per install. Domain safety
floors, domain rules, and kernel rules are unaffected. Full breaking-change
detail: [`CHANGELOG.md` § 9.0.0](../CHANGELOG.md).

### Required action

🔄 **Automatic on sync.** Existing installs are unchanged until you run
`agent-config sync` / re-install; settings sync preserves your current
`projection.rule_workspaces` value. The first session after opting in
rebuilds the KV-cache prefix once (one session only).

### Rolling back

✋ Set `projection.rule_workspaces: []` (= legacy every-rule projection).

## 1.14.x → 1.15.0 — `implement_ticket` → `work_engine`

1.15.0 finishes the rename started with PR #29: the orchestration
package is now `work_engine` and the default state file is
`.work-state.json`. A back-compat shim keeps `implement_ticket`
imports working for one minor release; the legacy state filename is
detected on load and surfaces a one-shot migration hint instead of
failing silently.

### What changed

| Surface | 1.14.x | 1.15.0 |
|---|---|---|
| Orchestration package | `implement_ticket/` | `work_engine/` |
| Default state file | `.implement-ticket-state.json` | `.work-state.json` |
| Legacy package import | native | thin shim, removed in 1.16.0 |
| State schema | v0 (flat `ticket`) | v1 (`input.kind` envelope) |

The schema migration itself shipped in 1.14.0 (`migrate_payload`
already wraps v0 → v1). 1.15.0 only flips the *default* output
filename and the shipped package name; v0 files on disk are still
recognised on a clear error path.

### Required action

✋ **Run the one-shot migration** if your project still has a
`.implement-ticket-state.json` file:

```bash
node agent-config-templates/scripts/work_engine/migration/v0_to_v1.js .implement-ticket-state.json
```

This:

1. Writes `.work-state.json` with the v1 envelope alongside the
   legacy file.
2. Rotates the v0 file to `.implement-ticket-state.json.bak` (or
   `.bak.1`, `.bak.2`, … if a previous backup is already present —
   no silent overwrites).
3. Refuses to overwrite an existing `.work-state.json`.
4. Exits `0` on success, `2` on schema errors.

Pass `--no-backup` if you do not want the v0 file kept around, or
`--destination <path>` for a custom location.

🔄 **Detection on load.** If the engine is invoked with
`--state-file .work-state.json` (or no `--state-file` at all) and
finds only the legacy file, it stops with:

```
error: Found legacy state file .implement-ticket-state.json but no
.work-state.json. The default state file was renamed in 1.15.0. Run
`node agent-config-templates/scripts/work_engine/migration/v0_to_v1.js .implement-ticket-state.json`
to migrate, or pass `--state-file .implement-ticket-state.json` to
keep using the old name. See docs/MIGRATION.md.
```

The detection only fires when the requested state file uses the
canonical name; explicit `--state-file <other>.json` bypasses it,
so power users with their own naming scheme stay in control.

### Optional — keep using the legacy name

💡 You do **not** have to migrate immediately. Both of these keep
working through the 1.15.x cycle:

- Pass `--state-file .implement-ticket-state.json` on every CLI
  invocation. The loader reads v0 and v1 transparently; format is
  preserved on save.
- Keep importing from `implement_ticket` — the shim under
  `templates/scripts/implement_ticket/` re-exports the
  `work_engine` API verbatim. Removed in 1.16.0.

The legacy hint is a UX nudge, not a hard cutover.

### Rolling back

If something goes wrong:

```bash
mv .work-state.json /tmp/work-state-bad.json
mv .implement-ticket-state.json.bak .implement-ticket-state.json
```

Then either re-run the migration or pin to 1.14.x until the issue
is reported. The v0 backup is byte-equal with the input —
`migrate_file` only renames the source after successfully writing
the v1 destination.

### CI / repository hygiene

If your project commits state files (uncommon but supported):

- Update `.gitignore` to exclude both `.implement-ticket-state.json`
  and `.work-state.json` if you want them transient.
- Otherwise, commit the new `.work-state.json` and either delete
  the `.bak` rotation or move it under an archive path — the
  loader never reads `.bak` files.

### Reference

- Schema and field-by-field semantics:
  [`docs/contracts/implement-ticket-flow.md`](contracts/implement-ticket-flow.md#workstate-v1-schema).
- Stability level: `work_engine` is **beta** — see
  [`docs/contracts/STABILITY.md`](contracts/STABILITY.md).
- Source of truth for the migrator:
  [`templates/scripts/work_engine/migration/v0_to_v1.ts`](../src/agent-src/templates/scripts/work_engine/migration/v0_to_v1.ts).

## Older versions

No formal migration was required before 1.15.0. The pre-1.14.0 v0
state schema (flat `ticket`, `.implement-ticket-state.json`) is
documented in `docs/contracts/implement-ticket-flow.md` and is
covered by the same `v0_to_v1` migrator above.
