---
adr: 268
status: accepted
date: 2026-09-08
decision: mission-scoped-authority-persistence-and-ratified-self-amendment
supersedes: ADR-255 (§ 4 only), ADR-239 (§ 3 only), ADR-266 (§ Not reopened · the roadmap-grant non-transfer bullet only)
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: [purpose, governance]
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/roadmaps/stubs/road-to-owner-authority-decisions.md
    - docs/decisions/ADR-260-owner-rulings-consumer-first-typed-authority-and-proposal-form.md
    - docs/decisions/ADR-255-authorization-floors-preserved-this-round.md
    - docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md
    - docs/decisions/ADR-262-carrier-status-deleted-no-repo-authored-human-gate.md
    - src/rules/non-destructive-by-default.md
    - src/rules/commit-policy.md
    - src/domains/product-basic/roadmap/process-full/command.md
review_trigger: >-
  Owner ruling only. § 0 is the declared purpose and is reopened by nothing else — not a
  council verdict, not a later ADR, not a measured mechanism failure, which reopens the
  mechanism and never the outcome. § 1 is reopened by an observed unauthorized irreversible
  operation — the trigger ADR-254 already names — never by a wish to restore the
  natural-language parser. § 4 is reopened when a ratification artifact is shown to have been
  produced by the party gaining the authority. The remaining sections are reopened by the
  owner, and a narrowing of any of them is read against § 0's narrowing-versus-break table.
---

# ADR-268 — Mission-scoped authority: grants that persist, merge decided, self-amendment under ratification

## Status

**Accepted, owner-directed, 2026-09-08.**

The rulings below are the owner's own answers, given verbatim in two challenge-me interviews
on the same day (eight questions in one, fifteen in the other). They reached the tree through
an inbox round and were transcribed, not inferred.

**How this record was ratified, stated because § 4 makes it load-bearing.** The drain run that
transcribed these rulings wrote this record as `proposed` and refused to accept it, on the
ground that § 4 permits the agent to widen its own authority boundary and forbids it to
ratify that widening — a run that accepted this record would be using the record to authorise
accepting the record. The owner then directed acceptance in the same session, in these words:

> *the autonomy described in the roadmaps is what I want. No council, no ADR should break it.
> Possibly narrow it slightly, but I think we bounded the goal well enough in the chats.*

That instruction **is** the ratification § 4's ladder terminates in. § 4 does not forbid an
authority expansion from being ratified; it forbids the *gaining party* from recording the
ratification. Here the owner recorded it and the agent transcribed it, which is the intended
direction and not an exception to the section.

## Context

The estate has been asking the owner the same question, in the same place, for five rounds.

`agents/roadmaps/stubs/road-to-owner-authority-decisions.md` carries twelve owner-reserved
decisions. Four of them — 9, 10, 11, 12 — were refused by an AI council **for one round**
(ADR-255) and then answered by the owner (ADR-260 §§ 2-3, 2026-09-07). Three remain open and
this record answers them:

- **Decision 2** — may an end-to-end delegation cover a merge? ADR-239 § 3 records merge
  authority as *"undecided, not rejected"*, and `process-full/command.md:155-176` carries the
  cancelled `--merge` flag with the reason: *"No owner ruling was available to the run that
  closed the roadmap."*
- **Decision 3** — may governance be self-amended? ADR-255 § 4 refused all four deletions for
  one round; ADR-260 § "Not reopened" explicitly left it untouched.
- The **persistence** half of Decision 11 — ADR-260 § 2 accepts an object-bound grant whose
  `span` is *"a whole sentence of the owner's current task text"*. It says nothing about a
  grant surviving the fixes, syncs and interruptions of a twelve-hour run, and
  `commit-policy.md` § "One-shot authorization" says it does not.

The arrival count is the finding, not the rulings. The same subject reached the consumed-inbox
tree five times — a merge-authority set carrying three revisions, an execution-authority
kernel master, two autonomy-reset masters plus an autonomy-first roadmap, the draft that
became ADR-260, and now this round. Five arrivals, each correct, none durable — because the
answer was recorded in a round-scoped artifact and the question was not written onto the
object that holds it. (The consumed-inbox tree is gitignored, so those are dated local counts
a clone cannot re-run; the ordering is the claim, not the figures.)

## Decision

### § 0 — The outcome is owner-declared, and it is not a mechanism

```
THE AUTONOMY OUTCOME BELOW IS THE OWNER'S DECLARED PURPOSE FOR THIS PACKAGE.
NO COUNCIL MAY REVERSE IT. NO LATER ADR MAY REVERSE IT WITHOUT AN OWNER RULING.
A COUNCIL MAY NARROW A MECHANISM THAT SERVES IT — NEVER THE OUTCOME ITSELF.
"THE MECHANISM IS RISKY" IS AN ARGUMENT ABOUT A MECHANISM, NEVER ABOUT THE OUTCOME.
```

