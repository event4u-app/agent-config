<!-- analyzed: 2026-08-22 | pin: 1dba34c8 (v14.8.0) | corpus: 9,654 lines / 10 sessions -->
# Analysis — the 14.8.0 reviewer corpus, triaged

> **What this file is.** The audit trail for a dropped inbox bundle
> (`agents/tmp.old/feedback-14.8.0`) whose main input is a **9,654-line reviewer
> corpus spanning ten independent sessions**, separated by `------` in one flat
> text file. That corpus is not committed anywhere; this document is the only
> record of what it said, what of it was checked, and what was rejected. It is
> kept for the labelling as much as for the findings.
>
> **Reliability labels — the value of this file.** Every repo claim is marked
> **[V]** (verified in a clone at the pin), **[R]** (a reviewer assertion left
> unverified), or *(proposal)* (the analysis author's own). A reviewer consensus
> is **not** evidence here: a reviewer claim became a defect only where the tree
> confirmed it. Do not strip the labels when quoting from this file.
>
> **Pin.** Drafted against `1dba34c8` — `main`, v14.8.0, the merge of PR #1527,
> 2026-08-22. **`origin/main` has since moved 15 commits past that pin**
> (`ed311d70` at the time of writing). Every claim below is therefore *pinned,
> not current*: re-verify before acting on any of it. Where a figure was
> re-measured while filing this document, the re-measurement is stated inline
> and the original is left visible.
>
> **Anonymisation.** The bundle names third-party comparators. Per
> `src/rules/source-confidentiality.md` they are not named here:
> **Source A** = the external code-intelligence provider the bundle proposes as
> a benchmark candidate; **Source B** = the external host the bundle proposes an
> enforcement spike for. Two lines of the original carried Source A's real name;
> Source B's name appeared on five. The substance is preserved; the names are not.
>
> **Status.** Analysis, not a foundation. Nothing here is settled by being
> written down.
>
> **Method.** Inverted harvest form — start from confirmed repo defects and draw
> reviewer input in per defect, rather than starting from the reviewers and
> looking for support.

Inputs: the reviewer corpus above, plus three proposal documents from the same
bundle — a W1 amendment, an architecture-tournament program (in two revisions),
and a cross-corpus parity review.

---

## 1. The ten reviewer sessions

| # | Session, by its own framing | Core verdict | Its #1 ask | Reliability note |
|---|---|---|---|---|
| R1 | "most consequential consolidation phase, 14.5→14.8"; 10/10 on the partition | shared policy/decision core; one rule-delivery resolver as the single authority | decision core + rule-delivery resolver + mandatory effective-ADR resolution + finding taxonomy → construction guards | claims the release placeholder is "not yet fully effective" — **correct**, see § 2.1 |
| R2 | launch/adoption reviewer | recruit infrastructure built, session never run | run one external recruit session | out of scope per standing instruction; recorded, not actioned |
| R3 | governance-budget reviewer | estate drawdown is real; the stub estate is the new debt | a dark-channel ratchet (not built) | same adoption axis as R2; the stub observation is in-scope and verified |
| R4 | 9.99/10; corrects its own earlier framing | subagent return integrity is the only functional P0 | a minimal envelope with writer/reader/validator proven | says the placeholder is done, with a PR-body caveat — **wrong**, § 2.1 |
| R5 | 9.997; "runtime truth and reduction" | same P0; adds hook-envelope + session-state centralisation | 14.9 theme: "wire, observe, delete, simplify" | notes the auto-derived marker in the PR body — **understates it**, § 2.1 |
| R6 | 9.96; "convergence" | package size, evidence retention, review-loop budget | consumer/maintainer package split; an evidence lifecycle | its command count disagrees with the README — **unresolved counting semantics** |
| R7 | 118/120 matrix reviewer | drain wave; honest terminal states | post-audit of 5 random drain PRs against their exit criteria | self-declared shallow verification |
| R8 | 120/120 (solution-minimalism series) | discipline shipped; paid A/B transferred with an honest corpus gate | bring the pinned corpus to ≥ 30 tasks and fire the run | ran 115 tests green — **highest verification depth of the ten** |
| R9 | 9.78; "subagent return is not the problem we thought" | delivery 1,296/1,296; **contract adoption 0/1,296** | re-frame the P0 as response-contract adoption, not disk recovery | **best single reading of the envelope data** — verified, § 2.3 |
| R10 | author of the tournament program (rebase note) | 14.8 makes the runtime/daemon tournament "more plausible, not superfluous" | run the tournament on four tracks | directly contradicts R1/R4/R5/R6's "build nothing new" and the parity series note |

### Consensus map — independent sessions, not cross-cited

| Finding | Sessions | Tree status |
|---|---|---|
| the response-envelope 0/1,296 is the one functional P0 | R1 (implicit), R4, R5, R6, R9 | **[V]** § 2.3 |
| build nothing new (no carrier, council mode, ADR axis, autonomy class, event bus) | R1, R4, R5, R6, R9, parity series | policy, not a tree claim |
| the stub estate will reproduce roadmap debt | R1, R3, R5, R6 | **[V]** 44 stubs; the ratchet excludes stub count by design, § 2.4 |
| the release placeholder still leaks | R1, R5, R6 (R4 says done) | **[V]** the published 14.8.0 section carries four markers, § 2.1 |
| gate composition can deadlock (no reachable green state) | R4, R5, R9 | **[R]** described in release commits; not re-run |
| finding volume → construction guards / a severity closure barrier | R1, R5, R6 | process claim |
| effective-ADR resolution must be a library, not a CLI | R1, R4, R6 | **[V]** the CLI exists; library use by the runtime not checked |
| standing context still ≈ 114k after the partition | R9 | **[R]** from an evidence file; the partition header numbers are **[V]** |
| package size / consumer split | R6 only | **[R]** |
| evidence retention / rebind churn | R5, R6 | **[R]** |

---

## 2. Tree-verified corrections

### 2.1 The published changelog ships the placeholder again — **[V]**

`CHANGELOG.md` at the pin, section `## [14.8.0]` (line 396), lines 401–404: four
bullets each opening `_auto-derived, rewrite before merge:_` — behaviour changes,
default changes + migration, security and correctness, honest nulls. This is not
a PR body; it is the published section on `main`.
**Re-measured 2026-08-22 while filing: still four markers at lines 401–404.**

`agents/roadmaps/stubs/road-to-release-placeholder-guard.md` already records the
same defect for **14.7.0** and names the agreed design (extract publication
orchestration out of the release script; check the derived-marker before each
independently resumable irreversible transition). The commit titled "move the
placeholder guard onto the render path" shipped **in the release that leaked**.
Four of the ten reviewer sessions called this closed or PR-only; none of them
opened the changelog.

Consequence: this is the cleanest live instance of `src/rules/recurring-criticism.md`
in the tree — a confirmed defect with an existing stub and an agreed design. It
needs an owner and a PR, not more analysis.

### 2.2 Counts — **[V]**, with one figure corrected

| Surface | Measured @ pin | Reviewer spread |
|---|---|---|
| `src/rules/*.md` | 119 | 117–119 (117 is an older pin) |
| `src/skills/*/` | 290 | 290 |
| active roadmaps at the top of `agents/roadmaps/` | **3** | "36→3", "33→10", "10" — 10 is the ratchet ceiling from budget history, not a count |
| `agents/roadmaps/stubs/` | 44 | "very many" |
| `agents/roadmaps/later/` | 56 files / 55 candidates | the budget baseline said 55 — one arrived after registration |
| `agents/roadmaps/archive/` | 555 | 555–560 |
| ADR files (`docs/decisions/ADR-*.md`) | **182** — see correction below | "185 records" (a census count; a different denominator) |
| Source B references in `src/` | 5 files (host detection, surface matrix) | one proposal says "0 hits" — **overstated**; what is true is that no *enforcement plugin* exists, which is the claim that matters |
| commands | **not resolved** — README says 201, a direct count says 40 | two counting semantics; book neither |

> **Correction, kept visible rather than silently swapped.** The original draft
> of this analysis stated **"ADR files: 207 on disk"**. That figure was **never
> true**. Measured while filing this document:
> `ls docs/decisions/ADR-*.md | wc -l` → **182**, and the same count taken from
> git at the pin itself (`git ls-tree -r --name-only 1dba34c8 -- docs/decisions/`)
> is also **182** — as is the count at `origin/main` 15 commits later. So this
> was not drift between the pin and today; it was wrong when written, by 25
> files. The reviewer spread ("185 records", from a census with a different
> denominator) was **closer to the truth than the analysis that corrected it**.
> The lesson is the labelling one: an unlabelled figure in a document full of
> **[V]** marks inherits their credibility without having earned it.

### 2.3 The return channel works; the contract is unread — **[V]**

`agents/evidence/investigations/subagent-envelope-return-baseline.md:55` —
envelope return rate **0.00 %** (0 `ok` of **1,296 stops**); parse failure
**0.39 %** (5 `fail`); `absent` / `no_message` = 0. R9's reading is the correct
one: **delivery is 100 %, adoption is 0 %.** Disk-recovery work (R4's earlier
framing) is therefore not the P0.

Wiring hypothesis *(proposal — verify before building anything)*: the contract
lives at `src/agent-src/contexts/execution/subagent-response-contract.md` and is
referenced from the steering and spawn-contract contexts and three `_lib`
modules, but **neither of the two files under `src/subagents/`** mentions the
envelope or the contract, and the classifier in
`src/scripts/hooks/subagent_ledger_hook.ts` only *observes*. Whether any spawn
path places the contract into a worker's prompt is the first thing to measure.
If no path does, 0/1,296 is a **delivery** defect, not a compliance defect, and
the fix is a single projection rather than a repair loop.

### 2.4 Stubs sit outside the ratchet by design — **[V]**

`src/config/estate-count-budget.json` → `metric.not_gated`: *"agents/roadmaps/stubs/
as a COUNT — a stub is not yet a roadmap, so it is not estate."* Stub creation
dates cluster 4 × 2026-05-24, 5 × 2026-08-20, 1 × 08-21, 1 × 08-22; the
remaining 33 carry no `Created` line the grep matched. The stubs README defines
two classes and a promotion path but **no `review_by`, expiry, or owner field**.
The four May stubs are ~90 days old with no trigger fired. R1/R3/R5/R6's warning
is therefore a **structural gap, not a prediction**.

### 2.5 A dated obligation, 24 days out — **[V]**

`docs/decisions/ADR-134-launch-decision-dated-defer.md:10-16`: expiry
**2026-09-15**, and a lapsed expiry with neither action taken is, in the ADR's
own words, "an open compliance finding". Recorded here because it is a dated
obligation in the tree, not because of any adoption agenda.

---

## 3. The three proposals — why they cannot all be adopted

### 3.1 The W1 amendment

**Shape:** an analysis freeze, a two-item sprint (a Source B enforcement spike,
a context-budget ledger), and two free rides. Kill criterion: if neither core
item lands in the timebox, the finding is *capacity*, not design.

- The **ledger** is the strongest single item in any of the three documents: it
  is the only instrument that makes the "delivery saves while sources creep"
  scissors visible, and its first booking is already measured in the tree —
  `src/scripts/check_rule_layer_partition.ts` publishes a per-host split with
  `.cursor/rules` at 126 files / 26 package-only / 100 global-only, against
  `.claude/rules` at 13 / 13 / 0 **[V]**. Booking the creep as a debit is
  exactly the honest-null posture.
- The **Source B spike** is the weak item: **no confirmed repo defect starts
  it.** It is a capability probe against a host with 5 detection references and
  no observed failure. Under the inverted-harvest form it belongs behind a stub,
  demand-gated. The design is sound; the priority is not.
- The **freeze** is correct, and is the direct answer to R10.
- Defect in the document itself: its "0 hits" claim for Source B (§ 2.2).
  Minor; fix before committing.

### 3.2 The architecture-tournament program — two revisions

**Shape (v1):** a 12-roadmap family, a tournament across eleven tracks, every
identity ADR made challengeable, and daemon / runtime / swarm / browser all
permitted winners. **Shape (v2, the live revision):** the same direction reduced
to four sequenced items plus a tournament held only after convergence, with a
cap of three simultaneously active structural roadmaps.

**Assessment.** This is the best-written of the three and the one that must not
be adopted in this cycle, for reasons the repo already holds:

1. It **inverts the harvest form**: it starts from external comparators and
   pushes their layers onto this package. The repo's own parity series just
   concluded, after six audits, that every comparator axis is settled, locked or
   owner-reserved, and that the next audit "should begin from the locks, not
   from the comparators".
2. It contradicts the **one thing all ten reviewers agree on** — no new
   architecture block before the estate drawdown has measured effect.
3. Its **Phase 0 is the context ledger under another name.** The tournament
   cannot start before the ledger exists; the ledger is useful without the
   tournament. `agents/roadmaps/road-to-standing-payload-diet.md` Phase 0
   (steps 0.3–0.5) is already building the measuring half.
4. The native code-graph **null** (a large recall gap against a host baseline)
   is negative evidence the document converts into "attractive for a Source A
   provider, a fork, or a hybrid". That is re-argument of a settled axis — the
   parity series records Source A's axes as settled, with the retrieval null
   governing.
5. It would add **12 active roadmaps against a ratchet baseline of 3** — a gate
   that by construction only walks down.

**Disposition — executed 2026-08-22.** Parked as
`agents/roadmaps/later/road-to-agent-config-next.md` with a two-legged resume
condition: re-open when the standing-payload ledger has ≥ 4 weeks of measured
entries **and** response-envelope adoption is ≥ 95 % over ≥ 500 stops. Two
sections are marked reusable regardless of whether a tournament ever runs — the
program invariants and the decision loop; everything else is explicitly excluded
so the twelve-item version cannot be re-imported.

**One clause in it is owner-reserved and was flagged as such rather than
decided:** making standing identity ADRs challengeable is governance
self-amendment. Parking the roadmap does not dispose of that clause.

### 3.3 The cross-corpus parity review

**Shape:** one scheduled review of a chain-contract residue, then stop.

**Assessment.** Adopt as written. It is the smallest item, it is *due* by the
repo's own lock condition, and its series note is the policy answer to § 3.2.
Two edits before it enters the tree: anonymise the comparator names per
`src/rules/source-confidentiality.md`; re-pin comparators only if the review
cites their current shape.

### 3.4 Reconciliation

| | W1 amendment | tournament program | parity review |
|---|---|---|---|
| new analysis | forbids it | is one | ends one |
| estate delta | 0 active roadmaps | +12 | 0 (one evidence file) |
| starts from a confirmed defect | ledger yes; spike no | no | yes (a lock fired) |
| compatible with reviewer consensus | yes | no | yes |

They are consistent **only if the tournament program is parked**. That call is
owner-reserved; this document records the evidence, and the park recorded in
§ 3.2 is the sequencing disposition, not the governance one.

---

## 4. Defect ledger — what survived, and where it went

| # | Confirmed defect | Provenance | Carried by |
|---|---|---|---|
| D1 | response-envelope contract 0/1,296 adopted | the envelope baseline evidence file, line 55 | the roadmap `road-to-subagent-envelope-adoption` |
| D2 | the published 14.8.0 changelog carries the derived marker × 4 | `CHANGELOG.md` lines 401–404 | promote the existing placeholder-guard stub |
| D3 | stub count and age sit outside any gate; 4 stubs at ~90 days | the budget's `not_gated` list + stub dates | a stub-lifecycle item |
| D4 | source counters creep while delivery saves; no ledger | the W1 amendment's own table (rules count 119 verified) | `agents/roadmaps/road-to-standing-payload-diet.md` Phase 0 |
| D5 | the chain-contract residue review is due | the parity review | adopt the parity review as written |
| D6 | three emitters ignored the partition until 14.8 | release notes **[R]** | *measure first* |
| D7 | two gates jointly unsatisfiable in release mode | release commits **[R]** | *measure first* |

**Not carried** — reviewer-only, with no confirmed defect in the tree at this
pin: a shared decision core; hook-envelope / session-state extraction; the
package split; an evidence retention policy; a severity closure barrier; an
episode finalizer; the Source B plugin. Each needs a confirming measurement
before it becomes work.
