---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t verified at 5fa963cec, and ADR-286 unblocked, that this package's distribution pipeline does not know its own state. `docs/distribution/registry-submissions.md:40` records row 1 as `submitted` and awaiting upstream review; `gh pr view 9607` reports that pull request CLOSED on 2026-09-07, 39 days earlier. A second sheet, `docs/distribution/registries.md`, tracks the same registry under a different pull-request number and records it closed, so the two ledgers disagree about one pipeline. `adoption_status` reads only the sheet and reports `submitted 1 · stalled 0`, because its staleness rule is a date arithmetic that a closed pull request never trips. Both sheets' `roadmap_ref` point into `agents/roadmaps/archive/`, and the tracker's `keep-beta-until` lapsed on 2026-08-26. No active, parked or stub roadmap owns any of this: a grep over agents/roadmaps/{*,later,stubs} for registry-submissions, adoption_status, Packagist and mcp-publisher returns nothing, and the bus-factor stub owns the owner's login actions rather than the ledger's truth. Archiving or parking costs more because every outward action D1 of ADR-286 now permits is staged from a sheet that is wrong; merging into road-to-truthful-surfaces would put a pipeline reconciliation behind that file's in-tree text corrections."
relates:
  - slug: road-to-truthful-surfaces
    relation: extends
    note: "That file corrects the in-tree metadata text — the about file, the topic list, the issue chooser. This file corrects the distribution ledger and the detector that reads it. Its step 3.5 stages the row-1 text; this file is where that staging is finished against a live upstream read."
  - slug: road-to-a-release-that-says-whether-it-needs-you
    relation: disjoint
    note: "Owns what a version number means. This file publishes nothing and changes no release logic; the Packagist item is a listing disposition, not a release."
  - slug: road-to-an-update-that-installs-itself-only-when-it-is-safe
    relation: disjoint
    note: "Owns staying current on an install that exists. This file owns being findable in the first place; neither reads the other's surface."
---
# Road to a distribution ledger that is true

> **Source:** `agents/tmp.old/inbox-2026-10-t/topic-1/` — one transcript and
> four supplied plans, re-verified at `main@5fa963cec` on 2026-10-16. This file
> exists because of an owner ruling taken in the same round:
> [`ADR-286`](../../../docs/decisions/ADR-286-discoverability-is-a-goal-asking-is-not.md)
> § D1 declares discoverability a goal, so the work below is no longer refused
> by `ADR-216`. Readings marked *(executed)* ran against this tree or against
> the live upstream.

## Goal

Before this package asks anywhere to be listed, its own record of where it has
asked is correct. One ledger, reconciled against the upstream it describes, and
a detector that notices when an upstream answer arrives rather than waiting for
a calendar.

**Within ADR-286's bounds, both of them.** This file pursues D1 —
discoverability — and carries nothing from D2: no step here asks a user for
anything. It also honours D3: no step here gates on an adoption signal, and
nothing in it may be cited as a reason to.

## Prerequisites

- `gh` authenticated, for the live upstream reads in Phase 1. Every one is a
  read; nothing in this roadmap writes to a third-party repository.
- `npx vitest` for Phase 3.

## Context — read at `main@5fa963cec`

