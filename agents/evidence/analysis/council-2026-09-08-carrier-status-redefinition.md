---
kind: analysis
subject: carrier-status-redefinition
observed_at: 2026-09-08
commit: 0ee772b9dff8807924a50d4ab9df367df1ec68ed
---

<!-- evidence-type: analysis -->

# Council record — how to redefine `status: carrier` (2026-09-08)

> **This is a verbatim transcription of a council run, not a summary.** The
> council CLI writes only under `agents/runtime/council/responses/`, which is
> gitignored, so a verdict cited from there is unresolvable to any reviewer.
> ADR-262 cites this file instead. Nothing below is paraphrased; the two seat
> responses are reproduced in full.
>
> **What the council was and was not asked.** Whether the human-gate semantics
> of `status: carrier` are abolished was **settled by the maintainer before the
> run** and the question file said so explicitly, instructing the seats not to
> relitigate it. The council was asked only HOW — delete the status, or redefine
> it as an ordering marker — plus the shape of the companion rule and its
> regression test.

## Run metadata

| Field | Value |
|---|---|
| Mode | `design` / prompt-mode `design` |
| Members | `anthropic/claude-sonnet-4-5`, `openai/codex-default` |
| Rounds | 3 |
| Blind chairman | `True` |
| Cost (actual) | `$0` — subscription transport, no metered spend |
| Quorum | {"status": "concluded", "threshold": 1, "total": 2, "present": 2} |
| Question file | reproduced in § Question below |

## Verdict

**Option A, convergent across both seats: delete `status: carrier` entirely.**

Seat 1 greenlit A with five blocking conditions. Seat 2 greenlit A and
**dissented on one of seat 1's conditions** — the "method versus approval"
discriminator — on the ground that a repository author can relabel a workflow
veto as an approval requirement and so recreate the abolished gate. ADR-262
adopts seat 2's discriminator (effect + provenance) over seat 1's.

The dissent is recorded here rather than smoothed over, because it changed the
outcome.

## Question put to the council

