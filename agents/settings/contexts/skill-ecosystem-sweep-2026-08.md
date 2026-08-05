# Skill-ecosystem sweep — durable record (2026-08-05)

Durable home for the conclusions of a 40-source deep-dive of third-party
agent-skill suites. The roadmaps that act on it (`road-to-skill-ecosystem-*`)
are transient; these conclusions must outlive them. Sources are anonymized per
[`source-confidentiality`](../../../src/rules/source-confidentiality.md); real
links are retained as `ENC1:` tokens in § Provenance and recoverable via
`src/scripts/_lib/link_crypto.ts decrypt`.

## Method

Every source was read at tree level (full recursive file listing via the host
API), then at file level: skill frontmatter, executable scripts, JSON schemas,
CI workflows, eval harnesses, corpora, and prompt shapes. README-only reading
was treated as a failed analysis per
[`external-reference-deep-dive`](../../../src/rules/external-reference-deep-dive.md).
Roughly 200 discrete mechanisms were catalogued, each with a stated native form,
a cited file path, the gap it closes, a target form in this suite, and one
verdict: `ADOPT` · `ADAPT` · `REJECT` · `ALREADY` · plus the refusal classes
`DOMAIN-GATE`, `LICENSE-BLOCK`, `ARCH-CONFLICT`, `POLICY-CHECK`,
`PLATFORM-NOT-PORTABLE`.

Every quotation observed the ≤15-word ceiling in
[`content-quoting-floor`](../../../src/rules/content-quoting-floor.md). No
source text was adapted; mechanisms marked for adoption are re-derived under
[`code-provenance`](../../../src/rules/code-provenance.md).

## Headline conclusion

**The valuable finding is not capability. It is verification infrastructure and
rule text.** The overwhelming majority of *content* across the forty sources is
already covered by this suite or was refused. What survived clusters into
measurement integrity, deterministic enforcement of rules this suite ships as
model-carried, and a small number of authoring disciplines with a named failure
behind each.

Three properties made a mechanism worth taking, and their absence explains most
refusals:

1. It closes a failure this suite has **already recorded from its own history**.
2. It is **deterministic** — a gate, a schema, a marker file — rather than an
   exhortation.
3. It arrives with its **failing baseline attached**, so the mechanism can be
   matched to an observed failure mode rather than a plausible one.

## Convergences — the load-bearing evidence

A mechanism invented independently by several sources is stronger evidence than
any single source's advocacy. Six such convergences were observed.

### C1 — Silence is not evidence (six independent sources)

A checker that inspected zero items must **fail**, not pass. A skipped item must
record a machine-readable reason from a closed vocabulary. A registered gate
returning a null result is a block, not a pass. Success is derived from a
completeness projection, never from zero-findings. One source additionally
prints the scanned denominator on the **green** path so coverage is auditable on
every run rather than only on failure.

This suite has recorded the same failure class at least four separate times from
its own history and fixed each instance individually without ever generalising
the rule. This is the single clearest adoption in the sweep.

### C2 — A rule as prose does little; the same rule as a forced artifact works

One source published the A/B: an identical obligation produced 0/4 compliance as
absent, 1/4 — **below control** — when added as mid-list prose, and 4/4 when
converted into a mandated verbatim line the run must emit *before* the
irreversible action, paired with a mechanical pre-send sweep for owed-but-missing
lines. Two further sources reached the same conclusion structurally, by making
their operating modes **marker files** rather than instructions, and by putting
obligations in a validator "where they cannot be talked out of firing".

This is decision-relevant here because three of this suite's own honest nulls
tested *reminder-shaped* interventions and measured no effect. Those results
stand. This is a different mechanism with an opposite measured result and its
failing baseline published first, so it does not reopen them — see
[`decision-revisit-gate`](../../../src/rules/decision-revisit-gate.md) on
mechanism-match.

### C3 — Progress, not count, is the principled stop

Three sources land on the same hierarchy: a no-progress or new-minimum stop is
the primary signal, and an iteration cap is the backstop. One argues explicitly
against inventing a time, iteration, cost or retry limit when a clear
no-progress stop is available, and its own audit refuses to flag the *absence*
of an arbitrary budget. Another pairs a hard cap with a ledger-based stall
detector and treats the cap as secondary. A third continues only while an
objective error count reaches a new minimum, stopping after two rounds without
improvement.

This suite's validation budget is count-primary. The convergence is a friendly
challenge to that ordering, not a case for removing the cap.

### C4 — Judge the artifact on disk, not the transcript

