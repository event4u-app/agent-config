---
name: universal-project-analysis
description: "ONLY when user explicitly requests: full project analysis, deep codebase audit, or comprehensive architecture review. NOT for regular feature work."
source: package
---

# universal-project-analysis

## Mission

Operate as a Staff+ Engineer who reconstructs reality.

You do NOT just "analyze code". You:

- build a complete mental model of the system
- generate and test competing hypotheses
- validate every assumption against code, docs, and real-world evidence
- eliminate uncertainty systematically
- explain root causes with confidence and evidence

This is a **deep investigation system**, not a shallow code scanner.

## When to use

Use this skill when:

- You need to fully understand a project or codebase
- You work with unknown frameworks or packages
- You analyze architecture, bad practices, or hidden problems
- You debug complex issues that span multiple layers
- `analysis-autonomous-mode` routes you here as the primary investigation skill

Do NOT use when:

- You only need small isolated code snippets
- You already fully understand the system
- Simple isolated code changes or regular feature work

## Core principles

1. **Never assume** — always verify against code, config, and docs
2. **Version dictates behavior** — wrong version = wrong analysis = wrong fix
3. **Packages are external systems** — must be researched, not guessed at
4. **Real-world issues matter** — search GitHub Issues, StackOverflow, changelogs
5. **Code without context is meaningless** — understand the execution flow first
6. **Multiple hypotheses always** — never stop at the first plausible explanation
7. **Evidence over intuition** — code and docs beat memory and assumptions

## Thinking model

Always think in this order:

1. **Observe** — what exists (code, config, structure)
2. **Understand** — how it works (execution flow, lifecycle)
3. **Verify** — is it correct (docs, version-specific behavior)
4. **Hypothesize** — what could be wrong (generate multiple options)
5. **Validate** — test each hypothesis (code + docs + real-world)
6. **Conclude** — only proven facts, mark uncertainty explicitly

## Analysis modes

Choose the mode that fits the situation. Switch between modes as understanding deepens.

### Exploration mode

Used when the system is unknown. Goal: understand structure, identify risks, find investigation paths.

### Investigation mode

Used when a specific issue exists. Goal: find root cause, validate hypotheses, explain with evidence.

### Optimization mode

Used when the system works but is inefficient. Goal: improve performance, reduce complexity.

---

## Mandatory analysis workflow

### 1. Project discovery

Identify:

- Language (PHP, JS, Python, Go, etc.)
- Framework (Laravel, Symfony, Zend, Express, Next.js, etc.)
- Runtime environment (Docker, serverless, traditional hosting)
- Package managers (Composer, npm, pip, etc.)

Sources: `composer.json`, `package.json`, config files, bootstrap/entrypoints, `Dockerfile`,
CI workflows, `AGENTS.md`, `README.md`.

**If no obvious README exists:** search for `.md` files across the project root, `docs/`,
`agents/`, and subdirectories. Documentation is sometimes placed in non-standard locations
(e.g., `AGENTS.md`, `docs/*.md`, `app/Modules/*/agents/`, `.github/copilot-instructions.md`).
Always run a search before concluding that no documentation exists.

### 2. Version resolution (CRITICAL)

Determine EXACT versions. Rule: **If version is unknown, the analysis is unreliable.**

Priority sources:

1. Lock files (`composer.lock`, `package-lock.json`) — source of truth
2. Constraint files (`composer.json`, `package.json`) — fallback
3. CI config, Dockerfile — secondary evidence
4. Framework bootstrap files — version constants

Why this matters:
- Behavior changes between major AND minor versions
- Breaking changes may not be obvious
- Documentation must match the installed version, not the latest

### 3. Documentation loading (MANDATORY)

For EACH detected system:

**Framework:**
- Load version-specific documentation (NOT the latest — the INSTALLED version)
- Validate behavior assumptions against docs
- Check upgrade guides if version is not the latest

**Packages:**
- Identify every critical package and its exact version
- Read official docs, changelog, upgrade guide, and relevant source code
- Understand intended usage, lifecycle, config options, and edge cases
- Distinguish default package behavior from project customizations

### 4. Architecture mapping

Build a complete mental model:

- **Entrypoints:** HTTP routes, CLI commands, queue workers, scheduled tasks, webhooks
- **Dependency flow:** request → middleware → controller → service → repository → DB
- **Container/DI usage:** service providers, bindings, singletons, contextual binding
- **Module boundaries:** which code talks to which other code
- **Domain structure:** business domains, their models, services, and events
- **State management:** sessions, cache, database, file system, external services

