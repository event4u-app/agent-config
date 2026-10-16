<!-- evidence-type: analysis -->

# Eleven owner-labelled blockers, put to the council with the routing test attached

**Date:** 2026-10-16 · **Members:** `anthropic`, `openai`
**Mode:** prompt, 2 rounds each, peer review, blind chairman · **Cost:** $0.00 (subscription transport)
**Rounds:** ten · **Quorum:** 2/2 on every round

The sweep in `agents/evidence/analysis/active-blocker-disposition-20261016.md`
found eleven open blockers waiting on the repository owner, each already
carrying a written recommendation. Rather than forward eleven questions, each
was put to the council **with the owner-reserved table attached** and an
instruction to open with `DECIDE` or `ESCALATE` — so the council classifies its
own authority instead of the agent classifying it for them.

The instruction was explicit that the roadmap's own `owner` label is not the
test, and that an escalation still owes a recommendation. Both halves earned
their place: several rounds decided questions whose roadmaps said `owner`, and
every escalation came back with a pick the owner can take or leave.

## Why this shape, rather than reading the labels

A roadmap's `Owner:` field is written by whoever authored the blocker, usually
in the same sitting that discovered it. It records a first impression of who
should answer, not an adjudicated routing. Treating it as binding would hand the
owner every question any author ever felt uneasy about.

The counter-risk is the obvious one and it is why the test was attached verbatim
rather than paraphrased: an agent that re-routes questions to a venue it can
reach is choosing its own authority. The council classifying the transition,
against the written table, with the agent's reasoning absent from the prompt, is
the cheapest available separation.

## Verdicts

### Decided by the council — the transition cleared the table

| Round | Blocker | Verdict |
|---|---|---|
| q4 | `default-mode-for-consumers` | **(a)**, bounded to new installs and freshly generated settings |
| q5 | `maintainer-design-router-name` | **(a)**, concretely `/agent-design` with `replaces: [design]` |

### Escalated — convergent on the reading, and on the pick

| Round | Blocker | Reserved row crossed | Recommended |
|---|---|---|---|
| q1 · decision 1 | `node-floor-raise` | removes a **compatibility** commitment | **(a)**, cut as a semver-major |
| q2 | `which-completeness-skills-owe` | creates a **public** commitment | **(b) reach** |

### Split — the escalation condition fired

| Round | Blocker | Split on |
|---|---|---|
| q1 · decision 2 | `auto-default-for-existing-installs` | `anthropic` DECIDE (b); `openai` ESCALATE (a) |
| q3 | `default-flip-of-the-installed-layer` | `anthropic` DECIDE; `openai` ESCALATE — superseded by a tree finding, below |

## What each round turned on

### q1 decision 1 — the Node floor, and the semver framing neither roadmap had

Both seats escalate and both pick (a). The decisive reading, `openai`'s: CI
pins Node 20 while `SECURITY.md:21` backports nothing to it, so the repository
already emits *"a compatibility signal the project will not actually honor"*.

`anthropic` added the framing that changes what the owner is being asked.
Shipped as a **semver-major**, the question stops being *"may we break Node 20
in a minor?"* and becomes *"may we cut a major now?"* — a documented contract
point rather than an unannounced removal. Both seats require the engine change
and the pins to move atomically, and both require migration notes naming the
last Node-20-compatible version and stating that it receives no backports of any
kind.

**Re-measured on this tree, because the recommendation quotes a count.** The
roadmap says 45 Node-20 CI pins. Measured: `engines.node` is `>=20.11.0`, and
the workflows carry **38** literal `node-version: '20'` pins across **20**
files, plus **3** matrix lists of the form `node: ['20', '22']` in 2 further
files — 41 sites in 21 files. The difference does not change the decision and
the accurate figure belongs with it.

### q1 decision 2 — the one genuine split, and it is a real disagreement

`anthropic` holds DECIDE / (b): the reserved list names *externally binding,
liability-creating* commitments, and an internal policy about how conservatively
defaults evolve is none of those. Its sharpest point: **neither (a) nor (b)
weakens the floor** — both ask before changing — so the choice is how
conservative to be, not whether to preserve the user's agency. Only (c), which
neither seat picked, would weaken it.

