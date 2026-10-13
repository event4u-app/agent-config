<!-- evidence-type: review -->
<!-- completion-review: v1 | reviewed: 2026-10-13 | scope: aebcb54da4353551ffe18c23f34766268003ea2129c4c9f2f5c9f84a21c9ab39 | diff: 0eb2f5975 | reviewer: r2-fresh-subagent-drain-project-contract-written-down-round3 | author: claude-opus-5/drain-lane-c-20261013 | prompt_hash: f8582578dfe43d8f63119f34f6fa81568ed2e4270d19f9e65173b4e8f732a682 -->

# Completion review round 3 — `drain/project-contract-written-down-20261013`

Reviewed at `0eb2f5975`. Brief and diff:
`drain-project-contract-written-down-r2.round3.review-input/`. Every claim was
produced by running the code, and every documentation claim was checked against
the live page rather than against the quote in the source.

**Verdict: nothing would BLOCK a merge.** Measured green: `tsc --noEmit`,
`eslint` over all nine new files, `tests/install` (45 files, 529 passed / 1
skipped) plus the gate's suite, `lint_code_comments`, `lint_workflow_security`,
`check_kernel_edit_ratified` ("nothing to ratify" — D5's no-plumbing claim is
gate-verified), and the gate itself. No probe over 21 settings-file shapes
produced a result that loses, reorders or corrupts consumer content, or that
fails to parse; every refusal path exits 1 with the file byte-identical.

Three of round 2's four pre-merge items are closed and the fourth is closed in
substance. What remained was one open class the brief had named in advance —
the guessed-row class, narrowed a third time and still open — plus one defect
INTRODUCED by the fix for round 2 §2.5.

## 1. Disposition of round 2's findings

| # | Disposition |
|---|---|
| 2.1 negation governs a different clause | partially fixed — an equivalent class open (§2.1) |
| 2.2 `looksLikePath` | fixed for every input round 2 named; a stated residual |
| 2.3 `Don't` | fixed for the ASCII apostrophe; unfixed for `’` |
| 2.4 in-word hyphen | fixed; the comma-in-a-list sibling is open, with a wrong reason |
| 2.5 setext heading | **fixed, and the fix introduced a new defect** (§2.5) |
| 2.6 fence collapse | fixed — measured |
| 3.1 leading single `/` | fixed — `/etc/passwd` → prose, `//etc/passwd` → path, both correct |
| 3.2 over-reach not stated | fixed, with one residual shape |
| 4.1 `isSingleInsertion` comment | fixed |
| 4.2 non-array `permissions.deny` | fixed, with four fixtures; a sibling shape open (§4.2) |
| 4.3 cosmetic reformatting | unfixed; one instance is on the default path (§4.3) |
| 4.4 nothing reaches disk damaged | confirmed over a wider probe set |
| 5.1 dotted-path fixture | fixed |
| 5.2 no fixture for a non-array `deny` | fixed |
| 5.3 `Read`→`Edit` pairing control | partially fixed — the control exists, nothing discriminates it (§5.1) |
| 5.4 gate never runs in CI | **fixed** |
| 6 claims the diff does not support | fixed except the historical commit message; two new ones |
| 7 says it does not do / does | partially fixed — the shared-file half fixed; the guessed-row half open |

## 2. The classifier

**2.1 — The guessed-row class is narrowed a third time and still open.**
Measured: `"Don't forget to run \`npm ci\` before the tests"`, `"Never forget to
run \`npm ci\`"`, `"Do not hesitate to run \`make fmt\`"` and `"Never read
anything other than \`docs/\`"` all render deny rows over what the bullet
PRESCRIBES. The negation negates the omission of the action. Note the signature
of a partial fix: `except` is a break word and is caught; `other than` is not.

Not a blocker because nothing is written without the consent screen, which
prints each row beside `from: <the bullet>`. Round 2 classified the same class
as reportable; this is consistency, not leniency. It is the thing to fix first,
and after three narrowings a structural answer is worth more than a fourth word
list.

**2.2 — The extension list is correct for everything round 2 named, and its
comment overstates it.** `Dockerfile`, `Makefile`, `terraform.tfvars`,
`build.gradle`, `app.vue` fall to prose. Conservative direction, each with a
printed reason — a documentation overclaim, not a behaviour defect.

**2.3 — A curly apostrophe (U+2019) is not a negation,** and gerunds never
match (`"Avoid editing \`dist/\` directly"` → prose). Conservative; the reason
line is wrong about why.

**2.4 — A comma inside an enumerated verb list reads as a clause break.**
`"Never edit, rename or delete \`vendor/\`"` → prose with a reason that is not
what happened.

**2.5 — NEW DEFECT from the round-2 fix: a thematic break truncates the section
and eats the preceding line.** Every `^(?:=+|-{2,})\s*$` was treated as a setext
underline, including after a blank line or a list item where CommonMark makes
`---` a thematic break. Measured: a `---` separator drops every bullet after it
AND the one before it. The dropped bullets are invisible — no row, no reason
line — so the consent screen never mentions them. Conservative in direction,
which is why it is not a blocker.

**2.6 — Minor.** A heading indented up to three spaces opens nothing; only two
heading spellings are recognised. Both conservative.

## 3. The rendering

**3.1 — No rendering defect found.** Every quoted line in the pin and the
comments is verbatim on the live page, and every behavioural claim built on it
is correct — the trailing-`*` qualifier, the Edit-in-place-of-Write line, the
NotebookEdit exception, the unusable-pattern guarantee, `!` as a negation,
character classes, the single-leading-slash warning, `//` as the absolute form,
the three named Bash bypasses, and the any-depth deny table.

