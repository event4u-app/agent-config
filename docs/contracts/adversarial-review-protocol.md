---
stability: beta
keep-beta-until: 2026-08-27
---

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
| ID | Severity | Finding (one sentence) | Command executed | Captured output (excerpt) | Competitor baseline (if any) |
|----|----------|------------------------|------------------|---------------------------|------------------------------|
| F1 | S0       | …                      | `…`              | `…`                       | …                            |
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
   credibility-eroding / S3 cosmetic), the finding in one sentence, the
   command you executed, the captured output, and the competitor baseline
   where relevant.
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
