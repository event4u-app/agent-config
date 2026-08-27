# Positioning evidence & decision (B0)

> Market-readiness roadmap B0. The evidenced differentiators the positioning
> rests on, the H1 options that were weighed, and the decision. Every
> differentiator below is **shipped and machine-checked**, not aspirational —
> each names the artifact that backs it.

## The problem

External adoption is ≈0. The prior README H1 — *"Governed skills, rules & work
journeys for AI coding agents"* — was abstract and interchangeable: no single
uncopyable hook. This document fixes the one sentence that carries the
differentiator.

## Evidenced differentiators

1. **Machine-checked honest marketing (the Claims-Ledger).** Every public claim
   that carries a `<!-- claim:ID -->` marker must bind to a resolvable evidence
   pointer in [`CLAIMS.md`](CLAIMS.md), or CI fails. Unbacked claims are logged
   as visible debt rather than hidden. Evidence:
   [`src/scripts/check_claims.ts`](../src/scripts/check_claims.ts),
   [`CLAIMS.md`](CLAIMS.md).
2. **A self-verifying proof page.** [`proof.md`](proof.md) is generated from the
   ledger (claim → evidence table) plus the honest-null benchmark runs
   (*including the nulls*) plus a "verify it yourself" command block a skeptic
   runs on a fresh checkout. Drift-gated in CI. Evidence:
   [`src/scripts/build_proof.ts`](../src/scripts/build_proof.ts),
   [`proof.md`](proof.md).
3. **Published honest-nulls.** Measured null results ship rather than hide (e.g.
   a recursive-verification wrapper measured for null lift; an orchestration
   auto-flip held at a documented honest-null). Evidence:
   [`benchmark.md`](benchmark.md).
4. **No-runtime, host-agnostic governance.** Rules compile into each tool's
   native format at projection time; the same governance rides on 20 hosts with
   no daemon. Surgical uninstall (JSON-pointer + SHA-256, never a neighbour
   tool's keys). Evidence:
   [`contracts/no-runtime-boundary.md`](contracts/no-runtime-boundary.md),
   [`contracts/install-layout.md`](contracts/install-layout.md).
5. **A 30-second wedge.** `production-validator` — a single self-contained Claude
   Code subagent (one `curl` into `.claude/agents/`) that runs the last gate
   before "done": no mock/stub on the shipped path, validated against real
   systems. Evidence: [`wedge/production-validator/`](wedge/production-validator/).

## Competitive frame

The dominant competitor wins on reach behind a loud, **unbacked** headline
performance number (present in several files, no reproducible methodology). The
only defensible, uncopyable inverse is **reproducible honesty**: they cannot
adopt a Claims-Ledger + proof page without exposing their own unbacked numbers.
"Honesty" alone can read as merely defensive, so the wedge and the governed
depth carry the offensive substance.

## H1 options weighed — the 2026-07-04 record

> **Historical.** This section records what was weighed on 2026-07-04 and is
> kept because a decision whose alternatives are deleted cannot be reviewed. Two
> of the three options below rested their headline on the **runtime-absence
> claim**, whose exact wording is deliberately not reproduced here: it was
> retired on 2026-08-27 under ADR-249, and a live public document should not
> republish a retired assertion even as a quotation. The original wording is in
> this file's git history and in `docs/CLAIMS.md`'s `no-runtime-daemon` entry,
> which is preserved at `status: withdrawn` rather than deleted. The corpus
> figures below are likewise a July snapshot, correct as of that date — the live
> counts are the README badges, re-derived by `update_counts --check`.

- **Option 1 — verifiability as frame.** Headline: every claim machine-checked,
  with the runtime-absence claim named as its worked example. Subline: 261
  skills, 93 rules, 7 hosts; run the proof page yourself; no lock-in, no
  unverifiable promises.
- **Option 2 — architecture first.** Headline led with the runtime-absence claim
  itself, plus a proof page you verify in 30 seconds.
- **Option 3 — host-agnostic.** *"Write your agent governance once — run it in
  7 hosts, with a proof page that can't lie."*

## Decision

**Adopted: Option 1** (verifiability as frame).

Council (claude-sonnet-4-5 + gpt-4o, 2026-07-04) split only on headline vs.
subline placement, and converged on the substance: the stateless / host-agnostic
architecture is the technical moat, and the Claims-Ledger + proof page is the
maximally-uncopyable trust bootstrap. The decisive argument: in a low-trust
market, an architectural claim on its own is just another unverifiable promise —
making **verifiability the frame** and the architectural claims *what you
verify* is what makes any of them credible. The maintainer made the final call
per the B0 "human picks" gate.

### The frame survived its own object being retired — 2026-08-27

The argument above is unchanged and this section is the evidence for that, not a
caveat on it. What changed is **which** architectural claim it points at.

The runtime-absence claim was the worked example the July decision used. On
2026-08-27 the owner reversed the doctrine and ADR-249 replaced it: **resident
processes are permitted only under the supervision contract that record
establishes.** That is the constraint this repository adopted, stated as a rule
it holds itself to. It is deliberately **not** a statement that anything is
currently supervised, bounded, isolated or reliable — no supervised process has
shipped, and `docs/CLAIMS.md`'s successor entry is `unbacked` precisely so that
it may not be markered in public prose until lifecycle evidence exists.

That is the frame doing its job. A positioning built on *"trust this specific
architectural property"* would have needed rewriting from the ground up when the
property was withdrawn. A positioning built on *"every claim here is bound to
evidence or it fails the build"* survived, because the mechanism that retired
the claim — a ledger status, a regenerated proof page, a failing check on a
stale marker — **is the differentiator itself**. The claim's own retirement is
machine-checked: `check_claims` fails the build if the README still carries a
marker for a claim the ledger no longer backs, which is how the README line was
found and removed rather than left to rot.

**Biggest risk (tracked):** "machine-checked" can read as compliance-boring
rather than a competitive weapon — mitigated by framing it offensively
("built to be checked, in a market that runs on unbacked headlines"), not
defensively.

## Applied to

- README H1 + hero line (this repo).
- `distribution/launch-story-draft.md` headline placeholder (resolved).
- `distribution/awesome-list-submission.md` (already Option-1-aligned).
