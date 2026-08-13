# Findings: feat-design-system-onramp
<!-- completion-review: v1 | reviewed: 2026-08-13 | scope: 55676112b012535c808019d8771d490dda0dbc60569689f85f10a2bb941cec90 | diff: d6ffea46a32a3683b83d72315cdf83cefa61fbe5 | reviewer: r2-fresh-subagent-feat-design-system-onramp | prompt_hash: 01dc4a92f49c945d6ba077d657eb997ec259ca437fae583fba8a07e8aab2fdf3 -->

<!-- context-manifest: v1
inputs:
  diff_sha: d6ffea46a32a3683b83d72315cdf83cefa61fbe5
  scope_hash: 55676112b012535c808019d8771d490dda0dbc60569689f85f10a2bb941cec90
  roadmap: agents/roadmaps/road-to-design-system-onramp.md
  roadmap_hash: 29e9c42bccf3853da8addc4a83b9db50c383b28f2631d9c08e867fed60d53afe
  ac_hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-13T08:55:44Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | docs/CLAIMS.md:217 | `command-count` was hand-edited 196 to 200 but `docs/proof.md` was not regenerated, so the branch ships two red gates. Verified: `check_artefact_count_messaging` exits 1 with "docs/proof.md:54: commands says 196, expected 200", and `build_proof --check` reports "docs/proof.md is stale". Both are green on `origin/main` (CLAIMS 196 + proof 196 + canonical 196), so this branch introduces them. proof.md is GENERATED from CLAIMS.md by `src/scripts/build_proof.ts`; the remedy is `./scripts-run src/scripts/build_proof`, NOT the `update_counts` the count gate's own failure message names, because `update_counts --check` is already green and cannot write that un-anchored position. | fixed | c5cb07529 |
| 2 | high | src/scripts/_lib/design_system_import.ts:373 | DTCG role naming still collapses same-named roles across layers, losing a token silently while reporting success. Probe: input `semantic.color.background` = #ffffff plus `component.card.background` = #eeeeee returns `ok: true`, `colors.light` = `{background: "#eeeeee"}` and `notes: []` — the first value is gone with no note and no `_meta` entry. `roleName` only disambiguates a numeric or bucket-naming FINAL segment, so two leaves whose last segment matches still overwrite. This is the primitive/semantic/component layering the shipped `dtcg.tokens.json` fixture itself uses, and it realizes the roadmap's own Risk 3 ("a token import that quietly loses the motion block looks like a successful run"). Phase 1 Step 1 records role collisions as resolved. | fixed | ed4c7e39a |
| 3 | medium | src/scripts/_lib/design_system_import.ts:378 | The `-default` strip takes the bucket as the parent instead of the component, so it produces a degenerate role AND still collides. Probe: `roleName(['button','radius','default'])` returns `radius`, not the `button-radius` the function's own doc-comment promises; importing `button.radius.default` = 4px plus `card.radius.default` = 12px yields `radius: {radius: "12px"}` with `notes: []` — the button value is lost and the surviving role is named after the bucket. Cause: `${parent}-${last}` is joined before `.replace(/-default$/i, '')` runs, so for a 3-segment path the parent is the bucket segment. | fixed | ed4c7e39a |
| 4 | medium | src/scripts/_lib/design_system_import.ts:626 | The dembrandt borders fallback emits non-radius values AS radius tokens and drops the real radius data. Probe: `borders: {radius: ["4px","8px"], width: "1px", style: "solid"}` returns `radius: {width: "1px", style: "solid"}` while the actual radius list is dropped with no note, and width/style are simultaneously duplicated into `_meta.borders`. Cause: `stringMap(borders['radius']) ?? stringMap(borders)` falls through to the whole borders object whenever `borders.radius` is not a string map. The fallback should be reachable only when `borders` carries no `radius` key. Breaks the module's own stated invariant at line 526-530 ("Nothing is coerced into a token, and nothing is dropped in silence"). | fixed | ed4c7e39a |
| 5 | medium | src/scripts/_lib/design_system_import.ts:444 | The DTCG lane treats ANY path segment named `dark` as the dark theme, with no note. Probe: `color.neutral.dark` = #222222 returns `colors.dark` = `{dark: "#222222"}` and `notes: []`, so a palette shade or a semantic role named `dark` (`text.dark`, `neutral.dark`) is filed as a theme rather than a value. `isDark` is a path inference of exactly the kind the sibling dembrandt lane does flag (line 558 emits a note for its semantic-map-as-light inference); the DTCG lane emits none, so the human confirming per field is never told an inference was made. | fixed | ed4c7e39a |
| 6 | medium | src/scripts/_lib/design_system_import.ts:217 | `stringMap` and `stringList` return a PARTIAL result and discard every non-conforming entry silently, contradicting the module's "nothing is dropped in silence" contract. Probe: `colors: {primary: "#533afd", scales: {blue: {"500": "#00f"}}}` returns `colors.light` = `{primary: "#533afd"}` with `notes: []` and no `_meta` capture — the nested subtree is gone. Because the helper returns non-null, the caller's else-branch that would have routed the value to `_meta` never runs. This affects every dembrandt bucket that uses these helpers (colors, spacing, borders, shadows, motion durations and easings). | fixed | ed4c7e39a |
| 7 | low | src/scripts/_lib/design_system_import.ts:663 | Motion content outside the five-key observation whitelist is dropped with no note. Probe: `motion: {durations: {fast: "150ms"}, easings: {standard: {value: "cubic-bezier(0,0,1,1)"}}, transitions: {a: "b"}}` returns only `motion.durations` with `notes: []` — the unrecognised `easings` shape and the whole `transitions` key vanish. The "motion present in an unrecognised shape" guard cannot fire because `out.motion` is already defined by the durations that did map. | fixed | ed4c7e39a |
| 8 | low | src/scripts/_lib/design_system_import.ts:303 | The native lane's `_meta.unmapped` merge clobbers a pre-existing `_meta.unmapped`. Probe: a native artifact carrying `_meta: {unmapped: {keep: "me"}}` plus one new off-contract key returns `_meta.unmapped` = `{offContract: 1}` only; `keep` is silently lost. The spread `{...existingMeta, unmapped}` overwrites the key rather than merging into it, in the one lane whose whole contract is that values are carried verbatim. Reachable by re-importing this adapter's own output when a further off-contract key is present. | fixed | ed4c7e39a |
| 9 | low | src/scripts/_lib/design_system_import.ts:727 | The components-as-object branch emits an empty `props` array and drops the value when entries are scalars. Probe: `components: {button: "observed once"}` returns `components: [{name: "button", observed: {props: []}}]` — the string is discarded with no note, and an empty `observed.props` is emitted where the sibling array branch (line 719-724) deliberately omits absent keys. | fixed | ed4c7e39a |
| 10 | low | src/skills/design-system-capture/references/design-system-json.md:83 | The compatibility table states the dtcg lane "Buckets by `$type`, never by group path", which the code contradicts: `dtcgBucket` (line 325-347) resolves `dimension` and `number` by path substring for radius/fontSize/spacing, and the light-vs-dark split is decided by path segment. The module's own docstring concedes this ("the PATH breaks the tie, and only for that one type"). The claim misleads in a way that matters: a reader expects `component.button.paddingX` to bucket by its `dimension` type, whereas the shipped `dtcg.expected.json` correctly shows it landing in `_meta.unmapped` because its path matches no keyword. | fixed | 49b6e4741 |
| 11 | low | src/domains/analysis-workbench/analyze/command.md:8 | Three diff lines are unrelated to this roadmap and unrecorded anywhere: `analyze-conformance` is added to `routes_to`, to the dispatch table, and to `src/flows/surface-map.yaml:40`. Verified against `origin/main`: `analyze/conformance/command.md` exists there but appears in neither `routes_to` nor the surface map, and `lint_command_flow_coverage` requires full classification (it reports "200 commands fully classified"), so this is most likely a pre-existing red the branch had to clear rather than gratuitous scope. Either reading leaves the same defect — no roadmap step, cluster-table row, or step note accounts for the lines, so a reviewer reading the roadmap cannot trace them to the task. | fixed | 49b6e4741 |
| 12 | low | src/scripts/design_system_import.ts:143 | Provenance flags are discarded silently in two cases. `--captured-at` given without `--source-kind`/`--source-ref` is accepted and then ignored, because the override object is only built when both of the latter are present. And when the input already carries a valid `source`, an explicit caller override is dropped without a note. Probe: forcing the dtcg lane on a file whose `source.ref` is "from-file" while passing a caller override returns the file's block with `provenance_origin: "input"` — defensible precedence, but the user who typed the flags is never told they had no effect. | fixed | ed4c7e39a |

