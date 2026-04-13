---
name: universal-project-analysis
description: "ONLY when user explicitly requests: full project analysis, deep codebase audit, or comprehensive architecture review. NOT for regular bug fixes or feature work."
---

# universal-project-analysis

## Mission

Staff+ Engineer reconstructing reality. NOT shallow code scanner.

You:
- Build complete mental model of system
- Generate + test competing hypotheses
- Validate every assumption against code/docs/evidence
- Eliminate uncertainty systematically
- Explain root causes with confidence + evidence

## When to use

- Need full understanding of project/codebase
- Working with unknown frameworks/packages
- Analyzing architecture, bad practices, hidden problems
- Debugging complex multi-layer issues
- `analysis-autonomous-mode` routes here

NOT when: small isolated snippets, already understand system, framework-specific skill exists (use `project-analysis-laravel` for Laravel).

## Core principles

1. **Never assume** — verify against code/config/docs
2. **Version dictates behavior** — wrong version = wrong analysis
3. **Packages = external systems** — research, not guess
4. **Real-world issues matter** — search GitHub Issues, SO, changelogs
5. **Code without context meaningless** — understand execution flow first
6. **Multiple hypotheses always** — never stop at first explanation
7. **Evidence over intuition** — code/docs beat memory/assumptions

## Thinking model

1. **Observe** — what exists (code, config, structure)
2. **Understand** — how it works (execution flow, lifecycle)
3. **Verify** — correct? (docs, version-specific behavior)
4. **Hypothesize** — what could be wrong (multiple options)
5. **Validate** — test each (code + docs + real-world)
6. **Conclude** — only proven facts, mark uncertainty

## Analysis modes

- **Exploration** — system unknown → understand structure, identify risks
- **Investigation** — specific issue → find root cause, validate hypotheses
- **Optimization** — system works but inefficient → improve performance/complexity

---

## Mandatory workflow

### 1. Project discovery

Identify language, framework, runtime, package managers.

Sources: `composer.json`, `package.json`, config files, bootstrap, `Dockerfile`, CI, `AGENTS.md`, `README.md`.

No README? Search `.md` files across root, `docs/`, `agents/`, subdirs. Check `AGENTS.md`, `app/Modules/*/agents/`, `.github/copilot-instructions.md`.

### 2. Version resolution (CRITICAL)

**Unknown version = unreliable analysis.**

Priority: lock files → constraint files → CI/Dockerfile → framework bootstrap.

Behavior changes between major AND minor versions. Docs must match installed version.

### 3. Documentation loading (MANDATORY)

Per detected system:

**Framework:** Load version-specific docs (INSTALLED version, not latest). Validate assumptions. Check upgrade guides.

**Packages:** Identify exact version. Read official docs/changelog/upgrade guide/source. Understand usage/lifecycle/config/edge cases. Distinguish defaults from customizations.

### 4. Architecture mapping

- **Entrypoints:** routes, CLI, workers, scheduled tasks, webhooks
- **Dependency flow:** request → middleware → controller → service → repo → DB
- **Container/DI:** providers, bindings, singletons
- **Module boundaries:** code interaction paths
- **Domain structure:** models, services, events
- **State:** sessions, cache, DB, filesystem, external services

### 5. Execution model

Trace actual flow: Request/CLI/Queue/Event → service → DB → response/output/side effects.

Identify sync↔async boundaries, transaction boundaries, external calls.

### 6. Package deep dive

Per critical package:
1. Where used?
2. Used per docs?
3. Known issues for version?
4. Config correct?
5. Breaking changes vs tutorials?
6. `composer why <package>` — dependencies?

### 7. Real-world research (MANDATORY)

Search: exact error messages, stack traces, package+version+"issue", framework+unusual patterns.

Sources by authority: official docs → GitHub Issues → SO (verified) → vendor source → blog posts (skepticism).

---

## Hypothesis-driven analysis

### Hypothesis tree

For ANY issue, generate MULTIPLE competing explanations:

```
Root Problem
├── H1: Config issue (wrong env, cached stale config)
├── H2: Version mismatch (package expects different framework version)
├── H3: Package misuse (wrong API, wrong lifecycle hook)
├── H4: Async/timing (race condition, stale cache, job ordering)
├── H5: Data inconsistency (null unexpected, type mismatch)
└── H6: Architecture flaw (wrong abstraction, hidden coupling)
```

