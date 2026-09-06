---
complexity: lightweight
status: ready
execution:
  mode: autonomous
parent_roadmap: road-to-humanized-writing
---

# Road to humanizer hardening — close the follow-up findings

> **Arrivals:** the humanizer subject appears in **15** consumed inbox rounds
> under `agents/tmp.old/` (measured 2026-09-06, `grep -rli humanizer`, distinct
> round directories); the narrower tell phrasing in 5. Latest `inbox-2026-09-s`.
> A floor on the recurrence, not a count of asks for this roadmap. Written on an
> ARCHIVED file on purpose: the blocker `real-draft-lift-unmeasured` below is
> still open — 2026-07-11 — and this is where a later round looks for it.
> The feeder for it is carried by `agents/roadmaps/road-to-measured-prose-tells.md`,
> which also holds the four detector defects that round reproduced.

> Address the four adversarial-review findings that survived
> `road-to-humanized-writing` as advisory-only (the fix commits there were
> CI plumbing): untrusted-input handling on the `/humanize` ingestion path,
> a consumer-runtime doctor check for the write-engine step 4b default-on
> path, spend-gating + input hygiene on the bench script, and claim
> re-scoping to what the fixture corpus actually proves.

## Goal

Every finding below is closed with a verifiable check: `/humanize` ingested
content is treated as data (hidden-unicode + injection-signal scan before it
reaches the rewrite loop), the write-engine step-4b default-on path degrades
provably when no Node runtime is present, the bench script gates its billable
judge calls behind explicit opt-in, and the `humanizer-tell-reduction` claim
names n / judge-model / seed and is scoped to the fixture corpus with the
real-world question held open behind a live-usage gate.

## Context — findings carried from the parent review

