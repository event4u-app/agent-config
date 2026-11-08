<!-- evidence-type: analysis -->

# Reference-duty hook change — six council rounds, then a smaller slice

`road-to-a-reference-that-arrives-before-the-act` steps 2.2 and 2.3 first bound the
`reread-guard` concern on Bash and on claude `pre_compact`. That edit to
`src/scripts/hook_manifest.yaml` is hook plumbing under ADR-268 § 4 and needs a
two-provider ratification. Six modification-review rounds, prompts committed as
`agents/evidence/council/reference-duty-ratification-r{1..6}-20261107.question.md`
(council responses are gitignored and not kept):

| Round | anthropic | openai | What the refusals named, and what the next round changed |
|---|---|---|---|
| 1 | confirmed-non-expanding | refused | read credit ignored the reference's version; compaction wiped advisory state; `cat` newline / brace cases; latest-state overwrite; silent router failure → all fixed |
| 2 | refused | refused | reads and duties keyed outside-workspace references differently → one `ledgerKey` |
| 3 | refused | refused | missing rule file, malformed router silent; compaction dropped counts; local parser/glob → typed errors, YAML parse, router `trigger_matches`, counts kept |
| 4 | refused | refused (no stance line) | null entries, non-object triggers, non-mapping frontmatter → validated, any duty error counted |
| 5 | refused | refused (no stance line) | array-shaped router; weak compaction assertion; test file omitted from the prompt → fixed and included |
| 6 | refused | refused (no stance line) | frontmatter delimiter edge; one broken rule discards all; unbounded counters; unmeasured hot-path cost |

Every round surfaced a new, narrower finding and each was fixed with a test seen red
first; none was repeated. By round 6 the findings were measurement-quality concerns
about an observe-only hook, not defects in what it enforces — it enforces nothing.

**Disposition (strategy shift at attempt 7 of the fix-loop ladder):** the Bash and
`pre_compact` bindings were removed from the change, so it carries no hook-plumbing
edit and needs no ratification. What ships is wired through the concern's existing
Read/Edit/Write binding: the `agent_id` ledger key, exempt-path read recording, and the
duty observation (with round 6's exact delimiter and per-rule isolation). The `cat`
recognizer and the compaction clear are built and tested but not bound; binding them
is step 2.2's remaining work under blocker `hook-binding-ratification`, and round 6's
open points (counter bounds, hot-path cost) are its entry questions.

## Rounds 7–13: the binding on its own

After the measured hot-path cost and a cap on duty keys, the binding came back as its
own change (`feat/reference-duty-binding`), prompts
`agents/evidence/council/reference-duty-ratification-r{7..13}-20261107.question.md`.

| Round | anthropic | openai | Named, then fixed |
|---|---|---|---|
| 7 | refused | refused (no stance line) | cap held only for new keys → enforced on load |
| 8 | refused | refused | `cat` credited before it ran → credited at `post_tool_use` from the result |
| 9 | refused | refused | length match credits an equal-length replacement → byte-identical compare |
| 10 | refused | refused (no stance line) | a `cat` of a FIFO hung the hook → one non-blocking bounded descriptor |
| 11 | ratified | refused (no stance line) | no deadline; allocation before the length check; path replacement → fixed |
| 12 | refused | refused | deadline unchecked on the success path → final check |
| 13 | ratified (high) | ratified (med) | — record: `agents/evidence/ratifications/reference-duty-binding-20261107.md` |
