---
complexity: structural
status: active
source_analysis: 2026-07-25
---

# Road to Number Truth and Decision Homing

> This round started from a small observation about a competitor's positioning
> table — five rows, each naming a *failure mode prevented* rather than a feature,
> no adjectives, one number — and the thought that AC could fill that format more
> honestly, because every cell could carry a claim marker.
>
> Auditing whether AC could actually fill it found that **three numbers AC ships
> today are wrong**, and one shared cause.
>
> One sentence: **a decision recorded its own unblocking condition, the condition
> was met, and nothing fired — because the gate that would have noticed sees only
> percentages, and the ledger checks that a pointer exists, never that its number
> is true.**

## Goal

Correct the three shipped numbers, close the gate hole that let them ship, and
land the borrowed failure-mode framing as a projection of data that is already
CI-checked — not as a second table to keep true.

## Context — verified, do not relitigate

Every row was re-confirmed directly against source, not taken from the audit.

| # | Finding | Evidence |
|:--|:---|:---|
| **D1** | README understates host coverage by **3×**: it says *"compiled into 7+ host agents"* and names 7. Reality: **23 detected** (`knownToolIds().length` → 23, test-pinned at `tests/install/toolDetection.test.ts:66`), **20 receiving a written config surface** (3 export-only) | ran `knownToolIds()`; ran `lint_surface_matrix` → "No issues found (23 tools)" |
| **D1b** | The ledger entry `host-agent-count` is `status: unbacked`, and its evidence field **names its own unblocking condition**: *"the concrete binding artifact is `src/config/surface-matrix.yml` … once it exists, bind the count to that file and flip."* **That file exists and is CI-gated by set-equality against the installer's own path map.** The condition was met and nobody noticed | `docs/CLAIMS.md` entry read in full; linter run green |
| **D2** | `second-brain-retrieval-precision`'s claim text contradicts the artefact it binds to, in three numbers: it says `5/27`, `5/27`, `tie-set 3.3`; the artefact says `retrieval-off 2/27`, `retrieval-on 27/27`, `mean_tie_set_size 4.111` | claim text + `internal/bench/reports/second-brain-retrieval.json` read side by side |
| **D2b** | A sibling claim on the **same file** (`retrieval-substrate-live-pass`) cites the *correct* figures — so two `backed` claims disagree with each other while both resolve | both entries read |
| **D3** | `ledger-exec-verifiability` — shipped by the previous PR, i.e. mine — publishes "0 of **25** backed ledger claims". The ledger now holds **26** | `check_claims` output: "ledger 31 entries (26 backed…)" |
| **C1** | The shared cause: `QUANTIFIED_CLAIM = /\b\d+(?:\.\d+)?\s*(?:%\|[x×])/` matches **only** percentages and multipliers. Bite-tested MISSED: `7+`, `~5,000 tokens`, `22,077 tokens`, `13,881 GPT-tokens`. CAUGHT: `13.1%`, `15x` | `check_claims.ts:50`; ran the pattern against each string |
| **C2** | Witness surfaces are 2 files (`README.md`, `CAPABILITIES.yaml`). `docs/benchmark.md`, `docs/catalog.md`, `docs/value.md` all carry token-shaped figures and are unswept | `check_claims.ts:48` + grep over `docs/*.md` |
| F2 | Decisions have **11 possible homes**; 4 are validated for anything, **0** for decision homing. A routing rule does exist and is CI-wired — but only for the flat-vs-per-area ADR split | surface inventory |
| F2b | **Six** files in `agents/settings/contexts/` are named `adr-*.md`; one is titled `# ADR — Auto-Rule Consolidation` with ADR frontmatter (`status: locked`, `supersedes:`, `supersededBy:`) and has **zero** presence in the ADR index | `head` of the file + `grep -c` on `INDEX.md` → 0 |
| F2c | AC already paid for this once: ADR-124 mandated a re-classification sweep whose recorded remedy was a **hand-built 44-entry table**, not a mechanism | ADR-124 |
| F2d | `audit_adr_coverage.ts` iterates 5 hardcoded areas, never scans `docs/contracts/`; `docs/adrs/memory/` exists on disk and is absent from the list → unaudited | `audit_adr_coverage.ts:39-60` |
| F3 | The "every cell binds to resolving evidence" mechanism **already exists**: `docs/comparison.yaml` (fields `claim`, `our_evidence`, `their_evidence`, `checkable`) resolved by `check_comparison.ts` — which imports the *same* `pointer_unresolved` as the ledger — and rendered into `docs/proof.md` § 4 by `build_proof.ts` | all three read |

### What the reference case shows, corrected by reading it

The competitor's headline token figure is not merely underived — it is **falsified
by its own published formula** (its own method yields ~20,933 where the table says
~5,000, off by 4.1×), its guarding test asserts only `savings >= 3000` (passes
trivially), and a second test does `assertIn("5,000 tokens", …)` — a substring
pin that **entrenches the stale number instead of checking the math**. Its CI
declares `README.md` and `docs/*` *"inert documentation surfaces"*.

