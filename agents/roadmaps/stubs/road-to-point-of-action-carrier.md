---
complexity: lightweight
review_by: 2026-09-19
---

# Stub: road to the point-of-action delegation carrier

> **Stub — not active work.** Transferred out of
> `road-to-always-on-orchestration.md` (Phase 7.3 + blocker
> `point-of-action-carrier`) by the autonomous drain run of 2026-08-20.
> Council 2026-08-20 (anthropic/claude-sonnet-4-5 + openai/codex-default,
> quorum 2/2), disposition **B — transferred**, outcome state `transferred`.
> Rationale recorded by the council: *"A repository-only inference cannot
> establish main-agent versus subagent identity on the real host."*
>
> **Promotion note.** The three shared promotion criteria in
> [`README.md`](README.md) (recruited customer, funded security audit,
> maintainer ADR) **do not govern this stub.** This is a drain-run transfer
> gated on a host discrimination spike. Its gate is the re-entry probe below.

## 1. Original criterion (verbatim)

The transferred blocker's `Resolved when` clause, copied without edit:

> the spike note exists and the build/no-build decision cites it plus the
> F3-lite adoption telemetry.

## 2. Dependent steps moved (complete list)

- **The main-vs-subagent discrimination spike** on a real host. Upstream
  closed the PreToolUse agent-identity request as NOT_PLANNED, and the
  per-agent-permission fix landed with unverified scope — so the only
  remaining route is a live probe, which is exactly what a repository cannot
  perform on its own.
- **The F3-lite adoption telemetry reading** that the build/no-build decision
  must cite alongside the spike.
- **The discriminator verdict** — separation found, or measured null.
- **The scoped-carrier decision** — with no discriminator, the carrier ships
  only under scope reduction (source-file writes above a size threshold, with
  generous exemptions) or not at all.

Phase 7.3's negative statement stays as it is: no hard tool-deny on the main
session and no point-of-action pre-tool-use ladder ships today, verified
against `hook_manifest.yaml`'s pre_tool_use chains.

## 3. Re-entry producer and detection probe

- **Named producer:** a **maintainer with a real multi-agent host session** —
  one session that demonstrably runs both a main agent and a subagent, so
  paired traces can be captured from the same host at the same time. Not
  "when identity lands upstream"; upstream declined, so the producer is the
  person who can run the pair.
- **Detection probe:** **paired main/subagent traces** that test the candidate
  discriminator, publishing either a separation result or a measured null.
- **Probe value measured today (2026-08-20):** not measurable from this
  repository, and that is the finding rather than a gap in this run. The
  parent roadmap already carries the reason in the ladder's own contract
  surface: the recursive-dispatch guard is a **caller-supplied fact**
  (`insideSubagentSession`), explicitly *"never a `process.env` probe for an
  unverified variable name"* — because no field in this repository's hook
  envelope carries session lineage. There is no local value to read; a number
  reported here would be invented.

**The pre-registered null still stands, and it is the likely outcome.** The
parent blocker registered it before any evidence existed: *"no discriminator"
is publishable and does not block the roadmap. That registration is what keeps
this stub from being a parking lot — a measured null closes it, and the honest
expectation after an upstream NOT_PLANNED is that the null is what the spike
finds.

## Seed content on re-entry

- Run the spike **before** designing the carrier. A carrier built against an
  assumed discriminator is the "designing against assumptions" failure the
  grounding discipline names.
- Publish the null if that is the result. An unpublished null costs the next
  person the same spike.
- If a discriminator does exist, the carrier is still scope-reduced on first
  ship: source-file writes above a size threshold, generous exemptions. A
  pre-tool-use carrier that fires on every write is the over-firing canary
  Risk 2 of the parent roadmap already measured once at 24/29 misses.
- Whatever ships is honest about host scope: only one host both binds
  `pre_tool_use` and honours a deny
  ([`hook-architecture-v1`](../../../docs/contracts/hook-architecture-v1.md)
  § Which hosts carry pre_tool_use). A carrier bound elsewhere runs and is
  ignored, which is not enforcement.
