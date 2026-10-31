<!-- evidence-type: analysis -->

# Owner directive — the owner approves payload grants; no second reviewer

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-10-31 |
| Scope | the standing-payload exception ledger (`src/config/preamble-payload-exceptions.json`) and its CI approval step (`.github/workflows/standing-payload-delta.yml`) |
| Grants by itself | approval of `oq-42-image-floor-routes-to`, and removal of the second-person review requirement for every payload grant |

The owner's words, verbatim, after the gate refused PR #2766 because
`oq-42-image-floor-routes-to` carried no approving review by someone other than
the author:

> "und oq-42 gebe ich frei. und das ist mein recht !!! ich will auch, dass du die fremdfreigabe komplett raus nimmst. ich bin nur 1 author. was ich sage passiert" <!-- md-language-check: ignore -->

("I approve oq-42, and that is my right. I also want you to remove the
third-party approval entirely. I am the only author. What I say happens.")

## What changes

- `oq-42-image-floor-routes-to` is approved; its `approval_event` names this record.
- The CI step passes `--approved` for every live grant. A grant is approved by the
  owner recording it in the ledger; no review by a second person is required.
- Unchanged: at most one active grant, expiry, measured repayment, and the
  shrink-only ratchet that refuses deleting a record.

## Undo

Restore the review query in the `Verify exception approvals` step and the
`approval_must_be_authenticated` contract line.
