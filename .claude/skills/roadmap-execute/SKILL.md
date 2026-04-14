---
name: roadmap-execute
description: "Roadmap Execute"
disable-model-invocation: true
---

# roadmap-execute

## Instructions

### 1. Find roadmap

List `agents/roadmaps/*.md` + `app/Modules/*/agents/roadmaps/*.md` (exclude `template.md`). One → confirm. Multiple → list. None → suggest `/roadmap-create`.

### 2. Read + summarize — phases, progress, next open step

### 3. Execute step by step

Per step: summarize → analyze codebase → plan → ask confirm. Yes → implement + quality + mark `[x]`. No → skip. Stop → summarize.

### 4. After each step — update roadmap, quality checks, "continue?"

### 5. After phase — summarize, "continue Phase N+1?"

### 6. Done/stopped — progress summary, update file

### Rules

- No commit/push. Ask before implementing. Quality checks. Break down large steps. Flag uncovered problems.
