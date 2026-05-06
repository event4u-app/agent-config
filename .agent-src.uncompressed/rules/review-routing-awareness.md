---
type: "auto"
tier: "2a"
description: "When routing reviewers or flagging risk hotspots — consult ownership-map and historical-bug-patterns before suggesting reviewers or claiming a change is safe"
source: package
triggers:
  - keyword: "reviewer"
  - phrase: "risk hotspot"
  - phrase: "ownership map"
routes_to:
  - "skill:review-routing"
---

# Review Routing Awareness

**Iron Law.** Consult ownership-map and historical-bug-patterns before suggesting reviewers or claiming a change is safe.

Body migrated to `skill:review-routing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
