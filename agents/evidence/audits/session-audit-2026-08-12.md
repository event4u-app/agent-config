# Cross-project session audit — 2026-08-12

Scope: every transcript store under `~/.claude/projects/` holding at least one
session modified within 28 days. Instrument: `conformance_scan --store` — the
same classifiers the shipped gates import, so the scan and the gates cannot
disagree silently.

## Corpus — stated per store, because the requested shape was not satisfiable

The request was "the last 30 sessions from each project". **Only one store
holds 30 in-window sessions.** The rest are smaller, and saying so is the
finding: a per-project 30 would have to invent 20+ sessions in most stores.

| Store | Sessions (≤28 d) | Assistant turns |
|---|---:|---:|
| `agent-config` (main) | 37 | 3 071 |
| `agent-config` wt `worker-recycling` | 24 | 1 067 |
| `private/agent-switch` | 19 | 3 368 |
| `private/capisco` | 17 | 2 664 |
| `agent-config` wt `roadmap-next` | 11 | 779 |
| `agent-config` wt `road-to-release-truth` | 11 | 490 |
| `galawork/galawork-api` | 10 | 593 |
| **Total** | **129** | **12 032** |

Stores holding fewer than 10 in-window sessions were not scanned individually
(41 further stores, mostly single-session worktrees). `private/capisco` (17)
and `private/agent-switch` (19) are the largest non-package corpora — a
per-project 30 is unreachable there by a wide margin.

`private/capisco` and `private/agent-switch` carry no project-scope install
(no `.claude/rules/`, no `.agent-settings.yml`); they receive the user-global
install only. That makes them a single-carrier control group against this
package's two-carrier condition.

## Violation counts, per store

| Store | language-pin | git-auth | vacuous | steering | completion-claim |
|---|---:|---:|---:|---:|---:|
| `agent-config` main | 408 | 0 | 3 | 2 | 21 |
| wt `road-to-release-truth` | 141 | 0 | 0 | **21** | 2 |
| wt `roadmap-next` | 25 | 0 | 0 | 1 | 3 |
| wt `worker-recycling` | 1 | 0 | 0 | 0 | 3 |
| `private/agent-switch` | 308 | **2** | 0 | 0 | 15 |
| `private/capisco` | 776 | **1** | 0 | 0 | 2 |
| `galawork-api` | 7 | 0 | 0 | 0 | 0 |

## Era split — `language-pin` is closed, not open

`language-pin` is the largest raw count (1 666 across all stores) and the
easiest to mis-sell. Splitting this package's main store by date:

```
2026-07-29  b01eda65  118
2026-08-01  1a5c2b99    1
2026-08-04  adf0e5fc   98
2026-08-05  a1317be7    1
2026-08-05  df8171b3  156
2026-08-06  0571cbc6   34
   (none after 2026-08-06)
```

The `user_prompt_submit` language-pin carrier landed 2026-08-06. **Every
violation predates its own fix.** No work is proposed against it; booking the
historical count as a live defect would be the exact over-claim the scan's own
header warns about.

## What this audit cannot see

Stated because the instrument states it, and an unstated blind spot reads as a
clean bill of health:

- **`ask-shape`** (trailing free-text offer instead of numbered options) —
  measured nowhere. `user-interaction` says plainly that the discriminator
  needs judgement and that no gate ships for it. This is also the single most
  frequent complaint in the operator's own turns (see below), so its absence
  from the counts is a real gap, not a rounding error.
- **Checkbox batching** — measured nowhere.
- **Session-canary / promissory closings** — not in these counts, but probeable
  via `probe_session_canary` / `probe_promissory_closing`.

## Operator corrections — the qualitative half

36 user turns across the corpus read as a correction. Clustered:

| Cluster | Count | Representative |
|---|---:|---|
| Autonomy stopped early / asked instead of continuing | 6 | *"Warum hast Du nur eine phase gemacht, obwohl ich roadmap-process-full gesagt habe?"* |
| CI / release broken, not fixed autonomously | 5 | *"die ci bricht. solltest du die scheiße nicht automatisch fixen?"* | <!-- md-language-check: ignore -->
| Delegation not used | 1 | *"Wir haben ja festgelegt, dass der Hauptchat Subagents starten soll. Das ist nicht nur ein 'Ich möchte', sondern ein muss."* | <!-- md-language-check: ignore -->
| Uncommitted files left behind | 2 | *"wir haben Dateien die nicht im git sind."* | <!-- md-language-check: ignore -->
| Reply-close / PR link missing | 1 | *"Du sollst laut agent-config den pr link immer am ende schreiben."* |
| Design fidelity ignored | 1 | *"Du hast Dich überall nicht an das Design gehalten. Es sollte 1:1 übernommen werden."* | <!-- md-language-check: ignore -->
| Inbox `tmp` → `tmp.old` not executed | 1 | *"du hast gerade dateien aus tmp abgearbeitet. danach sollten diese doch nach tmp.old verschoben werden."* | <!-- md-language-check: ignore -->
| Question answered by running off instead | 1 | *"Wenn ich etwas frage, will ich eine Antwort. Du bist schon mehrfach einfach los gelaufen."* | <!-- md-language-check: ignore -->

The delegation line and the F1 finding are the same defect seen from two
sides: the operator demands fan-out, and a blocking guard eats it.

Note for whoever runs the next audit: **this analysis was requested three
times** (`0571cbc6`, `3d50d0df`, and the session that produced this note), and
the second request opened with *"warum wurde das nicht gemacht?"*. <!-- md-language-check: ignore -->

## F4 resolved during execution — all three were false positives

The three `git-authorization` hits were read back in full (the scan truncates
commands to 110 chars, which hid the shape). None was an unauthorized
operation; all three were **misclassifications of read-only or harmless
commands**, and all three were `BLOCK` severity:

| Session | Command | Classified | Actually |
|---|---|---|---|
| `agent-switch/fe28ecf4` t32 | `gh pr create … --title "…(unblock npm publish)"` | `publish` | a PR *about* a publish problem |
| `agent-switch/fe28ecf4` t33 | `gh api repos/…/releases/latest --jq …` | `release` | a GET |
| `capisco/a88ef17a` t22 | `gh api repos/jdx/aube-action/releases --jq …` | `release` | a GET on a third-party repo |

Two causes, both fixed: unanchored verb patterns (a verb *named* in a quoted
argument counted as one *invoked*), and `gh api` path matching with no
HTTP-method check. Re-scanned after the fix: **`git-authorization` 0** in both
stores, down from 2 and 1.

The operator-facing consequence is worth stating next to the complaint cluster
above. On a hook-bound host this guard would have refused both the PR that
carried the publish fix and the read-only call that diagnoses why a release did
not appear — in the same window whose transcripts carry these two lines:

> *"Ich kann wieder nicht releasen. Warum nicht?"* <!-- md-language-check: ignore -->
> *"SChon wieder geht das release nicht !!!"* <!-- md-language-check: ignore -->

## Findings carried into a roadmap

`road-to-fan-out-guard-correctness.md` carried F1 (fan-out guard), F2
(store-slug mangling) and F4 (git authorization) to completion; it is archived.
F3 is recorded above as a measurement gap and deliberately **not** turned into
a gate — `user-interaction` states that the ask-shape discriminator needs
judgement and that no gate ships for it, so building one here would be the
theatre the conformance scan's own header refuses.

One consequence of that is worth carrying forward: the most frequent complaint
class in this corpus is the one class nothing measures. That is a known,
deliberate blind spot, not an oversight — but it does mean the counts above
under-state how often the operator had to correct behaviour.
