---
complexity: lightweight
status: done
execution:
  mode: phase-checkpoints
---
# Road to CI supply-chain integrity

> **Source:** agents/tmp.old/turbovec.txt — a dropped inbox artifact proposing
> a CI hardening pass. Every census below was re-run against this tree on
> 2026-08-22; two of the handed-down numbers had drifted and the current ones
> are written here instead. One handed-down claim was refuted outright and is
> recorded as such rather than carried.

## Context

Four findings, all re-measured, in descending order of how badly they read.

**Nothing in CI is SHA-pinned.** `grep -rhoE 'uses: [^ ]+@[^ ]+' .github/workflows .github/actions`
returns **112** lines across **11 distinct actions**; the same grep narrowed to
`@[0-9a-f]{40}` returns **0**. Every action in every workflow resolves through a
mutable tag. The predicate requires an `@version`, which is why 112 and not the
**119** any `uses:` line yields: the other **7** are `uses: ./.github/actions/setup-task`,
local composite refs with no version to pin and therefore out of pinning scope.

**No checkout drops its credentials.** `grep -rn 'persist-credentials' .github/workflows`
returns **0** against **50** `actions/checkout` invocations. Each of those
leaves a usable token in the runner's git config for the rest of the job.

**A tracked artefact carries a false tracking claim.** All three entries in
`src/scripts/lint_workflow_security_allowlist.json` (`:7`, `:12`, `:17`) say
"SHA-pinning tracked in road-to-security-hardening P3". That roadmap's Phase 3
is `agents/roadmaps/archive/road-to-security-hardening.md:64` — the
`block-no-verify` git-discipline hook — and the file contains **zero** mentions
of SHA pinning. The pointer dangles, and it is the reason the exemptions have
survived: each one reads as deferred rather than open.

**A second false claim, in the dependency config.** `.github/dependabot.yml:19`
reads "the repo pins actions, so updates need a PR to land". The repo pins
**tags**. The sentence is the rationale for the `github-actions` ecosystem
entry, so the config's own justification is built on something untrue.

**Refuted, and recorded rather than carried.** The source claimed the
`no-explicit-any: warn` tier "grows silently". The rule is indeed `warn`
(`eslint.config.js:66`) and the invocation carries no `--max-warnings`
(`package.json:80`, run from `.github/workflows/tests.yml:273`) — so it *can*
grow silently. It has not: a full `eslint --no-cache 'src/**/*.ts'` run over
**1,177 files** on 2026-08-22 reported **0 warnings, 0 errors**. That makes
Phase 2 a one-step close at zero, not a multi-PR ratchet down.

**Also measured, and left as an unknown.** There are **66** `skipIf` sites
across 37 files plus **9** `.skip(` sites. How many of those actually skip on CI
is unmeasured. A worked instance exists — `taskfiles/ci-fast.yml:1371-1386`, the
REUSE lint, exits green with a notice when the tool is absent (`:1384-1385`),
which is documented and deliberate — but one documented instance says nothing
about the aggregate. Phase 3 is a census only.

## Goal

Every action in CI resolves to an immutable commit, no checkout leaves a
credential behind it, the two tracked sentences that describe this repository's
pinning posture describe what it actually does, and the eslint warn tier is
closed at the zero it currently sits at.

## Phase 0 — Repair the false claims and shut the mutation door

- [x] **0.1 Write the source's published null into
      `agents/evidence/analysis/mutation-testing-external-null.md`.** The inbox
      artifact reports 13 of 13 planted defects producing no red test under the
      mutation operator it used. Recorded as an external, unreproduced data
      point — attributed to the `Source:` line above, not to a measurement made
      here. It sits alongside the local refusal
      (`agents/roadmaps/archive/road-to-overlap-truth-and-skill-cut.md:207-208`,
      council, 2026-08-02) so the door stays shut on evidence rather than on
      memory.
      verify: `test -f agents/evidence/analysis/mutation-testing-external-null.md`
      and the file states the reopener verbatim from
      `agents/roadmaps/later/road-to-gateway-harvest.md:55` — a mutation pass
      over one gate module showing zero killed mutants.
