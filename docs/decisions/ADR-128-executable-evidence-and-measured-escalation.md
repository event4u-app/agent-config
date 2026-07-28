---
adr: 128
status: accepted
date: 2026-07-25
decision: executable-evidence-and-measured-escalation
supersedes: —
superseded_by: —
phase: road-to-executable-evidence · P1–P4
type: structural
review_trigger: >-
  When an `exec:` claim is found green while the thing it asserts is false —
  which would mean the exit code stopped carrying the verdict and the form has
  become a more expensive pointer. Also reopen when a ledger surface is edited
  by anyone other than the maintainer, because contributor access is the
  premise the deferred tamper-chain disagreement turned on and this package
  does not have it yet.
---

# ADR-128 — Evidence that re-derives itself, and escalation that is measured before it bites

## Status

**Accepted** · 2026-07-25. Continues ADR-127.

## Context

ADR-127 made an enforcement claim resolve against the wiring rather than merely
exist, and closed five live defects doing it. It deliberately left one thing
measured and unbuilt, in its own Decision 8: the claims ledger still checked
that an evidence pointer **resolves**, never that the claim is **true**. A ledger
entry reading "the suite is green" whose pointer resolves to a report nobody
regenerated stays `backed` indefinitely — the pointer resolves, the claim is
false. The pre-registered threshold for building the fix was ≥ 10 pp of the
backed ledger, set before counting; the measurement came back 11 of 26 feasible.

A second round of the same external comparison raised four further candidates
and a council was run over the cut (two members, two rounds). Both members
independently scoped in the `exec:` form and a content-driven risk axis, and
scoped out filling the 86 undeclared `enforced_by` fields and a
lifecycle-scenario cost model. The reasoning is recorded below because kills
that are not written down get re-proposed by the next analysis round.

The missing risk axis is concrete rather than theoretical.
`discipline_profile: auto` resolves rigor by host capability — *how much
governance can this environment afford*. Nothing asks *how dangerous is this
diff*. The live combination that leaves open: a weak host plus a diff in the
installer's provenance path resolves to minimum discipline, which is precisely
the change class hardened in 9.6.0. The fix landed; the process escalation for
the next change of that class did not.

## Decision

**1. `exec:` is the fourth evidence form, and it re-runs the command.**
`exec:<command> -> <exit-code>`. The exit code carries the verdict. The
allowlist is a set of argv prefix tuples in
`src/scripts/_lib/exec_evidence.ts`, never a regex over a command string — a
regex over shell text is the classic bypass. Every argument after the matched
prefix is re-checked for shell metacharacters and repo escape, **including the
right-hand side of `--flag=value`**, without which `--rootdir=/etc` clears an
allowlist that only inspected the flag name.