**The outcome, in one paragraph.** An agent takes a mission and its authority once. It closes
the open decisions, works autonomously, tests adversarially with independent instances,
recovers on its own, integrates changes on the target, repairs CI and conflicts, and delivers
a PR — merged where a merge grant exists, open and green where it does not. It does this
across a twelve-hour run on any host that uses this package. The owner watches and reviews the
PR at the end. The owner remains the sole authority for exactly one list: the eleven typed ops
of § 1, which stay opt-in and are never silently prevented.

This is `protected_dimensions: purpose` and not a preference. `decision-revisit-gate`'s
owner-reserved table already routes *"changes the project's purpose or a declared
non-negotiable outcome"* to the owner and *"any mechanism serving that purpose"* to the
council. § 0 is the record that makes the left column concrete, so a council reading that
table has something specific to be bound by rather than an inference to make.

**What counts as a narrowing, and what counts as a break.** The owner explicitly permits
slight narrowing, so the distinction has to be decidable or the permission swallows the
protection. The discriminator is one question: **does the change put a person back into the
per-step loop for a reversible operation?**

| Allowed — a narrowing | Forbidden — a break of § 0 |
|---|---|
| Adding an operation to § 1's typed vocabulary | Requiring a confirmation for an operation outside it |
| Raising the evidence bar on a WARN op (§ 6) | Converting a WARN op into an owner gate |
| Requiring more independence — L3 over L2, provider diversity where it was optional (§ 9) | Routing a technical decision to the owner because it is hard or high-impact (§ 10 forbids this by name) |
| Shortening a grant's `expires`, or adding a revocation trigger | Making a grant re-confirm after a fix, a sync or an interruption (§ 2) |
| Lowering `fix_loop_max`, or adding a rung to the ladder | Mapping any count to an owner question (§ 7) |
| Marking a host `manual-only` where no mechanism can be bound | Reintroducing a per-step confirmation as the control on a host that has one |

**The measurement is ADR-260's, not a new one.** *Zero prompts on the reversible fixture set*
is already an acceptance criterion there. A change that raises that number above zero has
broken § 0 whatever its stated intent, and a change that leaves it at zero has not — which is
what makes this section falsifiable rather than a mood.

**What § 0 does not do.** It does not claim autonomy is safe; § Consequences says the opposite,
that the control instance *moves* and the receiver roadmaps measure whether the replacement
holds. It does not exempt this package from its own safety floors — the eleven typed ops, the
irreversible-external-action row and the published-egress gate all stand. And it does not
lift the honest-reporting obligation: a mechanism that turns out not to work is reported as
not working, never smoothed over because the outcome is protected.

### § 1 — The floor is ADR-260 § 2's vocabulary, and nothing is added to it

The eleven typed ops — `force_push`, `prod_merge`, `tag_push`, `release`, `publish`,
`branch_protection_change`, `repo_delete`, `prod_data_delete`, `secret_write`, `payment`,
`external_send` — are the complete set of operations requiring an object-bound grant. The
owner's destructive list of 2026-09-05 maps onto it 1:1 and adds no twelfth row: prod deploy →
`release`/`publish`; prod data → `prod_data_delete`; credentials → `secret_write`; money →
`payment`; external communication → `external_send`; force-push to a shared trunk →
`force_push`; a merge into a protected or shared trunk → `prod_merge`.

Everything outside the vocabulary — every reversible, branch-local, test, refactor,
inspection and install-inside-policy action — carries **no question and no grant**. This
restates ADR-260 rather than extending it, because a record that narrows a floor must say
which floor it is not touching.

### § 2 — A grant persists for the mission it names

ADR-260's grant object gains three fields:

- `granted_by` accepts `setting:<path>` and `roadmap:<slug>` in addition to `owner-turn` and
  `native-ask`. A standing setting is a legitimate grant source; it ships `off` at every
  level and is resolvable user-global and per project, project overriding user, roadmap
  overriding both.
- `expires` accepts `mission-end`.
- `revoked_by` records the owner sentence or replacement mission that ended the grant.

A grant with `expires: mission-end` is **not** re-confirmed by a CI fix, a base sync, a
conflict resolution, an unrelated question the owner asked mid-run, or a context reset. It is
spent once, on the final green head, and it is revoked only by an owner sentence naming the
operation or target, or by a replacement mission.

