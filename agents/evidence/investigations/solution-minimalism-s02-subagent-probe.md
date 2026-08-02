# S0.2 — subagent rule-propagation probe, transcript

> Committed evidence for
> [`solution-minimalism-phase0-spikes § S0.2`](solution-minimalism-phase0-spikes.md).
> Host: Claude Code 2.1.220. Date: 2026-08-02. One subagent, zero tool calls.

## Probe design

The subagent was instructed to answer **from its own context only** and that any
tool call voids the probe — so a correct verbatim quote of a rule body can only
mean the rule text was already in its context window, not that it read a file.
Reported tool-use count for the run: **0**.

## Prompt (verbatim)

```
PROBE — answer from your own context only. Do NOT use any tool. Do NOT read any
file. Do NOT search. If you call a tool, the probe is void.

Report these five items verbatim and literally:

1. Do you have any project-specific instruction text in your context right now
   (a CLAUDE.md, AGENTS.md, an "Iron Law", a rules list)? Answer YES or NO.
2. If YES: list the NAMES of every rule you can see. If NO: write exactly
   NO-RULES-IN-CONTEXT.
3. Quote verbatim the fenced Iron Law block of the rule named `minimal-safe-diff`,
   if it is present in your context. If it is not present, write exactly ABSENT.
4. Quote verbatim the first line of the Iron Law of the rule named
   `commit-policy`, if present. If not present, write exactly ABSENT.
5. Describe in one sentence what instruction sources you DO see.
```

## Response (abridged only where the rule-name list repeats)

**1.** `YES`

**2.** ~105 rule names, including `role-mode-adherence`, `downstream-changes`,
`secret-vcs-guard`, `verify-before-complete`, `minimal-safe-diff`,
`commit-policy`, `scope-control`, `non-destructive-by-default`,
`senior-engineering-discipline`, `improve-before-implement`,
`active-remediation`, `architecture`, `session-canary`. It located them in the
user-global rule set **and** noted the project projection under
`dist/agent-src/rules/`, calling out `source-of-truth` as appearing only in the
project set.

**3.** Reproduced verbatim, matching `src/rules/minimal-safe-diff.md:20-22`:

```
THE DIFF CONTAINS THE SMALLEST CHANGE THAT SOLVES THE STATED PROBLEM.
NEVER REFORMAT, RENAME, OR RESTRUCTURE UNTOUCHED CODE IN THE SAME DIFF.
NEVER ADD DRIVE-BY EDITS, OPPORTUNISTIC REFACTORS, OR DEPENDENCY BUMPS.
```

**4.** `NEVER COMMIT. NEVER ASK ABOUT COMMITTING.`

**5.** *"a Claude-agent system prompt … plus a large `system-reminder` block
carrying codebase and user instructions — the user's global `~/.claude/CLAUDE.md`
→ `RTK.md` and ~105 rule files under `~/.claude/rules/`, the project `CLAUDE.md`
for `event4u/agent-config`, the mirrored rule projections under that project's
`dist/agent-src/rules/`, an auto-memory index (`MEMORY.md`), plus deferred-tool
and available-skill listings."*

## What this does and does not prove

**Proves:** always-on projected rule text is present in a subagent's context on
this host, with no hook and no explicit re-injection by the orchestrator.

**Does not prove:** that the subagent *follows* the rules (presence ≠ adherence);
anything about other hosts; anything about on-demand (tier-2) rules that the
router surfaces per-turn rather than always.
