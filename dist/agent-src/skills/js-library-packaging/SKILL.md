---
model_tier: medium
name: js-library-packaging
description: "Use when a JavaScript/TypeScript package is consumed by another package — exports map, peer vs. direct dependencies, files allow-list, and whether it should be built at all."
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# js-library-packaging

> **Pack placement.** `engineering-base`. The step asked for it to be *suggested by* the
> `react` and `typescript` packs, and the skill schema carries no `suggested_by` key — so the
> intent is recorded here rather than expressed in frontmatter that would fail validation.
> A React or TypeScript consumer receives this skill through `engineering-base`, which both
> of those packs require.

The JavaScript twin of [`composer-packages`](../composer-packages/SKILL.md). A component is
a file; a **library** is a package with a public surface, and that surface is declared in
`package.json` rather than inferred. Most of the failures below are silent at author time
and loud at the consumer's — which is why the surface is read, not assumed.

## The Iron Law

```
`react` AND `react-dom` ARE peerDependencies. NEVER dependencies.
`types` IS THE FIRST KEY OF EVERY CONDITIONS OBJECT.
DECIDE buildable-VS-source-consumed BEFORE WRITING THE EXPORTS MAP.
NEVER HAND-BUMP A VERSION.
```

## When to use

A package in the repository is imported by another package, or is about to be published:
an `exports` map is being written or changed, a hook fails at runtime with *"invalid hook
call"*, an install fails on a `workspace:` range, a release needs cutting, or the
buildable-vs-source question has not been answered yet.

## Procedure

1. **Answer buildable-vs-source-consumed FIRST.** It determines the exports map, the `files`
   list, and whether a build step exists at all — deciding it after writing the map means
   rewriting the map.
   - **Source of truth:** is the package published to a registry, or only consumed inside
     this workspace?
   - **Verify:** the exports targets all point into one of the two worlds (`src/` or the
     build directory), never a mix.
2. **Read the surface rather than asserting it.** Run the check below over the package root.
   - **Source of truth:** `package.json` — `exports`, `dependencies`, `peerDependencies`,
     `files`, `private`, `publishConfig`.
   - **Verify:** zero `error`-severity findings.
3. **Fix peer placement before anything else.** A library carrying `react` in
   `dependencies` gives the consumer a second copy of React.
   - **Verify:** `react` and `react-dom` appear under `peerDependencies` only.
4. **Order the conditions.** `types` first, then `import` / `require`.
   - **Verify:** the check reports no `types-not-first`.
5. **Cut the release through the repository's own mechanism** — never by editing a version
   field. See § Release.
   - **Verify:** the version change is produced by the tool the repository already carries.

## Read the surface

```
check_package_surface <library-root> [<library-root> …]
```

`scripts/check_package_surface.ts` beside this skill. Deterministic, JSON on stdout, no
network and no subprocess. It reports:

| Code | Severity | Why |
|---|---|---|
| `peer-as-dependency` | error | two copies of React in one tree break hooks at runtime, with a message that names neither package |
| `export-target-missing` | error | the manifest promises a file the package does not ship |
| `no-exports-map` | warn | `main`/`module` without `exports` — the entry point resolves by bundler convention, not by declaration |
| `types-not-first` | warn | conditions match in declaration order, so a later `types` is never seen and the package silently ships untyped |
| `workspace-range-publishable` | warn | a `workspace:` range does not resolve outside the workspace; published, the consumer's install fails |

**It classifies from the declared export targets, never from a directory name.** A package
directory called `ui-lib-vite` is not evidence about Vite, and one called `buildable` is not
evidence that anything builds. A **mixed** declaration is reported as `undeclared` rather
than resolved to a guess — declaring both is the ambiguity worth surfacing.

**What it does not do:** it never compiles and never runs a bundler, so it cannot tell you
the declared layout is producible. A checker that grew a parser would report compile errors
as packaging errors, and the two have different fixes.

## Buildable vs. source-consumed

