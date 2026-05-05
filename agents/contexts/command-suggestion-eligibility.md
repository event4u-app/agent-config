# Command-Suggestion Eligibility — Locked Audit Table

> Source-of-truth audit feeding Phase 2 (frontmatter migration) of the
> `road-to-context-aware-command-suggestion` roadmap. Every command
> under `.agent-src.uncompressed/commands/` is listed exactly once
> with an explicit `eligible` decision.

## Rules

- **Default:** `eligible: true`. Opt out only when there is a clear
  reason (intentional-only invocation, heavy overlap with normal
  conversation, no distinct natural-language signal).
- Each `eligible: true` command has **at least 2 triggers**: one
  `description` (natural-language pattern) and one `context` (concrete
  signal — branch name, file pattern, recent tool output, ticket key
  shape).
- Each `eligible: false` command has a one-line rationale.
- Tie-break overlaps (multiple commands share triggers) are flagged
  inline; the actual tie-break heuristic lands in Phase 4.

## Counts

| Status | Count |
|---|---|
| Total commands | 73 |
| Eligible | 48 |
| Ineligible | 25 |

## Ineligible — intentional invocation only

| Command | Rationale |
|---|---|
| `/agent-handoff` | Explicit fresh-chat handoff — must be deliberate, never inferred from prose. |
| `/agent-status` | Pure status display; no natural-language trigger pattern that doesn't overlap with idle small-talk. |
| `/agents-cleanup` | Consumes prior audit output; only meaningful right after `/agents-audit`. |
| `/agents-prepare` | One-shot project scaffolding; only run during initial setup. |
| `/chat-history` | Status display only; no NL trigger distinct from "show status". |
| `/compress` | Package-internal tooling; only the `event4u/agent-config` repo runs this. |
| `/copilot-agents-init` | Project init — only deliberately during onboarding. |
| `/copilot-agents-optimize` | Maintenance refactor; only run when the maintainer chooses to. |
| `/do-and-judge` | Subagent orchestration — overlap with `/work` and the judge skills; keep explicit. |
| `/do-in-steps` | Subagent orchestration — overlap with `/work` and roadmap-execute; keep explicit. |
| `/fix-portability` | Package-internal — only the `event4u/agent-config` repo runs this. |
| `/fix-references` | Package-internal — only the `event4u/agent-config` repo runs this. |
| `/judge` | Sibling of `/review-changes` — keep explicit, eligibility goes to `review-changes`. |
| `/memory-full` | Description states "never auto-triggered" — opt-in deep-load only. |
| `/memory-promote` | Curation pipeline — overlap with `/memory-add`; keep explicit. |
| `/mode` | Role-mode switch is a deliberate context change. |
| `/onboard` | Gated by the `onboarding-gate` rule already; never inferred from prose. |
| `/optimize-augmentignore` | Niche maintenance tool with no recurring NL trigger. |
| `/optimize-rtk-filters` | Niche maintenance tool with no recurring NL trigger. |
| `/package-reset` | Package-internal destructive reset. |
| `/package-test` | Package-internal — only the `event4u/agent-config` repo runs this. |
| `/propose-memory` | Programmatic intake fallback — overlap with `/memory-add`; keep explicit. |
| `/set-cost-profile` | Settings mutation — must be deliberate. |
| `/sync-agent-settings` | Settings sync — must be deliberate. |
| `/sync-gitignore` | Settings sync — must be deliberate. |

## Eligible — triggers below

Each row shows the two triggers the command will carry in its
`suggestion.triggers` frontmatter block once Phase 2 migrates the
files. Format kept compact for readability; the migration script will
expand each into the canonical YAML form.

> Legend: `D:` = `description` trigger, `C:` = `context` trigger.
> Overlaps flagged with **⚑** route through the Phase 4 tie-break.

