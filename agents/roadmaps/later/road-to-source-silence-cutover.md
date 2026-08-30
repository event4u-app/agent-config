---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "Parking relocates estate rather than creating it: this change moves road-to-source-silence-cutover out of the active top level into later/ and carries its one open blocker with it, so later_roadmaps and open_blockers each rise by exactly one while active_roadmaps falls by one and no new work is planned. The budget file already names this as the parking allowance (+1 per roadmap moved from the active top level into later/ in the same change); the automatic offset did not fire because the move reaches the diff as an add plus a delete rather than a detected rename, so the growth is claimed here instead of left to a heuristic. The alternative was deleting the blocker to satisfy the count, which is the burial this ratchet exists to prevent."
review_by: 2026-10-20
relates: []
# relates: the predecessor `road-to-source-silence` archived on 2026-08-29;
# every item below is a carry-forward from it, with the blocker that stopped it.
# Nothing here is new scope.
research_pin: "agent-config @ 63d06b7eb (origin/main, 2026-08-29) plus the drain/source-silence change that archived the predecessor. Every count below was measured at that state, not carried."
---

> **PARKED 2026-08-30. Phases 2 and 3 are complete; Phase 1 is gated on a
> repository secret no agent can mint.** Resume when a maintainer with secret
> access has provisioned `SOURCE_DENY_KEY`.
>
> This is the `later/` disposition applied as written — *"a roadmap whose open
> work cannot proceed now (gated on an external trigger) but will resume"* — and
> not a judgement call. Step 1.1 is `gh secret set SOURCE_DENY_KEY`: minting a
> secret and writing it into the repository's configuration is an outward
> mutation of public state that no roadmap authorization substitutes for, and
> the value itself must never pass through an agent's context.
>
> **Phase 1 is NOT split, and that refusal is a standing council verdict rather
> than caution.** AI council 2026-08-28, 2/2 convergent and unqualified: shipping
> the executable half as a *replacement* is net-negative, because the half an
> agent can build without secrets is precisely the half that enforces nothing.
> One seat: *"you've added complexity without adding protection, and you've
> broken a gate that at least worked before."* So the three steps an agent
> COULD prepare (1.2's candidate reading, 1.3's digest generation, 1.4's CI
> wiring) are deliberately left undone rather than landed as a partial cutover.
>
> **Why parked rather than descoped to a stub.** Parking preserves every item
> and its blocker in one file with an exact resume condition, and costs the
> estate nothing. A stub would split the four atomic steps away from the
> acceptance criteria that depend on them (AC-1 and AC-2), which is the same
> split the council refused, performed on the paperwork instead of the code.
>
> **What landed and is not waiting on anything:** the `skip_paths` target is
> settled at 21 with the `src/scripts/cost/` entry retired and its MIT notice
> shipped (Phase 2), and the attribution-shape ratchet is down from 243 to 148
> by fixing a class that was scoring compliance as debt (Phase 3). AC-3 and
> AC-4 are met. AC-1 and AC-2 remain open and are exactly Phase 1.
>
> **The cost of waiting, restated because it is the reason this file exists:**
> the tracked denylist keeps publishing the 65 harvest source names it exists to
> hide, in a public repository, and the mechanism to stop that sits in the tree
> built and tested, enforcing nothing.
>
> **Revisit-if:** `SOURCE_DENY_KEY` is provisioned; or the digest cutover is
> abandoned as a design, which is an owner decision and would retire this file
> rather than resume it.
# Road to source-silence cutover — the four things an agent cannot do, and the one it would not

> **Origin:** carry-forward from `road-to-source-silence`, archived 2026-08-29.
> Internally originated — no external source, so no `Source:` header, per the
> roadmap template's Provenance rule.
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

