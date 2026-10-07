---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "First of three receivers for inbox round inbox-2026-10-f, which reviewed PR #2235 (the git.* settings) and measured that its three keys reach no worktree, fresh clone or CI run and that an unreadable settings file silently yields a merge. No active roadmap owns the git.* keys; they do not exist on main yet. Archiving an unrelated roadmap to buy the slot would hide the growth instead of naming it."
relates:
  - slug: road-to-one-owner-for-the-ticket-and-the-subject
    relation: disjoint
    note: Sibling from the same round. It consumes the verb of step 1.2 and the reader of 1.1; nothing here depends on it.
  - slug: road-to-a-rebase-that-leaves-a-way-back
    relation: disjoint
    note: Sibling from the same round. It reads the strategy through 1.1; its Phase 1 shares this file's release-ordering constraint.
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: Owns who may authorise a rewrite. Nothing here changes authorisation; a declared strategy picks an operation and never grants one.
---
# Road to a git convention that reaches every checkout

> **Source:** `agents/tmp.old/inbox-2026-10-f/` — a round of three generations of
> roadmap-shaped proposals, two analyses and one transcript on pull request
> #2235 (`feat/git-convention-settings`). Every anchor below was re-read at the
> pull request head `2333b93d6` on 2026-10-07 (merge base with `main`:
> `e3c30fc9d`). "Measured" marks a reading the proposals ran at that head and
> this run did not repeat. The round's final consolidation declared two parents
> and omitted the third-generation proposal beside it; that proposal was read in
> full and its survivors are folded into this file and its two siblings.

## Goal

A team's git convention is declared in one committed place and resolves to the
same value in the primary checkout, a worktree, a fresh clone and CI; a
declaration that cannot be read is never treated as the default; and a consumer
install can read the convention through one command that resolves.

## Prerequisites

- The work is a pull request based on #2235, per the owner's instruction of
  2026-10-07: its branch is cut from `feat/git-convention-settings`.
- `.branch-convergence.yml` does not exist at `2333b93d6` or on `main`
  (`POLICY_PATH`, `src/scripts/_lib/branch_convergence.ts:46`). The policy is
  read at the target commit (`src/scripts/sync_pr_branch.ts:410`, `:488`), so a
  pull request targeting `feat/git-convention-settings` needs the file committed
  **on that branch** before `sync_pr_branch` can run against it; an entry in this
  pull request does not count.
- Every step that edits `src/` regenerates what #2235 regenerated: the
  projection, the settings reference and the install bundle.
- A new guard's test is shown red with the guard removed, and the commit says so.

## Context

#2235 adds `git.commit_format`, `git.branch_pattern` and `git.update_strategy`
(`src/config/agent-settings.template.yml:425-444`). Its defaults change nothing,
and its strongest rule stands: the setting picks the operation and never
authorises it.

**1. A declaration that cannot be read becomes the default.**

- `_read_yaml` returns null on a parse error (`src/scripts/_lib/agent_settings.ts:1355-1358`)
  and `updateStrategy` folds every failure into `merge`
  (`sync_pr_branch.ts:861-869`). Measured: `rebase` plus an unclosed bracket
  elsewhere in the file merges, exit 0, empty stderr; `settings:get` prints
  "not set" — the reading every prose site uses
  (`src/skills/git-workflow/references/branch-update.md:7`).
- The helper that tells absent from malformed exists
  (`agent_settings.ts:904`, `settings_layer_states`). Its warning goes to
  `Logger.records` only (`:90-92`), so it is never printed, although the doc
  comment at `:73-75` says it is.
- `settings:check` reads a YAML subset and never the schema enum
  (`schema.json:95-97`), so `update_strategy: rebsae` passes.
  `git check-ref-format --branch` accepts `a$(id)`, `a;b` and `a|b` (re-run on
  2026-10-07), so it is no guard for a pattern that reaches a shell.
- `/pr:merge` § 2 reads exit 0 as "current"
  (`src/domains/git/pr/merge/command.md:152`); the script also exits 0 when it
  could not fetch (`sync_pr_branch.ts:764`) and when the policy is bypassed
  (`:962-966`). The command's rule still says "Never rebase a pushed branch; the
  base is merged in" (`:449`), and "unless the invocation itself asked for the
  rebase" (`:154`) has no syntax (`:5`).
