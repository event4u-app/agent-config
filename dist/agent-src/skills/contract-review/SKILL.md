---
model_tier: inherit
name: contract-review
description: "Use when reviewing a contract clause-by-clause from your party's side — buyer/seller/vendor/licensee. Triggers on 'review this contract', 'redline this MSA', 'is this clause a problem'."
status: active
tier: senior
domain: process
recommended_for_user_types: [legal]
workspaces:
  - legal-review-prep
packs:
  - legal-review-prep
trust:
  level: advisory
install:
  removable: true
---

# contract-review

## When to use

- A contract draft (MSA / SOW / vendor / licence / partner agreement) needs a **position-aware, clause-by-clause** review — the user states their party role and the review adjusts to what *their* side should fear.
- An existing contract is being negotiated and each load-bearing clause needs a GREEN / YELLOW / RED severity call plus a specific redline *suggestion* (not an edit).
- A non-lawyer needs the analysis that prepares the attorney conversation: what each clause binds, where the risk concentrates, what to ask for.

Do NOT use to **issue a legal opinion** (the licensed attorney decides — see `legal-safety-floor`), for the non-lawyer cognition layer that precedes a structured review (route to [`contracts-cognition`](../contracts-cognition/SKILL.md)), or for DPA / data-processing review (route to [`dpa-review`](../dpa-review/SKILL.md)).

## Procedure

### Step 0: Fix the party role and the jurisdiction

