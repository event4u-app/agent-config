# Anti-reskin gate for your skills repo

If you maintain a catalog of AI-agent skills and accept community PRs, your
failure mode is the **find-replace re-skin**: an existing skill resubmitted
with "Laravel" → "Symfony", "Vietnam" → "Korea", new name, same substance.
Keyword-cosine and token-Jaccard checks miss it; manual review does not scale
past a handful of PRs per month.

This package ships the gate that catches it: `lint_originality` — an
entity-neutralized shingle-overlap linter. Framework / vendor / region proper
nouns are neutralized before comparing 8-word shingles, so the swap does not
move the score: a re-skin scores ~100 % overlap while the worst legitimate
pair in a 496-artifact corpus scores 40 %. Class templates and
document-frequency boilerplate are subtracted, so shared scaffolding never
scores. The `--changed` mode is batch-masking-hardened: a batch of
near-identical submissions cannot classify its own shared shingles as
boilerplate (regression-locked in `tests/scripts/lint_originality.test.ts`).

It runs as a blocking PR gate on this repo (`originality-gate` job in
[`.github/workflows/skill-lint.yml`](../.github/workflows/skill-lint.yml)).

## Run it on your own catalog — today

The tool is not yet a standalone package; it runs from a clone. The corpus
roots are fixed (`src/skills/*/SKILL.md`), so you stage your skills into one:

```bash
git clone --depth 1 https://github.com/event4u-app/agent-config
cd agent-config && npm ci

# Stage your catalog into the skills corpus root (one dir per skill):
for f in /path/to/your-repo/skills/*/SKILL.md; do
  d="src/skills/ext-$(basename "$(dirname "$f")")"
  mkdir -p "$d" && cp "$f" "$d/SKILL.md"
done

# Compare your skills against each other (and this corpus) in one pass:
./scripts-run src/scripts/lint_originality --changed src/skills/ext-*/SKILL.md
```

Exit `1` with an offending pair + overlap % means a re-skin; exit `0` means no
same-class pair exceeds the 40 % warn floor. Thresholds are env-overridable
(`ORIGINALITY_FAIL`, `ORIGINALITY_WARN`).

## Want this as a zero-config `npx` tool?

We will extract `lint_originality` as a standalone zero-config package
(`--changed` mode for PR CI, no repo coupling, regression suite included) **if
there is real demand** — the bet is settled by a measured floor, not opinion:

- **Signal:** open an issue on this repo titled `anti-reskin gate: standalone
  request` (or reference `lint_originality` in an issue/PR about your own
  catalog).
- **Floor:** ≥ 3 distinct external maintainers signal within 90 days of this
  page landing on `main` → we ship the extraction.
- **Kill criterion:** floor missed → extraction is cancelled and recorded;
  this page stays as the run-from-clone recipe.

Contract: [`docs/contracts/adoption-signal-floor.md` § Extraction demand
gate](contracts/adoption-signal-floor.md#extraction-demand-gate--lint_originality-standalone-probe).
