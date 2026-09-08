---
kind: analysis
subject: lint_carrier_integrity
observed_at: 2026-09-08
commit: 0ee772b9dff8807924a50d4ab9df367df1ec68ed
---

<!-- evidence-type: analysis -->

# Assertion-migration audit — `lint_carrier_integrity` → `lint_deferral_integrity`

> **This is evidence, not a decision.** Every line number is read at commit
> `0ee772b9d`, before the change. It exists to satisfy the council's blocking
> condition #1 for ADR-262: *"Produce a line-by-line audit showing where each
> assertion goes. Without this audit, 'generalize the checks' is an instruction
> to future you, not verification."*
>
> The claim this document has to earn is exactly one: **deleting
> `status: carrier` loses no assertion.** Where an assertion is deleted rather
> than migrated, the entry names the specific reason it can no longer fire.

## Summary

| Disposition | Assertions | Note |
|---|---|---|
| **Migrated unchanged** | 6 | the whole archived-side enumeration; status-independent |
| **Deleted — provably unreachable** | 1 | tests `declaresCarrier`, which is being removed |
| **Deleted — its only purpose was policing the exemptions** | 1 | the live-carrier enumeration |
| **Migrated unchanged** (infrastructure) | 4 | fence-scoping, frontmatter-scoping, ratchet, ledger |

Twelve assertions in, ten out, two deleted with a stated reason.

## 1. Enumeration 1 — the archived-side walk. Migrated whole.

`deadRoadmaps()` (`:115-137`) walks `agents/roadmaps/archive/` and
`agents/roadmaps/skipped/` (`DEAD_DIRS`, `:73`), excluding `README.md`,
`INDEX.md`, `template.md`, `progress.md` (`:84-89`). Annotation parsing is
delegated to `parseDeferredItems`, imported from
`archive_completed_roadmaps.ts` (`:60-64`), so the syntax has one
implementation.

**Nothing in this enumeration reads a `status:` value.** It reads archived
files, their `[~]` items, and their `carried-to=` annotations. It is the gate's
entire reason for existing, per its own header (`:11-16`): *"This gate closes
that by walking from the ARCHIVED side … whole-file deletion is detected on the
first pass."*

Every branch of `carryProblemsFor` (`:249-322`):

| # | Source line | Assertion | Destination |
|---|---|---|---|
| A1 | `:256-264` | a `[~]` step carries a `carried-to=` annotation (class `unannotated`) | `lint_deferral_integrity`, unchanged, same class, same ratchet |
| A2 | `:266-271` | the destination is not the source itself | migrated unchanged |
| A3 | `:273-281` | the destination slug resolves under `agents/roadmaps/{,later/,archive/,skipped/}` (`_locate`, `:181-194`) | migrated unchanged |
| A4 | `:283-289` | the destination is not under `skipped/` — *"skipping a receiver is not fulfilling the carry"* | migrated unchanged |
| A5 | `:294-304` | the destination is not an **archived `status: carrier` roadmap** | **DELETED — see § 3** |
| A6 | `:305-312` | the destination, if archived, carries no OPEN steps | migrated unchanged |
| A7 | `:314-320` | the destination back-links via `parent_roadmap:` or a `relates:` row, frontmatter-scoped (`_linksBackTo`, `:169-178`) | migrated unchanged |

Six of seven migrate byte-for-byte. Only A5 is carrier-typed.

## 2. Enumeration 2 — the live-carrier walk. Deleted.

`liveCarriers()` (`:336-366`) enumerates every `*.md` directly under
`agents/roadmaps/` and `agents/roadmaps/later/` (`LIVE_SUBDIRS`, `:326`) whose
frontmatter declares `status: carrier`. `auditCarries` (`:408-426`) then reds
any such file that no archived parent named with a `carried-to=` annotation.

**The gate states its own purpose for this enumeration, and that purpose is the
thing being deleted** (`:40-49`):

> `status: carrier` buys exclusion from the active count, from trackability and
> from the plan risk register; enumerating only archived parents means a file
> nobody carried anything to wears the status for free. So every live carrier
> must be named by some dead roadmap's `carried-to=` annotation, and one that is
> not is a hard failure like any other lost obligation — **the status is
> legitimate for a receiver of a real carry, and for nothing else.**

This assertion protects against *taking three exemptions without earning them*.
ADR-262 deletes all three exemptions. With nothing to take, there is nothing to
police: a file that would once have been an unjustified carrier is now simply an
ordinary roadmap, subject to the dashboard, to `check_roadmap_trackable` and to
`lint_plan_risk_register` like every other roadmap.

**What is NOT lost.** The reciprocal direction — *every carry names a
destination that exists and back-links* — is A1–A7 above and survives whole.
Enumeration 2 never checked that. It checked the opposite direction, and only
for the purpose of exemption-policing.

