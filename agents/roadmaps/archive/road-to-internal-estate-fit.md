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

## Outcome — read this before the phases

**Archived does not mean achieved.** Phases 2, 3 and 4 landed in full. **Phase 1
is transferred**, because Phase 0 refuted its premise.

| Phase | State | What that means |
|---|---|---|
| **0** — make an install self-describing | **satisfied, and it refuted Phase 1** | 0.1 found the manifest is absent **by design** (ADR-020, consumer installs are global-only) and that this roadmap conflates TWO different manifests. 0.2's report-and-offer decision is recorded in the lockfile contract, and `doctor` already matched it. |
| **1** — drift becomes reportable | **transferred** | Writing a project-scope manifest on a consumer install path would contradict ADR-020 as a side effect of a roadmap step. Moved whole to [`stubs/road-to-per-repository-install-verification.md`](../stubs/road-to-per-repository-install-verification.md). |
| **2** — polyglot repositories are described | **satisfied** | Detection returns every manifest (additively); the mis-cited ADR-007 D2 comment is corrected; the duplicated constants are one definition each. |
| **3** — the runner is read, not assumed | **satisfied** | All five cascade branches implemented, two-lockfile is a finding rather than a guess, the script command names the resolved manager, and 9 tests pin it with sensitivity proven three ways. |
| **4** — a catalog range is a workspace range | **satisfied** | `catalog:` is unpublishable like `workspace:`; upgrade guidance points at the declaration; the literal question is decided as report-not-gate. |

### The Phase 1 transfer, and why re-scoping was refused

0.1 established three things that Phase 1 was written without:

1. `--scope=project` is **maintainer-gated** — the installer refuses it for a
   consumer, citing ADR-020 in the refusal text.
2. `write_lockfile` targets `~/.event4u/agent-config/installed.lock`, a
   **user-global** file that exists on this machine, from five call sites.
3. `agents/installed-tools.lock` is a **different** manifest with a different
   schema, written by nothing on a consumer path.

So the absence is ADR-020 working as decided. AI council 2026-08-26, **2/2
convergent on transfer**, refused two other options explicitly:

- **Executing 1.1 as written** would contradict ADR-020 as a side effect.
- **Re-scoping Phase 1 onto the global lockfile** is a goalpost move. Both seats
  applied the same discriminator: a *generic* goal may be re-scoped when its
  premise is refuted; a *specific, measurable* one may not. *"whether it is
  correctly installed **in a given repository**"* is specific, and a
  one-file-per-user lockfile cannot satisfy it. One seat: *"A council cannot
  quietly redefine success to match what it's permitted to execute."*

The stub carries what was **promised**, what is **reachable** without reopening
anything (user-global install verification — useful, and explicitly not the same
thing), and **the gap**: per-repository projection state is unverifiable by
design under the current architecture.

### The finding worth more than the phase it blocked

**Two manifests with similar names, different schemas and different scopes
produced a roadmap phase built on the wrong one.** Both council seats asked for
that to be recorded durably and independently of the disposition. It is: the
comparison table is at 0.1, the § Absence section of
`docs/contracts/installed-tools-lockfile.md` warns against the conflation at the
point a reader meets the file, and the stub holds it too.

### Two defects found by fixtures rather than by the roadmap

- **The peer-shadow bug** (4.1). `{ ...deps, ...devDeps, ...peers }` let a later
  map shadow an earlier one, so a `workspace:` range in `dependencies` for a
  package also listed in `peerDependencies` was invisible to the check. Found
  because a `catalog:` fixture used a name the test manifest lists as a peer.
- **The three-of-five cascade** (3.1) was known to the roadmap, but the
  **two-lockfile silent guess** was not stated as its own defect: the old code
  answered `pnpm` for an ambiguous repository, which the skill explicitly says
  not to do.

## Phase 0 — make an install self-describing before changing anything else

