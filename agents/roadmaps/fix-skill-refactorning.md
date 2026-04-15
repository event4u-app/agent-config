# fix-skill-refactorning

## Purpose

This roadmap documents what got weaker in PR #3, what should be sharpened again, and how to prevent the same regression pattern in future refactors and compression passes.

Primary goal:
- restore execution quality
- keep the cleanup and restructuring wins
- prevent "clean but generic" skills
- harden rules/skills/linter so this does not regress again

---

## Executive summary

PR #3 did many things right:

- reduced generic framework noise
- merged overlapping skills into clearer targets
- moved conventions into guidelines
- improved repo structure
- improved rule linting
- established a stronger audit baseline

But the PR also introduced a predictable regression pattern:

- some skills became too compressed
- some skills lost concrete decision power
- some procedures became heading-only outlines instead of executable steps
- some validations became less strict because the linter got relaxed
- some removed skills were correctly removed, but their strongest operational content was not fully preserved in the merge target

This roadmap keeps the structural wins of PR #3, while restoring the missing sharpness.

---

## What got worse overall

### 1. Procedure quality dropped in several skills

Pattern:
- long procedural skills were trimmed aggressively
- high-value examples, explicit checks, and decision matrices were moved out
- remaining skills often became “route to guideline + short checklist”

Why this is bad:
- skills stop being executable
- agents need to infer too much
- users get more generic answers again

Fix:
- every retained skill must still contain:
  - one inspect step
  - one choose/decide step
  - one apply/change step
  - one validate step with concrete checks
- guidelines can hold broad conventions, but skills must still hold the operational workflow

### 2. Validation was weakened by linter relaxation

Pattern:
- missing_validation was downgraded to warning
- Procedure was moved from required to recommended
- more skills become “lint-clean” even if they are less useful

Why this is bad:
- the repo can drift toward neat-looking but weak skills
- CI stops enforcing execution quality

Fix:
- make `Procedure` required for skills again
- make `missing_validation` an error again
- require at least one explicit validation checklist in every procedural skill

### 3. Some merges are correct structurally, but incomplete semantically

Pattern:
- multiple focused skills were merged into a single target
- but the target did not fully inherit the best examples / edge cases / quality gates of the removed skills

Why this is bad:
- fewer files, but also less targeted guidance
- merged skills risk becoming umbrella docs

Fix:
- for every merged target, restore:
  - the strongest example from each source skill
  - one anti-pattern per merged responsibility
  - one split/merge note that preserves scope boundaries

### 4. Guidelines extraction was good, but some skills became too dependent on guidelines

Pattern:
- conventions moved to `.augment.uncompressed/guidelines/**`
- some skills now mostly say “read guideline X” and do very little themselves

Why this is bad:
- agent execution quality depends on a second file lookup for basic steps
- the skill no longer stands on its own

Fix:
- skills should contain:
  - the workflow
  - the decision points
  - the validation
- guidelines should contain:
  - conventions
  - reference examples
  - style expectations
- do not move the operational core out of a skill

### 5. Some removals were correct, but a few removed skills need stronger successors

Pattern:
- generic framework skills were removed
- this was mostly correct
- but some replacement targets are still too shallow

Fix:
- do not restore deleted generic skills
- instead strengthen the target skill or the new guideline that replaced them

---

## Global fixes to implement now

### A. Tighten the linter again

Restore these rules:

1. `Procedure` is required for every skill
2. `missing_validation` is an error, not a warning
3. every skill must have at least one of:
   - numbered steps
   - ordered `### Step N` subsections
4. every skill must include at least one concrete validation check
5. every merged skill must include at least one example or anti-pattern from each merged responsibility
6. every management/meta-skill must include at least one “reject / do not proceed” condition
7. compressed skills must fail if they lose:
   - validation
   - decision hints
   - critical anti-failure guidance

### B. Update compression logic

Add this rule to compression behavior:

Compression must be rejected if it removes:
- specific validation checks
- concrete examples
- real failure patterns
- decision criteria needed to choose between two valid approaches

### C. Add a “minimum sharpness” rule for all skills

Every skill must answer:
1. When should I use this?
2. What exactly do I do?
3. How do I verify it worked?
4. What common failure must I avoid?