**Falsifiable check that this is right:** after the change, take the fixture from
`lint_carrier_integrity.test.ts:174` (*"reds a carrier that no dead roadmap names
with carried-to"*), strip its `status: carrier` line, and run the ordinary
roadmap gates over it. It is caught by `check_roadmap_trackable` (no `## Phase`)
and by `lint_plan_risk_register` (no risk register) — two gates instead of one,
both for present-tense reasons rather than for its ancestry. The migrated test
asserts exactly this.

## 3. A5 — deleted, and it was already redundant

A5 (`:294-304`) fires when a carry's destination is an archived file that
declares `status: carrier`. Its stated justification (`:291-294`):

> A carrier exists to stay live. Archiving one is the terminal-archival
> transition that has no vocabulary yet, and it strands every item the carrier
> itself holds — **none of which is an OPEN step, so the check below would not
> see it.**

**That premise is false against the real corpus, measured at this commit.** The
three live carriers hold `- [ ]` open steps, not `[~]`. Counting open-checkbox
lines and deferred-checkbox lines in each of the three files gives
`road-to-continuity-retirement-sequencing.md` **9 open / 0 deferred**,
`road-to-council-topology-evidence-followups.md` **38 open / 0 deferred**, and
`road-to-the-skill-surface-framing-choice.md` **0 / 0**.

So A6 (`:305-312`, "archived but still has OPEN steps") **would** have seen both
of the first two. A5 was doing no work A6 was not already doing, for the two
files it was written about. It is deleted on that ground as well as on the
vocabulary ground — and this is recorded because "it was carrier-specific" alone
would have been a weaker reason than the one that actually holds.

The third live carrier carries **zero** checkbox items of either glyph — it is a
decision packet. Neither A5 nor A6 protects it; what protects it after the
change is that it becomes an ordinary `ready` roadmap with a `## Blockers`
entry, which `lint_roadmap_blockers` reads.

## 4. Infrastructure assertions — migrated unchanged

| # | Source line | Assertion | Destination |
|---|---|---|---|
| B1 | `:152-155`, `:226-228` | `status` is read from the frontmatter block only, never from body prose | migrated (the frontmatter helper survives; only the value it looks for changes) |
| B2 | `:197-223` | `hasOpenStep` skips fenced code blocks — *"a roadmap that documents step syntax inside a fenced block is not a roadmap with an open step"* | migrated unchanged, with its test (`lint_carrier_integrity.test.ts:33` `FENCE_DOC`) |
| B3 | `:770-805` | two tiers: `broken-destination` is a hard failure at zero with no baseline; `unannotated` is ratcheted | migrated unchanged, ratchet key renamed with the gate, count held at 243 |
| B4 | `:66-67`, `GateLedger` / `reportScanned` | ledger adoption + scan-scope reporting | migrated unchanged |

**On B3 and the baseline.** `src/config/gate-violation-baselines.json:88-92`
holds `lint_carrier_integrity: {count: 243}`. The key is renamed with the gate
and the count is **not** touched. A rename is not a measurement, and lowering a
ratchet on a rename would be the laundering this repository's own budget notes
warn about. The `broken-destination` class keeps its no-baseline hard-zero,
including the reason recorded at `:91`: deleting
`road-to-council-topology-evidence-followups.md` produces 38 of them and must
red immediately.

## 5. Gate-coverage row and canary

`src/config/gate-coverage.yml:490-507` holds the `lint_carrier_integrity` row:
`min_scanned: 600`, `status: enforced`, and a `contract-violation` canary planted
transiently at `agents/roadmaps/archive/zz-canary-carrier-integrity.md` (the file
does not exist on disk; `check_gate_coverage --canary` writes it).

**The canary is status-independent already.** Its planted content (`:497-507`)
carries `complexity: bounded` frontmatter and a `[~]` step naming
`carried-to=road-to-zz-canary-receiver-that-does-not-exist` — it exercises A3
(destination does not resolve), not the carrier enumeration. It migrates with the
row unchanged apart from its id and path.

`min_scanned: 600` is a floor on **dead roadmaps scanned**, not on carriers, and
is unaffected.

## 6. What this audit does not cover

- The *other* sense of "carrier" — obligation-delivery vehicles
  (`report_carrier_divergence.ts`, `src/rules/session-canary.md:88-137`,
  `src/scripts/schemas/rule.schema.json:218`). Untouched by ADR-262 and
  deliberately not enumerated here; the name collision is a grep hazard and is
  called out in the audit sibling document.
- Whether the migrated roadmaps pass the gates they newly become subject to.
  That is the migration's own acceptance evidence, not this audit's, and it is
  asserted by test rather than by prose.
