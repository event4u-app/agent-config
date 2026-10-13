<!-- evidence-type: review -->
<!-- completion-review: v1 | reviewed: 2026-10-13 | scope: a7c4e0e697dbdf54a445fe2729ec1e83a4e8ddd311a8b6f4ffd62298fd86c089 | diff: 44dcf6e9b | reviewer: r2-fresh-subagent-drain-project-contract-written-down-round2 | author: claude-opus-5/drain-lane-c-20261013 | prompt_hash: 3198fd43ef82c6ff6938e2c1d9ea476c82d567c02f2549ba56710878cb805372 -->

# Completion review round 2 — `drain/project-contract-written-down-20261013`

Reviewed at `44dcf6e9b`. Brief and diff:
`drain-project-contract-written-down-r2.round2.review-input/`. Every finding
was produced by running the code against the real modules, and every
documentation claim was checked against the pinned page as fetched that day,
not against the quote in the source.

**Verdict: sound at the shipped boundary, with one false claim about the fix
itself.** Both round-1 blockers are closed on the path `/agents:init` actually
invokes: no probe gets the CLI to write a file that loses, reorders or corrupts
consumer content, and the three worst classifier shapes round 1 named are now
`prose`. Four things remain — one false claim in the comment that justifies the
blocker fix, the same duplicate-key shape one level down, a provenance control
that runs in no CI path, and a set of partial fixes.

## 1. Disposition of round 1's findings

| # | Disposition |
|---|---|
| 1.1 prescribed command becomes a deny row | partially fixed — the negation is satisfied anywhere in the line (§2.1) |
| 1.2 any dotted identifier is a path | partially fixed, with a regression (§2.2) |
| 1.3 `#` heading does not close the section | fixed for ATX, unfixed for setext (§2.5) |
| 1.4 nested fences collapse | unfixed, and now demonstrable as a leak (§2.6) |
| 2.1 `!` emits a gitignore negation | fixed |
| 2.2 glob metacharacters unescaped | partially fixed — a leading single `/` is not covered (§3.1) |
| 2.3 the `Bash(x *)` rationale is false | fixed, all three copies; the correction is accurate against the page |
| 2.4 no prefix-match caveat | fixed |
| 2.5 a read no-go emits no `Edit` row | fixed |
| 2.6 bare relative paths vs `./`-anchored | unfixed; round 1 under-stated the direction (§3.2) |
| 2.7 token interpolated with no validation | **was wrong** — the page: "Parentheses inside the specifier are literal". No action owed |
| 3.1 duplicate `permissions` key | fixed for `permissions`, open for `permissions.deny` (§4.2) |
| 3.2 stale `pendingKey` across a brace | fixed; the test discriminates |
| 3.3 write-time guard weaker than the claim | fixed in effect, false in its stated reason (§4.1) |
| 3.4 cosmetic reformatting | unfixed |
| 4.1 gate does not check what its comment says | fixed; the drop-`Read` probe now reds |
| 4.2 decline test is a tautology | fixed |
| 4.3 the CLI has no test | fixed — 12 cases; AC-3 re-discharged against it |
| 4.4 the time-dependent property never fires in CI | discrimination proven, substance unfixed (§5.4) |
| 4.5 no discriminating fixtures | partially fixed — the path side still cannot discriminate (§5.1) |

## 2. The classifier

**2.1 — The negation test is satisfied by a negation governing a different
clause.** `noGoRules.ts:88,222,229`. Measured:

```
"If no cache exists, run `npm run build`"            -> Bash(npm run build), …
"There is no need to run `npm install` — …"          -> Bash(npm install), …
"Not every change needs to touch `docs/`"            -> Edit(docs/**)
```

Round-1 §1.1's class narrowed, not closed: the fix requires a negation
somewhere, never that it governs the clause the token sits in.

**2.2 — `looksLikePath` refuses ordinary filenames and still accepts
non-paths.** `noGoRules.ts:172`. The `!/^[a-z]+\.[a-z]+$/` clause keys on
"all-lowercase, one dot", the shape of most filenames. Refused as prose:
`package.json`, `composer.json`, `main.go`, `index.js`, `app.py`. Still
rendered: `Users.id`, `my_table.id`, `A.b`. The comment names three excluded
inputs; the regex excludes a far larger class.

**2.3 — `Don't` is not a negation.** `firstWordIndex` builds `\bdont\b` with no
apostrophe tolerance. The tolerance that exists is applied to the action verbs,
none of which contains an apostrophe — dead where it sits, missing where it is
needed.