`openai` holds ESCALATE / (a): whether an existing installation may acquire
materially different update behaviour is a public behavioural commitment, and
(a) preserves the consent state of existing installs without freezing the
product forever — new installs may default to `auto`, existing ones keep
`notify` unless they accept a one-time invitation carrying a durable "never".

The split is on both axes, so it escalates. Worth stating plainly for whoever
answers: the two seats are one step apart, not opposed — (a) and (b) differ in
whether a single invitation may ever be shown, and both forbid a silent flip.

### q2 — reach, with the sentence already drafted

Both seats escalate as a public commitment and both pick **(b) reach**.
`openai` supplied a `README.md:59` replacement, which is the part the resolution
clause actually needs:

> Every skill included in this package is available with its documented
> behavior through one deterministic retrieval step on supported hosts; each
> host may decide which skills are installed locally.

Both seats require more than the word. `anthropic`: promising (b) makes the
query mechanism **a capability requirement, not optional infrastructure** — a
host that cannot provide it is unsupported rather than broken, and that must be
written down. `openai`: the owner ratifies an **operational definition**, not
the word "reach" — the authoritative skill set, supported hosts, what "one step"
means, version selection, failure behaviour, offline expectations, and what
counts as preserved semantics.

Both also treat the measured host truncation as settling (a): a default install
on which the host stripped every description and dropped hundreds of entries
makes universal presence a promise the package cannot keep.

### q4 — decided, and the fact both seats conditioned it on is now measured

Both seats pick **(a)** and both bound it to **new installs and freshly
generated settings only**. `anthropic` is explicit that it would have escalated
had the template reached existing installs; `openai` declines to assume either
way and asks for the deployment fact to be recorded before step 6.5 closes.

**Measured on this tree, which is what they asked for.** `renderSettingsTemplate`
in `src/server/io/substituteTemplate.ts` is the only render path, its own
docstring scopes it to the wizard's Skip path, and a tree-wide search finds **no
caller** of it outside its own file. `cmd_update.ts` states in its header that
the daily banner *"never writes settings files"*. So the template does not
propagate into an existing install, the condition both seats attached is
satisfied, and the branch `openai` reserved — *"if templates update existing
installations, do not flip those automatically"* — is moot today rather than
unanswered.

That an exported render function has no caller at all is a separate, pre-existing
observation. It is recorded here and **not** acted on: it is nobody's orphan from
this change.

Both seats also narrowed the roadmap's own phrasing. "No utility cost" is too
absolute — authentication debugging, credential-format checks and fixture-based
tests can depend on structure or stability. The defensible claim is narrower:
coding tasks do not depend on *the secret value itself being visible*, and
stable placeholders preserve structure and consistency. The cost is bounded and
addressable, not zero, and the published result should carry failure categories
and known exceptions rather than a single pass mark.

### q5 — decided, with a name and a caveat that checks out

Both seats pick **(a)** and both converge on **`/agent-design`** with
`replaces: [design]`. `openai` rejected the alternative `/design:router` on two
grounds: colon portability across hosts is not established in the tree, and the
name describes implementation rather than intent.

**The caveat both seats raised, checked here.** They asked whether `replaces:`
is metadata-only. It is not: `src/cli/commands/commands.ts` reads it at runtime,
printing `<slug>  <-  absorbed: <names>` in the command listing (`:248`) and a
`replaces:` line in the detail view (`:414`).

The honest limit is the other direction. A maintainer who types the old name on
Claude Code reaches **the host's own built-in**, which this package cannot
decorate — so the forward pointer `openai` asked for exists in the package CLI
and cannot exist on the host's slash surface. That is a property of the host,
not a gap in the migration.

**Two tree facts confirming the pick is applicable.** `agent-design` is held by
no command and is not in `CLAUDE_CODE_BUILTIN_NAMES` (103 entries), so the
predicate returns `false` for it as option (a) requires. And `design` itself is
**not yet** in that set — the list carries `design-login` and `design-sync` only
— which is precisely what step 1.2 adds; 1.3 therefore sequences after 1.2 and
not before it.