- [x] **2.1 Settle the `skip_paths` target: 22, 21, or 18.** The predecessor's
      criterion said at most 20 and the measured floor with every principled
      carve-out intact is 22. The council was asked twice and **split** on the
      second round: one seat chose "correct the criterion to the measured floor",
      the other "hold at most 20 and leave it unmet". A split escalates, so this
      is an owner decision. Both seats agreed on everything else — the ledger
      discharges the evidentiary question, and the `dist/agent-src/` glob
      consolidation must not be done *to hit a number*.
      verify: DONE — the number is **21**, recorded below with the council's rationale; the predecessor's AC-6 is restated as this roadmap's AC-3; `check_suppression_hygiene` reports `src/scripts/external_sources_denylist.json: 21 entry(ies) (22 at base, 1 removed)`.

      **Decision: 21.** AI council, 2026-08-30 — **2/2 seats present**
      (anthropic `claude-sonnet-4-5`, openai `codex-default`), $0.00,
      subscription-authed. The maintainer delegated this decision to the council
      for the autonomous drain run of 2026-08-30; the earlier round SPLIT 1–1,
      and this round converged because two facts changed rather than because the
      question was asked louder.

      **What changed.** The per-entry ledger now exists, so every survivor's
      suppressed-hit count is measured rather than estimated. And the
      `src/scripts/cost/` entry, which was blocked on an unknown upstream
      license, is unblocked — the license is MIT (step 2.2), MIT discharges
      through a distributed notice rather than an in-file one, so that entry is
      retirable and the measured floor is 21 rather than 22.

      **Both seats rejected (c), the 18-entry consolidation, and for the same
      reason** — it must not be done to reach a number. openai put the principle
      sharpest: ADR-201's byte-exact projection proves *content* equivalence,
      not *policy* equivalence, and replacing five narrow `dist/agent-src/`
      patterns with one broad glob changes which future paths are automatically
      authorised. The five entries are a review boundary; a comment saying the
      projection "mechanically inherits" exceptions records the coupling without
      making it safe. anthropic agreed on the framing and pushed back on gating
      consolidation behind a new CI invariant, calling that gold-plating — but
      not on the refusal to use it as target arithmetic. **Consolidation is
      therefore available only as an independently argued gate-design change,
      never as a way to hit a number.**

      **Both rejected (d), holding at 20**, on the argument this blocker already
      carried: a criterion left unmet at 21 implies the last defensible entries
      should go *despite* being defensible, which is satisfying a number rather
      than a principle.

      **The binding condition, from openai, and it is a SEQUENCE rather than a
      preference:** the MIT notice must be on a surface included in every
      relevant distributed artifact, and the packaged outputs — not just the
      repository tree — must be verified, BEFORE the `src/scripts/cost/` entry is
      removed. Establishing the license only removes the legal uncertainty; it
      does not discharge the notice obligation. Step 2.2 executes that order and
      records what it found: `CREDITS.md`, `NOTICE`, `docs/THIRD-PARTY-NOTICES.md`
      and `provenance/borrows.jsonl` were **all absent from `package.json`'s
      `files` list**, while `src/scripts/` was present — so the affected code
      shipped and every notice surface did not. Three of the four are now added.

      **Rollback, as the seat specified:** if any packaged artifact lacks the
      notice or the deny scan develops an unskipped hit, restore the narrow
      `src/scripts/cost/` exemption until the distribution defect is fixed. That
      is containment, not permanent acceptance.

      **One recorded observation neither acted on nor buried.** openai flagged
      that the gate exempting its own source and denylist (entries 1 and 2) is a
      trust boundary this roadmap does not examine: whole-file exemption means
      edits to those files can evade the policy they enforce. "Self-reference"
      explains the exception; it does not eliminate the risk. Out of scope here,
      and recorded so the next reader does not have to rediscover it.

      *Revisit-if:* another exemption becomes unnecessary; the MIT notice
      distribution cannot be verified in a packed artifact; the deny scan gains
      an unskipped hit; or CI begins rejecting a source-exemption change that
      implicitly broadens `dist/agent-src/` coverage without explicit review.

