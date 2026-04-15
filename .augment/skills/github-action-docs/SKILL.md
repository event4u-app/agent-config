---
name: github-action-docs
description: "Use when documenting GitHub Actions workflows, CI pipelines, or automation setups."
source: project
---

# github-action-docs

## When to use

* Documenting GitHub Actions workflows
* Explaining CI/CD pipelines
* Describing automation steps

Do not use for editing workflow YAML (use github-ci) or general project docs (use readme-generator).

## Goal

* Clearly explain workflow purpose and steps
* CI behavior understandable
* Reproducible examples

## Preconditions

* GitHub Actions workflow exists or being created
* YAML config involved
* Output readable and copyable

## Decision hints

* Complex workflow → break into steps
* Multiple jobs → explain each separately
* Environment variables → document clearly

## Procedure

### 0. Inspect workflow

* Read YAML first
* Identify triggers, jobs, steps, secrets
* Note dependencies between jobs

### 1. Document

1. Purpose
2. Triggers (push, PR, etc.)
3. Jobs and steps breakdown
4. Important commands
5. Required secrets/env vars

### 2. Validate

* All referenced secrets documented
* Trigger conditions match intended behavior
* No hidden dependencies unexplained

## Output format

1. Short explanation → workflow breakdown (jobs → steps) → commands → secrets → config notes

## Core rules

* Simple, structured explanations
* Focus on what workflow does
* Avoid unnecessary YAML complexity
* Commands must be understandable

## Gotchas

* Missing secrets cause runtime failures
* Wrong triggers lead to confusion
* Hidden dependencies break CI

## Do NOT

* Do NOT paste large YAML without explanation
* Do NOT assume CI knowledge
* Do NOT omit required environment variables

## Auto-trigger keywords

* github actions, CI/CD, workflow, pipeline, automation

## Anti-patterns

* Raw YAML dump without explanation
* Documenting only happy path
* Missing secrets/env vars list

## Examples

Good: Purpose → trigger (on PR) → jobs (lint, test, deploy) → secrets (AWS_KEY) → notes
Bad: raw YAML dump without explanation
