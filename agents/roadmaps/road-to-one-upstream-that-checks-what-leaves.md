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
- [x] **1.4 The four threshold sites cite one table.** Each points at the
      canonical evidence-threshold table in `docs/contracts/retro-v1.md`
      instead of restating its own.
      **Done 2026-10-17:** the contract landed (retro step 0.4, census at
      current lines). The skill's principle and aggregate block, the command's
      checkbox, the pipeline gate and `MIN_CORROBORATIONS` now cite it; the
      skill and command no longer offer "clearly generalizable" as a route,
      which the table rejects. Two further restatements of that phrase sit in
      `learning-to-rule-or-skill` and `skill-improvement-pipeline`, where it
      filters *capture* rather than establishment — left as they are.
      verify: `grep -c 'retro-v1.md' src/skills/upstream-contribute/SKILL.md` -> /[1-9]/

## Phase 2 — A floor over the whole payload

> **Phase state, executed against the tree on 2026-10-14 rather than read off a
> marker.** The prerequisite named under § Prerequisites is
> `road-to-one-detector-and-the-senders-we-own` Phase 2, and that roadmap
> measures **24 open, 0 closed** — its detector table does not exist. K5 of this
> file forbids building a second scanner, so 2.2 has nothing to scan against.
> *(Superseded 2026-10-17: the table landed as `_lib/egress_rules.ts`, and 2.2
> scans with it.)*
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
> *(Superseded 2026-10-17: 2.1 and 2.3 are built — see D6.)*

- [x] **2.1 The release builds a clean patch first.** In an isolated checkout of
      this package, one commit on the package base; the gate walks every object
      reachable from it that is not on the base, plus branch name, commit
      identity, commit message, diff, title and body.
      **Done 2026-10-17 (D6):** the "isolated checkout" is a temporary index
      with no working tree — `read-tree` of `origin/main`, `apply --cached` of
      the author branch's net diff (`origin/main...<branch>`, binary, no
      textconv or external driver), `write-tree`, `commit-tree` — and the
      commit is pushed by sha onto `retro/<fp8>`. Nothing from the branch's
      history leaves: its name, its commits, content added and later removed.
      The floor walks `rev-list --objects <base>..<sha>`: each commit object
      raw, each tree and blob path, each blob whole. Tested against a real bare
      repository, not a scripted argv.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t release-scans-whole-object-graph --reporter=verbose` -> /✓.*release-scans-whole-object-graph/
- [x] **2.2 Against the detector table and the consumer's own identifiers.** The
      scan uses the detector table of `road-to-one-detector-and-the-senders-we-own`
      and adds the consumer's identifiers from `_detect_project_identifiers`
      (`src/scripts/check_portability.ts:109`, `:230`) as a deny list. A finding
      refuses; the floor never rewrites.
      **Done 2026-10-17, over the author's branch until 2.1 builds its own:**
      `_lib/self_repair_payload.ts` scans branch name, commit identities and
      messages, every commit's patch (`log -p --cc` over `origin/main..branch`,
      so content added and later removed is read, forced to text with no
      textconv or external driver), title and body; a finding or an unreadable
      range skips every push rung and degrades to the issue — unless it sits in
      the title or body, which the issue would carry too, so nothing is sent.
      Rule and part are named, never the value. Not read: commit signatures,
      and commits a stale or forked `origin/main` already holds; the dry run
      does not run the scan. The deny list drops the target
      repository's own tokens, so a release from this checkout is not refused
      on its own name. The detector table's identifier class is its step 2.3
      and still open, so a company e-mail whose domain is not a consumer
      identifier passes — 2.3 here closes that.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t consumer-identifier-in-diff-refuses --reporter=verbose` -> /✓.*consumer-identifier-in-diff-refuses/