- Two remedies print a merge whatever the strategy:
  `src/scripts/check_branch_freshness.ts:616` and
  `src/domains/engineering-base/review/changes/command.md:361`.
- `/fix:ci` and `/roadmap:next` map the script's exits
  (`src/domains/engineering-base/fix/ci/command.md:99-101`,
  `src/domains/product-basic/roadmap/next/command.md:283-284`); a new exit has no reader there.

**2. The declaration does not travel.**

- The keys are read from the developer layers only
  (`agent_settings.ts:842-846`), with the gitignored local layer read last
  (pinned by `tests/lib/agent_settings.test.ts:715-733`). The shipped ignore
  block lists `.agent-settings.yml` without an anchor
  (`src/config/gitignore-block.txt:55-56`), which also ignores the canonical
  settings file under `agents/settings/`. The worktree skill forbids copying the
  file (`src/skills/using-git-worktrees/SKILL.md:172`).
- Measured: with `rebase` declared in the primary checkout, the primary refuses
  to merge, while a worktree of the same repository has no file and
  `sync_pr_branch` creates a merge commit. A fresh clone and CI have no file
  either.
- The user-global layer discards the keys: `settings:get` says so
  (`src/scripts/_cli/cmd_settings_get.ts:313`), `sync_pr_branch` merges
  silently, and the settings GUI writes there for a consumer
  (`src/server/writeRoot.ts:15`).
- The committed team file is read for `modules:` only
  (`agent_settings.ts:1123-1150`), is labelled legacy
  (`src/scripts/_lib/install_reach_checks.ts:303`) and is bootstrapped by copy
  (`src/scripts/apply_modules_config.ts:382`).
- The tree met this problem on 2026-09-03: a policy is read at the resolved
  target commit only (`branch_convergence.ts:14`), from a tracked root file
  because `.agent-settings.yml` is ignored everywhere this ships (`:22-37`).
  `git.update_strategy` is read from the checkout in the same file
  (`sync_pr_branch.ts:861-869`) as the reader that honours that ruling (`:488`).
  For a target that is the default branch, `resolveBase` returns
  `not-required` at `:482`, before the policy load at `:488`, so routing the
  strategy through that reader as written would never fire in the common case.

**3. The convention is not reachable as code.** Measured in a fresh consumer
install: the project has neither `scripts-run` nor `node_modules`, and the check
#2235 added to `/pr:merge` (`:150`) calls `./scripts-run`. The `agent-config`
verb is the only code an installed command reaches. The CLI budget is 110 of 110
(`src/config/evaluator-budgets.json:60-66`); its own record lets a registering
change move it.

**4. The setting value is named after the wrong family.** `ticket-prefix` is a
classifier family, "ticket, then free text"
(`src/skills/conventional-commits-writing/SKILL.md:171`), while the setting
value means the family `ticket-conventional` (`:150`, `:172`). The value is
unreleased (it sits under `[Unreleased]`, `CHANGELOG.md:160-186`) and is also
used by `docs/guidelines/php/git.md:79`. Once a release carries it, `upgrade`
writes it into settings files and the rename becomes a migration.

## Phase 1 — A declaration that cannot be read is never the default

- [x] **1.1 One reader, and it knows five states.**
      `src/scripts/_lib/git_convention.ts` returns, per key, the value, the
      source file and one of `valid`, `absent`, `malformed`, `invalid`,
      `discarded`. It is a new module because `agent_settings.ts` is 10 lines
      over the 1,500-line ceiling (`check_source_size_budget.ts:85`) with the
      excess total on its 17,550 baseline (D3). `updateStrategy`
      (`sync_pr_branch.ts:861-869`) goes through it and refuses with exit 4 and
      a stable reason code naming the file, on anything but `valid` or
      `absent`; exit 3 keeps its meaning. The suite covers an unreadable file, a
      typo'd value and a malformed top layer over a healthy lower one, and pins
      that under `rebase` the script never rebases and never pushes.
      `/fix:ci` and `/roadmap:next` map exit 4.
      verify: `test -f tests/scripts/_lib/git_convention_reader.test.ts && npx vitest run tests/scripts/_lib/git_convention_reader.test.ts tests/scripts/sync_pr_branch.test.ts && git grep -q -F 'exit 4' -- src/domains/engineering-base/fix/ci/command.md src/domains/product-basic/roadmap/next/command.md` -> 0
