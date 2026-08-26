---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
relates: []
# relates: `agent-config roadmap:context --roadmap internal-estate-fit --relates`
# returned one UNANSWERED hit, `road-to-internal-estate-fit` -- the file itself,
# not a sibling. Grepped `installed-tools.lock`, `detectProjectShape`,
# `SCOPE_DETECT` and `catalog:` across agents/roadmaps/: no hits in active/ or
# later/. No live relation to declare.
estate_growth_exempt: "Charges +0 on the COUNT half (status-scoped, this file is draft) and +1 on one-in-one-out, which is file-based. Warranted on a first-contact measurement against a real multi-repository estate: zero of four consumer repositories carry the install manifest their own contract calls the project-committed bill of materials, and the fullest install is 42 to 52 per cent short across three surfaces that were each written at a different time."
estate_offset_exempt: "No archive move is available in this change. This is the first roadmap in the estate written from an outside-in probe rather than from an inbox artefact or a self-audit, so it has no predecessor to retire."
---
# Road to internal-estate fit — what a first contact with a real estate surfaces

> **Source:** an outside-in review of a multi-repository developer estate on
> 2026-08-24, run against package HEAD `b15b63d38`. **Deliberately carries no
> repository, product, company or person name** — every finding is stated as a
> structural class, and every count is a denominator, not an identity. Read it
> as: *does this suite survive contact with the shapes it says it serves?*
>
> **This roadmap is scoped to fit, not to features.** It proposes no new
> capability. Each phase either closes a gap a real estate exposed, or records
> that the shape is already handled so a later reader stops re-checking.

## Goal

The suite can state, with a command rather than a claim, whether it is correctly
installed in a given repository and whether the shapes that repository actually
has are ones it recognises. Finished means: a consumer install carries a record
that makes drift detectable, a repository carrying more than one language
manifest is not silently reported as one of them, and the detection constants
that decide both have exactly one definition.

## Context — measured 2026-08-24 against a 13-repository estate at package HEAD `b15b63d38`

### D1 — an install has no record, so drift is not merely undetected but undetectable

`docs/contracts/installed-tools-lockfile.md` specifies `agents/installed-tools.lock`
as *"the project-committed bill of materials for AI tooling installed into this
repository"*. Measured across four consumer repositories carrying an install:
**zero** have the file. The `doctor` verb is registered as a *"Read-only drift
report: **manifest ↔ filesystem**"* (`src/cli/registry.ts:41`) — with no
manifest there is nothing to compare, and `read_manifest`
(`src/scripts/_lib/installed_tools.ts:120`) returns `null` on a missing file and
*"tolerates partial / malformed files"*, so the absence is silent rather than
loud.

What that permits, measured in the fullest install of the four:

| Projected surface | installed | package HEAD | short by |
|---|---:|---:|---:|
| skills | 174 | 299 | 125 (42 %) |
| rules | 57 | 119 | 62 (52 %) |
| commands | 106 | 202 | 96 (48 %) |

And the three surfaces are not one stale install — they are **three install
events**: the rule projection dated 2026-05-29, the skill projection 2026-06-01,
the root instruction file 2026-07-10. Six weeks between the extremes, in one
repository, with no record that any of it happened.

**`converge` does not cover this.** `src/scripts/_cli/cmd_converge.ts:1-11`
handles *duplicate* install surfaces — the same tool installed twice — and
performs cleanup, not comparison. Nothing in the suite reports that a projection
is a version behind.

### D2 — a repository carrying two language manifests is reported as one of them

`detectProjectShape` (`src/install/detect.ts:143`) resolves with
`SCOPE_DETECT_MANIFESTS.find(...)` — **first match wins, one `kind` returned** —
over a list whose first two entries are `package.json` then `composer.json`
(`:43-51`). A repository carrying both is therefore reported as the first, and
the second stack is invisible to the caller. Measured in the estate: **4 of 13
repositories carry both**, three of them being a backend framework plus a
frontend build.

Two honest bounds, because this is smaller than it first looks:

- **The blast radius is one caller.** `detectProjectShape` is consumed only at
  `src/server/routes/install.ts:338`, the setup wizard's detect endpoint. The
  *scope* decision uses a different function (`detectScope`, `:102`) for which
  any manifest is equivalent, so install scope is unaffected. What is wrong is
  what the wizard reports.