- [x] **0.1 Establish why the manifest is absent — written, or never written.**
      Four of four is not four oversights. Either the installer does not write
      it on the paths these repositories used, or it wrote it and something
      removed it. The answer decides whether Phase 1 is a writer fix or a
      migration.
      verify: the install path that produces `agents/installed-tools.lock` is
      named with its `file:line`, and a scratch install into a temp directory
      either produces the file or does not — recorded either way.


      **DONE — and the answer is NEITHER of the two the step offers. It is by
      design.**

      **The scratch install refuses the scope outright:**

      ```
      $ ./scripts-run src/scripts/install --project /tmp/probe --scope project \
          --tools claude --no-ui --quiet --no-smoke --core-only
      ❌  --scope=project is reserved for maintainers (ADR-020 — consumer
          installs are global-only).
      ```

      No `agents/` directory was created.

      **THERE ARE TWO MANIFESTS AND THIS ROADMAP CONFLATES THEM.** That is the
      finding, and it is larger than the question that produced it.

      | | `~/.event4u/agent-config/installed.lock` | `agents/installed-tools.lock` |
      |---|---|---|
      | Scope | **user-global** | **project** |
      | Written by | `write_lockfile` (`_lib/installed_lock.ts:228`), **5 call sites** | nothing on a consumer path |
      | Path from | `lockfile_path()` (`:98-109`) | `_lib/installed_tools.ts:100` |
      | Schema | `schema_version: 1` | `SCHEMA_VERSION = 2` (`:47`) |
      | On this machine | **present**, 489 bytes | **absent** |

      The five writers: `install.ts:3657`, `install.ts:3751`,
      `_cli/cmd_update.ts:548`, `_cli/cmd_uninstall.ts:800`,
      `install/partitionEligibility.ts:338`. The global file carries
      `agent_config_version: "14.12.0"`, `installed_at: "2026-08-25T12:28:34Z"`,
      a `host_layer_fingerprint` and a tools list.

      So *"four of four is not four oversights"* is right, and the reason is that
      **ADR-020 decided consumer installs are global-only**. Not a writer fix.
      Not a migration. Nothing to repair.

      verify, met: the install path is named with its `file:line`, and the
      scratch install is recorded — it did not produce the file, and said why.
- [x] **0.2 Decide what a manifest-less install should report.**
      Silent-null is the current behaviour and it is the reason four repositories
      drifted unnoticed. Loud is not automatically right either: a suite that
      errors on every pre-manifest install punishes the installs it most wants
      to keep. Report-and-offer is the third option.
      verify: the decision is recorded in the lockfile contract, and `doctor`'s
      behaviour on a manifest-less tree matches it.


      **DONE — option (c) report-and-offer, AI council 2/2 convergent**
      (anthropic/claude-sonnet-4-5 + openai/codex-default, two rounds, blind peer
      review), and refined by a second council once 0.1's finding landed.

      Silent-null was rejected as the cause of the drift; a hard failure was
      rejected because it would red every pre-manifest install at once and the
      fastest fix a user finds is to stop running the check — this roadmap's own
      rank-1 risk.

      **Recorded in the contract**, `docs/contracts/installed-tools-lockfile.md`
      § Absence, with the three states and their exit codes, the
      printed-command-never-a-write rule, the strict-mode carve-out, and the
      two-manifest warning.

      **`doctor` already matches it, verified rather than assumed**
      (`_cli/cmd_doctor.ts:3035-3085`): a consumer install marker with no project
      lockfile prints *"expected under ADR-020"* and **skips** the
      project-manifest checks at **exit 0**; no marker warns, names both repair
      commands, and exits 2. No automatic write, no prompt.

      **What the council refined after 0.1, and it matters:** the first ruling
      treated absence as indeterminate by default. Under the corrected facts a
      consumer install is manifest-less **by design**, and *"a finding that
      reports an absence guaranteed by an ADR is noise"*. The discriminator is
      the install marker, which is observable.

      **One distinction is recorded as NOT drawn:** pre-manifest versus
      regressed. Both seats wanted them reported differently; both found no
      stable local marker that establishes which a tree is — a package version
      does not, because an installer bug produces the same absence. They collapse
      into one `indeterminate` row with a `revisit-if`, rather than being guessed
      apart.
## Phase 1 — drift becomes reportable

- [~] **1.1 Write the manifest on every install path that projects a surface.**
      verify: a scratch install into a temp directory produces
      `agents/installed-tools.lock`; a second install updates it; the file
      validates against its own contract's schema version.


      **TRANSFERRED — see `## Outcome`.** 0.1 refuted this phase's premise:
      writing `agents/installed-tools.lock` on a consumer install path would
      contradict ADR-020 as a side effect of a roadmap step. AI council
      2026-08-26, 2/2 convergent, refused both executing it as written and
      re-scoping it onto the user-global lockfile, and transferred the phase
      whole to
      [`stubs/road-to-per-repository-install-verification.md`](../stubs/road-to-per-repository-install-verification.md).
