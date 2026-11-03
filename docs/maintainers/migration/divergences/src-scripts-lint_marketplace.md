# Divergence: lint_marketplace

## Script

- Python: `src/scripts/lint_marketplace.py`
- TypeScript: `src/scripts/lint_marketplace.ts`

## Symptom

One byte-level mismatch, confined to the malformed-`marketplace.json` path
where the message embeds the language's native JSON-parser error text:

- **Python output:** `❌  .claude-plugin/marketplace.json is not valid JSON: Expecting property name enclosed in double quotes: line 1 column 3 (char 2)`
- **TS output:** `❌  .claude-plugin/marketplace.json is not valid JSON: Expected property name or '}' in JSON at position 2 (line 1 column 3)`
- Affected channel(s): stdout

Every other case (valid repo, missing file, missing field, version mismatch,
nonexistent / SKILL.md-less / duplicate skill paths, empty plugins, missing
owner email, reverse-drift, completeness exemptions) is byte-identical.

## Root cause

The Python original catches `json.JSONDecodeError` and renders `str(exc)`,
which is CPython's hand-written decoder message
(`Expecting property name enclosed in double quotes: line L column C (char N)`).
The TypeScript port catches the `JSON.parse` `SyntaxError` and renders
`e.message`, which is V8's decoder message
(`Expected property name or '}' in JSON at position N (line L column C)`).
The two decoders disagree on wording, position vs. char offset, and clause
order for the same malformed input. Reproducing CPython's exact decoder
message in TS would require porting CPython's `json.scanner` state machine
verbatim — out of scope and of no consumer value: the message is a debugging
hint appended to the stable `… is not valid JSON: ` prefix, which is the
actual contract (alongside exit code 1). Mirrors the same cross-language
parser-error-text divergence already accepted for `check_memory`
(YAML parse-error class name).

## Verdict

`formatting-only` — the byte difference is a debugging-hint suffix with no
semantic or consumer impact. The stable `… is not valid JSON: ` prefix and the
exit code (1) are preserved; both are what callers and tests assert on.

## Evidence

- The TS twin `tests/scripts/lint_marketplace.test.ts` runs python3 and tsx in
  the same tmp cwd and asserts **byte-identical** stdout/stderr/exit for every
  fixture **except** the malformed-JSON one, where it asserts the stable
  contract (exit 1 + the `is not valid JSON` prefix on both) per this doc.
- The real-repo golden-parity case (the live CI invocation, which has a valid
  `marketplace.json`) is byte-identical.

## Approval

Approved as a Phase-4 documented divergence. Permanent — it stems from the
cross-language JSON-decoder error taxonomy, the same class as the accepted
`check_memory` YAML divergence.
