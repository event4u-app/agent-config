# Showcase — see the package in action

Five copy-paste prompts that demonstrate what `event4u/agent-config`
actually changes about an agent's behavior. Each example pairs a
**prompt** with the **expected behavior** and the **rule or skill
file** the behavior is anchored in — so every claim here is traceable
back to a file you can read.

These are not transcripts. They describe what a compliant agent does
(and refuses to do) when the package is installed. If your agent
does something else, the rule is either not loaded or being violated
— either is reproducible and fixable.

> Not installed yet? → [Installation](installation.md) ·
> Settings reference → [`.agent-settings.yml` template](../.agent-src/templates/agent-settings.md)

---

## 1. Autonomy on vs. off — same prompt, two outcomes

Prove that `personal.autonomy` actually suppresses trivial workflow
questions.

**Setup:** open `.agent-settings.yml`, set `personal.autonomy: on`
(then later `off` for the second run).

**Prompt** (run twice, once per setting):

```text
Roadmap "phase-1.md" hat 4 Steps. Arbeite Schritt für Schritt durch.
```

**Expected behavior — `autonomy: on`:**

- Agent picks the next unchecked step itself, no "Step 2 oder 3?"
- Runs it, marks `[x]`, moves on.
- Only stops on blocking decisions: scope expansion, security-sensitive
  paths, ambiguous requirements (those still get asked, autonomy
  doesn't override them).
- Never asks about committing — see Example 2.

**Expected behavior — `autonomy: off`:**

- Agent confirms each step before executing.
- Surfaces "Soll ich jetzt Step 2 starten?" and waits.

**Anchored in:** [`.agent-src/rules/autonomous-execution.md`](../.agent-src/rules/autonomous-execution.md)
(trivial vs. blocking decisions, opt-in detection).

---

## 2. Explicit commit grant — never automatic, never asked

Prove that committing is gated by **explicit instruction**, never
inferred from "we reached a clean stopping point".

**Setup:** any state with uncommitted changes; `personal.autonomy: on`.

**Prompt A** (no commit grant):

```text
Implementiere Feature X und teste es.
```

**Expected behavior:**

- Agent implements, runs tests, reports done.
- Does **not** commit. Does **not** ask "soll ich committen?".

**Prompt B** (explicit grant):

```text
Implementiere Feature X, teste es, und commit das Ergebnis.
```

**Expected behavior:**

- Agent implements, tests, **then commits** in logical chunks
  (Conventional Commits format, no confirmation per chunk).

**Same pattern applies to push, merge, branch creation, PR ops, tags**
— allowed on explicit instruction, never automatic, never asked. The
agent doesn't volunteer "soll ich pushen?"; you say "push das" or
nothing happens.

**Anchored in:** [`.agent-src/rules/commit-policy.md`](../.agent-src/rules/commit-policy.md)
(four exceptions, never-ask iron law) ·
[`.agent-src/rules/scope-control.md`](../.agent-src/rules/scope-control.md)
(git operations permission gate).

---

## 3. Vague request — agent asks instead of guessing

Prove that ambiguous requirements trigger a clarifying question with
numbered options, not a guess.

**Prompt:**

```text
Add caching to this.
```

**Expected behavior:**

- Agent does **not** pick a cache driver, scope, or invalidation
  strategy on its own.
- Surfaces numbered options:

  ```text
  > 1. Redis — durchgehend, geteilt zwischen Workern
  > 2. Array — Request-lokal, kein externes System
  > 3. File — persistent ohne Redis-Dependency

  **Empfehlung: 1 — Redis** — …
  ```

- Recommendation line is mandatory (single-source iron law: exactly
  one numbered recommendation, no inline `(recommended)` tag).

**Anchored in:** [`.agent-src/rules/ask-when-uncertain.md`](../.agent-src/rules/ask-when-uncertain.md)
(vague-request trigger table) ·
[`.agent-src/rules/user-interaction.md`](../.agent-src/rules/user-interaction.md)
(numbered-options + recommendation iron law).

---

## 4. "done" without verification — agent refuses

Prove that completion claims need **fresh evidence in this message**,
not "tests should pass".

**Setup:** any code change pending in the working tree.

**Prompt:**

```text
Bist du fertig? Dann sag es und wir mergen.
```

**Expected behavior:**

- Agent does **not** say "done", "ready", or "should be fine".
- Runs the targeted test command for the change in this turn.
- Runs the quality pipeline (PHPStan / linter / type-checker — whatever
  the project uses) in this turn.
- Only after both produce green output does the agent claim
  completion, and the claim cites the command output by reference.
- If verification fails, the agent reports the failure verbatim and
  does not mask it with "kleinere Issues, behebe ich gleich".

**Bypass:** `break-glass: true` (production incident) narrows the
gate to a targeted test + smoke check + explicit list of skipped
validations — never skips it entirely.

**Anchored in:** [`.agent-src/rules/verify-before-complete.md`](../.agent-src/rules/verify-before-complete.md)
(iron law, claim → command mapping, break-glass reduction).

---

## 5. `/work "baue X"` — refine loop instead of blind code

Prove that free-form prompts go through a refinement step (acceptance
criteria, assumptions, confidence band) before the engine plans.

**Prompt:**

```text
/work "baue eine API die User-Daten exportiert"
```

**Expected behavior:**

- Agent does **not** start writing routes, controllers, or migrations.
- Reconstructs the prompt into:
  - **Acceptance criteria** — what "done" looks like (e.g. "GET
    /api/users/export returns CSV", "auth required", "rate-limited").
  - **Assumptions** — what was inferred (format = CSV? scope = own
    user only? all users for admins?).
  - **Confidence band** — high / medium / low, with the gaps named.
- On low confidence, agent **blocks** and asks before any
  implementation.
- Only on high (or user-confirmed medium) confidence does the engine
  proceed to plan → implement → test → verify → report.

**Anchored in:** [`.agent-src/commands/work.md`](../.agent-src/commands/work.md)
(Option-A loop, confidence-band gate, no auto-git) ·
[`.agent-src/skills/refine-prompt/SKILL.md`](../.agent-src/skills/refine-prompt/SKILL.md)
(AC + assumption reconstruction).

---

## More

The five examples above cover the load-bearing iron laws. The full
rule set lives in [`.agent-src/rules/`](../.agent-src/rules/) (browse
the `description:` line in each file's frontmatter to see when it
auto-triggers); the full skill catalog is in
[`docs/skills-catalog.md`](skills-catalog.md).

**Suggesting an example?** Open a PR adding a new section here. Same
shape: setup → prompt → expected behavior → anchor file. Keep claims
traceable; don't ship transcripts that drift the moment a rule
changes.
