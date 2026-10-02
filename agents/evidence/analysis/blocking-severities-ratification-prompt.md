<!-- evidence-type: analysis -->

# The two council prompts behind the blocking-severities change

Committed so the verdicts beside them are checkable. `evaluator-independence`
makes a self-commissioned review admissible as gate evidence **only when the
prompt is recorded alongside the verdict** — the agent that wrote this diff also
wrote both prompts, so without the text nobody can tell a neutral question from a
steered one. The verdicts live in
[`drain-blocking-severities-20261001.md`](../ratifications/drain-blocking-severities-20261001.md)
and in the roadmap's `## Decisions` table.

Both were run through `council_cli run` against `anthropic` and `openai`,
2/2 present on each run, on 2026-10-01. The raw responses land in
`agents/runtime/council/responses/`, which is gitignored and auto-pruned, so what
is durable is the prompt here and the verdict in the artefact — stated plainly
rather than linked, because a link into the pruned tree would rot.

**What this discharges and what it does not.** It makes the question auditable.
It does not prove the question shown here is the question that was sent: the same
session wrote both, so substitution stays possible and merely requires an act
that leaves its own artefact in the commit. That is the detection floor
`check_review_prompt_binding` names for itself, carried over verbatim rather than
improved on.

---

## Prompt 1 — the representation decision (roadmap step 1.1, decision D1)

Verbatim.

~~~markdown
# Question: what should a `blocking` severity mean on a host whose slot cannot refuse?

You are reviewing a decision in a governed skill/rule/hook suite that projects
onto nine AI coding hosts. Answer as an independent reviewer. A recommendation
already exists; say whether it survives, and say so with reasons that could
falsify it, not only reasons that support it.

## The measured situation

`hook_manifest.yaml` declares *concerns* (hook handlers). Each concern carries a
`severity`, either `blocking` or `advisory`, and a list of `platforms` it is
bound on. `host_lowering.yaml` separately records, per host and per lifecycle
slot, whether that slot's exit code can produce a refusal (`block_exit: 2`) or
cannot (`block_exit: null`), or whether the host has no row for that slot at all.

Running the enforcement-matrix gate on 2026-10-01 reports:

- `augment` / `pre_tool_use` — `block_exit` is null, a refusal has nowhere to go.
  Six concerns declared `blocking` are bound there: `block-config-weakening`,
  `block-kernel-rule-writes`, `block-no-verify`, `block-plumbing-writes`,
  `block-speaking-inbox-dir`, `evidence-independence`.
- `cowork` / `pre_tool_use` — no lowering row at all, nothing is bound natively.
  The same six blocking concerns.
- `claude` is the only host with a refusing slot: 3 of its 9 lowerable slots.

So the manifest says "blocking" for twelve host-concern pairs where the host
cannot refuse. The severity is a property of the *concern*; whether a refusal can
land is a property of the *host slot*. Nothing today reconciles the two in any
artefact a reader sees — the audit above is printed to stdout by one gate and
appears in no generated document.

Relevant repository conventions:

- `host_lowering.yaml` states in its own header that an absent `verified` block
  "does NOT mean the host cannot enforce" — the package is careful not to assert
  host facts it has not observed.
- The existing matrix audit is deliberately non-failing: "Failing would red the
  tree on bindings that predate this check."
- The suite's standing discipline is that a claim about enforcement must be
  honest about what is deterministic and what is model-carried; several rules
  carry an explicit `instruction-only` honesty paragraph for exactly this.

## The three options

(a) **Report the effective severity.** The generated host table in
    `docs/enforcement-by-host.md` and the `doctor` host-traffic block print, per
    host, the *effective* severity of each binding — `blocking` where the slot can
    refuse, and something like `advisory here — no refusal slot` where it cannot.
    The manifest is untouched; nothing about runtime behaviour changes. A gate
    then fails if any generated row claims `blocking` on a slot whose `block_exit`
    is null, so the document cannot drift back into the stronger claim.

(b) **Per-host severity override in the manifest.** The concern declares
    `severity: blocking` with a per-host override marking it advisory on hosts
    with no refusal slot. The manifest becomes the single place a reader looks.