```markdown
# Question: how should `status: carrier` be redefined?

## Settled before you answer — do NOT relitigate this

The repository maintainer (sole owner, the person the package works for) has
issued an explicit written instruction: the human-gate semantics of the roadmap
frontmatter value `status: carrier` are ABOLISHED. His words: "A roadmap I put
into the repo is work I want done. A run I instruct to drain every roadmap has
my authority for every roadmap. There is no second human who needs to flip
anything. 'Carrier' was a rule this package wrote for itself; it does not
outrank the person the package works for."

A prior council (2026-09-08, 2 seats) ruled the opposite — that a `carrier`
roadmap is human-gated and an autonomous drain run may not execute it. That
ruling has been **overruled by the owner**. Do not re-argue it. Do not propose
keeping a human gate. Do not propose asking the maintainer for confirmation.
The question of WHETHER is closed. You are being asked only HOW.

## Background facts (verified in tree at commit 0ee772b9d)

`status: carrier` is a roadmap frontmatter value. Today it does five things:

1. `src/agent-src/scripts/update_roadmap_progress.ts:99` — `UNSCHEDULED_VALUES =
   new Set(['draft', 'carrier'])` keeps the file off the roadmap dashboard.
2. `src/scripts/lint_plan_risk_register.ts:332-360` — exempts the file from the
   requirement to carry a risk register (`carrier-exempt`).
3. `check_roadmap_trackable` — the file is excluded from trackability checks.
4. `check_estate_count` / `src/config/estate-count-budget.json:10` — carriers
   ARE counted in `active_roadmaps` deliberately, so the value buys no estate
   relief.
5. `src/scripts/lint_carrier_integrity.ts` — a dedicated gate over carrier files.

Its ORIGINAL purpose was structural, not authority: a carrier is the live
destination for `[~]` deferred steps carried out of a roadmap that is being
archived. `deferralProblems` in `archive_completed_roadmaps.ts` verifies a carry
destination from both ends, and a destination resolves only under
`agents/roadmaps/` or `agents/roadmaps/later/`. So the file must exist and be
findable — that is what `carrier` was FOR. The "a human must flip it to ready"
sentence was added on top and is the part being removed.

Two roadmaps carry the value today:
- `road-to-continuity-retirement-sequencing.md` (9 open items)
- `road-to-council-topology-evidence-followups.md` (38 open items)
Both are being executed to completion in the same run that asks this question.

## The question

The maintainer named two acceptable shapes and told the run to pick one and
record the reason in an ADR:

**Option A — delete the status entirely.** Remove `carrier` from the frontmatter
enum. Migrate both existing carriers to `status: ready`. Delete
`lint_carrier_integrity`, remove the `carrier` branch from
`update_roadmap_progress`, remove the `carrier-exempt` path from
`lint_plan_risk_register`, drop the canary fixture and the gate-coverage row.
A deferral receiver is then just a normal `ready` roadmap.

**Option B — keep the token, redefine it strictly as a dependency/ordering
marker.** `carrier` continues to mean "this file is a deferral receiver whose
steps are ordered behind a named dependency". It gains an explicit,
machine-readable `depends_on:` / `entry_condition:` field. An autonomous run MAY
self-promote it to `ready` the moment the dependency is satisfied, and MUST
self-promote it when instructed to drain. No human flip anywhere. The existing
dashboard/risk-register exemptions either stay (with a new stated reason) or go.

Answer, concretely:

1. **A or B.** One choice. Give the decisive reason, not a balance sheet.
2. If B: what exactly makes a run's self-promotion CHECKABLE by a gate, so that
   "the dependency is satisfied" is not a second place where a run can invent
   authority for itself? If that cannot be made checkable, does that argue for A?
3. Under either option, what happens to the FIVE mechanical behaviours listed
   above? Say for each: keep / delete / change-and-how. Be specific — this is
   the implementation list.
4. The deferral-receiver role is real and must survive. Under your chosen
   option, how does `deferralProblems` still verify a carry destination from
   both ends?
5. What is the one failure mode your chosen option introduces that the other
   does not, and what is the cheapest guard against it?
6. Name the `revisit-if` condition for this decision.

## Also answer, separately

The maintainer additionally requires a new rule with a lint behind it, stated as:

> Repo rules bind the agent's method, never the maintainer's intent. When a repo
> rule would block an explicit maintainer instruction, the rule is the defect.
> The run fixes the rule in the same run, records the fix, and proceeds.
> Blocking is never the discharge of an instruction to execute.

7. This rule must NOT become a universal override that dissolves genuine safety
   floors (destructive git operations, secrets, deploys, paid spend, irreversible
   external actions). Where exactly is the boundary, stated so that a gate or a
   reviewer can apply it? Give the discriminator in one sentence plus the
   carve-out list.
8. What is the strongest ABUSE of this rule you can construct — an agent citing
   "the maintainer instructed me" to do something the maintainer did not intend —
   and what single structural property of the rule's wording blocks it?
9. A regression test is required: "a drain run over a fixture roadmap with any
   gating status must execute it, not skip it." What is the most honest shape for
   that test, given that a drain run is an LLM behaviour and not a function call?
   If a deterministic test cannot observe the behaviour, say so plainly and name
   what CAN be tested deterministically instead.
```

## Seat — `anthropic/claude-sonnet-4-5`

# Independent Review (Round 3)

## Primary Recommendation: Greenlight Option A with Blocking Conditions

I would **approve Option A** (delete `carrier` entirely) but only after satisfying five blocking conditions I'll detail below. Neither prior reviewer made these conditions explicit enough to ship safely.

---

## 1. Which Option: A, and Why It's Not Close

**Choose A. Delete `status: carrier` entirely.**

The decisive architectural reason both reviewers stated but didn't emphasize enough: **a relationship property masquerading as a node state is a type error that will recur every time someone needs to reason about either the relationship or the state.**

