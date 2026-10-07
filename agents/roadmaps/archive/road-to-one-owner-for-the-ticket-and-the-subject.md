---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
depends: [road-to-a-git-convention-that-reaches-every-checkout]
estate_offset_exempt: "Second of three receivers for inbox round inbox-2026-10-f. Ticket and subject rules for the git.* settings of PR #2235 are restated in three regex grammars across eleven commands and skills and validated by a model reading a regex; no active roadmap owns commit-subject or ticket extraction, and the git.* keys do not exist on main yet, so nothing can be offset against it."
relates:
  - slug: road-to-a-git-convention-that-reaches-every-checkout
    relation: depends
    note: Phase 1 here needs the reader (its 1.1) and the `git:convention` verb (its 1.2); the subcommands below hang off that verb, so the CLI budget moves once.
  - slug: road-to-a-rebase-that-leaves-a-way-back
    relation: disjoint
    note: Sibling from the same round; it touches branch updates, this file touches subjects, tickets and branch names.
---
# Road to one owner for the ticket and the subject

> **Source:** `agents/tmp.old/inbox-2026-10-f/` — the round on pull request #2235
> described in `road-to-a-git-convention-that-reaches-every-checkout`. Anchors
> re-read at the pull request head `2333b93d6` on 2026-10-07.

## Goal

The ticket a branch carries, the commit subject in the convention in force and
the branch name a pattern renders are each computed by one module that an
installed command reaches through `agent-config git:convention`, and every prose
surface cites one reference instead of restating a grammar.

## Prerequisites

- `road-to-a-git-convention-that-reaches-every-checkout` Phase 1 has merged: the
  reader resolves `git.commit_format` and `git.branch_pattern` and the verb
  exists.
- The branch is cut from `feat/git-convention-settings` or from a branch that
  contains it.

## Context

- **Three ticket grammars.** `[A-Z][A-Z0-9]+-[0-9]+` in two git commands;
  `/[A-Z][A-Z0-9]+-\d+/` in `src/scripts/command_suggester/match.ts:33`;
  `[A-Z]+-[0-9]+` in nine other commands and skills, two of them inside
  `trigger_context:` frontmatter the suggester reads (`implement-ticket`,
  `estimate-ticket`), with the same literal in
  `src/scripts/migrate_command_suggestions.ts:119`; and `[A-Z]{2,10}` in
  `src/scripts/refine_ticket_detect.ts:74`, which reads a project key out of a
  ticket body and is intentionally separate.
- **A security branch yields a ticket.** `fix/CVE-2026-12345-patch` yields
  `CVE-2026`: the denylist is `UTF`, `ISO`, `SHA`, `RFC`
  (`src/domains/git/commit/command.md:61-66`), and `/commit:in-chunks` never
  asks (`src/domains/git/commit/in-chunks/command.md:52`). The first match wins
  when a name carries two candidates (`commit/command.md:60`).
- **The subject is validated by reading a regex.** The lookahead at
  `commit/command.md:137` excludes only a scope that is exactly the ticket, so a
  ticket inside a compound scope passes; an approved measured family has no
  validator at all; and `conventional-commits-writing/SKILL.md:166-167` states
  that no executable classifier ships.
- **The branch renderer is prose.** The empty-placeholder rule lives in
  `src/domains/engineering-base/worktree/create/command.md:44`; a ticket without a slot is
  prefixed to the slug per `src/skills/jira-integration/SKILL.md:150-153`.
  `docs/guidelines/php/git.md:11` carries a fifth branch shape,
  `{type}/{ticket-id}/{short-description}`.
- **The title is a fourth shape.** `/create-pr:description-only` builds the
  title at `src/domains/git/pr/create/description-only/command.md:90`; under
  `ticket-prefix` it already becomes the commit subject (`:91-92`), and where
  the forge squashes, the default case does too.
- **Ticket keys have a home.** Ticket prefixes are an `approved-observation` on
  the convention card the skill writes (`SKILL.md:227-233`, `:245`); a settings
  key for them would red the settings ratchet.
- The review record of #2235 shows what restating costs: eight rounds, with
  rows repeatedly worded as one file disagreeing with another.

## Phase 1 — The grammars and one verb that computes them

