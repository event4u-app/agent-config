---
adr: 067
status: proposed
date: 2026-06-08
decision: glama-registry-listing
supersedes: —
superseded_by: —
phase: road-to-glama-registry-listing (Phases 1–3)
type: lightweight
---

# ADR-067 — Glama MCP registry listing

## Status

**Proposed** · 2026-06-08. Implements
[`road-to-glama-registry-listing.md`](../../agents/roadmaps/archive/road-to-glama-registry-listing.md).
Council convergence: claude-sonnet-4-5 + gpt-4o, design mode, 2 rounds +
peer-review, 2026-06-08 — one of four candidate Glama moves survives the
"no-bullshit" bar (registry listing only; Gateway, Inspector in CI, and Worker
listing all dropped with reasons in the roadmap).

## Context

[Glama](https://glama.ai) indexes ~32k open-source MCP servers, provides a free
registry listing, and surfaces them in tool-level search across Claude Code,
Cursor, VS Code, and similar clients. The `agent-config` local stdio MCP server
(`scripts/mcp_server/`, Python, `mcp_scope: full`) is not currently listed
anywhere outside the package README. The listing is a one-way-door free
experiment: costs nothing, creates no technical lock-in, and the only ongoing
maintenance surface is a removable README badge.

The listing targets **agent developers and contributors**, not end-users
configuring pre-built agents. The stdio server requires a local checkout; there
is no turnkey `npx`/`pip` install path (that is a separate roadmap:
`road-to-mcp-stdio-end-user-packaging.md`, held at `status: draft` until a real
demand signal fires). Listing the server for end-users without packaging would
create friction and false support expectations — the audience scope below must be
reflected verbatim in the Glama listing description.

The experimental Cloudflare Worker (`internal/workers/mcp/`, `mcp_scope: lite`,
not README-linked) is **never listed** here or anywhere else until it exits
`experimental`. Listing it would create an incoherent support promise.

## Decision

List the local stdio MCP server in the Glama registry. Developer-first scope.
This ADR documents the exact submission content, discovery channels, kill-switch
criteria, and review trigger so the whole process is reproducible and auditable
without re-litigating the council decision.

---

## Submission — exact steps (manual, one-time)

1. Open: <https://glama.ai/mcp/servers/new> (or the "Add server" button on
   <https://glama.ai/mcp/servers>).
2. **Repository URL:** `https://github.com/event4u-app/agent-config`
3. Paste the **listing description** from `## Listing description` below.
4. **Tags / categories:** `governance`, `agent-tools`, `rules`, `skills`,
   `prompts`, `resources`, `claude-code`, `cursor`, `windsurf`
5. Submit.
6. Record the resulting listing URL in this ADR (`## Listing URL` section below)
   and add the README badge per `## README badge` below.

---

## Listing description

> **agent-config — MCP governance server for AI coding agents**
>
> Exposes the package's read-only governance surface (skills, commands, rules,
> guidelines) as MCP `prompts` and `resources`. Intended for **agent developers
> and contributors** who want to load the governance content into Claude Code,
> Cursor, Zed, or Continue without manual copy-paste.
>
> **Not a turnkey package** — requires a local checkout (`git clone` +
> `task mcp:setup`). End-user turnkey packaging is a separate, future roadmap.
>
> **What it serves:** `prompts/list` + `prompts/get` (every skill, command, rule,
> guideline as a named prompt) and `resources/list` + `resources/read` (same
> content as addressable resources). Read-only; never executes code, never writes
> files, never spawns shells.
>
> **Quick start (developers):**
> ```bash
> git clone https://github.com/event4u-app/agent-config
> cd agent-config
> task mcp:setup   # creates .venv-mcp/, installs MCP SDK
> task mcp:run     # starts the server on stdio
> ```
>
> Source: `src/scripts/mcp_server/` · Contract:
> `docs/contracts/mcp-phase-1-scope.md` · Experimental hosted Worker (separate,
> opt-in): `docs/setup/mcp-cloud-setup.md`

---

## Listing URL

Live — Glama **auto-indexed** the GitHub repo (no manual form submission was
needed):

```
https://glama.ai/mcp/servers/event4u-app/agent-config
```

Listing state as of 2026-06-08: License **MIT (permissive)**, Quality **not
tested**, Maintenance **C-grade**, and a **"This server cannot be installed"**
notice. The "cannot be installed" flag is expected and consistent with the
developer-first scope — the stdio server is not a turnkey `npx`/`pip` package;
it requires a local checkout + `task mcp:setup`. Resolving that flag is the job
of the follow-up roadmap (`road-to-mcp-stdio-end-user-packaging.md`), not this
one.

---

## README badge

Glama does **not** expose an embeddable badge snippet for this listing, so a
plain link is used instead of a badge image (avoids a broken-image surface). One
discreet line was added to `README.md` in the MCP section (after the Worker
"Scope — Lite, not Full" note):

```markdown
> The built-in **local stdio** server is listed for discovery in the
> [Glama MCP Registry](https://glama.ai/mcp/servers/event4u-app/agent-config)
> (agent developers / contributors; requires a local checkout, not a turnkey
> install — see [ADR-067](docs/decisions/ADR-067-glama-registry-listing.md)).
```

This link is the **sole reputational signal** from the listing and is removable
in a single commit. Removing it is the Phase-3 kill-switch for spam-farm
scenarios; see `## Kill-switches` below.

