---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
review_by: 2026-12-01
estate_offset_exempt: "Round inbox-2026-10-v verified at 324969e7e that the remediation path ends at an upgrade plan: dependency-upgrade's output is a changed constraint plus code adjustments (SKILL.md:272-278); finishing-a-development-branch knows four end states and none of them is a security fix (SKILL.md:93-176, 0 hits for security|CVE|advisory); and the tree's own rule that security updates travel alone (.github/dependabot.yml:29-30) reaches no consumer asset. No active, parked or stub roadmap owns carrying a security finding to a merged and deployed fix. Merging into road-to-advisories-heard-the-same-day would push that file over the lightweight caps and couple notice delivery, which waits on a council round, to fix work, which does not; parking costs more because the owner asked on 2026-10-21 for fixes, not only notices."
relates:
  - slug: road-to-advisories-heard-the-same-day
    relation: depends
    note: "Consumes that file's verdict vocabulary (its 2.2) and its finding evidence. Phases 1–2 here also run from a finding the user names by hand, so they do not wait for its notice."
  - slug: road-to-worktrees-that-leave-after-the-merge
    relation: depends
    note: "Calls that file's merge-time removal (its 3.1) for a fix worktree. Without it, every fix worktree is one more stale tree."
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: "A merge grant scoped to security branches would live there; this file merges only under an owner instruction (D3)."
depends:
  - road-to-advisories-heard-the-same-day
  - road-to-worktrees-that-leave-after-the-merge
---
# Road to security fixes carried to the merge

> **Source:** `agents/tmp.old/inbox-2026-10-v/` — one owner transcript and
> three supplied plans, pinned at `main@8a2c3b4`, re-read at `main@324969e7e`
> on 2026-10-21. The owner's words that set this file's goal: not only point
> the user at a hole but actively help fix it, in the branch/PR or through a
> worktree with its own PR and release, as fast and as well as possible.

## Goal

A security finding that has a fix leaves the agent as a **verified fix ready
for the owner's merge**: the smallest change that closes it, placed where it
belongs (this branch, or its own worktree, branch and PR), proven closed by the
same authority that reported it, tested, and — where the project publishes
releases — with a patch release prepared. After the merge the agent follows it
to "released" and, where the project exposes a signal, to "deployed"; the
worktree is gone. Merge, tag, publish and deploy stay the owner's.

Measured promise, pre-registered in Phase 0: **time-to-remediation (TTR)** —
accepted offer → fix PR green and ready to merge.

## Prerequisites

- `road-to-advisories-heard-the-same-day` Phase 2 (verdicts) for the automatic
  path. A finding the user names by hand ("fix CVE-… in this project") enters
  Phase 1 here without it.
- `road-to-worktrees-that-leave-after-the-merge` Phase 3.1 before Phase 2.2
  here creates its first worktree.

## Context — read at `main@324969e7e`

| # | Defect | Evidence |
|---|---|---|
| R1 | **The fix story ends at a plan.** `dependency-upgrade` emits a changed constraint and code adjustments; nothing routes a security fix, opens a PR with advisory evidence, watches it, prepares a release or follows it to deployment. | `src/skills/dependency-upgrade/SKILL.md:272-278` |
| R2 | **No security end state.** `finishing-a-development-branch` has four end states; security, CVE and advisory have zero hits. | `src/skills/finishing-a-development-branch/SKILL.md:93-176` |
| R3 | **The tree knows security fixes travel alone — for itself.** Security updates stay ungrouped "so they arrive alone and are mergeable without reading an unrelated bump". No consumer asset carries this into routing. | `.github/dependabot.yml:29-30` |
| R4 | **A worktree is created only on an explicit ask**, and a branch only with permission. An offer the user answers "separate worktree" is that ask; nothing records it as such. | `docs/decisions/ADR-229-worktrees-are-instruction-only.md:60-66`; `src/rules/scope-control.md:29` |
| R5 | **A runtime fix is partly outside the repository.** A PHP security release changes every file that pins the version (Dockerfile `FROM`, CI `setup-*`/`image:`, `config.platform.php`) and a host no file controls. Nothing in the tree reads those pins today. | `src/agent-src/templates/scripts/work_engine/stack/detect.ts:9-30` |
| R6 | **Merge is the owner's unless the owner said otherwise.** `/pr:merge` reads an explicit invocation or the owner's own words as the confirmation for a `routine` PR. | `src/domains/git/pr/merge/command.md:36-40`; ADR-282 |

