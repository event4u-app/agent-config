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
   native format at projection time; the same governance rides on 7+ hosts with
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

## H1 options weighed

- **Option 1 — verifiability as frame.** *"Agent Config — every claim
  machine-checked, including 'zero runtime'."* Subline: 261 skills, 93 rules,
  7 hosts; run the proof page yourself; no daemon, no lock-in, no unverifiable
  promises.
- **Option 2 — architecture first.** *"Governed AI agents with zero runtime —
  and a proof page you verify in 30 seconds."*
- **Option 3 — host-agnostic.** *"Write your agent governance once — run it in
  7 hosts, with a proof page that can't lie."*

## Decision

**Adopted: Option 1** (verifiability as frame).

Council (claude-sonnet-4-5 + gpt-4o, 2026-07-04) split only on headline vs.
subline placement, and converged on the substance: the stateless / host-agnostic
/ no-runtime architecture is the technical moat, and the Claims-Ledger + proof
page is the maximally-uncopyable trust bootstrap. The decisive argument: in a
low-trust market, "zero runtime" on its own is just another unverifiable
promise — making **verifiability the frame** and the architectural claims *what
you verify* is what makes "zero runtime" credible. The maintainer made the final
call per the B0 "human picks" gate.

**Biggest risk (tracked):** "machine-checked" can read as compliance-boring
rather than a competitive weapon — mitigated by framing it offensively
("built to be checked, in a market that runs on unbacked headlines"), not
defensively.

## Applied to

- README H1 + hero line (this repo).
- `distribution/launch-story-draft.md` headline placeholder (resolved).
- `distribution/awesome-list-submission.md` (already Option-1-aligned).
