# Producing the review — validation, tiers, governance, deep path

Loaded on demand by [`code-review`](../SKILL.md) when writing up the review.
Kept off the always-loaded body so the on-invoke cost stays neutral.

## Reasoned finding-validation (not vote-counting)

Group candidate findings by file + line range; give each a disposition + a
one-line reason:

- **CONFIRMED** — trigger is real; keep it, cite `file:line` + concrete trigger.
- **adjusted** — real but mis-scoped / mis-severity; keep the corrected form.
- **DROPPED** — false positive; record it (with reason) in the dropped-FP
  section, never silently discarded.

## Deep path — security-class CONFIRMED findings

A CONFIRMED finding on a security-sensitive surface (auth, injection, secrets,
tenancy, upload, SSRF) routes through a false-positive deep-verify before it
ships as a Blocker: restate the claim; name the threat-model fields (privilege
level · execution context · attacker precondition); trace source→sink; run a
devil's-advocate pass; give an evidence-backed verdict. Shares the
**Rationalizations to Reject** table with [`security-audit`](../../security-audit/SKILL.md)
§ 0 — "it looks dangerous" is not a finding; "clearly critical" gets the
devil's-advocate pass because models overrate severity.

## Two-tier output template

```
## Tier 1 — Mechanical  (enumerated, fix-ready; never mix severities in a block)
🔴 **Blocker** — must fix before merge
path/to/file.ext:LINE — description + why it's critical.
🟡 **Suggestion** — should fix
🟢 **Nit** — optional

## Tier 2 — Alignment  (judgment; names the principle/ADR + concern; not fix-ready)
⚖️  path/to/file.ext:LINE — conflicts with `ADR-0NN` (or principle X): <concern>. Discuss.

<details><summary>Dropped false positives (N)</summary>
- path:LINE — looked like X; not a finding because <traced reason>.
</details>

Verdict: YES | NOT-SURE | NO  ·  Tier-1: B blockers, S suggestions
Coverage: deep=[files]  skimmed=[files]  confidence=high|medium|low
```

Group related findings; skip what the linter / type-checker already catches.
The dropped-FP section is not optional — its presence proves the validation ran
(an empty list is fine).

## Governance-conflict step (feeds Tier 2)

Scan `docs/decisions/` (or the project's ADR dir) **status-aware** for a
decision the change conflicts with:

- Conflict with an **accepted** ADR → Tier-2 flag: "this change contradicts
  `ADR-0NN` — the change or the ADR must move".
- Conflict with a **draft / in-review** ADR → still flag: "either the change
  or the draft `ADR-0NN` needs updating — discuss".
- Optionally suggest a reviewer via `git blame` on the cited line (the
  decision's author / last toucher). **Guarded:** degrade silently when no
  governance docs or no blame data exist — never fabricate a reviewer.