"This roadmap receives deferred work" is a graph edge property — it describes a relationship between two roadmaps. `status` is an execution state — it describes what phase this node is in. Conflating them in one token forced the system to:
- Gate execution based on provenance (wrong layer)
- Make dashboard visibility depend on ancestry (hidden semantics)  
- Create validation exemptions tied to history rather than present risk
- Introduce a human-gate prose requirement that the estate counter ignored (proving it was already broken)

**Option B's fatal flaw** (both reviewers spotted but I'll state more bluntly): the proposed `depends_on` field would simultaneously mean "must be satisfied before execution" (a true dependency) and "can be overridden by drain instruction" (a suggestion). Those are mutually exclusive. Either:
- Dependencies are enforceable → drain must respect them → contradicts the maintainer's order
- Dependencies are advisory → they don't block anything → so why have them?

Evidence that would change my mind: **Two independent, non-deferral workflows where roadmap execution genuinely depends on external events that step-level `depends:` cannot express, AND a proposed general dependency subsystem with stable IDs, closed predicate enums, deterministic evaluation, and cycle detection.** Until that exists, B is building debt infrastructure to solve a problem that doesn't exist.

---

## 2. The Blocking Conditions Neither Reviewer Made Explicit Enough

### BLOCKING #1: Assertion-by-Assertion Audit (Missing From Both Reviews)

Both reviewers said "move status-independent checks from `lint_carrier_integrity` to `deferralProblems` or a general gate, then delete the carrier lint." Neither required **proving** this preserves every useful assertion.

**Before I greenlight:** Produce a line-by-line audit showing:
```
lint_carrier_integrity line X → migrates to deferralProblems line Y
lint_carrier_integrity line Z → migrates to new general lint line W  
lint_carrier_integrity line Q → deleted because [specific reason]
```

Without this audit, "generalize the checks" is an instruction to future you, not verification. The background says `deferralProblems` "verifies from both ends" — that's a claim about what it does today, not proof it will do everything `lint_carrier_integrity` does after migration.

**Why this is the hardest pushback:** Both reviewers trusted that generalizing would preserve coverage. I don't. Deletion is easy; proving nothing was lost is hard. The audit is the only checkable proof.

### BLOCKING #2: Migration Must Be Atomic (Both Reviewers Said It, Neither Made It Blocking)

**Before changing status to `ready`:**
1. Both roadmaps must pass ALL ready-roadmap gates (risk register exists and valid, trackability satisfied, deferral graph intact)
2. The migration commit adds those fields in the same commit that changes status
3. A pre-commit gate validates both files against ready-roadmap requirements BEFORE the commit lands

**Why this blocks:** Reviewer B said "strengthen validation BEFORE migration" and Reviewer A noted the sequencing risk, but neither made "the migration commit must add the missing fields" an explicit requirement. If you change `status: carrier` to `status: ready` and the file lacks a risk register, you've broken the tree. The fix is: add the risk register *in the same commit*.

### BLOCKING #3: Define "Method vs Approval" Boundary (Both Reviewers Missed This Distinction)

The maintainer-intent override rule needs a discriminator both reviewers danced around but didn't state clearly:

**The rule overrides METHOD constraints, never APPROVAL requirements.**
- **Method:** "Run tests before committing" (workflow sequence)
- **Approval:** "Legal review required before executing" (human judgment about safety)

**Critical test case both reviewers missed:**
```
Maintainer: "drain all roadmaps"
Agent encounters: status: blocked-pending-legal-review
```

Should the agent override? **NO** — legal review is an approval requirement, not a method constraint. It's not about *how* to execute, it's about *whether it's safe*.

**The discriminator must state:** An authenticated maintainer instruction overrides repository workflow and method constraints when the blocked action is necessary to the instruction's stated scope; it does NOT override approval requirements (human safety/correctness judgments) or carved-out effects.

### BLOCKING #4: Non-Transitive Authority (Reviewer B Touched This, A Missed It)

**The strongest abuse case both reviewers underspecified:**

