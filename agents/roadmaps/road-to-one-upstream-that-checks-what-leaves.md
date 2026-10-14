---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
depends:
  - road-to-one-detector-and-the-senders-we-own
estate_offset_exempt: "Round inbox-2026-10-o reproduced at 2bc5715c7 that the self-repair privacy floor scans only record text while the release pushes a whole branch (self_repair.ts:236-238 vs self_repair_cli.ts:291, :317), that the same mechanism from two projects gets two fingerprints (executed: 15b30f56 vs ec8a7aee), that an upstream PR is not opened as a draft (self_repair_cli.ts:324), and that a consumer install always degrades to an issue (findAgentConfigCheckout returns null outside an agent-config checkout). No active, later or stub roadmap owns the egress ladder or /upstream-contribute; road-to-one-detector-and-the-senders-we-own owns the detector table this file consumes, not the ladder. Archiving or parking costs more because Phase 1 is executable now and fixes three documents that send contributors to paths that do not exist; merging into the detector roadmap would put a ladder rebuild behind a scanner."
relates:
  - slug: road-to-one-detector-and-the-senders-we-own
    relation: depends
    note: "Phase 2 here consumes its detector table for outgoing bytes; no second scanner is built. Phase 1 does not wait on it."
  - slug: road-to-a-retro-the-merge-runs
    relation: extends
    note: "Added in the same change. Produces the package records Phase 5 here may offer; nothing in that file sends anything."
  - slug: road-to-self-modification-that-a-council-must-pass
    relation: disjoint
    note: "Its Phase 2.1 builds a content-digest binding (`subjectDigest`) beside the digest approval in `self_repair_class_b.ts`; step 4.1 here reuses one of the two and records why."
  - slug: road-to-surface-consolidation
    relation: extends
    note: "later/. Its `/memory` table names `learn-low-impact`; step 1.3 here retires that command's `--apply` and updates the row."
  - slug: road-to-org-telemetry-sink
    relation: disjoint
    note: "stubs/. An optional organisation-level intermediate stage; not reactivated here."
---
# Road to one upstream that checks what leaves

> **Source:** `agents/tmp.old/inbox-2026-10-o/` — the same round as
> `road-to-a-retro-the-merge-runs`; the owner asked that a learning which would
> improve this package may optionally become a neutral pull request against it,
> "without telling agent-config too much about the project". Every reading below
> was taken at `main@2bc5715c7` on 2026-10-12.

## Goal

There is **one** way for a finding to leave a machine and become a pull request
or issue against this package, and it checks every byte that leaves — branch
name, commit identity, commit message, diff, title and body — not only the
record's text. A consumer project can reach a pull request, not only an issue;
the pull request is a draft; the same mechanism found in two projects clusters
under one fingerprint; and the person approves the exact bytes that will be sent.
Nothing is sent without the person's word in that turn.

## Prerequisites

- `road-to-one-detector-and-the-senders-we-own` Phase 2 (its detector table) for
  Phase 2 here. Phase 1 has no prerequisite.

## Context — read at `main@2bc5715c7`