- [x] **2.2 Establish the upstream license for `src/scripts/cost/` and place its
      attribution.** Two files there carry a fork-attribution header comment
      (4 suppressed hits, the last entry that could leave the estate without
      touching a principled carve-out). It is harvest-shaped attribution outside
      the three license surfaces, so step 1.3 of the predecessor would move it
      into `provenance/borrows.jsonl` and de-name the comment. The agent did
      not, and the reason is a rule: the upstream license is established nowhere
      in this tree, and `code-provenance` says an unknown source license is
      never permissive-by-default — stop and escalate, never guess.
      verify: DONE — `provenance/borrows.jsonl` carries the entry (upstream, `MIT`, `source_sha`, both files); `lint_provenance` reports `2 ledger record(s) OK · docs/THIRD-PARTY-NOTICES.md in sync`; the in-file comments are de-named and `src/scripts/cost/*` is removed from `skip_paths`, which is branch (a).

      **The license is MIT**, established from the upstream repository's own
      `LICENSE` via the GitHub API rather than inferred — `spdx_id: MIT`, with
      the copyright line reproduced on the license surface where it belongs
      (`CREDITS.md`) rather than quoted here, since a roadmap is not one of the
      three exempt surfaces. The upstream is not archived and the two forked
      files still exist there, so the `source_sha` pins a revision a reader can
      fetch.

      **Branch (a), and the license text is why.** MIT requires the copyright
      notice and the permission notice to be *included in all copies or
      substantial portions of the Software* — it says nothing about placement,
      and a notices file distributed with the software is the conventional
      discharge. So the in-file source name is not required by the license, and
      `source-confidentiality` forbids it: both comments now point at the
      notice surfaces without naming the upstream.

      **What the in-file comment actually was, which matters:** a "Forked from
      <repo>" attribution line and NOT an MIT copyright or permission notice. So
      the previous state discharged the license obligation nowhere — it merely
      named a source in a place a rule forbids. Recording it properly is a
      compliance improvement, not a relocation.

      **A live compliance gap was found and closed on the way, and it is worth
      stating plainly.** The council's sequencing condition ("verify packaged
      outputs, not just the repository tree") turned up that `package.json`'s
      `files` list carried **neither `NOTICE` nor `CREDITS.md` nor
      `docs/THIRD-PARTY-NOTICES.md` nor `provenance/borrows.jsonl`** — while it
      does carry `src/scripts/`. npm auto-includes `LICENSE` and `README` and
      nothing else from that set, so every third-party notice surface was absent
      from the published package while the code it covers shipped. That is not
      only the new MIT entry: the pre-existing Apache-2.0 entry in `NOTICE` has
      the same problem, and Apache-2.0 § 4(d) is explicit about distributing
      NOTICE. All four paths are now in `files`.

      The MIT notice itself is reproduced IN FULL in `CREDITS.md` — copyright
      line, permission notice, warranty disclaimer — rather than by reference to
      `LICENSES/MIT.txt`, which is an unfilled template carrying
      `<year> <copyright holders>` and is therefore a notice for no particular
      work.


## Phase 3 — The ratchet expiry, which has a date

