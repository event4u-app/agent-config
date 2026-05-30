---
stability: experimental
---

# Skill Discovery Contract

> **Status** · v0 / design · 2026-05-30. Phase 3 of `road-to-leaner-core-and-discovery`.
> **Local-only.** Mirrors [`local-analytics.md`](local-analytics.md): no network egress, no POST,
> no remote Worker. The recommender reads local files only and honours the analytics opt-out.

## Problem

The package ships 220 skills. Both council members named "218-skill paralysis" as the dominant
discoverability risk. This contract defines a **recommendation surface** that turns existing signals
into a short, *explained* shortlist — and explicitly **reuses** signals already on disk. It adds **no**
new always-loaded layer (that would fail the Phase-1 leaner-core premise).

## Input signals (all local, all already on disk)

| Signal | Source | Used for |
|---|---|---|
| Skill catalog | `.agent-src/skills/*/SKILL.md` frontmatter (`name`, `description`, `domain`) | candidate universe + `domain` category |
| Role shortlist | `agents/roles/<role>/skills.yml` (priority-ordered `id` + `why`) | `most-useful-for-role` |
| Local analytics | `~/.event4u/agent-config/workspace/analytics/events.jsonl` (`event`, `data.role`, `data.task`, optional `data.skill`) | `recently-adopted`, `popular-in-role` |

The role `skills.yml` is the strongest signal and is always present; analytics is optional and
degrades gracefully (below).

## Four recommendation classes

| Class | Ranking basis | `why` shape |
|---|---|---|
| `most-useful-for-role` | role `skills.yml` priority order | the shortlist's own `why:` line |
| `related-to-current-task` | skills sharing the `domain` of the role's shortlist skills, not already shortlisted | `same domain (<domain>) as your role's core skills` |
| `recently-adopted` | analytics events in the last 14 days carrying a skill id (`data.skill`), most-recent first | `used <N>d ago in this workspace` |
| `popular-in-role` | analytics skill-events filtered by `data.role`, by frequency | `launched <N>× by the <role> role locally` |

## Explanation requirement — non-negotiable

```
EVERY RECOMMENDATION CARRIES A NON-EMPTY `why`. NEVER AN UNEXPLAINED SCORE.
```

Both council members flagged "opaque / self-referential recommendations without real usage signal" as
the main risk. A result with no `why` is a contract violation. The `why` names the *signal* (role match,
domain adjacency, recent-adoption, role-popularity) — never a bare number.

## Graceful degradation — analytics absent or opted out

Analytics is optional. When the JSONL file is missing, empty, or the opt-out is set
(`AGENT_CONFIG_NO_LOCAL_ANALYTICS` env or `analytics.local: off` config — same checks as
`local-analytics.md`), the two analytics-backed classes do not fabricate signal:

- `recently-adopted` and `popular-in-role` fall back to **role-shortlist order** with an honest `why`
  (`from your role shortlist — no local usage signal yet`).
- `most-useful-for-role` and `related-to-current-task` are unaffected (catalog + role only).

The recommender therefore always returns a useful, explained list — even on a fresh machine with no
analytics history. Today's analytics schema logs `data.task` (not skill ids); the skill-level classes
read the forward-compatible `data.skill` field and degrade to the role-shortlist fallback until it is
populated. No class ever returns an empty `why`.

## Local-only / no-network floor

The recommender opens local files only. It performs no network I/O, writes nothing, and never emits a
prompt or response body. It is read-only over the catalog, the role file, and (if present) the analytics
log. This mirrors `local-analytics.md` and does not lift the 3.1.0 Hard-Floor.

## Surfaces

- CLI / agent: `/skills:discover [role]` → Markdown table (`skill · class · why · first command`).
  Defaults to the active role experience when one is set; otherwise prompts for a role.
- GUI: a right-rail "Suggested skills" strip on the Workspace tab, reusing the `/api/v1/workspace/*`
  bridge (no new infra). Deferrable behind the CLI surface if the employee-roadmap right-rail blocker
  is still open.

## Implementation

`scripts/skill_discovery.py` (≤ 300 LOC). Pure-local, no POST. Honours the analytics opt-out env + config.
Coverage: `tests/test_skill_discovery.py` against a fixture catalog + fixture analytics JSONL.
