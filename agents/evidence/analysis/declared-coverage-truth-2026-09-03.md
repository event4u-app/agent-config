<!-- evidence-type: analysis -->
# Declared coverage truth — census and execution evidence

<!-- generated-by: hand, road-to-declared-coverage-truth · verified against 7211a4274 -->

Evidence note for `road-to-declared-coverage-truth`. Three artefacts claimed a
coverage they did not have. This records what was measured, what changed, and
the two places the roadmap's declared verify could not be run as written.

## Phase 1 — `security-sensitive-stop` trigger reach

### Before

`src/rules/security-sensitive-stop.md` is `type: auto`, so it loads on its
`triggers:` block alone. That block carried six keywords — `auth`, `billing`,
`tenant`, `webhook`, `oauth`, `signing key` — while the rule's own
§ What counts as security-sensitive additionally names **file uploads**,
**external integrations**, **public endpoints** and **data exposure**, and its
`description:` advertises uploads to every catalogue that renders it.

### After

Five keywords added: `file upload`, `ssrf`, `api resource`, `public endpoint`,
`status endpoint`. No `collision_ok` disposition was needed — collision is per
trigger **value**, and none of the five is shared by another routed rule
(`lint_trigger_collisions`, 120 rules scanned).

Two keywords were deliberately **narrowed from the obvious single word**.
Trigger `keyword` matching is word-boundary-anchored with an optional plural `s`
(`src/scripts/_lib/router_match.ts:153-176`), so a single word claims every
prose use of it.

| Rejected | Shipped | Because |
|---|---|---|
| `upload` | `file upload` | a bare `upload` fires on "Upload the roadmap to the shared drive" |
| `endpoint` | `public endpoint`, `status endpoint` | a bare `endpoint` fires on "Document the API endpoint parameter", a docs edit the rule's own § When NOT to fire excludes |

All four are pinned as near-misses.

#### The `endpoint` narrowing, and the council round that forced it

The first implementation shipped a bare `endpoint` with a fourth
`collision_ok` entry beside the three routed rules that already trigger on it
(`broken-access-control`, `senior-engineering-discipline`,
`source-discovery-gate`). The defence offered was "no honest near-miss exists —
no endpoint-shaped coding prompt should be denied a threat pass".

The council rejected that defence and named three candidate near-misses. The
defence does not survive them:

| Candidate | Verdict |
|---|---|
| "Document the API endpoint parameter" | a genuine near-miss — a docs edit, excluded by the rule's own § When NOT to fire. The "no honest near-miss exists" claim was false. |
| "Refactor the internal endpoint helper" | a genuine near-miss on the same ground |
| "The health-check endpoint returns 200 OK" | a **legitimate fire** — the rule's own table names public endpoints "including health/status" |

Since one honest near-miss existed, the bare trigger could not be defended and
was narrowed. Both genuine near-misses are now pinned in the fixture.

**Stated recall gap, not closed.** `status endpoint` matches "expose a public
status endpoint" but not "the health-check endpoint returns 200 OK" — a prompt
this rule's own table puts in scope. Chasing the phrasings
(`health endpoint` / `health-check endpoint` / `healthcheck endpoint`) is the
keyword wish list the roadmap's risk register warns against, and a bare
`endpoint` buys that recall back at the price of firing on documentation. The
gap is recorded here rather than papered over; the reopening condition is a
measured prompt corpus showing health-endpoint prompts arriving without either
shipped keyword.

### Verify — mechanism substituted, and why

The roadmap declared:

> `./scripts-run src/scripts/rule_trigger_eval` over the four prompts … reports
> `security-sensitive-stop` as matched for each.

**That command cannot do this.** `src/scripts/rule_trigger_eval.ts:1-4` is a
**live LLM** harness, "advisory only, never gating", and its usage line is
`[--dry-run] [--model MODEL] [--out FILE] [--max-cases N]` — there is no
prompt-input flag. Its suite is *derived from* `tests/eval/routing-matrix/*.yaml`.