**3.2 — Residual.** The "reach FURTHER" block names the single-segment
directory case but not the bare-filename one, which the renderer routinely
produces.

**3.3 — Two low-probability tokens render a rule guarding nothing** — a URL and
a Windows path.

**3.4 — A duplicated rule is printed twice and counted once.** Cosmetic.

## 4. The settings-file append

**4.1 — No path to a lost, reordered or corrupted file survives to disk.**
Probed `appendDenyRules` over 14 bodies and `main()` over 7 more through the
real argv path, including CRLF, BOM, a brace inside a string value, a nested
`other.permissions.deny`, and both non-array shapes.

**4.2 — One shape round 2 did not name:** a DUPLICATE `permissions` key makes
`appendDenyRules` splice into the shadowed object. The CLI refuses it (measured:
exit 1, file unchanged), so nothing reaches disk through the shipped path.
Latent module-level defect with no fixture.

**4.3 — Cosmetic reformatting, unfixed, and one instance is on the default
path:** with no settings file, the created file ended `}}`.

**4.4 — CRLF files get LF insertions.** Valid JSON, mixed line endings.

## 5. Tests, fixtures and controls

**5.1 — The `Read`→`Edit` pairing control has no discriminating test.**
Deleting the pairing block leaves all 17 tests green: the only case that could
exercise it drops ALL `Edit` rows, which already trips the shape check.

**5.2 — Measured, not reasoned.** Replacing the splice with
`JSON.stringify(root, null, 2)` reds **four** tests across two files, not the
one the roadmap claims. The discrimination is real and stronger than claimed;
the claim is wrong.

**5.3 — Two refusal branches no test reaches** — defensive code with no
red-first proof.

**5.4 — Round 2 §5.4 is closed.** The workflow step runs the gate with no
`--today`, so the date resolves through `asOf()` and the `expires` verdict is
reachable. D7 was amended to say so.

**5.5 — No other tautological assertion found.**

**5.6 — The gate is not registered in `gate-coverage.yml`,** which D7 records
with a reason. It carries the `check_` prefix so it IS in the gate population;
the non-registration costs a minimum-scan floor and nothing else.

## 6. Claims the diff does not support

- The roadmap's "the same probe reds exactly one test" — measured four.
- Commit `3435f5452`'s "All ten steps and all four acceptance criteria" — the
  file carries six steps and four criteria, ten checkboxes in total.
- The extension list's "without guessing either way" (§2.2).
- Risk 1's "the guide documents removing one" — nothing in the guide or the
  init command told a consumer how to remove a deny row. The roadmap was
  archived with every criterion closed while this mitigation was never built.
  No acceptance criterion names it, which is why it is not blocking.
- Round 2's note on `3435f5452` stands and is unfixable in history.

**Verified accurate:** D5's `_structure()` measurement; D5's "no plumbing file
is touched and no ratification artifact is owed" (the gate says "nothing to
ratify"); D7's CI-step claim; AC-1's template claim; the council record and the
D5/D6 rows it supports; the corrected `Bash(x *)` rationale in all three
copies; the `init.md` projection.

## 7. Things the change says it does not do, which it does

- The never-a-guessed-row Iron Law, against §2.1's four measured rows.
- Round 2's shared-settings-file item is **fixed**.

## 8. Categories with nothing to report

Rendering against the pinned page; loss, reorder or corruption reaching disk;
invalid JSON produced; and the change being unsound — it is not. The split the
council required is real and held, the append is a genuine splice, the refusals
are deliberate, and the consent gate is where the design says it is.

## What I would fix before merge, in order

1. §2.1 — close the prescriptive-adjacency class, or stop claiming "never a
   guessed row". A structural answer is worth more than a fourth word list.
2. §2.5 — make the setext branch conditional on the popped line being a
   non-blank, non-list paragraph line.
3. §5.1 — a fixture that drops only the companion `Edit`.
4. §6 — correct the two counts and either build the removal documentation Risk
   1 names or record that the mitigation was dropped.

The rest are reportable and would not block on their own.

---

## What the author did with this round

All four were taken, in the order given.

1. **§2.1 — closed structurally, as the review asked.** The discriminator is an
   infinitive `to` between the negation and the action verb: it means the
   action is some other verb's object rather than the thing forbidden. That
   covers `forget`, `hesitate`, `fail`, `neglect` and the siblings nobody has
   enumerated, which a fourth word list would not. `other than` joined the
   clause-break list beside its already-caught `except`. Four measured bullets
   pinned.
2. **§2.5 — the setext branch now requires the popped line to be a paragraph**,
   so a thematic break after a blank line or a bullet is left alone. Two
   fixtures, both of which the previous version failed.
3. **§5.1 — a fixture that drops ONLY the companion `Edit`** now exists, so the
   pairing control is red-first.
4. **§6 — both counts corrected in place with the correction recorded**, not
   quietly swapped; and Risk 1's mitigation was BUILT rather than dropped. The
   consumer guide gains § "Removing a deny row your no-gos produced", which
   also states plainly why no command removes a row for you: a package-written
   entry and a hand-typed one are the same text in the same array.

**Left open, deliberately, with the reason:** §2.2's extension-list residual,
§2.3's curly apostrophe and gerunds, §2.4's comma-in-a-list reason text,
§2.6's indented heading, §3.2-§3.4, §4.2's duplicate-`permissions` latency,
§4.3's remaining cosmetics, §4.4's CRLF, §5.3 and §5.6. Every one is
conservative in direction — it produces fewer rows, never a wrong one — and
each is named here so the next reader inherits a list rather than a surprise.
The `}}` instance of §4.3 was fixed, because it is the one every consumer
without a settings file would have seen.
