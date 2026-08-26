---
complexity: structural
status: ready
estate_offset_exempt: "No active roadmap covers the consumer-install surface this measures, so there is nothing to merge into; the tooling overlap this phase does have is with existing doctor verbs, which it composes rather than duplicates. Archiving an unrelated roadmap to pay for this one would be an accounting move, not a drawdown."
estate_growth_exempt: "The findings behind this roadmap were measured in installed consumer trees, not assumed, and each carries a named public ecosystem mechanism as its anchor. No active roadmap covers the same surface. Phase 1 extends the existing doctor family rather than adding a parallel one — the overlap is deliberate and is stated in the phase itself."
execution:
  mode: phase-checkpoints
---
# Road to consumer-repo reality

> **Source:** a three-pass reading of three first-party repositories that
> install this package — a framework-based PHP API, a JS/TS monorepo with a
> component library and workshops, and a mixed legacy/modern PHP+React
> application. Each pass re-entered the repositories carrying the previous
> pass's conclusions. **Three trees of one organisation are a discovery
> channel, never a validation sample:** they share a toolchain culture and one
> team's habits, so the reading below is where each shape was *noticed*, and
> the generality bar — not the reading — is what admits it.

## The generality bar

Every shape in this roadmap must clear **both** tests. The first was in the
original draft and is insufficient on its own; the second exists because a
purely in-house convention is just as expressible as a universal one.

1. **Fixture-expressible.** The shape can be stated as a fixture with no
   reference to an observed tree. A finding that needs the tree to be
   understood is not a shape yet.
2. **Publicly anchored.** A named, publicly documented ecosystem mechanism
   exists independently of any tree read here — a specified config directive, a
   package-manager protocol, a published distribution model, a named pattern.
   The anchor is cited in the phase. "We saw it in our repositories" is a
   discovery, not an anchor.

**Frequency inside the sample is not an input to either test, and not an
input to ordering.** How many of the three trees showed a shape says something
about one organisation's toolchain and nothing about the shape's reach, so the
counts recorded in the phases below are provenance — where the shape was seen —
never an argument for its priority or its admission. Phases are ordered by what
their anchor implies about blast radius on an arbitrary consumer: a silent
mis-read that makes every later routing decision wrong outranks one that
degrades a single skill's output.

A step whose anchor is a single organisation's practice is marked
**anchor-pending** and does not get built until a second, independent,
external instance is recorded next to it. One such step is marked below rather
than quietly promoted, because the bar is worth more than the step.

## Goal

The package stops assuming that its own installed surface, the consumer's
configuration, and the consumer's framework family are what its documents say
they are, and starts **probing each of the three before routing on it**. When
this is finished: a consumer can be told in one command whether the agent layer
its root instruction file promises actually exists; a project whose real
standards live behind an `extends` chain yields those standards instead of a
null; and a PHP application built from framework *components* without the
framework is no longer routed to that framework's skill.

## Phase 1 — The map is not the territory: install integrity

**Anchor:** root agent-instruction files are a multi-vendor ecosystem
convention (`AGENTS.md`, the Copilot instructions file, per-tool root files),
and a manifest pin diverging from an installed artefact is the ordinary
manifest-versus-lockfile drift every package ecosystem has. Neither depends on
who the consumer is.

This phase is first because of what its anchor implies, not because of what
the sample showed: a dangling pointer is read as a working one, so **every**
routing decision downstream of it is made against a layer that is not there,
and nothing surfaces the fault. That is the widest blast radius on the list.
The counts below are provenance only. A root instruction file listed an agent
layer — rules, skills,
guidelines — under a path that **did not exist in the tree**. In one repository
the entire layer was absent while the file still described it; in another the
layer existed but two of its four advertised directories did not. An agent
reads the root file, believes the layer is there, and routes on names it can
never load. A third repository carried no agent surface at all while sitting
inside the same product boundary as the other two.

