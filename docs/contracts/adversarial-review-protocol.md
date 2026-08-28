---
stability: beta
keep-beta-until: 2026-11-23
---

<!--
keep-beta-until extended 2026-08-27 -> 2026-11-23, with the reason, because the
window lapsed on the calendar rather than on evidence and now reds every PR.

NOT promoted to `stable`, deliberately. `docs/contracts/STABILITY.md` reserves
that level for "fully released contracts that have shipped through one major
release without breaking", and this contract's surface changed as recently as
`e5e4c48d6` ("close all fourteen R2 findings") -- three corrective commits in its
most recent history. Marking it stable would assert a settledness its own git log
contradicts, which is a worse outcome than an extended window.

The new date is the 2026-11-23 horizon the frozen lapsed-beta baseline already
uses, so this contract's review lands with that cohort rather than on a date
invented for it. Adding it to that baseline is not an option and was not
attempted: the baseline is frozen and "may not grow".

Extended by an autonomous run that met the red on an unrelated PR. The promotion
decision is a maintainer review this run is not entitled to make; what it can do
is keep the lapse visible with its reason instead of silent.
-->

# Adversarial Review Protocol — structure over exhortation

> **Status:** active · **Owner:** maintainer · **Source roadmap:**
> `road-to-self-critical` (council debate 2026-07-26,
> anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds; activated
> 2026-07-27 by maintainer decision).

Every previous "be critical" surface (adversarial-review skill, premortem,
11 review personas) existed while external chat reviews scored this package
118–119/120 — and still missed real defects. Exhortation does not
generalize; structure does. This contract fixes the **structure** of how
the package gets reviewed: seat, context, objective, measurement,
calibration. It is the protocol every maintainer-solicited review runs
under from 2026-07-27 forward.

## § 1 — Root causes this protocol removes

| # | Root cause | Removed by |
|---|---|---|
| R1 | Inside-out vantage — reviewer starts from the repo's own story | Consumer seat first (§ 2.2) |
| R2 | Reading, not measuring — findings from prose impressions | Measurement mandate (§ 2.4) |
| R3 | Context contamination — repo rules, prior reviews, scores in context | Clean-room session (§ 2.1) |
| R4 | Score-seeking objective — "rate this /120" invites praise | Rejection mandate (§ 2.3) + no-score rule (§ 3) |
| R5 | No external baseline — package judged against itself | Competitor quota (§ 2.5) |

R1/R2's deterministic classes are additionally killed by the standing
containerized outside-in gate (built as `road-to-credible-install`
Phase 6 — routed there, not duplicated here). The protocol itself is
calibrated with planted canaries (§ 6) because an uncalibrated watchdog
is indistinguishable from a sleeping one.

## § 2 — The five structural mandates

Every solicited review MUST satisfy all five. A review that skips one is
not a protocol review and its findings carry no protocol weight.

### 2.1 Clean-room session

The review runs in a session that contains **none** of: this repo's rules
or skills, prior reviews, historical scores, roadmaps, or maintainer
commentary. The reviewer receives ONLY the solicitation template (§ 4) and
the public artifacts an external evaluator would have (registry listing,
README, install command). Anything else in context is contamination and
voids the run.

### 2.2 Consumer seat first

The reviewer installs the package **from the registry into an empty
project** and works there BEFORE the repo checkout is opened. First
impressions (install friction, first-five-minutes surface, broken
commands) are recorded from the consumer seat; the checkout is opened only
afterwards, for depth.

### 2.3 Verbatim rejection mandate

The solicitation instructs, verbatim: **"find the fastest credible reasons
to reject this package."** The reviewer's objective is rejection, not
assessment. A review that returns no rejection-grade findings must state
what it measured and failed to break — not that the package is good.

### 2.4 Measurement mandate

