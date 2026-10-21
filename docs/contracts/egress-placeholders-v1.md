---
stability: experimental
---

# Egress placeholders v1 — what leaves for a model provider, and what each state proves

**Purpose.** Fix the vocabulary every egress-placeholder surface is built and
judged against: which values are listed, what happens to each class, what a
placeholder token is, and what a published coverage state is allowed to claim.

**Scope.** Any byte sequence that travels from a session or from this package
toward an external model provider. Two owners build against this contract:
`road-to-one-detector-and-the-senders-we-own` (requests this package writes
itself) and `road-to-placeholders-on-the-wire` (channels a host writes). Neither
re-defines a term below.

**Stability: experimental.** The rule table, the token grammar, an in-memory
replacement and the dispatcher's egress stage (local views and counts only)
exist, and the council channel's replacement and final check; identifier
rules, a final check on every other sender and every host rewrite do not. A
section below that names an open decision is not a promise of its outcome.

## What this is not

Replacing a value with a token that a local mapping can turn back into the value
is **pseudonymisation**. Nothing built under this contract may be described with
a stronger word, and no published state claims that a request is free of
personal or confidential meaning. A sentence that identifies a person or a
customer without a recognisable span — a role, a nickname, a description — is
outside every rule and is reported as the **implicit-identity residue**, never
as covered.

## The two classes

| Class | Members | Restore policy |
|---|---|---|
| `credential` | values that grant access: API keys, tokens, private keys, passwords, connection strings with an inline secret | **Never restored, never stored.** The value is not written anywhere — not in a mapping, a log, a cache or a record. A local edit that needs the value re-derives it from the object it came from. |
| `identifier` | values that point at a person, account or payment instrument: e-mail address, phone number, IBAN, payment card, tax ID | **Restored locally for display or for a sink the human controls.** How an identifier value rests between processes, if at all, is the `identifier-table-at-rest` decision of `road-to-placeholders-on-the-wire`; until that records a verdict, no identifier value rests anywhere outside the memory of the process that replaced it. |

A rule belongs to exactly one class. When two rules claim overlapping bytes, the
more sensitive class wins (`credential` over `identifier`), then the span a
validator confirmed, then the longer span. Only the rule table
(`src/scripts/_lib/egress_rules.ts`) defines a pattern for either class.

A credential row may also declare its literal vendor **prefixes**. Surfaces
that act on shape alone — a council `api_key_ref`, a masked `explain last`
value, the low-impact corpus redactor — read those prefixes
(`CREDENTIAL_PREFIXES`, `rawKeyPrefixPattern`) instead of spelling a list of
their own; every other consumer runs the rows. Each consumer keeps its own
policy for a hit (refuse, mask, report, redact a line); only detection is
shared, and `egress_drift_matrix.test.ts` runs a positive fixture for every
credential row against every consumer. Moving a consumer must not narrow it:
`egress_legacy_superset.test.ts` freezes every pre-move pattern and runs an
adversarial corpus through old and new, and a consumer whose own reading was
looser than the row (an OpenAI key glued to a word, a GitHub token past 36
characters, a key block whose END label differs) keeps that reading over the
table's prefixes. `rawKeyPrefixPattern` holds a prefix to a token start only
where its own row is anchored. `check_credential_spelling` fails a second
spelling of a declared prefix under `src/scripts` and `src/cli`.

The shapes that carry no vendor literal are the table's too: the
keyword-assignment vocabulary (`ASSIGNMENT_KEYWORDS`, built by
`assignmentPattern`), the `Authorization` header name and two raw-key prefix
families spelled as a class (`CLASS_SPELLED_PREFIXES`). Each consumer picks the
keywords it always read, in its own order, and keeps its own threshold for the
value; the rebuilt regexes are the pre-move spellings byte for byte. A
consumer the dispatch bundle carries reads the one keyword it needs through
`egress_prefixes.ts`. `check_credential_spelling` also fails a class or
alternation spelling that expands to a declared prefix and a keyword-assignment
shape — a table keyword beside the `[:=]` operator class on one line — outside
the table; it does not see a shape assembled across lines.

## Detection span and replacement span

A rule's **detection span** is what the commit-time scanner reports: enough
bytes to say a secret is there. Its **replacement span** is every byte that
must not leave. They are declared separately, per rule, in the table's
`replacement` field:

- `'detection'` — the detection span is the whole secret (keys, tokens, JWTs,
  the connection URI's scheme-to-`@` authority, an assigned value);
- a `through` function — the secret extends past the detection span and the
  function proves where it ends. `pem-private-key` detects on the header and
  replaces through the `-----END … PRIVATE KEY-----` that carries the same label.

**A rule that cannot prove its replacement span fails closed.** When `through`
returns no end — a private-key header with no end marker, an end marker
with a different label, or another header first — the replacer refuses the whole text (`EgressRefusedError`,
naming the rule and carrying no byte of the text). It never replaces part of a
secret and lets the rest leave. Overlapping replacement spans merge, and the
merged span takes the more sensitive class.

An end-to-end suite plants a credential for every rule — a multi-line key, a
JWT glued to a word, a connection URI with a long scheme, values thousands of
characters long — runs the full replacement path, and asserts that the output
is exactly the bytes before the secret, one token, and the bytes after it: every
byte of the replacement span is gone and none outside it changed. Each fixture
also checks that the rule it is filed under is the one that detects it.

## Refuse or replace (D4)

**Refuse where content has not yet moved; replace where it has.** A surface that
can decline to produce or send output — a writer, a store, a pre-send check —
refuses on a finding and names the type. A surface that has already received
the content and must pass something on — a tool result being returned, a bundle
being assembled for a request that will be sent — replaces. A surface never
masks a value into a shortened form: a masked fragment is a partial disclosure.

## The placeholder token

A token stands for one value inside one **issuing scope**. It carries four parts:

| Part | Meaning |
|---|---|
| type | the rule type that found the value (`EMAIL`, `IBAN`, …) |
| number | per type, in the order values first appear in the text within the scope, from 1 to 999,999 (a scope refuses a further value of that type); what a human reads |
| fingerprint | a truncated keyed digest over type and canonical value, under a key drawn at random per scope and **never sent and never persisted** |
| variant | optional; distinguishes two spellings of one entity (a spaced and a compact IBAN) so a restore reproduces each spelling byte for byte |

- **Identity.** A token stands for one **(type, canonical value)** pair. Two
  occurrences of one pair in one scope get one number and one fingerprint; two
  different values of one type get two numbers; one value matched under two
  types gets two tokens, one per type. One
  canonical value has one class for the life of the scope, **whatever type it is
  minted under**: minting it again under the other class is refused, so a value
  first seen as a credential can never become restorable, and the reverse cannot
  silently drop a restore. The class is indexed by a keyed digest of the value
  alone, never by the value.
- **Scope.** For a request this package writes, the scope is the one invocation
  that builds and sends it. For a host carrier, the scope is set by that
  roadmap's session table, which must keep the key out of every request.
- **Lifecycle.** A token is minted on first replacement and dies with its scope's
  key. A token from another scope, a token the model invented and a token whose
  fingerprint does not match its number are **unresolved** — never resolved by
  number alone, never guessed. This holds with high probability, not with
  certainty: the fingerprint is 24 bits, so one invented or foreign token whose
  type and number match a token the scope issued resolves with probability
  2^-24 (about 6 in 100 million). The guess budget is enforced, not assumed:
  after 64 failed resolutions a scope resolves nothing at all, genuine tokens
  included, so the chance that guessing ever resolves a value is at most
  64·2^-24 (about 4 in a million) per scope. Resolving a credential token is
  not a failed guess and spends no budget. What a successful guess returns is an
  identifier value to the local process that holds the scope — never a
  credential, which no scope stores.
- **Owner of resolution state.** The process that minted the token. No other
  process resolves it unless the at-rest decision gives it the state.
- **Stability of bytes.** Replacing already-replaced text yields the same bytes.
  A span is left alone only when it is exactly a token **this scope minted**;
  token syntax alone protects nothing, so a token-shaped substring planted inside
  a credential, or a token from another scope, does not stop detection. Rules do
  match tokens in places — `generic-assignment` matches one after a keyword —
  which is why the scope check, not the grammar, carries idempotence. One recogniser parses the grammar;
  the grammar's spelling is one constant, and no second spelling exists under
  `src/`.
- **Spelling: `__TYPE_n_fp__`** — e.g. `__IBAN_1_495cff__`: type `[A-Z][A-Z0-9]{1,15}` (an upper-case
  letter, then 1–15 upper-case letters or digits), number 1–999,999, fingerprint six lower-case hex digits. Chosen
  by the model-fidelity bar pre-registered in
  `internal/bench/egress-placeholders-PREREG.md` (endpoint d) among spellings that
  survive an unquoted shell word, YAML, JSON and an anchored regex; reading in
  `internal/bench/reports/egress-placeholders-fidelity-2026-10-15.md`. The
  bracket form `[TYPE_n]` is excluded on that survival test. A
  surface that renders Markdown must escape a token, which renders as bold
  otherwise. Constant and recogniser: `src/scripts/_lib/egress_token.ts`.
- **Variant: `__TYPE_n_fp_vK__`** — the K-th spelling (K from 2 to 99) of one
  entity; the first spelling carries no suffix. Number and fingerprint come from
  the canonical value, so `DE89 3704 …` and `DE893704…` share both and differ
  only in the suffix, and each restores to its own bytes. The canonical form is
  per type: `IBAN` drops whitespace and upper-cases, `CARD` drops spaces and
  hyphens, `PHONE` drops spaces, parentheses, dots, hyphens and slashes; every
  other type is its own canonical form, so two spellings of it are two entities.
  The scope keeps a keyed digest per spelling, never the spelling of a
  credential. The session table of the host carrier mints by spelling and
  issues no variant yet: there, two spellings are two entities.

## The four published states

A channel is published in exactly one state per class. The state is a claim
about evidence, not intent.

| State | Where it may be claimed | What counts as proof |
|---|---|---|
| `asserted` | only where this package writes the request itself | the outbound body is rescanned immediately before the write for every value replaced in the scope and every high-confidence finding, a hit refuses the send, and a canary that plants a raw value past the replacement is refused — removing the check turns the canary red |
| `replaced` | where a host hook substitutes content before it reaches the model | the substitution runs on the channel, and the rate at which the host drops or ignores the substituted content is measured and published beside the state |
| `gated` | where content can only be refused, not rewritten | the refusal fires on a planted value on that channel, and what the refusal costs the user is stated |
| `uncovered` | everywhere nothing above reaches | none required — this is the default, and a channel without evidence is `uncovered`, never left unlisted |

A channel moves out of `uncovered` only with its proof committed. A measured null
or a regression is published in the same table, not withheld.

### Published, per channel (2026-10-20)

| Channel | Who writes the request | Credential class | Identifier class | Evidence |
|---|---|---|---|---|
| Council requests (bundle and every member call) | this package | `asserted` | `uncovered` — no identifier row exists; replaced only in `protect`/`strict` once one does (D8) | `tests/scripts/ai_council/council_egress.test.ts` |
| Every other sender of this package | this package | per the census below: `fixed-corpus`, or `uncovered` with its reason | `uncovered` | § This package's own senders |
| Context this package injects into a session (hot context, handoff, memory recall) | the host, carrying text this package wrote | `uncovered` — replaced at injection in `protect`/`strict`, but no host drop rate is measured, which `replaced` requires | `uncovered` | `tests/scripts/hooks/egress_injection.test.ts` |
| The typed prompt | the host | `uncovered` | `uncovered` | `road-to-placeholders-on-the-wire` |
| Tool results | the host | `uncovered` | `uncovered` | `road-to-placeholders-on-the-wire` |
| Tool inputs | the host | `uncovered` | `uncovered` | `road-to-placeholders-on-the-wire` |
| Host telemetry that can export prompts or bodies (threat j2) | the host | `uncovered` | `uncovered` | `road-to-placeholders-on-the-wire` |
| A request gateway (threat j4) | the host or a gateway | `uncovered` | `uncovered` | `road-to-placeholders-on-the-wire` |
| Arguments to an external tool — an MCP server, a web fetch (threat j5) | the host | `uncovered` | `uncovered` | `road-to-placeholders-on-the-wire` |

Every channel this package does not write is `uncovered` until the host-carrier
roadmap commits its proof; this table changes only with that proof.

## Logging

Anything written about a finding — a log line, a record, a report, a hook
message, a test failure text — carries the **type and a count**, and nothing
else derived from the value: no value, no masked fragment, no prefix, no length,
no digest a reader could test a guess against. Counts are aggregated per type
per surface. A test that checks a finding asserts on type and count; a planted
fixture value is never echoed into the test's own failure output.

**Known exception, not yet conforming.** The commit-time scanner
(`secret_detector.ts`, read by `check_secret_leak`) reports a masked preview —
up to four leading and two trailing characters — because `secret-vcs-guard`
asks the agent to show the match to the human before a commit. When that scanner
runs inside an agent session, the preview reaches the model provider with the
rest of the tool output. It predates this contract and is recorded here rather
than claimed conforming; moving the scanner onto this rule is part of step 2.2
of `road-to-one-detector-and-the-senders-we-own`, which shares detection across
consumers.

## Detection ceilings

None. The credential rows match everything the commit-time scanner matched
before they moved into the rule table. `jwt` and `db-connection-uri`, whose
unbounded pre-move forms were quadratic on a hostile input, now make one
attempt per character run and consume the run up to its first possible start
atomically; their `LINEARITY` entries state why that loses nothing.
`DETECTION_CEILINGS` stays as the place a future ceiling would be declared; a
test fails when a listed ceiling no longer loses its case, and the parity suite
fails on any loss that is not listed.

**Line scope.** The commit-time scanner evaluates each line on its own, as it
did before the move; `detect()` and the replacement read the whole text. The
replacement therefore sees at least what the scanner sees, and more — an
assignment split across lines (`password =` then the value on the next line)
is replaced but not reported at commit time. A test pins both directions.

Every other rule states in its `LINEARITY` entry (`_lib/egress_rules_linearity.ts`,
kept out of the shipped engine because no runtime path reads it) why it runs in
linear time without a bound. A rule whose vendor format has a variable length
matches a value of any length whole, so a replacement never leaves a suffix in
plaintext. Three shapes are fixed-length by vendor format (`aws-access-key`,
`google-api-key`, the classic `github-pat`) and match exactly that length; a
masking consumer whose own reading was a longer run keeps it
(`workspace_secrets`, pinned by `egress_legacy_superset.test.ts`).

## The egress stage and its two views

The dispatcher's egress stage (`src/scripts/hooks/egress_stage.ts`) is the only
code that may produce a rewrite (ADR-285). It runs once per hook event, before
any concern, over the prompt (`prompt`), the tool input and the tool result —
the keys `payload_stub.ts` names as body classes — and builds at most two views
of one envelope through the payload-shape planner:

- the **execution view** — the envelope as the host sent it. It goes only to
  the concerns on `EXECUTION_VIEW_GRANTS`, a closed list the dispatcher owns:
  every concern that decides whether a call may run, each bound to the one
  script it runs. A manifest entry that borrows a listed name for another script
  gets the placeholder view. A concern cannot request the grant;
  `lint_hook_manifest` refuses a `payload_view: execution` declaration off the
  list, a blocking concern missing from it, a listed concern that is not
  blocking, and a listed name bound to another script. Until a session table exists there are no tokens to resolve, so the
  execution view is the received envelope unchanged.
- the **placeholder view** — every detected value replaced by its token. It goes
  to every other concern, so a local store written by a recording concern
  (chat history, journals, ledgers) inherits tokens without a scrubber of its
  own. A key whose secret has no provable extent is withheld whole (an object
  carrying `_agent_config_egress_withheld` and the rule id), never partly
  replaced; any other failure of the stage withholds every body and is
  recorded as a `stage-error` refusal.

**The engine is a conditional chunk.** The rule table, the token grammar and the
commit scanner are not part of `dist/hooks/dispatch.js`: `build:hook-chunks`
runs `src/scripts/hook_chunks.mjs`, the one definition of every chunk's entry,
output and build options, which emits them as `dist/hooks/egress_engine.chunk.cjs`
with a digest sidecar, and
`hooks/egress_engine_loader.ts` loads the chunk only when a caller needs
detection — the stage when its mode is not `off`, the subagent capsule when it
validates an envelope. The loader refuses a chunk that is missing, that does not
match its sidecar or has none, whose `ENGINE_SCHEMA` is not the one it was built
against, or that does not load; each is a value, never a throw. What an
unavailable engine means is fixed per mode:

| Mode | Engine unavailable |
|---|---|
| `off` | the engine is never loaded |
| `observe` | no view changes; the record carries an `engine-unavailable` refusal per scanned field |
| `protect`, `strict` | every body is withheld from the placeholder view, recorded as `engine-unavailable` |

The subagent capsule rejects an envelope it cannot scan. Every chunk carries its
own byte ceiling in `src/config/hook-bundle-budget.json` (`chunks`), raised only
with a `raise_log` entry that names it; the composition gate builds each with the
same `buildChunk` the shipped build uses and refuses a defined chunk without a
ceiling, a ceiling without a chunk, and a doubled entry on either side. The one bundled module that needs the
raw-key prefix list (`ai_council/config.ts`) reads `_lib/egress_prefixes.ts`, a
generated projection of the table that a test and `check_credential_spelling`
both hold equal to it.

**The stage is also the only writer of the tool-result store**
(`_lib/tool_output_spool.ts`, `road-to-tool-results-that-leave-a-handle`
Phase 2). After its views exist it hands the dispatch to the engine's
`spoolResult`, which stores a result only from `protect` upward, only for a
class in `_lib/tool_output_selection.ts` (empty until that roadmap's D14), only
when the placeholder view of the result equals the bytes the model receives,
and never when the result carries a credential detection or a refusal; in
`observe` it records class, length and a keyed digest and stores no body. The
store is a third conditional chunk, `tool_output_spool.chunk.cjs`, loaded by
the engine only when a class is selected. A handle names a keyed address, an
expiry and a MAC over both and the session that stored it, so an expired handle
answers `expired` after its entry is gone, and
`report_reducible_classes --read-handle <handle> [--range start:end]` returns
the stored bytes — inside the storing session only, read from the host's
session id, never a flag — or the state that stops them.

**Two claims, two threat models.** They are separate on purpose, because the
first ratification round refused them argued as one:

| Claim | What protects it | What it does NOT cover |
|---|---|---|
| The store's CODE is the shipped code | the chunk's sha256 sidecar, checked by `tool_output_spool_loader.ts` before load; a mismatch or a foreign schema loads nothing | anything about the data the code writes |
| The store's DATA is reachable only by its session, only until expiry, only in range | the MAC over address, expiry and session; the address `HMAC(key, session, sha256)` so equal content is not linkable without the key; a 0700 directory and 0600 files under the user-global root, outside the workspace, the directory re-tightened to 0700 on every store; the key beside them, where the repository cannot plant it; retention enforced on every store and read | a local process running as the same user, which can read the key and the files directly. Session binding is a scope boundary between sessions, not a defence against the machine's own user |

**What can turn the store on, and what the gate does and does not see.** This
is a set of layers, not a proven boundary:

- *By name* (`check_kernel_edit_ratified.ts`): the selection, the store, its
  loader, the classifier, the engine, the stage, the engine loader and the chunk
  table are gated hook-plumbing surfaces whatever the import closure looks like.
- *By literal import*: a source file importing a store module through a literal
  specifier is gated. A computed specifier, an alias or a wrapper is not seen.
- *By arrival*: any module newly reachable from the dispatcher is gated, and a
  new concern needs a gated manifest entry — this is what catches a store under
  another name.
- **Not gated:** a store written into the body of a concern that is already
  bound, or a store reached only through a dynamic specifier from such a body.
  Concern bodies sit outside the ratification fence by that gate's design;
  closing it would put every concern edit behind a council round.

No setting, environment variable or config file populates the selection.

**Storage guarantees, kept apart.**

- *Atomic visibility* — an entry appears whole or not at all (exclusive temp
  file, fsync of the file, rename). A temp file is never served and is removed
  after an hour.
- *Corruption detection* — a read recomputes the address from the sha256 of
  the bytes on disk and answers `corrupted` on a mismatch.
- *Crash durability* — **not promised.** The directory is not fsynced, so a
  crash can lose an entry whose rename had completed. The store is a cache of
  bytes the model already received; a lost entry reads `missing`.
- *Capacity and age* — a store refuses an entry larger than the cap
  (`too-large`). It then takes the cleanup lock and holds it across making room
  for its full size — never crediting an entry already at its address, which
  this very sweep may expire or evict —
  and publishing, so no two stores can each make room and then publish together
  past the cap. If another process holds the lock, the store is not written at
  all (`cap-busy`): a hook must not wait, and a skipped store is a cache miss.
  A cleanup that throws means nothing was written (`store-error`), and nothing
  is taken back after publication. The cap counts published entries; temp files
  in flight do not count. `storeBytesUnchecked` is the low-level publish that
  enforces neither retention nor the cap; production stores go through
  `spoolResult` only. Every authenticated read also runs cleanup, an expired
  handle included — that read is exactly when its entry should be gone; a
  malformed, forged or foreign-session handle reaches no cleanup and no entry, though a syntactically valid one still reads the key file to check its
  MAC. Expiry is rounded up, so a handle never expires before the full
  retention age.
- *Nothing is under the workspace* — entries, the observation log, the cleanup
  lock and the key all live under the user-global root, keyed by a digest of
  the workspace's real path: `runtime/tool-output-spool/<digest>/` (0700),
  `runtime/tool-output-spool/<digest>.observations.jsonl`, and
  `runtime/spool-keys/` (0600 in 0700). A repository controls its own tree,
  and a path check there is check-then-use, which a process the repository
  starts (a git hook, a build step) could defeat by swapping a component
  between check and write. Outside the workspace the repository controls no
  ancestor of these paths, so there is nothing to check. A key path or an
  entry that is not a regular file is refused; cleanup and the cap count
  enumerate with `lstat` and only regular files.
- *Threat model, stated* — in scope: whatever reaches the store through the
  workspace tree, whether the repository put it there statically or a process
  it starts does it while the store runs; none of it can redirect the store,
  because the store has no path under that tree. Out of scope: any process
  running as the same user that acts on the user-global root directly —
  including one a repository starts, such as a git hook or a build step. Such a
  process can read the key and the entries, replace files and plant links
  there; this store does not defend against it. Keeping repository code away
  from the user's own files is a sandbox's job, not the store's.
- *Complete writes* — every byte is written (short writes are looped) and
  fsynced before the rename; a failed write removes its temp file. The key is
  published the same way, by link, so a concurrent first store reads a whole
  key or none; a key file of the wrong length refuses every store
  (`store-error`) rather than signing with it.
- *Deletion is a claim* — cleanup renames an entry to a name only it uses and
  inspects what it took (inode, mtime, size). A file a writer replaced after
  cleanup measured it is linked back, unless an even newer copy already holds
  the name; while claimed, that entry reads `missing`. Two cleaners cannot both
  delete one entry, and capacity is subtracted only for a confirmed deletion.
- *The lock* — it records the holder's pid and a random token. It is taken
  over only when that pid is no longer running, never for its age, so a slow
  but live holder is never displaced and no two processes overlap between
  making room and publishing; a dead holder cannot publish. Taking over a dead
  holder's lock runs under its own guard (an atomic `mkdir`), so of any number
  of takers exactly one replaces it. A holder releases only its own token, and
  since no live holder is ever displaced, no successor can appear between that
  check and the removal. A lock in a format this version did not write names
  no holder it can check and is never taken, whatever its age. Limits, stated:
  the lock is per host; a reused pid, an unreadable lock, or a takeover guard
  left by a crash keeps the lock held, so stores skip as `cap-busy` until it is
  removed — the safe direction in every case.

**A concern reply cannot rewrite.** The dispatcher reads a fixed set of keys
from a concern reply (`decision`, `reason`, `additional_context`, `context` and
the permission verdict) and builds the host emission from those alone, so a
rewrite field in a reply reaches no host; a test drives a concern that returns
one through the dispatcher and asserts the emission carries none. The lint rule
`rewrite-concern-refused` is the authoring-time half and reads source text only.

The token scope is one dispatch: a token in a local store cannot be resolved
later. The `identifier-table-at-rest` decision (option (b), council 2026-10-16)
says how a scope may outlive a process, and its table exists as a module the
stage does not call yet (`src/scripts/_lib/egress_session_table.ts`): one table
per session under the user-global root (`runtime/egress-sessions/`, outside the
workspace, `0600`, named by a digest of the session id), removed after seven
idle days. It holds a per-session key and, per token, a keyed digest of the
value, the type, the number and MAC-authenticated origin descriptors — **no
value of any class**. A restoration names a destination, re-derives the value
from the origin bound to that destination, matches the digest first even for
the same destination, and otherwise fails closed as `ORIGIN_CHANGED`,
`ORIGIN_UNAVAILABLE`, `ORIGIN_AMBIGUOUS`, `DESTINATION_MISMATCH` or
`SESSION_EXPIRED`, each with a message that names no value and one recovery:
explicit confirmation with the value shown. A token the session never issued is
`UNRESOLVED` and has no recovery. Text carried into another session is
re-issued under that session's key, or becomes the dead form
`[expired TYPE placeholder]`, which the recogniser never parses. The key rests
beside the digests, so the table is data minimisation, not a defence against a
reader running as the same user. Byte lengths in a payload stub are
measured on the received envelope whichever view the stub is cut from.

**What this package injects goes through the engine too.** Every concern's
reply that the dispatcher hands back to the session — a `context` block at
session start (hot context, a handoff) and the `reason` plus
`additional_context` of every other reply (memory recall among them) — passes
`egressInjection` in `src/scripts/hooks/egress_stage.ts`. In `protect` and
`strict` each listed value becomes its token under one scope per dispatch, so
one value is one token across replies; text whose secret has no provable
extent, or that no engine can read, is withheld whole as
`[egress: injected text withheld (<rule>)]`. `off` and `observe` inject the
text unchanged. The mode is read once per dispatch, and only when a reply
carries text. The per-text work lives in the engine chunk
(`src/scripts/_lib/egress_text.ts`, schema 2), so the dispatch bundle carries
only the field walk.

**What the placeholder view does not reach.** A concern that opens the host's
transcript file reads it from disk, raw; an operator-armed raw capture
(`AGENT_HOOK_CAPTURE_DIR`) writes the received payload before the stage runs;
and a guard's own refusal text, built from the execution view, is passed on as
it is. Each is a residue of the view, not a covered surface.

## Prevention tiers

A value never read cannot leak through a later bug, so prevention sits before
every replacement path. Three tiers, and who turns each on:

| Tier | What it refuses | Who enables it |
|---|---|---|
| Read guard | a hooked file tool or shell command on a credential-class file, and environment dumps (`block-credential-reads`, classes in `src/scripts/_lib/credential_files.ts`) | this package, on every `pre_tool_use` slot it binds; refuses only where the slot honours a deny |
| Native deny rows | the same classes, as the host's own `permissions.deny` rows | **the user** — `hooks:doctor` reports which rows are in force across the three Claude Code settings layers and prints the missing ones to paste (`src/scripts/_lib/credential_deny_rows.ts`). This package writes none: a written row would be a second exception to the published no-host-setting-write commitment (D10) |
| Sandbox and a scrubbed environment | reads outside the sandbox, and values that were never in the session's environment | **the user** — `sandbox.enabled` in the host settings, and starting the session from an environment without the credential variables; never written into a project |

The native rows cannot except a template, so `.env.*` is not offered (it would
deny `.env.example`) and the value-holding suffixes are listed by name; the read
guard covers every other name.

## Settings

Replacement paths are switched by `egress.placeholders.mode`. The shipped
default is `off`; whether any class is replaced by default for consumers is an
owner decision (`default-mode-for-consumers`). The key is read from the project
layers of the settings cascade only; a layer that does not contain the word
`egress` skips the full cascade read. Resolution fails toward protection: an
absent mode (or a bare YAML `off`) is `off`, a present value that is not one of
the four is `protect`, and a layer that names `egress` but does not parse, or a
read that fails, is `protect` — never a silent `off`.

| Mode | Detects and counts | Placeholder view to concerns | Rewrite sent to the host |
|---|---|---|---|
| `off` | no | no | no |
| `observe` | yes | no — every concern sees exactly what it saw without the stage | no |
| `protect` | yes | yes, to every concern off the grant list | no, until the host rewrite is built |
| `strict` | yes | as `protect` | no, until the host rewrite is built |

`strict` differs from `protect` only once the host rewrite and the prompt gate
exist; until then the two behave identically, and that is stated rather than
implied by the name. `observe` never changes a view.

A thrown kill switch (`AGENT_CONFIG_NO_EGRESS_STAGE`) turns the stage off
whatever the settings say, and `publishedEgressState` then reports every channel
`uncovered`, so a stale `replaced` cannot outlive the stage that earned it. A
mode that replaces nothing reports `uncovered` the same way.

**Counts.** In every mode but `off`, each dispatch that carried a scanned field
appends one line to `agents/runtime/state/egress-observations.jsonl` (gitignored,
rotated once past 4 MiB): platform, event, an id-shaped tool name, the mode, the
fields scanned, and per field the class, type and count, plus the rule id of any
refusal — nothing derived from a value. The rule table holds credential rules
only, so every count is a credential count until identifier rules exist.
`agent-config hooks:replay … --json` reports what the stage would do with a
fixture under the workspace's mode, in the same shape, without writing.

## This package's own senders

Every module of this package that posts to a model or media provider, one row
each, derived from the source rather than listed by hand. A row is a claim about
source text: `sender` means the module names a provider endpoint and carries a
recognised send shape, `local` that its only endpoint is loopback, and
`unclassified` that the scanner could not settle it — never that it is safe.
Each module also carries an `egress-content:` marker, and its **coverage** is
what the contract may publish for it: `asserted` (its requests pass the
replacement and the final check of § The four published states — accepted only
from a module that imports that check), `fixed-corpus` (it sends a corpus this
package fixed, never session content) or `uncovered` with the reason. A sender
with no answer is `undeclared`, and `egress_sender_census` — run by
`egress_sender_scan.test.ts` in CI, not a registered gate — fails on it whether
or not the committed table is current.

**The council channel is `asserted` for credentials.** The bundle replaces every
value the table detects with a placeholder, span by span, under one scope per
run (`src/scripts/ai_council/council_egress.ts`); the final check runs in
`callMember`, in `curlJsonPost` before curl is spawned and before a CLI seat is
spawned, over every value that scope replaced and every high-confidence finding
(a credential row other than the keyword-entropy one, or a validated
identifier), and a hit refuses the send with a reason that names no value. A
canary that plants a replaced value past the bundle is refused, and the same
body handed to a member directly carries it
(`tests/scripts/ai_council/council_egress.test.ts`). The retained record holds
what was sent, so it keeps the placeholders; `restoreForDisplay` resolves
identifiers for an in-process display, and the council run has no such display
today. The channel carries no identifier claim until identifier rows exist: an
e-mail, an IBAN or a phone number still leaves it unchanged. When they exist,
the bundle replaces and the final check refuses identifiers only in `protect`
and `strict` — credentials are replaced whatever the mode, because the bundle
masked every credential line before; whether identifiers are replaced by
default for consumers is the owner's decision D8. A caller of the
client classes outside a council round (team review, the low-impact fast path,
`ask_transport`, the benches) gets the final check but no replacement, so a
credential in its prompt is refused rather than replaced.

<!-- BEGIN egress-sender-census (generated) -->
> Generated by `egress_sender_census`. Do not edit between the markers;
> regenerate with `./scripts-run src/scripts/egress_sender_census --write`.

Scanned: `src/scripts/`, `src/cli/`, `src/install/`, `src/shared/`, TypeScript and shell, tests excluded.
A module whose endpoint is computed at runtime **and** whose send shape the
scanner does not recognise is absent from this table; that residual is why
`unclassified` exists. `content` stays `undeclared` until the module carries an
`egress-content:` marker, and `engine` counts a direct import of a function that detects or replaces
(`detect`, `findSpans`, `replaceSpans`, `replaceValues`); importing a table constant does not count.
`coverage` is what the module's marker claims (`asserted` only for a module that imports the final
check, `council_egress.ts`); `undeclared` fails the census.

| module | endpoint | content | engine | status | evidence | coverage | reason |
|---|---|---|---|---|---|---|---|
| `src/scripts/_lib/llm_proposer_transport.ts` | `api.anthropic.com` | session-content | no | **sender** | names a provider endpoint and carries a send shape | **uncovered** | the prompt is assembled from repository evidence at run time and is not passed through the engine; the module has made no live call |
| `src/scripts/_lib/trigger_routers.ts` | `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com` | fixed-corpus | no | **sender** | names a provider endpoint and carries a send shape | **fixed-corpus** | sends the trigger-eval corpus (skill descriptions and the eval's own prompts), never session content |
| `src/scripts/ai-image/adapters/flux.sh` | `configured` | session-content | no | **unclassified** | media adapter whose endpoint is configured, not written down | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-image/adapters/gemini-image.sh` | `generativelanguage.googleapis.com` | session-content | no | **sender** | media adapter naming a provider endpoint | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-image/adapters/ideogram.sh` | `api.ideogram.ai` | session-content | no | **sender** | media adapter naming a provider endpoint | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-image/adapters/recraft.sh` | `external.api.recraft.ai` | session-content | no | **sender** | media adapter naming a provider endpoint | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-video/adapters/comfyui.sh` | `127.0.0.1`, `localhost` | session-content | no | **local** | media adapter whose only endpoint is loopback | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-video/adapters/fal.sh` | `queue.fal.run` | session-content | no | **sender** | media adapter naming a provider endpoint | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-video/adapters/gemini-veo.sh` | `generativelanguage.googleapis.com` | session-content | no | **sender** | media adapter naming a provider endpoint | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-video/adapters/higgsfield.sh` | `platform.higgsfield.ai` | session-content | no | **sender** | media adapter naming a provider endpoint | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-video/adapters/kling.sh` | `api.klingai.com` | session-content | no | **sender** | media adapter naming a provider endpoint | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-video/adapters/musetalk.sh` | `configured` | session-content | no | **unclassified** | media adapter whose endpoint is configured, not written down | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-video/adapters/openai-images.sh` | `configured` | session-content | no | **unclassified** | media adapter whose endpoint is configured, not written down | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-video/adapters/replicate.sh` | `api.replicate.com` | session-content | no | **sender** | media adapter naming a provider endpoint | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-video/adapters/sora.sh` | `api.openai.com` | session-content | no | **sender** | media adapter naming a provider endpoint | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai-video/adapters/syncso.sh` | `api.sync.so` | session-content | no | **sender** | media adapter naming a provider endpoint | **uncovered** | the generation prompt is an operator-authored brief sent from a shell adapter the TypeScript engine does not reach |
| `src/scripts/ai_council/airgap.ts` | `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com` | fixed-corpus | no | **unclassified** | names a provider endpoint with no recognised send shape — read the module | **fixed-corpus** | a DNS lookup of the provider hosts; no request body exists |
| `src/scripts/ai_council/api_transport.ts` | `generativelanguage.googleapis.com` | session-content | no | **sender** | names a provider endpoint and carries a send shape | **asserted** | every body passes councilEgress().check in curlJsonPost before curl is spawned; the council bundle is replaced through the engine first |
| `src/scripts/ai_council/clients.ts` | `api.anthropic.com`, `api.openai.com`, `api.perplexity.ai`, `api.x.ai` | session-content | no | **unclassified** | names a provider endpoint with no recognised send shape — read the module | **asserted** | API seats post through api_transport.curlJsonPost and CLI seats pass councilEgress().check before the spawn; council rounds are replaced through the engine first |
| `src/scripts/rdp_gate_classify.ts` | `api.anthropic.com` | fixed-corpus | no | **sender** | names a provider endpoint and carries a send shape | **fixed-corpus** | sends the labelled classification corpus named by --corpus, never session content |
| `src/scripts/rdp_quality_eval.ts` | `api.anthropic.com` | fixed-corpus | no | **sender** | names a provider endpoint and carries a send shape | **fixed-corpus** | sends the RDP quality corpus (corpus-prompts.json or --corpus), never session content |
| `src/scripts/second_brain_retrieval.ts` | `api.anthropic.com` | fixed-corpus | no | **sender** | names a provider endpoint and carries a send shape | **fixed-corpus** | sends the seeded retrieval corpus (retrieval-corpus.yml) and entries retrieved from it, never session content |
| `src/scripts/second_brain_run.ts` | `api.anthropic.com` | fixed-corpus | no | **sender** | names a provider endpoint and carries a send shape | **fixed-corpus** | sends the deterministic recall corpus of Phase 1, never session content |

23 module(s): 17 sender, 1 local, 5 unclassified; coverage 2 asserted, 6 fixed-corpus, 15 uncovered, 0 undeclared. <!-- enforcement-count-ok: egress coverage census of sender modules, not a rule-enforcement figure -->
<!-- END egress-sender-census -->

## See also

- `docs/threat-model.md` row j — the threats this contract answers.
- `src/scripts/_lib/secret_detector.ts` — the commit-time credential scanner,
  which reads its rules from the same table.
