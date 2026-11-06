You are an independent source reader establishing ground truth for a code-navigation benchmark, at the level of individual edges.

Input: `{PACKET}` — a JSON list of items. Each has a registered `question` (with the target symbol in `probe` and its declaration in `declared_in`) and `candidate_files`, a pool assembled from several sources. The pool may contain files that do not reach the target and may miss files that do.

Subject source: `{SUBJECT_DIR}`. Read it with grep/rg, find, sed, cat. Ignore `vendor/`, `node_modules/`, `lang/`, `storage/`, `bootstrap/cache`, generated build output. Do NOT run any `code-graph` command, any script under `src/scripts/code_graph/`, or any graph or index builder. Do not modify the subject.

For every item, list the **edges** through which files reach the target. An edge says: a line in `from_file` calls, instantiates, extends, uses, renders, dispatches, routes to, or (for a test) requests a symbol or route that is declared at a line in `to_file`. Kinds:
`call` · `use` (type use, instantiation, inheritance, trait) · `route` (route file → controller action, or a test's HTTP request → route definition) · `component` (template usage of a component/directive → its definition) · `dispatch` (job/event/listener dispatch → handler) · `framework` (a framework convention that invokes the symbol: container binding, mutator, observer, middleware registration — name the convention in `note`).

Rules:
- Every edge must be visible at the two cited lines: `from_line` shows the usage, `to_line` shows the declaration of `to_symbol` (or the route definition).
- Chain edges until they reach the target declared at `declared_in`. The target's own file is reached at hop 0.
- Cover every candidate file you find a chain for, and add files outside the pool when you find chains for them. A candidate without any chain simply gets no edge; list it under `no_path` with one line why.
- Give the shortest chain you know for each file; extra edges are fine, missing ones are not.
- A question that states a hop limit still needs every edge on the way; the limit is applied later.

Write JSON to `{OUT}`:
`[{"id": "<item>", "target": {"file": "...", "line": N, "symbol": "..."}, "edges": [{"from_file": "...", "from_line": N, "to_symbol": "...", "to_file": "...", "to_line": N, "kind": "call|use|route|component|dispatch|framework", "note": "optional"}], "no_path": [{"path": "...", "reason": "..."}]}]`

Paths relative to the subject root. Reply with a short summary only (items, edge counts, anything you could not resolve).
