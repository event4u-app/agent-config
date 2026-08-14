# Skill-catalogue budget — codex as the second host

Measured 2026-08-15 on codex-cli 0.147.0, subscription (ChatGPT) account.
Corpus rows: `agents/evidence/metrics/skill-catalogue.jsonl`.
Roadmap: `road-to-skill-catalogue-budget`.

## What the corpus now holds

| host | kind | entries offered | dropped | survivors | truncation mode | verdict |
|---|---|---:|---:|---:|---|---|
| claude (2026-08-12) | self-reported | 336 | — | — | *(unspecified)* | `no-selector` |
| codex (2026-08-15) | **host-reported** | 497 | 393 | 104 | `budget-strip-all` | `host-declared-budget` |

The claude row is byte-unchanged. It carries no `truncation_mode` and was
deliberately **not** back-filled: it was taken before the distinction existed,
and stamping a mechanism onto it would be a claim nobody made at the time.

**The two verdicts are reported per host and never pooled.** That is Risk 1 of
the plan, and it is enforced by construction rather than by discipline: the
codex path does not call `analyzeSelector` at all. Piping a budget-shaped
observation through the per-entry inference would return
`insufficient-observation` (zero described entries survive a
description-stripping budget) and read as a failed measurement rather than the
decisive one it is.

## The two mechanisms are different, so `no-selector` never meant what it looked like

- **claude** — some entries arrive described, others bare, with no host-stated
  rule. All 16 bare entries *declare* a description; described entries reach
  position #325 while bare ones start at #45. No measured property separates
  the groups: `no-selector`.
- **codex** — the host states its own selector: a **budget**. It strips every
  description first, then drops entries wholesale, and publishes the count on
  its structured channel.

So `no-selector` on claude was never evidence that no selector exists. It was
evidence that claude's is not budget-shaped — exactly the confound the parent
roadmap's blocker warned about.

## The parent's conditional branch: DISCHARGED on this host

`road-to-frontend-skill-application` Phase 2 Step 2 reads *"If the selector is
estate size — project a workspace-scoped skill subset at install."* It was open
because nothing had established estate size as the selector.

On codex it is established, by the host's own words (*"Exceeded skills context
**budget**"*) and by the delta experiment below. **On claude it is not**, and
this measurement does not make it so. The branch fires for codex; it stays
conditional for claude.

## The double-count question: RULED OUT, from host output

The plan flagged an arithmetic reading — 298 skills + 200 commands counted
*twice* = 698, against 393 dropped + survivors — as persuasive and unproven,
and told nothing to build on it. It is now settled without arithmetic.

**Method.** Hold the global estate fixed. Run from a fresh directory twice to
establish that the host's own number is stable, then add *N* project-local
skills to that directory and re-run. If the catalogue counted each artefact
twice, *N* added entries would move the reported drop by 2*N*.

```
baseline run 1: 393
baseline run 2: 393      ← stable, same cwd
+5 project-local skills
after +5 run:   398      ← moved by exactly 5
```

**Conclusion: each artefact is counted once.** The 698 reading is ruled out.
The conservative count is the right one: 297 skills + 200 commands = 497
offered, 393 dropped, 104 surviving — and 104 is a *survivor count*, not a
published cap. No host documents its budget; what is knowable is how many came
through on a machine whose estate was counted at the same moment.

Two further observations from the same experiment, neither of them planned:

1. **The count is working-directory dependent — and not stable over time
   either.** The same estate reported 393 from one directory and 401 from
   another within minutes; later the *same* directory that had read 393 read
   401. So "stable across two runs" above is a statement about one directory
   within one window, and it is the strongest claim the data supports — it is
   what makes the +5 delta readable, not a claim that the number holds.
   Corrected here rather than left standing: an unqualified "stable" is exactly
   the overclaim this file's own Risk-3 lesson warns about. Any figure is
   meaningful only beside the directory *and* the moment it was taken in, which
   is why the corpus row carries `observed_at` and why a limit must never be
   cited from a remembered number.
2. **All five added entries were dropped.** The budget was already exhausted, so
   new entries land past the surviving head rather than displacing anything.
   Adding a skill to an over-budget estate makes it invisible on this host.

## A finding the measurement produced about itself

The first real run reported **297 skills offered against 393 dropped** — more
dropped than offered. That is not a broken parser; it is the projection root
under-covering what the host counted, because the host's catalogue spans
skills *and* commands. Clamping the subtraction would have published a
confident `survivors: 0`.

The tool now reports under-coverage as a named condition
(`codexProjectionUndercovers`) and refuses to publish a derived survivor count
across the gap, and `--command-root` supplies the missing half. The dropped
count — host-reported — was correct throughout; only the denominator was wrong.

## Not established

- **Whether 104 is a cap, a ratio, or a byte budget.** The host reports a count,
  not a rule. The description payload alone measures **55,114 bytes** across 297
  skills, which is the number a description-stripping budget discards first, but
  nothing observed ties survival to bytes rather than to position.
- **Whether claude truncates by budget too.** Its observation predates this
  distinction and its mechanism looked per-entry. One more claude observation
  under the extended schema would answer it; this one does not.

## Reproduce

The instrument is a maintainer script, not a shipped CLI verb — it is run from
the package checkout:

```bash
codex exec --json --skip-git-repo-check - <<< 'reply with exactly: OK' > events.jsonl
./scripts-run src/scripts/capture_skill_catalogue \
  --codex-events events.jsonl \
  --projection-root ~/.codex/skills \
  --command-root ~/.codex/commands \
  --observed-at <ISO date> --record
```

An absent budget event is reported as a **loud failure**, never as
`dropped: 0` — a reworded host message and a fixed defect must not produce the
same record (Risk 3).