AC's sweep has the **right shape** — it demands a claim marker rather than pinning
a literal. D1 proves the breadth is wrong. Nothing below may drift toward the pin
shape; that is the one mistake here that would be easiest to copy by accident.

---

## Phase 1 — Correct the three shipped numbers

- [x] **P1.1 — Flip `host-agent-count` to the artefact its own entry names.**
      Bind it to the surface matrix, set the real figures, and mark it backed. The
      entry's recorded unblocking condition has been satisfied for some time; this
      is the flip it asked for.
- [x] **P1.2 — Correct the README from "7+" to the true shape.** Two numbers, not
      one: hosts *detected* and hosts *receiving a written surface*. Understating by
      3× is not modesty in a package that sells falsifiability — it is the same
      class of defect as overstating, and it is the one AC actually committed.
- [x] **P1.3 — Reconcile `second-brain-retrieval-precision` with its artefact.**
      Three figures are wrong. Correct the claim text to the artefact's values and
      state the tie-set honestly — the larger tie-set is the ADR-116 activation
      signal the artefact itself explains, so the accurate number is *more* useful
      than the flattering one.
- [x] **P1.4 — Resolve the two-claims-disagree case.** A sibling claim on the same
      file already cites the correct numbers. Decide whether both entries should
      exist at all, or whether one is the durable record and the other should be
      retired — two backed claims disagreeing about one artefact is worse than
      either being wrong alone.
- [x] **P1.5 — Fix the stale denominator in `ledger-exec-verifiability`** (25 → the
      live count). It is mine from the previous PR, it drifted within a day of
      shipping, and it is the exact class that claim's own text describes. Record
      that plainly rather than quietly correcting it.

## Phase 2 — Close the gate that let them ship

- [x] **P2.1 — Extend the existing sweep; do not build a second gate.** The council
      split here and the decisive argument is that a magnitude on a marketing
      surface *is* a claim: one rule, one fix path. A separate gate does not resolve
      the derived-vs-unbacked ambiguity, it only moves where the false-positive cost
      is paid, and it would need its own remedy taxonomy.
- [x] **P2.2 — Add the bare-count class that D1 exposes.** `7+` carries no unit and
      no `%`, so no unit allowlist would catch it either. A count-shaped assertion
      about the package's own surfaces (`N host agents`, `N+ …`) needs its own
      pattern — this is precisely the shape that shipped wrong.
- [x] **P2.3 — Unit allowlist for magnitudes, not a digit heuristic.** Fire on a
      number carrying a measurement unit (`tokens`, `ms`, `USD`/`$`, `KB`/`MB`/`GB`,
      `chars`) plus the existing `%` and `x`. A thousands-separator heuristic would
      catch `22,077` and also every year and large ordinal.
- [x] **P2.4 — Exclude time-in-prose in v1.** "wait 30 seconds", "takes 5 minutes"
      are instructions, not claims. A gate that false-positives is a gate that gets
      bypassed — the same `narrow > recall` rationale as the credential floor.
- [-] **P2.5 — Widen the witness surfaces.** CANCELLED by measurement, not skipped.
      The premise was that `docs/benchmark.md`, `catalog.md` and `value.md` carry
      token-shaped figures unswept. They do — and counting the hits first showed
      `benchmark.md` alone would fire on **54 lines**. It is a methodology
      document whose job is to be full of statistics; sweeping it produces exactly
      the flood that teaches a maintainer to bypass the gate. `proof.md` and
      `comparison.yaml` are pointer-enforced by their own linters, so an
      unmarkered figure cannot originate there either. The gap was never the
      surface list — it was the pattern (P2.2/P2.3) and the line-level exemption
      (found while bite-testing, see below). Recorded in the code comment.
- [x] **P2.6 — Bite-test both directions and pin them.** An unmarkered `7+ host
      agents` fails; a markered one passes; `Node 20` and a bare year do not fire.
      The regression that matters is the one that just happened.

- [x] **P2.7 — The second hole, found while bite-testing and not in the plan.**
      Fixing the pattern alone still did not catch the shipped line: the end-to-end
      probe passed. The README line already carried `<!-- claim:no-runtime-daemon -->`,
      and the sweep exempted the whole line on *any* marker — so `7+` would have
      ridden along even with a correct pattern. A `kind: qual` claim about having
      no daemon says nothing about a quantity, so a figure is now cleared only by
      a marker whose ledger entry is `kind: quant`. Both holes were load-bearing;
      closing either alone would still have shipped the wrong number.

**Honest-null path.** If the widened pattern produces more than a handful of
findings that are all legitimate prose, the pattern is wrong rather than the
surfaces being dirty — narrow it and record what it could not safely see.