### Bestand — reuse, do not rebuild

| Need | Already in tree |
|---|---|
| Upgrade procedure incl. post-update malware audit | `src/skills/dependency-upgrade/SKILL.md:22-270` |
| Worktree creation with ignore-safety and test baseline | `src/skills/using-git-worktrees` |
| Branch end states | `src/skills/finishing-a-development-branch/SKILL.md:93-176` |
| Merge with head-commit match | `src/domains/git/pr/merge/command.md:278` |
| CI settle | `ci_settle <pr>` |
| Release communication | `src/skills/release-comms` |
| Security floor outranking a version rule | `src/scripts/check_dependency_floors.ts:24` |

## Phase 0 — Pre-register the promise and the fixtures

- [ ] **0.1 TTR bar**: lockfile-only fix ≤ 30 min of agent time from accepted
      offer to green PR; runtime fix ≤ 2 h to a PR changing every pinning file
      plus an ops checklist. An honest null is a complete result.
      verify: a TTR claim row in `docs/CLAIMS.md`, status `unbacked`, committed
      with `build_proof` in the same change.
- [ ] **0.2 Fixtures**: G1 trunk clean, lockfile-only fix; G2 a feature
      branch in progress that does not touch the lockfile; G3 a feature branch
      that already changes the same lockfile; G4 the vulnerable dependency was
      introduced by the current branch; G5 a library that publishes releases;
      G6 a PHP runtime pinned in Dockerfile, CI and `config.platform.php`; G7
      an open bot PR that already fixes the finding; G8 no fix exists; G9 the
      fixing version is younger than the cooldown.
      verify: each fixture is a directory under
      `tests/fixtures/security-fixes/` with the expected route and outcome.

## Phase 1 — The fix, built and proven

- [ ] **1.1 Minimal fix first.** `dependency-upgrade` gains a security entry:
      the smallest fixing version inside the current constraint (`composer
      update vendor/pkg --with-dependencies`, `npm update pkg`, an override or
      resolution for a transitive-only fix); a constraint change only when
      required; never a major without a stated compatibility analysis; never
      `audit fix --force`.
      verify: G1 changes one lockfile entry and no manifest constraint.
- [ ] **1.2 Runtime fixes as file edits (R5)**: every file that pins the
      runtime is changed in one commit, and a short ops checklist names what no
      file controls (managed hosting, a base image built elsewhere).
      verify: G6 yields one commit touching all three pinning files and a
      checklist in the PR body.
- [ ] **1.3 Cooldown and provenance (G9)**: a `fix-fresh` version runs the
      existing post-update audit before install, extended with the release-age
      check and a diff of `.claude/`, `.vscode/`, `.cursor/` and install
      scripts.
      verify: G9 produces the audit lines and stops if the diff touches an
      agent-config directory.
- [ ] **1.4 Proof it is fixed, not that it was attempted.** The same source
      adapters re-run on the changed lockfile and declarations inside the fix
      branch; the finding must move to `fixed-in-branch` by the authority's own
      answer. Then the project's tests and static checks run. A fix that leaves
      the advisory open or breaks a test is reported as exactly that.
      verify: a fixture whose "fix" stays inside the affected range reports
      `fix-failed`, never success.
- [ ] **1.5 No fix exists (G8)**: a mitigation is offered — a configuration
      change, a disabled feature, a pinned-back version where that is safe —
      marked temporary, and the finding stays open and watched.
      verify: G8 yields a `mitigated` finding that a later release fixture
      re-opens as `fix-available`.

