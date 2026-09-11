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
      concern block, and in the `session_start` row of `claude` — the one host
      binding its reader — and in no other slot; no host binds a concern the
      registry cannot dispatch, and the `worker` role drops it beside
      `end-review-nudge`.
- [x] AC-6 - The two blockers above are recorded with owners and open status
      rather than resolved inside this roadmap.

AC-6 held for the phases, and is left as it was written rather than reworded to
match a later state. The three blockers (not two - the count was wrong when the
criterion was authored, and a third was added by the neutral review) were
recorded open and none was resolved by the work the phases did. They were closed
afterwards, in a separate pass that produced the evidence each one asked for, and
the closure records sit in `## Blockers` above with the authority for each
disposition named. Two closed `premise-invalidated` and one on its own criterion;
none closed by a phase quietly deciding its own blocker, which is the failure AC-6
exists to prevent.