---

## Discovery channels (cross-listing)

The listing must not depend on Glama alone (network-effect lock-in risk per
council). Two channels are active as of 2026-06-08:

| Channel | State | How |
|---|---|---|
| Glama MCP Registry | **pending** (manual form) | This ADR |
| GitHub topics | **active** | `model-context-protocol` added via `gh api` (see below) |
| Awesome MCP list (`punkpeye/awesome-mcp-servers`) | **optional next step** | Open a PR; content below |

### GitHub topics (done)

`model-context-protocol` added to `event4u-app/agent-config` topics, alongside
the existing `mcp` topic. Both surface the repo in
`github.com/topics/model-context-protocol` and `github.com/topics/mcp` searches.

Command run:
```bash
gh api -X PUT /repos/event4u-app/agent-config/topics \
  --field 'names[]=claude-code' \
  --field 'names[]=ai-agent' \
  --field 'names[]=mcp' \
  --field 'names[]=model-context-protocol' \
  --field 'names[]=mcp-server' \
  --field 'names[]=agent-governance' \
  --field 'names[]=ai-video' \
  --field 'names[]=cursor' \
  --field 'names[]=llm' \
  --field 'names[]=prompt-engineering' \
  --field 'names[]=skills' \
  --field 'names[]=windsurf'
```

### Awesome MCP list (optional future step)

If Glama alone proves insufficient or to reach the GitHub-native audience, open
a PR against `punkpeye/awesome-mcp-servers`:

```bash
gh repo fork punkpeye/awesome-mcp-servers --clone
# Add to the appropriate section:
# - [agent-config](https://github.com/event4u-app/agent-config) —
#   MCP governance server for AI coding agents (skills, rules, commands,
#   guidelines as prompts/resources). Developer-first; requires local checkout.
gh pr create --repo punkpeye/awesome-mcp-servers \
  --title "Add agent-config MCP governance server" \
  --body "..."
```

**Kill-switch:** if Glama listing alone drives sufficient discovery (≥1 inbound
issue referencing it within 12 months), skip this PR — it adds maintenance
surface without additive benefit.

---

## Kill-switches

Conditions under which to **remove the README badge** (the listing itself can
harmlessly stay up — removing the badge severs the only active reputational
signal):

| Trigger | Action |
|---|---|
| (a) Glama makes listing **conditional on using their Gateway hosting** | Remove badge immediately; delist if possible. Rationale: migration to Glama hosting breaks the A0-cloud contract (version-pinned URLs, prebaked skillSetSignature, bearer-token control). Non-negotiable. |
| (b) Registry degrades into a spam farm (>50 % low-quality entries dominate MCP search results) | Remove the badge; let the listing rot harmlessly (no maintenance cost). |
| (c) Per-release listing maintenance exceeds ~5 min/release | Investigate whether Glama auto-syncs from GitHub releases (preferred); if not, evaluate removing the listing. |

A listing **fee** is **not** an automatic remove trigger — evaluate the amount.
A $5–10/month fee buys real distribution; an unreasonable fee does not.

---

## Review trigger (trigger-based, never calendar-based)

**Do not set a 60/90-day calendar review.** This is OSS infrastructure, not a
SaaS product; 60-day windows measure random noise.

**Trigger:** the first GitHub issue, PR, or star note that references Glama.
On that signal, assess:
1. Did the user have a good experience? Could they actually run the server?
2. If friction: fix docs or sharpen "developers only" in the listing description.
3. If confusion about end-user use: link to the end-user packaging roadmap
   (`road-to-mcp-stdio-end-user-packaging.md`) from the listing.

**Timeout kill-switch:** if no inbound reference to Glama appears within
12 months of the listing going live, treat the listing as low-signal. The
badge removal cost is one commit.

---

## Consequences

**Positive:**
- Zero-cost discovery channel for agent developers. The Glama inspector also
  lets potential users explore tools without cloning.
- GitHub `model-context-protocol` + `mcp-server` topics reach the GitHub-native
  audience independently of Glama.

**Negative / risks:**
- Listing implies a degree of support. Mitigated by the honest "developers only /
  not a turnkey package" scope label in the description.
- Network-effect lock-in if Glama becomes the de facto standard and adds
  badge-gating for Gateway users. Kill-switch (a) handles this.
- Registry could attract wrong-audience users (expecting `npx` one-liner).
  Mitigated by explicit description language + link to future packaging roadmap
  once it ships.

**Not changed:**
- No CI dependency added.
- No hosting changed.
- The Cloudflare Worker is not listed.
- The `mcp_scope: full` contract is unchanged.
- All three dropped options (Inspector in CI, Gateway hosting migration, manual
  Inspector smoke) remain dropped.

## See also

- [`road-to-glama-registry-listing.md`](../../agents/roadmaps/archive/road-to-glama-registry-listing.md)
- [`road-to-mcp-stdio-end-user-packaging.md`](../../agents/roadmaps/road-to-mcp-stdio-end-user-packaging.md) — follow-up
- [`docs/contracts/mcp-phase-1-scope.md`](../contracts/mcp-phase-1-scope.md) — stdio kernel contract
- [`docs/contracts/mcp-cloud-scope.md`](../contracts/mcp-cloud-scope.md) — Worker A0-cloud contract
