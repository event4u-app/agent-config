# Distribution Checklist

External marketplace, registry, and marketing actions for
`event4u/agent-config`. **Human-gated work.** Items here cannot be
executed by an autonomous agent — they require credentials, manual
web-form submissions, terminal-recording on a maintainer's machine,
content authoring, or external approval processes. Tracked separately
from the roadmap dashboard so the agent step counter stays honest.

## Origin

Lifted from archived
[`agents/roadmaps/archive/road-to-simplicity-and-everywhere.md`](../agents/roadmaps/archive/road-to-simplicity-and-everywhere.md)
Phase 7 (S34–S38) after a follow-up AI Council review flagged the
category error of tracking external-action items inside an
engineering roadmap. See the "Post-merge addendum" in that archive
for the full lessons-learned.

## Status vocabulary

- **Prepared** — substrate (config file, package source, copy) committed.
- **Submitted** — handed to the external queue.
- **In Review** — accepted into review queue, awaiting approval.
- **Live** — listing public, install path verified end-to-end.
- **Blocked** — gated on an external dependency; see Notes.

`[ ]`/`[x]` markers are **deliberately not used** here — these items
are not roadmap steps.

## Items

### Anthropic Claude Code plugin marketplace

- **Status:** Prepared
- **Owner:** maintainer
- **Last Reviewed:** 2026-05-12
- **Substrate:** [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json)
  committed and current. Slug `event4u/agent-config` is canonical
  across all listings.
- **Doc anchor:** [`docs/setup/per-ide/claude-code.md`](setup/per-ide/claude-code.md)
  § "Plugin marketplace".
- **Action:** Submit via Anthropic plugin marketplace review queue
  per current Claude Code plugin docs.
- **Pre-conditions:** none (substrate ready).
- **Notes:** Source of truth for naming — Cursor / Smithery listings
  reference this slug.

### Cursor 2026 marketplace listing

- **Status:** Prepared
- **Owner:** maintainer
- **Last Reviewed:** 2026-05-12
- **Substrate:** [`templates/marketing-copy.yml`](../templates/marketing-copy.yml)
  is the single source for listing copy across surfaces.
- **Doc anchor:** [`docs/setup/per-ide/cursor.md`](setup/per-ide/cursor.md)
  § "Marketplace install".
- **Action:** Submit to Cursor's 2026 marketplace listing process.
- **Pre-conditions:** Anthropic listing live (link as primary source
  to avoid drift).
- **Notes:** Per "Decisions" in archived roadmap — Anthropic listing
  is canonical, others reference by stable slug.

### Smithery (MCP server registry)

- **Status:** Blocked
- **Owner:** maintainer
- **Last Reviewed:** 2026-05-12
- **Substrate:** none yet — MCP server itself is not publishable.
- **Doc anchor:** none yet.
- **Action:** Submit to Smithery once the MCP server can be installed
  and exercised end-to-end.
- **Pre-conditions:** [`road-to-mcp-full-coverage.md`](../agents/roadmaps/archive/road-to-mcp-full-coverage.md)
  Phase 3 (Selective Implementation) shipped.
- **Notes:** **Do not submit before the gate.** Premature listing
  produces a bad first impression and is hard to retract.

### npm: `@event4u/create-agent-config`

- **Status:** Prepared
- **Owner:** maintainer
- **Last Reviewed:** 2026-05-12
- **Substrate:** [`packages/create-agent-config/`](../packages/create-agent-config/)
  source is ready; the wrapper clones the repo to a temp dir, runs
  `scripts/install`, then deletes the temp dir.
- **Doc anchor:** [`docs/installation.md`](installation.md) §
  "npx one-liner".
- **Action:** `npm publish --access public` from `packages/create-agent-config/`.
- **Pre-conditions:** npm registry credentials for the `@event4u`
  scope.
- **Notes:** Public scope, MIT-licensed. Verify `npx
  @event4u/create-agent-config init` in an empty directory before
  declaring Live.

### GitHub repo topics + tagline