If one of these is weak, the skill is not done.

### D. Add a “merge preservation” checklist

When merging skills:
- list source skills
- copy best example from each source
- copy strongest failure mode from each source
- verify merged target is still narrow enough to execute
- if not, split again

---

## Rules and skills to update so this does not happen again

### Update `skill-writing`

Add:
- “Do not compress away concrete validation, examples, or anti-patterns”
- “When refactoring or merging, preserve the strongest example and strongest failure mode from the source skill”
- “A skill that only points to guidelines is incomplete”

### Update `skill-management`

Add:
- explicit reject rule for over-compression
- explicit merge-preservation checklist
- explicit requirement that compressed skill must still be executable without opening a second file for core workflow
- explicit restore rule for examples and critical checks

### Update `skill-reviewer`

Add mandatory checks:
- missing validation = fail
- Procedure missing = fail
- merged skill lost source examples = warn/fail
- skill depends too heavily on guideline references = warn
- anti-patterns too generic = warn

### Update `learning-to-rule-or-skill`

Add:
- “If a refactor removes concrete operational guidance, capture that as a regression learning”
- “Do not convert procedural content into pure guideline content if execution quality drops”

### Update `markdown-safe-codeblocks` rule

Keep the migration to rule, but add:
- “If code examples are needed inside template content, prefer plain text or tildes”
- “Do not wrap copy/paste templates in outer triple backticks unless explicitly requested”

### Update `guidelines` rule

Add:
- “Guidelines hold conventions; skills hold execution workflows”
- “Do not move the operational core of a skill into a guideline”

---

## Per-rule and per-skill fixes

## Rules

### `.augment.uncompressed/rules/markdown-safe-codeblocks.md`

Status:
- keep as rule
- migration from skill to rule was correct

What improved:
- the behavior is truly “always apply”, so a rule is a better fit than a skill

What got weaker:
- the old skill carried more operational advice around safe output strategies
- the rule is now correct, but too thin to prevent all related markdown regressions

Fix:
- keep this as rule
- add two more concrete constraints:
  - if nested code is required, use plain text or `~~~`
  - avoid wrapping copyable templates in an outer fence
- keep template-generation specifics in a complementary skill, not in the rule

### `.augment.uncompressed/rules/guidelines.md`

Status:
- keep
- strengthen

What improved:
- it now points to a wider and more useful guideline system

What got weaker:
- it needs to draw a harder boundary between guidelines and skills

Fix:
- explicitly state:
  - guidelines = conventions and reference knowledge
  - skills = executable workflows
- add “do not move procedural core from skills into guidelines”

---

## Merged / replacement target skills

### `api-design`

Source changes:
- absorbed `api-versioning`
- was also trimmed and moved toward guideline-driven content

What improved:
- fewer overlapping files
- better single entry point for API design decisions

What got weaker:
- scope got broader
- versioning + deprecation + base API design are now in one place
- concrete decision matrix for “extend v1 vs create v2” became less prominent
- implementation-independent but execution-critical examples were reduced

Fix:
- keep merged structure
- restore:
  - explicit “when to create a new version” decision matrix
  - deprecation workflow checklist
  - one concrete response-format example
  - one validation checklist for new API designs
- add a dedicated subsection:
  - `### Validate API design`
  - check route/version naming, error format, pagination, resource usage, backward compatibility

### `learning-to-rule-or-skill`

Source changes:
- absorbed `post-task-learning-capture`

What improved:
- less duplication between “capture” and “decide”
- stronger single flow from learning → codification

What got weaker:
- the “after finishing a task” trigger became less explicit
- retrospective capture can get lost behind the classification logic
- practical prompts/examples for extraction are easier to miss

Fix:
- keep merged structure
- re-add an explicit first mode:
  - `Mode: Post-task capture`
- include:
  - 3 concrete retrospective questions
  - one example for a weak learning
  - one example for a promotable learning
- validation:
  - “Would this matter more than once?”
  - “Does this change future behavior?”

### `universal-project-analysis`

Source changes:
- absorbed `project-analysis-laravel`

What improved:
- less framework-specific duplication
- reusable base for project-analysis

