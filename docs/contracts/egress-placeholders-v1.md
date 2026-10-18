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
exist; identifier rules, the senders' final check and every host rewrite do
not. A
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
spelling of a declared prefix under `src/scripts` and `src/cli`. Not yet moved: the keyword-assignment
variants (`password =`, `api_key:`) that several consumers read at their own,
looser threshold, and one prefix spelled through a character class in
`check_reach_channels.ts`; neither carries a vendor literal, so the
single-spelling test cannot see them.

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
  bracket form `[TYPE_n]` is excluded on that survival test. The variant suffix
  is not yet part of the spelling; adding it is a change to this section. A
  surface that renders Markdown must escape a token, which renders as bold
  otherwise. Constant and recogniser: `src/scripts/_lib/egress_token.ts`.

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
atomically; their `linearity` fields state why that loses nothing.
`DETECTION_CEILINGS` stays as the place a future ceiling would be declared; a
test fails when a listed ceiling no longer loses its case, and the parity suite
fails on any loss that is not listed.

**Line scope.** The commit-time scanner evaluates each line on its own, as it
did before the move; `detect()` and the replacement read the whole text. The
replacement therefore sees at least what the scanner sees, and more — an
assignment split across lines (`password =` then the value on the next line)
is replaced but not reported at commit time. A test pins both directions.

Every other rule states in its `linearity` field why it runs in linear time
without a bound, and matches a value of any length whole, so a replacement never
leaves a suffix in plaintext.

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

**A concern reply cannot rewrite.** The dispatcher reads a fixed set of keys
from a concern reply (`decision`, `reason`, `additional_context`, `context` and
the permission verdict) and builds the host emission from those alone, so a
rewrite field in a reply reaches no host; a test drives a concern that returns
one through the dispatcher and asserts the emission carries none. The lint rule
`rewrite-concern-refused` is the authoring-time half and reads source text only.

The token scope is one dispatch: a token in a local store cannot be resolved
later, which is the intended state until the `identifier-table-at-rest` decision
says how a scope may outlive a process. Byte lengths in a payload stub are
measured on the received envelope whichever view the stub is cut from.

**What the placeholder view does not reach.** A concern that opens the host's
transcript file reads it from disk, raw; an operator-armed raw capture
(`AGENT_HOOK_CAPTURE_DIR`) writes the received payload before the stage runs;
and a guard's own refusal text, built from the execution view, is passed on as
it is. Each is a residue of the view, not a covered surface.

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
`unclassified` that the scanner could not settle it — never that it is safe. No
row here is `asserted` until its request passes the egress engine and the final
check of § The four published states.

<!-- BEGIN egress-sender-census (generated) -->
> Generated by `egress_sender_census`. Do not edit between the markers;
> regenerate with `./scripts-run src/scripts/egress_sender_census --write`.

Scanned: `src/scripts/`, `src/cli/`, `src/install/`, `src/shared/`, TypeScript and shell, tests excluded.
A module whose endpoint is computed at runtime **and** whose send shape the
scanner does not recognise is absent from this table; that residual is why
`unclassified` exists. `content` stays `undeclared` until the module carries an
`egress-content:` marker, and `engine` counts a direct import of a function that detects or replaces
(`detect`, `findSpans`, `replaceSpans`, `replaceValues`); importing a table constant does not count.

| module | endpoint | content | engine | status | evidence |
|---|---|---|---|---|---|
| `src/scripts/_lib/llm_proposer_transport.ts` | `api.anthropic.com` | undeclared | no | **sender** | names a provider endpoint and carries a send shape |
| `src/scripts/_lib/trigger_routers.ts` | `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com` | undeclared | no | **sender** | names a provider endpoint and carries a send shape |
| `src/scripts/ai-image/adapters/flux.sh` | `configured` | undeclared | no | **unclassified** | media adapter whose endpoint is configured, not written down |
| `src/scripts/ai-image/adapters/gemini-image.sh` | `generativelanguage.googleapis.com` | undeclared | no | **sender** | media adapter naming a provider endpoint |
| `src/scripts/ai-image/adapters/ideogram.sh` | `api.ideogram.ai` | undeclared | no | **sender** | media adapter naming a provider endpoint |
| `src/scripts/ai-image/adapters/recraft.sh` | `external.api.recraft.ai` | undeclared | no | **sender** | media adapter naming a provider endpoint |
| `src/scripts/ai-video/adapters/comfyui.sh` | `127.0.0.1`, `localhost` | undeclared | no | **local** | media adapter whose only endpoint is loopback |
| `src/scripts/ai-video/adapters/fal.sh` | `queue.fal.run` | undeclared | no | **sender** | media adapter naming a provider endpoint |
| `src/scripts/ai-video/adapters/gemini-veo.sh` | `generativelanguage.googleapis.com` | undeclared | no | **sender** | media adapter naming a provider endpoint |
| `src/scripts/ai-video/adapters/higgsfield.sh` | `platform.higgsfield.ai` | undeclared | no | **sender** | media adapter naming a provider endpoint |
| `src/scripts/ai-video/adapters/kling.sh` | `api.klingai.com` | undeclared | no | **sender** | media adapter naming a provider endpoint |
| `src/scripts/ai-video/adapters/musetalk.sh` | `configured` | undeclared | no | **unclassified** | media adapter whose endpoint is configured, not written down |
| `src/scripts/ai-video/adapters/openai-images.sh` | `configured` | undeclared | no | **unclassified** | media adapter whose endpoint is configured, not written down |
| `src/scripts/ai-video/adapters/replicate.sh` | `api.replicate.com` | undeclared | no | **sender** | media adapter naming a provider endpoint |
| `src/scripts/ai-video/adapters/sora.sh` | `api.openai.com` | undeclared | no | **sender** | media adapter naming a provider endpoint |
| `src/scripts/ai-video/adapters/syncso.sh` | `api.sync.so` | undeclared | no | **sender** | media adapter naming a provider endpoint |
| `src/scripts/ai_council/airgap.ts` | `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com` | undeclared | no | **unclassified** | names a provider endpoint with no recognised send shape — read the module |
| `src/scripts/ai_council/api_transport.ts` | `generativelanguage.googleapis.com` | undeclared | no | **sender** | names a provider endpoint and carries a send shape |
| `src/scripts/ai_council/clients.ts` | `api.anthropic.com`, `api.openai.com`, `api.perplexity.ai`, `api.x.ai` | undeclared | no | **unclassified** | names a provider endpoint with no recognised send shape — read the module |
| `src/scripts/rdp_gate_classify.ts` | `api.anthropic.com` | undeclared | no | **sender** | names a provider endpoint and carries a send shape |
| `src/scripts/rdp_quality_eval.ts` | `api.anthropic.com` | undeclared | no | **sender** | names a provider endpoint and carries a send shape |
| `src/scripts/second_brain_retrieval.ts` | `api.anthropic.com` | undeclared | no | **sender** | names a provider endpoint and carries a send shape |
| `src/scripts/second_brain_run.ts` | `api.anthropic.com` | undeclared | no | **sender** | names a provider endpoint and carries a send shape |

23 module(s): 17 sender, 1 local, 5 unclassified.
<!-- END egress-sender-census -->

## See also

- `docs/threat-model.md` row j — the threats this contract answers.
- `src/scripts/_lib/secret_detector.ts` — the commit-time credential scanner,
  which reads its rules from the same table.
