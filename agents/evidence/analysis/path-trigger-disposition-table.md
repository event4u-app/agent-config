<!-- evidence-type: analysis -->

# Path-trigger disposition table

Phase 2 of `agents/roadmaps/road-to-the-delivery-flip-that-tells-the-truth.md` — the
enumeration (2.1), the per-row disposition (2.2), and the path-only check (2.3).

Measured 2026-09-12 at branch `drain/delivery-flip`. Every number below is read from the
tree, not estimated.

## What the flip does to a trigger, stated before the table

`src/config/agent-settings.template.yml` ships `lean_projection.mode: delivery` with
`hosts: [claude-code]`. Under that mode `src/scripts/project_thin_rules.ts` replaces a
non-exempt rule's body with a pointer stub, and `src/scripts/hooks/rule_inject_hook.ts`
delivers the body back when a trigger fires.

The concern is bound on `user_prompt_submit` and `pre_compact`, and **not** on
`pre_tool_use` (`src/scripts/hook_manifest.yaml:1332,1366`, and the comment at `:1333`
recording owner ruling E2). The code path for `pre_tool_use` exists and would populate
`openFiles` from the tool payload (`rule_inject_hook.ts:353-365`), but nothing dispatches
to it. So after the flip:

- a **prompt-shaped** trigger (`keyword`, `phrase`, `command`) still fires and still
  delivers the body;
- a **path-shaped** trigger (`path_prefix`, `file_pattern`) has no carrier at all.

The exemption set in the projector is `kernel || triggerless || path-only`
(`project_thin_rules.ts:352`). A rule carrying **both** kinds is therefore thinned, and
its path half is silently dropped. That class is this table's population.

## Method

Three independent readings, taken separately and then compared:

1. **Source of truth** — `src/rules/*.md` frontmatter parsed directly (120 files).
2. **Router** — `dist/router.json` `tier_1` + `tier_2` (105 entries, 9 kernel), classified
   with the same `PATH_TRIGGER_KINDS` list `src/scripts/_lib/rule_injection.ts:73` uses.
3. **Projector output** — `project_thin_rules.build_thin(undefined, null, …)` invoked at
   full scope, each entry tested with the projector's own `is_thin_entry`.

Readings 1 and 2 produced identical sets: 18 mixed, 3 path-only, 4 trigger-less `auto`.
Reading 3 confirmed what each set actually receives. `src/scripts/check_host_tree_parity`
reports the same population from a fourth angle and agrees on the 3 path-only and the 4
trigger-less; it lists 17 of the 18 mixed rules, because it walks only the two host trees
it scans and `roadmap-progress-sync` is absent from the maintainer-scoped `.claude/rules/`
tree in this repository. The source and router readings carry it, so the population is 18.

Byte figures: `distFullB` is the projected body in `dist/agent-src/rules/`, `thinStubB` is
the stub the projector's own `thin_entry` produces for that rule, and `costB` is the
difference — what choosing `keep full-bodied` adds back to the delivered standing payload
on `claude-code`.

## 2.1 + 2.2 — the mixed-trigger population, 18 rows

