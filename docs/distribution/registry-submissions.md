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

**An upstream that blocks automated reads** is a standing condition, not a
failed attempt to retry. Before recording it as unread, try a real headless
browser (Playwright's Chromium is already in `node_modules`): a bot check that
refuses `curl` under every user agent can still serve the page to a browser, as
`mcpservers.org` did on 2026-10-17. A browser read is a reading — set
`Last read` and the status from it, and say in the notes that the route was a
browser, because `--check-upstream` uses `curl` and will keep reporting the row
`unreachable`. Only when the browser is refused too, leave `Last read` empty and
record the attempt, its date and what it returned in the notes.

`./scripts-run src/scripts/adoption_status --check-upstream` performs those
reads and reports `answered-closed`, `answered-merged`, `stalled`, `open`,
`listed`, `not-listed` or `unreachable` per row. Without the flag it reads
nothing, reports from this sheet only, and says so on stderr.

A submission is done when the entry is live, not when it went out. So the same
live read also names an **action** wherever the sheet and the upstream disagree
in a way that needs a person: `sheet-behind` (a `pending` or `submitted` row
whose upstream closed, merged or is now listed), `needs-response` (an open pull
request with changes requested), `listing-lost` (an `accepted` listing that now
reads `not-listed`) and `listing-stale` (the registry's latest version lags
`package.json`). `--fail-on-action` exits 2 on any of them, and
`release-adjacent-health.yml` runs it daily on `main`, so a drifted row turns
red within a day without anyone opening a session. One unreachable read is
never an action — an outage does not red the watcher — but an `accepted` or
`submitted` row whose `Last read` is older than the re-read threshold while its
upstream stays unreachable is `read-overdue`: row 3, behind a bot check, reds
once a month until someone reads it through a headless browser.

## Tracking rows

| # | Registry | Submission shape | Status | Upstream kind | Upstream ref | Last read | Date | Maintainer notes |
|---|---|---|---|---|---|---|---|---|
| 1a | `punkpeye/awesome-mcp-servers` — attempt 1 | One-line entry under the Developer-Tools section + Glama score badge | `rejected` | `github-pr` | `punkpeye/awesome-mcp-servers#6865` | 2026-10-17 | 2026-05-25 | Closed unmerged 2026-06-11 by the upstream maintainer: the Glama quality score had not been evaluated yet ("shows '?' — no grade yet"). Not a review rejection of the entry. Read 2026-10-16 and again 2026-10-17: `CLOSED`, `closedAt: 2026-06-11`, `mergedAt: null`. |
| 1b | `punkpeye/awesome-mcp-servers` — attempt 2 | One-line entry; PR via `scripts/mcp_registry_submit.sh` | `rejected` | `github-pr` | `punkpeye/awesome-mcp-servers#9607` | 2026-10-17 | 2026-07-07 | Closed unmerged 2026-09-07 for inactivity ("The author has not responded or updated the PR since July 7, 2026"). Outstanding at closing: Glama listing badge and a permitted language emoji tag after the link. **This row read `submitted`, noted as still waiting on review, for 39 days after the close**; corrected 2026-10-16 from a live `gh pr view` (`CLOSED`, `closedAt: 2026-09-07`, `mergedAt: null`). Re-read 2026-10-17: unchanged. |
| 1c | `punkpeye/awesome-mcp-servers` — attempt 3 | One-line entry under Developer Tools with the Glama score badge and the 📇 🏠 🍎 🪟 🐧 markers; PR title ends `🤖🤖🤖` (the list's agent fast-track) | `submitted` | `github-pr` | `punkpeye/awesome-mcp-servers#17444` | 2026-10-24 | 2026-10-24 | Opened 2026-10-24 by an agent under the owner's go of the same day (`tier-b-go` in `later/road-to-listings-the-owner-submits`). Preconditions read before opening: the badge renders grade A, the upstream CONTRIBUTING is unchanged, no entry for the package exists, and an `initialize` + `tools/list` handshake against the published 17.2.1 package succeeded with no credentials. The daily watcher reds this row on changes requested or on a close the sheet has not recorded. |
| 2 | `mcp.so` | Directory form submission (web form, no programmatic API) | `accepted` | `listing-page` | <https://mcp.so/server/agent-config/event4u-app> | 2026-10-17 | 2026-06 | Server page live: HTTP 200, title "@event4u/agent Config MCP Server", links `event4u-app/agent-config`. `registries.md` recorded this form as submitted (maintainer-confirmed 2026-06) while this sheet said `pending`; the live page settles it. Re-read 2026-10-17: the ref now redirects (HTTP 301) to <https://mcp.so/servers/agent-config>, which answers HTTP 200 with the same title and links `event4u-app/agent-config`. |
| 3 | `mcpservers.org` | Directory form submission (web form) | `accepted` | `listing-page` | <https://mcpservers.org/servers/event4u-app/agent-config> | 2026-10-17 | 2026-06 | Listed. Read 2026-10-17 with a headless Chromium (Playwright): the row's own URL answered HTTP 200, title "event4u Agent Config MCP Server | Awesome MCP Servers", page filed under Development and linking GitHub. A plain `curl` gets HTTP 403 from the site's Cloudflare bot check (2026-10-16 and 2026-10-17, any user agent), and the site root stays behind the challenge even in the headless browser — so `adoption_status --check-upstream` reports this row `unreachable`, and that is the curl route failing, not the listing. `registries.md` had recorded the form as submitted (maintainer-confirmed 2026-06) while this sheet said `pending`; the browser read settles it. |
| 4 | Official MCP Registry (`registry.modelcontextprotocol.io`) | `server.json` publish via `mcp-publisher` CLI (GitHub-auth'd) | `accepted` | `registry-query` | <https://registry.modelcontextprotocol.io/v0/servers?search=io.github.event4u-app> | 2026-10-24 | 2026-10-24 | Not published: the 2026-10-16 query, and again the 2026-10-17 one, for `io.github.event4u-app` returned `"count":0`. Paperwork complete 2026-07-27: `mcpName` in package.json, `mcp-name:` README marker, `dist/mcp/server.json` emitted by `build:mcp-manifest`, version- and name-equality gated in `lint_mcp_registry_manifest`. **Route (2026-10-24):** CI-published on every plain `X.Y.Z` release by the `publish-mcp-registry` job in `publish-npm.yml` (`mcp-publisher login github-oidc`, no secret); the earlier blocker — an interactive maintainer login — no longer applies. The row stays `pending` until a live read after that release returns a count above 0. The registry's search answers slowly (15 s on 2026-10-17); `adoption_status` waited 20 s and could report the row `unreachable`, so its `curl` wait is now 45 s. **Accepted 2026-10-24:** the 17.3.0 release ran the `publish-mcp-registry` job (run 40066529500, success) with no owner act beyond the merge, and a live read of the registry search returned `io.github.event4u-app/agent-config` 17.3.0 flagged `isLatest`. |
| 5 | `glama.ai` | Server page; score badge used by the awesome-list entry | `accepted` | `listing-page` | <https://glama.ai/mcp/servers/event4u-app/agent-config> | 2026-10-17 | 2026-06-08 | Server page live: HTTP 200, title "@event4u/agent-config by event4u-app". Moved here from `registries.md`, which recorded it listed on 2026-06-08. Re-read 2026-10-17: HTTP 200. |
| 6 | `docker/mcp-registry` (Docker MCP Catalog) | `servers/agent-config/server.yaml` building `internal/docker/mcp-server/Dockerfile` (stdio, non-root) at commit `184251b1` via `source.dockerfile` | `submitted` | `github-pr` | `docker/mcp-registry#6046` | 2026-10-24 | 2026-10-24 | Opened 2026-10-24 by an agent under the owner's Tier B go. Before opening: the upstream's own `task validate -- --name agent-config` passed every check, and `task build -- --tools agent-config` built the image from the pinned commit and found 2 tools. Its CI first waited on maintainer approval (`action_required`), which is the upstream's rule for a first-time fork, not a failure. |

## Planned targets

Targets this package can hold and has not submitted to yet, from
`road-to-listings-a-release-keeps-current` (2026-10-24). A target gets a
tracking row above only when it is submitted (rule 2 below) — until then it has
no upstream to read, and a row here would be reported unread forever. Tier A is
CI on release, Tier B is the agent after one owner go per named batch, Tier C is
the owner, from [`owner-packets.md`](owner-packets.md).

| Target | Tier | Route | Precondition |
|---|---|---|---|
| Gemini CLI Extensions gallery | A | root `gemini-extension.json` + repository topic `gemini-cli-extension`; daily crawl, no form | the topic is pushed (needs the repo-admin secret) |
| the Copilot CLI's built-in default plugin list | B | external-plugin issue form: repo, path `.github/plugin`, release tag, 40-char SHA | the discovery manifest is in a release; a clean Copilot install loads it; owner go |
| Cline MCP Marketplace | B | issue, `mcp-server-submission` template, `assets/logo-400.png` | owner go given 2026-10-24; the template's required checkbox — Cline set the server up from the README alone — needs a real Cline run |
| Cursor Marketplace | C | `cursor.com/marketplace/publish`, manual review | a Cursor manifest of the same discovery shape exists |
| agentskill.sh | C | web "Analyze & Import" with the repo URL | — |
| `hesreallyhim/awesome-claude-code` | C | web issue form; the list accepts human submitters only | — |
| GitHub MCP Registry | C | read after the official registry lists the package; email request if absent | row 4 `accepted` |
| Claude community marketplace | gated | Console form | the Claude plugin stops being a shim — see below |

Three attempts at the awesome list exist. 1a and 1b were not declined on their
content; both closed on upstream listing requirements (a Glama quality score,
then a badge and an emoji tag) that were not met in time. 1c carries both.

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

### Row 3 — `mcpservers.org` — no act needed

A headless-browser read on 2026-10-17 shows the listing exists. Nothing to
submit.

### Row 4 — Official MCP Registry — no owner act

Published by CI on every release (see row 4); accepted on the first live read
after 17.3.0. The daily watcher compares the registry's latest version with
`package.json` from here on.

## Claude plugin directories — gated, not a form

Two routes exist and they differ. The **official** Claude Code plugin directory
takes no submissions at all. The **community** marketplace does take individual
submissions through a Console form — so the route is open, and what keeps it
from being a pending row is the plugin itself: `.claude-plugin/marketplace.json:8`
describes the listing as a bootstrap shim, "**DEPRECATED as a content
channel**", whose hooks do nothing without a separate npm install. A directory
entry for a plugin that does not function on its own is not something to
submit. Whether the Claude plugin should become a discovery plugin — as the
Copilot manifest did on 2026-10-24 — is an open product question; this ledger
records the gate and proposes no change to it.

## Adoption-tracking signal

Row counts are reported, never used as a condition: no plan, release or gate in
this package waits on how many rows reach `accepted` (ADR-216 D5). The score
this section once fed belonged to a retired plan and is no longer kept.

## See also

- [`registries.md`](registries.md) — channel posture, submission template, audit cadence, Discussions setup.
- [`scripts/mcp_registry_submit.sh`](../../src/scripts/mcp_registry_submit.sh) — automation that opened attempt 1b.
- [`mcp-submission-checklist.md`](mcp-submission-checklist.md) — MCP-specific pre-submission floor.
- `task adoption:status` — one-screen dashboard; `-- --check-upstream` for live readings.
