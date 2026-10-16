<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-16, committed verbatim below
     this comment so the verdict beside it can be checked against what was
     asked. Only these two comment blocks were added afterwards. -->

# Council question — lineage gate: quote parsing and succession

Repository: event4u/agent-config. Gate: `src/scripts/lint_consolidation_lineage.ts`
(report-mode lint; reads `road-to-*.md` siblings in an inbox folder, compares the
parent set a consolidating file declares against the siblings present).

The roadmap being executed is `road-to-gates-that-read-what-was-written`, Phases 1
and 2. Two questions arose while executing it. Each has evidence below; please
answer each independently, with reasoning. Findings and alternatives not listed
here are welcome.

## Q1 — where the quote strip belongs

Current code, `frontmatterList()`:

```ts
// inline [...] branch, line 168
.map((x) => normalizeParent(x.replace(/["']/g, '')))
// block-list branch, line 177
out.push(normalizeParent((item[1] as string).replace(/#.*$/, '')));
```

`normalizeParent(raw)` takes the backticked span if any, else the first token
split on `[\s—–,;|]`, then strips a directory prefix, `.md`, and a `(N)` suffix.
It has 5 call sites: :168 (already strips quotes), :177 (does not), :198 (prose
bullet list), :218 and :231 (input is the content of a backtick span).

A block-list entry `- "road-to-x (note) — more"` therefore arrives as `"road-to-x`.

The roadmap text contains two statements that cannot both hold:

- Step 1.1 / AC-1: "`normalizeParent('\"road-to-x\" — note')` must equal
  `road-to-x`" — a statement about the helper's own output.
- Step 1.2 and decision D1: fix `:177` by adding `.replace(/["']/g, '')`
  "matching its sibling at :168"; "does not touch `normalizeParent` itself";
  rationale: "changing the shared helper would touch 4 call sites that are
  correct today".

Options seen so far:
(a) Fix only :177 as D1 says; write the 1.1 test against the block-list path,
    and record that the helper-level assertion in AC-1 is not what was built.
(b) Strip a leading/trailing quote inside `normalizeParent` (first-token
    branch), satisfying AC-1 literally; :168 and :177 then need no strip.
(c) Both: fix :177 per D1 and also make the helper tolerate quotes.

Which option, and why? If the helper changes, name any input at the other call
sites whose result would differ.

## Q2 — which siblings count as successors, not omitted parents

Step 2.1: "A sibling declaring `supersedes_proposals:` (or `supersedes:`) over the
consolidating file is reported as a succession, or not reported at all — never as
`omitted-sibling`." Step 2.3 / AC-2: re-running over the real round folder must
yield "exactly 1" finding, the prose-named ghost parent.

The real folder (gitignored, local-only) holds four `road-to-*.md`. Their
lineage frontmatter, with prose shortened:

- P (`road-to-power…`, the consolidating file):
  `supersedes: []`, `consolidates:` two quoted entries — one names sibling I,
  one is a prose title with no slug (shape: "AC × <title> (<author>, <date>) — <note>").
- I (`road-to-an-install…`): `supersedes: []`, `relates:` list naming neither P
  nor anything else in the folder by supersession.
- C (`road-to-a-consumer…`): `supersedes_proposals:` naming I, P and D.
- D (`road-to-a-default…`): `supersedes: []`, `relates:` list with an entry
  `slug: road-to-power-that-pays-its-way, relation: extends`, plus entries for
  files outside the folder.

After the Q1 fix and a 2.1 rule keyed on `supersedes_proposals:`/`supersedes:`
only, the gate would report two findings on P: the prose ghost, and
`omitted-sibling` naming D. AC-2's "exactly 1" therefore holds only if D is also
treated as downstream of P. D declares `relation: extends` over P in `relates:`;
it does not declare supersession.

Options seen so far:
(a) Implement 2.1 exactly as written (supersession keys only); AC-2 then reads
    2 findings, and the roadmap's "exactly 1" is recorded as a miscount.
(b) Also treat a sibling whose own `relates:` names the consolidating file with a
    directional relation (`extends`, or a defined set) as downstream.
(c) Treat any sibling whose own lineage frontmatter names the consolidating file
    at all as downstream.

Which option, and why? The roadmap's risk register item 4 says the exemption
must be "keyed on an explicit declaration, not on a date or an inference", and
that the inverse pair (the consolidating file declares nothing about B, B
declares nothing about it) must still report.

Also: step 2.2 introduces `unresolvable-parent` for "a parent named only in
prose, with no slug and no backticks", distinct from `missing-parent` ("a slug
that resolves to nothing"). Please state the test you would use to classify a
normalised entry as slug-shaped versus prose — e.g. after normalisation the
prose entry above becomes `AC`.
