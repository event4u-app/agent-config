---
complexity: lightweight
---

# Road to harvested-claim provenance and router-head skills

> Make a harvested knowledge claim citable the way a borrowed line of code
> already is, and turn the documented 400-line skill cap from a checklist item
> into a gate.

> Source (consumed inbox): `agents/tmp.old/distillation` — two draft roadmaps
> and their transcript, authored outside this repo by a comparative pass
> against an external reference. The source is named only in that gitignored
> directory, per [`source-confidentiality`](../../src/rules/source-confidentiality.md);
> this roadmap carries the mechanisms, never the attribution.

## Context / What is verified

The inbox drafts were pinned against this tree at `1432c7a4`; HEAD is **23
commits** further on. Every anchor was re-verified at HEAD before a phase was
written, and two of them moved — which is why this roadmap is materially
smaller than the drafts it consumes.

**Anchors that still hold.**

| Anchor | Re-verified at HEAD | Serves |
|---|---|---|
| No assertion-level registry for harvested *knowledge* | `provenance/borrows.jsonl` = **0** rows; `provenance/README.md:1-8` scopes the ledger to conscious **code** borrows; no sibling file exists (`ls provenance/` → `README.md`, `borrows.jsonl`) | Phase 1 |
| Personas declare a voice, not a citable library | `src/agent-src/templates/persona.md` frontmatter is `id/role/description/tier/mode/version/source` — **no** `sources:` field (grep returns nothing) | Phase 2 |
| The comparative-analysis command has an open exit | `src/domains/analysis-workbench/analyze/reference-repo/command.md:260-272` (§7) ends at four offers, the last being "stop here"; nothing appends to any registry, and turning an ADOPT row into content is a pointer in `## Related` (`:292-300`), not a step | Phase 1 |
| The 400-line skill cap is documented and unenforced | `src/agent-src/templates/skill.md:210` — "**K6: Under 400 lines**" is a checklist line; **four** heads exceed it (`ai-council` 1055, `skill-writing` 763, `roadmap-management` 552, `quality-tools` 445 — the drafts named only the first three); median **167** over **289** skills | Phase 4 |

**Anchors that moved — and what that removes.**

- **Ad-hoc UI routing is shipped.** The drafts proposed a bare-invocation
  elicitation router anchored on `fe-design` being reachable only through
  `/implement-ticket`. At HEAD, `src/skills/fe-design/SKILL.md:1-31` opens with
  an explicit *"Ad-hoc mode — outside the engine, YOU run this loop now"* and a
  mode table, and [`road-to-frontend-skill-application.md`](road-to-frontend-skill-application.md)
  Phase 3 steps 1–4 are all `[x]`. That draft phase carried its own instruction
  for this case — fold in and cancel — and it is honoured in `## Cancelled`.
- **"Never manufacture consensus" already exists**, in a different file than the
  draft guessed. It looked at `adversarial-verification-council.md:81-94` and
  found only the `refutes` / reconciliation machinery. The real owner is
  [`judge-synthesis`](../../src/skills/judge-synthesis/SKILL.md):84-89: *"Surface
  both verdicts and the disagreement explicitly — never silently resolve it by
  averaging or vote-count."* Phase 3 shrinks to the half that is genuinely
  missing.

**One re-cut this analysis makes on its own.** The drafts proposed a **new
rule** for cite-or-label. [`code-provenance`](../../src/rules/code-provenance.md)
already owns exactly this discipline one layer down — a ledger, a
before-it-lands obligation, an escalation on unknown provenance — and differs
only in that its subject is code. Extending it is the smaller move
([`improve-before-implement`](../../src/rules/improve-before-implement.md)
§ solution-size ladder: reuse-in-repo before a new artefact), and it avoids
adding a rule to a projection surface with four generators.

## Phase 1 — A harvested claim is citable or it is labelled

The spine. Phases 2 and 3 both scope against the registry, so it lands first.

- [x] **1.1 Create `provenance/harvests.jsonl`.** Sibling of `borrows.jsonl`,
      same append-only convention, for harvested **knowledge** claims —
      heuristics, numbers, and mechanisms adopted from an external source into a
      skill, rule, or roadmap. Row shape: `harvest_id` (slug), `stated_in` (repo
      path, optionally `:line`), `source_ref` (URL+sha for a public source; an
      opaque id for a confidential one, per `source-confidentiality`),
      `evidence_locator`, `harvested_at`, `verdict` (`adopt` | `adapt`). Starts
      empty and grows only on a real harvest — never backfilled. Schema under
      `src/scripts/schemas/`, README section mirroring the `borrows`
      conventions. The schema stays inside this repo's Draft-07 subset — no
      `$ref`, no `const`, inline single-member `enum` — the trap
      [`road-to-inbox-harvest-2026-08.md`](road-to-inbox-harvest-2026-08.md)
      already paid for.
      <!-- verify: npx vitest run tests/scripts/lint_harvest_provenance.test.ts -->
      <!-- renamed from the drafted `claims.jsonl`/`claim_id`: `check_claims.ts`
      and `docs/CLAIMS.md` already own the word "claim" in this tree, for the
      opposite direction of travel — public claims this package makes ABOUT
      ITSELF. Two unrelated concepts under one grep is a confusion trap in an
      estate this size, so the ledger is named after what it records and the
      gate after `lint_provenance`, its actual sibling. `provenance/README.md`
      states the three-way distinction where a reader meets it. -->
