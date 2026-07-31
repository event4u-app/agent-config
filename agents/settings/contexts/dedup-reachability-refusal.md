# Dedup reachability — closed with a refusal (2026-07-31)

Durable record of a **decided** question: scope de-duplication of the rule
projection is measured, understood, and **not being made reachable**. Both
candidate mechanisms were worked out in full and both were declined.

This lives in `contexts/`, not in `agents/roadmaps/archive/`, on purpose: an
archived roadmap reads as "work that finished", while this is a **standing
refusal** that later proposals have to argue against. It must stay citable.
Its sibling is [`cache-economy-refusals`](cache-economy-refusals.md), which
records the measurements and the honest null this decision rests on.

## Decision — reject both. Maintainer verdict, not a council verdict.

**Why it is recorded as the maintainer's, not the council's.** The council pass
of 2026-07-31 (one round, cap 0.10 USD, actual 0.0357) was **budget-truncated**:
`claude-sonnet-4-5` answered, `openai/gpt-4o` returned `cost_budget_exceeded`
with zero tokens — one member, not two. Its verdict was also reject-both, but
its two headline premises are refuted against this repo's own measurements
(§ Council pass below): it confused a transport saving with an execution saving,
and read a quality win-rate as a payload reduction. A verdict resting on refuted
premises cannot be cited as the reason, even when its conclusion survives. The
conclusion is therefore carried as a maintainer decision, with the reasoning
below — which is *not* the council's reasoning.

**The load-bearing reason: real risk against an empty recipient set.**

The risk side of both mechanisms is real and was not talked down:

- **A** carries a cross-parser risk. Excluding the ownership keys schema-exactly
  turns byte equality into "byte equality modulo a parse", and the parse that
  matters is the **host's** reader, not ours. Agreement on BOM, CRLF inside
  frontmatter, block scalars, duplicate keys and key-prefix collisions is not
  something a property test over our own parser can establish.
- **B** carries manifest drift (four sub-cases, each able to delete or preserve
  the wrong file), the rename exhaustion below (path-keyed ownership cannot
  distinguish "package renamed a rule" from "user authored a matching file"
  without reintroducing the divergence B exists to remove), and a real migration
  for every already-stamped installation, with two ownership paths supported for
  at least one deprecation cycle.

The benefit side has **no known recipient**. The ≈86.8k tokens per spawn are only
paid by a **dual-scope** installation — the same rule set present at user scope
*and* project scope. No such external consumer is known to exist.

**Stated honestly, because this is an absence claim and absence claims are the
weakest kind:** we have no consumer telemetry, so "no known recipient" means
exactly that — not "no recipient exists". What is *measured* rather than assumed
is the other half: on the one dual-scope machine that does exist (a development
checkout) the dedup is **correctly inert**, because the two scopes hold different
releases. So the honest form of the argument is: the cost is real and immediate,
the benefit is unevidenced, and the cheapest way to settle it is reopen
condition 5 — a single demonstrated dual-scope consumer flips it.

So the decision is **sequencing, not a judgement on the mechanisms**: neither is
wrong, both are premature. Nobody is paying the cost the mechanism would remove,
while both mechanisms would put a real safety risk into the install path today.
If a consumer with a dual-scope installation appears, this reopens on its merits
and the work below is waiting.

**What is explicitly NOT done as a consequence:** no change to the byte-identity
predicate, no change to `install.ts`, no implementation of A or B, no further
council pass. `projection.scope_dedup` stays shipped-but-opt-in and inert.

## Reopen conditions (all five recorded; any one is enough to reopen)

1. A profile showing rule loading is IO-bound on the duplicate bytes **and**
   that removing them measurably cuts cold-start time — not just payload size.
2. Telemetry from a network-constrained consumer where the reduction changes
   behaviour (adoption, spawn frequency).
3. A measurement invalidating the quality floor that governs payload-shaping
   experiments in this suite.
4. **Perceptibility** — evidence that the saving is user-perceptibly faster,
   not merely cheaper. A sub-100 ms improvement is not worth either risk.
5. **≥ 1 external consumer with a demonstrated dual-scope installation** — the
   condition that closes the empty-recipient-set argument above, and the most
   likely of the five to fire first.

Reopening means re-deciding A vs B vs reject with the analysis below as the
starting point. It does **not** mean re-deriving the honest null: the cause is
settled (see `cache-economy-refusals` § Honest null) and the
"align the versions" hypothesis is refuted, not open.

## The problem, stated as measurements

