---
adr: 292
status: accepted
date: 2026-10-20
decision: retro-switch-and-verb
supersedes: —
superseded_by: —
phase: road-to-a-retro-the-merge-runs · step 0.2
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/owner-directives/2026-10-12-retro-inbox-2026-10-o.md
    - agents/roadmaps/road-to-a-retro-the-merge-runs.md
    - docs/contracts/retro-v1.md
    - docs/contracts/settings-classes.md
    - docs/decisions/ADR-041-controlled-command-verbs.md
review_trigger: >-
  Reopened if the 30-day dogfood of road-to-a-retro-the-merge-runs step 5.2
  shows net cost with no landed learning, if a user needs a retro value the
  contract fixes as a constant, or if a host already reserves the verb `retro`.
---

# ADR-292 — One switch for the retro, on by default, and the verb `retro`

## Status

Accepted 2026-10-20. The default and the verb follow the repository owner's
directive of 2026-10-12, filed verbatim under
`agents/evidence/owner-directives/`: a retro after every merged pull request,
startable by hand, **on by default and switchable off by a setting**. The shape
of the switch (one key, class C, user-global cascade) is the roadmap's D2,
carried out here. This record is also the ADR-041 § 5 addendum for the new verb.

## Context

The retro (`docs/contracts/retro-v1.md`) runs on three automatic paths and one
manual command. "On by default" fits no class without a decision: class B
requires a conservative default and the build breaks otherwise
(`docs/contracts/settings-classes.md` § B), so the one admissible shape is class
C with a documented default, the pattern `continuity.auto_record` already
follows. A user-global `retro.enabled: false` would be discarded silently unless
the key is on `MERGEABLE_KEYS` (`src/scripts/_lib/agent_settings.ts`), and
adding a key there requires an ADR. `retro` is not an approved command verb, and
ADR-041 § 5 requires an ADR for a new one.

## Decision

1. **`retro.enabled`, class C, default `true`.** One key. Budgets, the catch-up
   window and triage thresholds stay contract constants, not settings (D2).
   Class C means an agent cannot set it: `settings:set` refuses it, and a person
   changes it by hand or through the GUI.
2. **It cascades from the user-global file.** `retro.enabled` joins
   `MERGEABLE_KEYS`, so `false` in the user-global file switches the retro off in
   every checkout. A project value still wins over the user-global one.
3. **`false` stops every automatic path** — the merge path, the forge-merge
   marker, the daily sweep and its probe. It does not stop an explicit `/retro`:
   a person asking for one retro has asked, and a manual run never re-enables an
   automatic path.
4. **The automatic paths stay local but for one read.** Everything the retro
   writes lives in the git common directory. The one network access is the
   daily probe asking GitHub, through the user's own `gh` login, whether a PR a
   push recorded has merged — repository and PR number, inside one
   three-second budget for the whole probe. `false` stops it with the rest.
   The queue line the probe emits asks for the retro after the user's first
   task and grants no delegation; whether a subagent may run it is the
   delegation policy's question, not this switch's.
5. **The verb `retro` is approved** for the visible command `/retro`
   (ADR-041 § 5). It names the activity the owner asked for; no existing verb
   (`review`, `audit`, `memory`) carries "examine finished work and draw at most
   one learning" without overloading a cluster that means something else.

## Consequences

The key exists before any automatic path reads it, so the first path that lands
lands switchable. Existing installs carry no value and resolve to the default,
which is the behaviour the owner asked for. The verb lands in the same change as
the key rather than in a PR of its own: the roadmap bundles both into one record
because neither is useful without the other.

## Alternatives considered

- **Class B with default `false`** — contradicts directive (e); the build
  forbids a permissive class-B default, and a conservative one is the opposite
  of what was asked.
- **Four keys** (paths, budget, window, transcripts) — each extra class-C key is
  a GUI surface and a governance row; the owner asked for one switch (D2).
- **A sub-command under `/memory`** — the owner named the command `retro`; the
  memory cluster promotes lessons, it does not examine finished work.

## Evidence

The owner directive file (verbatim turns of 2026-10-12) and the roadmap's
decision table (D1, D2, D3).

## References

- `docs/contracts/retro-v1.md`, `docs/contracts/settings-classes.md`
- `src/scripts/_lib/agent_settings.ts` (`MERGEABLE_KEYS`)
- `src/config/discovery/command-verbs.yml`
- ADR-041 § 5
