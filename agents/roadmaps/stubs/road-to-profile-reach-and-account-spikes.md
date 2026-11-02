---
complexity: lightweight
review_by: 2026-12-15
---

# Stub: road to profile reach and account spikes

> **Stub — not active work.** Carried out of `road-to-the-profile-the-session-runs-in` (round `inbox-2026-11-l`, 2026-11-02): everything here needs real accounts on the owner's machines, which no repository run has.
> **Arrivals:** 1 — `inbox-2026-11-l` (2026-11-02).

## What is carried

1. **Global-layer reach (old P-6).** AC installs its user scope to `~/.claude/` and `~/.codex/` (`install.ts:1667`, `:1676`; `globalRuleLayers.ts:65`, `:115`). The account tool shares `skills/`, `commands/`, `agents/`, `settings.json` from `~/.claude` but **not** `rules/`, and shares nothing for Codex profiles. So AC rules probably do not reach a profile session. Derived, not tested. Once S2/S3 answer: `doctor` checks reach under an active profile; the fix is the account tool sharing `rules/` (AC writes nothing into profile trees, K7).
2. **Gemini path formula (P-2).** Wait for S4; until then doctor prints a hint (shipped).
3. **`kind` / `parent` in the session record.** Only if S5 shows the hook input carries a parent id.
4. **Spike protocol** under `agents/evidence/` with date and versions, null results included.

## Spikes

| # | Question | Decides |
|---|---|---|
| S0 | Does the account tool's CLI run over SSH on Linux with two Claude and two Codex profiles, session move included? | whether AC needs any remote work (expected: no) |
| S1 | macOS: under a profile, is the Keychain entry suffixed and the unsuffixed one absent? | fixture confirmation for P-1 |
| S2 | Does Claude Code under `CLAUDE_CONFIG_DIR` read `<dir>/rules` instead of `~/.claude/rules`? | whether item 1 is real for Claude |
| S3 | Does Codex under `CODEX_HOME` read `AGENTS.md` / skills from `<CODEX_HOME>`? | whether item 1 is real for Codex |
| S4 | What does `GEMINI_CLI_HOME` replace — home, or `.gemini`? | item 2 |
| S5 | Does the Claude Code SessionStart hook input carry a parent / subagent id? | item 3 |

## Blockers

### blocker: real-account-spikes

- **Status:** open
- **Owner:** maintainer
- **Blocks:** items 1-4 above; promotion of this stub.
- **What to do:** run spikes S0-S5 on machines with two real profiles per provider and record each result under `agents/evidence/` with date and host versions — options: (1) run all six, (2) run S2/S3 only (unblocks item 1, the one with user impact), (3) leave parked.
- **Recommendation:** option 2 — S2/S3 decide whether AC rules silently miss every profile session.
- **If you do nothing:** AC keeps detecting the right login and sessions under a profile (shipped), but whether its global rules reach that session stays unknown.
- **Resolved when:** S2 and S3 each have a dated evidence file naming the host version and the observed behaviour.
