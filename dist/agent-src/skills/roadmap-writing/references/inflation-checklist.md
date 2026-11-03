# roadmap-writing — inflation checklist for Done notes

> Mode body of the [`roadmap-writing`](../SKILL.md) skill, § Do NOT. SKILL.md sits
> at the 400-line cap, so the checklist lives here; load it before writing a
> `Done:` note, a Verified-table row or a progress line.

A `Done:` note, a Verified table row or a progress line restates what happened;
it must not say more than the evidence. Check each against its `verify:` output
before saving:

- [ ] **Widened verb** — the note says *fixed*, *validated*, *eliminated* where
      the evidence shows *mitigated*, *tested once*, *reduced*. The verb matches
      the strongest thing the command proved, not the hoped-for outcome.
- [ ] **Supplied number** — every figure in the note appears in the command's
      output or a cited file; a count, percentage or duration nothing printed is
      cut.
- [ ] **Smoothed status** — *behind a flag*, *report-only*, *partial* or
      *one of N* survives into the note; a gated or partial result is never
      written as shipped, enforced or complete.
- [ ] **Absorbed achievement** — work another roadmap, PR, team or tool did is
      named as theirs; a step is not ticked for a result this change did not
      produce.

Number, status and attribution drift between a draft and its source is
mechanically checkable: `detect_ai_tells --baseline <source> <draft>` lists
every number, status word and attribution subject one side has and the other
lacks. A widened verb is not, and is checked by reading.

