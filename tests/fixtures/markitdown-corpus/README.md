# markitdown-corpus

Measurement corpus for the `markitdown` skill. Lets a consumer ground the calibrated token-saving claim (3-5× / 10-50× / 1.5-2×) on their own machine, with their own peer-side `markitdown-mcp` install.

## Files

| File | Format | Profile |
|---|---|---|
| `pdf-text-heavy.pdf` | PDF | 2 pages of headings + body text |
| `pdf-image-heavy.pdf` | PDF | 2 pages of image-marker placeholders |
| `pdf-scanned.pdf` | PDF | 1 page, image-only, no extractable text layer |
| `pptx-text.pptx` | PPTX | 2 slides, text only |
| `pptx-image.pptx` | PPTX | 2 slides with image markers |
| `docx-with-revisions.docx` | DOCX | Body text + tracked-changes XML |
| `xlsx-with-formulas.xlsx` | XLSX | 2×2 grid + a `SUM()` formula |

All fixtures are **MIT-cleared, hand-crafted, stdlib-generated**. No third-party content. Regenerate at any time with `python3 tests/fixtures/markitdown-corpus/_generate.py`.

## Use

```bash
python3 scripts/measure_markitdown_lift.py            # baseline-only (no markitdown peer install needed)
python3 scripts/measure_markitdown_lift.py --convert  # tries to call markitdown-mcp via stdio if reachable
```

The script prints a per-fixture row with raw byte size, raw-byte token estimate (bytes ÷ 4), and — when `--convert` is set and `markitdown` is reachable — the converted-Markdown token count plus the ratio.

## Provenance

- Generator: `_generate.py` in this folder (stdlib-only)
- Skill: `.agent-src.uncompressed/skills/markitdown/SKILL.md`
- Roadmap: `agents/roadmaps/road-to-markitdown-adoption.md` § Phase 2 B2
