---
proposed_by: the repository owner, in session on 2026-11-02 (OQ-60 answered 'wie empfohlen', then 'setz die offenen Punkte von OQ-60 um, mit PR')
implemented_by: claude-opus-5.5 session on feat/oq-60-containment-follow-up
reviewed_by: ai-council
subject: 0ab2faeecf681fe424278a4ba18eed486a91784c1e3f41228195d5673dc042fb
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

security_ops.plan joins class B: the answer to the containment plan offer is asked once per user and persisted with --source jit-answer; settings-ask-protocol names the key and counts four B keys.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/security-ops-plan-key-ratification-r2-20261102.question.md`, committed at `a30c38895c4bec81b17999bd73b3ad8adfa60d7b` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
Matze, reviewing the second-round ratification for `security_ops.plan` joining class B.

## Assessment: Mixed — implementation solid, scope questionable

The round-1 fixes worked. The provenance reader now correctly distinguishes "absent sidecar" from "unreadable sidecar" (line 95–96 in `security_ops.ts`), and stamped non-boolean values are `unanswered` rather than silently coercing to `no`. Tests confirm each edge case (lines 38–50 in the test diff). The entry points state that only the user's own reply is recorded, not project content.

But user-global persistence means one answer in a throwaway test project enables automatic plan drafting for every production codebase this user audits from then on, forever, with no context sensitivity.

---

## Strongest argument FOR

The change directly implements OQ-60 item 2's owner directive ("asked once per user"), and the provenance reader's conservative logic prevents malicious projects from hijacking the decision. Template default `false` means no auto-planning unless the user explicitly opts in, and manual override via `settings:set` or direct YAML edit remains available.

---

## Strongest counter-argument

**User-global scope with automated downstream action is too coarse-grained.** A single "yes" answer—perhaps given while experimenting with a side project—will cause the agent to invoke feature-planning and draft containment sections for *every* deployed project this user audits in all future sessions, without re-confirming context. There is no "yes for this project-type" granularity, no visibility into when the standing answer triggers action, and the entry points document neither a reset procedure nor a way to audit "which projects got auto-planned due to my old answer."

Consider: a user answers "yes" while learning the tool on a trivial demo app. Six months later, they run `/audit security` on their employer's production API gateway. The contain finding says `security_ops.plan: true — hand off to feature-planning, no question`, and a draft appears. The user may not remember the global answer or realize it applies here. The architecture conflates *willingness to see a plan once* with *standing authorization to draft plans for all projects.*

---

## Concrete next steps

**If you proceed (which the owner directive authorizes):**

1. **Document the reset path** in `audit/command.md` and `feature-planning/SKILL.md`: users can run `agent-config settings:set security_ops.plan false --source manual` or delete the provenance entry to make the offer reappear.
2. **Add introspection guidance**: recommend `settings:get security_ops.plan` so users can check their standing answer before it triggers action in a new project.
3. **Log when the standing answer fires**: when auto-invoking feature-planning due to `security_ops.plan: true`, emit a one-line notice: "Drafting plan (security_ops.plan: true, set 2026-11-02)". Visibility into automated action helps users notice unwanted triggers.

**If you want safer scoping (deviates from OQ-60):**

1. Make it per-deployment-signal or per-project-root rather than user-global—ask once per *context*, not once per *human*.
2. Keep user-global but add a lightweight re-confirm when auto-action would trigger: "You previously answered yes (2026-11-02). Draft a plan now? [Y/n]" — one keypress, but conscious.

---

## Answers to the nine questions

1. **Behaviour change**: First audit session offers and persists; subsequent sessions read the answer and either hand off to feature-planning (`true`), stay silent (`false` stamped), or offer once (`unanswered`). Follow-on: a stamped `true` is a standing authorization to draft plans for all projects this user audits, indefinitely.

2. **Authority boundary shift**: Narrower—nag-prevention (asked once). Wider—user-global persistence means the agent auto-invokes feature-planning across all projects based on a single prior answer; the provenance reader has authority to classify "decision" vs "unanswered."

3. **Does it weaken what judges it?** No. The contract count went 3→4 and both docs updated. Tests were added (not weakened)—the round-1 test asserting `unreadable + true → yes` now asserts `→ unanswered`. Provenance logic is *more* conservative (unreadable sidecar blocks decision).

4. **Workaround via other host?** No. Only user-global settings are read; per-project files cannot supply the answer (entry point states this explicitly, line 227 in `audit/command.md`). Provenance source validation (`jit-answer`, `manual`, `gui` only) blocks inference.

5. **Undo path**: User edits `~/.event4u/settings/.agent-settings.yml` directly or runs `settings:set security_ops.plan <value> --source manual`. Authority: the user, in their home directory. Against which revision: rolling back code stops reading the key, but doesn't delete the user's persisted answer (data, not code).

6. **Falsification / rollback criteria**: Observe users complaining they can't reset the offer, or that auto-planning triggered in an inappropriate project. Missing: telemetry on standing-answer firing, documented reset command, per-project escape hatch.

7. **Smaller change?** Per-project scope would reduce blast radius but violate OQ-60 ("once per user"). Session-scope would defeat persistence goal. Change is minimal for its stated goal; automation field is separate (project-local, validated to require levers).

8. **Standing instruction weight**: +1 user-global boolean, +60 lines reader logic, +75 lines tests. Per-session: 2 file reads (settings, provenance), may auto-invoke feature-planning. Weight is low—read-only except when user explicitly answers.

9. **Untrusted content steering**: User-global file (not project), boolean-only, provenance source validation, `auto-detected` rejected as non-deciding. A malicious repo cannot write settings, cannot inject provenance, cannot trigger `settings:set` without user action. Bounded by: home-directory scope, JSON schema, source whitelist.

---

**STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no**

The round-1 security issues are resolved. User-global scope may cause "why did this auto-plan?" friction in practice, but the owner directive explicitly chose "once per user," the user retains manual override, and the conservative template default prevents surprise enablement.
```

