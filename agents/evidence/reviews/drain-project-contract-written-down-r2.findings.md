<!-- evidence-type: review -->
<!-- completion-review: v1 | reviewed: 2026-10-13 | scope: c091aa3d1adde9507c78f87e15d3e28d7079c280a6f0b9c376ea1ac4b89fff57 | diff: 650b372276321d136a284e13ebf2123f22f4cd65 | reviewer: r2-fresh-subagent-drain-project-contract-written-down | author: claude-opus-5/drain-lane-c-20261013 | prompt_hash: 38329acfd78a6dfca64e76652afe2696c77afdc0e87afa1c56e7b0e9c3933ae1 -->

# Completion review round 1 — `drain/project-contract-written-down-20261013`

Reviewed at `650b37227`. Brief and diff:
`drain-project-contract-written-down-r2.review-input/`. Every finding below was
produced by running the code, not by reading it.

**Verdict: not sound as it stands.** Two defects are shipping-blockers on their
own — an append that writes a duplicate `permissions` key, reports success, and
silently discards every rule it claimed to add; and a classifier that turns a
bullet's *recommended* command into a deny rule. Four further findings are
rules enforced over less than they appear to cover, which is the failure class
the change names as its own. The shape of the change is right: the
classifier/adapter split, the textual splice, the consent default, and the
honesty notes about what the provenance gate does not prove are all better than
the baseline. The defects are in the places the change did not look.

## 1. The classifier

**1.1 — A bullet's *recommended* command becomes a deny rule.**
`src/install/noGoRules.ts:80-88`. `actionOf` lower-cases the whole bullet,
backticked token included, and never checks that the verb negates or that the
token is its object. Measured through the real code:

```
"Never run migrations in production - use `php artisan migrate --pretend` instead"
  -> command / Bash(php artisan migrate --pretend), Bash(php artisan migrate --pretend *)
"`npm run build` is the only sanctioned build command"
  -> command / Bash(npm run build), Bash(npm run build *)
"Use `bin/console` to run console commands"
  -> command / Bash(bin/console), Bash(bin/console *)
```

Each denies the thing the bullet prescribes. The first is the worst shape: a
correct no-go whose escape hatch is named in the same sentence, and the escape
hatch is what gets blocked. The one-backticked-token guard does not help —
these bullets carry one. The `run` branch short-circuits before the path test,
so `bin/console` renders as a Bash rule on the strength of the word "run"
appearing anywhere in the line.

**1.2 — Any dotted identifier is treated as a path.** `noGoRules.ts:110-113`.
`/\.[A-Za-z0-9]+$/` accepts `users.id`, `app.debug`, `v2.1`. The one case the
tests pin fails on a space, not on the dot, so the branch has no discriminating
test.

**1.3 — A `#` heading does not close the section.** `noGoRules.ts:218-223`.
Only `##` resets `inside`, so every bullet of every following top-level section
is classified as a no-go.

**1.4 — Fence tracking collapses nested fences.** `noGoRules.ts:209-216`.
`fence` stores one character, so a four-backtick block containing three-backtick
fences closes on the first inner fence. Low severity; it is the shape the skip
exists for.

## 2. The rendering, against the pinned page

**2.1 — A `!` token emits a gitignore negation that WEAKENS the existing deny
list.** `hostPermissionsAdapter.ts:97-99,115-123`. `Never edit \`!important/\``
→ `Edit(!important/**)`. The page: a deny pattern starting with `!` "carves the
paths it matches out of the `path` or `./path` rules listed before it".

**2.2 — Glob metacharacters pass through unescaped.** Same lines.
`reports/[2024]/` → `Edit(reports/[2024]/**)`, which matches `reports/2/` and
never the named directory. The page: "Rules you write yourself aren't escaped."

**2.3 — The two-row rationale is contradicted by the page it cites.**
`hostPermissionsAdapter.ts:104-113`, roadmap `:145-150`,
`no_go_classify.test.ts:124-131`. All three assert that `Bash(x *)` never
matches the bare command. The page, one line above the sentence that was read:
"A `*` at the end, with a space before it, also matches the bare command.
`Bash(ls *)` matches `ls`." The extra row is harmless; the claim is false, and
the roadmap calls it the step's "one non-obvious finding".

**2.4 — No caveat that a Bash deny row is prefix-matched.**
`noGoDenyRows.ts:94-124`. The page is explicit that `Bash(rm *)` misses
`/bin/rm -rf build/` and `bash -c '…'`. The consent screen shows the rows and a
provenance line and nothing else.

**2.5 — A read no-go emits no `Edit` row.**
`hostPermissionsAdapter.ts:111-113`. The page: "NotebookEdit isn't covered, so
add an `Edit` deny rule for paths no tool may change."

