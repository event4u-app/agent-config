## Acceptance criteria

- **AC-1** With the halt armed, no queue entry reads `dispatchable: true`, and
  the JSON and text outputs both say why.
- **AC-2** The re-dispatch procedure in `process-full-all.md` reads the halt
  (via the queue) before sending a fresh lane; a halted queue refuses it.
- **AC-3** One test drives the halt from a real settings file through
  `roadmap_drain_queue` to the dispatch decision, with no injected flag.
- **AC-4** Each misread above is a failing test first, then green.
- **AC-5** A resolved named blocker no longer masks an independent
  owner-reserved hold in the same step.
- **AC-6** No step currently classified correctly in the live estate changes
  class (before/after diff of `roadmap_drain_queue --json` over `agents/roadmaps/`).