- **Status:** Prepared
- **Owner:** maintainer
- **Last Reviewed:** 2026-05-12
- **Substrate:** Topic list + tagline copy live in
  [`templates/marketing-copy.yml`](../templates/marketing-copy.yml).
- **Doc anchor:** none (GitHub-native).
- **Action:** Apply via `gh repo edit` (or repo Settings → General).
  Topics: `agent`, `claude-code`, `cursor`, `windsurf`, `cline`,
  `mcp`, `agents-md`, `skill-files`. Description: one-line tagline
  matching the marketplace copy.
- **Pre-conditions:** none.
- **Notes:** Per `scope-control` rule, repo-settings changes are
  permission-gated and run by the maintainer.

### Medium / dev.to articles + conference CFP

- **Status:** Blocked
- **Owner:** unassigned
- **Last Reviewed:** 2026-05-12
- **Substrate:** none — copy authored per submission.
- **Doc anchor:** none yet.
- **Action:** Owner authors articles (Medium / dev.to), submits CFP
  to relevant conferences. Cadence aligned to the 1 day/week
  marketing cap from `road-to-distribution-and-adoption.md` Phase 1.
- **Pre-conditions:** owner + budget assigned; Phase 1 pre-conditions
  1–4 from the distribution roadmap met (Thinking A+C ≥80%,
  post-pr29 1.15.0, `docs/contracts/` policy active).
- **Notes:** Origin: `road-to-distribution-and-adoption.md` H4 (moved
  here 2026-05-11 after AI Council convergence on category-error
  filter: "owner + budget assigned first" is non-agent action). The
  roadmap step is `[-]` cancelled with a back-reference.

### Screencasts / asciinema casts per primary surface

- **Status:** Blocked
- **Owner:** unassigned
- **Last Reviewed:** 2026-05-12
- **Substrate:** the `## Verification` block in every
  [`docs/setup/per-ide/<surface>.md`](setup/per-ide/) page is the
  cast script — agent-shipped, ready to record against.
- **Doc anchor:** [`docs/setup/per-ide/claude-code.md`](setup/per-ide/claude-code.md),
  [`docs/setup/per-ide/cursor.md`](setup/per-ide/cursor.md),
  [`docs/setup/per-ide/windsurf.md`](setup/per-ide/windsurf.md),
  [`docs/setup/per-ide/claude-desktop.md`](setup/per-ide/claude-desktop.md).
- **Action:** Record asciinema cast on a real maintainer machine
  following each surface's Verification block; embed under the
  surface doc.
- **Pre-conditions:** all four per-IDE docs landed with stable
  Verification blocks (shipped via archived
  `road-to-simplicity-and-everywhere.md`).
- **Notes:** Origin: `road-to-distribution-and-adoption.md` H5
  (moved here 2026-05-11 after AI Council convergence — terminal
  capture on a real machine is non-agent action; substrate was
  already shipped, the cast itself is the human-gated step). The
  roadmap step is `[-]` cancelled with a back-reference.

## Review cadence

Refresh `Last Reviewed` each time an item is revisited or its status
changes. Stale items (`Last Reviewed` older than 90 days while not
`Live`) should surface in a manual review pass — no automated
enforcement, this file is deliberately out of the agent's execution
loop.

## See also

- [`agents/roadmaps/archive/road-to-simplicity-and-everywhere.md`](../agents/roadmaps/archive/road-to-simplicity-and-everywhere.md)
  — origin (Phase 7, S34–S38) and lessons-learned addendum.
- [`agents/roadmaps/road-to-distribution-and-adoption.md`](../agents/roadmaps/road-to-distribution-and-adoption.md)
  § "External distribution (human-gated, not agent-executable)" —
  sibling roadmap. H4 (Medium / CFP) and H5 (screencasts) are
  `[-]` cancelled there with back-references to the entries above.
- [`agents/roadmaps/road-to-mcp-full-coverage.md`](../agents/roadmaps/archive/road-to-mcp-full-coverage.md)
  Phase 3 — pre-condition for the Smithery item.
