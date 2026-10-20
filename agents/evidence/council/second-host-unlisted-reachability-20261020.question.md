<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-20, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Council question — remedy for `second-host-unlisted-reachability`

Context. A skills package installs ~300 skills for a coding-agent host ("the
second host", codex-cli 0.148.0). That host lists skills within an 8,000-character
budget; over budget it strips every description and drops entries from the
alphabetical tail behind a warning (measured: 406 dropped). To stop that, the
installer writes a per-skill policy file (`agents/openai.yaml`,
`policy.allow_implicit_invocation: false`) into every skill outside a computed
"resident set" (37 entries, 7,769 chars), so the listing fits and no warning prints.

Measured (two-armed): a policy-disabled skill is NOT in the model-visible skills
list, and the model answers "UNAVAILABLE" when asked to invoke it. Its SKILL.md
stays on disk and readable by a caller that knows the path.

The package has publicly promised (ADR-289, option "reach"): every skill is
reachable in one deterministic step with its declared semantics; presence on disk
is decided per host. The package's own reach report counts these skills as
`unlisted` (installed, not listed) and must not call that reach.

Constraints. This host receives the package's skills, commands and personas but
NO rules (so a rule telling the model "search the catalogue" never reaches it).
Adding a new authored skill to the package is effectively impossible (a CI budget
on the per-spawn skill catalogue has almost no headroom). The package already ships
a shell search: `agent-config route:explain --skills "<task>"` ranks every
installed skill by task and prints each row's name, description and path.

Remedies on the table:

(a) Give the host a retrieval path for a non-resident skill. Concrete shape
proposed: the installer writes ONE package-owned, installer-generated entry into
the host's skills root (not an authored skill, so it does not touch the catalogue
budget), always first in the resident set, recorded in the same ownership sidecar
and removed on uninstall. Its description: use when no listed skill fits the task,
or the user names a skill not in this list — N more package skills are installed
but unlisted. Its body: run `agent-config route:explain --skills "<task>"` (or
look up the named skill), read the chosen SKILL.md at the printed path and follow
it. The reach report then classifies a policy-disabled skill by the same rule it
uses for not-installed skills on the shell path: reachable when it declares no
host-applied keys, degraded when it does; it stays `unlisted` only if the finder
entry is absent. A live probe on the host verifies it before the acceptance
criteria close.

(b) Accept listing-scoped reach on this host and amend ADR-289's published promise
(owner-reserved, because it weakens a public commitment).

(c) Drop the resident set on this host and accept the host's own alphabetical
truncation plus its warning.

Questions:
1. Which remedy? Answer DECIDE with one letter, or ESCALATE if the choice is
   owner-reserved (weakens a published commitment / irreversible / external).
2. If (a): is the proposed shape sound, and what must the live probe show for the
   acceptance criteria "every non-resident skill is reachable by the package's
   deterministic triggers" to count as met? Name any defect in the classification
   rule.