- [x] **1.2 One verb an installed command can call.**
      `agent-config git:convention show` prints the three keys with value,
      source and state, as text and as JSON, and exits non-zero on `malformed`
      or `invalid`. It names a repository commit-message validator (a
      `commit-msg` hook or a commitlint config) where one outranks
      `git.commit_format`. It is wired in `src/scripts/_dispatch.bash` and
      `src/cli/registry.ts`; the budget moves from 110 to 111 in the same change
      with its reason, and the measurements file is regenerated. Every prose site
      that reads a `git.*` key calls `show`. `settings:get` keeps its exit
      contract and gains one warning line when a layer is malformed.
      verify: `test -f tests/scripts/_cli/cmd_git_convention.test.ts && npx vitest run tests/cli/registry.test.ts tests/scripts/_cli/cmd_git_convention.test.ts && ./scripts-run src/scripts/check_cli_registry_budget_sync` -> 0
- [x] **1.3 A value and a pattern are checked where a consumer can see it.**
      The reader accepts the placeholders `{type}`, `{ticket}` and `{slug}`
      only, requires `{slug}`, restricts literal characters to
      `[A-Za-z0-9._/-]`, and renders a sample that must pass
      `git check-ref-format --branch`; anything else is `invalid` with the
      reason. `settings:check` calls the same check, so a typo'd strategy or a
      bad pattern fails there too. Prose that puts a rendered name into a
      command quotes it.
      verify: `test -f tests/scripts/_lib/git_convention_pattern.test.ts && npx vitest run tests/scripts/_lib/git_convention_pattern.test.ts tests/scripts/_cli/cmd_settings_check.test.ts` -> 0
- [x] **1.4 `/pr:merge` § 2 is written once.** It opens with the strategy from
      `show` and keeps the `sync_pr_branch` call, so the convergence policy is
      still read; it maps exit 0, 3 and 4 explicitly and treats the fetch
      failure and the bypass as "not checked", which stops that pull request.
      The rule at `:449` reads per strategy, the clause at `:154` goes, and
      `branch-update.md:34-36` says the same.
      verify: `test -z "$(git grep -F -e 'Never rebase a pushed branch' -e 'invocation itself asked' -- src/domains/git/pr/merge/command.md)" && git grep -q -F 'exit 4' -- src/domains/git/pr/merge/command.md` -> 0
      Positive control: the first `git grep` prints two lines at `2333b93d6`.
- [x] **1.5 The two remaining remedies follow the strategy.**
      `check_branch_freshness.ts:616` prints the pointer to `branch-update.md`
      instead of a merge command under a strategy other than `merge`;
      `review/changes/command.md:361` says what its lines 44-47 say.
      verify: `test -f tests/scripts/check_branch_freshness_remedy.test.ts && npx vitest run tests/scripts/check_branch_freshness_remedy.test.ts` -> 0
- [x] **1.6 The setting value takes the family's name, before any release.**
      The value `ticket-prefix` of `git.commit_format` becomes
      `ticket-conventional`, the family whose grammar it already is. The family
      `ticket-prefix` keeps its name, so no approved convention card changes
      meaning. Schemas, template, settings reference, every command and skill
      that names `commit_format: ticket-prefix`, `CHANGELOG.md` and
      `docs/guidelines/php/git.md:79` move together. An alias is added only if a
      release already carried the old value.
      verify: `test -z "$(git grep -l -F 'commit_format: ticket-prefix' -- src docs CHANGELOG.md)" && test -z "$(git grep -l -F "'ticket-prefix'" -- src/scripts/schemas src/server/schemas src/config)"` -> 0
      Positive control: the first `git grep` prints nine files at `2333b93d6`.

## Phase 2 — The declaration reaches every checkout