**A finding without an executed command and captured output is
discarded.** Every finding cites the command it ran and the output it
observed (exit code, timing, byte count, error text). Prose impressions
("the docs feel bloated") are not findings until a measurement makes them
falsifiable ("`wc -c` on the always-loaded set: N bytes against the
declared budget of M").

### 2.5 Competitor quota

At least **3 competitors cloned and measured on the same metrics**, plus
one fresh sweep for new entrants since the last review. Numbers without a
baseline are vibes; the package's install size, latency, and surface
counts are reported next to the competitors' — whichever way the
comparison lands.

## § 3 — Output: severity-tagged findings ledger. No score.

The ONLY accepted output format is a findings ledger. **No numeric score
is requested, and none is accepted** — a score arriving anyway is ignored
on arrival and does not enter any record.

### The /120 format is retired

Numeric self- or solicited scores (the historical "/120" chat-review
format) are **no longer requested and are ignored on arrival**.
Severity-tagged findings replace their function entirely. Existing
historical scores stay as history — nothing is rewritten — but no new one
is produced, cited, or published as a quality signal. The solicitation
prompt previously used to obtain /120 chat reviews is retired with this
contract and MUST NOT be used alongside the § 4 template; § 4 is the only
sanctioned solicitation.

### Ledger format

One row per finding:

```markdown
| ID | Severity | Confidence | Finding (one sentence) | Command executed | Captured output (excerpt) | Competitor baseline (if any) |
|----|----------|------------|------------------------|------------------|---------------------------|------------------------------|
| F1 | S0       | confirmed  | …                      | `…`              | `…`                       | …                            |
| F2 | S1       | unverified | …                      | `…`              | `…`                       | …                            |
```

Severity scale:

| Tag | Meaning | Examples |
|---|---|---|
| S0 | Reject-grade. Broken install, security exposure, dishonest public claim | install command exits non-zero; secret in tree; claim contradicted by measurement |
| S1 | Adoption-blocking. Works but an evaluator walks away | first-run latency measured over budget; core command errors on documented input |
| S2 | Credibility-eroding. Survivable but signals neglect | stale reference; dead script target; doc/code drift |
| S3 | Cosmetic / observation | naming, prose nits |

### Coverage rows — a coverage claim is evidence-bound like a finding

*(Protocol fix from calibration cycle 2026-07-c1 — the first canary was
missed because sweep coverage was self-attested: the ledger claimed
"measured and did not break" over a surface no command had touched.)*

The ledger MUST close with one **coverage row per swept surface**
(surface · command executed · output excerpt). A surface with no command
behind it is recorded as `UNSWEPT` — unswept is not passed. An `UNSWEPT`
first-priority surface voids any "nothing found" conclusion for that
surface. "Checked X" without its command is discarded exactly like a
finding without one (§ 2.4 applied to coverage, not only to findings).

### Severity is carried, never used to decide what to report

```
EVERY FINDING CARRIES A SEVERITY. FILTERING HAPPENS IN A SEPARATE PASS,
AFTER THE LEDGER IS COMPLETE — NEVER INSIDE THE REVIEW.
NEVER INSTRUCT A REVIEWER TO PRE-FILTER BY SEVERITY.
```

The failure this forbids is specific and it is not laziness. An instruction to
"only report high and above" is followed **literally**: the reviewer
investigates fully, finds the defects, and then declines to report the ones
below the bar. Precision rises, recall appears to collapse, and the regression
reads as a capability problem in the reviewer rather than as an instruction
defect in the prompt. The findings were found. They were withheld.

So the two operations are separated: the review produces every finding it has,
each tagged S0–S3; whoever consumes the ledger filters it. A consumer that wants
only S0 and S1 slices the ledger — it does not ask for a shorter review.

**Swept 2026-08-06, and the first sweep was wrong.** A keyword grep over 14
judge and review skills plus 12 review and judge commands returned zero, and a
full read of the same surface returned **six**. The defect does not announce
itself with the words a grep looks for — the live instances read *"surface only
the trade-offs the user needs to decide"*, *"top concerns"*, *"not every minor
gap"*, and *"prioritized fix recommendations"*. All six are fixed; the worst sat
in `adversarial-review`, which `self_review_gate.ts` loads as the system prompt
for this package's own CI self-review, so it was suppressing findings on every
pull request.

Two lessons, and the second is the reusable one: a phrase like *"top concerns"*
does the defect's work without any of its vocabulary, and **a keyword grep is
evidence of absence only for the keywords.** Distinguish the three shapes when
sweeping — a genuine pre-filter tells the reviewer not to REPORT what it found;
a scope limit tells it what to LOOK at; an ordering instruction tells it what to
put first. Only the first is the defect, and mistaking a scope limit for one
would strip the lane-keeping that makes a multi-judge panel work.

### Confidence is a separate field, and an unconfirmed finding is preserved

```
AN UNCONFIRMED HIGH-SEVERITY FINDING IS TAGGED, NEVER DROPPED.
CONFIDENCE IS NOT SEVERITY. A CONFIDENT NOTE AND AN UNCERTAIN BREACH
ARE DIFFERENT FACTS AND MUST NOT COLLAPSE INTO ONE COLUMN.
```

Severity says *how bad if real*. Confidence says *how sure it is real*. Folding
them produces the worst available default — a possible S0 downgraded to S2
because the reviewer was unsure, which loses exactly the finding a human most
needs to see.

The ledger row therefore carries `Confidence` beside `Severity`
(`confirmed | plausible | unverified`), and an S0 or S1 the reviewer could not
confirm ships **as S0/S1, tagged `unverified`**, with what it would take to
settle it. Dropping it is not available: an unverified breach is a question for
the human, and the reviewer's uncertainty is not authority to answer it.

### Rubric shape — scope, do-not-flag, and what a gate already owns

**Status: adopted for new and touched rubrics, not yet true of the estate.**
Measured 2026-08-06 across the seven judge skills: zero carry a per-check scope
column, one carries partial do-not-flag prose, none carries the gate-owned
exclusion. Stating it as *every rubric carries* would be a mandate with no
compliant instance — the shape this contract's own § 2 forbids. So it binds a
rubric the moment it is authored or edited, and the retrofit is opportunistic,
for the same reason the primary-bias retrofit is: a batch edit across the judge
cluster lands without attention and trips the byte-stability gate.

A per-check rubric carries three things:

1. **A scope column** — what this check looks at. A check with no stated scope
   expands to fill the reviewer's imagination.
2. **A do-not-flag list** — the near-misses this check must stay silent on,
   named. This is the false-positive-fatigue control the question surface
   already fights for, applied to the review surface: a reviewer that flags
   everything is filtered out entirely, which costs more recall than any
   pre-filter would have.
3. **A closing instruction not to report what a deterministic gate already
   owns.** If a lint fails the build on it, a review finding about it is noise
   that competes for attention with the findings nothing else catches.

## § 4 — Solicitation template (ready to paste)

This template **replaces** the prompt previously used to solicit /120 chat
reviews. It is the only sanctioned solicitation; the old prompt must not
survive alongside it.

```text
You are evaluating a software package as a skeptical external evaluator
deciding whether to REJECT it. You have no prior context on this package
and you must not ask me for any — no history, no prior reviews, no scores.

Package: <registry name / install command>

Your objective: find the fastest credible reasons to reject this package.

Rules:
1. CONSUMER SEAT FIRST. Install it from the registry into an empty
   project. Record everything about the first five minutes — install
   friction, latency, surface size, broken or misleading output — BEFORE
   you look at the source checkout.
2. MEASURE, don't read. A finding without an executed command and its
   captured output will be discarded. Cite the command and the output for
   every finding.
3. COMPETITOR BASELINE. Clone and measure at least 3 competing packages
   on the same metrics (install size, first-run latency, command surface,
   docs honesty), and do one fresh sweep for new entrants. Report my
   numbers next to theirs.
4. OUTPUT FORMAT: a findings ledger only — one row per finding with
   ID, severity (S0 reject-grade / S1 adoption-blocking / S2
   credibility-eroding / S3 cosmetic), CONFIDENCE (confirmed / plausible /
   unverified, and it is NOT severity — an S0 you could not confirm stays an
   S0 tagged `unverified`, never a downgrade), the finding in one sentence,
   the command you executed, the captured output, and the competitor baseline
   where relevant. Report every finding you have; do not filter by severity —
   whoever reads the ledger does that.
5. DO NOT produce a numeric score of any kind. If you have no
   reject-grade findings, state exactly what you measured and failed to
   break. Praise is not output.
```

## § 5 — Findings → work routing

Every **S0/S1** finding from a protocol review gets a recorded
disposition — one of:

- **fix now** — small and task-aligned; lands with its verification;
- **roadmap item** — routed into a new or existing roadmap under
  `agents/roadmaps/` via the normal flow;
- **rejected with reason** — one recorded sentence naming why the finding
  does not hold (measurement error, accepted trade-off with citation).

Dispositions are appended to the review's ledger artifact (§ 7). S2/S3
findings MAY be batched into a hygiene item; they never require individual
dispositions. No new machinery: the routing reuses the roadmap flow.

## § 6 — Canary calibration: review the reviewer

The only way to know the watchdog still bites is to plant something it
must find. This is the package-side mechanism; a consumer-facing canary
skill is explicitly deferred (E-pack, post-launch).

### Procedure

- **Cadence:** biannual (solo-maintainer calibrated; quarterly was
  council-rejected as unsustainable).
- **The plant:** exactly one defect per cycle, drawn from a **rotating
  class** — vulnerable dependency pin · dead script target · oversized
  artifact · stale reference · slow path. A class is not reused until all
  five have rotated through.
- **Where:** a SHORT-LIVED branch created for the cycle. The canary is
  committed only there.
- **Sealed planting record:** the planting facts (class, file, exact
  defect, plant date, cycle id) are fixed at plant time but the plaintext
  record is written to `agents/evidence/reviews/canary/` **only after the
  review returns its findings** — while the review runs, no plaintext
  record may exist in any tree the reviewer could reach (council
  refinement 2026-07-27: a record anywhere in reachable storage is a side
  channel; if tamper-evidence is needed before the verdict, store an
  encrypted or hash-committed form only). The reviewer must have no access
  to the planting facts by any path.
- **Never ships:** the canary is reverted before any merge. A canary MUST
  NOT be able to reach `main` — the cycle branch is deleted after the
  verdict is recorded. This rule is absolute; no review outcome changes it.

### Consequence rule

A review that misses its canary means **the review process failed — not
the reviewer**. Consequence: a root-cause entry (which mandate leaked?
which seat was skipped?) plus a protocol fix in this contract BEFORE the
next cycle runs.

**Escape hatch:** a review that surfaces **≥ 3 genuine high-severity
(S0/S1) non-canary findings** is not failed by a canary miss — a reviewer
that found three real reject-grade defects did its job; the canary simply
lost the race.

### Cycle record

Each cycle produces one artifact under `agents/evidence/reviews/canary/`:
the planting record (sealed section), the review's findings ledger, the
catch/miss verdict, and — on a miss — the RCA and the protocol fix. The
first completed cycle is this contract's proof-of-life; until one exists
the protocol is prose.

### § 6b — The gate surface runs under the same contract

The reviewer above is a human (or a model) reading a diff. The package's
**deterministic gates** need the same calibration for the same reason: a
gate's exit code is its own testimony, and a 2026-07-29 sweep found
fourteen gates certifying corpora they never read. Coverage
(`check_gate_coverage`) proves a gate READ something; only a planted
defect proves it can still FAIL.

**Inherited verbatim:** the biannual cadence, the sealed-record rule, the
ledger artifact under `agents/evidence/reviews/canary/`, and — absolutely
— **never ships**. The runner
(`./scripts-run src/scripts/check_gate_coverage --canary`) creates each
plant, runs the gate, and deletes the plant in a `finally`, including any
directory it had to create. It is deliberately kept OFF the default CI
path: it mutates the working tree, so it is an operator-invoked
experiment, never a per-PR gate.

**What differs, and why.** The rotating class list above (vulnerable
dependency pin · dead script target · oversized artifact · stale
reference · slow path) is calibrated to what a *reviewer* should notice. A
gate canary plants what one *specific gate* is built to reject, so its
`class` names the gate-surface defect kind — `oversized-artifact`,
`stale-reference`, `dead-target`, `orphan-artifact`,
`malformed-frontmatter`. Two of those coincide with the review list; the
rest would be dishonest to force into it. And it is **one plant per gate,
not one per cycle**: the review canary calibrates one reviewer, the gate
canary calibrates N independent gates, and rotating a single class across
them would leave most of the surface untested for years.

**Consequence rule, restated for gates.** A gate that stays GREEN over its
planted defect is dead by definition, and its ledger row is a defect
ticket — the same "the process failed, not the reviewer" stance. There is
no escape hatch here: a deterministic gate has no competing real findings
it could have found instead.

**Cross-check.** The ledger is compared against
`agents/evidence/reports/gate-scope-census.md`, which records what each
gate reads. Each artifact alone is satisfiable by a broken gate; together
they are not. Two disagreements are reported, and either fails the run:

- **`dead_gate`** — the census records a live, non-empty corpus, but the
  canary could not make the gate fail.
- **`census_stale`** — the canary made the gate fail, so it demonstrably
  reads a live corpus, but the census records no units for it.

**Coverage is stated, never implied.** The ledger prints the gate-script
population, how many are listed in `src/config/gate-coverage.yml`, and how
many carry a recipe. Every gate outside the recipe count is reported
UNPROVEN — a gap, not a pass.

## § 7 — Publish-regardless rule

**Every external score, scan result, registry rating, and dogfood delta is
published with the same prominence regardless of outcome.** Burying a bad
result rebuilds the false-confidence machine this contract exists to
dismantle. The evaluator page (`road-to-credible-install` Phase 4) is the
publication surface and MUST cite this rule; external score recording
folds into that page rather than a parallel surface. A result that cannot
be published verbatim (e.g. embargoed security detail) is published as an
entry with a redaction note — the existence of the result is never hidden.

## § 8 — Review artifacts

Protocol review outputs live under `agents/evidence/reviews/`:

```text
agents/evidence/reviews/
  <YYYY-MM>-<source>.md        # findings ledger + dispositions (§ 5)
  canary/<cycle-id>.md         # planting record + verdict + RCA (§ 6)
```

## See also

- `road-to-credible-install` Phase 6 — the standing containerized
  outside-in gate (deterministic first-five-minutes checks; kills R1/R2).
- [`docs/enforcement-by-host.md`](../enforcement-by-host.md) — enforcement
  vocabulary, including the ladder glossary recorded alongside the
  coverage taxonomy.
- [`ADR-127`](../decisions/ADR-127-enforcement-claims-must-resolve.md) —
  enforcement claims must resolve; the same honesty posture this protocol
  applies to reviews.
- [`adversarial-review`](../../src/skills/adversarial-review/SKILL.md) —
  the in-session critique skill; it remains for ad-hoc use but does NOT
  substitute for a protocol review (it runs inside a contaminated
  context by construction).