(c) **Unbind blocking concerns on hosts with no refusal slot.** A concern declared
    `blocking` is simply not bound on `augment`/`cowork` `pre_tool_use`. The
    binding list stops containing bindings that cannot do what they say.

## The recommendation on the table

(a), on the grounds that it changes no runtime behaviour and makes the published
table truthful.

## What to decide, and the specific risks to weigh

1. Which option, and why the other two lose.
2. Option (c) would *remove* a binding. On those hosts the concern currently still
   runs and can still emit a warning the agent sees — so (c) trades a truthful
   label for a lost warning. Is that trade ever right here?
3. Option (b) puts a host fact (can this slot refuse?) into the concern's own
   declaration, where it must be kept in sync by hand with `host_lowering.yaml`.
   Is that duplication acceptable, or is it the defect?
4. A stated risk against (a): printing "advisory here" is honest and also removes
   the pressure to find a refusing slot — the gap becomes documented and therefore
   comfortable. How should the chosen option guard against that?
5. If (a): should the gate that fails a `blocking` row on a null-`block_exit` slot
   be a hard CI failure, given the existing audit is deliberately non-failing?
   Note the difference: the audit counts *bindings* that predate the check, while
   the proposed gate checks a *generated document* against the configuration it is
   generated from, which cannot have a legacy backlog.

Answer with a verdict on 1, then one short paragraph each on 2-5.
~~~

**Note on the prompt's own wording, recorded rather than quietly fixed.** It
carries a recommendation and names it as such. That is steering of a mild kind,
and the mitigation chosen was to demand falsifiers in the same breath — "say so
with reasons that could falsify it" — rather than to hide the standing proposal
and have both seats re-derive it. One seat then rejected the prompt's own term
*effective severity*, which is the evidence that the invitation worked: the
shipped column names are the seat's, not the prompt's.

It also says "the `doctor` host-traffic block", which was wrong about this tree —
that block reports network-traffic environment variables and has nothing to do
with hook severities. The third surface shipped is `hooks:status` instead. The
error is in the prompt and did not reach either answer, so it is recorded here
rather than silently corrected in the copy above.

## Verdict, as recorded

2/2 present. Both seats chose **(a)**. `openai/codex-default` revised it: do not
call the derived value an *effective severity*, because severity has not changed
and enforcement strength has — publish `declared severity` and
`verified enforcement` as two columns. Both seats separately insisted that an
absent lowering row is `unverified` and never "cannot refuse", and both asked for
the generated-row gate to be a hard failure while the legacy-binding audit stays
non-failing. All of that is what shipped.

Both seats also proposed a **gap-count ratchet** — CI failing when the number of
blocking-but-unenforceable bindings grows, or when a refusing slot regresses.
That is not in this change. It is recorded as residue in the roadmap's
`## Decisions` table with its `revisit-if`, because a new ratchet is its own
baseline decision and lands better with its own evidence than as a rider.

---

## Prompt 2 — the ratification review

Verbatim, and reproduced in full because this is the prompt a ratification
verdict rests on.

~~~markdown
# Ratification review: does this diff expand anyone's authority?

You are the independent reviewer for a governance change in a skill/rule/hook
suite. The agent that wrote this diff is not you and does not get to record this
verdict. Your job is to decide, from the description below, which of four
verdicts the change carries, and to say what you checked and what would have
changed your answer.

The four verdicts, as the repository's contract defines them:

- `ratified` — the change EXPANDS someone's authority and an independent
  reviewer approves the expansion.
- `confirmed-non-expanding` — an independent reviewer looked and found no
  authority expansion. It carries the same independence bar as `ratified` and is
  not a weaker class; a misclassified expansion is review error.
- `refused` — do not land it.
- `non-convergent` — the reviewers do not converge.

State your verdict explicitly, in those exact words, and then justify it.

## Why a verdict is needed at all

The repository's CI gate `check_kernel_edit_ratified` demands a ratification
artifact for any diff touching a kernel rule, a `block_*.ts` governance hook, or
hook plumbing. This diff touches two governance hooks' path sets and the gate's
own path set, so it cannot land without a recorded verdict.

