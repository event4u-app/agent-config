# Road to Memory Self-Consumption

**Problem.** `agent-config` and `@event4u/agent-memory` are meant to
interoperate in both directions: agent-memory's developers consume
agent-config as an agent-assistance layer, and agent-config's
developers can consume agent-memory as an operational memory backend
while building new skills and rules. Without an explicit clause this
looks like a circular dependency and later engineers will try to
"clean it up" by collapsing one side into the other. This roadmap
freezes the architecture so the bidirectional use stays a feature,
not an accident.

## Scope

Covers three adjacent concerns that all flow from the bidirectional
design:

1. **Dogfooding** — `agent-config` installs `agent-memory` optionally
   for its own development
2. **No circular dependency** — neither package imports the other at
   code level; all interaction is through versioned contracts
3. **Conflict rule** — when the repo-file (authoritative) and the
   operational store return entries for the same key, who wins and
   how is the conflict surfaced

## The two directions

| | agent-memory uses agent-config | agent-config uses agent-memory |
|---|---|---|
| How | Installs this package like any consumer | Optionally installs `@event4u/agent-memory` under `require-dev` / `devDependencies` |
| What it gets | Skills, rules, commands, guidelines for its developers | Operational memory store for learnings about skill-writing, linter rules, installer bugs |
| Learnings flow back via | Cross-project feed ([`agent-memory/road-to-cross-project-learning.md`](agent-memory/road-to-cross-project-learning.md)) | Same-repo `upstream-contribute` skill → PR against this repo |
| Gate | Opt-in per consumer | Opt-in per developer |

The two directions are **symmetric in intent, asymmetric in
mechanism**. Cross-project requires anonymisation (agent-memory is one
consumer among many). Self-consumption is direct — the reflux PR lands
in the repo that produced the learning.

## No circular dependency — clause

Neither package imports the other at runtime. All interaction is
through the contracts below. Attempts to "just add a direct import for
convenience" are rejected at review.

| Interaction | Mechanism | Defined in |
|---|---|---|
| Retrieval | MCP / CLI / file lookup, returning v1 envelopes | [`agent-memory/road-to-retrieval-contract.md`](agent-memory/road-to-retrieval-contract.md) |
| Health check | Same channel, `health()` call | Same spec |
| Signal emission | `/propose-memory` drops file or calls MCP | [`road-to-agent-memory-integration.md`](road-to-agent-memory-integration.md) |
| Storage format | Append-only JSONL, content-addressed drop-ins | [`road-to-memory-merge-safety.md`](road-to-memory-merge-safety.md) |
| Promotion | Drafts PR against this repo's `agents/memory/` | [`agent-memory/road-to-promotion-flow.md`](agent-memory/road-to-promotion-flow.md) |

`composer.json` / `package.json` of `agent-config` declare **no**
`require` entry for `agent-memory`. `suggest` is allowed.

## Bootstrap order

- `agent-config` is installable and fully functional **without**
  `agent-memory`. This is non-negotiable — it is the fallback contract.
- `agent-memory` is installable and usable standalone by any
  MCP-compatible agent **without** `agent-config`. It is not an
  extension of this package.
- When both are present, the integration contract activates. Detection
  happens once per session via `scripts/memory_status.py`.

Consumers never install them in the opposite order as a prerequisite.
Either side can come first.

## Conflict rule: repo vs. operational

When a retrieval call returns candidates for the same logical key from
both sources, the rule is:

```
REPO WINS. OPERATIONAL AUGMENTS. OPERATIONAL NEVER CONTRADICTS SILENTLY.
```

Specifically:

- **Same `id`, both sides present** → the repo entry is returned. The
  operational entry is suppressed but accounted for (see `shadowed_by`
  below).
- **Repo entry says `status: deprecated`, operational says `status:
  active`** → deprecated wins. Operational cannot revive a retired
  entry.
- **Same logical key (e.g., same `path` + `type`), different `id`s** →
  both returned. Agent sees both and weights repo higher by construction
  (repo entries carry higher explicit confidence in the curated files).
- **Repo has no entry, operational has one** → operational is returned
  with `source: "operational"` and its own `trust` score.

### Shadow semantics

When the backend suppresses an operational entry in favour of a repo
entry, the repo entry in the response carries `shadowed_by: null` and
a separate debug field `shadows: [<operational_id>]`. The suppressed
entry is not returned in `entries[]` but shows up in `slices[type].shadowed_count`
for observability. Hygiene (`scripts/check_memory.py`) flags high
shadow counts as candidates for repo-entry retirement or operational
cleanup.