### 5. Execution model

Trace the actual flow for the area being analyzed:

- Request → controller → service → DB → response
- CLI → command → service → DB → output
- Queue → job → service → DB → side effects
- Event → listeners → side effects

Identify where sync meets async, where transactions begin/end, where external calls happen.

### 6. Package deep dive

For EACH critical package:

1. Where is it used in the codebase?
2. Is it used according to its documentation?
3. Are there known issues for this version? (GitHub Issues, changelogs)
4. Is the configuration correct?
5. Are there breaking changes between the installed version and what tutorials show?
6. Search: `composer why <package>` — who depends on it?

### 7. Real-world research (MANDATORY)

Search for:
- Exact error messages (quoted)
- Stack trace patterns
- Package name + version + "issue" or "bug"
- Framework version + unusual patterns observed

Sources (in order of authority):
1. Official documentation
2. GitHub Issues on the relevant repository
3. StackOverflow (verified answers)
4. Vendor source code
5. Blog posts (treat with skepticism)

---

## Hypothesis-driven analysis

### Building the hypothesis tree

For ANY issue found, generate MULTIPLE competing explanations:

```
Root Problem
├── H1: Config issue (wrong env, cached stale config)
├── H2: Version mismatch (package expects different framework version)
├── H3: Package misuse (API used incorrectly, wrong lifecycle hook)
├── H4: Async/timing issue (race condition, stale cache, job ordering)
├── H5: Data inconsistency (null where not expected, type mismatch)
└── H6: Architecture flaw (wrong abstraction, hidden coupling)
```

### Prioritizing hypotheses

Rank by:

1. **Likelihood** — how well does it explain the observed behavior?
2. **Impact** — if true, how serious is it?
3. **Testability** — can it be confirmed or rejected quickly?

Start with the most likely AND most testable hypothesis.

### Validation loop

For EACH hypothesis:

1. **Check code** — does the code support this explanation?
2. **Check docs** — does framework/package behavior confirm it?
3. **Check real-world** — have others experienced this?
4. **Mark result:**
   - ✅ **Confirmed** — evidence supports it
   - ❌ **Rejected** — evidence contradicts it
   - ❓ **Uncertain** — insufficient evidence, note what's missing

### Reality check

After reaching a conclusion, ask:

- Does this **fully** explain the observed behavior?
- Is there anything left **unexplained**?
- Could there be **multiple interacting causes**?
- Would a senior engineer on this project **agree** with this conclusion?

If anything is unexplained → continue analysis. Do NOT present partial explanations as complete.

---

## Cross-system thinking

Issues rarely exist in isolation. Always check interactions between:

| System A | ↔ | System B | What can go wrong |
|---|---|---|---|
| Framework | ↔ | Package | Version mismatch, wrong lifecycle hook, config conflict |
| Sync code | ↔ | Async code | Lost context, stale data, race conditions |
| Config | ↔ | Runtime | Cached config doesn't match env, env() outside config |
| Cache | ↔ | Database | Stale reads, inconsistent state after write |
| Auth | ↔ | Middleware | Order-dependent behavior, missing guards |
| Model events | ↔ | Queue jobs | Events fire during seeding/migration, serialization issues |
| Transaction | ↔ | External calls | Side effects can't be rolled back (emails, API calls) |

---

## Pattern and anti-pattern detection

### Architecture anti-patterns

- Tight coupling between modules that should be independent
- God classes (services with 20+ methods or 500+ lines)
- Hidden side effects (model events, observers doing unexpected work)
- Unclear responsibilities (controller does business logic, model does validation)
- Circular dependencies between services or modules

### Framework misuse

- Wrong lifecycle usage (booting logic in wrong service provider method)
- Abusing framework features (using cache as a database, using events as synchronous calls)
- Ignoring conventions (custom solutions for problems the framework already solves)
- `env()` calls outside config files (broken after `config:cache`)

### Package anti-patterns

- Wrong configuration for the installed version
- Outdated usage patterns copied from old tutorials
- Breaking changes between installed and documented version
- Using internal/undocumented package APIs

### Hidden issues

- Race conditions in concurrent code or queue workers
- Silent failures (empty catch blocks, swallowed exceptions)
- State problems (stale references, partial updates, missing rollbacks)
- Implicit dependencies (code works only because of execution order)
- Memory leaks (growing collections in long-running processes)

---

## Framework deep knowledge

### Laravel (extended investigation)

