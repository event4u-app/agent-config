---
proposed_by: owner request in session cbb3709c (agent-config), 2026-11-26: session titles that sharpen, agent phrases them, /rename final, global switch on by default
implemented_by: claude-opus-5-5 session on feat/session-titles-that-sharpen
reviewed_by: ai-council
subject: 95e177dbecf213caff279ed810f8e2bc78e484dcf27e4bad6caea7236cab5c4f
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: ratified
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

An advisory claude user_prompt_submit concern asks the agent at prompt milestones to publish a sharper session title via session:title; a /rename title is final; sessions.auto_title (class A, default true, global) switches it off and hides refined titles; lazy chunk, no deny.

Verdict `refused`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/session-title-ratification-r3-20261126.question.md`, committed at `9de36ec5cffb397e546dd9cb1f3619b28d2447c9` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
# Ratification review: session-title concern

Reviewing the diff, test suite, and round-2 responses against the nine-question framework.

## 1. Behaviour changes beyond the stated

**Stated**: Nudges at milestones, writes sidecar titles, respects /rename.

**Unstated consequences**:
- Transcript tail (64 KiB) read on **every prompt** (tailHasCustomTitle) to detect /rename between milestones — adds I/O to the hot path.
- Full transcript streamed at every milestone (readHostTitles) to find both custom and AI titles — scales with transcript size.
- Nudge text (~200 characters) injected into context window at each milestone — token overhead accumulates in long sessions.
- State directory grows one JSON file per session touched; pruning after 60 days bounds it, but sidecar files persist indefinitely.
- sessions:catalog now reads two files per session (transcript + potential sidecar); Agent Switch gains the same overhead.

## 2. Authority boundaries

**Wider**:
- Agent can write files outside the transcript (sidecar via `session:title` CLI). **Bounded**: CLI refuses unless path is an existing `<session-id>.jsonl` file (transcriptFor validation, test line 162 asserts refusal).
- Agent receives unsolicited instructions (the nudge) not from the user. **Mitigated**: advisory-only (fail_closed: false), never blocks.

**Narrower**:
- 60-character cap on what the agent can publish (TITLE_MAX, enforced by sanitizeTitle, test line 158).
- User's custom-title acts as permanent veto; concern freezes on first detection (test line 92, round-2 fix (i)).

## 3. Silent weakening check

Round-1 and round-2 objections were addressed by **adding** safeguards, not loosening them:
- (b) Path validation added → test line 162 fails when removed
- (c) TITLE_MAX enforcement → test line 158 caps at 60
- (d) Freeze on /rename → test line 86 asserts counter stops
- (e) State pruning → test line 102 confirms removal
- (i) Tail check every prompt → test line 92 confirms freeze before milestone

Test count 77 → 78 (addition), CLI budget 132 → 133 (documented increase). No assertions loosened, no tests xfailed. **Clean**.

## 4. Bypass via other hosts

Concern binds only `platform: claude`, `event: user_prompt_submit`. Worker role drops it. By design — yaml comment: "no other host writes a title this could refine." Since fail_closed: false, there's nothing to bypass. The CLI respects auto_title setting and custom-title across all callers. **No bypass**.

## 5. Undo mechanisms

- **User**: `settings:set sessions.auto_title false` (global), or `/rename` (per-session veto)
- **Project**: `sessions.auto_title: false` in .agent-settings.yml
- **Rollback criteria**: ADR-305 names two failures (most nudged sessions lack sidecar, or >20% get custom-title after a refined one) → template default to false, binding dropped. Window: 30 days, floor 40 sessions.
- **State auto-prunes** after 60 days; sidecars persist but are informational only.

**Reversible** at multiple authority levels with objective thresholds.

## 6. Falsification and omitted criteria

**Stated measurements**: uptake (% with sidecar), correction (% custom-title after sidecar), 30-day window.

**Omitted**:
- **Quality gate**: measures adoption and override rate, but not whether refined titles are objectively better than original ones. A worse title that users don't bother to fix wouldn't trigger rollback.
- **Token cost**: nudge overhead vs. benefit not measured.
- **I/O latency**: tail-reading on every prompt not instrumented.

However: fail_closed: false + opt-out-able means catastrophic failure (nobody uses it, everyone overrides) will be caught. Quality is hard to measure objectively; override rate is a proxy. **Acceptable omissions** for an advisory, opt-out feature.

## 7. Smaller change trade-offs

**Could be smaller**:
- Skip tail-read on non-milestone prompts (only check at milestones) → misses /rename for a few turns but eventually consistent.
- Fewer milestones ([10, 50, 100, 200...] instead of [3, 8, 20, 45, 100, 200...]).

**What the larger change buys**:
- Tail-read every prompt: **immediate freeze** after /rename (round-2 objection i), not at next milestone. Cost: I/O on hot path. Justified by user-experience requirement.
- Frequent early milestones: titles crystallize as goal settles. Cost: more nudges, more tokens. Justified by "sharpen over time" goal.

Design choices align with stated requirements. The tail-read is the heaviest ongoing cost but addresses a specific UX demand (instant /rename respect).

## 8. Standing instruction weight

**Per-session overhead**:
- Tail read (64 KiB) on every prompt — persistent I/O cost
- Nudge text (~200 chars) at 1–6 milestones for typical session lengths

**Mitigations**:
- Worker role drops it
- `auto_title: false` disables
- /rename stops future nudges

**Not trivial**, but bounded and opt-out-able.

## 9. Untrusted content steering

**Attack vectors examined**:

1. **Arbitrary path write**: Session ID from host envelope, CLI validates `<session-id>.jsonl` exists. Test line 162 confirms refusal. ✓ Blocked.

2. **State directory exhaustion**: Tiny files (~200 B), pruned after 60 days, would need millions of sessions to fill disk. That's a host-level resource attack, not specific to this concern. ✓ Bounded.

3. **Downstream injection**: sanitizeTitle strips control chars (0x00–0x1F, 0x7F–0x9F) but **allows `<>` and other HTML-active characters**. If Agent Switch or catalog UI render titles without escaping, an agent could craft `<script>alert(1)</script>`. **Concern identified**, but:
   - Requires deliberate agent malice or prompt injection
   - Responsibility to escape output belongs to renderer (defense in depth)
   - **Same risk exists in ai-title already** — not new to this change

## Critical finding: HTML injection risk in titles

sanitizeTitle (line 60–63) allows angle brackets. If downstream renderers (Agent Switch GUI, catalog formatters) don't HTML-escape before display, crafted titles could carry XSS. This is **not new** to this change — ai-title has the same issue — but the concern remains.

**Highest-leverage mitigation**: Strip `<>` characters in sanitizeTitle, or document clearly that all title renderers MUST escape before display.

This is a **marginal security concern**, not a dealbreaker:
- Requires agent to craft malicious title
- Requires renderer to fail to escape (renderer's bug)
- Pre-existing in ai-title

## Shipping risk assessment

- **Blast radius**: Adds I/O to hot path, but fail_closed: false means cannot break sessions.
- **Rollback**: Multiple opt-out levels, objective criteria for template default flip.
- **Testing**: Comprehensive — 14 tests, positive and negative cases, regression coverage for all round-1/2 objections.
- **Concerns mixed**: No — this is purely session-title functionality, no unrelated changes.

## Verdict

The change is well-designed, thoroughly tested, addresses all prior council objections, and has clear rollback criteria. The path validation prevents arbitrary file writes. The opt-out mechanisms work at multiple authority levels. The I/O overhead is a performance concern, not correctness. The XSS risk exists in ai-title already and is the renderer's responsibility to mitigate.

**Single highest-leverage change before merge**: Add `.replace(/[<>]/g, '')` to sanitizeTitle (after control-char strip, before length check) to defend against XSS in downstream renderers that forget to escape. Alternatively, document in ADR-305 and the sidecar schema that readers MUST HTML-escape titles before rendering.

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `refused`

```text
1. **Behavior changes.** Claude sessions get a prompt nudge at prompts 3, 8, 20, 45, 100, 200, then every 200 prompts. The agent can publish a refined title to a sidecar; the catalog prefers a user custom title, then that sidecar, then the host title. `sessions.auto_title` defaults on. Beyond the stated behavior, catalog readers can see a refined title even when nudging is switched off, and state is frozen only when the hook observes a custom title in the transcript. The CLI’s custom-title check scans the whole transcript, but its `--show` path does not check the setting.

