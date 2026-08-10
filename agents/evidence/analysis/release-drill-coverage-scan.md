# Release-drill coverage scan — every `fix(release):` commit vs the drill scenarios

**This report is the FP-measurement input for the `b-drill-ratchet` maintainer
gate decision** (`road-to-feedback-9-29`, blockers): whether coupling
`fix(release):` commits to drill scenarios ships as a gate or stays a
release-checklist line. It is a scan only — no gate, no code change.

## Method

- Enumeration: `git log --oneline --grep="fix(release" --fixed-strings`
  over full history (the parenthesised form makes the unquoted regex variant
  unreliable, so `--fixed-strings` is the enumeration of record; the
  `--grep="fix(release)"` regex variant returns the same commit set plus its
  merge commits). **25** non-merge `fix(release):` commits exist as of
  2026-08-10. Merge commits are carriers, not fixes, and are excluded.
- Drill: `src/scripts/release_drill.ts` (added `a937e5908`, 2026-08-03) runs
  the real `release.ts` `execute()` — checkout → bump → commit → push → PR →
  checks → merge → tag → GitHub Release → cleanup — against a scripted
  FakeWorld via the exec seam. `tests/scripts/release_drill.test.ts` runs
  every scenario in CI. Seven scenarios: `happy-resume`,
  `push-rejected-then-recover`, `behind-then-merge`, `merge-race-recovers`,
  `behind-forever-dies`, `merge-fails-hard-surfaces`, `checks-fail-dies`.
- Verdict vocabulary:
  - **covered** — the failure class has a drill scenario exercising it.
  - **uncovered** — the failure is in `execute()`'s orchestration (reachable
    through the exec seam) but no scenario exercises it.
  - **not-a-drill-class** — the failure lives outside what the drill can see:
    content generation (changelog, footers, highlights, counts), CI gates and
    allowlists, packaging/docs, pre-`execute()` paths (`--dry-run` returns
    before `execute()`), or stdin/TTY mechanics (the seam intercepts exec,
    not input).

## Commit → scenario table (newest first)