- [x] **3.1 Lower, clear, or reaffirm the shape-debt baseline before
      2026-10-24.** `check_no_external_sources:shape-block` sits at 243 and goes
      stale 56 days after its `landed` date. The debt is the predecessor's
      Phase 2.1 codename rewrite on the NON-anchored occurrences — roughly 190
      quoted non-opaque inbox directory paths and 107 speaking `**Source:**`
      header values across the roadmap corpus. The anchored occurrences are
      already done; this is the corpus-wide remainder.
      verify: DONE — `check_no_external_sources` reports `attribution shape — block(agents/**) 148 / baseline 148`, `landed: 2026-08-30`, by a REAL reduction of 95: 243 → 148.

      **The reduction is a heuristic fix, not a paydown, and the difference is
      the whole finding.** The `source-header` class flagged the VALUE of every
      `**Source:**` header that was not an `ENC1:` token or an opaque round id —
      so a correctly ANONYMISED header scored exactly like a leaking one. All 95
      were read: **not one named an external source in readable form**, and six
      were flagging the anonymisation notice itself (`**Source:** anonymisation
      (source-confidentiality).** External harvest sources …`). The detector was
      reporting compliance as debt.

      **AI council 2026-08-30, 2/2 seats present** (anthropic `claude-sonnet-4-5`
      + openai `codex-default`), $0.00, subscription-authed; delegated by the
      maintainer for the autonomous drain run. Verdict: **(a) — narrow the
      class, do not delete it, baseline 148.** Both seats REFUSED (c), removing
      the class: a `**Source:**` header is where policy directs authors to
      record attribution and is therefore the highest-value place to keep
      looking. Both refused (d), reaffirming at 243, because that would
      characterise all 243 as established debt when 95 of them are not.

      **The test that separates this from metric gaming, in the council's own
      words:** *"whether the revised detector preserves recall for the prohibited
      behaviour while removing findings that do not represent it"* — which is
      why the fixtures are a condition and not a nicety.

      **The operational grammar is written out**, because a seat named the exact
      risk: *"'readable slug' is still an open question disguised as a decision …
      without that specification, option (a) merely moves subjective
      classification into code."* `readableIdentifierIn` flags three shapes,
      none of which prose produces by accident — an `owner/repo` slug, a domain,
      an `@scope/package` — with this repository's own paths, roadmap slugs, ADR
      ids and PR references excluded first.

      **The delta is audited, and the first attempt was wrong.** A full-tree
      recount removed exactly the 95 audited `source-header` findings and ADDED
      ZERO; 148 = 127 `tmp-quote` + 21 `repo-slug`, which is openai's stated
      reviewer check verbatim. The first run produced **150**, on
      `uncondensed/rules` and `installer/src` — two middle-of-path segments that
      read like repository slugs unless you look at what surrounds them. Both
      are pinned as fixtures.

      **Evidence:** `tests/scripts/source_header_narrowing.test.ts`, 30 cases
      over three labeled fixtures in `tests/fixtures/source-headers/` —
      `compliant.md` (anonymised, must not flag, and asserted to be exactly what
      the OLD detector flagged), `internal-ref.md` (repo paths, must not flag),
      `leaking.md` (invented names covering all three identifier shapes, MUST
      flag). The fixture names are invented on purpose: a fixture carrying a real
      source name would itself be the leak.

      **Shadow metric, a council condition:** `legacySourceHeaderHits` is kept
      and the gate reports its raw count (107) beside the live one. It enforces
      nothing, and the line says plainly that it is not comparable to the 95 —
      that figure was measured after snapshot deduplication and this one is not.

      **What remains is real debt and was NOT paid down here:** 127 quoted
      speaking inbox-directory names and 21 repository slugs, 152 of them in
      `agents/roadmaps/archive/`. Paying it down is in-place redaction under
      ADR-250 across ~150 historical files, which this change deliberately did
      not attempt and which the council explicitly separated from fixing a
      defective metric.

      *Revisit-if:* a readable identifier in a `**Source:**` fixture escapes
      detection; the full-tree count is not reproducibly 148; the observed delta
      contains anything outside the audited `source-header` set. Any of the
      three reverts the matcher and restores 243.

## Blockers

### blocker: agent-cannot-provision-a-secret

- **Status:** open
- **Class:** 3
- **Owner:** maintainer
- **Blocks:** Phase 1 in full — steps 1.1, 1.2, 1.3 and 1.4, which are one
  atomic change and cannot be split.
- **What to do:** the four steps of `docs/maintainers/source-deny-digests.md`,
  in one change: (a) `gh secret set SOURCE_DENY_KEY`; (b) create the gitignored
  `src/scripts/external_sources_denylist.private.json` <!-- ref-ignore --> from
  the current plaintext `deny` array; (c) `./scripts-run src/scripts/build_source_digests`
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

- **Status:** resolved 2026-08-30 — **(b), 21**. AI council, 2/2 seats present
  (anthropic + openai), $0.00. The maintainer delegated the decision to the
  council for the autonomous drain run of 2026-08-30; the earlier round split
  1–1 and this one converged, because the per-entry ledger landed and the
  `src/scripts/cost/` entry became retirable once its license was established.
  Both seats rejected (c) as target arithmetic and (d) as a criterion that
  implies removing defensible entries. The number and the full rationale are
  recorded at step 2.1; the binding sequencing condition — notice on a
  distributed surface, packaged outputs verified, THEN the entry removed — is
  recorded and was executed in that order at step 2.2.
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