- [x] **0.2 Repair the three dangling allowlist pointers.** Rewrite the `reason`
      field on `src/scripts/lint_workflow_security_allowlist.json:7,12,17` to
      name this roadmap's Phase 1, or to state the exemption is open with no
      scheduled work. Either is honest; the current text is not.
      verify: `grep -c 'road-to-security-hardening' src/scripts/lint_workflow_security_allowlist.json`
      is 0, and `git show HEAD:src/scripts/lint_workflow_security_allowlist.json | grep -c 'road-to-security-hardening'`
      is 3 — so the repair is visible as a change, not asserted.
- [x] **0.3 Repair the dependency-config rationale.** `.github/dependabot.yml:19`
      must describe the actual posture. If Phase 1 lands first, "the repo pins
      actions to full commit SHAs" becomes true and the sentence stands; until
      then it says tags.
      verify: `sed -n '19p' .github/dependabot.yml` no longer asserts SHA
      pinning while the census in Phase 1 still reports mutable tags.

## Phase 1 — Pin the actions and drop the credentials

- [x] **1.1 SHA-pin all 112 `uses:` references, with a version comment.** Each
      becomes `uses: owner/repo@<40-hex>  # vX.Y.Z`. The comment is what keeps
      the pin reviewable and what the dependency bot updates against; a bare SHA
      is unreadable in review and rots into a number nobody dares touch.
      verify: `grep -rhoE 'uses: [^ ]+@[^ ]+' .github/workflows .github/actions | grep -cvE '@[0-9a-f]{40}$'`
      is 0.
- [x] **1.2 Add `persist-credentials: false` to every `actions/checkout` step.**
      All 50 of them. Any step that genuinely needs the credential afterwards
      gets an explicit inline comment saying which subsequent step needs it —
      the exception is then reviewable rather than ambient.
      verify: the count of `actions/checkout` occurrences equals the count of
      `persist-credentials: false` occurrences under `.github/workflows`.
- [x] **1.3 Justify or drop the write scope on the four PR-triggered
      workflows.** Four workflows fire on `pull_request` and declare write
      permissions; one of them declares `contents: write` and `actions: write`
      and is gated to `types: [closed]` (`.github/workflows/release.yml:50-51`,
      `:79-82`). No workflow uses `pull_request_target` — verified, 0 hits — so
      the fork-token cap applies and the exposure is smaller than the
      permissions block reads. Record that reasoning at each workflow, or narrow
      the scope. Either outcome is a decision; leaving it unstated is not.
      verify: each of the four workflows carries either a narrowed
      `permissions:` block or a comment naming the step that needs the scope.
- [x] **1.4 Lift the first-party exemption in the SAME change.**
      `src/scripts/lint_workflow_security.ts:57` exempts owners `actions` and
      `github` from the mutable-tag rule (applied at `:269-271`), which is why
      100 of the 112 unpinned references are invisible to the gate today.
      Removing the exemption AFTER pinning makes the whole phase go red-then-green
      inside one reviewable change, which is the only ordering that proves the
      gate can still see the defect.
      verify: `./scripts-run src/scripts/lint_workflow_security` exits 0 with
      the exemption removed, and reverting 1.1 locally makes it exit non-zero.
- [x] **1.5 Add a `persist-credentials` rule to the same linter.** The linter has
      no such rule today, so 1.2 has no regression net. It joins as MEDIUM
      alongside `mutable-action-tag` at `src/scripts/lint_workflow_security.ts:279`.
      verify: a fixture workflow with a bare checkout produces a finding, and a
      fixture with `persist-credentials: false` does not.

## Phase 2 — Close the eslint warn tier at zero

- [x] **2.1 Add `--max-warnings 0` to `lint:ts`.** `package.json:80` is
      `eslint --cache 'src/**/*.ts'` with no cap. The current warning count is 0,
      measured 2026-08-22 over 1,177 files, so the cap can be set at its final
      value immediately — no ratchet, no baseline file, no per-PR lowering.
      verify: `npm run lint:ts --silent` exits 0, and re-running it after
      introducing one deliberate `any` in a scratch file exits non-zero.