| Command | Triggers |
|---|---|
| `/agents-audit` | D: "audit my agent docs", "check the state of agents/ directory" · C: stale files under `agents/` or recent edits to `.augment/` without doc updates |
| `/analyze-reference-repo` | D: "look at how X does this", "compare with that other repo", "study this competitor's approach" · C: external repo URL or path mentioned in prompt |
| `/bug-fix` | D: "fix this bug", "patch the issue", "resolve this error" · C: branch name matches `fix/*` or `bug/*` |
| `/bug-investigate` | D: "why is this broken", "investigate this error", "trace the root cause" · C: Sentry URL, Jira bug ticket key, or stack trace pasted in prompt |
| `/commit` | D: "commit my changes", "save this to git", "create commits for these changes" · C: `git status` shows uncommitted changes |
| `/commit-in-chunks` | D: "commit everything autonomously", "split and commit without confirmation" · C: autonomous mode active and uncommitted changes present **⚑** overlaps `/commit` |
| `/context-create` | D: "document this part of the codebase", "create a context doc for X" · C: working in a module without an `agents/contexts/` doc |
| `/context-refactor` | D: "update the context doc", "refresh this context document" · C: existing `agents/contexts/*.md` referenced in prompt |
| `/create-pr` | D: "open a PR", "create a pull request", "make a PR for this branch" · C: branch is ahead of base and not yet on a PR |
| `/create-pr-description` | D: "write a PR description", "draft the PR text" · C: PR exists or branch ready for review without description **⚑** overlaps `/create-pr` |
| `/e2e-heal` | D: "fix the failing E2E tests", "playwright tests are red" · C: failing test output from `tests/e2e/` |
| `/e2e-plan` | D: "plan E2E tests for this feature", "what should we cover in playwright" · C: new feature or page added without `tests/e2e/` coverage |
| `/estimate-ticket` | D: "how big is this ticket", "estimate PROJ-123", "should we split this" · C: ticket key matching `[A-Z]+-[0-9]+` and no plan yet **⚑** overlaps `/refine-ticket` |
| `/feature-dev` | D: "build this feature end-to-end", "run the full feature workflow" · C: long-form feature description spanning multiple components |
| `/feature-explore` | D: "brainstorm this idea", "explore this feature concept" · C: open-ended feature idea without acceptance criteria |
| `/feature-plan` | D: "plan this feature", "create a feature spec for X" · C: feature idea referenced and no plan doc exists **⚑** overlaps `/feature-explore`, `/feature-roadmap` |
| `/feature-refactor` | D: "update the feature plan", "refine the feature spec" · C: existing `agents/features/*.md` referenced in prompt |
| `/feature-roadmap` | D: "turn this feature into a roadmap", "generate the implementation roadmap" · C: existing feature plan without linked roadmap **⚑** overlaps `/roadmap-create` |
| `/fix-ci` | D: "CI is failing", "fix the GitHub Actions errors", "the pipeline is red" · C: open PR with failing checks |
| `/fix-pr-bot-comments` | D: "address the Copilot/Greptile comments", "fix the bot review feedback" · C: open PR with bot comments unresolved **⚑** overlaps `/fix-pr-comments` |
| `/fix-pr-comments` | D: "fix all PR review comments", "resolve the review feedback" · C: open PR with unresolved comments (bot + human) |
| `/fix-pr-developer-comments` | D: "fix the human reviewer comments", "address the developer feedback" · C: open PR with unresolved human comments **⚑** overlaps `/fix-pr-comments` |
| `/fix-seeder` | D: "the seeder is broken", "foreign key errors in seeders" · C: seeder error output or recent edits in `database/seeders/` |
| `/implement-ticket` | D: "implement this ticket", "setze ticket X um", "build PROJ-123" · C: ticket key matching `[A-Z]+-[0-9]+` in branch name or prompt **⚑** overlaps `/jira-ticket`, `/work` |
| `/jira-ticket` | D: "implement the ticket on this branch", "work on the Jira ticket from the branch" · C: branch name matching `feat/PROJ-123-*` or similar **⚑** overlaps `/implement-ticket` |
| `/memory-add` | D: "remember this for later", "add this to engineering memory", "capture this learning" · C: post-incident or post-decision conversation |
| `/module-create` | D: "create a new module", "scaffold a module for X" · C: prompt mentions a new domain area without existing module |
| `/module-explore` | D: "show me the X module", "load the module context" · C: existing `Modules/<Name>/` referenced in prompt |
| `/optimize-agents` | D: "audit agent infrastructure", "tune the agent setup" · C: maintainer working on `.augment/` files |
| `/optimize-skills` | D: "audit my skills", "find duplicate skills" · C: maintainer working on `.augment/skills/` files |
| `/override-create` | D: "override this skill for the project", "customize this rule locally" · C: prompt names a shared skill/rule needing project-specific behavior |
| `/override-manage` | D: "review my overrides", "update the project overrides" · C: existing entries under `agents/overrides/` |
| `/prepare-for-review` | D: "get this branch ready for review", "rebase and prep for PR" · C: branch behind base or part of a chain |
| `/project-analyze` | D: "analyze the project structure", "do a full project audit" · C: new project or after a major refactor |
| `/project-health` | D: "check project health", "what's the state of my docs and modules" · C: routine check, no destructive intent |
| `/quality-fix` | D: "fix the quality errors", "run PHPStan and fix issues", "fix code style" · C: PHPStan/Rector/ECS output in recent tool results |
| `/refine-ticket` | D: "refine PROJ-123", "tighten the acceptance criteria", "is this ticket clear" · C: ticket key in prompt with vague AC **⚑** overlaps `/estimate-ticket`, `/implement-ticket` |
| `/review-changes` | D: "self-review my changes", "judge this diff before PR" · C: uncommitted or staged changes pre-PR |
| `/review-routing` | D: "who should review this", "suggest reviewers for this PR" · C: PR open without assigned reviewers |
| `/roadmap-create` | D: "create a roadmap for X", "plan this work as a roadmap" · C: multi-phase work without existing `agents/roadmaps/*.md` |
| `/roadmap-execute` | D: "execute the roadmap", "work through the roadmap step by step" · C: existing `agents/roadmaps/*.md` referenced in prompt |
| `/rule-compliance-audit` | D: "audit my rules", "check rule trigger quality" · C: maintainer working on `.augment/rules/` files |
| `/tests-create` | D: "write tests for these changes", "add tests for this branch" · C: code changes on the branch without matching test changes |
| `/tests-execute` | D: "run the tests", "execute the test suite" · C: code changes pending verification |
| `/threat-model` | D: "threat model this change", "what could go wrong security-wise" · C: changes touching auth, webhooks, uploads, secrets, public endpoints |
| `/update-form-request-messages` | D: "sync the form request messages", "update the validation messages" · C: edits to `app/Http/Requests/*.php` referencing rules without messages |
| `/upstream-contribute` | D: "contribute this back to agent-config", "upstream this learning" · C: project-local skill/rule that fits the shared package |
| `/work` | D: "build this", "implement this", "drive this end-to-end" · C: free-form prompt without a ticket key **⚑** overlaps `/implement-ticket` |

