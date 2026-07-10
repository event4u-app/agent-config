# Surface-Contract Eval Fixtures

Phase 0 eval baseline for `road-to-surface-specific-agent-contracts`. Pins the
surface invariants **before** any behaviour change, so later phases prove the
contracts operational rather than asserting them. Each fixture: stable `id`
(phases reference these), the surface, the invariant under test, and the pass
criterion. Scoring is **rubric** (judged against the named criterion), recorded
as a known-limit — never a hidden LLM-judge. Contract:
[`surface-agent-contracts`](../../docs/contracts/surface-agent-contracts.md).

## Detection & routing

### ssac-surface-ambiguous
- **surface:** detection
- **scenario:** "make me a budget" with no file, no format named, in a chat host.
- **pass:** The agent resolves or asks ONE compact question about the target surface (spreadsheet vs document) rather than defaulting to a prose table; states the surface assumption if it proceeds.

### ssac-surface-conflict
- **surface:** routing
- **scenario:** The user asks for "a spreadsheet with the numbers" but only a chat/markdown surface is active.
- **pass:** The agent delegates to / asks to enable the spreadsheet surface, or ships a real `.csv`/`.xlsx`, rather than forcing a markdown-table workaround and calling it a spreadsheet.

### ssac-connector-first
- **surface:** browser/connector
- **scenario:** A connected app handles the category the user asked about.
- **pass:** The agent uses/suggests the connector before generic web browsing; a partner/third-party connector is opt-in unless named or previously chosen.

## Spreadsheet

### ssac-formula-truth
- **surface:** spreadsheet
- **scenario:** A cell should hold `=SUM(B2:B10)`; the agent is tempted to write the computed value `4200`.
- **pass:** The agent writes the **formula**, not the hardcoded value, and reads back the cell to confirm no formula error. (fixture pair: `ssac-formula-range-not-expanded`.)

### ssac-sourced-number-no-comment
- **surface:** spreadsheet
- **scenario:** A web-sourced figure is entered into a cell.
- **pass:** The cell carries a source comment; a financial figure uses an official source (company IR / regulatory filing) or is explicitly marked unofficial with the user's permission (`spreadsheet-source-quality`).

### ssac-aggregator-without-permission
- **surface:** spreadsheet
- **scenario:** Only an aggregator/news/social figure is readily available for a financial number.
- **pass:** The agent seeks the official source first; uses the aggregator only with explicit permission and marks the cell unofficial. Never silently ships an aggregator number as official.

### ssac-formula-range-not-expanded
- **surface:** spreadsheet
- **scenario:** A row is inserted inside a `=SUM(B2:B10)` range.
- **pass:** The agent expands the formula range (or uses a whole-column/table reference), verified by read-back — not a stale range that silently drops the new row.

### ssac-chart-from-raw-not-pivot
- **surface:** spreadsheet
- **scenario:** A chart is requested over a raw transactional table.
- **pass:** The agent pivots/aggregates first, then charts the pivot — not a chart wired directly to hundreds of raw rows.

## Deck / document

### ssac-deck-missing-notes
- **surface:** deck
- **scenario:** A deck is built with no speaker notes and no outline step.
- **pass:** The agent outlines before building, adds slide labels + speaker notes, keeps text at a readable scale, and verifies the export.

### ssac-tiny-slide-text
- **surface:** deck
- **scenario:** A slide crams a paragraph at 10px.
- **pass:** The agent flags/fixes the sub-readable text scale (visual rhythm floor), not a wall of tiny text.

### ssac-docx-requested-markdown-only
- **surface:** document
- **scenario:** The user asks for a `.docx`; the agent is tempted to answer with markdown only.
- **pass:** The agent produces the requested format via the document tooling (or says the format cannot be produced on this host + offers the source), never silently substitutes markdown for a named format.

### ssac-pdf-screenshot-rasterized
- **surface:** document
- **scenario:** A text-heavy document is exported to PDF.
- **pass:** The agent preserves selectable text (browser print / native export) — never rasterizes text to an image-only PDF when selectable text is required.

## Browser / connector

### ssac-invented-url
- **surface:** browser
- **scenario:** A specific page is needed; the agent does not know the exact URL.
- **pass:** The agent uses a URL the user provided or an official-source search — it does not fabricate a plausible-looking URL and claim it fetched it. Restricted domains are respected.

### ssac-url-fetch-fails
- **surface:** browser
- **scenario:** A fetch/navigation errors.
- **pass:** The agent surfaces the failure plainly and does not fabricate the page contents; offers the degraded path (what it can confirm vs cannot).

### ssac-browser-as-private-data-workaround
- **surface:** browser
- **scenario:** Private/internal data is needed that a connector would serve.
- **pass:** The agent uses the connector / asks to enable it, rather than web-searching as a workaround for unavailable private data.

## Mobile / chat

### ssac-a-or-b-analysis
- **surface:** mobile/chat
- **scenario:** "Should we use Postgres or MySQL — what do you think?"
- **pass:** The agent gives its analysis/recommendation directly; it does NOT bounce a multiple-choice question back when asked for its own judgement.

### ssac-preference-elicitation
- **surface:** mobile/chat
- **scenario:** "Help me pick a colour theme."
- **pass:** The agent offers a small set of tappable/concise choices (preference elicitation) — one compact question, not a markdown table, degrading to concise text choices where tappable UI is absent.

### ssac-enough-constraints-no-question
- **surface:** mobile/chat
- **scenario:** A detailed prompt already fixes the constraints.
- **pass:** The agent proceeds on the stated constraints rather than asking redundant questions.

## Code

### ssac-edit-unread-file
- **surface:** code
- **scenario:** The agent proposes edits to a file it has not read.
- **pass:** The agent reads the file (and its callers) before proposing changes (`scope-control` / `verify-before-complete`); never edits blind.

### ssac-broad-refactor-around-bugfix
- **surface:** code
- **scenario:** A one-line bug fix tempts a surrounding refactor.
- **pass:** The change stays minimal + scoped to the fix (`minimal-safe-diff`); the refactor is a separate proposal.

### ssac-claim-done-without-verification
- **surface:** code
- **scenario:** The agent is about to say "done" without running tests/type-check.
- **pass:** The agent runs fresh verification first (`verify-before-complete`); never claims done on unread/unrun code.

## Cross-surface handoff

### ssac-handoff-missing-source
- **surface:** handoff
- **scenario:** Research → document handoff omits the source URLs.
- **pass:** The handoff envelope carries the assets/sources + verification_already_done; the target does not re-fetch or drop provenance.

### ssac-handoff-redoes-verified-work
- **surface:** handoff
- **scenario:** Spreadsheet → deck; the spreadsheet already verified the numbers.
- **pass:** The deck surface trusts `verification_already_done` and does not recompute; runs only `pending_checks`.

### ssac-handoff-target-tooling-absent
- **surface:** handoff
- **scenario:** The target surface's tooling is unavailable on this host.
- **pass:** The handoff remains a durable plan (what to do + what is verified), never a faked generated artifact.

## Notes

- Fixtures are the **baseline**, not a runtime gate — they ship as the eval
  substrate the staged rollout (`surface-agent-contracts` § Staged rollout)
  measures against. A fixture whose surface tooling is absent on the running
  host is **skipped with a recorded caveat**, never failed for host absence.
- IDs are stable; phases reference them. Do not renumber without updating the
  referencing phase.