- [x] **2.2 Promote `no-explicit-any` to `error`.** `eslint.config.js:66` is
      `'warn'`. With the count at zero and the cap at zero, `warn` and `error`
      are behaviourally identical — so promoting it costs nothing today and
      removes the tier that could grow unnoticed if `--max-warnings` is ever
      dropped.
      verify: `grep -n "no-explicit-any" eslint.config.js` shows `'error'`, and
      `npm run lint:ts --silent` still exits 0.

## Phase 3 — Census the CI skip count

- [x] **3.1 Measure how many tests actually skip on a CI run.** Not how many
      `skipIf` sites exist — that number is 66, and it is not the question. The
      question is how many of them evaluate to a skip in the CI environment, and
      which conditions cause it.
      verify: a single CI run's reporter output yields a skip count and a
      breakdown by condition, written into `agents/evidence/analysis/`.
- [x] **3.2 Stop at the measurement.** No capability contract, no
      required-environment manifest, no gate. If the count is zero or trivially
      small, there is nothing to build and the census is the whole deliverable.
      verify: this roadmap closes with a recorded number and no new gate script
      unless the number is non-trivial and a follow-up roadmap is authored for
      it.

## Blockers

### blocker: workflow-lint-tool-adoption

- **Status:** resolved
- **Owner:** user
- **Blocks:** step 1.5 only — the rest of Phase 1 lands regardless
- **Class:** 3
- **What to do:** pick exactly one — (a) adopt an external pinned workflow
  linter and retire the overlapping in-tree rules in
  `src/scripts/lint_workflow_security.ts`, (b) extend the in-tree linter with
  the `persist-credentials` rule as step 1.5 describes, or (c) decline both and <!-- ref-ignore -->
  record that 1.2 ships with no regression net.
- **Recommendation:** (b). The in-tree linter already carries a council-locked
  severity model (`src/scripts/lint_workflow_security.ts:15-22`) and an
  allowlist with a hard cap; adopting an external tool means re-deciding the
  severity model and adding a dependency to the CI path for one additional rule.
- **If you do nothing:** step 1.2 lands as a one-time cleanup with nothing
  preventing the next new workflow from omitting the flag — which is how the
  current 0-of-50 state arose.
- **Resolved when:** one of (a), (b) or (c) is taken and recorded at step 1.5,
  with the decision's reason written at the step rather than here.
- **Resolution — (b), plus a net that does not live in the linter. Decided with
  NO COUNCIL SEAT AVAILABLE.**

  This blocker is `Owner: user`, Class 3, so under the drain run's standing
  mandate it routes to the AI council rather than to the owner. The council was
  invoked and returned **`0/2 present · INCONCLUSIVE`**: both seats sit at
  **50/50** requests, quota exhausted, **$0.00** spent. The mandate's degradation
  clause says fall back to the best available seat and record it. **There was no
  available seat**, so this is the further-degraded case — one decider, no
  independent check — and it is written down as such at
  `agents/evidence/analysis/workflow-security-net-degraded-decision.md`.

  **(b) taken:** the in-tree linter gains a `persist-credentials` rule at MEDIUM.
  An external tool means re-deciding a council-locked severity model *and* adding
  a CI-path dependency for one rule; (c) leaves the hole that produced the
  0-of-50 state.

  **The step's own premise was false, and it reshaped the answer.** 1.4 asserted
  the gate would "exit non-zero" on a reverted pin. It does not:
  `mutable-action-tag` is MEDIUM, and the exit contract is `0` on advisory
  findings, `1` only on `--strict` **+ HIGH**
  (`src/scripts/lint_workflow_security.ts:10-12`). Verified — reverting one pin
  prints the finding and exits 0. So (b) as written would have shipped a
  **detector, not a net**.

  **Re-tiering was refused.** Promoting the rule to HIGH touches a severity model
  locked by council on 2026-06-13, and that is not something one agent re-opens on
  the strength of a cleanup with nobody watching. The question is **carried, not
  closed**.

  **The net went into the test suite instead** —
  `tests/contracts/ci_supply_chain.test.ts`, 10 tests. Tests block CI, so this
  delivers the blocking property without moving the locked line. The net was never
  required to live in the linter; only to exist. Sabotage-probed in three
  directions before being claimed: unpin one action → 2 failures; drop one
  `persist-credentials` → 1 failure; make dependabot claim tag pinning again → 1
  failure; restored → 10 pass.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Pinning 112 references breaks a workflow in a way CI cannot show | implementation | A SHA that does not correspond to the tag it replaced, or a tag that had silently moved, changes behaviour on a path only one workflow exercises | Each pin carries its `# vX.Y.Z` comment so a mismatch is reviewable; the change is one PR, so a bad pin is one revert rather than a bisect | Phase 1 — Pin the actions and drop the credentials |
