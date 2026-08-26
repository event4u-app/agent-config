---
complexity: lightweight
review_by: 2026-09-19
---

# Stub: road to exercising the YouTube transcript channel

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated
> stub. Created 2026-08-20 when
> [`road-to-gated-reach-followup.md`](../archive/road-to-gated-reach-followup.md)
> was drained: nine of its fifteen lines are gated on a **host-environment
> install this run may not perform**, so they could be neither completed nor
> honestly cancelled. Framework of record:
> [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
> (batch A, `legacy | B | transferred`, quorum 2/2). Outcome state recorded on
> the parent: **transferred** — chosen so that "archived" can never read as
> "achieved". The channel is still unexercised and still `experimental`.

## The criterion, verbatim from the parent

> condition described above clears

That is the whole of it, and its brevity is the reason this stub restates the
condition it points at. The parent's `legacy` blocker was a
`> Blocked until …` note, not a `### blocker:` entry, so the dashboard parser
synthesised its `Resolved when` field rather than an author writing one. The
condition the note described, verbatim:

> Blocked until `yt-dlp` and a JavaScript runtime are installed **by a human** on
> the machine that runs this. Execution starts when the condition clears. The
> package never auto-installs — that is a contract (`missing-tool-handling`), not
> a limitation to work around.

**Narrowed by measurement, and the narrowing travels with the criterion.** The
condition reads as one act and is two, and one of the two is already done — see
§ Producer and probe. The remaining act is a single `pipx install`.

## What moves here — the complete list

Nine items. Six of the parent's fifteen lines stayed and are satisfied there;
they are listed in the last column so nobody re-does them.

| Item | Parent location | Why it moves |
|---|---|---|
| Install the pinned backend + a JS runtime | Phase 1 Step 1 | A host-environment install; the act this package contractually never performs. |
| Exercise the channel — subtitle pull, metadata dump, search | Phase 1 Step 2 | All three operations run through the absent backend. |
| Run the pre-registered Y1–Y6 set, both arms | Phase 1 Step 3 | The reach arm needs the extractor; a native-only half-run scores no channel. |
| Flip `lifecycle: experimental → stable` | Phase 1 Step 4 | Gated on a tally that does not exist. `experimental` correctly stands. |
| Move the YouTube trigger case on the verdict | Phase 1 Step 5 | Its decision input is the missing verdict. The no-ship branch is a no-op and holds today. |
| A transcript extracted, and both doctor states observed | AC 1 | Only the third state (`unknown`) is observable while the backend is absent. |
| Auto-caption dedup **proven by running it** | AC 2 | The criterion explicitly refuses a description. |
| A verdict against the parent's frozen thresholds | AC 3 | A park verdict exists, but by the unexercised rule — not scored against the bands. |
| Trigger set matches the verdict, proven both directions | AC 4 | Re-opens if the verdict changes; the both-directions proof needs a live model run. |

**Not transferred — already satisfied in the parent, do not redo:** the three
prerequisites (reading, bench-convention and pre-registration-authority checks),
Phase 1 Step 6 (the outcome published in `docs/benchmark.md` § gated-reach), AC 5
(the null published and `docs/CLAIMS.md` carrying no claim), and AC 6 (gates).

## Producer and probe — named, not wished

- **Producer:** the **host owner** — the human with write access to the machine
  that runs this repository's sessions. Not "whoever installs it later", and not
  a subsystem: the act is one command run by the person who owns the PATH.
- **Probe, two parts, both must succeed:**
  1. `command -v yt-dlp` resolves.
  2. The JavaScript-runtime probe succeeds — `agent-config reach:doctor
     --channel youtube` reports readiness **`ready`** (or `not-ready` with a
     named config remedy), never `unknown`.
- **Measured baseline, 2026-08-20, so a later reader can tell movement from
  noise:**

  | Probe | Reading |
  |---|---|
  | `command -v yt-dlp` | **fails** — exit 1, does not resolve on PATH |
  | `command -v deno` | fails — exit 1 |
  | `command -v node` | **succeeds** — `/opt/homebrew/bin/node`, `v26.7.0` |
  | yt-dlp user config | **present** at `~/.config/yt-dlp/config`, `--js-runtimes` **yes** |
  | `reach:doctor --channel youtube` readiness | **`unknown`** — backend missing, so readiness is not evaluated |
  | `reach:doctor` backend | `❌ yt-dlp — 'yt-dlp' does not resolve on PATH`; fix (darwin) `pipx install yt-dlp==2026.7.4` |

- **Part 2 of the probe is already satisfied.** A human has installed `node` and
  written the `--js-runtimes` entry. Only part 1 is outstanding, which is why the
  pending act is one `pipx install` rather than the two installs plus a config
  edit the original note implies. Stated because a future reader who trusts the
  note's wording would do work that is already done.
- **`--version` passing is not the probe.** The parent's own invariant: a passing
  `yt-dlp --version` does not imply extraction works, which is the entire reason
  the readiness layer exists. Whoever promotes this must read the doctor's
  readiness line, not the binary's presence.

## Carried forward so the reasoning is not lost with the parent

- **The unexercised rule is why this is a transfer and not a drop.** The parent
  bench's pre-registration
  (`internal/bench/gated-reach/README.md:115-119`) freezes ≥5/6 ship · 3–4/6
  park · ≤2/6 drop, and a channel whose backend cannot be exercised at all
  reaches none of them — it parks. An uninstalled tool is a fact about *this
  machine*, not about the channel. Scoring it a drop would publish a null about
  the wrong subject.
- **Do not substitute a page-scrape stand-in for the extractor.** The parent
  measured a caption-track URL scraped from a watch page: **200 with 0 bytes**.
  The extractor's challenge solving is genuinely required, so a stand-in answers
  a different question and rigs the arm.
- **Y6 is gated even though it reads like local logic.** "Readiness detection
  with a JS runtime unconfigured" needs the doctor to reach `not-ready`, and
  while the backend is absent it reports `unknown` instead. The task cannot run
  before the install either.
- **The thresholds are frozen and must not be re-cut after results.** Y1–Y6 at
  `internal/bench/gated-reach/README.md:173-178`. One documented repair per task
  is allowed; unlimited repair is threshold shopping.
- **Audio transcription for videos with no caption track stays out of scope** —
  parked separately, with its own trigger, because its cost shape (compute or
  per-minute API) makes it a different decision rather than a deeper version of
  this one.
- **The pin may have moved.** `2026.7.4` is the registry's value as of the
  transfer. Re-look it up against the real registry before installing, and if it
  moved, bump it in `src/config/reach-channels.yml` **and** the intake in the
  same commit.

## Promotion gates

The README's shared promotion criteria (recruited customer, funded security
audit, ADR sign-off) **do not govern this stub** — see that file's
`## Drain-run transfers` section. This does:

