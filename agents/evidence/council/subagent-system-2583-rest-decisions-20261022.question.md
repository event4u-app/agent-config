<!-- evidence-type: analysis -->

# Three design decisions for the remaining steps of PR #2583's roadmaps

Repository: event4u/agent-config, branch `feat/subagent-system-2583-rest` off `origin/main@e7d10fac53`.
The owner delegated this run; questions the tree does not settle go to the council first. For
each decision below, choose one option, give the deciding facts, name the condition under which
your choice would be wrong, and say whether it is reversible.

## Decision 1 — can the reuse shadow ever see a reusable worker?

Roadmap `agents/roadmaps/road-to-a-cold-start-paid-once.md` step 3.5 files a shadow window of at
least 100 `Agent` calls recording, per spawn, whether a warm named worker would have been
re-tasked (`would_resume`) or a fresh one was spawned, with the refusal reasons. The decision
function is `src/scripts/_lib/worker_reuse.ts` (`shadowReuseVerdict`, `decideWorkerReuse`, eight
conditions (a)–(h)).

Facts on this tree:

- The production hook `src/scripts/hooks/spawn_guard_shadow_hook.ts` reads
  `probeHostCapabilities(platform).worker_resume`. The committed `claude` registry row
  (`src/scripts/_lib/host_capability.ts` ~line 307) leaves `worker_resume` unset, so every
  production verdict is `fresh` with reason `host_resume_unobserved`. The same function already
  live-probes `agent_teams` from the environment variable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`.
- Observation (step 1.4, Claude Code 2.1.306, 2026-10-21): with that variable set before the
  session, a spawn named `probe-worker` was re-tasked by that name and its first call read 99.8 %
  from cache; without it the spawning tool takes no name and a send to a name is unreachable
  (step 1.8). The row was left unset because the by-name half holds only under the experimental
  variable.
- The production hook also passes no worker register: even with `worker_resume` true the verdict
  would be `worker_register_unrecorded`. On this branch the hook now records, per spawn, the
  definition (`agent_type`) and a session-bound digest of the requested name (`name_key`), and
  the ledger indexes named spawns and stops, so a report can join a later spawn to an earlier
  stopped worker of the same name and session.
- The dispatch bundle has 1,113 bytes of headroom (ceiling 1,550,000). Computing conditions
  (b)–(h) live needs the stopped worker's transcript (tokens, compaction marker), its worktree,
  branch head, skill-set signature and installed package version at stop.

Options:

- (a) Make `worker_resume` a live probe on `claude` only: true when the agent-teams variable is
  set in the hook's environment (the condition under which 1.4 observed it), false otherwise; and
  have the 3.5 report reconstruct the full verdict per spawn from the ledger lines plus the
  stopped worker's transcript at report time, labelled `reconstructed`, while the hook records
  only the precondition and the join keys.
- (b) As (a) for the probe, but compute the full verdict live in the hook, inside the remaining
  bundle budget or a new lazily loaded chunk with its own ceiling.
- (c) Leave `worker_resume` false. The window is then a null by precondition, filed as such.

## Decision 2 — a keyless free route for the free-hands shadow

Roadmap `agents/roadmaps/road-to-free-hands-a-paid-head-checks.md` step 6.2 runs a shadow: a free
route answers in parallel, the paid answer is used, both are verified; public-artifact corpus
only (the repository is public); cap 2,000 calls (decision A5). Decisions A9 and A10 (council
2026-10-22) admit OpenAI-compatible routes as hands under ADR-257 and keep every free route at
`public-artifact` permanently. Step 2.3: a route's dated data-use attestation records source,
date, training, retention and whether the terms permit a client distributed to users in the
EEA, Switzerland and the UK; a route without that last field is admissible for the
maintainer's own runs only, never as a consumer default. Model ids are never committed.

The maintainer holds no free-tier key whose billing class can be proven (a Gemini key exists;
its project's billing state is unknown, and the run may spend USD 0 on paid keys). One keyless
first-party endpoint documents anonymous use: Pollinations (`https://text.pollinations.ai/openai`,
OpenAI-compatible). Its own documentation: "This API needs no key"; anonymous requests are
limited per IP, one at a time, at least 30 s apart. Its privacy policy and terms, read from the
provider's public source repository at commit `97d1ffbec3ab` (2026-10-20), say:

- "Pollinations does not use your prompts or outputs to train or fine-tune models without
  explicit opt-in. Community providers may follow different practices."
- Prompts/outputs are "processed transiently … not retained beyond what's necessary", with
  short-lived response caches; depending on the selected model, content "may be sent to
  inference … services", whose retention "depend[s] on the service".
- "the standard service does not promise EEA-only processing"; transfers outside the EEA
  "require applicable GDPR safeguards". No clause restricting clients distributed to EEA, CH or
  UK users was found.

At 30 s per call the 2,000-call cap takes at least 17 hours; 333 calls for one task kind take
at least 2.8 hours.

Options:

- (a) Admit it as a catalogued keyless route with an attestation dated 2026-10-22,
  `trains_on_prompts: false` (first-party models; community models excluded), and the
  distribution field `unknown`, so it is maintainer-only and never a consumer default.
- (b) As (a), with the distribution field `permitted`.
- (c) Do not admit it; 6.2 stays without a route and AC-3 stays open as an owner action.

## Decision 3 — how the shadow verifies both answers

`shadowAsk` (`src/scripts/ai_council/free_hand_shadow.ts`) records a verify result for the paid
and the free answer; without an injected verifier both are recorded `skipped`, and
`kind_flip.ts` treats `skipped` as not passing, so no kind can flip on such data. Owner decision
O6 (2026-10-23) permits a deliberately created measurement window if it consists of real, useful
work and is labelled `manufactured` in its evidence file. Owner decision O5 sets 333 shadow calls
per kind before a flip.

Options:

- (a) A manufactured window over public repository artefacts whose ground truth is derivable
  from the tree itself — e.g. `classify` (which artefact class a tracked file is, from its path
  and frontmatter), `extract` (a named frontmatter field of a skill), `summarise-given-text`
  checked for containing the source's required terms — so each answer is verified
  deterministically; kinds without a derivable ground truth stay unmeasured.
- (b) Only real asks verified by the paid head model, as they occur in normal work; no
  manufactured corpus.
- (c) (a) plus a paid-head verification of a random 10 % sample of each kind, to check that the
  deterministic verifier agrees with the head.
