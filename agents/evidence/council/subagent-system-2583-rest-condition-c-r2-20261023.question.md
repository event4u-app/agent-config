<!-- evidence-type: analysis -->

# Condition (c), second round — remove it now, or keep it and add a pre-registered second reading?

Context and options are unchanged from round 1
(`agents/evidence/council/subagent-system-2583-rest-condition-c-20261023.question.md`). Round 1
split. Both seats agree that the comparison in `src/scripts/_lib/worker_reuse.ts:102-103` sets two
unlike quantities against each other (a whole transcript against fresh written-or-uncached
tokens, which excludes the cache-read prefix), and that the filed reading stays as the measured
result of the policy as implemented.

The two positions, stated neutrally:

- **(b) remove (c) now.** Inside the cache TTL, condition (b) already guarantees the replay is
  cache-read, which is the cost (c) was written to bound, and (d) bounds context growth; the data
  show resumed first calls writing 147 tokens against 863.5 fresh, with a higher verify-pass
  rate. Counter-condition named by that seat: a long cache-read context may still cost latency or
  quality the token figures do not capture.
- **(d) keep (c) unchanged in the shipped function and add a pre-registered second shadow
  reading** (option (a)'s like-for-like comparison, or a billing-weighted one) beside it, decided
  on a later window not used to choose it. Changing the function right after a reading it
  produced contaminates the evaluation; option (a) is itself not exactly like-for-like, because a
  resumed call also processes new instructions and task input.

Facts that bear on both:

- The reuse guard is shadow-only: nothing in the tree acts on the verdict; a flip to blocking
  needs the activation policy's four conditions and its own ratification (roadmap step 3.6).
- The reconstruction runs at report time over recorded ledgers and transcripts, so a second
  reading can be computed over the existing window and any later one without new spawns.
- The three pre-registered claims this window read (`warm-worker-cold-start-relief` ratio 0.170,
  `resume-non-inferiority` +10.9 pp, `fresh-spawns-per-drain`) do not use condition (c).

Choose (b) or (d) (or (a)/(c) as defined in round 1), give the deciding facts, the condition under
which your choice would be wrong, how the filed reading is labelled, and reversibility.
