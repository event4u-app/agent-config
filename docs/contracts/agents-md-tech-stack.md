---
stability: beta
keep-beta-until: 2026-08-12
---

# Tech stack — deep detail

Outboarded from `AGENTS.md` Phase 2 of `road-to-augment-limit-fit` to
keep the front-door file under the Augment workspace-guidelines
budget. AGENTS.md retains a 2-3 sentence summary; everything below
is the long-form reference.

## Recommended ingestion path for non-text formats

PDF, DOCX, XLSX, PPTX, EPUB, image, and audio inputs route through the
[`markitdown`](../../.agent-src/skills/markitdown/SKILL.md) skill — a
thin markdown-only wrapper over Microsoft's MIT-licensed
`markitdown-mcp` server (peer-side install, zero Python in this
package). The skill ships the four-layer security defense:

1. **Skill checklist** — frontmatter declares allowed input types, max
   sizes, and the disallow list (no remote URLs, no executables).
2. **Narrow API** — the skill exposes `convert(path) → markdown`; no
   shell-out, no arbitrary file globbing.
3. **Docker read-only** — `markitdown-mcp` runs in a read-only
   container with the mount restricted to the input file's directory.
4. **Localhost binding** — the MCP server binds to `127.0.0.1` only;
   no exposure to the host network.

Calibrated token claim: 3-5× comprehension on text-heavy formats
(PDF, DOCX), 10-50× on image-heavy formats (scanned PDF, PPTX with
diagrams). Measure locally with
`python3 scripts/measure_markitdown_lift.py` against
`tests/fixtures/markitdown-corpus/`.

## Cognition-only floor for Wings 2–4

Wings 2 (Product + Foundation), 3 (GTM + Growth), and 4 (Money +
Strategy + Ops) enforce a no-SaaS-auth, no-vendor-SDK,
no-stage-prescription floor: cognition artifacts (markdown tables,
scoring rubrics, walkthroughs) must work in any host without
external dependencies.

Mechanical enforcement: the structural-malice check in
`scripts/skill_linter.py` blocks:

- Credential exfiltration patterns (env-var reads of `*_TOKEN`,
  `*_KEY`, `*_SECRET` followed by network egress).
- Remote execution (subprocess to URLs, `eval` of network-fetched
  content).
- Shell injection in subprocess calls (string-concat shell commands
  with user-controlled input).

See `.agent-src.uncompressed/rules/skill-quality.md` § Structural
Malice Floor for the full rule.

## Distribution mechanics

- `type: library` in `composer.json`; no `app/` directory, no
  application runtime (no Laravel, Symfony, Next.js, or other
  framework app code).
- Published to Composer and npm as `event4u/agent-config` /
  `@event4u/agent-config`.
- Installed into consumer projects via `scripts/install.sh` (Bash)
  and `scripts/install.py` (Python bridge).

## See also

- [`AGENTS.md`](../../AGENTS.md) — front-door (kernel orientation only)
- [`docs/architecture.md`](../../docs/architecture.md) — package
  architecture and cloud-bundle pipeline
- [`.agent-src.uncompressed/rules/skill-quality.md`](../../.agent-src.uncompressed/rules/skill-quality.md)
  — Structural Malice Floor
- [`.agent-src/skills/markitdown/SKILL.md`](../../.agent-src/skills/markitdown/SKILL.md)
  — markitdown skill entry point