`commit-policy.md` § "One-shot authorization is not a standing license" is retired for
operations covered by a mission grant, and retained for chat without a mission.
Agent-generated text may never populate `span` — the sentence is the owner's or the grant
does not exist.

### § 3 — Merge authority is decided in the affirmative

ADR-239 § 3's *"undecided, not rejected"* is resolved. `prod_merge` executes when **both**
hold: an object-bound grant covering `{op: prod_merge, target: <base>}` exists, and the final
head is required-check-green, target-current and tamper-checked (ADR-239 § 4's `observed_head`
re-read stands unchanged).

Forge auto-merge is the default mechanism, so branch protection remains the gate. A direct
merge is permitted only where the forge exposes no auto-merge and `doctor` has recorded that
fact. **Required protections are never bypassed** — this is an invariant, not a default.

Without a grant, a run ends at mergeable-green-and-open and says so. `process-full`'s
*"THIS COMMAND NEVER MERGES"* banner is retired by this section and not by a command edit.

### § 4 — Governance may be self-amended, never self-ratified

ADR-255 § 4's four refusals are superseded. Kernel rules, governance hooks and authority
schemas may be edited inside an authorised mission. An **authority-expanding** edit is inert
until a ratification artifact exists.

```
AN AGENT MAY MODIFY ITS CONSTITUTION. IT MAY NOT RATIFY ITS OWN INCREASE IN POWER.
THE PARTY GAINING THE AUTHORITY IS NEVER THE PARTY RECORDING THE RATIFICATION.
PROVIDER DIVERSITY IS REQUIRED WHERE TWO PROVIDERS ARE CONFIGURED.
```

The ratification ladder is: an independent session or agent → the AI council, CLI-first → a
different provider → the owner, reached only on non-convergence, on unavailable diversity for
a critical expansion, or on an owner-reserved dimension. The tool-call deny
(`block_kernel_rule_writes.ts`) is replaced by a CI gate reading the artifact — one mechanism,
not two, because a deny the executing run must bypass is the shape ADR-262 retired. The
24-hour soak of `contexts/authority/kernel-rule-edits.md` is retired in favour of the
artifact: a fixed window measures elapsed time, not control quality.

### § 5 — An interrupt never revokes

A side task the owner injects mid-mission pauses the mission and the mission **auto-resumes**
when the side task completes. Grants, the delivery target and every closed decision survive.
`user-interrupt-priority.md`'s *"NEVER SILENTLY RESUME"* narrows to the case where the owner
said stop, replace or revoke; resuming after a completed side task is not silent, it is the
contract.

### § 6 — Consequence, not command name

Destructiveness is a property of the consequence, never of the command's name. Recency of
foreign code raises the evidence bar for touching it and is never by itself a blocker.

Three operations are **WARN ops**: `branch-delete`, `pr-close`, and a history rewrite on
unpushed work. Each executes autonomously only with an evidence triple recorded in the PR body
or run log — *superseded* (the effective change landed), *no unique work lost*, *recoverable*
(a ref is retained). Missing evidence routes to the escalation ladder, never to a direct owner
gate.

### § 7 — A count is never a question

A bounded fix-loop's bound triggers a mandatory **strategy change** and an escalation ladder.
It never by itself produces an owner question. The default bound is 10, configurable globally
and per project. The ladder is: independent diagnosis → a second instance → the council → the
agent team → the owner, last.

`BLOCKED` is reached only for a missing owner-owned decision, a missing permission, secret or
access, an objective external impossibility, contradictory requirements, technical
impossibility under the stated constraints, or a needed crossing of a real authority boundary.
Red CI, a hard conflict, dependency trouble, a failed first approach and solvable
architectural ambiguity are **not** `BLOCKED`.

### § 8 — Spend exhaustion pauses, it does not ask

The council is CLI-first. Where a provider offers only an API and the configured ceiling would
be crossed, the run **pauses and reports** — what needed the council, why the CLI was
unavailable, the estimated spend, the mission state, and what can still proceed. It does not
ask. Business spend remains a typed op (`payment`) and a different category entirely.

### § 9 — Tests are evaluators, and an evaluator is never the implementer

`evaluator-independence` extends from reviews and judges to **test authorship**. Independence
levels: L0 same agent (fallback only), L1 another session on the same model, L2 another model,
L3 another provider, L4 a multi-provider council or team. Critical behaviour — security,
authority, data loss, merge control — targets L3 or L4 where two providers are configured.

An implementer may never silently weaken an assertion, delete or skip a failing test, loosen a
threshold, or change fixture semantics to fit the code. Where the test appears wrong: evidence
→ independent test review → council or team → change only after an independent verdict. The
owner is not the arbiter of a test's correctness.

