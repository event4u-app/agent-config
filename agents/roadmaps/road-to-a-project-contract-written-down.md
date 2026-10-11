---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The consumer-side answer to the round's playbook demand has no owner in the estate. Merging into road-to-typed-grants-that-persist was rejected because that file owns the authority model, not what a consumer writes down; folding into stubs/road-to-target-project-bootstrap-enforce was rejected because that stub is demand-gated on quality tooling; parking in later/ was rejected because both phases are executable today."
relates:
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: "Draft. Owns autonomy and grants; the per-task-type autonomy ledger the source proposed stays there or nowhere, never here."
  - slug: road-to-target-project-bootstrap-enforce
    relation: disjoint
    note: "Stub. Owns quality-tool bootstrap in a consumer repo; this file owns the written goal and no-gos only."
---
# Road to a project contract written down

> **Source:** `agents/tmp.old/inbox-2026-10-i/` — a transcript in which the owner
> named the subject of a short video (an external reference: a derivative
> playbook of a vendor post on human-agent teams) and asked how this package
> gets better from it, plus the supplied plan's delta phase that mapped the
> playbook's four lessons onto the tree. Re-verified against `origin/main` @
> `d41121927` (v16.4.0) on 2026-10-11. Steps marked
> `corrected-from-reproduction` carry the wording the reproduction forced.

## Goal

A consumer repo that ran `/agents:init` carries, in its own `AGENTS.md`, a
written goal and a written list of no-gos beside the architecture and
conventions the initializer already asks for; a read-only report says which of
the four are present; and every no-go that names a path or a command can, with
the consumer's consent, become a deny rule the host enforces instead of a
sentence the agent may read past. Nothing is fabricated for the consumer and no
company content ships in the package.

## Context

- **The playbook's first lesson — "what is not written does not exist for the
  agent" — has half a receiver.** `/agents:init` asks five questions
  (`src/domains/meta/agents/init/command.md:84-97`): name, one-line
  description, architecture style, user-facing strings, additional conventions.
  It asks for no goal and no no-gos. The consumer guide's optional copy-in
  sections (`src/agent-src/contexts/contracts/consumer-agents-md-guide.md`)
  cover tech stack, setup, structure, testing and quality tools — none for a
  goal or a no-go. A grep for "north star" across `src/`, `docs/contracts/` and
  `README.md` returns only internal uses, none on a consumer surface.
- **The template cannot carry new sections.** `lint_agents_md` holds the
  consumer template (`src/agent-src/templates/AGENTS.md`) to a 2,500-character
  fail cap; it measures 2,495 at the base. `corrected-from-reproduction`: the
  supplied plan put the sections into a `CLAUDE.md` written by `init`; `init`
  only detects `CLAUDE.md` (`src/install/detect.ts:76`), the consumer entry
  point this package writes is `AGENTS.md`, and the template has five
  characters of headroom — so the sections go into the consumer's filled file
  and the guide, never into the template.
- **No consumer no-go is enforceable today.** The `pre_tool_use` deny concerns
  (`block-kernel-rule-writes`, `block-plumbing-writes`, `block-config-weakening`
  and siblings in `src/scripts/hook_manifest.yaml`) guard this package's own
  surfaces; none reads a consumer-authored list. Nothing under `src/install/`
  writes a `permissions` block into a consumer's settings file.

## Phase 1 — The two questions the initializer does not ask

- [ ] **1.1 Two copy-in sections in the consumer guide.** The guide gains
      `## Goal section (optional copy-in)` and `## No-gos section (optional
      copy-in)`, each with a short shape: the goal as one to three sentences a
      plan can be checked against; the no-gos as bullets, each naming a path,
      a command, a dependency, or a behaviour. The guide states why these two
      belong in the always-loaded file when its default is "leave AGENTS.md
      thin": they bind every turn.
      verify: `grep -c '^## No-gos section (optional copy-in)' src/agent-src/contexts/contracts/consumer-agents-md-guide.md` -> /^1$/
- [ ] **1.2 The initializer asks them, one at a time.** `/agents:init` step 3
      gains two questions after "Architecture style": the goal, then the
      no-gos. An empty answer omits the section and is reported in step 8 —
      never filled with a default. The sections are written into the consumer's
      filled `AGENTS.md` below the template content; the template file is not
      edited. `corrected-from-reproduction` (see Context).
      verify: `grep -c 'No-gos' src/domains/meta/agents/init/command.md` -> /^[1-9]/
- [ ] **1.3 A read-only report: N of 4.** `report_project_contract` reads a
      consumer `AGENTS.md` and prints which of goal, no-gos, architecture and
      conventions are present, as `N of 4` plus the missing names; it writes
      nothing and never infers a section from other prose. `/agents:init`
      step 8 calls it. A fixture with a goal and no
      no-gos reads `3 of 4` only when architecture and conventions are present
      too, and the test is seen red before the reader exists.
      verify: `npx vitest run tests/scripts/report_project_contract.test.ts` -> 0

## Phase 2 — A no-go that names a path or a command is enforced