### q6 — the destruction rule, written by consequence rather than by path

Both seats `DECIDE` **(a)**. The routing is clean in both readings: (a) **adds**
a denial and leaves ADR-268 § 1's eleven-operation set and ADR-260's zero-prompt
criterion untouched, so it strengthens a floor. `openai`: the roadmap's `owner`
label *"describes provenance, not decision authority"*.

Two refinements, and both change what gets written.

**`openai` — name the consequence, not the path shape.** The category *"target
resolves to `/`, `~` or a block device"* is **too broad** and **too narrow** at
once: a read-only or non-destructive write outside the tree matches it if the
implementation conflates location with destructive effect, while a mounted
filesystem, a symlink escape, a raw device reached through an alias or an
indirect operand destroys without naming any of those three. The recorded rule
therefore states the prohibited consequence; the three examples stay examples,
and path resolution plus command recognition are the enforcement mechanism.

**`anthropic` — the record is the authority source, not a description of the
guard.** A denial cites it, so the chain from the 2026-09-05 ruling to the
refusal is auditable rather than reading as "the tool said no". It carries
weight on four paths and only one is the blocked command: a guard bug in path
resolution leaves the model a rule to refuse on; a plan is checked against it
before a command is formed; a user asking *why* gets the rule rather than an
exit code; and a later change to the guard has a continuity anchor.

**The container had to move, and that is worth stating.** The blocker's
resolution clause named `agents/evidence/owner-directives/`. That directory
holds orders the owner gave in their own session prompt — its one existing
record opens with `Ordered by | the repository owner, in their own session
prompt`. Writing a council verdict there would attribute to the owner a decision
the owner never made. The clause now points here instead.

### q7 — routed per option, which is what the question asked for

Both seats split the three options rather than the round, exactly as invited:

| Option | Routing | Why |
|---|---|---|
| (a) trailer **binds** the bump | **ESCALATE** | version numbers govern consumer dependency resolution — a public compatibility commitment |
| (b) trailer advisory | **DECIDE** | alters no dependency resolution; reversible |
| (c) reject both | **DECIDE**, and declined | preserving the existing rule creates no commitment |

**The contradiction both seats found.** The blocker said (b) *"reduces Phase 2
to 2.3 (the backfill)"* while recommending *"(b) first, then (a) once the replay
in 2.2 has run"*. With 2.2 cut, the evidence for (a) is never produced and (b)
becomes terminal by accident. `anthropic` resolved it: **step 2.2 scores
historical releases** (10.0.0 → 16.0.0 against the recorded rows), so it needs
no new commit carrying the trailer. Under (b), Phase 2 is **2.2 and 2.3**.

**"Advisory commits the package to nothing" is too absolute**, said
independently by both. The trailer is **published in git history** and so is
externally observable whether or not it binds: a commit reading
`Consumer-Impact: BREAKING` that ships as a patch is contradictory public
communication. (b) therefore ships with an explicit experimental,
non-normative disclaimer as part of the option, not as decoration.

**The threshold for (a) is accuracy, not delta.** `anthropic`: *"a 30% change
rate where all 30% are misclassifications is worse than 5% where all are
fixes."* The hard requirement is **zero false negatives on BREAKING** — the one
classification error consumers cannot recover trust from.

### q8 — three months is a window, not a criterion

Both seats `DECIDE` **(b)**: reversible, weakens no floor, creates no ratchet,
not reserved. The shared reasoning is that a ratchet makes the **first**
observation load-bearing, and with no history nothing distinguishes a real
regression from denominator churn, a classification change, nondeterminism or
ordinary variance.

Four refinements, all adopted into D4 of the roadmap:

- **Exit on evidence, not on the calendar.** Three months is the observation
  window; the criterion is whether the metric proved reproducible.
- **Freeze the methodology before the first reading**, and publish it with every
  reading: definition, numerator, denominator, exclusions, reproduction command.
