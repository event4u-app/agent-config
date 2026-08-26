<!-- evidence-type: analysis -->
<!-- evidence-artifact-type: analysis -->

# Placement of the install-reach question, against the existing doctor family

`road-to-consumer-repo-reality` step 1.1. The step forbids asserting a
placement: *"a placement asserted without the enumeration does not count."* So
the enumeration comes first and the decision follows from it.

Risk-register rank 3 is what the step is protecting against: *"an eighth
parallel diagnostic is built next to seven existing ones … adds a second source
of truth about the install and drifts from the installer that wrote it."*

## The enumeration — what each existing verb already answers

Read from `src/cli/registry.ts` at the current commit, not from the roadmap's
list. **The roadmap's own enumeration was incomplete**, and the omission is the
one that decides the question: it names seven verbs and does not name `doctor`.

| Verb | The question it answers |
|---|---|
| `hooks:doctor` | do the registered hook concerns resolve to something executable, and is the posture right |
| `routing:doctor` | is each routing gate ACTIVE or INACTIVE right now, with the reason and the chain |
| `reach:doctor` | which reach-channel backend is active, and what is the pinned fix per channel |
| `workspace:doctor` | which repo root, worktree, branch and PR base am I in, with provenance |
| `settings:check` | does `.agent-settings.yml` satisfy the YAML-subset contract |
| `mcp:check` | are the rendered MCP client configs stale against `mcp.json` |
| `packs:active` | which packs are active here, from which file |
| **`doctor`** | **manifest ↔ filesystem drift, plus a battery of ~30 structured health checks** |

`doctor` is the one the roadmap missed, and it is the host. It already owns the
axis: its `missing` drift category is *"manifest entry has a `path` that is not
on disk"*, and it publishes a registry of check ids with `--check <id>` to run
one, each emitting `{id, status, message, remedy}`.

## The residual question none of them covers

**Does a path a root INSTRUCTION FILE names resolve at all?**

That is a different claim from `doctor`'s `missing` category, and the difference
is the whole reason a new check is needed. `missing` compares what the
**installer recorded writing** against disk — it knows its own manifest. A root
instruction file (`AGENTS.md`, the Copilot instructions file, a per-tool root
file) is prose describing an agent layer to the model that reads it. It may
describe a layer no installer ever wrote, or one written by a version several
majors ago. Nothing in the tree reads it.

Same axis, one level up: the manifest's promise versus disk, and now the
instruction file's promise versus disk.

## The decision

**Extend `doctor`. No new top-level verb.** Three new check ids join the
existing battery:

| id | step | question |
|---|---|---|
| `instruction-path-reach` | 1.2 | does every path a root instruction file names resolve |
| `version-axis` | 1.3 | pinned vs installed vs resolvable-now, printed together |
| `override-set` | 5.2 | which shipped artifacts this tree overrides, and in how many layers |

Four reasons, in the order they actually weighed:

1. **A host exists, so rank 3's condition is not met.** The step's own escape —
   *"a new top-level verb is the outcome only if the enumeration shows no host
   for the question"* — does not fire.
2. **`routing:doctor` set the precedent** of composing existing single-purpose
   surfaces rather than re-implementing them; this is the same move inside one
   verb's battery.
3. **`--check <id>` already gives the granularity a separate verb would have
   bought.** `agent-config doctor --check instruction-path-reach` runs exactly
   the new check and nothing else, which is what a dedicated verb would have
   offered and no more.
4. **A new verb costs the registry budget** (`check_cli_registry_budget_sync`);
   a check id costs nothing there.

## How it was built, and the line it had to pay

`src/scripts/_lib/install_reach_checks.ts`, spread into `CHECK_IDS` and the
runner maps — the exact pattern `runtime_wiring_checks.ts` established, whose
own docblock records why: `cmd_doctor.ts` is ~3,700 lines and
`check_source_size_budget` counts every line above 1,500, so a check written
inline is charged against a budget while the same code in a module is free.

The wiring itself still charged **five lines**. They were paid by extraction,
never by a baseline bump: `_check_python_runtime` and `_check_humanizer_runtime`
moved whole into `_lib/doctor_runtime_checks.ts` — cohesive with each other and
with nothing else in that file, since each answers "is a runtime present and
what happens when it is not", and neither reads the manifest, the drift sets or
the project root. Thin wrappers keep the historical names and arity, so the
runner map, the export block and the existing fallback test are untouched. Net
**18,489 → 18,461**.

One detail worth recording because it constrained the shape: `shutilWhich` is
defined and exported *in* `cmd_doctor.ts`, so importing it into the new module
would have made the two circular. It is passed in as a parameter instead —
cheaper than moving a shared utility four other call sites already resolve from
there.

## What running it on this repository found

The check was run against this repository's own root instruction files, which is
the sharpest available test of whether it is safe to ship.

**First revision: 38 dangling paths, and the majority were not paths at all.**
`skills` and `rules` as bare words in prose mean "the skills layer", not
`./skills`; `event4u/agent-config` is a package name that contains a slash. Both
would have been reported as a broken install — precisely risk-register rank 4,
*"a checker that … can misparse a path and report a healthy install as broken,
which is worse than not checking."*

The fix is the anchoring rule now documented in the module: a path claim must
start with `./`, `../`, `/` or `.`; or end with `/`; or carry a file extension;
or have a **first segment that is a directory existing in the tree**. The last
clause separates `src/skills` from `event4u/agent-config`, and it deliberately
does not require the whole path to exist — a wholly absent layer under an
existing parent stays anchored and is still reported dangling, which is the
defect the check is for. A token with no separator at all is not a path claim in
any form: `link_crypto.ts`, `size-enforcement.md` and `pathlib.Path` all reached
the classifier during development and all three would have been reported
dangling.

**Final measurement: 161 path claims — 96 present, 18 dangling, 47
unresolvable.** All 18 dangling are real:

- **10** from the `scripts/` → `src/scripts/` move: `scripts/install.sh` (named
  in three separate root files), `scripts/skill_linter.ts`,
  `scripts/check_condensation.ts`, `scripts/check_no_roadmap_refs.ts`,
  `scripts/check_council_references.ts`, `scripts/lint_framework_leakage.ts`,
  `scripts/check_token_optimizer_freshness.ts`, and two under
  `scripts/ai_council/`.
- **2** retired by the py2ts migration: `src/scripts/condense.py`,
  `src/scripts/check_portability.py`.
- **6** others including `.agent-src.uncondensed/rules/` and
  `data/low-impact-decisions-seed.md`.

This package's own root instruction files carry the exact defect the check was
written for. That is the strongest evidence available that it is worth shipping,
and it is stated here rather than quietly fixed, because the fix belongs to
whoever owns those files.

## What this decision does NOT settle

The **agent-side** half. A command answers when somebody runs it; an agent
mid-session routing on a dangling path never invoked it. That placement is step
1.5's own recorded decision and went to the council separately.
