# Rule `paths:` coverage census — where the standing payload actually sits

> `road-to-inbox-harvest-2026-08-d-context-ledger` Step 5.1. Measured
> 2026-08-15 against the tree at `e3bd96158`, over `dist/agent-src/rules/` —
> the projected set, i.e. what a consumer actually receives. Every figure below
> was produced by a command run for this page and cross-checked against the
> repository's own census script.

## Headline

| Measure | Value |
|---|---:|
| Projected rule files (`dist/agent-src/rules/`) | **115** |
| …declaring `paths:` | **0** |
| Rule files in the Claude host projection (`.claude/rules/`) | **110** |
| …declaring `paths:` | **25** |
| Total bytes (neutral projection) | **441,965** |
| Estimated tokens (bytes ÷ 4) | **110,491** |

> **Correction, 2026-08-15 — the "zero" is true of one projection only, and the
> first version of this page did not say so.** `dist/agent-src/rules/` is
> host-neutral and carries no `paths:` by construction. The *host* projection
> does: `.claude/rules/` has **25 of 110** scoped today, emitted by
> `condense.ts::derive_trigger_globs` (`:1332`) from each rule's existing
> path-shaped `triggers:` entries, with Cursor `globs:` and Windsurf
> `trigger: glob` equivalents. Read alone, the original headline invited the
> conclusion that scoping does not happen. **It does, on three hosts, in
> production.** The question is therefore not "may we start scoping" but
> "is what is already scoped correct" — see the finding below.

The zero was checked two ways — a per-file extraction of the region between the
first two `---` fences, and a concatenated-frontmatter sweep. Both return zero.
The related keys `file_pattern:` and `path_prefix:`, which appear in some rule
*bodies* as prose about routing, also have zero frontmatter occurrences.

## Weight by rule type

| `type:` | Files | Bytes | Est. tokens | Share of weight |
|---|---:|---:|---:|---:|
| `always` | 9 | 29,466 | 7,366 | 6.7 % |
| `auto` | 101 | 407,042 | 101,760 | 92.1 % |
| `manual` | 5 | 5,457 | 1,364 | 1.2 % |
| **total** | **115** | **441,965** | **110,491** | 100 % |

The split is the actionable part. The `always` set is exactly the nine kernel
rules — `agent-authority`, `ask-when-uncertain`, `commit-policy`,
`direct-answers`, `language-and-tone`, `no-cheap-questions`,
`non-destructive-by-default`, `scope-control`, `verify-before-complete` — and
they carry **6.7 %** of the weight. They are also the rules an agent may not
write to, and the ones a scoping change would need its own process for. **The
92 % is in the `auto` tier**, which is where scoping is both permitted and
worth doing.

## Top 20 by delivered weight

Not one of them is a kernel rule; every one is `auto`.

| # | Rule | Bytes | Est. tokens | `type:` |
|---|---|---:|---:|---|
| 1 | `context-hygiene` | 10,988 | 2,747 | auto |
| 2 | `design-fidelity` | 10,400 | 2,600 | auto |
| 3 | `session-canary` | 9,458 | 2,364 | auto |
| 4 | `settings-ask-protocol` | 9,374 | 2,343 | auto |
| 5 | `code-provenance` | 9,089 | 2,272 | auto |
| 6 | `design-review-after-ui-write` | 8,906 | 2,226 | auto |
| 7 | `domain-safety-pii` | 8,511 | 2,127 | auto |
| 8 | `token-budget-discipline` | 8,380 | 2,095 | auto |
| 9 | `domain-safety-disclaimer` | 7,821 | 1,955 | auto |
| 10 | `active-remediation` | 7,464 | 1,866 | auto |
| 11 | `downstream-changes` | 7,394 | 1,848 | auto |
| 12 | `delegation-policy` | 7,393 | 1,848 | auto |
| 13 | `senior-engineering-discipline` | 7,031 | 1,757 | auto |
| 14 | `legal-safety-floor` | 6,814 | 1,703 | auto |
| 15 | `autonomous-execution` | 6,787 | 1,696 | auto |
| 16 | `brand-source-of-truth` | 6,674 | 1,668 | auto |
| 17 | `ui-audit-gate` | 6,513 | 1,628 | auto |
| 18 | `roadmap-progress-sync` | 6,069 | 1,517 | auto |
| 19 | `evaluator-independence` | 6,064 | 1,516 | auto |
| 20 | `media-governance-routing` | 6,009 | 1,502 | auto |

