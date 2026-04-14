---
name: javascript
description: "Use when writing JavaScript (ES2020+) — clean patterns, proper error handling, and alignment with project conventions."
source: package
---

# javascript

## When to use

`.js`/`.mjs`, frontend without TS, Node.js scripts, build configs. TS projects → `typescript` skill.

## Before: check for TS files first.
2. **Check ESLint / Biome config** — understand the linting rules.
3. **Check `package.json`** — `"type": "module"` means ES modules, otherwise CommonJS.
4. **Match existing patterns** — arrow functions vs function declarations, naming, etc.

## Core rules

### Modern syntax (ES2020+)

- Use `const` by default, `let` when reassignment is needed. Never `var`.
- Use arrow functions for callbacks: `items.map(item => item.name)`.
- Use template literals for string interpolation: `` `Hello ${name}` ``.
- Use destructuring: `const { name, email } = user`.
- Use spread operator: `const merged = { ...defaults, ...overrides }`.
- Use optional chaining: `user?.address?.city`.
- Use nullish coalescing: `value ?? defaultValue`.

### Functions

- Prefer arrow functions for short callbacks and anonymous functions.
- Use function declarations for named, hoisted functions.
- Use default parameters: `function greet(name = 'World')`.
- Use rest parameters: `function sum(...numbers)`.

### Async code

- Use `async/await` over `.then()` chains.
- Always handle errors with `try/catch`.
- Use `Promise.all()` for parallel async operations.
- Use `Promise.allSettled()` when some failures are acceptable.

### Modules

- Use ES module syntax when the project supports it:
  ```javascript
  import { something } from './module.js'
  export function myFunction() {}
  ```
- Use CommonJS only when the project requires it:
  ```javascript
  const { something } = require('./module')
  module.exports = { myFunction }
  ```

### Arrays and objects

- Use `map`, `filter`, `reduce`, `find`, `some`, `every` over manual loops.
- Use `Object.entries()`, `Object.keys()`, `Object.values()` for object iteration.
- Use `structuredClone()` for deep cloning (modern browsers/Node 17+).
- Use `Array.from()` or spread for converting iterables.

### Error handling

- Always catch errors in async code.
- Use custom error classes for domain-specific errors.
- Never swallow errors silently — at minimum log them.
- Use `instanceof` checks for error type narrowing.

### Naming conventions

- `camelCase` for variables and functions.
- `PascalCase` for classes and components.
- `UPPER_SNAKE_CASE` for constants.
- Prefix booleans with `is`, `has`, `should`, `can`: `isLoading`, `hasPermission`.

## DOM interaction

When working with browser JavaScript:

- Use `querySelector` / `querySelectorAll` over older methods.
- Use event delegation for dynamic elements.
- Use `addEventListener` — never inline `onclick` attributes.
- Clean up event listeners and intervals to prevent memory leaks.

## Gotcha: const/let not var, `===` not `==`, don't forget `await`, no `eval()`.

## Do NOT: var, ==, callbacks over async/await, mutate args, ignore ESLint/Biome, mix ESM/CJS.
