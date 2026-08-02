# Dead-scan-root sweep — full-population findings (2026-08-02)

Companion to [`gate-scope-census`](gate-scope-census.md), which covers the **14**
gates a manual audit confirmed dead. That report states its own limit: extending
to the full population is `road-to-gates-that-can-fail` Phase 1's remaining work.
This is the first measurement over that population, and it is **re-runnable** —
`./scripts-run src/scripts/sweep_dead_scan_roots`.

**Measured on `main` @ `c1931bcde`.** Every number below comes from
`--json`, not from prose.

## Why this exists

Two dead gates were found **outside** the censused 14 while doing thematically
unrelated work: `audit_skill_overlap` (rooted at a deleted container, 0 of 287
skills read) and `lint_media_policy_linkage` (`agents/policies/media` absent,
exit 0 with "nothing to lint"). Two incidental finds outside an audited set is a
base-rate question. A hand-written census cannot answer it repeatably; this can.

## Headline

| | |
|---|--:|
| Gate scripts in population | **213** |
| Confirmed findings (missing root **+ read evidence**) | **26** |
| — of those class A (retired containers) | **13** |
| — class B (build artifacts) | 7 |
| — class C (optional / other) | 6 |
| Unproven (missing, evidence not statically provable) | **15** |
| Stale ledger entries | 0 |
| Exit | **1** |

The `~190` figure the census used was low; the real population is 213.

## Class A — confirmed dead roots in retired containers (13)

These gates read a container that no longer exists. Unless a second live root
covers them, they are scanning nothing today.

| Gate | Missing root | Read evidence |
|---|---|---|
| `audit_user_type_axis.ts` | `.agent-src.uncondensed/skills` | `helper-read:_isDir` |
| `lint_command_routing.ts` | `packages` | `direct-read` |
| `lint_command_verbs.ts` | `packages` | `direct-read` |
| `lint_media_policy_linkage.ts` | `.agent-src.uncondensed/skills` | `array-iterated-helper:_exists:SCAN_ROOTS` |
| `lint_media_policy_linkage.ts` | `.agent-src.uncondensed/rules` | `array-iterated-helper:_exists:SCAN_ROOTS` |
| `lint_media_policy_linkage.ts` | `.agent-src.uncondensed/commands` | `array-iterated-helper:_exists:SCAN_ROOTS` |
| `lint_namespace.ts` | `.agent-src.uncondensed/skills` | `spec-iterated-helper:_isDir:TARGETS` |
| `lint_namespace.ts` | `.agent-src.uncondensed/rules` | `spec-iterated-helper:_isDir:TARGETS` |
| `lint_namespace.ts` | `.agent-src.uncondensed/commands` | `spec-iterated-helper:_isDir:TARGETS` |
| `lint_namespace.ts` | `.agent-src.uncondensed/personas` | `spec-iterated-helper:_isDir:TARGETS` |
| `lint_new_skill_gate.ts` | `packages` | `direct-read` |
| `lint_pack_boundaries.ts` | `packages` | `direct-read` |
| `lint_role_experiences.ts` | `.agent-src.uncondensed/skills` | `array-iterated-helper:_exists:SKILL_SOURCES` |

Cross-check against the census: `lint_namespace`, `lint_command_verbs` and
`lint_pack_boundaries` are already listed there as **structural** (a container
became several independent roots) rather than one-line repoints, and
`lint_new_skill_gate` is listed as repaired against `src/skills` — it still
carries a `packages` read alongside the repaired root, which is exactly the
"repair every root a gate reads, or none" note the census itself records.
`audit_user_type_axis`, `lint_command_routing`, `lint_media_policy_linkage` and
`lint_role_experiences` are **not** in the censused 14.

## Class B — build artifacts consumed as inputs (7)

`check_always_budget` (`.github/budget-trend.jsonl`),
`check_release_includes_discovery` (`dist/discovery/…summary.md`),
`lint_mcp_registry_manifest` (`dist/mcp/…` ×4).

Missing in a fresh clone is only a defect **if CI runs the gate before its
producer**, or if the producer is retired. Disposition is one Taskfile/workflow
ordering check per script — not a repoint.

## Class C — optional surfaces and one likely typo (6)

`lint_ghostwriter_source` (`agents/ghostwriter`), `lint_load_context`
(`agents/contexts`), `lint_media_policy_linkage` (`agents/policies/media`,
`.claude/skills`), `lint_showcase_sessions` (`docs/showcase/sessions`),
`lint_originality_shingles` (`src/personas`).

**`lint_originality_shingles` deserves separate attention.** It joins
`src/personas`; the tree has `src/agent-src/personas`. The path is guarded by
`existsSync`, so the anti-reskin gate **silently skips the entire persona
corpus** — the surface where a re-skin is most likely to show. This looks like a
one-segment path error, not an optional surface.

## Unproven (15) — reported, never dropped

Missing roots where static single-file analysis cannot prove a read (reads can
cross module boundaries). The confirmed set is a **floor**, not a census
closure. Three of the 15 carry a disposition and print as `known-benign`; the
remaining twelve are the manual-review queue.

Known false-negative surface: roots read from config files, bases outside the
declared base-identifier set, glob-library walks, template-literal paths.

## Criterion, in one line

A path counts as a finding only with **positive read evidence** — direct, via a
same-file helper, through a derivation chain that terminates in a read, or as a
member/property of an iterated collection whose loop variable reads. "Not
written to" and "derived from" were both tried as evidence and both produced
false positives; the script header carries the full evidence log, and every rule
in it maps to a measured failure.

## Disposition and next step

Nothing is repaired here. This report and its instrument answer *how many and
which*; the repairs surface pre-existing violations whose disposition is a
maintainer call under the open `dead-gate-finding-triage` blocker — the same
reason the census landed 3 of 14 repairs and deliberately held the rest.

The sweep is **not wired into `task ci`**: it exits 1 on the 13 class-A findings
above, and a gate that turns CI red on debt it did not create is the failure
mode this whole track exists to avoid. Wiring follows the triage, not the other
way round.