- **Status:** resolved 2026-08-30 — the license is **MIT**, read from the
  upstream repository's own `LICENSE` via the GitHub API rather than guessed,
  and branch **(a)** was executed: the entry is in `provenance/borrows.jsonl`,
  `lint_provenance` passes, both in-file comments are de-named, and
  `src/scripts/cost/*` is out of `skip_paths`. `code-provenance`'s rule that an
  unknown license is never permissive-by-default is what kept this open; the
  answer was one API call away and the previous session was right not to guess
  it. Detail, including the live packaging gap this uncovered, is at step 2.2.
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
<!-- risk-review: v1 | reviewed: 2026-08-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The atomic cutover gets split across PRs | implementation | Steps 1.3 and 1.4 land in different changes, leaving the gate either failing every run for want of a key or silently degraded to warn mode — the exact failure the predecessor was written about. | Phase 1's own preamble states it, the maintainer recipe states it, and 1.4's verify asserts the keyless run exits 3 rather than 0, so a half-cutover is observable rather than quiet. | Phase 1 — The atomic digest cutover |
| 2 | The ratchet expiry passes unnoticed | implementation | The shape-debt baseline goes stale before anyone lowers it, and the gate then reports a stale entry instead of a real count. | **UPDATED 2026-08-30: the date moved with the lowering.** Phase 3 closed by reducing 243 → 148, which reset `landed` to 2026-08-30 and the expiry to **2026-10-25**. `review_by` is 2026-10-20 — before the expiry rather than after it, which the previous pairing (2026-10-24 against a 2026-10-24 expiry, then one day after) did not guarantee. The baseline's own note still names the expiry and this roadmap as its owner. | Phase 3 — The ratchet expiry, which has a date |
| 3 | This roadmap becomes the parking lot | product | A carry-forward roadmap whose every item is maintainer-gated is the shape that sits untouched for a year, which is the specific objection both council seats raised against disposition D3(a). | Each blocker names the exact command or decision, an accountable owner, and a falsifiable Resolved-when; and one item — Phase 3 — had a hard date rather than a condition, so at least one thing here could not be deferred silently. **RE-REVIEWED 2026-08-30 and the mitigation is SPENT: Phase 3 is closed, so every remaining item is maintainer-condition-gated in a `later/` file that the dashboard and `/roadmap:process-*` both exclude.** What replaces it is weaker and is named rather than implied: the roadmap's own resume condition (`SOURCE_DENY_KEY` provisioned) plus the shape-block baseline's 2026-10-25 expiry, which fails on its own and points here. `review_by` is moved to 2026-10-20 so this file is looked at BEFORE that expiry rather than one day after it. | Blockers |
| 4 | 2.2 is resolved by guessing the license | product | The fastest way to close 2.2 is to assume permissive and strip the notice, which is the guess `code-provenance` forbids and the reason the predecessor left it open. | The blocker's option set is written as a license-conditional fork, so "which license" has to be answered before either branch is reachable. | Phase 2 — The two decisions the council could not settle |

## Acceptance Criteria

- [ ] AC-1 — The tracked config holds no readable source name: every
      `deny_digests` entry is a 64-hex digest, no `deny` array is present, and
      the gate still exits 1 on a seeded fixture violation in CI.
- [ ] AC-2 — A keyless run is loud, never green: with the key unset the gate
      exits **3** under the strict flag, and a CI step asserts key presence
      before the gate step runs.
- [x] AC-3 — `skip_paths` has a recorded target it meets, and the entry is
      shrink-only, so the next drift fails rather than accumulating.
      MET by 2.1 and 2.2, and this line IS the predecessor's AC-6 restated
      against the settled number, which is what 2.1's `verify:` asks for.
      **The target is 21**, decided by the AI council on 2026-08-30 with 2/2
      seats present after an earlier 1–1 split; `check_suppression_hygiene`
      reports `21 entry(ies) (22 at base, 1 removed)`. The entry is shrink-only
      by that gate's own construction — a base of 22 with one removed is a
      ratchet reading, and a 22nd entry would fail it rather than accumulate.
      Each of the 21 survivors is individually justified in
      `agents/evidence/reports/source-skip-paths-ledger.md` with a MEASURED
      suppressed-hit count, and unskipped deny hits are 0.
- [x] AC-4 — `check_no_external_sources:shape-block` carries a `landed` date
      within its 56-day window, reached by a reduction or by a `reaffirmed`
      block that states a real reason.
      MET by 3.1, and by a REDUCTION rather than a reaffirm: 243 → **148**,
      `landed: 2026-08-30`, expiry 2026-10-25. The 95 removed findings were each
      read and are each a false positive of a class that flagged the presence of
      a `**Source:**` header rather than a leaked name; the delta was recounted
      full-tree and added zero. What remains — 127 speaking inbox-directory names
      and 21 repository slugs — is real debt with a named paydown mechanism
      (ADR-250 in-place redaction) that this change did not attempt.

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
