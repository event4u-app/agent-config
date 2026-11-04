# Council verdict — b-history-credential-store-vs-egress-contract

- **Date:** 2026-11-04
- **Delegated by:** the repository owner, in chat: "zu dem blocker, entscheide den im ai council".
- **Prompt:** `history-credential-store-blocker-20261104.question.md` (this directory), sent
  unchanged in both runs. It states both options without a recommendation.
- **Members:** anthropic (Claude CLI), openai (Codex CLI). Subscription transport, USD 0.00.
- **Verdict:** `option-1` — unanimous (2/2).

## Runs

1. Two rounds at `--effort high`. The anthropic seat answered `option-1`; the openai seat
   answered round 1 and timed out at 300 s in round 2. Round-1 texts are not persisted, so the
   openai verdict of that run is not recoverable. The run is not counted.
2. One round at `--effort medium`, same prompt. Both seats answered `option-1`. This is the
   counted run. It was re-run because a verdict was missing, not because one was unwelcome.

The openai seat ran on the agent-switch account (`CODEX_HOME` set to the profile that
`agent-switch dir --provider codex` returns): the default codex login was at its usage limit.
PR #2844 makes the council do that itself.

## Reasons given

- **anthropic:** "never stored" is a deliberate floor, and every exception adds risk. A 7-day
  disk copy is exposed to a stolen laptop, malware, and filesystem bugs. Most agent tasks finish
  in minutes, so asking for a credential again costs little.
- **openai:** the contract is a categorical boundary. Option 2 would make credentials persistent
  and recoverable, which needs a new security design, not reuse of the egress layer.
  Record the departure from OQ-34 explicitly. Define remediation for existing plaintext history
  and test representative credential formats.

## Counter-argument both named

A credential pasted into a session may have no source it can be re-derived from, so option 1
can interrupt work and make the user paste it again.

## Revisit if

A demonstrated workflow needs a credential across sessions, and an approved threat model
justifies amending `docs/contracts/egress-placeholders-v1.md`. Any such design must expire on
time, not only on a read or write: a store that is only purged on access can stay on disk past
7 days while idle (named by both seats).
