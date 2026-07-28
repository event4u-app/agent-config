# Evaluator pack (E1–E5) — deferral note + E3 re-test design

> Durable deferral record from the road-to-self-critical roadmap
> (AI council debate 2026-07-26; maintainer-activated 2026-07-27).
> Roadmaps named by slug only per `no-roadmap-references`.

## Disposition: DEFERRED post-launch, as a pack

Shipping evaluator skills before the package has proven self-criticism on
itself is backwards; the feature freeze also stands. The package-side
mechanisms shipped instead, now:

- **Review structure** — `docs/contracts/adversarial-review-protocol.md`
  (clean-room, consumer seat, rejection + measurement mandates, competitor
  quota, S0–S3 ledger, no-score rule, publish-regardless).
- **Package-side canary calibration** — protocol § 6; the consumer-facing
  canary skill (E4) waits with the pack.

Per-item routing:

| Item | Disposition |
|---|---|
| E1 (derivation approach) | Routed into the Galawork dogfood item (adoption roadmap) as **instrumentation**, not a shipped skill |
| E2, E5 | Wait with the pack, post-launch |
| E3 (re-test design) | Recorded below as the pre-registered design; run gated on benchmark spend, post-freeze |
| E4 (consumer canary skill) | Waits with the pack; package-side mechanism ships now via protocol § 6 |

## E3 — pre-registered re-test design (vs the 9.5.0 Team-Mode Δ=0 null)

The 9.5.0 Team-Mode defect-finding benchmark returned Δ=0 — the reviewed
arm found no more real defects than the unreviewed arm. That null was
measured under the OLD review structure. The re-test changes exactly the
three structural variables the protocol introduced, so a non-null would be
attributable:

- **Clean context** — reviewer arm runs with zero repo-rules / prior-review
  contamination (protocol § 2.1), vs the old in-session review.
- **Consumer seat** — reviewer installs from the registry into an empty
  project before opening the checkout (§ 2.2).
- **Measurement mandate** — findings without executed-command evidence are
  discarded at scoring time (§ 2.4), vs prose findings counting.

Fixed from the 9.5.0 design (unchanged): fixture set construction, arms
count, scoring of "real defect", spend estimate rendered before the first
call. Run is **gated on benchmark spend authorization, post-freeze**.

**Pre-registered honest-null consequence:** Δ=0 again → publish the null
with the same prominence as any positive (protocol § 7) and the evaluator
layer defaults **off** — the pack ships, if ever, as opt-in
instrumentation, not as a recommended layer.
