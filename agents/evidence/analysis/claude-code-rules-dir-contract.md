# Claude Code `.claude/rules/` loading contract — probed fixture

> **Produced by:** P0.1 of `road-to-rule-delivery-integrity`.
> **Probed:** 2026-08-08 · **Host version:** Claude Code `2.1.226`
> (`claude --version`) · **Method:** first-party observation of a live session
> in this checkout, plus the host's own documentation at
> `https://code.claude.com/docs/en/memory` § *Organize rules with
> `.claude/rules/`*.
> **Gate outcome (P0.2): A — a scoping key exists.**

## The two questions P0.1 had to answer

### (a) Are rules without a scoping key loaded unconditionally at session start?

**Yes.** Documented verbatim, twice on the same page:

> Rules without `paths` frontmatter are loaded at launch with the same priority
> as `.claude/CLAUDE.md`.

> Rules without a `paths` field are loaded unconditionally and apply to all
> files.

**Independently observed, first-party.** A session running in this checkout on
2026-08-08 carried substantially all of both rule layers in its standing
context simultaneously — including `downstream-changes`,
`verify-before-complete`, `scope-control` and `commit-policy` in **two copies
each**, one attributed to `/Users/<user>/.claude/rules/<name>.md` and one to
`dist/agent-src/rules/<name>.md`. No probe was needed for this half; the
duplication is directly visible from inside the session it affects.

Measured at probe time:

| Layer | Entries | Scoping key present | Bytes |
|---|---|---|---|
| `~/.claude/rules/` | 112 real files | **0** | 409,606 |
| `<project>/.claude/rules/` | 92 symlinks into `dist/agent-src/rules/` | **0** | 305,161 |
| overlap by basename | **91** | — | — |

`grep -l '^paths:\|^globs:\|^appliesTo:'` returns 0 across both layers. The
frontmatter keys actually present in the global layer are `type`, `tier`,
`description`, `alwaysApply`, `triggers`, `workspaces`, `packs`, `routes_to`,
`source_path`, `package`, `obligation_frequency`, `collision_ok` — agent-config's
own vocabulary. **None of them is a key this host reads.**

### (b) Does a frontmatter key that scopes loading exist?

**Yes — `paths`.** Documented syntax is a YAML list of globs:

    ---
    paths:
      - "src/api/**/*.ts"
    ---

Semantics, verbatim: *"Path-scoped rules trigger when Claude reads files
matching the pattern, not on every tool use."*

Constraints worth encoding in the emitter:

- Brace expansion is supported (`src/**/*.{ts,tsx}`); a rule's whole `paths`
  list shares a budget of **1,000 expanded patterns and 4 MiB**. A pattern that
  would exceed the budget is used **unexpanded**, and its literal braces then
  match no files — a silent no-op, so the emitter must stay under the budget.
- `[` starts a bracket expression. An unparseable `[` makes that one pattern
  match nothing (the rule's other patterns keep working). A literal `[` needs
  escaping as `\[`.
- Symlinked project paths are matched as of v2.1.198.
- Path-scoped rules are **not re-injected after `/compact`** — they reload the
  next time a matching file is read. An obligation that must survive compaction
  cannot be path-scoped.

Relevant version floors, all satisfied by 2.1.226: v2.1.207 (an invalid pattern
no longer breaks Read for every evaluated file), v2.1.211 (on-demand rules are
skipped when `project` is excluded from `--setting-sources`), v2.1.217 (many
brace groups no longer stall the CLI at startup).

## Two mechanisms the roadmap did not know about

Both were found while probing (b) and both are shipped host features, not
proposals.

### `claudeMdExcludes` — a direct remedy for the duplicate layer

A settings key, honoured at any layer (user / project / local / managed), that
skips instruction files by absolute-path glob — and the host's own example
excludes a **rules directory**:

    {
      "claudeMdExcludes": [
        "**/monorepo/CLAUDE.md",
        "/home/user/monorepo/other-team/.claude/rules/**"
      ]
    }

Arrays merge across layers. Managed-policy CLAUDE.md cannot be excluded;
everything else can. **Consequence for P1.1:** the installer does not have to
stop at detect-and-refuse — it can offer to write a `claudeMdExcludes` entry
for the layer the user does not choose, which suppresses the duplicate load
*without deleting a single file*. That satisfies P1.1's no-delete guarantee and
actually fixes the byte cost, which detection alone does not.

### `InstructionsLoaded` hook — the measurement P1.2 needs

Documented as: *"Use the `InstructionsLoaded` hook to log exactly which
instruction files are loaded, when they load, and why."* That is a real
per-session record of the **effective** instruction set, which is exactly what
`check_standing_rule_delivery` (P1.2) otherwise has to infer from the
filesystem. It measures what arrived, not what was projected.

It is **not** P2.1's mechanism — P2.1 needs the injected *skill* catalogue, and
this hook covers instruction files. The two stay separate.

## Deviation recorded — the step named the wrong artifact

P0.1's text asks for "a row in the cross-model capability matrix". On
inspection that artifact is the wrong home and no row was added:

- `agents/evidence/cross-model-capability-matrix.md` scopes itself to **model**
  capabilities and explicitly reasons about capability-vs-behaviour gaps for the
  parity smoke. A host instruction-loading semantic is not a model capability.
- `src/scripts/_lib/host_capability.ts:17-23` is a schema-versioned manifest
  whose documented contract (`contexts/execution/host-capability-manifest.md`)
  is **subagent orchestration primitives** and whose safe default is all-`false`.
  Adding `rules_dir_scoping` would widen a versioned contract with live
  consumers for an unrelated concern — a `minimal-safe-diff` violation.

This fixture is therefore the artifact of record. Anything that needs the fact
cites this file.

## What this fixture does not establish

- Whether the two layers are byte-identical or a **version skew** (Risk #2).
  Basenames were compared; contents were not. P0.3 owns that.
- Whether `paths`-scoped rules reliably fire for this suite's trigger shapes.
  The documented semantics are read-triggered; P3.1's fixtures must exercise
  them rather than assume them.
