<!-- evidence-type: analysis -->
# Blast radius of an added stack-detector axis, and the migration path

**Why this file exists.** The `the-detector-is-a-consumer-template` blocker of the
declared-component-contract roadmap resolves when *"the blast radius is stated in
the evidence tree and the migration path is named, or the axis change is
refused."* The radius had been measured but stated only inside the roadmap
blocker, which is not the evidence tree. This file is that statement, re-verified
from the source rather than copied from the prose, and it names the migration
path.

**Not a decision.** Whether the detector may grow a workshop axis and a
verification axis — option (a) assess and proceed, option (b) refuse and drop the
phase — stays with the owner. What follows removes "nobody has looked" as a
reason, and adds one finding that argues against (a) which did not exist when the
blocker was written.

**Re-verified 2026-09-19** against the tree at `origin/main` (`107a21051`). Twelve
claims were checked one at a time against the files themselves. Nine confirmed
verbatim; **three corrections** are recorded in § 4 and § 5 rather than carried
forward silently.

## 1. The premise the blocker states is wrong, in two independent ways

The blocker says an axis change "ships into every consumer project". It does not.

**The live engine is never read from the consumer's tree.** `cmd_work`
(`src/scripts/_dispatch.bash:877`) and `cmd_implement_ticket` (`:863`) both set

```
local engine_root="$PACKAGE_ROOT/dist/agent-src/templates/scripts"
```

and `PACKAGE_ROOT` (`:31`) is derived from the script's own install location.
`CONSUMER_ROOT` (`:32`) is defined and referenced by neither function. The
consumer-override resolver `resolve_template_script` (`:668-686`) does exist, and
every one of its eight call sites is a flat script — `memory_lookup`,
`memory_signal`, `memory_hash`, `telemetry_record`, `telemetry_status`,
`telemetry_report`, `check_memory`, `check_memory_proposal` (`:888` through
`:973`). **No work_engine file is resolved through it.** An axis change therefore
reaches a consumer through an npm upgrade, not through a file already on their
disk.

**The installer's only copy of the template tree is augment-global.**
`GLOBAL_DEPLOY_SOURCES` in `src/scripts/install.ts:1923-1955` carries
`['dist/agent-src/templates', 'templates']` on the `augment` row and on no other;
`USER_SCOPE_PATHS['augment']` is `~/.augment/`, so that copy lands at
`~/.augment/templates/`. Consumer installs are global-only, enforced by
`_enforce_consumer_global_only` (`install.ts:2033-2040`, called at `:4905`). By
the paragraph above, that copy is inert with respect to `/work`.

## 2. What an already-installed consumer sees, and the migration path

**A silent overwrite, and it always did.** `_resolve_file_conflict`
(`install.ts:556-559`) is a three-line body that returns `'write'`
unconditionally, with the comment *"deploys always overwrite our own content"*.
Both parameters are underscore-prefixed and unused, so neither `--force` nor a
local edit changes the outcome, and the `skip` branch at both call sites
(`:2928`, `:2998`) is unreachable.

**Do not cite the ownership machinery as a safety net.** `src/install/conflict.ts`
and `src/install/recordedOwnership.ts` are not wired to the writer, and
`conflict.ts:66-71` says so in its own header:

> What this resolver decides is in any case NOT what the installer does. The
> single writer is `src/scripts/install.ts`, whose `_resolve_file_conflict`
> returns `write` unconditionally for deployed files and which reads nothing
> from this module; `skip` here means "the planner would not touch it", never
> "your edit is safe".

`resolveFileConflict` has no caller in `src/` at all — only its own definition and
a test.

**The migration path, named: none is required.** A project already carrying the
template needs no migration step, because the copy it carries is (i) overwritten
without prompting on the next deploy, as it has always been, and (ii) never
executed by `/work` or `/implement-ticket`, which read the package tree. There is
no consumer-side state to convert, no version straddle to support, and no
rollback owed — the repository cannot roll back a consumer's file and does not
need to.

## 3. Where an added axis does cost something: inside this repository

The radius is real but local. Ordered loudest first.