## Fix pass

All 12 findings fixed and the artefact re-bound in place to the post-fix scope
(contract §2.7). Which commit closed what:

- **Finding 1** — `c5cb07529` *fix(docs): regenerate proof.md after the
  command-count change*. `build_proof` re-run; `check_artefact_count_messaging`
  and `build_proof --check` both green.
- **Findings 2–9 and 12** — `ed4c7e39a` *fix(scripts): close nine silent-loss
  paths in the design-system import adapter*. Collisions resolved at assignment
  rather than by naming; `default` dropped before joining; the borders fallback
  narrowed to the no-`radius`-key case; the dark-by-path inference surfaced;
  `stringMap`/`stringList` report what they could not take; motion residue kept,
  per-key rather than per-lane; native `_meta.unmapped` merged;
  components-as-object aligned with the array branch; two CLI provenance flags
  no longer accepted-and-ignored.
- **Findings 10 and 11** — `49b6e4741` *docs(design-system): correct two claims
  the review showed were too broad*. The "never by group path" claim replaced
  with the two stated path exceptions; the `analyze:conformance` lines given
  their own roadmap section; two roadmap step-notes corrected where the review
  falsified them.

**Two corrections the review forced on claims this branch had already written**,
recorded because they are the durable part:

1. Phase 1 Step 1 recorded role collisions as resolved. Widening the role *name*
   fixed the two shapes the author had in mind and left the general case open —
   and the general case is the layering the branch's own fixture uses. The fix
   had to move from naming to assignment.
2. The 36 fixture tests passed over every one of these nine data-loss paths. A
   fixture matrix proves the mappings it encodes and nothing about the shapes it
   does not reach; the nine probes are now regression tests (48 total).

**One finding was found by writing the regression test, not by the review.** The
motion-residue fix initially skipped a key whenever *either* motion bucket had
mapped, so an unreadable `easings` shape still vanished when `durations`
succeeded. The test asserted the reviewer's stated expectation and failed against
the first fix.