| # | Defect | Evidence |
|---|---|---|
| F1 | **Two upstream ways with different guarantees, and a third that writes nowhere.** `self-repair:release` has the push → fork-PR → issue ladder, a privacy floor and a deny list (`src/scripts/self_repair_cli.ts:337-398`). `/upstream-contribute` has a consent gate and a checkbox "No project-specific references" (`src/domains/meta/upstream-contribute/command.md:58`) and runs no check. `/memory learn-low-impact --apply` names `.agent-src.uncondensed/data/low-impact-decisions-seed.md` (`src/domains/meta/memory/learn-low-impact/command.md:25`, `:61`, `:105`), which does not exist; the always-loaded rule `low-impact-corpus-privacy-floor` names `data/low-impact-decisions-seed.md` as a locked target, which does not exist either. |
| F2 | **The floor does not check what leaves the device.** `egressBlockedReason` scans `suggested_surface` and `evidence` (`src/scripts/_lib/self_repair.ts:236-238`); the PR path then pushes the branch (`self_repair_cli.ts:291`, fork `:317`) — diff, commit messages and branch name leave unscanned, and the commit author e-mail comes from the local git configuration, often a company domain. |
| F3 | **A consumer has no pull-request route.** `findAgentConfigCheckout` finds only an environment variable or this repository as cwd (`self_repair_cli.ts:103-115`); `AGENT_CONFIG_SOURCE` is documented nowhere under `src/`, `docs/` or `README.md`. *(executed)* from a consumer directory it returns `null`, so the ladder always degrades to an issue. |
| F4 | **Upstream pull requests are not drafts.** `prArgs` carries no `--draft` (`self_repair_cli.ts:324`). |
| F5 | **The fingerprint hashes project evidence.** `fingerprint` = class + normalised evidence (`self_repair.ts:663-671`). *(executed)* one mechanism described with two project names → `15b30f56…` and `ec8a7aee…`, so the clustering the issue template promises (`.github/ISSUE_TEMPLATE/self_repair_report.yml:4-5`) cannot happen across installations. |
| F6 | **A digest-bound approval exists and nothing uses it.** `self_repair_class_b.ts` binds an approval to a hash of the exact bytes read (`:9-16`, `:57-68`); its only importer is its own test (7/7 green). |
| F7 | **`/upstream-contribute` points at paths that do not exist.** It asks for a hand-written 40–60 % condensed copy (`src/skills/upstream-contribute/SKILL.md:198`, `command.md:115`) although ADR-201 copies `.md` verbatim, names `.augment/` targets (`SKILL.md:124-127`), `scripts/condense.sh` (`command.md:132`; the script is `src/scripts/condense.sh`), `composer update` (`:178`) and `git add .` (`:161`). |
| F8 | **The pipeline document describes a loop that is not there.** `docs/guidelines/agent-infra/self-improvement-pipeline.md:39` writes to `agents/learnings/`, which does not exist; `:109` names `event4u/agent-config` where the ladder targets `event4u-app/agent-config` (`self_repair_cli.ts:57`). |

## Phase 1 — Repair what sends people to nowhere (executable now)

- [x] **1.1 `/upstream-contribute` becomes a thin front on the ladder (D1).** Its
      command and skill drop the condensed-copy step, the `.augment/` targets, the
      wrong `condense.sh` path, `composer update` and `git add .`, and hand the
      finding to `self-repair:release --dry-run`. The command name stays as a
      public contract.
      verify: `grep -c 'self-repair:release' src/domains/meta/upstream-contribute/command.md` -> /[1-9]/
- [x] **1.2 The pipeline document matches the tree.** `agents/learnings/` and the
      wrong organisation are replaced by the sidecar and `event4u-app`.
      The sibling-search over the exact construct `agents/learnings/` found
      **4 sites in 4 files** — the pipeline document plus
      `src/agent-src/templates/agents/proposal.example.md`,
      `src/skills/learning-to-rule-or-skill/SKILL.md` and
      `src/skills/context-authoring/SKILL.md`; all four are closed, 0 remain.
      Two further dangling paths in the same document were repaired with it:
      `scripts/check_proposal.ts` (the verb is `./agent-config proposal:check`)
      and the installed-tree prohibition, which named only the legacy
      `.agent-src.uncondensed/`.
      verify: `grep -c 'agents/learnings/' docs/guidelines/agent-infra/self-improvement-pipeline.md` -> /^0$/
- [x] **1.3 The third way is retired (D2).** `learn-low-impact --apply` is
      removed with its documentation, the rule's locked-target line names the
      corpus that exists, and the `/memory` row in
      `later/road-to-surface-consolidation` is updated. Callers now read the
      seed literal from one place — `PACKAGE_SEED_PATH` in
      `src/scripts/ai_council/learn_low_impact_preview.ts` — which states that
      the file is deliberately absent, so the preview diffs against an empty
      baseline rather than against a path nobody can open. **Corrected
      2026-10-14 after an independent review:** an earlier wording here said
      the literal lives in exactly one place, and it does not. The privacy
      floor names the same path twice, in its trigger block and in its locked
      targets, and the pinning test names it once more. Those are a lock and
      an assertion, not second sources — a rule has to name what it locks —
      but "one place" was a false claim and is replaced by the true one. The
      rule keeps the seed's `path_prefix` trigger: a seed reappearing then
      arrives already under the floor instead of beneath it.
      verify: `grep -c 'low-impact-decisions-seed' src/domains/meta/memory/learn-low-impact/command.md` -> /^0$/
