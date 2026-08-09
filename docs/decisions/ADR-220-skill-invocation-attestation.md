---
adr: 220
status: accepted
date: 2026-08-09
decision: skill-invocation-attestation
supersedes: —
superseded_by: —
type: structural
phase: road-to-judgment-and-forensic-evidence · Phase 4
review_trigger: >-
  Reopen when either (a) a transcript-scanning consumer for attestation lines
  is concretely proposed with a named reader and a named decision it feeds, or
  (b) a first skill adopts `attest` in production and a session transcript
  shows the line being emitted — whichever occurs first. Until one of the two
  exists, building the check would be a detector with no signal to detect.
---

# ADR-220 — Skill invocation attestation: specified, check deferred

## Status

**Accepted** · 2026-08-09.

## Context

Gates in this repository publish a `scanned: <N>` count so that a gate that
read nothing fails loudly instead of passing silently. Skills have no
analogue: a skill that was supposed to run and silently did not is
indistinguishable, in a transcript, from a skill that was never applicable.
The measured background makes the gap concrete: across the recorded session
corpus, skill invocation is effectively unobservable — nothing in a transcript
distinguishes "the skill shaped this turn" from "the skill never loaded".

The source harvest behind `road-to-judgment-and-forensic-evidence` proposed an
`attest` capability: a skill that declares it states its own invocation in a
fixed, greppable form, making non-invocation and silent skips detectable in a
transcript — the skill-layer analogue of a gate publishing its scan count.

This edits the authoring standard used by every pack, which is why the
roadmap ordered it last and behind its own record (this ADR), rather than
shipping it as a drive-by convention change.

## The self-report limitation — stated here, not in a linked file

```
A SELF-REPORTED ATTESTATION IS EVIDENCE THAT A SKILL SAID IT RAN,
NEVER THAT IT RAN — AND NEVER THAT ITS GUIDANCE WAS FOLLOWED.
```

This repository has already measured the gap this limitation names: the
enforcement-projection and reminder-injection nulls established that
self-report and injected reminders track nothing about actual compliance, and
`ui-audit-gate` / `security-sensitive-stop` state the same boundary for their
own obligations ("self-report is not enforcement"). An attestation line is an
*audit surface* — it makes one specific failure mode (silent non-invocation)
visible after the fact. It is not a gate, not a compliance proof, and no
clearance may ever depend on it. Any future consumer of attestation lines
must carry this paragraph's limitation in its own text.

## Decision

1. **The `attest` capability is specified as follows** (optional, default
   absent, no schema change until first adoption):
   - A skill opts in by carrying `attest: true` in its frontmatter.
   - An attesting skill's Procedure section instructs the agent to emit, at
     the point of first application in a reply, exactly one line:
     `[skill-attest] <skill-name>` — fixed form, greppable, one per skill per
     reply, in the reply body (not a code comment, not frontmatter).
   - The line is emitted when the skill's procedure actually shaped the turn,
     not when the skill was merely loaded into context.
2. **No transcript-scanning check is built now.** The signal is not currently
   worth the surface: zero skills carry the capability, so a scanner would
   have nothing to read, and the number of skills for which silent
   non-invocation is a *measurable, recurring* failure is unknown. Building
   the reader before the writer exists would repeat the pattern the
   orchestration-telemetry null documented (an instrument with a 0.27%
   capture rate measuring nothing).
3. **The authoring-standard edit (skill-writing / schema) ships with the
   first adopting skill**, not speculatively — the capability costs nothing
   until used, and an unused permission in the standard is surface without
   signal (the ADR-217 lesson).

## Consequences

- Non-invocation of an attesting skill becomes greppable in transcripts the
  moment a first skill adopts the capability — at zero runtime cost and zero
  new machinery.
- Until adoption, this ADR is the entire footprint of the feature. That is
  deliberate: rollback is "do not adopt", and nothing ships ahead of its
  record.
- The `review_trigger` above names the two conditions under which the
  deferred check is reconsidered; a bare "someday add the scanner" backlog
  item is exactly what this ADR replaces.

## Alternatives

- **Ship the transcript scanner now** — rejected: no writer exists, so the
  reader would measure nothing; and a scanner scoring self-report would
  invite the exact over-read the limitation paragraph forbids.
- **Make attestation mandatory for all skills** — rejected: 289 skills ×
  one line per applied skill per reply is reply noise and kernel-budget
  regression for a signal that matters only where silent skips have been
  observed; and a mandatory line degrades into boilerplate, the same failure
  mode the roadmap's Phase 1 names for mandatory pre-mortems.
- **Hook-based invocation telemetry instead of in-reply lines** — rejected
  for now: hook slots exist on only three hosts, and the existing
  orchestration-telemetry experience shows hook-carried capture without a
  consumer decays to noise; the in-reply line is host-independent.

## References

- The `road-to-judgment-and-forensic-evidence` roadmap (Phase 4) — archived in
  the roadmap layer; this record outlives it.
- `src/scripts/_lib/scan_scope.ts` — the gate-layer analogue (`scanned: <N>`).
- `docs/CLAIMS.md` — the enforcement-projection / reminder-injection nulls
  establishing the self-report boundary this ADR restates.
