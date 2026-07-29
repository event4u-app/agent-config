# Gate scope census — what each audited gate actually reads

Measured 2026-07-29 on `main` @ 9.9.0. Companion to
[`gates-that-cannot-fail`](../../settings/contexts/gates-that-cannot-fail.md).

**Why this file exists.** ADR-051 moved the source container and a later commit
deleted `packages/`. Fourteen gates kept a hardcoded literal path and, because
every one treats a missing directory as "nothing to check", exited 0 with a
green checkmark while scanning zero files. Nothing in the repo recorded what a
gate is supposed to read, so the drift was invisible in every diff. This census
is that record: a future root-move now shows up here as a changed count.

## Scope of this pass

`190` `lint_*`/`check_*` scripts exist; ~170 are wired into CI or Taskfiles.
This census covers the **14 gates confirmed dead** by the audit, not all 190.
Extending it to the full population is Phase 1's remaining work — stated here so
the coverage claim is not read as broader than it is.

## Status legend

- **repaired** — root repointed, verified scanning real units, landed.
- **triage** — repair measured, but it surfaces pre-existing violations whose
  disposition (fix / grandfather / reclassify the rule) is a maintainer call per
  the `dead-gate-finding-triage` blocker. **Root left unrepaired on purpose** —
  landing it would turn CI red on debt this change did not create.
- **structural** — the root did not just move, the layout changed shape
  (one container with subdirs → several independent roots, or `packages/`
  removed entirely). Needs real restructuring, not a path swap.

## Census

| Gate | Declared root (dead) | Real root | Units on a clean tree | Status |
|---|---|---|---:|---|
| `check_safety_floor_untouched` | `.agent-src.uncondensed/rules` | `src/rules` | 4 guarded files | **repaired** |
| `check_iron_law_prominence` | `.agent-src.uncondensed/rules` | `src/rules` | 111 rule files, 0 violations | **repaired** |
| `lint_new_skill_gate` | `packages/*/…/skills` → `.agent-src.uncondensed/skills` | `src/skills` | 286 skills; 10 new vs 9.8.0, all cleared | **repaired** |
| `lint_handoffs` | `.agent-src.uncondensed/skills` | `src/skills` | **19 violations** | triage |
| `check_augment_description_cap` | `.agent-src.uncondensed/rules` | `src/rules` | **16 violations** | triage |
| `check_context_paths` | `.agent-src.uncondensed/contexts` + 4 reference roots | `src/agent-src/contexts`, `src/rules`, `src/skills`, `src/domains` | **1 violation** | triage |
| `lint_namespace` | `.agent-src.uncondensed` (4 subdirs) | `src/skills`, `src/rules`, `src/domains`, `src/agent-src/personas` | not measured | structural |
| `lint_artefact_frontmatter` | `.agent-src.uncondensed` | several independent roots | not measured | structural |
| `check_condensation` | `.agent-src.uncondensed` → `dist/agent-src` | per-kind source roots under `src/` | not measured | structural |
| `lint_load_context` | `.agent-src.uncondensed/{rules,contexts}` | `src/rules`, `src/agent-src/contexts` | 24 real declarers unseen | structural |
| `lint_command_verbs` | path regex `.agent-src.uncondensed/commands/` | `src/domains/**/command.md` | 191 commands unseen | structural |
| `check_no_roadmap_refs` | 6 of 9 `STABLE_TREES` dead | `src/**` equivalents | partial coverage today | structural |
| `lint_pack_boundaries` | `packages/` | `src/packs`, `src/domains` | `packages/` deleted | structural |
| `lint_pack_dependencies` | `packages/` | `src/packs`, `src/domains` | `packages/` deleted | structural |

## Triage detail (input for the blocker)

Numbers are what the repair surfaces; none of it is new breakage.

- **`lint_handoffs` — 19.** Mostly `handoff_tier_mismatch` (a senior-tier skill
  links to a skill with `tier='unset'`), e.g. `build-buy-partner` → `adr-create`,
  `customer-research` → `po-discovery`. **One is a genuine broken link:**
  `competitive-positioning/SKILL.md:117` → `analyze-reference-repo` resolves to a
  missing `../analyze-reference-repo/SKILL.md`. Likely disposition: fix the
  dangling link, then decide whether `tier: unset` on a linked-to skill is a real
  violation or the rule needs a `tier`-backfill first.
- **`check_augment_description_cap` — 16.** Auto-rule descriptions over the
  150-char cap, e.g. `prefer-enums-over-literals.md` at 189,
  `active-remediation.md` at 184, `question-not-instruction.md` at 184. These
  descriptions are projected into the Augment workspace-guidelines budget, so the
  cap is a real budget surface, not cosmetic. Disposition is per-rule copy work.
- **`check_context_paths` — 1.** `src/agent-src/contexts/execution/host-capability-manifest.md`
  is referenced by nothing. Note this number is 1 **only after repairing the
  reference-scan roots too**: repairing the contexts root alone reports 17
  orphans, 16 of them false — the gate could not see the files that do the
  referencing. A half-repair lies in both directions.

## Reproducing

Every "repaired" row is re-checkable by running the gate with no arguments and
reading its own scanned-unit count. The dead-scope assertion added in
`_lib/scan_scope.ts` now makes a zero count a non-zero exit, so a regression
announces itself instead of printing a checkmark.
