# Registry Submissions — tracking sheet

> The one ledger of where this package has asked to be listed, and what the
> upstream answered. The channel posture (npm-primary, Packagist
> deprecated-in-place) and the submission template live in
> [`registries.md`](registries.md); every submission row lives here. No roadmap
> owns this file — it is a standalone operational ledger, kept true by the
> re-read rule below rather than by a parent plan.

## Why a separate tracking sheet

`registries.md` defines **what** to submit (the entry template, the
audit cadence, the GitHub Discussions setup). This file records
**what happened** — one row per submission attempt, with its upstream, the
last time that upstream was actually read, and maintainer notes. Splitting
them keeps `registries.md` editable as the submission shape evolves; this file
accumulates history.

## Status legend

| Status | Meaning |
|---|---|
| `pending` | Pre-submission. Entry text staged but the maintainer has not opened the PR / submitted the form yet. |
| `submitted` | PR opened or form submitted. The upstream has not answered yet. |
| `accepted` | Upstream merged the PR or the directory lists the package. |
| `rejected` | Upstream closed the attempt without listing it — declined in review, or closed for unmet requirements or inactivity. The notes say which. |
| `stalled` | ≥ 60 days in `submitted` while a live read shows the upstream **still open** and silent. A row whose upstream has answered is never `stalled`; it takes the answer. |

## Reading rule

**Re-read threshold:** 30 days.

A status is a claim about someone else's repository or website, and it decays.
Every row records the date its upstream was last **successfully** read in
`Last read`. A row with no reading, or one older than the threshold, is
reported by `adoption_status` as `unread` whatever its status says — the sheet
does not get to be believed on its own word.

| Upstream kind | What `Upstream ref` holds | How it is read |
|---|---|---|
| `github-pr` | `owner/repo#N` | `gh pr view N --repo owner/repo --json state,closedAt,mergedAt` |
| `listing-page` | the package's page on the directory | one fetch; HTTP 200 is `listed`, 404 is `not-listed`, anything else is unread |
| `registry-query` | a registry search URL returning `metadata.count` | one fetch; a count above 0 is `listed` |

`./scripts-run src/scripts/adoption_status --check-upstream` performs those
reads and reports `answered-closed`, `answered-merged`, `stalled`, `open`,
`listed`, `not-listed` or `unreachable` per row. Without the flag it reads
nothing, reports from this sheet only, and says so on stderr.

## Tracking rows

