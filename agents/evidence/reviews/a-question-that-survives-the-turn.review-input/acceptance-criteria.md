## Acceptance Criteria

- [x] AC-1 - A JSONL transcript whose single user turn is followed by two
      assistant entries, the first carrying a numbered-options block and the
      second carrying none, produces a turn-end refusal naming `pending-decision`.
- [x] AC-2 - The same shape with a genuine user prompt between the two assistant
      entries produces no refusal, and neither does a shape whose second entry is
      a tool call carrying no text.
- [x] AC-3 - `DETECTOR_IDS` in `src/scripts/_lib/turn_end_refusals.ts` carries
      five ids, and `docs/contracts/turn-end-detector-demotion.md` carries a
      pre-registered Q1/Q2 bar and sample floor for the fifth.
- [x] AC-4 - `end_review_nudge_hook` does not fire on a 5-line turn when the
      session baseline recorded 1,771 pre-session non-doc lines, and does fire on
      the unsubtracted count when the baseline's `head_sha` no longer matches.
- [x] AC-5 - `review-baseline` resolves in `CONCERN_REGISTRY`, in the manifest's
      concern block, and in every host's `session_start` row; no host binds a
      concern the registry cannot dispatch.
- [x] AC-6 - The two blockers above are recorded with owners and open status
      rather than resolved inside this roadmap.