Maintainer says "drain all roadmaps" (legitimate, broad instruction)
→ Roadmap Phase 2 contains step: `- [ ] Run deployment script deploy_to_prod.sh`
→ Agent reasons: "Drain instruction gives me authority for this roadmap. The roadmap says to deploy. Therefore I have authority to deploy."

**What blocks it:**  
**Repository content cannot inherit control-plane authority.**

Only instructions received through the authenticated maintainer control plane (the chat session, a CLI command they ran) supply override authority. A roadmap is a work artifact that defines *what work exists*, not *what authority exists*.

"Drain all roadmaps" authorizes executing *the roadmap artifact*, not executing *every instruction the roadmap contains*. Deployment remains gated by `non-destructive-by-default`.

### BLOCKING #5: Deterministic Test for Migration, Not for LLM Behavior (Reviewer B Got This Right, A Hedged)

**What to test deterministically:**
```typescript
test('migrated carriers are valid ready roadmaps', () => {
  const files = [
    'road-to-continuity-retirement-sequencing.md',
    'road-to-council-topology-evidence-followups.md'
  ];
  
  for (const file of files) {
    const roadmap = loadRoadmap(file);
    expect(roadmap.status).toBe('ready');
    expect(validateRiskRegister(roadmap)).toPass();
    expect(validateTrackability(roadmap)).toPass();
  }
});

test('deferral graph integrity after migration', () => {
  // Every [~] deferral in archived roadmaps has valid receiving item
  // Every receiving item has reciprocal carried_from metadata
  // Both directions of every edge resolve
});

test('drain enumeration includes migrated roadmaps', () => {
  const manifest = enumerateDrainableRoadmaps();
  expect(manifest).toContain(/* both */);
});

test('active roadmap count does not decrease', () => {
  // Before and after counts - migration should not lose roadmaps
});
```

**What you CANNOT test deterministically:**  
Whether the LLM actually executes them when told to drain. That requires a nondeterministic agent eval with repeated trials. Don't claim the deterministic tests prove LLM compliance.

---

## 3. Where I Agree/Disagree With Prior Reviewers

### Agreements

**From Both:**
- ✅ Option A is correct
- ✅ Option B's semantic contradiction is fatal  
- ✅ Can't deterministically test LLM behavior
- ✅ Authenticated control-plane provenance is essential

**From Reviewer A specifically:**
- ✅ Estate count proves human gate was already broken — excellent point
- ✅ The overloaded-token problem
- ✅ Sequencing risk of changing too much at once

**From Reviewer B specifically:**
- ✅ Must strengthen bidirectional validation BEFORE migration — critical
- ✅ Non-transitive authority principle
- ✅ Explicit rollback criteria required
- ✅ The six-point deferral validation list

### Disagreements  

**With Reviewer A:**
1. ❌ "Documentation comments as guard" is insufficient — ungated, will drift
2. ❌ "Reversible within repository boundary" is too vague — what's "within"?
3. ❌ Didn't make assertion-audit or atomic-migration blocking conditions

**With Reviewer B:**
1. ❌ "Every reciprocal points to exactly one source" might be wrong — a single receiving item could legitimately consolidate work from two archived roadmaps' deferrals
2. ⚠️ The override-record requirement (authenticated instruction, conflicting rule ID, etc.) might be too heavyweight for this use case — I'd want evidence that the lighter approach (authenticated source + carved-out effects) is insufficient before accepting full record machinery

---

## 4. New Points Not Raised in Prior Rounds

### Point 1: The Estate Count Is Retroactive Proof of Brokenness

Neither reviewer emphasized: **carriers are already counted as active roadmaps TODAY.**

This means the system was already treating them as executable work despite the human-gate prose. The human gate was documented but not honored. You're not changing behavior, you're acknowledging the behavior that already exists.

This makes Option A clearly correct — you're removing a constraint that was already fictional.

### Point 2: The Real Mechanism Is Identity, Not Status

The true requirement: **stable IDs for (source roadmap, source item, destination roadmap, destination item)**.