Scope de-duplication of the rule projection works and was measured at **38.0%**
of the median cold-start payload. It is nonetheless **inert for every consumer**:

| measurement | value | how to reproduce |
|---|---|---|
| installed rules carrying `package:` / `source_path:` | 110 / 110 | `src/scripts/measure_scope_dedup.ts` § REACHABILITY |
| in-repo project-scope rules carrying the same | 0 / 110 | same |
| differ only in the ownership stamp | 61 / 110 | same |
| differ in body **and** stamp | 49 / 110 | same |
| byte-identical twins reachable by aligning versions | **0 / 110** | same |

`_tag_installed_file` stamps the ownership keys unconditionally —
`_set_key(fm_lines, 'package', PACKAGE_TAG_ID)` at `install.ts:2723`,
`source_path` at `install.ts:2725` — with no flag and no branch. The in-repo
projection written by `condense.ts --generate-tools` stamps nothing. Two
writers, deliberately different output. Aligning versions only converts body
diffs into provenance diffs, so the twin count goes to 0, not 110.

The stamp is **load-bearing**: `reap_tagged_orphans` (`install.ts:3035` apply,
`install.ts:3120` dry-run preview) uses it to decide which files this package
owns, so a stale file from an earlier install can be deleted without touching a
user-authored one. Any mechanism that removes the stamp owes a replacement
ownership signal of at least equal strength.

**What is out of scope.** Relaxing the byte-identity predicate to "ignore
frontmatter" or "compare loosely" so the number moves. That predicate is the
entire content-neutrality argument — it is why "no regression on the
trigger/outcome evals" holds *by construction* rather than by measurement. The
disabled thin projection is the standing evidence for what the alternative
costs (36.2% win-rate against a 48% floor).

## Candidate A — predicate precision

Compare **body bytes plus every non-ownership frontmatter key**, with the
ownership keys excluded **schema-exactly**: a fixed, named key list, matched as
frontmatter keys inside the frontmatter block only. Not "skip lines that look
like `key:`", not "ignore frontmatter".

**Safety argument.** The stale-copy guarantee rests on body bytes, and it
survives intact: an older release differs in its body, so it still fails the
comparison. The keys removed from the comparison are written by the installer
itself and carry no instruction to the agent — they name where the file came
from. So the property being preserved is unchanged in substance: *the agent sees
the same rule text either way*.

**Attack surface.**
- An attacker who can write `~/.claude/rules/<name>.md` can make the project
  copy be skipped by matching the body. Today they must also match the stamp,
  which is a trivially forgeable two-line string — so the delta in attacker cost
  is **near zero**, not a real reduction. What actually bounds this is that
  writing into another user's `$HOME` is already a compromise, plus the
  world-writable / not-a-directory guards shipped in #1062.
- The narrower risk is a **parser** one, below.

**Failure modes.**
- **Parsing risk (the main one).** The comparison stops being a byte equality
  and becomes "byte equality modulo a parse". Every parser bug is now a
  potential silent rule drop: an unterminated `---` block, a key appearing in
  the body, YAML block scalars, BOM, `\r\n` inside the frontmatter, a key that
  merely *starts with* `package:` (`packages:`), duplicated keys.
- **Scope creep of the exception list.** The first time a legitimate difference
  is "obviously harmless too", the list grows, and the guarantee erodes one
  entry at a time. The list must be closed by test, not by convention.
- **Divergence** between the harness predicate and `condense`'s predicate — they
  are deliberately duplicated today; a more complex predicate makes drift more
  likely and more consequential.

**Migration path.** None needed. Existing stamped installations become
de-duplicable the moment the predicate ships. That is A's real advantage: it
works on the installed base as it stands, with no re-install.

**Kill criterion.** A property test over ≥ 1,000 generated frontmatter shapes
(malformed blocks, key-prefix collisions, block scalars, CRLF, BOM, duplicate
keys, keys in body position) must produce **zero** cases where the predicate
accepts a pair whose bodies differ. One counter-example kills A — a predicate
that can drop a rule under a shape nobody enumerated is exactly the class of
defect the byte predicate existed to make impossible.

## Candidate B — writer convergence

`install.ts` stops stamping the file. Ownership moves to a **sidecar manifest**
(a file list plus content hashes) written next to the installed tree;
`reap_tagged_orphans` reads the manifest instead of the in-file key. Both
writers then emit identical bytes **by construction**, and the byte-identity
predicate stays literally unchanged.