- [x] **2.3 Identity.** The commit uses a noreply identity; a configured identity
      with a company domain is never used.
      **Done 2026-10-17:** `<id>+<login>@users.noreply.github.com` of the
      account `gh` is signed in as — already visible on the pull request — set
      for author and committer through the environment, which overrides any
      configured identity; dated in UTC so no timezone offset leaves; unsigned.
      The built commit object is read back and refused unless every identity
      line carries exactly that address. No resolvable identity → no push, the
      ladder starts at the issue.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t company-identity-is-never-committed --reporter=verbose` -> /✓.*company-identity-is-never-committed/

## Phase 3 — Synthesised, clustered, drafted

- [ ] **3.1 Synthesised, not redacted.** The upstream payload is built from
      closed fields only — `target`, `defect_class`, `principle`, `mechanism`,
      `falsifier`, a synthetic package fixture — with no transcript text, no
      local key and no free-text project context.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t payload-has-only-closed-fields --reporter=verbose` -> /✓.*payload-has-only-closed-fields/
      **Open for a named reason, re-measured 2026-10-17:** `principle` and
      `mechanism` are still on no record — `DefectFinding` carries neither, and
      the retro's `Candidate` carries `subject`, `falsifier` and
      `counter_hypothesis` but no `principle`. The producer is
      `road-to-a-retro-the-merge-runs` step 4.4 ("package findings become
      self-repair records"), open and in flight in a parallel lane; defining
      the fields here first would fix the producer's schema from the consumer's
      side. 3.2 waits on the same field.
      **Re-measured 2026-10-19, and the wait is mutual.** Retro step 4.4 is
      still open, and its own reason points back here: it "needs a unit-key
      field on the self-repair record, whose shape the privacy floor and the
      release path read". So each side names the other's shape as its reason.
      The producer already has the field under another name: the retro's
      `Candidate.subject` (`src/scripts/retro.ts`) is documented as the
      canonical, stable claim two agreeing syntheses must spell identically —
      which is what `principle` is for. A proposal to define `principle`,
      `mechanism` and `falsifier` as optional fields here, map `subject` onto
      `principle`, and render the upstream body from closed fields only (with
      `renderReport` left for the local and Class-B case) was put to the
      council. **Both seats were quota-exhausted (anthropic 50/50, openai
      50/50); 0/2 answered, so nothing was decided.** Overriding a recorded
      deferral needs that round first, so the step stays open until it runs.
      **The round ran later on 2026-10-19 (D9): 2/2 present, one round, $0.**
      Both seats cleared the first half and called it council-decidable: the
      record gains optional `principle`, `mechanism` and `falsifier`, validated
      on write and scanned by the privacy floor, with the retro mapping written
      into `docs/contracts/retro-v1.md`. That landed, so the producer's stated
      wait on this side's field shape is gone. The upstream body did not: the
      openai seat named two owner-reserved dimensions for changing what leaves
      (a privacy boundary — `mechanism` and `falsifier` are free text whatever
      their field name — and a public contract, the cross-installation key),
      and the seats split on whether those two lines may be sent at all
      (anthropic keep, openai drop) and on whether a record without `principle`
      may keep today's evidence-bearing body (openai: not indefinitely). A seat
      naming an owner-reserved dimension makes this owner residue, as in D7.
      The step stays open until the owner decides; the less-revealing reading
      — body from `target`, `defect_class` and `principle` only — is the one
      to build when he does.
      The landed half is pinned by the four claim-field cases in
      `tests/scripts/self_repair.test.ts`, each watched red.
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
      **2026-10-19:** sequenced behind the same council round as 3.1 — the
      fingerprint change is the proposal's second half, and it changes no
      stored record because no producer sets `principle` yet.
      **2026-10-19, after the round (D9): not adopted.** The openai seat's
      objection holds against the formula as proposed — the retro defines
      `subject` as a canonical *claim*, so two mechanisms may share one, and
      `defect_class | target | principle` would merge them. It asked for a
      versioned key and a stable mechanism identifier, and would accept the
      formula only on corpus evidence that each subject maps to one mechanism
      across repositories. No such corpus exists until a producer writes the
      field, so this step now waits on evidence, not on a schema, and on the
      owner's decision under 3.1 for the public-contract half. The key is
      pinned unchanged by `claim-fields-change-neither-key-nor-body-yet`.
- [x] **3.3 Draft, and a neutral branch.** `--draft` on every pull request; the
      branch is `retro/<fingerprint[:8]>`.
      **Branch half done 2026-10-17 with 2.1:** the commit is pushed as
      `<sha>:refs/heads/retro/<fp8>` and `gh pr create` names it in `--head` on
      both rungs (the fork rung as `<login>:retro/<fp8>`).
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
> identity, its branch — are 2.1's output. *(Superseded for 4.3 on 2026-10-17:
> the account needs none of those bytes.)* Until 2.1 exists the dry run has no
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