## What the diff does, in four parts

**Part 1 — widen the ratification gate's path set.**
`check_kernel_edit_ratified` previously gated diffs touching `hook_manifest.yaml`,
`host_lowering.yaml`, the `*-dispatcher.sh` trampolines and two hook budget
files. It now ALSO gates four files the runtime reads directly:
`src/scripts/hooks/dispatch_hook.ts` (the dispatcher), `src/scripts/_lib/kernel_rules.ts`
(the list of the nine kernel rules, which the gate itself resolves through), and
the two compiled JSON tables `src/scripts/hook_manifest.json` and
`src/scripts/hooks/host_lowering.json`. Effect: four more file classes now
REQUIRE a ratification artifact where they previously required none.

**Part 2 — widen the tool-call deny.** The `block_plumbing_writes` PreToolUse
guard previously refused hand edits to `dist/hooks/dispatch.js` and
`hooks/hooks.json`. It now also refuses hand edits to the two compiled JSON
tables, naming the compiler command that regenerates each. Effect: two more
files cannot be hand-edited through an edit tool or a recognised shell write
shape on the one host that honours a deny. The compiler itself still runs.

**Part 3 — check the served body.** Both compiled tables carry a `fingerprint`
field binding them to their YAML source. The runtime serves the compiled body in
preference to the YAML whenever that field matches. An edited body with an
untouched field therefore matched and was served. Both readers now also verify a
new `body_fingerprint` field — the fingerprint of the exact body bytes the
compiler emitted — and fall through to the YAML source on a mismatch or when the
field is absent. The compiler writes the new field. The repository's recorded
design decision is to fall through rather than refuse, on the grounds that the
reader is documented as slow-never-wrong and refusing would turn a tamper into
an outage on every host.

**Part 4 — publish an enforcement reading.** A new generated table in
`docs/enforcement-by-host.md`, and a new annotation in the `hooks:status`
report, state per binding both the DECLARED severity (from the manifest) and the
VERIFIED ENFORCEMENT its host slot can carry (`refusal`, `warning-only`,
`unverified`, `proof-expired`). A new hard CI check fails a published row that
claims `refusal` where the slot's `block_exit` is null or absent, and fails a row
claiming `warning-only` where no lowering row exists at all. No manifest entry,
no binding and no runtime behaviour changes; the table is a report.

## Facts you may rely on

- No kernel rule file is edited by this diff.
- No concern is removed from the manifest, no binding is removed, and no
  `severity` value changes.
- `block_kernel_rule_writes.ts` and `block_no_verify.ts` are untouched.
- No existing refusal becomes a non-refusal; no threshold, baseline or ceiling
  is lowered.
- The pre-existing non-failing audit that counts legacy bindings stays
  non-failing. The new hard check applies only to generated document rows.
- One existing test's pinned key set grew by one field, and two existing test
  fixtures that hand-built a compiled payload now also supply the new
  `body_fingerprint`; both were updated because the property each tests is
  unchanged.

## What to answer

1. Your verdict, in the contract's exact words.
2. What you checked to reach it — name the specific claim above that your
   verdict turns on.
3. What would have changed your verdict. Be concrete: name a fact which, if it
   were different, would move you to a different one of the four.
4. Anything in the four parts that you think is misdescribed, under-justified,
   or carries a risk the description does not name.
~~~

**On this prompt's neutrality.** It states no expected verdict in either
direction, names all four options including the two that block the change, and
asks for falsifiers explicitly. The "facts you may rely on" block is the one
steering surface: the reviewers did not read the diff, they read a description
written by the party the review is about. That is stated here rather than implied,
and it is the honest limit of this review — a reviewer with the diff in hand
could have contradicted a fact; these two could only reason from them.

## Verdict, as recorded

2/2 present, both approve, split on the label: `anthropic` →
`confirmed-non-expanding` on a governed-actor reading of "authority",
`openai` → `ratified` on a literal reading that includes enforcement
jurisdiction. The artefact records `ratified`, the stricter of the two approving
labels, and says why. Three residual risks both seats raised are carried forward
there unresolved rather than closed.
