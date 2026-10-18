<!-- evidence-type: analysis -->
# Procedure pilot heads against the compaction tail (road-to-steps-the-skill-cannot-skip 4.4)

Measured on 2026-10-18 after the 4.1 split, with `wc -m` (characters) on
`src/skills/<pilot>/SKILL.md` and on the committed pre-split bodies under
`tests/skills/fixtures/procedure_conservation/`.

The tail is the one `road-to-skills-that-arrive-when-called` step 3.4 records:
after compaction the first host re-attaches only the first 5,000 tokens of each
invoked skill, and that file counts a body past **20,193 characters** as one
that loses its tail. This file reports the numbers and decides nothing about the
tail; the threshold, and what follows from it, stay with that roadmap (H2).

| Pilot | Head lines before → after | Head characters before → after | Tail threshold | Head inside the tail | Steps | Largest step file (characters) |
|---|---|---|---|---|---|---|
| existing-ui-audit | 396 → 136 | 24,587 → 9,969 | 20,193 | before: no · after: yes | 12 | 2,821 (`06-match-candidates.md`) |
| project-analyzer | 367 → 306 | 17,944 → 16,515 | 20,193 | before: yes · after: yes | 10 | 330 (`04-business-domains.md`) |

`existing-ui-audit` was one of the six bodies 3.4 named as past the tail; its
head now re-attaches whole. `project-analyzer` was already inside it — its
procedure is a small share of its body, so the split moved little. Step files
are opened on demand during a run and are not part of the invoked skill the
tail re-attaches.
