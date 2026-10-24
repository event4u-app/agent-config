# agent-config

agent-config is a governed suite of skills, rules and commands for AI coding
agents (Claude Code, Cursor, GitHub Copilot, Gemini CLI and others).

This extension adds only the read-only `agent-config` MCP server. It serves the
skills, rules and commands as MCP prompts, resources and tools; it installs
nothing and changes no files.

The full suite — rules, skills, commands and hooks projected into your
project — is installed with:

    npx -y @event4u/agent-config init

Run that in the project root when you want the rules to apply to this agent.
