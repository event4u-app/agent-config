---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-10-24
relates: []
# relates: the predecessor `road-to-source-silence` archived on 2026-08-29;
# every item below is a carry-forward from it, with the blocker that stopped it.
# Nothing here is new scope.
research_pin: "agent-config @ 63d06b7eb (origin/main, 2026-08-29) plus the drain/source-silence change that archived the predecessor. Every count below was measured at that state, not carried."
---
# Road to source-silence cutover — the four things an agent cannot do, and the one it would not

> **Source:** carry-forward from `road-to-source-silence`, archived 2026-08-29.
> The AI council (2026-08-29, anthropic + openai, 2/2) directed this roadmap's
> creation in decision **D3(a)**: *"Carry both items, with their blocker, into a
> follow-up roadmap created in the same change, immediately active in the
> estate."* Both seats explicitly refused cancellation as owner-reserved. The
> D2 items were added on the same principle after the council **split** on D2,
> and a split escalates rather than resolves.

## Goal

Every item the predecessor could not close is closed, and each is here because
of a **named** capability gap rather than because it was hard. Three of the four
groups need a repository secret or a license fact the executing agent has no
access to; the fourth needs an owner decision the council could not reach. When
this roadmap is finished: the tracked deny set publishes no readable source
name, a keyless CI run fails rather than warns, the `skip_paths` estate has a
recorded target it actually meets, and the shape-debt ratchet has been lowered
or reaffirmed before it expires on **2026-10-24**.

Two things are stated up front so they are not discovered later. First, the
digest cutover is **one atomic change** by a recorded council decision — four
steps that must land together, and splitting them is the specific failure mode
the predecessor's `where-the-key-lives` blocker was written about. Second, this
roadmap inherits the predecessor's honesty limit unchanged: nothing here is
historical eradication. Trunk commit messages and merged PR bodies still name
sources — 341 occurrences, counted as accepted residual — and no phase here
changes that.

## What the predecessor already landed, so this roadmap does not re-do it

Measured at the archiving change, all re-runnable:

| Property | State |
|---|---|
| Readable source names in tracked content and paths | **0** — `check_no_external_sources` exits 0, and that exit code is the `exec:` evidence behind `claim:plaintext-source-attribution` |
| `skip_paths` estate | 32 to **22**, per-entry measured, ledger at `agents/evidence/reports/source-skip-paths-ledger.md` |
| Attribution-shape block debt | 275 to **243**, shrink-only ratchet, expires 2026-10-24 |
| Keyed-digest machinery | built, tested against a non-production fixture key, **dormant** (`deny_digests` empty) |
| Off-tree metadata | gated on `pull_request` and on pre-push — branch name, PR title, PR body, commit messages |
| Write-time inbox naming | `block-speaking-inbox-dir` refuses a new speaking round directory |
| Archive redaction governance | **ADR-250**, accepted; five by-name archive exceptions removed |

## Phase 1 — The atomic digest cutover

**Read this before touching any step.** All four steps are ONE change. AI
council 2026-08-28, 2/2 convergent and unqualified: shipping the executable half
as a *replacement* is net-negative, because the half that can be built without
repository secrets is precisely the half that enforces nothing. One seat: *"you've
added complexity without adding protection, and you've broken a gate that at
least worked before."* The other: *"the security cutover must be atomic …
missing keys in CI must fail, never warn."* The recipe is
`docs/maintainers/source-deny-digests.md`, which already carries all four steps.

- [ ] **1.1 Provision `SOURCE_DENY_KEY` and create the private master.**
      Generate a high-entropy secret, store it as the repository secret, keep a
      copy where the other maintainer secrets live, and move the current
      plaintext `deny` array verbatim into the gitignored
      `src/scripts/external_sources_denylist.private.json`.
      verify: `./scripts-run src/scripts/build_source_digests --check` exits 0 against the private master, and `git check-ignore src/scripts/external_sources_denylist.private.json` confirms the master is untracked. <!-- blocked-by: agent-cannot-provision-a-secret -->