| Commit | Date | What broke | Verdict |
|---|---|---|---|
| `049e8b242` | 2026-08-09 | Step 8 tag push: check-then-act race — a parallel `--resume` landed the same tag, loser crashed on `cannot lock ref` although the desired state existed | **uncovered** — orchestration in `execute()`; regression pinned by `tests/scripts/release_tag_race.test.ts`, but no drill scenario replays the race |
| `1af0f0316` | 2026-08-07 | Checks waiter treated "no checks reported" as a pass while required checks simply had not been dispatched (GitHub Actions incident) — 9.26.0 merged/tagged/published unvalidated | **uncovered** — orchestration; `checks-fail-dies` covers failing checks, not absent-checks-as-pass |
| `47faa19e0` | 2026-08-07 | Step 4 push recovery armed on EVERY non-zero push; a pre-push-gate rejection was masked as a moved remote ref and the real error never surfaced | **uncovered** — adjacent to `push-rejected-then-recover` (moved-ref recovery IS drilled); the non-move-failure-must-surface direction has no scenario |
| `2f23d6bb9` | 2026-08-04 | `--dry-run` preview skipped the head pre-fill and printed the `_none_` skeleton the real run would not write | **not-a-drill-class** — `--dry-run` returns before `execute()`; outside the drill by the drill's own design |
| `8fe60e9ab` | 2026-08-04 | Release-highlights generator wrote a `_none_` the highlights gate rejects | **not-a-drill-class** — content generation + gate |
| `ad02d92ec` | 2026-08-03 | `gh pr` invocations resolved the PR from the wrong HEAD when the branch was not passed explicitly | **covered** — one of the three 2026-08-03 bugs the drill was built from; every scenario asserts branch-explicit `gh pr …` call strings |
| `ffe6b5b0a` | 2026-08-03 | Push and merge steps died when main moved under the run (rejected push; BEHIND head at merge) | **covered** — `push-rejected-then-recover`, `behind-then-merge`, `merge-race-recovers`, `behind-forever-dies` |
| `8db87abcc` | 2026-08-03 | Release-PR shape gate rejected `package-lock.json` | **not-a-drill-class** — CI gate allowlist |
| `3bba94e2e` | 2026-08-02 | Legacy-root ratchet + lockfile drift in the shape gate | **not-a-drill-class** — CI gate |
| `4ad743ee3` | 2026-08-02 | Highlights dedup key embedded its separator raw | **not-a-drill-class** — content derivation |
| `5dc9491de` | 2026-08-02 | Release-PR content checks did not see the release | **not-a-drill-class** — CI gate / scope probe |
| `45b6eb221` | 2026-07-31 | Test-count probe exceeded the 1 MiB subprocess buffer | **not-a-drill-class** — content probe |
| `a56d1fd14` | 2026-07-31 | 9.10.0 CHANGELOG section lost its Tests footer | **not-a-drill-class** — changelog content |
| `33167fce1` | 2026-07-29 | Two first-contact gate failures on the 9.9.0 release PR (footer gate anchored on the era banner; packed-artifact eval died on npm JSON) | **not-a-drill-class** — CI gates |
| `0d18fbc1a` | 2026-07-29 | Two contract files missing from npm `files[]` | **not-a-drill-class** — packaging |
| `d47949e13` | 2026-07-22 | Step 9 tag-workflow dispatch threw on a token 403 AFTER the release had shipped — a completed release reported failure | **uncovered** — orchestration in `execute()`; no dispatch-failure scenario |
| `653863666` | 2026-07-08 | Tests-footer counter recursed into vitest | **not-a-drill-class** — content probe |
| `572e6ce83` | 2026-07-07 | Era-split gate measured the wrong (pre-release) state | **not-a-drill-class** — CI gate |
| `0a414b7e8` | 2026-06-29 | Project-template version-pin gate wrong + manual | **not-a-drill-class** — CI gate |
| `f41be3d27` | 2026-06-22 | `[y/N]` confirm read fd 0, which Node treats as non-blocking under a pty — EAGAIN swallowed, release auto-aborted | **not-a-drill-class** — stdin/TTY mechanics; the exec seam cannot simulate input channels |
| `383704813` | 2026-06-21 | Era-split gate measured only the newest era body | **not-a-drill-class** — CI gate |
| `548803ac8` | 2026-06-21 | `task release` spawned with stdin detached — confirm hit EOF and aborted silently | **not-a-drill-class** — stdin/TTY mechanics |
| `59f6bd2bc` | 2026-06-12 | Three fixes: PR/notes body over GitHub limit (content); empty `git commit` crash on resume after era-split (orchestration); count-sync patterns (content) | **uncovered** — the empty-resume-commit half is `execute()` orchestration with no asserting scenario (`happy-resume` walks the resume path but does not exercise an empty index); the other two halves are not-a-drill-class |
| `f2db736c7` | 2026-06-02 | `--resume` derived the target from the highest stale `release/*` branch and would have tagged a downgrade (5.4.0 instead of 5.8.0); merged branches never deleted | **uncovered** — resume target mis-detection has no scenario; the cleanup half is covered in passing (`happy-resume` asserts `--delete-branch`) |
| `f95804d90` | 2026-05-24 | Version bump not propagated to the 36 pack manifests | **not-a-drill-class** — content/regeneration |

## Totals

| Verdict | Count | Share of 25 |
|---|---|---|
| covered | 2 | 8% |
| uncovered (drill-class, no scenario) | 6 | 24% |
| not-a-drill-class | 17 | 68% |

Drill-class subset (covered + uncovered): **8 of 25** — of which the drill
covers 2 and misses 6 (`049e8b242` tag race, `1af0f0316` absent-checks-as-pass,
`47faa19e0` non-move push failure surfacing, `d47949e13` post-ship dispatch
failure, `59f6bd2bc` empty resume commit, `f2db736c7` resume target
mis-detection).

## Reading for the gate decision

- A naive gate — "every `fix(release):` commit must name a drill scenario" —
  would have false-positived on **17 of 25 (68%)** of history: gates, content
  generation, packaging and TTY mechanics have no scenario to name and never
  will under the current exec-seam harness. That is the FP rate the
  `b-drill-ratchet` decision asked for.
- A gate scoped to **drill-class** commits (touching `execute()` orchestration)
  would have fired correctly on 6 of 8 — but "touches `execute()`
  orchestration" is a judgement the table above made by reading commit bodies,
  not a predicate a gate can evaluate mechanically. Any mechanical
  approximation (e.g. "diff touches `src/scripts/release.ts`") misclassifies
  content-generation commits inside `release.ts` (`4ad743ee3`, `8fe60e9ab`)
  as drill-class.
- Timing context: the drill exists since 2026-08-03 (`a937e5908`). 20 of the
  25 commits predate it; of the 5 after it, 3 are drill-class and all 3 are
  currently uncovered — the post-drill period has so far produced new failure
  modes faster than scenarios.

No recommendation is made here — the maintainer decision (`b-drill-ratchet`)
consumes these numbers.