- [x] **1.1 The grammars live in the module.**
      `src/scripts/_lib/git_convention_grammar.ts`, beside the reader, holds: the ticket grammar with its
      denylist (`CVE`, `CWE` and `GHSA` join the four) and an optional key
      allowlist, returning every candidate in a name, not only the first; the
      subject grammar per format and per approved family, where a ticket
      anywhere inside a scope fails; and the branch renderer, which owns the
      empty-placeholder and separator-collapse rules, never rewrites a literal
      character, and prefixes the slug with a ticket that has no slot (D1). A
      parity test holds `command_suggester/match.ts:33` equal to the module's
      ticket grammar.
      verify: `test -f tests/scripts/_lib/git_convention_grammar.test.ts && npx vitest run tests/scripts/_lib/git_convention_grammar.test.ts` -> 0
- [x] **1.2 Three subcommands under the existing verb.**
      `git:convention subject` reads subjects on stdin, resolves the convention
      through the reader and the skill's tiers, and exits non-zero listing each
      failure. Where a `commit-msg` hook is installed it validates nothing: the
      commit is the validator and `block_no_verify` holds; where a commitlint
      config has no hook, it prints the one command that runs it; where the
      checkout's validator and the committed declaration disagree, it prints
      both and adopts neither. `git:convention ticket` takes a branch name and
      the keys the caller passes. `git:convention branch` renders a name from
      type, ticket and slug. Subcommands do not move the CLI budget.
      verify: `test -f tests/scripts/_cli/cmd_git_convention_subject.test.ts && npx vitest run tests/scripts/_cli/cmd_git_convention_subject.test.ts tests/cli/registry.test.ts` -> 0
- [x] **1.3 Approved project keys live on the convention card.** The card gains
      a `ticket_keys` line, filled from the answer `/commit` already asks for
      when it meets an unknown key; a commitlint config's issue prefixes are
      offered as the card proposal, never written silently. The caller passes
      the line to `git:convention ticket`; a candidate whose key is not on the
      card is asked about by `/commit` and omitted by `/commit:in-chunks`.
      Without a card the grammar and the denylist apply.
      verify: `test -f tests/scripts/_lib/git_convention_ticket_keys.test.ts && npx vitest run tests/scripts/_lib/git_convention_ticket_keys.test.ts` -> 0

## Phase 2 — The surfaces call the module and cite one reference

- [x] **2.1 The commands validate by running.** `/commit` step 5 and
      `/commit:in-chunks` step 4 pipe the generated subjects through
      `agent-config git:convention subject` and act on the exit code;
      `/worktree:create` renders through `git:convention branch`. The regexes
      and the precedence paragraph (`commit/command.md:67-70`, `:134-138`) leave.
      verify: `test -z "$(git grep -l -F '[A-Z][A-Z0-9]+-[0-9]+' -- src/domains/git)"` -> 0
      Positive control: the same `git grep` prints two files at `2333b93d6`.
- [x] **2.2 One reference owns the prose.**
      `src/skills/git-workflow/references/commit-subject.md` holds ticket
      reading, placement, precedence, the area-scope clause `/commit:in-chunks`
      needs, and the title rule of 2.4. Its grammar block is generated from the
      module and registered in `check_generator_sync`; it is what a command
      falls back to when the verb cannot run, stated as
      `docs/contracts/capability-answerability.md:36-41` asks. `/commit`,
      `/commit:in-chunks`, `/fix:commit-messages`, `/create-pr:description-only`,
      `/worktree:create`, `jira-integration`, `docs/guidelines/php/git.md` and
      the commit skill's § 3 keep one line and the link, and the skill's
      "no executable classifier ships" sentence is corrected.
      verify: `test -f src/skills/git-workflow/references/commit-subject.md && ./scripts-run src/scripts/check_generator_sync --quiet` -> 0
- [x] **2.3 One ticket grammar in prose.** The commands and skills on
      `[A-Z]+-[0-9]+` cite the reference. The two `trigger_context:` entries and
      `migrate_command_suggestions.ts:119` stay as they are and are listed in the
      reference as suggester metadata (D4). The reference records
      `refine_ticket_detect.ts:74` as intentionally independent.
      verify: `test -z "$(git grep -l -F '[A-Z]+-[0-9]+' -- src/domains src/skills ':!*/estimate-ticket/*' ':!*/implement-ticket/*')"` -> 0
      Positive control: without the two exclusions the same `git grep` prints nine files at `2333b93d6`.
