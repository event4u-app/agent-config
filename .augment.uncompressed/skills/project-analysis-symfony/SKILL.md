---
name: project-analysis-symfony
description: "Use for deep Symfony project analysis: kernel/bootstrap, container wiring, routing/request flow, Doctrine, security, Messenger, and Symfony-specific failure patterns."
source: package
---

# project-analysis-symfony

## When to use

Use this skill when:

* The project uses Symfony
* A deep Symfony-specific analysis is needed
* `universal-project-analysis` routes here after framework detection
* The issue spans kernel boot, DI, Doctrine, security, or Messenger

Do NOT use when:

* The task is a small isolated Symfony code change
* The issue is already narrowed to a different specialist skill
* The project is not actually Symfony

## Core principles

* Symfony behavior is highly container-driven
* Environment-specific config changes meaningfully affect runtime
* Service wiring and priority/order issues are common
* Doctrine and Messenger often hide critical operational behavior
* Security configuration must be traced end-to-end

## Procedure

### 1. Confirm Symfony version and app shape

Check: `composer.lock`, `composer.json`, Symfony packages/components, PHP version, environment config structure.
Validate: Symfony version is explicit, major bundles/components are identified, environment-specific config layout is known.

### 2. Analyze kernel and container boot

Inspect: Kernel bootstrap, bundle registration, compiler passes, `services.yaml`, autowiring/autoconfigure patterns, manual aliases/bindings, cache warmup/compiled container assumptions.

Check:

* autowiring conflicts
* decoration order
* tagged service priority
* circular dependency symptoms
* private/public service misuse

### 3. Trace request-to-response flow

Trace: route → request listeners/subscribers → controller → service layer → repository/Doctrine → serializer/forms → response.
Validate: request lifecycle is visible, security checks are visible, serializer/form behavior is explicit, response transformation path is clear.

### 4. Analyze Doctrine and persistence

Inspect: entity mapping, repositories, lifecycle callbacks, subscribers/listeners, migration posture, DQL/QueryBuilder/native SQL usage.

Check:

* schema drift
* proxy/lazy-loading issues
* N+1 behavior
* wrong lifecycle hook usage
* transaction boundaries

### 5. Analyze security and Messenger

Inspect: firewalls, authenticators, voters, access rules, Messenger transports, handler routing, retry/failed-message behavior.

Check:

* auth flow correctness
* firewall separation/context sharing
* voter assumptions
* failed-message handling
* serialization/transport issues

### 6. Validate Symfony analysis quality

Check:

* kernel/container behavior is explicit
* request/security/doctrine paths are mapped
* version-specific Symfony behavior was considered
* Messenger/security risks are evidence-based
* next specialist skill is clear if needed

## Output format

1. Symfony version and app summary
2. Kernel/container findings
3. Request/security flow
4. Doctrine findings
5. Messenger/async findings
6. Key risks and next steps

## Gotcha

* In Symfony, configuration and service wiring often explain more than the controller code.
* Compiler passes, decorators, tags, and priorities can change behavior in non-obvious ways.
* Doctrine and Messenger issues often appear as "application bugs" but originate in framework integration details.

## Do NOT

* Do NOT analyze Symfony without explicit version context
* Do NOT ignore service wiring and container behavior
* Do NOT treat Doctrine entities as simple data objects without lifecycle effects
* Do NOT skip security/firewall flow when access issues exist
* Do NOT ignore Messenger transport and retry behavior in async problems
