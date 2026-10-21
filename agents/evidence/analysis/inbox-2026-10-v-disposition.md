# Inbox round inbox-2026-10-v — disposition

<!-- evidence-type: analysis -->

> **Source:** `agents/tmp.old/inbox-2026-10-v/` — one owner transcript (three
> turns), two agent-drafted proposals pinned at `main@8a2c3b4`, one external
> three-loop plan at the same pin, and a source annex that stays in the
> gitignored inbox. Verified against `main@324969e7e` on 2026-10-21 by two
> independent read-only passes plus two scratch-repository reproductions.
> Codenames only; the true source is recorded once, encrypted, in the round's
> intake note.

## What the round produced

| Roadmap | Carries |
|---|---|
| `road-to-advisories-heard-the-same-day` | inventory incl. runtimes, authorities, verdicts, tiers, the session notice, `/audit deps` |
| `road-to-security-fixes-carried-to-the-merge` | minimal fix, authority re-check, routing, PR evidence, release draft, follow to deployed |
| `road-to-worktrees-that-leave-after-the-merge` | squash-aware merge evidence, automatic removal of the proven set, merge-time and daily triggers, consumer reach |

`stubs/road-to-worktree-lifecycle.md` moved to `skipped/`, superseded.

## Recurrence

Worktree cleanup has arrived **three** times: the 8.0/8.1 review dumps that
produced the stub (council 2026-07-08: "zero demand"), a 12.0.0 feedback line
("Worktree Cleanup adressierte nur zwei von 304 Worktrees"), and this round. <!-- md-language-check: ignore -->
Outcome per `recurring-criticism`: **the disposition was wrong** — the stub's
gate counted requests while the tree's own checker had measured 304 registered
trees on 2026-08-13. The owner decided the open question this round (D1 in the
worktree roadmap), so no owner decision remains.

## Verification summary

| Plan claim | Verdict | Evidence |
|---|---|---|
| Squash merges never class as merged | still-true, **reproduced** | scratch repo: squash twin `review`, merge-commit twin `safe` |
| "Every first-parent commit has one parent" | never-true | 66 of the last 500 first-parent commits are merges |
| "Plain `worktree remove` cannot lose data" | **diverged** | scratch repo: an ignored `local.cfg` is deleted, exit 0 |
| Plain `-d` free, `-D` needs a grant | never-true | `git_command_classifier.ts:157,313-331`: both `branch-delete`, WARN |
| Reuse the retro's `gh pr list` batch | never-true | `retro_sweep.ts:430-450` reads per PR |
| ~250 stale trees | unverifiable here | this checkout: 73 linked, 47 outside the standard roots |
| `/pr:merge` line refs, process-full lane refs | stale | files rewritten since the pin |
| ADR-294+ free for proposals | stale | ADR-294 landed in #2557 |
| Advisory defects D1–D11, constraints C1–C8 | still-true | per-row file:line in the roadmaps' Context tables |
| The pinned advisory red is live | already-fixed | lockfile past both fixed versions; kept as replay fixture |

## Point ledger

Anchor census: 1 topic, 5 files, 339 anchors, 0 revision sets
(`inbox_source_census`). Three extraction passes; pass 2 added W4, W5, W6, W8
and A-plan items 2.5 / 4.1-F10 / 1.5; pass 3 found no `adopted-not-found`.

### Owner demands (transcript)

| ID | Demand | Disposition |
|---|---|---|
| T1-D1 | Check security updates for every tool, framework, language and package a project uses, and propose them | adopted — advisories 1.1, 2.1 |
| T1-D2 | At least daily, or more often (constraint) | adopted — advisories 0.1 TTN bar, 4.1, 5.3 |
| T1-D3 | Tell the user by importance | adopted — advisories 3.1, 0.3 |
| T1-D4 | The PHP pre-announcement as the worked case | adopted — advisories F2, AC-1; fixes G6, AC-1 |
| T1-D5 | Research deeply, three loops, then a roadmap | already-satisfied — the supplied plans did this; this run re-verified them |
| T2-D1 | Actively help fix, not only notify | adopted — fixes Goal, Phases 1–2 |
| T2-D2 | In the branch/PR, or a worktree with its own PR and release | adopted — fixes 2.1, 2.2, 2.4 |
| T2-D3 | As fast and as well as possible (constraint) | adopted — fixes 0.1 TTR bar, 1.4 |
| T2-D4 | Worktree cleaned up at the latest after the merge (constraint) | adopted — worktrees 3.1, AC-1 |
| T2-D5 | Checked regularly, cleaned automatically where possible | adopted — worktrees 3.3, D1 |
| T2-D6 | 250 stale trees today | adopted — worktrees 4.3, AC-2 |
| T3-D1 | Work in worktrees, one PR with all roadmaps as `ready` | adopted — this change |

### Supplied-plan sections

Anchor counts per file are the census's; the per-section dispositions below
are not counted separately.

| Source file | Anchors | Disposition |
|---|---|---|
| owner transcript | 22 | two user turns plus this run's invocation → the twelve demand rows above; the agent turns are summaries of the two proposals and add no point beyond them |
| v4 advisories proposal | 68 | Goal, D1–D11, C1–C8, Bestand: adopted, re-verified, line refs corrected. Phases 0–4 and 8 → advisories Phases 0–5; Phases 5–7 → fixes Phases 1–3. E1–E11 and K1–K13 → Decisions and non-goals; E9 changed (fixes D2), E11 kept (fixes D3) |
| worktree proposal | 34 | adopted with W4–W8 added; E1 decided by the owner (worktrees D1); E2 changed (worktrees D3) |
| external three-loop plan | 214 | **Adopted:** unknown ≠ safe, private names never leave, feed text is data, no auto-merge, declared vs deployed runtime, vendor backports, corrected advisories, one fetch for five sessions, re-scan after fix, bot-PR reuse, mitigation without a patch, one remediation per fingerprint, merged ≠ deployed, squash evidence, no `--force`, ignored-but-important files, dry-run-first migration. **Declined:** SQLite state, leases and job queue (advisories D3); hourly polling and an OS scheduler (advisories D6); a separate `security` CLI (advisories 5.1 uses `audit`); image-digest drift, OS-layer, IaC and managed-runtime scanning (out of scope until TTN is measured); MCP/skill supply chain (owned by `supply-chain-intake`); notification channels and a GUI; the PR series (phases carry the order); cross-host worktrees, backup export, disk-pressure UI |
| source annex | 1 | not carried — stays in the gitignored inbox |

Total 339, unaccounted 0.
