# Evaluator independence — enforcement reach and its correction history

> What the `evidence-independence` guard actually does per branch, per host; the
> limits that were measured rather than assumed; and the two corrections this
> material has taken. The rule keeps the verdict — this page carries the argument.

_Origin: migrated from [`evaluator-independence`](../../../src/rules/evaluator-independence.md)
§ *Enforcement — honest scope* under the P4 pattern
(`road-to-standing-payload-diet` step 1.3). Nothing here is new; the rule was
re-sending all of it on every session and every spawn, and only the verdict has
to be._

## The two branches

[`evidence_independence.ts`](../../../src/scripts/hooks/evidence_independence.ts) is a
`pre_tool_use` concern, and its two branches do **different** things —
**corrected 2026-08-23**, because this paragraph claimed both of them block:

- **Item 1 BLOCKS.** A dispatch whose prompt carries a pre-loaded verdict returns
  `EXIT_BLOCK` (`:253`). Mechanically enforced, on the one host that honours a deny.
- **Item 4 WARNS and does not block.** A second self-scoped evaluation dispatch in the
  same turn returns **`EXIT_ALLOW`** with `decision: "warn"` (`:301-317`), and so does
  the first (`:319-324`). That is deliberate, and the code says why at `:296-300`: the
  internal ladder's `2 = warn` is read as a hard **deny** by this host's native
  PreToolUse contract, *"which is the defect that made an advisory guard a hard deny
  once already"*. Exiting 2 here would have kept a legitimate fan-out blocked while
  claiming to warn.

So the rule's own turn-budget clause is **advisory**, not enforced. It reads the prompt
the agent is about to send, so item 1 is mechanically enforced and item 4 is surfaced.

The manifest's `severity: blocking` for `evidence-independence`
(`src/scripts/hook_manifest.yaml:380-385`) is a **third** reading and it is true of the
item-1 path only: a severity declares the concern, never every branch inside it. A
reader taking it as "both branches deny" reaches the claim this paragraph used to
make.

Three limits, stated because they were measured. The pre-loaded-verdict list is
a **phrase list**, so a paraphrase evades it — it catches recurrences of known
steering wording, not steering as such. The turn boundary is the
authorization ledger's `detected_at` stamp, because the envelope carries no turn
id; with no ledger yet, the counter falls back to session scope. And the guard
does not deny everywhere it exists: `pre_tool_use` is **bound** on three hosts —
augment, claude, cowork — and only `claude` honours the deny. Everywhere else,
augment and cowork included, items 1 and 4 join 2 and 3 as model-carried.
`agent-config hooks:status` answers it for the host you are on right now.

**Corrected 2026-08-17 — this paragraph was wrong on both sides of the line it
drew.** It said `pre_tool_use` "exists on three hosts" and that the guard has
"nowhere to bind" on the other five. Neither half survived a re-read of the
tree. **Downward:** the manifest's own `native_event_aliases` table already maps
`preToolUse` (cursor), `PreToolUse` (cline) and `BeforeTool` (gemini) onto
`pre_tool_use`, so there the guard is **unbound, not unbindable**; only windsurf
and copilot carry no pre-tool surface at all. **Upward, and worse:**
`host_semantics.ts` certifies **claude alone**, and the augment and cowork
trampolines discard dispatcher output and `exit 0` unconditionally — so on two
of the three "enforcing" hosts this guard runs and is then ignored. Nor may the
inverse be asserted downward: nothing records whether an unbound host's
pre-tool event can *deny*, and `severity: blocking` is a property of the concern
rather than of the host. The four states are tabulated once in
[`hook-architecture-v1 § Which hosts carry pre_tool_use`](../../contracts/hook-architecture-v1.md).

Stated at this length because this rule exists over a case where a process that
*looked* followed produced fabricated evidence. An unbacked reason for a real
gap and an unmeasured claim of enforcement are the same failure in a smaller
font, and this paragraph had shipped one of each. Note also what the frequency
join actually reports: `check_enforcement_coverage.ts` skips `fallback_only`
platforms, so its gap set is **four** — cursor, cline, windsurf, gemini — never
copilot, which is excluded by declaration rather than measured as a gap.

**Item 2 — an honestly chosen scope — is not enforced by anything.** A narrowed scope
is not decidable from the prompt alone.

**Item 3 — recording the prompt with the verdict — IS enforced**, and this rule said
otherwise until 2026-08-23:
[`check_review_prompt_binding.ts`](../../../src/scripts/check_review_prompt_binding.ts)
binds a verdict to the prompt it was produced from. Its own header states the limit that
matters, so citing it does not oversell it: **omission beats substitution** — simply not
committing `<slug>.review-input/prompt.md` drops the round out of the checkable set with
**no finding and no signal**, because an artefact without a package is deliberately out
of scope. Measured on the corpus it shipped against, **11 of 19** artefacts already
carry a `prompt_hash` with no package, so the bypassed state is the historical norm and
is indistinguishable from it.
They are stated here as obligations and are model-carried. Saying so is the
point: this rule exists because a process that *looked* followed produced
fabricated evidence, and claiming coverage it does not have would repeat that.


## See also

- [`evaluator-independence`](../../../src/rules/evaluator-independence.md) — the rule this page carries the argument for.
- [`hook-architecture-v1 § Which hosts carry pre_tool_use`](../../contracts/hook-architecture-v1.md) — the four host states, tabulated once.
