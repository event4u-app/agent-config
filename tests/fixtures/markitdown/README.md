# markitdown smoke-test fixtures

Tiny hand-crafted fixtures for the `markitdown` skill (peer-side install,
upstream `markitdown-mcp@0.0.1a4`). All three files are generated locally
with **Python stdlib only** — no `reportlab`, `python-docx`, or
`python-pptx` dependency. This keeps the package's cognition-only floor
intact (no runtime / dev libraries for non-text formats).

| Fixture | Bytes | Purpose |
|---|---|---|
| `sample.pdf` | ~500 | Minimal valid PDF 1.4 with a single text-bearing page. |
| `sample.docx` | ~2 KB | Minimal Office Open XML WordprocessingML document. |
| `sample.pptx` | ~3 KB | Minimal Office Open XML PresentationML deck (one slide). |

## Regeneration

The fixtures are committed under version control. To regenerate them
(after a corruption or a deliberate content change), run the generator
script that was used to produce them:

```bash
python3 tests/fixtures/markitdown/_generate.py
```

The generator uses only `zipfile` from the Python stdlib and produces
byte-identical output for the same inputs.

## Smoke test (manual, peer-side)

Once `markitdown-mcp` is installed peer-side per the skill's Step 1:

```bash
docker run --rm -i -v "$(pwd)/tests/fixtures/markitdown:/workdir:ro" \
  markitdown-mcp:latest
# In the MCP client UI:
#   convert_to_markdown("file:///workdir/sample.pdf")
#   convert_to_markdown("file:///workdir/sample.docx")
#   convert_to_markdown("file:///workdir/sample.pptx")
```

Each call MUST return non-empty Markdown containing at least one heading
or paragraph derived from the fixture's body text.

## What these fixtures do NOT cover

- Token-saving measurement (Phase 2 of `road-to-markitdown-adoption.md`
  ships a richer corpus under `tests/fixtures/markitdown-corpus/`).
- DOCX revision history, PPTX presenter notes, XLSX formulas — the
  Step 3 mitigations need real-world fixtures the consumer supplies.
- OCR / audio paths — those plugins are out-of-scope for the smoke test.
