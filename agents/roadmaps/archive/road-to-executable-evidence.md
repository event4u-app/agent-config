---
complexity: structural
status: ready
---

# Roadmap: Executable evidence — a claim that re-derives itself

> ADR-127 made an enforcement claim resolve against the wiring instead of merely
> existing. It left one thing measured and deliberately unbuilt: the ledger still
> checks that an evidence pointer **resolves**, never that the claim is **true**.
> This roadmap builds the form that closes that, adds the missing second axis of
> rigor (how dangerous is this diff, not just how capable is this host), and
> writes down what a council said to kill so the kills stop being re-proposed.

## Context

A source-level comparison against an external governance reference produced two
rounds of gap analysis. The **first** wave shipped as ADR-127 on 2026-07-25 and
its roadmap is archived 27/27. Re-verified in source today, so this roadmap does
not redo it:

- `enforced_by:` resolves against real wiring — a `validator:` reachable from no
  taskfile, workflow, or hook manifest resolves to `unwired`, not covered.
- Blocking and instrumenting are separate tiers: a hook registered
  `fail_closed: false` resolves to `observer`. Of 18 hooks, exactly 1 can block.
- Published figure: **14 of 107 rules (13.1 %) blocking**, 21 declared,
  86 undeclared, 0 unwired. Undeclared counts as uncovered, by design.
- Kernel and safety-floor rules are non-overridable, with a registry:
  `replace` is refused, `extend` requires an entry in
  `agents/overrides/kernel-exceptions.yml`.
- The subagent safety floor is generated from the kernel rule list and injected
  into every dispatch prompt in `src/` **and** the shipped projection.
- ADRs must name a `review_trigger` — an event, never a cadence — from
  2026-07-25 forward, grandfathered by date.

**What ADR-127 Decision 8 scheduled and did not build:** the `exec:` evidence
form. The threshold was pre-registered at ≥ 10 pp of the backed ledger *before*
the count was taken; the measurement in
[`internal/reports/exec-evidence-feasibility.json`](../../internal/reports/exec-evidence-feasibility.json)
came back **11 of 26 feasible (42.3 pp) against 0 machine-re-verifiable today**,
and named the command for each of the 11. Phase 1 is that PR.

### What the council decided (2026-07-25, anthropic + openai, 2 rounds)

Both members independently put **A (`exec:`)** and **F (trust-boundary
escalation)** in scope and **B (filling the 86 undeclared fields)** and
**G (lifecycle-scenario cost)** out. The reasoning that survived rebuttal, kept
here so it is not re-litigated:

- **B is deferred, not cheap-and-good.** You cannot fill 86 `enforced_by` fields
  honestly without first building 86 enforcement points; what you get otherwise
  is 86 `# TODO: write this test` values, which is *strictly worse than a blank*
  — the blank is honest about non-coverage, the TODO is a promise. This is
  exactly the failure ADR-127's own `review_trigger` names. Revisit when there is
  real enforcement to point at.
- **D (adversarial governance evals) is killed, not deferred.** A corpus of
  "user pressures the agent to skip a gate" scores a refusal as the pass
  condition — and this package's documented authority model says the user
  decides. An eval asserting "the agent must refuse when the user says no" would
  declare `agent-authority` a security failure. The question worth testing is
  narrower and already answerable: *does the enforcement mechanism return
  non-zero?* That is a per-rule test, not a jailbreak corpus.
- **E (a governed-writes lint) is killed as the wrong layer.** A static scan for
  `fs.writeFile` against protected paths is simultaneously too weak
  (`child_process.exec('… > file')` walks past it) and too strong (fixture setup
  trips it). The type system is the right layer: make the atomic-write helper the
  only exported way to reach those paths. Same reasoning as ADR-127 Decision 5 —
  a gate covering one route of several, while reading as coverage, is theatre.
- **C (tamper-evident chains) is deferred with the split recorded**, because the
  two rounds disagreed and the disagreement is substantive. Round 1: a hash chain
  adds nothing Git does not already give, and the external `git merge-base`
  line-prefix witness is doing all the work. Round 2 found the hole in that: a
  line-prefix witness catches **tail truncation** and does **not** catch
  **mid-sequence deletion** — dropping entries 50–90 from the middle of a ledger
  leaves a diff that is not a line-prefix violation and reads as an ordinary
  divergent branch. Neither round produced the number that settles it, which is
  how often a ledger surface is edited by someone other than the maintainer.
  Phase 4 records the split and its revisit condition instead of guessing.

