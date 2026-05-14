---
stability: beta
---

# Settings-sync YAML subset

**Purpose.** Pin the YAML feature set that `.agent-settings.yml` and
`config/agent-settings.template.yml` may use, so contributors can cite a
contract instead of inferring it from
[`scripts/sync_yaml_rt.py`](../../scripts/sync_yaml_rt.py) source. The
sync engine ([ADR](adr-settings-sync-engine.md)) is a custom stdlib-only
round-trip parser/emitter; staying inside the subset below is what
keeps user-line preservation (every byte of every user line round-trips
unchanged unless the merger explicitly edits the key).

Authoritative source: this document. The module docstring of
`sync_yaml_rt.py` mirrors it; on drift, this file wins and the docstring
is corrected to match.

## Supported

### Document shape

- One YAML document per file. No `---` or `...` document separators.
- UTF-8. CRLF and LF line endings — both accepted, preserved per-line.

### Mappings (sections)

- Block-style mappings only (`key: value` on its own line).
- Indent: 2- or 4-space, **no tabs** in indent.
- Nested mappings unlimited in depth (the template uses 3 levels —
  e.g. `chat_history.archive.cleanup_after_days`).
- Duplicate keys at the same level: **last wins** (the later line
  carries the value; the earlier entry is replaced).

### Scalars (values)

- Bare scalars: `enabled`, `42`, `true`, `~`, `null`, `None`.
- Single-quoted strings: `'literal text'`.
- Double-quoted strings: `"literal text"`.
- Bools, ints, `~` / `null` / `None` are kept **verbatim** — the
  parser does not normalise `True` → `true` or `null` → `~`.

### Lists (sequences of scalars)

- Block-style lists:
  ```yaml
  allowlist:
    - foo
    - bar
  ```
  Indent inside the list must be consistent.
- Inline-flow lists, **flat only**: `[a, b, c]`.
- List items are scalars only. Nested mappings inside a list item are
  **not** supported (see below).

### Comments and blank lines

- `#`-comments — full-line and inline (`key: value  # comment`). Both
  preserved verbatim, including leading whitespace and the gap before
  `#`.
- Blank lines preserved verbatim — the engine never collapses them.

## Not supported (parser raises `ValueError` with a line number)

The following YAML features are out of contract. A user file that uses
any of them surfaces as `ValueError` from `scripts/sync_yaml_rt.py:sync`,
which `scripts/sync_agent_settings.py` catches and reports as **exit
code 2** with a line-numbered message.

- **Anchors and aliases** — `&name`, `*name`.
- **Multi-document streams** — `---` / `...` separators.
- **Nested flow mappings** — `key: {nested: value}` inline. Block-style
  nested mappings are fine; flow-style nested mappings are not.
- **Nested mappings inside list items** — `- name: foo` followed by
  indented children. Lists hold scalars only.
- **Complex keys** — `? [composite, key]: value`.
- **Tagged scalars** — `!!str 42`, `!Custom value`.
- **Multiline scalar styles** — `|` (literal) and `>` (folded) block
  scalars.
- **Tabs in indent** — even one tab character in indent.
- **Mixed indent inside a block** — every child of a parent must share
  the same indent.

Pinned by `tests/test_sync_round_trip.py` (34 tests) — every
not-supported feature has at least one fixture that asserts the
`ValueError` message.

## Test pinning

- Verbatim round-trip: `tests/test_sync_round_trip.py::test_user_block_round_trip_is_idempotent`, `::test_three_level_idempotent`.
- Out-of-subset rejection: same file, fixtures under
  `tests/fixtures/sync_yaml_rt/` named `bad_*.yml`.
- CLI exit code on malformed input:
  `tests/test_sync_agent_settings.py::test_malformed_user_yaml_exits_2_with_message`.

Any parser change is gated on those tests staying green. New fixtures
for new features land under `tests/fixtures/sync_yaml_rt/`.

## Why this subset (and why it is fixed)

The driving requirement from
[`layered-settings`](../guidelines/agent-infra/layered-settings.md) is
**verbatim user-line preservation**. `ruamel.yaml` and PyYAML both
re-emit through their own emitters, which normalises whitespace,
quoting, and blank-line placement. A stdlib parser limited to this
subset gives byte-identity across two consecutive syncs — the property
the merger relies on for additive insertion.

Out-of-subset YAML therefore is not a parser bug; it is a contract
violation by the user file. The friendly `ValueError` and exit code 2
are the contract's failure surface.

## Revisit triggers

This subset is **fixed** until one of the
[ADR revisit triggers](adr-settings-sync-engine.md#revisit-triggers)
fires — namely:

1. `.agent-settings.yml` schema gains a YAML feature outside the subset
   (anchors, multi-doc, complex keys, nested flow mappings) — the cost
   of extending the parser exceeds the cost of adopting `ruamel.yaml`.
2. The verbatim-preservation contract is relaxed — the driver for the
   custom parser is gone.
3. The 0-dep posture for Python tooling is dropped at the package level
   — the marginal cost of one more dep collapses.
4. A maintenance bug surfaces in the engine that ruamel's mature spec
   coverage would have prevented.

A new ADR (with successor link) is required to change the subset; this
document is updated in the same commit.

## See also

- [`docs/contracts/adr-settings-sync-engine.md`](adr-settings-sync-engine.md) — decision record for the stdlib-only engine.
- [`docs/guidelines/agent-infra/layered-settings.md`](../guidelines/agent-infra/layered-settings.md) § Sync rules — the additive-merge-with-user-line-preservation contract this subset implements.
- [`scripts/sync_yaml_rt.py`](../../scripts/sync_yaml_rt.py) — implementation; module docstring mirrors this file.
- [`scripts/sync_agent_settings.py`](../../scripts/sync_agent_settings.py) — CLI driver and exit-code contract.
