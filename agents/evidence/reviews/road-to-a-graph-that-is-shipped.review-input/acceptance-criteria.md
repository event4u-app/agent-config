## Acceptance Criteria

- [x] AC-0 ADR-259 accepted; `package.json` carries the parser pair in `dependencies`.
      <!-- 2026-09-07, AS AMENDED. `web-tree-sitter@0.24.7` is in `dependencies`;
      `tree-sitter-wasms` deliberately is NOT, because the three loadable grammars are
      vendored instead and depending on the pack would deliver all 36 (49 MiB) — the
      outcome ADR-259's own Alternatives rejects. The criterion's INTENT (a consumer
      receives the engine) is met and verified end-to-end by AC-1; the amendment is
      recorded at ADR-259 § "Amendment — 2026-09-07 · vendored-wired-set". -->
- [x] AC-1 A fresh consumer install builds a graph with no manual step (1.1).
      <!-- 2026-09-07: real tarball, throwaway install, `code-graph build --root .` exit 0
      on a PHP+TS fixture — "4 files · 12 nodes · 15 edges, languages: php, typescript".
      `tree-sitter-wasms` absent from the consumer's node_modules. -->
- [x] AC-2 The nudge hook and its flag are gone; `code_graph_context` is in the manifest with
      per-host `enforced_by` resolved from the platform table (1.2).
      <!-- 2026-09-07: `grep -c code_graph_nudge` on the manifest (yaml and compiled json)
      → 0; `hooks.code_graph.enabled` → 0 in both settings templates;
      check_enforcement_coverage ratchet holds. -->
- [x] AC-3 Queries above 50k edges read SQLite through a per-node/per-edge API and parse no
      JSON (2.1); every edge carries `resolved_via` and `provider` (2.2).
      <!-- 2026-09-07: traced — zero `JSON.parse` calls on a 60k-edge `affected`, with the
      canonical JSON chmod 000 for the duration; 4.9 ms / 190.7 MB RSS against 9,809.6 ms /
      349.0 MB on the blob path. Both fields are REQUIRED on `CodeEdge`, so the type system
      enforces the second half at every construction site. -->
- [x] AC-4 `impact --diff`, `tests-for`, `dead` exist with golden fixtures;
      `regression_neighbourhood` reads the native graph (3.x).
      <!-- 2026-09-08. All four verbs are `code-graph` subcommands in
      `src/scripts/code_graph/verbs.ts` + `cli.ts`; `selectRegressionsFromCode` in
      `_lib/regression_neighbourhood.ts` neighbours over the native graph and
      `grep -c 'no index to select against'` on that file is 0.
      Golden fixtures: tests/scripts/code_graph_gate_verbs.test.ts → 23 passed (full-array
      `toStrictEqual` assertions over a graph built from a real PHP+TS tree, plus the CLI
      exit-code contract), tests/scripts/regression_neighbourhood.test.ts → 20 passed
      (13 pre-existing on the artefact path, all still green).
      The 2026-09-07 scoping note was right about the prerequisites and each was met:
      the `tests` relation landed as a BUILD-PASS derivation rather than extractor work
      (SCHEMA_VERSION 3 → 4, GRAPH_STORE_VERSION 3 → 4), and 3.3's entry-point problem was
      resolved by making `dead` REFUSE while a source is unreadable rather than by guessing
      — AI council 2/2, because the extractor records no exportedness and the Risk-Register
      rank-4 false "dead" is the failure that would follow from answering anyway. -->
- [x] AC-5 Five graph tools are in the MCP catalogue, taking it to 36, and emit telemetry;
      the install hint is pinned (4.x).
      <!-- 2026-09-08. `build_mcp_catalog --write --strict` → "36 tool(s)"; all five carry
      `implemented_on: ['stdio']`, so they are on the wire rather than documentation stubs.
      Telemetry asserted over the file the server writes
      (`agents/runtime/mcp-telemetry/calls.jsonl`) after dispatching all five through the
      real `ToolCache.dispatch`: one row each, `outcome: 'implemented'`.
      tests/scripts/mcp_graph_tools.test.ts → 8 passed. Install hint is
      `agent-config mcp-server`; `grep -c 'npx -y'` on the catalogue is 0 and
      `check_mcp_doc_drift` is green.
      PINNED IS NOT THE FORM THE STEP EXPECTED, and the substitution is recorded at 4.2
      rather than here: every `npx` shape is unusable — the pinned one is the literal string
      4.2's verify forbids, and the un-pinned one prompts and therefore hangs a
      non-interactive client start. The installed binary resolves no dist-tag at all, which
      serves the pin RATIONALE more directly than a pinned `npx` would, and its PATH
      assumption is stated in the catalogue description.
      Standing cost re-measured and recorded as a RISE: 3,886 → 4,876 payload tokens
      (`agents/evidence/metrics/mcp-tool-standing-cost.jsonl`, 2026-09-08 row). -->
- [x] AC-6 The v2 benchmark rerun after all phases is byte-identical on every class — this
      roadmap moved delivery, not measurement.
      <!-- DISCHARGED 2026-09-08, after all phases, at commit 9452f29b4.
      `internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-08.{md,json}`,
      written under `--report-stem` so the dated historical artifacts stay on disk (the
      overwrite hazard 2.2's note recorded).

      IDENTICAL, and measured rather than eyeballed: every metric field of the new JSON was
      compared against `code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.json` —
      `precision`, `recall`, `answered`, `verdict`, `delta_recall_pp`, `precision_ok`,
      `clean`, `macro_precision`, `macro_recall`, at every nesting depth. **126 metric
      fields on each side, 0 differences.**

        | class             | grep R | graph R | Δrecall | grep P | graph P | verdict |
        |-------------------|--------|---------|---------|--------|---------|---------|
        | callers           | 1      | 1       | +0      | 0.611  | 0.667   | TIE     |
        | transitive-impact | 0.611  | 0.611   | +0      | 1      | 1       | TIE     |
        | path-between      | 0.917  | 1       | +8.3    | 0.722  | 1       | TIE     |
        | references        | 1      | 1       | +0      | 0.722  | 1       | TIE     |

      macro (reported only): grep P 0.764 R 0.882 · graph P 0.917 R 0.903 ·
      `classes_won: []` · `classes_void: []` · in-domain negative controls clean 1/1 both
      arms · capability boundary grep recall 1, graph recall 0 (unanswerable by
      construction, no verdict derived).

      WHAT DID DIFFER, stated so "byte-identical" is not read wider than it is: the run
      date, the measured commit and the three root tree-hashes (this branch changed
      `src/scripts/code_graph`), `wall_ms` on every probe (510-563 ms → 708-767 ms on the
      graph arm), and `output_bytes` on the graph arm (e.g. callers 1,892 → 2,638). Timings
      are wall-clock on a different machine-state and were never a criterion. The
      output-bytes growth is real and attributable: the graph now carries 6,669 derived
      `tests` edges (3.2), so a `query`/`affected` answer over a symbol a test imports
      returns more lines. It changed no precision and no recall, which is exactly the claim
      AC-6 makes — the delivery moved and the measurement did not.

      Zero of four classes met the +10 pp bar, on this run as on the two before it. The
      skill's `No class is graph-first` sentence
      (`src/skills/code-intelligence/SKILL.md:164`) is byte-unchanged, per K5 and 4.3. -->
