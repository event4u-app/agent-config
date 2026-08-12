# Rootless-write inventory — commands that resolve a project root and then act on it

Companion finding to `agents/roadmaps/road-to-rootless-write-refusal.md` Phase 3.
Read-only: no command below is changed by this document.

## The construct

`resolve_project_root(arg, opts)` returns `[root, origin]`. When the walk
reaches the filesystem root without finding an anchor
(`.agent-settings.yml`, an `agents/` dir carrying a marker, or `.git`), it
returns the starting directory itself with `origin === ORIGIN_CWD_FALLBACK`
(`src/scripts/_lib/agent_settings.ts:770-775`). A caller that discards the
origin cannot distinguish "this is the repo" from "I found nothing, here is
your cwd back".

## The population

Six commands resolve a root and then write or delete under it. Measured by
`grep -rln "resolve_project_root" src/scripts/_cli/` (15 hits) intersected
with `grep -ln "writeFileSync\|rmSync\|unlinkSync\|atomic_write_json"` (5 hits
plus `session:recycle` itself).

| Command | Root source | Explicit override | What it writes / deletes | Origin read? |
|---|---|---|---|---|
| `session:recycle` | cwd | `--project` (added by Phase 1) | `agents/runtime/state/recycle-envelope.json` | **yes — refuses on fallback** |
| `doctor` | `--project` → cwd | `--project` | deletes the wizard-state file (`cmd_doctor.ts:3488`) | **reports it, never gates on it** |
| `uninstall` | `--project` → cwd | `--project` | `rmSync`/`unlinkSync` over installed tool trees, labels, lockfile (`cmd_uninstall.ts:252-821`) | no |
| `prune` | `--project` → cwd | `--project` | `unlinkSync` over manifest-declared paths (`cmd_prune.ts:388`) | no |
| `migrate` | `options.cwd` → cwd | none | writes migrated files, unlinks legacy links/sources (`cmd_migrate.ts:272,475,501,581`) | no |
| `update` | `options.cwd` → cwd | none | writes the version-state file and rewrites wrapper/config lines (`cmd_update.ts:231,304-324`) | no |

## What a wrong root costs, per command

- **`uninstall`, `prune`** — highest. Both delete, and both read a manifest
  first: from an unanchored cwd there is no manifest, so the realistic
  outcome is a clean "nothing installed here" exit, not a wrong deletion.
  The damage case is narrower and worse — an unanchored cwd that happens to
  *contain* a stale manifest (a copied tree, an extracted archive) is treated
  as the project. Not reproduced; stated as the shape to test before changing
  either command.
- **`migrate`, `update`** — write into a directory nobody reads, then report
  success. Same class as the `session:recycle` defect, lower cost: the
  operator notices on the next run because the migration did not take.
  Neither carries an explicit override flag, so from an unanchored cwd there
  is currently no way to name the target at all except the
  `AGENT_CONFIG_PROJECT_ROOT` environment variable.
- **`doctor`** — diagnostic. A wrong root produces a wrong report, which is
  cheap to notice and free to re-run.

## Two findings the table does not carry

1. **`doctor` re-derives the origin from string literals.** It builds its own
   origin value with `origin = 'cwd-fallback'` (`cmd_doctor.ts:3376`) instead
   of importing `ORIGIN_CWD_FALLBACK`. The two are equal today by coincidence
   of spelling; renaming the constant would leave `doctor` reporting a value
   nothing else produces, and no test compares them.
2. **`doctor` already surfaces what every other caller drops.** It emits
   `project_root_origin` in its JSON payload (`cmd_doctor.ts:3159-3161`). So
   the information is not merely available — it is already presented to
   operators in one place, which makes its absence in the five writers a
   consistency gap rather than a missing capability.

## Shared-helper verdict: not yet

A `require_anchored_root()` helper would generalize Phase 1's refusal to all
six call sites in a few lines, and the symmetry argument is real. It is still
the wrong next step, for three reasons:

- **The correct behaviour differs per command.** `session:recycle` must refuse,
  because the action it recommends next (`/clear`) destroys the session. For
  `doctor` a refusal is worse than a wrong report — a diagnostic that declines
  to run in the exact situation the operator is trying to diagnose is a bad
  trade. `migrate` and `update` probably want a warning plus an override flag
  they do not currently have. One helper with three behaviours is a flag
  argument, which is the shape that reads as symmetry and behaves as a switch.
- **Two of the six have no override.** Adding a refusal to `migrate` and
  `update` without first adding `--project` converts a silent wrong-target
  write into a hard block with no documented way out — a strictly worse
  failure for a consumer that has to invoke from outside the tree.
- **The failure shape is unmeasured for five of the six.** Phase 1's refusal
  is backed by a reproduction. The rows above are read from the source; none
  of the five was run from an unanchored cwd. Generalizing a fix across five
  unmeasured call sites is exactly the move this suite refuses elsewhere.

**Revisit-if:** a second command is reported failing this way, or `migrate` /
`update` gain a `--project` flag for an unrelated reason. Either makes the
helper cheap and the behaviour question already answered.
