---
name: javascript
description: "Use when writing JavaScript (ES2020+) — clean patterns, proper error handling, and alignment with project conventions."
source: package
---

# javascript

## When to use

Use this skill when:
- Writing `.js` or `.mjs` files
- Working on frontend code without TypeScript
- Writing Node.js scripts or tooling
- Working with build configs (Vite, Webpack, ESLint, etc.)

**If the project uses TypeScript**, prefer the `typescript` skill instead.

## Before writing code

1. **Check for TypeScript** — if `.ts` files exist, use TypeScript instead.
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

## What NOT to do

- Do not use `var` — use `const` or `let`.
- Do not use `==` — use `===` for strict comparison.
- Do not use `arguments` object — use rest parameters.
- Do not use `eval()` or `new Function()`.
- Do not mutate function parameters — create new objects/arrays.
- Do not ignore ESLint/Biome errors — fix them.
- Do not mix ES modules and CommonJS in the same file.


## Gotcha

- Don't use `var` — always `const` or `let`. The model sometimes falls back to `var` in quick examples.
- `===` not `==` — loose equality causes subtle bugs with type coercion.
- The model tends to forget `await` on async functions — always check the return type.

## Do NOT

- Do NOT use var — use const or let.
- Do NOT use == for comparison — use ===.
- Do NOT use callbacks when async/await is available.
- Do NOT mutate function arguments.

## Auto-trigger keywords

- JavaScript
- ES2020
- async/await
- DOM
- event handling
- modules