What got weaker:
- Laravel-specific discovery paths / checks likely became less visible
- framework mode behavior risks becoming implied instead of explicit

Fix:
- keep universal skill
- add `Framework modes` subsection with at least:
  - Laravel
  - generic PHP
- for Laravel mode, restore:
  - check routes, containers, config, jobs/events, service layer, tests, task/make commands
- add one validation output shape:
  - architecture summary
  - entry points
  - risks
  - next actions

### `skill-reviewer`

Source changes:
- merged `skill-linter` + `skill-validator`

What improved:
- clearer single review target
- less duplication

What got weaker:
- the merged skill risks becoming a checklist without enough enforcement detail
- some checks from the deleted linter/validator can disappear into generalities

Fix:
- keep merged structure
- restore:
  - explicit fail conditions
  - explicit warn conditions
  - explicit duplication checks
  - explicit compression-safety checks
- include a minimum verdict model:
  - pass
  - pass with warnings
  - fail
- include exact examples of:
  - vague validation
  - too-broad trigger
  - missing required section

### `skill-management`

Source changes:
- merged `skill-caveman-compression`, `skill-decompression`, `skill-refactor`

What improved:
- much better lifecycle coverage in one place
- easier to discover

What got weaker:
- the merged skill is at risk of becoming “management overview” instead of a sharp operator tool
- the old specialized compression/decompression failure modes may get diluted

Fix:
- keep merged structure
- strengthen each mode with:
  - one concrete anti-pattern
  - one reject condition
  - one validation checklist
- add a final merge-preservation section:
  - if refactoring removes examples, decision hints, or validation, reject the result
- add mode-specific output shapes

### `pest-testing`

Source changes:
- absorbed `test-generator`

What improved:
- tighter focus on the project’s preferred testing style

What got weaker:
- pure “generate tests” workflow may now be less explicit
- generation checklist may be weaker after merge

Fix:
- keep `pest-testing`
- restore:
  - test-generation checklist
  - expected assertions categories
  - anti-patterns for weak generated tests
- require final validation:
  - test fails before change if appropriate
  - test passes after change
  - assertions check behavior, not only existence

---

## Deleted skills: keep removed, but verify successor quality

The following removals are directionally correct and should stay removed unless no adequate successor exists:

- `cloudflare-workers`
- `composer`
- `graphql`
- `guidelines`
- `javascript`
- `markdown-template-generator`
- `microservices`
- `mobile`
- `nextjs`
- `npm-packages`
- `npm`
- `nuxt`
- `php`
- `react`
- `readme-generator`
- `tailwind`
- `typescript`
- `vue`
- `wordpress`

Why removal was mostly correct:
- these were generic framework knowledge or too broad to act as sharp skills

What to verify:
- if a deleted skill contained a real workflow, that workflow must exist in a narrower successor
- do not restore these as broad skills

Concrete follow-up:
- check whether any deleted skill had a unique operational checklist
- if yes, migrate only that checklist into a focused surviving skill

---

## Deleted but must be preserved through better successors

### `markdown-template-generator` (deleted)

Status:
- do not restore as-is
- but preserve the useful operational guidance elsewhere

What got lost:
- explicit copy/paste-safe markdown template workflow
- practical guardrails for nested fences and template generation

Fix:
- split its useful parts into:
  - rule: `markdown-safe-codeblocks`
  - target skill: whichever skill generates markdown templates/docs in practice
- ensure one surviving skill still teaches:
  - structure first
  - placeholders
  - safe examples
  - copyability validation

### `post-task-learning-capture` (deleted)

Status:
- do not restore as separate skill if `learning-to-rule-or-skill` is strengthened

What got lost:
- explicit post-task timing and reflection trigger

Fix:
- restore this as a mode inside `learning-to-rule-or-skill`

### `skill-caveman-compression` / `skill-decompression` / `skill-refactor` / `skill-linter` / `skill-validator` (deleted)

Status:
- do not restore as separate files if `skill-management` and `skill-reviewer` become strong enough

What got lost:
- sharp specialization
- mode-specific edge cases
- clearer anti-patterns per responsibility

