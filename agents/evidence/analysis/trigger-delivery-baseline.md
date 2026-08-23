# Trigger-delivered rule bodies — the pinned baseline

<!-- evidence-type: analysis -->

> Phase 0 of [`road-to-trigger-delivered-rule-bodies`](../../roadmaps/archive/road-to-trigger-delivered-rule-bodies.md).
> Every figure below carries the command that produced it, measured **2026-08-23**
> on the branch's own tree against `origin/main` @ `e7c437fe5`. Nothing here is
> carried over from the drafting session, and where the drafting session's number
> disagrees with the tree the tree wins and the delta is named.
>
> This file exists so that no later phase quotes a *(proposal)* figure as
> measured, and so that nobody re-proposes a judge — see § ADR-202.

## 1. The per-spawn preamble is RED, and drifting upward

```
$ ./scripts-run src/scripts/check_preamble_payload_budget
  project-scope rules                      122476 tok
  preloaded skills catalog                  14590 tok
  CLAUDE.md hierarchy (project only)          746 tok
  measured total                           137812 tok (baseline 102520, +35292; ceiling 107646)
❌  per-spawn preamble payload grew past the ratchet: 137812 > 107646 tok.
```

The drafting session read **135,575**; the tree reads **137,812**. The direction
is the finding: every rule and skill description here is re-written on EVERY
subagent spawn, so the growth is paid per spawn rather than once.

**Body length is not this roadmap's axis** — it belongs to
`road-to-standing-payload-diet`, and amendment A4 lands there.

## 2. The activation census — which axis this roadmap moves (step 0.2)

```
$ ./scripts-run src/scripts/check_rule_activation_census
✅  check_rule_activation_census: 4 scoped · 17 mixed · 113694 unconditional tokens (exact BPE) · 120 rule file(s).
```

The gate pins two axes independently. **The identity axis** — the exact
`scoped_ids` and `mixed_ids` SETS, by identity, so that one rule in and one rule
out cannot pass as no change:

- `scoped_ids` (4): `design-review-after-ui-write`, `roadmap-progress-sync`,
  `source-of-truth`, `ui-audit-gate`.
- `mixed_ids` (17): `augment-edit-discipline`, `design-fidelity`,
  `doc-screenshot-hygiene`, `domain-adoption-policy`,
  `framework-neutrality-in-generic-skills`, `image-likeness-and-rights`,
  `laravel-translations`, `lethal-trifecta-guard`,
  `linked-projects-onboarding-gate`, `low-impact-corpus-privacy-floor`,
  `markdown-safe-codeblocks`, `onboarding-gate`, `persona-governance`,
  `php-coding`, `provider-lifecycle-discipline`, `roadmap-ci-steps-policy`,
  `settings-ask-protocol`.

**The weight axis** — the unconditional corpus token total, which ratchets DOWN
only.

**This roadmap moves NEITHER, and the answer is `none`.** It touches no rule
frontmatter, adds no rule file, and changes no `paths:` scoping: the two sets
above are byte-identical to `src/config/rule-activation-census.json`. The
delivery mode changes how a body *reaches* a session, not whether a rule is
activated conditionally, which is the property this census measures. So no
`--write-baseline` re-anchor is taken, and none is needed.

One pre-existing drift is recorded rather than absorbed: the committed baseline
reads `unconditional_tokens: 113699` and the tree reads **113,694**, a −5 that
was already present before this branch's first commit (measured on the untouched
worktree). It is a lowering, so the gate is green; re-anchoring it here would
silently claim another change's gain, which is the failure that config's own
notes name. It is left for whoever earned it.

## 3. The router, by trigger kind

```
$ node -e "…dist/router.json…"
kernel 9 · tier_1 24 · tier_2 81
triggers 752 {keyword:483, phrase:208, path_prefix:41, file_pattern:13, command:7}
no-trigger: no-roadmap-references, skill-quality, source-confidentiality, rule-type-governance
```

The drafting session read **80** tier-2 rules and **745** triggers; the tree
reads **81** and **752**. Four rules carry no trigger at all — all
maintainer-workspace — and they are the residue step 1.3 keeps eager.

## 4. The thin-projection delta, with the residue made visible

```
$ ./scripts-run src/scripts/project_thin_rules --measure
Rule-layer thin projection (kernel full-bodied + 106 non-kernel pointers):
  eager: 120582 GPT tok (485,634 chars)
  thin:   18573 GPT tok (76,991 chars)
  saved: 102009 GPT tok  (84.6% of the rule layer)
  no-trigger residue (kept full-bodied, 4 rules, 2871 GPT tok): no-roadmap-references, rule-type-governance, skill-quality, source-confidentiality
```

