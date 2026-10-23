<!-- evidence-type: analysis -->
# Code-graph providers — baseline and readings, 2026-10-23

> `road-to-graph-providers-for-every-stack` 0.2, 3.5, 5.1, 7.1 and 7.2. Built at
> `main@4502d328f` before any code moved, with `code-graph build --force` and
> `code-graph map --no-verify` on three trees. Two full runs produced identical bytes.

## Trees

| Tree | What it is |
|---|---|
| this repository | the agent-config working tree at the pin |
| Fixture L | the MIT Laravel application pinned in `road-to-a-map-that-draws-itself`, at `045c6a98cac2` |
| synthetic | five files: a TypeScript package with `main` / `bin`, a Python module pair, one HTML template |

## Baseline checksums (SHA-256, first 16 hex)

| Tree | graph.json | map.json | MAP.md |
|---|---|---|---|
| this repository | `9595fc48a4e687ac` | `8da87b86b6c51dc5` | `7c84fb96c14e8b3e` |
| Fixture L | `884ac13eed081cd4` | `43cba985d3852183` | `18b3422667576c95` |
| synthetic | `b36b3f4e23f4d686` | `4758f8372cd83ad7` | `bb5fe0c80b919222` |

## Baseline readings

"Unconnected" counts file nodes with no stated, cross-file edge (member edges and the guess
mechanisms `name-lookup`, `dynamic`, `foreign` excluded). The definition is this file's own;
it reads 11.5 % on Fixture L where the source plan reported 11.3 % under a slightly different
counting rule.

| Tree | Files | Unconnected | Routes | Routes resolved | Edges |
|---|---|---|---|---|---|
| this repository | 10,452 | 1,890 (18.1 %) | 0 | 0 | 226,306 |
| Fixture L | 2,235 | 256 (11.5 %) | 340 | 340 | 104,062 |
| synthetic | 5 | 0 (0 %) | 0 | 0 | 11 |