### Prioritize by

1. **Likelihood** — explains observed behavior?
2. **Impact** — how serious?
3. **Testability** — quick to confirm/reject?

### Validation loop

Per hypothesis: check code → check docs → check real-world → mark ✅ Confirmed / ❌ Rejected / ❓ Uncertain.

### Reality check

- Fully explains behavior?
- Anything unexplained?
- Multiple interacting causes?
- Senior engineer would agree?

Unexplained → continue. Do NOT present partial as complete.

---

## Cross-system interactions

| System A | ↔ | System B | Risk |
|---|---|---|---|
| Framework | ↔ | Package | Version mismatch, lifecycle hook, config conflict |
| Sync | ↔ | Async | Lost context, stale data, race conditions |
| Config | ↔ | Runtime | Cached config mismatch, env() outside config |
| Cache | ↔ | Database | Stale reads, inconsistent state |
| Auth | ↔ | Middleware | Order-dependent, missing guards |
| Model events | ↔ | Queue jobs | Fire during seeding/migration, serialization |
| Transaction | ↔ | External calls | Side effects can't rollback |

---

## Anti-pattern detection

**Architecture:** tight coupling, god classes (20+ methods/500+ lines), hidden side effects (observers), unclear responsibilities, circular dependencies.

**Framework misuse:** wrong lifecycle, abusing features (cache as DB, events as sync calls), ignoring conventions, `env()` outside config.

**Package:** wrong config for version, outdated tutorial patterns, breaking changes, undocumented APIs.

**Hidden:** race conditions, silent failures (empty catch), state problems (stale refs, partial updates), implicit dependencies, memory leaks.

---

## Framework knowledge

**Laravel:** Container misuse (wrong provider method, singleton vs transient), facade overuse, N+1 queries, queue serialization/tenant context, config caching, middleware order, model events in seeding/migration, route model binding.

**Symfony:** Autowiring conflicts, env vs parameter bags, event ordering, firewall config.

**Zend/Laminas:** Legacy service manager, config merge order, module conflicts.

**Node/Express:** Async/await pitfalls, middleware order, memory leaks in closures, module resolution.

---

## Output format (STRICT)

### Investigation summary
What analyzed, system+version, execution flow, mode.

### System model
Stack diagram, key entrypoints, packages+roles.

### Hypothesis tree
All hypotheses with status (confirmed/rejected/uncertain).

### Confirmed findings
Per finding: **Issue** (title), **Severity** (Low/Medium/High/Critical), **Context** (where/when), **Root Cause** (deep WHY), **Evidence** (code/doc/issue ref), **Fix** (concrete), **Confidence** (Low/Medium/High).

### Rejected hypotheses
What considered, disproven, WHY. Prevents re-investigation.

### Risk areas
Unverified suspicious parts. What evidence missing, what would confirm/reject.

### Priority fix plan
1. Critical root cause → 2. Stabilize → 3. Optimize → 4. Clean architecture.

### Next steps
What to check/fix/investigate. Which specialist skills to chain.

---

## Integration

- **analysis-autonomous-mode** — routes here, switches to specialists
- **project-analysis-laravel** — Laravel-specific deep analysis
- **bug-analyzer** — chain when bugs found
- **performance-analysis** — chain for bottlenecks
- **security-audit** — chain for vulnerabilities

## Decision rules

- Unclear → broaden (more context)
- Pattern match → narrow quickly
- Multiple causes → separate concerns
- Evidence missing → do NOT conclude (mark uncertain)
- First explanation too easy → challenge it

## Gotcha

- Full analysis expensive — only when explicitly requested
- Model spends too much time on trivial findings — focus high-impact
- Analysis docs must note date — point-in-time snapshot

## Do NOT

- Assume framework behavior — verify against version-specific docs
- Skip doc lookup for important packages
- Ignore versions — behavior changes between releases
- Give generic advice — specific code refs + evidence
- Stop at first explanation — test multiple hypotheses
- Present guesses as facts — mark confidence
- Trust tutorials over official docs
- Ignore contradictory evidence
