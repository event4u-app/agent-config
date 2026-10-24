# Vendored tree-sitter grammars

Compiled WebAssembly grammars for the native code-graph engine
(`src/scripts/code_graph/`). They are vendored — carried in this repository and
published inside the npm tarball — so that a consumer who runs
`npm install @event4u/agent-config` can build a code graph on the next command
with no manual parser install (ADR-259).

## Why vendored rather than a dependency

`tree-sitter-wasms` carries 36 grammars (49 MiB on disk). Depending on it at
runtime would hand every consumer all 36, which is the option ADR-259 §
Alternatives rejects on exactly that measurement. Only the seven grammars below
are loadable by the engine — `GRAMMAR_WASM` in `src/scripts/code_graph/types.ts`
has seven entries — so the other 29 would be payload with no reader. Vue needs no
grammar of its own: the extractor blanks a component's template and parses its
`<script>` with the TypeScript grammar.

**No grammar is ever fetched at runtime** (Kill register K1). These files are in
the tarball; the loader reads them from disk.

## The set

| Language | File | SHA-256 |
|---|---|---|
| php | `tree-sitter-php.wasm` | `55bb617b6f01e14bab997861f0b20a2420cf6ba3199ffeb295b9ec398966d8a3` |
| typescript (also serves `.tsx`) | `tree-sitter-typescript.wasm` | `8515404dceed38e1ed86aa34b09fcf3379fff1b4ff9dd3967bcd6d1eb5ac3d8f` |
| javascript | `tree-sitter-javascript.wasm` | `63812b9e275d26851264734868d27a1656bd44a2ef6eb3e85e6b03728c595ab5` |
| python | `tree-sitter-python.wasm` | `9056d0fb0c337810d019fae350e8167786119da98f0f282aceae7ab89ee8253b` |
| go | `tree-sitter-go.wasm` | `9963ca89b616eaf04b08a43bc1fb0f07b85395bec313330851f1f1ead2f755b6` |
| java | `tree-sitter-java.wasm` | `637aac4415fb39a211a4f4292d63c66b5ce9c32fa2cd35464af4f681d91b9a1f` |
| csharp | `tree-sitter-c_sharp.wasm` | `6266a7e32d68a3459104d994dc848df15d5672b0ea8e86d327274b694f8e6991` |

All seven are built against **grammar ABI 14** (`EXPECTED_GRAMMAR_ABI` in
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

## Verification

Two checks, and they answer different questions.

`src/config/packed-binary-manifest.json` plus `_lib/packed_binary_predicate.ts`
verify that these bytes are what the manifest says they are — eleven conditions,
all of them re-derived from the bytes. Every one of them reads the manifest, so
a commit that edits a row and its file together satisfies all eleven.

`_lib/vendored_grammar_upstream.ts` verifies that these bytes are what the
**locked upstream** says they are: it byte-compares each file against
`node_modules/tree-sitter-wasms/out/`, after asserting that the installed
version is the one `package-lock.json` pins. An absent or unlocked upstream is a
refusal, never a pass. It is exercised by
`tests/scripts/vendored_grammar_upstream.test.ts`, which also drives every
refusal path and a real mutated grammar to failure.

What neither check covers is a `package-lock.json` row pointing at a hostile
package; that is review's job, and `packed_binary_predicate.ts`'s docblock says
so in those words.

## Refreshing

The pair is ABI-coupled and must move together:

```bash
npm i -D web-tree-sitter@<v> tree-sitter-wasms@<v>
for g in php typescript javascript python go java c_sharp; do
  cp node_modules/tree-sitter-wasms/out/tree-sitter-$g.wasm src/vendor/grammars/
done
shasum -a 256 src/vendor/grammars/*.wasm   # update the table above
```

Then update, in the same change:

- the seven entries in `src/config/packed-binary-manifest.json` (they are
  path-, sha256- and size-bound, so any refresh invalidates them by design).
  This used to name `BINARY_PAYLOAD_EXCEPTIONS` in `src/scripts/check_pack_size.ts`,
  a constant that no longer exists — `grep -rn BINARY_PAYLOAD_EXCEPTIONS` returned
  this line and nothing else, so a refresher following it would have skipped the
  manifest and reddened the pack-size gate with no pointer to why;
- `EXPECTED_GRAMMAR_ABI` in `src/scripts/code_graph/types.ts` if the ABI moved;
- the install-size line in `MIGRATION.md`.
