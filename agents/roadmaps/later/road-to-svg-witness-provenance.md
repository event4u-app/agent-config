---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner-requested follow-up (2026-10-12) for the three design limits the 16.5.0 release review recorded as accepted risk. No active roadmap owns the SVG witness any more — road-to-svg-review-followups and road-to-svg-from-a-live-session are archived — so there is nothing to merge into; parking was rejected because every phase is executable today; it lands as a draft, so the count half reads +0 and only the one-in-one-out half needs this claim."
# relates: swept agents/roadmaps/*.md for svg, witness, manifest, turn-end gate on 2026-10-12 — no active roadmap owns these surfaces.
relates: []
---
# Road to svg witness provenance

> **Source:** the 16.5.0 release review, run three times through the Claude CLI
> because CI's self-review had no API credit. Rounds one and two were fixed on
> `main` in #2305 and #2307. Round three's two real gaps were fixed in the PR
> that adds this file. Three findings remain, and the owner chose to ship them as
> accepted risk with this roadmap as the durable answer:
> `1dc7d5c013e5` and `01536ef6db6a` (manifest-forgery detection is a command
> pattern list) and `3b21e612b3ae` (a declared delivery mode is trusted
> unverified). The 16.5.0 release findings ledger, committed with that
> release, carries all three with their dispositions.
>
> **Fold into `road-to-type-with-a-witness` declined 2026-10-16** (council
> 2/2, `agents/evidence/council/intake-folds-2026-10-16.md`): shared use of the
> asset render witness is not shared ownership.

## Goal

The blocking SVG turn-end obligation is discharged only by a render the hook
itself saw succeed. No command pattern list stands in for that observation.
A declared `img` / `css-bg` delivery mode downgrades a safety finding only
when the project actually delivers the file that way. A namespace prefix is
resolved by its in-scope binding, not by a document-wide list.

## Context

- **Today's gate reads the transcript.** `svg_obligation.ts` accepts a
  digest-matching manifest when a standalone `ui:render --profile asset` naming
  the file ran after the edit. It voids the manifests when a recognised write
  touched the render directory. The header states the residual: an omission
  check, not an attestation. Any write route the pattern list does not know
  (an unlisted interpreter, a script file, indirection through a variable)
  forges a manifest unseen.
- **What a hook can see that a transcript cannot.** A `post_tool_use` hook
  receives the finished tool call, including its exit status. It can record
  "render of `<file>` exited 0 and left a manifest with digest `<d>`" at the
  moment the render finished. A later write changes the manifest's bytes and
  no longer matches the recorded digest.
- **Delivery mode.** `lint_svg_asset --delivery img` grades
  `svg-safety-active-content` as `inert`, and nothing checks that the file is
  reached through `<img>` or a CSS background.
- **Namespaces.** `svgPrefixes()` collects every `xmlns:p` bound to SVG across
  the whole document. A prefix re-bound to a foreign namespace inside a subtree
  is still read as SVG, which over-reports on the safety side and is not a
  bypass.
- **Out of scope here:** restoring CI's own self-review (an API credit or a
  CLI seat on the runner) is an owner action on the repository settings, not a
  code change.

## Phase 1 — The render is observed, not inferred

- [x] **1.1 Record successful asset renders from a `post_tool_use` concern.**
      For a Bash call that is a standalone `ui:render --profile asset` and exited
      0, write `{file, file digest, manifest path, manifest digest}` to a hook
      state file, keyed by session.
      verify: a vitest case feeding the concern a successful and a failed render
      payload records exactly one entry; the failed one records none.
      Correction (2026-10-14, against the tree): "exited 0" alone would have
      locked out every consumer without Playwright — `ui:render --profile asset`
      exits 3 (`EXIT_RENDERER_ABSENT`) on that path, and its manifest is the
      static witness the gate's `static-only` discharge reads. The recorder
      therefore records exit 0 or 3; exit 1 records nothing. It is not a new
      concern either: the existing `verify-before-complete` recorder already
      sees every finished Bash call with its exit, so the record is an
      `asset_renders` field in that state (turn-scoped), written by
      `src/scripts/_lib/asset_render_record.ts`. "Standalone" is the positive
      `isPureRender` shape, which fails closed, so a render chained to a write
      records nothing. Done in `tests/scripts/svg_render_record.test.ts`.