Before step 1.3 the projector thinned the residue too and read **15,946** tok.
That number was cheaper and wrong: a rule the router cannot fire is a rule no
hook can put back, so a pointer there is a silent hole rather than a saving.
**18,573 is the honest figure** and it is the one every price row below uses.

## 5. The labelled corpus — and a refuted premise

```
$ ls tests/eval/routing-matrix/*.yaml | wc -l          → 94
$ grep -l open_files tests/eval/routing-matrix/*.yaml   → 21
$ ./scripts-run src/scripts/model_rule_injection --corpus tests/eval/routing-matrix
corpus: 94 labelled rules · 305 positives · 194 near-misses · 32 positives carry open_files
```

**The roadmap's own § D2b is wrong here and this is the correction.** It reads
"94 yaml files, 46 carrying `open_files`". The file count holds; the
`open_files` count is **21 files / 32 positives**, less than half the claim. It
matters because step 2.1(b)'s recall floor is derived from this corpus's spread:
a floor set against a believed 46-file path arm would have been set against a
population that does not exist.

## 6. ADR-202 — the quality instrument is closed, three times

Recorded here so that no step in this roadmap re-proposes a judge, and so the
prohibition is readable without opening the ADR:

| Closure | Where | What it says |
|---|---|---|
| Paired judging inadmissible | `ADR-202:69-71` | "Paired judging — LLM or human — is not admissible for this question… Neither is re-opened by this record." |
| The 48 % bar is not inherited | `ADR-202:83`, `:146` | "0.48 is not inherited. It was calibrated for a pairwise preference statistic" |
| Anchor scoring fails its own floor | `ADR-202:402-407` | Inter-evaluator Cohen's **κ 0.472** against a registered floor of **0.800**, 34/130 disagreements — "κ = 0.472 → the instrument fails. This is the final honest null." |

The ADR's `review_trigger` (c) — a judge substrate with measurable reliability —
has not fired. **Behavioural equivalence therefore has no admissible instrument
in this tree, and this roadmap does not build one.**

The only quality datum that exists is `docs/CLAIMS.md` § `context-token-reduction`:
the thin projection reduced eager rule load 78,513 → 13,881 GPT tok and FAILED
its gate at **36.2 % against a required 48 %**. That run tested **POINTERS**.
The delivery arm was never run, which is why it is untested rather than refuted.

## 7. `rules_efficiency` — classification: **pre-intervention-impossible** (step 0.8)

Step 0.8 requires exactly one of three literal tokens, and forbids manufacturing
usage from prompt substring counts. The classification is
**`pre-intervention-impossible`**, and here is why the other two are wrong:

```
$ ./scripts-run src/scripts/dispatch_economy_report | grep -A2 rules_efficiency
rules_efficiency:
  envelopes with pair=0 · median quota=— · low-quota signal (< 0.2): no data

$ grep -o '"rules_carried":[^,}]*' agents/runtime/state/audit/2026-08.jsonl | sort | uniq -c
 755 "rules_carried":null
$ grep -o '"rules_used":[^,}]*' agents/runtime/state/audit/2026-08.jsonl | sort | uniq -c
 755 "rules_used":null
```

**Not `miswired`.** The report path works: 755 orchestration lines carry both
fields and both are `null` on every one of them. `orchestration_record.ts:146-147`
reads them from `--rules-carried` / `--rules-used` CLI flags, and
`grep -rn -- '--rules-carried' src/ dist/` finds the flag's own declaration and
its usage line and **no caller anywhere**. There is no data to re-route.

**Not `stale`.** The question it asks — are worker rules carried unused? — is
exactly the question the delivery mode makes answerable, so retiring the metric
would retire a live question.

**`pre-intervention-impossible`, in the roadmap's own words.** `rules_carried` is
computable today (it is a property of the projection). `rules_used` is not:
"rules the worker actually applied/cited"
(`contexts/execution/orchestration-telemetry.md:68`) is a model self-report, and
under an eager projection there is no runtime consumer of rule bodies to observe.
Nothing in the tree can distinguish a rule that was applied from one that was
merely present.

**The replacement datum, and why it is an observation rather than a proxy.** The
producible figure is `rules_matched / rules_carried` — the trigger-match rate —
because in the delivery mode a rule body is *delivered* only on a match, and the
delivery is an event the concern performs rather than a claim the model makes. It
is computed offline by `model_rule_injection` over the frozen corpus (§ 8: p50 2,
p90 4, mean 2.07 matched of 105 carried) and, once the mode is on, by the concern
itself.

It is deliberately **NOT** relabelled as "usage". Matched-and-delivered is not
applied-and-followed, and the roadmap's risk register ranks the substitution
eighth precisely because calling it usage would make the retriever's own demand
gate self-fulfilling. `later/road-to-deferred-rule-retriever` gate (2c) is
amended to read the match rate and to say in as many words that it is not a
usage figure.

