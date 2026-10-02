<!-- evidence-type: analysis -->

# The thinned standing weight, with the law-in-stub class in place

`road-to-rule-laws-that-can-stand` step 2.3. The class whose stub carries its
own law is in the tree; this is what it weighs, on both scopes, against the
65,000 target and the 75,000 hard ceiling that
`road-to-an-installed-layer-that-is-thinned` D2 records.

The headline is not the class. **Both scopes are over the hard ceiling with the
class and without it**, so the class is a surcharge on a total that was already
over, not the reason it is over.

## Commands, re-runnable

```
./scripts-run src/scripts/project_thin_rules --measure --json --workspaces engineering
./scripts-run src/scripts/project_thin_rules --measure --json --workspaces agent-config-maintainer
```

The without-class arm is the same two commands run with `members` and `no_stub`
emptied in `src/config/rule-consequence-class.json` — a temporary edit, restored
afterwards. That is the only way to price the form, because the projector reads
the committed class and has no flag to ignore it: a flag that switched a shipped
obligation off from the command line is a worse thing to own than a two-line
edit a reader can reproduce.

## Measured 2026-10-02, at `0c7c360cb`

Unit: **package-owned standing characters** of the rule layer — what
`build_thin` writes for a thinned host, which is every stub plus the full body
of every rule that is never thinned (kernel, the no-trigger residue, the
path-only residue, and the declared `no_stub` subset).

| scope | rule files | without the class | with the class | delta | vs 65,000 target | vs 75,000 ceiling |
|---|---|---|---|---|---|---|
| default (`engineering`, the `developer` profile) | 101 | 79,102 | **106,800** | +27,698 (+35.0 %) | +41,800 | +31,800 |
| maintainer (`agent-config-maintainer`) | 78 | 82,751 | **104,079** | +21,328 (+25.8 %) | +39,079 | +29,079 |

Exact-BPE tokens for the same two readings, with the class: 26,470 GPT tok
(default) and 25,738 GPT tok (maintainer).

### Where the characters sit

Computed over the same `build_thin` map with `String.length`. It sums ten
characters above the `--measure` reading on the default scope because that field
comes from the tokenizer helper's own `chars` count; the difference is named
here rather than reconciled, because neither number changes a verdict at this
magnitude.

| scope | kernel, full | non-kernel kept full | stubs carrying a law | plain stubs |
|---|---|---|---|---|
| default | 29,063 (9 rules) | 35,282 (6) | 20,172 (19) | 22,293 (67) |
| maintainer | 29,063 (9) | 45,835 (10) | 14,071 (12) | 15,120 (47) |

19 of the class's 24 stub-law members are in the default scope, and they cost
20,172 characters against 22,293 for the 67 plain stubs — a law-carrying stub is
roughly 3.2× a plain one. That ratio is the whole economics of the form, and it
is the number to narrow the criterion against if it is judged too expensive.

## What this does and does not establish

**Establishes.** The class ships, its cost is measured on both scopes, and the
cost is attributable per rule. The roadmap's own Risk 3 asked for exactly this —
"a class that overshoots is a criterion to narrow, not a ceiling to raise" — and
the number is now on the table rather than in an argument.

**Does not establish** that 106,800 is the installed layer's standing total.
This is the **rule layer only**. The authoritative installed-layer figure is
owned by `road-to-an-installed-layer-that-is-thinned`, whose report does not
exist yet, and quoting this number as that one would be the coverage inflation
this tree's enforcement audit exists to remove. What is comparable is the
direction: the rule layer alone already exceeds the ceiling the installed layer
is meant to sit under, which is a fact about the baseline and not about this
change.

**Does not establish** that the criterion is wrong. A narrower class would save
characters and would also remove a law from a stub, which is the thing the class
exists to put there. Deciding that trade is the owner's; it is recorded in the
roadmap's Decisions as D3's `revisit if`, and the evidence it asked for is
above.

## The reading for whoever acts on this

Three dispositions, and the measurement does not pick between them:

1. **Narrow the criterion.** 24 members is 23 % of the routed corpus. The
   `authority-bypass` clause is the widest of the three — ten members — and the
   four safety-floor rules under it (`legal`, `finance`, `strategy`,
   `domain-safety-disclaimer`) state the same shape of obligation four times.
2. **Accept the surcharge** and take the saving from the baseline instead: 35,282
   characters of non-kernel full bodies on the default scope are rules kept whole
   because the router gives them no trigger, or only a path-shaped one. That
   residue is larger than the entire law-in-stub cost.
3. **Leave both and move the target**, which D2 of the sibling roadmap forbids
   without the host publishing a different limit.

Nothing here recommends one. The point of recording the number is that the next
person does not have to re-derive it to argue.