- [x] **1.2 Discharge only on a recorded render.** `readSvgObligations` accepts
      a manifest only when its current bytes hash to a digest recorded in 1.1
      for that file after the file's last edit. The command-pattern write
      detection (`writesRenderDir`, `isPureRender` as a gate input) is removed.
      verify: the forged-manifest cases in
      `tests/scripts/turn_end_gate_svg_render.test.ts` (tool write, redirect,
      `cd`, interpreter, unlisted interpreter, script file) all stay open with
      no pattern list; a real recorded render discharges.
      Correction (2026-10-14): `writesRenderDir` is not deleted. Step 1.3 keeps
      the transcript rule as the fallback on hosts with no live recorder, and
      removing its write detection there would only weaken those hosts. On the
      record path neither it nor `isPureRender` is a gate input. On that path
      a manifest discharges only through a recorded render, so the write
      route of a forgery never needs recognising; what a recorded render could
      be fooled by — a rewritten manifest, earlier bytes, an argument the shell
      rewrites, a leftover manifest for another target — is pinned in
      `tests/scripts/svg_render_record.test.ts`, and the existing transcript
      cases keep pinning the fallback. A render whose exit the host does not
      report is an instrument gap and sends the gate to the fallback.
- [x] **1.3 State the host reach honestly.** Where `post_tool_use` is not bound
      (`agent-config hooks:status`), the gate falls back to the transcript rule
      and says so in its reason.
      verify: a test with no recorded entry and a matching manifest reports the
      fallback reason verbatim.

## Phase 2 — A declared delivery mode is checked against the project

- [ ] **2.1 Find how the project delivers the file.** Search the project's
      markup and stylesheets for references to the asset: `<img src>`,
      `background-image: url()`, inline `<svg>` includes, framework imports.
      verify: fixture projects for each delivery shape return the expected mode;
      an unreferenced file returns `unknown`.
- [ ] **2.2 Grade by the stricter of declared and observed.** `inert` applies
      only when every observed delivery is `img` or `css-bg`. `unknown` or any
      inline delivery grades as inline, with the reason naming the reference.
      verify: a vitest case declaring delivery img for a file the fixture
      project also inlines reports svg-safety-active-content as an error and
      names that inline reference.

## Phase 3 — Prefixes resolve by scope

- [ ] **3.1 Resolve each element's namespace from its in-scope bindings.** Use
      the `svg_dom` tree, not a document-wide set, and accept a prefixed root
      in the structure and name rules when its prefix is bound to SVG.
      verify: a vitest case where a subtree re-binds an SVG prefix to a foreign
      namespace reports no active content for the prefixed script there, and a
      prefixed root carrying its own SVG binding draws no missing-xmlns finding.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Hook reach | implementation | On a host without a bound `post_tool_use` slot nothing is recorded, so the obligation could never be discharged and a blocking gate would refuse honest work | Step 1.3 keeps the transcript rule as a named fallback on exactly those hosts | Phase 1 — The render is observed, not inferred |
| 2 | Delivery search misses a framework's reference shape | implementation | An import the search does not recognise reads as `unknown` and grades inline, which over-reports | Over-reporting is the safe direction; every miss becomes a fixture in 2.1 | Phase 2 — A declared delivery mode is checked against the project |

## Acceptance Criteria

- [ ] AC-1 — A manifest written by any route other than an observed successful
      render discharges no SVG obligation, and the gate contains no command
      pattern list for write detection.
      Note (2026-10-14): met on every host whose `post_tool_use` recorder is
      live. As written it contradicts step 1.3, which keeps the transcript rule
      — pattern list included — as the named fallback where no recorder runs;
      the restatement "on a host whose recorder is live" is the reading this
      roadmap's own steps support, and is left for the closing review to
      confirm rather than ticked here.
- [ ] AC-2 — `svg-safety-active-content` is graded `inert` only for a file the
      project demonstrably delivers through `<img>` or a CSS background.
- [ ] AC-3 — A namespace prefix is resolved by its in-scope binding in both the
      safety and the structure rules.
