# Feature Planning Template

Templates for feature plan files stored in `agents/features/` or `app/Modules/{Module}/agents/features/`.

---

## Rules for Feature Plans

1. **Collaborative.** Feature plans are created interactively with the user, not auto-generated.
2. **Decision-focused.** Capture problems, proposals, scope, and tradeoffs — not implementation steps.
3. **Linked.** Reference affected modules, related features, and generated roadmaps.
4. **Language:** All feature plans must be written in **English**.
5. **One feature per file.** Don't combine unrelated features.
6. **Keep it concise.** Aim for 100–300 lines. If larger, the feature should be split.

---

## Status Values

| Emoji | Status | Meaning |
|---|---|---|
| 💡 | Idea | Rough concept, not yet validated |
| 🔍 | Exploring | Being researched and brainstormed |
| 📋 | Planned | Structured plan complete, ready for roadmap |
| 🗺️ | Roadmapped | Roadmap(s) generated, ready for implementation |
| 🔄 | In Progress | Implementation started |
| ✅ | Complete | Feature shipped |
| ❌ | Rejected | Decided not to build |
| ⏸️ | On Hold | Paused for external reasons |

---

## Template

Copy the structure below into a new file:

```markdown
# Feature: {title}

> {One sentence: What does this feature do and why?}

**Status:** 💡 Idea
**Created:** {YYYY-MM-DD}
**Author:** {name}
**Jira:** {ticket/epic links or "none" — e.g. [DEV-1234]({JIRA_BASE_URL}/browse/DEV-1234)}
**Module:** {module name or "project-wide"}
**Context:** {path to context document or "none"}

## Problem

{What pain point does this solve? Who is affected? What happens today without this feature?}

## Proposal

{What's the proposed solution? Keep it high-level — describe the outcome, not the implementation.}

## Scope

### In Scope

- {What this feature includes}
- {Specific functionality}

### Out of Scope (deferred)

- {What this feature does NOT include}
- {Features to consider later}

## Affected Areas

| Area | Impact |
|---|---|
| Module: {name} | {what changes} |
| Model: {name} | {new fields, relationships} |
| API: {endpoint} | {new/changed endpoints} |
| UI: {view/component} | {new/changed views} |
| Migration | {schema changes} |

## Technical Approach

{High-level architecture decisions. Which patterns to follow? Which existing services to extend?
Reference existing code where helpful.}

### Options Considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| {Option A} | {pros} | {cons} | ✅ Chosen / ❌ Rejected |
| {Option B} | {pros} | {cons} | ✅ Chosen / ❌ Rejected |

## Open Questions

- [ ] {Unresolved question 1}
- [ ] {Unresolved question 2}

## Dependencies

- {Other features or changes this depends on}
- {External services or packages needed}

## Acceptance Criteria

- [ ] {Measurable outcome 1}
- [ ] {Measurable outcome 2}
- [ ] All quality gates pass (PHPStan, Rector, tests)

## Roadmaps

_No roadmaps generated yet. Run `/feature-roadmap` to create implementation roadmaps._

## Notes

{Optional: edge cases, risks, references, related discussions.}
```

---

## Tips

- **Start with the Problem.** If you can't articulate the problem, the feature isn't ready.
- **Be specific in Scope.** "Out of Scope" is as important as "In Scope".
- **List Affected Areas early.** This helps estimate effort and identify risks.
- **Use Options Considered.** Document why you chose one approach over another.
- **Link to code.** "See `app/Modules/Import/App/Services/ImportService.php`" is better than "the import service".

