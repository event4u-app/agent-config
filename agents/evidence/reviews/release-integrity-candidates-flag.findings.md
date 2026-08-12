# Completion review — `commands ls --candidates` (release-integrity step 3.4)

**Reviewed:** full `origin/main...HEAD` delta, scope
`1c5028ba2177cdf3c5869b344e91b9700f04bb2fae6a509314fe5186861b80b4`
(head `bc6ba8693`), declared 2026-08-13. Neutral single-reviewer pass, prompt
recorded below.

## Ordering — stated rather than implied

The contract wants the artefact committed **before** the fixes (§2.5). It was
not: the reviewer returned while the branch already carried two commits, the
HIGH finding was a live wrongness in code written the same turn, and it was
fixed immediately. This record is therefore written **after** the remediation
and says so, instead of being backdated into the shape the ordering prefers.
What is preserved is the part that matters for auditing — the prompt, so a
reader can check what was asked.

## The prompt (recorded per `evaluator-independence`)

The reviewer was asked to review the full delta against `origin/main`, told
explicitly **not** to narrow the scope, given the changed-file list, and pointed
at named suspicion areas (empty input, missing optional manifest fields,
duplicate slugs, a `visibility` value outside the three known labels, cap
misreporting, flag interaction, tests that pass for the wrong reason, prose
claims the tree contradicts, bundle/gate breakage). It was told to report what
it actually found, "including nothing if you find nothing", and explicitly not
to assume any particular finding count. No expected verdict was supplied in
either direction.

## Findings

### F1 — HIGH — the bucket named canonical commands as the retirement class

The `replaces` bucket was labelled **"deprecation shims … the one retirement
class that is evidenced without a usage window"**. That inverts the field's
contract. `src/scripts/schemas/command.schema.json` states: *"Distinct from
`superseded_by` (set on the OLD shim pointing forward); `replaces` is set on the
NEW canonical command pointing back."*

Consequence on the shipped manifest: the report presented `git-commit`,
`git-pr-create`, `fix-quality`, `cost-profile` and the two `tests-e2e-*`
commands as the evidenced cut class. `git-commit` is `tier: 0`,
`visibility: visible`. A reader acting on the one class the report called
evidenced would have retired the current commit / PR / quality / e2e commands
and left the retired names alone.

Verified independently before acting, because a reviewer's load-bearing claim
has twice been falsifiable in this repo:

- `grep -rl '^superseded_by:' src/domains --include=command.md` → **0 files**.
- `superseded_by` is not emitted into the discovery manifest at all.
- `check_command_count_messaging` prints and CI-enforces
  **`196 files · 0 shims · 196 active`**.

So the repo would have published both **0** and **8** for the same phrase over
the same 196-command estate.

**Fixed.** The bucket is `absorbedNames`, rendered as `absorbed prior names`
with an explicit `NOT a retirement class` line and the arrow reversed to
`<- absorbed`. The real shim class is reported as **not computable from this
data**, naming `superseded_by` and citing the canonical 0-of-196 — rather than
substituting the inverse field for it.

### F2 — `task ci` is red with no in-branch path to green — HANDED BACK

Closing 3.4 makes the roadmap 12/12 with 0 deferred, so
`update_roadmap_progress --check` fails: the completed roadmap is unarchived.
The remedy it prints (`archive_completed_roadmaps`) refuses, correctly, because
three maintainer-owned blockers are open (`release-head-cadence-decision`,
`carrier-install-paths-decision`, `adr-221-acceptance`).

**Not fixed, deliberately.** Both available in-branch moves are wrong: archiving
by hand buries three open maintainer decisions, and re-opening a finished step
misreports the work. Confirmed scope, independently: the gate runs in **no**
GitHub workflow (`grep -rl` over `.github/workflows/` → no hit), so remote CI is
unaffected — verified at 36/36 pass on an earlier head. It bites whoever runs the
documented pre-PR pipeline locally, and it is the designed reminder to dispose of
the blockers.

### F3 — MEDIUM — `--candidates` silently discarded every narrowing flag

`commands ls --pack git --candidates` printed the whole 196-command estate with
no notice the filter was dropped; `--visible` still printed `internal 174`; and
`commands ls --profile bogus --candidates` exited **0** with a full report where
plain `ls --profile bogus` exits 1. A typo became a silent success.

**Fixed.** `--pack`, `--visible`, `--profile` and `--expanded` are refused with
exit 1 naming the offending flag, rather than ignored. Four assertions, one per
flag, plus a verified real-CLI exit code of 1.

### F4 — the flag's user-facing entry points had no coverage

No test invoked `runCommandsLs({candidates: true})`, `runCommandsCandidates`, or
the `--json` payload, and the test titled "never caps the structured payload"
asserted a record length rather than touching the JSON path.

**Partly fixed.** The refusal path is now covered through `runCommandsLs`. The
`--json` shape (`{candidates, reduction_owners}`, deliberately different from
`ls --json`'s `{commands}`) is still unpinned by a test; it was exercised
manually against the real manifest. Recorded as residual rather than claimed
closed.

### F5 — tests that asserted around their titles

Three were real and are fixed: the pack tie-break asserted only descending order
over a 3/2/1 fixture that never ties (now exercised on an actual tie); a filter
in the visibility test also matched the owning-packs block, so its variable did
not hold what its name said (removed); and the bucket-membership expectation
re-derived the implementation's own predicate, which is precisely what let F1's
inversion pass a green suite (now asserts **named** slugs).

The strawman `\bprune (this|these|now)\b` regex is dropped in favour of the
exported-constant assertion. The remaining constant-based assertions are
acknowledged as deletion-detectors, not behaviour tests — stated in the file.

### F6 — `--json` was unstable across input permutations

The visibility record seeded three known labels then appended unknowns in
first-seen order, so `{zeta, alpha}` and `{alpha, zeta}` produced different key
orders. The earlier fix had sorted unknowns in the **renderer** only, and the
byte-stability test compared rendered output, so it could not see the record.

**Fixed** in the builder; a test compares record key order across a reversed
input.

### F7 — dead assertion — fixed, removed.

### F8 — roadmap drift — fixed

The step's prose claimed "19 assertions" after a commit took it to 22 (now 30),
and it carried F1's misclassification into the permanent record. Both corrected,
and the three defects found before merge are now named in the step itself.

## Checked and clean — recorded so the absence is legible

Empty input (measured zero, no throw, no omitted section) · text-mode cap header
count is the uncapped length and the withheld count is derived, no misreport ·
every load-bearing prose claim verified against the tree and all true (`prune`
is a registered `delegate` verb; `utilization_report`'s entry guard is an argv
comparison with no bundle guard; `SKILL_CENSUS` disclaims usage evidence;
`check_artefact_count_messaging` excludes dated censuses by design; census dates
and counts match; 166-of-196 matches a real run) · `npm run typecheck`,
`npx eslint`, `npm run build:cli`, `npx vitest run src/cli/` (73), `task
preflight`, `check_cli_registry_budget_sync` (97 unchanged — synopsis text only),
`check_command_count_messaging`, `check_artefact_count_messaging`,
`check_no_roadmap_refs` all clean · duplicate slugs and missing optional fields
unreachable via the CLI on a schema-valid manifest.

## Residual, carried forward rather than closed

- **F2** — three maintainer blockers gate the local `roadmap-progress-check`.
- **F4** — the `--json` payload shape has no test.
- The report's three roadmap pointers are not gated: archiving one leaves the
  output pointing at a file that no longer exists.
