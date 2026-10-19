<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-19, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Second round: what class of release note does a merged hook-carrier fix need, and where does it live?

Repository: `event4u/agent-config`, an npm package installed by consumers into AI coding hosts.

## Authority for this question

The repository owner delegated the resolution of open decisions to this council on 2026-10-18, verbatim: "versuche die offenen entscheidungen im ai council zu lösen". A first round on 2026-10-18 split 1/1 on this exact question (one seat: a `notice` named in the curated release head; the other seat: a `BREAKING_CHANGES.md` "Pending" row because some upgrades move from silent success to refusal). Under the delegation a split is not a resolution, so this is a second round with new input.

## The change

PR #2455 (merged 2026-10-18, squash `3f8c98e74`) made the installed claude hook command fall through to a dispatcher staged under `~/.event4u/agent-config/runtime/` after a project-local install and before `PATH`. On machines where every hook concern used to exit silently with code 0 (installs through `npx`, or hosts launched with a bare `PATH`), the dispatcher now runs — including three `fail_closed` guards: `block-no-verify` (refuses `git … --no-verify`), `block-kernel-rule-writes` and `block-plumbing-writes` (refuse agent writes to the package's own kernel rules and hook plumbing). They may refuse an agent's tool call for the first time after the upgrade. No setting, file layout, API or command is removed; no consumer action is needed for the install to keep working. On machines where the carrier already worked, nothing changes.

## What is new since round one

1. **The trailer loss is fixed.** PR #2479 (`b2d7b41ce`, merged 2026-10-18) makes the release read `Consumer-Impact:` from every trailer block, not only the body's last paragraph. Running the fixed parser on `3f8c98e74` today returns `{impact: "notice", recorded: true}`. So the next release records #2455 as `notice` in its machine-read impact map (`package.json` `agentConfig.impact`), without any manual step. The one-line fix-commit body inside that squash names all three guards: "fix(hooks): reach a staged dispatcher ahead of PATH, so block-no-verify, block-kernel-rule-writes and block-plumbing-writes run where they were silent".
2. **A major is coming anyway.** ADR-290 (2026-10-18) raises the Node floor as a semver-major, so the class of this note no longer decides whether the next release is a major.

## How the repository classifies

`Consumer-Impact` values: `none`, `automatic`, `notice` ("should read the release notes"), `action` ("must do something or the install breaks"). `BREAKING_CHANGES.md` lists "consumer-facing breaking changes, one per major", with a "Pending — landed on `main`, not yet in a released major" table the release moves into its per-major table. The curated release head has a "Behaviour changes" line a human edits at release time; the generator pre-fills it from the span but does not read impact trailers.

## Options (this lane's framing)

- **(B1)** breaking: a `BREAKING_CHANGES.md` Pending row now, naming the three guards;
- **(B2)** `notice`, not breaking: no Pending row; the release head's "Behaviour changes" line names the three guards, written at release time;
- **(B3)** `notice`, and no extra note beyond what the release now records automatically (the impact map plus the generated log);
- **(other)**.

## Answer format

One paragraph of reasoning. End with exactly these lines:

CHOICE: <B1|B2|B3|other>
OWNER-ONLY: <yes|no>

OWNER-ONLY is `yes` only if the decision requires a human action (a physical or forge/UI action, a human-run probe) or a governance self-amendment; otherwise `no`.