The same trees show the version axis of the identical defect: a committed
project settings file pinning a version several majors behind the installed
projection, under a **settings filename this package no longer reads**, while a
generated artefact in that tree still cites a generator script in a language
this package has not shipped for generations.

**This phase composes, it does not duplicate.** The tree already carries a
doctor family — `hooks:doctor`, `routing:doctor`, `reach:doctor`,
`workspace:doctor`, `settings:check`, `mcp:check`, `packs:active` — and
`routing:doctor` sets the precedent by composing existing single-purpose
surfaces instead of re-implementing them. Each of those answers "is the
mechanism I configured working". **None of them asks whether a path a root
instruction file names resolves at all**, which is the one question added here.
Building an eighth independent diagnostic would be the failure mode; the first
step is therefore a placement decision made against the existing family, in
public, before any code.

- [x] **1.1 Decide the placement against the existing doctor family, and record
      it.** Enumerate what each existing verb already answers, name the residual
      question none of them covers, and choose: extend one of them, or add one
      that composes them. A new top-level verb is the outcome only if the
      enumeration shows no host for the question.
      verify: the decision is recorded with the enumeration that produced it,
      and names which existing verb was extended or which ones the new surface
      composes — a placement asserted without the enumeration does not count.

      **DONE.** Extend `doctor`; no eighth verb. The roadmap's own enumeration
      listed seven verbs and omitted the one that decides it: `doctor` already
      owns manifest ↔ filesystem drift and publishes a check battery with
      `--check <id>`. Three ids added: `instruction-path-reach`, `version-axis`,
      `override-set`. Full enumeration and the four reasons:
      `agents/evidence/analysis/doctor-family-placement-2026-08-26.md`.
- [x] **1.2 Resolve every path a root instruction file names.** Parse the root
      instruction files, extract every repository-relative path they point at,
      and report each as present, dangling, or unresolvable-for-a-stated-reason.
      This is the check that would have caught all three trees.
      verify: a fixture consumer whose root file names one existing and one
      absent directory exits non-zero and names exactly the absent one; a
      fixture whose paths all resolve exits zero; a fixture with a path the
      parser cannot interpret reports it as unresolvable, never as absent.

      **DONE.** `src/scripts/_lib/install_reach_checks.ts`, 26 fixtures.
      Run against this repository's own root files it reports **100 claims — 71
      present, 8 dangling, 21 unresolvable-with-a-reason**, and all 8 dangling
      are real (3× `scripts/install.sh` from the `scripts/` → `src/scripts/`
      move, 2 retired by py2ts, 3 absent generated directories).

      **Two earlier figures here were wrong and are corrected rather than
      quietly replaced.** The first revision reported 38 dangling, most of which
      were not paths at all — fixed by the anchoring rule, pinned by three tests
      named after the false positives they encode. The second reported 18, and a
      neutral review of the branch found that number inflated by two further
      defects: the extractor read a markdown link's backticked **label** as a
      path claim, and the generated single-file concatenations (`.windsurfrules`
      and its siblings) were being read at all. Together those produced 49 of 57
      dangling paths on the live tree, every one a false positive. Both are
      fixed and pinned; the honest number is 8.
- [x] **1.3 Report the version axis as a three-way comparison.** Pinned version
      (from whichever settings file the consumer actually carries, legacy
      filenames included), installed-projection version, and the version the
      resolver would pick now — printed together, with legacy settings paths
      named as legacy rather than ignored.
      verify: a fixture carrying only the legacy settings filename is read, not
      skipped, and its pin is reported alongside a differing installed version.

      **DONE.** `checkVersionAxis` prints pinned · installed · resolvable-now
      together, and a pin under a legacy filename is read and LABELLED legacy
      rather than skipped.
