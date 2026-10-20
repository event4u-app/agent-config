# Council — the lazy-concern chunk bundled with two new concerns, refused 2/2

> **Type:** council-record. Round of 2026-10-20, both seats present before and after
> the run (`2/2 present … concluded`), nothing billed (subscription seats).
> Seven earlier rounds on this question returned `0/2 present` — DEGRADED, which is
> not a verdict and is recorded as such rather than as agreement.

## Verdict

**`refused`** — convergent, no split. Both seats refuse the change **as bundled**
and say the chunking may be ratifiable on its own once its fallback is proven.


## Seat — anthropic

Matze, independent assessment after reading both prior critiques:

## Verdict: **refused** — authority expansion via the two new concerns

---

## 1. Prior points I agree with

**Both Reviewer A and B** identified the core issue correctly:

- The chunking optimization itself is clean (latency-only fallback)
- `update-notice` spawning `upgrade --unattended` is **install-triggering authority** a fail-open advisory concern shouldn't have
- `update-auto-invite` adding **proactive user-question capability** to stop hooks is a new interactive surface
- The ring-0 file is a **rollout switch, not an authority boundary** — it's mutable and eventually changes from `no` to enable the behavior
- Both concerns should be pulled into a separate change with explicit ratification as authority expansions

**Reviewer A's stdin point** is valid: `Symbol.for(...)` creates process-global symbols. If the key isn't namespaced per-concern (e.g., `Symbol.for('stdin_' + concernName)`), cross-concern visibility is possible.

**Reviewer B's strongest counter-argument** correctly acknowledges that neither concern introduces a *new primitive* — upgrade and notifications already exist. But the expansion is **choosing when to invoke them**, not the primitives themselves.

---

## 2. Points I disagree with

None. Both reviewers converged on the same refusal with overlapping reasoning. The only gap is that neither could verify the branch/manifest directly, which they stated openly.

---

## 3. New points / refinements

**On the stdin override isolation:**

Reviewer A flagged the Symbol.for concern but didn't verify the actual implementation. I checked the description: "per-concern stdin override to `globalThis` under `Symbol.for(...)`". The critical question is **whether the symbol key includes concern identity**. If it's `Symbol.for('hook_stdin')` (shared), concerns can see each other's envelopes. If it's `Symbol.for('hook_stdin_' + concernName)`, they're isolated.

**Recommendation:** Verify the symbol key construction before any chunking lands. If it's shared, switch to `AsyncLocalStorage` or explicit envelope-passing (per Reviewer B's concrete alternative).

---

**On the "re-runs every gate" defense:**

The description says `upgrade --unattended` "re-runs every gate and holds its own lock". This is accurate but **irrelevant to the authority question**. The expansion isn't that upgrade bypasses gates — it's that a session-start hook now **decides to run it**. A concern choosing when to trigger a guarded command is still authority expansion, even if the command's own gates remain intact.

---

**On rollout vs. capability control:**

Reviewer B nailed this: the ring-0 file is a **rollout switch**, not user consent. Once it flips from `no`, the behavior activates for all users in that environment. That's deliberate (progressive rollout), but it doesn't make the concerns authority-neutral — it just gates *when* the expanded authority activates.

---

**Concrete next steps (agreeing with both reviewers):**

1. **Ratify chunking separately** after verifying:
   - Missing/malformed/incompatible chunks reach spawn fallback
   - Symbol.for key is properly scoped per-concern
   
2. **Pull the two new concerns** into their own change:
   - Declare them as authority expansions
   - Consider making `update-notice` read-only (report/stage only, no activate)
   - Gate `update-auto-invite` on an explicit user setting, not solely ring-0

3. **If automatic activation is intended**, ratify it as an expansion with:
   - Justification for why fail-open advisory concerns need these capabilities
   - Explicit user opt-in mechanism (not just a rollout file)
   - Tests proving the ring-0 gate actually blocks when expected

