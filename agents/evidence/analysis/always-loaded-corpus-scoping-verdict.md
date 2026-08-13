# Can a declared scope reduce the always-loaded rule corpus? — verdict + inventory

> **Produced by:** Phases 1 and 2 of `road-to-always-loaded-corpus-scoping`.
> **Measured:** 2026-08-13 · **Tokenizer:** exact BPE (`cl100k_base`) via
> `src/scripts/_lib/token_count.ts` · **Machine:** maintainer checkout, worktree
> off `origin/main`.
> **Verdict: YES — and the mechanism is already live and already saturated.**

## Phase 1 — the verdict, with the mechanism named

**Can a declared scope reduce what a session receives? YES.** Both halves are
citable rather than inferred, which is what the step required.

**The host reads `paths:`.** `agents/evidence/analysis/claude-code-rules-dir-contract.md`
records it as a probed fixture — host `2.1.226`, probed 2026-08-08, against the
host's own documentation, gate outcome **A (a scoping key exists)**. Verbatim from
that fixture: *"Rules without a `paths` field are loaded unconditionally and
apply to all files"*, and *"Path-scoped rules trigger when Claude reads files
matching the pattern, not on every tool use."*

**And this package already emits it.** `condense.ts:1508` `_emit_claude_rule`
writes the host's own `paths:` key into every `.claude/rules/*.md`, derived from
the source rule's `triggers:` by `derive_trigger_globs` (`condense.ts:1332`),
under the host's documented 1,000-expanded-pattern budget
(`CLAUDE_PATHS_PATTERN_BUDGET`). The projection is a copy-plus-host-frontmatter
emit, not the old symlink.

**So the roadmap's Risk 1 is false.** It pre-registered *"`paths:` is
projection-inert on the hosts that matter"* as the most likely outcome, by
analogy to `triggers:` having no runtime consumer. The analogy does not hold:
`triggers:` is agent-config's own vocabulary and is indeed unread, but the
emitter **translates** it into the one key the host does read. Phase 1 therefore
does **not** stop the roadmap, and Phase 2 runs.

**One constraint the fixture attaches, and it is load-bearing below:**
path-scoped rules are *"not re-injected after `/compact` — they reload the next
time a matching file is read. An obligation that must survive compaction cannot
be path-scoped."*

## Phase 2 — inventory of the projected corpus

Confirmed against the two gates first, rather than trusting the roadmap's
figures: `eager_rule_load` **108,742** tok against baseline 106,704 (+1.9 %, so
3.1 % of the 5 % allowance left), and `check_standing_rule_delivery`
**196,959 / 110,000 (179.1 %) — red**, split global 110,468 / project 86,491
over 109 divergent overlapping rules.

`.claude/rules/` holds **110** emitted rules totalling **86,491** tok — the same
figure the delivery gate reports for the project layer, so the two measurements
agree.

### The `paths:` axis is saturated

| Set | Rules | Tokens | Share |
|---|---:|---:|---:|
| Projected total | 110 | 86,491 | 100 % |
| Carries `paths:` | 25 | 17,628 | 20.4 % |
| Loads unconditionally | 85 | 68,863 | 79.6 % |
| — of which kernel / `alwaysApply` | 9 | 6,352 | 7.3 % |
| — **addressable** (non-kernel, unscoped) | **76** | **62,511** | **72.3 %** |

The addressable set looks like the target. It is not, and this is the finding:

- **All 76 declare a `triggers:` block, and none of them declares a path-shaped
  trigger.** Kind census over the 76: `keyword` 73, `phrase` 51,
  `file_pattern` **0**, `path_prefix` **0**. By combination: 48 rules /
  40,099 tok carry `keyword+phrase`, 25 / 20,989 `keyword` only, 3 / 1,423
  `phrase` only.
- **Source-side cross-check:** exactly **25 of 116** rules under `src/rules/`
  declare `file_pattern` or `path_prefix`, and they are precisely the 25 that
  carry `paths:` in the projection. The emitter converts **25 of 25 — 100 %**.

So there is no unconverted path-shaped rule anywhere in the tree. The `paths:`
axis is not unexploited; it is **fully exploited**.

### Classification — universal vs surface-scoped vs pack-scoped

The step asks for the classification of every rule above the median, and for the
honest count of the universal set. Reading the 15 highest-cost addressable rules
for a *nameable file class* rather than deferring to their frontmatter:

- **Universal, cannot be path-scoped at all** — the obligation fires on the
  turn, not on a file read: `context-hygiene` (2,446), `session-canary` (2,049),
  `delegation-policy` (1,616), `downstream-changes` (1,615),
  `active-remediation` (1,600), `autonomous-execution` (1,474),
  `evaluator-independence` (1,185), `think-before-action` (1,110),
  `user-interaction` (1,023). Every one of these must also survive `/compact`,
  which the fixture says a path-scoped rule does not.
