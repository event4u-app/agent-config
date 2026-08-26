---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: road to the multi-host screenshot census

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated
> stub. Created 2026-08-20 when
> [`road-to-source-first-frontend`](../road-to-source-first-frontend.md) was
> drained: three items in that roadmap are gated on a **host capability this
> environment does not have**, so they could be neither completed nor honestly
> cancelled. Framework of record:
> `agents/evidence/council/drain-blocker-dispositions-a.md` <!-- ref-ignore -->
> (on `origin/drain/council-records`, PR #1463; not yet on `main`, hence the
> ignore marker). Outcome state recorded on the parent: **transferred** —
> chosen so that "archived" can never read as "achieved".

## The criterion, verbatim from the parent

> **Step 2:** Census the screenshot-capable tool names actually present
> across the supported hosts (Claude Code browser tools, Playwright MCP
> `browser_take_screenshot`, Chrome MCP equivalents, `Bash` screencapture
> shapes) — the matcher list for Phase 3 comes from this census, never
> from memory.

Re-scoped on 2026-08-20, and the re-scoping travels with the criterion: the
census is **no longer a precondition for anything**. `source-first-gate` shipped
in shadow, and under shadow an over-broad matcher costs a log line instead of a
false warning — so the unfinished census became the thing being measured rather
than a blocker. The criterion is now discharged by **flip condition (d)** of the
parent's Phase 3 Step 2, carried here verbatim:

> (d) the shipped matcher is narrowed to the entries that actually appeared,
> which closes Phase 1 Step 2's multi-host half by observation instead of by a
> second census.

That is a strictly cheaper closing condition than the original: it needs
observed records, not a census campaign.

## What moves here — the complete list

| Item | Parent location | Why it moves |
|---|---|---|
| The multi-host census itself | Phase 1 Step 2 | One host was censused; "across the supported hosts" is unreachable from a single host. |
| The screenshot dimension of the re-measurement | Phase 6 Step 1 | Recorded **not a measurement** in both measurement rounds. Neither arm declined a screenshot — the option was absent, and a dimension that cannot vary is not measured. |
| The W5 URL / live-page handover class | Phase 4 (§ *URL / live-page handover*) | The section shipped but **no fixture scores this class**, for the same absent primitive that made `daf-source-over-screenshot` skip. |

Nothing else transfers. Everything else in the parent is satisfied, narrowed,
or cancelled — see its `## Outcome` section.

## Producer and probe — named, not wished

- **Producer:** a session on a **second supported host** with a
  **page-reaching capture primitive connected** — Playwright MCP
  (`browser_take_screenshot`), a Chrome-DevTools-MCP equivalent, or connected
  `mcp__claude-in-chrome__*` tools.
- **Probe:** is a capture tool available that reaches **the page** rather than
  **the display**? That distinction is the whole gate, and it is the finding
  that produced this stub — not tool count.
- **Measured reading, 2026-08-20, so a future reader can tell movement from
  noise:** this host has **`screencapture` (`/usr/sbin/screencapture`) only**.
  It photographs the physical display, so with no browser process rendering the
  artifact it has nothing to capture. Playwright MCP, Chrome-DevTools-MCP and
  `mcp__claude-in-chrome__*` were all absent from the session tool surface; the
  package tool registry carried only read-only github and jira. **One capture
  tool, and it is the one that cannot photograph a web page.**
- **A page-reaching primitive is the only thing that moves this stub.** A second
  host that also has display-only capture changes nothing.

The parent's non-goals still bind here: no crawler, no Playwright runtime, no
font-bundler is to be shipped — the 2026-06-28 council lock holds, and
extraction runs through the user's own connected tools.

## Carried forward so the reasoning is not lost with the parent

The parent's Phase 3 Step 1 required a condition that **could not be honoured as
written**: *"the session has a routed design handover (the same trigger event
`design-fidelity` records)"* names an event that **does not exist** —
`design-fidelity` is a rule with no runtime carrier. Rather than fake it, the
shipped concern records **two observable proxies side by side** and lets the
candidate spread tell them apart:

1. `handover_seen_in_session` — a handover path named by any tool this session.
2. `handover_present_on_disk` — a handover artifact present under
   `.claude/design-system/` in the workspace.

Promoting either one to *the* signal before the shadow window has data would be
the pick-then-measure mistake `docs/contracts/concern-activation-policy.md`
names. Whoever promotes this stub inherits that open question, and inherits it
with the data the shadow log will by then have collected — the proxies are not
a placeholder to be tidied away.

## Promotion gates

The README's shared promotion criteria (recruited customer, funded security
audit, ADR sign-off) **do not govern this stub** — see that file's
`## Drain-run transfers` section. These do:

1. **The probe above returns a page-reaching capture primitive** on a second
   supported host. This is a capability gate, not a demand gate: there is no
   scope decision to make and no customer to recruit, only an environment that
   does not exist yet.
2. **The shadow log has records to narrow the matcher from** — the parent's
   flip condition (a): >= 100 capture-shaped records or >= 2 weeks, including
   at least one with `handover_seen_in_session: true`. Without them, promotion
   buys a census whose result nothing consumes.

## Seed content on promotion

- Complete the census on the second host and **narrow
  `TOOL_MATCHERS` / `COMMAND_MATCHERS`** in
  `src/scripts/hooks/source_first_gate_hook.ts` to the entries that actually
  appeared — that is flip condition (d), discharged.
- Re-run the parent's Phase 6 Step 1 method (same fixture, same two arms, one
  prompt carrying a `design-fidelity` trigger and one carrying none) with the
  capture primitive **present**, so the screenshot dimension varies and becomes
  a measurement rather than a recorded gap.
- Score the W5 URL / live-page handover class with a `daf-*` fixture, and
  un-skip `daf-source-over-screenshot`, whose skip reason is this same absent
  primitive.
- Only then re-open the parent's Phase 6 Step 2 (b): flipping
  `source-first-gate` from shadow toward advisory. It is recorded there as
  structurally undecidable while the gate cannot fire, and that is still true.