- **Define "representative" up front** — at least three host platforms, fresh
  and upgrade installs, minimal and full projection scopes. `anthropic` rejected
  a fixed count of releases as cadence-dependent; `openai` rejected elapsed time
  as evidence in itself.
- **The window ends in a decision.** Drifting into permanent (b) defeats the
  staged path, so it closes on (a) or (c); too few observations **extend** the
  window rather than force a pick.

Both seats refused a numeric variance threshold — a fixed `<5%` is unsupported
and may be meaningless for a discrete ratio over a small denominator. The early
trigger is qualitative instead: a material unexplained decline, or evidence that
the absent gate was exploited, reopens it immediately.

### q3 — the round the tree answered better than the council could

`anthropic` **DECIDE**, `openai` **ESCALATE** — a split, and on the routing
rather than the substance. Both converged on the same replacement: a one-shot
clean-install probe producing `installed-arrival-<version>.md`, carrying step
2.1's original assertions, plus the step 2.2 fixture green.

`openai`'s escalation reason is precise and was the right instinct: the
artefact *"never defines what the arrival record was supposed to prove"*, so no
reviewer can establish that a substitute preserves the owner's assurance —
which is the reserved row **cannot be bounded from the available evidence**. It
also named the condition that would dissolve its own objection: *"recover the
documented assertions for step 2.1's arrival record. If found, the transition
becomes bounded and can be decided."*

**They were found, and they refute the question's premise.** The question
carried the blocker's own 2026-10-10 claim that the instrument was cancelled and
nothing scheduled could produce the record. That premise is false, and the
refutation sits **one entry above it in the same file**:

- Step 2.1 of `road-to-an-installed-layer-that-is-thinned` names its producer in
  its first sentence — the observer at step 3.0 of
  `stubs/road-to-instructions-loaded-observer.md`, *"NOT the carrier roadmap's
  step 0.2, which the owner cancelled on 2026-10-06 (D10 there)"*. D10 cancelled
  a **carrier**, not the instrument.
- The sibling blocker `arrival-record-needs-a-cancelled-observer` has read
  `resolved` since **2026-10-15**: the owner scheduled that stub's step 3.0 as
  steps 1.1–2.2 of `road-to-a-setup-that-decides-itself`, which is
  `status: ready`.
- That roadmap's step 2.2 reads: **"Hand it to its waiting consumer. The
  installed-layer roadmap's step 2.1 reads this record."**
- And step 2.1 states the three assertions in full — which stubs and standing
  laws loaded at start and after compaction; whether a user-layer `paths:` rule
  loads on `Read`, `Edit`, a creating `Write` and a Bash-first edit; every
  matched delivery under the 8,000 budget with none replaced by a preview.

So the blocker is an **accrual wait on a named, scheduled producer**. Recorded
as D8 of that roadmap, with the resolution clause re-pointed from a closed step
to the condition and its producer.

**The honest reading of this round.** The council answered the question it was
asked, and the question was wrong — the agent carried a stale cross-reference
into the prompt instead of checking it first. The round was not wasted: it was
`openai`'s refusal to accept an unbounded substitution that sent the search back
to step 2.1's own text, where the answer was. But the lesson belongs to the
agent, not to the seats: **execute the resolution condition before writing the
question**, which is the discipline the first sweep applied to four blockers and
did not apply here.

### q9 — the second split, and the arguments the (a) side did not answer

`openai` **DECIDE / (a) conditional on 7.2**; `anthropic` **ESCALATE / (b) with
a staged future option**. Split on both axes, so it escalates.

`openai`: a reversible mechanism strengthening an existing floor crosses no
reserved row, and choosing (b) *knowingly* makes the owner's stated
typed-prompt goal unreachable. Conditional coverage beats permanent
non-coverage when its activation and its limits are conspicuous per session.

`anthropic` routes it reserved — operating infrastructure users depend on is a
public commitment with an ongoing operational burden — and argues (b) on three
grounds the other seat did not rebut:

