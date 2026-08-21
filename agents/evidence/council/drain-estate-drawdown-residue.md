# Council decisions — road-to-estate-drawdown, the four remaining items

<!-- evidence-type: analysis -->

Session: 2026-08-21. Members: anthropic (claude-sonnet-4-5), openai (codex-default).
Quorum 2/2 both rounds. Two rounds: a disposition round that diverged on **all
four** rows, then a divergence-resolution round on the named merge plus one row
the first round had omitted. Actual spend USD 0.0968 + 0.0292 = **0.1260**.

Framework: `drain-blocker-dispositions-a.md` (adopted round 1 of the drain run,
both seats convergent) — dispositions A/B/C/D/E, the four outcome states, the
categorical Rule 3, the measured-null distinction of Rule 4, duplicate-evidence
merging under Rule 5, and the three-point stub-integrity check. Not re-opened
here.

Evidence the questions cited:
`agents/evidence/analysis/estate-drawdown-residue-probe-2026-08-21.md`, measured
at `origin/main` @ `52cfb4bb8`.

## Round 1 — divergence on every row

| Row | anthropic seat | openai seat |
|---|---|---|
| 1 · step 1.1 | `C / satisfied` | `E / abandoned` |
| 2 · step 1.2 | `C / satisfied` | `A / narrowed` |
| 3 · steps 2.1 + 2.2 | `A / narrowed` | `B / transferred` |
| 4 · three `draft` roadmaps | `D / satisfied` | `B / transferred` |

The openai seat opened *"I would not greenlight this decision request as written.
Its forced one-disposition-per-row model hides mixed outcomes and unresolved
ownership."* That critique was adopted rather than argued with, exactly as round 1
of the parent drain framework was.

## Round 2 — the adopted table

Rows 1–4 were put back as a specific merge with the reasoning per row. **Both
seats confirmed all four.** Row 5 was asked for the first time and diverged.

```text
row-1-step-1.1       | C | abandoned   | Instrument ran and answered zero; nothing was cleared, so not `satisfied`.
row-2-step-1.2       | A | narrowed    | Mechanism shipped; the one named item was already transferred in batch A.
row-3-steps-2.1-2.2  | B | transferred | 71 files are explicit AC-2 scope and need a carrier, not a narrowing.
row-4-draft-roadmaps | B | transferred | Author-controlled `draft` status is a trust-boundary flaw, not a finding.
row-5-step-4.1       | E | abandoned   | The pass is specified over a delegate path the council declined.
```

### Row 1 — step 1.1 · `C / abandoned` · both seats confirmed

A **merge**, not a pick. Disposition **C** because Rule 4 maps
instrument-ran-and-answered-zero to C categorically, the openai seat did not
dispute the measurement, neither seat asked for a transfer, and **E** does not fit
a mechanism that shipped with 23 fixture tests. Outcome **`abandoned`** because
`satisfied` overclaims: the criterion says *"clears every class-0 blocker"* and
zero were cleared.

openai (round 2): *"C / abandoned correctly separates successful measurement from
failure to clear any blocker."*

One round-1 objection was answered by evidence, not argument: the 35-vs-34
instrument disagreement is the single `legacy` entry in
`road-to-gated-reach-followup.md`, which states its gate as prose with no `Class:`
field, so neither instrument reads it as class 0/1. **The remaining objection was
adopted and changed the closure**: classification is mutable — twelve entries were
reclassified once — so the claim is bounded to a named snapshot (`52cfb4bb8`,
2026-08-21) rather than asserted as a permanent invariant. That bound is the fix
the objecting seat itself named as sufficient.

### Row 2 — step 1.2 · `A / narrowed` · both seats confirmed

Both seats agreed on the two load-bearing points independently: the budget
mechanism shipped, and **no second stub may be created** — anthropic citing Rule 5
by name, openai saying to reference the existing transfer rather than duplicate
it. The openai instruction was adopted as the more precise one: record the two
halves separately instead of letting one word cover both.

anthropic's round-1 dissent, recorded: `C / satisfied` on the same facts.

### Row 3 — steps 2.1 + 2.2 · `B / transferred` · both seats confirmed

Decisive on the roadmap's own terms: 71 files are explicit AC-2 scope, and a
narrowing with no carrier drops them with nothing holding them — this roadmap's
own **risk 1, "drawdown by burial"**. The openai seat had said B is the only
defensible direction *but not ready* without three things; all three were supplied
and are in the stub:

1. **Named producer** — the repository maintainer, scheduling further triage
   batches under the same register.