| | source-consumed | buildable |
|---|---|---|
| exports point at | `src/` | the build directory |
| build step | none | one, and it must run before publish |
| `files` | not needed (nothing published) | the build directory, as an allow-list |
| `private` | `true` on a workspace-only package | absent; `publishConfig.access` set instead |
| cost | consumer compiles it | a build to maintain, and output that can go stale |

**Default to source-consumed inside a workspace.** A build step exists to serve publication;
adding one for a package nobody publishes is a maintenance cost with no consumer.

## Release

Read the repository, then take exactly one branch — **Class A**, per
[`standards-from-config`](../standards-from-config/SKILL.md): the config *is* the answer.

1. **`.changeset/` present → changesets.** Add a changeset describing the change and let the
   release job bump and publish. Never edit `version` by hand.
2. **A task runner with a release command (e.g. `nx release`) → that command.** It owns
   version, tag, and changelog together; splitting them by hand desynchronises them.
3. **Neither present → none configured.** **Propose** a mechanism and stop. Do not hand-bump:
   a manually edited version has no changelog entry and no tag, so the next release cannot
   tell what shipped.

A breaking change carries the `!` marker and the footer — see
[`conventional-commits-writing`](../conventional-commits-writing/SKILL.md). The marker is
what a release tool reads to decide the major bump, so omitting it publishes a breaking
change as a patch.

## Output format

1. State the classification (source-consumed / built surface / undeclared) and where it was
   read from.
2. List every `error` finding with its fix, then the warnings.
3. Name the release branch taken and the evidence in the repository for it.
4. Say explicitly what was not checked — buildability, types, runtime behaviour.

## Gotchas

- **"Invalid hook call" names neither package.** The developer sees a React error and looks
  at their component; the cause is a library shipping its own React. This is why peer
  placement is an error and not a warning.
- **Condition order is silent.** `{ "import": …, "types": … }` type-checks fine at author
  time and ships untyped to the consumer.
- **A stale build directory passes every metadata check.** The manifest points at files that
  exist; nothing says they match `src/`. Only a real build proves that.
- **`files` is an allow-list, not a deny-list.** Adding a directory to the package means
  adding it here, and forgetting is invisible until a consumer imports a missing path.
- **A `workspace:` range is not a version.** It resolves in the workspace and nowhere else.

## Do NOT

- Do NOT put `react` or `react-dom` in `dependencies`.
- Do NOT write an exports map before answering buildable-vs-source-consumed.
- Do NOT place `types` after `import` or `require`.
- Do NOT edit a `version` field by hand, in any of the three release branches.
- Do NOT claim the package builds because the check passed — it never ran a build.

## Security constraints

`scripts/check_package_surface.ts` is **read-only and offline by construction**, and the
constraint is worth stating because a packaging tool is a tempting place to lose it:

- **No network.** It never resolves a version, queries a registry, or checks whether a name
  is taken. Every verdict comes from the manifest in front of it.
- **No subprocess.** No package manager, no bundler, no compiler. It cannot install, build,
  or publish, so running it on an untrusted repository executes none of that repository's code
  — which a package manager's lifecycle scripts would.
- **No writes.** It reads `package.json` and tests path existence. It never edits a manifest,
  so it can never "fix" a version field, which is the one thing § Release forbids.
- **Paths come from the caller, targets from the manifest.** Export targets are resolved
  relative to the given root and used only for an existence test; nothing is read from them.

Widening any of these turns a metadata reader into something that runs a third party's code.
If a future check needs a build, it belongs in a separate integration test with its own
declared cost — never here.

## See also

- [`composer-packages`](../composer-packages/SKILL.md) — the PHP twin; same surface discipline, different manifest.
- [`standards-from-config`](../standards-from-config/SKILL.md) — the Class-A rule the § Release branch follows.
- [`conventional-commits-writing`](../conventional-commits-writing/SKILL.md) — the `!` marker a release tool reads.
- [`ui-component-architect`](../ui-component-architect/SKILL.md) — the component inside the library; this skill is the package around it.