- [x] **4.1 The person approves what is sent.** `--dry-run` shows every byte;
      the release accepts only an approval bound to the digest of those bytes
      through `self_repair_class_b`, or through the self-modification roadmap's
      `subjectDigest` if that lands first — one primitive, the other's reason
      recorded in the step's commit.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t changed-bytes-void-approval --reporter=verbose` -> /✓.*changed-bytes-void-approval/
      **Done 2026-10-17:** `_lib/self_repair_outgoing.ts` renders branch,
      identity, commit message, diff, title, body and the fallback issue as one
      length-sectioned text; the dry run prints it with its SHA-256, and the
      release refuses unless `--approve <digest>` names the bytes it recomputes
      at send time — through `self_repair_class_b`'s `approve`. `subjectDigest`
      is not used: it digests the gated paths of a ratification subject at a
      revision, not an arbitrary outgoing payload.
- [x] **4.2 A consumer reaches an issue, not yet a pull request (D5).** From a
      consumer project the ladder stops at the issue step; a pull request is
      opened only from a checkout of this package, and `AGENT_CONFIG_SOURCE` is
      documented as that checkout's pointer. In the same step, a threat-model
      matrix under `agents/evidence/analysis/` compares issue, same-repository PR
      and fork PR across visible account, fork and repository linkage, branch
      name, activity events, timestamps, notifications, retention and deletion;
      if the fork PR adds no project linkage beyond the issue, D5 reopens toward
      an ephemeral-checkout pull request from consumers.
      verify: `ls agents/evidence/analysis/` -> /upstream-fork-pr-linkage/
      **Done 2026-10-17:** `findAgentConfigCheckout` honours
      `AGENT_CONFIG_SOURCE` only when the working directory is inside the
      checkout it names, so set in a consumer project it widens nothing; the
      command documents it. The matrix
      (`agents/evidence/analysis/upstream-fork-pr-linkage-2026-10-17.md`) was
      measured read-only on a live forge without opening anything: a fork PR,
      as the release now builds it, adds no consumer-project linkage over an
      issue — D5's literal condition is met — but it is not deletable where an
      issue is, so a floor miss is permanent. The reopen went to the council
      (D7): split, D5 unchanged.
- [x] **4.3 The remaining identity is said out loud.** The dry run states which
      account will appear on the pull request (blocker below).
      **Done 2026-10-17:** unlike 4.1 it needs no 2.1 bytes — `renderDryRun`
      names the login `gh` is signed in as for a pull request and an issue
      alike, says so when it cannot be resolved, and names none for a
      local-only plan.
      verify: `npx vitest run tests/scripts/self_repair_release.test.ts -t dry-run-names-the-account --reporter=verbose` -> /✓.*dry-run-names-the-account/

## Phase 5 — The retro may offer, never send