2. **Authority and safety boundary.** The change expands the agent’s ability to write a session title that affects catalog display. It bounds that authority to an existing transcript whose basename matches the session ID, caps title length at 60 characters, and refuses a write when a custom title is found. The setting is global-mergeable, but a project setting still wins, so the effective control is not strictly global as the template comment suggests. The hook is advisory and fails open.

3. **Whether it weakens its judges.** The supplied diff does not show a weakened assertion, deleted/skipped/xfail test, lowered threshold, or altered fixture semantics. The new tests exercise several important branches, and the described generated manifest comparison is against the correct merge base. I cannot independently verify the described checks or the omitted wiring changes from this excerpt.

4. **Other hosts and projections.** The binding is Claude-only, so other hosts’ session naming is not governed by this control. The CLI is also directly callable and does not authenticate its caller; the author’s rationale that local processes can already edit files is plausible, but means the CLI guard is a product behavior constraint, not a security boundary. The provided catalog projection gives custom titles precedence, though other readers such as Agent Switch must independently implement that precedence to honor it.

5. **Undo.** The stated rollback is to set the template default false and drop the binding. That stops new nudges and writes, but does not hide sidecars already written. Fully reverting titles requires removing sidecars, and the described control does not provide a cleanup or rollback command. A user can rename a session to supersede a sidecar in the catalog. Rollback authority and the exact revision to reverse are not fully specified in the supplied text.