- [x] **1.4 Stop generated artefacts from hard-coding their generator's path.**
      A generated file that names the script that wrote it becomes a lie the
      moment that script moves. Emit a stable, resolvable reference instead.
      verify: grep the generated-artefact templates for a literal script path;
      zero matches, and the count is reported so a future addition is visible.

      **DONE, and the drift had already happened.** 18 attributions cleaned;
      **12 named a script that does not exist** (11 retired by py2ts, 1 by the
      `scripts/` move). `_lib/generated_by.ts` emits a command or a module name
      and THROWS on a path separator. Sweep: 0 hits over 1,257 files, count
      reported on the green path.
- [x] **1.5 Carry the discipline on the agent side, not only in a command.**
      A path named by an instruction file is a claim, not a fact — probe before
      routing on it, and say which source answered. [`missing-skill-recovery`](../../src/rules/missing-skill-recovery.md)
      covers the mirror case — a **catalogue that under-reports** — and **does
      not cover this one**. An instruction file that **over-reports** is the
      opposite direction and is currently carried by nothing. Whether that rule
      is extended or a sibling is added is a placement decision to be made and
      recorded the same way 1.1 makes its own, not asserted here.
      verify: the placement is recorded with its reasoning; whichever artefact
      carries it states the over-reporting direction explicitly, and is
      reachable from the diagnostic's own output.


      **DONE.** New sibling rule `instruction-path-verification`. Council
      2026-08-26 verdict B, **DEGRADED 1/2** — anthropic returned `exit_1`, and
      the single-seat basis is recorded rather than presented as convergence:
      `agents/evidence/council/instruction-path-placement.md`. The diagnostic's
      `fail` message names the rule, so reachability runs both ways.
## Phase 2 — Configuration resolution follows the chain

**Anchor:** `extends` is a specified directive in TypeScript, ESLint, Biome and
Stylelint, with `includes` playing the same role in PHPStan and Rector;
`workspace:` is a documented protocol in npm, yarn, pnpm and bun; catalogued
dependency versions are a documented feature of pnpm and bun. All four are
published mechanisms with public specifications.

A root linter configuration in one tree is fourteen lines, of which the
load-bearing one is an `extends` into a package inside the same workspace; the
root TypeScript configuration is a single `extends` into another. Read
literally — which is what "derive standards from the real config" currently
does — both yield nothing, and an agent concludes the project has no standards
while the standards sit one hop away.

- [x] **2.1 Resolve `extends` / preset chains before digesting a config.**
      Follow the chain through relative paths and through workspace-package
      specifiers; report the resolved chain, and treat an unresolvable hop as a
      **named gap with a partial digest**, never as an absence of standards.
      verify: a fixture whose root config only extends a workspace package
      yields that package's rules in the digest; a fixture whose extends target
      is missing yields the hops that did resolve, plus the unresolved hop by
      name, and is reported as partial rather than complete.

      **DONE.** `_lib/config_chain.ts`, 11 fixtures. An external hop is
      labelled and excluded from the digest (risk rank 5). A real bug surfaced:
      an unresolvable hop carries `path: null` and was queued anyway, so the
      module crashed on exactly the partial-digest input it exists to handle.
- [x] **2.2 Treat per-workspace configuration as the config.** Where a
      repository carries linter, environment or deployment configuration per
      package rather than at the root, the file that governs an edit is the one
      nearest that edit. State the precedence explicitly.
      verify: a fixture with a root config and a differing per-package config
      returns the per-package one for a path inside that package.

      **DONE.** `nearestConfig` + the precedence stated explicitly in
      `standards-from-config`: nearest-first, and reading the root config for an
      edit inside a package that carries its own is a WRONG answer, not a coarse
      one. The outranked root candidate is reported too.
