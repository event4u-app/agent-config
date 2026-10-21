---
proposed_by: claude session of 2026-10-20 that wrote ADR-292 (owner directive of 2026-10-12, recorded under agents/evidence/owner-directives/)
implemented_by: claude session of 2026-10-20, merged as 5100656c9 (#2541)
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round of 2026-10-21
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: confirmed-non-expanding
  openai: ratified
effective_after: merge
subject: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
---

<!-- evidence-type: ratification -->

# `retro.enabled` and the `retro` verb (ADR-292) — ratified on its own

Step 0.2 of `road-to-a-retro-the-merge-runs` asks for a council ratification of
the settings-and-verb half of ADR-292 **alone**. The 2026-10-20 rounds reviewed
it bundled with the session-start probe and ended `refused` on the probe each
time, so none of them could be filed as a ratification of this half.

## What was reviewed

The eight files as commit `5100656c9` introduced them, and nothing else:
`docs/decisions/ADR-292-retro-switch-and-verb.md`,
`docs/contracts/settings-classes.md`, `src/config/agent-settings.template.yml`,
`src/config/discovery/command-verbs.yml`, `src/scripts/_lib/agent_settings.ts`,
`src/server/schemas/settings.ts`, `docs/settings-reference.md`,
`tests/lib/agent_settings.test.ts`. The prompt is committed verbatim as
`agents/evidence/council/retro-settings-and-verb-2026-10-21.question.md`; it asked
whether the change expands agent authority and offered the four verdicts of the
closed vocabulary without stating an expected one.

`subject:` is the digest of an empty gated set: `ratification_subject` over these
eight files reports that none is gated, so no record is owed by
`check_kernel_edit_ratified`. This record exists because the roadmap step names
it, not because the gate demands it.

## Seats

**anthropic — `confirmed-non-expanding`.** `retro.enabled` is class C, so an agent
cannot write it; the automatic paths it enables produce intake (queue files,
signals) and apply no behaviour change without a person; `MERGEABLE_KEYS` only
lets a user-global `false` propagate; the verb only admits a user-invoked command.

**openai — `ratified`.** Defaulting the key to `true` does authorise automatic
local writes and one GitHub read without per-event approval, so it is an
expansion; class C stops an agent from changing that authorisation but does not
make it non-expanding. The recorded owner directive makes it acceptable. The verb
alone expands nothing. Two follow-ups:

1. *Wording* — the template said a user-global value switches the retro off
   "everywhere", and the `MERGEABLE_KEYS` comment said every checkout honours it,
   while ADR-292 § 2 says a project value wins. **Fixed in this change:** both now
   describe the user-global value as applying to every project that does not set
   its own.
2. *Precedence tests* — `tests/lib/agent_settings.test.ts` checks only list
   membership. The behaviour the seat asked for is already pinned in
   `tests/scripts/retro_queue.test.ts` (`disabled-globally-means-no-probe`, both
   cases: a user-global `false` disables every workspace without its own value,
   and a project `true` overrides it). That file was outside the eight shown to
   the seat.

The derived verdict is `ratified`: one seat classifies the change as an
expansion and accepts it, the other finds no expansion, and neither refuses.