| # | Rule | Tier | Path triggers | Prompt triggers | distFullB | thinStubB | costB | Disposition |
|---|---|---|---|---|---|---|---|---|
| 1 | `augment-edit-discipline` | 2a | `path_prefix` x2 | `keyword` x3 | 1285 | 309 | **976** | keep full-bodied |
| 2 | `design-fidelity` | 2a | `file_pattern` x2, `path_prefix` x1 | `keyword` x8, `phrase` x13 | 10956 | 336 | 10620 | rebind — deferred |
| 3 | `doc-screenshot-hygiene` | 2a | `path_prefix` x1 | `keyword` x8, `phrase` x7 | 5051 | 419 | 4632 | prompt side sufficient |
| 4 | `domain-adoption-policy` | 2b | `path_prefix` x1 | `keyword` x3 | 2814 | 305 | 2509 | prompt side sufficient |
| 5 | `framework-neutrality-in-generic-skills` | 2a | `path_prefix` x3 | `keyword` x10, `phrase` x3 | 4263 | 381 | 3882 | prompt side sufficient |
| 6 | `image-likeness-and-rights` | 2a | `path_prefix` x1 | `keyword` x7 | 3039 | 372 | 2667 | prompt side sufficient |
| 7 | `laravel-translations` | 2a | `path_prefix` x1 | `keyword` x3 | 773 | 282 | **491** | keep full-bodied |
| 8 | `lethal-trifecta-guard` | 2a | `path_prefix` x2 | `keyword` x4, `phrase` x2 | 4610 | 389 | **4221** | keep full-bodied |
| 9 | `linked-projects-onboarding-gate` | 2b | `path_prefix` x2 | `keyword` x3 | 1567 | 346 | **1221** | keep full-bodied |
| 10 | `low-impact-corpus-privacy-floor` | 1 | `path_prefix` x2 | `keyword` x3 | 2918 | 348 | 2570 | prompt side sufficient |
| 11 | `markdown-safe-codeblocks` | 2b | `file_pattern` x1 | `keyword` x1 | 1109 | 261 | **848** | keep full-bodied |
| 12 | `onboarding-gate` | 1 | `path_prefix` x1 | `keyword` x1, `phrase` x1 | 1605 | 270 | **1335** | keep full-bodied |
| 13 | `persona-governance` | 2a | `path_prefix` x2 | `keyword` x2, `phrase` x4 | 2438 | 364 | 2074 | prompt side sufficient |
| 14 | `php-coding` | 3 | `file_pattern` x1 | `keyword` x2 | 907 | 248 | **659** | keep full-bodied |
| 15 | `provider-lifecycle-discipline` | 2a | `path_prefix` x4 | `keyword` x8, `phrase` x2 | 3072 | 347 | 2725 | prompt side sufficient |
| 16 | `roadmap-ci-steps-policy` | 2a | `path_prefix` x2 | `keyword` x6, `phrase` x3 | 3502 | 362 | 3140 | prompt side sufficient |
| 17 | `roadmap-progress-sync` | 1 | `path_prefix` x1 | `command` x3 | 10313 | 269 | 10044 | rebind — deferred |
| 18 | `settings-ask-protocol` | 2a | `path_prefix` x1 | `keyword` x6, `phrase` x4 | 9497 | 419 | 9078 | prompt side sufficient |

Every row carries exactly one disposition. None is blank.

### Trigger-kind combinations

| Combination | Count | Rules |
|---|---|---|
| `path_prefix` + `keyword` | 6 | 1, 4, 6, 7, 9, 10 |
| `path_prefix` + `keyword` + `phrase` | 8 | 3, 5, 8, 12, 13, 15, 16, 18 |
| `path_prefix` + `command` | 1 | 17 |
| `file_pattern` + `keyword` | 2 | 11, 14 |
| `file_pattern` + `path_prefix` + `keyword` + `phrase` | 1 | 2 |

Counted by kind rather than by combination: `path_prefix` appears in 16 of the 18 rules and
`file_pattern` in 3 (rows 2, 11, 14), row 2 being the only rule carrying both path kinds.
On the prompt side, `keyword` appears in 17 rules, `phrase` in 9, and `command` in 1.

### Disposition tally

| Disposition | Rows | Aggregate costB |
|---|---|---|
| keep full-bodied | 7 | **9,751 B** |
| prompt side sufficient | 9 | 31,277 B not spent |
| rebind — deferred | 2 | 20,664 B not spent |

The 18 rows together are 63,692 B of restorable body. Choosing `keep full-bodied` across
all of them is the move `project_thin_rules.ts:128-134` measures at +16,329 GPT tokens
(+69 % on the thin rule layer) and names as owner-reserved. This table takes 9,751 B of
that 63,692 B — 15.3 % by bytes. The token equivalent is **not** computed here: a byte
share is not a token share, and asserting one from the other would be the kind of derived
figure the roadmap's Phase 3 exists to stop.

Risk 1 of this roadmap's register is "Phase 2 quietly undoes the flip". The aggregate row
above is the mitigation it names — the cost of the full-bodied choice is visible in the
table itself, and it is a seventh of the available restoration rather than all of it.

## The `prompt side sufficient` rows, one reason each

The claim in each line is specific to that rule: the prompt triggers that survive cover
the work the dropped path trigger covered. Where a residual remains it is named rather
than absorbed.

