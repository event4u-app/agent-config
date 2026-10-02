---
proposed_by: claude-opus-5/drain-session-2026-10-02
implemented_by: claude-opus-5/drain-session-2026-10-02
reviewed_by: council/anthropic+openai-2026-10-02-dependabot-required-check
providers:
  - anthropic
  - openai
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — dependency PRs reach their required check

## What was reviewed

Two governance-surface files:

- `.github/workflows/consistency.yml` — `**/package.json` and
  `**/package-lock.json` added to the `paths:` filter of both the
  `pull_request` and the `push` trigger. This workflow emits
  `Sync + Generate Tools Consistency`, one of exactly two required status
  checks on `main`.
- `.github/dependabot.yml` — an `ignore` entry for `mermaid` at
  `version-update:semver-major`, scoped to the `/site` ecosystem.

## Verdict: `confirmed-non-expanding`

Neither change moves an authority boundary. The workflow change **increases**
what is verified: today a PR touching only dependency manifests never starts
the required check and sits permanently at "Expected — Waiting for status to
be reported", so those changes are unverified *and* unmergeable. After it, the
check runs and the PR passes or fails on its merits. That is a tightening; it
makes a dependency bump harder to land, not easier.

The dependabot entry **reduces** what the bot proposes. It cannot grant the
agent anything: the agent still cannot merge without approval, cannot bypass
the required check, and now cannot receive an auto-proposed mermaid major at
all — a human has to raise one deliberately after checking compatibility.

## How the review ran, stated as it happened

Two providers were consulted and the verdict is **not** a concurrence. The
anthropic seat argued the ignore "reduces automated security oversight" and
that the peer-range claim was unverifiable from the diff. The openai seat
rejected the first point on the documented behaviour — dependabot does not
apply version-ignore rules to **security** updates, so a CVE fixed only in
mermaid 12 would still be proposed — and narrowed the second to a
documentation concern rather than an authority question.

**The run was DEGRADED and this record does not round that up.** The quorum
line reads `1/2 present` after the final round: one seat did not answer the
second round, so the closing verdict is one seat's, written against the
other's objections rather than beside its agreement. Provider diversity holds
across the review (both seats produced text); strict two-seat convergence on
the final wording does not.

## The residue the review named, kept rather than closed

The peer-range claim is **not** verifiable from the diff alone. It was
verified outside it, and the command is in the config comment so the next
reader can repeat it rather than trust this file:

```
npm view astro-mermaid@latest peerDependencies
→ mermaid: "^10.0.0 || ^11.0.0"   (astro-mermaid 2.1.0, the latest published)
```

The `revisit-if` in `.github/dependabot.yml` is documentation, not
enforcement — nothing fails when astro-mermaid widens its range and the ignore
outlives its reason. Named here because that is the honest state, not an
oversight to be argued away.

## Spend

$0.0000. Both seats are subscription-authed; quota 2/50 each.