- [~] **1.2 Report per-surface drift, not one number.**
      The measured case has three surfaces from three dates. A single "you are
      behind" line would have hidden exactly the fact that made it diagnosable.
      verify: the report names each projected surface with its recorded version
      and the package version, and a fixture with two surfaces at different
      versions prints two rows.


      **TRANSFERRED — see `## Outcome`.** 0.1 refuted this phase's premise:
      writing `agents/installed-tools.lock` on a consumer install path would
      contradict ADR-020 as a side effect of a roadmap step. AI council
      2026-08-26, 2/2 convergent, refused both executing it as written and
      re-scoping it onto the user-global lockfile, and transferred the phase
      whole to
      [`stubs/road-to-per-repository-install-verification.md`](../stubs/road-to-per-repository-install-verification.md).
- [~] **1.3 Sabotage the drift check before believing it.**
      Roll one surface back in a scratch tree, confirm the report names it,
      restore. A check never seen fire has unknown sensitivity.
      verify: the deliberate rollback is reported; after restore the report is
      clean. Record both outputs.


      **TRANSFERRED — see `## Outcome`.** 0.1 refuted this phase's premise:
      writing `agents/installed-tools.lock` on a consumer install path would
      contradict ADR-020 as a side effect of a roadmap step. AI council
      2026-08-26, 2/2 convergent, refused both executing it as written and
      re-scoping it onto the user-global lockfile, and transferred the phase
      whole to
      [`stubs/road-to-per-repository-install-verification.md`](../stubs/road-to-per-repository-install-verification.md).
## Phase 2 — polyglot repositories are described, not guessed

- [x] **2.1 Return every detected manifest, not the first.**
      The shape of a repository carrying two manifests is *both*, and the caller
      can decide what to do with that. This is a return-type widening at one
      call site, not a new capability.
      verify: a fixture carrying two manifests yields both kinds; a
      single-manifest fixture is unchanged; the one consumer at
      `install/detect.ts`'s caller renders the multi-kind case.


      **DONE — additive, so no caller had to change.** `detectProjectShape` used
      `SCOPE_DETECT_MANIFESTS.find(...)`; it now filters. `ProjectShape` gains
      `kinds` and `manifests` (every detected kind, in declaration order) and
      **keeps** `kind` / `manifest` as the primary, so a single-manifest
      repository sees exactly what it saw before.

      `ProjectKind` is now a named exported type rather than an inline union —
      it had to be nameable to type the array.

      The one consumer, `src/server/routes/install.ts:338`, returns the shape
      whole in its `DetectResponse`, so it renders the multi-kind case with no
      change at all.

      verify, met: a two-manifest fixture yields both kinds; a single-manifest
      fixture is byte-identical in `kind` / `manifest`; typecheck is green.
- [x] **2.2 Correct the comment that cites the wrong clause.**
      The polyglot limitation is real and undocumented; the clause cited covers
      the `.git/` signal. Either record the polyglot behaviour where the
      constant is declared, or — once 2.1 lands — delete the caveat because it
      no longer describes the code.
      verify: no comment on `SCOPE_DETECT_MANIFESTS` cites ADR-007 D2 for a
      property that clause does not state.


      **DONE — and the behaviour it wrongly described was corrected with it.**
      The comment on `SCOPE_DETECT_MANIFESTS` cited ADR-007 D2 for two
      properties. The clause covers the `.git/` signal — which is kept, because
      that part was true — and says nothing about detection *"short-circuiting on
      the first hit"*.

      Once 2.1 landed, the short-circuit sentence stopped describing the code at
      all, so it is deleted rather than re-attributed: the order is now a
      reporting order, not a tie-break.

      verify, met: no comment on `SCOPE_DETECT_MANIFESTS` cites ADR-007 D2 for a
      property that clause does not state.