**2.6 — Rows are bare relative paths while the pinned example is `./`-anchored.**
Softened by deny-rule depth semantics, but `/migrations/**` is the shape the
page recommends for a project settings file.

**2.7 — The token is interpolated with no validation.**
`Never run \`foo(bar)\`` → `Bash(foo(bar))`, which `RULE_RE` accepts.

## 3. The settings-file append

**3.1 — BLOCKER: a non-object `permissions` produces a duplicate key, discards
every rule, and reports success.** `noGoDenyRows.ts:270-295`,
`no_go_deny_rows.ts:127-153`. `locate` returns a span only for `{`/`[`, so with
`"permissions": null` both branches miss and the root branch inserts a second
`"permissions"` key. Run end to end through the real CLI: exit 0, "1 row(s)
appended", and the written file parses to `{"permissions":null,"model":"opus"}`
— last key wins. The CLI's own guard compares only `permissions.deny` before
and after, both empty, so `lost` is `[]`.

**3.2 — `locate` carries a stale `pendingKey` across a closing brace.**
`noGoDenyRows.ts:168-181`. The second object in an array inherits the first
one's last key, so `{"permissions": [{"deny": 1}, {"a": 2}]}` matches on the
second element and splices a bare string into an object. The CLI's round-trip
parse catches it today, so it is not a data-loss path — but `appendDenyRules`
is exported with a docstring promising a valid splice.

**3.3 — The write-time guard is weaker than the claim it guards.**
`no_go_deny_rows.ts:134-142`. The module claims every byte outside the
insertion point is unchanged; the guard checks only that prior deny entries
survive, which 3.1 passes.

**3.4 — Cosmetic reformatting.** A tab-indented file gets a space-indented
entry; a one-line `"deny": ["X"]` is split across lines.

**No finding on:** braces and brackets inside string values, escaped quotes, an
unrelated `hooks.deny`, a string value spelled `"permissions"`, a non-string
entry in an existing deny array, the malformed-body refusal, the
already-present short-circuit, the empty-array and empty-root branches, and the
temp-file-then-rename write. All probed; all correct.

## 4. Tests that cannot fail for the reason they claim

**4.1 — The provenance gate does not check what its own comment says.**
`check_permission_deny_syntax.ts:44-48,106-129`. Measured with a mock over
`denyRulesFor` that drops every `Read(...)` row and every with-arguments `Bash`
row: no findings, test green.

**4.2 — The decline-path test is a tautology.**
`no_go_deny_rows.test.ts:200-208`: a `const` asserted against its own literal,
and an `appendDenyRules(body, [])` that early-returns. Neither line can fail.
The property is also untestable there — `planDenyRows` takes a string and has
no path to write to.

**4.3 — `src/scripts/no_go_deny_rows.ts` has no test at all.** It owns the
`--apply` gate, the unenforceable-host refusal, the pre-write loss check and
the rename. AC-3 is a criterion about this command, discharged by a prose
record of a manual run. Both §3 blockers live in the untested half.

**4.4 — The gate's time-dependent property never fires in CI.** Its only
carrier pins `--today` to the read date, so `expires` can never be reached.

**4.5 — No fixture discriminates** the dotted-identifier branch, the `!` and
character-class token classes, the `#`-heading boundary, or a non-object
`permissions`.

## 5. Claims the diff does not support

The `Bash(x *)` rationale (2.3); the FIXTURES comment (4.1); "every byte
outside the insertion point" as a claim about the shipped path (3.1); the
decline test's comment (4.2); "six rejecting shapes" in a header where there
are nine; AC-3's prose record of a manual run; and "a `Read` deny also covers
edits and writes" stated without the NotebookEdit exception (2.5).

## 6. Things the change says it does not do, which it does

- "A bullet the function cannot classify is `prose`, never a guessed row" —
  §1.1 and §1.2 are guessed rows.
- The unenforceable-host report renders Claude's spelling and closes with
  Claude's documentation URL without saying the rows are not that host's.
- The rows default to `.claude/settings.json`, the shared project file, with no
  statement anywhere the consumer sees that they will be committed and bind
  every developer on the repo.

## What I would require before merge

1. §3.1 — refuse a non-object `permissions`; never emit a duplicate root key.
   Add the strict byte-preservation check.
2. §1.1 — require the token to sit in a negated clause; anything unresolvable
   goes to prose.
3. §2.1 / §2.2 — reject `!`-leading and character-class tokens as prose.
4. §2.3 — correct the three copies of the claim, the archived roadmap included.
5. §4.1 — per-shape assertions; §4.3 — a test over the CLI's `--apply` path.

§1.3, §1.4, §2.4-2.7, §3.2, §3.4, §4.2, §4.4, §4.5 and §6 are reportable but
would not block on their own.