These twenty sum to **39,278 estimated tokens — 35.5 % of the whole rule
payload in 17 % of the files.** Several are visibly domain-scoped by subject
(`design-fidelity`, `design-review-after-ui-write`, `legal-safety-floor`,
`media-governance-routing`, `brand-source-of-truth`, `ui-audit-gate`), which is
what makes them the natural first tranche: a rule about UI fidelity delivered
into a session that touches no UI is the case `paths:` exists for.

**That observation is not a recommendation to scope them.** Scoping narrows what
an existing install receives, which is a consumer-visible change and the reason
Step 5.2 is blocked on an explicit decision. This page ranks; it does not
choose.

## The finding this census did not set out to make

Scoping a rule on Claude Code, Cursor and Windsurf **replaces** its activation
surface rather than adding to it. `derive_trigger_globs` (`condense.ts:1332`)
walks a rule's `triggers:` list and keeps **only** `file_pattern` and
`path_prefix` entries; `keyword:` and `phrase:` entries are skipped. The emitted
`paths:` block then becomes the whole gate, because a rule *with* `paths:` loads
on a path match and a rule *without* it loads unconditionally
(`docs/contracts/rule-router.md`).

So a rule carrying both kinds of trigger loses its conversational reach on those
three hosts. Measured over the live host projection:

| | Count |
|---|---:|
| Rules scoped in `.claude/rules/` | 25 |
| …of those, also carrying `keyword:`/`phrase:` triggers in `src/rules/` | **19** |

Two worked cases, both live on this machine right now:

- **`design-fidelity`** — 21 keyword/phrase triggers, 2 path globs
  (`*design.html`, `.claude/design-system/**`). Its own routing section names a
  pasted screenshot and a capability URL as handover classes it must catch,
  explicitly *because* they arrive with no matching file. Under path-only
  gating those classes do not fire at all — the rule is silent in precisely the
  case it documents as its reason for existing.
- **`settings-ask-protocol`** — 10 keyword/phrase triggers, 1 path prefix
  pointing at a contract document. A settings question arising mid-session
  nowhere near that document gets none of the four-slot shape or the
  one-question budget.

**This read as an unreviewed side effect rather than a decision.** Nothing in
the tree recorded a choice to trade keyword reach for path precision, and the
rules most affected were the ones whose own bodies argue hardest for the reach.

## Repaired 2026-08-15 — and what it cost

The maintainer took it as a defect. `_claude_paths_plan` now emits **no**
`paths:` for a rule that also declares keyword or phrase triggers, so such a
rule keeps loading unconditionally on Claude Code. Each suppressed pattern is
**reported**, not dropped silently, so a rule whose obligation genuinely is
path-bound stays visible as a candidate for removing its keyword triggers — an
authoring decision rather than an emitter side effect.

The repair is Claude-only by construction, and that asymmetry is the reason it
is correct: Cursor and Windsurf treat globs as **additive** (an empty glob list
still leaves the rule reachable through its description), while Claude Code
treats `paths:` as **exclusive**. One emitter had been feeding both semantics
from one list.

Effect, measured:

| | Before | After |
|---|---:|---:|
| Rules scoped in `.claude/rules/` | 25 | **6** |
| …of those, mixed-trigger | 19 | **0** |

The six that remain declare path-shaped triggers and nothing else —
`no-roadmap-references`, `roadmap-progress-sync`, `rule-type-governance`,
`skill-quality`, `source-confidentiality`, `source-of-truth`. Verified: none of
them carries a keyword trigger.

**The cost, stated plainly because it cuts against this roadmap's other half:**
the 19 restored rules total **54,521 bytes ≈ 13,630 estimated tokens**, so
Claude Code sessions now carry about **12 % more rule payload** than they did
while the rules were silently narrowed.

## The follow-up pass — how much of that was actually recoverable

The obvious next move was to give those 19 genuine `paths:` coverage, so the
repair and the payload schedule would pull the same way. Each was read in full
against its own "When it fires" section, asking one question: *could this rule
drop its keyword triggers entirely and live on paths alone, without losing a
case it exists to catch?*

| Verdict | Rules | Bytes | ≈ Tokens |
|---|---:|---:|---:|
| Scoped in this pass | **0** | 0 | **0** |
| Must stay unconditional | **19** | 54,521 | **13,630** |

**The recovery is zero. The entire 12 % is the honest price** — not slack that
better globs would remove.

### The first answer was "four of nineteen", and CI refuted it

That reading came from each rule's own body — its "When it fires" section, its
scope statement — and it was defensible from the body alone and still false,
because **the body is not the only authority on what a rule must catch.**

`tests/eval/routing-matrix/<rule>.yaml` pins the prompts each rule must route
on, and a fixture carrying **no `open_files`** is by construction a case that
arrives with no matching file. All four candidates have one:

| Rule | File-less positive that stopped routing |
|---|---|
| `framework-neutrality-in-generic-skills` | *"This generic skill mandates php artisan directly - neutralize it."* |
| `augment-edit-discipline` | *"Rename this skill and update every cross-reference."* |
| `php-coding` | *"Run phpstan on the changed files and fix the level 8 errors."* + 2 more |
| `low-impact-corpus-privacy-floor` | *"Append this naming verdict to the low-impact corpus, please."* + 2 more |

Dropping the keywords made every one of those prompts stop routing, and
`routing_matrix.test.ts` failed on precisely that. The lesson is procedural and
worth more than the pass was: **a rule's scopeability cannot be judged from its
prose alone — the routing matrix is a second authority, and unlike the prose it
is machine-checked.** Any future attempt reads the matrix first.

The finding is therefore stronger than the original framing rather than weaker:
nineteen for nineteen, the keyword reach is load-bearing, and it is *tested* to
be so.

Six recurring shapes, which is the reusable part of this finding:

1. **Proposal-stage gates.** `domain-adoption-policy` fires on *opening* a
   domain, `persona-governance` on *proposing* a persona — both before any file
   exists. Scoping them to the file means the gate arrives after the decision.
2. **Circular gates.** `provider-lifecycle-discipline` and `onboarding-gate`
   exist to make the agent *go read* a file; scoping them to that same file
   means they load only once the compliant behaviour already happened.
3. **Session-state gates.** `settings-ask-protocol`'s worked example is a
   first-turn question on a bare session with nothing open.
4. **Reply-generation gates.** `markdown-safe-codeblocks` governs markdown the
   agent writes *into the chat*, which touches no file at all.
5. **Prompt-triggered gates.** `image-likeness-and-rights` and
   `lethal-trifecta-guard` fire on what is *asked for* — "generate an image of
   X", "fetch this and post it to that webhook" — not on an edit.
6. **Unboundable surfaces.** `laravel-translations` targets every user-visible
   string, authored anywhere in a Laravel app; `doc-screenshot-hygiene` names
   README and "feature docs" as firing surfaces distinct from its one
   `docs/media/` prefix. No finite glob narrows either.

Two rules carry the sharpest self-evidence. `design-fidelity`'s own routing
section is an extended argument *for* keeping its keywords, including a
withdrawn attempt at a third trigger class that was unfixably over-broad. And
`ui-audit-gate` states outright that the ground-truth UI-surface predicate is
**wider than its own authored glob list** — "a measurement denominator and a
routing trigger are not the same population".

**One real fix survives the reverted pass**, and it is a correctness bug rather
than a payload win:
`low-impact-corpus-privacy-floor` names *two* locked target files in its body
and its trigger reached only one, so a write to
`data/low-impact-decisions-seed.md` never loaded the rule that governs it. The
missing prefix is now declared — a correctness fix that happens to also make
the rule scopable.

The repair did not create this work. It made the cost visible instead of paying
for it with capability nobody chose to give up, and this pass establishes that
the remaining cost is structural rather than sloppy.

## Method note

Token figures use **bytes ÷ 4**, the same proxy `preamble_byte_census.ts` uses
and states. Running that script independently returns `files=115,
chars=441,965, tokens_estimate=110,491` — an exact match to the manual
computation above, which is a consistency check rather than a proof of
tokenizer exactness for any single rule.

## Reconciliation — and a live finding

The recorded budget figures do **not** reconcile with what the tree measures
today, and both of the repository's own gates say so directly:

- `check_preamble_payload_budget.ts` measures **125,593 tokens** against a
  registered baseline of 102,520 and a ceiling of 107,646 — **exit 1, roughly
  23,000 tokens over.**
- `check_standing_rule_delivery.ts` measures **110,529 tokens** against the
  110,000 cap in `budgets.yml` — **exit 1, 100.5 % of cap.**

Both are **pre-existing** and **local-only**: neither script is referenced by
any file under `.github/workflows/` or by `Taskfile.yml`, so nothing in CI is
red because of them, and nothing in this roadmap's change set caused them (it
adds no rule and edits no rule body).

The cause is knowable rather than mysterious. `preamble-payload-budget.json`'s
`baseline_tokens: 102520` is a ratchet baseline recorded 2026-07-31, and the
narrative figures in `budgets.yml` are a snapshot from 2026-08-08. The rule set
has grown since. The ratchet is written to fail on **growth** and has no
downward schedule, so the corpus drifted past its own checkpoint without
anything obliging a correction — which is precisely the gap Step 5.3 addresses,
now with a number attached: the distance from measured to target is not the
102,520 → 40,000 the file implies, it is **125,593 → 40,000**.
