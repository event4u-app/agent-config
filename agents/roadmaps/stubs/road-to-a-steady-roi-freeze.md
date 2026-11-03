---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: a ROI freeze check the runner agrees with

> **Arrivals:** 1 — `inbox-2026-11-n` (2026-11-03): seen red on PR #2817's CI;
> the defect predates that branch, which touches no media file.

> **Stub — not active work.** It needs a reproduction on the CI runner itself,
> which no local or emulated run has produced.

## Goal

A steady ROI freeze test.

## The defect

`tests/scripts/media_video_qa.test.ts` › "finds a region frozen while the frame
around it moves" fails on `Node Tests (ubuntu-latest, shard 2/4)`: the frozen
ROI reports no freeze (`expected 0 to be greater than 2.4`).

## Evidence

- Red on three runs of PR #2817 (run 41591575892, run 41596498855 attempts 1
  and 2) and on `chore/auto-learnings-1` (run 41596351458), a branch with no
  shared change. Green on `main` at `81788b6e63` (run 41582787410).
- Same runner image (provisioner `20261021.618`) and the same ffmpeg package
  (`7:8.0.1-3ubuntu2`, `amd64v3`) on the green and the red runs.
- Green locally on macOS and in an `ubuntu:26.04` container under amd64
  emulation (9/9), which installs the generic, not the `amd64v3`, build.
- The case was last changed by the main commit that made ROI freeze tolerate
  codec noise at −40 dB with a coarser-quantiser fixture.

## Items

1. Capture the ROI's per-frame difference on the runner (an upload of the
   fixture and of `video-qa.sh`'s raw freezedetect output from a failing job).
2. Decide from that capture whether the noise floor, the fixture's quantiser
   or the ROI crop is what the `amd64v3` build reads differently, and fix
   that one, with the case seen red on the runner before the fix.

## What closes it

The case is green on ten consecutive `ubuntu-latest` runs, and the fix names
which of the three inputs moved.