- [ ] **1.2 Extend the deny set from the census candidates.** Decrypt the Phase
      0 census and read its `candidates` array — 219 un-denied identifier tokens
      found on attribution-cue lines. A human decides which are real source
      families; the list over-reports by design, because an exact-match set
      structurally cannot find a family nobody listed. Adopted families go into
      the private master, never into tracked plaintext.
      verify: the private master's `deny` array is longer than the 65 entries it started with, and `sweep_source_surfaces` reports a LOWER `candidates:` count than 219 at the same pin. <!-- blocked-by: agent-cannot-provision-a-secret -->
- [ ] **1.3 Generate the digests and delete the tracked plaintext.**
      `build_source_digests` writes `deny_digests`; the `deny` array is removed
      from the tracked config in the same commit. Keep
      `_deny_digests_README`, `skip_paths` and `skip_reason`.
      verify: every entry of `deny_digests` matches the 64-hex digest form, the tracked config has no `deny` key, and `check_no_external_sources` still exits 1 on a seeded fixture violation. <!-- blocked-by: agent-cannot-provision-a-secret -->
- [ ] **1.4 Make CI strict, with a key-presence assertion before the gate.**
      Set `SOURCE_DENY_KEY` and `SOURCE_DENY_STRICT` on the gate step, and add a
      step before it that fails when the secret is empty — so a mis-scoped
      secret fails visibly rather than as a confusing gate error.
      verify: a CI run with the secret deliberately unset exits **3** (not 0), and the key-presence step is the one that reports it. `tests/scripts/source_digest.test.ts`'s last case — which asserts the shipped config is still dormant — is INVERTED rather than deleted, because that assertion is the tripwire that catches a half-cutover. <!-- blocked-by: agent-cannot-provision-a-secret -->

## Phase 2 — The two decisions the council could not settle

- [ ] **2.1 Settle the `skip_paths` target: 22, 21, or 18.** The predecessor's
      criterion said at most 20 and the measured floor with every principled
      carve-out intact is 22. The council was asked twice and **split** on the
      second round: one seat chose "correct the criterion to the measured floor",
      the other "hold at most 20 and leave it unmet". A split escalates, so this
      is an owner decision. Both seats agreed on everything else — the ledger
      discharges the evidentiary question, and the `dist/agent-src/` glob
      consolidation must not be done *to hit a number*.
      verify: the chosen number is recorded here with its rationale, the predecessor's AC-6 is restated against it, and `check_suppression_hygiene` holds at or below it. <!-- blocked-by: skip-paths-target-is-owner-reserved -->
- [ ] **2.2 Establish the upstream license for `src/scripts/cost/` and place its
      attribution.** Two files there carry a fork-attribution header comment
      (4 suppressed hits, the last entry that could leave the estate without
      touching a principled carve-out). It is harvest-shaped attribution outside
      the three license surfaces, so step 1.3 of the predecessor would move it
      into `provenance/borrows.jsonl` and de-name the comment. The agent did
      not, and the reason is a rule: the upstream license is established nowhere
      in this tree, and `code-provenance` says an unknown source license is
      never permissive-by-default — stop and escalate, never guess.
      verify: `provenance/borrows.jsonl` carries an entry naming the upstream, its license and these two files; `lint_provenance` passes; and either the in-file comment is de-named and the `src/scripts/cost/` entry removed from `skip_paths`, or the entry stays with a one-line reason recording that the license requires in-file retention. <!-- blocked-by: upstream-license-unknown -->

## Phase 3 — The ratchet expiry, which has a date

- [ ] **3.1 Lower, clear, or reaffirm the shape-debt baseline before
      2026-10-24.** `check_no_external_sources:shape-block` sits at 243 and goes
      stale 56 days after its `landed` date. The debt is the predecessor's
      Phase 2.1 codename rewrite on the NON-anchored occurrences — roughly 190
      quoted non-opaque inbox directory paths and 107 speaking `**Source:**`
      header values across the roadmap corpus. The anchored occurrences are
      already done; this is the corpus-wide remainder.
      verify: on the day of the change, `check_no_external_sources` reports the block count at or below a baseline whose `landed` date is within 56 days — by a real reduction, by clearing the class, or by a `reaffirmed` block stating a real reason. A refreshed date with no reduction and no reason does not satisfy this.