- **Partially surface-shaped but not cleanly** — `code-provenance` (2,049) fires
  on any borrowed code plus a prose knowledge layer; `domain-safety-pii` (1,788)
  spans drafts, logs and exports, which is not a file class;
  `brand-source-of-truth` (1,437) spans brand decisions *and* emitted UI.
- **The single genuine candidate, named so nobody re-derives it:**
  `preservation-guard` (1,182 tok) governs transformations of skills, rules,
  commands and guidelines, so `src/skills/**`, `src/rules/**` and
  `docs/guidelines/**` would be a truthful `file_pattern`. At **1.4 %** of the
  corpus on its own it fails Phase 3's "measurable share" bar, and its
  obligation is exactly the kind that must survive compaction.

**Honest count of the universal set:** of 62,511 addressable tokens, the
inspected universal subset alone accounts for ~13,100 tok, and no inspected rule
outside `preservation-guard` yielded a truthful path glob. The universal set does
not merely exceed a useful ceiling — on this axis it *is* the remainder.

### Two further scoping axes exist, are already built, and ship inactive

Not part of the roadmap's hypothesis, found while classifying, and measured with
the shipped predicate (`rule_in_scope`, `src/install/ruleInScope.ts:107`) rather
than a re-implementation. Both are read from `projection.*` in
`.agent-settings.yml`; absent resolves to `null`, i.e. **no filtering**, which is
why the full corpus projects today.

| Configuration | Rules kept | Tokens kept | Pruned | Share |
|---|---:|---:|---:|---:|
| today — both axes absent | 110 | 86,491 | 0 | 0 % |
| `projection.rule_packs: auto` | 102 | 80,033 | 6,458 | 7.5 % |
| `projection.rule_workspaces: [agent-config-maintainer]` | 72 | 52,118 | 34,373 | **39.7 %** |
| both together | 68 | 49,424 | 37,067 | **42.9 %** |

The pack axis prunes 8 rules, all domain floors for packs this repository does
not activate (`legal-safety-floor`, `media-governance-routing`,
`strategy-safety-floor`, `finance-safety-floor`, `media-sync-ground-truth`,
`provider-lifecycle-discipline`, `image-likeness-and-rights`,
`spreadsheet-source-quality`). The workspace axis prunes 38 rules tagged for
workspaces this checkout is not — which is the larger lever by a factor of five,
and it needs no rule edit, only a setting.

For completeness, the same predicate on a consumer workspace:
`[engineering]` prunes 17 rules / 12,201 tok (14.1 %);
`[engineering, agent-config-maintainer]` prunes 4 / 3,764 (4.4 %).

## What this means for Phase 3

Phase 3 requires declaring, **before editing anything**, "the smallest set of
clearly surface-scoped rules that together carry a measurable share of the
corpus". That set is empty: every surface-scoped rule in the tree is already
scoped, and the one remaining candidate carries 1.4 %.

The available alternative would be to *author* `file_pattern` triggers for
keyword-triggered rules. That is rejected on two grounds, not on effort:

1. **It changes what the trigger means.** A `keyword` trigger fires on intent
   anywhere in a turn; a `paths:` glob fires when the host reads a matching file.
   Converting one to the other does not narrow a rule's delivery, it *relocates*
   it — and for an obligation with no file surface there is nothing truthful to
   point at.
2. **It loses `/compact` survival**, per the fixture. `_emit_claude_rule`'s own
   docstring already refuses this for kernel rules — *"scoping one would be a
   correctness regression dressed as a byte saving"* — and the argument does not
   stop at the kernel boundary; it stops wherever the obligation must survive
   compaction, which is most of the addressable set.

Phase 3 is therefore recorded as **not runnable on its own terms**, not deferred.
Phase 4 decides against the Phase 3 declaration, which is what the
pre-registration requires.

## Reproducing these numbers

The three probes were scratchpad-only and are not committed — they compose
shipped functions and each is a handful of lines over `.claude/rules/`:

- `paths:` split — count files under `.claude/rules/` matching `^paths:`, and
  cross-check `grep -lE '^\s*-?\s*(file_pattern|path_prefix):' src/rules/*.md`.
- trigger-kind census — parse each source rule's frontmatter for the five trigger
  keys.
- axis deltas — `rule_in_scope(src, ws, packs)` per projected rule, summing
  `gpt_tokens()` of the emitted file; pack ids from
  `compute_active_pack_ids(load_packs_registry(root), [])`.

Every token figure is exact BPE on the same machine in the same run, before and
after, as the acceptance criteria require.
