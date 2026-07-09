---
model_tier: medium
name: frontend-render-security
description: "Writing/reviewing client-side UI (React/Vue/vanilla) — insecure-render + client-trust gaps AI ships: XSS via innerHTML, client secrets, client-only auth, CORS wildcard, token in localStorage"
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
---

# frontend-render-security

AI optimizes for the shortest code producing the requested visible behavior and omits the invisible defensive layer — the sanitizer, origin check, server-side gate, security header. Large samples put XSS in a majority of AI frontend code, ~2.74× more than human; every agent in the Tenzai benchmark shipped client-side flaws. High-precision, grep-catchable patterns — stop them at authoring time.

## When to use

- Writing/modifying a component, template, or client-side script that renders data, calls an API, handles auth, or reads the URL / `postMessage`.
- Reviewing an AI-authored frontend diff.
- Editing `.tsx` / `.jsx` / `.vue` / `.svelte` / `.html` or client-side `.js` / `.ts`.

Do NOT use when: change is server-only, CLI, or non-UI — route to `security` / `security-sensitive-stop`.

## The Iron Law

```
NEVER RENDER NON-CONSTANT INPUT INTO AN HTML/JS SINK WITHOUT ENCODING OR SANITIZING.
THE CLIENT IS UNTRUSTED — EVERY CLIENT GATE NEEDS A SERVER-SIDE TWIN.
NO SECRET, PRIVILEGED KEY, OR SESSION TOKEN LIVES IN CLIENT CODE OR localStorage.
```

## Procedure

1. Identify the sinks in the diff: HTML/JS render points, API calls, auth/role checks, URL / `postMessage` reads, secret/token usage.
2. Run the backstop greps below; for each hit, apply the matching fix from the patterns table.
3. For every client-side gate, confirm a server-side twin exists (the client is never the security boundary).
4. Emit the per-diff verdict (Output format); surface any unresolved hit to the user.

## The patterns AI ships by default

| Pattern | Why dangerous | Do instead |
|---|---|---|
| `dangerouslySetInnerHTML` / `v-html` / `.innerHTML =` on non-constant value | Stored/DOM XSS (CWE-79) | render as text, or sanitize (DOMPurify) if HTML required |
| Secret / API key inline or in `NEXT_PUBLIC_*` / `VITE_*` | Bundler inlines it into shipped JS (CWE-798) | call third party via backend-for-frontend proxy; only truly-public values get a public prefix |
| Client-side-only auth / role / validation | Bypassable via dev tools or proxy (CWE-602) | client gate = UX only; enforce server-side |
| `location.*` / query param → HTML or JS sink | DOM XSS (CWE-79) | `textContent`; never pass URL data into an HTML/exec sink |
| CORS `origin: '*'` (esp. with credentials) | Any site reads authenticated responses (CWE-942) | explicit origin allow-list; never reflect `Origin` on credentialed routes |
| Token / JWT in `localStorage` / `sessionStorage` | XSS-exfiltratable (CWE-522) | `HttpOnly; Secure; SameSite` cookie |
| `addEventListener('message', …)` without `event.origin` check | Any embedder drives the handler (CWE-346) | strict-equality `event.origin` vs allow-list first |
| `redirect` / `next` param → `location` / `router.push` | Open redirect / phishing (CWE-601) | relative-path or allow-listed-host only; reject external / non-http schemes |
| `eval` / `new Function` / string-`setTimeout` on input | Eval injection / RCE (CWE-95) | a parser or explicit allow-list |
| `target="_blank"` without `rel="noopener"` | Reverse tabnabbing (CWE-1022) | add `rel="noopener noreferrer"` |
| Missing CSP; missing alt/label/contrast | No XSS second line of defense; a11y failures | strict CSP (no `unsafe-inline`); alt text, labels, AA contrast |

## Backstop greps

Run before committing frontend changes; each returns zero (or every hit is read + justified):

```bash
# Insecure render + eval sinks
rg -n 'dangerouslySetInnerHTML|v-html|\.innerHTML\s*=|document\.write\(|\beval\(|new Function\(' src/
# Client secrets / token storage
rg -n 'NEXT_PUBLIC_.*(SECRET|KEY|TOKEN|PASSWORD)|VITE_.*(SECRET|KEY)|localStorage\.setItem\([^)]*[Tt]oken' src/
# Wildcard CORS + unchecked postMessage + open redirect
rg -n "origin:\s*['\"]\*['\"]|Access-Control-Allow-Origin.*\*" src/
rg -n "addEventListener\(\s*['\"]message['\"]" src/   # then confirm each checks event.origin
# Unhardened external links
rg -n 'target=["'\'']_blank["'\'']' src/   # then confirm rel="noopener" present
```

## Output format

1. A per-diff verdict listing each pattern class checked + result (`clean` / `hit at file:line → fixed by <change>`).
2. The backstop greps run, with results.
3. For any client gate added, file:line of its **server-side twin** (or an explicit note the server check already exists + where).

## Gotcha

- Modern browsers default `_blank` to `noopener`, but legacy/embedded webviews don't — keep the `rel` for portability.
- `NEXT_PUBLIC_`/`VITE_` on a *genuinely* public value (a publishable analytics ID) is fine; the violation is a *sensitive* name behind that prefix. Read the name, don't blanket-block the prefix.
- A sanitizer (DOMPurify) is the fix only when HTML output is actually required; if plain text suffices, render text and skip the dependency.
- Client-side validation isn't wrong — it's wrong *as the only* enforcement. Keep it for UX; add the server twin.

## Do NOT

- Do NOT render user/DB HTML through `dangerouslySetInnerHTML`/`v-html`/`innerHTML` without a sanitizer.
- Do NOT put a secret, privileged key, or session token in client code or web storage.
- Do NOT treat a client-side role/auth check as a security boundary.
- Do NOT set `origin: '*'` on a credentialed endpoint.
- Do NOT auto-strip a grep hit without reading it — some innerHTML uses are on constant, trusted markup.

## Auto-trigger keywords

- frontend security
- XSS
- dangerouslySetInnerHTML
- client-side secret
- insecure render

## See also

- [`ai-code-blindspots`](../ai-code-blindspots/SKILL.md) — the surface→controls checklist that routes here.
- [`senior-engineering-discipline`](../../rules/senior-engineering-discipline.md) — anchor rule.
- [`security`](../security/SKILL.md), [`defense-in-depth`](../defense-in-depth/SKILL.md), [`accessibility-auditor`](../accessibility-auditor/SKILL.md), [`secrets-management`](../secrets-management/SKILL.md).