| # | Defect | Evidence |
|---|---|---|
| N1 | **The ledger is wrong about its only `submitted` row.** `docs/distribution/registry-submissions.md:40` records row 1 as `submitted`, dated 2026-07-07, note "Awaiting upstream review." *(executed)* `gh pr view 9607 --repo punkpeye/awesome-mcp-servers` returns `"state":"CLOSED"`, `"closedAt":"2026-09-07"`. The row has been wrong for 39 days. |
| N2 | **Two sheets track one pipeline and disagree.** `registry-submissions.md:40` carries pull request **9607**; `registries.md` § Submission status row 1 carries pull request **6865** and records it "closed unmerged 2026-06-11 (verified live 2026-07-25)". Two attempts at the same registry, recorded in two files, neither referencing the other. A reader cannot tell from either sheet how many attempts there have been. |
| N3 | **The staleness detector cannot see a closed pull request.** *(executed)* `./scripts-run src/scripts/adoption_status` prints `submitted 1 · stalled 0`. The sheet's own legend defines `stalled` as "≥ 60 days in `submitted` with no upstream response" — pure date arithmetic over a hand-maintained field. A row whose pull request was **answered** — closed, rejected, merged — never becomes `stalled`; it stays `submitted` until a human edits it. The one state the pipeline most needs to notice is the one state it cannot. |
| N4 | **Both sheets point at archived roadmaps.** `registry-submissions.md:4` declares `roadmap_ref: road-to-adoption-proof-and-ci-green.md`; `registries.md` cites `road-to-product-adoption.md` and `road-to-distribution-identity.md` as its authority. *(executed)* all three resolve only under `agents/roadmaps/archive/`. The authority these files claim has been archived out from under them. |
| N5 | **The tracker's own beta window lapsed.** `registry-submissions.md:3` — `keep-beta-until: 2026-08-26`, 51 days past. |
| N6 | **Three rows are blocked on a human login, and that is correct.** Rows 2 and 3 are web forms; row 4 needs `mcp-publisher login github`. The Packagist disposition in `registries.md` needs a packagist.org login. These are owner acts, already held at `agents/roadmaps/stubs/road-to-bus-factor-external-actions.md` under a council disposition that forbids a parent recording them as done. **This roadmap stages their text and records nothing as submitted.** |
| N7 | **The marketplace listing describes itself as deprecated.** `.claude-plugin/marketplace.json:8` — "Bootstrap shim … **DEPRECATED as a content channel**", whose hooks do nothing without a separate npm install. That is an accurate description of what it is, and it is the reason the official directory route is not simply a form to fill in. Whether it should stop being a shim is a product question this file does not answer; it only stops the ledger from implying the route is open. |

## Phase 1 — Reconcile the ledger with the upstream it describes

- [x] **1.1 Read every row's live state once.** For each row carrying a pull
      request or a form URL, take the upstream state with `gh pr view <n>
      --repo <owner/repo> --json state,closedAt,mergedAt` or, for a form, a
      single fetch of the listing page. Record the reading and its date in the
      row's notes.
      verify: `gh pr view 9607 --repo punkpeye/awesome-mcp-servers --json state -q .state` -> /CLOSED/
      *Done 2026-10-16:* five of six rows read live. Row 3 (`mcpservers.org`)
      answered HTTP 403 to an automated and a browser user agent, so its
      `Last read` stays empty and the detector reports it `unread-never`. The
      reads also corrected rows 2 and 3, which this sheet held `pending` while
      `registries.md` recorded them submitted — the live `mcp.so` page shows
      row 2 listed.
- [x] **1.2 Correct row 1.** Its status becomes the verified upstream state
      with the closing date, not `submitted`. The note records that it stood
      wrong for 39 days and what the reading was.
      verify: `grep -c 'Awaiting upstream review' docs/distribution/registry-submissions.md` -> /^0$/
- [x] **1.3 Record both attempts, in one place.** Rows 6865 and 9607 are two
      attempts at one registry. Whichever sheet survives Phase 2 carries both,
      in order, with their outcomes — so the next person asking "have we tried
      this" gets a number rather than a row.
      verify: both pull-request numbers appear in the surviving sheet, each
      with a dated outcome.
- [x] **1.4 Repoint the authority lines.** `registry-submissions.md:4` and
      `registries.md`'s authority block name archived roadmaps. Point them at
      this file, or at nothing with a sentence saying the pipeline is
      standalone — never at a path under `archive/`.
      verify: `grep -rn 'roadmaps/archive' docs/distribution/` -> 1