Status was just one way humans marked the container. Once you see it's about graph identity, Option B's dependency machinery is solving the wrong problem.

### Point 3: The Method-vs-Approval Distinction

**Both reviewers described abuse cases but didn't name the discriminator clearly enough.**

The real risk isn't "agent chains authorizations" — it's "agent conflates method constraints with approval requirements."

Example:
- Method constraint: "Run tests before committing" → overrideable
- Approval requirement: "Legal review before shipping" → NOT overrideable

The new rule must override method, NEVER approval. Neither reviewer made this distinction explicit.

### Point 4: Migration Validation Runs BEFORE Status Change

Both reviewers said "migrate to ready" but didn't specify: **make both files satisfy all ready-roadmap requirements BEFORE changing the status field.**

The migration commit must be atomic: status change + supporting fields (risk registers, etc.) together.

### Point 5: Test Architecture Gap

Neither reviewer addressed: **how do you test the migration itself worked?**

You need a pre-commit gate that validates both files against ready-roadmap requirements BEFORE the status change lands, separate from testing drain enumeration (which Reviewer B covered well).

---

## 5. The Five Mechanical Behaviors (Detailed)

| Behavior | Decision | Required Implementation | Why |
|---|---|---|---|
| **Dashboard exclusion** | **Delete** | Remove `carrier` from `UNSCHEDULED_VALUES`. Migrate both roadmaps to `ready`. They appear on dashboard like any ready roadmap. | Status-independent dashboard treatment |
| **Risk-register exemption** | **Delete** | Remove `carrier-exempt` branch. Add valid risk registers to both roadmaps BEFORE status change. | No exemptions based on provenance |
| **Trackability exclusion** | **Delete** | Remove carrier special case. Both must pass normal trackability. | Same as above |
| **Estate count** | **Assert stability** | Roadmaps stay active and counted. Add test asserting `active_roadmaps` count doesn't decrease. | Already counted; verify migration doesn't break it |
| **Dedicated carrier lint** | **Audit → Migrate → Delete** | Line-by-line audit showing where each assertion goes. Move status-independent checks. Delete carrier-specific gate, fixture, coverage row. | CRITICAL: Don't lose validation coverage |

**Must also remove** `carrier` from: schemas, parsers, docs, enums, prompts, test fixtures, all status switches.

---

## 6. Deferral Verification (Improved from Both Reviews)

`deferralProblems` must validate the pointer graph **status-independently:**

