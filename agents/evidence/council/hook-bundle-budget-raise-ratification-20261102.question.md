<!-- evidence-type: original-review -->

# Ratification prompt — hook-bundle budget raise for the web-launch chunk loader (verbatim, as sent 2026-11-02)

~~~text
Ratification review of one change to src/config/hook-bundle-budget.json, a file on this repository's ratification watched set.

subject: 9e31fa133e634a35c9e4d70c56a264a5ffc1876a5cd48fe46a81fa902e9534f6

Under this repository's governance (ADR-268 § 4), a change to a governance surface needs a record from a party other than its author, with one closed verdict:
- ratified: the change expands what an agent may do, and that expansion is approved
- confirmed-non-expanding: the change does not expand any authority, weaken any gate, or make an enforcing step non-enforcing
- refused: the change must not land

What the change does. The hook dispatch bundle (every hook event loads it) has a byte ceiling, max_bytes, enforced by check_hook_bundle_composition; a raise needs a raise_log entry whose `to` equals the new value. This branch adds a write-time pass to design_pass_hook: for an .html/.css file the agent just wrote, it reports a third-party resource loaded on first paint and an imprint citing a superseded statute (advisory, P2, exit 0). Inlined, the rows plus their provider register and supersession table put the bundle 30,568 bytes over. They were moved into a conditional chunk (web_launch_rows.chunk.cjs) loaded only for .html/.css writes; the chunk-require code was extracted from svg_rules_loader into a shared loadChunkExport so the second loader adds no copy. What remains in the bundle is the call site and the chunk path: measured +961 bytes against origin/main's two hook files in the same worktree. The change raises max_bytes 1,562,000 -> 1,563,000 with a raise_log entry, and registers a 13,000-byte ceiling for the new chunk (measured 11,326).

Diff of the gated file:
- "max_bytes": 1562000 -> 1563000
- raise_log += { date 2026-11-02, from 1562000, to 1563000, what_was_added: loader + webLaunchFindings call site, +961 bytes; why_it_could_not_be_avoided: the pass needs a call site and a way to reach its chunk, and the require logic is shared; what_would_have_caught_it: nothing earlier, the first wiring measured 30,568 over before the move }
- chunks += { entry src/scripts/hooks/web_launch_rows.ts, max_bytes 13000, derivation: measured 11,326 + ~15 % }

Answer each of these, one at a time, keyed by number:
1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

Close with exactly one line:
STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>
~~~
