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

- [ ] Make the release-PR check scope resolve to `previous_release_tag...release_head`
      rather than the PR's own file list, for the content checks that are
      diff-scoped (skill lint, rule lint, portability, claim impact).
      *Verify:* re-running the check on the last release reports a non-zero
      checked count; a synthetic skill defect introduced anywhere in the tag span
      turns it red.
- [ ] `INCONCLUSIVE` on a release PR is a failure, not an outcome — a release
      check that examined nothing must block the release, matching the scan-scope
      regime already adopted for the other gates.
      *Verify:* a fixture release PR with an empty resolved scope exits non-zero.
- [ ] Fix the silent-probe class the footer incident exposed: any probe that
      shells out for a count must fail loudly on buffer overflow rather than
      degrading to zero.
      *Verify:* a fixture whose output exceeds the buffer produces an error, not a
      zero; the footer gate stays green for the right reason.

## Phase 2 — Release notes state impact, not commit count

- [ ] Give the release notes a fixed curated head above the generated log, in this
      order: **behaviour changes · default changes + migration · security and
      correctness · honest nulls · known limitations**, capped at roughly ten
      operator-relevant lines. The full generated log stays below it, unchanged.
      *Verify:* the next release's head section fits the cap and every default
      change appears in it; the generator emits the section skeleton so it cannot
      be forgotten.
- [ ] Deduplicate repeated commit lines in the generated section.
      *Verify:* no line appears twice in the last release's regenerated notes.

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