2. **Measured probe** — files under `agents/roadmaps/*.md` + `later/*.md` with no
   `- file:` / `moved_to:` row in `agents/decisions/estate-triage-dispositions.yml`.
   **71 at transfer** (24 active, 47 `later/`). Re-entry completes at 0.
3. **Collision + snapshot policy** — batches are selected against a named snapshot
   commit, and a file held by an open drain PR is skipped with its reason in the row.

**A proviso the openai seat attached to its confirmation, and it is binding:**
*"provided the maintainer remains the producer independently of step 4.1."* The
draft of this stub had named the Phase-4 recurring pass as an alternate producer.
Row 5 abandons that pass, so naming it would have made the producer depend on
something that no longer exists. It is **not** named in the shipped stub.

anthropic's round-1 dissent, recorded: `A / narrowed`, on the reading that the
batch *form* was delivered and the concurrent per-roadmap drain PRs are the real
drain mechanism.

### Row 4 — the three `draft` roadmaps · `B / transferred` · both seats confirmed

The openai seat's framing was adopted as the stronger reading: authors control
`status: draft` and the dashboard parser excludes drafts, so **the measured party
controls whether its work enters the measurement boundary**. A named blind spot in
an anti-regrowth ratchet is an open obligation, not a closed finding — naming it
does not satisfy T2.

Rule 3's reach over *"change a shipped gate's counting semantics and its committed
baseline"* is genuinely ambiguous, and the openai seat said so rather than
resolving it by assertion. The conservative reading was taken: **the metric is not
touched in this change.** The finding is recorded and the fix is carried by a stub.

anthropic's round-1 dissent, recorded: `D / satisfied` — the finding is the
deliverable and metric maintenance is separate work.

### Row 5 — step 4.1 · `E / abandoned` · **split 1/1, dissent recorded**

Round 1 never asked about 4.1. It cannot be omitted: 4.1 is `[~]` **deferred**,
and Iron Law 3 forbids archiving a roadmap with an unresolved deferral.

Both seats agreed on one thing — **separate**, not merged with the row-3 stub.

| Seat | Verdict | Argument |
|---|---|---|
| openai | **E / abandoned** | *"The council explicitly declined the required delegate path, so transferring this specification would create a zombie obligation whose re-entry condition reverses an adopted decision."* |
| anthropic | `B / transferred` | Batch B recorded the blocker as `narrowed`, not `abandoned`; the entry stays alive and re-enters when `allow_delegate` is authorised, on a setting-value probe. |

**Adopted: `E / abandoned`,** on three grounds.

1. **Rule 1's own rationale is this exact shape.** E was created because *"without
   it, permanently-infeasible work is forced into stubs that become parking lots
   while completion percentages report success."* A stub whose re-entry probe is
   "`allow_delegate` became true" has a re-entry condition that reverses the
   council's own adopted decision. That is the parking lot, by construction.
2. **E's definition fits.** E covers work that *"depends on a capability nobody is
   building."* Nobody is building the authorised delegate path — the council
   declined it in batch B, choosing (b) with `allow_delegate: false`.
3. **The dissent's premise does not carry where it points.** `narrowed` in batch B
   describes the **blocker's** disposition — option (b) adopted instead of (a). It
   does not describe step 4.1's viability. The blocker was narrowed; the *step*
   defined over the option that was declined lost its subject. The two are
   different objects and the dissenting rationale treats them as one.

**Nothing capable is lost, and that is checked rather than asserted.** Each of the
four actions the pass would have composed exists today and is hand-invocable:
`resume_probe` (used by triage batch 1), `gates --execute` (shipped, 23 tests, and
zero subjects per row 1), `gates --sheet`, and `check_estate_count` for the count
paragraph. What is abandoned is the **scheduled delegated-write automation** —
precisely and only the thing the council declined. AC-4, defined over that pass,
is abandoned with it.

## Authority note — a user-reserved disposition taken under standing delegation

`roadmap-progress-sync` Iron Law 3's preservation test routes a disposition that
does **not** keep an item alive in the active estate to the **user**, never the
council. Row 5 is such a disposition: `abandoned` drops step 4.1 and AC-4.

It was taken by the council under this drain run's standing delegation — the
maintainer pre-authorised that any decision which would normally reach the user
goes to the council instead, and its recorded verdict substitutes for user
sign-off, which is the same delegation `drain-blocker-dispositions-a.md` records
for all 44 blockers. Recorded here explicitly so the authority chain is visible
rather than inferred, and because a split council on a user-reserved drop is the
weakest link in this closure. A maintainer who disagrees reverses row 5 by
restoring 4.1 to `[ ]`; nothing else in this change depends on it.