- **The nearby ADR does not cover it.** `src/install/detect.ts:40-42` attaches
  the caveat *"monorepos, dotfile-git repos, and non-Git workspaces all break
  it (ADR-007 D2)"* to this constant. Read at source, ADR-007 D2:143-144 says
  something else: *"`.git/` presence is **explicitly not a signal** (monorepos,
  dotfile managers, Hg/SVN workspaces all break it)"* — a statement about the
  `.git/` signal, not about the manifest list. The polyglot single-classification
  is undocumented, and the comment that appears to document it points at a
  clause about a different mechanism.

### D3 — the two constants that decide D1 and D2 are each defined twice

`SCOPE_DETECT_MANIFESTS` and `SCOPE_DETECT_AI_DIRS` each exist in two
independent copies: exported at `src/install/detect.ts:43` and `:53`, and
declared privately at `src/scripts/install.ts:2331` and `:2339`.
`src/scripts/install.ts` imports nothing from `src/install/detect.ts`. Both
pairs are byte-identical today (6 and 12 entries) and nothing keeps them so.

The test makes this worse rather than better: `tests/install/detect.test.ts:8-10`
imports **only the exported copy** and pins it exactly — *"covers the six
manifests in order"*, *"includes all twelve entries"*. A test that pins one of
two copies reads as a guard on the constant and guards half of it. (The same
file's assertion names still say "python", a leftover of the TypeScript
migration and a member of the same family as the 152 dead `.py` links recorded
in `road-to-contract-review-deadlines` Phase 4.)

### D4 — the package-manager cascade is correct in prose and two-fifths implemented in code

`src/skills/monorepo-workspace/SKILL.md:40-44` states it completely and
correctly: *"`packageManager` in the root `package.json` is the declaration and
wins when present … Otherwise infer from the lockfile: `pnpm-lock.yaml` → pnpm,
`yarn.lock` → yarn, `bun.lock` / `bun.lockb` → bun, `package-lock.json` → npm.
Two lockfiles is a finding, not a tie to break."*

The code implements two of those five branches:

```ts
function _package_manager(root: string): string {
    if (_is_file(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
    if (_is_file(path.join(root, 'yarn.lock')))      return 'yarn';
    return 'npm';
}
```
`src/agent-src/templates/scripts/work_engine/stack/runner.ts:495-502`. No
`packageManager` read, no `bun.lock` branch, no two-lockfile finding — and
`_script_command` at `:582-588` hardcodes `` `npm run ${name}` `` regardless.
Measured: **zero** files under `src/` mention `bun.lock` or `packageManager`
at all.

Consequence for a repo whose runner is not npm: every verification command the
work engine derives is the wrong binary. This is the same skill↔code class as
D1 in `road-to-component-granularity-vocabulary`, on a third surface — and the
prose being right is what makes it cheap to fix and easy to miss.

### D5 — a central version catalog is invisible, and one gate mis-classifies it as safe

Where a package manager supports named version catalogs, a member manifest
carries `"react": "catalog:default"` instead of a version, and the version lives
once at the root. Measured in one repository of that shape: **16 declared
catalogs, 357 `catalog:` references** across its members.

`src/skills/js-library-packaging/scripts/check_package_surface.ts:150` filters
unpublishable ranges with `v.startsWith('workspace:')` alone. A `catalog:` range
has the **same failure semantics** — it does not resolve outside the workspace —
and passes as an ordinary registry range, so the `workspace-range-publishable`
finding does not fire where it should. The upgrade skills compound it by
directing the edit at the member manifest, which in this shape is the wrong
file: the version is one root line with N referents.

## Phase 0 — make an install self-describing before changing anything else

- [ ] **0.1 Establish why the manifest is absent — written, or never written.**
      Four of four is not four oversights. Either the installer does not write
      it on the paths these repositories used, or it wrote it and something
      removed it. The answer decides whether Phase 1 is a writer fix or a
      migration.
      verify: the install path that produces `agents/installed-tools.lock` is
      named with its `file:line`, and a scratch install into a temp directory
      either produces the file or does not — recorded either way.

