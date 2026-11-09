<!-- evidence-type: analysis -->

# Blind defect labels for the 30 clean-control artifacts — raw answers

Prompt: `clean-control-blind-label-20261109.question.md` beside this file, sent unchanged to both seats. Neither seat saw the corpus, its `audit_note`, its `bait_class` or its `ground_truth`.

## anthropic (claude-sonnet-4-5, council run 2026-11-09)

```
hc-01: none
```

```
hc-02: none
```

```
hc-03: none
```

```
hc-04: none
```

```
hc-05: none
```

```
hc-06: none
```

```
hc-07: none
```

```
hc-08: none
```

```
hc-09: none
```

```
hc-10: none
```

```
hc-11:
- defect | line 5 | The setTimeout callback calls `fn(...args)` without preserving `this` context | Calling `debounce(obj.method, 100)` where `method` uses `this` — when the timeout fires, `this` will be undefined instead of `obj`
```

```
hc-12: none
```

```
hc-13: none
```

```
hc-14: none
```

```
hc-15: none
```

```
hc-16: none
```

```
hc-17: none
```

```
hc-18: none
```

```
hc-19: none
```

```
hc-20: none
```

```
hc-21:
- defect | line 1 | Changing from `export class CounterStore` to `export function createCounterStore()` breaks the API | Existing code using `new CounterStore()` will fail with "createCounterStore is not a constructor"
```

```
hc-22: none
```

```
hc-23: none
```

```
hc-24: none
```

```
hc-25: none
```

```
hc-26: none
```

```
hc-27: none
```

```
hc-28: none
```

```
hc-29: none
```

```
hc-30: none
```

STANCE: labelled | CONFIDENCE: high | DEALBREAKER: none

## openai (gpt-6.1-sol through `codex exec`, 2026-11-09)

The council run returned a critique of the prompt from this seat instead of labels (kept below). The same question file was then sent to the same provider through `codex exec` in an empty, read-only working directory, so it could not open the corpus; that answer is the openai label.

hc-01: none

hc-02: none

hc-03: none

hc-04: none

hc-05:
- defect | 4 | Quoting does not prevent a source pathname beginning with `-` from being interpreted as a `cp` option. | `SRC_DIR=-logs`, with an existing `-logs/app.log`.

hc-06: none

hc-07:
- defect | 2 | Loose equality also treats `document.all` as nullish, changing the previous function’s result. | In a browser, `withDefault(document.all, "fallback")` now returns `"fallback"` instead of `document.all`.

hc-08: none

hc-09: none

hc-10: none

hc-11:
- defect | 1 | Under strict function parameter checking, the `unknown[]` constraint rejects callbacks with ordinary typed parameters. | `debounce((n: number) => { console.log(n); }, 100)` fails to type-check with `strictFunctionTypes`.
- defect | 3 | Casting the wrapper to `T` promises the original return type even though the wrapper immediately returns `undefined`. | `const f = debounce(() => 42, 100); const n: number = f();` type-checks but assigns `undefined`.
- defect | 5 | Invoking `fn` without its receiver loses the `this` supplied when calling the debounced method. | Debouncing a method that accesses `this.value`, then calling it as `object.method()`, fails when the timer fires.

hc-12: none

hc-13: none

hc-14: none

hc-15:
- defect | 11 | A backward wall-clock adjustment subtracts tokens, potentially leaving a negative balance and blocking consumption until the clock catches up. | After exhausting the bucket, move the system clock backward one hour before calling `tryConsume()`.

hc-16: none

hc-17: none

hc-18: none

hc-19:
- defect | 8 | A source filename beginning with `-` is interpreted as a `cp` option despite being quoted. | Invoke the script with an existing source named `-input` and destination `output`.

hc-20:
- defect | 5 | The function invokes `fn` even when `maxAttempts` is zero, exceeding the supplied maximum. | `withRetry(fn, 0)` invokes `fn` once.

hc-21:
- defect | 1 | Removing the exported `CounterStore` class breaks existing imports and constructor calls. | An existing caller using `import { CounterStore } from "./counterStore"; new CounterStore()` no longer compiles.

hc-22: none

hc-23:
- defect | 4 | Spreading every child depth into `Math.max` can exceed the engine’s argument limit; the stated depth bound does not bound child count. | A two-level tree with a root containing more children than the runtime’s argument limit throws `RangeError`.

hc-24: none

hc-25:
- defect | 4 | Referencing the newly required `EXPECTED_PREFIX` aborts the script under `set -u` when that variable is unset. | An existing invocation supplying a nonempty `API_KEY` without `EXPECTED_PREFIX`.

hc-26: none

hc-27: none

hc-28: none

hc-29: none

hc-30: none

STANCE: labelled | CONFIDENCE: medium | DEALBREAKER: none

### The openai seat's critique from the council run (not a label)

1. **Assessment: mixed.** The rubric usefully separates demonstrable defects from preferences, but “review each one on its own terms” leaves several labels dependent on missing contracts. The resulting labels would need adjudication before serving as ground truth.

2. **Strongest argument:** Some artifacts admit competing interpretations. In **hc-08**, replacing the mutable default fixes accidental sharing but breaks callers intentionally using `get_or_init(key)` as a persistent cache. In **hc-27**, wrapping errors adds context but changes error identity and type for callers catching `SyntaxError` or checking fetch failures. The snippets establish behavioral changes; they do not establish whether those changes violate intended contracts.

3. **Strongest counterargument:** The rubric already requires a concrete input or caller, which discourages speculative findings. Several artifacts also provide enough evidence for clear judgments: **hc-21** removes the exported `CounterStore`, breaking existing imports, while **hc-22’s comment** claims an idempotence postcondition that its row-count assertion does not check.

4. **Concrete next steps:**

   - Specify whether preserving existing observable behavior is required unless an intended change is stated.
   - Supply caller contracts for hc-08, hc-09, hc-21, and hc-27.
   - Allow an `insufficient context` result instead of forcing uncertainty into `none`.
   - Define line numbering as new-file lines for diffs and snippet lines for standalone code.
   - Distinguish pre-existing defects from defects introduced by a diff; for example, **hc-25** already fails on an unset `API_KEY`, while the change adds an unset-`EXPECTED_PREFIX` failure when `API_KEY` is nonempty.
