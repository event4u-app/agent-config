---
complexity: lightweight
status: ready
---

# Road to release-shape honesty — lint the release that shipped, and describe it truthfully

> Five independent reviews of 9.9.0 and 9.10.0 raised the same two release
> defects. The first is a correctness hole: a 179-commit release ran its skill
> lint over the release-metadata diff, reported **"0 skills checked, INCONCLUSIVE"**,
> and merged. The second is a truthfulness hole: a headline claims a 38 %
> reduction that a later measurement found unreachable in production installs, and
> the changelog headline still reads as an achieved win. Council cut:
> [`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md).

## Goal

Make release-time checks see the release, and make release notes state what a
reader would be misled about otherwise. Two defects, one truthfulness pass, no new
governance layer — the reviews' proposed release-budget gate is deliberately folded
into an existing checklist rather than built.

## Context (verified from the review set, 2026-08-01)

- The release PR's own diff is version, changelog, pack metadata and marketplace
  files. The substantive work arrives in the preceding commits, so every check
  scoped to "files changed in this PR" measures the release wrapper, not the
  release. The visible consequence: `0 skills checked` on a release containing
  many skill changes, correctly labelled `INCONCLUSIVE` and merged anyway.
- The scope-dedup measurement: **38.0 % of median cold-start tokens** (87,677 of
  230,556) against a pre-registered 15 % bar — measured on a byte-identical
  fixture. In the real install model, global files carry additional ownership
  metadata and are therefore *not* byte-identical to project projections, so the
  byte-identity gate correctly refuses to dedup and the recipient set is empty.
  This was recorded as an honest null. **The changelog headline was not updated.**
- Release notes are a generated commit log: reviewers repeatedly could not tell
  which entries change consumer behaviour, which need migration, which are
  internal gate repairs, and which ended as nulls.
- One release cycle lost a changelog footer because a probe buffered `vitest list`
  output through a 1 MiB default and the suite listing had grown to 1,254,812
  bytes — ENOBUFS degraded the probe silently to zero. Same silent-drop symptom
  class as a prior incident, different cause.

> **Scope boundary.** No release-budget *gate*. The reviews' "one capability track
> per minor" recommendation folds into the existing release checklist and
> self-review prompt; a new blocking gate is precisely the governance inflation the
> same reviews condemn. Release *size* is a planning decision, not a machine check.

## Phase 1 — Release checks must see the release diff

- [x] Make the release-PR check scope resolve to `previous_release_tag...release_head`
      rather than the PR's own file list, for the content checks that are
      diff-scoped (skill lint, rule lint, portability, claim impact).
      *Verify:* re-running the check on the last release reports a non-zero
      checked count; a synthetic skill defect introduced anywhere in the tag span
      turns it red.
      <!-- `_lib/release_scope.ts::resolveContentLintScope` — reuses the release detector `self_review_gate` already had (moved to the lib, re-exported, its 27 tests still green) rather than adding a fourteenth changed-file resolver. Wired into `skill_linter --changed` (+ `--since`) and, via the `resolve_lint_scope` resolver, into the originality gate's shell. Measured: 0 → 10 linted files. -->
      <!-- **Correction to this step's premise.** Of the four checks named, only the skill lint is diff-scoped. `check_portability` and `check_claims` walk the whole tree, `lint-rule-tiers` globs all rules — all three already see the release and need no scope machinery. There is no "claim impact" gate at all; the nearest thing is `self_review_gate`'s advisory claim-surface classifier. The step's real fifth target, unnamed in the roadmap, is the **originality gate**, and it is the one whose INCONCLUSIVE was a literal `exit 0`. -->
      <!-- Landmine found and pinned by test: this repo carries 152 semver tags alongside names like `rebase-backup-pre-squash`, which sort ABOVE every version under `git tag --sort=-v:refname`. A naive "newest tag" resolves the scope to a backup ref. `pickPreviousTag` filters to semver by construction. -->
      <!-- Second landmine: neither `skill-lint.yml` checkout set `fetch-tags: true`, so tag resolution in CI would have returned nothing and reintroduced the blindness through a different door. Both checkouts now fetch tags. -->
- [x] `INCONCLUSIVE` on a release PR is a failure, not an outcome — a release
      check that examined nothing must block the release, matching the scan-scope
      regime already adopted for the other gates.
      *Verify:* a fixture release PR with an empty resolved scope exits non-zero.
      <!-- Mirrors the existing regime rather than inventing a second shape: `_lib/scan_scope.ts::assertScanned` + `DeadScopeError` → exit 2, as `check_iron_law_prominence` does. (The precedent disagrees with itself — `check_safety_floor_untouched` returns 3 — so 2 is chosen as the more common one and stated here.) The originality gate's `exit 0` becomes `exit 1` on a widened scope. -->
      <!-- Deliberately narrow: only a release PR whose scope ACTUALLY widened to a resolved tag span fails on empty. An ordinary PR that touches no skill keeps exit 0 (a legitimately empty scope is not a dead one), and a release whose previous tag cannot be resolved is excluded too — failing that would punish a shallow clone for the wrong reason. -->
- [x] Fix the silent-probe class the footer incident exposed: any probe that
      shells out for a count must fail loudly on buffer overflow rather than
      degrading to zero.
      *Verify:* a fixture whose output exceeds the buffer produces an error, not a
      zero; the footer gate stays green for the right reason.
      <!-- **Premise partly stale, corrected rather than re-done.** The footer probe itself was already hardened: `release.ts` pins a 64 MiB buffer and `_count_from_list_result` warns on every degradation. What was missing is the CLASS the step actually names. `_lib/counted_probe.ts` supplies it: ENOBUFS THROWS (the command succeeded and we lost its output — there is no honest count), while ENOENT / non-zero stay degradable outcomes (a dev box without `npx` is a real, reportable condition). -->
      <!-- Converted the four Tier-1 sites where truncation manufactures a GREEN gate: `skill_linter`'s changed-file diff (its swallow-all `catch { return []; }` no longer eats an overflow), `check_gate_coverage` (a truncated read loses the `scanned:` line and the scan-scope guard reports a dead scope that is merely truncated), `lint_agent_security` (a truncated `--json` payload parses to zero findings on the security aggregate), and `check_kernel_rule_bundle` (a short diff lets the guard pass on files it never saw). ~30 Tier-2 sites remain and are a follow-on sweep, not this phase. -->

## Phase 2 — Release notes state impact, not commit count

- [x] Give the release notes a fixed curated head above the generated log, in this
      order: **behaviour changes · default changes + migration · security and
      correctness · honest nulls · known limitations**, capped at roughly ten
      operator-relevant lines. The full generated log stays below it, unchanged.
      *Verify:* the next release's head section fits the cap and every default
      change appears in it; the generator emits the section skeleton so it cannot
      be forgotten.
      <!-- `render_release_head()` in release.ts; `RELEASE_HEAD_CAP_LINES = 10`, the HTML authoring comment excluded from the count because it is invisible to a reader. -->
      <!-- Default value is `_none_`, deliberately not a placeholder token: for most releases it is the TRUE answer, and a release that changed no defaults should say so. That also keeps the skeleton clear of the placeholder prose `output-discipline` bans — nothing here is wrong-if-shipped, only terse-if-unedited. -->
      <!-- **Verification substituted, and the substitution stated.** The literal verify ("the next release's head") cannot close inside this PR — no release is cut here. In-PR evidence instead: `./scripts-run src/scripts/release --dry-run` regenerates the notes for 9.12.0 → 9.13.0 through the new generator against the real repository, and the head renders above `### Features` at 6 operator-facing lines. -->
      <!-- Wording taken from `docs/RELEASE_STORY_TEMPLATE.md` rather than invented, and that file now points at the head as the shipped artifact — otherwise the package would carry two competing definitions of a curated head. -->
- [x] Deduplicate repeated commit lines in the generated section.
      *Verify:* no line appears twice in the last release's regenerated notes.
      <!-- `dedupe_commit_lines()`, applied once over `commits` so both emit sites (graded sections and `Other`) are covered by one change. Keyed on `type + scope + subject` — the parts that reach the rendered line — keeping the first occurrence so the earliest SHA stays the citation. -->
      <!-- A breaking commit is never folded into a non-breaking twin: `!` changes what the line MEANS, and collapsing them would hide a breaking change behind a routine one. Pinned by test. -->
      <!-- Verified on the real regenerated notes: 13 bullets, `sort | uniq -d` empty. -->

## Phase 3 — Correct the standing claims

- [ ] Amend the scope-dedup changelog and claim entries so the condition travels
      with the number: the 38 % is fixture-measured and **currently unreachable for
      production installs** because global and project projections are not
      byte-identical. The honest-null record already says this; the headline must
      not outrun it.
      *Verify:* the claims ledger and the changelog agree, and neither states an
      unconditioned 38 % win.
- [ ] Give every claim whose backing trigger is outside maintainer control an
      honest lifecycle status (`untestable without external adoption` or
      equivalent) instead of an indefinite `unbacked pending`. Debt that cannot
      structurally shrink is a misfiled blocker, not debt.
      *Verify:* no claim remains in a pending state whose precondition the
      maintainer cannot satisfy; the count of genuinely open items drops.
- [ ] Fold the release-shape recommendations into the existing release checklist:
      one capability track per minor, security/fix releases cut separately, and a
      pre-version-PR dry run of the actual artifact (pack → install → hooks →
      upgrade → uninstall).
      *Verify:* the checklist lines exist and no new gate was created.

## Non-goals (recorded refusals)

- **No release-budget gate.** Folded into the checklist, per the reviews' own
  no-new-governance rule.
- **No adoption-conditioned work.** Launch posts, registry submissions, external
  recruiting and the adoption deadlines that two source documents make their top
  phase are out of scope by operator decision; the claim-lifecycle item above is
  the *only* adoption-adjacent work retained, and it exists to close the ledger
  honestly rather than to pursue adoption.
- **No release splitting enforced by machine.** Naming it in the checklist is the
  intervention; a gate that counts commits would block work for a planning
  preference.

## Surface delta

**+3 checklist lines, +1 generated notes section, 0 new gates**, and a claims
ledger that shrinks because structurally-unclosable entries stop being counted as
open. Two correctness defects (blind release lint, silent probe overflow) are
closed.

## Provenance

Sources: `agents/tmp.old/feedback-9.10.0-1.txt` (five independent reviews of PR
#1069 / 9.10.0), `agents/tmp.old/feedback-9.9.0-1.txt` (six reviews of 9.9.0),
`agents/tmp.old/feedback-9.9.0-2.txt` (their cross-checked consolidation) — all
operator-owned. Disposition: council 2026-08-01 (`anthropic/claude-sonnet-4-5` +
`openai/gpt-4o`, 2 rounds) —
[`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md).
The consolidation document's own Phase 0 (an adoption deadline) is dropped rather
than deferred, per the operator's out-of-scope decision on external adoption.