- [ ] **2.1 Classify each no-go bullet.** A pure function sorts each bullet
      into `path`, `command` or `prose`, and returns the deny rule it would
      become in the host's documented permission-rule syntax for the first two
      kinds. The syntax is checked against the host documentation when the step
      is implemented and pinned with its `docs_url` in
      `src/scripts/hooks/host_lowering.yaml`, not taken from this file. A bullet
      the function cannot classify is `prose`, never guessed.
      verify: `npx vitest run tests/install/no_go_classify.test.ts` -> 0
- [ ] **2.2 Shown, consented, appended.** After 1.2, `/agents:init` prints the
      rows 2.1 produced and asks once whether to add them. On yes it appends
      them to the consumer's settings file's deny list, keeping every
      existing entry and its order; on no it writes nothing. `prose` bullets are
      reported as instruction-only. On a host with no native deny list the step
      reports the rows as instruction-only and writes nothing.
      verify: `npx vitest run tests/install/no_go_deny_rows.test.ts` -> 0
- [ ] **2.3 Seen to block.** The deny-row test's fixture no-go "never edit
      `migrations/`" yields a deny row; a second fixture asserts an existing
      user deny entry survives the append byte-for-byte, and a third asserts a
      declined consent leaves the file unchanged.
      verify: `npx vitest run tests/install/no_go_deny_rows.test.ts -t preserves` -> 0

## What this roadmap deliberately does not do

- **No persona lowered to a host subagent, no generated roster.** ADR-109
  rejected projecting personas as a subagent subtype (`ADR-109:54`, `:171`);
  the supplied plan's persona-to-subagent step is the rejected mechanism, and
  the one shipped verifier, `production-validator`, already gates "done".
- **No north-star claim and no plan-gate criterion on it.** No measured
  comparison of goal-anchored against task-anchored work exists; a section the
  agent reads is the whole adoption.
- **No autonomy ledger.** The authority model is owner-ruled in ADR-268 and
  received by `road-to-typed-grants-that-persist`; raising autonomy from
  evidence is not decided here.
- **No company or project content in the package** — generalised mechanics
  only; the consumer's goal and no-gos live in the consumer's file.
- **No setup-prompt skill.** The playbook's copyable prompt is prose; the
  mechanics above carry its effect with a test behind them.

## Acceptance Criteria

- [ ] AC-1 — `/agents:init` asks for a goal and for no-gos, writes only what
      the consumer answered, and never edits the shipped template.
- [ ] AC-2 — `report_project_contract` prints `N of 4` for a consumer
      `AGENTS.md` and writes nothing.
- [ ] AC-3 — A no-go naming a path becomes a host deny row only after consent,
      and existing deny entries survive unchanged.
- [ ] AC-4 — No file under `src/` ships a consumer's goal or no-go content.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Sections go into the filled consumer `AGENTS.md` and the guide, not the template | Template 2,495 chars against a 2,500 fail cap (`lint_agents_md.ts:58`) | The template's cap is raised by its own owner |
| D2 | reversible-technical | agent | Enforce through the host's native deny list, not a new `pre_tool_use` concern | A concern costs hook-bundle bytes and binds on every install; a consented, consumer-authored deny row changes nothing for a consumer who declines | A hook host without a native deny list asks for the same enforcement |
| D3 | reversible-technical | agent | Two new questions only | Architecture and conventions are already asked (`init/command.md:92-97`) | The report in 1.3 shows architecture or conventions missing on most filled files |
| D4 | reversible-technical | agent | Unclassifiable bullets stay prose | A guessed deny row on a vague sentence blocks legitimate work silently | A classifier error rate is measured on real consumer files |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A deny row blocks legitimate work | product | A broad path no-go stops an edit the consumer later needs, and the agent cannot say why | Rows are shown before consent; each row names the bullet it came from; the guide documents removing one | Phase 2 — A no-go that names a path or a command is enforced |
| 2 | The always-loaded file grows | product | Long goal or no-go sections add tokens to every turn on every host | The guide's shape caps each section at a few lines; 1.3's report prints the section sizes | Phase 1 — The two questions the initializer does not ask |
| 3 | The deny syntax is guessed | implementation | A row in the wrong syntax is accepted by the file and enforced by nothing | 2.1 pins the syntax to the host documentation with a `docs_url`; 2.3 asserts the produced row, not only that a row was written | Phase 2 — A no-go that names a path or a command is enforced |
| 4 | Writing the settings file clobbers it | implementation | Rewriting the settings file drops a user entry or reorders it | 2.2 appends, never replaces; 2.3 asserts byte-for-byte survival | Phase 2 — A no-go that names a path or a command is enforced |

## Provenance

Source ids from the supplied plan, by disposition: W6.1 → Phase 1
(`corrected-from-reproduction`); W6.2 → Phase 2; W6.5 → the goal section only,
plan criterion and suggestion anchor declined (K13); W6.3, W6.4 → declined on
ADR-109 (E9 moot); W6.8 → declined, receiver named (E10); W6.6, W6.7, W6.9 →
declined or already satisfied in the round's ledger; K14, K15, K16 → carried as
non-goals; E11 (interview over silent scaffold) → adopted as 1.2.
