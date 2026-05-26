# telegraph-v2 — input-side memory condensation bench

**Generated:** 2026-05-16T23:21:29Z
**Schema:** `telegraph-v2` (input-side; offline; chars→tokens via /4 heuristic)
**Script:** `scripts/bench_condense_memory.py`

## Headline

- Median char saving: **+3.52%** (p10 -4.84% · p90 +6.18%)
- Total chars saved across corpus: **+6,270**
- Total tokens (estimate) saved across corpus: **+1,568**
- Files: 12 · errors: 0

## By category (median %)

| Category | Median saving |
|---|---:|
| prose-heavy-contract | +4.56% |
| rule-classification | +0.09% |
| thin-root-consumer-generated | -4.84% |
| thin-root-consumer-template | -4.84% |
| thin-root-package | -3.92% |

## Per file

| Path | Category | Before | After | Δ chars | Saving % |
|---|---|---:|---:|---:|---:|
| `AGENTS.md` | thin-root-package | 2,987 | 3,104 | +117 | -3.92% |
| `.agent-src.uncondensed/templates/AGENTS.md` | thin-root-consumer-template | 2,272 | 2,382 | +110 | -4.84% |
| `.agent-src/templates/AGENTS.md` | thin-root-consumer-generated | 2,272 | 2,382 | +110 | -4.84% |
| `docs/contracts/ai-council-config.md` | prose-heavy-contract | 32,659 | 31,413 | -1,246 | +3.82% |
| `docs/contracts/implement-ticket-flow.md` | prose-heavy-contract | 28,395 | 27,136 | -1,259 | +4.43% |
| `docs/contracts/command-clusters.md` | prose-heavy-contract | 20,831 | 20,180 | -651 | +3.13% |
| `docs/contracts/mental-models.md` | prose-heavy-contract | 15,255 | 14,263 | -992 | +6.50% |
| `docs/contracts/kernel-membership.md` | prose-heavy-contract | 14,633 | 14,161 | -472 | +3.23% |
| `docs/contracts/load-context-budget-model.md` | prose-heavy-contract | 11,759 | 11,163 | -596 | +5.07% |
| `docs/contracts/mcp-cloud-scope.md` | prose-heavy-contract | 17,402 | 16,459 | -943 | +5.42% |
| `docs/contracts/context-spine.md` | prose-heavy-contract | 9,353 | 8,914 | -439 | +4.69% |
| `docs/contracts/rule-classification.md` | rule-classification | 9,803 | 9,794 | -9 | +0.09% |

## Methodology

- Offline run: `condense_memory.py` writes `.original.md` backup + frontmatter (`original_sha256`, `condensed_at`). The frontmatter pair (≈ 120 chars) is the fixed condensation tax — files with little prose net negative.
- chars → tokens approximation: `tokens ≈ chars / 4` (GPT-4 / Claude English rule of thumb). Calibrated number requires `tiktoken` or `claude-tokenizer`; deferred until a consumer requests pinpoint numbers.
- The `telegraph-v1` output-side verdict (`vs_terse` median −9.27%) is orthogonal — input-side savings apply to the always-loaded memory budget, not the reply stream.

## Interpretation

- **Thin-Root files net negative.** `AGENTS.md` and `templates/AGENTS.md` already follow `agents-md-thin-root` (≥ 40 % pointer ratio). The condenseor's frontmatter pair adds more bytes than the sparse prose loses. **Do not condense Thin-Root files.**
- **Prose-heavy contract docs net 3–6 % saving.** Useful but modest. Pays off when the file is large and frequently loaded.
- **Rule of thumb:** target files with > 5 KB and visible paragraph prose; skip pointer-only files.
