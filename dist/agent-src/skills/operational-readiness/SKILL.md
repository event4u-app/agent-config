---
model_tier: medium
name: operational-readiness
description: "Use when adjudicating an operational go/no-go from typed evidence — a readiness enum with an explicit floor where one red is not-ready, unknown is never green, and no score can average a red away."
domain: devops
workspaces:
  - engineering
packs:
  - engineering-base
---

# operational-readiness

## When to use

Use when turning evidence that already exists into a **verdict**: is this system
ready to operate. The inputs come from other skills; this one adjudicates them
and refuses to average.

Do NOT use when:
- Producing the observability evidence itself (use `logging-monitoring`)
- Deciding what earns a page (use `alerting-doctrine`)
- Hardening the host (use `server-hardening`)
- Working through a release checklist and rollout plan (use `launch-readiness` —
  that is a pre-merge procedure; this is a verdict over operational evidence)
- Running an incident already in progress (use `incident-commander`)

## The verdict is an enum with a floor

```
ONE RED MAKES THE VERDICT not-ready, WHATEVER SITS BESIDE IT.
UNKNOWN IS NEVER GREEN. THERE IS NO SCORE, NO WEIGHT, NO AVERAGE.
```

| Verdict | Condition |
|---|---|
| `ready` | Every input is green. No reds, no unknowns. |
| `ready-with-risk` | Every input is green or amber, at least one amber, **no** reds and **no** unknowns. Each amber names its accepted risk and an owner. |
| `not-ready` | **At least one** red — or at least one unknown. |

Three properties, each load-bearing:

- **The floor is absolute.** One red among nineteen greens is `not-ready`. The
  red is the interesting input precisely because the greens cannot answer it.
- **`unknown` lands in `not-ready`, not in `ready-with-risk`.** An uninspected
  input is not a small risk, it is an unmeasured one, and treating it as amber is
  how "we never checked" becomes "we accepted it". Amber requires someone to have
  looked and named what they are accepting.
- **There is no numeric path.** No readiness percentage, no weighted score, no
  count of greens, no "N of M passing". Any such construct can hide a red, which
  is the only failure mode this skill exists to prevent. If you catch yourself
  producing a number, the verdict has already been lost.

## Typed evidence intake

Each input arrives from an owning surface and keeps its provenance. This skill
does not re-derive an input — it reads the verdict the owner produced.

| Input | Owner | Red when |
|---|---|---|
| Observability posture | `logging-monitoring` | A required Golden Signal is `unavailable` or `unknown` |
| Alert set | `alerting-doctrine` | Any `malformed-alert`, or no page exists for a user-visible failure |
| Finite-resource headroom | `scale-discipline` R-A12 | A constrained resource has no known ceiling, or headroom is unquantified |
| Host posture | `server-hardening` | SSH, firewall or patch baseline unmet or uninspected |
| Deploy safety | `engineering-safety-floor` | Any of blast radius, rollback path, pre-flight checks, observability or named risk owner is missing |

An input the intake cannot obtain is `unknown` — never omitted, and never
defaulted to green. Omission is the silent failure; recording it as `unknown` is
what makes it visible in the verdict.

A threshold reaching this skill with `proposed` provenance is not evidence. It is
a suggestion, and adjudicating against it produces a verdict about a number
nobody committed to — see `logging-monitoring` § Evidence states.

## Procedure: Adjudicate readiness

1. **Enumerate the five inputs.** The list does not shrink to the ones that are
   convenient to obtain.
2. **Read each owner's verdict.** Do not re-derive it here; a second derivation
   is a second opinion, and the owner holds the authority.
3. **Mark every input `green`, `amber`, `red` or `unknown`.** An input you could
   not obtain is `unknown`, stated with what blocked the inspection.
4. **Apply the floor, in this order.** Any red or any unknown → `not-ready`,
   stop. Else any amber → `ready-with-risk`. Else `ready`.
5. **Name every red and every unknown in the output**, each with the input it
   came from and what would clear it. A `not-ready` verdict that does not say
   what to fix is an obstruction rather than a finding.
6. **For `ready-with-risk`, record each amber's accepted risk and its owner.**
   An accepted risk with no owner is an unaccepted risk.

### Validate

- Verify all five inputs appear in the output, including the ones scored
  `unknown`.
- Confirm any red or any unknown produced `not-ready`.
- Confirm no amber was used to absorb a red or an unknown.
- Confirm the output contains no score, percentage, weight or pass-count.
- Confirm every red and unknown names what would clear it.
- Confirm every amber names an accepted risk and an owner.

## Output format

1. The verdict — one of `ready`, `ready-with-risk`, `not-ready`.
2. One row per input — input, owner, state, evidence pointer.
3. Every red and unknown with what would clear it; every amber with its accepted
   risk and owner.

## Examples

Contract fixtures. The pair differs **only** in the condition under test, and
each case states the verdict it must produce. Contract evidence for review, not
an executable suite.

### One red among greens — malformed vs clean

```yaml
# malformed input set — four greens and one red.
# The floor applies: the greens do not outvote the red.
inputs:
  observability:   { state: green, evidence: "4/4 signals present" }
  alert_set:       { state: green, evidence: "0 malformed-alert" }
  finite_resource: { state: green, evidence: "pool ceiling 100, peak 61" }
  host_posture:    { state: green, evidence: "ssh keys-only, ufw default deny" }
  deploy_safety:   { state: red,   evidence: "no rollback path stated" }
verdict: not-ready
blocking: ["deploy_safety: no rollback path stated"]
clears_when: "a rollback path is stated and its time-to-rollback estimated"
```

```yaml
# clean — only the red input is replaced.
inputs:
  observability:   { state: green, evidence: "4/4 signals present" }
  alert_set:       { state: green, evidence: "0 malformed-alert" }
  finite_resource: { state: green, evidence: "pool ceiling 100, peak 61" }
  host_posture:    { state: green, evidence: "ssh keys-only, ufw default deny" }
  deploy_safety:   { state: green, evidence: "rollback: revert + redeploy, ~4min" }
verdict: ready
```

### Unknown is not amber — malformed vs clean

```yaml
# malformed — an uninspected input recorded as an accepted risk.
inputs:
  host_posture: { state: amber, accepted_risk: "probably fine", owner: null }
verdict: invalid-unknown-as-amber
reason: "nobody inspected the host; amber requires a named accepted risk and owner"
```

```yaml
# clean — the same uninspected input recorded honestly.
inputs:
  host_posture:
    state: unknown
    reason: "no shell access to the managed runtime; posture not inspectable"
verdict: not-ready
blocking: ["host_posture: not inspectable"]
```

## Gotcha

- A count of passing inputs is a score wearing different clothes.
- `ready-with-risk` is not a softer `not-ready`; it is unreachable while any red
  or unknown exists.
- An amber with no named owner is a red that has been rounded down.
- Re-deriving an owner's verdict here produces a disagreement with no tiebreak.
- A green built on a `proposed` threshold is a green built on a guess.

## Do NOT

- Do NOT compute a readiness percentage, weighted score or pass-count.
- Do NOT let greens outvote a red — the floor is absolute.
- Do NOT record an uninspected input as amber, or omit it.
- Do NOT treat `unknown` as green, compliant, or "probably fine".
- Do NOT return `not-ready` without naming what would clear it.

## Auto-trigger keywords

- operational readiness
- readiness verdict
- go/no-go
- ready to operate
- production readiness
