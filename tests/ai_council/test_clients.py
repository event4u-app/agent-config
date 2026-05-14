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
    GeminiClient,
    OpenAIClient,
    PerplexityClient,
    XAIClient,
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
    "cls", [AnthropicClient, OpenAIClient, GeminiClient, XAIClient, PerplexityClient]
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


# ── reasoning-model parameter shape (o1/o3/o4) ──────────────────────────────


class _CapturingOpenAI:
    """Records kwargs passed to chat.completions.create."""

    def __init__(self) -> None:
        self.last_kwargs: dict | None = None
        self.chat = SimpleNamespace(completions=SimpleNamespace(
            create=self._create,
        ))

    def _create(self, **kw):  # type: ignore[no-untyped-def]
        self.last_kwargs = kw
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))],
            usage=SimpleNamespace(prompt_tokens=1, completion_tokens=2),
        )


@pytest.mark.parametrize("model", ["o1", "o1-preview", "o1-mini", "o3-mini", "o4-large"])
def test_openai_reasoning_models_use_max_completion_tokens(model: str) -> None:
    capture = _CapturingOpenAI()
    client = OpenAIClient(client=capture, model=model)
    r = client.ask("sys-prompt", "user-prompt", max_tokens=512)
    assert r.error is None
    assert capture.last_kwargs is not None
    assert "max_tokens" not in capture.last_kwargs
    assert capture.last_kwargs["max_completion_tokens"] == 512
    # No system role on reasoning models — system is folded into user content.
    messages = capture.last_kwargs["messages"]
    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert "sys-prompt" in messages[0]["content"]
    assert "user-prompt" in messages[0]["content"]


@pytest.mark.parametrize("model", ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"])
def test_openai_chat_models_keep_max_tokens_and_system_role(model: str) -> None:
    capture = _CapturingOpenAI()
    client = OpenAIClient(client=capture, model=model)
    client.ask("sys-prompt", "user-prompt", max_tokens=256)
    assert capture.last_kwargs is not None
    assert capture.last_kwargs["max_tokens"] == 256
    assert "max_completion_tokens" not in capture.last_kwargs
    messages = capture.last_kwargs["messages"]
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"


# ── Gemini / xAI / Perplexity (Phase 0 — Step 6) ────────────────────────────


class _MockGemini:
    """Mimics google.genai.Client(api_key=...).models.generate_content(...)."""

    def __init__(self, text: str = "ok", in_tok: int = 6, out_tok: int = 12):
        self._text = text
        self._in = in_tok
        self._out = out_tok
        self.last_kwargs: dict | None = None
        self.models = SimpleNamespace(generate_content=self._generate)

    def _generate(self, **kw):  # type: ignore[no-untyped-def]
        self.last_kwargs = kw
        return SimpleNamespace(
            text=self._text,
            usage_metadata=SimpleNamespace(
                prompt_token_count=self._in,
                candidates_token_count=self._out,
            ),
        )


class _ExplodingGemini:
    def __init__(self, exc: Exception) -> None:
        self._exc = exc

    @property
    def models(self):
        raise self._exc


def test_gemini_client_returns_normalised_response() -> None:
    mock = _MockGemini("hi-gem", 6, 12)
    client = GeminiClient(client=mock, model="gemini-2.5-pro")
    r = client.ask("sys", "user", max_tokens=128)
    assert isinstance(r, CouncilResponse)
    assert r.provider == "gemini"
    assert r.model == "gemini-2.5-pro"
    assert r.text == "hi-gem"
    assert r.input_tokens == 6
    assert r.output_tokens == 12
    assert r.error is None
    # System + user folded into a single `contents` string and max_output_tokens passed.
    assert mock.last_kwargs is not None
    assert "sys" in mock.last_kwargs["contents"]
    assert "user" in mock.last_kwargs["contents"]
    assert mock.last_kwargs["config"]["max_output_tokens"] == 128


def test_gemini_client_normalises_sdk_exception() -> None:
    client = GeminiClient(client=_ExplodingGemini(RuntimeError("quota")))
    r = client.ask("sys", "user")
    assert r.text == ""
    assert r.error is not None
    assert "quota" in r.error


def test_gemini_handles_missing_usage_metadata() -> None:
    bare = SimpleNamespace(models=SimpleNamespace(
        generate_content=lambda **kw: SimpleNamespace(text="x", usage_metadata=None),
    ))
    r = GeminiClient(client=bare).ask("sys", "user")
    assert r.text == "x"
    assert r.input_tokens == 0
    assert r.output_tokens == 0


@pytest.mark.parametrize(
    "cls,expected_provider,expected_model",
    [
        (XAIClient, "xai", "grok-4"),
        (PerplexityClient, "perplexity", "sonar-pro"),
    ],
)
def test_openai_compatible_clients_return_normalised_response(
    cls, expected_provider, expected_model,
) -> None:  # type: ignore[no-untyped-def]
    client = cls(client=_MockOpenAI("hi-compat", 5, 7))
    r = client.ask("sys", "user")
    assert r.provider == expected_provider
    assert r.model == expected_model
    assert r.text == "hi-compat"
    assert r.input_tokens == 5
    assert r.output_tokens == 7
    assert r.error is None


@pytest.mark.parametrize("cls", [XAIClient, PerplexityClient])
def test_openai_compatible_clients_normalise_sdk_exception(cls) -> None:  # type: ignore[no-untyped-def]
    client = cls(client=_ExplodingClient(RuntimeError("boom")))
    r = client.ask("sys", "user")
    assert r.text == ""
    assert r.error is not None
    assert "boom" in r.error


@pytest.mark.parametrize("cls", [XAIClient, PerplexityClient])
def test_openai_compatible_clients_keep_system_role(cls) -> None:  # type: ignore[no-untyped-def]
    capture = _CapturingOpenAI()
    client = cls(client=capture, model="custom-model")
    client.ask("sys-prompt", "user-prompt", max_tokens=128)
    assert capture.last_kwargs is not None
    # Neither vendor ships a reasoning model — `max_tokens` + system role stay.
    assert capture.last_kwargs["max_tokens"] == 128
    assert "max_completion_tokens" not in capture.last_kwargs
    messages = capture.last_kwargs["messages"]
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
