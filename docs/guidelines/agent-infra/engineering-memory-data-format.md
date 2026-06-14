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
merge-safe) **or** in a single `agents/memory/<type>.yml` file for projects
that prefer one file per type.

| Type | Single-file path | Sharded path |
|---|---|---|
| Domain invariants | `agents/memory/domain-invariants.yml` | `agents/memory/domain-invariants/<hash>.yml` |
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
| `priority` | no | `critical` \| `normal` \| `low` | tier-0 surfacing; defaults to `normal` |
| `ts_week` | no | ISO-week string `YYYY-Www` | promotion week stamp; convention, not enforced |

### Priority semantics (`critical` / `normal` / `low`)

The `priority` field controls how aggressively `/memory:load` surfaces
an entry. The three-tier enum is intentional — see
an internal roadmap (local-only) § B2 and the Phase 2 council brief
for why a fourth `high` tier was rejected.

| Value | Meaning | Reader behaviour |
|---|---|---|
| `critical` | Tier-0 — always surface regardless of query | `/memory:load` injects on every load, irrespective of key/query match |
| `normal` (default) | Standard query-matched retrieval | Surfaced when the lookup key/query matches the entry |
| `low` | Background — only surface on explicit full load | Skipped by query-matched retrieval; visible only via `/memory:load --type` full sweep |

**Tier-0 governance.**
`scripts/check_memory.py` enforces two soft guards on `critical` entries:

- **Critical-stale warning** — a `priority: critical` entry whose
  `last_validated` is older than 90 days emits a `critical-stale` warning
  during validation (still exit 0; the curator decides whether to
  re-validate or downgrade).
- **Tier-0 inflation warning** — when a memory type accumulates more
  than 10 active `critical` entries, the validator warns. The intent is
  to keep the always-surface slice small enough to remain signal, not to
  block writes; raise the threshold deliberately if the project's domain
  genuinely needs more.

Both are warnings, never errors. The curator stays in charge.

### Temporal jitter (`ts_week`)

`ts_week` stamps a curated entry with the **ISO week** it was promoted
(`YYYY-Www`, e.g. `2026-W17`). It is optional and **convention-only** —
the validator does not require it and does not reject entries without
it. Promotion tooling (`/memory:promote`) writes it; manual edits are
free to set or omit.

**Why ISO-week, not date-time.** Curated YAML lives in the repo and is
reviewable by anyone with access. A precise timestamp on every entry
leaks session timing — "this rule appeared Tuesday 3pm" correlates with
"the incident hit Tuesday 3pm". ISO-week granularity preserves long-
term ordering (useful for audit) while removing intra-week inference.

**When to use it.** Stamp on every promotion. Do not retroactively
backfill — empty `ts_week` for older entries is fine and a deliberate
non-signal.

**Privacy carve-outs.** Highly sensitive entries (incident-learnings
tied to active investigations) may omit `ts_week` entirely; the field
is not a forensic record.

## Type-specific required fields

Each file also carries the template-specific body. See the example
templates for the full shape:

- [`domain-invariants.example.yml`](../../templates/agents/memory/domain-invariants.example.yml)
  adds `rule`, `boundary`, `scope.paths`, `violation_contract`.
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

- [`review-routing-data-format.md`](review-routing-data-format.md) — sibling format for ownership + bug patterns