- [x] **2.1 The carrier facts become tests.**
      `tests/scripts/git_convention_carrier.test.ts` asserts today's behaviour:
      a worktree with its own commit merges while the primary refuses; a key in
      the team file reads "not set"; a key written through the GUI's write root
      reads "not set"; the gitignored local layer overrides the canonical file;
      a subdirectory with its own project file resolves a different value than
      the repository root.
      verify: `test -f tests/scripts/git_convention_carrier.test.ts && npx vitest run tests/scripts/git_convention_carrier.test.ts` -> 0
- [x] **2.2 The council picks the carrier.** The first action runs the council
      under three constraints: the carrier is a tracked file at the repository
      root; `update_strategy` is read from it at the resolved target commit
      only; the three keys, their template block, schemas and contract rows stay
      where #2235 put them (D2). Options: (i) a `git:` section in a tracked file
      of its own; (ii) a section in `.branch-convergence.yml`, which reopens
      that file's deferral (`branch_convergence.ts:38-40`); (iii)
      `.agent-project-settings.yml`, legacy-labelled and bootstrapped by copy.
      The verdict becomes a row in this file's Decisions table and an ADR that
      carries one authority row per key: layer, whether the local layer
      participates, what a branch-local change is, and what `malformed` does.
      verify: `test -n "$(git ls-files docs/decisions | grep git-convention-carrier)" && grep -q '| council' agents/roadmaps/archive/road-to-a-git-convention-that-reaches-every-checkout.md` -> 0
- [x] **2.3 The reader resolves the committed declaration.**
      `update_strategy` is read at the target commit through the convergence
      reader, independently of the `not-required` early return at
      `sync_pr_branch.ts:482`; a branch without a pull request resolves the
      default branch, and nothing resolvable is exit 4, never `merge`.
      `malformed` is judged on that blob. `commit_format` and `branch_pattern`
      are read at the repository root, never per directory, and the committed
      carrier overrides every developer layer for them, the local layer
      included (D8). Where the checkout's value
      differs from the target commit's, `show` prints both and names the one in
      force. The class-C fence gains the carrier's basename
      (`src/scripts/hooks/block_config_weakening.ts:134`), and 2.1's assertions
      flip.
      verify: `test -f tests/scripts/git_convention_committed_carrier.test.ts && npx vitest run tests/scripts/git_convention_committed_carrier.test.ts tests/scripts/git_convention_carrier.test.ts tests/scripts/sync_pr_branch.test.ts` -> 0
- [x] **2.4 The write side stops promising what is dropped.** The GUI does not
      offer the three keys while its write root is the user-global layer; its
      write route runs the 1.3 check. The discard warning of `settings:get`
      (`cmd_settings_get.ts:255`, `:313`) stays silent when the dropped value
      equals the template default, which is what `upgrade` inserts
      (`src/scripts/_cli/cmd_upgrade.ts:35`).
      verify: `test -f tests/server/git_keys_write_route.test.ts && npx vitest run tests/server/git_keys_write_route.test.ts tests/scripts/_cli/cmd_settings_get_user_global_drop.test.ts` -> 0
- [x] **2.5 The surfaces name the carrier.** `CHANGELOG.md:160-186`,
      `docs/guidelines/agent-infra/layered-settings.md:20` and `:44`,
      `docs/contracts/settings-classes.md:528-530`, `docs/guidelines/php/git.md`
      and tier 1b of the commit skill (`SKILL.md:49`, `:64`) say where a team
      declares: in the carrier, where either value is a declaration.
      verify: `git grep -q -F 'either value' -- src/skills/conventional-commits-writing/SKILL.md` -> 0
- [x] **2.6 The verb is proven in a packed install.**
      `src/scripts/consumer_matrix.ts` gains a leg that runs
      `git:convention show` in a packed global install. The changelog entry says
      which git surfaces still need a source checkout.
      verify: `grep -q 'git:convention' src/scripts/consumer_matrix.ts && grep -q 'source checkout' CHANGELOG.md` -> 0

<!-- resequenced: until Phase 2 lands, a team that sets update_strategy to
     rebase gets merge commits from every worktree and from CI, and step 1.6 is
     free only before a release. Phases 1 and 2 land on the branch #2235 merges
     from, or directly behind it, before the keys are described as a team
     setting. -->