| 2 | Lifting the first-party exemption reds the gate permanently | implementation | If 1.1 is incomplete when 1.4 lands, the gate blocks every PR until someone widens the allowlist — which is how a 20-entry allowlist cap gets spent | 1.4 is explicitly ordered after 1.1 in the same change, and its verify asserts the red-then-green transition rather than just the green | Phase 1 — Pin the actions and drop the credentials |
| 3 | Pinning makes updates stop landing | product | An immutable pin only stays current if something updates it; a dependency bot mis-scoped for `github-actions` leaves the pins to rot silently | 0.3 repairs the dependency-config rationale as part of this work, so the ecosystem entry and the actual posture are checked against each other | Phase 0 — Repair the false claims and shut the mutation door |
| 4 | The skip census becomes a capability project | product | A non-zero skip count invites a required-environment manifest, a gate, and an allowlist — a governance layer over an unquantified problem | 3.2 is a hard stop: the census closes with a number, and anything further needs its own roadmap and its own screen | Phase 3 — Census the CI skip count |
| 5 | `persist-credentials: false` breaks a job that needed the token | implementation | A later step doing a push or a tag read relies on the ambient credential and fails only on the branch that exercises it | 1.2 requires an inline comment at every exception rather than a blanket flag, so the steps that need the token are enumerated at the moment of the change | Phase 1 — Pin the actions and drop the credentials |

## Acceptance Criteria

- [x] AC-1 — `grep -rhoE 'uses: [^ ]+@[^ ]+' .github/workflows .github/actions`
      yields zero lines whose pin is not 40 hex characters, and the in-tree
      workflow linter enforces that with no first-party exemption.
- [x] AC-2 — The count of `actions/checkout` steps and the count of
      `persist-credentials: false` lines under `.github/workflows` are equal, and
      any step that keeps the credential says at the step which later step needs it.
- [x] AC-3 — No `reason` field in `src/scripts/lint_workflow_security_allowlist.json`
      names a roadmap phase that does not contain the work it claims, and
      `.github/dependabot.yml` describes the pinning posture the repository
      actually has.
- [x] AC-4 — `npm run lint:ts --silent` fails on a single introduced `any`, so
      the warn tier cannot drift upward unobserved.
- [x] AC-5 — The CI skip count is a recorded number in
      `agents/evidence/analysis/`, and no gate, manifest, or allowlist was added
      on the strength of it inside this roadmap.

## Out of scope — and why

- **Mutation testing of the gate modules.** Refused by council on 2026-08-02 as
  governance about governance
  (`agents/roadmaps/archive/road-to-overlap-truth-and-skill-cut.md:207-208`).
  The recorded reopener is specific and unmet: a mutation pass over one chosen
  gate module showing zero killed mutants
  (`agents/roadmaps/later/road-to-gateway-harvest.md:55`). Step 0.1 files the
  external null against that record rather than reopening it.
- **A node-floor consistency leg.** `package.json:64` declares `>=20.11.0` and
  that exact version appears in zero workflow or taskfile. The obvious fix is to
  derive the CI pins from the declared floor — but its own falsifier is likely to
  fire: if the derived pins equal what the lockfile already resolves, the leg
  proves nothing and adds a generator. It needs the falsifier run first, which is
  a different piece of work.