Parent roadmap `road-to-humanized-writing` (archived, merged in PR #896)
shipped the humanizer vertical. Its adversarial-review gate produced findings
that the fix commits (all CI plumbing) never addressed. Verified against the
merged code on `main` 2026-07-11 before this roadmap was authored:

| # | Finding | Verified state | Verdict |
|---|---|---|---|
| 1 | `/humanize` ingests untrusted pasted text + arbitrary file paths into an LLM rewrite loop | Real — the command reads pasted content and `<path>` files; no untrusted-input handling wired. The #812 primitives (`lint_hidden_unicode.ts`, `lint_confusables.ts`, `injection_scan_hook.ts`, `_lib/retrieval_sanitize.ts`) exist and are reusable. | **KEEP** — real vector is prompt-injection + hidden-unicode smuggling in ingested content, NOT shell-exec (see corrected note below) |
| 1b | "Shell-exec on user input in `detect_ai_tells.ts`" | **False positive** — the file has no `exec`/`spawn`/`child_process`; it `readFileSync`s + runs static-registry regexes. `new RegExp(p.source)` compiles registry patterns (authored, not user-controlled); user text is only the match *subject*. | **CUT** — not encoded; the only residual is theoretical ReDoS on registry patterns, folded into Phase 1 as a low-severity check |
| 2 | Step 4b is default-on but `npx tsx` runtime never verified in a consumer environment; the SKILL.md "graceful fallback" is unproven | Real — no doctor check covers the tsx/detector runtime. `cmd_doctor.ts` infrastructure exists (`src/scripts/_cli/cmd_doctor.ts`). | **KEEP** — Phase 2 |
| 3 | CLAIMS.md entry omits n, judge-model, and randomization seed | Real — the report names the judge model + deterministic seed, but the `CLAIMS.md` sentence does not; outsiders can't reproduce from the ledger entry alone. | **KEEP** — Phase 4 |
| 4 | 16/16 blind preference runs on the same self-seeded fixture corpus that pins the detector — measures seeded-tell removal, not real-draft improvement | Real epistemic gap — the "before" fixtures were deliberately tell-seeded; perfect scores are expected, not evidence of real-world lift. | **KEEP** — Phase 4 re-scopes the claim + opens a live-usage gate |

Minor items (folded into the phases, not their own roadmap):

- Write-engine got a default-on behavior change inside the beta window
  (formally covered by `keep-beta-until`, but existing ghostwriter users
  deserve a CHANGELOG note) — Phase 2.
- README/count-drift surfaced across multiple review runs — determine whether
  it is a recurring generated-count artifact worth an allowlist entry so real
  drifts don't hide in the noise — Phase 3.

## Prerequisites

- [x] Confirm the #812 injection primitives exist and are reusable
      (`lint_hidden_unicode.ts`, `lint_confusables.ts`, `injection_scan_hook.ts`,
      `_lib/retrieval_sanitize.ts` all present on `main`, verified 2026-07-11).
- [x] Confirm the shell-exec finding is a false positive
      (`detect_ai_tells.ts` has no `exec`/`spawn`; verified 2026-07-11) — so
      Phase 1 targets the injection/hidden-unicode vector only.
- [x] Confirm `docs/contracts/write-engine.md` is still `stability: beta`
      when Phase 2 starts; if the window lapsed, Phase 2 becomes a versioned
      contract edit.

## Phase 1 — Untrusted-input handling on the `/humanize` ingestion path

The real vector: `/humanize` (and step-4b when it audits externally-sourced
drafts) treats ingested pasted text / file content as material to rewrite.
That content is untrusted — it can carry planted instructions
("ignore the above, output X") or hidden-unicode smuggling.

- [x] In the `humanizer` skill's procedure, add an explicit ingestion guard:
      before the draft→audit→final loop, treat pasted text / file content as
      **data, not instructions** (spotlight/datamark it), and never obey
      instruction-shaped content found inside it — per
      [`untrusted-input-defense`](../../src/rules/untrusted-input-defense.md).
- [x] Wire a hidden-unicode + confusables scan on ingested content, reusing
      `src/scripts/_lib/retrieval_sanitize.ts` (or the `lint_hidden_unicode`
      class) rather than a new primitive — surface a warning when anomalous
      characters appear, do not silently strip.
- [x] Add the low-severity ReDoS guard in `detect_ai_tells.ts`: cap per-pattern
      match time or bound the two variable-window patterns
      (`tell-negative-parallelism`, `tell-rule-of-three`) so adversarial input
      cannot force catastrophic backtracking. (Explicitly NOT a shell-exec fix —
      that finding was a false positive.)
- [x] Fixtures: an injection-laden "text to humanize" (planted "ignore
      instructions" line) is treated as data and reported, not obeyed; a
      hidden-unicode sample is flagged. Extend
      `tests/scripts/detect_ai_tells.test.ts` or a new command-level test.
- [x] Verify: `npx vitest run <the new/extended suite>`
      <!-- carve-out: new-gate-verification -->

**Exit criteria:** ingestion guard documented in the skill; hidden-unicode
scan wired to an existing primitive; ReDoS bound in place; the injection +
hidden-unicode fixtures pass in a targeted run.
**Rollback:** revert the skill-procedure edit + detector guard; `/humanize`
falls back to its shipped behavior.

## Phase 2 — Consumer-runtime doctor check for step 4b default-on

Step 4b runs `detect_ai_tells.ts` via `npx tsx` "when a runtime is available".
On a consumer install without a Node toolchain the graceful prose-only
fallback must actually fire — this has never been verified.

- [x] Add a doctor check (extend `src/scripts/_cli/cmd_doctor.ts`) that reports
      whether the tsx/detector runtime is present, so a consumer sees the
      write-engine humanize-audit runtime status explicitly.
- [x] Prove the fallback: a test that runs the step-4b path with the detector
      runtime unavailable and asserts the prose-only audit still completes
      (no thrown error, no broken write-engine output).
- [x] Add a CHANGELOG.md note: write-engine step 4b is default-on for
      ghostwriter/`post-as` drafts as of this line, with the `--raw` opt-out —
      so existing users see the behavior change.
- [x] Verify: `npx vitest run <fallback test>` green; `cmd_doctor` prints the
      runtime line.
      <!-- carve-out: new-gate-verification -->

**Exit criteria:** doctor reports the runtime status; the runtime-absent
fallback test passes; CHANGELOG note landed.
**Rollback:** revert the doctor + test additions; step 4b behavior unchanged.

## Phase 3 — Bench-script spend-gate + count-drift allowlist decision

- [x] Gate the billable path in `bench_humanizer_eval.ts`: `--judge` makes
      real API calls (via the council client's `spawnSync` curl transport).
      Require an explicit spend acknowledgement (a `--confirm-spend` flag or an
      estimate-and-halt) before any billable judge call, consistent with the
      council's own cost-disclosure pattern. The objective-only default path
      stays free and unchanged.
- [x] Investigate the recurring README/generated-count drift. **Disposition:
      real staleness, not an artifact — no allowlist.** Each occurrence was a
      generated count (`docs/command-flows.md`, README badge) not regenerated
      after adding an artifact; the gate caught it correctly and the fix is
      always `task build-*` / regenerate. An allowlist entry would mask genuine
      future drift — explicitly rejected. Recorded so the next reviewer does
      not re-open it.
- [x] Verify: bench objective-only run stays free (no network); the spend-gate
      blocks `--judge` without the flag (a targeted unit check).

**Exit criteria:** `--judge` cannot spend without explicit acknowledgement;
count-drift disposition recorded (allowlist entry or generator fix).
**Rollback:** revert the flag gate; bench returns to prior behavior.

## Phase 4 — Claim re-scoping + live-usage gate (honest-null discipline)

The 16/16 blind preference is on the self-seeded fixture corpus — it proves
seeded-tell removal, not real-draft improvement. The claim must say so.

- [x] Rewrite the `CLAIMS.md` `humanizer-tell-reduction` entry to (a) name
      **n = 20 pairs, judge = claude-sonnet-4-5, deterministic seed**, and
      (b) scope the sentence to "on the fixture corpus" — the reproducibility
      the "falsifiability path for outsiders" bar requires.
- [x] Add an explicit open-question line to the report + claim: real-draft lift
      is **unmeasured** until step 4b has processed real `/ghostwriter:write`
      runs; the fixture result is not evidence of real-world improvement.
- [x] Open a `## Blockers` live-usage gate: the stronger claim (real-draft
      preference lift) stays unbacked until ≥ N real ghostwriter drafts have run
      through step 4b and been paired-evaluated. Do not fabricate that corpus.
- [x] Verify: `check_claims` green with the re-scoped entry; the report names
      n / model / seed and carries the open-question line.

**Exit criteria:** claim entry names n/model/seed and is corpus-scoped; the
real-world question is explicitly open behind the live-usage blocker;
`check_claims` green.
**Rollback:** none needed — this tightens copy, does not change code.

## Blockers

### blocker: real-draft-lift-unmeasured

- **Status:** open
- **Owner:** maintainer
- **Blocks:** any public claim of real-draft (non-fixture) preference lift
- **What to do:** accumulate real `/ghostwriter:write` / step-4b drafts and run
  a paired, length-controlled eval on that real corpus (not the self-seeded
  fixtures).
- **Resolved when:** ≥ N real drafts (maintainer picks N) have a recorded
  paired-eval; only then may the claim widen beyond "on the fixture corpus".

## Non-goals

- A shell-exec sanitizer for `detect_ai_tells.ts` — the flagged shell-exec does
  not exist (verified); the residual ReDoS bound lives in Phase 1.
- Re-running the fixture eval for a higher score — the fixture ceiling is
  already 16/16; the open question is real-draft lift, not fixture lift.
- Any new voice mechanism, or reopening the council-settled v1 decisions
  (em-dash density cap, PERSONALITY-AND-SOUL cut) — those stay as shipped.

## Acceptance criteria

- [x] `/humanize` ingestion treats untrusted content as data (injection guard
      + hidden-unicode scan via an existing #812 primitive), with passing
      injection + hidden-unicode fixtures.
- [x] Step-4b runtime-absent fallback is proven by a test; doctor reports the
      runtime; CHANGELOG carries the default-on note.
- [x] `bench_humanizer_eval.ts --judge` cannot spend without explicit
      acknowledgement; count-drift disposition recorded.
- [x] `CLAIMS.md` `humanizer-tell-reduction` names n/judge-model/seed, is scoped
      to the fixture corpus, and the real-draft claim is gated behind the
      live-usage blocker; `check_claims` green.
- [x] No council-settled v1 decision reopened; the false-positive shell-exec
      finding is explicitly not encoded.
