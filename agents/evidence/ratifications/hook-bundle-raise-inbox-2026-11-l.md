---
proposed_by: road-to-the-profile-the-session-runs-in 1.1, 2.1, owner invocation of inbox-2026-11-l
implemented_by: claude-opus-5.5 session on analysis/inbox-2026-11-l
reviewed_by: ai-council
subject: 5e48a5ca5a7829f54a48c9486dc53a3b52db9d06bf639f16448652180d333545
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Hook-bundle ceiling raised 1,562,000 -> 1,567,400 B for env-only profile detection on session_start and the provider-home resolver; no permission, tool or floor change.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/hook-bundle-raise-inbox-2026-11-l.question.md`, committed at `9571fd037106ee82ef22e43a4879e87e3c077e25` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
# Round 2 Review — Ratification of Hook-Bundle Ceiling Raise

## Agreement with Prior Reviewers

### Points of Agreement

**Reviewer A — Structural Analysis (substantially agree):**
- ✅ **No authority expansion**: Correct. The change adds read-only environment inspection with no new filesystem, credential, or network access.
- ✅ **Raise log accuracy**: The arithmetic is sound (5,386 B growth vs 5,400 B ceiling increase).
- ✅ **Type safety**: The `SessionProfile` discriminated union and null handling are correct.
- ✅ **Incomplete feature concern**: Reviewer A correctly identifies that the profile is *written* but no *reader* appears in this PR. This is a valid product-completeness observation.
- ✅ **Test coverage gap**: 9 branches in `session_profile()` with zero tests added is a legitimate concern.
- ✅ **Reviewer fatigue trap on "same terms"**: The comment at lines 260–263 could mislead a tired reviewer about implementation similarity vs optionality semantics.

**Reviewer B — Operational Pragmatism (substantially agree):**
- ✅ **Correctness of refactoring**: The `claudeHome()` abstraction is cleaner.
- ✅ **Security posture**: No injection vulnerabilities; NFC normalization in keychain service derivation is appropriate (though that function isn't in the critical path).
- ✅ **Documentation verbosity**: The raise_log is thorough but could contribute to review fatigue.

---

## Points of Disagreement

### Disagreement 1: "Incomplete Feature" Severity (Reviewer A)

**Reviewer A states**: *"The profile is written but not yet consumed. [...] Incomplete feature? Not a correctness bug, but shipping half a feature carries risk."*

**Disagreement**: This is *not* an incomplete feature in the sense that matters for this gate. The change is **Phase 1 of a documented roadmap** (commit message references `road-to-the-profile-the-session-runs-in 1.1, 2.1`). The session record schema is intentionally additive: old readers ignore unknown fields, and the `profile` field is explicitly optional (lines 260–263). 

**Why this pattern is correct**:
1. Session records are append-only artifacts; adding a field in one release and consuming it in another is standard practice for schema evolution.
2. The gate's concern is *authority expansion* and *correctness of what ships*, not *completeness of a multi-phase feature*.
3. Reviewer A's suggestion to document the migration plan is reasonable *product advice* but not a *correctness blocker*. The code already handles the "old sessions without this field" case by making it optional.

**Operational lens**: An operator deploying this sees a session record that grows by one optional field. The blast radius is: none, until a future release reads it. This is *low-risk incremental delivery*, not "shipping half a feature."

---

### Disagreement 2: Dead Code in Bundle (Reviewer A)

**Reviewer A states**: *"Line 150–152 (raise log): 'Room was looked for first: `sessions_cli.ts` (16,380 B) rides in through `env_session_id` [...] but extracting those is an unrelated refactor.' This means the bundle carries 16 KB of unused CLI code."*

**Disagreement on severity**: The raise_log explicitly says the author *considered* extracting it but deemed it "an unrelated refactor of two hooks and a CLI." This is **correct judgment** under the project's own doctrine (line 5 of the budget file): "a bundle is rebuilt from source on every run," so churn from unrelated refactors would itself trigger raises.

**Why the 16 KB is not a blocker**:
1. The `sessions_cli.ts` code is pulled in *transitively* through `env_session_id` and `other_worktree_branches_detailed`, which the hook legitimately needs.
2. Extracting those functions into a shared module is indeed a separate refactor (would touch multiple call sites, require its own tests, etc.).
3. The project explicitly sizes the ceiling with ~2.3% headroom (line 5) for exactly this kind of transitive inclusion.

**Operational lens**: An operator running this code pays the bundle-size cost once per hook invocation. The 16 KB is not executed (tree-shaken or unreachable), so runtime cost is negligible. The maintenance burden is: "future refactor could reclaim this," which is already documented. Not a dealbreaker.

---

### Disagreement 3: Tree-Shaking Uncertainty (Reviewer A)

**Reviewer A states**: *"The rest (`codexHomeInfo`, `geminiHomeInfo`, `claudeKeychainService`) are dead code in the bundle unless tree-shaken. [...] If they are NOT shaken, the 903 B claim is wrong."*

**Disagreement**: The raise_log cites a *measured* bundle size (1,566,892 B) from running `check_hook_bundle_composition` on the branch. This measurement is **post-esbuild**, so tree-shaking has already occurred. The 903 B figure for `provider_home.ts` is what *actually made it into the bundle*, not the source file size.

**Evidence**: The commit message says "measured with `check_hook_bundle_composition` on the branch" and the gate reads the metafile (esbuild's output). If unused exports were included, they'd be in that 1,566,892 B total. The raise_log doesn't need to prove tree-shaking worked; the measurement already reflects reality.

---

## New Points Not Raised in Round 1

### New Point 1: Missing Environment Variable Validation

**Observation**: `session_profile()` (lines 292–300) reads `CLAUDE_CONFIG_DIR` and `CODEX_HOME` and passes them through `path.basename(path.resolve(raw.trim()))`. 

**Edge case not covered**:
- What if `raw` is an empty string after trim? `path.resolve('')` returns `process.cwd()`, and `basename(cwd())` would be the current directory name, which could be `.git` if the hook runs from there.
- **Impact**: A session in a repo named `.git` with `CLAUDE_CONFIG_DIR=""` (empty but set) would record `profile: {provider: "claude", name: ".git", via: "env"}`, which is nonsensical.

**Correct fix**: Line 296 checks `raw.trim() === ''` and continues if empty, so this is actually *handled correctly*. The loop only processes non-empty values. **No bug, but the code is defensive in a way that's easy to miss.**

---

### New Point 2: Profile Detection Order Is Underdocumented

**Lines 292–294**: The code iterates `[['claude', 'CLAUDE_CONFIG_DIR'], ['codex', 'CODEX_HOME']]` and returns the first non-empty match.

**Operational consequence**: If a user has *both* `CLAUDE_CONFIG_DIR` and `CODEX_HOME` set (plausible in a multi-tool environment), the session records `provider: claude`. This is:
1. A policy decision (Claude takes precedence).
2. Not documented in the function's docstring (line 278 only says "a manually set CLAUDE_CONFIG_DIR (then CODEX_HOME)").

**Risk**: When Codex profiles are added, operators debugging "why is my session tagged `claude` when I'm running Codex?" will have to read the source. This is a *minor documentation gap*, not a correctness issue, but it's new surface area.

**Recommendation**: Add a comment at line 292: `// Precedence: Claude > Codex when both env vars are set.`