Fix:
- strengthen the merged targets instead of re-splitting immediately
- if merged targets become too broad again, split by mode later

### `project-analysis-laravel` (deleted)

Status:
- keep deleted if Laravel mode is restored strongly inside `universal-project-analysis`

What got lost:
- framework-specific discovery sharpness

Fix:
- re-add Laravel mode checklist to universal target

### `api-versioning` (deleted)

Status:
- keep deleted if `api-design` restores explicit versioning/deprecation logic

What got lost:
- version bump decision logic
- migration/deprecation flow

Fix:
- restore those as concrete subsections in `api-design`

### `test-generator` (deleted)

Status:
- keep deleted if `pest-testing` restores generation workflow

What got lost:
- test creation checklist and anti-patterns

Fix:
- restore that inside `pest-testing`

---

## Skills trimmed and moved to guidelines: where they got weaker and how to sharpen them

The following skills were trimmed heavily in Phase 3. The direction was correct, but each needs a “minimum sharpness pass”.

### `database`

What improved:
- less generic theory in the skill
- guideline extraction is sensible

What got weaker:
- current skill is too centered on query optimization
- schema/index/connection decision logic likely became thinner
- moved too much operational detail to guideline

Fix:
- keep workflow skill
- restore:
  - separate flows for schema design vs query optimization vs indexing
  - one EXPLAIN-driven validation checklist
  - one multi-connection safety checklist
- add anti-patterns:
  - index everything
  - paginate with offset on huge tables
  - forget connection in multi-DB project

### `dashboard-design`

What improved:
- likely shorter and easier to scan

What got weaker:
- design-review and dashboard-specific UX tradeoffs may now be under-specified
- risk of becoming generic FE advice

Fix:
- restore:
  - audience / KPI / density / interaction checklist
  - one validation checklist for “good dashboard”
  - anti-patterns for overloading, mixing chart types, no hierarchy

### `eloquent`

What improved:
- much less framework-documentation weight
- clearer trigger

What got weaker:
- relationship/scopes/query/loading decision guidance likely got thinned too much
- easy to lose sharp distinctions between model logic, query logic, and service logic

Fix:
- restore:
  - choose relationship vs query scope vs accessor vs service
  - eager loading validation checklist
  - N+1 detection checklist
  - one relationship design example
- keep conventions in guideline, but keep workflow in skill

### `jobs-events`

What improved:
- less noisy content
- conventions moved out

What got weaker:
- jobs vs events decision boundary can blur
- queue safety / idempotency / retry handling may now depend too much on guideline lookup

Fix:
- restore:
  - “Use job vs event vs listener” decision matrix
  - retry / idempotency validation
  - one failure-mode example for duplicate processing

### `websocket`

What improved:
- less theory
- likely cleaner scope

What got weaker:
- channel type, authorization, broadcasting flow, reconnect behavior may now be too thin
- risk of “just read guideline” behavior

Fix:
- restore:
  - public/private/presence channel decision matrix
  - auth + event + frontend subscription checklist
  - one validation checklist using real client/server flow
  - anti-patterns for auth bypass and stale subscriptions

### `naming`

What improved:
- conventions moved to guideline where they belong

What got weaker:
- the operational use case “name this thing correctly in this project” may now be underpowered

Fix:
- keep skill only if it remains a naming decision workflow
- restore:
  - naming by artifact type (class, route, table, variable, job, event)
  - “check neighboring code first” step
  - one consistency validation checklist
- if it cannot stay executable, convert more of it to guideline and narrow the skill

### `logging-monitoring`

What improved:
- less broad reference content in skill

What got weaker:
- level choice, structured context, alerting significance, and Sentry/Grafana handoff may now be less concrete

Fix:
- restore:
  - choose debug/info/warn/error matrix
  - context checklist
  - redaction/sensitive-data anti-patterns
  - one validation checklist for actionable logs

### `artisan-commands`

What improved:
- conventions now have a good guideline target

What got weaker:
- destructive command safety and scheduler/non-interactive behavior may be too shallow in skill form

Fix:
- restore:
  - manual vs scheduled command decision
  - destructive-command safeguard checklist
  - one validation checklist: exit codes, output, side effects, no interaction in CI/scheduler

