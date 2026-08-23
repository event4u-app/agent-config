<!-- evidence-type: analysis -->

# Does the host dispatcher offer a transparent input rewrite?

**Answer: yes on the host, no in this tree's plumbing — and the shipped claim conflates
the two.** Phase 1 of `road-to-terminal-token-economy`, steps 1.1 and 1.2.

## Pinned to a build and a date

| | |
|---|---|
| **Host** | Claude Code |
| **Version** | **2.1.241** (`claude --version`) |
| **Binary probed** | `/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe` |
| **Probed on** | **2026-08-23** |
| **Platform** | darwin-arm64 |

The pin is the point. An unpinned capability claim rots exactly the way the one being
replaced did, so a later reader can compare their own `claude --version` against 2.1.241
and know whether this paragraph still describes anything.

## The pre-state it refutes

`git show HEAD:src/scripts/hooks/rtk_wrap_hook.ts | grep -c "updatedInput"` = **2** — the
two assertions at `:13-15` and `:190`:

> *"It NEVER blocks (the v1 dispatcher contract is allow/block/warn — **there is no
> transparent `updatedInput` rewrite** — and, like `injection_scan_hook`, warn preserves
> agency)."*

> *"The roadmap step asked for a deterministic PreToolUse cap REWRITE; **the v1 dispatcher
> contract carries no `updatedInput`**, so per the roadmap's pre-registered consequence this
> degrades to an ADVISORY."*

A third site says the same thing: `src/config/hook-token-budget.json:90` — *"no
updatedInput in the v1 contract, so nothing caps and nothing changes."*

## Method — an observation, not a recollection

Field-name extraction from the shipped host binary, counting distinct occurrences:

```
$ strings <claude 2.1.241 binary> | grep -c 'updatedInput'        → 86
$ strings <claude 2.1.241 binary> | grep -c 'permissionDecision'  → 21
$ strings <claude 2.1.241 binary> | grep -c 'hookSpecificOutput'  → 40
$ strings <claude 2.1.241 binary> | grep -c 'modifiedInput'       →  0
```

A count alone would be weak evidence — a token can appear anywhere. The **context** is what
settles it; these lines are the host's own strings, quoted verbatim:

```
  - `permissionDecision` - "allow", "deny", or "ask" (PreToolUse only)
  - `updatedInput` - Modified tool input (PreToolUse only)
Expected {behavior: 'allow', updatedInput?: object} or {behavior: 'deny', message: string}.
… : updatedInput is missing or empty, falling back to original tool input
… returned updatedInput that failed schema validation:
… via updatedInput
The permission handler returned updatedInput for
```

That is a documented field name, a documented shape (`{behavior: 'allow', updatedInput?:
object}`), **schema validation** on the value, and a **documented fallback** when it is
absent or empty. A host that validates a field's schema and logs a fallback for it
implements the field.

**Verdict: the host offers a transparent PreToolUse input rewrite at 2.1.241.** The
assertion in `rtk_wrap_hook.ts` is **false for this build**.

## The half that is still true, and why the distinction matters

**This tree's dispatcher does not emit it.** `grep -rn 'updatedInput' src/` returns two
files, and both are the *claims* above — no hook and no host-semantics path constructs one.
`src/scripts/hooks/host_semantics.ts:107-117` builds exactly one envelope shape:
`hookSpecificOutput: { hookEventName, additionalContext }`. There is no
`permissionDecision` emitter either.

So the accurate statement is two clauses, and the shipped one collapsed them into the wrong
half:

| claim | true? |
|---|---|
| "our dispatcher cannot rewrite tool input" | **yes** — nothing emits the field |
| "the host contract has no transparent `updatedInput` rewrite" | **no** — 2.1.241 documents, validates and falls back on it |

The first is a fact about our code and is fixable by us. The second is a fact about the host
and was asserted without a date, which is precisely the defect step 1.3 names: *"A header
that asserts a host contract with no date is the defect, independent of whether the
assertion is true."* Here it is both undated **and** wrong.

## What this does NOT establish

- **Not** that the rewrite works end-to-end through this repository's dispatcher. The
  dispatcher aggregates many concerns per event and reduces them to one exit code; how a
  per-concern `updatedInput` would compose across concerns is an unanswered design question,
  not a probe result.
- **Not** that any earlier claim was wrong *when written*. The v1 contract may well have had
  no such field; `hook-architecture-v1.md` is a v1 document and the host is now 2.1.241. An
  undated assertion cannot be checked against the build it was true for, which is the
  argument for dating it rather than for blaming it.
- **Not** a recommendation. Whether to plumb it is Phase 2's decision, and this file
  deliberately stops at the capability.
