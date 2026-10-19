<!-- evidence-type: analysis -->
# The installed-layer total, measured environment-independently (2026-10-19)

Evidence for D7 of `road-to-an-installed-layer-that-is-thinned`, whose
`revisit if` column reads: *"a normaliser exists and is shown
environment-independent across at least two differing root lengths, or the
base-ref form is built; either reopens 3.2 without reopening D6."*

This page is the first of those two. It records the measurement only — no
ceiling, no gate, no stored baseline. The mechanism the council returned
REQUEST_CHANGES on (2026-10-12, one seat present, openai seat `os_error:
ENOBUFS`) was a stored baseline over an **un-normalised** figure; that
mechanism is untouched and stays rejected.

## What was measured

The real rule corpus at this branch — `dist/agent-src/rules`, 121 files —
copied into a temporary directory and thinned by the installer's own
`thinInstalledRuleLayer`, twice, with nothing different between the two runs
but the root its `Body:` pointers are built on:

- `/r` — 2 characters
- `/a-considerably-longer-staged-runtime-root-directory` — 52 characters

Both directories were then read by `readLayer` from
`src/scripts/_lib/installed_layer.ts`, which is the same reader the
installed-layer report, the install receipt and `doctor` call.

## The reading

| root | files | `chars` (raw) | `normalised_chars` |
|---|---|---|---|
| `/r` | 121 | 111,084 | 106,806 |
| `/a-considerably-longer-…` | 121 | 116,084 | 106,806 |
| delta | 0 | **+5,000** | **0** |

The prefix differs by 50 characters and the raw total differs by 5,000 — one
character per stub per character of prefix, over the 100 stubs this corpus
thins. That is the defect D7 names, reproduced at full size: a stored ratchet
over `chars` would lock at the shortest path any runner ever had.

`normalised_chars` is byte-identical across the two. It is also not a constant:
it is 4,278 below the raw figure at the short root, which is the pointer text
the substitution ate, and it still counts every character that is not a path.

## What the normaliser does

`src/scripts/_lib/installed_layer_normalise.ts` substitutes every absolute path
— POSIX and Windows-drive — with the fixed token `<abs>`. Substituted rather
than stripped, so a stub that carries a pointer and one that does not still
read differently. The function is pure, total and idempotent; the token carries
no separator, so a second pass finds nothing to replace.

It does **not** answer "what does the host load". The host loads the real text,
absolute path and all, and `chars` stays the figure for that question. The
report now prints both, adjacent and labelled, because a reader who sees one
number cannot tell which question it answers.

## Reproduce

```
npx vitest run tests/scripts/installed_layer_normalise.test.ts
./scripts-run src/scripts/installed_layer_report | grep TOTAL
```

The suite carries the two-root case directly: the same fixture corpus staged
under two root lengths, asserting that the raw delta is exactly
`stubs x prefix-delta` and that the normalised delta is zero. Both halves are
asserted — a test that only pinned the normalised equality would also pass over
a corpus that was never environment-dependent, and would prove nothing about
the defect above. Sensitivity checked by neutralising `normaliseLayerText` to
the identity: 5 of 10 cases go red, including the two-root one, while the raw
control stays green.

## What this does not settle

3.2 stays open. Its text asks for a ceiling "above the measured thinned total
plus 10 %, never above 75,000", and the normalised total is 106,806 — plus
10 % is 117,487, and the floor of the two bounds is 75,000, which would be red
on `main` the day it landed. The corpus is still roughly 38,000 characters
above where a 75,000 ceiling could mean anything, and that is a matter for the
full-bodied set rather than for this measurement. What changed is that one of
3.2's two reasons for being open is now discharged: the measurement exists and
is environment-independent. The remaining reason is the corpus.