1. **The two-part probe above returns true**, i.e. `command -v yt-dlp` resolves
   and `reach:doctor --channel youtube` no longer reports readiness `unknown`.
   A capability gate, not a demand gate: the scope decision is already made and
   the work is wanted.

That is the only gate. There is no customer to recruit for a tool that is simply
not installed, and no audit clears an absent binary.

## Seed content on promotion

- Run the parent's Phase 1 Step 2 for real: one subtitle pull, one metadata dump,
  one search — and document the auto-caption line-duplication **with the dedup
  applied**, proven by running it. Consecutive cues repeat their text as the
  caption rolls, so a summary double-counts without it.
- Observe the doctor's **`not-ready`** state as well as `ready`, on the same
  machine, so AC 1's both-states requirement is met by observation rather than by
  assertion. Deliberately unconfiguring `--js-runtimes` after the install is the
  cheapest way to reach it, and it also discharges Y6.
- Run Y1–Y6 both arms and record the rows next to
  `internal/bench/gated-reach/results.md`, including the native control, which is
  expected to fail and **must be measured rather than assumed**.
- Score the channel against the frozen bands and publish the verdict — ship,
  park or drop alike — amending the parent's per-channel table in
  `docs/benchmark.md` § gated-reach rather than writing a competing one.
- Only on a **ship** verdict: flip `lifecycle: experimental → stable` in
  `src/config/reach-channels.yml`, add the intent to
  `src/skills/gated-reach/SKILL.md` triggers **and** move the YouTube case in
  `src/skills/gated-reach/evals/triggers.json` from should-NOT-trigger to
  should-trigger. On park or drop, leave the negative case exactly where it is —
  the skill declines YouTube on purpose, and that stays correct until the
  evidence changes.
- Add a `docs/CLAIMS.md` claim **only** on a ship verdict. Today the file
  correctly carries none.
