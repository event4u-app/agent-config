<!-- evidence-type: analysis -->
# Skipped-parent lineage record — the two omitted consolidation parents

**Why this file exists.** `consolidation-lineage-census-2026-08-26.md` found that
four of four declared consolidations omitted a parent. Two of those omitted
parents are the deepest inputs to the roadmaps now on `main`, and both live in
`agents/tmp.old/`, which is **gitignored**. A program that names them as parents
would therefore declare a lineage no clone can check — the same defect one layer
up.

This record makes them citable: pinned by content hash, inventoried in English,
and — the operative part — with the **residual** stated, meaning what of each
parent is *not* represented anywhere in the estate. Their prose is German and
this tree's `.md` must be English, so a verbatim copy is not an option; a
structural record with hashes is.

**Not an adoption.** Nothing below is folded into any roadmap by this file.
Sections marked *residual* are candidates a future consolidation must dispose of
explicitly — `folded`, `killed`, `superseded`, or `adds-nothing` — rather than
leave silent.

**How the residual was verified, because a first pass got the scope wrong.** The
criterion is "absent from **either** merged roadmap". The first pass checked each
parent's residual only against its own descendant, which would have let an item
carried by the *sibling* roadmap read as residual. Re-run across both files, both
directions return zero matches — with exactly one apparent hit, discussed under
Parent B's mutation-surface entry, which is a same-named mechanism and not
coverage.

---

## Pins

| Parent | SHA-256 | Lines |
|---|---|---|
| `road-to-gated-harness-evolution-deep-v4.md` | `5a2a0a199859539980dc4d5bb0c5393ba120e0c47c2ea1845298f34610ffb004` | 1925 |
| `road-to-outcome-grounded-harness-evolution.md` | `24e12ce6fd08db7258e6b22562933050920ff225149ce8a93f95e789e9b74d4a` | 2728 |

Both hashes were computed twice by independent readers and matched. Reproduce
with `shasum -a 256` from `agents/tmp.old/{evolve,evolver}/`.

**Retention caveat, stated because it is the reason this file exists.**
`agents/tmp.old/` is gitignored, holds 347 entries, and has no retention
guarantee. If it is pruned, this record is the only remaining trace and the
hashes become unverifiable. That is a known, accepted limit — not a defect this
file fixes.

**Provenance of the omission.** Each parent declares in its own header that it
supersedes the parents its sibling master then consolidated —
deep-v4 at `:10-11`, outcome-grounded at `:10-12` — and neither master names it.
Whether the file was unavailable to the consolidating session or available and
unread is not establishable from the artefacts, and the distinction matters: it
decides whether the fix is a completeness check or a **provenance** declaration
on the parent set. This record therefore states the parent set *as observed in
the inbox folder*, which is the claim that can be checked.

---

## Parent A — `road-to-gated-harness-evolution-deep-v4.md`

Final roadmap is its section 8 (`:819`). Eleven phases, Phase 0–10. No earlier
draft generations; sections 4–6 are challenge loops.

**Phases:** 0 reconcile the estate and write the evolution constitution (`:821`)
· 1 observation and failure-localization spine (`:906`) · 2 repair the routing
evaluation foundation (`:994`) · 3 evaluate and extend the existing delivery
substrate (`:1064`) · 4 evolution workspace and candidate isolation (`:1145`) ·
5 deterministic credit, cascade, frontier + pathology archive (`:1198`) ·
6 reflector, curator, automated candidate generation (`:1291`) · 7 code-graph
curriculum and consumer-repository evolution (`:1361`) · 8 adaptive scoped
harness selection (`:1434`) · 9 production learning bridge (`:1482`) ·
10 meta-evolution (`:1545`).

**Kill register:** twelve entries at `:1616-1692`, all verdict *killed*; this
file has no defer tier. K4 (new delivery engine from scratch), K9 (100 % trigger
coverage as a vanity target) and K11 (sealed holdout every iteration) are the
three that the merged roadmap adopted or that answer an open decision.

**No id-shaped acceptance criteria.** Verified by pattern search, not inferred.
Its equivalents are ten per-phase `### Exit` gates and a five-group programme
success section at `:1788`.