---

### New Point 3: Agent-Switch Profile Parsing Is a Trust Boundary

**Line 287**: `const as = detectAgentSwitchProfile(env);`

**Critical observation**: This function is *not in the diff*. Reviewer A noted this as a "trust dependency," but neither reviewer asked: **What happens if `detectAgentSwitchProfile()` throws?**

**Failure mode**:
- If that function has a bug (e.g., invalid path parsing), it will crash `session_profile()`, which will crash `build_record()`, which will crash the `session_start` hook.
- **Blast radius**: All sessions for all users in repos where the agent-switch path exists but is malformed.

**Mitigation check**: The diff shows `build_record()` does *not* wrap the `session_profile()` call in try-catch (line 595). If the hook runner has global error handling, this is fine; if not, this is a **latent operational risk**.

**Correct assessment**: The gate's concern is "does this PR expand authority?" (no) and "is the raise accurate?" (yes). Whether `detectAgentSwitchProfile()` is hardened is a *pre-existing condition* of pulling it into the bundle. If it's already used elsewhere in the codebase, this PR doesn't make it riskier. But an operator should know: "This hook can now fail if agent-switch profile parsing fails."

---

### New Point 4: The Keychain Service Function Is Unexplained Weight

**Lines 98–102 of `provider_home.ts`**: `claudeKeychainService()` computes a hashed suffix for the keychain service name when `CLAUDE_CONFIG_DIR` is overridden.

**Why is this in the bundle?** Reviewer A noted it's not called by the hook, but neither reviewer asked: *Why does it exist in a file titled `provider_home.ts` when it's about keychain services?*

**Answer from code context**: The file is "The one place that decides where a provider CLI keeps its state" (line 2). The keychain service is *part of* that state (Claude Code writes credentials there), so it belongs in this module.

**Operational question**: If `claudeKeychainService()` is dead code in the hook bundle, why wasn't it split into a separate file (`provider_keychain.ts`)? The raise_log says "room was looked for first" but doesn't mention this.

**Assessment**: This is a *minor code organization smell* (mixing path resolution and keychain logic), but it's not a bug. The function is likely used by other CLI commands that share the module, and esbuild tree-shakes it from the hook bundle. The 903 B measurement already accounts for this. **Not a blocker, but a future refactor candidate.**

---

### New Point 5: The "What Would Have Caught It" Entry Is Recursive

**Line 156 (raise_log)**: *"what_would_have_caught_it": "Nothing earlier: the growth is the feature. Sized to the measurement plus about 500 bytes of rebuild jitter."*