**Safety argument.** The predicate is untouched, so the content-neutrality
argument needs no restatement — the strongest property of this option. The
ownership question moves from "is the key present" to "is the path listed with a
matching hash", which is *stronger* than today's check: the current key can be
forged by writing two lines, a hash cannot be matched without reproducing the
content.

**Attack surface.**
- The manifest becomes the authority for **deletion**. An attacker who can write
  it can cause arbitrary listed files to be reaped. Today the equivalent power
  requires writing the stamp into each victim file — comparable, but the
  manifest concentrates it in one place, which cuts both ways: one file to
  protect, one file to attack.
- A missing manifest must **never** be read as "nothing is owned" if that would
  make reaping delete everything or nothing silently; the fail-safe direction
  has to be chosen explicitly and tested.

**Failure modes.**
- **Manifest drift** — the manifest and the tree disagree. Sub-cases, each
  needing a decided behaviour, not a default: (a) file present, not listed →
  treat as user-authored, never reap (fail safe); (b) listed, absent → stale
  entry, prune quietly; (c) listed, present, hash mismatch → the user edited an
  installed file; reaping it destroys their edit, so it must **not** be reaped
  silently; (d) manifest absent entirely (older install, manual delete) →
  reaping must degrade to "reap nothing" and say so.
- **Rename robustness** — the manifest is path-keyed, so a rule renamed between
  releases leaves an orphan the new manifest does not list. Case (a) says never
  reap the unlisted, which turns a rename into a permanent orphan: exactly the
  problem the stamp solves today. Any B design must answer renames explicitly —
  most likely by keeping the *previous* manifest, or by keying on content hash
  as well as path.
- **Concurrency / partial write** — an interrupted install leaves a manifest
  describing a tree that was only half written. Needs atomic replace, and a
  reaper that tolerates a truncated manifest by doing nothing.
- **Multi-tool anchors** — one manifest per tool anchor, or one global? Two
  installs into different anchors must not reap each other's files.

**Migration path.** Real work, and the reason B is not obviously the winner.
Existing installations have stamped files and no manifest. The migration must:
(1) detect stamped-but-unmanifested trees, (2) synthesise a manifest from the
existing stamps — the stamp is the only ownership record those installs have —
(3) strip the stamps so bytes converge, and (4) keep reaping correct throughout,
including if the user never re-installs. A consumer who never upgrades keeps
stamped files forever, so **both** ownership paths have to be supported for at
least one deprecation cycle. That is a compatibility surface A does not have.

**Kill criterion.** An install → modify → re-install → reap matrix over the four
drift sub-cases plus a rename plus an interrupted write must show **zero**
cases where a user-authored or user-modified file is deleted, and zero cases
where a stale package file survives silently. Any user-data loss kills B
outright, no mitigation: a reaper that can eat a user's edited file is worse
than a dedup that never ships.

## The trade that was weighed

Not "which is nicer" but which trade to take — and the answer was neither:

| | A — predicate precision | B — writer convergence |
|---|---|---|
| Predicate | changed (parse-dependent) | **unchanged** |
| Works on the installed base | **yes, immediately** | only after re-install + migration |
| Main risk | parser accepts a differing pair | reaper deletes a user file |
| Compat surface | none | two ownership paths for ≥ 1 cycle |
| Blast radius if wrong | a rule silently missing | user data lost |
| Effort | small | substantial |

Both columns cost something real. Neither column has anyone in it yet. That
asymmetry — not a defect in either design — is what decided it: rejecting both
leaves `projection.scope_dedup` a measured-but-dormant mechanism and the 38.0% an
unrealised ceiling, which costs nothing but a saving nobody is currently paying
for.

## Council pass — 2026-07-31, one round, cap 0.10 USD (actual 0.0357)

**Coverage caveat, stated first:** the 0.10 cap bound before the second member
ran. `anthropic/claude-sonnet-4-5` answered in full; `openai/gpt-4o` returned
`cost_budget_exceeded` with zero tokens. So this is a **one-member** pass, not a
two-member one. Its verdict carries correspondingly less weight, and a second
member is the cheapest way to strengthen it if the maintainer wants that before
deciding.

**Its verdict: reject both, close the strand.**

### Objections accepted — folded into the candidates above

