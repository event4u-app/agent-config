#!/usr/bin/env python3
"""P4.3 — Write condensed rule bodies. Run after _p43_condense.py."""
from __future__ import annotations
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
RULES = ROOT / ".agent-src.uncondensed" / "rules"


def write(name: str, content: str) -> None:
    p = RULES / f"{name}.md"
    p.write_text(content, encoding="utf-8")
    print(f"  ✓ {name}: {len(content)} chars")


# Each entry is the FULL file content (frontmatter + body).
FILES: dict[str, str] = {}

FILES["think-before-action"] = """---
type: "auto"
tier: "2b"
description: "Before coding, modifying, or debugging — analyze first, verify with real tools, never guess or trial-and-error"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncondensed/contexts/communication/rules-auto/think-before-action-mechanics.md
triggers:
  - intent: "before coding"
  - intent: "before debugging"
  - intent: "before modifying"
---

# think-before-action

## The Iron Law

```
ANALYZE BEFORE CODING. VERIFY WITH REAL TOOLS. NEVER GUESS.
NO BLIND TRIAL-AND-ERROR. MAX 2 RETRIES PER APPROACH.
```

- Always analyze before coding or modifying anything.
- Never guess behavior — verify using code, data, or tools.
- Prefer targeted inspection (jq, debugger, logs) over brute-force.
- Always verify results after changes (API, UI, tests).
- When behavior can be defined → prefer test-first / TDD.
- Unclear requirements → precise clarification question, not hidden assumptions.
- Refactors must preserve behavior, validation, examples, and anti-failure guidance unless explicitly changed.
- Do NOT modify code you do not fully understand — read it, trace the flow, then change it.
- Multiple valid frameworks/patterns coexist (Tailwind + Flux, multiple form libs, competing state stores) → do NOT pick one silently — ask. See [`no blind implementation`](../../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md#2-no-blind-implementation).

## Mechanics — workflow, minimum read set, verify-with-real-tools, no blind retries

The five-step Understand → Analyze → Plan → Implement → Verify workflow, the minimum read set (symbol, callers, tests, abstractions, data), the memory-consult step, the verification matrix, the output-reduction patterns, the no-blind-retries protocol, and the "open files are context, not intent" clause all live in [`contexts/communication/rules-auto/think-before-action-mechanics.md`](../contexts/communication/rules-auto/think-before-action-mechanics.md). The rule above is the obligation surface; the mechanics file is the lookup material.

If analysis is skipped → results are unreliable.
"""

FILES["guidelines"] = """---
type: "auto"
tier: "3"
description: "Writing or reviewing code — check relevant guideline before writing or reviewing code"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncondensed/contexts/communication/rules-auto/guidelines-mechanics.md
triggers:
  - intent: "writing code"
  - intent: "reviewing code"
  - keyword: "convention"
---

# Guidelines

Coding guidelines live under `docs/guidelines/` organized by language. **Always check the relevant guideline** before writing or reviewing code.

## How guidelines work

- **Guidelines** = detailed coding conventions (reference material, read on demand).
- **Rules** = always-active behavior constraints (auto-loaded every conversation).
- **Skills** = agent capabilities and workflows (matched by topic).

Guidelines are the "how to write code" docs. Rules enforce critical subsets automatically. Skills reference guidelines when performing related tasks.

## Index — see mechanics

The full file index (PHP, PHP patterns, E2E, agent-infra) plus the guidelines-vs-skills boundary and the "adding new guidelines" template live in [`contexts/communication/rules-auto/guidelines-mechanics.md`](../contexts/communication/rules-auto/guidelines-mechanics.md). The rule above is the obligation surface; the mechanics file is the catalog.
"""