## Phase 2 — Where the fix goes

- [ ] **2.1 Deterministic routing table**, shown with its reason in the offer:

| Situation | Default route | Why |
|---|---|---|
| Trunk, clean (G1) | new branch from fresh trunk in this checkout | nothing to isolate from |
| Feature branch, fix touches other files (G2) | separate worktree from fresh trunk, own branch, own PR | travels alone (R3); mergeable without the feature |
| Feature branch already changes the same lockfile (G3) | separate worktree and PR; after its merge, offer the feature branch a rebase | one lockfile, two conflicts otherwise |
| The branch introduced the dependency (G4), or the user asks | current branch, own `fix(security): …` commit | the bug lives here; fixing elsewhere ships it in this PR |
| An open bot PR already fixes it (G7) | complete that PR (tests, breaking-change adjustments) | no second PR |
| Library that releases (G5) | worktree and PR plus a patch-release draft (2.4) | consumers need a version |

      verify: each of G1–G5 and G7 routes as the table says.
- [ ] **2.2 The worktree route, consented per offer (R4).** Choosing "separate
      worktree" in the offer is the explicit ask ADR-229 requires. The agent
      creates it with `using-git-worktrees` checks, registers it with
      `purpose: security-fix` and the finding IDs (the sibling's 3.4
      registry), and works there while the user continues in the main
      checkout.
      verify: G2 creates exactly one worktree, registered, and leaves the main
      checkout's status unchanged.
- [ ] **2.3 The PR carries its evidence.** Branch `security/<pkg>-<id>`;
      title `fix(security): <pkg> <from> → <to> (<IDs>)`; body: finding IDs,
      tier, before/after authority verdicts, test result, cooldown and
      provenance note, deploy note. Never mixed with non-security changes;
      several security fixes of one tier in one lockfile may share a PR.
      verify: G1's PR body carries all seven fields.
- [ ] **2.4 Release, when the project releases (G5).** Version bump per the
      project's convention, changelog entry naming the advisory IDs, a
      `release-comms` draft; stop before tag and publish.
      verify: G5 produces the three artefacts and no tag.
- [ ] **2.5 Watch, then hand over.** CI is watched in the background with
      `ci_settle`; red checks the fix caused are fixed; the agent reports
      "ready to merge". Merge is the owner's, or `/pr:merge` under an explicit
      owner instruction (R6). After the merge the sibling's 3.1 removes the
      fix worktree.
      verify: a merged G2 fixture leaves no worktree for its branch.

## Phase 3 — Follow the fix to production

