---
applies_to: []
reliability: high
last_verified: 2026-06-15
---

# Nested conditionals → guard clauses (early return)

## Problem

The happy path is buried inside three levels of `if`. The reader tracks every
open brace to find what the function actually returns, and the error cases are
tangled with the success case. Arrow-shaped code (deep indentation that peaks in
the middle) is the visual tell.

## Before

```
function publish(post) {
  if (post != null) {
    if (post.isDraft) {
      if (user.canPublish) {
        return doPublish(post);   // the real work, 3 levels deep
      } else { throw new Forbidden(); }
    } else { throw new AlreadyLive(); }
  } else { throw new NotFound(); }
}
```

## After

Invert each condition into an early return/throw; the happy path falls through to
the bottom at the top indentation level.

```
function publish(post) {
  if (post == null)     throw new NotFound();
  if (!post.isDraft)    throw new AlreadyLive();
  if (!user.canPublish) throw new Forbidden();
  return doPublish(post);          // happy path, flat
}
```

## Verification

The function's deepest indentation drops to one level for the happy path, and
each error case has its own one-line guard. Existing tests must stay green —
this is a pure behavior-preserving refactor; a changed test means you altered
logic, not shape.

## Gotchas

- Preserve the original **order** of checks when they have side effects or when
  one guard depends on a previous one passing (e.g. null-check before field
  access).
- Don't merge distinct error cases into one guard to "save lines" — each
  guard should map to one failure with its own message.
- Loops use `continue` as the guard, not `return`.