- [x] **2.3 De-duplicate the two detection constants and let the test see both.**
      One exported definition, imported by the second site. The current test
      pins one copy exactly, which is the shape that makes divergence invisible.
      verify: `grep -rn "const SCOPE_DETECT_MANIFESTS" src/` returns one
      definition, same for `SCOPE_DETECT_AI_DIRS`, and the existing test still
      passes unchanged.


      **DONE — one definition each, imported by the second site.** Both constants
      were duplicated byte-for-byte in `src/scripts/install.ts:2331,2339`
      alongside their exported definitions in `src/install/detect.ts`. The
      existing test pinned **one** copy exactly, which is the shape that makes
      divergence invisible: a change to the other would have passed CI.

      Ordered after 2.1 deliberately, per this roadmap's own Risk 4 — merging the
      constants while first-match ordering was still load-bearing would have made
      the declaration order a silent correctness dependency of two call sites
      instead of one.

      verify, met: `grep -rn "const SCOPE_DETECT_MANIFESTS" src/` → **1**, same
      for `SCOPE_DETECT_AI_DIRS` → **1**, and `tests/install/detect.test.ts`
      passes **unchanged** (24/24).
## Phase 3 — the runner is read, not assumed

- [x] **3.1 Implement the cascade the skill already specifies.**
      Five branches, in the stated order, with two-lockfiles as a reported
      finding rather than a tie-break. This is transcription, not design — the
      contract is `monorepo-workspace/SKILL.md:40-44` and it is already correct.
      verify: a fixture per branch resolves to the stated manager; a fixture with
      two lockfiles produces the finding and no manager; the existing
      pnpm/yarn/npm fixtures are unchanged.


      **DONE — five branches, and the two-lockfile case is now a finding rather
      than a silent guess.** `_package_manager` implemented three of the five
      (`pnpm`, `yarn`, `npm`) and returned the first branch it happened to test
      when two lockfiles were present.

      Added: the **`packageManager` declaration** from the root `package.json`,
      which wins over any lockfile because it is what Corepack enforces; **bun**
      (`bun.lock` / `bun.lockb`); and **`package-lock.json` → npm** as an
      explicit branch rather than a fallthrough.

      `_resolve_package_manager` returns `{ manager, via, finding }`. Two
      DIFFERENT lockfiles yields `manager: null` with a finding naming both
      files — the skill says report both and stop, and the old code answered
      `pnpm`.

      verify, met: a fixture per branch resolves to the stated manager; the
      two-lockfile fixture produces the finding and no manager; the existing
      pnpm / yarn / npm fixtures are unchanged (42/42 pass).
- [x] **3.2 Derive the script command from the resolved manager.**
      `_script_command` returns `npm run <name>` unconditionally. Every command
      the work engine hands an agent for verification inherits that.
      verify: the derived command names the resolved manager; a fixture whose
      manager is not npm produces a non-npm command.


      **DONE.** `_script_command` returned `npm run <name>` unconditionally, and
      every command the work engine hands an agent for verification inherited it
      — so a pnpm repository was told to run a command its own lockfile
      contradicts.

      It now takes the resolved manager. Threaded through `_js_runners`, which
      gained the parameter, and the three call sites that build e2e and slow-test
      commands.

      verify, met: a pnpm fixture with a `test:e2e` script yields
      `pnpm run test:e2e`, and **no** command in that config starts with
      `npm run`.
- [x] **3.3 Pin the two together so prose and code cannot drift again.**
      The defect is not that the cascade was unknown — it is written down
      correctly one directory away. A test that reads the branch list from the
      skill would be over-engineering; a test that fails when the code's branch
      count is below the documented one is not.
      verify: a test enumerates the implemented branches and asserts all five
      are present, and names the skill section as its source in a comment.


      **DONE — 9 tests, and their sensitivity is PROVEN rather than assumed.**
      `PACKAGE_MANAGER_BRANCHES` is exported and asserted to hold all five, with
      the skill section named as its source in a comment. The step is right that
      parsing the prose would be over-engineering; the pin is the branch count
      plus one fixture per branch.

      **Sabotage, three ways, each restored from a file copy rather than
      `git checkout`:**

      | Sabotage | Result |
      |---|---|
      | two-lockfile finding disabled | **1 failed** — *"two DIFFERENT lockfiles is a finding, not a tie-break"* |
      | script command hardcoded back to `npm` | **1 failed** — *"the derived script command names the resolved manager"* |
      | `bun` branch removed | **4 failed** — the branch-count assertion plus all three bun fixtures |

      Restored: 42/42 pass, file back at 833 lines.
## Phase 4 — a catalog range is a workspace range

