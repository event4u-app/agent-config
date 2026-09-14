<!-- evidence-type: analysis -->

# Threat pass over `typed_op_grant` and `mission_record` — 2026-09-14

The Phase 1 artefact of `road-to-authority-object-exactness`. Both modules are
authorization surfaces: `typed_op_grant.grantFor` decides whether a typed op
proceeds, `mission_record.restore` decides whether a mission resumes under a
grant. `security-sensitive-stop` puts this pass **before** the first edit, and
this file was committed before either module changed.

The four findings the roadmap carries are the **input**, not the conclusion. They
came from a review of the *tests*, so they are what an outside reader could see
from the assertions — treating them as the whole population is the sampling error
`downstream-changes` names. Section 4 records what a pass over the *modules*
found on top of them.

## 1 — The surface, measured rather than assumed

Every consumer of either module, as of `0b8961c4d`:

| Module | Consumers |
|---|---|
| `typed_op_grant` (`grantFor`, `ExactObjectAsk`) | `tests/scripts/typed_op_grant.test.ts`, `tests/e2e/adversarial-verification-fixtures.test.ts` |
| `mission_record` (`restore`, `MissionRecord`) | `tests/scripts/mission_continuity.test.ts`, `tests/e2e/adversarial-verification-fixtures.test.ts` |

**There is no production caller of either module.** Both are pure libraries that
the shipped scripts do not yet import. Two consequences, and they point in
opposite directions:

- The **live** blast radius of a weakened check is zero today. Nothing is
  currently being authorised through these functions.
- The **migration** cost of a signature change will never be lower than it is
  now. A control that is cheap to add today becomes a breaking change to every
  call site the moment the first one is wired.

That second point is what changes the disposition of finding 3 below, and the
change is recorded rather than assumed.

## 2 — Reproduction: each finding, against the tree

Run before any edit, against `0b8961c4d`:

```
D1 !!!!!!!!      -> granted
D1 all-branches  -> granted
D1 category-1    -> granted
D2 op=""         -> granted
D2 op="   "      -> granted
D2 op=tab        -> granted
D3 ask keys      -> op,object,confirmed
D4 snapshot=grant-A ledger=grant-B -> resume
```

All four hold exactly as the roadmap describes them. One detail of the roadmap's
*prescription* does not survive contact with the tree, and is recorded in § 3.1.

## 3 — Abuse cases, missing controls, negative tests owed

### 3.1 `objectIsExact` accepts a category or a punctuation run

**The control today.** `object.trim().length >= 8 && /[^a-z ]/i.test(object)` —
eight characters, one of which is not a letter or a space.

**Abuse case.** The Hard Floor's guarantee is that a human approved *the exact
thing that is about to happen*. An agent that renders its confirmation prompt
from a category — "force-push all-branches?" — and gets a yes has a `granted`
verdict over an object naming no ref and no SHA. The human believes they approved
one push; the grant covers every branch. `!!!!!!!!` is the same hole with the
pretence removed: a confirmation whose object carries no information at all still
grants. The guarantee the Hard Floor rests on is not real.

**The control it needs.** Per-op structure, not a shape-free heuristic. What
makes an object exact is that it *pins* the operation: a ref-and-SHA for a push,
a recipient-and-subject for a send, an amount-and-suffix for a purchase.

**Where the roadmap's prescription is wrong.** It says a force-push object
"names a remote, a full ref and a SHA". The shipped object in
`tests/scripts/typed_op_grant.test.ts` is `drain/adversarial-verification @
0e100f17c` — a ref and a SHA, and **no remote**. Requiring a remote would refuse
a shipped object, which is Risk 1 of the roadmap firing on the first step. The
remote is therefore **optional** in the implemented shape, and the mandatory part
is the pair that actually pins the push: a ref and a SHA. The roadmap's text is
the weaker authority here; the shipped fixture is the stronger one.