- [x] **2.3 Never invent a dependency version — and define invention.**
      **Invention** is writing a version string that no source in the repository
      produced. **Lookup failure** is having searched the declared version
      sources — catalogue, workspace protocol, existing manifests, lockfile —
      and found none. The two get opposite handling, and **only the first is
      forbidden**: on lookup failure, resolving the version from the registry or
      from the user is the correct move, not a violation — it is reported as
      unresolved-then-resolved with the source named. What the rule forbids is
      producing a version with no source and no report. Silence is the failure,
      never the fallback.
      verify: the supply-chain intake step names the version-source lookup as a
      precondition and distinguishes the two outcomes; a fixture manifest using
      a catalogue protocol is not rewritten to a literal, and a fixture with no
      version source produces an unresolved report rather than a guess.


      **DONE.** The definitional split is in `supply-chain-intake` as a
      precondition of the pin step: invention is forbidden, lookup failure is
      not, and silence is the failure rather than the fallback.
## Phase 3 — Framework families have a third state

**Anchor:** component-based distribution is a published model — a framework
family that ships its ORM, container, collections and HTTP layer as
independently installable packages, usable with no framework present. PHP has
at least two such families distributed exactly this way; the shape is a
property of the distribution model, not of any consumer.

One tree runs a PHP application on framework *components* with **no
framework**: a custom entry point, a custom router, and no framework CLI.
Dependency-presence routing sends this to that framework's skill, which then
offers a CLI that does not exist, a request-validation primitive that is not
wired, and a routes file that was never there.

- [x] **3.1 Detect the application shape from the entry point and the router,
      not from the dependency list.** A dependency proves a library is
      available; only the entry point and the routing mechanism prove which
      application shape is in play. Add the third verdict —
      *components-without-the-framework* — and route it away from the
      framework skill.
      verify: a fixture carrying the framework's ORM and container but a custom
      entry point and no framework CLI resolves to the third verdict, and the
      framework-routing rules do not claim it.

      **DONE.** `src/install/detect_php_shape.ts`, 17 fixtures. Ordering IS the
      discriminator: a family resolves only when a skeleton marker exists.
      Sabotaging it to follow the dependency list reds 4 tests.
- [x] **3.2 Make the two framework-routing rules state the discriminator they
      actually use.** Both currently read as dependency-flavour tests. Name the
      entry-point-and-router discriminator in each, specified as a small fixed
      set of file probes with a stated cost, so it is cheap enough to actually
      run and not re-derived per session.
      verify: both rules name the discriminator and its probe set; a fixture
      prompt in the third state routes to neither.


      **DONE.** Both Iron Laws name the discriminator; both skills carry the
      probe table and its cost (8 probes, `PROBE_PATHS` exported). The two stub
      ceilings were raised 126→135 and 129→139 through the `history` path the
      gate itself names, after compressing the clause twice.
## Phase 4 — Working inside a repository that is half-migrated

**Anchor:** incremental replacement of a legacy system alongside the system it
replaces is a named, published migration pattern, and the server-composed
bootstrap payload of 4.2 is a documented mechanism in several mainstream
frameworks — each ships its own named channel for serialising server state into
the page for a client island. 4.3 has no such anchor and says so.

The mixed tree is roughly two-fifths namespaced, strict-typed, PSR-shaped code
and three-fifths an older include-and-dispatch module system, with the two
meeting **inside single files**: a strict-typed, namespaced service importing
non-namespaced global singletons. Current guidance says to respect existing
patterns and to keep diffs minimal, but nothing produces the artefact that
makes either decidable — a per-path verdict on which half a file belongs to.

**The overfitting trap in this phase, named so the implementer cannot miss it:**
4.2 and 4.3 were each noticed in exactly one tree. What may be encoded is the
**question** — which fields are exposed, does a mechanism already exist. What
may never be encoded is the *particular* mechanism that tree happened to use.
A step here that names a concrete implementation shape has failed, whatever its
tests say.

