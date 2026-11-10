## Startup contract

- **When:** after every code edit.
- **Must:** find ALL downstream changes — callers / call sites, interface implementations, subclasses, tests, imports / use statements, type definitions, config / bindings, API schemas, routes, and the doc that describes a changed public surface — and update them in the same change · after fixing a defect, grep the tree for the exact wrong construct and report how many sites matched and which.
- **Never:** move on to the next task, claim completion, or suggest committing until every caller, test, import, and reference is updated; missing one is a critical failure.
- **Ask first:** before starting a breaking change nobody asked for — removing or renaming a public method/class · changing a method signature · changing an API response structure · removing a database column or table · changing an event payload · renaming a route name the frontend uses. A change the user explicitly requested is already answered: make it, and update every caller in the repository in the same change.
- **Verify:** syntax check, test suite, type-checker, zero grep results for the old name, no own-orphans, no doc drift.