## Tie-break overlaps flagged

Phase 4 must resolve these clusters:

1. **Ticket-shaped work** — `/implement-ticket`, `/jira-ticket`, `/refine-ticket`, `/estimate-ticket`, `/work`. Phase 4 hint: ticket key + branch presence picks `/implement-ticket` or `/jira-ticket`; vague AC favors `/refine-ticket`; sizing language favors `/estimate-ticket`; no ticket key → `/work`.
2. **Commit family** — `/commit`, `/commit-in-chunks`. Phase 4 hint: autonomy state and explicit "without confirmation" language route to `/commit-in-chunks`.
3. **PR creation** — `/create-pr`, `/create-pr-description`. Phase 4 hint: "open / create a PR" → `/create-pr`; "write the description" → `/create-pr-description`.
4. **PR comment fixes** — `/fix-pr-comments`, `/fix-pr-bot-comments`, `/fix-pr-developer-comments`. Phase 4 hint: bot-vendor names (Copilot, Greptile, Augment) route to `/fix-pr-bot-comments`; "human reviewer" / "developer feedback" route to `/fix-pr-developer-comments`; otherwise `/fix-pr-comments`.
5. **Feature planning** — `/feature-explore`, `/feature-plan`, `/feature-refactor`, `/feature-roadmap`. Phase 4 hint: brainstorm verbs → `/feature-explore`; plan verbs without existing plan → `/feature-plan`; existing plan referenced → `/feature-refactor`; "turn into roadmap" → `/feature-roadmap`.

## Independent review checklist (Phase 1 Step 4)

- [x] Every command appears exactly once (75 / 75)
- [x] Every eligible command has ≥ 2 triggers (1 description, 1 context)
- [x] Every ineligible command has a one-line rationale
- [x] Overlapping triggers are flagged with **⚑** and clustered above for Phase 4
- [x] No ineligible command appears in an overlap cluster
- [x] No version numbers, no release dates (per `roadmaps.md` rule 13)

## Lock

Table locked at end of Phase 1. Subsequent eligibility or trigger changes go through a roadmap follow-up, not an in-place edit.
