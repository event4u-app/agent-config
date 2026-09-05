# Tamper corpus

Fixture diffs for `detect_verification_tampering`, committed **before** the
detector so that the detector is written against a fixture set that already
exists rather than against itself (`road-to-deterministic-defect-detectors`
step 0.1).

## Shape

`manifest.json` is the machine-readable index. Every entry names:

| Field | Meaning |
|---|---|
| `id` | fixture id, unique |
| `diff` | file under `diffs/`, a plain unified diff |
| `kind` | `positive` (tampering, must be detected) or `negative` (must stay clean) |
| `expect` | detector ids that MUST fire — empty for every negative |
| `message` | the commit message the diff would land under |
| `why` | one line a human can read to agree with the classification |
| `negative_kind` | on negatives only: `shape` or `declared` (see below) |

## Two kinds of negative, and why both are needed

A detector only ever seen fire has unknown specificity. Two different things
can make a diff legitimate, and they falsify different halves:

- **`shape`** — the diff is structurally *not* the tampering shape: an
  assertion added rather than removed, a skip removed rather than added, a
  strengthened assertion, a deleted non-test file, a guarded early return.
  These prove the matcher is narrow. If a shape-negative starts firing, the
  matcher widened.
- **`declared`** — the diff **is** the tampering shape, and the commit message
  declares why it is legitimate with a scoped
  `tamper-allow: <detector-id> — <reason>` line. These prove the escape hatch
  works and is scoped to one id, so it can never blanket-suppress the rest.

The two named in the roadmap — a legitimately deleted obsolete test, and a
legitimately relaxed assertion whose commit message says why — are both
`declared`. Shape alone cannot tell either of them from tampering, and a
detector that claims it can would be asserting a judgement it does not have.
The `shape` negatives are additional, because the roadmap's Risk 1 is a
detector that fires on legitimate work and only shape-negatives falsify it.

## Verdict fixtures

`verdicts/*.json` carry a recorded runner verdict for the phantom-verification
check (step 2.1): `{ "status", "ran_at", "last_edit_at" }`. A verdict whose
`ran_at` precedes `last_edit_at` is not evidence of anything, however green it
reads.
