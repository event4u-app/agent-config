---
complexity: structural
status: ready
estate_offset_exempt: >-
  Nothing in the estate covers the consumer-install surface this measures; the
  three findings classes it opens have no existing roadmap to merge into, and
  archiving an unrelated file to pay for it would be an accounting move, not a
  drawdown.
estate_growth_exempt: "This roadmap opens a surface the estate does not cover — the installed state of this package inside a consumer tree — and the findings behind it were measured, not assumed. No active roadmap covers it, and closing an unrelated one to make room would trade a real drawdown for an accounting one."
execution:
  mode: phase-checkpoints
---
# Road to consumer-repo reality

> **Source:** a three-pass reading of three first-party repositories that
> install this package — a framework-based PHP API, a JS/TS monorepo with a
> component library and workshops, and a mixed legacy/modern PHP+React
> application. Each pass re-entered the repositories carrying the previous
> pass's conclusions. Every finding below is a **class** observed in a real
> installed tree, deliberately stripped of the repositories' identity: what is
> planned here must hold for any consumer with the same shape.

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

The sharpest finding, because it is silent and it was present in two of the
three trees. A root instruction file listed an agent layer — rules, skills,
guidelines — under a path that **did not exist in the tree**. In one repository
the entire layer was absent while the file still described it; in another the
layer existed but two of its four advertised directories did not. Nothing
detects this. An agent reads the root file, believes the layer is there, and
routes on names it can never load. A third repository carried no agent surface
at all while sitting inside the same product boundary as the other two.

The same trees show the version axis of the identical defect: a committed
project settings file pinning a version several majors behind the installed
projection, under a **settings filename this package no longer reads**, while a
generated artifact in that tree still cites a generator script in a language
this package has not shipped for generations. Three independent staleness
signals, none of them surfaced.

- [ ] **1.1 Add an install-integrity verb that resolves every path a root
      instruction file names.** Parse the root instruction files (`AGENTS.md`,
      the Copilot instructions file, any per-tool root file), extract every
      repository-relative path they point at, and report each as present or
      dangling. This is the check that would have caught all three trees.
      verify: a fixture consumer whose root file names one existing and one
      absent directory exits non-zero and names exactly the absent one; a
      fixture whose paths all resolve exits zero.
- [ ] **1.2 Report the version axis as a three-way comparison.** Pinned version
      (from whichever settings file the consumer actually carries, legacy
      filenames included), installed-projection version, and the version the
      resolver would pick now — printed together, with legacy settings paths
      named as legacy rather than ignored.
      verify: a fixture carrying only the legacy settings filename is read, not
      skipped, and its pin is reported alongside a differing installed version.
- [ ] **1.3 Stop generated artifacts from hard-coding their generator's path.**
      A generated file that names the script that wrote it becomes a lie the
      moment that script moves. Emit a stable, resolvable reference instead.
      verify: grep the generated-artifact templates for a literal script path;
      zero matches, and the count is reported so a future addition is visible.
- [ ] **1.4 Carry the discipline on the agent side, not only in a command.**
      A path named by an instruction file is a claim, not a fact — probe before
      routing on it, and say which source answered. Extend the existing
      missing-skill recovery discipline, which already covers a catalogue that
      under-reports, to cover an instruction file that over-reports.
      verify: the rule or skill that carries this states the probe explicitly
      and is reachable from the install-integrity verb's own output.

## Phase 2 — Configuration resolution follows the chain

A root linter configuration in one tree is fourteen lines, of which the
load-bearing one is an `extends` into a package inside the same workspace; the
root TypeScript configuration is a single `extends` into another. Read
literally — which is what "derive standards from the real config" currently
does — both yield nothing, and an agent concludes the project has no standards
while the standards sit one hop away. The same tree keeps dependency versions
in a single root catalogue that workspace packages reference by protocol rather
than by literal version, and pins every one of them exactly.

