<!-- evidence-type: analysis -->

# A permission deny rule is not a hook fact, so it does not live in the hook table

**Date:** 2026-10-13 · **Members:** `anthropic/claude-sonnet-4-5`, `openai/codex-default`
**Mode:** design, deep · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 present, concluded · **Verdict: Path B — convergent**

Executes step 2.1 of `road-to-a-project-contract-written-down`. The step
instructs that the host permission-rule syntax be "pinned with its `docs_url`
in `src/scripts/hooks/host_lowering.yaml`, not taken from this file". Three
measurements taken before the question was put showed that home cannot hold a
readable pin, and the council was asked whether to extend the table anyway.

## What was measured first

1. `_structure()` in `src/scripts/hooks/host_lowering.ts` reads only named hook
   keys (`entry_shape`, `json_shape`, `fail_policy`, `timeout_unit`,
   `timeout_default`, `verified`, `slots`). An unknown key is dropped from the
   typed table, so a `permissions:` block there would be read by nobody.
2. `compile()` in `src/scripts/compile_hook_manifest.ts` serialises the raw
   parsed document, so that unread key still moves `body_fingerprint` and
   forces a recompile.
3. `PLUMBING_SOURCE_RE` in `src/scripts/check_kernel_edit_ratified.ts` matches
   both the YAML and its compiled sibling, so the edit would carry an
   independent ratification record with two distinct providers.

Net: the literal instruction costs a ratification record and a fingerprint
move, and buys a pin no reader can consume — unless the typed table is widened
for a fact that is not a hook fact.

## The verdict

| Seat | Path | Hook table may carry it | Authority classification |
|---|---|---|---|
| `anthropic/claude-sonnet-4-5` | **B** | No | consented authority expansion |
| `openai/codex-default` | **B** | No | taxonomy-dependent; record the split effect, do not assert a label |

Both seats, independently and in the same words, anchored the refusal on the
table's declared subject: it describes "how each host lowers a dispatcher
verdict into its own hook contract", and a permission rule has neither a
dispatcher verdict nor a slot. One seat put the pipeline difference plainly —
hook lowering is consulted after a tool is approved, a permission deny before.

Both seats also rejected the Path C variant the question offered, in which the
classifier resolves the host row at run time: that contradicts step 2.1's own
word "pure", and makes the classifier depend on host plumbing.

## What both seats required beyond the placement

1. **The classifier stays host-neutral.** It emits `{kind, token, action}`; a
   separate install-layer adapter owns the host's spelling and its provenance.
2. **Fail-closed on ambiguity** — an unresolvable bullet falls back to prose
   and never broadens into a deny rule.
3. **A provenance gate in place of the plumbing ratification.** Both seats
   noted that moving the fact out of the gated tree could bypass scrutiny
   rather than correctly avoid irrelevant governance, so the placement decision
   owes a replacement control.
4. **No live documentation fetch in CI.** One seat argued for a six-month
   expiry and a fetching check; the other refused the fetch as
   nondeterministic and network-dependent, and refused the six months as
   unsupported by evidence. The narrower reading was taken: a committed read
   date and a chosen review-by date, no network.
5. **The departure recorded in the Decisions table with the measurement that
   forced it**, so a later reader can check the reasoning rather than the
   conclusion.

## Where the seats differed

On the authority label. One seat called it a consented authority expansion —
new enforcement capability plus a write to a consumer-owned settings file. The
other held that the label is taxonomy-dependent and that the effect is split in
two directions at once: the generated deny rule **reduces** the agent's
execution authority, while the installer **gains** authority to mutate a
consumer's settings file after consent. Absent a cited taxonomy, it asked for
the split effect to be recorded and the final label left open.

The narrower reading was taken, as it was for the fetch: the split effect is
recorded in the roadmap's Decisions table and no label is asserted.

## What this run does NOT settle

Both seats raised requirements this change does not carry, and they are named
here rather than quietly dropped:

- **Ownership-aware rollback** — distinguishing a package-written deny entry
  from an identical user-authored one, so a removal path could tell them apart.
  This change only ever appends and ships no removal path, so there is nothing
  yet to disambiguate. It becomes real the day a removal path does.
- **A host conformance probe** — the examples are verbatim quotes recorded with
  their URL and read date, so the gate proves conformance to a recorded
  reading, not to the live host. Only a probe against an installed host would
  close that, and the gate's header says so rather than implying otherwise.
- **A general `host_capabilities.yaml`** — both seats named it as the right
  answer *if* a second non-hook per-host fact ever needs the same lifecycle,
  and both refused it for one row.
