# Roadmap: Context-Aware Command Suggestion

> When the user's prompt matches a command's purpose, surface that command as a numbered option **alongside the option to run the prompt as-is**. The user always decides. **Nothing auto-executes.** Commands stay safe shortcuts; the suggestion layer is a context-aware shortcut *finder*.

## Prerequisites

- [x] Read `.agent-src.uncompressed/rules/slash-commands.md` — current invocation contract
- [x] Read `.agent-src.uncompressed/rules/user-interaction.md` — numbered-options Iron Law
- [x] Read `.agent-src.uncompressed/rules/ask-when-uncertain.md` — one-question-per-turn rule
- [x] Read `.agent-src.uncompressed/skills/command-routing/SKILL.md` — current routing skill
- [x] Read `.agent-src.uncompressed/skills/command-writing/SKILL.md` — command-authoring conventions
- [x] Inventory all commands under `.agent-src.uncompressed/commands/` (75 total — count update vs. roadmap header)
- [x] Re-read `.agent-src.uncompressed/templates/roadmaps.md`

## Context (current state)

The package has 73 slash commands. Each is invoked **only** when the user types `/command` explicitly. A developer who types "Setze Ticket ABC um" doesn't get `/implement-ticket` — they get a generic implementation. The agent has the command list in context but no contract that says "when the prompt looks like *this*, offer *that* command as a choice".

The user's clarification is the architectural anchor: **never auto-execute**. The user always picks. The suggestion layer compares the prompt to commands, presents matches as numbered options, and includes "just run the prompt as-is" as an escape hatch. If the user picks a command, the command's normal flow runs (with its own safety prompts intact). If the user picks the as-is option, the agent treats the prompt as plain input.

This keeps every existing safety guarantee — `scope-control`, `ask-when-uncertain`, `verify-before-complete`, the per-command halt structure — fully intact. The suggestion layer is **read-only** with respect to execution: it surfaces, it does not invoke.

- **Feature:** context-aware command suggestion
- **Jira:** none
- **Independent of:** R1 / R2 / R3 — synergistic but not blocked by them

## Target architecture

```
.agent-src.uncompressed/
  commands/{any}.md
    frontmatter:
      suggestion:
        eligible: true                 # default; set false to opt out
        triggers:
          - description: "ticket-shaped work, e.g. 'setze ticket X um', 'implement PROJ-123'"
          - context:     "user message contains a ticket key matching ^[A-Z]+-[0-9]+$"
        confidence_floor: 0.6          # optional, defaults to settings value
        cooldown: 10m                  # optional, defaults to settings value
  rules/
    command-suggestion.md              ← NEW, always-on
  skills/
    command-routing/SKILL.md           ← extended with suggestion logic

scripts/
  command_suggester/
    match.py                           ← scans user message + recent context
    rank.py                            ← scores, applies floor, dedupes
    cooldown.py                        ← per-conversation suppression
    render.py                          ← builds the numbered-options block
```

`.agent-settings.yml` additions:

```yaml
commands:
  suggestion:
    enabled: true
    blocklist: []                      # commands never suggested
    confidence_floor: 0.6
    cooldown: 10m
    max_options: 4                     # cap; "as-is" option always present on top of this
```

## Suggestion contract

When at least one command matches above the floor, the agent emits **exactly one** numbered-options block before doing anything else, conforming to `user-interaction` Iron Law:

```
> 💡 Your request matches a command. Pick one or run the prompt as-is:
>
> 1. /implement-ticket — recognized ticket-shaped work (recommended)
> 2. /refine-ticket — clarify acceptance criteria first
> 3. Just run the prompt as-is, no command
```

Rules:

- The "run as-is" option is **always present**, always last, never removed.
- Maximum `max_options` command suggestions, plus the as-is option (so 5 total at default).
- Recommendation marker (per `user-interaction`) goes on at most one option, with reason in 1–3 sentences after the block.
- Free-text replies count as the as-is option unless they unambiguously name one of the commands.
- If the user picks a command, the agent invokes it via the standard slash-command flow — including the command's own halts.
- If the user picks as-is, the agent processes the original prompt as plain input.

## Non-goals

- **No** auto-execution of any command, ever. The user picks every time.
- **No** tier system, escalation paths, or settings that bypass the user pick.
- **No** chained suggestions (suggestion → command → another suggestion). Suggestion runs at most once per user turn.
- **No** ML-based matching. Pattern + keyword matching only — deterministic, replayable in goldens.
- **No** changes to existing slash-command invocation. `/command` typed explicitly still skips suggestion entirely.
- **No** version numbers (per `roadmaps.md` rule 13).

