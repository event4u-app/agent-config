# Data governance & domain safety

`agent-config` ships **12 domain-safety rules** (`.agent-src.uncompressed/rules/domain-safety-*.md`) that act as a per-domain output floor — PII redaction, disclaimer requirements, and retention guidance. Rules fire automatically via the router when their triggers match.

## Surface → rule(s) → floor

| Surface | Rule(s) | Floor |
|---|---|---|
| Support / CRM drafts | `domain-safety-pii-support` · `domain-safety-retention-support` | Redact customer names, emails, phones, account IDs to placeholders before output |
| Finance / invoicing | `domain-safety-pii-finance` · `domain-safety-retention-finance` | Redact counterparty PII and bank identifiers; flag retention under audit hold |
| Recruiting | `domain-safety-pii-recruiting` | Redact candidate PII from notes, scorecards, rejection emails |
| Marketing testimonials | `domain-safety-pii-marketing` | Require consent record before customer-identifying copy ships |
| Legal · financial · medical · consulting drafts | `domain-safety-disclaimer-*` | "Not legal/financial/medical advice" disclaimers; refuse diagnostic / dosage / specific tax positions |
| Logs · exports | `domain-safety-logging-pii-floor` · `domain-safety-export-redact` | No raw PII in logs or exports; allowlist-driven structured fields only |

## How the floor is enforced

- Each rule declares `applies_to_user_types:` in frontmatter — rules load only when the matching user-type is active (forward-compatible with the user-types axis shipping in `step-9-user-types-axis`).
- Each rule routes to `skill:privacy-review` as the baseline deeper-regime check (GDPR · CCPA · HIPAA).
- The set is opt-in by domain, never overrides higher Iron Laws (`non-destructive-by-default`, `commit-policy`, `scope-control`).

## Related skills

- [`privacy-review`](../.agent-src.uncompressed/skills/privacy-review/SKILL.md) — end-to-end data-flow review for a regulatory regime (GDPR / CCPA / HIPAA).
- [`data-handling-judgment`](../.agent-src.uncompressed/skills/data-handling-judgment/SKILL.md) — classification, retention, cross-border transfer, DSR workflow.

## See also

- [`non-destructive-by-default`](../.augment/rules/non-destructive-by-default.md) — Hard Floor that overrides every domain-safety carve-out.
- [`security-sensitive-stop`](../.augment/rules/security-sensitive-stop.md) — threat-model before touching auth / billing / tenant boundaries / uploads.
