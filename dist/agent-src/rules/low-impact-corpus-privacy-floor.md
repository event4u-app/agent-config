---
type: "auto"
tier: "1"
consequence_class: "security-boundary"
description: "Writing/upstreaming low-impact-decisions corpus entries — non-bypassable privacy floor"
triggers:
  - path_prefix: "agents/decisions/low-impact-decisions"
  - path_prefix: "data/low-impact-decisions-seed"
  - keyword: "low-impact-decisions"
  - keyword: "low-impact corpus"
  - keyword: "learn-low-impact"
self_contained: true
workspaces: [agent-config-maintainer]
packs: [meta]
obligation_frequency: "per-edit"
---

# Low-Impact Corpus — Privacy Floor

## Iron Law

```
NO ENTRY LEAVES THE PROJECT REPO UNTIL THE REDACTOR CLEARS IT.
NO SECRETS. NO EMAILS. NO PROJECT PATHS. NO CUSTOMER NAMES.
NO INTERNAL HOSTNAMES. NO MONEY. NO BUSINESS SQL. NO LONG CODE.
```

The redactor — named under *See also* — runs at **both** gates:

1. **Write gate** — every intake append to
   `agents/decisions/low-impact-decisions.md`.
2. **Review gate** — every `/memory learn-low-impact` preview; a refused
   entry is named, never promoted.

A failure at either gate refuses the operation, surfaces the
offending pattern, and asks the user to rephrase. The redactor never
auto-rewrites — silent rewriting is a soft gate, this is hard.

## Forbidden-content classes (8)

| # | Class | Pattern source |
|---|---|---|
| 1 | Secrets | raw-key prefixes from `_RAW_KEY_PREFIXES` in `src/scripts/ai_council/config.ts` + inline `api_key:` shape |
| 2 | Emails | RFC-5322-ish |
| 3 | Project-rooted paths | `/Users/`, `/home/`, `/opt/`, `/private/`, drive letters, configured `repo_root` |
| 4 | Customer / tenant names | caller-supplied list; generic placeholders (`<customer>`, `<tenant>`, `<account>`, `<user>`) survive |
| 5 | Internal hostnames | `*.internal`, `*.local`, caller-supplied private domains |
| 6 | Monetary amounts | `$1,234`, `€500`, `USD 1000` shapes |
| 7 | Business-context SQL identifiers | caller-supplied table / column list |
| 8 | Inline code excerpts > 40 chars | backtick-fenced runs |

## Locked target types

- `agents/decisions/low-impact-decisions.md` — the project-local corpus.
- `data/low-impact-decisions-seed.md` — the package seed, **not in the
  tree**. Locked anyway, so a reappearing seed arrives under the floor.

## When to invoke

- A user intake trigger arrived (`TRIGGER_PHRASES` in
  `src/scripts/ai_council/low_impact_intake.ts`).
- An entry is about to reach the corpus, or a
  `/memory learn-low-impact` preview to render.

## What to surface on refusal

One-line marker:

```
> Low-impact corpus refused — <category>: <snippet…>. Rephrase or skip.
```

Then the agent stops the intake / upstream flow. No silent retry, no
auto-rewrite.

## See also

- `src/scripts/ai_council/redact_low_impact_entry.ts` — the redactor.
- `src/scripts/ai_council/low_impact_intake.ts` — write-gate caller.
- `agents/decisions/low-impact-decisions.md` — corpus + Anti-Examples list.