- [x] **1.5 Resolve the lapsed beta marker.** `keep-beta-until: 2026-08-26` is
      51 days past. Either set a new date with what changes by then, or drop
      the marker because the sheet is simply operational.
      verify: `grep -c 'keep-beta-until: 2026-08-26' docs/distribution/registry-submissions.md` -> /^0$/

## Phase 2 — One ledger, not two

- [x] **2.1 Decide which file is the ledger.** `registries.md` defines the
      channels and the submission shape; `registry-submissions.md` is the
      operational row set. The split is defensible — what is not is a second
      row table inside the definitions file. Move `registries.md`'s
      § Submission status rows into the tracker and leave a pointer.
      verify: exactly one table of submission rows exists under
      `docs/distribution/`.
- [x] **2.2 Keep the channel posture where it is.** The npm-primary /
      Packagist-deprecated decision stays in `registries.md` under its ADR;
      only the per-submission rows move.
      verify: `grep -c 'ADR-033' docs/distribution/registries.md` -> /^[1-9][0-9]*$/
- [x] **2.3 Give the ledger a shape a script can read.** The row table gains
      the fields the detector in Phase 3 needs — registry, upstream kind,
      upstream ref, status, last-read date — so a reading can be checked
      rather than narrated.
      verify: a fixture row missing `last-read` is reported by Phase 3's
      checker.

## Phase 3 — A detector that notices an answer, not a calendar

- [x] **3.1 Red first: pin the state the detector cannot see.** A fixture
      ledger with a `submitted` row whose upstream is closed must be reported.
      Today it is not.
      verify: the new case is **red** against the current `adoption_status`
      and its failure names the date-only rule behind `stalled`.
      *Observed red 2026-10-16:* all seven new cases failed before the change
      (`TypeError: parse_ledger_rows is not a function` — the detector had no
      way to read an upstream at all); the closed-upstream case asserts the
      legacy reading `submitted 4 · stalled 0` first and carries the message
      "the date-only stalled rule cannot see a closed upstream". Sensitivity:
      forcing the 60-day guard to `true` turns the both-directions case red.
- [x] **3.2 Read the upstream, do not infer it.** `adoption_status` gains an
      opt-in live check (`--check-upstream`) that reads each row's upstream ref
      and reports three new states: `answered-closed`, `answered-merged`,
      `unread-for-N-days`. Offline and in CI it reports from the sheet exactly
      as today and says that it did.
      verify: with no network, the command's output is byte-identical to
      today's and names the degraded mode.
- [x] **3.3 A stale reading is a finding, not a silence.** A row whose
      `last-read` date is older than the sheet's own threshold is reported as
      `unread`, whatever its status says.
      verify: `./scripts-run src/scripts/adoption_status` -> 0
- [x] **3.4 Keep `stalled` and make it mean something.** It stays the
      "submitted, no answer, 60 days" state. It is now reachable only when the
      upstream really has not answered, because 3.2 can tell the difference.
      verify: a fixture closed at day 10 reports `answered-closed`, and a
      fixture still open at day 70 reports `stalled`. Both directions.

## Phase 4 — Stage what the owner must submit, and claim nothing

- [x] **4.1 Stage the three form and publish actions.** Rows 2, 3 and 4 get
      their submission text finalised against the current positioning, each
      with the exact command or form field it goes into. Nothing is submitted.
      verify: each row carries staged text and the word `pending`.
      *Deviation 2026-10-16:* row 2 (`mcp.so`) gets no staged text — the live
      read shows it listed, so there is nothing to submit; the ledger says so.
      A staged third awesome-list attempt (`1c`) was added instead, since that
      is the act the two closed attempts leave open.
- [x] **4.2 Stage the Packagist disposition.** `registries.md` already offers
      two acceptable paths under ADR-033. Prepare the exact text for each so
      the owner's login session is a paste rather than a drafting exercise.
      verify: both paths carry ready text; neither checkbox is flipped.