| Surface | What happens | Verified at |
|---|---|---|
| `_EMPTY_AXES` | **compile error** — it is explicitly typed `StackAxes`, whose five fields are all non-optional, so a new required key breaks the build | `work_engine/stack/detect.ts:151-164`, `:169-175` |
| `_OVERLAY_AXES` / `_AXIS_OVERLAYS` | silently ignores an axis it does not list; `compose_bundle` loops `_OVERLAY_AXES` only | `work_engine/directives/ui/stack_bundles.ts:347-363`, `:386-393` |
| `_AXIS_COMBOS` | a hand-written 12-row matrix that enumerates axis values | `src/scripts/lint_ui_stack_bundles.ts:60-72` |
| `ui_lane_matrix.test.ts` | hand-enumerated `StackAxes`-shaped fixtures throughout an 874-line file | `tests/scripts/work_engine/ui_lane_matrix.test.ts` |
| two shipped skills | both cite the axis table **by line number**, and no gate validates a line-number citation | `src/skills/existing-ui-audit/SKILL.md:129-131`, `src/skills/react-shadcn-ui/SKILL.md:96-98` |

`css` is already an axis absent from `_OVERLAY_AXES`, so the silently-ignored
state is an accepted shape in this codebase rather than a new failure a new axis
would introduce.

## 4. Two corrections to the earlier measurement

**`_AMBIGUOUS_AXES` is `['reactivity']`, not `['view', 'reactivity']`.** The
earlier text conflated two distinct hand-written lists in the same file.
`detect.ts:537` reads `const _AMBIGUOUS_AXES: ReadonlyArray<keyof StackAxes> =
['reactivity'];` and feeds `_detect_ambiguity()` (`:596-611`), which flags two
mutually exclusive SPA signals on one axis. The `['view', 'reactivity']` array is
real but separate, unnamed and inline at `detect.ts:589`, inside `_detect_axes()`,
back-filling `'unknown'` on manifest-bearing projects. Both hand-enumerate a
subset of axes and neither mentions `css`, `component_lib` or `meta`, so the
*finding* stands — the attribution did not.

**The line-number citation under-scopes its second row.** Lines 521-524 of
`detect.ts` today are the complete `tailwind-v4` row plus only the opening three
lines of the `tailwind-v3` row, whose `files:` payload runs to line 531. The
citation is close enough to read correctly today and is still unvalidated by any
gate, so the fragility the earlier measurement named is if anything understated.

## 5. The material finding: the detector has no production caller

This is the argument for (b) that did not exist when the blocker was written, and
it is now confirmed from three independent angles.

**Read side.** A grep inside the shipped template tree for any executable import
of the module returns nothing:

```
grep -rn "from ['\"].*detect" work_engine/   -> no output
grep -rn "require(.*detect"    work_engine/  -> no output
grep -rn "import(.*detect"     work_engine/  -> no output
```

The only `stack/detect` and `./detect` hits inside `work_engine/` are a
`Mirrors ...` comment and three JSDoc `{@link}` tags in `stack/runner.ts`. The
committed code graph agrees: the callers of `detect_stack` are the definition
itself, its own recursion at `detect.ts:809`, and six call sites across two test
files. **Zero production callers.**

**Write side, which is new.** Nothing anywhere in `work_engine/` assigns a
detector result into `state.stack` — it is only ever initialised or passed
through as `?? null`. So `state.ts:501-505`, which states that *"the detector
populates `state.stack` lazily — the first dispatch of a new state file may run
without it set, then the dispatcher fills it in before any UI handler reads
it"*, describes behaviour that is not implemented in the current tree.

**Validation side.** `_validate_stack` (`state.ts:507-524`) checks only that
`frontend` is a non-empty string and that `mtime` is a number. It never
enumerates an axis, so no axis is validated at the state boundary either.

**What follows for the decision.** If no production path calls `detect_stack`,
Phase 4's radius is test-and-prose rather than engine behaviour, and the phase
buys less than its cost. That is an input to (a)-versus-(b), not a verdict on it.

**One enumeration correction.** A full-tree grep for `detect_stack` outside
`dist/` and `tests/` returns eight locations, not the five the earlier text
listed: it missed `src/agent-src/contexts/execution/toolchain-resolver.md:35`.
The unrelated `detect_stacks` (plural) in `src/scripts/lint_persistence.ts` is
correctly not part of the set.

## 6. Already corrected, and confirmed still correct

`docs/architecture.md` once claimed the engine is *"shipped to consumer projects
via `scripts/install.py`"* — a file that exists nowhere in the tree, next to a
claim wrong on both halves per § 1. Re-checked 2026-09-19: the correction is
present, the file now states that the engine is executed from the installed
package and names `engine_root` and the augment-global copy, and no `install.py`
reference remains anywhere.

## 7. What this file does not settle

Option (a) assess-and-proceed versus option (b) refuse-and-drop-Phase-4 is the
owner's, and § 5 is a reason to weigh (b) more seriously than the blocker's
recommendation did. Phase 4 also remains gated independently by
`taxonomy-reversal-is-a-second-arrival`, so nothing here releases 4.1 or 4.3.
