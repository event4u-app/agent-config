"""ai_council — external-AI consultation module.

The host agent uses this to poll independent models (OpenAI, Anthropic)
for second opinions on roadmaps, diffs, free-form prompts, or file sets.
Council members never see the host agent's reasoning — only the artefact
plus a neutral system prompt asking for an independent critique.

Architecture:
    clients.py      — ExternalAIClient ABC + concrete OpenAI/Anthropic
                      impls + 0600 key loaders (no env-var fallback).
    bundler.py      — Context bundling with redaction + size guard.
    orchestrator.py — Parallel fan-out, error normalisation, cost cap.
    prompts.py      — Neutrality system-prompt templates per input mode.

Trust boundary: this module makes networked, paid calls. Tokens come
exclusively from ~/.config/agent-config/<provider>.key (mode 0600). The
module never edits files, never opens PRs, never merges — output is
text only, advisory.
"""

from scripts.ai_council.clients import (
    AnthropicClient,
    CouncilResponse,
    ExternalAIClient,
    KeyGateError,
    OpenAIClient,
    load_anthropic_key,
    load_openai_key,
)

__all__ = [
    "AnthropicClient",
    "CouncilResponse",
    "ExternalAIClient",
    "KeyGateError",
    "OpenAIClient",
    "load_anthropic_key",
    "load_openai_key",
]
