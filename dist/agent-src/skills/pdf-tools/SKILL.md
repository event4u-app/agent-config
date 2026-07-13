---
model_tier: medium
name: pdf-tools
description: "Create, merge, split, rotate, encrypt, or form-fill PDFs and extract text/tables — library-per-task routing (pypdf, reportlab, qpdf). Use for 'merge these PDFs', 'fill this form', 'create a PDF'."
compatibility: "Needs one PDF library in the environment per task — pypdf/reportlab (Python), pdf-lib (Node), or qpdf/ocrmypdf CLIs. A throwaway venv/npx install is acceptable; nothing is bundled."
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

# pdf-tools

Write-side PDF operations. `markitdown` *reads* PDFs (text/OCR → markdown);
this skill **creates, transforms, and fills** them. PDF is a binary-ish format
with an object graph — never hand-edit bytes; always go through a library, and
pick the library per task.

## When to use

- Merging, splitting, rotating, or re-ordering PDF pages.
- Encrypting / decrypting a PDF or stripping permissions.
- Creating a PDF from content (report, letter, invoice).
- Filling PDF form fields (AcroForm) programmatically.
- Extracting text or tables when `markitdown` output is not enough (page-scoped
  extraction, coordinates, tables).
- OCR on scanned PDFs to make them searchable.

Do NOT use for: plain PDF→markdown conversion (route to `markitdown`), Word
documents (`docx-authoring`), or slide decks (`html-deck`).

## Library-per-task routing

| Task | First choice | Fallback |
|---|---|---|
| Merge / split / rotate / re-order | `pypdf` (Python) | `pdf-lib` (Node), `qpdf` CLI |
| Encrypt / decrypt / permissions | `pypdf` | `qpdf` CLI |
| Create from scratch | `reportlab` (Python) | `pdf-lib`; HTML→PDF via headless browser for layout-heavy docs |
| Form-fill (AcroForm) | `pypdf` (`update_page_form_field_values`) | `pdf-lib` |
| Text extraction (page-scoped) | `pypdf` | `pdfplumber` for coordinates |
| Table extraction | `pdfplumber` | `camelot` (needs ghostscript) |
| OCR (scanned → searchable) | `ocrmypdf` CLI | `tesseract` + rebuild |

One library per task — do not chain three libraries where one covers the job.
If none is installed, a **throwaway venv** (`python3 -m venv … && pip install
pypdf reportlab`) or `npx`-scoped install is the standard move; ask before any
global/system install per `missing-tool-handling`.

## Procedure

1. **Classify the task** against the routing table; confirm (or provision) the
   one library it needs.
2. **Inspect before transforming.** For merge/split/fill, read the input first
   — page count, encryption status, form-field names (`reader.get_fields()`).
   Filling field names you guessed instead of read is the #1 form-fill failure.
3. **Operate via the library** — never regex/byte-patch a PDF.
4. **Validate the output.** Re-open the result with the same library: page
   count matches expectation, text extraction returns the expected content,
   filled fields read back with the written values. An output that cannot be
   re-opened is a failed run, not a deliverable.
5. **Report** what was produced and how it was validated (page counts,
   field read-back).

## Output format

1. **The PDF file(s)** — produced by the routed library, re-opened
   successfully as part of the run.
2. **A validation line per output** — page count + (for form-fill) the
   read-back of every written field; (for extraction) the page-scoped source
   of each extracted value.

## Gotcha

- Form fields often don't render their filled values in every viewer unless
  `NeedAppearances` is set (pypdf: `auto_regenerate=False` pitfalls) — verify
  by field read-back, not by eyeballing a viewer.
- Merging encrypted PDFs silently fails or throws late — check
  `reader.is_encrypted` first and decrypt with the known password before
  merging.
- Page indices are 0-based in pypdf but humans speak 1-based — off-by-one
  splits are the classic defect; restate the requested range in both forms
  before cutting.
- Text extraction on a scanned PDF returns empty strings, not an error — an
  empty extraction on a non-empty page means OCR is needed (`ocrmypdf`), not
  that the page is blank.
- `reportlab` coordinates are points from the **bottom-left** — top-left
  assumptions place content off-page.

## Do NOT

- Do NOT byte-edit or regex-patch a PDF file directly.
- Do NOT claim a form was filled without reading the field values back from
  the written file.
- Do NOT install PDF tooling system-wide without asking — throwaway
  venv / npx scope first (`missing-tool-handling`).
- Do NOT copy code from proprietary document-skill sources — pattern
  re-implementation only.
