<!-- evidence-type: analysis -->
# The injection scanner, after wiring the measured layer in

**Measured:** 2026-08-22 · **Corpus:** `internal/bench/corpora/encoding-channels/` — 300 positives, 353 negatives, 15 channels, frozen by sha256 in its `manifest.json` (read, never regenerated)
**Detector under test:** `_scan` in `src/scripts/injection_scan_hook.ts` — four phrase regexes **plus** both halves of the shipped encoding layer

## The numbers

| | value | bar | verdict |
|---|---|---|---|
| recall over all positives | **99.00 %** (297 / 300) | ≥ 95 % | PASS |
| channels with zero detections | **0 of 15** | 0 | PASS |
| false-positive rate over negatives | **0.85 %** (3 / 353) | — | see below |
| p95 per scan | **0.0079 ms** | `any_hook_event` `p95_ci: 250` | PASS by ~4 orders of magnitude |

p50 0.0048 ms · p99 0.0143 ms · max 0.0787 ms over 653 entries, after 3 warm-up passes. The latency question is settled and not close: this detector is not what would put a hook near its budget.

## The correction that matters: one import was not enough

The commissioning roadmap's premise was that importing `scan_encoding_findings` gives the hook "the 15 measured channels". **Measured, it gives 11.**

`scan_encoding_findings` **alone**: recall **72.33 %** (217 / 300), with four channels at **0 of 20 each** — `deprecated-format`, `private-use-area`, `control-char`, `invisible-filler`.

Those four are the module's **strip-only invisible layer**. Verified in both directions: `sanitize_text` changed **20 of 20** for each of them, while the reporting API reported **0 of 20**. The module says so itself — *"`sanitize_text` strips the invisible layer. This reports the VISIBLE layer"* (`retrieval_sanitize.ts:92`).

**And the published 99.00 % is the stripping pipeline's number.** `agents/evidence/reports/encoding-floor-measurement.md:22` records it against the full pipeline. The reporting half alone had never been measured separately, so "import the measured layer and get 15 channels" read as true and was not.

A warn-only PostToolUse hook **may not strip** — rewriting what the agent already read would break the one property the warn-only posture rests on. So the gap was structural, not a configuration miss: a consumer that may not strip was blind to a quarter of the channel set.

**The fix is additive, not a reimplementation.** `scan_invisible_findings` is a new export in the same module, reusing the **same** predicates `sanitize_text` uses — `_classify`, `_isStrippableControl`, `_INVISIBLE_FILLERS`, not copies of them. A channel therefore cannot become strippable without becoming reportable in the same edit. Nothing that existed changed behaviour, and the eight existing call sites are untouched.

With both halves: **99.00 %, zero blind channels.**

## The false positives, named rather than rounded away

3 of 353, and **all three are the pre-existing `injection-phrase` regex** — none from the encoding layer, which keeps its published 0.00 %.

| id | what it is |
|---|---|
| `neg-inter-agent-message-033` | *"An embedded \"ignore previous instructions\" is an attack:"* |
| `neg-inter-agent-message-093` | *"...(\"ignore previous instructions\","* |
| `neg-inter-agent-message-094` | *"\"you are now…\", \"new system prompt\") are DATA describing an attack,"* |

All three are this repository's **own security prose, quoting the attack while explaining it**. Talking about the attack looks like the attack to a regex.

**Not fixed here, deliberately.** Narrowing the phrase regex to exclude quoted occurrences is a change to the detection surface that this corpus cannot validate — the corpus was built for encoding channels, and its negatives happen to contain security prose. Tuning against it is what its own manifest note forbids. The honest disposition is the number, in a report, on a hook that ships **off**.

## What this does NOT establish

**The corpus rate is not the tool-output rate.** `encoding-floor-measurement.md:115` says so for its own numbers and it is more true here: web fetches and MCP responses are a different distribution from 653 in-repo strings. A 0.85 % rate over this corpus predicts nothing about a repository whose tool output is mostly prose about prompt injection — which, ironically, is this one.

**This is not enforcement.** The hook is `fail_closed: false`, `severity: advisory`, and ships `enabled: false`. It cannot refuse. `untrusted-input-defense`'s `enforced_by: none` is unchanged and was not a candidate to change — a hook that cannot refuse does not enforce, however many channels it names.

**No default flip.** `src/config/agent-settings.template.yml` still ships `injection_scan: enabled: false`. Both numbers clear their bars, which makes a flip *discussable*; it does not make it decided. A roadmap that shipped a detector and its own default flip in one change would be grading its own homework.

## Reproducing

The two committed tests are the reproduction: `tests/hooks/injection_scan_corpus.test.ts` (freeze assertion, per-channel table, bounded FP with channel attribution) and `tests/hooks/injection_scan_output_contract.test.ts` (the payload keys and the risk ranking). The corpus freeze is asserted **first**, because if it were ever edited every other number here would silently become a measurement of nothing.
