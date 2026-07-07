---
type: "auto"
tier: "2a"
description: "Reviewer suggestions / risk hotspots — anchor in paths/risk + ownership-map; medium/high needs primary + secondary"
triggers:
  - keyword: "reviewer"
  - phrase: "suggest reviewers"
  - phrase: "risk hotspot"
  - phrase: "ownership map"
routes_to:
  - "skill:review-routing"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Reviewer Awareness

**Iron Law (reviewer choice).** Anchor reviewer choice in paths and risk, never seniority; medium / high risk requires primary + secondary role.

**Iron Law (routing / risk).** Consult ownership-map and historical-bug-patterns before suggesting reviewers or claiming a change is safe.

Body migrated to `skill:review-routing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

Consolidates the former review-routing-awareness rule per the
package's adr-auto-rule-consolidation decision.
