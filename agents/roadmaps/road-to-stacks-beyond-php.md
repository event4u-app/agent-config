---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane of road-to-leading-every-row; the set's growth is declared there. No active, parked or stub roadmap owns test or convention content for python, typescript or go; the quality-tooling third is deliberately routed into the stub road-to-target-project-bootstrap-enforce instead of a skill, and the two one-artefact packs cannot be archived into anything."
relates:
  - slug: road-to-leading-every-row
    relation: depends
    note: "the programme; blocker b5 there decides Phase 2"
  - slug: road-to-behavior-vocabulary-and-runner-truth
    relation: depends
    note: "its Phase 2 owns de-binding pest-testing from the tests commands; open PR #2144 is closing it — step 1.3 extends its fixture, never re-plans it"
  - slug: road-to-target-project-bootstrap-enforce
    relation: disjoint
    note: "stub; owns per-stack quality as quality-tools reference bodies, which this lane uses instead of new quality skills"
depends: [road-to-leading-every-row, road-to-behavior-vocabulary-and-runner-truth]
---
# Road to stacks beyond PHP

> **Source:** `agents/tmp.old/inbox-2026-10-b/` — a code-level comparison against a
> curated host-config collection with per-language rule sets; every anchor re-read at
> `9bc8cd4`. Class: external comparison corpus. Corrected where reproduction diverged.

## Goal

A Python, TypeScript or Go repository gets the discipline this tree gives a Laravel one,
without a language-named copy of every engineering skill. At `9bc8cd4`:
`src/domains/laravel/pack.yaml:2` carries 25 artefacts, `src/packs/python/pack.yaml:2`
and `src/packs/typescript/pack.yaml:2` one each; `quality-tools` covers PHP and JS/TS only
(`src/skills/quality-tools/SKILL.md:27-41`, references `php-tools.md`, `js-ts-tools.md`);
three commands bind `pest-testing` unconditionally
(`src/domains/engineering-base/tests/create/command.md:8-9`,
`…/tests/execute/command.md:8`, `…/bug/fix/command.md:8`). The language signal is
`resolve_toolchain` (`src/agent-src/templates/scripts/work_engine/stack/runner.ts:208`,
`ecosystems` at `:139,248`); `detect_stack` (`…/stack/detect.ts:251`) reads only
`composer.json` and `package.json` and returns frontend labels, so it can never say
python or go. Done: the composition table exists before any skill, stack-agnostic skills
adapt by the resolver's ecosystem, quality lands as `quality-tools` references, and only
`create` rows become skills, under the owner's cap.

## Phase 1 — Composition before creation

- [x] **1.1 Run the composition gate on three stacks.** For python, typescript and go,
      list the engineering-base skills a Laravel repository gets for testing, quality and
      conventions, and mark each `compose`, `adapt` or `create`. The table is the
      deliverable.
      verify: `grep -cE '\| (compose|adapt|create) \|' agents/evidence/analysis/stack-composition-2026-Q4.md` -> /^(2[7-9]|[3-9][0-9])$/
- [x] **1.2 Adapt, don't duplicate.** Every `adapt` row is one paragraph in the existing
      skill keyed on the resolver's `ecosystems`, under the skill's word budget. No skill
      is created here. `corrected-from-reproduction` — keyed on `detect_stack` the
      paragraph could never fire.
      verify: `test "$(ls src/skills | wc -l)" -eq "$(git ls-tree -d --name-only origin/main src/skills/ | wc -l)"` -> 0
- [x] **1.3 Prove a pyproject repository never binds `pest-testing`.** The de-binding is
      owned by the runner-truth lane's Phase 2; this step adds a fixture over
      `resolve_toolchain` on a python fixture under `tests/fixtures/stack/` covering all
      three binding sites.

      **The third site was still bound, and that is what this step found.**
      `tests/create` and `tests/execute` were de-bound by the runner-truth lane as
      planned, but `bug/fix/command.md:8` still read
      `skills: [bug-analyzer, pest-testing]` and carried `framework: laravel`. Its
      195-line body mentions no framework at all — the only two PHP tokens in the
      file were those two frontmatter lines — so the marker claimed a coupling the
      body does not have. Both are removed here and the resolver-conditional
      paragraph the sibling commands carry is added to its § 5 Tests, which is the
      adapt-don't-duplicate rule applied to the site that was missed.

      Sensitivity proven rather than assumed: re-adding `pest-testing` to that
      frontmatter turns the suite red on exactly one case
      (`bug/fix/command.md does not bind pest-testing`), and removing it again
      returns 13/13.
      verify: `npx vitest run tests/scripts -t 'pyproject never binds pest-testing'` -> 0
- [x] **1.4 Quality as references, not skills.** Add `python-tools.md` and `go-tools.md`
      under `src/skills/quality-tools/references/`, per the stub
      `road-to-target-project-bootstrap-enforce`; TypeScript is already covered by
      `js-ts-tools.md`.
      verify: `ls src/skills/quality-tools/references/ | grep -c 'python-tools.md\|go-tools.md'` -> /2/

## Phase 2 — At most two skills per stack, behind the owner's cap

- [ ] **2.1 python: `testing-pytest`, `conventions-python`** — only rows 1.1 marked
      `create`; each carries `evals/triggers.json` with ≥ 8 positive and ≥ 4 near-miss rows
      on the creating diff.
      <!-- blocked-by: b5-skill-growth-for-stacks | asked: no — programme blocker, inbox round authored without the owner present -->
      verify: `./scripts-run src/scripts/description_route_check --changed-files <list>` -> 0