- [x] **4.1 Produce a legacy/modern boundary map before applying modern
      idioms.** Per path: which conventions hold there, what the neighbouring
      files actually do, and whether a modern idiom is an improvement or a
      foreign body. The verdict is per path, never per repository.
      A **mixed** verdict is not a refusal to decide: it
      carries which convention governs which region of the file, and which of
      the two an edit at a given point must follow. A verdict that says only
      "mixed" leaves the caller exactly where it started.
      verify: run it against a fixture with both halves; every path gets a
      verdict, a file mixing both is reported as mixed rather than assigned to
      one side, and the mixed verdict names the governing convention per region
      rather than for the file as a whole.

      **DONE.** `_lib/legacy_boundary_map.ts`, 9 fixtures. A mixed file reports
      which convention governs which REGION by line range, and
      `conventionAt(verdict, line)` answers what an edit at a point must follow.
- [x] **4.2 Add the server-composed bootstrap payload to the render-security
      surface, and state plainly that nothing enforces the judgement.** A payload assembled
      server-side and serialised into the page for a client island is a
      data-exposure surface: whatever is put in it is readable by anyone who can
      load the page. The question — *should this field be
      here* — is not decidable by any check: a grep over the framework-named
      payload channels cannot tell a privileged field from a public one. So this
      step ships **discovery, not enforcement**, and the two halves are labelled
      as such. A diff-scoped grep over those channels, advisory and
      non-blocking, **locates** a payload a field was added to; a checklist entry
      in the render-security skill carries the **judgement**, model-carried like
      every other obligation of that class. Neither half refuses anything, and
      the step must not be written as though one did — `enforced_by: none` is the
      honest field, and the value of the deterministic half is that it puts the
      question in front of a reader who would otherwise never see it.
      verify: the checklist names the pattern and the per-field question; the
      gate is registered in the gate coverage registry with its scanned count,
      and a fixture adding a privileged field to a payload channel is flagged
      while a fixture touching an unrelated file is not.

      **DONE, as discovery and not enforcement.** The grep locates, the
      checklist judges, `enforced_by: none` is stated. Adding it turned the
      skill's linter red (`missing_analysis_before_action`) and the fix was the
      analysis step the section actually needs, not wording around the check.
- [x] **4.3 Discover the repository's own mechanism before adding one.**
      **anchor-pending** — the generality bar's second test is not met: the only
      instance recorded is one tree's feature-flag mechanism, and "a repository
      may already have a mechanism" is a truism rather than an anchored shape.
      Do not build this until a second, independent, external instance is
      recorded here. If the second instance never arrives, the step is deleted
      rather than downgraded — that outcome is a success of the bar, not a gap.
      verify: this step stays unbuilt while its anchor line is empty; a change
      that implements it while the anchor is still empty is the violation.


      **UNBUILT — which is this step's verify, met.** *"this step stays unbuilt
      while its anchor line is empty"*. No second independent external instance
      was recorded, so the anchor is still empty and nothing was built. The bar
      biting is the outcome, not a gap.
## Phase 5 — Honesty at the repository boundary

**Anchor:** a package published to a registry and consumed by another
repository, and an API described by a shared contract, are the two standard
ways a product spans repositories. Both make an exported surface a public
mechanism rather than an in-house arrangement.

Three repositories form one product: one publishes a component package the
second consumes, and the third serves the API both call. The downstream-changes
discipline greps one tree and reports completeness, which is true of that tree
and false of the product. Separately, two of the three trees override the
**same three shipped skills**.

**What that override observation is, and is not.** It is n=2 from one
organisation — below this roadmap's own generality bar, and therefore **not a
basis for changing any shipped default**. 5.2 builds the channel that would
make such a signal readable across independent consumers; it does not act on
the observation that prompted it. Changing those three skills now, on the
strength of two same-culture installs, is precisely how this package would
become one organisation's house style, and no step here authorises it.

- [x] **5.1 State the repository boundary in the downstream sweep.** When a
      changed surface is exported beyond the repository — a published package, a
      served API, a shared schema — say that the sweep stopped at the tree edge
      and name the consumers it could not check. Completeness claimed over one
      tree of a multi-tree product is the failure.
      verify: the sweep's output names the boundary when an exported surface is
      touched, and does not when nothing is exported.

      **DONE.** `downstream-changes` § the sweep stops at the tree edge, plus
      verification step 7. It does not fire on a purely internal refactor.
