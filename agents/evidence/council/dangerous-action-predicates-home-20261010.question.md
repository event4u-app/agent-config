<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-10, committed verbatim so the
     split beside it can be checked against what was actually asked. Not
     edited after the run. -->

# Step 2.1 — where does the six-predicate test live?

One question for `road-to-authority-routing-mechanism` step 2.1. Answer on the
evidence below; do not summarise it back.

## What has to be committed

The six-predicate dangerous-action test from the authority-routing council
record (§ 4), verbatim, plus the rule stated beside it: *uncertainty about
whether a predicate applies goes to the council for classification; a council
finding that a predicate applies routes authorisation to the user.*

The predicates: (1) non-trivial loss, disclosure, expenditure, external
communication, reputational effect, or loss of access · (2) affects production,
shared infrastructure, third parties, legal obligations, or anything outside the
authorised workspace · (3) grants, delegates, persists or widens present or
future agent authority · (4) weakens, bypasses, reclassifies or disables a
control meant to constrain agents · (5) recovery needs a person, a privileged
credential, an external administrator, payment, or unavailable prior state ·
(6) target, authorisation or maximum blast radius cannot be established before
execution.

## The two options the step names

- **(a)** a new `docs/contracts/dangerous-action-predicates.md` <!-- ref-ignore -->
- **(b)** a section appended to `docs/contracts/ratification-artifact.md`

## Four facts that bear on it, all verified today

1. **`ratification-artifact.md` is itself a gated surface.** Its own § When the
   user decides, condition 4, names "the modules that compute the record's
   `subject`, write the record, ask the questions and derive the verdict, **and
   this contract**".

2. **The gate's watch list is a fixed path set.** `check_kernel_edit_ratified.ts`
   watches the nine kernel rules, `block_*.ts` hooks, hook plumbing, itself, its
   reader, the closure reader, the policy file, the workflow, and three
   platform-anchor paths. **A new file under `docs/contracts/` is on none of
   them.** Measured today: a comment-only edit to the gate's own header returned
   `scanned: 1 · the ratification mechanism itself` and was refused for having
   no record — so the watch list is live and narrow.

3. **A blocker opened today gates option (b) in practice.** An AI council
   (2026-10-10, 2/2) ruled that a forge-side approval outside the candidate
   branch must precede the first authority-expanding merge to that contract. It
   is owner-reserved and open. So (b) likely cannot land until the owner acts;
   (a) plausibly could land today.

4. **`ratification-artifact.md` is 584 lines.**

## What makes each option WRONG

- **(a) is wrong if** a predicate test living outside the gate's watch list can
  later be weakened by a diff carrying no record — which is the circularity the
  parent record names: *"the enforcement code must not be ratifiable through the
  same process it enforces."* A test that defines what counts as dangerous is
  arguably enforcement.
- **(a) is also wrong if** two contracts drift: the one that cites the
  predicates and the one that states them.
- **(b) is wrong if** putting the predicates behind an owner-gated blocker means
  they are never committed at all, leaving the routing table this roadmap exists
  to install with no definition behind it.
- **Either is wrong if** it is chosen because it is the one that can land sooner.

## Two moves that are forbidden here, by name

- Do **not** pick (a) because (b) is blocked. Landability is a fact to weigh,
  never a reason on its own — say so explicitly if it moves you.
- Do **not** propose a third location that is merely a compromise of the two.
  A third option is legitimate only if you name what it guarantees that neither
  (a) nor (b) does.

## What to return

1. Your pick — `(a)`, `(b)`, or a named third option.
2. Whether a new file under `docs/contracts/` should be **added to the gate's
   watch list in the same change**, and what that costs. This is the half the
   step did not ask and the one fact 2 makes live.
3. One sentence on what your pick guarantees and one on what it does not.
4. Confidence, and any dissent you would want recorded.
