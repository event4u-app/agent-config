# Vendored tree-sitter grammars

Compiled WebAssembly grammars for the native code-graph engine
(`src/scripts/code_graph/`). They are vendored — carried in this repository and
published inside the npm tarball — so that a consumer who runs
`npm install @event4u/agent-config` can build a code graph on the next command
with no manual parser install (ADR-259).

## Why vendored rather than a dependency

`tree-sitter-wasms` carries 36 grammars (49 MiB on disk). Depending on it at
runtime would hand every consumer all 36, which is the option ADR-259 §
Alternatives rejects on exactly that measurement. Only the three grammars below
are loadable by the engine — `GRAMMAR_WASM` in `src/scripts/code_graph/types.ts`
has three entries — so the other 33 would be payload with no reader.

**No grammar is ever fetched at runtime** (Kill register K1). These files are in
the tarball; the loader reads them from disk.

## The set

| Language | File | SHA-256 |
|---|---|---|
| php | `tree-sitter-php.wasm` | `55bb617b6f01e14bab997861f0b20a2420cf6ba3199ffeb295b9ec398966d8a3` |
| typescript (also serves `.tsx`) | `tree-sitter-typescript.wasm` | `8515404dceed38e1ed86aa34b09fcf3379fff1b4ff9dd3967bcd6d1eb5ac3d8f` |
| javascript | `tree-sitter-javascript.wasm` | `63812b9e275d26851264734868d27a1656bd44a2ef6eb3e85e6b03728c595ab5` |

All three are built against **grammar ABI 14** (`EXPECTED_GRAMMAR_ABI` in
`src/scripts/code_graph/types.ts`). The loader asserts the ABI on every load, so
a drifted grammar fails loudly rather than parsing wrongly.

## Provenance

Copied byte-for-byte from `tree-sitter-wasms@0.1.13`
(<https://github.com/Gregoor/tree-sitter-wasms>, Unlicense), which compiles them
from the upstream `tree-sitter/tree-sitter-{php,typescript,javascript}` grammars
(MIT). The compiled artifacts are derivatives of the MIT grammar sources, so
they are annotated MIT in `REUSE.toml` and credited in `CREDITS.md`.

`tree-sitter-wasms` remains a **devDependency**: it is the source these copies
are refreshed from, and the ABI smoke test in `tests/scripts/code_graph.test.ts`
runs against it. It is deliberately not a runtime dependency.

## Refreshing

The pair is ABI-coupled and must move together:

```bash
npm i -D web-tree-sitter@<v> tree-sitter-wasms@<v>
for g in php typescript javascript; do
  cp node_modules/tree-sitter-wasms/out/tree-sitter-$g.wasm src/vendor/grammars/
done
shasum -a 256 src/vendor/grammars/*.wasm   # update the table above
```

Then update, in the same change:

- the three `BINARY_PAYLOAD_EXCEPTIONS` entries in `src/scripts/check_pack_size.ts`
  (they are path-and-size-bound, so any size change invalidates them by design);
- `EXPECTED_GRAMMAR_ABI` in `src/scripts/code_graph/types.ts` if the ABI moved;
- the install-size line in `MIGRATION.md`.