## Phase 3 — Decisions filed where nothing can find them

- [x] **P3.1 — Resolve the six ADR-shaped context files.** They carry ADR titles
      and ADR frontmatter and are invisible to the index. Decide per file by reading
      it: either it is a decision and belongs on the ADR surface, or it is a context
      doc and must stop claiming otherwise. The `adr-` prefix is a claim.
- [-] **P3.2 — Migrate every inbound reference.** NOT NEEDED — the approach
      changed during execution and the roadmap records why. Relocating the six
      files would have meant renumbering six decision records and rewriting ~15
      inbound references, ten of them inside frozen archived roadmaps whose paths
      were correct when written. The harm was findability, not location, so the
      index generator now SCANS for decision-shaped files outside the ADR
      directory and lists them. Paths unchanged, zero references touched, and the
      scan keeps working for the next file filed in the wrong place — which a
      one-time move would not.
- [x] **P3.3 — Close the coverage-audit blind spots** so no area is silently
      unaudited, and make the index see the decision file that lacks the expected
      filename prefix.
- [x] **P3.4 — Regenerate the index and verify** the previously invisible decisions
      are listed.

## Phase 4 — The borrowed framing, as a second lens on checked data

Both council members split on how to land this; the resolving argument is that
`comparison.yaml → proof.md` is **already** a projection. A schema field makes a
second view mechanical, whereas hand-picking "these rows for the README" is manual
curation with weaker enforcement than what already exists.

- [x] **P4.1 — Add an optional `failure_mode` field** to the comparison row schema.
      It names the risk the row's `claim` mitigates — complementary, not a duplicate.
      Optional, so no row is forced to invent one.
- [x] **P4.2 — Populate it only where a real failure mode exists**, in
      failure-mode voice, adjective-free. An empty field is the honest signal that
      a row is comparative only.
- [x] **P4.3 — Render the second view from the same source.** A row appears in the
      adopter-facing view **iff** `failure_mode` is populated, so "which rows go
      where" is a data property and never a curatorial decision that drifts.
- [x] **P4.4 — No cell escapes the resolver.** The existing gate enforces this for
      `our_evidence`; the new view must not introduce an unbound cell. That is the
      entire reason the borrowed format is worth anything here — the table is a
      proof exhibit, not positioning.
- [x] **P4.5 — Record the refusal of the pin shape** in the schema comment: a
      number in this table is bound by a resolving pointer, never by a substring
      assertion.

---

## Parked, with the condition that reopens each

| Item | Why parked | Reopens when |
|:---|:---|:---|
| Forward-only decision-homing linter (narrow detector, three legal dispositions, committed baseline over the 691 legacy marker lines) | Both council members converged on it and the shape is a clone of the existing `later/`-disposition linter — so this is a deferral on **priority**, not merit. Three live wrong numbers on shipped surfaces outrank a class-prevention mechanism this round, and Phase 3 closes the concrete damage | Immediately after this lands — it is the natural next PR, and the baseline it needs is already measured (691 lines / 248 archives) |
| Archive index making the ~94 stranded prose decisions searchable | Same reason; it is a one-time generated scan, cheap, but it pairs with the linter above rather than with number truth | Ships with the linter |
| Retrofitting stranded decisions into real ADRs | ~90 after-the-fact decision records is authoring, not engineering | A stranded decision is found to have been contradicted by later work |
| Re-running derivations in CI so a claim's **math** is checked, not just its pointer | The strictly better fix for the D2 class, and it is the `exec:` work the previous roadmap's pre-registered measurement already scheduled | That `exec:` PR lands; this is its second half |
| An activation / attach-rate number | Genuinely unbacked: the nearest artefact is disqualified by its own contract (a deterministic replay that "would fabricate activation counts"), and the trigger-coverage figure is a *can-fire* floor, not an activation rate. Claiming one would be the exact defect this roadmap corrects | A measurement with a model in the loop exists |
| End-to-end "what one task costs" | Per-task figures exist and are ledger-backed, but the raw reports behind them are operator-local and untracked (0 of 29 in git), so they are not reproducible from a clone | The reports become tracked, or the figure is re-measured reproducibly |
| Widening the number sweep to time units | Excluded from v1 on false-positive grounds | A latency or duration claim actually ships on a witness surface |

## Acceptance criteria

- No shipped surface states a host count that contradicts the CI-gated matrix.
- `host-agent-count` is backed, bound to the artefact its own entry named.
- No two backed claims disagree about the same artefact; no claim text contradicts
  the file it binds to.
- An unmarkered count- or magnitude-shaped assertion on a witness surface fails CI,
  and ordinary prose numbers do not.
- No file claims to be an ADR while being invisible to the ADR index; no area of
  the coverage audit is silently unaudited.
- The adopter-facing failure-mode view is generated from the same CI-checked rows
  as the comparison table — one source, two lenses, no cell without a pointer.
