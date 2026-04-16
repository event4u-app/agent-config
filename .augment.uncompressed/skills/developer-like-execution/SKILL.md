---
name: developer-like-execution
description: "Use when implementing, debugging, or modifying code. Enforces think → analyze → verify → execute workflow with real developer behavior."
source: package
---

# developer-like-execution

## When to use

- Implementing features
- Fixing bugs
- Refactoring code
- Analyzing unexpected behavior
- Working with APIs, frontend, or backend logic

Do NOT use when only explaining concepts or writing documentation without execution.

## Goal

Act like a real developer: think before acting, analyze before coding, verify before concluding. Avoid unnecessary trial-and-error.

## Core principles

- Never start coding without understanding the system
- Prefer analysis over guessing
- Avoid unnecessary loops and retries
- Minimize data and tool usage for efficiency
- Always validate changes with real execution when possible

## Procedure

### 1. Understand the task

- Read the request carefully
- Identify expected outcome
- Identify affected parts of the system

### 2. Analyze BEFORE acting

- Inspect relevant code
- Check existing logic and data flow
- Compare with requirements, tickets, existing behavior
- Identify possible root causes or implementation paths

### 3. Form a plan

- Define minimal steps needed
- Avoid unnecessary changes
- Prefer simplest correct solution

### 4. Use tools like a real developer

When available:

- Use debugger (e.g. Xdebug) for tracing
- Use logs instead of guessing
- Use CLI tools to inspect data

Efficiency rules:

- Use `jq` to extract relevant JSON parts
- Avoid loading full datasets when partial is enough
- Avoid unnecessary loops or brute force exploration

### 5. Implement

- Apply focused changes only
- Do not rewrite unrelated code
- Follow existing patterns

### 6. Verify (MANDATORY)

Backend:

- Call endpoints using `curl` or similar
- Use Postman collection if available

Frontend:

- Use Playwright or browser testing
- Verify real UI behavior

General:

- Confirm expected output
- Check for regressions

### 7. Validate

- Does the result match the requirement?
- Are edge cases handled?
- Is the solution minimal and correct?

## Output format

1. Short explanation of what was done
2. Code changes (if applicable)
3. Verification result (what was tested and how)
4. Any risks or follow-ups

## Gotchas

- The model tends to start coding too early → always analyze first
- The model tends to brute-force → prefer targeted inspection
- The model tends to over-fetch data → use selective extraction (e.g. jq)
- The model may skip verification → always test changes

## Do NOT

- Start coding without understanding the codebase
- Guess behavior without verifying
- Load full datasets when not needed
- Rely on trial-and-error loops
- Skip verification steps
- Modify unrelated parts of the system
