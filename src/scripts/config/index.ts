// Config-layer loaders (profile, preset, pack).
//
// Phase 1 of step-15 product refinement. Single home for the audience /
// governance / workflow axes introduced by the profile-system,
// config-presets, and workflow-packs contracts. Loaders here are pure,
// read-only, lazy-PyYAML; they layer on top of `scripts/_lib/agent_settings`
// for project-root anchoring.
//
// Twin of `src/scripts/config/__init__.py`. The Python package's
// `__init__.py` declares no public symbols (only the module docstring), so
// this barrel intentionally re-exports nothing — importers reach into the
// individual twins (`./presets.js`, `./profiles.js`, `./packs.js`,
// `./session_profiles.js`, `./profile_explain.js`) directly, mirroring the
// Python `from scripts.config.<module> import …` shape.
export {};
