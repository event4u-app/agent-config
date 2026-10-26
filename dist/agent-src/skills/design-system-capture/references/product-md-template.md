# PRODUCT.md template

The file `design-system-capture` writes on a first capture. It is a superset of
the product-truth format other design tools write, so a file either side
writes reads on both.

```markdown
# PRODUCT.md — [Project name]

> AI-readable product memory. Update when a new pattern is established.
> Last updated: [date]

## Register
[brand / product] — brand: the impression is the product; product: design serves the task.

## Users
[Who uses it, in what situation, with what at stake.]

## Purpose
[One sentence: what the product is for.]

## Anti-references
- [A product or style this must not look or behave like, and why.]

## Principles
1. [A design principle a reviewer can check.]

## Interaction patterns

### Destructive actions
Policy: [typed confirmation ("DELETE") / dialog with verb button / undo toast / etc.]
Example: "All destructive actions require the user to type 'DELETE' or the resource name."

### Mutation feedback
Policy: [optimistic UI + inline undo / loading spinner / success toast / etc.]
Undo window: [N seconds, or "not applicable"]
Example: "Optimistic UI for all mutations; inline undo toast for 5 seconds, then commit."

### Filter and sort persistence
Policy: [URL params / localStorage / session / not persisted]
Restore on load: [yes / no]

### Empty states
Approach: [illustration + CTA / text only / skeleton / etc.]
Example: "Illustration + primary CTA for empty lists; text-only for zero-search-results."

### Error handling
Approach: [inline field errors / toast / error boundary / etc.]
Network errors: [retry + message / fail fast / etc.]

### Navigation and routing
Pattern: [SPA / MPA / hybrid / etc.]
Active state: [how active nav items are marked]

### Mental model
One sentence: [how the product conceptualizes itself to the user]
Example: "Dashboard = control panel for power users, not an exploration space."
```
