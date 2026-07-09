---
model_tier: medium
name: supply-chain-intake
description: "Before adding/installing any dependency the agent named — verify the package exists (slopsquatting: ~1 in 5 AI suggestions are hallucinated), isn't typo-adjacent, is pinned + locked, and CVE-scanned"
domain: devops
workspaces:
  - engineering
packs:
  - engineering-base
---

# supply-chain-intake

An LLM generates a plausible-sounding package name token-by-token with no lookup against a real registry. ~19.7% of AI-recommended packages don't exist (576k-sample study); the same fake name recurs across runs, so attackers pre-register it as malware — "slopsquatting". The `huggingface-cli` PoC (an empty package matching a common hallucination) drew 30k+ downloads. Endor Labs: only ~1 in 5 AI-recommended dependency versions is both real *and* safe. A dependency the agent named is untrusted until verified — never install it just because the model produced the name.

## When to use

- About to add a dependency to `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` / `composer.json` / `pyproject.toml`, or run `npm/pnpm/yarn install`, `pip install`, `go get`, `cargo add`, `composer require`.
- Reviewing an AI-authored diff touching a dependency manifest or lockfile.
- An install command was suggested (especially `curl … | bash`).

Do NOT use when: no dependency is added and no manifest/lockfile is touched.

## The Iron Law

```
VERIFY THE PACKAGE EXISTS ON THE REAL REGISTRY BEFORE YOU INSTALL IT.
A NAME THE MODEL PRODUCED IS A HYPOTHESIS, NOT A DEPENDENCY.
PIN IT, LOCK IT, CVE-SCAN IT. NEVER PIPE A REMOTE SCRIPT STRAIGHT TO A SHELL.
```

## Procedure — intake gate (run in order before adding a dependency)

1. **Existence** — confirm the exact string resolves on the real registry, published before your session, with real usage:
   ```bash
   npm view <pkg> version        # non-zero exit = does not exist (hallucination)
   pip index versions <pkg>      # or: pip install <pkg>== to list
   go list -m <module>@latest
   cargo search <crate>
   ```
   Non-existent, brand-new (days old), or near-zero-download → **stop**, treat as hallucination/slopsquat.
2. **Typo-adjacency** — name within 1–2 chars of a far-more-popular package (`python-dateutil` vs `dateutil`, `lodahs` vs `lodash`)? Probably want the popular one — confirm before installing.
3. **Version safety** — the model's pin may predate a CVE fix (training-cutoff reintroduction). Take the current patched release, then scan:
   ```bash
   npm audit           # block on high/critical
   pip-audit
   osv-scanner -r .
   ```
4. **Pin + lock** — install exact + commit the lockfile; reject floating ranges (`^`, `latest`, no lockfile) on production deps.
   ```bash
   npm install --save-exact <pkg> && git add package-lock.json
   ```
5. **License** — confirm compatible with the project's declared license before it lands.
6. **No pipe-to-shell** — never `curl … | bash` an install; download → inspect → execute over pinned HTTPS, or surface it to the user for confirmation.

## Backstop greps

```bash
# Floating / unpinned production deps (npm)
rg -n '"[^"]+":\s*"(\^|~|\*|latest)' package.json
# Missing lockfile alongside a manifest
[ -f package.json ] && [ ! -f package-lock.json ] && echo "no lockfile"
# curl|bash install patterns anywhere in the change
rg -n 'curl[^|]*\|\s*(bash|sh)|wget[^|]*\|\s*(bash|sh)' .
```

## Output format

1. Per new dependency: name, resolved registry version, publish date / usage signal, and the existence-check command output (`npm view … → 4.17.21`) — proving it real.
2. The lockfile diff staged, and the `audit` / `osv-scanner` result (`0 high/critical`, or the finding + resolution).
3. For any suggested install command, confirmation it isn't `curl|bash` and the source is pinned HTTPS.

## Gotcha

- Hallucinated names are *repeatable* — re-prompting the same model yields the same fake name, so "it looked confident / consistent" isn't evidence it exists. Only the registry is.
- Short, "obvious" variants (`X-cli`, `X-client`, `X-sdk`) are the prime hallucination shape — verify these hardest.
- A package that exists but was published this week with 12 downloads is a slopsquat candidate, not a safe dep — weigh age + usage, not just existence.
- Lockfile integrity is part of the threat model: an unhashed or floating entry can pull a freshly-poisoned release even when a lockfile is "present".

## Do NOT

- Do NOT run an install command for a package you haven't existence-checked this session.
- Do NOT accept the model's version pin as authoritative — re-check against current CVEs.
- Do NOT commit a manifest change without its lockfile.
- Do NOT pipe a fetched script into an interpreter.
- Do NOT inline code that duplicates a copyleft source without carrying its license.

## Auto-trigger keywords

- dependency intake
- package hallucination
- slopsquatting
- add a dependency
- npm install / pip install / go get

## See also

- [`ai-code-blindspots`](../ai-code-blindspots/SKILL.md) — the surface→controls checklist that routes here.
- [`senior-engineering-discipline`](../../rules/senior-engineering-discipline.md) — anchor rule.
- [`dependency-upgrade`](../dependency-upgrade/SKILL.md), [`secrets-management`](../secrets-management/SKILL.md), [`security`](../security/SKILL.md).
