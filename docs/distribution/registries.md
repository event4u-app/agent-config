# External Registry Submissions

Track third-party registries / directories we want this package to surface in. Submissions are **human-owner** — they require a GitHub account interacting with another org's PR review or with the GitHub UI to flip settings.

> **Authority** — Phase 2 of [`road-to-product-adoption.md`](../../agents/roadmaps/road-to-product-adoption.md). The autonomous roadmap pass cannot open PRs in third-party repos; this file is the handoff.

## Distribution channels — npm-primary

Per [`ADR-033`](../decisions/ADR-033-distribution-identity-npm-primary.md), the package is **npm-primary, Packagist deprecated-in-place**. Both lenses of the council deliberation (strategic / operational) converged on a single-channel posture: this is the canonical record of which registries we publish to vs. which we treat as legacy.

| Channel | Status | Canonical install | Notes |
|---|---|---|---|
| npm — `@event4u/agent-config` | **Primary** | `npm install @event4u/agent-config` or `npx @event4u/agent-config install` | The release pipeline (`src/scripts/release.ts`) runs `npm publish` exclusively; `package.json` is the source of truth for the published version. |
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
| 1 | `punkpeye/awesome-mcp-servers` | <https://github.com/punkpeye/awesome-mcp-servers> | One-line entry under the Developer-Tools section + Glama score badge | ❌ **PR closed unmerged 2026-06-11** (verified live 2026-07-25 via `gh pr view 6865`; this row previously read "PR open" for six weeks) | <https://github.com/punkpeye/awesome-mcp-servers/pull/6865> |
| 2 | `mcp.so` | <https://mcp.so/> | Submit via the directory form; same one-line shape | ✅ submitted (maintainer-confirmed 2026-06) | — |
| 3 | `mcpservers.org` | <https://mcpservers.org/> | Submit via the directory form; same one-line shape (verify URL current at submission time) | ✅ submitted (maintainer-confirmed 2026-06) | — |
| 4 | `glama.ai` | <https://glama.ai/mcp/servers/event4u-app/agent-config> | Server page live; score badge embedded in the awesome-mcp-servers entry (PR #6865) | ✅ listed (server page + badge return HTTP 200, verified 2026-06-08) | <https://glama.ai/mcp/servers/event4u-app/agent-config> |

## Submission template

Use this exact text for the awesome-list entry. Adjust the link anchor per directory.

```markdown
- [event4u/agent-config](https://github.com/event4u-app/agent-config#readme) — Universal AI Agent OS. Audited skills, governance rules, commands, and templates for Claude Code, Cursor, Windsurf, Copilot. Bring your own provider.
```

## Submission body — ledger-bound, version-agnostic

Reuse this block in any directory submission or PR description.

It deliberately carries **no artefact counts and no version number.** The block
this replaced described version 3.2.0 with figures like "4929 tests" and role
experiences that no longer exist; it sat here for months while the package
reached 9.7.0, because this file is not scanned by the artefact-count gate
(it is now — see § Drift guard). A stale number on a public growth surface is
precisely what this package positions against, so the shape below cannot rot:
every figure resolves through [`docs/CLAIMS.md`](../CLAIMS.md), and anything you
add needs a ledger entry or it does not go in.

```
event4u/agent-config — a governance and content layer for AI coding agents,
compiled into each host's native format. Bring your own provider: no SaaS, no
remote sync, and no background daemon (claim: no-runtime-daemon).

What is different is falsifiability. Every public claim binds to evidence a
skeptic can reproduce on a fresh checkout, and the runs where the layer changed
nothing are published too (claim: positioning-honest-nulls). The measured wedge
is deliberately narrow: on weak or cheap hosts the `essential` tier transplants
scope and downstream-change discipline at a measured 1.71x corpus cost, and it
switches itself off on hosts where the effect measured null.

Start at the proof, not the catalog:
https://event4u-app.github.io/agent-config/proof/
```

Before pasting, verify: `task check-claims` is green on `main`, and each
`claim:` id above still resolves to a `backed` entry. Artefact counts belong in
the README badges (`update_counts` owns them) — never hand-typed into a listing.

## Drift guard

`docs/distribution/registries.md` is in
[`check_artefact_count_messaging`](../../src/scripts/check_artefact_count_messaging.ts)
`SURFACES`, so any artefact count that appears here must match the canonical
number or CI fails. That is the structural fix for the rot described above:
the previous block went stale silently because nothing watched this file.

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
