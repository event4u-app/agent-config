<!-- evidence-type: analysis -->

# Triage — the feedback-14.11.0 inbox bundle

> **Evidence artefact, not estate.** Written by `/analyze:inbox` on 2026-08-24 at
> HEAD `3cf0077d9`+. It records what the bundle contained, what was verified, and
> which parts did **not** become roadmaps and why. Source:
> `agents/tmp.old/feedback-14.11.0/`.

## What arrived

14 files: a 9,032-line German review (`chat.txt`) carrying **350 numbered
sections across four concatenated review passes**, plus 13 accompanying `.md`
files. All ten uniform proposals pin `main_sha: 0f7c26ee9` (release 14.11.0),
which was HEAD immediately **before** PR #1612 — so the entire drift between the
bundle's baseline and this triage is that one PR, 16 commits.

## The review itself — where the payload was

Ratings run 9.8–10/10 almost throughout, so the praise is not the payload. Of 87
sections in pass A, **29 were actionable**; PR #1612 had already closed exactly
**one** of them. The four passes together produced a ranked open set, three
verified corrections to the tree's own records, and one finding the reviewer did
not make.

Landed as roadmaps from this bundle:

| Roadmap | Carries |
|---|---|
| `road-to-release-placeholder-guard.md` (promoted, `ready`) | §62/63 — the marker shipped in five releases, eight review rounds |
| `road-to-standing-payload-truth.md` (`ready`) | §10/68/69/81/88 — two red gates neither of which can fail a PR |
| `road-to-opencode-enforcement.md` (`draft`) | the accompanying proposal; its own premise contradicts `surface-matrix.yml` |
| `stubs/road-to-draft-status-ratchet-boundary.md` (extended) | the estate-ratchet asymmetry — see below |

## The finding the reviewer did not make

Three subjects he keeps re-raising — the publication guard, stub hygiene, the
package diet — share no technical content. What they share is **where they
stopped**: each was blocked at the estate boundary rather than on its merits.

| Subject | Where it stopped |
|---|---|
| publication guard | `one_in_one_out`; *"promotion is growth requiring an offset this run did not identify"* |
| stub hygiene | disposition `E` (abandon), council **split 1/1**, dissent standing |
| package diet | refused on ROI at one payload size; the cap has since risen 6.4 → 9.2 |

And the same gate was waived **13 times in PR #1612**, every claim carrying an
identical boilerplate reason. Measured by tree entries per ref: top-level 4 → 12,
`stubs/` 69 → 73, `later/` 61 → 64, `archive/` 601 → 603 — **15 planning
artefacts opened against 2 closed.**

So the recurrence is predictable without reading the content. Recorded in
`stubs/road-to-draft-status-ratchet-boundary.md`, which already documented the
population half of the same defect.

## What did NOT become a roadmap, and why

### The ten architecture-tournament proposals — the program they belong to is parked, on conditions that are measurably unmet

`road-to-architecture-tournament` plus its nine tracks
(`agent-orchestration-and-model-routing`, `browser-verification-and-real-system-evidence`,
`evals-benchmarks-and-convergence`, `knowledge-and-code-intelligence`,
`memory-learning-and-context`, `runtime-and-session-kernel`,
`security-sandbox-and-operating-boundary`, `spec-artifact-and-execution-graph`,
`agent-config-next`) are **design frames**, not executable roadmaps: tracks,
candidate ladders (`R0`–`R4`), contracts, event lists and failure-injection sets,
with acceptance criteria as bullets and **no phases and no `verify:` lines**.

`agents/roadmaps/later/road-to-agent-config-next.md` already **is** this program —
its title reads *"the architecture-tournament program, parked"* — drained from the
`feedback-14.8.0` bundle, itself a 9,654-line corpus over ten sessions. So the
bundle is a **re-arrival**, rebased on 14.11.0, not a new proposal.

Its resume condition needs both legs, *"measured and written down, not asserted"*.
Measured 2026-08-24:

| Leg | Condition | Measured | Met? |
|---|---|---|---|
| (a) | standing-payload delta ledger holds **≥ 4 weeks** of entries | the instrument landed (`check_standing_payload_delta.ts`, with `partitionCredit()` booking the ADR-236 credit), but the ledger cannot hold four weeks before **2026-09-20**, a floor the parked file derives rather than estimates | **no** |
| (b) | subagent envelope adoption **≥ 95 % over ≥ 500 stops** | **0.00 %, 0 valid of 4,274 stops** — the denominator is met eight times over and the rate is in the roadmap's own DROP band | **no** |

Leg (b) is not merely unmet; it points the wrong way. Landing ten roadmaps for a
program whose resume conditions are both unmet — one of them falsified — is the
estate inflation this same triage documents one section up.

**Disposition:** the ten files are consumed as the 14.11.0-rebased frame of a
parked program. Nothing is landed. If the owner wants the tournament reopened, the
lever is the parked roadmap's resume condition, not ten new files.

### `w1-closeout-v14.11.0.md` — a verified delta report, and it closes its own item

It is deliberately not a "v4": its predecessor set a kill criterion for a further
re-baseline without ratification, that criterion fired, and the document says so
and corrects its own prediction. Its verdict on W1.2 is **GESCHLOSSEN** — landed
via the drain machine rather than via the amendment, with
`check_standing_payload_delta.ts` and `partitionCredit()` (line 243, used at 325)
cited as the evidence. Consumed as evidence; nothing to plan.

### `road-to-cross-corpus-parity-v8.md` — a locks check that declares itself a proposal

Header: *"Status: **proposal** (not adopted; nothing below is a foundation until
merged)"*, superseding a v7 which had *"recommended no scheduled v8"*. This run is
owner-requested per its own text. Consumed; a locks check is a measurement pass,
not estate.

## Honest limits of this triage

- **The council was not re-run.** For the flagship item it had already answered —
  `agents/runtime/council/responses/r-placeholder-guard-placement.md`, 2 members,
  2 rounds, convergent, with a seven-step list whose step 1 had already landed.
  Re-asking would have paid for a re-derivation; `decision-revisit-gate` step 2
  asks for a lock to be *evaluated* before it is cited. Both members also reported
  `quota_exhausted` on the day before.
- **One promotion exceeded its recorded authority, and it is filed as such.** The
  2026-08-23 council reopening condition asked the maintainer to promote **and name
  a `one_in_one_out` offset**; this run had the owner instruction and supplied a
  self-issued `estate_offset_exempt` instead. Tracked as
  `b-promotion-offset-not-named` with a revert command in the blocker.
- **Three of the four review passes reported corrections to the briefs that
  produced them**, and one corrected a claim this run had already committed (the
  preamble gate's strike in `road-to-ten-across-the-board.md`). Those corrections
  are in the files, not only here.
- **The opencode plugin API is unverified.** Establishing it needs a network fetch
  the analysis bound forbids, so it is the first phase of its own roadmap rather
  than an assumption.