## 8. Recall, false fires, cost — the step 0.4 appendix

Reproduce with `./scripts-run src/scripts/model_rule_injection --corpus tests/eval/routing-matrix`;
two consecutive runs are byte-identical (`cmp` clean).

```
── matched rules per positive prompt (exact-trigger matcher) ──
  count  p50=2 p90=4 max=9 mean=2.07
  tokens p50=1728 p90=4804 p99=8248 max=12957 mean=2245
  per-prompt cap = p90 rounded up to 500 = 5000 tok

SUMMARY
recall, open_files ignored:  0.902 (275/305)
recall, open_files honoured: 0.993 (303/305)
path-rule misses: 0
false fires: 0 of 194 near-miss prompts
price USD/session · sonnet in 3/cr 0.3/cw 3.75 per 1M · cells = turns 10/50/200 at 0|5|20 spawns
  eager-all     0.7778|2.5865|8.0127  2.2247|4.0335|9.4597  7.6509|9.4597|14.8858
  thin-pointers 0.1198|0.3984|1.2342  0.3427|0.6213|1.4571  1.1785|1.4571|2.2928
  delivery      0.1675|0.4461|1.2819  0.4500|0.7285|1.5643  1.4213|1.6999|2.5356
endpoint (d) price · delivery 0.7285 < eager 4.0335 at 50 turns x 5 spawns: PASS
```

The two residual misses at 0.993 are the honest column and are named rather than
rounded away: the corpus carries two positives whose labelled rule the exact
matcher does not fire even with open files honoured. **`path-rule misses: 0`** is
the separate, sharper reading step 1.2 asks for — every positive that carries
`open_files` for a path-declaring rule fires once the file binding exists.

The price model's assumptions are stated in `sessionCostUsd`'s own docstring
rather than implied: standing context is cache-written once and cache-read per
later turn, a spawn re-writes the whole preamble as uncached input, injected
bodies are uncached input paid once per rule per session (step 1.4's seen-set,
modelled directly), and output tokens are excluded because they are identical
across shapes and would add the same constant to every row.

## 9. The matcher comparison — step 0.3, pre-registered

Reproduce with `--baseline-comparison`. The 2026-07-28 council lock required the
shipping lexical core to be scored BEFORE a new matcher was written, because
build-then-measure already cost this repository a whole engine (code graph,
recall 0.365 against disciplined grep's 0.797).

```
  matcher                          recall    false-fires
  router_match (exact triggers)   0.993     0/194
  lexical_index BM25 top-1        0.466     28/194
  lexical_index BM25 top-4        0.728     51/194
  lexical_index BM25 top-8        0.820     69/194

WINNER: router_match (exact triggers) — no new matcher.
```

"No new matcher" was a permitted OUTCOME of 0.3, not its premise. It is now
measured: exact matching wins on both axes at every depth tried, so a third
matcher would be strictly worse at strictly higher cost.

## 10. The runtime cost of the concern, gate-closed and gate-open

The number step 1.7 (as amended) actually needs is the concern's RUNTIME cost,
not its presence in a manifest list.

```
$ ./scripts-run src/scripts/bench_hook_injection
bench_hook_injection: 73 concern-slot pairs · 4 emitted under the committed fixtures
  … session-canary, council-availability, session-canary, end-review-nudge …
  slot-sum user_prompt_submit      922 B (cap 4096)
```

`rule-inject` is bound on both slots and is **not among the emitters**: zero
bytes under the shipped default. Timed in-process over 200 iterations per slot:

| path | p50 | p95 | max |
|---|---:|---:|---:|
| `user_prompt_submit`, gate closed | 0.046 ms | 0.224 ms | 39.7 ms |
| `pre_tool_use`, gate closed | 0.043 ms | 0.158 ms | 38.0 ms |
| `user_prompt_submit`, gate OPEN | 8.6 ms | 87.8 ms | 320.2 ms |

Gate-closed is ~0.1 % of the 250 ms any-slot budget. **Gate-open is not, and
that is recorded here rather than in a footnote:** p95 87.8 ms is roughly 35 % of
that budget and 50 % of the 175 ms `pre_tool_use` CI cap, dominated by exact-BPE
tokenisation of every matched body. It is a cost the flip pays, not a cost this
change pays, and it belongs in the flip's evidence.

The whole-dispatch readings from the same machine (`bench_hook_latency`,
darwin, ~10 parallel sessions live) read `user_prompt_submit` p95 240 ms and
`pre_tool_use` p95 288 ms against CI caps of 250 and 175. Those are measurement
rather than gate — the budget file's own `hardware_reference` names the CI
ubuntu runner as the gated hardware and a 1-vCPU floor of 400 ms — and the
marginal figures above are the attributable half.
