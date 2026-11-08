## Startup contract

- **When:** skill declares allowed_tools, calls external APIs or runtime reaches external services; not internal capabilities (file read, code analysis), MCP config (mcp-tool-use), credential management.
- **Must:** least agency: narrowest tools/scopes/actions · deny by default: no tool unless in allowed_tools · names MUST match tool registry (static, not reachable MCP servers; `agent-config mcp:available`) · prefer read-only actions; writes need explicit approval · prefer scoped grants where the host supports it · refuse disallowed_tools match even if allowed · tool usage should be observable and logged · falsifiable numeric thresholds in descriptions where they apply.
- **Never:** API keys/tokens in skill files · arbitrary execution (adapters = fixed interfaces) · grant on doubt (deny and ask instead) · use a tool not in registry (flag registry-extension; add before use).
