<!-- evidence-type: analysis -->

# Council question — two open steps of one roadmap: decide, or escalate with a pick

Open your answer for EACH item with exactly one word: `DECIDE` + the option you
pick, when the transition is not owner-reserved; or `ESCALATE` + the reserved row
it crosses AND still a recommended pick. Route options separately when they route
differently ("(a) ESCALATE, (b) DECIDE" is a valid answer). The roadmap's own
owner field is not the test; the transition is. Do not escalate because a
question feels weighty.

## The owner-reserved table (verbatim from this repository's decision-revisit-gate rule)

| Reserved to the owner | Council-decidable |
|---|---|
| Changes the project's purpose or a declared non-negotiable outcome | Any mechanism serving that purpose |
| **Lowers or removes** a recorded security / privacy / safety / data-handling floor | Strengthening a floor, or an equivalent swap above it |
| Irreversible or materially destructive | Reversible within the envelope |
| Spend or liability **above** a delegated threshold | Budgeted, threshold-bounded spend |
| Creates / removes / weakens a legal, regulatory, contractual, licensing, compatibility, or public commitment | Internal-only commitments |
| Governance self-amendment — reopening authority, quorum, escalation, this set | What the rules already permit |
| Cannot be bounded from available evidence | Bounded, with the evidence cited |

## Context

The package is a CLI installer that deploys agent configuration files. A consumer
project may carry `agents/installed-tools.lock`. Facts verified in the tree today:

1. `docs/contracts/agents-layout.md` records the lock as **source repo: local-only
   (gitignored)** and **consumer repo: tracked-durable** — "the project's tool
   manifest and team-reproducibility surface ... deliberately absent from
   `src/config/gitignore-block.txt` and adding it there would break that workflow".
2. `README.md:357`: "every tool you `init` is recorded in `agents/installed-tools.lock`
   (committed, machine-managed). New team members run `npx @event4u/agent-config sync`
   after cloning; CI gates drift with `agent-config validate`."
3. `src/scripts/install.ts:3517-3525`: a **global** install run from a consumer
   project that has project settings calls
   `_update_installed_tools_manifest(project_root, tools, 'global', ...)`, i.e.
   writes **global-scope** entries (files deployed under the user's home directory)
   into that consumer's tracked lock. Those entries carry `$HOME`-rooted paths of
   whoever ran the install.
4. Since the last merged PR, global-scope ownership has its own user-scoped record
   (an ownership ledger under the user's home), and the installer's preserve
   decision for global targets reads that ledger. `doctor` reads the ledger too.
   Whether any reader still NEEDS global-scope entries in the project lock
   (`sync`, `validate`, `doctor`, drift reports, `prune`) has not been audited.

### Item A — roadmap step 3.3 "Close the $HOME-leak gap"

Written verify line: `grep -c installed-tools src/config/gitignore-block.txt` ≥ 1
(and acceptance criterion AC-8's first half is the same grep).

- **(a)** Do it as written: add the lock to the consumer gitignore block.
- **(b)** Narrow fix: stop writing global-scope entries into a consumer's project
  lock (keep project-scope entries; the ledger is the global record), after
  auditing the readers in fact 4. Re-cut the verify line to that behaviour.
- **(c)** Re-cut the step and AC-8 to what already holds — the two documents
  agree on one rule for the consumer case — and record the `$HOME`-path leak in
  global entries as a separate owner question.
- **(d)** Leave both step and AC open, unchanged.

### Item B — roadmap step 3.4 "`adopt` and `reset` are flags, not verbs"

ADR-041 governs the controlled verb vocabulary (a new top-level verb needs its own
ADR). Nothing in the tree specifies what `adopt` or `reset` would do. The most
plausible meaning of `adopt` — "record the bytes I have as ours" — is exactly the
ownership assertion a previous council round declined to make automatically.
`reset` plausibly means "restore one file, a scoped `--force`". The step's verify
line ("`--help` lists no new top-level verb") passes vacuously today.

- **(a)** Implement both flags now with semantics the implementing agent chooses.
- **(b)** Close the step as satisfied by its verify line plus the routing decision
  ("if they ship, they ship as flags"), and move the unspecified behaviour into a
  separate stub for whoever specifies it.
- **(c)** Cancel the step (`[-]`), recording that the features are unspecified.
- **(d)** Leave it open.

For each item: the one-word opening, your pick, two to five sentences of reason,
and one `revisit-if` condition.