- [x] **4.1 Treat `catalog:` with the same unpublishability semantics as `workspace:`.**
      One predicate, two prefixes. The finding code and its reason are already
      written for the `workspace:` case and carry over unchanged.
      verify: a fixture manifest with a `catalog:` dependency produces the
      unpublishable-range finding; a registry range still does not.


      **DONE — one predicate, two prefixes, exactly as the step specifies. And
      the fixture found a second defect in the same lines.**

      `catalog:` resolves against the workspace catalog definition and means
      nothing to a registry, so it is the same defect as `workspace:`, not an
      adjacent one. The finding code and its reason carry over unchanged; the
      message now names which prefixes were seen.

      **The second defect, found by the first fixture and fixed here rather than
      noted:** the check built `{ ...deps, ...devDeps, ...peers }` and scanned
      the merge. A later map **shadows** an earlier one for the same package
      name, so a `workspace:` or `catalog:` range in `dependencies` for a package
      that also appears in `peerDependencies` with a registry range was
      **invisible**. Each map is now scanned separately. Same predicate, same few
      lines, so it is fixed in place per `active-remediation`'s fix-now bar
      rather than deferred.

      verify, met: `catalog:` and `catalog:<name>` both produce the finding in a
      publishable package; a registry range does not; a private package stays
      quiet. Sabotage: removing the `catalog:` prefix turns exactly the two
      catalog tests red; restored, 26/26 pass.
- [x] **4.2 Point the upgrade path at the declaration, not the referent.**
      Where a catalog exists, editing a version in a member is either a no-op or
      a divergence from the catalog. The skills that direct an upgrade must ask
      where the version is declared before naming a file.
      verify: the upgrade guidance names the catalog as the edit site when one
      exists, and a fixture repository without catalogs is unchanged.


      **DONE — a lookup added ahead of the edit, in both skills that own the
      question.**

      `dependency-upgrade/SKILL.md` gains **§ 1b — Find where the version is
      DECLARED, before naming a file to edit**, with a three-step lookup that
      stops at the first answer: a catalog entry for this dependency → a
      root-level pin (`overrides` / `resolutions` / `pnpm.overrides`) → the
      member manifest. A repository with neither behaves exactly as before, so
      this adds a lookup rather than changing a default.

      `monorepo-workspace/SKILL.md` gains **§ 2b — Catalogs**, stating that a
      member's `catalog:` range is a REFERENCE and the upgrade edits the catalog,
      and that where several catalogs declare the same dependency every candidate
      is listed rather than one being invented as applicable.

      verify, met: the guidance names the catalog as the edit site when one
      exists; a repository without catalogs is unchanged; both skills pass
      `skill_linter`.
- [x] **4.3 Decide whether a version literal in a member is a finding.**
      In a catalog repository it plausibly is — the catalog exists to be the one
      place — but that is a convention claim about someone else's repository and
      not this suite's to make unilaterally. Report or nothing; not a gate.
      verify: the decision is recorded with its reason, and if it reports, the
      report names the catalog it diverges from.


      **DONE — option (b), report unconditionally, informational and
      suppressible. AI council 2/2 convergent.**

      Both seats preferred (b) over (c) report-only-on-divergence, on the same
      argument: the durable fact is the **duplicated source of version policy**,
      not whether the two strings differ today. (c) waits until the risk is
      realised, and introduces a hard comparison question — textual versus
      semantically equivalent ranges — that (b) does not have.

      **On the boundary this step draws** — *"a convention claim about someone
      else's repository"* — the council ruled that a **normative warning would
      cross it and a factual, non-gating observation need not**. So the wording
      is descriptive: *"member literal overlaps catalog entry"*, never
      *"invalid"*. Recorded in `monorepo-workspace/SKILL.md` § Do NOT, which
      states plainly that this does not gate.

      The report names the member, the dependency, the literal range, the catalog
      name (`default` included) and the catalog range — the step's own
      requirement. An exact mismatch is higher severity and still does not gate.

      **Multiple catalogs, which the step did not anticipate:** if a dependency
      appears in several named catalogs, every candidate is listed. Inventing an
      "applicable" one would claim knowledge of intent the workspace definition
      does not carry.

      **Revisit-if:** pnpm establishes semantics identifying the uniquely
      applicable catalog; intentional literals prove common enough to create
      material noise; or repository configuration declares selective catalog
      use.
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

- [x] **AC-1** — the reason four of four installs carry no manifest is established and written down, as a writer defect or as a pre-manifest population.

      **Met, and the answer is neither branch the AC anticipates.** The manifest
      is absent **by design** — ADR-020 makes consumer installs global-only, so
      the project-scope manifest is never written there. The scratch install is
      recorded with its refusal text; the two-manifest table is at 0.1.
