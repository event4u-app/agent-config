---
proposed_by: 17.0.0 self-review finding bc83fb66c55d and the owner's hold on the 17.0.0 cut (2026-10-21); the short -n scope from road-to-agent-throughput-recovery 4.3
implemented_by: claude sessions of 2026-10-20 (short -n, held on wip/short-n-scope-ratification-pending) and 2026-10-21 (abbreviations), branch fix/no-verify-semantic-bypass
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round of 2026-10-21
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: confirmed-non-expanding
  openai: ratified
effective_after: merge
subject: f5f171ffb39adbb0b94fa5e26d30942a4f416de7bb276d427f8a1863d13d1c1a
---

<!-- evidence-type: ratification -->

# `block_no_verify`: short `-n` scoped, every `--no-verify` abbreviation refused

Two changes to one `fail_closed` governance hook, reviewed together because
they ship together. The short-`-n` scope was written on 2026-10-20 and held for
want of a second seat; the abbreviation fix closes finding `bc83fb66c55d`, which
holds the 17.0.0 cut.

## What was reviewed

The prompt is committed verbatim as
`agents/evidence/council/no-verify-semantic-bypass-20261021.question.md`. It
carried the full diff of the three commits, the local test and entry-point
evidence, and asked whether the change expands agent authority or opens a hook
bypass, offering the four verdicts without stating an expected one. `subject`
is the digest of the one gated file at commit `e30a9e847`. One round
(`--rounds 1`); both seats answered.

## Seats

**anthropic — `confirmed-non-expanding`.** The 18 subcommands where `-n` is now
allowed could not skip a hook with it before and cannot now, so allowing them
removes false positives rather than granting a bypass. The abbreviation clause
closes a real hole. The allowlist is load-bearing: an alias, an unknown
subcommand and a bare `git -n` stay refused, and the long `--no-verify` stays
unscoped. It found no remaining bypass spelling.

**openai — `ratified`.** Allowing `-n` on an explicit builtin allowlist is an
expansion of what an agent may run, and an acceptable one: it opens no hook
bypass, and no bypass spelling is evident.

The derived verdict is `ratified`: one seat classifies the scoped `-n` as an
expansion and accepts it, the other finds none, and neither refuses.
