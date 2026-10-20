# Findings: drain-release-says-needs-you-20261020
<!-- completion-review: v1 | reviewed: 2026-10-20 | scope: a2ebde2321baa39d69d5c5af9ceb202d89bf7516f52eed7d94f419738ee473f4 | diff: e08691641c2900bb78ccf37a6ec684188f632fe7 | reviewer: r2-fresh-subagent-drain-release-says-needs-you-20261020 | prompt_hash: 6d672708a232f8c489d235aaab6ebcd40c9b7bda19d39a8741c62e22439d70c8 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-release-says-needs-you-20261020"]}} -->
<!-- evidence-type: v1 | type: original-review | declared: 2026-10-20 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e08691641c2900bb78ccf37a6ec684188f632fe7
  scope_hash: a2ebde2321baa39d69d5c5af9ceb202d89bf7516f52eed7d94f419738ee473f4
  roadmap: agents/roadmaps/road-to-a-release-that-says-whether-it-needs-you.md
  roadmap_hash: 9df0508e0827dc95a0b7fc08ab85a9b0727435ca4935c8c6c0d88233278dbe9d
  ac_hash: c953911047b1e6386c50d1ab605ea4be42442f1c56d89debb2cdccff25789a3e
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-20T20:07:41Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/scripts/_lib/major_surface.ts:59 | `SETTINGS_KEY_FILES` cannot match the canonical settings template, so the committed result does not follow from the committed method. The template was renamed `config/agent-settings.template.yml` -> `src/config/agent-settings.template.yml` in the 6.0.0 span (name-status shows `R093`); the first regex is root-anchored at `^config/` and no other entry reaches the new path. Applying the artefact's own derivation (artefact:112) to that file yields removed `key:` lines in two in-sample spans with no re-adding `+` line: the whole `turn_end_gate` block (5 lines) in `9.36.0..10.0.0`, and `worktrees: mode: ask` in `10.4.0..11.0.0`. Under the stated method `settings-keys` fires on both and `impact_bump` promotes both to **major**. So artefact:148 and artefact:149 record `none`/`minor` where the method gives `settings-keys`/`major`; F2 (artefact:170) "changed no verdict, in 14 of 14 cases" and "it has never been the deciding clause" are false — the clause decides twice, 12 of 14; F1 (artefact:164) "in-sample it keeps 2 of 7" becomes 4 of 7; roadmap:271 and roadmap:277 repeat both wrong figures as the blocker's discharge record. NOT affected and verified separately: the hard requirement (zero false negatives on `action`) still holds, and 2.2's headline survives — 13.0.0, 14.0.0 and 16.0.0 have zero removed keys in the uncovered files. | fixed | 835c84fd1 — every row of `SETTINGS_KEY_FILES` now tolerates a leading directory, so the template matches at either root |
| 2 | high | agents/evidence/analysis/impact-bump-out-of-sample-20261020.md:190 | The `settings-keys` zero is reported for 14 of 14 spans with no control, which is why finding 1 was not caught. The Controls section opens "A zero from a detector is worth nothing until the detector is shown to be looking" and then controls only `installer-layout` and `rule-or-skill-removal`; `settings-keys` receives neither a positive nor a negative control. Compounding it: `SETTINGS_KEY_FILES` is exported but imported by nothing in `src/` or `tests/` and asserted by no test, making it the only constant in the module with zero coverage; and the documented reproduction (artefact:112) passes `<SETTINGS_KEY_FILES>`, a `RegExp[]`, as a `git diff --` pathspec, which is not executable as written. The settings half of the measurement therefore has no runnable form in the repo and no reader can re-derive it. | fixed | 835c84fd1 — `settings-keys` gained a positive and a negative-with-the-file-present control, `settings_key_paths` is imported and asserted by the tests, and the reproduction is executable |
| 3 | medium | src/scripts/_lib/major_surface.ts:43 | `INSTALLER_LAYOUT_PATHS` has the same staleness as finding 1, demonstrated in the measured window. The doc comment claims the list is historical "on purpose" and names three roots, but the entry-point regex matches only a root-level `scripts/install.` file with extension py, sh, ts or mjs, so it is root-anchored and misses today's `src/scripts/install.ts`, `src/scripts/install.sh` and `dist/install/install.mjs`. In span `6.1.0..7.0.0` both `src/scripts/install.ts` and `dist/install/install.mjs` are added and neither fires `installer-layout`. No verdict changes here (7.0.0 is `action`, already major) but the per-surface breakdown behind F2 is wrong and any future span that adds or removes the current entry point will not fire. The test at tests/lib/major_surface.test.ts:31 pins `templates/AGENTS.md`, `bin/agent-config` and `scripts/install.py`, none of which exist at HEAD, so the suite locks in the historical table and cannot detect the gap. | fixed | 835c84fd1 — the entry-point row takes an optional `src/` prefix; the tests now pin the current entry points, and `dist/install/install.mjs` is asserted to yield no surface with the reason stated |
| 4 | medium | agents/evidence/analysis/impact-bump-out-of-sample-20261020.md:202 | The one positive control offered is misstated by roughly an order of magnitude. "`5.10.1..6.0.0` contains **162** creations or removals under the rule and skill paths and 45 deletions" reads as both figures scoped to those paths. Measured: 162 is 158 additions plus 4 deletions under those paths, and the 45 is the span's total deletions anywhere in the tree. Since `rule-or-skill-removal` is deletion-only, the actual positive control for that detector is **4**, not 45, and the 162 conflates additions with deletions for a trigger that ignores additions. The control still passes, but the section whose purpose is to make the zeros checkable states a number that does not check out. | fixed | 835c84fd1 — the control now separates the deletion-only figure from the span total and names the earlier conflation |
| 5 | medium | agents/roadmaps/road-to-a-release-that-says-whether-it-needs-you.md:288 | The blocker's actionable field contradicts the note this diff inserted six lines above it. `What to do:` still reads "(b) now, decided by council; (a) is the owner's and waits on 2.2's result" — a condition superseded on 2026-10-19, when the council re-set it to the out-of-sample measurement, and again by the 2026-10-20 note recording that precondition as discharged. The field is written in the present imperative and carries no date, so a reader screening the backlog takes the two-revisions-old condition as current. The diff updates the narrative notes and leaves the field that states the blocker's live condition. | fixed | 835c84fd1 — the blocker's `What to do:` field carries a dated supersession and no longer states the two-revisions-old condition |
| 6 | low | tests/lib/major_surface.test.ts:91 | The `condensed-format` describe block cannot fail for the reason its name asserts. `classify_surfaces` is typed `Set<MajorSurface>`, so a classification containing `'condensed-format'` is unrepresentable; the third test therefore asserts something the type system already guarantees. The first two assertions restate the constants one import away. The block is a change-detector for `MAJOR_SURFACES` and `UNDERIVABLE_SURFACES`, which is useful, but its heading claims to test the distinction between "declared underivable" and "scored as absent" and no assertion exercises that distinction. By contrast the main `classify_surfaces` block is genuinely sensitive — its modification, rename and deletion-only assertions each fail under the obvious mutation. | accepted-risk | Kept deliberately and labelled in place: the assertion is weak because the type already forbids the value, and it still fails if a future author widens the union and wires a condense path into a table. The test now says so in a comment citing this finding rather than reading as a stronger check than it is. |
| 7 | low | agents/evidence/analysis/impact-bump-out-of-sample-20261020.md:121 | The rename-limit control is neither reproducible nor informative where it was applied. The warning `exhaustive rename detection was skipped` did not reproduce on the same tree with git 2.39.5 and no `diff.renameLimit` configured — stderr was empty for the 6.0.0 span. And the 6.0.0 span is already saturated on both file-decidable surfaces, so a two-pass comparison there could not have detected a change in either direction; for every other span, raising a limit that was not hit is a no-op by construction. The conclusion is nevertheless true and stronger than the artefact claims: re-running all 14 spans under `--no-renames`, the maximal create-and-delete reading, changes no row's surfaces. No row depends on rename handling at all. | fixed | 835c84fd1 — all 14 spans were re-run under `--no-renames` and every row is identical, which is the stronger claim the finding said was available |