### openai — `ratified`

````text
**Assessment: agree with ratification, with medium confidence.** The supplied change supports an owner-authorized preference while preserving the boundary between drafting a plan and operating deployed infrastructure. This assessment covers the supplied evidence; I have not independently verified the commit, digest, projection identity, or test execution.

**Strongest argument:** the reader distinguishes an unanswered template default from an explicit refusal. In `planAnswer()`, only boolean values qualify, deciding provenance preserves both answers, and unreadable provenance produces `unanswered`. That makes persistent refusal possible without silently treating every existing installation’s default `false` as consent to suppress the offer.

**Strongest counter-argument:** “asked once” depends on agent behavior and intact provenance. The implementation persists answers, not whether an offer was presented. Dismissal, an interrupted write, or damaged provenance can cause another question. Conversely, a global `true` authorizes repeated planning across projects, although the original question sounds project-specific.

1. **Behavior and implied consequences.**  
   The gated rule adds a fourth class-B key and a sixth ask-producing key. The associated reader changes future containment findings: unanswered offers a question; recorded `false` suppresses it; recorded `true` directs planning without another question. Consequently, accepting once can initiate plans in unrelated projects, and declining once suppresses offers there too. It does not suppress the underlying finding. “Once per user” is therefore best understood as **once successfully answered and persisted**, not once displayed.

2. **Authority and safety boundaries.**  
   The agent’s permitted global settings writes expand by one named key. A recorded `true` also grants standing authority to draft containment plans when the trigger recurs. This is an expansion, so `confirmed-non-expanding` would be inappropriate. The execution boundary remains intact: the template and `/audit` prose authorize planning, while explicitly withholding lever construction and operation. Relative to round 1, malformed values and unreadable provenance narrow the automatic planning path.

3. **Whether the change weakens its judges.**  
   The shown diff does not delete, skip, or xfail tests, lower thresholds, or weaken a gate. The reported replacement of the unreadable-sidecar expectation changes a previously accepted behavior, but the new expectation is more conservative and follows a stated review finding; it is not silent accommodation of unsafe code. The claimed red-before-fix execution and the contract-derived key-list test remain unverified evidence here.

4. **Other hosts and projections.**  
   The artifact asserts byte-identical source and distribution rules; the distribution diff is not supplied. Feature planning now references the same CLI finding, reducing reader divergence. However, its added prose does not itself repeat `/audit`’s explicit user-reply-only recording restriction. This is a **medium, deferred integration risk**: shared rules may cover it, but the excerpt does not establish that every supported host loads and follows them.

5. **Reversal.**  
   The user can revoke standing planning permission with:
   ```bash
   agent-config settings:set security_ops.plan false --source manual
   ```
   This preserves an explicit refusal. Maintainers can revert the introduction patch against the identified `c18662ed13` state, following the applicable ratification process for the gated files. Code rollback should preserve user settings rather than erase decisions. Neither action automatically removes plans already drafted.

6. **Falsification and missing rollback criteria.**  
   A repeated offer after a successfully persisted refusal would falsify the main benefit. Planning after recorded `false`, or recording an answer supplied by project content, would demonstrate a boundary failure. The proposal omits explicit incident criteria: either boundary failure should stop further rollout pending correction. User-level `false` is a practical planning kill switch; unreadable provenance instead reopens the offer.

7. **Smaller alternative.**  
   Keeping the existing per-run answer would avoid global state but fail the owner’s persistence requirement. An explicit-only settings command could persist choices without adding a just-in-time question, but would sacrifice discoverability. The proposed scope is proportionate to the stated requirement; unrelated automation and workspace changes receive no approval from this verdict.

8. **Standing instruction weight.**  
   The gated rule adds one key and default, with count updates and no new slot or budget. The greater maintenance cost lies in the provenance semantics and two entry points. Keeping one reader is the strongest measure against that cost becoming behavioral drift.

9. **Untrusted-content steering.**  
   Project content can influence deploy detection and inventory absence, so it can steer the trigger. It must not supply the persisted answer. `/audit` explicitly enforces that distinction in prose; the reader itself verifies value and provenance shape, not whether a human actually supplied them. These stamps are decision metadata, not authentication.

Concrete follow-up: verify the exact digest and projection equality before recording this verdict; exercise both entry points with explicit refusal and hostile project text; and describe the promise as “once answered and persisted.” The remaining concerns are integration and wording limitations, not demonstrated dealbreakers in the supplied patch.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
````