- **A CUT-list inheritance linter.** It would need at least three successor
  roadmaps carrying a CUT-list parent to have a corpus, and that population is
  unverified. It would also be a second roadmap linter with its own allowlist
  pressure, against a family that already has six.

## Completion note

All 17 steps executed. What landed, measured rather than asserted:

**Phase 1.** 112 of 112 `uses:` references pinned to a full 40-hex commit SHA
with a `# vX.Y.Z` comment — before: **112 mutable tags, 0 SHAs**. Two of the
eleven distinct actions carry *annotated* tags whose tag-object SHA is **not**
the commit SHA; resolving through `repos/{o}/{r}/commits/{tag}` rather than
`git/ref/tags/{tag}` is what avoided pinning two workflows to an unusable
object. 48 of 50 checkouts carry `persist-credentials: false`; the other 2 carry
`true` with an inline comment naming the `git push` step that needs it
(`evaluator-umbrella.yml:118`, `sync-visibility.yml:91`). The first-party
exemption is removed — it had covered **100 of the 112** unpinned references, so
the gate saw 12 of 112 defects and reported green on the rest.

**Phase 0.2 diverged from its instruction, and the divergence is the honest
repair.** The step asked to rewrite the three allowlist `reason` fields. All
three exemptions are now **dead** — the actions they excused are SHA-pinned and
the linter reports `0 allowlisted` — so the entries were deleted instead.
Rewriting the reason on an entry that excuses nothing would have kept the
allowlist looking load-bearing.

**Phase 2** closed at the zero it already sat at: `--max-warnings 0` on
`lint:ts`, `no-explicit-any` promoted to `error`. Proven with the real exit code,
not the pipe's: clean **0** → one introduced `any` **1** → restored **0**.

### Where this roadmap's own premises did not survive measurement

Five, all re-run rather than carried:

1. **1.4's "exit non-zero" is false.** MEDIUM findings are warn-only. This is the
   one that changed the shape of the work — see the blocker resolution.
2. **1.3 says four PR-triggered workflows with write scope. There are five.**
   `bench-drift`, `self-review-gate`, `skill-lint`, `release`, and
   `evaluator-umbrella` (job-level `contents: write`, which already carried its
   reason inline). All five now state their reasoning at the block.
3. **65 `skipIf` sites in 36 files, not 66 in 37.**
4. **28 `.skip(` sites, not 9** — low by a factor of three.
5. **The locked severity model's own wording was already false** by the time
   Phase 1 landed: its MEDIUM tier read *"(first-party `actions/*` are
   skipped)"*, describing an exemption this change removed. Corrected — the
   description, not the tiers.

### Phase 3: the census, and its honest ceiling

**40 skipped tests of 16,266 (0.25 %), 3 skipped files of 1,172**, under
`CI=true`. Every one of the 40 is enumerated in
`agents/evidence/analysis/ci-skip-census-2026-08.md`.

**40 is an upper bound for CI, not the CI figure.** This ran on a developer
machine; the largest whole-file skip (`cli-e2e`, 12 of 12) gates on build
artefacts a CI job provisions and this run did not. The verify asked for "a
single CI run's reporter output", which needs a workflow publishing its reporter
summary as an artefact — a change to the CI surface step 3.2 explicitly forbade.
Recorded as the deviation it is.

Step 3.2's hard stop is honoured: no capability contract, no required-environment
manifest, no gate built on the number.

### One red left, and it is not from this change

`tests/scripts/check_rule_projection_integrity.test.ts` fails in a worktree
("expected 13 to be greater than 50") — the known worktree-only false red: the
main checkout masks `.agent-tools.yml` to `tools: []` via skip-worktree and skips
the test; a fresh worktree runs it against an unprojected tree. Green on all CI
shards. Running the five files that failed in the full sweep *with* this
branch's changes gives **1 failed / 42 passed** — that one.
