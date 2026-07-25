---
complexity: lightweight
status: ready
parent_roadmap: road-to-gated-reach
---

# Roadmap: Reach — logged-in `old.reddit` via a human-exported session cookie

> The successor path for Reddit **ranking and thread structure** if — and only if —
> the credential-free one dies. It is parked because the credential-free one is
> currently alive.

## Why this is parked, not open

Ranking and reply nesting already ship, credential-free, from server-rendered
`old.reddit` HTML (6/6 on a pre-registered task set, 2026-07-25). Reddit announced
a login requirement for that interface on 2026-06-30; it was **not** enforced on the
bench machine on 2026-07-25. Building a cookie path now would add a credential
surface to replace a capability that still works — the definition of premature.

## Resume trigger — BOTH must hold

1. An **observed** login wall or redirect-to-login on the `old.reddit` permalink
   fetch (the parser reporting `login_wall: true` on a real fetch). The
   announcement alone is explicitly **not** the trigger.
2. The maintainer choosing this successor over the two alternatives recorded with
   it — accept text-only, or pursue approved API access. This is a risk decision,
   not a technical default.

## What it would have to solve — the costs, recorded up front

- A **consent gate** before the first read (`non-destructive-by-default` applies —
  the credential is the user's account).
- A `chmod 600` credential file declared as `credential_path`, confined by the same
  path-confinement the doctor already applies.
- **Account-ban risk** carried by the maintainer's own Reddit account.
- The sharpest one, named by the design council: a credential sitting on the same
  autonomous path as untrusted third-party comment bodies and an outbound fetch —
  all three legs of the lethal trifecta. Either the egress is human-gated or the
  credential leg is quarantined; `lethal-trifecta-guard` is not negotiable here.

The parser needs no change — it reads the same HTML either way. That is the whole
reason this stays cheap while parked.

## See also

- `internal/bench/gated-reach/VERDICT.md` — the kill-switch criterion that fires this.
- `docs/decisions/ADR-126-internet-reach-operator-tooling.md` § Amendment 2026-07-25.