**Observation**: Every raise_log entry says "nothing earlier: the growth is the feature." This is *correct* (you can't catch intended growth), but it makes the field **uninformative**. The field's purpose should be: "What process gap allowed *unintended* growth?"

**Why this matters**: If a future PR accidentally pulls in a 10 KB dependency, the raise_log will say "nothing earlier" again, and operators lose the ability to distinguish "we added a feature" from "we regressed."

**Recommendation for the gate's owners** (not this PR): Change the `what_would_have_caught_it` schema to require one of:
- `"intended feature growth"`
- `"dependency upgrade (unavoidable)"`
- `"process gap: [description]"`

This PR's entry is correct under the current schema, but the schema itself is weak.

---

## Operational Cost Assessment (Expanded)

**Reviewer A identified profile drift risk.** Expanding on that:

1. **Drift scenario**: Claude Code changes its profile-path formula (e.g., starts using XDG directories). Sessions registered under the old formula will say `profile: {provider: "claude", name: "default"}`, but the tool now reads from `~/.config/claude/default`. The session record is *stale*.

2. **Detection gap**: There is no "schema version" in `SessionProfile`. When the formula changes, old records are indistinguishable from new ones. An operator debugging "why doesn't AC see my profile?" has no way to know the session was registered under an old formula.

3. **Mitigation in this PR**: None, because the profile is not yet *used*. But when the reader lands, it should either:
   - Re-derive the profile at read time (making the recorded value advisory), OR
   - Add a `formula_version` field so drift is detectable.

**Operational burden**: Medium. The profile is environment-derived, so it's inherently volatile. The cost is: "every time a provider changes its config-dir logic, AC must either update the derivation or tolerate stale records."

---

## Final Synthesis

### What This PR Actually Does
1. Adds an optional `profile` field to session records, derived from environment variables at registration time.
2. Refactors home-directory resolution into a single module (`provider_home.ts`).
3. Pulls `agentSwitchProfile.ts` into the hook bundle to reuse existing profile-parsing logic.
4. Raises the bundle ceiling by 5,400 B to cover the measured growth.

### What It Does NOT Do
1. **Does not expand hook authority**: No new files are read, no credentials touched, no network calls.
2. **Does not ship a half-feature in a risky way**: The profile field is optional and ignored by all current readers. This is standard schema evolution.
3. **Does not introduce correctness bugs**: The logic is sound, null-safe, and type-safe.

### Risks Operators Should Know
1. **If `detectAgentSwitchProfile()` throws, the hook will crash.** This is a transitive risk from pulling it into the bundle, not a new bug in this PR.
2. **The 16 KB of `sessions_cli.ts` in the bundle is transitive weight.** Not a bug, but future refactoring could reclaim it.
3. **Profile detection has precedence rules** (Claude > Codex) that are not prominently documented.

---

## Disagreements with Reviewers (Summary)

| Reviewer | Claim | My Position |
|----------|-------|-------------|
| A | "Incomplete feature" is a concern | Disagree: Optional field + documented roadmap = correct incremental delivery |
| A | 16 KB of unused CLI code is "maintenance debt" | Disagree on severity: Transitive inclusion is expected; refactor is correctly deferred |
| A | "If tree-shaking didn't work, the 903 B is wrong" | Disagree: The 903 B is measured post-build, so tree-shaking is already proven |

---

## New Concerns Beyond Round 1

1. **Missing try-catch around `session_profile()`**: If `detectAgentSwitchProfile()` throws, the hook crashes. Not a bug in *this* code, but a latent operational risk.
2. **Profile detection precedence is underdocumented**: When both `CLAUDE_CONFIG_DIR` and `CODEX_HOME` are set, Claude wins. Should have an inline comment.
3. **The `what_would_have_caught_it` field in raise_log is uninformative**: Every entry says "nothing earlier," making it useless for distinguishing intended vs accidental growth.

---

**STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no**

**Why**: The change adds no authority, the raise-log arithmetic is accurate, the code is correct, and the optional profile field is a clean schema evolution. The "incomplete feature" concern is a misunderstanding of incremental delivery; the profile will be consumed in a later phase, and the optionality ensures old readers are unaffected.

**Highest-leverage change before merge**: Wrap the `session_profile(env)` call at line 595 in a try-catch that logs the error and returns `null` on failure, ensuring a malformed agent-switch profile cannot crash session registration. This costs ~5 lines and eliminates the single highest operational risk (transitive crashes from `detectAgentSwitchProfile()`).
```

### openai — `confirmed-non-expanding`

```text
1. I agree with Reviewer A's points regarding the authority expansion (none), raise log accuracy (it accurately reflects changes and reasoning), and correctness (no major bugs found). They also noted the potential reviewer fatigue due to verbose documentation and the lack of tests, which I concur are critical points. Reviewer B pointed out the clear abstraction improvements and security considerations, which I also agree with, noting no immediate security risks.

2. I disagree with Reviewer B on their stance being "ratified," as the PR has not addressed testing comprehensively. Although the structural changes are sound, they should not countenance a ratification without addressing the lack of testing, as highlighted by Reviewer A.

3. Another point not raised is the lack of discussion surrounding backward compatibility for existing session records without a profile, which could be significant when the profile reader functionality is added later. This could potentially impact the application's behavior and should be considered during implementation.

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no 

The single highest-leverage change the PR author should make before merge is to clarify the migration plan for session records lacking the 'profile' field and ensure comprehensive test coverage, primarily focusing on environmental configurations and edge cases introduced by these changes.
```