FILES["token-efficiency"] = """---
type: "auto"
tier: "2a"
description: "When running CLI tools, fetching logs, or producing replies — redirect verbose output, minimize tool calls, keep replies concise"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncondensed/contexts/communication/rules-auto/token-efficiency-mechanics.md
triggers:
  - intent: "verbose CLI output"
  - intent: "fetching logs"
  - keyword: "minimize tool calls"
---

# Token Efficiency

## The Iron Laws

```
NEVER load full command output into context. Redirect → read summary → targeted details.
```

```
NEVER call the same tool more than 2 times in a row with similar parameters.
If you catch yourself repeating a tool call — STOP, rethink, try a different approach, or ask the user.
```

## Fresh Output Over Memory

When a tool or command returns a value (branch name, file path, PR number), use that EXACT value in subsequent API calls. NEVER substitute a value from earlier in the conversation. Context decay causes silent mismatches — fresh output is the only source of truth.

## Mechanics — anti-loop patterns, conversation efficiency, exceptions

The anti-loop patterns (extended-reasoning loops, "CRITICAL INSTRUCTION" self-prompting), the act-skip-narration / stop-early / keep-output-minimal / don't-re-read / minimize-tool-calls clauses, and the small-output / debugging / explicit-full-output exceptions all live in [`contexts/communication/rules-auto/token-efficiency-mechanics.md`](../contexts/communication/rules-auto/token-efficiency-mechanics.md). The rule above is the obligation surface; the mechanics file is the lookup material.

This rule NEVER overrides `user-interaction` or command rules. Token efficiency means fewer *unnecessary* words — NOT skipping required questions, numbered options, or command steps.
"""

FILES["autonomous-execution"] = """---
type: "auto"
tier: "3"
description: "Deciding whether to ask the user or just act on a workflow step — trivial-vs-blocking classification, autonomy opt-in detection, commit default; defers to non-destructive-by-default for the Hard Floor"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncondensed/contexts/execution/autonomy-detection.md
  - .agent-src.uncondensed/contexts/execution/autonomy-mechanics.md
  - .agent-src.uncondensed/contexts/execution/autonomy-examples.md
triggers:
  - intent: "trivial workflow question"
  - intent: "autonomy mode"
  - keyword: "personal.autonomy"
---

# Autonomous Execution

User's time is the scarce resource. Trivial workflow questions are noise. This rule defines **trivial** (just act), **blocking** (still ask), the **hard floor** (always ask, no override), and the **commit default** (never commit, never ask — review-first by design).

## Hard Floor — see [`non-destructive-by-default`](non-destructive-by-default.md)

The universal safety floor (production-branch merges, deploys, pushes, prod data/infra, whimsical bulk deletions, and commits containing bulk deletions or infra changes) is governed by the canonical [`non-destructive-by-default`](non-destructive-by-default.md) rule. It applies regardless of `personal.autonomy`, a standing autonomy directive, or any roadmap authorization. Nothing in **this** rule lifts it. If a trigger fires, stop and ask — every other section below assumes the floor has already been cleared.

## Setting — `personal.autonomy`

Three values: `on` (suppress trivial questions), `off` (ask trivial questions too), `auto` (default — same as `off` until the user opts in via a standing autonomy directive). Read once on the first turn and cache. Missing key → treat as `on`. Full table, semantics, and cloud behavior: [`contexts/execution/autonomy-mechanics.md`](../contexts/execution/autonomy-mechanics.md).

## Opt-in detection — match by intent, not exact string

In `auto` mode, flip to `on` for the rest of the conversation when the user expresses **"stop asking on trivial steps, just work"**. Recognize **intent**, not the literal substring. Opt-out (same intent, reversed) flips back to `off`. Both directions are **speech-act-checked**: the phrase must be a meta-instruction to the agent, not content / quote / subject / code / third-party reference / hypothetical. In doubt → keep current mode, no speculative flips.

Algorithm and speech-act heuristic: [`contexts/execution/autonomy-detection.md`](../contexts/execution/autonomy-detection.md). Anchor phrases (DE+EN), no-flip patterns, counter-examples, trivial-vs-blocking taxonomy, commit-policy summary, and named failure modes: [`contexts/execution/autonomy-mechanics.md`](../contexts/execution/autonomy-mechanics.md) + [`contexts/execution/autonomy-examples.md`](../contexts/execution/autonomy-examples.md).

## See also

- [`non-destructive-by-default`](non-destructive-by-default.md) — universal safety floor; never overridden by autonomy
- [`scope-control`](scope-control.md) — git-ops permission gate
- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request triggers that always require asking
- [`no-cheap-questions`](no-cheap-questions.md) — mode-independent floor against context-derived asks
- [`commit-policy`](commit-policy.md) — never-commit / never-ask Iron Law
- [`/commit:in-chunks`](../commands/commit/in-chunks.md), [`/commit`](../commands/commit.md)
"""

