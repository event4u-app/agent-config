---
model_tier: inherit
name: data-handling-judgment
description: "Use when classifying data, setting retention, judging cross-border transfer, or shaping DSR workflow. Triggers on 'how long do we keep this', 'can this data go to the US'."
status: active
tier: senior
domain: process
context_spine: [regulatory-regime, customer-segment, product]
recommended_for_user_types: [ops, finance]
workspaces:
  - engineering
packs:
  - engineering-base
---

# data-handling-judgment

## When to use

- A data category needs classification (PII / PHI / financial / public / pseudonymous / aggregate) and downstream retention, access, and transfer rules depend on the classification.
- A retention default is being set (or audited) and the question is *how long is defensible*, *how long is useful*, *how long is dangerous*.
- A cross-border transfer is proposed (analytics in US, support in Philippines, backup in EU) and the transfer-mechanism + sub-processor obligations need a read.
- A data-subject-rights (DSR) workflow is being designed: access, deletion, portability, correction, objection, automated-decision-objection.

Do NOT use as a regulatory-regime delta read (route to `privacy-review` (P6); this skill composes P6 for the regime floor), for contract-clause depth (route to `contracts-cognition` (P5)), or for data-loss-prevention tool administration / classifier-engine configuration.

## Cognition cluster

- **Mental model 28 — Inversion.** *"If this data category leaked in this form, who would we have to notify and what would the headline read?"* The headline inversion forces honest classification ahead of operational convenience. See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 28.
- **Mental model 1 — First principles.** Strip every retention claim to: *what purpose does keeping this another day serve, and whose risk does it grow?* Most retention defaults are inherited from the previous system, not chosen. See `mental-models.md` § 1.
- **Mental model 26 — Optionality.** Aggressive retention preserves *analytical optionality* but forecloses *deletion optionality* and grows *breach optionality* for the attacker. Each retention choice is a trade. See `mental-models.md` § 26.
- **Context-spine — regulatory-regime + customer-segment + product.** Read **regulatory-regime** (J1) for floor (GDPR storage-limitation principle; HIPAA retention minimums for medical records; financial-regulator retention mandates). Read **customer-segment** for whose data sets the floor. Read **product** for which features actually need the data.

## Cross-wing handoff

- Composes / cites J1 `regulatory-regime` for the floor read; this skill operationalises the regime obligations into classification / retention / transfer / DSR shape.
- Composed by P6 `privacy-review` — privacy-review flags *that* a classification / retention / transfer issue exists, this skill produces the *operational answer*.
- Hands off to Wing-2 ops skills for implementation (retention-job scheduling, DSR-runbook authoring) — this skill produces the policy shape, ops implements.

## Procedure

### Step 0: Bind the regime floor and the segment

Read J1 `regulatory-regime` for the customer-segment in scope. Note which regime mandates a *minimum* retention (HIPAA medical records: typically 6+ years state-dependent; financial: SOX, regulatory varies) vs which mandates a *maximum* (GDPR storage-limitation; CCPA "necessary purpose"). Both floors and ceilings can apply simultaneously and create a window.

### Step 1: Classify the data category

For each data category in scope, assign a classification tier and rationale:

1. **Public** — already public or designed for publication; no confidentiality obligation.
2. **Internal** — company-confidential, not subject-specific; protected by trade-secret / commercial logic.
3. **Pseudonymous** — keyed to subject but not directly identifying; classification depends on re-identifiability (the GDPR test).
4. **PII** — directly identifying; subject to regime baseline.
5. **Sensitive-PII** — special-category (GDPR Art. 9), CCPA "sensitive personal information", financial-account, gov-ID.
6. **PHI / regulated** — HIPAA PHI, payment-card data (PCI), or sector-specific (children = COPPA, biometrics = state laws).

Rationale per category cites *what makes it that tier*, not just the label. Mis-classification downward is the canonical risk.

### Step 2: Set retention with explicit purpose binding

For each data category × processing purpose, name:

1. **Purpose** — why we keep it (operational, analytical, legal-hold, contractual, regulatory-mandate).
2. **Retention** — how long for that purpose; named in calendar units, not "as needed".
3. **End-state** — at expiry: hard-delete, anonymise, aggregate-only, archive-with-access-restriction.
4. **Authority** — what makes the chosen retention defensible (regime mandate, contract obligation, documented operational need).

Default "indefinite" retention is the failure mode. Every category needs an explicit end-state.

### Step 3: Cross-border-transfer judgment

For each transfer hop where data crosses a regime boundary:

1. **Source regime** vs **destination regime** — which subjects, which categories.
2. **Mechanism** — adequacy decision, SCC (with which version), BCR, derogation. Schrems-II-level transfer-impact assessment for transfers to non-adequate jurisdictions.
3. **Government-access risk** — destination jurisdiction's surveillance regime and the supplementary-measures shape (encryption with key-control, pseudonymisation before transfer, contractual challenge).
4. **Sub-processor chain** — every onward transfer is itself a transfer; map two hops deep, not one.

A transfer without a named mechanism + supplementary measures (where required) = an unauthorised transfer.

