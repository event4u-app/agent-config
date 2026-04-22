# Engineering Memory Data Format

Schema and conventions for the four project-local YAML files that
extend the memory layer beyond `ownership-map` and
`historical-bug-patterns` (those are covered in
[`review-routing-data-format`](review-routing-data-format.md)).

All four files are **optional** and live in the consumer repository —
never in package-shipped artifacts. Absence is handled gracefully:
consulting skills fall through to their generic behaviour.

This guideline replaces the *"one guideline per schema"* plan from
`road-to-engineering-memory.md` with a single consolidated reference,
matching the existing pattern established by `review-routing-data-format`.

## File locations

Each schema lives under `agents/memory/<type>/<hash>.yml` (content-addressed,
merge-safe — see [`road-to-memory-merge-safety.md`](../../../agents/roadmaps/road-to-memory-merge-safety.md))
**or** in a single `agents/memory/<type>.yml` file for projects that prefer
one file per type.

| Type | Single-file path | Sharded path |
|---|---|---|
| Domain invariants | `agents/memory/domain-invariants.yml` | `agents/memory/domain-invariants/<hash>.yml` |
| Architecture decisions | `agents/memory/architecture-decisions.yml` | `agents/memory/architecture-decisions/<hash>.yml` |
| Incident learnings | `agents/memory/incident-learnings.yml` | `agents/memory/incident-learnings/<hash>.yml` |
| Product rules | `agents/memory/product-rules.yml` | `agents/memory/product-rules/<hash>.yml` |

Choose one layout per type and stick with it. `scripts/check_memory.py`
warns if both exist for the same type.

## Shared frontmatter fields

Every entry across all four types MUST carry these keys. The gate
rejects entries missing any required field.

| Key | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | kebab-case slug | unique within the type |
| `status` | yes | `active` \| `deprecated` \| `archived` | lifecycle |
| `confidence` | yes | `low` \| `medium` \| `high` | reader weights accordingly |
| `source` | yes | list of URLs / ADR refs | ≥1 entry |
| `owner` | yes | team slug | who keeps this entry fresh |
| `last_validated` | yes | ISO date | stale check per type |
| `review_after_days` | yes | integer | triggers staleness warning |

## Type-specific required fields

Each file also carries the template-specific body. See the example
templates for the full shape:

- [`domain-invariants.example.yml`](../../templates/agents/memory/domain-invariants.example.yml)
  adds `rule`, `boundary`, `scope.paths`, `violation_contract`.
- [`architecture-decisions.example.yml`](../../templates/agents/memory/architecture-decisions.example.yml)
  adds `title`, `context`, `decision`, `alternatives_rejected`,
  `trade_offs`, `paths`, `superseded_by`.
- [`incident-learnings.example.yml`](../../templates/agents/memory/incident-learnings.example.yml)
  adds `pattern`, `trigger_conditions`, `consequence`, `guardrail`,
  `enforcement`, `severity`.
- [`product-rules.example.yml`](../../templates/agents/memory/product-rules.example.yml)
  adds `rule`, `applies_to`, `enforcement`, `error_contract`, `version`.

## Ownership (who writes, who reads)

| Type | Writer | Reader (skill/role) | Expiry |
|---|---|---|---|
| Domain invariants | senior engineer / architect | `developer-like-execution`, `php-coder`, `laravel` | reviewed at major version bump |
| Architecture decisions | decision author at ADR time | `feature-plan`, `api-design`, `blast-radius-analyzer` | `deprecated` on reversal; never deleted |
| Incident learnings | incident commander post-resolution | `Incident` role, `bug-investigate`, `bug-analyzer` | archived when guardrail lands + verified in prod |
| Product rules | PO or tech lead post-decision | `PO` role, `validate-feature-fit`, `laravel-validation` | version-stamped; old versions archived |

## Redaction rules (hard)

Enforced by `scripts/check_memory.py`. Reject on match:

- **No secrets.** API keys, tokens, credentials, private URLs with
  credentials, internal hostnames that expose infrastructure.
- **No customer names.** ACME Corp, specific account IDs, domain
  names of real customers. Rephrase to the pattern.
- **No PII.** Names, emails, phone numbers, IP addresses tied to
  real users. Incident-learnings is tempting here — resist.
- **No ticket IDs that identify the incident** in
  `incident-learnings.yml`. Link the guardrail PR instead.

## Reader contract

Consuming skills read an entry and expose its `status` + `confidence`
to the agent. A `confidence: low` domain invariant informs, it does not
dictate. A `confidence: high` incident learning blocks the generation
path if the guardrail is absent.

## Staleness

`check_memory.py` runs weekly (not per-PR). It reports entries where
`(today - last_validated) > review_after_days`. Stale entries stay
active — the report is informational, not a gate.

## Anti-patterns

- **Do NOT** merge `ownership-map.yml` semantics into these files.
  Ownership is a separate concern; mixing them doubles the staleness
  surface.
- **Do NOT** generate entries via LLM in bulk. Curated is the point.
  The point of a `confidence: high` entry is human-verified claim,
  not high-volume output.
- **Do NOT** delete `deprecated` or `archived` entries. History is
  the value of memory; deletion is amnesia.
- **Do NOT** ship this file pre-populated. Each consumer starts
  empty and fills as decisions and incidents accumulate.

## See also

- [`road-to-engineering-memory.md`](../../../agents/roadmaps/road-to-engineering-memory.md) — roadmap this guideline implements
- [`road-to-memory-merge-safety.md`](../../../agents/roadmaps/road-to-memory-merge-safety.md) — why content-addressed files
- [`review-routing-data-format.md`](review-routing-data-format.md) — sibling format for ownership + bug patterns
- [`road-to-role-modes.md`](../../../agents/roadmaps/road-to-role-modes.md) — role modes that consume these files
