---
complexity: lightweight
status: ready
parent_roadmap: road-to-gated-reach
---

# Roadmap: Follow-up to Road to gated reach — exercise the YouTube channel

> Turn `youtube-transcripts` from **parked-unexercised** into a scored channel:
> one real extraction, then a lifecycle decision made on evidence.

> **Gate retired 2026-08-20 — transferred, not cleared.** Execution needed
> `yt-dlp` and a JavaScript runtime installed **by a human** on the machine that
> runs this. That condition did not clear; it moved to
> [`stubs/road-to-youtube-channel-exercise.md`](stubs/road-to-youtube-channel-exercise.md).
> The package never auto-installs — that is a contract
> (`missing-tool-handling`), not a limitation to work around. This paragraph
> deliberately no longer opens with the legacy blocked-until wording: that
> phrasing is what the dashboard parser synthesises a placeholder `legacy`
> blocker from, and the blocker is now a real entry under `## Blockers` below.

> **Answer (consolidated decision sheet, 2026-08-20) — NOT COVERED by option (a);
> disposition `transferred`.** This gate was a legacy `> Blocked until …` note rather
> than a `### blocker:` entry, so it had no `Recommendation:` field and the sheet
> rendered it with **no default at all** — there was nothing for an accept-all-defaults
> answer to accept. Independently, installing `yt-dlp` and a JavaScript runtime is a
> host-environment modification, which the council framework in
> [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md)
> assigns categorically to `transferred`. Batch A dispositioned it there with the
> three-point check: original criterion verbatim, "condition described above
> clears"; the entire roadmap moved; re-entry producer the host owner, probe
> `command -v yt-dlp` plus this roadmap's JavaScript-runtime version probe both
> succeeding in the execution environment. Converting the note into a real blocker
> entry is what would give it a default, and that conversion belongs to this
> roadmap's own closure, not to the decision-sheet run. That conversion is done
> below, and this closure is it.

## Outcome

**Archived does not mean achieved.** The channel is still unexercised and still
`experimental`. Nothing here scored `youtube-transcripts` against the parent's
frozen thresholds, and no claim was added for it.

| Phase | Satisfied | Narrowed | Transferred | Abandoned |
|---|---|---|---|---|
| Prerequisites | 3 | — | — | — |
| Phase 1 | 1 (Step 6) | — | 5 (Steps 1-5) | — |
| Acceptance Criteria | 2 (AC5, AC6) | — | 4 (AC1-AC4) | — |

- **Satisfied (6 of 15).** The three prerequisites are reading and
  registration-existence checks that never depended on the backend. Step 6
  publishes the outcome, which for a non-shipping channel is the null — and a
  null is publishable today. AC5 is the non-ship branch of a conditional whose
  condition holds now. AC6 is the gate run.
- **Transferred (9 of 15).** Everything whose evidence requires a real
  extraction: the install itself, the exercise, the Y1-Y6 run, the lifecycle
  flip, the verdict-conditional trigger change, and the four acceptance criteria
  that quote extraction output or a threshold-derived verdict. All nine move to
  [`stubs/road-to-youtube-channel-exercise.md`](stubs/road-to-youtube-channel-exercise.md).
- **Divergence from the council record, stated rather than buried.** Batch A
  reads "Move the entire roadmap." Measured against the file, six of the fifteen
  lines have no dependency on the absent backend, so moving them would have
  transferred work that was already doable and inflated the stub. The
  *disposition* is the council's and is unchanged: `transferred`, because the
  producer is the host owner. Only its scope is narrower, and narrower in the
  direction that leaves less parked.

### Probe baseline, measured 2026-08-20 in the execution environment

Recorded so a later reader can tell real movement from noise. The re-entry probe
is two readings, and **they do not agree** — which is the finding, because the
blocker's own wording ("`yt-dlp` **and** a JavaScript runtime") reads as one
condition and is two.

| Probe | Command | Reading 2026-08-20 |
|---|---|---|
| Backend | `command -v yt-dlp` | **fails** — exit 1, does not resolve on PATH |
| Runtime | `command -v deno` | fails — exit 1 |
| Runtime | `command -v node` | **succeeds** — `/opt/homebrew/bin/node`, `v26.7.0` |
| Config | `reach:doctor --channel youtube` | config `~/.config/yt-dlp/config` **present**, `--js-runtimes` **yes**, runtimes on PATH `node`, version **not confirmed** |
| Readiness | `reach:doctor --channel youtube` | `unknown` — the backend is missing, so extraction readiness is not evaluated |

**The runtime half of the gate is already satisfied.** A human has installed
`node` and written the `--js-runtimes` entry the extractor needs; only the
backend is absent. So the remaining act is narrower than the original note
implies — one `pipx install`, not two installs plus a config edit.

**The readiness state is `unknown`, not `not-ready`.** That distinction is why
AC1 cannot be part-credited: it asks for **both** states observed on one
machine, and while the backend is missing the doctor never reaches `not-ready`.
Only the third state is observable today. For the same reason the pre-registered
task **Y6** ("readiness detection with a JS runtime unconfigured") is gated too,
even though it reads like a local-logic task.

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
