"""Block D pilot tools for skill discovery and persona auditing.

These four tools (D1 meta-linter + D2/D3/D4 functional pilots) ship under
this subdirectory per Block D council verdict (D-OQ2 → b). Each tool is:

  - stdlib-only (no third-party imports)
  - exposes ``--help`` and ``--json`` flags
  - named ``snake_case_verb_noun.py``
  - embeds sample data so it runs without external fixtures

Layout chosen to make the pilot reversible. If the D5 eval gate fails
(< 2 of 3 functional tools pass), the directory and its CI hook can be
removed in a single commit without touching the wider ``scripts/`` tree.

Public entry points:

  - ``scripts/lint_skill_tools.py`` — D1 meta-linter (lives at scripts/ root
    so ``task ci`` picks it up like other linters).
  - ``score_skill_relevance`` — D2 (this dir).
  - ``audit_persona_coverage`` — D3 (this dir).
  - ``suggest_skill_for_task`` — D4 (this dir).
"""