Four sources independently distrust the model's own narration: one gate reads
the plan file rather than the conversation; one treats the diff as ground truth
and the report as a set of claims to be re-verified; one grounds completion in a
receipt; one resolves tracked-file state from the index alone, because a
plausible-looking alternative query produces a false negative for exactly the
bug class the check exists for.

This suite requires fresh verification evidence but never states that the
evidence is a **file**, not a sentence.

### C5 — The suite's own artifacts are untrusted input

Five sources restate this for their own governed files. The sharpest formulation:
**auto-injection turns a governed file into a standing injection amplifier**,
because every tool call re-reads it. The mitigation observed is content
attestation — a hash stored beside the file, re-checked on every injection, with
refusal to inject an unattested body — plus the honest note that a delimiter
cannot defend against an attacker who can write the file, so attestation is the
actual control.

This is a hard precondition on any future mechanism here that auto-injects a
tracked artifact into the context.

### C6 — Verify that a delegated worker did the expensive thing

Three sources solve this three ways: recording the human-approved method into
every fan-out job and rejecting a family mismatch at the recording step, with an
identifier round-trip from dispatch to result; proving a delegated agent invoked
its tool by finding a fresh artifact in a scope-keyed directory and verifying its
magic bytes; and mandating a clean-context reviewer that never receives
production rationale. All three target the same failure: under pressure a worker
substitutes the cheap path, and the parent cannot tell from a filename or an exit
code.

This suite's subagent contract states that returns are never adopted unverified
and supplies no mechanism for **provenance** conformance.

## Refusals — recorded so they are not relitigated

| Class | What was refused | Governing rule |
|---|---|---|
| `DOMAIN-GATE` | Four verticals: GPU/ML-infra, scientific computing, crypto/blockchain/binary analysis, regulated medical-device conformity. In two cases the CI-tooling gate is not merely unmet but physically unmeetable (no accelerator in CI; per-artifact throwaway interpreter environments with pinned scientific wheels). | [`domain-adoption-policy`](../../../src/rules/domain-adoption-policy.md) |
| `DOMAIN-GATE` (open question) | Channel-execution marketing (paid-ads economics, technical and answer-engine SEO, email deliverability, creator programs, social operations). Verified genuinely uncovered here — a keyword sweep over the whole authored tree returned zero files for eleven of twelve probe terms. Unlike the four above, the CI-tooling gate is satisfiable, so the blocking gate is demand signal plus a named maintenance owner. | [`domain-adoption-policy`](../../../src/rules/domain-adoption-policy.md) |
| `POLICY-CHECK` | A cluster generating a named real person's likeness from a title plus a user photo, with no consent, rights, or disclosure check; and its siblings (face swap, lip-sync drive, motion drive, persistent-identity training). Adopt nothing; retain as a red-team fixture for the media policies. | [`image-likeness-and-rights`](../../../src/rules/image-likeness-and-rights.md), [`media-governance-routing`](../../../src/rules/media-governance-routing.md) |
| `LICENSE-BLOCK` | One copyleft ShareAlike source (prose adaptation would propagate copyleft into this tree — mechanism re-derivation only); one GPL platform (ideas only, zero code); one permissive-plus-corporate-commercial-restriction platform with a branding lock (a company-consumed package cannot vendor it); one component library carrying a no-competing-product clause and a named-attribution requirement on derivative themes. | [`code-provenance`](../../../src/rules/code-provenance.md), [`source-confidentiality`](../../../src/rules/source-confidentiality.md) |
| `ARCH-CONFLICT` | Three duplicated size tiers of every rule set (a lossy-copy architecture this suite deliberately eliminated); an N² pairwise conflict matrix (unmaintainable at this artifact count); entry files of 46–52 KB. | [`preservation-guard`](../../../src/rules/preservation-guard.md), [`size-enforcement`](../../../src/rules/size-enforcement.md) |
| `PLATFORM-NOT-PORTABLE` | Two full products (a collaborative-editing knowledge platform; a canvas workflow platform). One portable idea was extracted from each rather than the architecture. | — |
| `REJECT` (sprawl) | Four aggregator catalogues (848, 326, 257 and 120 artifacts). One counts 257 vendored third-party artifacts as its own total. These are the counter-example this suite's size and overlap gates exist to prevent, and are cited as such. | [`size-enforcement`](../../../src/rules/size-enforcement.md) |

## Negative evidence — anti-patterns observed in the wild

Recorded because they justify existing gates here that occasionally look
excessive:

