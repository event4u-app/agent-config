<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# What may a global install write into a consumer's committed lock file?

Repository: `event4u/agent-config`, an npm package installed by consumers into AI coding hosts, globally (`~/.claude`, ...) or per project. Roadmap: `road-to-an-ownership-record-that-belongs-to-the-user`, step 3.3.

## Authority for this question

The repository owner delegated the resolution of open decisions to this council on 2026-10-18, verbatim: "versuche die offenen entscheidungen im ai council zu lösen" ("try to resolve the open decisions in the AI council"). On 2026-10-16 the owner wrote, verbatim: "frag so einen scheiß den council nicht mich. ich will nicht immer gestört werden" ("ask the council things like this, not me; I don't want to be disturbed all the time"). An earlier council round on 2026-10-18 (same two providers) split on the venue (one seat council-decidable, one owner-reserved as a public compatibility commitment); both recommended the narrow fix (b). Option (b′) was formulated after that round, following a reader audit. That round ran before the delegation.

## The question

Pick exactly one:

- **(a)** add the lock (`agents/installed-tools.lock`) to `src/config/gitignore-block.txt` as step 3.3 is written, reversing the tracked-durable row in `docs/contracts/agents-layout.md` and the team workflow in `README.md:357`;
- **(b)** stop writing global-scope entries into a consumer's lock, which also stops `agent-config sync` replaying global installs for a new team member (`src/scripts/_cli/cmd_sync.ts:343-355`);
- **(b′)** keep global entries but stop recording their absolute `files[]` in the consumer's lock, since the user-scoped ledger now holds global ownership and `sync` never reads `files[]`;
- **(c)** keep today's behaviour and re-cut step 3.3 and AC-8 to the agreed rule the two documents already state.

## Evidence

- `README.md:357`: "every tool you `init` is recorded in `agents/installed-tools.lock` (committed, machine-managed). New team members run `npx @event4u/agent-config sync` after cloning; CI gates drift with `agent-config validate`."
- `docs/contracts/agents-layout.md:74`: in a consumer repo the lock is "tracked-durable", the team-reproducibility surface, "deliberately absent from `src/config/gitignore-block.txt` and adding it there would break that workflow". In the source repo it is local-only because it carries absolute paths and leaks `$HOME`.
- The residual gap: a global install run from a consumer project that has settings writes `$HOME`-rooted global-scope entries (absolute paths under the installing user's home) into that tracked lock, which the team commits.
- `cmd_sync.ts:166-182, :343-355` replays a `--scope=global` install from the lock's global entries — the new-team-member workflow README.md:357 promises. A per-user ledger cannot serve that workflow (it is on one machine). `sync` reads `name`, `scope` and `bridge_marker` and never the per-entry `files[]`.
- Phase 2 of the roadmap landed a user-scoped ownership ledger that records which global files the package wrote and their digests; it decides preservation of user edits for global targets. A council verdict (D1, 2026-10-16) bounds it: user-global ownership metadata, not a scope, carries no project key, drives no artefact selection.
- What the answer unblocks: step 3.3 and the first half of acceptance criterion AC-8; both are re-cut to the pick. If nothing is decided: nothing is lost and the `$HOME` leak stays.

## Omitted

The roadmap's own recommendation is not reproduced; its facts are above. The schema of `files[]` entries (path, digest, kind) is not reproduced.

## Answer format

Choose one option (or name a different option explicitly), give your reasoning in one or two paragraphs, and state any condition your choice carries (for example what a reader or the `validate` gate must still accept). End with exactly these lines:

CHOICE: <a|b|b-prime|c|other>
OWNER-ONLY: <yes|no>

OWNER-ONLY is `yes` only if the decision requires a human action (a physical or forge/UI action, a human-run probe) or a governance self-amendment; otherwise `no`.