## What this roadmap deliberately does not do

- No change to who may authorise a rebase or a force push; that is
  `road-to-typed-grants-that-persist` under ADR-254.
- No policy intermediate representation, planner/executor split, decision log or
  lint against direct reads of the keys. `sync` already has a dry run and a
  `Plan` (`sync_pr_branch.ts:228`, `:739`), and there is one code reader.
- No new settings key, no key moved out of the template, and one new verb only.
- No global strictness in `load_agent_settings`: it has 48 references in `src/`
  and a fail-closed reader is needed only where the git keys are read.
- No carrier for any other `policy` key; whether others share the problem is a
  separate reading.
- No edit to #2235's review file. Its binding rows map to steps across the three
  sibling roadmaps of this round.

## Acceptance Criteria

- [x] AC-1 — With a settings file or carrier that does not parse, neither
      `sync_pr_branch` nor `git:convention show` yields `merge`.
- [x] AC-2 — A value or pattern outside the schema is reported as invalid by
      `settings:check` and by `git:convention show`.
- [x] AC-3 — A worktree and a fresh clone of a repository that declares
      `rebase` resolve `rebase`, and `sync_pr_branch` creates no merge commit in
      either.
- [x] AC-4 — A pull request cannot change the strategy its own update is judged
      by, and `show` names the value in force and the branch-local candidate.
- [x] AC-5 — In a packed consumer install, `/pr:merge` reads the strategy
      through a call that resolves.
- [x] AC-6 — The setting value and the classifier family have different names
      in every schema, and no approved card changes meaning.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | The work is a pull request based on #2235 | Owner instruction, 2026-10-07; the keys are under `[Unreleased]` and absent from `origin/main` | #2235 merges before Phase 2 lands |
| D2 | deterministic | evidence | The carrier is additive: no key leaves the template, the schemas or the contract rows | Removing the block reds `lint_settings_classes` and `tests/server/schemas/parity.test.ts` | The settings contract gains a committed layer of its own |
| D3 | deterministic | evidence | The reader is a new module | `agent_settings.ts` is 1,510 lines against a 1,500 ceiling with the excess total on its 17,550 baseline, so any added line reds the ratchet | The loader is split |
| D4 | deterministic | evidence | Code an installed command calls is reached through one new CLI verb | A consumer project has no `node_modules`, so a skill-bundled script run through `tsx` cannot start; the budget record lets a registering change move the number | A second consumer-reachable carrier of code exists |
| D5 | reversible-technical | agent | The value is renamed to the family whose grammar it is; an alias only after a release | `conventional-commits-writing/SKILL.md:150`, `:172`; the value is unreleased at the pin | A release carries `ticket-prefix` as a value |
| D6 | reversible-technical | agent | A branch-local value of a key is shown as a candidate, never adopted | AC-4; the strategy that judges a pull request must not come from that pull request | — |
| D8 | product-owned | owner | For `git.commit_format` and `git.branch_pattern`, the committed carrier overrides every developer layer, the gitignored local layer included | Owner answer to blocker `committed-over-developer`, 2026-10-07; `upgrade` inserts template defaults into every developer file, so a developer-wins order would let an inserted default override the team | A team needs a per-developer override and names the key |
| D9 | reversible-technical | council:agents/evidence/council/git-convention-carrier-2026-10.md | The carrier is `.git-convention.yml`, a `git:` section in a tracked repository-root file of its own (option i); ADR-283 carries one authority row per key | Two single-seat readings, both DEGRADED, not a 2/2 convergence: `anthropic/claude-sonnet-4-5` (CLI) and `openai/gpt-4o` (API), 2026-10-07, both chose (i) — commit-message rules in a file named for branch convergence are a naming mismatch, and (iii) is legacy-labelled, read for `modules:` only and outside the class-C fence; `agents/evidence/council/git-convention-carrier-2026-10.md` | Three or more tracked SHA-pinned team policies exist (consolidate into one repository-policy file), or a council broadens the charter of `.branch-convergence.yml` |
| D7 | deterministic | evidence | "merge" and "push" in this file name the subject matter, an update strategy, never an operation this roadmap authorises; every real merge, push or rewrite during execution stays governed by `git-history-discipline` and is asked per turn | `closure_scan` classifies the word `merge` as a typed operation on every line that mentions the strategy | — |
| D10 | reversible-technical | council:agents/evidence/council/git-convention-target-resolution-2026-10.md | `update_strategy`'s target is the explicit `--base`, else the default branch; nothing asks a forge for a pull request's base, and every pull-request caller passes `--base origin/<base>`. A target that names no commit is exit 1, a named commit that cannot be fetched is `unverified` (exit 0, nothing merged), a refusing carrier or developer file is exit 4; `show --key` limits `show`'s exit to the requested keys | Seven R2 rounds of forge and offline detection found 12, 10, 6, 6, 6, 5 and 10 findings without converging; 2/2 convergent council, `anthropic/claude-sonnet-4-5` and `openai/codex-default`, 2026-10-07, both chose removal with fail-closed PR callers; stated loss: a direct `sync` or `show` on a stacked pull request without `--base` reads the default branch | A pull-request caller is found that cannot pass its base |
| D11 | product-owned | owner | The agent may create `.git-convention.yml` once, after the user's explicit yes this turn, through `git:convention init --yes`: never over an existing `.yml` or `.yaml`, only `commit_format` and `branch_pattern` (validated), never `update_strategy`, never committed by the verb; the class-C fence keeps refusing direct writes and edits | Owner decision, 2026-10-07; recorded in ADR-283 § Creation | A team needs the agent to change an existing declaration |

