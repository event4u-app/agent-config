"""Config-layer loaders (profile, preset, pack).

Phase 1 of step-15 product refinement. Single home for the audience /
governance / workflow axes introduced by
:mod:`docs.contracts.profile-system`,
:mod:`docs.contracts.config-presets`, and the upcoming workflow-packs
contract. Loaders here are pure, read-only, lazy-PyYAML; they layer on
top of :mod:`scripts._lib.agent_settings` for project-root anchoring.
"""
