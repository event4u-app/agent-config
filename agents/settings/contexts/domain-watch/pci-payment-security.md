# Watch note — PCI / payment-integration security skill

**Status:** deferred, demand-gated (ecosystem harvest, 2026-07-12; council
2026-07-11 confirmed the gate).

## What was proposed

A portable PCI-compliance / payment-integration security skill (source: a
multi-harness marketplace — provenance encrypted in the ecosystem-harvest
index) — complements the finance pack: cardholder-data flow mapping, PCI-DSS
scope minimization, tokenization-over-storage guidance, payment-webhook
verification patterns.

## Why deferred — the missing gate evidence

`domain-adoption-policy` Gate 1 (demand signal) is not met:

- **No consumer project** ships payments through the suite today.
- **No named user direction** with a target project/timeline.
- **No incident pull** — no payment-security incident on a consumer project.

## Re-open trigger

Any ONE of: a consumer project integrates a payment provider (Stripe,
Mollie, PayPal, …) · a user names a payment feature with a target project ·
a payment-adjacent security incident lands in `agents/settings/contexts/`.
On trigger: re-evaluate at the next harvest cycle; the skill slots into the
existing security cluster (route from `security-audit` / `threat-modeling`),
not a new domain.