## Blockers

### blocker: committed-over-developer
- **Status:** resolved — owner chose (a) on 2026-10-07; recorded as D8
- **Ownership:** product-owned
- **Owner:** user
- **Blocks:** step 2.3 — The reader resolves the committed declaration
- **Question:** When the committed carrier and a developer's own settings file
  both set `git.commit_format` or `git.branch_pattern`, which one wins?
- **Recommendation:** (a). `upgrade` writes the template defaults into every
  developer file, and the gitignored local layer is read last today
  (`tests/lib/agent_settings.test.ts:715-733`), so under (b) an inserted default
  on one machine would silently override the team.
- **If you do nothing:** step 2.3 cannot be built and the keys stay per-machine,
  with the worktree and CI behaviour 2.1 records.
- **What to do:** pick exactly one — (a) the committed carrier overrides the
  developer layers for these two keys; (b) the developer layers override the
  carrier. `git.update_strategy` is not part of the question: it is read at the
  target commit only. To see today's behaviour first, run
  `npx vitest run tests/scripts/git_convention_carrier.test.ts`.
- **Resolved when:** the answer is a row in this file's Decisions table with
  `resolved by` set to `owner`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The keys ship as a team setting before the carrier exists | product | #2235 merges and is released first; teams set `rebase` and worktrees and CI merge. | The resequencing note places both phases on or directly behind #2235's branch; D5 names the alias a release would need. | Phase 2 — The declaration reaches every checkout |
| 2 | A committed pattern reaches a shell | implementation | With a carrier, a pull request can change the pattern every checkout renders into commands. | 1.3 restricts the alphabet before the carrier exists; 2.3 puts the carrier behind the class-C fence. | Phase 1 — A declaration that cannot be read is never the default |
| 3 | The carrier verdict reopens a council deferral | product | Option (ii) extends a file whose scope the council froze on 2026-09-03. | 2.2 names the deferral in the option; (i) is available without reopening anything. | Phase 2 — The declaration reaches every checkout |
| 4 | The target-commit read surprises the first adopter | product | The pull request that introduces `rebase` is itself judged by the base's old value. | 2.3 has `show` name the commit it read and the candidate; 2.5 states the rule on every surface. | Phase 2 — The declaration reaches every checkout |
| 5 | The verb is not on the path | implementation | A consumer whose global bin directory is not on `PATH` cannot run `agent-config`; the installer warns about it today. | 2.6 proves the verb in a packed install; the ticket reference of the sibling roadmap keeps a generated fallback. | Phase 2 — The declaration reaches every checkout |
