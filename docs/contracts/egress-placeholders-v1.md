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

**Stability: experimental.** The rule table and the token recogniser exist; the
replacement path, the senders' final check and every host carrier do not. A
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
| number | per type, in first-seen order within the scope; what a human reads |
| fingerprint | a truncated keyed digest over type and canonical value, under a key drawn at random per scope and **never sent and never persisted** |
| variant | optional; distinguishes two spellings of one entity (a spaced and a compact IBAN) so a restore reproduces each spelling byte for byte |

- **Identity.** Two occurrences of one canonical value in one scope get one
  number and one fingerprint. Two different values get two numbers.
- **Scope.** For a request this package writes, the scope is the one invocation
  that builds and sends it. For a host carrier, the scope is set by that
  roadmap's session table, which must keep the key out of every request.
- **Lifecycle.** A token is minted on first replacement and dies with its scope's
  key. A token from another scope, a token the model invented and a token whose
  fingerprint does not match its number are **unresolved** — never resolved by
  number alone, never guessed.
- **Owner of resolution state.** The process that minted the token. No other
  process resolves it unless the at-rest decision gives it the state.
- **Stability of bytes.** Replacing already-replaced text yields the same bytes
  (a token never matches a detector rule). One recogniser parses the grammar;
  the grammar's spelling is one constant, and no second spelling exists under
  `src/`.
- **Spelling.** Chosen by the model-fidelity bar pre-registered in
  `internal/bench/egress-placeholders-PREREG.md` among spellings that survive an
  unquoted shell word, YAML, JSON and an anchored regex. The bracket form
  `[TYPE_n]` is excluded on that survival test.

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

## Settings

Replacement paths are switched by `egress.placeholders.mode`. The shipped
default is `off`; whether any class is replaced by default for consumers is an
owner decision (`default-mode-for-consumers`). `observe` detects and counts only
and never changes what any surface sees.

## See also

- `docs/threat-model.md` row j — the threats this contract answers.
- `src/scripts/_lib/secret_detector.ts` — the commit-time credential scanner,
  which reads its rules from the same table.
