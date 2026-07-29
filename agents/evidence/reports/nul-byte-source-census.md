# Raw control bytes in text sources — census and fix (S0.0c)

Deliverable for `road-to-runtime-encoding-hardening` Phase 0, step S0.0c. This
defect was not in the roadmap's plan — it was **found by** the roadmap, because
it is what made the roadmap's own premise wrong.

Measured 2026-07-29 on `feat/runtime-encoding-hardening`.

## The defect

25 tracked, text-intended source files carried a **raw C0 control byte** —
almost always `NUL` (0x00) used as a composite map-key separator inside a
template literal, written as the literal byte instead of the `\0` escape:

```ts
const key = `${tier}<NUL>${command}`;   // raw 0x00 byte in the source
```

The code is valid TypeScript, compiles, and behaves correctly. The problem is
upstream of behaviour: a raw control byte makes `file(1)`, `grep`, and every
tool that sniffs for binary content classify the file as **binary** and skip it
**silently**.

```
$ grep -n "sanitize_entry" src/scripts/memory_lookup.ts     # before the fix
$                                                            # (nothing. exit 0.)

$ grep -an "sanitize_entry" src/scripts/memory_lookup.ts
38:import { sanitize_entry } from './_lib/retrieval_sanitize.js';
```

Exit code 0 with no output is indistinguishable from "the symbol is not there".

## Why it mattered here

This roadmap's severity-1 finding was written as: *"`memory_lookup.ts` has
**zero imports**; the floor's only production caller is
`second_brain_retrieval.ts`."* Both claims were false. They came from a `grep`
that silently skipped the file. `memory_lookup.ts` imports `sanitize_entry` on
line 38 and calls it on the two surfaces the header names.

The severity-1 framing survived a council review and a roadmap authoring pass
because everyone downstream inherited the same broken measurement. This is the
same class as a gate whose scan root matches nothing: **zero findings read as a
pass.**

## Census — before the fix

| Tree | Files | Occurrences |
|---|---:|---:|
| `src/scripts/` | 18 | 34 |
| `src/agent-src/templates/scripts/` | 5 | 10 |
| `tests/` | 2 | 4 |
| `dist/agent-src/` (generated projection) | 5 | 10 |

All were valid UTF-8 — the single control byte was the only thing making them
"binary". Beyond NUL, four further raw C0 bytes were found once the check
generalised: `0x01` (`cluster_near_miss_patterns.ts`, `json_pointers.test.ts`),
`0x07` (`retrieval_sanitize.test.ts`), `0x1F` (`json_pointers.test.ts`).

Excluded from the census, correctly: real binary assets (`.png`, `.docx`,
`.pptx`, `.xlsx` — office formats are ZIP containers), and
`agents/evidence/analysis/*.txt`, which are **verbatim captures** of tool output
(see below).

## The fix

Every occurrence became the language escape — `\0`, `\x01`, `\x07`, `\x1F`.

**Behaviour-preserving by construction.** In TypeScript a string or template
literal containing a raw U+0000 and one containing `\0` produce the *identical
runtime string*; the difference exists only in the source bytes. The rewrite was
machine-applied and machine-verified: every occurrence was checked for a
following decimal digit first (`\0` before a digit is a legacy octal escape and
a SyntaxError in strict mode / template literals) — there were none, so no case
needed `\x00` instead. `task typecheck-ts` is clean and the affected suites pass.

`dist/agent-src/` was **not** hand-edited — it is a generated projection, so it
was regenerated with `task sync` and carries zero raw NULs afterwards.

## The gate — extended, not new

`lint_hidden_unicode` already classifies NUL as `control-char` (its `_classify`
covers C0 0x00–0x1F except tab/LF/CR). Only its **scope** was wrong: it scanned
`.md` under `src/{skills,rules,agent-src,domains}` and never looked at source
files. So the fix is a scope extension to an existing gate, which is what this
roadmap asked for ("extend the sanitizer, do not rebuild it").

The new pass — `_scanSourceControlBytes` — reads every tracked, text-intended
file and flags raw C0 controls only.

**Why C0 only, and not the full invisible set.** In a `.ts` file a real bidi or
zero-width codepoint is frequently *legitimate*: a regex character class, or a
deliberately hostile test fixture. This repo has several. Flagging those would
require an allowlist that grows until the gate is worthless (the
allowlist-growth antipattern). A raw control byte is different: the escape
always exists, always compiles to the same value, and always keeps the file
tool-readable. So the false-positive rate is **structurally zero**, not merely
low.

**Two exclusions, both stated rather than silent:**

- **Generated trees** (`dist/`, `.augment/`, `.claude/`, `.cursor/`,
  `.clinerules/`) — this is an authoring rule. Flagging a projection would point
  the author at a file they must not edit, and `dist/install/*.mjs` is a bundler
  artifact whose bytes are not hand-authorable at all. Fix the source; the
  projection follows on `task sync`.
- **`agents/evidence/analysis/`** — verbatim captured tool output. These are
  recordings; escaping a byte inside one would falsify the record it exists to
  preserve. If a capture needs to stay grep-readable, the fix is to escape **at
  capture time**, never to edit the artifact afterwards.

**The gate states its own scope on every run**, precisely because this whole
investigation started with a check that read nothing and reported clean:

```
  source pass: 5982 tracked text file(s) read for raw C0 control bytes
               (generated trees + verbatim captures excluded)
✅  hidden-unicode: clean
```

## Regression lock

Six assertions in `tests/scripts/lint_hidden_unicode.test.ts`. The load-bearing
ones:

- a synthetic raw NUL **is** flagged, with the right line and the escape named —
  without this the pass could silently stop working;
- the same content written as `\0` passes — the fix is what the gate wants;
- binary extensions, non-UTF-8 content, and generated projections are ignored;
- **the real repo is clean, and the eligible file list is `> 500` entries** —
  the scope assertion. A pass over an empty list would otherwise "succeed"
  vacuously, which is the failure this entire report is about.

## Honest scope

- This closes **tool-visibility** of the source tree. It is not a security
  control and does not belong to the sanitize floor's threat model — an attacker
  is not the reason a raw NUL is bad here; a silently-skipped file is.
- The pass reads bytes with `fs.readFileSync`, so it is unaffected by the very
  blindness it detects. Gates in this repo that read via `fs` were **never**
  blind; only grep/`rg`-based scanning and agent-side evidence gathering were.
  No claim is made that any specific other gate was broken — that would need a
  per-gate audit this report did not run.
