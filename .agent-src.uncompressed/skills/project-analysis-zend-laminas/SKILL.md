---
name: project-analysis-zend-laminas
description: "Use for deep Zend Framework or Laminas project analysis: bootstrap, config merge order, service manager, MVC flow, data layer, and migration-specific risks."
source: package
---

# project-analysis-zend-laminas

## When to use

Use this skill when:

* The project uses Zend Framework or Laminas
* A deep framework-specific analysis is needed
* `universal-project-analysis` routes here after framework detection
* The issue spans bootstrap, config merge, ServiceManager, MVC flow, or migration concerns

Do NOT use when:

* The task is a small isolated change
* The project is not Zend/Laminas
* The issue is already isolated to another specialist domain

## Core principles

* Config merge order is runtime behavior
* ServiceManager resolution rules matter
* Shared services can hide state issues
* Legacy Zend/Laminas migrations often preserve subtle compatibility traps
* MVC flow and module boundaries must be traced explicitly

## Procedure

### 1. Confirm framework generation and version

Check: `composer.lock`, `composer.json`, Zend vs Laminas packages, PHP version, migration-related packages.
Validate: framework family is explicit, migration state is known, major modules/components are identified.

### 2. Analyze bootstrap and config merge order

Inspect: application bootstrap, module loading order, global/local/autoload config, environment-specific overrides, `Module.php` lifecycle hooks.

Check:

* merge order surprises
* missing overrides
* environment config mismatches
* heavy bootstrap logic

### 3. Analyze ServiceManager behavior

Inspect: factories, abstract factories, delegators, initializers, shared vs non-shared services, service aliases.

Check:

* incorrect sharing/state leakage
* slow abstract factory fallback
* delegator order problems
* initialization side effects

### 4. Trace request-to-response flow

Trace: route match → dispatch/listener flow → controller → service layer → data access → view model/response rendering.
Validate: authorization/input filtering path is visible, service resolution path is visible, rendering flow is explicit.

### 5. Analyze data layer and migration risks

Inspect: TableGateway/hydrators, Doctrine if present, SQL abstraction vs raw queries, buffered/unbuffered result usage, Zend → Laminas migration artifacts.

Check:

* namespace drift
* hidden legacy references
* data mapping inconsistencies
* memory/performance risks on large result sets

### 6. Validate Zend/Laminas analysis quality

Check:

* bootstrap and merge order are explicit
* ServiceManager behavior is mapped
* MVC and data flow are traceable
* migration/legacy risks are evidence-based
* next specialist skill is clear if needed

## Output format

1. Framework/version summary
2. Bootstrap/config findings
3. ServiceManager findings
4. MVC/data flow findings
5. Migration/legacy risks
6. Key risks and next steps

## Gotcha

* Many Zend/Laminas issues are caused by config order and service resolution, not controller code.
* Shared services and legacy migration remnants can create cross-request or environment-specific bugs.
* Old project behavior may depend on historical bootstrap side effects that are easy to miss.

## Do NOT

* Do NOT assume Laminas behavior if the project still carries Zend-era patterns
* Do NOT ignore config merge order
* Do NOT ignore shared-service behavior
* Do NOT treat migration leftovers as harmless
* Do NOT stop at controller code when bootstrap or ServiceManager behavior is involved