> **Phase state, executed 2026-10-14.** Both steps verify against
> `tests/scripts/retro.test.ts`, and both the test file and every `retro*`
> module under `src/scripts/` are absent — a glob for them matches nothing.
> `road-to-a-retro-the-merge-runs` measures **35 open, 0 closed**. There is no
> retro run to attach an offer to, so neither step is buildable here, and
> building a stub to attach one to would create the second outward route K1
> forbids.
> *(Re-measured 2026-10-17: `retro.ts` and `tests/scripts/retro.test.ts` now
> exist, but a retro run still produces no package record — that is retro
> step 4.4, open — and `/retro status` is retro step 2.5, open. Both steps
> here stay sequenced behind them.)*
> *(Re-measured 2026-10-19: retro 4.4 and 2.5 are both still open, 2.5 for an
> owner-reserved reason — it is a new consumer command. Unchanged.)*

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
| D6 | reversible-technical | agent | Step 2.1's isolated checkout is a temporary index with no working tree, and the commit is pushed by sha | A worktree would run the package's commit hooks without its dependencies and leave a checkout to clean up; plumbing reaches the same property — only the net diff on the base leaves — with nothing on disk but a temp dir | a hook must run on the synthesised commit |
| D7 | critical-technical | council:2026-10-17-d5-reopen-fork-pr | D5 is NOT reopened; the reopen is owner residue, since one seat named an owner-reserved dimension (irreversible external consequence). Its condition fires literally (matrix: no consumer-project linkage), but the seats split: anthropic (a) reopen, council-decidable — the digest approval is the protection for the floor's gap; openai (b) keep — a matching digest proves integrity, not that the person recognised a company term, and widening irreversible consequences is owner-reserved. A split escalates; the less-revealing option stands until the owner decides | `agents/evidence/analysis/upstream-fork-pr-linkage-2026-10-17.md` | the owner decides, or the detector table's identifier class lands |
| D8 | reversible-technical | agent | Risk review 2026-10-19: AC-5 is reworded as D5 instructed ("corrected at the next risk review") and closed against `consumer-reaches-the-issue-step` in `tests/scripts/self_repair_release.test.ts`, watched red with the checkout condition removed from `chooseEgress`. AC-1 closed on the three Phase 1 documents plus the pipeline document and the privacy-floor rule — every backticked path resolves, or is a short-form mention of a file that exists, or is the seed path the rule names as deliberately absent — and on `check_references` (2,931 scanned, 0 broken). Rows 1–3 of the risk register re-read and kept; row 4 added | `npx vitest run tests/scripts/self_repair_release.test.ts` 30/30 · `./scripts-run src/scripts/check_references` exit 0 | the owner decides D7 — AC-5's wording then moves with it |
| D9 | critical-technical | council:2026-10-19-upstream-closed-fields | Optional `principle` / `mechanism` / `falsifier` added to the self-repair record (shape-validated, privacy-floor-scanned, read by neither key nor body) and the retro mapping documented — council-decidable and convergent (anthropic, openai). The upstream body change (3.1) and the mechanism key (3.2) are NOT adopted: openai named a privacy boundary and a public contract as owner-reserved, and the seats split on sending `mechanism` / `falsifier` and on keeping the legacy body; a split with an owner-reserved dimension is owner residue (D7). For 3.2 openai also objected that a claim is not a mechanism identity | 2/2 present, 1 round, $0; `tests/scripts/self_repair.test.ts` claim-field cases, each watched red | the owner decides 3.1, or a corpus shows one subject per mechanism (3.2) |

## What this roadmap deliberately does not do

- **K1** No second egress way and no new upstream verb.
- **K2** No consumer code, diff or path in the payload; the schema has no field for it.
- **K3** No "scrubbing": what the floor refuses stays local.
- **K4** No transcript text and no local correlation key upstream, not even
  rephrased; a hashed repository key is guessable from a dictionary.
- **K5** No scanner of its own; the detector table is the dependency.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Company jargon without a literal identifier slips through | product | A term that names nothing but identifies the employer leaves in a principle field. | Closed fields only, the person sees every byte in the dry run, digest-bound approval. | Phase 3 — Synthesised, clustered, drafted |
| 2 | Upstream pull requests flood the maintainer | product | Many installations open the same finding. | Mechanism fingerprint clusters them; the existing creation cap of 20 per 24 h; one offer per run. | Phase 5 — The retro may offer, never send |
| 3 | The ephemeral checkout fails on a locked-down machine | implementation | No network or no git leaves the consumer without a route. | The ladder still degrades to an issue, which is today's behaviour. | Phase 4 — Approval of exact bytes, and a route from consumers |
| 4 | Producer and consumer each wait on the other's record shape | implementation | Retro 4.4 waits on the record shape this file reads, and 3.1 / 3.2 here wait on a field the retro has not named, so neither side moves. | Broken on this side 2026-10-19 (D9): the record now has the fields and the mapping is in the retro contract, so retro 4.4 has a shape to write. What remains is an owner decision on what leaves, not a wait. | Phase 3 — Synthesised, clustered, drafted |

## Acceptance Criteria

- [x] **AC-1** No document in the tree sends a contributor to a path, script or
      file that does not exist.
- [x] **AC-2** A release whose branch, identity, message or diff carries a
      consumer identifier is refused, with the finding named.
- [ ] **AC-3** The same mechanism from two projects produces one fingerprint.
- [x] **AC-4** Every upstream pull request is a draft with a noreply identity,
      and changing one byte after approval voids the approval.
- [x] **AC-5** A consumer install reaches the issue step of the ladder; the
      pull-request step is reached from a checkout of this package (D5), until
      the owner decides D7.