- A generated per-entity body whose prose is **identical across entities** while
  passing structural validation — coverage in shape only.
- A `deprecated` redirect stub occupying a live activation slot, competing in the
  router and spending description budget.
- The same artifact published at three paths within one repository.
- A self-assessed 0–10 score with **no evidence-coverage gate**, one source away
  from another source's explicit not-scored discipline that exists to prevent
  exactly that.
- A headline benchmark image with no harness, no cases, no methodology, and no
  numbers file.
- A hand-copied multi-host projection with no generator and no drift gate, whose
  manifest still advertises an artifact count from two versions earlier.
- Prose counts disagreeing four ways within one repository while the same numbers
  derived by its generator could not drift.

## Two contradictions with locked decisions here

Recorded, not resolved. Both are `decision-revisit-gate` triggers and are
surfaced to the maintainer rather than acted on.

### R1 — Declared size bands versus published measurement

A published study (84 tasks, 7,308 trajectories) tiers instruction-file size by
measured effect: compact and mid-size bands both help substantially, the band
above roughly 2,500 tokens approaches diminishing returns, and above ~5,000
tokens performance measurably degrades. The same source measures real
tokenisation and ships character-division only as a secondary reference number.

This suite's declared `rich` class spans exactly the diminishing-returns band and
is justified in rule text as a deliberate quality investment. Its budget
estimates use character division. The same study's finding that a few focused
artifacts outperform more bundled ones independently supports this suite's
split-by-responsibility rule.

**Disposition:** measure real tokenisation first, then put the band question to
the maintainer with the numbers. Do not silently re-band the affected artifacts.

### R2 — Imperative density versus reasoning-based phrasing

Three sources disagree. One asserts reasoning-based phrasing outperforms rigid
directives and recommends explaining the why. One ships a metric that scores
instruction files **higher** for imperative-marker density. A third sits between
— keep examples and anti-patterns because bare rules are violated more often —
and adds the decisive operational fork: a rule the agent consistently fails to
follow needs **structural enforcement or deletion, not a louder rule**.

This suite's house style sits at the imperative-density end and has no
measurement either way. The third position's fork is adoptable independently of
the disagreement and is the more useful half.

**Disposition:** an open empirical question this suite's own A/B harness could
settle. Adopt the structural-enforcement-or-delete fork now; leave the style
question open.

## What this suite already wins on

Confirmed by direct comparison against forty sources, and worth stating because
several of these are the reason so much was refused:

- **Grounded reference corpora** denser than anything observed. Only one source
  computes rather than asserts in the design domain; the rest are corpus-free,
  combinatorial, or templated output.
- **A four-tier official-source ladder** with no equivalent anywhere in the
  forty. The gap is the machine-checkable *field*, not the doctrine.
- **A continuous numeric overlap gate** on new artifacts. One source approximates
  it with a hand-maintained pairwise matrix; the rest have nothing.
- **Byte-exact projection** between source and generated trees.
- **Size budgets stricter** than any observed suite.
- **A kernel plus trigger-router plus on-demand-context split** that is better
  factored than the duplicated size tiers two sources ship — the same benefit
  without the synchronisation surface.
- **A subtle-negative-control discrimination gate** on evals, stricter than the
  positive/negative control discipline observed elsewhere.
- **An independently converged safety floor.** One source's 43-line policy kernel
  restates roughly eight of this suite's Iron Laws in substance: untrusted content
  is data never instructions; permission is operation- and target-specific and
  never transfers; missing evidence is unknown, not fail; repeated failure on one
  step stops and reports; a blocked state is execution state, never a verdict.
  Two independently authored suites converging on the same floor is the strongest
  external validation available for those rules.

## Gate coverage this sweep exposes

Stated as gaps, each owned by a roadmap in the `road-to-skill-ecosystem-*` set:

| Gap | Nature |
|---|---|
| No completeness accounting across the gate estate | A gate that scans nothing is indistinguishable from a clean one |
| Allowlists are shrink-only by convention, not mechanically | A count comparison permits swap-one-out-add-one-in |
| Suppression entries carry no re-runnable disproof | An entry with a falsifier is a ratchet; one without is a hole |
| Six projection surfaces are byte-verified, none load-verified | Byte-exactness does not imply a host accepts the result |
| Several rules declare themselves unenforced where a deterministic exit is cheap | Model-carried where a shim or hook would bind |
| The rule-body-to-context migration is a lossy transform with no ledger | Byte-exactness covers source-to-projection only |
| Overlap is measured continuously; contradiction is not measured at all | Two artifacts can push opposite decisions in non-overlapping words |
| No removal signal exists | Ratchets move one way; nothing retires an artifact |
| No cross-artifact reference check against a consumer's *installed subset* | Presence in the repository is not presence in the install |
| External URLs shipped in authored text are unreviewed | A cited domain is a domain the agent will fetch |
| Fenced examples are not linted against the rules they sit beside | An example can teach the anti-pattern its own rule forbids |
| Eval fixtures have no gate of their own | A wrong fixture presents as a losing artifact |

