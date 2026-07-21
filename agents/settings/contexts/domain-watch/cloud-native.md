# Watch note — Cloud-native / Kubernetes / GitOps vertical

**Status:** deferred, demand-gated (ecosystem harvest, 2026-07-12; council
2026-07-11 confirmed a hard no).

## What was proposed

A cloud-native operations vertical — Kubernetes, GitOps (ArgoCD / Flux),
service-mesh (Istio) — as portable skills (source: a multi-harness marketplace —
provenance encrypted in the ecosystem-harvest index).

## Why deferred — the missing gate evidence

Hard no today; `domain-adoption-policy` gates are not met and the demand shape
argues against it:

- **Already covered for the target consumer.** Docker plus terraform/terragrunt
  already cover the solo-founder consumer's infra. k8s / GitOps / service-mesh is
  at-scale operations a solo consumer does not have — adopting it is
  resume-driven, not demand-driven.
- **No demand:** no consumer project runs on Kubernetes through the suite.
- **No named owner:** no SRE co-maintainer to keep a fast-churning k8s surface
  current (upstream k8s/operator churn rots such skills within 6–12 months).
- **No CI decision:** cluster-in-CI vs reference-only is unresolved.

## Re-open trigger — all three gates

Re-evaluate at the next harvest cycle only when ALL hold:

- **Demand:** ≥ 2 consumers running on Kubernetes through the suite.
- **Owner:** a named SRE co-maintainer for the vertical.
- **CI decision:** an explicit call on cluster-in-CI vs reference-only, per
  `domain-adoption-policy`.

Until then the vertical stays closed; do not relitigate.
