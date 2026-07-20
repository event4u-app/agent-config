# Launch story — the anti-thread thread (road-to-adoption-without-narrative-debt, Phase 2)

Status: **drafted, not yet posted** — posting to external channels is a
maintainer decision and out of scope for an autonomous merge. Voice-tune at
post time. Every number below resolves via `docs/CLAIMS.md`
(`task check-claims`); the story's hook IS the honesty, including the
published nulls.

## The one story (canonical body — adapt per channel, never inflate)

**Title:** We measured our own AI-agent layer. Here are the runs where it
changed nothing.

**Body:**

Most AI-agent tooling grows on headline numbers nobody can re-run. We went the
other way: every public claim binds to a machine-checked ledger
(`docs/CLAIMS.md` — CI fails on drift), and the benchmark page keeps the
honest nulls.

What we measured, reproducible on a fresh checkout:

- The discipline lift is real but SCOPED: on a weak host the `essential` tier
  transplants scope/downstream discipline at a measured 1.71× corpus cost
  (down from 11.7× for the full load) — and it auto-disables on hosts where
  we measured null. A strong host is a ceiling null; a non-Claude weak host
  FAILED replication and we say so. (Claim: `essential-tier-cost-factor`.)
- Swapping our advisor personas' identities changed ~nothing (Δ=0.17,
  p=0.607) while the provider choice mattered ~15× more — so persona identity
  is published as a placebo, not shipped as theater. (Claim:
  `persona-identity-placebo-null`.)
- The 30-second wedge (one read-only subagent, one command) has a scoped
  eval behind its promise: correct verdict on both fixtures, exact
  `file:line` on the planted hollow implementation, zero spurious findings
  on the clean control. (Claim: `wedge-hollow-detection`.)

Verify it yourself, fresh checkout:

```bash
task check-claims        # every markered public claim binds to resolvable evidence
task check-comparison    # every comparison-table "our evidence" pointer resolves
task build-proof-check   # the proof page is in sync with its sources
```

Try the wedge (30 seconds, installs nothing else):

```bash
mkdir -p .claude/agents
curl -fsSL https://raw.githubusercontent.com/event4u-app/agent-config/main/docs/wedge/production-validator/production-validator.md \
  -o .claude/agents/production-validator.md
```

Proof page: https://event4u-app.github.io/agent-config/proof/

## 1. Hacker News (Show HN)

- **Title:** Show HN: An AI-agent layer that publishes the runs where it
  changed nothing
- **Body:** canonical body above, verbatim numbers, lead with the nulls. HN
  will test the falsifiable positioning line — that is the desired
  conversation.

## 2. Reddit (r/ClaudeAI, r/LocalLLaMA)

- **Title:** We A/B-tested our own persona prompts. Identity was a placebo
  (p=0.607). Provider choice mattered 15×.
- **Body:** persona-null section first, then the cost sweep, then the wedge
  one-liner. Link the proof page, not the catalog.

## 3. Dev.to / blog cross-post

- **Title:** Adoption without narrative debt: growing an OSS agent layer on
  falsifiable claims only
- **Body:** canonical body + a short section on the claims-ledger mechanism
  (markered spans, `check-claims`, comparison-honesty table) as the
  engineering story.

## Posting checklist (maintainer, at post time)

- [ ] Numbers re-checked against `docs/CLAIMS.md` at post-day HEAD.
- [ ] No number added that lacks a ledger entry.
- [ ] Links point at the proof page as primary CTA.
- [ ] Session for B9 recruited via the same thread if possible
      (`agents/recruit-sessions/_install-friction-runbook.md`).