3. **`doc-screenshot-hygiene`** — the dropped prefix is `docs/media/`, and the Iron Law is
   scoped to a screenshot shipping into documentation; the act of making or embedding one
   is named by fifteen prompt triggers including three verb phrases ("add a screenshot",
   "put a screenshot", "embed an image in the docs"), so a file reaching that directory
   without any of them is the illustrative tier the rule itself waves through on a
   one-line justification.

4. **`domain-adoption-policy`** — the dropped `src/skills/` prefix fired on every skill
   edit in the tree while the obligation is the adoption of a new *domain track*, which
   the three surviving triggers name directly; residual, named rather than absorbed: a
   fourth track (the rule's own description says "IoT") has no keyword and would match
   neither side.

5. **`framework-neutrality-in-generic-skills`** — the ten framework tokens plus "generic
   skill" *are* the leakage vocabulary this rule polices, so a turn proposing the banned
   single-stack mandate matches by construction, and `src/scripts/lint_framework_leakage.ts`
   (declared in the rule's own `enforced_by` and run by `.github/workflows/rule-backstops.yml`)
   fails the build on the authored text whether or not the rule loaded.

6. **`image-likeness-and-rights`** — the Iron Law gates the act of *generating* an image
   and every route to that act utters `/image:`, "generate an image" or "image generation";
   the dropped `scripts/ai-image/adapters/` prefix covered editing the provider code, <!-- ref-ignore -->
   which is `provider-lifecycle-discipline`'s subject and not this rule's rights gate.

10. **`low-impact-corpus-privacy-floor`** — both dropped prefixes are the corpus's own
    storage paths and all three surviving triggers are that same corpus's name, so a turn
    that writes an entry cannot avoid naming the artefact it is writing to.

13. **`persona-governance`** — both dropped prefixes are the personas directories, and
    "persona" and "personas" are bare single-word keywords, so any turn that creates,
    edits or proposes a persona names it in the prompt that asks for it.

15. **`provider-lifecycle-discipline`** — the four dropped prefixes are the adapter and
    media-library directories, and the bare keywords "adapter", "provider" and "lifecycle"
    cover editing them while `/video:`, `/image:` and `/audio:` cover invoking them, so
    both halves of the rule's surface keep a route.

16. **`roadmap-ci-steps-policy`** — the execution half is named by nine literal pipeline
    commands a turn must utter in order to run one, and the authoring half has a
    deterministic backstop in `src/scripts/lint_roadmap_ci_steps.ts` (wired at
    `Taskfile.yml:178` and `.github/workflows/rule-backstops.yml:610`) that fails the build
    on a CI-shaped roadmap step regardless of whether the rule reached the model.

18. **`settings-ask-protocol`** — the single dropped prefix is one contract document, while
    the obligation fires when a settings question is about to be asked, and all six
    Class-B/C key names plus `settings:set` and "settings question" are prompt triggers, so
    the moment the protocol governs is prompt-reachable by name.

Council condition 5 forbids prompt-conversion as a general substitute. Nothing here
converts a trigger: no rule gains a keyword, and each line above is a claim about the
triggers the author already wrote. Nine of eighteen is not a blanket, and the seven
`keep full-bodied` rows are precisely the cases where the same test failed.

## The `keep full-bodied` rows, one reason each

1. **`augment-edit-discipline`** (976 B) — the rule's own obligation is "sync counts and
   cross-refs on **add**/rename/delete", and only rename and delete are keywords; a turn
   that adds a file under `src/` has no matching trigger on either side.

7. **`laravel-translations`** (491 B) — the `lang/` prefix fires exactly when translation <!-- ref-ignore -->
   files are being edited, and a turn that says "add the German strings" matches neither
   "translation" nor the two function-name keywords.

8. **`lethal-trifecta-guard`** (4221 B) — the keywords name the *concept* while the rule
   fires on the *act* of authoring a skill or command that combines the three legs, and an
   author describing the legs ("fetch the page, then post the summary") matches none of
   them; the dropped `src/skills/` and `src/agent-src/commands/` prefixes were the only
   authoring-time route.

9. **`linked-projects-onboarding-gate`** (1221 B) — the gate is proactive by construction:
   it fires when the IDE has attached a sibling repository the developer has not mentioned,
   which is the one case where no prompt trigger can fire by definition.

11. **`markdown-safe-codeblocks`** (848 B) — the sole prompt trigger is "triple backticks",
    a phrase nobody types, against a `*.md` pattern that covered every markdown edit; this
    is the widest gap in the table relative to its cost.

12. **`onboarding-gate`** (1335 B) — the obligation is first-turn detection, and a developer
    who has not been onboarded has no reason to say "onboarding" or "first turn"; an
    unprompted gate needs unconditional presence.

14. **`php-coding`** (659 B) — the two keywords name tools, not the activity, so ordinary
    PHP editing matches nothing; the `*.php` pattern was the carrier for a per-file coding
    standard.

Note on who pays: rows 7, 8 and 14 are `workspaces: [engineering]`, row 1 is
`agent-config-maintainer` only, and row 9 is both. Rows 11 and 12 project to all ten
workspaces. The 9,751 B aggregate is therefore an upper bound that no single install pays
in full.

## The `rebind — deferred` rows, and their revisit conditions

Neither row is marked `rebind` on the strength of `agent-config hooks:status`. Council
condition 1 rules that insufficient, and no host-carriage probe was run here, so the tuple
of `host x tier/version x install mode x target slot x required semantics` is **not**
verified for either. Both rows are deferred with a falsifiable condition rather than a
roadmap pointer (condition 4).

### Shared carriage prerequisite — checkable today, and false today

Both rows target the same slot, so the prerequisite is stated once rather than duplicated
into boilerplate. It has two conjuncts, each of which someone can check and find true or
false:

- **P1** — `src/scripts/hook_manifest.yaml`'s `pre_tool_use` list contains `rule-inject`.
  **False on 2026-09-12**: the file carries three per-host `pre_tool_use` lists, at `:1325`,
  `:1356` and `:1402`, and none of them names `rule-inject`; the comment at `:1333` records
  its removal under owner ruling E2.
- **P2** — the delivery concern's gate-open fire size restricted to path-trigger matches,
  measured over `tests/eval/routing-matrix` by `src/scripts/bench_hook_injection`, is at or
  below the `pre_tool_use` cap in `src/config/hook-token-budget.json`, **or** that cap has
  been raised by the owner to cover the measured value. **False on 2026-09-12**: the cap is
  2,048 B (`hook-token-budget.json:41`) and the concern's whole-corpus p90 gate-open fire
  is 16,188 B (`:40`), 7.9x the cap — and `pre_tool_use` fires once per tool call, so the
  per-turn multiple is ten by that file's own `tool_calls` definition.

P2 is the substantive one. P1 without P2 would bind a concern that the dispatcher's
`src/scripts/hooks/injection_budget.ts` drops first, being `severity: advisory` — which is
the failure council condition 1 names: a slot that is bound and a verdict that is discarded.

### Row 2 — `design-fidelity` (alternative cost 10,620 B)

**Why rebind and not one of the other two.** The rule's own routing section states that
`*design.html` and `*.dc.html` exist for the handover class whose prompt "carries **no**
keyword at all because the artifact is simply attached". The prompt side is therefore
documented-insufficient by the rule's own text, which rules out `prompt side sufficient`;
and at 10,620 B it is the second-largest body in the table, which makes `keep full-bodied`
the expensive answer to a gap a working carrier would close for ~336 B.

**Revisit condition.** P1 and P2 above, **and** a two-arm sentinel recorded under
`agents/evidence/investigations/`: on a real `claude-code` invocation whose tool payload
names a `.dc.html` path and whose prompt matches none of this rule's 21 prompt triggers,
the rule's body is present in the delivered context; and on the same input with
`lean_projection.mode: eager-all` the delivery-injected body is absent. Falsifiable in
both directions — the row reverts to `keep full-bodied` at 10,620 B if the positive arm
shows no body, and the binding is refused if the negative arm shows one anyway.

**Interim exposure, stated rather than left implied.** Until the condition is met this rule
stays thinned and the attached-artifact class reaches the model through no trigger. The
21 prompt triggers still cover every handover that says "prototype", "mockup", "Figma",
"handoff" or "design system" — which is most of them, and not the silent one.

### Row 17 — `roadmap-progress-sync` (alternative cost 10,044 B)

**Why rebind and not one of the other two.** Its three prompt triggers are the three
`/roadmap:process-*` commands, so a roadmap edit made any other way — a hand-edit, an
archival move, a newly authored file — matches nothing. The obligation is literally "sync
on roadmap touch": it is path-shaped in its definition, and no word stands in for file
contact. At 10,044 B it is the third-largest body here.

**Revisit condition.** P1 and P2 above, **and** a two-arm sentinel recorded under
`agents/evidence/investigations/`: on a real `claude-code` invocation whose only signal is
an edit tool call against a file under `agents/roadmaps/` and whose prompt contains none of
the three command triggers, the rule's body is present in the delivered context; and absent
on the same input under `lean_projection.mode: eager-all`. This rule is `tier: 1` and
`obligation_frequency: per-edit`, so the sentinel must also show the body delivered on the
**first** such tool call of a session rather than only after a prompt-slot fire.

## 2.3 — the path-only population, and an independent check of "kept full-bodied"

Three rules declare path-shaped triggers and nothing else. `check_host_tree_parity` prints
an `E2:` line for each saying they are kept full-bodied. That message was not trusted; both
properties were checked separately.

| Rule | Tier | Triggers | Thinned? | Delivered bytes | Full? |
|---|---|---|---|---|---|
| `design-review-after-ui-write` | 2b | `path_prefix` x5, `file_pattern` x5 | no | 10689 | yes |
| `source-of-truth` | 1 | `path_prefix` x4 | no | 3752 | yes |
| `ui-audit-gate` | 2b | `path_prefix` x5, `file_pattern` x5 | no | 9075 | yes |

**How each property was checked, separately.**

- *Path-only* was established twice from inputs the projector does not share: the
  frontmatter in `src/rules/`, and the trigger lists in `dist/router.json`. Both give the
  same three ids and no fourth. This matters because the exemption is computed from the
  router, so a rule that is path-only in source but carries a stray prompt trigger in a
  stale router would be thinned while looking exempt. The two readings agree at this HEAD,
  so no such drift exists.
- *Not thinned* was established by invoking `build_thin` at full scope and testing each
  entry with the projector's own `is_thin_entry`, rather than by reading the announcement.
  All three come back full-bodied. The mechanism is visible in the code as well:
  `project_thin_rules.ts:352` computes `full = kernel || noTrigger || pathOnly`, so the
  exemption is structural and not a side effect of the diagnostic.
- The same run classified all 119 projected entries: 103 thinned, 16 full. The 16 are
  9 kernel, 4 trigger-less `auto` (`no-roadmap-references`, `rule-type-governance`,
  `skill-quality`, `source-confidentiality`) and these 3 path-only.

**Result: zero rows are both path-only and thinned.** Step 2.3's criterion is met with no
remediation owed.

**One honest limit on that answer.** It holds for the projector as configured at this HEAD.
It is a property of the exemption set, not a guarantee about the future: an author who adds
a single keyword to `ui-audit-gate` moves it into the mixed class and it is thinned on the
next projection with no error — which is exactly what the comment already in that rule's
frontmatter describes from the other direction, where two keywords were *removed* to push
it back into the path-only class on purpose. The criterion is checkable against the live
rule set, which is what this roadmap's Risk 4 asks for, and re-running the three readings
above is how to check it.

## What this table does not establish

- **No carriage evidence was produced.** No host was probed, no sentinel was injected, no
  negative control was run. Both `rebind` rows are deferred for exactly that reason, and
  the conditions above name what would settle them.
- **The token cost of the seven `keep full-bodied` rows is not measured**, only their byte
  cost. The +16,329 GPT-token figure for exempting all eighteen is quoted from
  `project_thin_rules.ts`, not re-derived here.
- **No disposition was implemented.** This is the table Phase 2.2 asks for; changing the
  projector's exemption set is a separate act, and for the seven full-bodied rows it is a
  standing-payload move whose Phase 3 accounting does not exist yet.
- **The `prompt side sufficient` reasons are judgements about coverage, not measurements
  of it.** Each names the specific triggers it relies on so a reader can disagree with a
  row without re-deriving the table; row 4 carries a named residual for the same reason.