- [ ] **2.1 Resolve `extends` / preset chains before digesting a config.**
      Follow the chain through relative paths and through workspace-package
      specifiers; report the resolved chain, and treat an unresolvable hop as a
      named gap rather than as an absence of standards.
      verify: a fixture whose root config only extends a workspace package
      yields the workspace package's rules in the digest, and a fixture whose
      extends target is missing reports the unresolved hop by name.
- [ ] **2.2 Treat per-workspace configuration as the config.** Where a
      repository carries linter, environment or deployment configuration per
      package rather than at the root, the file that governs an edit is the one
      nearest that edit. State the precedence explicitly.
      verify: a fixture with a root config and a differing per-package config
      returns the per-package one for a path inside that package.
- [ ] **2.3 Never invent a dependency version.** Before adding a dependency,
      find the repository's version source of truth — a catalogue, a workspace
      protocol, a lockfile-pinned convention — and use it. A literal version
      string written into a package manifest that references a catalogue
      everywhere else is a silent convention break.
      verify: the supply-chain intake step names the version-source lookup as a
      precondition, and a fixture manifest using a catalogue protocol is not
      rewritten to a literal.

## Phase 3 — Framework families have a third state

One tree runs a PHP application on framework *components* — the ORM, the
container, the collections, the HTTP layer — with **no framework**: a custom
entry point, a custom router, and no framework CLI. Dependency-presence routing
sends this to that framework's skill, which then offers a CLI that does not
exist, a request-validation primitive that is not wired, and a routes file that
was never there. The same failure is available in the other direction for any
component-based framework family.

- [ ] **3.1 Detect the application shape from the entry point and the router,
      not from the dependency list.** A dependency proves a library is
      available; only the entry point and the routing mechanism prove which
      application shape is in play. Add the third verdict —
      *components-without-the-framework* — and route it away from the
      framework skill.
      verify: a fixture carrying the framework's ORM and container but a custom
      entry point and no framework CLI resolves to the third verdict, and the
      framework-routing rules do not claim it.
- [ ] **3.2 Make the two framework-routing rules state the discriminator they
      actually use.** Both currently read as dependency-flavour tests. Name the
      entry-point-and-router discriminator in each, so the third state is not
      re-derived per session.
      verify: both rules name the discriminator, and a fixture prompt in the
      third state routes to neither.

## Phase 4 — Working inside a repository that is half-migrated

The mixed tree is roughly two-fifths namespaced, strict-typed, PSR-shaped code
and three-fifths an older include-and-dispatch module system, with the two
meeting **inside single files**: a strict-typed, namespaced service importing
non-namespaced global singletons. Current guidance says to respect existing
patterns and to keep diffs minimal, but nothing produces the artefact that
makes either decidable — a per-path verdict on which half a file belongs to.
The same tree hands a server-composed bootstrap payload to a client-side island
and gates behaviour through a repository-local feature-flag mechanism that no
generic flag skill knows about.

- [ ] **4.1 Produce a legacy/modern boundary map before applying modern
      idioms.** Per path: which conventions hold there, what the neighbouring
      files actually do, and whether a modern idiom is an improvement or a
      foreign body. The verdict is per path, never per repository.
      verify: run it against a fixture with both halves; every path gets a
      verdict, and a file mixing both is reported as mixed rather than assigned
      to one side.
- [ ] **4.2 Add the server-composed bootstrap payload to the render-security
      surface.** A payload assembled server-side and serialised into the page
      for a client island is a data-exposure surface: whatever is put in it is
      readable by anyone who can load the page, including fields nobody meant
      to expose. Name it, with the check.
      verify: the render-security checklist names the pattern and states the
      per-field question; a fixture payload carrying a privileged field is
      flagged.
- [ ] **4.3 Discover the repository's own mechanism before adding one.**
      Feature flags, dispatch whitelists, permission checks: a repository that
      already has a mechanism does not want a second one. Make "find the
      existing mechanism" a step, not an assumption.
      verify: the step is stated in the relevant skills and names how the
      lookup is done, not merely that it should happen.