- [ ] **2.2 typescript: `testing-vitest-playwright`, `conventions-typescript`** — same rule.
      <!-- blocked-by: b5-skill-growth-for-stacks | asked: no — programme blocker, inbox round authored without the owner present -->
      verify: `./scripts-run src/scripts/description_route_check --changed-files <list>` -> 0
- [ ] **2.3 go: `testing-go`, `conventions-go`** — same rule; `src/packs/go/pack.yaml` is
      generated, not hand-written.
      <!-- blocked-by: b5-skill-growth-for-stacks | asked: no — programme blocker, inbox round authored without the owner present -->
      verify: `test -f src/packs/go/pack.yaml` -> 0

## Phase 3 — Prove it on one fixture per stack

- [x] **3.1 One resolver fixture per stack.** A vitest over `resolve_toolchain` on
      `tests/fixtures/stack/{python,typescript,go}` asserts the ecosystem, the bound test
      command and the selected pack. `agent-config doctor` does no stack detection, so it
      is not the instrument. `corrected-from-reproduction`.
      verify: `npx vitest run tests/scripts -t 'resolver fixture per stack'` -> 0
- [x] **3.2 The Laravel standing payload does not grow.** Define the Laravel fixture the
      supplied draft assumed, then compare `check_preamble_payload_budget --json` totals at
      the base ref and after.

      **Fixture:** `tests/fixtures/stack/laravel` — `composer.json` with
      `laravel/framework` and `pestphp/pest`, plus the `artisan` marker. It resolves
      `ecosystems: ['php']`, `vendor/bin/pest`, `vendor/bin/phpstan analyse`, and is
      asserted as the control case alongside the three new stacks.

      **Reading, pinned with `--as-of 2026-10-02` so it is reproducible:** base ref
      `21da7191` measures `138277`; this branch measures `138277`. Every bucket is
      equal too — project-scope rules `122686` over 120 files, preloaded skills
      catalog `14845` over 299 files, CLAUDE.md hierarchy `746`. The three `adapt`
      paragraphs land in skill BODIES, and the catalog bucket carries descriptions,
      so the payload is untouched by construction — the measurement confirms the
      construction rather than discovering it.
      verify: `./scripts-run src/scripts/check_preamble_payload_budget --json` total equal to the base-ref reading on the Laravel fixture

## Acceptance criteria

- The composition table exists before any skill is created, and every new skill maps to one `create` row.
- A python fixture binds no `pest-testing` at any of the three sites; a Laravel fixture is unchanged.
- No pack gains more than the owner's cap; quality content for python and go lives under `quality-tools/references/`. No pack gained anything: Phase 2 is blocked on `b5`.
- The Laravel standing payload is byte-identical before and after. `138277` on both sides, every bucket equal.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | evidence | no reviewer subagents per stack | `later/road-to-database-evolution-tactics.md:132` CUT precedent | a stack reviewer the host cannot compose is measured |
| D2 | deterministic | evidence | no `paths:`-scoped rules per stack | ADR-227 `:50-55` | ADR-227 is superseded |
| D3 | product-owned | owner | PENDING programme blocker b5 — proposed: up to two skills per stack after 1.1 | `src/scripts/check_estate_count.ts:832` skill allowance 0 | the owner answers b5 differently |
| D4 | reversible-technical | agent | no `composes:` frontmatter field; lineage lives in the 1.1 table | `skill.schema.json` has no such field; adding one is a schema change this lane does not need | `audit_skill_overlap` needs machine-readable lineage |
| D5 | reversible-technical | agent | `/bug fix` loses `pest-testing` and `framework: laravel` | its 195-line body carries zero framework tokens; the marker declares a 100 %-one-stack coupling (`command.schema.json`) the file does not have | the body acquires Laravel-specific instructions |
| D6 | reversible-technical | agent | the ecosystem label, not the pack name, is what an adapt paragraph keys on | measured: the typescript fixture resolves `ecosystems: ['js']`, never `typescript` | the resolver renames its labels |

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: claude/drain-stacks-beyond-php -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | New skills are the engineering-base skill with a language name added | product | The neighbour's language-named skills are mostly this. | 1.1 runs first; only `create` rows promote; quality content goes to references. | Phase 1 — Composition before creation |
| 2 | A monorepo yields several ecosystems and the payload grows | implementation | `ecosystems` can hold more than one entry. | 3.2 pins the Laravel payload byte-identical; a union larger than one pack is a finding. | Phase 3 — Prove it on one fixture per stack |
| 3 | Phase 2 lands before b5 and the estate gate reds | implementation | An execution loop ignoring markers writes skills the ratchet refuses. | Each 2.x step carries the blocker marker; Phases 1 and 3 run without the answer. | Phase 2 — At most two skills per stack, behind the owner's cap |
| 4 | The runner-truth lane drops the binding instead of making it resolver-driven | implementation | Its step 2.1 reads "resolver-driven or drop it". | 1.3's fixture asserts only absence of `pest-testing` on python, which holds under either outcome. | Phase 1 — Composition before creation |
| 5 | A binding site is de-bound in prose but left bound in frontmatter | implementation | Observed, not hypothesised: `bug/fix` kept `skills: [bug-analyzer, pest-testing]` and `framework: laravel` after its two siblings were de-bound. | 1.3's test reads the frontmatter of all three sites, and a fourth case refuses a `framework:` marker on any of them; the sensitivity was proven red. | Phase 1 — Composition before creation |