- [x] **5.2 Make a repeated override readable, and wire it to a flow that
      exists.** The same artefact overridden in independent installs is the
      cheapest available signal that a shipped default is wrong. Define the
      signal as artefact identity and a count only, with **no field capable of
      holding a path, a diff, or consumer content** — the shape the existing
      telemetry floor uses. Wire it into a flow a consumer already runs: the
      diagnostic from Phase 1 reports the local override set, and the existing
      upstream-contribution path is where an aggregate becomes a proposal. A
      mechanism with no flow is a mechanism nobody runs.
      verify: the signal type has no free-form field; the Phase 1 diagnostic
      reports the local override set; a fixture with one artefact overridden
      twice produces the signal while a single override does not.

      **DONE.** `collectOverrideSet` / `repeatedOverrides`, reported by
      `doctor --check override-set` and consumed by `upstream-contribute`. The
      signal's exact key set is asserted by a test — `kind`, `name`, `layers`
      and nothing else.
- [x] **5.3 Hold the line on the observation that prompted 5.2.** No shipped
      default is changed on the strength of the three overrides recorded in the
      Source above, and no follow-up change may cite them as evidence for a
      default change. They are admissible only as one input to an aggregate that
      clears the generality bar.
      verify: the three artefacts are named here so a later change citing them
      is visible in review; a diff changing any of their defaults with this
      roadmap as its stated justification is the violation.


      **HONEST NULL on the naming half, DONE on the substance.** The step wants
      the three overridden artifacts "named here". They are named NOWHERE in
      this roadmap — it records the count and not the identities — so no list
      exists for a later change to be checked against, and saying so is the only
      honest close. The substance shipped: no shipped default changes on n=2
      from one organisation, as an Iron Law in `upstream-contribute`.
## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Findings drawn from three trees of one organisation are read as universal | product | Three repositories share a toolchain culture, a package manager preference and one team's habits. A shape that looks like a class here may be one team's convention, and building a gate for it costs every other consumer. Expressibility as a fixture does not separate the two — an in-house convention is equally expressible. | The generality bar requires a named public ecosystem mechanism per shape in addition to fixture-expressibility, each phase cites its anchor, and a shape with only an in-house instance is marked anchor-pending and left unbuilt — 4.3 is marked that way rather than promoted, which is the bar demonstrating it bites. | The generality bar |
| 2 | The house style is exported through the override observation | product | Two same-culture installs overriding the same three skills is n=2, and the temptation to "just fix the defaults, we already know" converts a discovery channel into a mandate. | 5.3 forbids it explicitly, names the three artefacts so a later citing change is visible in review, and 5.2 builds a cross-consumer channel instead of acting on the observation. | Phase 5 — Honesty at the repository boundary |
| 3 | An eighth parallel diagnostic is built next to seven existing ones | implementation | The tree already carries a doctor family. A new top-level verb that re-answers what `settings:check` or `packs:active` already answer adds a second source of truth about the install and drifts from the installer that wrote it. | 1.1 makes placement a recorded decision produced by an enumeration of the existing verbs, before any code; the residual question is named, and composition is the precedent `routing:doctor` already set. | Phase 1 — The map is not the territory: install integrity |
| 4 | The install diagnostic reports failures that are its own | implementation | A checker that parses instruction files can misparse a path and report a healthy install as broken, which is worse than not checking. | It resolves paths against the filesystem and reports three outcomes, not two: present, dangling, and unresolvable-for-a-stated-reason. A path it cannot interpret is never reported as absent, and the parse failure is attributed to the checker in its own output. | Phase 1 — The map is not the territory: install integrity |
| 5 | Config-chain resolution follows a chain out of the repository and digests someone else's rules as the project's | implementation | An `extends` chain can leave the repository entirely; presenting a third-party preset as the project's own standard is worse than reporting nothing. | The resolved chain is reported with each hop's origin, and a hop leaving the repository is labelled external rather than merged into the project digest. | Phase 2 — Configuration resolution follows the chain |
| 6 | Phase 4 encodes one tree's concrete mechanism as the pattern | product | 4.2 and 4.3 were each observed once. Encoding the particular payload channel or flag mechanism seen there would ship one repository's implementation as guidance. | The phase states the trap in its own body, restricts what may be encoded to the question rather than the mechanism, and anchors 4.2 on framework-named channels rather than on the observed one; 4.3 is anchor-pending and unbuilt. | Phase 4 — Working inside a repository that is half-migrated |
| 7 | The third framework state is added but never fires, because the discriminator is expensive to evaluate | implementation | Entry-point-and-router detection is more work than reading a dependency list, and a check skipped under time pressure is not a check. | 3.2 specifies the discriminator as a small fixed set of file probes with a stated cost, and its fixture asserts the third verdict on a tree that would otherwise route to the framework. | Phase 3 — Framework families have a third state |
| 8 | The override signal collects something about a consumer's tree | product | Any mechanism reading consumer installs is a privacy surface, and this package's floor forbids carrying consumer content. | 5.2 specifies the signal as artefact identity and a count, with no field capable of holding a path, a diff or consumer content — enforced by the type's shape rather than by a scrubbing pass. | Phase 5 — Honesty at the repository boundary |