- [ ] **0.2 Decide what a manifest-less install should report.**
      Silent-null is the current behaviour and it is the reason four repositories
      drifted unnoticed. Loud is not automatically right either: a suite that
      errors on every pre-manifest install punishes the installs it most wants
      to keep. Report-and-offer is the third option.
      verify: the decision is recorded in the lockfile contract, and `doctor`'s
      behaviour on a manifest-less tree matches it.

## Phase 1 — drift becomes reportable

- [ ] **1.1 Write the manifest on every install path that projects a surface.**
      verify: a scratch install into a temp directory produces
      `agents/installed-tools.lock`; a second install updates it; the file
      validates against its own contract's schema version.

- [ ] **1.2 Report per-surface drift, not one number.**
      The measured case has three surfaces from three dates. A single "you are
      behind" line would have hidden exactly the fact that made it diagnosable.
      verify: the report names each projected surface with its recorded version
      and the package version, and a fixture with two surfaces at different
      versions prints two rows.

- [ ] **1.3 Sabotage the drift check before believing it.**
      Roll one surface back in a scratch tree, confirm the report names it,
      restore. A check never seen fire has unknown sensitivity.
      verify: the deliberate rollback is reported; after restore the report is
      clean. Record both outputs.

## Phase 2 — polyglot repositories are described, not guessed

- [ ] **2.1 Return every detected manifest, not the first.**
      The shape of a repository carrying two manifests is *both*, and the caller
      can decide what to do with that. This is a return-type widening at one
      call site, not a new capability.
      verify: a fixture carrying two manifests yields both kinds; a
      single-manifest fixture is unchanged; the one consumer at
      `install/detect.ts`'s caller renders the multi-kind case.

- [ ] **2.2 Correct the comment that cites the wrong clause.**
      The polyglot limitation is real and undocumented; the clause cited covers
      the `.git/` signal. Either record the polyglot behaviour where the
      constant is declared, or — once 2.1 lands — delete the caveat because it
      no longer describes the code.
      verify: no comment on `SCOPE_DETECT_MANIFESTS` cites ADR-007 D2 for a
      property that clause does not state.

- [ ] **2.3 De-duplicate the two detection constants and let the test see both.**
      One exported definition, imported by the second site. The current test
      pins one copy exactly, which is the shape that makes divergence invisible.
      verify: `grep -rn "const SCOPE_DETECT_MANIFESTS" src/` returns one
      definition, same for `SCOPE_DETECT_AI_DIRS`, and the existing test still
      passes unchanged.

## Phase 3 — the runner is read, not assumed

- [ ] **3.1 Implement the cascade the skill already specifies.**
      Five branches, in the stated order, with two-lockfiles as a reported
      finding rather than a tie-break. This is transcription, not design — the
      contract is `monorepo-workspace/SKILL.md:40-44` and it is already correct.
      verify: a fixture per branch resolves to the stated manager; a fixture with
      two lockfiles produces the finding and no manager; the existing
      pnpm/yarn/npm fixtures are unchanged.

- [ ] **3.2 Derive the script command from the resolved manager.**
      `_script_command` returns `npm run <name>` unconditionally. Every command
      the work engine hands an agent for verification inherits that.
      verify: the derived command names the resolved manager; a fixture whose
      manager is not npm produces a non-npm command.

- [ ] **3.3 Pin the two together so prose and code cannot drift again.**
      The defect is not that the cascade was unknown — it is written down
      correctly one directory away. A test that reads the branch list from the
      skill would be over-engineering; a test that fails when the code's branch
      count is below the documented one is not.
      verify: a test enumerates the implemented branches and asserts all five
      are present, and names the skill section as its source in a comment.

## Phase 4 — a catalog range is a workspace range

- [ ] **4.1 Treat `catalog:` with the same unpublishability semantics as `workspace:`.**
      One predicate, two prefixes. The finding code and its reason are already
      written for the `workspace:` case and carry over unchanged.
      verify: a fixture manifest with a `catalog:` dependency produces the
      unpublishable-range finding; a registry range still does not.

- [ ] **4.2 Point the upgrade path at the declaration, not the referent.**
      Where a catalog exists, editing a version in a member is either a no-op or
      a divergence from the catalog. The skills that direct an upgrade must ask
      where the version is declared before naming a file.
      verify: the upgrade guidance names the catalog as the edit site when one
      exists, and a fixture repository without catalogs is unchanged.