## Verification performed

Every numeric claim below was re-derived in this worktree rather than read
from the artefact, by importing the committed `classify_surfaces` and
`parse_name_status` and feeding them real `git diff --name-status` output.

Reproduced exactly, no discrepancy: all 14 span boundaries (greatest tag
strictly below each major); the absence of a `4.0.0` tag locally and on the
remote; every `Consumer impact` cell against `BREAKING_CHANGES.md`, including
the two-row 6.0.0 case resolving to `action` by rank; all 7 out-of-sample
surface and bump rows; all 7 in-sample rows as the classifier currently
computes them; the 162 and the single `src/config/budget-routing.json`
deletion; the four zero-installer controls; and F3's claim that 15.0.0 removed
`src/domains/meta/chat-history/command.md` and its projection while the
surface clause correctly stayed silent.

The pre-registration claim holds and is the strongest part of this change.
Commit `cb3299d9e` adds Part 1, the classifier and the tests with Part 2 as an
explicit `<!-- result: pending -->` placeholder; commit `e08691641` appends the
result. The ordering is real, not asserted.

The 13 committed tests pass.

Not checked, and why: whether `task ci` is green, which AC-8 leaves to the
remote pipeline and which a local run cannot settle; whether any repository
gate objects to a module that nothing imports, which would need a repo-wide
sweep outside the review scope; and whether the removed keys in finding 1 were
intended as consumer-visible breaks rather than internal churn, which is a
judgement the artefact's stated method does not make either.