- [x] **2.4 A title that becomes a commit follows the convention.** Where the
      forge's merge method read in `/pr:merge` § 9 is squash,
      `/create-pr:description-only` § 3 builds the title through
      `git:convention subject`, for the default format as well as for
      `ticket-conventional`.
      verify: `grep -q 'git:convention subject' src/domains/git/pr/create/description-only/command.md` -> 0

## What this roadmap deliberately does not do

- No third ticket placement and no new settings key for ticket keys (D2).
- No change to `lint_commit_subjects`, which gates this repository's own
  history; parity between it and the module grammar is a separate reading.
- No commit-message tooling installed for a consumer: an existing hook or config
  outranks the module and is reported, never replaced.
- No golden-transcript harness for commands; the verb's exit codes are the
  tested surface.

## Acceptance Criteria

- [x] AC-1 — The branch `fix/CVE-2026-12345-patch` yields no ticket, with or
      without a card.
- [x] AC-2 — In a packed consumer install, `/commit` validates a subject through
      a call that resolves, and a ticket inside a compound scope is rejected.
- [x] AC-3 — No git command or skill restates a ticket grammar; the prose
      grammar block is generated and checked by `check_generator_sync`.
- [x] AC-4 — A branch name rendered by `/worktree:create` and one rendered by
      `git:convention branch` for the same inputs are identical.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | A ticket without a slot in the pattern prefixes the slug | That is what `jira-integration/SKILL.md:150-153` already tells the model to do | A team needs the ticket dropped instead |
| D2 | reversible-technical | agent | Ticket keys sit on the card and are passed by the caller | Ticket prefixes are `approved-observation` (`SKILL.md:245`); a settings key would red the settings ratchet | A repository carries trackers the card cannot express |
| D3 | deterministic | evidence | The renderer and the grammars are code reached through subcommands of one verb | A consumer project has no `node_modules`; the sibling roadmap's D4 | A second consumer-reachable carrier of code exists |
| D4 | reversible-technical | agent | Suggester trigger metadata keeps its literal and is listed as exempt | It matches prompts, not branch names, and editing it changes when a command is suggested (Risk 1) | The suggester reads its triggers from the module |
| D5 | reversible-technical | agent | The commit skill's § 3 names the families and links the generated grammar block; the `/fix:commit-messages` rewrite example reads the ticket through `git:convention ticket`, with no regex literal | AC-3 left two restatements after Phase 2; the generated block is the one checked copy | A measurement must run where the `agent-config` binary is unavailable |
| D6 | reversible-technical | agent | `git:convention subject` validates only against the convention in force (`.git-convention.yml`, a developer declaration, the approved card, the default); a `commit-msg` hook or a commitlint config adds one `note:` line saying it also runs at commit and may be stricter, never changes the exit, and is never interpreted. Exit 3 is removed from `subject` | R2 completion-review rounds 2–5 of the git-convention branch each found a new defect in inferring what such a validator accepts (hook precedence hiding the config, a comment read as config, a compatible config still halting `/commit:in-chunks`) | A validator's verdict can be obtained without running repository code |
| D7 | product-owned | owner | Under an approved family a subject without a ticket is the family's form without the ticket part, `fixup!` / `squash!` / `amend!` / git's `Revert "…"` are always valid — under both `git.commit_format` values as well, one rule everywhere a subject is checked — and a ticket, when present, stands in the family's leading position — every family treats its ticket as the `ticket-conventional` setting value does | Owner decision, 2026-10-07; an approved `ticket-prefix` card rejected `chore: apply formatting`, `Add thing without ticket` and `fixup! x` with exit 1, which stopped `/commit:in-chunks` on every branch without a ticket | A team needs a ticket on every subject and declares it |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Citing the reference changes when a command is suggested | implementation | 2.3 edits command text near what the suggester reads. | The two `trigger_context:` entries stay (D4) and the suggester's tests run unchanged. | Phase 2 — The surfaces call the module and cite one reference |
| 2 | The verb is not on the path | implementation | A consumer without `agent-config` on `PATH` cannot validate a subject. | 2.2 keeps the generated grammar block as the stated fallback. | Phase 2 — The surfaces call the module and cite one reference |
| 3 | A stricter grammar rejects subjects teams already write | product | Rejecting a ticket inside a compound scope changes what `/commit` accepts. | The rule applies only under the declared or approved convention; 1.2 prints each failure with the rule it broke. | Phase 1 — The grammars and one verb that computes them |
