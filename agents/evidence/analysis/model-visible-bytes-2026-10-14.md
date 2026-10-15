<!-- evidence-type: analysis -->
# Model-visible tool-result bytes, per tool class — 2026-10-14

`road-to-bytes-the-model-actually-receives` step 1.4. Taken at `main@90ed4e697`
on 2026-10-14. **Machine-local**: the corpus is this machine's own Claude Code
transcripts for this repository, and another machine's sessions will give
other figures.

This is the before-figure that `road-to-tool-results-that-leave-a-handle` and
step 3.2 of `road-to-placeholders-on-the-wire` compare a reduction against.

## What is counted

- **Model-visible bytes** — the PAYLOAD of the `tool_result` block the model
  received, not the serialised block: a string body's UTF-8 bytes, or the sum of
  the text blocks' UTF-8 bytes plus the encoded image data of image blocks. The
  block's own structure (`type`, `tool_use_id`, `is_error`, JSON punctuation) is
  excluded, so every "model-visible" figure below understates the block by that
  per-result overhead. Producer: `scanToolResults` in
  `src/scripts/_lib/cc_transcript.ts` (metric `tool-result-payload-bytes`).

  *Definition stated 2026-10-15, after review.* The figures below were taken
  with the reader as it stood at `main@90ed4e697`, which counted the same
  payload with two differences: a content member carrying a `text` string was
  counted whatever its `type`, and a member of any other kind was skipped
  without a count. The current reader counts text from `type: text` members and
  data from `type: image` members with a `base64` source, and counts every other
  member in `unsupported_members`; that count was not taken for
  this reading, so how many members it skipped is unknown, not zero.
- **Hook-envelope bytes** — the transcript's `toolUseResult`, serialised. It is
  the object the host hands a post_tool_use hook, so it is what the census in
  `agents/runtime/state/tool-result-census.jsonl` measures (metrics
  `tool-raw-bytes` and `tool-delivered-bytes`).

The two columns are different populations and are never added together. Neither
is a traffic figure.

Each result is joined to its tool name by `tool_use_id` and counted once,
however many transcript files replay it. A Read that returned an image is its
own class, `Read:image`. A result whose id joins no `tool_use` would be counted
as `unknown`; this corpus has none.

## Corpus

Five project directories (the main checkout and its worktrees), 678 transcript
files, 83,031 distinct tool results.

## Distribution

| Tool class | Results | Model-visible bytes | Hook-envelope bytes | Envelope / model-visible | p50 model-visible | p95 model-visible |
|---|---:|---:|---:|---:|---:|---:|
| Bash | 71,162 | 100,196,592 | 158,742,629 | 1.58x | 350 | 6,282 |
| Read:image | 341 | 85,685,396 | 85,745,883 | 1.00x | 219,676 | 621,520 |
| Read (text) | 1,973 | 16,098,213 | 15,858,068 | 0.99x | 1,095 | 42,029 |
| Edit | 5,012 | 1,334,514 | 22,933,044 | 17.2x | 265 | 299 |
| Agent | 630 | 696,564 | 2,411,132 ¹ | 3.46x | 1,116 | 1,116 |
| Write | 2,385 | 618,785 | 14,338,447 | 23.2x | 257 | 287 |
| Monitor | 493 | 164,688 | 35,739 | 0.22x | 307 | 312 |
| TaskStop | 138 | 86,625 | 85,747 | 0.99x | 561 | 1,463 |
| WebFetch | 40 | 65,634 | 447,263 | 6.81x | 588 | 2,784 |
| SubagentHandback | 549 | 33,598 | 33,598 | 1.00x | 61 | 61 |
| AskUserQuestion | 24 | 12,230 | 34,082 | 2.79x | 287 | 687 |
| SendMessage | 51 | 8,484 | 8,458 | 1.00x | 163 | 176 |
| Skill | 24 | 948 | 1,784 | 1.88x | 37 | 37 |
| ToolSearch | 193 | 0 ² | 14,735 | — | 0 | 0 |
| five classes under 20 results | 16 | 24,215 | — | — | — | — |

¹ One Agent result carried no envelope; the envelope sum covers the other 629.
² ToolSearch returns tool-reference blocks, which carry no text; the reader
counts zero for them rather than inventing a size.

## Readings

- **Edit and Write are an envelope artefact.** The model received 1.33 MB for
  5,012 Edits; the hook envelope recorded 22.9 MB. The roadmap's F1 sample (12
  sessions) read 19.5x for the two together; the full corpus reads 17.2x and
  23.2x. A reduction aimed at the Edit and Write echo would aim at bytes the
  model never received.
- **Bash and image Reads are where the model-visible bytes are.** Bash carries
  100 MB across 71,162 results with a p95 of 6.3 KB; 341 image Reads carry
  85.7 MB, more than every text Read together.
- **Text Read is near 1:1.** The model-visible body is slightly larger than the
  envelope because the host adds line-number prefixes.

## Census shapes, read with both shapes

`readCensusLine` (`src/scripts/_lib/tool_result_census.ts`) over this machine's
census on the same date: 142,709 legacy `{bytes}` lines, 70,311 two-field lines,
none unreadable. A legacy line reads as hook-envelope bytes with the delivered
figure unknown.

## Reproduce

Run `scanToolResults({ root: ~/.claude/projects, projectDir })` for each of the
repository's project directories, merge the classes, and take p50/p95 over the
`model_visible_samples` (nearest-rank, floor). The figures above came from a
scratch script doing exactly that; it is not committed, because the reader it
calls is.
