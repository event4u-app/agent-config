# Design note — can the promotion gate count projects without enumerating them?

One page, written before implementation, as the deferral on the two project-level
kill-criterion counters requires. The question is narrow: the gate needs
**projects with ≥ 10 sessions** and **projects with ≥ 1 promoted observation**.
Both are per-project facts. Every recorded lock says a per-project record must not
exist at the global layer. Is there a primitive that counts without enumerating —
or is the honest answer that these two counters cannot ship?

## What the locks actually forbid

Checked for mechanism match, not cited by vibe:

1. **The refused P-layer namespace.** *"The moment any code path — error handling,
   collision detection, a diagnostic — touches the parent directory, `readdir` …
   hands the agent a list of every project the user has ever worked on. Collision
   detection is itself a forced enumeration … at a 0% collision rate the
   enumeration risk is still 100%."* The object of the refusal is **metadata
   leakage through ordinary filesystem operations**, not content leakage and not
   only deliberate enumeration.
2. **Lock #3, upheld unamended.** Project-shaped data must not live at the
   user-global layer. Project context is permitted only as a *field on a user
   observation* — never a project-shaped artefact, never a project-indexed tree.
3. **The operator amendment on `seen_in[]`.** The accepted shape is *"narrower,
   not zero"*: a field leaks only to a **targeted read of one file**, whereas a
   directory leaks **passively to any parent-directory access**. The amendment is
   explicit that this is a difference in surface, not in kind — so "it's only a
   field" is not a licence to add more project keys anywhere.

**The operative test.** The first draft of this note reduced the locks to "can any
code path recover a *list* of the user's projects?" — and the council was right
that this is too narrow (round 1, 2026-07-30): it silently drops the *passive*
half of the refusal. Recovering a list is the loud failure; the quiet one is that
ordinary operations expose project metadata without anyone choosing to look. The
reviewer's example is exact and applies to any file we might add: `fs.stat` on a
per-project state file leaks a modification time, i.e. "the user worked in some
project at time T", to any diagnostic that touches it. So the test is two-part:

- **(i) Listability** — can any path, intended or incidental, recover the set?
- **(ii) Passive exposure** — does normal operation (error handling, diagnostics,
  collision detection, a `stat`) expose per-project metadata without an explicit
  decision to enumerate?

A primitive must clear **both**.

## Candidates

| # | Primitive | Clears (i)? | Clears (ii)? | Verdict |
|---|---|---|---|---|
| 1 | Per-project state file / directory | No — `readdir` | No — `stat` leaks per-project mtime | Refused: this IS the rejected namespace |
| 2 | A set of salted digests of project keys | No — set size leaks the count, and membership is testable against any guessable path | No | Refused: hashing changes readability, not kind |
| 3 | Reuse `seen_in[]` on buffered observations | Partially — and it is destroyed on purpose: `seen_in[]` is **pruned at promotion**, removing exactly the evidence the numerator needs | n/a | Unusable without undoing a shipped safety control |
| 4 | A cardinality sketch (HyperLogLog et al.) | **Depends on the regime — see below** | Depends | Refused, on the scissor below |
| 5 | Don't count projects; let the gate fire on the accept-rate limb it already has | Yes — nothing new stored | Yes | **Chosen** |

## Why the sketch fails — the scissor, not the hand-wave

The council's sharpest hit landed here, and it was correct: the first draft
rejected HyperLogLog with *"the error enters twice, once through each sketch"*,
which is misdirection — the numerator is a **subset** of the denominator, so the
errors are correlated rather than independently compounding. The reviewer also
noted the draft never computed an error band, and called the section *"a
well-written advocacy document for a foregone conclusion"*. That criticism is
accepted and the argument is replaced, not patched.

The real disqualifier is a **scissor between accuracy and non-enumerability**,
and it is a lock argument rather than a fitness one:

- **To be accurate at n in the tens**, a cardinality sketch must operate in its
  small-cardinality regime — sparse representation plus linear counting, which
  estimates from *which registers are still empty*. That state is per-item-derived
  and therefore **membership-testable**: hash a candidate project path, look at
  its register, and an empty register proves that project was never inserted. With
  m registers ≫ n items most registers are empty, so a diagnostic (or anyone) can
  exclude most candidate paths outright and confirm the rest probabilistically.
  Candidate paths are not secret — the filesystem supplies them. In this regime the
  sketch **is** candidate 2 with extra steps: it fails test (i).
- **To avoid membership-testability**, the sketch must run dense and coarse enough
  that no register maps to few enough items to be informative. In that regime the
  estimate at n≈20 cannot resolve a **40% ratio**: the decision needs "is the
  numerator above or below 8 of 20", and a coarse estimator's band spans that line.
  It fails fitness.

Accurate ⇒ enumerable. Non-enumerable ⇒ non-decisional. There is no parameter
choice that is both, which is why this is a cancellation on the locks and not a
deferral pending better tuning. ADR-118's bar is the secondary reason, not the
primary one: automate on a direct measure, and "a number exists" is not "the
number is trustworthy".

## What ships instead, and what it costs

**Both project-level counters are cancelled.** The two behavioural counters —
`observations_proposed` and `observations_accepted` — are wired at the real write
sites and need no project identity. The kill-criterion is a disjunction:

> after 90 days live, **< 40%** of projects with ≥ 10 sessions carrying ≥ 1
> promoted observation, **or** a median review→accept rate **< 30%**, triggers a
> mandatory teardown review.

The second limb is fully instrumented by the two wired counters, so the gate can
still fire — but only on adoption *quality*, never on adoption *breadth*.

**The cost, stated at the strength the council put it, not softened.** The breadth
limb exists precisely to catch the case accept-rate cannot see: *"a feature used
seriously in 2 projects with a 95% accept rate is not validated — it's a pet
feature."* Removing that limb means a layer that is well-liked by one power user
who wired it into their workflow will pass the 90-day gate. The first draft
proposed a human counting projects at review time as the remedy; the council
rejected that too, and correctly — it outsources the automated gate's job and
merely delays the same enumeration by 90 days. So no remedy is claimed here. The
limitation is accepted, in the open, as the price of the no-enumeration guarantee.

## Decision

Outcome **(b)** of the two permitted outcomes: cancel both counters, with this note
as the reason. Explicitly **not** taken: a workaround that technically evades the
locks — a digest set, or a sketch operating in its membership-testable regime —
while violating the argument that produced them.

Council review, 2026-07-30 (one pass, claude-sonnet-4-5 + gpt-4o, $0.038): both
members independently reached **(b)**. gpt-4o: *"the absence of a reliable,
non-enumerative counting primitive effectively limits breadth assessment"*, with
transparency in the ADR as the condition. claude-sonnet-4-5 reached the same
verdict *"but not for the reason the note gives"* — and its reason is the one now
recorded above: the gate as specified requires data the locks forbid, and
weakening the gate to dodge the locks is the thing that must be written down
rather than absorbed. Its required sentence is in ADR-138 verbatim in substance.

## See also

- [`global-user-memory-cut`](global-user-memory-cut.md) — the three locks, the round-2 namespace reversal, and the `seen_in[]` amendment this note tests against.
- `docs/decisions/ADR-138-global-user-profile-layer.md` § Promotion-behaviour gate — the criterion, its window, and the non-self-locking argument.
- `src/scripts/_lib/user_memory_gate_counters.ts` — the four-field counter struct; two wired, two cancelled here.