- [x] **1.2 Extend `code-provenance` to the knowledge layer.** One section, not
      a new rule: a skill, rule, or roadmap asserting an externally-sourced
      claim either cites a `harvest_id` or labels the statement as own
      analysis. The rule's existing honesty stance carries over unchanged —
      an unknown source is never permissive by default. Its `## No CI-facing
      detector` section stays accurate: `lint_harvest_provenance` validates the
      ledger's own rows, exactly as `lint_provenance` does for borrows, and
      catches an unrecorded claim no more than it catches an unrecorded borrow.
      Say so in the same words rather than implying new coverage.
      <!-- verify: ./scripts-run src/scripts/check_references -->
      <!-- two frontmatter traps met on the way: `description` is capped at 190
      chars by rule.schema.json, and the `# obligation: line N` comment pins the
      Iron Law's line number, so adding two triggers shifted it 38 → 40 and the
      comment was corrected with it. Nothing in src/scripts parses that comment
      today — it is a human pointer — but a stale one is drift either way.
      Also resolved: `## When NOT to fire` excluded prose edits, which is right
      for the code clauses and exactly wrong for the knowledge layer, whose only
      surface IS prose. The exclusion is now scoped rather than inherited. -->
- [x] **1.3 Registry integrity gate.** `lint_harvest_provenance.ts`: every
      `<!-- harvest:<id> -->` citation under the scanned roots resolves to a
      ledger row, and every row's `stated_in` path exists. No orphan ids, no
      dead rows — plus schema, `harvest_id` uniqueness, and a pinning check that
      rejects a bare URL, since an unpinned reference cannot be re-verified. An
      **empty ledger with zero references is a legitimate green** — and both the
      gate's stdout and a dedicated test say so explicitly, because a gate that
      scans nothing and exits green is the failure mode this repo has already
      recorded. Wired into `task ci` as `lint-harvest-provenance`.
      <!-- verify: npx vitest run tests/scripts/lint_harvest_provenance.test.ts -->
- [x] **1.4 Close the harvest exit.** Add §8 to
      `src/domains/analysis-workbench/analyze/reference-repo/command.md`: after
      the user accepts a roadmap draft, **offer** to append one `harvests.jsonl`
      row per anchored ADOPT/ADAPT finding — `harvest_id`, `stated_in` = the
      accepted roadmap, `source_ref` = the reference's pinned URL+sha,
      `evidence_locator` = the `file:line` from the verdict row. Confirmation-gated
      like every other write in that command; never automatic; no row for
      REJECT / ALREADY / UNCLEAR.
      <!-- verify: ./scripts-run src/scripts/check_references -->
- [x] **1.5 Seed the content step.** The command's §6 document structure gains a
      seed block — proposed name, one-line description, target template, and the
      harvest ids it will cite — for each ADOPT row whose adoption lands in a *new*
      skill or rule. A handoff artefact for
      [`learning-to-rule-or-skill`](../../src/skills/learning-to-rule-or-skill/SKILL.md),
      never an auto-created file; the block declares itself a proposal in its
      first line. That skill's intake section names the seed block as an
      accepted input shape, which is what turns the current `## Related` pointer
      into a step.
      <!-- verify: ./scripts-run src/scripts/check_references -->

## Phase 2 — Personas may declare what they are allowed to cite

**Prerequisite:** 1.1 (there must be a registry to scope against).

