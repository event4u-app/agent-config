<!-- evidence-type: analysis -->

# Enforcement census, re-read 2026-09-13

`road-to-a-ledger-that-closes-the-loop` Phase 1. The roadmap's own framing is that
its source set's numbers are wrong, so this file records a reading rather than a
recollection: every figure below was produced by running the generator on this
commit, and the command that produces it is named beside it so a later reader
checks a file against a command instead of against a memory.

**Reading date:** 2026-09-13.
**Producer:** `./scripts-run src/scripts/check_enforcement_coverage` (and `--json`
for the machine shape). There is no second producer, and Phase 2.2 forbids one.

## The census summary, verbatim

```
enforcement coverage · 16/120 rules (13.3%) have a backstop that fails a CI build
  declared 39 · local-only 0 · observer 10 · unwired 0 · missing 0 · undeclared 81
  frequency: 9 gap · 9 unclassified (kernel — block_kernel_rule_writes denies the field)
  undeclared 81 splits: 9 kernel-denied · 10 observer · 1 carrier-less — the observer set is the reachable population
  denominator: 120 rule(s), frame in-scope (src/rules/*.md) == governed-total 120
```

The `--json` summary block, same run:

```json
{
  "total": 120, "declared": 39, "blocking": 16, "local_only": 0,
  "observer": 10, "unwired": 0, "missing": 0, "undeclared": 81,
  "blocking_pct": 13.3, "frequency_gap": 9, "frequency_unclassified": 9,
  "kernel_denied": 9, "carrier_less": 1,
  "frames": { "in_scope": 120, "governed_total": 120, "agree": true, "source": "src/rules/*.md" }
}
```

## The three figures the roadmap flagged — each re-derived here

### 1. Blocking concerns: **8**, not 9

Reproduced. `grep -c 'severity: blocking' src/scripts/hook_manifest.yaml` returns
**9**; a YAML parse of the same file returns **8** blocking and 52 advisory across
60 concerns. The ninth match is `src/scripts/hook_manifest.yaml:608`, a comment
line that quotes the string while explaining that `severity: blocking` states the
*highest* severity a concern can reach rather than the severity of every path
through it.

The trap is worth naming precisely, because the string that misleads a grep is
the string in a sentence warning you not to read it naively.

### 2. The `enforced_by:` split — and the two different splits a reader can mean

**39** of 120 rules carry `enforced_by:`. Those 39 declare **42** entries, because
a rule may declare more than one carrier. The two readings, both real:

| Reading | Values |
|---|---|
| **Declared** (what frontmatter says), 42 entries over 39 rules | `validator` 17 · `instruction-only` 12 · `hook` 11 · `observer` 1 · `none` 1 |
| **Resolved** (what the census makes of them), per rule | effective: `none` 94 · `validator` 15 · `observer` 10 · `hook` 1 |

The roadmap's corrected figure — *12 / 11 / 17 plus one `none` and one `observer`* —
is the **declared** reading and it reproduces exactly. The figure it replaced,
13 / 9 / 14, does not reproduce under either reading.

Recording both is the point. The declared and resolved splits differ because
resolution is not identity: a `hook:` declaration whose hook is `fail_closed: false`
resolves to `observer` (`check_enforcement_coverage.ts:421-422`), which is why 11
declared hooks become 1 effective hook and 10 effective observers. A reader who
takes one table for the other will conclude the frontmatter is wrong when it is
merely being resolved.

### 3. The frozen routing corpus: **318** gate-open fires, not 330

Reproduced, and from a second independent producer. `check_preamble_payload_budget`
reports `user_prompt_submit · 318 fires` over `tests/eval/routing-matrix`, matching
`src/config/hook-token-budget.json` and the distribution cited in
`src/scripts/hooks/rule_inject_hook.ts:19-23`.

## What the source set did not know it had

The source plans assert that no field says what enforces a rule. Two fields do.

- **`enforced_by:`** — 39 rules, value set closed by a schema pattern
  (`src/scripts/schemas/rule.schema.json`), covered in § The class vocabulary below.