Substituted mechanism: the four prompts were added as `positives:` in
`tests/eval/routing-matrix/security-sensitive-stop.yaml`. That file is both
(a) the corpus `rule_trigger_eval` reads, so the four prompts do become cases
it runs, and (b) the input to the deterministic
`tests/scripts/routing_matrix.test.ts`, which asserts every positive matches
and every near-miss stays silent through the canonical matcher.

```
npx vitest run tests/scripts/routing_matrix.test.ts
→ 193 passed (193)
```

Two near-misses were added alongside, testing the directions the new triggers
open — per the precedent `src/rules/design-fidelity.md` states, that a
near-miss must test the direction the new trigger opens rather than one already
closed:

| Near-miss | Guards against |
|---|---|
| `Upload the roadmap to the shared drive.` | a bare `upload` keyword |
| `Rename the apiResource variable in the seeder.` | `api resource` firing on the camelCase identifier |

| `Document the API endpoint parameter in the reference page.` | a bare `endpoint` keyword firing on documentation |
| `Refactor the internal endpoint helper for readability.` | the same, on an internal refactor |

Six near-misses, four positives, all pinned:

```
npx vitest run tests/scripts/routing_matrix.test.ts
→ 193 passed (193)
```

### Gates

```
./scripts-run src/scripts/lint_trigger_collisions
→ 42 trigger collision(s), all dispositioned (120 rules scanned)
./scripts-run src/scripts/lint_trigger_precision
→ 21 short (≤3 char) keyword triggers / budget 22
./scripts-run src/scripts/check_always_budget
→ green (the rule is tier-2a; the description was not touched)
```

## Phase 2 — the WCAG version the accessibility skill names

### Census (step 2.1)

Reproduce with:

```bash
for c in 2.4.11 2.4.12 2.4.13 2.5.7 2.5.8 3.2.6 3.3.7 3.3.8; do
  printf '%s: %s\n' "$c" "$(grep -rF "$c" src/skills/accessibility-auditor/ | wc -l)"
done
```

| Criterion | Level | Hits before | Hits after |
|---|---|---|---|
| 2.4.11 Focus Not Obscured (Minimum) | AA | 0 | 1 |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | 0 | 1 |
| 2.4.13 Focus Appearance | AAA | 0 | 1 |
| 2.5.7 Dragging Movements | AA | 1 (a `data/aria-patterns.csv` row) | 1 + a checklist row |
| 2.5.8 Target Size (Minimum) | AA | 1 (a `data/aria-patterns.csv` row) | 1 + a checklist row |
| 3.2.6 Consistent Help | A | 0 | 1 |
| 3.3.7 Redundant Entry | A | 0 | 1 |
| 3.3.8 Accessible Authentication (Minimum) | AA | 0 | 1 |

The skill states "WCAG 2.2 AA" at `src/skills/accessibility-auditor/SKILL.md:4`,
`:17`, `:62` and `:192`. Before this change it carried two of the nine criteria
2.2 added, and both only as corpus rows — never as auditable conditions.

**Limit of the census method, stated because the council raised it.** A grep for
criterion numbers is a **floor, not a ceiling**. If it finds a number, the
criterion is named; if it does not, the criterion may still be audited under
synonymous wording — 2.4.11 could be covered by prose reading "the focused
element stays visible" with no number in sight. So the zero-hit rows above prove
the skill did not let a reader **cite** those criteria, not that no related
guidance existed anywhere in it. That weaker claim is the one this phase acts on,
and it is sufficient: an audit skill whose output is "a verdict with cited
failures" (`src/skills/accessibility-auditor/SKILL.md:18`) cannot cite a
criterion it never names. The `2.5.7` / `2.5.8` rows are the proof the limit is
real — both were present as corpus rows and still needed an auditable condition.

### The level-A fork (step 2.3), decided

The step allowed "either add them or state in one line why an AA audit omits
them". They were **added**, because WCAG conformance is **cumulative**:
conformance at AA requires every level-A criterion *and* every level-AA one.
An "AA audit" that omits a level-A criterion is not an AA audit, so
"why an AA audit omits them" has no valid answer. The cumulative reading is now
stated in the skill's own text, which is where the silence had been.

2.4.12 and 2.4.13 are level AAA — outside the claim — and are named in the
skill as out-of-scope rather than left silent.

