"""Tests for ``scripts/_lib/json_pointers.py`` (P1.5)."""
from __future__ import annotations

import pytest

from scripts._lib.json_pointers import (
    ArrayIndexPointerError,
    build_merge_entries,
    collect_pointers,
    subtract_pointers,
    validate_pointer,
    value_hash,
)


class TestValidatePointer:
    def test_empty_pointer_is_valid(self):
        validate_pointer("")

    def test_object_key_pointer_is_valid(self):
        validate_pointer("/hooks/PostToolUse")

    def test_array_index_pointer_is_rejected(self):
        with pytest.raises(ArrayIndexPointerError) as exc:
            validate_pointer("/hooks/PostToolUse/0")
        assert exc.value.segment == "0"
        assert "/hooks/PostToolUse/0" in str(exc.value)

    def test_double_digit_index_is_rejected(self):
        with pytest.raises(ArrayIndexPointerError):
            validate_pointer("/items/42")

    def test_leading_zero_segment_is_not_index(self):
        # RFC 6901: leading zeros are not array indices.
        validate_pointer("/items/01")

    def test_must_start_with_slash(self):
        with pytest.raises(ValueError):
            validate_pointer("hooks/PostToolUse")

    def test_segment_with_escaped_slash_is_valid(self):
        validate_pointer("/foo~1bar/baz")


class TestValueHash:
    def test_stable_across_key_order(self):
        a = value_hash({"a": 1, "b": 2})
        b = value_hash({"b": 2, "a": 1})
        assert a == b

    def test_distinguishes_distinct_lists(self):
        assert value_hash([1, 2, 3]) != value_hash([1, 2, 4])

    def test_stable_for_equal_lists(self):
        assert value_hash([{"x": 1}]) == value_hash([{"x": 1}])


class TestCollectPointers:
    def test_top_level_scalar(self):
        entries = collect_pointers({"name": "agent-config"})
        assert entries == [{"json_pointer": "/name", "value_hash": None}]

    def test_nested_object_recurses_to_leaves(self):
        entries = collect_pointers({"mcpServers": {"agent-config": {"command": "x"}}})
        pointers = [e["json_pointer"] for e in entries]
        assert pointers == ["/mcpServers/agent-config/command"]

    def test_list_value_hashed_at_parent_key(self):
        entries = collect_pointers({"PostToolUse": [{"hook": "a"}, {"hook": "b"}]})
        assert len(entries) == 1
        assert entries[0]["json_pointer"] == "/PostToolUse"
        assert entries[0]["value_hash"] is not None

    def test_empty_dict_emits_self_pointer(self):
        entries = collect_pointers({"flags": {}})
        assert entries == [{"json_pointer": "/flags", "value_hash": None}]

    def test_keys_with_special_chars_are_escaped(self):
        entries = collect_pointers({"a/b": 1, "c~d": 2})
        pointers = {e["json_pointer"] for e in entries}
        assert "/a~1b" in pointers
        assert "/c~0d" in pointers

    def test_never_emits_array_index_pointers(self):
        entries = collect_pointers({"hooks": {"PostToolUse": [1, 2, 3]}})
        for entry in entries:
            validate_pointer(entry["json_pointer"])
        assert [e["json_pointer"] for e in entries] == ["/hooks/PostToolUse"]


class TestBuildMergeEntries:
    def test_includes_file_label(self):
        entries = build_merge_entries(".cursor/hooks.json", {"hooks": {"x": [1]}})
        assert all(e["file"] == ".cursor/hooks.json" for e in entries)

    def test_array_entry_carries_value_hash(self):
        entries = build_merge_entries(
            ".cursor/hooks.json", {"hooks": {"PostToolUse": [{"command": "x"}]}}
        )
        assert len(entries) == 1
        assert entries[0]["json_pointer"] == "/hooks/PostToolUse"
        assert entries[0]["value_hash"] is not None

    def test_scalar_entry_has_null_value_hash(self):
        entries = build_merge_entries(
            ".augment/settings.json", {"agent_config.enabled": True}
        )
        assert entries == [
            {
                "file": ".augment/settings.json",
                "json_pointer": "/agent_config.enabled",
                "value_hash": None,
            }
        ]


