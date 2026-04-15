---
name: github-action-docs
description: "Use when documenting GitHub Actions workflows, CI pipelines, or automation setups."
source: project
---

# github-action-docs

## When to use

Use this skill when:

* Documenting GitHub Actions workflows
* Explaining CI/CD pipelines
* Describing automation steps

Do not use this skill when:

* Writing or editing the workflow YAML itself (use github-ci skill)
* General project documentation (use readme-generator)

## Goal

* Clearly explain workflow purpose and steps
* Make CI behavior understandable
* Provide reproducible examples

## Preconditions

* GitHub Actions workflow exists or is being created
* YAML config is involved
* Output must be readable and copyable

## Decision hints

* If workflow is complex → break into steps
* If multiple jobs → explain each job separately
* If environment variables used → document them clearly

## Procedure

1. Explain purpose of the workflow
2. Describe triggers (push, PR, etc.)
3. Break down jobs and steps
4. Highlight important commands
5. Mention required secrets or env vars

## Output format

1. Short explanation
2. Workflow breakdown
3. Important commands or steps
4. Notes on configuration

## Core rules

* Keep explanations simple and structured
* Focus on what the workflow actually does
* Avoid unnecessary YAML complexity in docs
* Ensure commands are understandable

## Gotchas

* Missing secrets cause runtime failures
* Wrong triggers lead to confusion
* Hidden dependencies break CI

## Do NOT

* Do NOT paste large YAML blocks without explanation
* Do NOT assume CI knowledge
* Do NOT omit required environment variables

## Auto-trigger keywords

* github actions
* CI/CD
* workflow
* pipeline
* automation
