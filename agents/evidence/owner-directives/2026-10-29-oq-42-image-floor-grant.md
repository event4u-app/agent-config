<!-- evidence-type: analysis -->

# Owner directive — a preamble grant for the image rights floor (OQ-42)

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-10-29 |
| Question | `agents/owner-questions.md` OQ-42 |
| Grants by itself | the decision to spend ~43 tokens of per-spawn preamble on the image floor's `routes_to`; it authenticates nothing on the platform |

Owner, verbatim: "OQ-42: a, gib die Tokens frei und setz es um" ("OQ-42: a, release the tokens and implement it").

## What it means

- `image-likeness-and-rights` routes to the six image skills, measured +43 tokens
  over the watermark 135,824.
- The grant is recorded in `src/config/preamble-payload-exceptions.json` as
  `oq-42-image-floor-routes-to`, expiring 2027-01-27. It is a loan: before
  expiry the payload must return to the watermark (an offset elsewhere) or a
  fresh grant must be approved.

## What it does not change

The ledger honours a grant only with an approving review on its pull request by
someone other than the author (`standing-payload-delta.yml`, "Verify exception
approvals"). This directive is the owner's decision; it is not that review.
