---
stability: beta
---

# ADR — Settings sync engine: stdlib-only round-trip

> **Status:** Decided · 2026-05-04
> **Context:** Additive Settings Sync roadmap — review round 2
> (Self-Review + AI Council, Anthropic + OpenAI) flagged the
> 735-line `scripts/sync_yaml_rt.py` as potential NIH burden vs.
> adopting `ruamel.yaml` as a third-party dependency.
> **Builds on:** [`docs/guidelines/agent-infra/layered-settings.md`](../guidelines/agent-infra/layered-settings.md)
> § Sync rules — defines the additive-merge-with-user-line-preservation
> contract this engine implements.

## Decision

`.agent-settings.yml` synchronization uses a **custom, stdlib-only
round-trip parser + emitter** in [`scripts/sync_yaml_rt.py`](../../scripts/sync_yaml_rt.py),
not `ruamel.yaml` or any other third-party YAML library.

The engine implements a narrow YAML subset (block-mappings, scalars,
flow-list values, comments, CRLF/LF) that covers the full surface of
`.agent-settings.yml` plus its template (`config/agent-settings.template.yml`).
Out-of-subset YAML — anchors, aliases, multi-document streams, complex
keys, nested flow mappings — is **not supported** and raises `ValueError`.

The merge layer (additive walk, max-index insertion, scalar→section
guard, healer for legacy `_user._user.foo` corruption, EOL
normalization) sits on top of the parser and is custom regardless of
the parser choice.

## Why this was a real question

Three options were on the table:

1. **`ruamel.yaml` for parse + emit, custom merge on top.** Rejected.
2. **`PyYAML` for parse, custom emitter for round-trip.** Rejected
   earlier in the roadmap — PyYAML's parser drops comments and
   formatting before the merger ever sees them.
3. **Custom stdlib-only parser + emitter + merger.** Chosen.

### Why ruamel.yaml does not match the contract

The driving requirement from `layered-settings.md` is **verbatim
user-line preservation** — every byte of every line in the user's
file is preserved unless that line carries a key the merger is
explicitly editing. Tests pin this contract by asserting byte-identity
across two consecutive sync runs (`test_user_block_round_trip_is_idempotent`,
`test_three_level_idempotent`).

`ruamel.yaml` is a round-trip-aware library, not a verbatim one — it
re-parses into an in-memory model and **re-emits** through its own
emitter. This re-emit normalizes:

| Behavior | ruamel.yaml | Custom engine |
|---|---|---|
| User-line bytes (whitespace, quoting, blanks) | re-emitted, may shift | preserved 1:1 |
| Mixed CRLF/LF in user file | normalized to one EOL (typically platform default) | detected + normalized to the user's predominant EOL |
| `personal: null` blocking template-section injection | requires custom merge logic regardless | scalar guard in `_merge_into` |
| Legacy `_user._user.foo.bar` healer (one-off migration) | requires custom logic regardless | `heal_user_block` |
| Synthetic header rendering for newly-inserted template keys | re-emits the entire file | only renders the new subtree |
| Unknown user blocks at top level | preserved as data, but indent / quoting may shift on emit | preserved verbatim |
| 3rd-party dependency in distribution package | +1 (`ruamel.yaml` + transitive `ruamel.yaml.clib`) | 0 |

The rows where the libraries diverge are exactly the rows the test
suite asserts on.

### Cost analysis

| Axis | Custom engine | ruamel.yaml |
|---|---|---|
| Lines of code | 735 (engine) + 335 (merge/heal) = 1070 | ~400 (parser+emitter saved) + 335 (merge/heal stays) + adapter glue = ~735 |
| Net code saved | — | ~335 lines |
| 3rd-party deps | 0 | +2 (`ruamel.yaml`, `ruamel.yaml.clib`) |
| Runtime YAML surface | narrow (documented subset) | full YAML 1.2 |
| Verbatim guarantee | yes | no |
| Performance | irrelevant — cold-path, runs on profile change | irrelevant |

The 335-line saving is real but offset by a stronger contract (verbatim)
and a 0-dep posture. The package is a distribution-layer library
(`composer.json` `type: library`, `package.json` thin manifest); it
already restricts itself to stdlib for portability across consumer
projects, several of which lock Python deps tightly.

## Consequences

- **Maintenance:** the engine must keep covering the YAML subset its
  template + user files exercise. Any new template feature (e.g. a
  block-style nested list) is a parser change, not a config change.
- **Error surface:** YAML outside the subset (anchors, complex keys)
  surfaces as a friendly `ValueError` from `_rt.sync()`, caught by
  `sync_agent_settings.main` and turned into exit code 2 with a
  user-readable message. Documented in
  `tests/test_sync_agent_settings.py::test_malformed_user_yaml_exits_2_with_message`.
- **Test debt:** `tests/test_sync_round_trip.py` (34 tests) and
  `tests/test_sync_agent_settings.py` (15 tests) are the contract.
  Any parser change must keep those green and is the entry point
  for new fixtures under `tests/fixtures/sync_yaml_rt/`.

## Revisit triggers

This decision is revisited (new ADR with successor link) when **any**
of the following holds:

1. `.agent-settings.yml` schema gains a YAML feature outside the
   supported subset (anchors, multi-doc, complex keys, nested flow
   mappings) — the cost of extending the parser exceeds the cost of
   adopting ruamel.
2. The verbatim-preservation contract is relaxed (e.g. consumers
   accept that sync can re-format) — the driver for the custom engine
   is gone.
3. The 0-dep posture for Python tooling is dropped at the package level
   — the marginal cost of one more dep collapses.
4. A maintenance bug surfaces in the engine that would have been
   prevented by ruamel's mature spec coverage.

## See also

- [`docs/guidelines/agent-infra/layered-settings.md`](../guidelines/agent-infra/layered-settings.md)
  § Sync rules — the contract this engine implements.
- [`scripts/sync_yaml_rt.py`](../../scripts/sync_yaml_rt.py) module
  docstring — the supported YAML subset, listed exhaustively.
- `tests/test_sync_round_trip.py` — verbatim, scalar-guard, healer,
  CRLF, and synthetic-header pinning.
- `tests/test_sync_agent_settings.py` — CLI integration, profile
  override, malformed-input exit code.
