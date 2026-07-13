---
model_tier: medium
name: docx-authoring
description: "Create or edit a Word (.docx) document — skeleton-create, unpack→edit-XML→pack-with-validate, page-size and list gotchas. Use for 'generate a docx', 'edit this Word file', 'fill a Word template'."
compatibility: "Requires zip + unzip on PATH; XML validation uses xmllint or python3 (either suffices). No LibreOffice/Word needed."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
trust:
  level: professional
install:
  removable: true
execution:
  type: manual
---

# docx-authoring

Write-side completion of the document cycle: `markitdown` reads docx → markdown;
this skill creates and edits the docx itself. A `.docx` is a ZIP of XML parts
(OOXML) — every operation reduces to unpack → edit XML → pack → validate.

## When to use

- Generating a new Word document (report, letter, filled template).
- Editing an existing `.docx` — text changes, structure changes, template
  placeholder filling.
- Converting authored content (markdown, data) into a `.docx` deliverable.

Do NOT use for: *reading* a docx (route to `markitdown`), slide decks (route to
`html-deck`; pptx generation is gated), spreadsheets (`spreadsheet-authoring`),
or PDFs (`pdf-tools`).

## Procedure

1. **Pick the path.**
   - **New document** → `scripts/docx_new.sh <out.docx> [title]` creates a
     minimal valid skeleton; then unpack and build the body in
     `word/document.xml`. When a real docx library is available in the
     environment (`docx` on npm, `python-docx`), prefer it for rich documents —
     the skeleton path is the zero-dependency fallback that always works.
   - **Existing document / template** → never regenerate from scratch; edit in
     place via unpack → edit → pack so styles, headers, numbering, and images
     survive.
2. **Unpack.** `scripts/docx_unpack.sh <file.docx> <dir>`. Body text lives in
   `word/document.xml`; styles in `word/styles.xml`; list definitions in
   `word/numbering.xml`; relationships in `word/_rels/document.xml.rels`.
3. **Edit the XML.** Make the smallest edit that achieves the change. Keep
   existing namespaces and attribute order; new parts must be registered in
   `[Content_Types].xml` and (where referenced) in the rels file.
4. **Pack + validate.** `scripts/docx_pack.sh <dir> <out.docx>` — packs and
   runs `docx_validate.sh` (ZIP integrity, required OPC parts, XML
   well-formedness of every part). A pack without validation is not done.
5. **Round-trip proof.** Confirm the output opens: extract its text back
   (`markitdown`, `textutil` on macOS, or unpack + read `document.xml`) and
   check the intended content is present. For template filling, grep the
   output for leftover placeholders — zero remaining is the pass condition.

## Hard-won XML rules

- **Page size is never implicit.** A `document.xml` without
  `<w:sectPr><w:pgSz .../>` silently defaults to US Letter in Word. Always set
  `w:pgSz` explicitly (A4 = `w:w="11906" w:h="16838"`; Letter = `w:w="12240"
  w:h="15840"`).
- **Tables need dual widths.** Renderers disagree on which width wins: set both
  the table-level `<w:tblW>` + `<w:gridCol>` and the per-cell `<w:tcW>` values.
  A table with only one of the two renders correctly in one app and collapses
  in another.
- **No unicode bullets.** A `•` character pasted into run text *looks* like a
  list but is not one — it breaks indentation, continuation, and screen
  readers. Real lists use `<w:numPr>` referencing a definition in
  `word/numbering.xml` (register it in `[Content_Types].xml` if newly added).
- **Escape text content.** `&`, `<`, `>` in body text must be XML-escaped —
  the classic corruption source when injecting user content into `<w:t>`.

## Output format

1. **The `.docx` file** — packed via `docx_pack.sh`, i.e. validation has
   already passed (ZIP + required parts + well-formed XML).
2. **A round-trip note** — one line stating how the output was re-read
   (markitdown / textutil / unpack) and that the intended content (and zero
   leftover placeholders, for templates) was confirmed.

## Gotcha

- Regenerating an existing document from scratch instead of editing in place
  destroys styles, numbering, headers, and embedded images — template edits are
  always unpack → edit → pack.
- Word repairs some malformed files silently; LibreOffice and converters do
  not. "It opened in Word" is not validation — run `docx_validate.sh`.
- Adding a new part (image, numbering) without registering it in
  `[Content_Types].xml` produces a file that validates as ZIP+XML but fails to
  open — content-type registration is part of the edit, not an afterthought.
- Unescaped `&` in injected text is the most common corruption: the XML stays
  parseable-looking but the file is rejected on open.

## Do NOT

- Do NOT ship a packed docx without running `docx_validate.sh` (or an
  equivalent open-check) — a broken deliverable is worse than none.
- Do NOT copy code from proprietary document-skill sources — this skill
  re-implements the pattern only.
- Do NOT hand-build pptx here — pptx generation is gated (CI-tooling decision +
  demand signal, per `domain-adoption-policy`).
