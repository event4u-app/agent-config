"""ABC contract + mock SDK responses + error normalisation."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.clients import (  # noqa: E402
    AnthropicClient,
    CouncilResponse,
    ExternalAIClient,
    OpenAIClient,
)


# ── shared helpers ──────────────────────────────────────────────────────────


class _MockAnthropic:
    """Mimics anthropic.Anthropic(api_key=...).messages.create(...)."""

    def __init__(self, text: str = "ok", in_tok: int = 11, out_tok: int = 22):
        self.messages = SimpleNamespace(create=lambda **kw: SimpleNamespace(
            content=[SimpleNamespace(text=text)],
            usage=SimpleNamespace(input_tokens=in_tok, output_tokens=out_tok),
        ))


class _MockOpenAI:
    """Mimics openai.OpenAI(api_key=...).chat.completions.create(...)."""

    def __init__(self, text: str = "ok", in_tok: int = 5, out_tok: int = 7):
        self.chat = SimpleNamespace(completions=SimpleNamespace(
            create=lambda **kw: SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=text))],
                usage=SimpleNamespace(prompt_tokens=in_tok, completion_tokens=out_tok),
            )
        ))


class _ExplodingClient:
    def __init__(self, exc: Exception):
        self._exc = exc

    @property
    def messages(self):  # for anthropic shape
        raise self._exc

    @property
    def chat(self):  # for openai shape
        raise self._exc


# ── ABC contract ────────────────────────────────────────────────────────────


def test_external_ai_client_is_abstract() -> None:
    assert hasattr(ExternalAIClient, "ask")
    with pytest.raises(TypeError):
        ExternalAIClient()  # type: ignore[abstract]


@pytest.mark.parametrize(
    "cls", [AnthropicClient, OpenAIClient]
)
def test_clients_require_key_or_injected_client(cls) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(RuntimeError, match="api_key or"):
        cls()


# ── happy paths ─────────────────────────────────────────────────────────────


def test_anthropic_client_returns_normalised_response() -> None:
    client = AnthropicClient(client=_MockAnthropic("hi", 4, 8), model="m")
    r = client.ask("sys", "user")
    assert isinstance(r, CouncilResponse)
    assert r.provider == "anthropic"
    assert r.model == "m"
    assert r.text == "hi"
    assert r.input_tokens == 4
    assert r.output_tokens == 8
    assert r.error is None
    assert r.latency_ms >= 0


def test_openai_client_returns_normalised_response() -> None:
    client = OpenAIClient(client=_MockOpenAI("hello", 3, 9), model="gpt")
    r = client.ask("sys", "user")
    assert r.provider == "openai"
    assert r.text == "hello"
    assert r.input_tokens == 3
    assert r.output_tokens == 9
    assert r.error is None


# ── error normalisation ─────────────────────────────────────────────────────


def test_anthropic_client_normalises_sdk_exception() -> None:
    client = AnthropicClient(client=_ExplodingClient(RuntimeError("rate limit")))
    r = client.ask("sys", "user")
    assert r.text == ""
    assert r.error is not None
    assert "rate limit" in r.error
    assert r.input_tokens == 0
    assert r.output_tokens == 0


def test_openai_client_normalises_sdk_exception() -> None:
    client = OpenAIClient(client=_ExplodingClient(ValueError("network")))
    r = client.ask("sys", "user")
    assert r.text == ""
    assert r.error is not None
    assert "network" in r.error


# ── empty / partial response shapes ─────────────────────────────────────────


def test_anthropic_handles_empty_content() -> None:
    bare = SimpleNamespace(messages=SimpleNamespace(create=lambda **kw: SimpleNamespace(
        content=[], usage=None,
    )))
    client = AnthropicClient(client=bare)
    r = client.ask("sys", "user")
    assert r.text == ""
    assert r.input_tokens == 0


def test_openai_handles_empty_choices() -> None:
    bare = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
        create=lambda **kw: SimpleNamespace(choices=[], usage=None),
    )))
    client = OpenAIClient(client=bare)
    r = client.ask("sys", "user")
    assert r.text == ""
    assert r.input_tokens == 0
