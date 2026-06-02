# External Registry Submissions

Track third-party registries / directories we want this package to surface in. Submissions are **human-owner** — they require a GitHub account interacting with another org's PR review or with the GitHub UI to flip settings.

> **Authority** — Phase 2 of [`road-to-product-adoption.md`](../../agents/roadmaps/road-to-product-adoption.md). The autonomous roadmap pass cannot open PRs in third-party repos; this file is the handoff.

## Distribution channels — npm-primary

Per [`ADR-033`](../decisions/ADR-033-distribution-identity-npm-primary.md), the package is **npm-primary, Packagist deprecated-in-place**. Both lenses of the council deliberation (strategic / operational) converged on a single-channel posture: this is the canonical record of which registries we publish to vs. which we treat as legacy.

| Channel | Status | Canonical install | Notes |
|---|---|---|---|
| npm — `@event4u/agent-config` | **Primary** | `npm install @event4u/agent-config` or `npx @event4u/agent-config install` | The release pipeline (`scripts/release.py`) runs `npm publish` exclusively; `package.json` is the source of truth for the published version. |
| Packagist — `event4u/agent-config` | **Deprecated-in-place** | (do not install — see ADR-033) | The 1.0.4 listing is a legacy artefact from the pre-3.x repo namespace. No `composer.json` ships from this repo. Maintainer-side claim/archive action required (see below). |

### Packagist deprecation — human-owner item

The Packagist `event4u/agent-config` listing pins at 1.0.4 from a repository state that no longer exists. The autonomous pipeline cannot retire that listing — it requires a maintainer login at `packagist.org/packages/event4u/agent-config`. Two paths exist; either is acceptable per ADR-033.

- [ ] **Claim + abandoned-flag the package.** Log in at packagist.org, claim the `event4u/agent-config` namespace, set the package to `abandoned` with the replacement pointer `event4u/agent-config` on npm (or the npm package URL as a body note where Packagist's abandoned-replacement field expects a Composer-namespace value, fall back to a `description` field redirect).
- [ ] **OR: leave the listing as legacy + add a description-field redirect.** If claim is blocked or out of scope, edit the listing description to add a one-line `> Deprecated — install via npm: \`@event4u/agent-config\`` so any consumer who lands there sees the correct path.

This item is **owner-owned**, not autonomous; the roadmap explicitly captures it as such (`road-to-distribution-identity.md` Phase 2 Step 1). Mark the chosen path with `[x]` once executed.

### Breaking-change communication

Major-version bumps are policy-correct per [`CONTRIBUTING.md § Versioning policy`](../../CONTRIBUTING.md) (semver — installer-layout changes are major). The auto-generated `CHANGELOG.md § Breaking` section is the **single source of truth** for breaking changes; [`ADR-027`](../decisions/ADR-027-changelog-machine-vs-manual.md) locks the machine-generated path.

Consumers who see a major-version bump should follow:

1. [`CHANGELOG.md § Breaking`](../../CHANGELOG.md#breaking) — the diff between the prior and the new major. Every breaking change carries a Conventional-Commits subject prefixed `feat!:` or with a `BREAKING CHANGE:` footer.
2. The release-line link in the GitHub release entry for the new version (links the auto-generated changelog section).

No bespoke `BREAKING_CHANGES.md` is maintained — the changelog is the authoritative surface.

## Submission status

| # | Registry | URL | Submission shape | Status | PR link |
|---|---|---|---|---|---|
| 1 | `punkpeye/awesome-mcp-servers` | <https://github.com/punkpeye/awesome-mcp-servers> | One-line entry under the agent-tooling section, links to `README.md` hero anchor | ⬜ open | — |
| 2 | `mcp.so` | <https://mcp.so/> | Submit via the directory form; same one-line shape | ⬜ open | — |
| 3 | `mcpservers.org` | <https://mcpservers.org/> | Submit via the directory form; same one-line shape (verify URL current at submission time) | ⬜ open | — |
| 4 | `glama.ai` | <https://glama.ai/> | Submit via the Glama claim flow; same one-line shape — repo `https://github.com/event4u-app/agent-config`, tags `agent-governance`, `mcp`, `skills` | ⬜ open (human-owner: maintainer submits via the Glama claim flow) | — |

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
