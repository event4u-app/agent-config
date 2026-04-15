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
* Make CI behavior understandable
* Provide reproducible examples

## Preconditions

* GitHub Actions workflow exists or is being created
* YAML config involved
* Output readable and copyable

## Decision hints

* Complex workflow → break into steps
* Multiple jobs → explain each separately
* Environment variables → document clearly

## Procedure

1. Explain purpose of workflow
2. Describe triggers (push, PR, etc.)
3. Break down jobs and steps
4. Highlight important commands
5. Mention required secrets or env vars

## Output format

1. Short explanation → workflow breakdown → important commands → config notes

## Core rules

* Simple, structured explanations
* Focus on what the workflow does
* Avoid unnecessary YAML complexity in docs
* Commands must be understandable

## Gotchas

* Missing secrets cause runtime failures
* Wrong triggers lead to confusion
* Hidden dependencies break CI

## Do NOT

* Do NOT paste large YAML blocks without explanation
* Do NOT assume CI knowledge
* Do NOT omit required environment variables

## Auto-trigger keywords

* github actions, CI/CD, workflow, pipeline, automation