- [ ] **1.4 The four threshold sites cite one table.** Each points at the
      canonical evidence-threshold table in `docs/contracts/retro-v1.md`
      instead of restating its own.
      **Open for a named reason, re-executed 2026-10-14:**
      `docs/contracts/retro-v1.md` still does not exist, and
      `road-to-a-retro-the-merge-runs` now measures **35 open, 0 closed** —
      the count rose since 2026-10-13 rather than falling, so the contract is
      further away, not nearer. Writing the citation would create exactly the
      dangling reference AC-1 forbids — this step would break the acceptance
      criterion the rest of Phase 1 was closed to satisfy. It opens when that
      contract lands.
      verify: `grep -c 'retro-v1.md' src/skills/upstream-contribute/SKILL.md` -> /[1-9]/

## Phase 2 — A floor over the whole payload

> **Phase state, executed against the tree on 2026-10-14 rather than read off a
> marker.** The prerequisite named under § Prerequisites is
> `road-to-one-detector-and-the-senders-we-own` Phase 2, and that roadmap
> measures **24 open, 0 closed** — its detector table does not exist. K5 of this
> file forbids building a second scanner, so 2.2 has nothing to scan against.
>
> The sharper finding is about 2.1 and 2.3, and it was not visible from the
> step text: **the release makes no commit at all.** `executeRelease`
> (`src/scripts/self_repair_cli.ts:369`) READS the checkout's current branch
> and refuses when it is `main` or detached; the fix is authored and committed
> before the release is ever called. A grep for `isolated`, `ephemeral`,
> `mktemp` and `tmpdir` across that file returns **zero** matches. So 2.1 is a
> build — an isolated checkout, a synthesised commit, an object-graph walk —
> not a widening of something present, and 2.3 ("the commit uses a noreply
> identity") has no commit to set an identity on until 2.1 creates one. Both
> are correctly sequenced behind it; neither is blocked on the detector table,
> and that distinction is worth keeping for whoever takes this next.

- [ ] **2.1 The release builds a clean patch first.** In an isolated checkout of
      this package, one commit on the package base; the gate walks every object
      reachable from it that is not on the base, plus branch name, commit
      identity, commit message, diff, title and body.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t release-scans-whole-object-graph --reporter=verbose` -> /✓.*release-scans-whole-object-graph/
- [ ] **2.2 Against the detector table and the consumer's own identifiers.** The
      scan uses the detector table of `road-to-one-detector-and-the-senders-we-own`
      and adds the consumer's identifiers from `_detect_project_identifiers`
      (`src/scripts/check_portability.ts:109`, `:230`) as a deny list. A finding
      refuses; the floor never rewrites.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t consumer-identifier-in-diff-refuses --reporter=verbose` -> /✓.*consumer-identifier-in-diff-refuses/
- [ ] **2.3 Identity.** The commit uses a noreply identity; a configured identity
      with a company domain is never used.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t company-identity-is-never-committed --reporter=verbose` -> /✓.*company-identity-is-never-committed/

## Phase 3 — Synthesised, clustered, drafted

- [ ] **3.1 Synthesised, not redacted.** The upstream payload is built from
      closed fields only — `target`, `defect_class`, `principle`, `mechanism`,
      `falsifier`, a synthetic package fixture — with no transcript text, no
      local key and no free-text project context.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t payload-has-only-closed-fields --reporter=verbose` -> /✓.*payload-has-only-closed-fields/
- [ ] **3.2 A mechanism fingerprint.** For records carrying `target` and
      `principle`, the fingerprint hashes those instead of the evidence, so the
      F5 pair clusters.
      **Open for a named reason, executed 2026-10-14:** `DefectFinding` carries
      `target?: string[]` (`src/scripts/_lib/self_repair.ts:112`) but the
      string `principle` appears **zero** times in that file. The field is the
      retro schema's, and that schema is step 0.3 of
      `road-to-a-retro-the-merge-runs` (35 open, 0 closed). Hashing `target`
      alone would cluster two different mechanisms found in the same file, so
      the half-built version is worse than the evidence hash it replaces.
      verify: `npx vitest run tests/scripts/self_repair.test.ts -t same-mechanism-same-fingerprint --reporter=verbose` -> /✓.*same-mechanism-same-fingerprint/
- [ ] **3.3 Draft, and a neutral branch.** `--draft` on every pull request; the
      branch is `retro/<fingerprint[:8]>`.
      **Half landed 2026-10-14, half sequenced.** F4 is closed: `prArgs` now
      carries `--draft` before `--title`, on **both** rungs of the ladder — the
      direct-push one and the fork one. The two share one `prArgs` array, so
      one flag does cover both — but the fork rung reaches it down a different
      path and appends its own `--head`, and a later split of that array would
      be invisible to a test that only drove the direct-push rung. Three cases in
      `tests/scripts/self_repair_release.test.ts` drive the real
      `executeRelease` through a scripted runner, and all three were watched
      red with the flag removed. One of them only became sensitive after that
      probe: written as an index comparison alone it passed with the flag
      ABSENT, because `indexOf` answers `-1` and `-1` is less than everything.
      The branch half stays open because the release does not NAME a branch —
      it reads the one already checked out (see the Phase 2 note above). It
      closes with 2.1, which is where the commit it would name is created.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t pr-is-draft --reporter=verbose` -> /✓.*pr-is-draft/

## Phase 4 — Approval of exact bytes, and a route from consumers

> **Phase state, executed 2026-10-14.** 4.1 and 4.3 both describe what the dry
> run SHOWS, and the bytes they would show — the synthesised commit, its
> identity, its branch — are 2.1's output. Until 2.1 exists the dry run has no
> payload to render, so an approval bound to its digest would bind to nothing.
>
> **4.2's matrix is the one open item here with no code prerequisite, and it is
> still not takeable by this lane.** It asks what a fork pull request exposes
> that an issue does not — visible account, fork and repository linkage, branch
> name, activity events, timestamps, notifications, retention, deletion — and
> those are facts about a live forge, not about this tree. Writing them from
> recollection is precisely the unverified structural claim the evidence
> discipline forbids, and the only way to observe them is to open a real fork
> pull request, which is the act the matrix exists to decide about. It needs a
> session with explicit permission to take that observation, and D5's current
> option (b) is what holds until then — consumers send issues.

- [ ] **4.1 The person approves what is sent.** `--dry-run` shows every byte;
      the release accepts only an approval bound to the digest of those bytes
      through `self_repair_class_b`, or through the self-modification roadmap's
      `subjectDigest` if that lands first — one primitive, the other's reason
      recorded in the step's commit.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t changed-bytes-void-approval --reporter=verbose` -> /✓.*changed-bytes-void-approval/
- [ ] **4.2 A consumer reaches an issue, not yet a pull request (D5).** From a
      consumer project the ladder stops at the issue step; a pull request is
      opened only from a checkout of this package, and `AGENT_CONFIG_SOURCE` is
      documented as that checkout's pointer. In the same step, a threat-model
      matrix under `agents/evidence/analysis/` compares issue, same-repository PR
      and fork PR across visible account, fork and repository linkage, branch
      name, activity events, timestamps, notifications, retention and deletion;
      if the fork PR adds no project linkage beyond the issue, D5 reopens toward
      an ephemeral-checkout pull request from consumers.
      verify: `ls agents/evidence/analysis/` -> /upstream-fork-pr-linkage/
- [ ] **4.3 The remaining identity is said out loud.** The dry run states which
      account will appear on the pull request (blocker below).
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t dry-run-names-the-account --reporter=verbose` -> /✓.*dry-run-names-the-account/

## Phase 5 — The retro may offer, never send

> **Phase state, executed 2026-10-14.** Both steps verify against
> `tests/scripts/retro.test.ts`, and both the test file and every `retro*`
> module under `src/scripts/` are absent — a glob for them matches nothing.
> `road-to-a-retro-the-merge-runs` measures **35 open, 0 closed**. There is no
> retro run to attach an offer to, so neither step is buildable here, and
> building a stub to attach one to would create the second outward route K1
> forbids.

- [ ] **5.1 At most one offer per run.** A retro run whose package record passes
      the canonical threshold appends one release offer to its output; sending
      still needs the person's word in that turn.
      verify: `npx vitest run tests/scripts/retro.test.ts -t at-most-one-upstream-offer --reporter=verbose` -> /✓.*at-most-one-upstream-offer/
- [ ] **5.2 A leak stops the offers.** Any egress or authorisation leak found
      after release turns offers off until the owner decides, and `/retro status`
      says so.
      verify: `npx vitest run tests/scripts/retro.test.ts -t leak-turns-offers-off --reporter=verbose` -> /✓.*leak-turns-offers-off/

## Blockers

### blocker: upstream-pr-shows-the-account
- **Status:** resolved — council 2026-10-12 (2/2: not owner-reserved; choice split, resolved by the privacy tie-break to option (b)); recorded as D5
- **Owner:** maintainer
- **Ownership:** reversible-technical — first filed as product-owned by the authoring agent; the council found it was not
- **Blocks:** (was) step 4.2 and Phase 5 — a pull request from a consumer always carries the GitHub account that opens it; Phases 1–3 and 4.1 are not blocked
- **Question:** Is it acceptable that every upstream pull request reveals the opening GitHub account, given that the payload carries nothing else about the project?
- **Recommendation:** (a). An account is the floor of any pull request on a public forge; the issue route reveals it too, a relay service would be a new external party holding every finding, and saying it out loud in the dry run is the honest form.
- **If you do nothing:** consumers keep the issue route only, which reveals the same account, and the owner's "neutral pull request" never exists.
- **What to do:** pick exactly one — (a) accept and state it in every dry run (step 4.3); or (b) issues only from consumers, pull requests only from a checkout of this package; or (c) commission a relay design as its own roadmap and keep 4.2 blocked until it lands.
- **Resolved when:** this entry's Status reads resolved and step 4.2 carries no blocked-by marker, or 4.2 is re-scoped to option (b). Resolved 2026-10-12: 4.2 re-scoped to (b) and measures whether (a) is safe.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | `/upstream-contribute` stays as a name and becomes a front on the ladder | Patching it alone keeps a second way alive; the name is a public contract | the ladder is renamed |
| D2 | reversible-technical | agent | `learn-low-impact --apply` is retired, not repaired | It writes into a file that does not exist; the corpus it meant has its own path | a seed corpus is shipped again |
| D3 | reversible-technical | agent | No organisation-level intermediate stage now | `stubs/road-to-org-telemetry-sink` is unscheduled, and creating a sink is an owner act | that stub is scheduled |
| D5 | reversible-technical | council:2026-10-12-upstream-account-visibility | Consumer projects send issues; pull requests come only from a checkout of this package, until 4.2's matrix shows a fork PR adds no project linkage over an issue; until then AC-5 reads as reached by the issue step, and its wording is corrected at the next risk review | Both seats (anthropic, openai): not owner-reserved — every send is an explicit per-turn act and the issue route already shows the account. Choice split: anthropic (a) with an escape hatch, openai (b) because a fork PR adds a durable fork relationship and event metadata an issue does not. Tie-break: on a privacy split the option revealing less wins until evidence; dissent recorded here | 4.2's matrix finds no linkage beyond the issue |
| D4 | reversible-technical | agent | No automatic upstream and no automerge of a retro pull request, in this repository either | `self-repair-loop` requires the person's word for the outward step | — |

## What this roadmap deliberately does not do

- **K1** No second egress way and no new upstream verb.
- **K2** No consumer code, diff or path in the payload; the schema has no field for it.
- **K3** No "scrubbing": what the floor refuses stays local.
- **K4** No transcript text and no local correlation key upstream, not even
  rephrased; a hashed repository key is guessable from a dictionary.
- **K5** No scanner of its own; the detector table is the dependency.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Company jargon without a literal identifier slips through | product | A term that names nothing but identifies the employer leaves in a principle field. | Closed fields only, the person sees every byte in the dry run, digest-bound approval. | Phase 3 — Synthesised, clustered, drafted |
| 2 | Upstream pull requests flood the maintainer | product | Many installations open the same finding. | Mechanism fingerprint clusters them; the existing creation cap of 20 per 24 h; one offer per run. | Phase 5 — The retro may offer, never send |
| 3 | The ephemeral checkout fails on a locked-down machine | implementation | No network or no git leaves the consumer without a route. | The ladder still degrades to an issue, which is today's behaviour. | Phase 4 — Approval of exact bytes, and a route from consumers |

## Acceptance Criteria

- [ ] **AC-1** No document in the tree sends a contributor to a path, script or
      file that does not exist.
- [ ] **AC-2** A release whose branch, identity, message or diff carries a
      consumer identifier is refused, with the finding named.
- [ ] **AC-3** The same mechanism from two projects produces one fingerprint.
- [ ] **AC-4** Every upstream pull request is a draft with a noreply identity,
      and changing one byte after approval voids the approval.
- [ ] **AC-5** A consumer install reaches the pull-request step of the ladder.