**2. Re-execution is CI-only; the static half runs everywhere.** Whether a
pointer is well-formed and allowlisted is a property of the *ledger*, so it
fails on a laptop too. Whether the command actually passes is a property of the
*environment*, so it runs only on an ephemeral CI runner and never in a
consumer's checkout. Locally the gate reports `UNVERIFIED — re-execution is
CI-only, skipped locally`, never a silent pass.

**3. A skip is not a failure, and a failure is not a skip.** "Ran and
disagreed" is a finding. "Could not run" is not. Collapsing the two turns the
verifier into a rubber stamp in one direction or a nuisance in the other.

**4. The feasibility count was corrected down by one, by building it.** Of the
11 measured feasible, 10 survived contact. `context-token-reduction` was counted
feasible because `check_token_regression` re-derives token figures with a real
tokenizer — but the script reads `internal/bench/reports/projection-cost.json`,
which is gitignored as a per-run artefact, so the command is not self-sufficient
in a fresh checkout and exits 1. The `exec:` gate found this on its first CI
run. The corrected figure is 10 of 26 (38.5 pp), still far above the
pre-registered 10 pp bar, so the decision to build stands on the corrected
number too — the over-count changed the margin, not the verdict.

**5. The residue is published, not rounded away.** `docs/proof.md` states how
many backed claims re-derive themselves versus rest on a pointer, and lists each
non-re-executable claim with the reason: external cite, paid or stochastic
benchmark output, or a prose contract with no exit code to carry a verdict.

**6. Trust-boundary risk is classified now and gated later.** The classifier is
path-based and reproducible from the diff alone — no model judgement about
whether a change "feels risky". Three classes: authentication and token
handling; installer, provenance, publish, and subagent-spawn paths; governance
surfaces. The docs exemption is scoped to prose *about* a system, not to any
markdown file: in this repo the rules, `AGENTS.md`, and the kernel set are all
`.md` and are executable policy. An extension-only test classified
`src/rules/icon-consistency.md` as unclassified, which a test caught before the
report shipped.

**7. Escalation is additive and the direction is encoded, not left to callers.**
The host profile sets a floor; a risk trigger may only raise it. A weak host
must never be able to lower an escalation — that inversion is the entire failure
mode the second axis exists to prevent, so `escalated_floor` takes a maximum
rather than trusting each call site to get the order right.

**8. The non-declinable escalation is justified by measurement, and still not
built here.** The threshold — ≥ 5 of ~100 first-parent merges landing in a
trust-boundary class — was written into the roadmap before the report was first
read. Measured: **11 of 99**. That clears the bar, so a non-declinable class for
trust-boundary diffs is warranted and gets its own ADR and its own PR. It is
deliberately not enabled by this one, because it trades away something the
authority model holds (`agent-authority`, `ask-when-uncertain`) and that trade
deserves its own decision record rather than riding along inside a measurement.

**9. The prevented-failure table is generated and gated.** Each row names a
failure mode rather than a feature, and cites a ledger claim. A cited id that is
missing or not `backed` **throws** during generation. The format was borrowed
from the reference; the discipline was not available to borrow — the reference's
own equivalent table carries a headline efficiency figure that appears nowhere
else, an order of magnitude below the cheapest scenario in its own generated
benchmark. A number with nowhere to resolve is exactly what this ledger exists
to catch, so the table is held to the ledger's bar.

**10. Three candidates are closed rather than left open.**

- **Filling the 86 undeclared `enforced_by` fields — deferred.** You cannot fill
  them honestly without first building 86 enforcement points; what you get
  otherwise is 86 `TODO` values, which is *strictly worse than a blank*. The
  blank is honest about non-coverage; the TODO is a promise. This is the exact
  failure ADR-127's own `review_trigger` names.
- **Adversarial governance evals — killed.** A corpus of "user pressures the
  agent to skip a gate" scores refusal as the pass condition, while this
  package's documented authority model says the user decides. An eval asserting
  "the agent must refuse when the user says no" would declare `agent-authority`
  a security failure. The narrower question — does the enforcement mechanism
  return non-zero — is already answerable per rule.
- **A governed-writes lint — killed as the wrong layer.** A static scan for
  `fs.writeFile` against protected paths is simultaneously too weak
  (`child_process.exec('… > file')` walks past it) and too strong (fixture setup
  trips it). Same reasoning as ADR-127 Decision 5: a gate covering one route of
  several, while reading as coverage, is theatre. The type system is the right
  layer if this is ever worth closing.

**11. Tamper-evident chains — deferred with the disagreement recorded, not
resolved by fiat.** Round 1 argued a hash chain adds nothing Git does not
already provide, and that the external `git merge-base` line-prefix witness does
all the work. Round 2 found the hole in that: a line-prefix witness catches
**tail truncation** and does **not** catch **mid-sequence deletion** — dropping
entries 50–90 out of the middle leaves a diff that is not a prefix violation and
reads as an ordinary divergent branch. Neither round produced the number that
settles it, which is how often a ledger surface is edited by someone other than
the maintainer. That number is the revisit condition in this ADR's frontmatter.

## Consequences

**Good.** Machine-re-verifiable claims went from **0 to 10** of 27 backed. The
form found a real defect on its first CI run — the over-counted feasibility
entry — which is the gate doing the job it was built for, on itself. The risk
classifier caught its own docs-exemption bug through a test before its report
was published. Both are the intended shape: the instrument fails visibly rather
than reporting a comfortable number.

**Cost.** 17 of 27 backed claims still rest on pointers and cannot re-derive
themselves; that is now stated on the proof page rather than implied away. The
`exec:` allowlist is a maintenance surface — a renamed script silently drops a
claim from re-verification to static-only, and nothing yet detects that
downgrade.

**Accepted limits, stated rather than discovered later.** The allowlist only
covers commands whose exit code *is* the verdict; nothing about this form helps
a claim resting on a paid benchmark. The path classifier sees paths, not intent:
a dangerous change in a file it does not know about classifies as `none`, and
the class list is a judgement that will need revisiting as the tree moves. The
shadow report measures what *would* have escalated, which is not the same as
what *should* have — it cannot tell whether those 11 merges were actually
handled carelessly, only that they were in the class.

## Alternatives

- **Build `exec:` for all 26 claims.** Not possible, and the attempt would have
  produced fake pointers for benchmark claims. 10 honest re-verifications beat
  26 that only look uniform.
- **Ship the non-declinable escalation in this PR.** Rejected on sequencing: the
  measurement justifies it, but an authority-model trade deserves a decision
  record a reader can find, not a paragraph inside a measurement PR.
- **Let `exec:` run locally too.** Rejected: "commands execute in the repository
  root with full filesystem access" is a property to confine, not to trust, and
  a consumer's checkout has no business re-running this package's evidence.
- **A regex allowlist.** Rejected — the reason the tuple form exists.
- **Skip the prevented-failure table as marketing.** Rejected: the format names
  failure modes rather than features, which is a better description of what this
  package does than any feature list, and the ledger gate makes it falsifiable.

## References

- `internal/reports/exec-evidence-feasibility.json` — the pre-registered
  measurement, its correction, and the built outcome.
- `internal/reports/risk-escalation-shadow.json` — 11 of 99 first-parent merges,
  against a threshold fixed before the first read.
- `src/scripts/_lib/exec_evidence.ts`, `src/scripts/_lib/risk_paths.ts`.
- `tests/scripts/exec_evidence.test.ts` — the abuse cases for the allowlist and
  the argument hardening.
- ADR-127 — the enforcement-resolution decision this continues.
