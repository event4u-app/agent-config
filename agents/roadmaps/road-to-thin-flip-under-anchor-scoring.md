---
status: ready
complexity: moderate
---

# Road to a Thin Flip Under Anchor-Scoring

**Goal.** Decide the thin-projection flip on evidence a deterministic instrument
can produce — or record a second, honest negative.

**Why.** The thin projector is the largest single token lever the package has
(measured 81.6% of the rule layer). Two paired-judge attempts failed to resolve
it: the 2026-07-11 run returned 36.2% against a 48% floor with a 60% length
confound, and the 2026-07-12 length-neutral rerun was inconclusive at κ=0.46.
Phase H1 of the human-measurement track is CANCELLED on a falsified precondition
and stays that way. ADR-202 replaces the instrument rather than the sample:
deterministic anchor-scoring against `must_include` / `must_not`.

**Not a resumption.** This roadmap is a new mechanism with its own gates. It does
not reopen H1, and a green result here does not inherit H1's authorizations —
the flip decision is made here, from this evidence, or not at all.

## The three gates

The flip is authorized only when all three pass, in order. A failure at any gate
stops the sequence; it does not downgrade to a partial flip.

| # | Gate | Passes when |
|---|---|---|
| 1 | **Scoring pass** | Zero `must_not` regressions across the frozen corpus, AND `rate_thin ≥ rate_eager − δ` on `must_include`, AND no single rule below the per-rule floor |
| 2 | **Host canary** | The demoted-rule canary fires on every supported host and surfaces the router pointer, not the body sentinel |
| 3 | **essential decoupling** | The essential-baseline measurement is settled as an independent question, not as a condition on this flip |

## Phase 1 — Scoring pass

Blocked on the golden set landing (PR #1057) and on the runner existing.

- [ ] Build the anchor-scoring runner: both arms over the completed corpus,
  deterministic evaluation against `must_include` / `must_not`, output in the
  `quality-run.json` schema with `judge_model: "anchor-scoring"`.
- [ ] Ship the falsification suite in the same PR (ADR-202 § Scorer
  falsification): known-bad and known-good fixtures, a mutation test over the
  anchor evaluation where every mutant must be killed, and a null-scorer guard.
- [ ] Generate both arms once and **freeze the transcript**. State the cost
  before the run.
- [ ] Derive δ and the per-rule floor from the frozen corpus's observed spread
  and write both into ADR-202 — before any anchor is scored.
- [ ] Score the frozen corpus. Record the result either way.

## Phase 2 — Host canary

Blocked on Phase 1 passing. The scaffold already exists and is green mechanically
(`probe_host_compliance`: pointer, body-removed, hint, link all true); what is
missing is the live leg, which is operator-run by design.

- [ ] Set `lean_projection.mode: thin`, run `task generate-tools && task sync`,
  install the projected canary into each supported host.
- [ ] Invoke the canary keyword per host. PASS = the rule fires AND the host
  surfaces the router pointer; FAIL = the host surfaces the body sentinel, which
  means thin projection is a no-op there.
- [ ] Record the per-host result. A single FAIL blocks the flip for that host and
  is escalated to the host vendor, not worked around.

## Phase 3 — essential decoupling

- [ ] Record the essential-baseline measurement as an independent open question,
  with its own justification, and remove it as a precondition on this flip. The
  2026-07-29 council was explicit that the legitimate move is to DECOUPLE it,
  never to waive it — the gates exist to force honest measurement, not to protect
  users.

## Phase 4 — The decision

- [ ] With all three gates recorded, decide the flip. A green scoring pass is
  evidence, not authorization; the rollout shape stays a Hard-Floor decision.
- [ ] If any gate fails: record the negative in `docs/benchmark.md`, leave
  `lean_projection.mode: eager-all` as the shipped default, and close this
  roadmap. A second honest negative is a result, not a failure of the roadmap.

## Acceptance criteria

- [ ] Anchor-scoring runner + falsification suite landed, mutants all killed.
- [ ] δ and per-rule floor recorded in ADR-202 before scoring.
- [ ] Scoring pass result recorded, green or red.
- [ ] Host-canary table filled for every supported host, or the sequence stopped
  earlier with the reason recorded.
- [ ] essential-baseline decoupled and tracked separately.
- [ ] Flip decided and recorded — including the branch where it is decided
  against.

## See also

- `docs/decisions/ADR-202-anchor-scoring-as-thin-quality-instrument.md` — the
  instrument, the registered threshold, the falsification contract.
- `docs/benchmark.md` § Length-neutral judge RERUN — why paired judging closed.
- `internal/bench/corpora/TOKEN-QUALITY-GOLDEN-SCHEMA.md` — the corpus the
  scorer consumes.