- **`obligation_frequency:`** — **111 of 120** rules
  (`grep -lE '^obligation_frequency:' src/rules/*.md | wc -l` reads 111;
  `ls src/rules/*.md | wc -l` reads 120), a closed eight-value enum, joined against
  per-platform carrier frequency by `check_enforcement_coverage.ts`. The remaining 9
  are exactly the kernel rules, exempt because `block_kernel_rule_writes.ts` denies
  the write, and that exemption derives itself from `_lib/kernel_rules.ts` so it
  closes when a rule leaves the kernel.

Neither parent plan mentions either key. Work that extends this taxonomy extends
these two fields; it does not introduce a third.

## The class vocabulary — `observer` is already first-class

The roadmap records a blocker on the premise that the tree emits `observer` while
the proposed taxonomy has no slot for it, so adopting that taxonomy would remap a
value the census reports. The premise is **false at this commit**, and the schema
is the falsifier. `rule.schema.json` `enforced_by.items.pattern`:

```
^(hook:[a-z0-9_-]+|validator:[A-Za-z0-9_./-]+|test:[A-Za-z0-9_./-]+|observer:[a-z0-9 _-]+|instruction-only: *[^ ].*|none)$
```

`observer:<reason>` is an accepted **declared** value, one rule declares it today,
and `none` is accepted too. So the declared value set is already closed, already
expresses `observer`, and needs no migration.

The **resolver's** output vocabulary is a separate, wider set — `Resolution` at
`check_enforcement_coverage.ts:79-88`: `validator`, `validator-local`, `test`,
`hook`, `observer`, `unwired`, `missing`, `none`. It is wider on purpose: four of
those eight are *findings about wiring* (`validator-local`, `unwired`, `missing`,
and resolved-`observer`) that no author can declare, because they are facts about
whether the declared carrier is reachable rather than about what the author meant.

The census reports `"unwired": 0, "missing": 0` — every declared value resolves.

## The delivered-row class distribution over the frozen corpus

Phase 3.2 asks for a run over the frozen routing corpus producing rows for its
gate-open fires, with the class distribution recorded. Recorded here rather than in
a new metrics file, because Phase 2.2 forbids a second producer and this is a
reading, not a producer.

The probe drives the real selection path — `loadRouter`, `matchTierRules`,
`selectForInjection` at the concern's own `CAP_BYTES` of 16,384 — over
`tests/eval/routing-matrix`, then writes real rows through `recordDelivered`
and reads them back with `readDelivered`. Measured 2026-09-13:

| Figure | Value |
|---|---|
| gate-open fires | **318** |
| fires producing at least one row | **318** |
| distinct rules delivered | 97 |

| Declared class | Rules |
|---|---|
| `none` | 69 |
| `instruction-only` | 11 |
| `validator` | 9 |
| `hook` | 8 |

The 318 matches the independently produced figure in § 3 above, which is the
point of quoting both: the ledger's fire count and the payload budget's fire
count come from different call sites over the same corpus, and a divergence
between them would mean one of the two is measuring something other than what
it claims.

The distribution's shape is worth stating plainly because it is the case for the
later phases rather than a detail of them: **69 of 97 delivered rules declare no
carrier at all.** A discharge detector that refused on class `none` would refuse
on the large majority of what gets delivered, which is why the phases that follow
gate refusal on class and start in shadow.

## AC-2: no concern count in this tree is grep-derived

Checked, and the answer is zero sites:

- `concern_count` (the estate ratchet) comes from `countConcerns` to
  `concernIds` (`src/scripts/_lib/concern_estate.ts:53-74`), a block-scoped parse
  that enters `concerns:` and stops at the next column-0 key.
- The blocking set in `tests/hooks/concern_block_exit_parity.test.ts:40-53` comes
  from `parseYaml`, then filters `c.severity === 'blocking'`.

Zero is a real answer and is the one worth recording: the grep/parse divergence
at line 608 is a trap for a future author, not a live defect, and this section is
what a future author should find before reaching for `grep -c`.
