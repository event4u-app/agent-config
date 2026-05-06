# Council brief — markitdown integration into a governed skill suite

## Decision under review

`event4u/agent-config` is a project-agnostic, multi-tool agent-skill
distribution package (Augment, Claude Code, Cursor, Cline, Windsurf,
Gemini, GitHub Copilot). It ships ~134 skills, ~55 rules, ~94 commands
under an Iron-Law floor (commit-policy, non-destructive-by-default,
language-and-tone, skill-quality, direct-answers). Skills are
**markdown-only** — no executable runtime is shipped, no SaaS auth, no
vendor SDKs are bundled.

We are evaluating **microsoft/markitdown** (MIT, Python ≥3.10, latest
v0.1.5 Feb 2026) and **microsoft/markitdown-mcp** (native MCP server,
single tool `convert_to_markdown(uri)`, supports stdio/HTTP/SSE,
default-binds to localhost, Docker image available).

**Goal:** reduce LLM token consumption when the agent has to read
PDFs, DOCX, XLSX, PPTX, EPUB, images (OCR), or transcripts. Today the
agent either fails on these formats or burns ~5-50× more tokens via
naive ingestion.

## The three options on the table

**Option A — Ship a senior-tier markitdown skill that documents
installation of `markitdown-mcp` as a peer-side MCP server.**
The skill is markdown-only (consistent with the suite identity); the
user runs `docker run -v <data>:/workdir markitdown-mcp:latest` and
points their MCP client at it. No code or dependencies enter the
package. Skill teaches WHEN to call `convert_to_markdown(uri)`,
provides per-format examples, and explicitly enforces the
non-destructive-by-default floor (read-only, localhost-bound, no
SSRF to external URIs without user confirmation).

**Option B — Ship a thin reference skill only (no install
guidance), point at upstream docs.**
Minimal footprint. Just enough to make the agent recognize the trigger
("convert this PDF to tokens-cheap markdown"). User wires up MCP
themselves. Lowest maintenance, lowest leverage.

**Option C — Skip. Recommend per-project libraries
(pdfplumber, openpyxl, mammoth) inline.**
No new skill. The downside: every consumer project re-invents the
wheel, and the agent has no consistent token-saving pattern across
projects.

## Constraints from our governance

- **Iron Law `non-destructive-by-default`:** any tool that reads
  arbitrary `file:` or `http:` URIs is a SSRF + path-traversal
  surface. Skill must mandate localhost binding, must not bind to
  network interfaces, must require user confirmation for
  non-workspace `file:` URIs.
- **Iron Law `skill-quality` § Structural Malice Floor:** the skill
  itself cannot ship credential exfiltration, remote execution, or
  shell injection. markitdown runs *outside* the skill (in MCP
  server) so the skill is just docs — but the skill must surface
  the security implications.
- **License compatibility:** MIT ↔ MIT — clean.
- **Language-and-tone:** skill written in English, any examples in
  English; runtime translation to user's language.

## Specific token-saving claim to scrutinize

A 50-page PDF with two embedded images and one table:
- Naive ingestion via PDF→base64 or raw extraction: ~80-120k tokens.
- markitdown markdown output: ~8-15k tokens.
- Realistic ratio: ~5-15× token reduction on typical documents,
  ~50× on image-heavy decks.

We have **not yet measured this ourselves**. The numbers are inferred
from PDF/DOCX XML overhead vs clean markdown.

## Questions for the council

1. Is Option A the right shape — peer-side MCP server documented by a
   markdown-only skill — given a governance-heavy, multi-tool
   distribution package? Or does that documentation-only skill end up
   being too thin to be useful?

2. The biggest risk we see is **SSRF + path traversal** via
   `convert_to_markdown(file:///etc/passwd)` or
   `convert_to_markdown(http://internal-network/secrets)`. Is making
   the skill enforce *only workspace-relative paths and only HTTPS to
   user-confirmed hosts* sufficient, or does the design need a
   sandbox boundary (gVisor, Firecracker, network namespace)?

3. Is the token-reduction claim (5-15× typical, 50× image-heavy)
   plausible? If we cannot ground it with a measurement before
   shipping, should we ship anyway with a "measure and report back"
   note, or block on measurement?

4. We are *not* shipping markitdown as a Python dependency in our
   composer/npm package — it stays a peer-side install. Is that the
   right boundary, or should we ship a `task install-markitdown`
   helper that runs `pipx install markitdown-mcp` for the user?

5. What is the single biggest thing we are missing in this design
   that you would not have thought of?

## Output format

Each member: 5 numbered answers (one per question), 3-6 lines each.
Be specific, name file paths, name failure modes, no platitudes.
Cite a known PDF/MCP failure mode if you have one. Do not summarise
the brief — just answer.
