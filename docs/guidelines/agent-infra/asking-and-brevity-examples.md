# asking-and-brevity-examples

Companion examples for three always-rules:
[`ask-when-uncertain`](../../../.agent-src.uncompressed/rules/ask-when-uncertain.md),
[`no-cheap-questions`](../../../.agent-src.uncompressed/rules/no-cheap-questions.md),
[`direct-answers`](../../../.agent-src.uncompressed/rules/direct-answers.md).

The rules carry the Iron Laws and the obligation surface. This file
carries the illustrative material (example questions, rationale
tables, failure-mode catalogs) that does not need to live in the
always-loaded rule body — extracted to fit the always-rule budget.

## Vague-request triggers — example questions

Companion to `ask-when-uncertain` § Vague-request triggers. The rule
lists the trigger patterns and the "missing info" columns; this file
adds the example question to ask back at the user.

| Pattern | Example clarifying question |
|---|---|
| "improve / optimize this" | "Optimize for what — execution speed or readability?" |
| "add caching" | "Which cache driver, and what invalidates it?" |
| "make it better / cleaner" | "What specifically feels wrong in the current code?" |
| "clean up this file" | "Remove unused code, reformat, or restructure?" |
| "fix this" (without specifying) | "What output/behavior is wrong right now?" |
| "refactor X" | "Refactor toward what — smaller methods, extract class, or something else?" |
| "use best practices" | "Best practices for what specifically — testing, naming, structure?" |
| "handle errors properly" | "For which failure modes, and what should happen on error?" |
| "add a UI / component / tile / page" when the repo mixes frameworks | "This repo uses {A} and {B} for UI — which one for this?" |

## One-question-per-turn — why serial always wins

Companion to `ask-when-uncertain` § How to ask. The rule states the
Iron Law and the self-check; this file expands the rationale.

| Situation | Why serial always wins |
|---|---|
| Design / architecture decisions | Answer to Q1 reframes Q2 |
| Naming / command-syntax / API shape | Later choices depend on it |
| Scope / PR boundaries | Changes what the other questions even mean |
| Tool / library selection | Downstream choices branch from it |
| "Which approach: A vs B vs C" | Each answer opens a different follow-up |
| Even "independent" yes/no pairs | User still has to parse two contexts |
| Any question the user has to **think** about, not just pick | Thinking load compounds when stacked |

The shorthand: if the user has to *think* about an answer, that
answer almost always reframes whatever question would have come
next. Serial preserves the framing; parallel destroys it.

## Cheap-question class catalog — extended examples

Companion to `no-cheap-questions` § What counts as cheap. The rule
lists the classes; this file adds longer-form examples per class.

| Class | Pattern · why cheap | Concrete example |
|---|---|---|
| **Sequencing** | "Step 2 or 3 next?" when roadmap orders them — answer is in the roadmap | Roadmap says "2.1 then 2.2" → don't ask "should I do 2.2 next?" |
| **Format-only** | "Table or paragraph?" — no semantic trade-off | User asked for a summary; format is a non-decision |
| **Commit asks** | "Commit now?" — `commit-policy`: never ask | The commit-policy Iron Law forbids the question |
| **CI / test asks** | "Run tests now?" — `verify-before-complete` decides | Verification is mandatory before completion claims; not a choice |
| **Fenced-step re-asks** | "Start Phase 1?" after "plan only" — `scope-control § fenced step` | The fence stands until the user explicitly lifts it |
| **Iron-Law option** | Option breaches `commit-policy`, `scope-control § git-ops`, or `non-destructive-by-default` — does not exist | Don't surface "force-push to main?" as Option 2 |
| **Context-derived** | Answer follows from prior turn / standing instruction / roadmap — act, state assumption inline | "Use the same branch?" after user said "stay on this branch" |
| **Dominant option** | One choice obviously correct; alternatives carry no upside — pick it | "Run the linter or skip it?" when the linter is part of CI |
| **Re-ask after decline** | Same path after user said no — `scope-control § decline = silence` | User declined a separate branch → don't propose it again on the same task |

## Direct-answers — severity-tiered claim examples

Companion to `direct-answers` § Iron Law 2 (no invented facts). The
rule lists the severity table; this file adds concrete examples and
hedge-language patterns.

| Severity | Examples | Verification action |
|---|---|---|
| **High — load-bearing** | "Method `X::y()` exists at `path/to/file.php:142`", "version 12.4.1 added the API", "this test passes" | MUST verify with `view`, `grep`, `codebase-retrieval`, or fresh command output **before** claiming. Too expensive → ask. |
| **Medium — project-shape** | "This project uses Pest for testing", "controllers live under `app/Http/Controllers`" | Verify if one tool call reaches it; otherwise hedge: *"I'd guess X — not checked"*. |
| **Low — well-known idioms** | "PHP `array_map` returns a new array", "git tags are immutable", "JS arrays are zero-indexed" | Inference acceptable. Mark as inference if not 100% sure. |

Hedge-language patterns:

- ✅ "haven't verified X — likely from {known-similar-codebase}"
- ✅ "guess, not checked — `path/to/file.php:142` is my best read"
- ❌ "probably" alone — name what's unverified
- ❌ "vermutlich" without hedge target

## Direct-answers — failure modes the user will call out

Companion to `direct-answers` § Failure modes. The rule lists the
modes; this file adds the trigger phrases and the in-language
correction pattern.

| Failure | User's typical callout | Correct response |
|---|---|---|
| Iron Law 1 violation | "skip the flattery", "ohne smalltalk" | drop the opener; deliver substance |
| Iron Law 2 violation | "have you actually checked?", "wo steht das?" | re-verify with a tool call; correct or retract the claim |
| Iron Law 3 violation | "kürzer", "less prose", "tldr" | trim to one sentence + the answer |
| Emoji blacklist hit | "ohne emojis", "no decoration" | re-render plain |

Acknowledge once, in the user's language, switch behavior, no
excuses (mirrors `language-and-tone` § slip handling).
