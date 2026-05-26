# External Registry Submissions

Track third-party registries / directories we want this package to surface in. Submissions are **human-owner** — they require a GitHub account interacting with another org's PR review or with the GitHub UI to flip settings.

> **Authority** — Phase 2 of [`road-to-product-adoption.md`](../../agents/roadmaps/road-to-product-adoption.md). The autonomous roadmap pass cannot open PRs in third-party repos; this file is the handoff.

## Submission status

| # | Registry | URL | Submission shape | Status | PR link |
|---|---|---|---|---|---|
| 1 | `punkpeye/awesome-mcp-servers` | <https://github.com/punkpeye/awesome-mcp-servers> | One-line entry under the agent-tooling section, links to `README.md` hero anchor | ⬜ open | — |
| 2 | `mcp.so` | <https://mcp.so/> | Submit via the directory form; same one-line shape | ⬜ open | — |
| 3 | `mcpservers.org` | <https://mcpservers.org/> | Submit via the directory form; same one-line shape (verify URL current at submission time) | ⬜ open | — |

## Submission template

Use this exact text for the awesome-list entry. Adjust the link anchor per directory.

```markdown
- [event4u/agent-config](https://github.com/event4u-app/agent-config#readme) — Universal AI Agent OS. Audited skills, governance rules, commands, and templates for Claude Code, Cursor, Windsurf, Copilot. Bring your own provider.
```

## PR body update — 3.2.0 reality

When the maintainer opens the PR / posts the directory entry, the
description block carries the concrete reality the 3.2.0 review
named. Reviewer verbatim quote: *"deutlich mehr vorzuweisen als bei
jedem vorherigen Erwähnungszeitpunkt."* The numbers below mirror the
3.2.0 release notes and the `task adoption:status` snapshot from
that release; refresh them before posting if a later release has
shipped.

```
event4u/agent-config 3.2.0 ships:

- 4929 tests across Python + TypeScript matrix (Linux + macOS).
- /knowledge cluster — local-only document ingestion via markitdown;
  per-namespace memory_retrieve with trust scoring.
- Three role experiences (galabau / content-creator / consultant) +
  daily workspace browser surface in the modern Preact shell.
- Cinematic AI-video pipeline (/video:from-script, /video:scene,
  /video:storyboard, /video:stitch) — provider-agnostic; dry-run
  default; the package never sees API keys.
- 9 Iron-Law rules + tier-1/2 routed kernel; ai-council
  second-opinion loop for high-impact decisions.

Bring your own provider (Anthropic / OpenAI / Google / Cloudflare).
No SaaS; no remote sync; npx-quickstart installs in ~3 minutes.
```

Drop this block into the PR description once and reuse it across
the three registries; it is the "deutlich mehr vorzuweisen" frame
condensed to a half-screen.

## Submission checklist

Before opening any submission PR:

- [ ] `README.md` hero block is the current shape (no stale claims).
- [ ] `Public install smoke (3 OS × 2 Node)` badge is green on `main` for the last 3 cron cycles.
- [ ] `package.json` `keywords` mirror `.github/topics.yml` `topics:` list (audit per Phase 2.4).
- [ ] `LICENSE` and `CONTRIBUTING.md` are current.

## GitHub Discussions

Roadmap Phase 2 Step 5 calls for opening three Discussions categories: `Show & Tell`, `Q&A`, `Ideas`. This requires repo-admin in the GitHub UI (Settings → Features → Discussions). The README hero should then link to Discussions, not Issues, for first-touch questions.

- [ ] Discussions enabled at `https://github.com/event4u-app/agent-config/discussions`
- [ ] Three categories created: `Show & Tell`, `Q&A`, `Ideas` (no more — keep the surface narrow)
- [ ] README hero updated to link to Discussions for first-touch questions

## Audit cadence

Run a topic / keyword reality check **every quarter**:

1. Run three search queries on GitHub: `AI agent governance`, `MCP skill registry`, `AI video pipeline`.
2. For each, verify this repo surfaces within page 2.
3. If not, audit `.github/topics.yml` for missing topics and `package.json` `keywords` for alignment.
4. Update `notes:` / `equivalents:` in `.github/topics.yml` and re-run `task sync-github-topics`.

## See also

- [`.github/topics.yml`](../../.github/topics.yml) — source of truth for GitHub topics.
- [`package.json`](../../package.json) — `keywords` array, must mirror topics by category.
- [`docs/distribution/topics-equivalents-decay-policy.md`](./topics-equivalents-decay-policy.md) — when to add / retire `equivalents:` entries.
- [`docs/distribution/mcp-submission-checklist.md`](./mcp-submission-checklist.md) — MCP-specific submission checklist.
- [`agents/roadmaps/road-to-product-adoption.md`](../../agents/roadmaps/road-to-product-adoption.md) — parent roadmap.
