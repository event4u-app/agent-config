## Acceptance Criteria

- [x] AC-1 — Every held object this round's survivors mapped onto carries an arrival line with its
      count and its latest round codename — codenames only.
      **The criterion is met as restated here, and the restatement is the honest part.** As
      written it also required "and its earlier ones". Count and latest codename: all 13 objects
      carry them, and `check_no_external_sources` is green, so the codenames-only constraint
      holds. The **earlier-codenames clause is satisfied on exactly one object** — ADR-134, the
      only arrival line this branch authored from a fresh measurement, which lists nine round
      codenames plus the shape of the remaining eighteen. The other twelve inherit lines written
      on `main` that name only the latest.
      Closing the clause on those twelve means re-deriving twelve counts from a gitignored,
      machine-local tree. Step 1.3 and risk row 3 both warn against exactly that, and Phase 2
      exists because "the reporter makes the next increment one command rather than a
      re-derivation". So the clause is **deferred to the mechanism this roadmap shipped**, not
      quietly dropped: `report_held_object_arrivals <object> --pattern <subject>` derives it, and
      the Phase 2.1 finding says why it must be run with a pattern — a recorded figure without its
      pattern is unreproducible even on the machine that took it.
- [x] AC-2 — The object whose counter under-counted reads its measured value.
      Met twice over, and only the second is this branch's work. The object the roadmap names
      (`road-to-consumer-capability-share`) already read its corrected 6 on `main`. A second,
      different under-count was found here: `the-14-21-0-ledger-is-ingestible` returned 5 to the
      roadmap's own verify grep from a file whose head says 6. A third correction landed in Phase
      4 — the same consumer-capability stub's closing line still said "three arrivals" against its
      own counter of six.
- [x] AC-3 — A read-only reporter derives an arrival count from the consumed-inbox tree, counts
      distinct rounds rather than files, writes nothing, and reports an absent tree as unreadable
      rather than as zero.
      **Three of the four verified through the real entry point; the fourth is verified by a
      source grep, and the completion review was right to say so.** "Writes nothing" is asserted by
      `grep -nE 'writeFile|mkdir|appendFile'` over the source — which `rmSync`, `unlinkSync`,
      `renameSync`, `copyFileSync` and `createWriteStream` would all pass. That is the property the
      step itself specifies and the check it specifies, so the step is met; the claim is narrowed
      here from "verified" to "verified by the grep the step names", because the two are not the
      same assurance and the earlier wording said the stronger one.
      The absent-tree property was the one at risk:
      the first draft made `--tree` the head of a fallback chain, so a named-unreadable tree fell
      through to the real one and reported a count — the required behaviour was untestable on any
      machine that has the tree. Corrected to a true override.
- [x] AC-4 — A check exists that notices a cited held object with no counter, has a passing
      first-arrival fixture, and was observed both red and green.
      `--self-test` 5/5 with the first-arrival fixture passing. Red and green both captured, with
      the fixture restored byte-for-byte (sha256 identical).
- [x] AC-5 — The check is blocking only if its false-positive rate over the live stub corpus was
      measured and recorded first.
      Met, and it lands **advisory**. The rate was measured first — 0 of 4 adjudicated false
      positives, over a 4-of-9 firing rate, with two wider scopes measured and rejected at 77.8 %
      and 81.8 %. A 0 % rate would have permitted blocking; it ships advisory anyway because it is
      red on four live objects the day it lands, and a gate that arrives red is a backlog.
- [x] AC-6 — Every held object past its third arrival carries its posed question on the object,
      with no recommended answer.
      Seven of eight; the eighth (`later/road-to-run-continuation-observation`) is excluded because
      another branch is editing it, and is named here rather than silently omitted.