- [ ] **3.1 Lifecycle on the finding**: `fix-in-progress` → `fixed-in-trunk`
      (merge SHA) → `fixed-released` (a tag contains it) → `fixed-deployed`
      (only on a deploy signal the project exposes: a deploy workflow run, a
      release environment, or the user's word).
      verify: a fixture with a deploy workflow run moves the finding to
      `fixed-deployed`; one without stops at `fixed-released`.
- [ ] **3.2 Merged but not deployed is still a finding.** A T0/T1 that is
      `fixed-in-trunk` and not deployed after 24 h stays in the notice as one
      line naming the project's deploy route.
      verify: a 25 h-old `fixed-in-trunk` fixture is listed.
- [ ] **3.3 One remediation per scope.** A finding fingerprint (project,
      package or runtime, range, IDs) owns at most one open fix; a second
      session sees and joins it instead of starting another.
      verify: two sessions over G1 produce one branch.
- [ ] **3.4 `finishing-a-development-branch` gains the security end state**:
      "fix PR open → watched until merged → worktree removed → finding followed
      to deployed".
      verify: `grep -c "security" src/skills/finishing-a-development-branch/SKILL.md` -> /^[1-9]/

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | While a feature is in progress, a security fix defaults to its own worktree and PR; the current branch is the default only where that branch introduced the dependency | R3, the tree's own rule for itself; owner, 2026-10-21, names both routes | the owner reports the default route chosen wrongly twice |
| D2 | product-owned | agent | No standing "always use a worktree for security fixes" setting; the per-offer choice is the explicit ask | ADR-229 makes creation instruction-only and names its own review trigger (a user repeatedly asking); one directive is not that trigger | the user picks "separate worktree" in three consecutive offers, which is ADR-229's trigger, and an amendment is proposed then |
| D3 | destructive-owned | evidence | The agent stops at "ready to merge"; merge is the owner's or `/pr:merge` under the owner's instruction | R6; ADR-282 | `road-to-typed-grants-that-persist` lands a merge grant scoped to `security/*` with green checks |
| D4 | critical-technical | evidence | Never `audit fix --force`, never an unannounced major, never a tag or publish | 1.1, 2.4; an update-applying agent is itself on the supply-chain attack path | never |
| D5 | reversible-technical | agent | Several security fixes of one tier in one lockfile share a PR; never mixed with non-security changes | reviewability and revertability; R3 | a shared PR is reverted for one of its fixes |

## What this roadmap deliberately does not do

- It does not merge, tag, publish or deploy.
- It does not detect findings; that is `road-to-advisories-heard-the-same-day`.
- It does not remove worktrees itself; it calls the sibling's merge-time path.
- It does not touch a pull request a human owns without that human's ask.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The fixing version is itself compromised | implementation | A fast update is the attack path. | 1.3 cooldown, provenance and agent-config-directory diff. | Phase 1 — The fix, built and proven |
| 2 | A fix is reported done while the hole is open | product | A green PR is mistaken for a closed advisory. | 1.4 authority re-check; 3.1 separates trunk, release and deploy. | Phase 1 — The fix, built and proven |
| 3 | The fix worktree collides with the user's feature work | implementation | Same lockfile in two branches. | 2.1 row G3 and the rebase offer after merge. | Phase 2 — Where the fix goes |
| 4 | Two sessions build divergent fixes | implementation | Parallel sessions on one finding. | 3.3 one remediation per fingerprint. | Phase 3 — Follow the fix to production |

## Acceptance Criteria

- [ ] **AC-1** G6: one accepted offer yields a worktree, a PR changing every
      file that pins PHP, an ops checklist, and after the merge no worktree.
- [ ] **AC-2** G1 reaches a green PR with before/after verdicts inside the
      0.1 bar; G2 and G3 route to their own worktree; G4 stays in its branch;
      G7 opens no second PR; G5 stops before the tag.
- [ ] **AC-3** No code path runs `audit fix --force`, `gh pr merge` without
      the owner's instruction, or `git tag`.
- [ ] **AC-4** `task ci` green.

## Provenance

Source-derived under template rule 19; the source is not named here per
`source-confidentiality`; links are `ENC1`-encrypted in the round's intake note.

| Proposed | Verdict | Why |
|---|---|---|
| Minimal fix, runtime file edits, ops checklist | KEEP | R1, R5. |
| Proof by the authority's own re-check | KEEP | 1.4. |
| Routing table, worktree per offer | KEEP | R3, R4; owner directive. |
| Patch-release preparation, stop before tag | KEEP | 2.4; D3. |
| Follow to deployed; merged-not-deployed stays open | KEEP | 3.1, 3.2. |
| Reuse a bot PR, one remediation per fingerprint | KEEP | 2.1 G7, 3.3. |
| Mitigation when no patch exists | KEEP | 1.5. |
| Standing worktree setting via an ADR-229 amendment | CHANGED | D2: per-offer consent first; ADR-229's own trigger decides later. |
| Auto-merge of security branches | CUT | D3. |
| A persistent job queue, leases and SQL state | CUT | 3.3 needs a fingerprint, not a queue. |

## Notes — how this file was derived

Split from the supplied v4 plan's Phases 5–7, so detection can land without
fixes and fixes can be exercised by hand before detection exists. Three
extraction passes; pass 2 added mitigation (1.5) and bot-PR reuse (G7) from
the external plan; pass 3 matched each KEEP row to a step.