class TestSubtractPointers:
    def test_removes_scalar_leaf(self):
        doc = {"agent_config": {"enabled": True}, "other": "keep"}
        entries = [{"json_pointer": "/agent_config/enabled", "value_hash": None}]
        new_doc, warnings = subtract_pointers(doc, entries)
        assert warnings == []
        # Empty ancestor trimmed.
        assert new_doc == {"other": "keep"}

    def test_preserves_foreign_keys(self):
        doc = {
            "mcpServers": {
                "agent-config": {"command": "x"},
                "other-package": {"command": "y"},
            },
        }
        entries = [
            {"json_pointer": "/mcpServers/agent-config/command", "value_hash": None},
        ]
        new_doc, warnings = subtract_pointers(doc, entries)
        assert warnings == []
        # Sibling tool's key + mcpServers parent both survive.
        assert new_doc == {"mcpServers": {"other-package": {"command": "y"}}}

    def test_list_with_matching_hash_removes_whole_key(self):
        original_list = [{"hook": "a"}]
        doc = {"hooks": {"PostToolUse": original_list}}
        entries = [{
            "json_pointer": "/hooks/PostToolUse",
            "value_hash": value_hash(original_list),
        }]
        new_doc, warnings = subtract_pointers(doc, entries)
        assert warnings == []
        assert new_doc == {}

    def test_list_with_drifted_hash_skips_with_warning(self):
        original_list = [{"hook": "a"}]
        doc = {"hooks": {"PostToolUse": [{"hook": "a"}, {"hook": "neighbour"}]}}
        entries = [{
            "json_pointer": "/hooks/PostToolUse",
            "value_hash": value_hash(original_list),
        }]
        new_doc, warnings = subtract_pointers(doc, entries)
        assert len(warnings) == 1
        assert warnings[0]["reason"] == "drift"
        assert warnings[0]["pointer"] == "/hooks/PostToolUse"
        # Doc untouched.
        assert new_doc == {"hooks": {"PostToolUse": [{"hook": "a"}, {"hook": "neighbour"}]}}

    def test_missing_pointer_warns_does_not_raise(self):
        doc = {"other": "x"}
        entries = [{"json_pointer": "/agent_config/enabled", "value_hash": None}]
        new_doc, warnings = subtract_pointers(doc, entries)
        assert warnings == [{
            "pointer": "/agent_config/enabled",
            "reason": "missing",
            "expected_hash": None,
            "actual_hash": None,
        }]
        assert new_doc == {"other": "x"}

    def test_two_tools_share_parent_uninstalling_one_leaves_other(self):
        """Acceptance scenario from P2.2: two synthetic packages share `.cursor/hooks.json`."""
        doc = {
            "hooks": {
                "PreToolUse": [{"tool": "a"}],
                "PostToolUse": [{"tool": "b"}],
            },
        }
        # Tool A owned PreToolUse only.
        a_entries = [{
            "json_pointer": "/hooks/PreToolUse",
            "value_hash": value_hash([{"tool": "a"}]),
        }]
        new_doc, warnings = subtract_pointers(doc, a_entries)
        assert warnings == []
        assert new_doc == {"hooks": {"PostToolUse": [{"tool": "b"}]}}

    def test_escaped_segments_round_trip(self):
        doc = {"a/b": {"c~d": 1}}
        entries = [{"json_pointer": "/a~1b/c~0d", "value_hash": None}]
        new_doc, warnings = subtract_pointers(doc, entries)
        assert warnings == []
        assert new_doc == {}

    def test_deep_chain_trims_all_empty_ancestors(self):
        doc = {"a": {"b": {"c": {"d": "leaf"}}}}
        entries = [{"json_pointer": "/a/b/c/d", "value_hash": None}]
        new_doc, _ = subtract_pointers(doc, entries)
        assert new_doc == {}

    def test_ancestor_with_foreign_sibling_stops_trim(self):
        doc = {"a": {"b": {"c": "leaf", "foreign": "x"}}}
        entries = [{"json_pointer": "/a/b/c", "value_hash": None}]
        new_doc, _ = subtract_pointers(doc, entries)
        assert new_doc == {"a": {"b": {"foreign": "x"}}}
