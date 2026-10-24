<!-- evidence-type: analysis -->

# The collector advances the owed item; the classification ledger comes next

AI council, 2026-10-24, the sixth round that day. anthropic/claude-sonnet-4-5 +
openai/codex-default, 2/2 present, 2 rounds with peer review, design mode, CLI
transport, `$0.00`, no chairman synthesis. One first-round answer was withheld
by the provider's safety filter and contributed no technical point, which both
final answers note. The prompt is committed verbatim beside this file as
`gate-collector-slice-20261024.question.md`. It reviewed the experimental slice
in `src/scripts/_lib/gate_collector_experimental.ts`.

## Verdict: convergent — the item stays open, the next deliverable changes

- anthropic: *"No; keep it open, but progress is real."* Confidence 0.92.
- openai: *"Keep the item open, with two must-fix defects and several
  explicitly deferred limitations."* Confidence 0.96.

## Must fix, both seats — done in this change

1. **The line limit failed across chunks.** When the last permitted line feed
   was the final byte of a chunk, the next chunk was accepted. openai added
   that `>=` alone is wrong too, because it would make a stream of exactly the
   limit overflow. Fixed: both limits are now capacities. Exactly the limit
   finishes normally, the next byte is an overflow, and the accepted prefix is
   exactly the capacity. Tests went red first, then green.
2. **Health was not validated at runtime.** Fixed: an out-of-domain health
   value throws.
3. **Overreach in the module's own claims.** These were reworded. The drain is
   an *intended* boundary implemented through Node's undocumented
   `_handle.fd`, and it has never been exercised against a byte still buffered
   at `exit`. The claim is framing and bounded collection, not provenance and
   not truthfulness. The two policies the slice chose are now stated in the
   module header instead of hidden in code: a non-zero exit without a
   compatibility row is a diagnostic, and an `invalid` producer under a healthy
   validator leaves report-only exits at 0.

## Carried, not done here

- The driver's adapter is not deterministic, even though the reducer is. It
  has to be constrained or replaced before any integration, and it has to be
  tested on the supported OS and Node combinations.
- Per-check applicability does not exist. Preflight is run-level.
- Collection and protocol "primary outcomes" are two notions and need one
  wording. Whether timeout truncation may surface as `malformed` needs a
  decision.
- Compatibility rows are executable policy and belong in the governance model
  next to the producer registry.
- A kill switch and rollback thresholds are owed before any CI wiring.
- openai's hardest pushback is that producer-emitted records prove protocol
  conformance, not that the producer ran the check it names. With one
  repository authority over producers, rows, registry and verdict, the
  machinery gives consistency, not independent assurance.

## Q3 — the next item, convergent

Both seats name the same deliverable: **a 16-check contract-and-classification
ledger with provisional verdicts.** It comes before any wrapper and before any
aspect registration. For each check it records:

- identity and source;
- the property measured;
- inputs and trust dependencies;
- applicability conditions;
- what makes the result vary;
- the proposed class and the evidence for it;
- unresolved questions and the authority each one needs;
- whether a producer can prove the property or only assert it.

Wrapping the three named checks would test transport, not classification.
Registering all 16 first would encode unresolved semantics as configuration.

**On the owner-reserved second principal**, both seats agree, and this is what
lets the ledger proceed: the ledger and a provisional verdict made under
existing authority **do not** need it. Promotion into an independently governed
registry, or any claim that a classification is independently approved,
**does**. openai: *"evidence ledger → classification verdict → governed registry
entry. Those are three different trust events, not one."*
