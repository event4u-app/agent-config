---
complexity: lightweight
status: ready
parent_roadmap: road-to-internet-reach
---

# Roadmap: Reach — measure the gated-platform case (the half the first null could not test)

> **Superseded (2026-07-25):** its resume trigger fired and it was executed by
> `road-to-gated-reach`, which measured the gated-platform case with its own
> pre-registration. The headline finding inverts this file's premise: the case did
> **not** need credentials. Reddit thread text, Reddit comment ranking + reply
> nesting, and single-tweet reads all shipped credential-free (6/6 per channel
> against a native control); `youtube-transcripts` stayed parked because its
> backend is human-installed and was never exercised. The remaining gaps were
> re-cut into five narrower parked files — `road-to-reach-reddit-session`,
> `road-to-reach-reddit-approved-api`, `road-to-reach-twitter-login`,
> `road-to-reach-headless`, `road-to-reach-transcribe` — each with one concrete
> trigger. Kept for historical reference; do NOT resume this file.

> Decide, with its OWN pre-registration, whether prescription-based access to
> credential-gated platforms beats host-native tools — the question
> `road-to-internet-reach`'s benchmark structurally could not ask.

## Why this is parked, not open

`band: stop` from the first reach benchmark
(`internal/bench/reach-vs-native/VERDICT.md`, 2026-07-24) is **narrow by
construction**. Every task in that set had to be answerable **without
credentials**, for reproducibility. That constraint excluded exactly the two
cases where a reach advantage was hypothesized up front:

- **Video subtitles** — the backend (`yt-dlp`) was absent on the authoring
  machine and installing it is human-performed by design, so the channel scored
  `untested` and could not contribute to the tally. Substituting a page-scrape
  stand-in would have answered a different question and rigged the arm.
- **Authenticated / rate-limited access** — 403 walls, auth-gated APIs and
  rate-limit paths cannot appear in a keyless task set at all.

ADR-126 names this as an accepted cost: *"the capability gap for gated platforms
stays open."* This file is that gap's re-entry point, so it stays a named plan
rather than a footnote.

## Resume trigger — any ONE of these, then move this file to `agents/roadmaps/`

- A **named demand signal**: a user or consumer asks for reach on a
  credential-gated platform (video transcripts, authenticated repository data,
  a login-walled discussion source). One concrete ask, recorded, not a hunch.
- The **host's native tools regress** on a case they currently solve (measured,
  not assumed — the first run's host-capability baseline is in
  `internal/bench/reach-vs-native/README.md` § Run protocol, and the
  re-baseline rule applies).
- A maintainer decides to close the ADR-126 gap deliberately.

Absent a trigger this stays parked. Opening it speculatively would rebuild the
exact thing the first benchmark declined to justify.

## Non-goals (carried from the parent, unchanged)

- NO browser cookie extraction. Credential harvesting on an agent-invoked path
  stays refused; login-tier platforms get **documented, human-performed** setup.
- NO CN-market channels.
- NO auto-installation of any backend.

## Phase 1 — Pre-registration (nothing else starts first)

- [ ] **Step 1:** `internal/bench/reach-gated/README.md` — the task set: ≥ 8
  tasks that REQUIRE a credential or hit a documented bot wall (video subtitles,
  authenticated repository metadata beyond the anonymous rate limit, a
  rate-limited discussion source). Per task: the question, the acceptance
  evidence, and the credential class it needs.
- [ ] **Step 2:** Commit the thresholds and bands BEFORE any run, in the parent's
  shape — reach wins only where native fails, ties are native wins, and a
  three-band verdict whose bottom band ships nothing. Do not reuse the parent's
  numbers; a credentialed set has a different base rate and needs its own.
- [ ] **Step 3:** Commit the credential protocol: which credentials, stored
  where, `chmod 600`, and the throwaway-account warning. A benchmark that needs a
  human to hold a secret says so in its own README.
- [ ] **Step 4:** Record the host-capability baseline for this run (per the
  parent's run protocol) so a later re-run is a comparison and not a
  re-baseline-in-disguise.

## Phase 2 — Run and verdict

- [ ] **Step 1:** Execute the set, both arms, arms judged independently on the
  pre-declared acceptance evidence.
- [ ] **Step 2:** `internal/bench/reach-gated/VERDICT.md` with a parsable
  `band:` line, per-channel outcome, and the honest limitation section.
- [ ] **Step 3:** Publish the result — including a null — in `docs/benchmark.md`,
  and state explicitly whether it changes the parent's narrow null or only adds
  to it.
- [ ] **Step 4:** Only if the band earns it: extend `src/config/reach-channels.yml`
  with the login-tier channels and their **human-performed** prescriptions, each
  through the `supply-chain-intake` gate and the existing
  `check-reach-prescriptions` validator. No new automation.

## Acceptance criteria

- [ ] Thresholds, bands and credential protocol were committed before the first run.
- [ ] The verdict is published whether it wins or nulls.
- [ ] No cookie-extraction, no auto-install, no CN channels were added.
- [ ] `task check-reach-channels` / `check-reach-prescriptions` /
  `check-reach-staleness` stay green.

## Provenance

- Parent: `agents/roadmaps/archive/road-to-internet-reach.md`; decision context in
  `docs/decisions/ADR-126-internet-reach-operator-tooling.md` § Consequences.
