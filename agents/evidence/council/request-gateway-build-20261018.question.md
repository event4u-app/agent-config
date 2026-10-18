<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Build a local request gateway for what no hook reaches?

Repository: `event4u/agent-config`, a governed skill/rule/command suite installed into AI coding hosts. The roadmap `road-to-placeholders-on-the-wire` replaces credentials and personal identifiers in what leaves the machine with placeholders, through host hooks, and restores values locally.

## Authority for this question

The repository owner delegated the resolution of open decisions to this council on 2026-10-18, verbatim: "versuche die offenen entscheidungen im ai council zu lösen" ("try to resolve the open decisions in the AI council"). On 2026-10-16 the owner wrote, verbatim: "frag so einen scheiß den council nicht mich. ich will nicht immer gestört werden" ("ask the council things like this, not me; I don't want to be disturbed all the time"). A council round on 2026-10-16 (same two providers) split on this question: one seat DECIDE (a) conditional on step 7.2; the other ESCALATE, recommending (b) with a staged experimental opt-in. That round ran before the 2026-10-18 delegation.

## The question

Pick exactly one:

- **(a)** build the gateway, decided with the 7.2 probe and the Phase 3 dropped-replacement reading in hand (i.e. steps 7.3–7.7 proceed only once 7.2's probe exists and supports it);
- **(b)** do not build it; the typed prompt, `@file` mentions and instruction files on the first host stay `gated` or `uncovered` in the published coverage table permanently.

## Evidence

- On the first host (an Anthropic CLI coding agent), nothing but the HTTP request itself carries the typed prompt, an `@file` mention, an instruction file or a compaction request in a form the package can rewrite. Hooks cover tool calls and tool results.
- Step 7.1 is done: a loopback listener is classified as a "Class B" runtime component in the shape already used for the package's UI server — human-started, session-bounded, loopback only — with one written difference: it carries model traffic.
- Step 7.2 (open) is a probe against the pinned host: a subscription login through a loopback base URL with the OAuth capability forwarded; which host features turn off behind a non-first-party base URL; twenty turns with thinking enabled under deterministic rewriting, watching for a preserved-thinking rejection; behaviour when `count_tokens` is absent; each other auth mode. It needs a real subscription login, so it is human-run. No 7.2 probe file exists.
- Planned design if built (7.3–7.7): field-by-field deterministic rewrite (system text, message text, tool_result content, historical tool_use string inputs; never thinking blocks, tool definitions, cache markers); responses pass through untouched; a final rescan refuses a request still carrying a table value; a closed route list with a fixture per route; unparseable bodies refused in strict mode; launched as the parent of the host process with a random port and per-launch credential; `NO_PROXY` or provider settings that would bypass it refuse the launch; coverage table gains a launch-mode column.
- The earlier dissenting seat's arguments: the gateway is net new exposure surface (restoration logic, logging, error paths, bypass detection); the typed prompt has a different exposure profile (a human typing has an awareness moment; the automated path is silent and higher-volume); partial coverage creates a two-class experience ("am I protected?" depends on how the session was launched).
- The supporting seat's argument: choosing (b) knowingly makes the owner's stated goal (covering the typed prompt) unreachable; conditional coverage beats permanent non-coverage when its activation and limits are conspicuous per session.
- If nothing is decided: Phase 7 stops after 7.2; the coverage table keeps those rows `gated`/`uncovered`.

## Omitted

The full step texts, the roadmap's own recommendation and its risk register are not reproduced beyond the summary above.

## Answer format

Choose (a) or (b) (or name a different option explicitly), give your reasoning in one or two paragraphs, and state any condition your choice requires. End with exactly these lines:

CHOICE: <a|b|other>
OWNER-ONLY: <yes|no>

OWNER-ONLY is `yes` only if the decision requires a human action (a physical or forge/UI action, a human-run probe) or a governance self-amendment; otherwise `no`. If your choice is conditional on a human-run step, say so explicitly and say whether the decision itself still needs a human.