1. **The gateway is net new exposure surface.** Token restoration, logging,
   error paths and bypass detection are each a place the thing built to prevent
   credential leakage could create one.
2. **The typed prompt has a different exposure profile from the automated
   path.** A person typing a credential has an awareness moment; a pre-tool-use
   path is silent, higher-volume and unaware — so the protection already
   achievable covers the higher-value half.
3. **Partial coverage is a two-class experience.** "Am I protected?" becomes a
   function of how the session was launched: a support burden and a
   false-security risk, not only a documentation one.

Its staged alternative keeps (b) from being terminal: publish the three
channels `uncovered`, amend the goal to the achievable scope, and hold the
gateway as an experimental opt-in if 7.2 later shows a small fail-closed
implementation adding no logging, persistence or error-path exposure.

**Not in dispute, and measured here:** step 7.2 is a probe needing a real
subscription login through a loopback base URL, so it is human-run under either
option. Both seats also treat the coverage table's honesty as settled — (b)
hides nothing, it narrows what is promised.

### q10 — the third split, on a gap rather than on the merits

`anthropic` **DECIDE / (b)**; `openai` **ESCALATE / (a)**. The seats agree on
the substance that matters: the three names come from reading the 2.1.296
binary, so (b) makes a **smaller verified** claim rather than a larger invented
one, and neither seat would accept a fixture inferred from the older extract.
`anthropic` adds that the old extract is itself the risk — using it tests
obsolete behaviour whether or not anyone calls the result "invented".

`openai` escalates on a **missing fact**, not on a judgement: *"what step 5.2
delivers and what happens to 8.5 is absent, so the impact of (b) is
unknowable"* — the reserved row **cannot be bounded from the evidence
available**. It names exactly what would dissolve its own objection.

**Both facts, read from the roadmap after the round:**

- **5.2 delivers the conventions block** — `DESIGN.md` usage rules rendered
  into the host's human-editable conventions file between markers, text outside
  the markers byte-identical, with a drift check that reds on a divergent
  block. That is what (b) drops, and it is nameable.
- **8.5 is unaffected either way.** It is already `[~]` and already human-run by
  its own text: *"Needs a canvas account and network; never run by an agent."*
  The `Blocks` field listing it beside 3.2 and 5.2 is what made its fate look
  open.

With both in hand, (b)'s impact is bounded — lose the conventions block, keep
everything else, 8.5 unchanged — so the stated reserved row no longer obviously
applies.

**Recorded, not acted on.** A seat escalated; the agent found the evidence the
seat asked for; withdrawing the escalation on the agent's own reading is the
move the routing test exists to prevent. One re-run with these two facts
attached would most likely settle it, and that is a cheaper ask than a decision.

## What the ten rounds cost and what they moved

Ten rounds, 2/2 on every one, **$0.00** — all seats subscription-authed through
the CLI. The local counters were reset before the batch under the owner's
standing instruction of 2026-10-07 to run the council through the CLI rather
than the API.

| Outcome | Count | Blockers |
|---|---:|---|
| Decided by the council | 5 | `default-mode-for-consumers` · `maintainer-design-router-name` · `outside-tree-destruction-reading` · `consumer-gate-denominator` · `impact-numbering-model` (option (b); (a) stays owner-reserved) |
| Settled by tree evidence instead | 1 | `default-flip-of-the-installed-layer` |
| Escalated, seats convergent | 2 | `node-floor-raise` · `which-completeness-skills-owe` |
| Escalated on a split | 3 | `auto-default-for-existing-installs` · `request-gateway-build` · `host-sync-layout-at-current-host` |

**Open blockers across the active tree fell 20 → 13**, and seven of the eleven
no longer need the owner. Those are different numbers because two council
decisions did not close their blocker: `impact-numbering-model` keeps (a) with
the owner, and `default-flip-of-the-installed-layer` is an accrual wait rather
than a decision. The sweep that produced the
eleven read the roadmaps' `Owner:` labels; the labels were right about four of
them. That ratio is the argument for attaching the routing test to the question
rather than reading the field — and it is also the measurement that says the
field should not simply be trusted the next time either.