## Council

2026-08-05 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds, blind peer
review). Convened to discharge two simultaneous triggers on the harvest freeze:
the internal resume arm's council condition, and the periodic cadence review that
a minor release had made due. Convergence inlined here per
[`no-roadmap-references`](../../../src/rules/no-roadmap-references.md).

**Convergent, both members:**

- The freeze **lifts with a narrower successor constraint**, not wholesale and not
  by extension. Both selected the same option independently.
- The sweep is a reason to lift **selectively, for verification infrastructure**.
  Both grounded this on the same evidence: the top findings close failures already
  paid for rather than adding features, and verification work reduces future
  maintenance burden rather than enlarging the surface.
- The **greater risk is not lifting** for verification. Stated most sharply as:
  refusing to fix known repeated failures for procedural reasons wastes the sweep
  and damages the incentive to measure failures at all.
- **Sequencing: open executable roadmaps now.** Both refused the parked-everything
  option as a middle-ground fallacy — either the work justifies execution or it
  does not justify the authoring cost — and refused analysis-only as paying the
  sweep's cost while capturing none of its value.
- **Amendments C and D are insufficient for capability.** Both agreed the
  latent-risk door aligns with defect closure rather than capability addition.

**Divergent, and how it was resolved:**

- **Concurrency shape.** The majority position was two verification slots with
  capability capped at zero; the minority proposed one verification plus one
  capability slot gated on demand evidence. Resolved to the majority, because the
  capability arm's own gate is unmet, so a capability slot would open work with no
  evidence behind it.
- **Whether Amendment D's incompatibility is a defect or intent.** The majority
  held it a construction defect, on the grounds that the freeze's own framing names
  adoption as the binding constraint and never bans capability. The minority held
  the amendment adaptable. Resolved to the majority, with the repair being a
  separate capability arm rather than a patch to the amendment — a
  skipped-or-pending test for not-yet-existing code was explicitly rejected as
  indistinguishable from wishful thinking.

**Raised by the council and adopted, not present in the question:**

- **Mechanical enforcement of the cap.** A single maintainer can intend a two-slot
  limit and drift to five under urgency. The cap therefore ships as a gate rather
  than a guideline.
- **The activity-versus-progress objection, made falsifiable.** The strongest
  argument against lifting was that verification work feels productive while doing
  nothing about the binding constraint, which is adoption. Recorded as a review
  trigger: verification shipping across two release cycles with adoption still at
  zero confirms the gap and reopens the constraint.
- **Elevation of the contradictory-mechanism case.** A mechanism that directly
  contradicts a locally measured failure should not be blocked by the freeze even
  when it looks capability-shaped — which is why reproducing an external
  contradiction locally became the second, internally-reachable arm.

Disposition recorded as
[`ADR-215`](../../../docs/decisions/ADR-215-harvest-freeze-verification-arm-lift.md).

## Provenance

Sources are referenced by neutral label throughout. Real links are encrypted;
recover with `./scripts-run src/scripts/_lib/link_crypto decrypt <token>`.

