# Transcript — slot 13: ss-explain-undefined-error

- **Band:** standard · **Mechanism:** stateless
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

What does 'cannot read property of undefined' usually mean, and how do I find the cause?

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

This is a straightforward conceptual question about a common JavaScript error. No ambiguity, no multi-step task. I'll skip the full reasoning protocol and give direct, actionable guidance.

## Answer

**What it means:**  
You're trying to access a property (or call a method) on something that doesn't exist — a variable, object field, or function return value is `undefined`. The error stops your code there.

```javascript
// Common cases:
let obj;
obj.name  // ❌ Cannot read property 'name' of undefined

let arr = [];
arr[0].id  // ❌ Cannot read property 'id' of undefined (arr[0] is undefined)

function getData() { }
getData().value  // ❌ Cannot read property 'value' of undefined (no return)
```

---

**How to find the cause:**

1. **Read the stack trace** (the most direct path).  
   Look at the line number and filename in the error message — that tells you *where* the crash happened. Modern browsers and Node show this clearly.

2. **Work backward from the crash site.**  
   At that line, identify which object/variable is undefined:
   ```javascript
   user.profile.email  // Which one is undefined?
   ```
   Add a console check just before:
   ```javascript
   console.log('user:', user);
   console.log('user.profile:', user?.profile);  // Use optional chaining to stay safe
   ```

3. **Trace why it's undefined.**  
   - Was it never assigned? (`let x;` without `= ...`)  
   - Does the source function/API not return what you expect?  
   - Did you misspell a property name?  
   - Is the data structure different than your code assumes?

4. **Use optional chaining and nullish coalescing** as a safety net during debugging:
   ```javascript
   user?.profile?.email ?? 'no email'  // Won't crash if any step is undefined
   ```

5. **Reproduce with minimal input** — if it's async or data-dependent, log the actual values at each step rather than assuming the shape.

**Quick checklist:**
- Stack trace → line number  
- Log the variable at that line  
- Check: assignment, API response, spelling, data structure  
- Verify assumption with actual data, not expected shape
~~~

**Tokens:** in 669 / out 556 / est $0.010347 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Clean notes/answer split; grounded in JS behavior; direct diagnostic steps; coherent standalone summary. Exemplary."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

This is a conceptual/diagnostic question, not a code change. High value to answer directly and practically. The user is asking for both the meaning AND the debugging method. No reasoning protocol needed—answer outcome-first with concrete steps.

---

## Answer

### What it means

**"Cannot read property of undefined"** (or "Cannot read property 'X' of undefined") means your code tried to access a property or method on a value that is `undefined`, not an object.

Examples:
```javascript
let user;
user.name  // ❌ "Cannot read property 'name' of undefined"

let data = { };
data.nested.value  // ❌ if nested is undefined
```

### How to find the cause

1. **Read the stack trace** (most direct)
   - The error message points to a file and line number.
   - Go there first. Find the exact property access that failed.

2. **Work backward from the property access**
   - At that line, identify which variable is `undefined`.
   - Example: if the error is on line 15 in `user.name`, the variable `user` is undefined.
   - Ask: *Why wasn't this variable initialized?*

3. **Check the source of that variable**
   - Was it assigned? Fetch a value from an API, database, or parent prop?
   - Does the assignment have a guard? (e.g., `if (response.data)` before using it)
   - Did it come from a function return that might return nothing?

4. **Common culprits**
   - API call hasn't finished yet (async timing issue)
   - Conditional logic failed silently (e.g., `if` didn't match, so variable never set)
   - Object destructuring or prop drilling broke partway down the chain
   - Function returned `undefined` instead of the expected object
   - Typo in property name (accessed wrong key)

5. **Quick fixes to try**
   - Add optional chaining: `user?.name` (returns `undefined` gracefully instead of crashing)
   - Add a null check: `if (user) { ... }`
   - Log before the crash: `console.log(user)` on the line before to see what it actually is
   - Check your initial state (especially in React: did you initialize it to `null` or an object?)

**Pro tip:** Use browser DevTools → pause on exceptions, or add a breakpoint right before the failing line. Inspect the variable's actual value at that moment—often your assumption about what it contains is wrong.
~~~

**Tokens:** in 823 / out 593 / est $0.011364 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Clean separation: notes confirm no protocol needed. Answer is grounded, outcome-first, practical, avoids premature fixes."}

**Output-token overhead (orchestrated vs distributed):** +6.7%