**2.4 — `CLAUSE_BREAK` fires on a hyphen inside a word.** `Do not edit the
auto-generated \`dist/\` directory` → prose, with a reason that is not what
happened. Conservative in direction; wrong in what it tells the consumer.

**2.5 — A setext heading does not close the section.** `noGoRules.ts:326`
matches ATX only.

**2.6 — The fence collapse is a reachable leak.** `noGoRules.ts:313-320` stores
one character, so a four-backtick block closes on its first inner three-backtick
line and a guide's copy-in example leaks through.

## 3. The rendering

**3.1 — A leading single `/` is mis-anchored, and the page warns about exactly
this.** `Never read \`/etc/passwd\`` → `Read(/etc/passwd)`, which in project
settings resolves under the working directory. The page: a single leading slash
"anchors at the settings source, not the filesystem root".

**3.2 — Bare relative paths reach further than the bullet reads.** For a DENY
rule a single-segment relative directory matches that name at any depth, and a
bare filename matches at any depth. The consent screen says where enforcement
stops; it does not say where it over-reaches, which is Risk 1.

**3.3 — No other rendering defect found.** The `Read` + `Edit` pair, the
two-row command rendering and its corrected rationale, the `/**` expansion, the
absence of `Write`/`NotebookEdit` rules, and the prefix-match caveat all match
the page.

## 4. The settings-file append

**4.1 — `isSingleInsertion` does not catch the defect its comment says it
catches.** Reconstructing round-1 §3.1's output and running the function
verbatim returns `true`: a duplicate key appended at one point IS the file plus
one contiguous insertion. What refuses it is the consented-row check. The
comment and commit `a815776b1` attribute the fix to the wrong line.

**4.2 — The duplicate-key shape is live for a non-array `permissions.deny`.**
Measured through `appendDenyRules`: a second `"deny"` key inside the same
object, the consented row shadowed, success reported. A string or object `deny`
instead throws `.filter is not a function` at the consumer.

**4.3 — Cosmetic reformatting, unfixed.**

**4.4 — No loss, reorder or corruption path survives to disk.** Probed across
twelve settings shapes; every one appends correctly or exits 1 with the file
byte-identical.

## 5. Tests and fixtures

**5.1 — The dotted-path fixture cannot discriminate.** `app.config.json` has
two dots, so it passes under both the old and new regex; the branch the fix
changed is asserted by nothing.

**5.2 — No fixture covers a non-array `permissions.deny`,** which is why §4.2
is live.

**5.3 — The gate's shape assertions cannot see the `Read` → `Edit` companion.**
Dropping the `Edit` row beside a `Read` leaves the Edit shape satisfied by a
different fixture.

**5.4 — The gate never runs in CI, and its only carrier freezes time.** No
Taskfile target, no workflow step, no coverage row. The one carrier pins
`--today` to the read date, so the `expires` verdict is evaluated against the
real clock by nothing. D7 makes that date the entire substitute for the
ratification record; the signal cannot fire.

**5.5 — No other tautological assertion found.** 91 tests pass; the
neutralisations red; `tsc --noEmit` is clean.

## 6. Claims the diff does not support

`isSingleInsertion`'s comment (§4.1, repeated in its commit message); the
`looksLikePath` comment's enumeration (§2.2); D7's "nine rejecting cases"
(an undercount); D7's "driven in CI" as applied to the staleness verdict
(§5.4); and commit `3435f5452`'s phrasing, which implies the archive index is
committed when it is gitignored.

Verified accurate: the corrected `Bash(x *)` rationale in all three copies; the
NotebookEdit exception; the prefix-match caveat; the `_structure()` measurement
the council record rests on; AC-3's re-discharge against the CLI test.

## 7. Things the change says it does not do, which it does

- "A BULLET THE FUNCTION CANNOT CLASSIFY IS `prose`, NEVER A GUESSED ROW" —
  §2.1 and §2.2 are guessed rows.
- Nothing the consumer sees says the rows land in a file the team shares, or
  offers `.claude/settings.local.json` as the per-developer alternative.

## What I would fix before merge

1. §4.1 — correct the comment; stop attributing the blocker fix to
   `isSingleInsertion`.
2. §4.2 — refuse a non-array `permissions.deny`, with a fixture.
3. §5.4 — register the gate so it runs against `asOf()` in CI, or amend D7.
4. §3.1 — refuse a leading single `/` as prose.

§2.1-§2.6, §3.2, §4.3, §5.1, §5.3, §6 and §7 are reportable and would not block
on their own; §2.2's false-negative half is the one most likely to be met by a
real consumer.
