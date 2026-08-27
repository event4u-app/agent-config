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

AI optimizes for the shortest code that produces the requested visible behavior and omits the invisible defensive layer — the sanitizer, the origin check, the server-side gate, the security header. Large samples put XSS in a majority of AI frontend code and ~2.74× more XSS than human code; every agent in the Tenzai benchmark shipped client-side flaws. These are high-precision, grep-catchable patterns — stop them at authoring time.

## When to use

- Writing or modifying a component, template, or client-side script that renders data, calls an API, handles auth, or reads the URL / `postMessage`.
- Reviewing an AI-authored frontend diff.
- Editing `.tsx` / `.jsx` / `.vue` / `.svelte` / `.html` or client-side `.js` / `.ts`.

Do NOT use when: the change is server-only, CLI, or non-UI — route to `security` / `security-sensitive-stop`.

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

| Pattern | Why it's dangerous | Do instead |
|---|---|---|
| `dangerouslySetInnerHTML` / `v-html` / `.innerHTML =` on non-constant value | Stored/DOM XSS (CWE-79) | render as text, or sanitize (DOMPurify) if HTML is required |
| Secret / API key inline or in `NEXT_PUBLIC_*` / `VITE_*` | Bundler inlines it into shipped JS (CWE-798) | call the third party via a backend-for-frontend proxy; only truly-public values get a public prefix |
| Client-side-only auth / role / validation | Bypassable with dev tools or a proxy (CWE-602) | client gate is UX only; enforce the same check server-side |
| `location.*` / query param → HTML or JS sink | DOM XSS (CWE-79) | `textContent`; never pass URL data into an HTML/exec sink |
| CORS `origin: '*'` (esp. with credentials) | Any site reads authenticated responses (CWE-942) | explicit origin allow-list; never reflect `Origin` on credentialed routes |
| Token / JWT in `localStorage` / `sessionStorage` | XSS-exfiltratable (CWE-522) | `HttpOnly; Secure; SameSite` cookie |
| `addEventListener('message', …)` without `event.origin` check | Any embedder drives the handler (CWE-346) | strict-equality check `event.origin` against an allow-list first |
| `redirect` / `next` param → `location` / `router.push` | Open redirect / phishing (CWE-601) | relative-path or allow-listed-host only; reject external / non-http schemes |
| `eval` / `new Function` / string-`setTimeout` on input | Eval injection / RCE (CWE-95) | a parser or explicit allow-list |
| `target="_blank"` without `rel="noopener"` | Reverse tabnabbing (CWE-1022) | add `rel="noopener noreferrer"` |
| Missing CSP; missing alt/label/contrast | No XSS second line of defense; a11y failures | strict CSP (no `unsafe-inline`); alt text, labels, AA contrast |

## The server-composed bootstrap payload

A payload assembled **server-side and serialised into the page** for a client
island is a data-exposure surface: whatever is put in it is readable by anyone
who can load the page — no API call, no auth check, view-source. Several
mainstream frameworks ship their own named channel for exactly this, so the
pattern is a documented mechanism rather than one project's arrangement.

**Inspect the existing payload before judging any field.** Read what the channel
already carries and check current call sites for what the client actually
consumes — a field is only defensible against what the page needs, and a review
that never opened the payload is a guess. The grep below finds it.

**The per-field question, which is what this section is:**

> Would I return this field from a **public, unauthenticated** endpoint?
> If not, it does not belong in the payload.

Field classes that recur and are almost always wrong there: internal ids that
enumerate other users' rows · permission and role structures the client only
needs a boolean of · feature-flag payloads carrying unreleased product names ·
anything from an admin-scoped query that was convenient to reuse · a whole
serialised model where the page needs three of its fields.

**Nothing enforces this, and the split is deliberate.**

| Half | What it does | What it cannot do |
|---|---|---|
| the grep below | **locates** a payload a field was added to | tell a privileged field from a public one |
| this checklist entry | carries the **judgement** | run |

The question is not decidable by any check: a grep over the framework-named
payload channels cannot read intent. So the deterministic half is discovery,
advisory and non-blocking, and its whole value is putting the question in front
of a reader who would otherwise never see it. `enforced_by: none` is the honest
field here — this section refuses nothing.

**What may NOT be encoded.** The particular channel any one repository uses.
What is encoded is the question and the framework-named channels; a concrete
in-house payload shape would be one repository's implementation shipped as
guidance.

## Backstop greps

Run before committing frontend changes; each should return zero (or every hit is read and justified):

```bash
# Insecure render + eval sinks
rg -n 'dangerouslySetInnerHTML|v-html|\.innerHTML\s*=|document\.write\(|\beval\(|new Function\('
# Client secrets / token storage
rg -n 'NEXT_PUBLIC_.*(SECRET|KEY|TOKEN|PASSWORD)|VITE_.*(SECRET|KEY)|localStorage\.setItem\([^)]*[Tt]oken'
# Wildcard CORS + unchecked postMessage + open redirect
rg -n "origin:\s*['\"]\*['\"]|Access-Control-Allow-Origin.*\*"
rg -n "addEventListener\(\s*['\"]message['\"]"   # then confirm each checks event.origin
# Unhardened external links
rg -n 'target=["'\'']_blank["'\'']'   # then confirm rel="noopener" present
# Server-composed bootstrap payload — LOCATES it; the per-field judgement is yours
rg -n '__NEXT_DATA__|__NUXT__|window\.__INITIAL_STATE__|@json\(|json_encode\([^)]*\)\s*\)?\s*</script>|dehydratedState'
```

## Output format

1. A per-diff verdict listing each pattern class checked and its result (`clean` / `hit at file:line → fixed by <change>`).
2. The backstop greps run, with results.
3. For any client gate added, the file:line of its **server-side twin** (or an explicit note that the server check already exists and where).

## Gotcha

- Modern browsers default `_blank` to `noopener`, but legacy/embedded webviews do not — keep the `rel` for portability.
- `NEXT_PUBLIC_`/`VITE_` on a *genuinely* public value (a publishable analytics ID) is fine; the violation is a *sensitive* name behind that prefix. Read the name, don't blanket-block the prefix.
- A sanitizer (DOMPurify) is the fix only when HTML output is actually required; if plain text suffices, render text and skip the dependency.
- Client-side validation is not wrong — it is wrong *as the only* enforcement. Keep it for UX; add the server twin.

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