**Doctrine-level statements** (its own framing, not this record's): the governing
boundary is experimental autonomy versus canonical authority (`:28`) · a proposer
must never see the sealed truth it is optimized against (`:227`) · one primary
mutation dimension per candidate (`:542`, `:1610`) · "not evaluated" is never
treated as pass (`:597`) · a missing activation state stays unknown, never
silently success (`:951`) · solver self-report is diagnostic evidence only, never
outcome truth (`:974`) · a hard-invariant failure cannot be compensated by a
higher score (`:1230`) · an honest null is success if it prevents unnecessary
architecture (`:1841`).

### Residual — in Parent A, absent from the estate

**Load-bearing:**

- **Proactive solver feedback** (`:966`, limit at `:974`). First-person feedback
  collected from the solver — which instruction helped, which conflicted, what
  was missing — admissible as *diagnostic evidence only, never outcome truth*.
  Verified absent from both merged roadmaps: the governed roadmap's `5.3` has an
  optional judge model grading rubric questions, which is a different actor
  observing from outside. This is the only proposed source of *why* signal that
  the activation ladder structurally cannot produce, and it arrives with its own
  admissibility limit already attached.
- **Offline finalizer** (`:976`). In a controlled evaluation the terminal outcome
  is decidable immediately, so the programme must not block on the parked
  production-representativeness problem. Without it an offline programme inherits
  a blocker it was designed to avoid.
- **Adaptive validation** (`:1272`, limit at `:1277`). Once a trustworthy
  full-suite history exists, sample informative tasks to cut evaluation spend —
  never for sealed final evaluation. The only proposed mechanism for keeping
  evaluation cost flat as the corpus grows, and it carries its own hard limit.

**Minor:** multi-machine evidence resumption as a gating condition (`:1492`) ·
K10, that production telemetry is *not* a prerequisite for offline evolution
(`:1673`) — the framing survives on main, the kill does not, so nothing prevents
the prerequisite being reasserted · the deterministic-metadata and LLM-rerank
options of a second-stage compatibility rerank (`:1113`), whose embedding option
was killed and took the cheaper two with it · the per-scope delivery default flip
(one host / profile / pack / stack rather than a universal flip, `:1125`) ·
the five-way anti-overactivation metric set and its stated failure mode, "a
router cannot win by loading everything" (`:1459`), which survives only in
weaker form.

---

## Parent B — `road-to-outcome-grounded-harness-evolution.md`

Final roadmap is its section 32 (`:1587`). Twenty-five phases, Phase 0–24, with a
mirroring 25-step PR sequence at `:2288-2318`. Two earlier draft generations
(`:1312`, `:1456`) are excluded from this inventory.

**Kill/defer register** at `:2320`, two tiers — eight kills (`:2324-2352`,
including hub economy, a global desirability score, publication rewards,
self-reported validation as promotion evidence, automatic authority rewriting)
and five defers (`:2358-2376`: dedicated gene/capsule asset family, full
experience-graph ontology, resident daemon, cross-org marketplace, model-weight
evolution).

**Twenty acceptance criteria** at `:2422`, ids EVO-1 to EVO-20.

**Doctrine-level statements:** the system must never learn from a signal whose
existence depends on the agent remembering to self-report it (`:224`, its own
"core rule") · reflection may interpret facts later, it must not manufacture them
(`:243`) · unknown is never coerced to success (`:801`) · evaluator independence
is a hard architectural invariant (`:1023-1032`) · "zero diff = failure" must not
be global; the gate uses the expected-artifact contract (`:1085`) · never rewrite
historical events (`:1411`, restated as a rule at `:1744`) · failure may add an
anti-pattern, never widen scope (`:2030`) · no single scalar fitness (`:2184`) ·
authority is never runtime-owned (`:2603`) · "do not build genes now, build the
properties that make genes useful" (`:2554`).

### Residual — in Parent B, absent from the estate

**Load-bearing:**

- **The five-level credit-assignment ladder** (`:2046`, also `:985`). Level 0
  co-occurrence · 1 exclusion/activation evidence · 2 paired replay · 3 live
  champion/challenger · 4 held-out generalization — with the binding rule at
  `:2056` that every promotion level declares its **minimum attribution
  strength**, and canonical or global changes require stronger evidence than
  repo-local ones. Verified absent:
  `grep -ric 'attribution level|co-occurrence|paired replay|champion'` returns 0
  in both merged roadmaps. The experience roadmap's `7.5` requires "held-out or
  independent evidence" beyond repo scope but names no ladder and no per-level
  minimum, so promotion strength is currently binary where the parent made it
  graded. This is what would make its own EVO-11 (scope safety) enforceable in
  degrees.
- **The soft structured outcome dimensions** (`:776`, epistemic basis at `:792`).
  Beyond deterministic and temporal dimensions, the outcome vector carries
  architecture fit, maintainability, UI quality, accessibility, security review
  and overengineering — each stamped with an epistemic basis so a judgement can
  never read as a measurement. Verified absent:
  `grep -ric 'maintainab|overengineer|architecture fit|accessibilit'` returns 0
  in both. The consequence is specific: the merged programme can only score what
  a test can prove, so every quality regression this suite's own review skills
  exist to catch is structurally invisible to the loop. Note the asymmetry — the
  *epistemic basis stamp* that made these dimensions safe to include was carried
  over (experience `6.2`) while the dimensions themselves were not.
- **The mutation surface split** (`:2066`, `:2074`, `:2083`). An explicit
  **allowed** initial mutation set (skill learned-section overlay, router
  metadata, workflow order, activation hints, query recipes), an explicit
  **protected** set (hard floor, merge policy, destructive policy, network
  permissions, evaluator thresholds, owner decisions), and an eight-field
  mutation protocol (target · reason · evidence · scope · expected effect ·
  rollback · evaluator set · complexity delta).
  **Partial coverage, stated precisely:** the governed roadmap's `7.2` (`:432`)
  names `protected_dimensions` — but that is a pointer to an existing
  evidence-grading *schema field*, not an enumeration of surfaces
  self-evolution may never touch. A field name and a six-item list are different
  artefacts, and only the field name is on main. The experience roadmap defers
  the question to a blocker and its E11 asks the maintainer to confirm exactly
  *one* protected item. A deferral is not an answer.

**Minor:** EVO-12 authority safety stated at *store* level — deleting the
experience store changes no canonical rule and no owner decision (`:2477`);
the estate proves only the narrower index-level form · EVO-16 runtime
optionality as a criterion something must demonstrate (`:2494`) · EVO-19
complexity control in candidate comparison (`:2507`), deliberately traded away
by the one-core-metric decision rather than overlooked · D5, model-weight
evolution out of scope (`:2376`), with no corresponding boundary on main · the
six unblocking conditions for a resident runtime (`:1178-1205`) — the kill on
main is correct today, but it replaced a decision procedure for reopening with a
bare pointer · the eleven properties that would earn a new asset family
(`:2540-2578`), the positive half of a well-argued kill, so the criteria for ever
reversing it are unrecorded.

---

## How a future consolidation uses this file

Declare the parent set with its provenance, then dispose of every residual item
above explicitly. Four verbs, and silence is not one of them:

| Verb | Meaning |
|---|---|
| `folded` | now carried by a named step; cite the step |
| `killed` | rejected with a reason; gets a kill id |
| `superseded` | a different mechanism covers the same need; name it |
| `adds-nothing` | read, and it changes nothing; say so |

The residual lists are deliberately split into load-bearing and minor so that a
consolidation under time pressure can dispose of six items properly rather than
fourteen items nominally.

---

## Honest limits

- **Structure and coverage only.** This record inventories the parents and
  compares them against the estate. It does not claim the residual items are
  *right* — only that they were not considered.
- **Item-level attribution does not exist.** Neither merged roadmap attributes
  per item; both declare their skipped parent once in the header. Where a
  residual item also appears in a *declared* parent, this record says so rather
  than claiming sole sourcing.
- **Marker reliability — two of the tags are wrong, and that bounds this whole
  record.** The `from-skipped-parent` marker is defined in both roadmaps as
  "comes from the skipped parent and appears in no master". Two items carried it
  and should not have:
  - the governed roadmap's `7.4` (reject semantic no-ops, `:443`) — the clause is
    at `road-to-evidence-driven-harness-evolution.md:1200-1201`, a **declared**
    parent. Parent A contains no no-op gate; its only paraphrase mention
    (`:1342`, "Avoid five paraphrases") governs candidate diversity at generation
    time, a different mechanism. A first attempt to resolve this proposed `:1342`
    as the source — it is the only lexical neighbour in the file, and taking the
    nearest match for the source is exactly the error this record exists to
    prevent.
  - the experience roadmap's `E10` — the capability matrix and the
    "never manufacture parity" rule are at
    `road-to-evidence-gated-self-evolving-agent-config.md:1365-1373`, also a
    declared parent. Corrected in that file when a neutral review caught it.

  Both errors point the same way: an item was credited to the skipped parent when
  the master had in fact read it and dropped it. Those are different failures with
  different remedies — one is a lineage gap, the other an editorial choice — so
  **the marker is not by itself evidence of provenance**, and a future
  consolidation should treat every tag as a claim to check rather than a source.
- **External citations unchecked, on both sides.** Both parents cite an external
  reference tree and published papers. Neither was checked here — this analysis
  ran inside this repository only, which is the same limit both merged roadmaps
  already declare for themselves.