## Blockers

### blocker: agent-cannot-provision-a-secret

- **Status:** open
- **Class:** 3
- **Owner:** maintainer
- **Blocks:** Phase 1 in full — steps 1.1, 1.2, 1.3 and 1.4, which are one
  atomic change and cannot be split.
- **What to do:** the four steps of `docs/maintainers/source-deny-digests.md`,
  in one change: (a) `gh secret set SOURCE_DENY_KEY`; (b) create the gitignored
  `src/scripts/external_sources_denylist.private.json` from the current
  plaintext `deny` array; (c) `./scripts-run src/scripts/build_source_digests`
  then delete the tracked `deny` array in the same commit; (d) add the key and
  the strict flag to the gate's CI step behind a key-presence assertion.
- **Resolved when:** the tracked config carries digests and no `deny` array, a
  keyless CI run exits 3, and `build_source_digests --check` passes against the
  private master.
- **Recommendation:** do it as one PR authored by a human with secret access.
  An agent can prepare the diff for (c) and (d) but cannot perform (a), and a
  PR containing (c) without (a) breaks the gate — which is precisely the
  net-negative outcome the 2026-08-28 council refused.
- **If you do nothing:** the tracked denylist keeps publishing the 65 harvest
  source names it exists to hide, in a public repository, and every family
  Phase 1.2 would have added makes the disclosure larger. The mechanism sits in
  the tree, built and tested, enforcing nothing.

### blocker: skip-paths-target-is-owner-reserved

- **Status:** open
- **Class:** 3
- **Owner:** maintainer
- **Blocks:** Phase 2 step 2.1, and the predecessor's AC-6.
- **What to do:** pick exactly one — (a) correct the target to the measured
  floor of **22**, recording
  `agents/evidence/reports/source-skip-paths-ledger.md` as the basis, and keep
  the entry shrink-only so 22 can only go down; (b) resolve 2.2 first and take
  the target to **21**; (c) additionally exclude the `dist/agent-src/` globs as
  a derived surface, replacing 5 entries with 1 for a floor of **18** — coverage
  is materially unchanged because byte-exact projection is CI-verified
  (ADR-201), and the cost is visibility: a future `src/` exception would then
  silently extend to the projection where today it takes two entries a reviewer
  can see; (d) hold at most 20 and accept that the criterion stays unmet.
- **Resolved when:** the number is recorded here with its rationale and the
  predecessor's AC-6 is restated against it.
- **Recommendation:** (a). The 22 survivors are each justified by the
  predecessor's own step 1.3 — gate-own, license-required corpus, registry
  docs, license surfaces — and one seat's argument is the decisive one: a
  criterion left unmet at 22 implies the last two entries should go *despite*
  being defensible, which is satisfying a number rather than a principle. Take
  (c) only as an independently argued gate-design change, never to reach 20.
- **If you do nothing:** AC-6 stays open indefinitely and the 32-to-22 reduction
  that already landed has no recorded target to be measured against, so the
  next drift has nothing to fail.

### blocker: upstream-license-unknown

- **Status:** open
- **Class:** 3
- **Owner:** maintainer
- **Blocks:** Phase 2 step 2.2 only. Nothing else depends on it, and the
  `src/scripts/cost/` exception is stable meanwhile.
- **What to do:** read the upstream named in the header comment at
  `src/scripts/cost/budget.mjs:5` and `src/scripts/cost/track.mjs:5`, establish
  its license, then either (a) record it in `provenance/borrows.jsonl` with
  these two files and de-name the in-file comment — the license surface is
  already an excepted path, so the attribution survives where it belongs; or
  (b) keep the in-file notice because the license requires retention in
  derivative source, and record that one-line reason beside the `skip_paths`
  entry.
- **Resolved when:** the license is named in `provenance/borrows.jsonl` and one
  of (a) or (b) is executed.
