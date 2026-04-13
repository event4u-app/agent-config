---
name: fe-design
description: "Use when designing frontend interfaces — component architecture, layout patterns, form design, table patterns, responsive strategies, and UX principles for Blade/Livewire/Flux/Tailwind."
---

# Frontend Design Skill

## When to use

UI planning, component patterns, form design, responsive decisions, a11y review, Livewire structure.

## Stack: Blade (templates) → Livewire 3 (interactivity) → Flux (components) → Tailwind (styling). Server-first. JS only when Livewire can't (drag-drop, animations).

## Components

Blade partial (static) → Blade component (reusable, props) → Livewire (server state) → Flux (library elements) → Alpine.js (client micro-interaction).

One Livewire per concern. Compose with Blade inside Livewire. Flux for standard elements. Extract at 3+ uses.

## Forms: visible labels, validate on blur+submit, errors below field, required marked, logical grouping, prominent primary action.

Layout: 1-3 fields → single column. 4-8 → two columns desktop. 8+ → sections/tabs. Multi-step: progress indicator, back without data loss, validate per step, summary on final.

## Tables: right-align numbers, left-align text, sortable, sticky header, row actions, empty state. Responsive: desktop=full, tablet=hide columns, mobile=cards/scroll. Pagination: 25 default, show total, size options, Livewire server-side.

## Responsive: mobile-first. `sm:` 640, `md:` 768, `lg:` 1024, `xl:` 1280, `2xl:` 1536. Nav: hamburger→sidebar. Forms: single→two col. Tables: cards→full.

## A11y: 4.5:1 contrast, keyboard nav, focus indicators, alt text, ARIA labels, semantic HTML. No `<div onclick>`, color-only status, missing labels.

## UX: feedback (toast/loading), forgiveness (undo/confirm), consistency, progressive disclosure, loading states, error recovery.

## Related: `blade-ui`, `livewire`, `flux`, `tailwind`, `dashboard-design`

## Gotcha: check existing Flux/Livewire first, prefer project components over raw HTML, 320px minimum.

## Do NOT: skip mobile testing, fixed pixel widths, ignore a11y.