## Phase 5 — Honesty at the repository boundary

Three repositories form one product: one publishes a component package the
second consumes, and the third serves the API both call. The downstream-changes
discipline greps one tree and reports completeness, which is true of that tree
and false of the product. Separately, two of the three trees override the
**same three shipped skills** — a signal that those skills' defaults are wrong
for a whole class of consumer, and a signal nothing currently reads.

- [ ] **5.1 State the repository boundary in the downstream sweep.** When a
      changed surface is exported beyond the repository — a published package,
      a served API, a shared schema — say that the sweep stopped at the tree
      edge and name the consumers it could not check. Completeness claimed over
      one tree of a multi-tree product is the failure.
      verify: the sweep's output names the boundary when an exported surface is
      touched, and does not when nothing is exported.
- [ ] **5.2 Read a repeated override as evidence about the shipped default.**
      The same skill overridden in independent consumer installs is the
      cheapest available signal that the default is wrong. Define how that
      signal is collected and where it lands, without collecting anything about
      the consumers themselves.
      verify: the mechanism is specified with its privacy floor stated, and a
      fixture with one skill overridden twice produces the signal while a
      single override does not.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Findings drawn from three trees of one organisation are read as universal | product | Three repositories share a toolchain culture, a package manager preference and one team's habits. A shape that looks like a class here may be one team's convention, and building a gate for it costs every other consumer. | Each phase names the shape, never the repository, and its verify step is a fixture rather than the observed tree — a finding that cannot be expressed as a fixture is not general enough to build. | Phase 1 — The map is not the territory: install integrity |
| 2 | The install-integrity verb becomes a second source of truth about the install | implementation | A checker that parses instruction files can drift from the installer that wrote them, and then reports failures that are its own. | The verb resolves paths against the filesystem only, and claims nothing the filesystem cannot answer; where it cannot resolve, it reports unresolved rather than absent. | Phase 1 — The map is not the territory: install integrity |
| 3 | Config-chain resolution silently follows a chain into a dependency and digests someone else's rules as the project's | implementation | An `extends` chain can leave the repository entirely; presenting a third-party preset as the project's own standard is worse than reporting nothing. | The resolved chain is reported with each hop's origin, and a hop leaving the repository is labelled as external rather than merged into the project digest. | Phase 2 — Configuration resolution follows the chain |
| 4 | The third framework state is added but never fires, because the discriminator is expensive to evaluate | implementation | Entry-point-and-router detection is more work than reading a dependency list, and a check that is skipped under time pressure is not a check. | The discriminator is specified as a small fixed set of file probes with a stated cost, and its fixture asserts the third verdict on a tree that would otherwise route to the framework. | Phase 3 — Framework families have a third state |
| 5 | The override signal collects something about a consumer's tree | product | Any mechanism that reads consumer installs is a privacy surface, and the package's own floor forbids carrying consumer content. | 5.2 specifies the signal as artefact identity and a count only, with no field capable of holding a path, a diff or consumer content — the same shape the existing telemetry floor uses. | Phase 5 — Honesty at the repository boundary |

## Acceptance Criteria

- [ ] AC-1 — A consumer install whose root instruction file names a layer that
      is not present is reported as such by a command, and the report names the
      dangling paths rather than the fact that something is wrong.
- [ ] AC-2 — A project whose real standards sit behind an `extends` chain,
      including a chain into a workspace package, yields those standards; the
      previous behaviour of returning nothing is not reachable for that shape.
- [ ] AC-3 — A PHP application built from framework components with a custom
      entry point and no framework CLI resolves to a third verdict, and neither
      framework-routing rule claims it.
- [ ] AC-4 — A half-migrated repository yields a per-path legacy/modern verdict,
      and a file containing both halves is reported as mixed rather than
      assigned to one side.
- [ ] AC-5 — A downstream sweep over a repository that exports a surface names
      the boundary it stopped at; over a repository that exports nothing, it
      does not.