Wire-level detail: [`agent-memory/road-to-retrieval-contract.md`](agent-memory/road-to-retrieval-contract.md).

## Dogfooding pattern for this repo

For `agent-config` developers to benefit from operational memory while
building skills and rules:

1. Optional install in a developer sandbox (not in CI by default):
   `composer require --dev event4u/agent-memory` or MCP-based.
2. `memory_status.py` reports `present`; skills transparently use the
   operational backend.
3. Learnings captured during skill-writing (via `learning-to-rule-or-skill`
   skill, `/do-and-judge` post-verdict, `receiving-code-review`) drop
   into the operational store as quarantine entries.
4. Promotion to shared knowledge happens through the **same-repo reflux
   path** below — not the cross-project feed, since the consumer and
   the target repo are identical.

## Reflux path — same-repo self-learnings

A learning captured inside `agent-config` while developing
`agent-config` does not need anonymisation; it needs a clean PR path.

- Signal written to the operational store (quarantine) OR to
  `agents/memory/intake/learnings.jsonl` (absent path).
- `/memory-promote <id>` drafts a PR against `agent-config` itself.
- The draft lands as either a new entry in the content-addressed
  curated layout, or as a skill/rule/guideline change under
  `.agent-src.uncompressed/` (if the learning pattern is
  "always do X" rather than "this fact is true").
- Routing between "entry" and "skill/rule" is the existing five-stage
  pipeline in [`road-to-curated-self-improvement.md`](road-to-curated-self-improvement.md).

Net effect: `agent-config` is the **first production consumer** of its
own cross-project learning contract. If the reflux path does not work
for us, it will not work for any other consumer.

## Phases

### Phase 0 — clauses freeze

- [ ] This roadmap accepted; no-circular-dep clause referenced from
      contribution docs
- [ ] `agent-config` `composer.json` / `package.json` reviewed — no
      hard dependency on agent-memory; `suggest` only

### Phase 1 — conflict rule enforcement

- [ ] Backend detection helper returns the conflict rule's expected
      output when both sources have matching `id`
- [ ] Retrieval conformance fixture covers the four cases above
- [ ] `scripts/check_memory.py` reports shadow counts weekly

### Phase 2 — dogfooding readiness

- [ ] `agent-memory` installable locally against this repo with one
      command
- [ ] Learnings captured during agent-config development land in its
      own operational store
- [ ] One `/memory-promote` walkthrough documented end-to-end against
      this repo itself

## Acceptance criteria

- **Phase 0** ships when: the two package manifests show no hard
  dependency, every cross-link in this doc resolves, contribution
  docs reference the clause.
- **Phase 1** ships when: a deliberately conflicting test fixture
  produces the documented winner; shadow counts appear in weekly
  hygiene output.
- **Phase 2** ships when: a real learning captured in an agent-config
  development session has been promoted into a committed skill or
  curated entry via the reflux path.

## Open questions

- **Opt-in declaration.** Should `.agent-project-settings` in this
  repo declare `memory.dogfood: true` explicitly, or is the presence
  of `agent-memory` in `require-dev` enough signal? Leaning
  **explicit** — avoids accidental activation.
- **Shadow-count threshold for hygiene alerts.** Start at 10 per
  entry per week? Tune after the first hygiene run.
- **Retirement path for repo entries surpassed by operational data.**
  If operational data consistently outweighs a repo entry (e.g., the
  pattern no longer holds), should the hygiene check propose a repo
  retirement PR? Defer; needs real data.

## See also

- [`road-to-project-memory.md`](road-to-project-memory.md) — curated
  files and settings layering; this doc extends its conflict story
- [`road-to-agent-memory-integration.md`](road-to-agent-memory-integration.md) —
  caller side; this doc governs what the caller does with conflicts
- [`agent-memory/road-to-retrieval-contract.md`](agent-memory/road-to-retrieval-contract.md) —
  wire-level shape of `shadowed_by` / `shadows` fields
- [`agent-memory/road-to-cross-project-learning.md`](agent-memory/road-to-cross-project-learning.md) —
  other-direction counterpart; reflux is this doc, cross-project is that
- [`road-to-curated-self-improvement.md`](road-to-curated-self-improvement.md) —
  pipeline that reflux PRs flow through
- [`road-to-memory-merge-safety.md`](road-to-memory-merge-safety.md) —
  on-disk format for the fallback path
