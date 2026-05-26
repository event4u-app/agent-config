# Telegraph Carve-out Fixtures — Phase 8.4 / 8.4b

Locked carve-out contract for the [`telegraph-speak`](../../../.agent-src.uncondensed/rules/telegraph-speak.md)
rule. Each fixture pairs an input prose block with the regex that
identifies the carve-out region and the expected set of lines that
must survive byte-for-byte after telegraph condensation.

**Scope split** — `tests/golden/outcomes/` is the locked **outcome
baseline** layer (Iron-Law shape checks; scaling-gated). This
directory is the **carve-out preservation** layer (regex correctness
on protected regions). Different layer, different test runner — keeps
the outcomes/ scope pure.

## Layout

| File | Class |
|---|---|
| `numbered-options.json` | `^>?\s*\d+\.\s` lines + `**Recommendation:**` / `**Empfehlung:**` label |
| `iron-law-literal.json` | Triple-backtick ALL-CAPS fences |
| `code-block.json` | Triple-backtick fenced code (any language) |
| `error-marker.json` | Lines prefixed `❌`, `⚠️`, `✅` |
| `fuzz_inputs.py` | Fuzz fixture — 20 randomly-generated combinations |

## Schema

```json
{
  "name": "<class-id>",
  "carve_out_class": "<long name>",
  "input": "<multiline prose with carve-out regions>",
  "carve_out_regex": "<regex matching protected lines>",
  "expected_preserved_lines": ["...", "..."]
}
```

## CI runner

`tests/test_telegraph_carveouts.py` — stdlib-only validator that
applies `carve_out_regex` to `input` and asserts the matched-line set
equals `expected_preserved_lines`. Fuzz fixture generates 20
combinations and asserts every carve-out region survives the
identification pass unchanged.

## Acceptance

Failure here means the rule's documented enforcement mechanism
(snapshot → rewrite → validate → restore) cannot reliably identify
the protected regions, which means telegraph condensation is unsafe to
ship.