- [ ] **4.3 Decide whether a version literal in a member is a finding.**
      In a catalog repository it plausibly is — the catalog exists to be the one
      place — but that is a convention claim about someone else's repository and
      not this suite's to make unilaterally. Report or nothing; not a gate.
      verify: the decision is recorded with its reason, and if it reports, the
      report names the catalog it diverges from.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A loud manifest-less error breaks every existing install | product | Four of four measured installs have no manifest, so a hard failure on absence would red every one of them at once and the fastest fix a user finds is to stop running the check. | 0.2 decides the behaviour before 1.1 writes anything and lists report-and-offer as a first-class outcome; 0.1 establishes whether these are pre-manifest installs or a writer defect, which is what makes report-and-offer defensible rather than lenient. | Phase 0 — make an install self-describing |
| 2 | The drift report becomes an auto-updater | product | A report that knows the delta is one step from closing it, and a suite that silently rewrites a user-owned projection is the mutation the consent model in `cmd_converge.ts:12-22` exists to prevent. | Phase 1 reports only — no step writes a projection; 1.2's verify is a printed table, and the existing consent model is cited rather than extended. | Phase 1 — drift becomes reportable |
| 3 | Widening the return type breaks the one consumer | implementation | `detectProjectShape` has a single caller, and it is an HTTP response shape that a UI reads. | 2.1's verify requires the single-manifest case to be unchanged and the consumer to render the new case; the widening is additive, and one caller is a small enough blast radius to change in the same step. | Phase 2 — polyglot repositories |
| 4 | De-duplication changes behaviour while claiming not to | implementation | The two copies are byte-identical today, so a merge that silently reorders or drops an entry would be invisible — and order is load-bearing, since first-match-wins is the current semantics. | 2.3 keeps the existing exact-order test passing unchanged as its verify, and 2.1 lands first so order stops being load-bearing before the copies are merged. | Phase 2 — polyglot repositories |
| 5 | The cascade fix is treated as design and grows a manager-abstraction layer | implementation | Five branches invites a strategy object, a registry and a plugin point; the actual change is three `if`s and a field read. | 3.1 is scoped as transcription against an existing written contract; 3.3's test asserts branch presence, not architecture; no step introduces a new module. | Phase 3 — the runner is read |
| 6 | The catalog predicate turns into a convention gate on consumer repositories | product | 4.3's cheapest reading is "a version literal beside a catalog is wrong", which is a rule about how someone else should organise their manifests. | 4.3 admits "nothing" as a complete outcome and forbids a gate; 4.1 and 4.2 are confined to this suite's own findings and guidance. | Phase 4 — a catalog range |
| 7 | The roadmap is read as estate-specific | product | It was written from one estate, and a reader may treat its counts as facts about that estate rather than as a denominator for a shape. | Every finding is stated as a structural class with the count as evidence; no repository, product or person is named; the Goal is phrased on the suite's behaviour, not on any consumer's state. | Context |

## Acceptance Criteria

- [ ] **AC-1** — the reason four of four installs carry no manifest is established and written down, as a writer defect or as a pre-manifest population.
- [ ] **AC-2** — the behaviour on a manifest-less install is a recorded decision, and `doctor` matches it.
- [ ] **AC-3** — a scratch install produces a schema-valid `agents/installed-tools.lock`, and a second install updates it.
- [ ] **AC-4** — the drift report names each projected surface separately, proven by a fixture whose surfaces are at different versions.
- [ ] **AC-5** — the drift check was observed firing against a deliberately rolled-back surface, and both outputs are recorded.
- [ ] **AC-6** — a repository carrying two language manifests is reported as carrying both.
- [ ] **AC-7** — no comment cites ADR-007 D2 for a property that clause does not state.
- [ ] **AC-9** — the package-manager cascade implements all five documented branches, with a fixture per branch and a two-lockfile fixture that reports rather than guesses.
- [ ] **AC-10** — the derived script command names the resolved manager, proven by a non-npm fixture.
- [ ] **AC-11** — a `catalog:` dependency produces the same unpublishable-range finding as a `workspace:` one, and the upgrade guidance names the declaration site.
- [ ] **AC-8** — each detection constant has exactly one definition, and the existing order-pinning test passes unchanged.
