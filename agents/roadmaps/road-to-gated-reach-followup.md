---
complexity: lightweight
status: ready
parent_roadmap: road-to-gated-reach
---

# Roadmap: Follow-up to Road to gated reach — exercise the YouTube channel

> Turn `youtube-transcripts` from **parked-unexercised** into a scored channel:
> one real extraction, then a lifecycle decision made on evidence.

> Blocked until `yt-dlp` and a JavaScript runtime are installed **by a human** on
> the machine that runs this. Execution starts when the condition clears. The
> package never auto-installs — that is a contract (`missing-tool-handling`), not
> a limitation to work around.

> **Answer (consolidated decision sheet, 2026-08-20) — NOT COVERED by option (a);
> disposition `transferred`.** This gate is a legacy `> Blocked until …` note rather
> than a `### blocker:` entry, so it has no `Recommendation:` field and the sheet
> renders it with **no default at all** — there is nothing for an accept-all-defaults
> answer to accept. Independently, installing `yt-dlp` and a JavaScript runtime is a
> host-environment modification, which the council framework in
> [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md)
> assigns categorically to `transferred`. Batch A dispositioned it there with the
> three-point check: original criterion verbatim, "condition described above
> clears"; the entire roadmap moved; re-entry producer the host owner, probe
> `command -v yt-dlp` plus this roadmap's JavaScript-runtime version probe both
> succeeding in the execution environment. Converting the note into a real blocker
> entry is what would give it a default, and that conversion belongs to this
> roadmap's own closure, not to the decision-sheet run.

## Context

This roadmap collects items deferred from
[`agents/roadmaps/archive/road-to-gated-reach.md`](archive/road-to-gated-reach.md).
See the parent's archive entry for the original rationale.

Why they were deferred rather than dropped: the parent's pre-registration carries
an **unexercised rule** — a channel whose backend cannot be exercised at all
cannot reach a ship verdict, and is parked rather than scored as a drop, because
an uninstalled tool is a fact about *this machine*, not about the channel. All
three Phase-2 items and the YouTube acceptance criterion hang on that one fact.

**What already shipped, so this roadmap does not redo it:** the readiness check
itself. The doctor resolves the extractor's real config path the way the tool
does (XDG first), reads it bounded and symlink-refusing, checks for the literal
runtime flag, gates the remedy on the installed version, and emits an idempotent
OS-specific fix command — with a distinct `not-ready` channel state so
"installed" is never confused with "able to extract". 93 tests cover it. What is
missing is the **proof that extraction works**, which no amount of local logic
can supply.

## Prerequisites

- [ ] Read `AGENTS.md` and the parent archive entry.
- [ ] Bench convention: `internal/bench/<name>/` with the registration committed
  before the run, prototypes in gitignored scratch, arms judged independently on
  pre-declared evidence.
- [ ] The parent's pre-registration (`internal/bench/gated-reach/README.md`) is
  the authority for the Y1–Y6 task set and the ship/park/drop thresholds. Do
  **not** re-cut them after seeing results — that is the threshold shopping the
  bands exist to prevent.

## Phase 1: YouTube — exercise and score the channel

- [ ] **Step 1** *(from parent Phase 2 Step 1)*: Operator installs the pinned
  backend (`pipx install yt-dlp==<pin>` — pin re-looked-up against the real
  registry first and bumped in registry + intake in the same commit if it moved)
  plus a JavaScript runtime. Only Deno is enabled by default; with Node the
  yt-dlp user config needs `--js-runtimes node`, and the doctor prints the exact
  idempotent command.
- [ ] **Step 2** *(from parent Phase 2 Step 4)*: Exercise the channel for real:
  one subtitle pull, one metadata dump, one search. Document the auto-caption
  line-duplication and the dedup step — consecutive cues repeat their text as the
  caption rolls, so a summary double-counts without it.
- [ ] **Step 3**: Run the pre-registered Y1–Y6 task set from the parent's
  registration, both arms, and record the rows next to the parent's
  `internal/bench/gated-reach/results.md` — including the native control, which
  is expected to fail (a YouTube watch page answers 200 with metadata and no
  transcript) and must be measured rather than assumed.
- [ ] **Step 4** *(from parent Phase 2 Step 5)*: Flip `lifecycle: experimental →
  stable` **only** after a real run, per the registry's own vocabulary — and only
  if the tally clears the ship threshold. A park or drop verdict leaves
  `experimental` in place and is published like any other outcome.
- [ ] **Step 5**: If the channel ships, add its intent to
  `src/skills/gated-reach/SKILL.md` triggers **and** to
  `src/skills/gated-reach/evals/triggers.json` — moving the current
  should-NOT-trigger YouTube case to a should-trigger case. If it parks or drops,
  leave the negative case exactly where it is: the skill currently declines
  YouTube on purpose, and that is correct until the evidence changes.
- [ ] **Step 6**: Publish the outcome in `docs/benchmark.md` § gated-reach — ship,
  park or drop alike — and amend the parent's per-channel verdict table rather
  than writing a competing one.

## Acceptance Criteria

- [ ] A YouTube transcript is extracted after the human install, and the doctor
  demonstrably distinguishes "installed" from "ready to extract" on the same
  machine (both states observed, not just the passing one).
- [ ] The auto-caption duplication is documented **with the dedup applied** in the
  prescription, proven by running it — not described.
- [ ] A per-channel verdict for `youtube-transcripts` exists against the parent's
  frozen thresholds, with no aggregate band.
- [ ] The skill's trigger set matches the verdict exactly, proven in both
  directions by the trigger eval.
- [ ] If the channel does not ship, the null is published and
  `docs/CLAIMS.md` gains **no** claim for it.
- [ ] All quality gates pass — see `quality-tools`.

## Notes

- **A passing `yt-dlp --version` is not evidence of anything extraction-shaped.**
  That is the blind spot the parent's readiness layer exists to close, and it is
  the reason this roadmap cannot be closed by installing the binary alone.
- **Do not substitute a page-scrape stand-in for the extractor.** The parent
  measured a caption-track URL scraped from a watch page: 200 with **0 bytes**.
  The extractor's challenge solving is genuinely required, so a stand-in would
  answer a different question and rig the arm.
- Audio transcription for videos with **no** caption track is deliberately out of
  scope here — it is parked separately, with its own trigger, and its cost shape
  (compute or per-minute API) makes it a different decision rather than a deeper
  version of this one.