### Step 4: Data-subject-rights workflow shape

For each regime × right (access, deletion, portability, correction, objection, automated-decision-objection), name:

1. **Window** — regime-mandated response time (GDPR: 1 month; CCPA: 45 days; HIPAA: 30 days for access).
2. **Owner** — named human / role responsible (not "the team").
3. **Mechanism** — how the subject submits, how identity is verified, how the response is delivered, how denials are reasoned.
4. **Edge cases** — joint-controller scenarios, third-party data within a subject's record, deletion-vs-legal-hold conflicts.

DSR workflows that exist only as a generic support-inbox process fail under every regime. Force named owners and windows.

### Step 5: Validate the data-handling read before emitting

Before producing the artifact, verify three things:

1. **Classification coverage** — confirm every in-scope data category has a tier + cited rationale; un-rationalised tiers are guesses and must be re-run.
2. **Retention binding** — assert every category × purpose has a calendar-unit retention + named end-state + cited authority; "as needed" entries fail.
3. **Transfer + DSR completeness** — check every cross-border hop has a mechanism + supplementary-measures read; every applicable regime × right has a named owner + window. Gaps are surfaced, not smoothed.

All three must pass. If any fails, return to the failing step.

### Step 6: Emit the data-handling-judgment artifact

Produce the data-handling-judgment note for the feature owner, ops lead, and counsel. The artifact operationalises the regime floor into policy that ops can implement and counsel can sign off.

## Related Skills

**WHEN to use this**

- Classifying a new data category and setting downstream rules.
- Setting / auditing retention defaults against regime and purpose.
- Judging a cross-border-transfer mechanism + supplementary measures.
- Designing a DSR workflow with named owners and windows.

**WHEN NOT to use this**

- Regime-floor regulatory delta read — route to [`privacy-review`](../privacy-review/SKILL.md) (P6); this skill composes P6.
- Contract-clause redline depth — route to [`contracts-cognition`](../contracts-cognition/SKILL.md) (P5).
- Regime-floor surface — route to `regulatory-regime` (J1); this skill operationalises J1, doesn't replace it.
- DLP / classifier-engine tooling — out of scope.

## When the agent should load this

- "How do we classify this field?"
- "How long do we keep this?"
- "Can we send this to the US / India / wherever?"
- "Design our DSR workflow."
- "Wie lange dürfen wir Logs aufbewahren?"

## Output

1. **`classification-map.md`** — every in-scope data category × tier + cited rationale.
2. **`retention-policy.md`** — category × purpose × retention × end-state × authority.
3. **`transfer-register.md`** — cross-border hops × mechanism × supplementary measures × sub-processor chain (two-deep).
4. **`dsr-workflow.md`** — regime × right × window × owner × mechanism × edge cases.

## Gotcha

- Pseudonymous ≠ anonymous. If re-identification is possible with reasonable means, it's still personal data under GDPR.
- Retention defaults inherited from the previous system are usually wrong; treat every category as a fresh decision.
- "Encryption in transit" is not a Schrems-II supplementary measure on its own; the question is who can access the keys in the destination jurisdiction.
- Joint-controllership is silently common (analytics, embedded widgets); name the controller relationship explicitly per hop.

## Do NOT

- Do NOT issue privacy legal opinions; this skill produces operational policy, counsel signs it off.
- Do NOT classify by least-conservative tier to avoid operational burden; mis-classification downward is the canonical regulator finding.
- Do NOT set retention without a named end-state; "as needed" is not a retention.

## Runnable example

Series-B SaaS with EU + US customer mix, adding a customer-success analytics integration.

- Step 0 — Regime floor: GDPR (EU subjects), CCPA (CA subset), no PHI. GDPR storage-limitation is the ceiling; no minimum-retention mandate applies.
- Step 1 — Classify: account-id = pseudonymous (low re-id); email = PII; usage-event = PII (linked to email); free-text-feedback = PII + potentially sensitive (subjects may include health / political content). Aggregate cohort metrics = anonymous if k-anonymity ≥ 50.
- Step 2 — Retention: usage-event for product-analytics = 18 months, hard-delete on expiry; usage-event for billing-dispute = 7 years (contractual + tax authority); free-text-feedback = 12 months, hard-delete; email-for-marketing = until consent withdrawn or 24 months inactive.
- Step 3 — Transfer: analytics vendor in US (no adequacy), SCC 2021 module 2 + supplementary measures (pseudonymisation of free-text-feedback before transfer, key-control retained in EU). Sub-processor chain: vendor uses logging service in US-only; ok within SCC.
- Step 4 — DSR: access (1 month, CS lead, in-app + verified-email submission); deletion (1 month, CS lead, soft-delete-then-hard-delete-30d unless legal-hold); portability (1 month, ops engineer, JSON export); objection-to-marketing (immediate, automated).
- Step 5 — Validate: every category tier rationalised; every retention category × purpose has end-state + authority; transfer hops have SCC + supplementary measures; DSR rights have owners + windows. Pass.
- Step 6 — Emit data-handling-judgment artifact; ops implements retention jobs and DSR runbook; counsel signs off on transfer-impact assessment.
