---
proposed_by: a drain lane on drain/road-to-one-detector-senders-20261020 (session ended before delivery)
implemented_by: the same lane; delivered by claude session 8500483d on 2026-10-21
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), compact round of 2026-10-21
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: dfc71456ef9c7ab4a83143565f1f9559b833665958a4516c5a09240a89759306
---

<!-- evidence-type: ratification -->

# The gated half of the detector branch: a filter in an existing path

`check_kernel_edit_ratified` gates three of the branch's 69 files as
hook-plumbing sources: `hooks/dispatch_hook.ts`, `_lib/egress_rules.ts` and
`_lib/egress_text.ts`. Both seats returned **`confirmed-non-expanding`**.

## What the change does

Text the concerns inject back into a session — their messages, and
`session_start` context blocks — now passes `egressInjection` before delivery.
The rule table the egress engine matches against gains credential rows and
multi-group matching.

## Why both seats call it non-expanding

The argument both made independently: **removing this code would leave the
agent LESS constrained.** Before it, a concern's injected text reached the
session unfiltered and could carry a credential; after it, the same text passes
a filter that can mask or withhold it. No new channel, permission, tool,
recipient or action is introduced — the agent could already inject this content,
and the change can only replace or withhold it.

The rule-table additions improve detection precision. They are additive to the
engine, not to the agent's authority.

## The reservation both seats recorded, kept separate from the verdict

**Authority and assurance are different questions, and only the first is
answered here.** `egressInjection`'s implementation lives outside the three
gated files, so this round could not verify that it fails safe. The verdict
says the change grants nothing; it does not say the filter works. One seat
named what assurance would need: failure handling, quoted and unterminated
values, authorization headers, and scope isolation.

## How this round came to conclude, recorded because yesterday's did not

The lane that wrote this work prepared four question files of 21,354 to
34,058 bytes and died before running any. Round `a1` — the smallest, 21,354
bytes — was run on 2026-10-20 and returned `0/2 present`: both seats silent.
This round sent **one** question of 16,747 bytes carrying the complete diff of
the three gated files, nothing summarised, and both seats concluded.

That is one data point for the size hypothesis, not a measured threshold: a
transport failure on 2026-10-20 would produce the same contrast.

## One seat corrected a reviewer, and the correction is worth keeping

A seat noticed that an intermediate reviewer opened with
`confirmed-non-expanding` and closed with "Ratified" — which under this
vocabulary means an accepted *expansion*. Both final seat verdicts are
`confirmed-non-expanding`; the closing word was a slip, and the seat said so
rather than letting it stand.
