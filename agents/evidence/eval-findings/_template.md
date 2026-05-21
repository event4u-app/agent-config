# Eval-finding — `<short-slug>`

> **step-13 schema template.** One file per logged finding. Filename:
> `<YYYY-MM-DD>-<phase>-<slug>.md` (e.g.
> `2026-05-20-p1-indiehackers-jsmith.md`,
> `2026-08-13-p4-pivot-vs-sunset.md`).
> Anchors roadmap-closure rows under step-13 Phase 1, Phase 2, or Phase 4.

## Header

- **Date:** YYYY-MM-DD
- **Phase anchor:** (step-13 P1 | step-13 P2 | step-13 P4 | other)
- **Roadmap rows this finding closes:**
  - `<exact roadmap row text — copy verbatim from step-13>`
- **Recruit / source:** `<docs/recruits/<file>.md>` *(P1 / P4)* or
  `<poll-thread-url>` *(P2)*
- **Consent record:** `<link-or-NA>`
- **Tool host observed:** (claude-desktop | claude-code | cursor | other)

## Result summary

One paragraph. **What did we observe**, in 3–5 sentences. No
forward-looking claims, no speculation about other recruits — pure
report of this one session / poll.

| Metric | Target | Observed | Verdict |
|---|---:|---:|---|
| <e.g. MCP setup time> | <e.g. `< 10 min`> | <e.g. `7 min 22 s`> | PASS / FAIL |
| <e.g. dev-user approval (P2)> | <e.g. `≥ 8 / 10`> | <e.g. `9 / 10`> | PASS / FAIL |
| <e.g. zero-terminal flow> | yes | yes / no / partial | PASS / FAIL |

## Evidence

Concrete, citable evidence — not interpretation.

- **Session log:** `<docs/recruits/<file>.md#session-log>` *(P1)*
- **Screenshots / recordings:** `<path-or-link-or-redacted-marker>`
- **Verbatim quotes:** *"…"* — `<role, anonymised company shape>`
- **Tooling output:** ```paste relevant CLI / config snippets here```

## Friction inventory

Same shape as `docs/recruits/_template.md § Friction inventory`. **At
least two** real items, copy-paste from the session log so the recruit
file and the eval-finding file agree.

1. <what stalled> → <where it surfaces in code / docs> → <what we fixed
   or parked, with cross-link>
2. <...>

## Skill-description / rule deltas filed

If any friction maps to a fix in a skill description, a rule trigger,
or a command step, list the deltas here so the corpus learns.

- `.agent-src.uncompressed/skills/<skill>/SKILL.md` — `<one-line change>`
- `<...>`

If none, write `none — friction was workflow / docs only`.

## Cross-cuts

- **step-14 Phase 3 unblock?** (yes | no — reason)
  *(Phase 1 only — if yes, this finding is the citation for the
  step-14 row "Cold-install validation".)*
- **step-12 L72 parent-flip eligible?** (yes | no — reason)
  *(Phase 1 only — requires step-14 P3 row 1 closure too.)*
- **Phase 4 pivot-vs-sunset signal?** (n/a | pivot-leaning |
  sunset-leaning | inconclusive) *(Phase 4 only.)*

## Decision artifact

For Phase 4 findings, this section is **mandatory** — the roadmap
gate is "decision logged". For Phase 1 / Phase 2 findings, fill if
the finding triggers a corpus or messaging iteration.

- **Decision:** `<one sentence: what we are doing because of this>`
- **Owner:** maintainer initials
- **Follow-up roadmap / ADR (if any):** `<path>`

## Provenance

- **Logged by:** maintainer initials
- **Reviewed by recruit before publication:** (yes | no — reason)
- **Public / private:** public *(default — step-13 expects this)* /
  private with anonymised excerpt