- [x] **2.1 Additive `sources:` frontmatter on personas.** An optional list of
      harvest-ledger ids a persona may cite as doctrine. **Absent field = today's
      behaviour**, which is what keeps this additive across 34 personas; the
      Unique-Questions heuristic is untouched. Lint: a declared id must resolve
      in `harvests.jsonl`. One existing persona migrated as the worked example —
      and if the registry holds no row that persona could honestly cite, the
      worked example is the *empty* declaration plus a sentence saying why, not
      an invented row.
      <!-- verify: npx vitest run tests/scripts/lint_harvest_provenance.test.ts -->
      <!-- three decisions the step text did not anticipate. (a) The field needed
      adding to persona.schema.json, which is `additionalProperties: false` — the
      validator would otherwise have rejected every migrated persona. (b) The
      resolution check lives in `lint_harvest_provenance`, not a new persona
      lint: "a harvest id resolves" gets exactly one owner, and a second gate
      would be free to disagree with the first. (c) The worked example is
      `advisors/first-principles` with `sources: []` — reconstructing a problem
      from irreducible constraints is that advisor's whole function, so the
      empty declaration states something about the lens instead of filling a
      field. The ledger is empty and no row was invented to populate it. -->
      <!-- the verify command is the harvest-gate test rather than a persona
      lint: `lint_personas` does not exist in this tree (the persona gates are
      `lint_persona_governance` and `lint_profile_personas`, both run clean),
      and the behaviour this step adds is the three-state resolution, which that
      test suite is what pins. -->

## Phase 3 — The synthesis half that is actually missing

The draft proposed two council-synthesis additions. One is already shipped
(recorded in `## Cancelled`); this is the other, adapted rather than imported.

