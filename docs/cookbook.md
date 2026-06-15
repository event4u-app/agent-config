# Cookbook — things you can do in a minute

> **Generated** by `scripts/generate_cookbook.py` from `src/flows/cookbook.yaml` + `src/flows/<flow>.yaml` — do NOT hand-edit.
> Every command and skill below is validated to exist at generation time; a recipe naming a missing command fails the build.

Each recipe is a short command sequence. Run the commands in order; the listed skills are the capabilities they compose.

## Named recipes

### Review a change before it ships

*You have a diff and want a real review, not a rubber-stamp.*

- **Commands:** `/review-changes` → `/judge` → `/quality-fix`
- **Skills:** `code-review`, `adversarial-review`

### Fix a red CI run

*CI is failing and you want the failure pinpointed and fixed.*

- **Commands:** `/fix/ci`
- **Skills:** `systematic-debugging`

### Build a feature from a ticket

*You have a ticket and want it refined, estimated, and implemented.*

- **Commands:** `/refine-ticket` → `/estimate-ticket` → `/implement-ticket`
- **Skills:** `feature-planning`, `test-driven-development`

### Plan a feature before writing code

*The ask is fuzzy and you want a bounded plan first.*

- **Commands:** `/feature/explore` → `/feature/plan`
- **Skills:** `feature-planning`, `complexity-first-planning`

### Security-audit a surface

*You touched auth / billing / tenancy and want abuse cases first.*

- **Commands:** `/threat-model` → `/judge/solo`
- **Skills:** `threat-modeling`, `security-audit`

### Open a pull request

*The work is done and you want a clean PR ready for review.*

- **Commands:** `/prepare-for-review` → `/pr/create`
- **Skills:** `requesting-code-review`, `conventional-commits-writing`

### Research a topic deeply

*You need a multi-source, fact-checked report, not a guess.*

- **Commands:** `/research/deep` → `/research/report`
- **Skills:** `deep-reading-analyst`

### Investigate and fix a bug

*Something is broken and you want root cause before the patch.*

- **Commands:** `/bug-investigate` → `/bug-fix`
- **Skills:** `systematic-debugging`, `bug-analyzer`

### Get a second opinion from the AI council

*A design call is genuinely contested and you want independent models.*

- **Commands:** `/council/design` → `/council/debate`
- **Skills:** `ai-council`

### Process a roadmap autonomously

*You have a roadmap and want it worked end-to-end.*

- **Commands:** `/roadmap/create` → `/roadmap/process-full`
- **Skills:** `roadmap-management`

### Refactor with a safety net

*You want to restructure code without changing behaviour.*

- **Commands:** `/feature/refactor` → `/review-changes` → `/judge`
- **Skills:** `code-refactoring`, `test-driven-development`

### Commit in logical chunks

*You have a messy working tree and want clean, scoped commits.*

- **Commands:** `/commit/in-chunks`
- **Skills:** `conventional-commits-writing`

### Analyze an unfamiliar project

*You just opened a repo and want a fast structural read.*

- **Commands:** `/project-analyze` → `/project-health`
- **Skills:** `project-analyzer`

### Estimate a ticket

*You need a defensible estimate with the reasoning shown.*

- **Commands:** `/estimate-ticket`
- **Skills:** `estimate-ticket`

### Run a blame-free post-mortem that teaches the next change

*An incident, near-miss, or risky plan needs analysis that closes the learning loop.*

- **Commands:** `/analyze`
- **Skills:** `blameless-post-mortem`, `root-cause-frameworks`

### Upgrade a Laravel app one major version

*You want a gated, catalog-driven Laravel major-version upgrade (10→11) on a provisional branch — never auto-PR.*

- **Commands:** `/mission/upgrade`
- **Skills:** `dependency-upgrade`

## The four work flows

Broader than a single recipe — the end-to-end shapes most work follows.

### Discovery flow

Explore, plan, estimate, refine, and investigate before building. The "what should we build and how" front of the developer journey.

- **Path:** `/feature/explore` → `/feature/plan` → `/estimate-ticket` → `/refine-ticket`
- **Skills:** `feature-planning`, `estimate-ticket`, `refine-ticket`, `project-analysis-core`, `validate-feature-fit`

### Implementation flow

Build it. The core "make the change" front — drive a prompt, ticket, or feature end-to-end through plan → implement → verify.

- **Path:** `/work` → `/review-changes` → `/quality-fix` → `/commit`
- **Skills:** `test-driven-development`, `code-review`, `systematic-debugging`, `git-workflow`

### Review flow

Check it. Self-review, judge, quality-fix, and threat-model a change before it ships.

- **Path:** `/review-changes` → `/judge` → `/quality-fix` → `/threat-model`
- **Skills:** `code-review`, `adversarial-review`, `quality-tools`, `threat-modeling`, `receiving-code-review`

### Delivery flow

Ship it. Commit in logical chunks, open the PR, answer review comments, and prepare the branch for review.

- **Path:** `/commit` → `/pr/create` → `/fix/pr-comments`
- **Skills:** `conventional-commits-writing`, `git-workflow`, `requesting-code-review`
