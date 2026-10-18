<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# May an existing install ever arrive at automatic updates without being asked?

Repository: `event4u/agent-config`, an npm package installed globally by consumers into AI coding hosts. The roadmap `road-to-an-update-that-installs-itself-only-when-it-is-safe` adds `upgrade --unattended` and one settings key `update.mode: auto | ask | notify | off`.

## Authority for this question

The repository owner delegated the resolution of open decisions to this council on 2026-10-18, verbatim: "versuche die offenen entscheidungen im ai council zu lösen" ("try to resolve the open decisions in the AI council"). On 2026-10-16 the owner wrote, verbatim: "frag so einen scheiß den council nicht mich. ich will nicht immer gestört werden" ("ask the council things like this, not me; I don't want to be disturbed all the time"). A council round on 2026-10-16 (same two providers) split: one seat DECIDE (b), the other ESCALATE recommending (a). That round ran before the 2026-10-18 delegation.

## The question

The question is not whether `auto` exists — step 4.1 ships it as an opt-in, and an absent key behaves exactly as today. It is whether an install that already exists may ever arrive at `auto` without choosing it. Pick exactly one:

- **(a)** `auto` may become the default for new installs only; existing installs are asked once, with a permanent "never";
- **(b)** `ask` is terminal — `auto` stays opt-in forever and no default ever changes under an existing install;
- **(c)** `auto` may become the default everywhere after the ring-0 exit, with a release note.

## Evidence

- Today the only key on this surface is `update_check.enabled`; `upgrade` runs only when a human types it. Consumption is global-only through hosts, and the update notice is shown only by the CLI on a TTY, so most users never see it.
- `SECURITY.md:21-22`: nothing is backported; an install that is not current is unpatched.
- Measured 2026-10-18: swapping the global install mid-session failed 490 of 4,190 hook invocations during four swap rounds (the binary missing from `PATH` while npm replaces it; under the real hook wrapper a fail-closed guard can silently exit 0 in that window). So the unattended path is blocked from swapping until a machine-wide live-session register exists (step 1.4).
- Step 4.2 "ring 0": maintainer machines on the `next` dist-tag at `mode: auto`; exit after four consecutive releases installed unattended with zero rollbacks and zero errors. Step 4.3: after the ring-0 exit, one host-native question in the `stop` slot after a turn that ended on a verified success; zero prompts under CI, non-TTY, headless, `--json` and subagent runs. The default otherwise stays `notify`.
- The package's `non-destructive-by-default` rule treats a silent change to an install the user already has as what a default flip must not be.
- The earlier split, summarised: the (b) seat held that neither (a) nor (b) weakens the floor — both ask before changing — so the choice is how conservative to be; only (c) would weaken it. The (a) seat held that whether an existing install may acquire materially different update behaviour is a public behavioural commitment, and (a) preserves the consent state of existing installs without freezing the product: new installs may default to `auto`, existing ones keep `notify` unless they accept a one-time invitation with a durable "never". (a) and (b) differ only in whether a single invitation may ever be shown to an existing install.
- Only step 4.3's default depends on the answer; if nothing is decided, 4.3 ships the question and the default stays `notify`.
- Resolution requires an ADR recording the choice.

## Omitted

The roadmap's own recommendation is not reproduced; the facts it rests on are above.

## Answer format

Choose one option (or name a different option explicitly), give your reasoning in one or two paragraphs, and state any condition your choice carries. End with exactly these lines:

CHOICE: <a|b|c|other>
OWNER-ONLY: <yes|no>

OWNER-ONLY is `yes` only if the decision requires a human action (a physical or forge/UI action, a human-run probe) or a governance self-amendment; otherwise `no`.
