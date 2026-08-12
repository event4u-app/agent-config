---
reported: YYYY-MM-DD
reporter: operator
host: <tool + version if known>
symptoms:
  - <one line, in the reporter's own terms>
  - <one line>
---

# <short title — what the operator experienced, not what you think caused it>

<Free-form body. What was being done, what happened, what the operator expected
instead. Keep the reporter's framing; the diagnosis belongs in the `confirmed:`
block, and writing it here invites confirming a guess rather than checking it.>

<Then, within 30 days, exactly one of the two blocks from README.md — either
`## confirmed:` with a defect plus `file:line` at a pinned commit, or `## null:`
with what was checked and why it does not reproduce.>