- [x] **4.3 Record the round against the stub that owns these acts.** Add this
      round and this roadmap to
      `agents/roadmaps/stubs/road-to-bus-factor-external-actions.md`, so the
      owner's queue holds one entry naming the staged work rather than five
      scattered ones.
      verify: that stub names this roadmap.
- [x] **4.4 State the directory route honestly.** The ledger records that the
      official-directory route is gated on the marketplace listing being a
      functional plugin rather than a shim, citing
      `.claude-plugin/marketplace.json:8`. Whether to change that is out of
      scope here and is named as an open product question, not as a step.
      verify: the ledger names the shim as the gate and proposes no change to
      it.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | Discoverability is work worth doing; in-product asking is not | ADR-286 D1 and D2 | ADR-286 is reopened by the owner |
| D2 | critical-technical | evidence | No step here gates on an adoption signal | ADR-216 D5 survives ADR-286 untouched; a goal is not a gate | never — reopening this would reopen D5 |
| D3 | deterministic | evidence | The upstream check is opt-in, and the offline path is byte-identical to today | a detector that silently needs the network reports a different thing in CI than on a laptop, which is the class of defect this roadmap is fixing | CI gains an authenticated network budget for this |
| D4 | reversible-technical | agent | The rows move into the tracker; the channel posture stays in the definitions file | one row table is the fix for N2; moving the ADR-033 posture as well would detach it from its record | the two files are merged outright by a later change |
| D5 | contested-technical | agent | The owner-login actions are recorded against the existing stub, not carried as blockers here | a blocker duplicating a stub the tree already holds grows the estate twice for one obligation, and the stub carries a council disposition forbidding a parent from recording them done | the stub is closed or cancelled |
| D6 | product-owned | agent | Whether the marketplace listing stops being a shim is **not** decided here | it is a product question about what the plugin is, and this file's subject is whether the ledger is true | the owner asks for the directory route to be opened |

## What this roadmap deliberately does not do

- It asks no user for anything. ADR-286 D2 is a refusal, and no step here is a
  softened version of it.
- It gates nothing on how many people use this package, and supplies no
  argument that anything should.
- It submits nothing, logs in nowhere, and flips no checkbox that represents an
  externally visible act.
- It does not decide what the marketplace plugin should become.
- It collects no telemetry and adds no outbound call from a consumer's
  machine. The only network reads are the maintainer's own `gh` calls against
  public upstream state.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A truthful ledger reads as a record of failure and discourages the next submission | product | Reconciling row 1 turns one hopeful `submitted` into two closed attempts. | That is the information the next attempt needs; 1.3 records attempts in order precisely so the question "have we tried this" has an answer instead of an impression. | Phase 1 — Reconcile the ledger with the upstream it describes |
| 2 | The upstream check becomes a de-facto adoption gate | product | A detector that reads registry state is one step from a condition that waits on registry state. | D2 records the prohibition and ADR-216 D5 is unchanged; the detector reports and nothing consumes its output as a condition. | Phase 3 — A detector that notices an answer, not a calendar |
| 3 | `--check-upstream` behaves differently in CI and nobody notices | implementation | A network-dependent reading that degrades silently is the shape of N3 itself. | 3.2 asserts byte-identical offline output and requires the degraded mode to be named; the opt-in flag means CI never takes the live path by accident. | Phase 3 — A detector that notices an answer, not a calendar |
| 4 | Moving the rows loses the context that lived around them | implementation | `registries.md`'s row table sits under prose that explains it. | 2.1 leaves a pointer rather than deleting, and 2.2 pins the ADR-033 posture in place; the move is rows only. | Phase 2 — One ledger, not two |
| 5 | Staged text goes stale before the owner's session | product | Phase 4 prepares text that may sit for weeks. | Each staged row carries its staging date, and 3.3's `unread` finding covers the staged rows too, so an ageing stage is reported rather than assumed fresh. | Phase 4 — Stage what the owner must submit, and claim nothing |

