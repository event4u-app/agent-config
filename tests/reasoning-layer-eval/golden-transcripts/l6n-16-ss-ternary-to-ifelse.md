# Transcript — slot 16: ss-ternary-to-ifelse

- **Band:** standard · **Mechanism:** stateless
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Rewrite a deeply nested ternary as an if/else chain for readability — what's the general approach?

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

This is a straightforward refactoring task with no ambiguity or load-bearing unknowns. The request is asking for the *general approach*, not a specific code fix, so I'll give a clear, reusable pattern. No reasoning protocol needed here—it's a naming-and-explaining job.

## Answer

**General approach:**

1. **Extract the condition** at each ternary level into its own `if` or `else if` block.
2. **Assign to a single variable** (or return early) in each branch.
3. **Read top-to-bottom** instead of nesting right-to-left.

**Example:**

```javascript
// Before: deeply nested
const status = user.isAdmin 
  ? 'admin' 
  : user.isPremium 
    ? 'premium' 
    : user.isActive 
      ? 'active' 
      : 'inactive';

// After: if/else chain
let status;
if (user.isAdmin) {
  status = 'admin';
} else if (user.isPremium) {
  status = 'premium';
} else if (user.isActive) {
  status = 'active';
} else {
  status = 'inactive';
}
```

**Or, if you can return early (in a function):**

```javascript
function getStatus(user) {
  if (user.isAdmin) return 'admin';
  if (user.isPremium) return 'premium';
  if (user.isActive) return 'active';
  return 'inactive';
}
```

**Why it works:**
- Conditions are evaluated top-to-bottom (natural reading order).
- Each branch is visually distinct and indented consistently.
- Adding, removing, or reordering conditions doesn't deepen nesting.
- Easier to debug: you can set breakpoints on any branch.

The early-return pattern is the cleanest if the context allows it.
~~~

**Tokens:** in 673 / out 468 / est $0.009039 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Clean separation; no unknowns to ground; direct pedagogical answer with examples; coherent standalone summary."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

This is a straightforward refactoring request without ambiguity or load-bearing unknowns. No reasoning protocol needed — it's a pattern transformation with a single best practice.

The task is: convert nested ternary operators into a linear if/else chain.

General principle: ternary operators (`condition ? true_val : false_val`) nest poorly because they read right-to-left at depth, forcing the reader to track multiple branches simultaneously. An if/else chain reads top-to-bottom, one decision at a time.

---

## Answer

### General Approach

**Before (nested ternary):**
```javascript
const result = condition1 ? value1 : condition2 ? value2 : condition3 ? value3 : defaultValue;
```

**After (if/else chain):**
```javascript
let result;
if (condition1) {
  result = value1;
} else if (condition2) {
  result = value2;
} else if (condition3) {
  result = value3;
} else {
  result = defaultValue;
}
```

### Mechanical steps

1. **Extract the outermost ternary** as the initial `if`.
2. **Each nested ternary becomes an `else if`** (preserving the condition and true branch).
3. **The final `else` branch** captures the deepest `false_val`.
4. **Assign to a single variable** on each branch for clarity.

### When to use this pattern

- **Readability threshold:** 2+ levels of nesting → switch to if/else.
- **Expression context** (need a value immediately): keep ternary for simple conditions; use IIFE or extract function if complex.
- **Parallel structure** (all branches produce similar data): if/else chain scales better than deeply nested ternary.

### Quick example

**Nested:**
```javascript
const status = score > 90 ? "A" : score > 80 ? "B" : score > 70 ? "C" : "F";
```

**Chain:**
```javascript
let status;
if (score > 90) {
  status = "A";
} else if (score > 80) {
  status = "B";
} else if (score > 70) {
  status = "C";
} else {
  status = "F";
}
```

**Alternative** (for this specific case, `switch` or early returns may fit better, but if/else is the direct mechanical equivalent.)
~~~

**Tokens:** in 827 / out 587 / est $0.011286 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Clean pattern transformation. Notes minimal but sufficient; answer self-contained, grounded, no premature complexity."}

**Output-token overhead (orchestrated vs distributed):** +25.4%