**Two-tier design, and why the lower tier is not simply "refuse".** Refusing
every op with no declared shape would make an unrecognised op's Hard-Floor ask
unanswerable, which Risk 1 names as worse than a loose one. So:

- A **universal floor** applies to every op, declared or not: an object with no
  alphanumeric run of length ≥ 2 is refused. This kills `!!!!!!!!` everywhere
  and cannot refuse a legitimate object, because no real object is punctuation.
- A **per-op shape** applies where one is declared, and is where `all-branches`
  and `category-1` are refused for a push.
- An op with **no declared shape** keeps the existing heuristic above the
  universal floor, per the roadmap's own mitigation.

**Residual, stated rather than closed.** For an op with no declared shape,
`all-branches` still grants. The declared set is the eleven-op vocabulary
`typed_op_watch.TYPED_OPS` — the Hard Floor's own list — so the residual lives
entirely *outside* the set of operations this gate exists for. That is the
bounded form of the hole, not its removal.

**Negative tests owed.** `!!!!!!!!`, `all-branches`, `category-1` each refused;
a punctuation-only object refused under an *undeclared* op too (the universal
floor); and every shipped object still granting.

### 3.2 `op` is never validated

**The control today.** None. `op` is read for the reason string and never
checked.

**Abuse case.** The object names *what*; the op names *what is about to happen to
it*. An ask carrying `op: ''` and a well-formed object renders as a confirmation
with a blank verb — "proceed with  on `drain/x @ 0e100f17c`?" — and grants. The
half of the sentence that distinguishes a push from a delete is the unchecked
half. A whitespace-only op is the same hole with the blank made invisible to a
reader scanning a log.

**The control it needs.** A non-empty, non-whitespace op, refused before the
object is even considered — the verb is read first because it decides which
object shape applies.

**Negative tests owed.** `''`, `'   '` and `'\t'` each refused, red before the
fix.

### 3.3 `confirmed` carries no turn provenance

**The control today.** A bare `boolean`.

**Abuse case, and it is not the one the roadmap assumed.** The roadmap frames
this as a decision about type ergonomics. The concrete threat is a **replay
across a restart**, and the sibling module is what makes it concrete:
`mission_record` exists precisely so a twelve-hour run survives a restart by
persisting its state. An ask serialised into that record with `confirmed: true`
and read back after a restart is, to `grantFor`, indistinguishable from a
confirmation the human gave a second ago. The Hard Floor's wording is a
THIS-TURN confirmation; a boolean cannot express it, and the module that will
persist it is already in the same directory.

This is not a malicious-caller threat — a dishonest caller would forge the turn
too. It is an **accidental-replay** threat, and against that the control works:
the restoring caller honestly knows the current turn, and the stale ask honestly
carries an old one.

**Disposition — implement, not record.** The roadmap made this a decision step on
the stated ground that a turn identifier "touches how every caller constructs an
ask". § 1 measures that claim: there are **two** callers and both are tests.
Since `grantFor` is pure, the current turn cannot come from the ask — a caller
that constructed both sides could trivially set them equal — so it has to be a
third parameter, and a third parameter that defaults to off is a security check
that is off by default. It is therefore **required**, and both test callers are
updated in the same change. AC-4's first branch is satisfied rather than its
second.

**Negative tests owed.** A confirmation whose turn differs from the current turn
does not grant; a confirmed ask carrying an empty turn does not grant.

### 3.4 `restore` ignores `ledger.grant`

**The control today.** `restore` reads `ledger.revoked_by` and never compares
`ledger.grant` with `record.authority.grant`.

**Abuse case.** A record carrying grant A and a ledger describing grant B resumes
as though the two agreed. Concretely: a mission is authorised under a narrow
grant, that grant lapses, a *different* and possibly broader grant is later
written to the ledger, and the restored mission resumes — reading the new grant's
"not revoked" as clearance for the old grant's snapshot. The ledger is being used
as an oracle for a question it was never asked. A revocation that works by
*replacing* a grant rather than by setting `revoked_by` is invisible to the
check that exists.