## Phase 1: Eligibility audit and trigger drafting

> Inventory every command, decide which are *eligible* for suggestion, draft trigger patterns. Eligibility ≠ tier — it only governs whether the suggestion layer may surface the command. Picking it always runs the normal flow.

- [x] **Step 1:** Build `agents/contexts/command-suggestion-eligibility.md` — table of all 75 commands: eligible (yes/no), proposed triggers, rationale.
- [x] **Step 2:** Default eligibility is **`true`**. Opt-out cases:
  - Commands the user invokes only intentionally (e.g., `/onboard`, `/package-reset`, `/mode`, `/agent-handoff`, `/chat-history-clear`).
  - Commands whose trigger patterns would overlap heavily with normal conversation and create noise.
  - Commands that have no clear natural-language signal distinct from neighboring commands.

- [x] **Step 3:** Each eligible command gets at least 2 trigger items: one `description` (natural-language pattern) and one `context` (concrete signal — file pattern, branch name, recent tool output). Triggers are deliberate; the linter rejects empty or overly generic patterns.
- [x] **Step 4:** Independent review of the eligibility table — overlap clusters identified (5 clusters covering 13 commands) and routed to Phase 4 tie-break.
- [x] **Step 5:** Lock the table. Tier and eligibility changes thereafter are roadmap follow-ups.

## Phase 2: Frontmatter schema and migration

- [x] **Step 1:** Extend command frontmatter with the `suggestion` block. Document in `.agent-src.uncompressed/skills/command-writing/SKILL.md`.
- [x] **Step 2:** Add schema validation to `scripts/skill_linter.py` (or sibling `command_linter.py`):
  - `suggestion.eligible` must be `true` or `false`; default `true` if missing.
  - If `eligible: true`, `trigger_description` AND `trigger_context` must be non-empty (≥ 10 chars). Flat shape chosen over list-of-objects to keep within the stdlib YAML parser's one-level nesting; same expressive power, simpler validation. Documented in `command-writing/SKILL.md`.
  - `confidence_floor` if present must be `≥ 0.0`.
  - `cooldown` if present must be a string ≤ 16 chars.
- [x] **Step 3:** Migrate all 75 commands via `scripts/migrate_command_suggestions.py`. Eligible commands get triggers from the locked table; opt-outs explicitly set `eligible: false` with a one-line rationale.
- [x] **Step 4:** Run `python3 scripts/skill_linter.py --all` and `python3 scripts/validate_frontmatter.py` — both exit 0 with all 75 commands schema-valid.

## Phase 3: Matcher engine and suggestion rule

- [x] **Step 1:** Author `.agent-src.uncompressed/rules/command-suggestion.md` — always-on, type `always`. Triggers on every user turn that does **not** start with an explicit `/command`. Iron Law: never bypass `scope-control`, `ask-when-uncertain`, `verify-before-complete`. Suggestion is the very first thing the agent emits when matches exist; nothing else runs in the same turn until the user picks.
- [x] **Step 2:** Implement `scripts/command_suggester/match.py` — reads all eligible command frontmatter, scans the current user message + last 2 turns of context, returns scored matches `[{command, score, matched_trigger, evidence}]`.
- [x] **Step 3:** Implement `scripts/command_suggester/rank.py` — applies `confidence_floor` from settings (overridable per command), drops blocklisted commands, sorts by score, caps at `max_options`. Returns the ranked list or empty.
- [x] **Step 4:** Implement `scripts/command_suggester/cooldown.py` — same suggestion (same command, same trigger) is suppressed for `cooldown` window per conversation. Cooldown resets when the user explicitly invokes that command via `/command`.
- [x] **Step 5:** Implement `scripts/command_suggester/render.py` — builds the numbered-options block per the suggestion contract. Always appends "Just run the prompt as-is, no command". Includes recommendation marker on at most one option with 1–3 sentence rationale.

## Phase 4: Tie-break and anti-noise

- [x] **Step 1:** Tie-break policy when multiple commands match closely:
  1. Higher score wins.
  2. On score tie, the structural-bonus match (ticket key, file path) outranks the generic one.
  3. On full tie with no structural bonus, the longer matched evidence wins; alphabetic command name is the final stable tiebreaker.
  4. Both surface as separate options (within `max_options`).