- **Recommendation:** (a) for a license whose notices file discharges the
  obligation; (b) for one whose retention language makes stripping an in-file
  notice a legal question rather than a hygiene one. Either way
  `lint_provenance` must pass afterwards.
- **If you do nothing:** a harvest-shaped attribution stays in a source file
  outside the three license surfaces, and one `skip_paths` entry that could
  have been retired keeps the estate one above its reachable floor.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The atomic cutover gets split across PRs | implementation | Steps 1.3 and 1.4 land in different changes, leaving the gate either failing every run for want of a key or silently degraded to warn mode — the exact failure the predecessor was written about. | Phase 1's own preamble states it, the maintainer recipe states it, and 1.4's verify asserts the keyless run exits 3 rather than 0, so a half-cutover is observable rather than quiet. | Phase 1 — The atomic digest cutover |
| 2 | The 2026-10-24 ratchet expiry passes unnoticed | implementation | The shape-debt baseline goes stale before anyone lowers it, and the gate then reports a stale entry instead of a real count. | Phase 3 exists only for this date, `review_by` is set to it rather than to a comfortable later month, and the baseline's own note names the expiry and this roadmap as its owner. | Phase 3 — The ratchet expiry, which has a date |
| 3 | This roadmap becomes the parking lot | product | A carry-forward roadmap whose every item is maintainer-gated is the shape that sits untouched for a year, which is the specific objection both council seats raised against disposition D3(a). | Each blocker names the exact command or decision, an accountable owner, and a falsifiable Resolved-when; and one item — Phase 3 — has a hard date rather than a condition, so at least one thing here cannot be deferred silently. | Blockers |
| 4 | 2.2 is resolved by guessing the license | product | The fastest way to close 2.2 is to assume permissive and strip the notice, which is the guess `code-provenance` forbids and the reason the predecessor left it open. | The blocker's option set is written as a license-conditional fork, so "which license" has to be answered before either branch is reachable. | Phase 2 — The two decisions the council could not settle |

## Acceptance Criteria

- [ ] AC-1 — The tracked config holds no readable source name: every
      `deny_digests` entry is a 64-hex digest, no `deny` array is present, and
      the gate still exits 1 on a seeded fixture violation in CI.
- [ ] AC-2 — A keyless run is loud, never green: with the key unset the gate
      exits **3** under the strict flag, and a CI step asserts key presence
      before the gate step runs.
- [ ] AC-3 — `skip_paths` has a recorded target it meets, and the entry is
      shrink-only, so the next drift fails rather than accumulating.
- [ ] AC-4 — `check_no_external_sources:shape-block` carries a `landed` date
      within its 56-day window, reached by a reduction or by a `reaffirmed`
      block that states a real reason.

## What this roadmap will NOT build

- **A git-history rewrite.** Resolved **(a) no rewrite** by the predecessor's
  `whether-history-gets-rewritten` blocker, 2/2 convergent, one seat
  "strongly": a rewrite converts every pinned reproduced-at-sha in the evidence
  estate into an unverifiable claim. The 341 residual occurrences on trunk
  commit messages and merged PR bodies stay counted, not removed.
- **PR-metadata edits or branch-ref deletions on the live repository.** Descoped
  to `agents/roadmaps/stubs/road-to-public-metadata-redaction.md` as a
  Hard-Floor action under `non-destructive-by-default`. Deleting a ref is
  irreversible and both are outward mutations of public state, so they need a
  this-turn owner confirmation naming the exact objects — no roadmap
  authorization substitutes.
- **The corpus-wide codename rewrite as a separate programme.** It is Phase 3
  here, bounded by the ratchet's expiry date, deliberately not re-opened as its
  own roadmap.
- **A wider attribution-shape heuristic.** The bare slug class was built,
  measured at 3,109 hits against 202 for the URL form, and removed. The recall
  hole it leaves is recorded in `src/scripts/_lib/source_shape.ts` and pinned by
  a negative test; a future attempt has to pass the measured false positives
  first.