## Prerequisites

None. Phase 1 consumes a measurement that already shipped.

## Phase 1: The `exec:` evidence form

The ledger's three evidence forms are all existence checks — file present,
substring present, URL carries a date. A claim reading "the suite is green" whose
pointer resolves to a report nobody regenerated stays `backed` indefinitely. The
fourth form re-derives the claim and lets the exit code carry the verdict.

- [x] **P1.1 — Grammar.** Add `exec:<command> → 0` to `docs/CLAIMS.md` as the
      fourth evidence form, documented beside the existing three, with the
      local-vs-CI asymmetry stated in the grammar itself rather than in a footnote.
- [x] **P1.2 — Allowlist as prefix tuples, never a regex.** The allowlist lives in
      `src/scripts/_lib/` as a set of argv prefix tuples (`["skill_eval_coverage"]`,
      `["domain_soundness_status"]`, …), not as a pattern matched against a shell
      string. A regex over a command string is the classic bypass; a tuple compared
      against `shlex`-split argv is not.
- [x] **P1.3 — Argument hardening.** After the allowlisted prefix matches, every
      remaining argument is rejected on shell metacharacters (`& ; | > < ` $` plus
      NUL/CR/LF) and on repo escape (`..`, absolute POSIX paths, drive-letter
      paths). The right-hand side of `--flag=value` is checked as its own
      candidate — without that split, `--rootdir=/etc` passes an allowlist that
      only inspected the flag.
- [x] **P1.4 — CI-only execution; local refuses.** Re-execution runs only in the
      ephemeral CI runner. Locally the gate is read-only and reports
      `UNVERIFIED (exec skipped locally)` — never a silent pass, and never a run
      in a consumer's checkout. The reference's own docstring is honest that these
      commands execute in the repository root with full filesystem access; that is
      an argument for confining them, not for trusting them.
- [x] **P1.5 — A narrative result is `UNVERIFIED`, not `PASS`.** A claim whose
      declared result cannot be reduced to a pass/fail marker does not get
      credited by the exec path. Absence of a verdict is not a verdict.
- [x] **P1.6 — Apply to the 11 measured claims.** The feasibility report names the
      command for each. Convert them, then re-run the feasibility count so the
      published figure moves from 0 machine-re-verifiable to its real value.
- [x] **P1.7 — Publish the residue.** The 15 claims that cannot carry `exec:`
      (paid or stochastic benchmark runs no CI job can re-derive; prose contracts)
      are listed as such in `docs/proof.md`. A ledger that hides which of its
      claims are unfalsifiable is the thing this package sells against.

**Honest-null path.** If fewer than 5 of the 11 survive contact — because their
commands turn out to need network, credentials, or a paid model call — the form
does not earn a schema change plus a validator plus a renderer. Then: keep
`exec:` as an optional form on whatever number did survive, and publish
"N of 26 claims are machine-re-verifiable" as the finding. The measurement was
the point; a low N is a result, not a failure to report.

## Phase 2: Trust-boundary risk, measured before it gets teeth

Rigor here resolves on one axis — `discipline_profile: auto` asks how much
governance the host can afford. The missing axis is how dangerous the diff is.
Today a weak host plus a diff in the installer provenance path resolves to
minimum discipline, and that is precisely the change class hardened in 9.6.0.

The reference escalates on content: authentication touch; installer, updater, or
bootstrap logic for source selection and provenance — justified in its own text
as *crossing a downstream trust boundary*; and governance-file touch. It also
hard-blocks: a user's "no" to the escalation prompt does not count when the diff
exceeds 200 lines, or touches more than two modules, or adds a directory.

That last part collides head-on with `agent-authority` and `ask-when-uncertain`.
Both council members nonetheless landed on the same narrow answer: there **is** a
class where refusal should not be accepted, and *crosses a downstream trust
boundary* is the right and minimal boundary — because those changes affect people
other than the one declining. This phase does not implement that. It measures
whether the class is real first, which is the same sequencing ADR-127 used on
`exec:`.

- [x] **P2.1 — Path-based trigger table.** Classify diffs by touched path into the
      three risk classes (auth/session/token; installer, provenance, and
      source-resolution; kernel rules and the spawn path). Path-based only — no
      model judgement, so the classification is reproducible from the diff alone.
- [x] **P2.2 — Escalation is additive, never subtractive.** The host axis sets the
      floor; a risk trigger may only raise it. A weak host must not be able to
      lower a risk escalation. Encode the direction, not just the values.
- [x] **P2.3 — Report over recent history, no teeth.** Run the classifier over the
      last ~100 first-parent merges and emit
      `internal/reports/risk-escalation-shadow.json`: which merges *would* have
      escalated, and what discipline they actually ran under.
- [x] **P2.4 — Pre-register the teeth threshold before reading the report.**
      Write the number into the roadmap first: if **≥ 5** of the last ~100 merges
      would have escalated into a trust-boundary class while running under a
      lower profile, the non-declinable class is justified and gets its own ADR
      and its own PR. Below that, it is theory, and the report says so.

**Honest-null path.** If the shadow report finds fewer than 5, this phase ends at
a published measurement and the non-declinable class is not built. Recording
"0 of 100 merges would have escalated" is a real answer to a real question, and
it is the answer that keeps the authority model intact.

## Phase 3: The prevented-failure table

The reference ships a five-row "what you get" table whose rows each name a
*failure mode that is prevented*, not a feature — no adjectives, one number. The
format is worth borrowing. Its execution is a cautionary tale: the headline
efficiency number in that table appears **only** there, and the cheapest scenario
in the reference's own generated benchmark is an order of magnitude larger. That
is exactly the defect this package's ledger exists to catch, which means the
table can be filled here more honestly than at its source.

- [x] **P3.1 — Write the table as prevented failures.** Each row names the failure
      mode, not the mechanism. A row that cannot name what goes wrong without it
      is a feature in disguise and does not belong in the table.
- [x] **P3.2 — Every number carries a ledger id.** No cell holds a figure that is
      not an existing `backed` claim in `docs/CLAIMS.md`. A row with no resolving
      claim ships without a number rather than with an approximate one.
- [x] **P3.3 — Gate it.** The table is checked the way the rest of the ledger is:
      a number appearing in it without a resolving claim fails, so the table
      cannot rot into marketing after the fact.

**Honest-null path.** If fewer than three rows can carry a ledger-backed number,
the table is not ready and is not shipped with placeholders. Publish the rows
that resolve and leave the rest out — a three-row honest table beats a five-row
one with two aspirational cells.

## Phase 4: Record the cut

Kills that are not written down get re-proposed by the next analysis round. Each
decision below carries the revisit condition ADR-127 Decision 7 now requires.

- [x] **P4.1 — ADR for the cut.** One ADR recording: `exec:` built (Phase 1);
      trust-boundary escalation measured before teeth (Phase 2); B deferred with
      its trap named; D and E killed with the reasoning that survived rebuttal;
      C deferred with the round-1/round-2 split stated as a split, not resolved by
      fiat.
- [x] **P4.2 — A revisit condition per decision, event-shaped.** Specifically for
      C: reopen when a ledger surface is edited by someone other than the
      maintainer, since contributor access is the premise the whole disagreement
      turned on and this package does not have it yet.
- [x] **P4.3 — Name the limits in the ADR body.** The `exec:` allowlist only
      covers commands whose exit code is the verdict; the path classifier sees
      paths, not intent; the table is a snapshot bound to its claims. Stating a
      limit is cheaper than having it found.

## Acceptance Criteria

- [x] `exec:` is a documented evidence form with a prefix-tuple allowlist,
      argument hardening including the `--flag=value` right-hand side, CI-only
      execution, and a local path that reports `UNVERIFIED` rather than passing.
- [x] The machine-re-verifiable count in `docs/proof.md` is a measured number that
      moved off 0, or the honest-null finding is published in its place.
- [x] The claims that cannot carry `exec:` are listed as unfalsifiable-by-machine
      rather than omitted.
- [x] A risk-escalation shadow report exists over recent merges, and the teeth
      threshold was written down before the report was read.
- [x] The prevented-failure table holds no number without a resolving ledger claim,
      and a gate enforces that.
- [x] One ADR records the cut, each decision naming an event-shaped revisit
      condition.

## Notes

Local full-pipeline runs are not scheduled here: `quality.local_auto_run` is unset
and therefore false, so remote CI on the PR is the authoritative gate. Targeted
per-change verification still runs, and any new gate this roadmap adds is run once
locally to count as evidence.

Round-1 items not in scope and why: the enforcement-coverage mechanism, the kernel
override carve-out, the subagent floor, and ADR revisit conditions all shipped in
ADR-127. Filling the 86 undeclared `enforced_by` fields (B) and the
lifecycle-scenario cost model (G) are deferred per the council. Tamper-evident
chains (C) are deferred with the split recorded in Phase 4.
