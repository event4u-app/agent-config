<!-- evidence-type: analysis -->

# Blocker batch: three decided, one deferred to a measurement, three for the owner

AI council, 2026-10-19. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present before and after, two rounds with blind peer review, `$0.00` (both
seats subscription-authed). One batched pass over every blocker that the
`/roadmap:resolve-blockers` run of the same day could not close on evidence,
owner-labelled ones included. The prompt is committed verbatim beside this
file as `resolve-blockers-batch-20261019.question.md`; it carries no
recommendation. Raw response stays local (gitignored runtime tree).

The routing rule applied: a blocker whose chosen option both seats call **not**
owner-reserved is decided here; anything else, and every disposition that
cancels a step (`[-]`), reaches the owner — the second half is the roadmap
preservation test, which no council verdict lifts.

| # | Blocker | Owner-reserved (per seat) | Choice | Outcome |
|---|---|---|---|---|
| B1 | `native-deny-is-a-host-setting-write` | opt 1: yes, clause 5 (both); opt 2, 3: no (both) | **2** (both) | decided |
| B2 | `d1-reopen-helper-level-quote-strip` | (a), (b): no (both) | **(a)** (both), bounded | decided — D1 reopened |
| B3 | `impact-numbering-model` (a) | (a): yes, clause 5, unchanged by the replay (both) | **(a-later)** (both) | deferred to an out-of-sample measurement |
| B4 | `upstream-body-and-mechanism-key` | (a): no (both); (c): yes, clauses 2 and 5 (openai) | **(a)** (both) | decided |
| B5 | `phase-6-spend-ceiling` | (a), (b): yes, clause 4 (both) | (c) (openai); (c) or a staged (a) put to the owner (anthropic) | owner — cancellation |
| B6 | `user-negative-lexicon-schema` | (a): yes, clause 5 (both); (c): no (openai) | **split**: (c) openai; (a) routed to the owner, anthropic | owner — split + cancellation |
| B7 | `slot-read-rate-measurement-spend` | (a): yes, clause 4 (both); (c): no (both) | **(c)** (both) | owner — cancellation |

## Points that bind the decided items

- **B2 is not "move the regex".** Both seats: the caller-side
  `.replace(/["']/g, '')` deletes every quote, embedded apostrophes included.
  The helper strips **one matching pair of wrapping quotes** only, with a
  regression case for an embedded apostrophe, and all six call sites are
  tested. The revisit trigger D1 itself named (a sixth call site) has fired:
  six call sites, three of them duplicating the strip.
- **B1:** option 2 must print idempotent rows and detect coverage already in
  `permissions.deny`; openai adds that option 1 would also create an ongoing
  compatibility obligation against the host's settings schema.
- **B4:** full evidence stays local and is shown during the digest approval;
  only the structured fields leave. The fingerprint key is unchanged.
- **B3:** 7/7 on the seven rows the rule was written against is in-sample, and
  the surface axis is unscored. Return (a) to the owner only after a frozen
  classifier is scored on a pre-registered window it was not written on, both
  axes, with zero false negatives on BREAKING.

## Where the seats differ, kept as differences

- **B5:** anthropic adds an option neither the blocker nor openai named —
  authorise the 96-run calibration with a pre-registered stopping rule after
  32 runs. It is a paid option, so clause 4.
- **B6:** anthropic reads the spike's "schema field only, validator YAGNI" as a
  build directive for the field, so (c) contradicts the spike; openai reads the
  step's unfired condition ("only if 5.0 says build") as decisive, so building
  defeats the gate. Both agree (a) is clause 5.
- **B7:** both seats: the standing guard proves non-disclosure, not that the
  intended readers load the slot; any closure must not claim discoverability.