When the project uses Laravel, extend the standard workflow with:

**Boot analysis:**
- Service providers and registration order
- Environment-specific config loading, cache/config/route compilation
- Middleware stack and route grouping
- Queue, cache, mail, broadcast, session, and filesystem drivers

**Request-to-response trace:**
- Route → Middleware → FormRequest → Controller → Service → Model → Events → Response
- Verify: validation correctness, authorization/policy coverage, transaction boundaries,
  N+1/eager loading, hidden state changes in observers

**Data and schema analysis:**
- Migrations vs model relationships vs code assumptions
- Index usage, soft delete behavior, nullable mismatches, enum/cast/JSON columns

**Async and infrastructure flows:**
- Queued jobs (serialization, idempotency, retry loops)
- Scheduled commands, broadcasting, cache invalidation, external HTTP integrations

**Test posture:**
- Presence/quality of feature/unit/integration tests
- Factories, seeders, fakes/mocks; missing tests around critical paths

**Common deep issues:**
- Service Container misuse (binding in wrong provider method, singleton vs transient)
- Facade overuse (hiding dependencies, making testing harder)
- Eloquent N+1 queries (missing `with()`, lazy loading in loops)
- Queue issues (model serialization, lost tenant context, failed job handling)
- Config caching (env() returns null after config:cache)
- Middleware order (auth before rate limit? CORS before anything?)
- Model events in unexpected contexts (seeding, migration, queue)
- Route model binding (implicit vs explicit, soft deletes, wrong connection)

### Symfony

- Service definitions and autowiring conflicts
- Env configs vs parameter bags
- Event system ordering
- Security firewall configuration

### Zend / Laminas

- Legacy service manager patterns
- Config merge order
- Module system conflicts

### Node / Express

- Async/await pitfalls (unhandled rejections, missing awaits)
- Middleware order and error propagation
- Memory leaks in closures and event listeners
- Module resolution issues

---

## Output format (STRICT)

### Investigation summary

- What was analyzed
- System: framework + version, key packages
- Execution flow overview
- Mode: exploration / investigation / optimization

### System model

- Stack and architecture diagram
- Key entrypoints
- Important packages and their roles

### Hypothesis tree

List all hypotheses that were considered, with their status (confirmed / rejected / uncertain).

### Confirmed findings

For EACH finding:

- **Issue:** concise title
- **Severity:** Low / Medium / High / Critical
- **Context:** where and when it happens
- **Root Cause:** deep technical explanation (not just "it's wrong" but WHY it's wrong)
- **Evidence:** code reference, doc link, or real-world issue confirming this
- **Fix:** actionable, concrete solution
- **Confidence:** Low / Medium / High

### Rejected hypotheses

List what was considered but disproven, and WHY. This prevents others from re-investigating
the same dead ends.

### Risk areas

Unverified but suspicious parts that warrant further investigation. Mark what evidence is
missing and what would confirm or reject the suspicion.

### Priority fix plan

Ordered by:
1. Fix critical root cause first
2. Stabilize system
3. Optimize
4. Clean architecture

### Recommended next steps

What to check, fix, or investigate next. Which specialist skills to chain.

---

## Integration with other skills

- **analysis-autonomous-mode** — routes here for broad understanding, switches to specialists as needed
- **bug-analyzer** — chain when bugs are found during analysis (reactive or proactive mode)
- **performance-analysis** — chain when bottlenecks are found
- **security-audit** — chain when vulnerabilities are found

## Decision rules

- If unclear → broaden analysis (more context needed)
- If pattern matches → narrow quickly (go deep on the match)
- If multiple causes → separate concerns (analyze each independently)
- If evidence missing → do NOT conclude (mark as uncertain)
- If first explanation seems too easy → challenge it (test alternatives)

## Gotcha

- Full analysis is expensive (time + tokens) — only run when explicitly requested, never proactively.
- The model tends to spend too much time on trivial findings — focus on high-impact items.
- Analysis docs must note the date — they represent a point-in-time snapshot.

## Do NOT

- Do NOT assume framework behavior — verify against version-specific docs
- Do NOT skip documentation lookup for any package that matters
- Do NOT ignore versions — behavior changes between releases
- Do NOT give generic advice — be specific with code references and evidence
- Do NOT stop at the first explanation — always test multiple hypotheses
- Do NOT present guesses as facts — mark confidence level explicitly
- Do NOT trust tutorials over official docs — tutorials may target different versions
- Do NOT ignore contradictory evidence — it usually means the model is wrong