**The control it needs.** Identity before precedence: the two must be about the
same grant *before* either wins. The one-way precedence the module documents —
the ledger may revoke, never revive — is correct and is unaffected, because the
identity check runs first and refuses both directions equally.

**Ordering, checked against the existing assertions.** Every `restore` call in
the two consuming test files passes a ledger whose grant matches the record's, or
passes `null`. Placing the identity check first therefore changes no existing
verdict, including the `authority-withdrawn` case at
`adversarial-verification-fixtures.test.ts` where a revoked snapshot meets a live
ledger under the same grant name.

**Negative tests owed.** A snapshot and a ledger naming different grants refuse
rather than resume; the two existing revoke-precedence assertions still hold.

## 4 — What the pass over the modules found on top of the four

### 4.1 An empty grant is a grant — IN SCOPE, fixed here

`restore` never checks that `record.authority.grant` names anything. A record
carrying `grant: ''` and a ledger carrying `grant: ''` compares equal and
resumes: a mission running under an unnamed grant is not running under a grant.
This is finding 3.2's shape one module over — the identifier is checked for
*agreement* and never for *existence* — and Phase 1 puts a wider hole found here
in scope. Fixed in the same change, with a negative test.

### 4.2 An unrecognised council verdict silently loses a veto — RECORDED, not fixed

`grantFor` compares `verdict === 'out-of-mission'`. `CouncilVerdict` is a
TypeScript union, which is not a runtime guarantee: a verdict crossing a JSON
boundary as `'out-of-mission '` or `'OUT-OF-MISSION'` does not match, and the
veto is lost.

**Not fixed here, and the reason is ownership.** There is no JSON boundary inside
this module — the caller supplies a typed verdict, and there is no caller. The
control belongs at the boundary that parses the verdict, not at the pure function
that receives it. Making an *unrecognised* verdict veto would also invert the
module's deliberate "an UNAVAILABLE council does not block the op" design, and
turn a typo into the silent kill switch `council-availability` exists over. The
control the first real caller owes: **validate the verdict against the union at
the parse site, and fail closed there.**

### 4.3 A ledger that reports nothing is read as reporting no revocation — RECORDED

`restore` treats `ledger === null` as "no ledger entry" and resumes on the
snapshot alone. That is safe only while revocation is implemented as a *write*
(`revoked_by` set) rather than as a *delete* (the row removed). If a future
ledger writer revokes by deleting the row, every revocation becomes invisible.
The control the ledger writer owes: **revoke by writing, never by deleting.**
Recorded rather than changed, because inverting it today would make a missing
ledger a hard block on every restore, which is the same kill-switch shape as 4.2.

### 4.4 `op` and `object` are interpolated into reason strings — RECORDED

Both are placed into human-facing reason text unescaped. An `object` containing a
newline can render a reason that reads as two separate decisions in a log. No
control added here: the reasons are returned as data, and escaping belongs to
whatever renders them. The control the renderer owes: **treat the reason as a
single field, not as pre-formatted log lines.**

## 5 — The negative-test ledger

Every fix below owes a test that is **red before it and green after**, and the
red was observed rather than assumed.

| # | Fix | Negative test — the input that must be REFUSED |
|---|---|---|
| 3.1 | per-op object structure | `!!!!!!!!`, `all-branches`, `category-1` under a push; punctuation-only under an undeclared op |
| 3.2 | `op` validation | `''`, `'   '`, `'\t'` |
| 3.3 | turn provenance | a confirmation from a prior turn; an empty turn |
| 3.4 | grant identity | snapshot grant A against ledger grant B |
| 4.1 | grant existence | snapshot grant `''` against ledger grant `''` |

Positive control, against Risk 1: every shipped exact object in the two consuming
test files still grants after the change.

Run them with:

```
npx vitest run tests/scripts/typed_op_grant.test.ts
npx vitest run tests/scripts/mission_continuity.test.ts
```
