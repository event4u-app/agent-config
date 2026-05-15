---
type: "auto"
tier: "1"
description: "Writing, editing, or upstreaming entries in `agents/low-impact-decisions.md` — non-bypassable privacy floor for the learning corpus."
source: package
triggers:
  - path_prefix: "agents/low-impact-decisions"
  - keyword: "low-impact-decisions"
  - keyword: "low-impact corpus"
  - keyword: "learn-low-impact"
---

# Low-Impact Corpus — Privacy Floor

## Iron Law

```
NO ENTRY LEAVES THE PROJECT REPO UNTIL THE REDACTOR CLEARS IT.
NO SECRETS. NO EMAILS. NO PROJECT PATHS. NO CUSTOMER NAMES.
NO INTERNAL HOSTNAMES. NO MONEY. NO BUSINESS SQL. NO LONG CODE.
```

Redactor lives in `scripts/ai_council/redact_low_impact_entry.py`
and runs at **both** gates:

1. **Write gate** — every intake append to
   `agents/low-impact-decisions.md` (Phase 12 § Step 2).
2. **Upstream gate** — every `/memory learn-low-impact` PR draft,
   before diff leaves repo (Phase 12 § Step 5).

Failure at either gate refuses the operation, surfaces offending
pattern, asks user to rephrase. Redactor never auto-rewrites — silent
rewriting is soft gate, this is hard.

## Forbidden-content classes (8)

| # | Class | Pattern source |
|---|---|---|
| 1 | Secrets | raw-key prefixes from `scripts/ai_council/config._RAW_KEY_PREFIXES` + inline `api_key:` shape |
| 2 | Emails | RFC-5322-ish |
| 3 | Project-rooted paths | `/Users/`, `/home/`, `/opt/`, `/private/`, drive letters, configured `repo_root` |
| 4 | Customer / tenant names | caller-supplied list; generic placeholders (`<customer>`, `<tenant>`, `<account>`, `<user>`) survive |
| 5 | Internal hostnames | `*.internal`, `*.local`, caller-supplied private domains |
| 6 | Monetary amounts | `$1,234`, `€500`, `USD 1000` shapes |
| 7 | Business-context SQL identifiers | caller-supplied table / column list |
| 8 | Inline code excerpts > 40 chars | backtick-fenced runs |

## Locked target types

- `agents/low-impact-decisions.md` — project-local corpus.
- `data/low-impact-decisions-seed.md` (agent-config package) —
  upstream seed shipped with the package.

## When to invoke

- Host agent just received user intake trigger (see
  `scripts/ai_council/low_impact_intake.TRIGGER_PHRASES`).
- Host agent about to write entry to corpus or open `/memory learn-low-impact` PR.

## What to surface on refusal

One-line marker:

```
> Low-impact corpus refused — <category>: <snippet…>. Rephrase or skip.
```

Then agent stops intake/upstream flow. No silent retry, no auto-rewrite.

## See also

- `scripts/ai_council/redact_low_impact_entry.py` — the redactor.
- `scripts/ai_council/low_impact_intake.py` — write-gate caller.
- `agents/low-impact-decisions.md` — corpus + Anti-Examples list.