6. **Falsification and omitted criteria.** Low uptake, or custom renames after a refined title in more than one session in five, are stated rollback triggers, with a 30-day window and a floor of 40 nudged sessions. The first trigger is not sharply defined: “most nudged sessions carry no sidecar” lacks a numeric cutoff. The window extension below 40 sessions also means a decision may be delayed indefinitely without a maximum observation period. A stale sidecar continuing to display after the setting is turned off is a user-visible behavior that should be included in the evaluation or made explicitly acceptable.

7. **Smaller change.** A smaller change could add only the opt-in title writer and catalog sidecar reader, without prompt counting, nudges, global setting plumbing, pruning, and roadmap metrics. That would not fulfill the owner’s chosen “agent itself” refinement at milestones. The broader scope is therefore tied to the requested behavior, but the sidecar’s persistence after disablement and the unbounded low-sample window are avoidable parts of the rollout design.

8. **Standing instruction weight.** Each milestone adds one instruction line to that prompt’s hook context, asking the agent to reconsider the title and potentially run the CLI. The hook is silent between milestones; the instruction is not a persistent standing rule across every prompt, though each later milestone session pays the extra context and attention cost.

9. **Untrusted content and bounds.** Prompt or transcript content could influence the title the agent chooses, but the title is sanitized, length-capped, and written only beside a matching existing transcript. The nudge embeds the session ID in command text without validating it there; `safeId` is used for state filenames, not for this injected command. If IDs can contain shell-significant characters, this creates a command-instruction injection risk. The CLI’s transcript basename check also does not resolve symlinks, so a matching symlink could place the sidecar beside a different target. These need explicit bounds or validation before merge.

STANCE: refused | CONFIDENCE: med | DEALBREAKER: yes
```