### `security`

What improved:
- conventions extracted well

What got weaker:
- audit flow may now be thinner than the topic requires
- risk of generic “security best practices” instead of repeatable review workflow

Fix:
- restore:
  - auth / authorization / input / output / transport review sequence
  - one validation checklist
  - one high-risk anti-pattern per category

### `livewire`

What improved:
- conventions moved out

What got weaker:
- state/action/lifecycle/debugging workflow may now be too terse
- performance and Alpine boundary may be easier to miss

Fix:
- restore:
  - state flow checklist
  - validation for wire:model / actions / re-render behavior
  - anti-patterns for bloated components and duplicated Alpine logic

### `git-workflow`

What improved:
- likely more focused

What got weaker:
- branch / commit / PR flow may now be too generic
- project-specific release / review expectations may be less visible

Fix:
- restore:
  - branch naming, commit scope, PR checklist
  - one validation checklist before push/PR
  - anti-patterns for mixed-purpose PRs and hidden breaking changes

### `performance`

What improved:
- conventions extracted to guideline

What got weaker:
- the actual optimization workflow can become too general
- risk of jumping to caching before measuring

Fix:
- restore:
  - measure → identify bottleneck → choose fix → validate
  - one profiling checklist
  - anti-patterns for premature optimization and missing benchmarks

### `laravel-validation`

What improved:
- less framework background in skill

What got weaker:
- boundary between inline validation, FormRequest, custom rule, and after hooks may now be less explicit

Fix:
- restore:
  - choose validation mechanism matrix
  - one validation checklist
  - anti-patterns for controller-heavy validation and inconsistent messages

### `blade-ui`

What improved:
- conventions extracted to guideline

What got weaker:
- component vs partial vs inline view logic decisions can become too thin
- escaping/output-safety checks may now be too guideline-dependent

Fix:
- restore:
  - choose partial vs component matrix
  - output-safety checklist
  - anti-patterns for business logic in templates and repeated markup

### `sql`

What improved:
- less reference-heavy content in skill

What got weaker:
- raw SQL usage path may now lack concrete safety + performance checks
- MariaDB / parameterization / explain flow may be too thin

Fix:
- restore:
  - when to use raw SQL vs query builder vs Eloquent
  - parameterization checklist
  - EXPLAIN validation checklist
  - anti-patterns for string interpolation and `SELECT *`

### `coder`

What improved:
- likely cleaner and more execution-focused

What got weaker:
- risk of becoming too generic if broad coding guidance was removed without replacing it with tighter operational constraints

Fix:
- narrow trigger further if needed
- keep only workflow for implementing requested code safely
- add explicit output shape and validation expectations

### `php-service`

What improved:
- likely more focused on service layer

What got weaker:
- service vs action vs job vs controller boundaries may be under-specified

Fix:
- restore:
  - choose service placement checklist
  - side-effect boundary rules
  - one example of good orchestration vs bad fat service

### `flux`

What improved:
- conventions moved to guideline

What got weaker:
- practical “when to use Flux component vs existing project UI primitive” may be too weak

Fix:
- restore:
  - check project usage first
  - choose Flux vs existing partial/component
  - validation checklist for accessibility + consistency

### `commands`

What improved:
- now has gotcha

What got weaker:
- still at risk of being too broad/meta

Fix:
- narrow to command invocation / command-response behavior
- include one concrete decision about when to create a command vs use a skill vs use a rule

### `laravel`

What improved:
- now lint-cleaner

What got weaker:
- still likely broad

Fix:
- either:
  - narrow to a real workflow, or
  - treat as top-level router skill that sends to focused Laravel skills
- do not let it become “everything Laravel”

### `quality-tools`

What improved:
- gotcha added

What got weaker:
- may still be more catalog than workflow

Fix:
- restore:
  - inspect → run relevant tool → fix issues → re-run → confirm clean
- add tool-choice matrix

### `override`

What improved:
- now has `When to use` and `Gotcha`

What got weaker:
- probably still fragile if override semantics are not explicit enough

Fix:
- define:
  - when override is appropriate
  - precedence order
  - validation for whether override actually took effect

### `test-performance`