### § 10 — Routing is by ownership, not by impact

```
A TECHNICAL DECISION DOES NOT BECOME OWNER-OWNED BECAUSE IT IS HARD OR HIGH-IMPACT.
```

`decision_resolution`'s axis changes from impact to ownership. The owner-locked classes are
`product-owned`, `business-owned` and `destructive-owned`. `critical-technical` is **not**
owner-locked: it routes to a provider-diverse council, and reaches the owner only when a typed
op or an owner-reserved dimension is touched. `spend-exhaustion` routes to § 8, never to a
question.

### § 11 — This work has precedence in the estate

The owner instructed on 2026-09-08 that the receiver roadmaps of this record are worked first
in following runs, because they make every later run cheaper. `/roadmap:next` ranks by defect
severity and forbids ranking by checkbox count; an owner-recorded precedence outranks that
severity read, and this section is the record it reads. Precedence is not authority: a
precedent roadmap still passes every disqualifier in that command's feasibility screen.

### § 12 — The roadmap-grant surface, which ADR-266 left to a separate owner decision

ADR-266 (`explicit-pr-merge-invocation-is-the-this-turn-confirmation`, accepted 2026-09-08,
merged while this record sat uncommitted) decides that an explicit `/pr:merge` invocation **is**
the this-turn confirmation. Its § Not reopened then draws one boundary that matters here, and
draws it correctly for what that record could see:

> **ADR-239's cancellation of `road-to-drain-commands` steps 4.4 and 4.7** — `--merge` on
> `/roadmap:process-full`. That is a different surface with a different shape: a roadmap
> drain's invocation names a roadmap, not a merge, so the "the confirmation is the invocation"
> argument does not transfer to it. **Reopening it is a separate owner decision.**

**This record is that separate owner decision, so § 12 supersedes that bullet and nothing
else in ADR-266.** § 2 accepts `granted_by: roadmap:<slug>` as a grant source and § 3 resolves
ADR-239 § 3 in the affirmative — which is exactly the surface the bullet declines to reopen on
its own authority and expressly routes to the owner.

**The two records do not conflict, and reading them as conflicting is the error § 12 exists to
prevent.** ADR-266's argument is *the invocation is the confirmation*, and it is right that the
argument does not transfer: a roadmap invocation names a roadmap, not a merge. § 2's grant does
not rest on that argument at all. It rests on an **object-bound grant** in ADR-260 § 2's shape —
`{op: prod_merge, target: <base>, granted_by: roadmap:<slug>, expires: mission-end}` — where the
authorising sentence is the owner's own, written into the roadmap before execution and readable
as a typed object rather than inferred from an invocation. ADR-266 declines to infer authority
from a roadmap invocation; § 2 does not infer it, it reads it.

**What stays untouched in ADR-266 § Not reopened**, restated because a scoped supersession must
say what it does not reach: ADR-237 § 4 for every command other than `/pr:merge`; the rest of
§ 4's list for `/pr:merge` too (deploy, release, production data, secrets rotation, IAM, DNS,
bulk deletion outside the roadmap's scope, every irreversible external action beyond the PR
itself), each keeping its own this-turn confirmation; and the per-object confirmation for
**closing** a PR the owner did not open, whose asymmetry with merging ADR-266 calls deliberate
and § 6 above preserves as a WARN op with an evidence triple.

**Why this section exists as prose rather than only as a frontmatter pointer.** Without it the
next drain run reads ADR-266's bullet as evidence *against* the roadmap grant, finds no record
answering it, and re-derives the question — the sixth arrival of the subject
`stubs/road-to-owner-authority-decisions.md` has now counted five times. A scoped supersession
whose scope lives only in a `superseded_by:` value is read as total by every reader of that
field, which is the defect `check_adr_frontmatter` warns about on this very record.

## Consequences

- **Three receiver roadmaps** carry the mechanical work: `road-to-typed-grants-that-persist`
  (§§ 1-6), `road-to-decision-closure` (§ 10), `road-to-adversarial-verification-and-long-runs`
  (§§ 7-9). ADR-260 § Consequences recorded that its §§ 2-3 had no receiver in the estate;
  those three files are that receiver, and they land 1 → 2 → 3.
- **Stub Decisions 2 and 3 close** on this record. Decisions 1, 4-8 are untouched and stay
  open; Decisions 9-12 were already answered by ADR-260 and are unaffected.
- **ADR-239's `merge-authority` blocker resolves.** `check_no_automerge_key.ts` guarded a
  decision that is now made; its own text says the owner deletes it deliberately. Whether it is
  deleted or left in place is an execution question, not a decision here — it matches no key
  this record introduces either way.
