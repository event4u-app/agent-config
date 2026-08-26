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
| Free-text `compatibility` skill-frontmatter field (`src/scripts/schemas/skill.schema.json`) | 2026-08-14 | shipped 2026-08-14 — `deprecated: true` + superseded-by note in the schema; `harness_compat` lands beside it, additively | next major after the notice — **not pinned here** (removal date is maintainer-owned, same stance as the manifest `tier` entry, whose `sunset` shipped `null`) | The public Agent-Skills spec makes `compatibility` load-bearing for cross-host portability, or an external consumer is found reading it. `harness_compat` is package-local; `compatibility` mirrors the public spec, so keeping the mirror stays cheaply reversible. Superseded by `harness_compat` (class) + `runtime_requires` (probeable detail); both users (`docx-authoring`, `pdf-tools`) already carry both fields, so nothing breaks on removal day. |
| `code_graph` native code-graph engine (`code_graph.enabled`, the `code-intelligence` skill's native arm, `code_graph_nudge_hook`) | 2026-07-28 | next major after 9.x | **REVISED 2026-08-15 — no removal date; see below** | A consumer case the graph answers and disciplined grep cannot. Measured null: recall 0.365 vs grep 0.797 (`docs/CLAIMS.md` `code-graph-retrieval-null`), measured 2026-07-28 against a build predating the 2026-08-22 extractor repair. `enabled: false` stays the DEFAULT — "permanent" is retracted here on 2026-08-26, because this row's own revision below withdraws the removal commitment and a withdrawn schedule cannot leave a permanence behind it. **Revision (ADR-232 track, maintainer decision 2026-08-15).** The original row committed removal to 11.0; the tree reached 12.0.0 with the runtime paths still registered, i.e. the commitment was missed. Rather than quietly re-dating it, the commitment is withdrawn with its reason recorded, because the measurement changed what removal is worth: **the payload this deprecation existed for has already shipped** — the parser pair (`web-tree-sitter@0.24.7` / `tree-sitter-wasms@0.1.13`, ~51 MB unpacked) moved from `dependencies` to `devDependencies` ahead of schedule, so no consumer installs it. What source removal would still free is ~112 K against a 27 M tree (0.4 %). Against that it costs a breaking change across four consumer-visible surfaces (CLI verb, `code-intelligence` skill, `external-code-graph-interop` rule, `hooks.code_graph.enabled`) plus one surface that is re-plumbing rather than deletion: `_lib/auto_dispatch.ts` routes the `definition` / `references` lookup classes to `primitive: 'code-graph-query'`, and `_lib/judgment_ladder.ts` calls that live at Rung 0. There is also no cheap middle — `code_graph/detect.ts` handles the `consumer` / `scip` / `native` source kinds in one type union, so stripping only the native engine while keeping consumer-index interop is a redesign. **New commitment:** the surfaces stay registered and disabled; removal happens when a concrete reason appears (a maintenance cost that bites, a conflicting redesign, or a consumer asking), not on a date. This row stays in the table so the decision is visible rather than forgotten — a withdrawn commitment recorded is not the folklore this table exists to prevent; an unrecorded one would be. |
| `telegraph-speak` condenser (`telegraph.speak`, `src/rules/telegraph-speak.md`, `src/scripts/_lib/compile_time_toggles.ts`, `src/scripts/validate_telegraph_carveouts.ts`) | 2026-07-29 | shipped 2026-07-29 — dormant by default, `speak` defaults `false` | **not pinned here** — removal is authorized in principle and deliberately not executed (ADR `telegraph/0002` § Decision part 3), pending a `prose_only` bench (~$0.80). The date is maintainer-owned, same stance as the `compatibility` row above | An output-side bench clears the kill-criterion bar, at which point `telegraph.speak: true` restores the feature intact. Measured basis for dormancy: median vs_terse **−9.27 %** (API) / −5.47 % (exact `cl100k_base`) — the condenser emits MORE than a plain "be terse". Tracked as a row rather than left dormant-and-unlisted: dormancy without a row is untracked in *both* directions, neither scheduled nor recorded as a keep. Deliberately NOT a due version (that would invent a commitment ADR 0002 declined to make) and NOT a permanent keep (that would contradict its authorized removal). |

### Row status — what is currently late, and who owns it

Kept as prose under the table rather than inside a cell: every column above
carries what its header names, so the table stays a contract a reader (and the
parser) can rely on. `src/scripts/lint_scheduled_deprecations` derives lateness
itself from `Removal due` and `package.json`; this section records ownership and
reason, which no arithmetic can.

- **`code_graph` — commitment WITHDRAWN 2026-08-15, not late.** It was one major
  overdue (removal resolved to **11.0**; the tree reached **12.0.0**), and the
  maintainer answered by withdrawing the commitment with its reason recorded
  rather than re-dating it — see the row above. Nothing is overdue, so nothing
  refuses a cut. The reason the slip went unnoticed for a major is unchanged and
  is what the gate above now closes: the release runbook's manual pre-flight
  checkbox was in place the whole time and nothing compared the arithmetic.
- **`telegraph-speak` — tracked, not late.** Removal authorized in principle and
  deliberately not executed; the date is maintainer-owned.

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