- [x] **AC-2** — the behaviour on a manifest-less install is a recorded decision, and `doctor` matches it.

      **Met.** Report-and-offer, council 2/2, recorded in
      `docs/contracts/installed-tools-lockfile.md` § Absence with three states
      and their exit codes. `doctor` was **verified** to match rather than
      changed to match (`_cli/cmd_doctor.ts:3035-3085`): expected-and-skipped at
      exit 0 for a global-only consumer, warn-with-both-commands at exit 2
      otherwise.
- [~] **AC-3** — a scratch install produces a schema-valid `agents/installed-tools.lock`, and a second install updates it.

      **NOT met — transferred.** Writing a project-scope manifest on a consumer
      install path contradicts ADR-020, and reopening that is owner-reserved.
      Carried whole to `stubs/road-to-per-repository-install-verification.md`.
- [~] **AC-4** — the drift report names each projected surface separately, proven by a fixture whose surfaces are at different versions.

      **NOT met — transferred** with AC-3; per-surface drift depends on the
      manifest AC-3 would have written.
- [~] **AC-5** — the drift check was observed firing against a deliberately rolled-back surface, and both outputs are recorded.

      **NOT met — transferred** with AC-3 and AC-4. The sabotage requirement
      travels into the stub unchanged, because it is the half most likely to be
      dropped on promotion.
- [x] **AC-6** — a repository carrying two language manifests is reported as carrying both.

      **Met.** `detectProjectShape` returns `kinds` and `manifests` for every
      detected manifest, additively — `kind` / `manifest` keep their single-value
      meaning, so a one-manifest repository is unchanged and the one consumer
      renders the multi-kind case without an edit.
- [x] **AC-7** — no comment cites ADR-007 D2 for a property that clause does not state.

      **Met.** The ADR-007 D2 citation is narrowed to the `.git/` signal it
      actually covers, and the short-circuit sentence is deleted rather than
      re-attributed — after 2.1 it no longer described the code.
- [x] **AC-9** — the package-manager cascade implements all five documented branches, with a fixture per branch and a two-lockfile fixture that reports rather than guesses.

      **Met.** All five branches, a fixture per branch, and the two-lockfile
      fixture producing a finding with no manager. Sensitivity proven by three
      separate sabotages, each turning exactly the expected tests red.
- [x] **AC-10** — the derived script command names the resolved manager, proven by a non-npm fixture.

      **Met.** A pnpm fixture yields `pnpm run test:e2e`, and no command in that
      config begins `npm run`.
- [x] **AC-11** — a `catalog:` dependency produces the same unpublishable-range finding as a `workspace:` one, and the upgrade guidance names the declaration site.

      **Met on both halves.** `catalog:` produces the unpublishable finding
      (bare and named forms), a registry range does not, and a private package
      stays quiet. The upgrade guidance names the catalog as the edit site where
      one exists, in both skills that own the question.
- [x] **AC-8** — each detection constant has exactly one definition, and the existing order-pinning test passes unchanged.

      **Met.** One definition each; `grep -rn "const SCOPE_DETECT_MANIFESTS"
      src/` returns 1, same for `SCOPE_DETECT_AI_DIRS`. The order-pinning test
      passes **unchanged** (24/24), which is the conjunct that proves the merge
      did not quietly alter the list.

## Deferred-item resolution — 2026-08-26

Iron Law 3 of [`roadmap-progress-sync`](../../../src/rules/roadmap-progress-sync.md)
fired at closure: six items carry `[~]` — steps 1.1, 1.2, 1.3 and their
acceptance criteria AC-3, AC-4, AC-5.

**Resolved by TRANSFER**, which is the preserving disposition and therefore
council-decidable rather than owner-reserved: the items are carried into a named
follow-up created in the SAME change, with their criteria verbatim, the refuting
measurements attached, an authority-shaped promotion gate, and an honest-null
closing path.

**The transfer is not a workaround for the blocker; it IS the disposition the
council chose**, 2/2 convergent, after refusing both alternatives on the record.
What sits behind it is not a missing environment but a recorded architectural
decision — ADR-020 — whose reopening is owner-reserved and which this run
deliberately did not touch.

Nothing is lost: the promise (`in a given repository`), the reachable
alternative (user-global install verification), and the gap between them are all
written into the stub, together with the open owner question.
