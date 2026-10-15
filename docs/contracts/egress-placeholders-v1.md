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

**Stability: experimental.** The rule table, the token grammar and an in-memory
replacement exist; identifier rules, the senders' final check and every host
carrier do not. A
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

## Settings

Replacement paths are switched by `egress.placeholders.mode`. The shipped
default is `off`; whether any class is replaced by default for consumers is an
owner decision (`default-mode-for-consumers`). `observe` detects and counts only
and never changes what any surface sees.

## See also

- `docs/threat-model.md` row j — the threats this contract answers.
- `src/scripts/_lib/secret_detector.ts` — the commit-time credential scanner,
  which reads its rules from the same table.
