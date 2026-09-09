## Acceptance Criteria

- [x] AC-1 — A session ending at a bound slot leaves a continuity record without
      model spend, and a session that did nothing substantive leaves none. The
      count comes from the concern's own state, never from file presence.
      Carried from the predecessor's AC-5.
      Measured 2026-09-08 through the real dispatcher, under
      `continuity.auto_record: on`: one authoritative record and no temp litter
      (`tests/hooks/continuity_writer_dispatch.test.ts`), none for a session
      that crosses the recycle threshold but not the substantive floor, and none
      for a session with no claimed roadmap. The threshold-crossed-but-not-
      substantive fixture is the one that separates the two: it proves the
      decision comes from the counters and not from the threshold, and a
      further fixture shows an existing record in the slot does not change the
      transformation. No provider, network or child-process import reaches the
      writer, asserted statically over its own import list.
      The default stays `off` per 1.2, so this criterion describes a capability
      the tree HAS and does not exercise by default — stated here rather than
      left for a reader to infer from a green box.
- [ ] AC-2 — `./scripts-run src/scripts/check_continuity_surface` reports
      exactly `0 / 0 / 1 / 1 / 0`, and no exclusion in its inventory represents
      a normal-path continuity mechanism that would change the vector if
      counted. Carried from the predecessor's AC-7b; the vector read
      `1 / 2 / 5 / 1 / 1` when this roadmap was written.
      **Still `1 / 2 / 5 / 1 / 1`, measured 2026-09-08 after Phase 1 closed** —
      unchanged, and unchanged on purpose. Phase 1 adds a producer for the
      artifact that is already counted (`recycle-envelope.json`), so it moves no
      axis; Phase 3 is where every axis moves, and none of its four steps is
      done. This is Risk 1 of this roadmap holding exactly as written: the
      writer landed, the retirements did not, and the gate's own output is what
      makes that impossible to narrate past.
- [x] AC-3 — Disabling any one of the three lifecycle switches restores
      pre-change behaviour for that handler and leaves the other two firing,
      proven by a test rather than by the rollback note that describes it.
      Measured 2026-09-08: `tests/hooks/continuity_switches.test.ts` drives the
      real dispatcher on both slots with an all-armed baseline and then one case
      per switch, each asserting ALL THREE outcomes so an entanglement fails
      rather than passes. Sensitivity: forcing `continuity.auto_record` on reds
      2 cases, forcing `continuity.run_checkpoints` on reds 1, inverting the
      checkpoint guard reds 5.
      One limit, named rather than papered over: for `memory.session_index` the
      case proves the OFF direction and the independence (the stop handlers are
      byte-for-byte identical either way), NOT the ON injection — with the
      switch armed a scratch workspace emits no `memory-index` block, because
      it carries no curated corpus. The injection half is covered by
      `tests/scripts/session_memory_index.test.ts`.
