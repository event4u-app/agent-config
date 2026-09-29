---
proposed_by: claude-code session 5413debc (roadmap-process-full run, 2026-09-29)
implemented_by: claude-code session 5413debc (same session — see § Independence)
reviewed_by: ai-council, 2 of 2 seats present (anthropic, openai), 3 rounds
providers: [anthropic, openai]
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `drain/invocation-contract`

## What was proposed

Closing `road-to-an-invocation-contract-that-reaches-the-wire`. Four of the
thirty-one changed files are governance surfaces, which is why this record
exists:

| Surface | Change |
|---|---|
| `src/config/gate-coverage.yml` | four rows added, each `status: enforced`, with a `min_scanned` floor, a declared `ci_invocation` and a `no_canary_reason` |
| `.github/workflows/consistency.yml` | one step invoking those four scripts directly |
| `Taskfile.yml` · `taskfiles/ci-fast.yml` | the four task definitions and their place in the chain |
| `src/scripts/schemas/{command,skill}.schema.json` | an **optional** `inputs:` frontmatter block |

The rest of the diff — a census, a shrink-only placeholder ratchet, three
derivation checks and an MCP reader-versus-YAML parity gate — carries no
governance surface.

## Independence, stated rather than implied

`proposed_by` and `implemented_by` are the same session. That is the shape the
Iron Law forbids reviewing itself, which is why `reviewed_by` is the AI council
rather than another pass by this session: two seats, two providers, neither of
them the party that wrote the diff. Provider diversity is satisfied because two
providers are configured and both answered — `council:quorum · 2/2 present`.

An earlier in-session subagent review also ran on this branch and found four
defect classes, all fixed before this record was written. It is **not** cited as
the independent review: it is the same provider and the same session, so it
clears neither half of the bar. It is named here because its findings are in the
diff and a reader should know where they came from.

## Verdict: `confirmed-non-expanding`, 2 of 2

Both seats returned `confirmed-non-expanding` on the constitutional question.

**anthropic** inspected the branch and checked six things: all four gates are
`status: enforced` with floors; no existing gate was weakened (zero `min_scanned`
removals, zero status downgrades); the ratchet is seeded stricter than the
roadmap's figures *and* at the measured baseline for a **new** ceiling; `inputs:`
is optional, declarative, and creates no execution path; the `no_canary_reason`
justifications are correct for create-only checks; and the self-test claims are
verifiable. It tested the sharpest objection itself — whether an author-written
`no_canary_reason` is a self-exemption path — and answered that the field
**pre-dates this diff**, so using it is not the same as adding it.

**openai** could not reach the branch from its workspace and said so plainly,
scoping its verdict to the described delta rather than the implementation. It
agreed the classification is non-expanding, disputed the other seat's
evidentiary claims as shown-without-results, and withheld *merge* approval
pending inspection — a shipping judgement, not a constitutional one.

## What the review changed in the diff

openai named five conditions under which the ratchet would be unsound. Four were
already true (the budget is a committed file the gate only reads; growth fails;
each syntax is compared independently; an unreadable budget exits 2). **The
fifth was a real gap and is fixed in this change**: nothing rejected a *reduced
scan count* before the budget comparison, so a gate pointed at a moved or empty
root would have compared zero occurrences against its ceiling and exited green —
the false-green class the coverage manifest exists to refuse. All four gates now
call `assertScanned` **before** their verdict, and each carries a self-test case
that plants an empty root and requires a refusal.

That is the substantive reason this record is worth more than its frontmatter:
the review moved the code.

## What would have changed the verdict

Named by the seats, kept here so a later reader can re-test them rather than
re-derive them:

- any gate downgraded to `status: advisory`, or any existing floor, refusal or
  schema restriction removed;
- `inputs:` read by agent code to make an execution decision, or making
  arguments reachable that a host could not previously invoke;
- `no_canary_reason` creating a **new** exemption mechanism rather than using an
  existing field;
- the ratchet seeded looser than measured, updating itself, permitting growth,
  or silently scanning a narrower corpus;
- parsing errors or parity mismatches falling back permissively.

## Provenance

AI council, 2026-09-29 — 2 of 2 seats (anthropic, openai), 3 rounds, both
subscription-authed, nothing billed. The council config resolves user-global per
ADR-104 and was confirmed by `council:status` before the run, not inferred from
any project file.