FILES["user-interaction"] = '''---
type: "auto"
tier: "3"
description: "Asking the user a question, presenting options, or summarizing progress — numbered-options Iron Law, single-recommendation rule, progress indicators"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncondensed/contexts/communication/rules-auto/user-interaction-mechanics.md
triggers:
  - intent: "ask user a question"
  - intent: "numbered options"
  - intent: "summarizing progress"
---

# User Interaction

Two Iron Laws govern every reply that contains numbered options.
They override conversation momentum, brevity, and the urge to defer
to the user. **Missing a recommendation is a rule violation, not a slip.**

## Iron Law 1 — Single-Source Recommendation

```
EXACTLY ONE LINE NAMES THE RECOMMENDED NUMBER. NO INLINE TAG. NO SECOND PROSE NUMBER.
THE OPTION BLOCK STAYS NEUTRAL. THE RECOMMENDATION LINE IS THE ONLY SOURCE OF TRUTH.
DRIFT BETWEEN OPTION-BLOCK AND PROSE IS STRUCTURALLY IMPOSSIBLE WHEN THE TAG DOES NOT EXIST.
MISSING RECOMMENDATION = RULE VIOLATION, NOT A SLIP.
POSITION-AGNOSTIC. END-OF-TURN MENUS COUNT. NEXT-STEP LISTS COUNT. NO EXCEPTIONS.
THE RECOMMENDATION LINE LIVES DIRECTLY UNDER THE OPTIONS BLOCK. NOWHERE ELSE.
PROSE NAMING A "RECOMMENDED" PATH ABOVE OR BEFORE THE OPTIONS BLOCK = NO RECOMMENDATION.
WRONG-LANGUAGE LABEL (`Recommendation:` WHEN USER IS GERMAN, OR VICE VERSA) = NO RECOMMENDATION.
```

## Iron Law 2 — Pre-Send Self-Check

```
EVERY REPLY WITH NUMBERED OPTIONS RUNS THE SELF-CHECK. NO EXCEPTIONS.
SKIPPING IT IS A RULE VIOLATION, NOT A SLIP.
```

Mechanical backstop:
`python3 scripts/check_reply_consistency.py --stdin < draft.md`
(non-zero exit on any rule below). Self-scan is the primary gate;
the script is the deterministic safety net.

## Mechanics — rationale, failure modes, format details, examples

The "why take a position", position-agnostic clause, format
specification (neutral block + bolded recommendation line + caveat),
no-trailing-open-question rule, "what does NOT count" catalog, full
five-step pre-send self-check, named failure-mode catalog (end-of-turn
menu, trailing-question hedge, no-preference hedge, multi-block reply,
…), slip-handling protocol, numbered-options rules, format examples,
progress indicators, and summary-table patterns all live in
[`contexts/communication/rules-auto/user-interaction-mechanics.md`](../contexts/communication/rules-auto/user-interaction-mechanics.md).
The rule above is the obligation surface; the mechanics file is the
lookup material.
'''


if __name__ == "__main__":
    for name, content in FILES.items():
        write(name, content)
    print(f"✓ wrote {len(FILES)} condensed rule bodies")