---

**Summary:** The chunking work is solid. The two new concerns expand hook authority and should be split out, declared as expansions, and ratified on their own merits. **Refused** as currently bundled.


## Seat — openai

Matze, verdict: **`refused`**.

I could not locate the named branch or the three gated files in the supplied workspace, so I checked the proposal’s stated behavior and the prior critiques—not the implementation. That limitation prevents confirming the chunk fallback and stdin isolation, but it does not prevent identifying the explicit authority expansion.

1. **Assessment: disagree**

The combined change is not non-expanding. The chunking may be an internal optimization, but the manifest additions grant lifecycle hooks two new decisions:

- `update-notice` may initiate `upgrade --unattended`, causing installation mutations without a contemporaneous user command.
- `update-auto-invite` may initiate an interaction with the user.

`fail_closed: false` and `severity: advisory` describe failure and classification; they do not constrain side effects.

2. **Strongest argument**

The decisive passage is that `update-notice` “may activate [an update candidate] on a LATER [session start] via `upgrade --unattended`.”

Existing upgrade gates constrain *how* installation occurs. They do not answer *who may initiate it*. Moving that decision into `session_start` expands hook authority even if the invoked command, locking, and safeguards already exist.

Likewise, the ring-0 record only makes `update-auto-invite` dormant today. Changing `ring-0-exit: no` later activates a capability already shipped in the hook system. That is a rollout switch, not user authorization.

3. **Strongest counter-argument**

Neither concern apparently introduces a new low-level primitive: upgrade already owns the mutation, notifications already exist, execution is throttled and gated, and the invitation is presently unreachable. If authority is defined solely by available process primitives rather than by which subsystem may decide to invoke them, the change could be considered non-expanding.

That definition is too weak here: delegation of initiation is itself meaningful authority.

4. **Specific technical findings**

- **Chunk failure:** Not established as “latency only.” `CONCERN_REGISTRY[script] ?? loadLazyConcern(script)` proves fallback only when the loader returns `null` or `undefined`. A missing, malformed, incompatible, or initialization-throwing chunk reaches the spawn path only if `loadLazyConcern` catches every relevant failure and returns null. Reviewer B is correct to require tests; Reviewer A’s unconditional “yes” is unsupported by the supplied evidence.
- **Global stdin override:** `Symbol.for(...)` bridges module graphs, but does not provide isolation. A single process-global slot can expose the wrong envelope during overlapping, nested, or re-entrant execution. Safe behavior requires proven serialization or concern/execution-scoped storage with guaranteed restoration. Reviewer B’s `AsyncLocalStorage` or explicit parameter recommendation is stronger than keying merely by concern name.
- **Ring-0 gate:** Reviewer B is correct that it is a rollout gate, not consent. Reviewer A’s claim that it is “gitignored” is unsupported by the artifact and should be discarded.
- **Advisory classification:** Asking a question can reasonably remain fail-open, but should require a user-controlled opt-in and strict interactive-environment checks. Automatically initiating installation should not be classified as merely advisory.

5. **Concrete next steps**

- Split the chunking work from both new concerns.
- Test missing, invalid, incompatible, and throwing chunks, proving each reaches the spawn fallback without changing observable hook results.
- Replace the shared global stdin slot with explicit envelope passing or `AsyncLocalStorage`; otherwise prove serialization and use scoped `try/finally` restoration with concurrency and re-entrancy tests.
- Keep `update-notice` read-only: notify or stage, then require an explicit user command or previously recorded opt-in before activation.
- Gate `update-auto-invite` with a user-owned setting; retain ring-0 only as an additional rollout kill switch.
- If automatic activation remains intentional, document and review it explicitly as an authority expansion under a capability tier that permits installation mutations.

**Summary: refuse the combined change; chunking may be ratifiable separately, but its fallback still needs proof, while both manifest additions require explicit authority treatment.**
