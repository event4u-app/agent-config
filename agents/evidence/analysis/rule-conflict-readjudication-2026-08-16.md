# Rule-Conflict Re-Adjudication — the 12 `real-conflict` pairs, ten days on

Closes **F4.1** of `road-to-rule-coherence-followup`. The input is the
one-time offline audit
[`rule-conflict-audit-2026-08-06.md`](rule-conflict-audit-2026-08-06.md),
which classified 192 generated candidates and left 12 as `real-conflict`.
F4.1 asks for those to be re-run **against the current rule text** before any
further rewrite, because the parent roadmap changed several of the rules the
audit quoted.

Re-run against `origin/main` @ `ae8d443e3` on 2026-08-16.

## 1. The count the roadmap carried was already stale

F4.1 says "the 9 remaining `real-conflict` pairs". That was true when the
roadmap was written: 12 findings minus the 3 the parent had declared. Two more
have been declared since, so the live number at re-adjudication time is
**seven**, not nine. The step's own arithmetic is the first thing this pass
falsified, which is the reason the step exists.

Disposition of all twelve, measured by whether
[`rule-interactions.yml`](../../../docs/contracts/rule-interactions.yml)
carries a row for the pair — the audit's own criterion for `already-declared`:

| # | Pair | 2026-08-06 | 2026-08-16 | Basis |
|---|---|---|---|---|
| RC-1 | `commit-policy` × `secret-vcs-guard` | real-conflict | **declared** | row `secret-guard-x-commit-policy` |
| RC-3 | `context-hygiene` × `downstream-changes` | real-conflict | **declared** | row `downstream-changes-x-context-hygiene` |
| RC-8 | `direct-answers` × `role-mode-adherence` | real-conflict | **declared** | row `direct-answers-x-role-mode-adherence` |
| RC-9 | `downstream-changes` × `token-efficiency` | real-conflict | **declared** | row `downstream-changes-x-token-efficiency` |
| RC-10 | `fast-path-marker-visibility` × `session-canary` | real-conflict | **declared** | row `fast-path-marker-x-session-canary` |
| RC-2 | `communication-through-line` × `role-mode-adherence` | real-conflict | **declared this pass** | resolution transferred, § 3 |
| RC-12 | `role-mode-adherence` × `session-canary` | real-conflict | **declared this pass** | resolution transferred, § 3 |
| RC-4 | `context-hygiene` × `external-reference-deep-dive` | real-conflict | **reduced, declared this pass** | § 2 |
| RC-5 | `context-hygiene` × `security-sensitive-stop` | real-conflict | **reduced, declared this pass** | § 2 |
| RC-6 | `context-hygiene` × `source-discovery-gate` | real-conflict | **reduced, declared this pass** | § 2 |
| RC-7 | `context-hygiene` × `think-before-action` | real-conflict | **reduced, declared this pass** | § 2 |
| RC-11 | `fast-path-marker-visibility` × `telegraph-speak` | real-conflict | **unchanged, declared this pass** | § 4 |

Zero of the twelve are left undeclared. None of the twelve was resolved by
deleting a claim from a rule body; every one of them was resolved by naming a
winner and a decision domain, which is what the register is for.

## 2. The four read-loop pairs — reduced by the cap, not closed by it

F4.1 predicted these four "were materially reduced by the parent's
declared-protocol cap of 8". Re-measured, that is right and it is not
sufficient, and the distinction is the finding.

**What the cap did.** `context-hygiene` now carries § *Declared read
protocol — the cap goes UP, never off*: an undeclared read run keeps
3-warn / 5-abort, a **declared** protocol raises the abort to eight read-only
turns, and the abort is never suspended. A declaration is valid only if it
states, before the reading starts, the falsifiable analysis goal, the expected
read count, and the output shape the reads feed.

That is precisely the escape hatch the four counterparties need. Each of them
mandates a multi-read protocol whose three fields are already written down
somewhere:

| Pair | The declared protocol's three fields, already specified |
|---|---|
| RC-7 `think-before-action` | goal = the change being planned · count = the minimum read set (symbol, callers, tests, abstractions, data) · shape = the plan |
| RC-6 `source-discovery-gate` | goal = the structure being confirmed · count = the probe set · shape = **the Evidence Report**, named by the rule itself |
| RC-5 `security-sensitive-stop` | goal = the surface · count = the analysis skill's own steps · shape = abuse cases + missing controls + required negative tests |
| RC-4 `external-reference-deep-dive` | goal = the axis being classified · count = the fetch budget the rule already requires be stated · shape = the adopt / adapt / reject table |

