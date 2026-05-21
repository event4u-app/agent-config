/**
 * Public TypeScript types for `@event4u/installer`.
 *
 * The manifest types mirror the shape locked by ADR-015 (discovery-manifest
 * contract). The lockfile types implement the schema_version: 1 shape
 * locked by ADR-016 (installer architecture).
 */

// ─── Manifest (read from dist/discovery/discovery-manifest.json) ──────────────

export interface ManifestTrust {
    readonly level: string;
    readonly confidence: string;
    readonly human_review_required: boolean;
}

export interface ManifestInstall {
    readonly default: boolean;
    readonly removable: boolean;
}

export interface ManifestArtefact {
    readonly path: string;
    readonly category: 'skill' | 'rule' | 'command' | 'template';
    readonly name?: string;
    readonly workspaces: readonly string[];
    readonly packs: readonly string[];
    readonly lifecycle: string;
    readonly trust: ManifestTrust;
    readonly install: ManifestInstall;
    readonly checksum: string;
}

export interface ManifestPack {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly workspaces: readonly string[];
    readonly requires_hint?: readonly string[];
    readonly trust_level_default: string;
    readonly artefact_count: number;
}

export interface ManifestWorkspace {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly default_packs: readonly string[];
    readonly optional_packs?: readonly string[];
}

export interface DiscoveryManifest {
    readonly version: number;
    readonly generated_at: string;
    readonly scanner_version: string;
    readonly checksum: string;
    readonly workspaces: readonly ManifestWorkspace[];
    readonly packs: readonly ManifestPack[];
    readonly artefacts: readonly ManifestArtefact[];
    readonly unassigned: readonly { path: string; category: string; reason: string }[];
}

// ─── Lockfile (agents/agent-config.lock.yml — ADR-016 § 1) ────────────────────

export interface LockfilePack {
    readonly id: string;
    readonly version: string;
    readonly auto_selected: boolean;
    readonly required_by: readonly string[];
}

export interface LockfileFile {
    readonly path: string;
    readonly pack: string;
    readonly pack_version: string;
    readonly sha256: string;
    readonly manifest_sha256: string;
    readonly managed: true;
}

export interface Lockfile {
    readonly schema_version: 1;
    readonly agent_config_version: string;
    readonly manifest_sha256: string;
    readonly generated_at: string;
    readonly workspaces: readonly string[];
    readonly packs: readonly LockfilePack[];
    readonly files: readonly LockfileFile[];
}

// ─── Overrides (agents/agent-config.overrides.yml — ADR-016 § 2) ─────────────

export interface OverrideEntry {
    readonly path: string;
    readonly shadows: string;
    readonly reason?: string;
}

export interface OverridesFile {
    readonly schema_version: 1;
    readonly overrides: readonly OverrideEntry[];
}

// ─── Agent-mode protocol (ADR-016 § 4, § 6) ──────────────────────────────────

export type AgentResponseStatus = 'question' | 'done' | 'error';

export interface AgentQuestion {
    readonly status: 'question';
    readonly protocol_version: 1;
    readonly id: string;
    readonly prompt: string;
    readonly choices?: readonly { value: string; label: string }[];
    readonly multi: boolean;
    readonly next_call: string;
}

export interface AgentDone {
    readonly status: 'done';
    readonly protocol_version: 1;
    readonly summary: { files_written: number; lockfile_sha256: string };
}

export interface AgentError {
    readonly status: 'error';
    readonly protocol_version: 1;
    readonly reason: string;
    readonly expected_question_id?: string;
    readonly received?: string;
}

export type AgentResponse = AgentQuestion | AgentDone | AgentError;
