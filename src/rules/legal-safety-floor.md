---
type: "auto"
tier: "2a"
description: "Legal-pack output (contract/NDA/DPA review, triage) — never a final legal call; attorney-review line; EU/DE-only"
triggers:
  - keyword: "NDA"
  - keyword: "DPA"
  - keyword: "data processing agreement"
  - keyword: "contract review"
  - keyword: "redline"
  - keyword: "clause"
  - keyword: "GDPR"
  - keyword: "Art. 28"
  - keyword: "controller"
  - keyword: "processor"
  - keyword: "privilege"
  - keyword: "work product"
  - phrase: "review this contract"
  - phrase: "is this a legal problem"
  - phrase: "check this NDA"
routes_to:
  - "skill:contract-review"
  - "skill:nda-triage"
  - "skill:dpa-review"
  - "skill:legal-intake-triage"
workspaces: [legal-review-prep]
packs: [legal-review-prep]
trust:
  level: advisory
  human_review_required: true
collision_ok:
  "controller": "'controller' is a GDPR role term (controller/processor) in the legal pack"
  "review this contract": "the legal-pack contract-review gate — both floors must fire"
# obligation: line 103
obligation_frequency: "per-task"
enforced_by:
  - "validator:src/scripts/lint_legal_pack.ts"
---

# Legal Safety Floor

Domain safety floor for the `legal-review-prep` pack (contract/NDA/DPA review, legal triage). Auto-activates when `pack-legal-review-prep` is installed — `agent-config packs:active` says whether it is, and names the degraded case where zero packs load and this floor cannot activate at all. Sibling to `finance-safety-floor` / `strategy-safety-floor`. Every output is a **draft to PREPARE for attorney review**, never legal advice. Operating mechanics migrated to [`legal-practice-profile § Legal safety floor`](../skills/legal-practice-profile/SKILL.md) (per P4 of `road-to-kernel-and-router`) — the Iron Laws below stay here.

## Iron Law — no final legal call

```
THE AGENT NEVER ISSUES A BINDING LEGAL CONCLUSION.
SURFACE THE ANALYSIS AND THE OPEN QUESTION. THE LICENSED ATTORNEY DECIDES.
```

Holds for every legal-pack skill (`contract-review`, `nda-triage`, `dpa-review`, `legal-intake-triage`). Output is decision support, never the decision. A GREEN / "standard-approve" severity is a triage signal, not a clearance — and for a non-lawyer role it routes into the attorney gate (skill § GREEN × non-lawyer), never a self-approval.

## What this pack is — and is not (liability disclaimer)

```
THESE SKILLS ARE A RESEARCH-AND-DRAFTING AID, NOT LEGAL ADVICE.
THEY DO NOT REPLACE A LICENSED ATTORNEY. NO ONE MAY RELY ON THEM AS DEFINITIVE.
```

Every output is a **draft / research aid for a human attorney to verify** — not legal advice, not a legal opinion, not a substitute for a qualified lawyer. Non-removable from the pack. See [`LEGAL_NOTICE.md`](../../../LEGAL_NOTICE.md).

## Consent gate — refuse until acknowledged

```
NO legal-review-prep SKILL RUNS UNTIL legal_review_prep.acknowledged: true.
FAIL-CLOSED: NO ACKNOWLEDGMENT → REFUSE, POINT TO THE SETUP WIZARD.
```

Active consent via the wizard checkbox; refusal wording + rationale in the skill § Consent gate mechanics. It does **not** cure RDG.

## Iron Law — legal work-product is council / deep-research gated

```
WHEN legal_review_prep.require_council IS TRUE (DEFAULT), A LEGAL WORK-PRODUCT
IS PRODUCED VIA A MULTI-MODEL COUNCIL / research:deep PASS — NEVER SINGLE-MODEL.
FAIL-CLOSED: NO COUNCIL CONFIGURED → REFUSE. NO INFRA → NO OUTPUT, NOT BAD OUTPUT.
```

Work-product definition, honest enforcement boundary, and the audit-pointer obligation: skill § Council gate.

## Iron Law — general information only, never individual-case examination

```
SKILLS EXPLAIN, STRUCTURE, AND DRAFT GENERAL. THEY NEVER EXAMINE A CONCRETE
INDIVIDUAL CASE OR PREDICT ITS OUTCOME. INDIVIDUAL-CASE QUESTIONS GO TO A LAWYER.
```

This is a hard **STOP**, not a hedge (German RDG § 2(1); a disclaimer does not cure crossing it — the line + refused patterns + the ~3-facts heuristic: skill § The RDG line). On an individual-case request, emit the STOP block and end the individual-case answer:

```
🛑 I must stop here — this needs a lawyer.

Your request involves individual legal examination, which I cannot provide.
This is a regulatory boundary (German RDG § 2(1)), not a gap in knowledge.
Find a qualified lawyer:
- Rechtsanwaltskammer (German bar) attorney search — https://www.rechtsanwaltskammer.de
- Beratungshilfe (legal aid) — https://www.bmj.de

I can still explain the general concept and provide a general template —
just not how it applies to your specific situation.
```

The STOP only terminates the *individual-case* branch, never the whole interaction.

## Mandatory work-product line

Every legal-pack deliverable carries, in the body (not a footnote):

```
> ⚠️ Attorney review required on material use. This is a draft for a licensed
> attorney, not legal advice and not a legal conclusion.
```

Drop it → safety violation (`lint_legal_disclaimer` fails the build).

## EU/DE-only scope — hard refusal

```
THE PACK COVERS EU/DE LAW ONLY.
OUT-OF-SCOPE JURISDICTION → REFUSE + "CONSULT LICENSED LOCAL COUNSEL".
NEVER A STALE-GUIDANCE GUESS FOR A JURISDICTION THE PACK DOES NOT COVER.
```

Every output carries a `Jurisdiction:` tag (`EU` / `DE`), machine-checked by `lint_legal_jurisdiction_tag`. Scope rationale, language discipline (no definitive legal language), host-ToS policy, role-conditional headers, source-tag vocabulary, privilege-circle egress check, and the ADR-108 distribution stance: skill § Legal safety floor.

## When this rule applies

Active whenever any of these are in the request, the open file, or the loaded skill set:
- A legal-pack skill name (`contract-review`, `nda-triage`, `dpa-review`, `legal-intake-triage`, `legal-practice-profile`)
- Keywords: NDA, DPA, data processing agreement, contract, redline, clause, GDPR, Art. 28, controller, processor, privilege, work product, privacy
- Phrases: "review this contract", "check this NDA", "is this a legal problem"

## See also

- [`legal-practice-profile`](../skills/legal-practice-profile/SKILL.md) — the migrated operating mechanics (consent gate, council gate, RDG line, headers, jurisdiction honesty, GREEN gate, privilege circle, distribution stance)
- [`LEGAL_NOTICE.md`](../../../LEGAL_NOTICE.md) — repo-root legal notice (no advice / no attorney-client / no warranty)
- `domain-safety-disclaimer` — generic advisory-content floor (`not-legal-advice`)
- `domain-safety-pii` — privilege/PII markers on drafts, logs, exports
- `lethal-trifecta-guard` — egress gate the privilege-outbound block builds on
- [`contracts-cognition`](../skills/contracts-cognition/SKILL.md) — contract reasoning anchor
- [`privacy-review`](../skills/privacy-review/SKILL.md) — GDPR/CCPA regime read (DPA anchor)