## Acceptance Criteria

- [x] **AC-1** Every row in the ledger carries a status that matches a live
      upstream read taken in the same change, with the reading's date.
- [x] **AC-2** `grep -c 'Awaiting upstream review' docs/distribution/registry-submissions.md`
      returns 0, and both awesome-list attempts appear once each with dated
      outcomes.
- [x] **AC-3** Exactly one table of submission rows exists under
      `docs/distribution/`, and no file there cites a roadmap under
      `agents/roadmaps/archive/`.
- [x] **AC-4** A fixture ledger whose `submitted` row has a closed upstream is
      reported; the same fixture still open at 70 days reports `stalled`. The
      first case was observed **red** before Phase 3 and the observation is
      recorded in the PR.
- [x] **AC-5** With no network, `adoption_status` produces byte-identical
      output to the current release and names its degraded mode.
- [x] **AC-6** No step in this roadmap reports an externally visible
      submission as done; the bus-factor stub names this roadmap.
- [x] **AC-7** No step, acceptance criterion or blocker in this file names an
      adoption count, a download figure or a star count as a condition.
- [x] **AC-8** `task ci` green.

## Provenance

Source-derived under template rule 19. The source set compares this package
against several external references; none is named here per
`source-confidentiality`, and the retained links are `ENC1`-encrypted in the
round's intake note. The registries and directories named above are
**integration targets this package submits itself to**, which that rule
explicitly permits — they are not sources anything here was derived from.

| Proposed | Verdict | Why |
|---|---|---|
| Finish the stalled distribution pipeline | KEEP, reshaped | The pipeline cannot be finished from a ledger that is wrong about its own state; N1–N3 come first. |
| Reconcile the tracking sheet | KEEP | N1 executed against the live upstream. |
| Packagist claim / abandon | FOLD | Owner login; staged in Phase 4, held at the bus-factor stub. |
| Registry and directory submissions | FOLD | Same — staged, never claimed. |
| Make the plugin a functional directory entry | CUT from this file | A product question about what the plugin is; D6 records the refusal to decide it here. |
| Attribution footers in user artifacts | CUT | Forbidden by this package's own rule; the source already records it as closed. |
| A "Used by" dependency-graph entry | CUT | Needs a manifest dependency that global-only consumption never writes; the source already records it as correctly closed. |
| A monthly star prompt | CUT | ADR-286 D2 refuses it. |
| Adoption-gated sequencing | CUT | ADR-216 D5, unchanged by ADR-286. |

## Notes — how this file was derived

The defects were produced by verification rather than by the source set: N1
and N3 were executed in this round (a live `gh pr view`, and a local
`adoption_status` run), N2 and N4 by reading the two sheets against each other
and against the roadmap tree. The supplied plans proposed completing the
submissions; verification found the ledger describing those submissions to be
wrong about the one row it tracked as live, so the completion became Phase 4
and the reconciliation became Phase 1.

## Closed 2026-10-17

- **AC-1** closed on a fresh read of every row, all dated 2026-10-17: `gh pr
  view` for 6865 and 9607 (both `CLOSED`, unmerged), `curl` for `mcp.so`,
  `glama.ai` and the official registry (listed, listed, `count: 0`). Row 3
  (`mcpservers.org`) refuses `curl` with a Cloudflare 403 under every user
  agent, which two earlier rounds took for a human-only route. It is not: a
  headless Chromium from the Playwright install already in `node_modules`
  loaded the row's own URL with HTTP 200 and showed the listing, so the row is
  `accepted` on a reading, not on the maintainer's word. The ledger's reading
  rule now says to try the browser before recording a block. The same read
  found the official registry slower than the detector's 20 s `curl` wait, so
  that wait is now 45 s.
- **AC-8** is discharged by the PR's remote CI, not by a local `task ci` run.