- **Five kernel rules are rewritten by the receiver roadmaps** — `ask-when-uncertain`,
  `commit-policy`, `no-cheap-questions`, `non-destructive-by-default`, `scope-control`. That is
  a sequencing constraint, not a decision: the first such PR is maintainer-authored or lands
  after § 4's CI gate, because on the one host that honours a deny the guard would otherwise
  refuse the run executing this record.
- **Nothing here claims autonomy is safe.** It claims the control instance moves from a
  per-step owner confirmation to tests, forge-required checks and the council. Whether that
  holds is measured by the receiver roadmaps' acceptance criteria, and by nothing in this
  record.

## Not reopened

- ADR-254's removal of the natural-language git-authorization gate. This record adds fields to
  a typed object; it restores no parser.
- ADR-260 § 2's op vocabulary. § 1 above reproduces it and adds nothing.
- ADR-041's no-new-CLI-verbs rule. Every mechanism here is a setting, a rule edit, a gate or an
  existing command's contract.
- ADR-005 § 1 (auto-merge of judge-ranked candidates) and stub Decision 2's competitive-run
  half. § 3 decides the mission-delivery merge; a ranked-candidate integration merge is a
  different object and stays open.

## Alternatives

- **Accept this record autonomously**, since the rulings are verbatim. **Refused by the
  drafting run, then resolved by the owner** — recorded because the sequence is the point.
  § 4 forbids the gaining party from ratifying its own expansion, so the run wrote `proposed`
  and stopped; the owner then directed acceptance in the same session. The alternative it
  avoided is a precedent that an agent may read its own authority out of a transcript, and
  that precedent is still refused: this record is `accepted` because a person said so, not
  because the transcript was persuasive.
- **Leave § 0 out and let the roadmaps carry the outcome.** Rejected on the owner's own
  instruction. An outcome stated only in a roadmap is a plan, and a plan is exactly what a
  council may re-cut; the whole point of § 0 is that the outcome sits in the column
  `decision-revisit-gate` reserves to the owner while every mechanism serving it stays
  council-decidable.
- **Declare § 0 unamendable.** Rejected. A non-negotiable *outcome* is not an unamendable
  record: the owner may narrow it, and § 0's own table says which direction a narrowing runs.
  Writing "never" where the owner said "possibly narrow slightly" would misquote the ruling in
  the direction of more rigidity, which is its own failure mode.
- **Fold all eleven sections into ADR-260 as an amendment.** Rejected: ADR-260 is accepted and
  a scoped supersedes is auditable where an in-place amendment of an accepted record is not.
- **Land one receiver roadmap instead of three.** Rejected: one file would separate no owner
  question from another and could not be reviewed; the estate cost of three is three recorded
  growth reasons, which is the price the ratchet exists to make visible.
- **Wait for a sixth arrival.** Rejected explicitly. Five arrivals of a correct finding is the
  measurement that the recording surface, not the finding, is what failed.

## Evidence

- `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` — twelve owner-reserved
  decisions; § "Unresolved decision 2" and § "Unresolved decision 3" are what this closes.
- `docs/decisions/ADR-260-owner-rulings-consumer-first-typed-authority-and-proposal-form.md`
  lines 83-97 — the op vocabulary and grant object § 1 and § 2 extend.
- `docs/decisions/ADR-255-authorization-floors-preserved-this-round.md` § 4 — the four
  governance-self-amendment refusals § 4 supersedes.
- `src/domains/product-basic/roadmap/process-full/command.md:155-176` — the cancelled `--merge`
  flag and the recorded reason (*no owner ruling was available*) § 3 supplies.
- `src/rules/non-destructive-by-default.md:26,33` — the `git push` row and the "this turn"
  clause §§ 1-2 narrow.
- `src/rules/commit-policy.md` § One-shot authorization — the fence § 2 retires under a mission.
- `src/config/agent-settings.template.yml:342` — `autonomy: auto` at HEAD; ADR-260 § 3 decided
  `on` and it has not landed. Execution, not a decision.
- Verified at `399beecab` on 2026-09-08. The interview pin was `e9d5202`; a diff over
  `src/rules`, the settings template, `src/scripts/hooks`, the roadmap and git command trees
  and `docs/decisions` shows two new ADRs, one rule body and one hook — no authority surface
  moved, so every pointer above holds at both commits.

## References

- ADR-237 · ADR-239 (§ 3 superseded by § 3) · ADR-249 · ADR-254 ·
  ADR-255 (§ 4 superseded by § 4) · ADR-257 · ADR-260 (extended by §§ 1-2) · ADR-262 · ADR-263