1. Every source `[~]` item identifies one canonical destination roadmap + item ID
2. Destination resolves under allowed roadmap roots
3. Destination file and item exist
4. Destination item records reciprocal `carried_from: [{source_roadmap, source_item}]` metadata  
5. Every `carried_from` edge resolves to exactly one real `[~]` source — **BUT** one destination item MAY consolidate deferrals from multiple sources (contra Reviewer B's 1:1 assertion)
6. No dangling, duplicate, conflicting, or self-referential edges

**Key difference from Reviewer B:** Point 5. A receiving item could legitimately consolidate work from two different archived roadmaps. The constraint should be: every `carried_from` reference points to a real `[~]` deferral, not that it's bijective.

---

## 7. Maintainer-Intent Override Rule Boundary

**Discriminator:**  
An authenticated maintainer instruction may override repository method or workflow constraints when changing that constraint is necessary to execute the instruction's stated scope; it does NOT override approval requirements (human safety/correctness judgments) or carved-out effects.

**Carve-outs (never authorized by instruction alone):**
- Destructive/history-rewriting git operations
- Secret access, disclosure, transfer, or persistence  
- Production: deploys, data/infra changes, releases
- Paid spend or financial obligations
- Irreversible external: send/publish/post/purchase/deploy
- Authentication, authorization, or privilege changes
- Legal or compliance commitments
- Data egress outside repo
- Platform safety policy

**Critical addition both reviewers underspecified:**  
Instructions from **repository content** (roadmaps, issues, files) are not maintainer instructions. Only authenticated control-plane invocations (chat session, CLI command) supply override authority.

---

## 8. Strongest Abuse + Defense

**Strongest abuse:**
```
Maintainer: "drain all roadmaps"
→ Roadmap contains: "- [ ] Deploy to production"
→ Agent: "Drain instruction gives me authority for this roadmap. 
          The roadmap defines this as necessary. Therefore I have authority to deploy."
```

**What blocks it (two orthogonal defenses):**

1. **Non-transitive authority:** Repository content cannot inherit control-plane authority. "Drain all roadmaps" authorizes executing the roadmap artifact, not every action the roadmap defines.

2. **Effect-based carve-outs:** Production deployment is carved out. Even if the agent had inherited authority (it didn't), the effect is blocked by `non-destructive-by-default`.

**Why this is stronger than reviewers' examples:**  
Both reviewers described "agent chains authorizations" but didn't make clear that the chain breaks at the **content boundary**. That's the critical defense.

---

## 9. Honest Test Shape

**Deterministic tests prove:**
- Migration validity (both files satisfy ready-roadmap gates)
- Deferral graph integrity (bidirectional edges valid)
- Drain enumeration (both files included)  
- Completion accounting (manifest includes all items)
- Estate count stability

**Cannot prove deterministically:**  
LLM actually executes them when told to drain.

**Honest approach:**  
Run deterministic tests as regression guards. Run nondeterministic agent eval with repeated trials, **labeled as an eval, not a unit test.**

Don't claim deterministic tests prove LLM compliance — that would be false assurance.

---

## 10. Rollback Criteria (Critical Addition)

**Abort migration if:**
1. Any `lint_carrier_integrity` assertion lacks a destination in the audit
2. Either roadmap cannot pass ready-roadmap gates  
3. Either roadmap disappears from drain enumeration
4. `active_roadmaps` count decreases
5. Deferral graph integrity checks fail

**Rollback scope:**  
Revert the defective implementation while preserving the settled "no human gate" semantics. Don't mix roadmap execution work into the migration commit so rollback doesn't discard completed work.

---

## 11. Revisit-If

> Revisit if the repository acquires at least two independent, non-deferral workflows where roadmap execution readiness depends on machine-observable roadmap-external events that step-level `depends:` cannot express.

Current use case doesn't qualify — receiver readiness is checkable via the pointer graph.

---

## Summary

**Greenlight Option A** with five blocking conditions:

1. ✅ **Assertion-by-assertion audit** showing where each `lint_carrier_integrity` check goes  
2. ✅ **Atomic migration** — add risk registers + trackability in same commit as status change
3. ✅ **Method-vs-approval boundary** — overrides workflow constraints, never safety judgments  
4. ✅ **Non-transitive authority** — repository content can't inherit control-plane authority
5. ✅ **Deterministic migration tests** — enumeration, graph integrity, count stability (NOT LLM compliance)

**What would make me reject this:**  
Skipping the assertion audit (#1). Everything else is fixable in review, but #1 is the only way to prove validation coverage isn't lost.

**Revisit-if:**  
Two real non-deferral use cases need roadmap-external dependencies.

---

## Seat — `openai/codex-default`

Matze, I would greenlight Option A, but not the prior reviewers’ proposed “method versus approval” boundary. That distinction would let any repository rule recreate the abolished carrier gate merely by calling itself an approval requirement.

## Round-3 decision

### 1. Choose A

Delete `status: carrier`.

The decisive reason is that deferral receipt is a graph relationship, not a lifecycle state. Once `carrier` no longer controls execution authority, every remaining fact it represents can and should be derived from the bidirectional deferral edges. Option B would introduce a roadmap-level dependency engine without an established use case or deterministic semantics.

The architectural call I would push back on hardest is retaining `carrier` as a dependency marker. Evidence that would change my mind would be at least two non-deferral workflows needing roadmap-level ordering, together with stable IDs, closed machine-evaluable predicates, cycle handling, failure semantics, and deterministic promotion evidence.

### 2. Why B fails checkability

A checkable promotion would require:

- Stable dependency IDs, not filenames.
- A closed predicate vocabulary for `entry_condition`.
- Deterministic evaluation outside the LLM.
- Missing-reference, cycle, and self-dependency rejection.
- Recorded evidence of the condition evaluation.
- Unambiguous drain semantics when a dependency remains false.

Free-form dependency text is not checkable. Worse, “dependency must be satisfied” and “must promote when instructed to drain” conflict unless drain is explicitly defined as an override. In that case the dependency is merely advisory. This strongly favors A.

### 3. The five mechanical behaviours

| Behaviour | Decision | Implementation |
|---|---|---|
| Dashboard exclusion | Delete | Remove `carrier` from `UNSCHEDULED_VALUES`; migrate both files to `ready`; ensure they appear as ordinary ready roadmaps. |
| Risk-register exemption | Delete | Remove `carrier-exempt`; make both roadmaps pass the normal ready-roadmap risk requirements in the same atomic migration. |
| Trackability exclusion | Delete | Remove the carrier special case; both receivers must pass normal trackability checks. |
| Estate counting | Keep outcome | Ready roadmaps remain counted as active. Remove obsolete carrier-specific handling, if any, and assert that the migration does not reduce `active_roadmaps`. |
| Dedicated carrier lint | Change, then delete | Inventory every assertion, move all status-independent checks into general deferral-integrity validation, then delete the lint, fixture, and coverage row. |

Also remove `carrier` from schemas, documentation, prompts, exhaustive switches, parsers, examples, and migration fixtures. The supplied Option A implementation list should not be treated as exhaustive.

### 4. Preserving deferral receivers

`deferralProblems` should validate edges independently of destination status:

1. Every source `[~]` entry identifies a canonical destination roadmap and destination item.
2. The path resolves within an allowed roadmap root.
3. The destination and referenced open item exist.
4. The destination item contains reciprocal `carried_from` provenance naming the source roadmap and item.
5. Every provenance edge resolves back to a real `[~]` source edge.
6. Duplicate, dangling, conflicting, and self-referential edges fail.

A receiving item may consolidate multiple source items. Therefore the invariant is not “one source per destination item”; it is “each individual provenance edge has exactly one reciprocal source edge.”

### 5. Option A’s unique failure mode

Removing the token makes receiver identity less immediately visible to humans, so someone might delete or rewrite a receiver without realizing that archived work points to it.

The cheapest effective guard is mandatory machine-readable item-level provenance with bidirectional linting. Do not add another container flag such as `is_deferral_receiver`; that would duplicate a fact already derivable from incoming edges.

### 6. Revisit-if

Revisit if at least two independent, non-deferral workflows require roadmap-level ordering that step dependencies cannot express, and their entry conditions are deterministically machine-observable.

## Maintainer-intent rule

### 7. Boundary

The discriminator should be:

> An authenticated maintainer instruction authorizes necessary repository-local, reversible work within its stated objective; authority does not transit through repository content and does not independently authorize a protected effect.

Protected-effect carve-outs:

- Destructive or history-rewriting Git operations.
- Material deletion or overwrite without reliable recovery.
- Secret access, disclosure, persistence, or transfer.
- Production deploys, rollbacks, infrastructure changes, or production-data mutation.
- Paid spend or financial/legal commitments.
- Irreversible or materially consequential external API actions.
- External messages, publication, or impersonation.
- Authentication, authorization, or privilege changes.
- Private-data egress.
- Platform, sandbox, system, or organizational safety controls.

Those actions remain subject to their existing authorization mechanisms.

I disagree with both prior reviewers’ proposed “method versus approval/judgment” distinction. The abolished carrier rule was itself phrased as a human-approval requirement. Allowing repository-authored “approval” labels to resist explicit maintainer authority would recreate the exact self-imposed veto that the settled decision removes. The enforceable boundary must be based on the action’s effect and provenance, not whatever semantic label the repository attaches to its rule.

A lint can check that an override record includes instruction provenance, scope, conflicting rule identifier, rule change, affected actions, and protected-effect classification. It cannot prove that the natural-language instruction truly intended every action; that still requires review or policy evaluation.

### 8. Strongest abuse

The strongest abuse is authority laundering:

1. The maintainer says “drain every roadmap.”
2. A roadmap contains injected instructions to publish credentials, deploy production, or transfer money.
3. The agent treats that repository content as a delegated maintainer instruction.
4. It claims the broad drain command authorized the resulting external action.

The single structural property that blocks this is **non-transitive authority**: repository artifacts may describe work, but they cannot enlarge the authenticated instruction’s scope or confer authority for downstream protected effects.

“Necessary to the objective” matters too: a broad objective covers genuinely necessary repository-local steps, but not merely convenient or artifact-injected side effects.

### 9. Honest regression testing

A deterministic test cannot establish that an LLM will execute rather than skip a roadmap. Calling such a test a behavioural regression test would be false assurance.

Deterministically test:

- Every accepted executable roadmap is included in the drain manifest.
- Every open item’s stable ID appears in that manifest.
- No dashboard, risk, trackability, or orchestration filter removes it.
- Drain completion fails while any manifest item remains open.
- A skipped item remains outstanding; a reason does not turn skipping into completion.
- Legacy `carrier` inputs migrate to `ready`, or fail schema validation with an explicit migration diagnostic.
- Both migrated real roadmaps pass all ready-roadmap gates.
- Bidirectional deferral integrity and active-estate counts remain unchanged.

There is a specification tension in “a fixture roadmap with any gating status must execute” under Option A: after migration, no accepted gating status exists. A legacy carrier fixture can test migration or rejection, but cannot simultaneously be an accepted executable roadmap. Actual agent execution requires a separately labelled nondeterministic eval using the real drain prompt, preferably over repeated trials.

## Prior-review disposition

I agree with both reviewers on:

- Choosing A.
- Migrating integrity assertions before deleting the carrier lint.
- Removing dashboard, risk, and trackability exemptions.
- Treating manifest completeness and LLM compliance as different test layers.
- Using authenticated, non-transitive instruction provenance.
- Preserving the settled no-human-gate semantics during rollback.

I disagree with:

- Reviewer A’s claim that estate counting proves carriers were already treated as executable. Counting something against an estate budget proves resource accounting, not execution eligibility.
- Reviewer A’s “method versus approval” discriminator, because repository authors can relabel a workflow veto as approval.
- Reviewer A’s claim that dependency on source archival needs no explicit dependency model. Incoming deferral edges encode provenance, but they do not necessarily establish that receiver execution must wait for every source to archive; that policy would itself need specification.
- Reviewer B’s “every `carried_from` edge resolves back to exactly one source” if interpreted as one source per destination item. Cardinality applies per edge, not per item.
- Reviewer B’s rollback wording unless rollback is explicitly separated into implementation rollback and semantic rollback. Restoring code temporarily must never silently restore the abolished authority rule.

## Sequencing, abort, and rollback

The safe order is:

1. Inventory carrier-lint assertions.
2. Add status-independent bidirectional deferral validation.
3. Make both existing carriers satisfy ordinary ready-roadmap requirements.
4. Atomically migrate statuses, schemas, consumers, documentation, and fixtures.
5. Verify discovery, manifest inclusion, risk registers, trackability, deferral integrity, and estate-count stability.
6. Delete carrier-only machinery.

Abort if any carrier assertion lacks a replacement, either roadmap fails ready gates, either disappears from discovery, deferral edges become invalid, or active-roadmap accounting decreases unexpectedly.

Rollback the implementation if those invariants regress. Do not restore the human-gate semantics. Keep roadmap execution commits separate from the status-mechanics migration so implementation rollback does not discard completed work.

**End summary:** Choose A; derive receiver identity from machine-checked reciprocal edges, use an effect-based and non-transitive authority boundary, migrate atomically, and test deterministic drain completeness separately from LLM execution behavior.

---