- [x] **Step 2:** Anti-noise heuristics applied before rendering:
  - If only one match and its score is below `confidence_floor + 0.1`, suppress (high uncertainty isn't worth interrupting the user). Structural bonus overrides.
  - If the user message is < 6 words and matches more than 2 commands, suppress (likely too vague to disambiguate without asking — falls through to as-is). Structural bonus overrides.
  - If the user message is a pure continuation phrase (`ok`, `weiter`, `mach weiter`, `go on`, …), suppress. Structural bonus overrides.
- [x] **Step 3:** Tests: 44 cases (well above the 12-fixture floor) covering single-match, tie + structural-bonus tiebreak, sub-floor, vague-input suppression, continuation suppression, blocklist, cooldown, eligibility filter, render contract.

## Phase 5: Settings and opt-out paths

- [x] **Step 1:** Add `commands.suggestion` block to `.agent-src.uncompressed/templates/agent-settings.md` and `agent-settings.yml.dist`. Document in `.agent-src.uncompressed/guidelines/agent-infra/layered-settings.md`.
- [x] **Step 2:** Settings semantics:
  - `enabled: false` → suggestion layer fully off; explicit slash commands still work.
  - `blocklist: ["/refine-ticket"]` → command never appears as a suggestion (still works when typed).
  - `confidence_floor` and `cooldown` apply globally; per-command frontmatter values override.
  - `max_options` caps command suggestions (the as-is option is always extra).
- [x] **Step 3:** Per-conversation opt-out: a `/command-suggestion-off` directive in the user's message disables suggestion for the rest of that conversation. Persisted in conversation state, not settings.
- [x] **Step 4:** Tests: settings combinations, per-conversation opt-out, blocklist behavior, floor overrides.

## Phase 6: Hardening — what suggestion must never do

- [x] **Step 1:** **No execution without user pick.** The rule's contract is "emit options, then halt". Any code path that invokes a command before the user picks is a bug. Linter scans the rule for forbidden patterns.
- [x] **Step 2:** **No multi-question stacks.** Suggestion is one numbered-options block per turn, period. If the agent has another clarifying question (per `ask-when-uncertain`), suggestion is **suppressed** that turn — clarification wins, suggestion can fire next turn.
- [x] **Step 3:** **No conversation hijack.** When `enabled: false` or no matches above floor, suggestion is silent. Zero output. The user's prompt runs as it would today.
- [x] **Step 4:** **No echo-trigger.** If a suggestion emits a command name, that text is excluded from the next-turn matcher input — prevents the suggestion's own output from re-triggering itself.
- [x] **Step 5:** **Hard subordination.** `command-suggestion.md` rule is explicitly listed as junior to `scope-control`, `ask-when-uncertain`, `verify-before-complete` and to any active role-mode contract. On conflict, suggestion stays silent.
- [x] **Step 6:** Adversarial tests: prompts crafted to inject command syntax, prompts containing fake `/command` references, prompts mid-flow during an active `/implement-ticket` halt — suggestion must stay silent or yield to the active flow.

## Phase 7: Golden tests, verification, docs

- [x] **Step 1:** Add suggestion goldens:
  - **GT-CS1 — clear single match:** "Setze Ticket ABC-123 um" → block with `/implement-ticket` recommended + `/refine-ticket` + as-is option.
  - **GT-CS2 — multi-match tie-break:** "Bitte committe die Änderungen und schreib eine PR-Description" → `/commit` and `/create-pr-description` both surface; user picks; only the picked command runs.
  - **GT-CS3 — sub-floor suppression:** vague prompt, low scores → no block emitted; prompt processed as-is.
  - **GT-CS4 — explicit slash bypass:** user types `/quality-fix` directly → no suggestion block, command runs immediately.
  - **GT-CS5 — pick "as-is":** suggestion shown; user picks the last option → original prompt processed; cooldown updated for the suggested commands.
  - **GT-CS6 — cooldown:** same trigger fires twice in 2 min → second occurrence silent.
  - **GT-CS7 — settings off:** `commands.suggestion.enabled: false` → no block regardless of triggers.
  - **GT-CS8 — clarification wins:** turn requires `ask-when-uncertain` clarification AND matches a command → only the clarification question is shown; suggestion suppressed for that turn.
  - **GT-CS9 — adversarial echo:** prompt contains `/commit` as quoted text in user-pasted code → suggestion does not surface `/commit` based on that string.
- [x] **Step 2:** Wire goldens into `task ci` as a required check.
- [x] **Step 3:** Document the suggestion contract in `agents/contexts/command-suggestion-flow.md` — how matching scores, what suppresses, how to opt out per command / per conversation / globally.
- [ ] **Step 4:** `task sync && task generate-tools && task ci` — green end-to-end.
- [x] **Step 5:** Update `README.md` and `AGENTS.md` — explain the suggestion layer, the always-present as-is option, and the three opt-out paths (settings, per-command, per-conversation).
- [x] **Step 6:** ADR `agents/contexts/adr-command-suggestion.md` — rationale, "never auto-execute" anchor, eligibility rubric, anti-noise heuristics, hardening list.
- [x] **Step 7:** Changelog entry under "Unreleased" — suggestion layer, settings keys, opt-out paths, no behavioral change to slash invocation.

## Acceptance criteria

- [x] Every one of the 73 commands has explicit `suggestion.eligible` in frontmatter; eligible commands have ≥ 2 triggers (1 description + 1 context)
- [x] Linter enforces schema; rejects empty/overly-generic triggers
- [x] `command-suggestion` always-on rule surfaces matches as one numbered-options block, with the "run as-is" option always last
- [x] Numbered-options output strictly conforms to `user-interaction` Iron Law (one question per turn)
- [x] Suggestion never executes a command — it only renders options; the user pick triggers the standard slash flow
- [x] All 9 GT-CS goldens pass
- [x] Anti-noise heuristics suppress vague / sub-floor / continuation cases (verified by GT-CS3 and dedicated unit tests)
- [x] Three opt-outs functional: settings global, settings blocklist, per-conversation directive
- [x] Suggestion stays silent when an existing always-on rule has the floor (clarification, role-mode, scope-control gate)
- [x] `task ci` exits 0; ADR + changelog in place
- [x] No regression in R1 / R2 / R3 goldens (if shipped)

## Open decisions

- **Confidence floor default** — `0.6` (default) vs. `0.7` (stricter). Lean: `0.6`; tunable per fixtures if false-suggest rate is high.
- **Cooldown default** — `10m` (default) vs. `5m` vs. session-wide. Lean: `10m`; balances "don't nag" with "still helpful when context shifts".
- **Max options** — `4` (default) vs. `3`. Lean: `4`; covers most realistic multi-match cases without scrolling.
- **Per-conversation opt-out syntax** — `/command-suggestion-off` (default) vs. natural-language ("don't suggest commands"). Lean: explicit directive; deterministic.
- **As-is option label** — "Just run the prompt as-is, no command" (default) vs. "Skip — run my prompt as-is". Lean: default; clearer that no command is involved.
- **Suggestion during active engine flows** (mid `/implement-ticket` halt) — suppress (default) vs. show. Lean: suppress; active flow has the floor.

## Risks and mitigations

- **Suggestion fatigue** → confidence floor + cooldown + per-conversation opt-out + global `enabled: false`
- **False positives suggesting wrong commands** → anti-noise heuristics + 9 goldens including adversarial cases + manual replay of 20 real prompts before merge
- **Echo loop (suggestion output re-triggers itself)** → echo-trigger guard + loop tests
- **Stacking with `ask-when-uncertain` (two questions in one turn)** → clarification-wins rule + GT-CS8 covers it
- **Eligibility creep (commands marked eligible without triggers earning their keep)** → linter requires ≥ 2 triggers; periodic eligibility review documented in ADR
- **User confusion about "did the command run or not?"** → suggestion text is unambiguous, "run as-is" option always present, and any picked command emits its standard "running /command" preamble
- **Subordination drift (suggestion fires during a scope-control gate)** → rule explicitly subordinates; goldens cover the conflict cases; rule-compliance audit verifies ordering

## Future-track recipe (deferred)

- **Project-local trigger overrides** — consumer projects extend triggers in `agents/overrides/` — **next roadmap if demand**
- **Auto-suggestion telemetry** — track pick-rate per command, tune floors — **deferred indefinitely**
- **Multi-turn intent detection** — current matcher uses last 3 turns max; broader window deferred
- **ML-based matching** — explicitly out of scope
- **Auto-execute escalation** — explicitly out of scope; the "no auto-execute" anchor is non-negotiable
- **Suggestion for skills or rules** — skills already auto-activate via descriptions; rules via type=auto. No roadmap needed.