- [x] **3.1 Flag an uncited assertion — never drop it.** `judge-synthesis` gains
      one obligation: a panelist assertion carrying neither fresh `evidence[]`
      nor a citation is **marked as uncited** in the report. The source
      formulation was "drop or flag"; **drop is incompatible with this repo** —
      § 4 of the same skill already binds the opposite direction ("Advisory —
      **Emitted in full, never elided** … a finding that reached a judge and not
      the reader was suppressed by the aggregator"). Taking the drop half would
      have contradicted a rule in the file being edited, which is the finding
      this step records.
      <!-- verify: task lint-skills -->

## Phase 4 — The documented cap becomes a gate

The activation argument for splitting a large skill is **not** available: the
host loads `SKILL.md` whole on trigger, and whether it then follows a pointer is
host behaviour nothing in this tree observes. So this phase does not claim a
token win. It enforces a cap the repo already published (`skill.md:210`, K6) and
which 4 skills currently exceed — an existing contract made real, nothing more.

- [x] **4.1 Write the router-head contract.** A `SKILL.md` over the K6 cap
      restructures as an entry head (when-to-use, mode table, routing) plus
      `tasks/` or `references/` files loaded per mode; the head never inlines
      procedure bodies for more than one mode. Lands in
      `src/agent-src/templates/skill.md` beside K6 with a worked example, and
      `skill-writing` points at it.
      <!-- verify: task lint-skills -->
- [x] **4.2 Enforce it as a shrink-only ratchet.** `lint_skill_router_head.ts`:
      a `SKILL.md` over 400 lines with no `tasks/`-or-`references/` split fails
      `task ci`. The current offenders enter a committed allowlist that may
      only shrink — same pattern as `lint_trigger_precision`. The test asserts
      both directions: a new oversized monolith fails, and an allowlisted file
      does not.
      <!-- verify: npx vitest run tests/scripts/lint_skill_router_head.test.ts -->
      <!-- the offender set is FOUR, not the three the drafts named: `quality-tools`
      (445) was missed by the outside pass, which listed only ai-council 1055,
      skill-writing 763 and roadmap-management 552. Measured with `wc -l` over
      all 289 heads and pinned by a test that re-derives it, so a padded
      allowlist (which would silently pre-authorize regressions) fails.
      `references/` is the established split directory — 9 skills already use
      it; `tasks/` is new and permitted. The allowlist is an inline constant
      rather than a JSON baseline: a baseline file grows unread, and a
      shrink-only list has to be read on every diff that touches it. -->
- [~] **4.3 Retrofit the three offenders.** Deferred, not skipped — see
      `blocker: router-head-retrofit-instrument`. The draft pre-registered
      "tokens-on-trigger before/after per skill" as the gate on this work, and
      that instrument does not exist: tokens-on-trigger is a host-side quantity,
      and this tree can measure a file's exact BPE size
      (`lint_token_budget_discipline`) but not what the host loaded. Retrofitting
      three skills on an unmeasurable premise is the exact move ADR-202 forbids,
      so the series waits for an instrument or an explicit maintainer decision to
      proceed on the contract alone.

## Cancelled — each against a named citation

- [-] **Bare-invocation elicitation router for mode-rich skills.** Shipped.
      `src/skills/fe-design/SKILL.md:1-31` carries the mode table and the ad-hoc
      executor lane; [`road-to-frontend-skill-application.md`](road-to-frontend-skill-application.md)
      Phase 3 steps 1–4 are `[x]`, including trigger evals pinning the
      engine/ad-hoc disjunction. The draft's own prerequisite ordered this
      cancellation if the surface was already claimed.
- [-] **A fixed-count comparative loop, or a new command for one.** Strictly
      weaker than what ships. `analyze/reference-repo/command.md:183-196` (§5b)
      binds **DONE = a pass produces zero verdict changes**, minimum two passes,
      cap four, and a still-flipping table published as `contested` — never
      stopped silently, and *"never an LLM-as-judge gate, never a script"*. A
      fixed "repeat three times" can stop before convergence and waste a pass
      after it. The anchor-table-before-fetch (`:60-68`), read-only pinned clone
      (`:85-101`), and adopt/adapt/reject/already classification (`:155-182`) are
      likewise already in place.
- [-] **Directory-as-roster instead of hand-maintained lists.** Already the
      repo's shape — `task generate-tools` and the census scripts encode it.
- [-] **"Never manufacture consensus" in council synthesis.**
      [`judge-synthesis`](../../src/skills/judge-synthesis/SKILL.md):84-89 —
      *"Surface both verdicts and the disagreement explicitly — never silently
      resolve it by averaging or vote-count. The human adjudicates."* The draft
      looked for this in `adversarial-verification-council.md` and, not finding
      it there, proposed adding it; it exists one file over.
- [-] **Per-user diagnostic profile personalising future sessions.** No anchored
      defect it serves; `user-types/*.yml` already shape audience, and a stored
      profile adds a privacy surface for zero verified need.
- [-] **Single-command installer rework.** The blocker is not the installer.
      `docs/install-friction-report.md:2` still reads `status: template —
      awaiting sessions (no real data yet)` — re-verified at HEAD. No installer
      change until that study produces data.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-13 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The claims ledger becomes ceremony nobody feeds | product | `borrows.jsonl` has **0** rows after existing for a full governance roadmap; a second empty ledger is a plausible outcome and would add a gate, a schema, and a rule section for no recorded claim | Ship it wired to a producer in the same phase — 1.4 makes the comparative-analysis command the writer, so the registry has an author before it has a policy; if it is still empty after the next real harvest, that is a falsifier worth recording, not a reason to add reminders | Phase 1 |
| 2 | The new gate lands red on the tree as it stands | implementation | `check_claims_registry` and `lint_skill_router_head` both scan surfaces never scanned before; either may report pre-existing state on its first run | Classify every first-run finding before wiring into `task ci`; a real finding is a fix in this roadmap, never a loosened gate. The router-head allowlist is seeded from the measured offender set, not guessed | Phases 1, 4 |
| 3 | The router-head split trades one cost for another | product | Moving procedure into `tasks/` can make a skill *less* reachable if the host never follows the pointer — the same unreachability `road-to-frontend-skill-application` Phase 1 measured for the catalogue | 4.3 stays `[~]` behind the instrument blocker; 4.1–4.2 constrain only *new* oversized skills, where no working skill is made worse | Phase 4 |
| 4 | Additive persona frontmatter drifts past additive | implementation | A `sources:` field that lint treats as required, or a worked example that invents a claim row to have something to declare, breaks 34 personas or corrupts the ledger's first entries | Absent field is normative today's behaviour and is pinned by a test; the worked example is allowed to be an empty declaration with a stated reason | Phase 2 |

## Blockers

### blocker: router-head-retrofit-instrument
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 4.3 only. Steps 4.1 and 4.2 are unblocked — they constrain
  new skills and do not require the retrofit.
- **What to do:** either supply an instrument that observes what the host
  actually loads on skill trigger (no such observation exists in this tree
  today), or decide explicitly that the published K6 cap is reason enough to
  restructure the three offenders without a token claim.
- **Resolved when:** an instrument exists and has produced a before/after
  reading on one skill, **or** a maintainer decision is recorded that the
  contract alone justifies the retrofit.

### blocker: first-contract-true-analysis-run
- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap. Recorded because the consumed drafts
  raised it and it is a real gap: no artefact under `agents/evidence/analysis/`
  shows `/analyze:reference-repo` having been run end-to-end under its own §5b
  convergence contract — `ls agents/evidence/analysis/ | grep compare` returns
  nothing. The drafts themselves were produced *outside* the command, so its
  contract has an untested path.
- **What to do:** run the command against a small reference and land the
  evidence artefact. Two things make this a maintainer call rather than an
  autonomous step: it spends on external fetches, and its output is raw named
  evidence, which `source-confidentiality` keeps local-only unless anonymised.
- **Resolved when:** one evidence artefact exists that was produced by the
  command rather than by an ad-hoc pass.

## Out of scope

- Importing any *content* from the reference — the harvest is mechanism-only.
- Automating convergence via LLM-as-judge — §5b forbids it, and that
  prohibition is load-bearing.
- Scheduling recurring harvests — cadence is a maintainer decision under the
  capacity caps of [`ADR-216`](../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md).
