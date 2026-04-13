---
skills: [pest-testing]
description: Run PHP tests inside the Docker container
---

# tests-execute

## Instructions

### 1. Detect runner (first match): Makefile → Taskfile → artisan → Pest → PHPUnit

Prefer Makefile/Taskfile (handle Docker + env).

### 2. Run — host for Make/Task, Docker for raw commands. Filter if specified.

### 3. Analyze — pass → summary. Fail → show details, ask: `1. Fix code` / `2. Fix test` / `3. Skip`

### 4. Re-run until green

### Rules — No commit/push. Ask before changing assertions. Slow → suggest specific file.