**What the cap did not do.** Neither side says any of this. `context-hygiene`
does not name a single one of the four as a protocol that qualifies, and none
of the four tells the agent to declare. So the agent that follows either rule
literally still meets a contradiction: an eight-turn ceiling it was never told
it could reach, against a protocol it was told is mandatory. A wider ceiling
that nobody knows how to unlock is not an arbitration.

**Verdict: `real-conflict`, materially reduced, and the resolution is a
declaration rather than a rewrite.** Four rows added (§ 5). This deliberately
does not touch the four rule bodies — F4.1 says to re-run the pairs "before
writing any further rewrite", and the register is the surface that can record
a winner without one.

**A residue the rows do not remove, stated rather than smoothed over.** Eight
is a ceiling, not an accommodation: a deep dive over a large external
repository can exceed it with a valid declaration in hand. The rows say what
happens then, and the two rules agree on it — surface which subtrees stay
un-inspected and ask, which is the same instruction the abort gives. The pair
that is genuinely unresolvable at the ceiling is therefore not a conflict but
a stop, and both rules already prescribe the same stop.

## 3. The two reply-position pairs — one resolution, three surfaces

RC-2 and RC-12 are the same collision as RC-8, reached through two rules that
restate `direct-answers`' closing obligation: `communication-through-line`
("close the loop with ONE end-summary") and `session-canary` ("a PR created
this turn puts its raw URL as the literal last line"). `role-mode-adherence`
claims the same terminal position for the mode marker.

RC-8's row already resolves it, and its `conflict` text even names
`session-canary` as the restating rule — but the register is keyed on pairs,
so a reader who loads `session-canary` and `role-mode-adherence` without
loading `direct-answers` finds two declared rules and no row between them,
which the linter's own message calls the worse failure. The resolution
transfers verbatim, so the two new rows say so explicitly rather than
re-deriving it: **the mode marker goes last, the summary or PR URL is the last
line of prose immediately above it**, on the ground that an HTML comment is
invisible in rendered output and therefore does not defeat the
scannable-handle purpose the last-line rule serves.

**One pair fell out of adding these**, and it is a real interaction rather
than an artefact of the closure check: `communication-through-line` states at
its own line 17 that "brevity and the one-recommendation rule win on
conflict", which is a precedence claim over `direct-answers` with no row.
Declared as `direct-answers-x-communication-through-line`, senior
`direct-answers`, quoting the junior rule's own sentence. Adding six slugs to
the register produced exactly this one additional obligation — measured, not
assumed, by running the linter with the slugs added and no rows.

## 4. RC-11 — unchanged, and worth saying so

`fast-path-marker-visibility` requires its marker verbatim, to the byte.
`telegraph-speak`'s seven carve-outs were re-read in full at
`src/rules/telegraph-speak.md`: fences, numbered-options blocks, code blocks,
backtick spans, status glyphs, mode markers, deliverables. The marker is none
of them — it is chat prose by that list's own reasoning, and carve-out 7
excludes it explicitly by defining deliverables as what is written *for* the
user rather than to them.

So the audit's finding is unchanged after ten days. The honest fix is an
eighth carve-out, which is a rule-body edit F4.1 defers; the row declares the
winner without one. Blast radius stays low for the same reason the audit gave
— `telegraph-speak` is dormant by default and workspace-scoped — and low is
not zero, which is why it is recorded rather than dropped.

## 5. What changed in the tree

Eight rows added to `docs/contracts/rule-interactions.yml`, plus six slugs in
its `rules:` list (`communication-through-line`,
`external-reference-deep-dive`, `security-sensitive-stop`,
`source-discovery-gate`, `think-before-action`, `telegraph-speak`). The
register goes from 23 rules / 30 pairs to 29 / 38, and
`lint_rule_interactions` is clean at that shape.

No rule body was edited. That is the step's instruction, and it is also the
right shape: every one of the seven had a resolution derivable from text that
already shipped, so the defect was a missing declaration, never a missing
decision.

## 6. What this pass does NOT claim

The register's own coverage disclaimer still holds and this pass does not
narrow it. Twelve candidates were adjudicated because an audit generated
twelve at a full-recall operating point on five axes; a pair no axis nominated
is as invisible today as it was on 2026-08-06. The detector that would find
those was measured at 67 % false positives on this corpus and rejected, and
nothing here revisits that.