What improved:
- Do NOT added

What got weaker:
- likely still light on concrete performance-test validation

Fix:
- add:
  - setup checklist
  - metric thresholds
  - regression validation steps

### `skill-writing`

What improved:
- vague validation example fixed
- remains one of the strongest meta-skills

What got weaker:
- after PR #3, it still needs stronger anti-overcompression rules

Fix:
- add explicit “merge/refactor preservation” section
- add “a skill that only points to guidelines is incomplete”
- add “do not downgrade concrete checks during refactor”

---

## Skills that appear mostly safe after this PR

These appear to have mainly structural/heading-level updates and likely do not need major changes beyond standard linting:

- `adversarial-review`
- `agent-docs`
- `agents-audit`
- `analysis-autonomous-mode`
- `api-endpoint`
- `api-testing`
- `aws-infrastructure`
- `bug-analyzer`
- `code-review`
- `composer-packages`
- `context`
- `copilot`
- `copilot-agents-optimizer`
- `dependency-upgrade`
- `design-review`
- `devcontainer`
- `docker`
- `dto-creator`
- `fe-design`
- `feature-planning`
- `file-editor`
- `github-ci`
- `grafana`
- `jira`
- `laravel-horizon`
- `laravel-mail`
- `laravel-middleware`
- `laravel-notifications`
- `laravel-pennant`
- `laravel-pulse`
- `laravel-reverb`
- `performance-analysis`
- `qa-testing`
- `scheduler`
- `security-audit`
- `support`
- `theme-analyzer`
- `ui-developer`

Action:
- run them through the stronger linter once global rules are restored
- only patch them if validation/examples are actually weak

---

## Other changes in the PR: assessment

### Audit baseline and results template

Assessment:
- very good
- keep

Why:
- gives you a measurable starting point
- enables batch processing
- creates objective prioritization

Improve:
- add a column for:
  - “lost sharpness after refactor”
  - “needs example restored”
  - “needs validation restored”

### Rule linter improvements

Assessment:
- mostly very good
- keep the new frontmatter and structure checks

Problem:
- linter became more permissive on the wrong axis

Fix:
- keep:
  - frontmatter checks
  - type/source checks
  - heading/newline/blank-line checks
- revert:
  - `Procedure` from recommended back to required
  - `missing_validation` from warning back to error

### Guidelines expansion

Assessment:
- good and worth keeping

Problem:
- some skills became too dependent on these new guidelines

Fix:
- no rollback needed
- instead sharpen the skills so they own workflow again

---

## Implementation order

### Phase 1 — Guardrails first

1. tighten linter
2. update `skill-writing`
3. update `skill-management`
4. update `skill-reviewer`
5. update `guidelines` rule

### Phase 2 — Restore merged target sharpness

1. `api-design`
2. `learning-to-rule-or-skill`
3. `universal-project-analysis`
4. `skill-reviewer`
5. `skill-management`
6. `pest-testing`

### Phase 3 — Restore trimmed procedural skills

High priority:
- `database`
- `eloquent`
- `jobs-events`
- `websocket`
- `artisan-commands`
- `security`
- `performance`
- `laravel-validation`
- `sql`

Medium priority:
- `blade-ui`
- `livewire`
- `logging-monitoring`
- `naming`
- `git-workflow`
- `dashboard-design`
- `php-service`
- `flux`
- `commands`
- `quality-tools`
- `override`
- `test-performance`
- `laravel`

### Phase 4 — Verify deletion successors

Check deleted skills one by one and confirm:
- no lost workflow remains
- strongest examples were preserved
- strongest failure patterns were preserved

---

## Definition of done

This refactor is complete when:

- every surviving skill is executable again
- every merged target preserved the best content from its sources
- linter fails on missing validation
- Procedure is required again
- no skill is only a pointer to guidelines
- deleted generic skills stay deleted
- no restored detail reintroduces broad framework-documentation bloat

---

## Final principle

Keep the structural cleanup of PR #3.

Do NOT revert the direction.

Instead:
- restore sharpness
- restore validation
- restore decision power
- restore examples where they carry execution value

The package should be:
- smaller
- cleaner
- stricter
- and still operationally sharper than before
