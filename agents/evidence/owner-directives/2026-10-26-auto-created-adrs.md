<!-- evidence-type: analysis -->

# Owner directive — seven owner-attributed ADRs were created automatically

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-10-26 |
| Scope | ADR-283, 287, 288, 293, 297, 298, 299 (OQ-18) |
| Grants by itself | nothing; it records how these records came to exist |

Owner, verbatim: "Vieles habe ich selber getroffen, aber nie als aktiv genangen <!-- md-language-check: ignore -->
ADR. Die wurden automatisch erstellt" ("I made much of it myself, but never as
an ADR I actively asked for. They were created automatically"), answering
which of the seven ADRs he decided himself.

## What it means

- Much of the substance of these seven decisions came from the owner. The
  records were written by agents, which put `owner` in `decision_makers`
  without recording his words.
- The owner does not confirm any single record. Three of the seven still carry
  his words: ADR-293 quotes his directive of 2026-10-12, ADR-297 his directive of
  2026-10-23, and ADR-298 cites three rulings recorded verbatim in its roadmap.
  The other four — ADR-283, 287, 288 and 299 — quote nothing. Their owner
  attribution is **unverified**, and they are not cited as owner authority or as
  precedent for an owner-reserved transition. Each record carries a dated note
  saying which case it is.
- None is relabelled to `council` or `agent`, because that would be just as
  unsupported. This follows the AI council of 2026-10-26 (2/2): quarantine the
  unsupported attribution, and leave confirmation of historical fact to the owner.
- New records are already covered: `check_new_adr_evidence` refuses an added ADR
  that names the owner without citing a directive under this directory.
