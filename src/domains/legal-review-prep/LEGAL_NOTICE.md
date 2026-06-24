# Legal pack — Legal Notice & README

> **⚠️ Not legal advice. Not a substitute for a lawyer.** Read this before using
> the legal pack. (Repo-root canonical copy: [`LEGAL_NOTICE.md`](../../../LEGAL_NOTICE.md).)

## What this pack is

A governed, **EU/DE-scoped** set of skills for **first-pass** legal work —
contract / NDA / DPA review, legal triage — plus a practice-profile and a safety
floor. Skills ship **procedure + output templates only, no default legal
positions**; your positions live in the practice profile (`legal-practice-profile`).

## What this pack is NOT

1. **Not legal advice** and not a legal opinion. It does not create an
   attorney-client relationship. Outputs may be inaccurate or incomplete.
2. **Not an individual-case tool.** The skills give *general* information and
   *general* templates. They do **not** examine your concrete case, predict a
   matter's outcome, or decide what is legal in your specific situation —
   individual-case examination is for a licensed lawyer (German RDG § 2(1); a
   disclaimer does not change that line, so the pack refuses to cross it).
3. **Not a substitute for counsel.** Every output must be reviewed by a qualified
   lawyer before use in any concrete matter. No one may rely on it as definitive.
4. **Not US/Swiss/other law.** EU/DE only — out-of-scope jurisdictions are
   refused with "consult licensed local counsel".

## Guardrails (enforced)

`rule:legal-safety-floor` enforces: no-final-legal-call · install consent gate
(inactive until acknowledged) · hard individual-case STOP · council / deep-research
gate on work-product (fail-closed) · no definitive legal language · mandatory
attorney-review line + `Jurisdiction:` tag on every output (CI-checked by
`lint_legal_pack`) · GREEN×non-lawyer → attorney gate.

> The council / multi-model gate is **defense-in-depth** — it improves quality and
> creates an audit trail of the review. It does **not** make output reliable legal
> advice and does not cure the individual-case boundary above. Attorney review
> still required.

## Promotion gate

This pack ships **lab-tier / experimental, off by default** on purpose. Promoting
it (out of `lab`, default-on, or any hosted surface) is **blocked** until a
licensed German attorney has reviewed the *framing* (the safety floor, this
notice, the RDG individual-case wording) and the review is recorded here as:
`Framing reviewed by <name>, Rechtsanwalt/Rechtsanwältin, <date>`. Enforced by
`lint_legal_pack` (ADR-107 amendment, 2026-06-24).

_Attorney framing review: not yet performed — pack stays lab-tier._

## Distribution

Open-source (MIT), forever; no commercial / Pro tier (ADR-108). Use may also be
subject to your AI provider's terms of service.