- **A's parsing risk is a category error, not a test-count problem.** The kill
  criterion as written proves "my parser agrees with itself", not "my exclusion
  list is safe against every shape". Correctness becomes coupled to whether *my*
  parser and the *host's* parser agree on BOM, CRLF-in-frontmatter, block
  scalars and duplicate keys — untestable except by exhaustive cross-validation
  against the host. **Consequence for A's kill criterion:** a property test over
  generated shapes is necessary but no longer sufficient; A now also owes a
  cross-parser agreement check against the host's own frontmatter reader, or A
  should not be attempted.
- **B's rename gap is unsolvable without reintroducing divergence** — argued by
  exhaustion, and the exhaustion holds: content-hash-in-manifest turns reaping
  into an O(n) scan for "hash matches, path differs"; a stable `rule_id` in
  frontmatter re-creates the byte divergence B exists to remove; inferring
  identity from path history needs release N-1's manifest, which is the
  diff-tracking the stamp avoids. The stamp answers "package-renamed vs
  user-created" *because* it is in the file. **Consequence for B:** the rename
  case is not an open detail to specify later, it is a structural cost of moving
  ownership out of the file.
- **The attack-surface framing was a distraction.** The threat model here is
  "installer bug deletes a user file", not "malicious actor". Anyone who can
  write into `~/.claude/rules/` has already won by simply replacing rule bodies.
  Both candidates' risks are **safety** risks, not security risks — reframed
  accordingly; the forgeability comparison in A was measuring the wrong thing.
- **A fourth reopen criterion:** perceptibility. A payload saving that does not
  translate into user-perceptible latency is not worth either risk. Added to the
  parked-decision revisit list below.

### Objections rejected — with the evidence that rejects them

The verdict's two headline premises are factually wrong, and both are checkable
in this repo. They are recorded here rather than quietly dropped, because the
verdict may still be right while its stated reasoning is not:

1. **"The 38% is transport savings, not execution savings — the consumer
   evaluates 110 rules either way, dedup only changes which file descriptor
   they're read from."** No. The dedup stops the project-scope copies from being
   written at all, so the preamble carries **one** rule set instead of two. The
   duplication is measured *in the billed write volume*, from transcripts:
   `110 shared filenames, ≈86.8k redundant tokens per spawn, ≈38% of subagent
   write volume` ([`cache-economy-refusals`](cache-economy-refusals.md)).
   Tokens billed twice today would be billed once. That is not transport.
2. **"A larger, simpler reduction (36.2%) was already disabled, so 38% is below
   the threshold for mattering."** Two errors in one sentence. 36.2% is a
   **quality win-rate** from a paired judge run, not a reduction; and thin
   projection's actual reduction was **~65.6%** (eager rule load 78,513 →
   13,881 GPT-tokens), i.e. *larger* than 38%, not smaller. The 48% figure is a
   **quality floor**, so it cannot support "anything under 48% payload reduction
   is below measurement noise" — it says nothing about payload value. See
   `docs/proof.md` and `ADR-202`.

What survives of the verdict after removing those two premises is the *risk*
side of the argument — A's parser coupling and B's rename/migration cost — which
is real and is exactly what the table above weighs. The verdict is therefore
**presented, not adopted**: reject-both remains a legitimate and possibly correct
outcome, but it is not carried on the reasoning offered for it.

### A third mechanism it raised, and why it does not obviously win

A content-addressed projection (a hashed content store at user scope, symlinked
into `.claude/`) was proposed and then self-refuted in the same pass: symlinks
across the user/project boundary fail in sandboxed or permission-restricted
consumers, and the store's persistence is fragile where `~/.claude/` is ephemeral
(CI runners, containers) — cases the in-file stamp survives because ownership
travels with the file. Recorded so it is not re-proposed as new.

## Parked decisions

- **Consumer default for `projection.scope_dedup`** — recommendation on record
  is **opt-in**, and the question is parked rather than carried as open.
  `revisit-if`: reachability is established (A or B lands). Until then the
  setting is inert for consumers by construction, so a default-on flip would
  advertise a switch that does nothing and would read as "active" in the census.
- **Reopen conditions for the strand as a whole** — see § Reopen conditions at
  the top of this file; all five live there so a reader hits them before the
  analysis, not after.

## See also

- [`cache-economy-refusals`](cache-economy-refusals.md) — the honest null this decision rests on, with `install.ts` line references.
- The 38.0% was pre-registered before it was measured, and the archived roadmap that recorded it now carries the fixture condition inline. That roadmap is transient by design, so it is deliberately not linked from here — the durable version of everything it concluded lives in `cache-economy-refusals` above.
- `src/scripts/measure_scope_dedup.ts` — the live reachability split; run it before trusting any number in this file.
