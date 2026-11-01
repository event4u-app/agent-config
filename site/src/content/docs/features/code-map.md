---
title: "Code map: see who calls what before you change it"
description: agent-config code-graph map draws a local map of your codebase — callers, impact, tests for a change, data, interfaces and delivery — as a page you open in the browser.
---

Draw a map of the repository you are standing in and open it:

```bash
npx -y @event4u/agent-config code-graph map --open
```

[**Open the demo map →**](/agent-config/demo-map/) — drawn from a sample project, so you can click around before installing. It is sample data, not your code.

## What it does

`code-graph` builds a local index of your codebase, and `map` draws it into `agents/map/` in your repository: an `index.html` you open in the browser, a `MAP.md` your agent reads, and one page per area of the code. Besides who calls what, it reads — from files only — your migrations and schema files, outbound calls and API contracts, Docker and Terraform setup, CI pipelines and which files change together in git history.

In your AI tool, `/project:map` draws the same map and points the agent at it.

## When to use it

- Before a change you are not sure about: `agent-config code-graph impact --diff main` lists the callers, dependents and test files a diff can break.
- To find the tests for a symbol: `agent-config code-graph tests-for <symbol>`.
- When you join a codebase and want the shape of it in one page.

## Example

```bash
agent-config code-graph ask "who calls createInvoice"
agent-config code-graph tests-for createInvoice
```

`ask` takes one question in words and answers with the symbols and files it names, their callers and their tests.

## What it needs

- Nothing beyond the install: no API key, no database connection, no running service. It reads files in your repository.
- A browser to view the map.

## Limits

- An index is a pointer, not the truth: the agent confirms what it found in the source before it acts on it, and a text search finds what the index missed.
- It reads files only. Observed state such as a live database schema enters only if you save a dump into `agents/map/data/` yourself.
- An area with no facts says "no data yet" and why, rather than being hidden.
