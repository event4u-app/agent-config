# Observability Scoping — Design

Addresses **Gap 4** from `agents/roadmaps/product-maturity.md`: observability features
(metrics, events, audit, feedback, reports) are useful for maintainers but irrelevant
— and visible — to end users. Risk: "why are there 5 JSON files I never look at?"

## Principle

Observability is **layered by audience**. Features that serve package maintainers do
not appear in end-user projects by default. The `minimal` profile produces **zero**
observability artefacts in the project tree.

## Audience classification

Every observability feature falls into one of two groups:

| Feature | Audience | Surfaces when | Profile trigger |
|---|---|---|---|
| Skill linter | Package developers | Always (dev only, not in user projects) | All |
| CI summary | PR reviewers | Only when running in CI | All |
| `report-stdout` | Package developers | On explicit request | All |
| `metrics.json` | Package developers | On request + `full` profile | `full`+ |
| `feedback.json` | Package developers, CI | On request + `balanced` profile | `balanced`+ |
| `tool-audit.json` | Package developers | On request + `full` profile | `full`+ |
| Lifecycle reports | Package developers | On request | `full`+ |

**User-facing observability:** CI summary, linter warnings. These deliver direct value
to non-maintainer teams (PR quality, skill health) without requiring setup.

**Developer-facing observability:** metrics, feedback, tool-audit. These exist for
package maintainers — building and evolving the skill catalog. End users should not
see these unless they opt in.

## File creation rules

| File | minimal | balanced | full |
|---|---|---|---|
| `.augment/settings.json` | ✅ (bridge, tiny) | ✅ | ✅ |
| `.agent-settings` | ✅ (personal) | ✅ | ✅ |
| `feedback.json` | ❌ | ✅ | ✅ |
| `metrics.json` | ❌ | ❌ | ✅ |
| `tool-audit.json` | ❌ | ❌ | ✅ |
| Reports (`reports/`) | ❌ | ❌ (on demand only) | ❌ (on demand only) |

The installer (`scripts/install.py`) never creates observability files. They are
created by the runtime package when runtime executes and the matching profile is active.

## Where observability goes

- **User project tree:** only bridge files + `.agent-settings`. Nothing else by default.
- **Runtime data directory:** `storage/agent-runtime/` (gitignored) — created by runtime
  when first needed. Contains `feedback.json`, `metrics.json`, `tool-audit.json`.
- **Reports:** `storage/agent-reports/` (gitignored) — created only by `task report`.
- **CI artefacts:** PR comments + CI run artefacts. Never in the project tree.

## Naming convention

Files surfaced to users should use human-friendly names:
- ✅ `agent-settings` (user edits this)
- ✅ `reports/` (readable by humans)
- ❌ `feedback.json`, `metrics.json` (machine artefacts, go in `storage/`)

## What users see in minimal

After `composer require` + install:

```
project/
├── .agent-settings          # personal settings, gitignored
├── .vscode/settings.json    # bridge (may already exist)
├── .augment/settings.json   # bridge
└── .github/plugin/marketplace.json  # bridge
```

**Four bridge files. No JSON zoo.** That's the promise of `minimal`.

## What developers see on `full`

Additionally:

```
storage/
├── agent-runtime/
│   ├── feedback.json
│   ├── metrics.json
│   └── tool-audit.json
└── agent-reports/           # only after `task report`
    └── <timestamp>/...
```

Both `storage/` paths are gitignored — they contain local data only, not committed.

## Implementation tasks mapped

| Roadmap task | Implementation |
|---|---|
| Classify every observability feature: user-facing vs developer-facing | Audience table above |
| User-facing: CI summary, linter warnings — always available | Already implemented (Taskfile targets) |
| Developer-facing: metrics, feedback, audit — opt-in only | File creation rules above; tied to `cost_profile` |
| No observability files created by default in `minimal` profile | Enforced by runtime package (not yet created) + installer never generates these |
| Document: "Observability features are for package maintainers, not end users" | This document + README "What you get" section |

## Anti-patterns to avoid

- Creating empty observability files during install "so they exist".
- Writing to `storage/` without first creating it and adding to `.gitignore`.
- Surfacing developer-facing metrics in the agent context.
- Using observability files as agent input (covered by `feedback-consumption.md`).

## Open questions

- Should CI summary mention skill health in PR comments on any profile? **Yes** —
  it's user-facing and cheap. No gating.
- Should `task report-stdout` work on `minimal`? **Yes, but empty** — if no data exists,
  it says "no runtime data collected (cost_profile=minimal)" and exits cleanly.
- Gitignore enforcement: installer could ensure `storage/` entries are in `.gitignore`.
  **Defer** — leave it to the runtime package when it exists.

## Related

- `agents/docs/feedback-consumption.md` — how feedback is consumed once collected.
- `agents/docs/runtime-visibility.md` — subtle vs verbose runtime output.
- `agents/docs/vanilla-vs-governed.md` — what users notice on `minimal`.
