<!-- evidence-type: analysis -->
# Two ratchets disagree about whether the estate may grow, and one of them makes any new skill unlandable

**Measured 2026-08-27** while attempting `road-to-database-erd-landing`. The
finding is about the **gate configuration**, not about that roadmap: it applies
to every skill addition, and it was discovered by trying one.

## The two gates

**`check_estate_count`** — `skill_count` allowance is 0, and
`src/config/estate-count-budget.json:24` names the escape explicitly:

> "0 — no allowance, deliberately. … An addition takes the
> `estate_growth_exempt` claim path — a recorded reason read from the diff — or
> it fails."

So growth **is** permitted, conditional on a recorded justification.

**`check_preamble_payload_budget`** — `src/config/preamble-payload-budget.json`
→ `ci_delivery.why_a_grace_ceiling`:

> "The grace ceiling is set AT the measurement so growth beyond today reds
> immediately while today's tree passes, and it ratchets DOWN toward the design
> ceiling as reductions land. **It may never move UP.** It expires at the
> milestone-1 date, at which point the design ceiling applies."

`grace_ceiling: 138212`, `grace_measured_at: 2026-08-24`,
`grace_end_date: 2026-11-10`, `design_ceiling: 107646`.

So growth is **not** permitted, and the ceiling has no claim path.

## The measurement

Clean worktrees, `check_preamble_payload_budget` on each:

| Ref | Measured | vs grace ceiling 138,212 |
|---|---|---|
| `origin/main` (460b62007) | **138,195** | −17 |
| + the `schema-erd` skill, full description | **138,248** | **+36** |
| + the same skill, description gutted to 12 tokens | **138,213** | **+1** |

**The third row is the finding.** The description was cut from 198 characters to
`"ERD of a schema, or a diff-ERD of what a change alters."` — 56 characters,
destroying the `'show me the schema'` trigger phrase — and the total is *still*
one token over. The floor is structural: the catalog bucket is
`Σ "- <name>: <description>\n"` per skill (`preamble_byte_census.ts:399`), and
`"- schema-erd: "` alone measures **6 tokens** before a single word of
description. With 17 tokens of headroom, name plus formatting plus any usable
description does not fit.

**So no skill of any description can land while the grace ceiling sits at the
exact measured total.** Not a property of this skill; a property of the ceiling
having zero slack.

## Why the obvious escapes are closed

| Escape | Why it is closed |
|---|---|
| Raise the grace ceiling | The config says "It may never move UP", unconditionally. Its whole purpose is to force convergence toward the design ceiling by 2026-11-10; raising it claim-by-claim is convergence in reverse. |
| Shorten the new skill's description | Measured above: insufficient by construction, and it destroys the trigger the skill's reachability argument rests on. |
| Shorten other skills' descriptions | Lowering a ratchet on a local reading of surfaces the change does not own. Both council seats forbade it explicitly — it funds an addition by shaving unrelated semantics and punishes whoever moves first. |
| Reduce the census's own formatting | The catalog representation is **synthetic** — the census constructs `"- name: description\n"`; the host's real on-wire format is not file-measurable (`:400`). Editing it lowers the number by redefining the metric, which is worse than raising the ceiling because it hides the change. |
| Ship the capability with no skill | Refused 2/2 on reachability: `grep -rlE 'erDiagram' src/skills/*/SKILL.md` returned 0 of 299, and an implementation agents cannot discover does not deliver the capability. |

## Council verdict, 2026-08-27

AI council, 2 seats (anthropic + openai), **convergent on (a)**: keep both gates
independent, the ceiling holds, and a new preloaded skill must satisfy the
payload ceiling on its own — an estate exemption authorises **count** growth
only, never every resource the skill consumes.

Both seats rejected raising the ceiling, and both rejected excluding the catalog
bucket from it (that would stop detecting verbose descriptions and cumulative
growth across individually-approved skills, which `check_estate_count` cannot
see).

One seat disputed the framing: the gates govern **different scarce resources**, so
"a PR satisfying one necessarily fails the other" is overstated — a new skill can
satisfy both *if its payload is offset*. That correction is adopted, and it
sharpens rather than dissolves the finding: the policy demands an offset while
defining **no owned reduction mechanism**, which makes the freeze real in practice
even though it is not a logical contradiction. Its words: *"a budget with no
ownership model or reduction mechanism can become deadlock dressed as process."*

Both seats' fallback, and the disposition taken here: **block the addition until
a separate payload-reduction change creates headroom.**

## The November milestone

Asked directly whether 2026-11-10 is now known-unmeetable. Both seats: **not
known-unmeetable, but known-unplanned and not credible.** The tree is 138,195
against a design ceiling of 107,646 — **30,549 tokens**, 28.4% over — and the
config names no reduction mechanism, no per-bucket targets and no owner. One seat
asked for a go/no-go **decision date well before November** rather than
discovering the miss on expiry.

Recorded here rather than in the config, because changing a registered budget's
milestone is a maintainer decision this analysis does not take.

## What this does NOT establish

- **No reduction is proposed.** Where 30,549 tokens should come from is a
  separate question; 89% of the payload is the `project-scope rules` bucket
  (122,680 tok), and nothing here says that corpus is too large — only that
  nothing currently walks it down.
- **Nothing about whether the grace ceiling was set correctly.** Setting it at the
  measurement was a deliberate, recorded council decision (2026-08-24, 2/2). This
  analysis records a consequence that decision did not anticipate, not an error
  in it.
- **Nothing about other addition classes.** Rules, commands and guidelines were
  not measured against this ceiling; only the skills-catalog bucket was.
