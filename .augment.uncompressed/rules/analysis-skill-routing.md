---
type: auto
description: "When choosing an analysis skill, route to the narrowest matching skill instead of defaulting to broad analysis"
source: package
---

# Analysis Skill Routing

When choosing an analysis skill, always route to the narrowest skill that still matches the actual problem shape.

Use `universal-project-analysis` only for:

* full project analysis
* deep architecture review
* broad multi-layer debugging
* unclear systems where the stack or boundaries must first be discovered

Use framework-specific project-analysis skills only after the framework is known.

Use root-cause analysis skills when the problem is concrete and hypothesis-driven.

Do not use broad analysis skills for:

* small isolated code questions
* normal feature work
* obvious local fixes
* framework-specific issues that already have a dedicated skill

Prefer:

* narrow specialist skill over broad analysis skill
* framework-specific skill over universal router when the framework is already explicit
* root-cause skill over full-project analysis when the issue is already localized

If the stack is unclear:

* start broad
* then narrow quickly