- **Source A** — `ENC1:4/w0DVCvHnNMB+wZvBQ7y7X0Fs6vGa96qmFtXh/RWXCF+xkKbs4xU5pRg3TRXgeFoEYMTs1k3pFORHfAntYTYA==`
- **Source B** — `ENC1:xGInUDayvUK0yQLr9Af4uUeqgfA67rwncl+T3QPWd3l9xZVGtqQOJaQz0O3/JhiIFLu0HGpEADFkTOIVchU6ww==`
- **Source C** — `ENC1:gJdvDMciswZMkLpbitIHFWdVTXO1GqJT3F2TtGSxJy5ph0h6sh3QSuMgBr3UAu+LSVwkCsVEBIKMMqtTZPFMzg==`
- **Source D** — `ENC1:Ij8S7glalCGXxmJneeoZfxxc2yZE/pBu1ft7TV6pF1jOJ51G54Nuq0UYHA9IIah++yjKmioElEgcOpjO/shg7Q==`
- **Source E** — `ENC1:I4Y8DWM0YaavUxBzOtqOy/70u1SThyTTgCVN1Qh/lLPdRX86SDm6bJwZeZx48lZwaYyWh2VKe4zliS/X+JO86A==`
- **Source F** — `ENC1:XpKYLUo3QrvOsWQvEbbWHRsW0G9vVefx2UO8npqTHei4i4wW/Yxu1KtOBUxjPi46rsu44CusqBlGrZYiwbD6LA==`
- **Source G** — `ENC1:j++Ixlsmfbzk3wCd1nxH6kuzspYiFTYcAEDlpZZitjm0eLlBTFrYVJ6qVvZj9Uve6AJR1PfYAhBe30eN+AEuIA==`
- **Source H** — `ENC1:1QaW6+iVWEyCrU4jsfKOrcUHLo+smdxKTLVa1mCanVu494ch1nt8nOEoUpDnvg06ONFXfYVFRtA3MH7IOXKQxA==`
- **Source I** — `ENC1:OO33vynpwtqStbEB0VaeTGx9rm3O93yntVZm51PCOAqVWDxlaYobZsgcqIjXri7zdP5TvUQ+2RW399vGJIa3SA==`
- **Source J** — `ENC1:jsdadObRkHKUZO01dN5tCyKov7LT7gMzGqrDeuPy+4roIOOQ9F5jRcstRnchzq6fvTWPpgYI+4/EmPKQkIqqag==`
- **Source K** — `ENC1:TVbuKRR0eYAXY8jEM/8pt1iQwaRaPCOo36q0YoHUWOiJapMZrFgZ80Tc4uayfRVKWGb0nGavgnUPJuYTiIuJ4Q==`
- **Source L** — `ENC1:8CrVwGkr7GxVzeMMgSIAkvw+WB/iXUOLX1U1mvQy6HMTI1tB8/Fn2wU5aJ2ZUqRM8UHmu6yVOi7oUsfK8jquNA==`
- **Source M** — `ENC1:ozyIQz1PLBFFajoLhuKm22c4Ag0cvAXxAeZYln4AQRMBy4wVAP0TYFHfQFCnzr2JuBH9CzJkHjUaoUJc6p1KUw==`
- **Source N** — `ENC1:nwmWKei8bul6g4xgeF0/js310kTlclD4npaSN290BJWnIdz174AN9pSozc5SqIQgNfcu84tyJk8Pej2KcMwigQ==`
- **Source O** — `ENC1:+cGDdj1QtEW87hlmqP+cMTN5hKDztb45YQr1zpx6tqdy3OPw9/8u0zq89YoE2IoOYh/CYuVfqHgjxGIRPfoszQ==`
- **Source P** — `ENC1:I9MI5dsR78f+e66BnxTIFfPuet2LT6On2jN6k9WTatyEB30YtM6jctI6TLp+jrqlBXHzsz0mDdhu9wB32u3JBA==`
- **Source Q** — `ENC1:0Jd6LMsUjprGZrQGycRkXUoZcNVjLJOoVm8Mp5UU29T2hw/VLtBn2taQExly2pFMAuG3oj7QLtc8qMw4ulZzoQ==`
- **Source R** — `ENC1:E5aA8P+yDEJ1gFe5tu1Oe5xl7YCVxXv1MyJT7GG0AssBkL7054NIk7BbukQjgbdDMIsykQaO/JJK1VGcHhovbg==`
- **Source S** — `ENC1:ELscUIjxHeuFpLEEZjeQlzVAlbAXjC7fupoHdE1Gweov8A+rWB5CjHgVFXIho2JE4qSt0uepfg1rH2/PlGPrcw==`
- **Source T** — `ENC1:2DaCmibgjDN0IxMmTytgl9lUlz0h6j2uy804qlhEZQQlBmxDnuZF3dfHwo99gXyJ7SCaru88h7DAm/ft0lEXXg==`
- **Source U** — `ENC1:EFJis7yvws7vC+FGJA4kr1/D+ODTFVg7vig4zWg9mKdEX2blHiL92SB+M2ymNU/i6Cvgj3M/M1o9HFEYfviifg==`
- **Source V** — `ENC1:UYtkCGg/2LFVXr273kQMSvXHfeI4ypPeQB2DegR5e46lztjUs6vxk9TbUIk4nYcnb+UR0LWN/pKpy6ugbxezwA==`
- **Source W** — `ENC1:10HkbUWPXHXGFdQp0fBQFwMRWOdz8L3L3WS5Na9EJjH+35eOYOryLEzgW1mdyllN5MB5VSRUGpXibiKPxMArNA==`
- **Source X** — `ENC1:rEDP/DodE+32iUMGRqVemGGt5TAMuPpRockQvi7taC/A3J4uBSoUweBE5v0D941W6FP36M72W8NKKWC6JU2+Aw==`
- **Source Y** — `ENC1:lG5lnhQ7ZHoj83+5eXRaPiv7sTOKmPJCbAyyw0c5Hr9zVjn8ejrTZx04WbO5cGDenP3lC5bmkoDCk31HqaqKzA==`
- **Source Z** — `ENC1:D/FiC/VX/1CL2TdUtBph9ACCc5izUO7OScfqW1enItHvlB2xAQFy7+VxDkNOuYbeGIThRlHv7orO4ZOaKtaSdg==`
- **Source AA** — `ENC1:WlopuaTwkGa3dRBFRiVh1dXtHl3pmoUzob0D1/CHE2n6x0AV6Wq6dejQWYDqBlNnMolNuXZK/JuQYBYPzIgalw==`
- **Source AB** — `ENC1:Lp/ea59Lgc5WJkrIfOMqCmReq9Mk8rG5oOj85YqQUAoaik5mlovLX3dfmeqYcjY/G9mTrQwmfh4Z9Er5AEB1xg==`
- **Source AC** — `ENC1:XPztMo2cQCrJ3Q1U/6oRm428IEWw264qa3iZgKiAgStbkG7bHqwFzBjBE2ZVCrG5f3K073kc1czliJTgMXk+VQ==`
- **Source AD** — `ENC1:z4qN3N0YrHm6Everu5stENVZDPZm5buraE5VqpV7jh5tO+RyHpWgvqEhSZcD0k24FnSEh2PpRuFYEVsSQ+EJWQ==`
- **Source AE** — `ENC1:TyjPtU0xzIZ5KqWEGtM9t1Y/VysyEtlHXklvP77tG+fKUGAJBtWIlv+vWCXNoDUYvSPMoYfIZXa8qbyef0iVXw==`
- **Source AF** — `ENC1:pm27oQ7NdcbR9CyykXvT1JkdpA3C+qi+M7AYjpmWn2GqJUcJz8vDrPAoDVb231TCQVyxzeZXcZI7mo1Wiq9MbA==`
- **Source AG** — `ENC1:3FTiuFVLBA6xMU6wT4oe+OnjgX5S57Ef+SCJ6FWjoToXWXjoqgcK8ZdG2/CA/NmG+Qrxg1j0LdA6B4Y/2vHErg==`
- **Source AH** — `ENC1:/RDyav8ZP4y/YxDfOgHSpkthFu8vgeQNs46cdk0cdJrGPFZMgJYu/HfhVroIY+2MTqQfHGiS3WC7JadSwjMtHg==`
- **Source AI** — `ENC1:ot+2/yqVpa05QJCZZun717mhsusT+vQW8uSfnH85QwY4a7CoTexdeD7KLhZ4dDaVD8pvhHmh4eeSpbhjzbJquQ==`
- **Source AJ** — `ENC1:36Ys6XrDRweRgC+Tr2NSW81hoJ4fLns2zT6MCOfEHabyOC2WfyYeN7cFwLNT2jyktVAwtz4oGHoYe0TuGTu0gA==`
- **Source AK** — `ENC1:S1hrUtQsFIjZZq1/JbISeVEHa9mZeAbJcVsdarge07r3Nv1Kl403iSTAL3Y4w7c/1yxt2tDfj0Djq/leWGSBhg==`
- **Source AL** — `ENC1:eDAPRL4zw6EpgIRXjg8M34xCvjErNHXYACw08mfpFEOucyb/n2PXrn3+jIcYfJ53r5O8kyXx+ux01AyPESBOww==`
- **Source AM** — `ENC1:ZTaaTBr5so9PQb8iwVs2wonOytKpZlosZuRFA6LtzSw8wNd5lxfmopcHfhgeJ/SqAcrrxzucYW9cxln4FBc2IA==`
- **Source AN** — `ENC1:ltJ1EDM1xFegicwIggCvuIXvaLSiK0WYYevvu14Eklzv7goagYXETWR45Fi7HSzanmumecPp50RAPh+s5Rheog==`
