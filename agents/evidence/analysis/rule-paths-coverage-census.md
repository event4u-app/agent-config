# Rule `paths:` coverage census — where the standing payload actually sits

> `road-to-inbox-harvest-2026-08-d-context-ledger` Step 5.1. Measured
> 2026-08-15 against the tree at `e3bd96158`, over `dist/agent-src/rules/` —
> the projected set, i.e. what a consumer actually receives. Every figure below
> was produced by a command run for this page and cross-checked against the
> repository's own census script.

## Headline

| Measure | Value |
|---|---:|
| Projected rule files | **115** |
| Rules declaring `paths:` in frontmatter | **0** |
| Total bytes | **441,965** |
| Estimated tokens (bytes ÷ 4) | **110,491** |

Coverage is zero, so this census is a **ranking** exercise rather than a
discovery one: nothing is scoped today, and the only open question is which
rules would be worth scoping first.

The zero was checked two ways — a per-file extraction of the region between the
first two `---` fences, and a concatenated-frontmatter sweep. Both return zero.
The related keys `file_pattern:` and `path_prefix:`, which appear in some rule
*bodies* as prose about routing, also have zero frontmatter occurrences.

## Weight by rule type

| `type:` | Files | Bytes | Est. tokens | Share of weight |
|---|---:|---:|---:|---:|
| `always` | 9 | 29,466 | 7,366 | 6.7 % |
| `auto` | 101 | 407,042 | 101,760 | 92.1 % |
| `manual` | 5 | 5,457 | 1,364 | 1.2 % |
| **total** | **115** | **441,965** | **110,491** | 100 % |

The split is the actionable part. The `always` set is exactly the nine kernel
rules — `agent-authority`, `ask-when-uncertain`, `commit-policy`,
`direct-answers`, `language-and-tone`, `no-cheap-questions`,
`non-destructive-by-default`, `scope-control`, `verify-before-complete` — and
they carry **6.7 %** of the weight. They are also the rules an agent may not
write to, and the ones a scoping change would need its own process for. **The
92 % is in the `auto` tier**, which is where scoping is both permitted and
worth doing.

## Top 20 by delivered weight

Not one of them is a kernel rule; every one is `auto`.

| # | Rule | Bytes | Est. tokens | `type:` |
|---|---|---:|---:|---|
| 1 | `context-hygiene` | 10,988 | 2,747 | auto |
| 2 | `design-fidelity` | 10,400 | 2,600 | auto |
| 3 | `session-canary` | 9,458 | 2,364 | auto |
| 4 | `settings-ask-protocol` | 9,374 | 2,343 | auto |
| 5 | `code-provenance` | 9,089 | 2,272 | auto |
| 6 | `design-review-after-ui-write` | 8,906 | 2,226 | auto |
| 7 | `domain-safety-pii` | 8,511 | 2,127 | auto |
| 8 | `token-budget-discipline` | 8,380 | 2,095 | auto |
| 9 | `domain-safety-disclaimer` | 7,821 | 1,955 | auto |
| 10 | `active-remediation` | 7,464 | 1,866 | auto |
| 11 | `downstream-changes` | 7,394 | 1,848 | auto |
| 12 | `delegation-policy` | 7,393 | 1,848 | auto |
| 13 | `senior-engineering-discipline` | 7,031 | 1,757 | auto |
| 14 | `legal-safety-floor` | 6,814 | 1,703 | auto |
| 15 | `autonomous-execution` | 6,787 | 1,696 | auto |
| 16 | `brand-source-of-truth` | 6,674 | 1,668 | auto |
| 17 | `ui-audit-gate` | 6,513 | 1,628 | auto |
| 18 | `roadmap-progress-sync` | 6,069 | 1,517 | auto |
| 19 | `evaluator-independence` | 6,064 | 1,516 | auto |
| 20 | `media-governance-routing` | 6,009 | 1,502 | auto |

These twenty sum to **39,278 estimated tokens — 35.5 % of the whole rule
payload in 17 % of the files.** Several are visibly domain-scoped by subject
(`design-fidelity`, `design-review-after-ui-write`, `legal-safety-floor`,
`media-governance-routing`, `brand-source-of-truth`, `ui-audit-gate`), which is
what makes them the natural first tranche: a rule about UI fidelity delivered
into a session that touches no UI is the case `paths:` exists for.

**That observation is not a recommendation to scope them.** Scoping narrows what
an existing install receives, which is a consumer-visible change and the reason
Step 5.2 is blocked on an explicit decision. This page ranks; it does not
choose.

## Method note

Token figures use **bytes ÷ 4**, the same proxy `preamble_byte_census.ts` uses
and states. Running that script independently returns `files=115,
chars=441,965, tokens_estimate=110,491` — an exact match to the manual
computation above, which is a consistency check rather than a proof of
tokenizer exactness for any single rule.

## Reconciliation — and a live finding

The recorded budget figures do **not** reconcile with what the tree measures
today, and both of the repository's own gates say so directly:

- `check_preamble_payload_budget.ts` measures **125,593 tokens** against a
  registered baseline of 102,520 and a ceiling of 107,646 — **exit 1, roughly
  23,000 tokens over.**
- `check_standing_rule_delivery.ts` measures **110,529 tokens** against the
  110,000 cap in `budgets.yml` — **exit 1, 100.5 % of cap.**

Both are **pre-existing** and **local-only**: neither script is referenced by
any file under `.github/workflows/` or by `Taskfile.yml`, so nothing in CI is
red because of them, and nothing in this roadmap's change set caused them (it
adds no rule and edits no rule body).

The cause is knowable rather than mysterious. `preamble-payload-budget.json`'s
`baseline_tokens: 102520` is a ratchet baseline recorded 2026-07-31, and the
narrative figures in `budgets.yml` are a snapshot from 2026-08-08. The rule set
has grown since. The ratchet is written to fail on **growth** and has no
downward schedule, so the corpus drifted past its own checkpoint without
anything obliging a correction — which is precisely the gap Step 5.3 addresses,
now with a number attached: the distance from measured to target is not the
102,520 → 40,000 the file implies, it is **125,593 → 40,000**.