1. The user states their **party role**: `buyer` / `seller` / `vendor` / `licensee` / `licensor` (or the contract's own term). The review is asymmetric — a cap that protects the seller exposes the buyer. If the role is missing, STOP and ask once. Do not infer from prose.
2. Read the governing-law clause. If the contract is governed by a jurisdiction **outside EU/DE scope**, REFUSE the review: *"This is governed by &lt;jurisdiction&gt; — outside this pack's EU/DE scope. Consult licensed local counsel."* Never a stale guess for an out-of-scope jurisdiction.
3. Tag the output with `Jurisdiction: EU` or `Jurisdiction: DE` — the one you reasoned under.

### Step 1: Establish the position profile

Read thresholds and acceptable positions from the `legal-practice-profile` (sibling skill). The skill ships **no default legal positions** — caps, notice windows, indemnity shapes, and acceptable-risk bands are the profile's, not the agent's.

Until the profile is configured, emit explicit `[configure]` placeholders (e.g. *"indemnity cap acceptable band: [configure]"*) and say plainly that no position is being asserted.

### Step 2: Map clauses to the risk taxonomy

Walk the contract clause by clause. Classify each against a public clause-risk reference (a CUAD-style 41-category taxonomy — named as a reference; **no dataset is vendored**): liability/indemnity, term/renewal/termination, IP/licence grant, confidentiality, data, governing law, audit, exclusivity/MFN, change-of-control, payment, warranty, assignment, and the rest.

For each clause, read it **from the user's party role**: *"under what scenario does this fire, and who pays when it does?"*

### Step 3: Assign GREEN / YELLOW / RED per clause

- **GREEN** — standard, symmetric, within (or absent-of) the profile band. A triage signal, not a clearance.
- **YELLOW** — acceptable only with a named change, or carries role-specific risk worth surfacing.
- **RED** — unbounded, one-way against the user's role, or contradicts a `[configure]`/profile band. Leads the redline list.

### Step 4: Produce redline SUGGESTIONS (never edits)

For each YELLOW/RED clause, write a specific *suggested* ask — the cap to add, the carve-out to remove, the notice window to extend — phrased as a proposal for counsel and the negotiation lead, **not** an applied edit to the document.

### Step 5: Surface the open questions, refuse the final call

List what the licensed attorney must decide (which clauses are counsel-led vs commercial) and the open questions the review could not resolve. Do **not** issue a sign / don't-sign verdict.

### Step 6: Emit the review artifacts

Produce `review-frame.md` and `redline-suggestions.md` (see Output). Every artifact carries the `Jurisdiction:` tag and the work-product line below.

> ⚠️ Attorney review required on material use. This is a draft for a licensed attorney, not legal advice and not a legal conclusion.

## Related Skills

**WHEN to use this**

- Position-aware clause-by-clause review of a contract within EU/DE scope.
- The user knows their party role and wants per-clause severity + redline suggestions.

**WHEN NOT to use this**

- Mutual / one-way NDA quick read — route to [`nda-triage`](../nda-triage/SKILL.md).
- DPA / Art. 28 / data-processing review — route to [`dpa-review`](../dpa-review/SKILL.md).
- "Is this even a legal problem / what is this document" — route to [`legal-intake-triage`](../legal-intake-triage/SKILL.md).
- Non-lawyer cognition that precedes a structured review — route to [`contracts-cognition`](../contracts-cognition/SKILL.md).

Obeys `legal-safety-floor` (rule): no final legal call, mandatory work-product line, EU/DE-only hard refusal, machine-checkable `Jurisdiction:` tag.

## When the agent should load this

- "Review this contract from the buyer's side."
- "Redline this MSA — we're the vendor."
- "Is this indemnity clause a problem for us?"
- "Prüf diesen Vertrag aus unserer Sicht durch."
- "Worauf müssen wir als Lizenznehmer achten?"

## Output

1. **`review-frame.md`** — party role, `Jurisdiction:` tag, position profile read (or `[configure]` placeholders), per-clause table with GREEN/YELLOW/RED severity + risk-taxonomy category + the firing scenario from the user's side. Carries the work-product line.
2. **`redline-suggestions.md`** — per YELLOW/RED clause, the specific suggested ask (cap / carve-out / notice window), phrased as a proposal for counsel — never an applied edit; plus the open questions and counsel-led vs commercial-led split. Carries the work-product line.

## Gotcha

- The review is **asymmetric**: a GREEN for the seller can be a RED for the buyer. Re-run severity against the stated party role, never against "the contract" in the abstract.
- Severity is a triage signal, never a clearance — a GREEN clause is not a sign-off, and the agent never issues the sign / don't-sign call.
- The skill ships **no default positions**. A severity asserted without a profile band or a `[configure]` placeholder is a fabricated legal position — surface the gap, don't fill it.
- Out-of-scope governing law is a hard refusal, not a best-effort guess — a stale read of a jurisdiction the pack doesn't cover is worse than no read.
- Suggested redlines are proposals, not edits. Applying changes to the document silently strips the attorney's review gate.

## Do NOT

- Do NOT issue a final legal call (sign / don't-sign / safe / unsafe) — surface analysis + open questions; the licensed attorney decides.
- Do NOT invent thresholds or acceptable positions — read them from `legal-practice-profile` or emit `[configure]`.
- Do NOT review a contract governed by an out-of-scope jurisdiction — refuse and route to licensed local counsel.
- Do NOT emit any artifact without the `Jurisdiction:` tag and the verbatim attorney work-product line in the body.
- Do NOT apply redlines as edits — emit them as suggestions only.

## Runnable example

Vendor-side review of a customer-drafted MSA, governed by German law.

- Step 0 — party role = `vendor`; governing law = Germany → in scope. `Jurisdiction: DE`.
- Step 1 — `legal-practice-profile` not yet configured → indemnity-cap band, notice-window floor, and acceptable-liability shape all emitted as `[configure]`; output states no position is asserted.
- Step 2 — clauses mapped: uncapped IP indemnity (liability/indemnity), 3-year auto-renewal / 90-day notice (term/renewal), MFN buried in pricing schedule (exclusivity/MFN), unilateral audit right (audit).
- Step 3 — severity from vendor's side: uncapped IP indemnity → **RED**; auto-renewal + short notice → **YELLOW**; MFN → **RED** (forecloses portfolio pricing); audit right → YELLOW.
- Step 4 — redline suggestions: cap IP indemnity at `[configure]`× ACV with carve-outs; extend notice to `[configure]` days, reduce renewal to 1 year; strike MFN or limit to identical SKU; bound audit frequency + notice.
- Step 5 — open questions: is the IP-indemnity carve-out scope counsel-led (yes); auto-renewal window is commercial-led. No sign / don't-sign verdict.
- Step 6 — emit `review-frame.md` + `redline-suggestions.md`, each tagged `Jurisdiction: DE` and carrying the attorney work-product line.