### The self-check (step 2.4)

`tests/contracts/accessibility_wcag_version_claim.test.ts`. It is keyed on the
**claimed** version, not hardcoded to 2.2: a bump to a version with no registry
entry fails loudly. Four cases, two of them sensitivity probes:

```
npx vitest run tests/contracts/accessibility_wcag_version_claim.test.ts
→ 4 passed (4)
```

- removing `2.4.11` from the content produces an AA finding — asserted, not assumed;
- claiming `WCAG 2.9` produces a `(registry)` finding.

A test rather than a `lint_*` gate: a gate script owes a gate-coverage row, a
minimum-scan floor and a self-test, and would scan exactly one file. The step
permitted "a gate or test"; this is the smaller one.

### Bounded remediation, recorded

`src/skills/accessibility-auditor/SKILL.md` § Why this skill is rich claimed the
skill "carries the full WCAG criterion matrix". It did not, and after this change
it still does not — it carries the 2.2 additions plus its four checklists. One
phrase corrected in the same edit (same file, one line, and the same drift class
the phase exists to fix).

Size after: 2,773 exact-BPE tokens against the `rich` ceiling of 3,500
(`lint_token_budget_discipline`, green).

## Phase 3 — the icon default the sibling rule forbids

`src/rules/icon-consistency.md` § What this gates names "Defaulting to Lucide
without a deliberate choice" as the anti-pattern. `src/skills/iconography/SKILL.md`
step 2 opened with "Default open sets: **Lucide** (clean, Tailwind-native)",
listed it first, and hard-wired `react-shadcn-ui → Lucide` inside an imperative
pick step.

Step 2 is now a three-rung selection, and the rung that survives to open
candidates lists them alphabetically — Heroicons, Lucide, Phosphor, Tabler — with
a criterion table that maps *what the surface needs* to *which candidates supply
it*, so removing the default did not remove the guidance (risk-register rank 3).

The stack mappings moved out of the pick step into a section headed "an
observation, not a pick", where finding one of them in a project is rung-2
evidence of an incumbent set, and reaching for one because the stack is new is
named as the scaffold inheritance the rule forbids.

Cross-citation was already bidirectional and is unchanged:
`src/rules/icon-consistency.md:54` → `iconography`;
`src/skills/iconography/SKILL.md` → `icon-consistency`, now from three places.

The description and the `set:name` syntax examples (`lucide:arrow-right`) were
deliberately **not** touched: a format example is not a default, and a
description edit costs four regenerations for no change in what the skill
instructs.

## Council round — 2026-09-03

Convened on the three execution decisions above. Members configured: 2
(anthropic, openai). **Answered: 1 of 2** — the openai seat failed transport
(`os_error: ENOBUFS`), not quota (`anthropic 16/50 · openai 16/50`). Cost
$0.0000, all seats subscription-authed. Multi-round with internal peer review
and prose synthesis; quorum needed 1, so the run concluded, but it is
**DEGRADED — one voice, not convergence**, and is recorded as such rather than
quoted as agreement.

Verdict: **AMEND all three.** All three amendments were applied and are visible
above:

| Decision | Verdict | Amendment applied |
|---|---|---|
| 1 — substituting a deterministic fixture assertion for a non-executable advisory LLM eval | AMEND | mechanism accepted as the right one; the substitution is now stated inline in the roadmap step and in § Verify above, so the declared and the actual verify cannot silently diverge |
| 2 — adding the two level-A criteria rather than omitting them | AMEND | cumulative-conformance reading confirmed; the census method's floor-not-ceiling limit is now stated in § Census |
| 3 — a bare `endpoint` keyword with a declared collision | AMEND | defence tested against three named candidate near-misses, failed on the first, trigger narrowed to `public endpoint` + `status endpoint`, the two genuine near-misses pinned, and the residual health-endpoint recall gap stated |

The third amendment is the one that changed shipped behaviour: the council's
challenge produced a near-miss the execution had claimed did not exist, which
falsified the argument for the broader trigger. Recorded because the failure was
in the agent's own reasoning, not in the roadmap.