| # | Registry | Submission shape | Status | Upstream kind | Upstream ref | Last read | Date | Maintainer notes |
|---|---|---|---|---|---|---|---|---|
| 1a | `punkpeye/awesome-mcp-servers` — attempt 1 | One-line entry under the Developer-Tools section + Glama score badge | `rejected` | `github-pr` | `punkpeye/awesome-mcp-servers#6865` | 2026-10-16 | 2026-05-25 | Closed unmerged 2026-06-11 by the upstream maintainer: the Glama quality score had not been evaluated yet ("shows '?' — no grade yet"). Not a review rejection of the entry. Read 2026-10-16: `CLOSED`, `mergedAt: null`. |
| 1b | `punkpeye/awesome-mcp-servers` — attempt 2 | One-line entry; PR via `scripts/mcp_registry_submit.sh` | `rejected` | `github-pr` | `punkpeye/awesome-mcp-servers#9607` | 2026-10-16 | 2026-07-07 | Closed unmerged 2026-09-07 for inactivity ("The author has not responded or updated the PR since July 7, 2026"). Outstanding at closing: Glama listing badge and a permitted language emoji tag after the link. **This row read `submitted`, noted as still waiting on review, for 39 days after the close**; corrected 2026-10-16 from a live `gh pr view` (`CLOSED`, `closedAt: 2026-09-07`, `mergedAt: null`). |
| 2 | `mcp.so` | Directory form submission (web form, no programmatic API) | `accepted` | `listing-page` | <https://mcp.so/server/agent-config/event4u-app> | 2026-10-16 | 2026-06 | Server page live: HTTP 200, title "@event4u/agent Config MCP Server", links `event4u-app/agent-config`. `registries.md` recorded this form as submitted (maintainer-confirmed 2026-06) while this sheet said `pending`; the live page settles it. |
| 3 | `mcpservers.org` | Directory form submission (web form) | `submitted` | `listing-page` | <https://mcpservers.org/servers/event4u-app/agent-config> | — | 2026-06 | `registries.md` recorded this form as submitted (maintainer-confirmed 2026-06); this sheet said `pending`. The 2026-10-16 read returned HTTP 403 to both an automated and a browser user agent, so the status is the maintainer's word, **not** a reading — the row stays `unread` until a human checks the site. |
| 4 | Official MCP Registry (`registry.modelcontextprotocol.io`) | `server.json` publish via `mcp-publisher` CLI (GitHub-auth'd) | `pending` | `registry-query` | <https://registry.modelcontextprotocol.io/v0/servers?search=io.github.event4u-app> | 2026-10-16 | — | Not published: the 2026-10-16 query for `io.github.event4u-app` returned `"count":0`. Paperwork complete 2026-07-27: `mcpName` in package.json, `mcp-name:` README marker, `dist/mcp/server.json` emitted by `build:mcp-manifest`, version- and name-equality gated in `lint_mcp_registry_manifest`. **Blocker:** the publish needs the maintainer's interactive GitHub login. |
| 5 | `glama.ai` | Server page; score badge used by the awesome-list entry | `accepted` | `listing-page` | <https://glama.ai/mcp/servers/event4u-app/agent-config> | 2026-10-16 | 2026-06-08 | Server page live: HTTP 200, title "@event4u/agent-config by event4u-app". Moved here from `registries.md`, which recorded it listed on 2026-06-08. |

Two attempts at the awesome list exist, 1a and 1b. Neither was declined on its
content; both closed on upstream listing requirements (a Glama quality score,
then a badge and an emoji tag) that were not met in time.

## How to update a row

When a row transitions, or whenever its upstream is read:

1. **Any read.** Set `Last read: YYYY-MM-DD` to the date of a **successful**
   read, and put what it returned in the notes. A failed read changes nothing
   but the notes — it is not a reading.
2. **`pending` → `submitted`.** Set `Status: submitted`, `Date: YYYY-MM-DD`, and the upstream ref. Add one-sentence maintainer note (e.g. "PR #142; reviewer assigned").
3. **`submitted` → `accepted`.** Set `Status: accepted`. Append the merge timestamp to the maintainer notes. Cross-link the merge commit / form-confirmation in the notes.
4. **`submitted` → `rejected`.** Set `Status: rejected`. Append the stated reason verbatim (or paraphrase if the conversation is verbal), including "closed for inactivity" where that is what happened.
5. **`submitted` → `stalled`.** Only when `--check-upstream` reports the row `stalled`: still open, no answer, ≥ 60 days.
6. **A new attempt at a registry already in the sheet** gets its own row with a letter suffix (`1c`), never an overwrite of the earlier attempt.

The dates are UTC.

## Maintainer-side checklist

Before flipping a row from `pending` to `submitted`:

- [ ] The `README.md` hero block is current (no stale claims about deferred features).
- [ ] `task ci:status --branch main` is green (per `ci-green-floor.md`).
- [ ] The submission template in `registries.md` § Submission template matches the package's current positioning.
- [ ] The PR body (or form description) cites concrete reality, not aspiration — the ledger-bound submission body in `registries.md` is the text to use.

If any row stays `pending` for more than four weeks, the maintainer
re-validates the readiness checklist; positioning that was current
in week 1 can age out by week 4.

## Staged owner actions — none of these is done

Every item below is an externally visible act that needs a maintainer login.
The text is staged so the session is a paste, not a drafting exercise. Each is
**pending**; nothing in this file or in any roadmap records one as done until
the row above changes on a live read. The owner's queue for these acts is the
bus-factor external-actions stub in the roadmap tree. Staged 2026-10-16.

### Row 1 — a third awesome-list attempt (`1c`) — pending

Only worth opening once the two requirements both earlier attempts closed on
are met: the Glama page carries a quality score, and the entry carries a
permitted emoji tag. The entry line, with the TypeScript tag the upstream's
check asked for:

```markdown
- [event4u/agent-config](https://github.com/event4u-app/agent-config#readme) 📇 — Universal AI Agent OS. Audited skills, governance rules, commands, and templates for Claude Code, Cursor, Windsurf, Copilot. Bring your own provider. [![event4u-app/agent-config MCP server](https://glama.ai/mcp/servers/event4u-app/agent-config/badges/score.svg)](https://glama.ai/mcp/servers/event4u-app/agent-config)
```

The badge URL is the one the upstream's own check posted on attempt 1a; confirm
it renders a grade, not `?`, before pasting.

### Row 2 — `mcp.so` — no act needed

The live read shows the listing exists. Nothing to submit.

### Row 3 — `mcpservers.org` — pending (check first)

First open <https://mcpservers.org/> in a browser and search for
`agent-config`. If the package is listed, record the date in `Last read` and
set `accepted`. If it is not, submit the form with this description:

```text
event4u/agent-config — Universal AI Agent OS. Audited skills, governance rules, commands, and templates for Claude Code, Cursor, Windsurf, Copilot. Bring your own provider. https://github.com/event4u-app/agent-config
```

### Row 4 — Official MCP Registry — pending

From a clean checkout of `main` at the released version:

```bash
npm run build:mcp-manifest
cd dist/mcp
mcp-publisher login github
mcp-publisher publish
```

`mcp-publisher publish` reads `./server.json` by default; confirm with
`mcp-publisher publish --help` before running. Afterwards the
`registry-query` URL in row 4 should return a count above 0.

## The official plugin directory — gated, not a form

The official Claude Code plugin directory is **not** a pending row, because the
route is not open: `.claude-plugin/marketplace.json:8` describes the listing as
a bootstrap shim, "**DEPRECATED as a content channel**", whose hooks do nothing
without a separate npm install. A directory entry for a plugin that does not
function on its own is not something to submit. Whether the marketplace
listing should stop being a shim is an open product question about what the
plugin is; this ledger records the gate and proposes no change to it.

## Adoption-tracking signal

Row counts are reported, never used as a condition: no plan, release or gate in
this package waits on how many rows reach `accepted` (ADR-216 D5). The score
this section once fed belonged to a retired plan and is no longer kept.

## See also

- [`registries.md`](registries.md) — channel posture, submission template, audit cadence, Discussions setup.
- [`scripts/mcp_registry_submit.sh`](../../src/scripts/mcp_registry_submit.sh) — automation that opened attempt 1b.
- [`mcp-submission-checklist.md`](mcp-submission-checklist.md) — MCP-specific pre-submission floor.
- `task adoption:status` — one-screen dashboard; `-- --check-upstream` for live readings.
