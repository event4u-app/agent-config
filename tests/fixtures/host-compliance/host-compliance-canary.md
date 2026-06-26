---
type: "auto"
tier: "2b"
description: "Host-compliance canary — a thin-projection probe rule; fires only on its sentinel keyword, never in real work."
triggers:
  - keyword: "xyzzy-canary-probe"
  - phrase: "host compliance canary"
---

# Host-Compliance Canary

CANARY_BODY_SENTINEL_DO_NOT_INLINE — under correct thin projection a host that
fires on `xyzzy-canary-probe` shows the router POINTER to this body, not the
body itself. If a host surfaces this sentinel line, it is reconstructing the
rule body and IGNORING the thin pointer — a thin-projection compliance failure
that means thin mode is a no-op on that host (escalate to the host vendor).
