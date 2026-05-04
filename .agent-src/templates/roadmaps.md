# Roadmap Template

Templates for roadmap files stored in `agents/roadmaps/` or `app/Modules/{Module}/agents/roadmaps/`.

---

## Rules for Roadmaps

1. **Be precise and concise.** Aim for 500–1000 lines max. If larger, split into multiple files.
2. **Checkboxes are mandatory, not decorative.** Every active roadmap MUST contain at least one `- [ ]` per non-intro phase. Decision tables, ICE matrices, and block-sequencing tables capture the *why*; checkboxes capture the *what to do next*. A roadmap without checkboxes is invisible to `agents/roadmaps-progress.md` — the dashboard cannot count it, the next reader thinks no work is planned. Enforced by [`roadmap-progress-sync`](../rules/roadmap-progress-sync.md) Iron Law #2.
   - **Status is binary: `ready` (default) or `draft`.** New roadmaps are created **ready** unless the user explicitly says draft — `ready` is implicit and need not be written. Drafts declare it via frontmatter at the top of the file (`---\nstatus: draft\n---`) and are hidden from the dashboard until the flag is removed or flipped to `ready`. Use `draft` while the roadmap is still being authored, while waiting for upstream decisions, or as a capture-only synthesis that has not been promoted to executable phases. There are no other status values; legacy banners like `**Status: directional**` are removed.
3. **State the goal first.** One sentence at the top — what is the outcome?
4. **List prerequisites** — what must exist or be running before starting.
5. **Reference existing code** — point to files, classes, or modules.
6. **Define acceptance criteria** — how do we know the task is done?
7. **Include quality gates** — which commands must pass.
8. **Language:** All roadmap files must be written in **English**.
9. **Improve on read:** When processing a roadmap, check if it follows this template and suggest
   improvements if it doesn't.
10. **Keep docs up to date:** If changes affect documented behavior, update the relevant agent docs.
11. **One task per file.** Don't combine unrelated work.
12. **Lifecycle:** Every roadmap ends in exactly one folder:
    - `agents/roadmaps/` — active (in progress or planned)
    - `agents/roadmaps/archive/` — work happened (fully or partially); no further work planned
    - `agents/roadmaps/skipped/` — decision against pursuit; typically 0 items `[x]` (superseded, scope rejected)

    See the `roadmap-management` skill for the exact trigger matrix and user-confirmation flow.
13. **No tags, releases, or version numbers.** Roadmaps describe work, not shipping.
    Never assign version suffixes to phases (`Phase 1 — v1.8.0`), never write
    "Target release: X.Y.Z", never plan git tags or deprecation dates. Release
    and tag decisions belong to the user and are taken outside the roadmap.
    This is enforced by [`scope-control`](../rules/scope-control.md#git-operations--permission-gated).
14. **No automatic branch switches mid-roadmap.** Roadmap work runs on the
    branch the user is on. If a separate branch (spike, hotfix, experiment)
    would be genuinely useful, the agent may propose it **once** while
    creating the roadmap — not during execution. Default: stay on the
    current branch. If the user declines, the topic is closed for this
    roadmap. See [`scope-control`](../rules/scope-control.md#decline--silence--no-re-asking-on-the-same-task).

---

## Quality Gates (always apply)

Every roadmap must pass these before it is considered done:

Run the project's quality pipeline and test suite. Common commands:

```bash
# PHP projects (inside Docker container if applicable)
vendor/bin/phpstan analyse           # Static analysis
vendor/bin/rector process            # Auto-fix refactoring
vendor/bin/ecs check --fix           # Auto-fix code style
php artisan test                     # Tests (or: vendor/bin/phpunit)

# Non-Laravel projects — check Makefile/Taskfile for quality commands
```

Check `AGENTS.md` or `Makefile` / `Taskfile.yml` for the exact commands.

---

## Template

Copy the structure below into a new file:

```markdown
---
complexity: lightweight
---

# Roadmap: {Short descriptive title}

> {One sentence: What is the expected outcome?}

## Prerequisites

- [ ] Read `AGENTS.md` and relevant module docs
- [ ] {specific prerequisites}

## Context

{Why this roadmap exists. Which module/domain. Links to Jira tickets and feature plans.}

- **Feature:** {path to feature plan or "none"}
- **Jira:** {ticket links or "none"}

## Phase 1: {Phase name}

- [ ] **Step 1:** {Clear, actionable instruction}
- [ ] **Step 2:** {Next step — reference files/classes}
- [ ] ...

## Phase 2: {Phase name}

- [ ] **Step 1:** {description}
- [ ] ...

## Acceptance Criteria

- [ ] {Observable, testable criterion}
- [ ] All quality gates pass (PHPStan, Rector, tests)

## Notes

{Optional: edge cases, decisions, links to related docs.}
```

---

## Tips

- **Don't describe architecture** the agent can read from `AGENTS.md` — just reference it.
- **Don't repeat coding standards** — they live in `.github/copilot-instructions.md`.
- **Do reference specific files:** "See `app/Modules/Import/App/Services/ImportService.php`"
  is better than "look at the import service."
- **Do define boundaries:** State what the agent should NOT touch or change.
- **Do include example inputs/outputs** for non-obvious behavior.
- **Do split large tasks** — an agent works better with a focused 500-line file than a sprawling 2000-line one.
- **One task per file.** Don't combine unrelated work.