## Acceptance Criteria

- [x] AC-0 — Every built step cites a named public ecosystem mechanism as its
      anchor, and every step whose only instance is in-house is either
      anchor-pending and unbuilt, or deleted. No step is built on
      fixture-expressibility alone.

      **Met.** Every built phase cites a public mechanism (root-instruction-file
      convention and manifest/lockfile drift; `extends`/`includes` and
      `workspace:`/catalogues; component-based distribution; incremental
      replacement and framework-named bootstrap channels; registry packages and
      contract-described APIs). 4.3 is anchor-pending and unbuilt.
- [x] AC-1 — A consumer install whose root instruction file names a layer that
      is not present is reported as such, and the report names the dangling
      paths rather than the fact that something is wrong. A path the checker
      cannot interpret is reported as unresolvable, never as absent.

      **Met.** 26 fixtures, including three named after measured false
      positives, and an `unresolvable` path is never reported as absent.
- [x] AC-2 — A project whose real standards sit behind an `extends` chain,
      including a chain into a workspace package, yields those standards. Where
      a hop cannot be resolved, the result is a partial digest naming the
      unresolved hop; returning nothing for a chain that partly resolved is not
      reachable for that shape.

      **Met.** A chain into a workspace package yields that package's rules; a
      missing hop yields the resolved hops plus the unresolved one by name, and
      a test asserts the digest is never empty for a chain that partly resolved.
- [x] AC-3 — A PHP application built from framework components with a custom
      entry point and no framework CLI resolves to a third verdict, and neither
      framework-routing rule claims it.

      **Met.** The canonical fixture resolves to `components-without-framework`,
      and both routing rules state that they do not claim it.
- [x] AC-4 — A half-migrated repository yields a per-path legacy/modern verdict,
      and a file containing both halves is reported as mixed rather than
      assigned to one side.

      **Met.** Per-path verdicts, and a file containing both halves is `mixed`
      with per-region governance rather than assigned to one side.
- [x] AC-5 — A downstream sweep over a repository that exports a surface names
      the boundary it stopped at; over a repository that exports nothing, it
      does not.

      **Met.** Both directions are stated in the rule: named on an exported
      surface, and explicitly not fired on a purely internal refactor.
- [x] AC-6 — No shipped default was changed on the strength of the override
      observation recorded in the Source, and the aggregate channel exists and
      is reachable from a flow a consumer already runs.


      **Met.** No shipped default was changed. The channel exists
      (`doctor --check override-set`) and is reachable from a flow a consumer
      already runs, with the admissibility bar stated in `upstream-contribute`.