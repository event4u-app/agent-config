/**
 * Deterministic SPDX license detection + derived borrow-compatibility policy
 * (road-to-provenance-and-license-governance S1.2).
 *
 * NO LLM classification (cut C3, same cut as lean-init's own C3) — every id
 * is matched via a fixed, deterministic marker table, and the borrow policy
 * comes from a closed compatibility matrix, never free text. Design
 * principle #1 (unknown escalates, never down-guessed) governs every gap in
 * this file: sources that disagree, a repo license outside the matrix's five
 * target rows, or a source class the matrix leaves unstated for a given
 * target all resolve to the STRICTEST available action (escalate or deny),
 * never a guessed allow.
 *
 * This module does real filesystem I/O (reading LICENSE/package.json/
 * composer.json from a target repo) — that IS the detection job, so unlike a
 * typical "_lib is pure" split, only the CLI's argv parsing, stdout/stderr
 * shaping, and file-write side effect live in the sibling
 * `../detect_target_license.ts` wrapper.
 *
 * Deviations from a literal transcription of the roadmap (recorded here so
 * the trace is auditable, not silent):
 *
 * - SSPL's real SPDX identifier is `SSPL-1.0` (there is no bare "SSPL" entry
 *   in the SPDX license list) — the roadmap prose shorthand is used
 *   everywhere it says "SSPL"; this module uses the real id so its output
 *   is directly usable by SPDX-aware consumers.
 * - The top-level `deny` array (flattened to concrete SPDX ids) is NOT in
 *   the roadmap's literal S1.2 text — it exists because
 *   `src/scripts/lint_provenance.ts` (landed concurrently, S1.3) already
 *   reads `license-policy.yaml`'s top-level `deny: [<SPDX id>, ...]`
 *   directly (`resolveDenyPolicy()`). Emitting it keeps this file usable as
 *   that linter's override surface without touching S1.3's code. The
 *   roadmap-mandated class-keyed verdict still lives at `policy.{allow,
 *   conditional,deny}` — the top-level array is a derived view of
 *   `policy.deny`, expanded to concrete ids for that one downstream reader.
 * - Workspace-license escalation (v1 scope-limiter): a divergent workspace
 *   SPDX id escalates through the SAME disagreement path as root-source
 *   disagreement — no second mechanism. Full per-workspace policy
 *   derivation is explicitly out of scope for v1 (see
 *   agents/roadmaps/later/road-to-per-workspace-license-policy.md).
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── SPDX ids (the roadmap's closed 15-id detection list) ───────────────────

export type SpdxId =
    | 'MIT' | 'Apache-2.0' | 'BSD-2-Clause' | 'BSD-3-Clause' | 'ISC' | '0BSD'
    | 'MPL-2.0' | 'LGPL-2.1' | 'LGPL-3.0' | 'GPL-2.0' | 'GPL-3.0' | 'AGPL-3.0'
    | 'SSPL-1.0' | 'Unlicense' | 'CC0-1.0';

export const KNOWN_SPDX_IDS: readonly SpdxId[] = [
    'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD',
    'MPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'GPL-2.0', 'GPL-3.0', 'AGPL-3.0',
    'SSPL-1.0', 'Unlicense', 'CC0-1.0',
];

const SPDX_ID_LOOKUP: ReadonlyMap<string, SpdxId> = new Map(
    KNOWN_SPDX_IDS.map((id) => [id.toLowerCase(), id]),
);

// ─── Source / target classes ────────────────────────────────────────────────

/** The bucket a BORROWED (source) snippet's license falls into. */
export type SourceClass =
    | 'permissive' | 'public-domain' | 'weak-copyleft'
    | 'gpl-2.0' | 'gpl-3.0' | 'agpl' | 'sspl' | 'unknown';

export const SOURCE_CLASSES: readonly SourceClass[] = [
    'permissive', 'public-domain', 'weak-copyleft',
    'gpl-2.0', 'gpl-3.0', 'agpl', 'sspl', 'unknown',
];

/** The TARGET repo's own license class — one row of the S1.2 matrix. */
export type TargetClass = 'permissive' | 'weak-copyleft' | 'gpl-2.0' | 'gpl-3.0' | 'agpl' | 'none';

export const TARGET_CLASSES: readonly TargetClass[] = [
    'permissive', 'weak-copyleft', 'gpl-2.0', 'gpl-3.0', 'agpl', 'none',
];

export type Verdict = 'allow' | 'conditional' | 'deny';
export type DetectionSourceKind = 'license-file' | 'package-json' | 'composer-json' | 'none' | 'manual';
export type WorkspaceScope = 'single' | 'homogeneous-multi';

/** Maps a detected SPDX id to the source class it represents when BORROWED. */
const SPDX_TO_SOURCE_CLASS: Record<SpdxId, SourceClass> = {
    MIT: 'permissive', 'Apache-2.0': 'permissive', 'BSD-2-Clause': 'permissive',
    'BSD-3-Clause': 'permissive', ISC: 'permissive', '0BSD': 'permissive',
    Unlicense: 'public-domain', 'CC0-1.0': 'public-domain',
    'MPL-2.0': 'weak-copyleft', 'LGPL-2.1': 'weak-copyleft', 'LGPL-3.0': 'weak-copyleft',
    'GPL-2.0': 'gpl-2.0', 'GPL-3.0': 'gpl-3.0', 'AGPL-3.0': 'agpl',
    'SSPL-1.0': 'sspl',
};

/**
 * Maps a detected SPDX id to a TARGET row, when the matrix has one.
 * SSPL-1.0 / Unlicense / CC0-1.0 have NO target row in the roadmap's 5-row
 * matrix — deliberately absent (principle #1): a repo licensed under one of
 * these falls back to the strictest default ('none') plus a warning, rather
 * than a guessed row.
 */
const SPDX_TO_TARGET_CLASS: Partial<Record<SpdxId, TargetClass>> = {
    MIT: 'permissive', 'Apache-2.0': 'permissive', 'BSD-2-Clause': 'permissive',
    'BSD-3-Clause': 'permissive', ISC: 'permissive', '0BSD': 'permissive',
    'MPL-2.0': 'weak-copyleft', 'LGPL-2.1': 'weak-copyleft', 'LGPL-3.0': 'weak-copyleft',
    'GPL-2.0': 'gpl-2.0', 'GPL-3.0': 'gpl-3.0', 'AGPL-3.0': 'agpl',
};

/**
 * The source-class of a concrete detected SPDX id — the counterpart Phase 2
 * (`lint_code_provenance.ts`, S2.1) needs to classify a BORROWED snippet's
 * detected license against this module's target-derived policy.
 */
export function sourceClassOfSpdxId(id: SpdxId): SourceClass {
    return SPDX_TO_SOURCE_CLASS[id];
}

/** Reverse of SPDX_TO_SOURCE_CLASS — used to flatten policy.deny to concrete ids. */
const SOURCE_CLASS_TO_SPDX_IDS: Record<SourceClass, readonly SpdxId[]> = {
    permissive: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD'],
    'public-domain': ['Unlicense', 'CC0-1.0'],
    'weak-copyleft': ['MPL-2.0', 'LGPL-2.1', 'LGPL-3.0'],
    'gpl-2.0': ['GPL-2.0'],
    'gpl-3.0': ['GPL-3.0'],
    agpl: ['AGPL-3.0'],
    sspl: ['SSPL-1.0'],
    unknown: [],
};

export function expandSourceClassesToSpdxIds(classes: readonly SourceClass[]): SpdxId[] {
    const ids = new Set<SpdxId>();
    for (const cls of classes) {
        for (const id of SOURCE_CLASS_TO_SPDX_IDS[cls]) ids.add(id);
    }
    return [...ids].sort();
}

// ─── The closed compatibility matrix (S1.2, transcribed verbatim per row) ───

export interface ClassBuckets {
    allow: SourceClass[];
    conditional: SourceClass[];
    deny: SourceClass[];
}

/**
 * The EXPLICIT cells from the roadmap's matrix, one entry per target row.
 * A source class this module knows about but a given row does NOT name is
 * intentionally absent from all three buckets here — `classifyBorrow()`
 * folds any such gap into 'conditional' (escalate), never a silent
 * allow/deny. This keeps the matrix itself a byte-for-byte transcription
 * (no invented rows) while still producing an exhaustive, closed-enum
 * output policy via `derivePolicyBuckets()`.
 *
 * The one interpretive call this file makes: the roadmap's GPL row deny
 * cell reads "AGPL (for GPL-2.0), SSPL, unknown" — the parenthetical scopes
 * the AGPL denial to a GPL-2.0 target only. For a GPL-3.0 target, AGPL-3.0
 * is therefore folded into the row's "permissive + GPL-compatible copyleft"
 * allow cell instead (AGPL-3.0 is one-directionally GPL-3.0-compatible per
 * FSF guidance) — hence the GPL row is modeled as two target buckets
 * (`gpl-2.0`, `gpl-3.0`) rather than one, reproducing the same cell content
 * the roadmap wrote, not inventing new content.
 */
export const COMPATIBILITY_MATRIX: Record<TargetClass, ClassBuckets> = {
    permissive: {
        allow: ['permissive', 'public-domain'],
        conditional: ['weak-copyleft'],
        deny: ['gpl-2.0', 'gpl-3.0', 'agpl', 'sspl', 'unknown'],
    },
    'weak-copyleft': {
        allow: ['permissive', 'weak-copyleft'],
        conditional: ['gpl-2.0', 'gpl-3.0'],
        deny: ['agpl', 'sspl', 'unknown'],
    },
    'gpl-2.0': {
        allow: ['permissive', 'gpl-2.0', 'gpl-3.0'],
        conditional: ['weak-copyleft'],
        deny: ['agpl', 'sspl', 'unknown'],
    },
    'gpl-3.0': {
        allow: ['permissive', 'gpl-2.0', 'gpl-3.0', 'agpl'],
        conditional: ['weak-copyleft'],
        deny: ['sspl', 'unknown'],
    },
    agpl: {
        allow: ['permissive', 'gpl-2.0', 'gpl-3.0', 'weak-copyleft'],
        conditional: [],
        deny: ['sspl', 'unknown'],
    },
    none: {
        allow: ['permissive'],
        conditional: ['public-domain'],
        deny: ['weak-copyleft', 'gpl-2.0', 'gpl-3.0', 'agpl', 'sspl', 'unknown'],
    },
};

/**
 * Classify ONE borrow: target repo's class -> the verdict for a source of
 * the given class. `unknown` is an absolute invariant — always deny,
 * regardless of target — matching every row's explicit "…, unknown" deny
 * entry. Any source class a row does not explicitly place is 'conditional'
 * (escalate), never a silent allow or deny.
 */
export function classifyBorrow(target: TargetClass, source: SourceClass): Verdict {
    if (source === 'unknown') return 'deny';
    const buckets = COMPATIBILITY_MATRIX[target];
    if (buckets.allow.includes(source)) return 'allow';
    if (buckets.deny.includes(source)) return 'deny';
    return 'conditional';
}

/** The exhaustive, closed-enum policy for a target class — every SourceClass placed. */
export function derivePolicyBuckets(target: TargetClass): ClassBuckets {
    const buckets: ClassBuckets = { allow: [], conditional: [], deny: [] };
    for (const source of SOURCE_CLASSES) {
        const verdict = classifyBorrow(target, source);
        buckets[verdict === 'allow' ? 'allow' : verdict === 'deny' ? 'deny' : 'conditional'].push(source);
    }
    return buckets;
}

// ─── SPDX detection from LICENSE-file text ──────────────────────────────────

const SPDX_TAG_RE = /SPDX-License-Identifier:\s*([A-Za-z0-9.+-]+)/i;

function normalize(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Deterministic marker-phrase detection — NO LLM (cut C3). Priority order:
 * (1) an explicit `SPDX-License-Identifier:` tag — exact, unambiguous, no
 * heuristics needed; (2) header/body marker phrases, most-specific first so
 * a superstring license (AGPL/LGPL vs bare GPL) never gets misread as its
 * substring cousin.
 *
 * Known limitation (stated, not hidden): 0BSD's body text overlaps almost
 * exactly with ISC's short grant clause, so 0BSD is detected via its header
 * only ("BSD Zero Clause License" / "Zero-Clause BSD"); a 0BSD file with
 * neither that header nor an SPDX tag is undetectable here and falls back
 * to the "nothing detectable" strictest-default path — never guessed as ISC.
 */
export function detectSpdxFromText(rawText: string): SpdxId | null {
    const tagMatch = SPDX_TAG_RE.exec(rawText);
    if (tagMatch?.[1] !== undefined) {
        const canonical = SPDX_ID_LOOKUP.get(tagMatch[1].toLowerCase());
        if (canonical !== undefined) return canonical;
    }

    const t = normalize(rawText);

    if (t.includes('gnu affero general public license')) return 'AGPL-3.0';
    if (t.includes('gnu lesser general public license')) {
        if (t.includes('version 2.1')) return 'LGPL-2.1';
        if (t.includes('version 3')) return 'LGPL-3.0';
        return null; // version unstated -> ambiguous, never guess
    }
    if (t.includes('gnu general public license')) {
        if (t.includes('version 2')) return 'GPL-2.0';
        if (t.includes('version 3')) return 'GPL-3.0';
        return null;
    }
    if (t.includes('server side public license')) return 'SSPL-1.0';
    if (t.includes('mozilla public license')) return 'MPL-2.0';
    if (t.includes('bsd zero clause license') || t.includes('zero-clause bsd')) return '0BSD';
    if (t.includes('bsd 3-clause license')) return 'BSD-3-Clause';
    if (t.includes('bsd 2-clause license')) return 'BSD-2-Clause';
    if (t.includes('redistributions of source code must retain the above copyright')) {
        return t.includes('neither the name') ? 'BSD-3-Clause' : 'BSD-2-Clause';
    }
    if (t.includes('isc license')) return 'ISC';
    if (t.includes('permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that')) return 'ISC';
    if (t.includes('apache license') && t.includes('version 2.0')) return 'Apache-2.0';
    if (t.includes('mit license')) return 'MIT';
    if (t.includes('permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files')) return 'MIT';
    if (t.includes('this is free and unencumbered software released into the public domain')) return 'Unlicense';
    if (t.includes('unlicense')) return 'Unlicense';
    if (t.includes('cc0 1.0 universal')) return 'CC0-1.0';
    if (t.includes('creative commons legal code') && t.includes('cc0')) return 'CC0-1.0';

    return null;
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * SPDX id from a package.json/composer.json `license` field. Compound SPDX
 * expressions ("(MIT OR Apache-2.0)") are intentionally NOT resolved —
 * picking a branch would be exactly the down-guess principle #1 forbids;
 * they surface as undetectable (null) via this source instead.
 */
export function detectSpdxFromManifestLicenseField(value: unknown): SpdxId | null {
    if (typeof value === 'string') {
        return SPDX_ID_LOOKUP.get(value.trim().toLowerCase()) ?? null;
    }
    if (isPlainRecord(value) && typeof value.type === 'string') {
        return detectSpdxFromManifestLicenseField(value.type); // legacy npm { type, url } shape
    }
    if (Array.isArray(value)) {
        const ids = value
            .map((v) => detectSpdxFromManifestLicenseField(v))
            .filter((v): v is SpdxId => v !== null);
        const distinct = new Set(ids);
        if (distinct.size === 1) {
            const [only] = distinct;
            return only ?? null;
        }
        return null; // empty or ambiguous multi-license array -> undetectable, never guessed
    }
    return null;
}

function readJsonIfExists(filePath: string): unknown {
    if (!fs.existsSync(filePath)) return undefined;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return undefined;
    }
}

// ─── Directory-level signal scan (reused for root AND each workspace) ──────

const LICENSE_FILENAMES = ['LICENSE', 'LICENSE.md', 'COPYING'] as const;

export interface FileLicenseSignal {
    source: 'license-file' | 'package-json' | 'composer-json';
    spdxId: SpdxId | null; // present but undetectable -> null
    filePath: string | null;
}

export interface DirectoryScan {
    signals: FileLicenseSignal[];
    licenseFilePath: string | null;
    licenseSha256: string | null;
}

/** Scan one directory (repo root or a workspace dir) in roadmap precedence order. */
export function scanDirectoryLicenseSignals(dirAbs: string, dirRel: string): DirectoryScan {
    let licenseFilePath: string | null = null;
    let licenseSha256: string | null = null;
    const signals: FileLicenseSignal[] = [];

    for (const name of LICENSE_FILENAMES) {
        const abs = path.join(dirAbs, name);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
            const content = fs.readFileSync(abs, 'utf8');
            licenseFilePath = path.join(dirRel, name).split(path.sep).join('/');
            licenseSha256 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
            signals.push({ source: 'license-file', spdxId: detectSpdxFromText(content), filePath: licenseFilePath });
            break; // first found by precedence — LICENSE, then LICENSE.md, then COPYING
        }
    }

    const pkgJson = readJsonIfExists(path.join(dirAbs, 'package.json'));
    if (isPlainRecord(pkgJson) && 'license' in pkgJson) {
        signals.push({ source: 'package-json', spdxId: detectSpdxFromManifestLicenseField(pkgJson.license), filePath: null });
    }

    const composerJson = readJsonIfExists(path.join(dirAbs, 'composer.json'));
    if (isPlainRecord(composerJson) && 'license' in composerJson) {
        signals.push({ source: 'composer-json', spdxId: detectSpdxFromManifestLicenseField(composerJson.license), filePath: null });
    }

    return { signals, licenseFilePath, licenseSha256 };
}

export interface ResolvedLicense {
    spdxId: SpdxId | null;
    detectionSource: DetectionSourceKind;
    licenseFilePath: string | null;
    licenseSha256: string | null;
    /** Non-null when 2+ distinct SPDX ids were found across sources — never auto-picked. */
    disagreement: { source: string; spdxId: SpdxId }[] | null;
}

/** Fold a directory's raw signals into one verdict, applying the disagree-escalate rule. */
export function resolveLicenseSignals(scan: DirectoryScan): ResolvedLicense {
    const withIds = scan.signals.filter(
        (s): s is FileLicenseSignal & { spdxId: SpdxId } => s.spdxId !== null,
    );
    const distinctIds = new Set(withIds.map((s) => s.spdxId));

    if (distinctIds.size > 1) {
        return {
            spdxId: null,
            detectionSource: 'none',
            licenseFilePath: scan.licenseFilePath,
            licenseSha256: scan.licenseSha256,
            disagreement: withIds.map((s) => ({ source: s.source, spdxId: s.spdxId })),
        };
    }

    const winner = withIds[0];
    if (winner === undefined) {
        return {
            spdxId: null,
            detectionSource: 'none',
            licenseFilePath: scan.licenseFilePath,
            licenseSha256: scan.licenseSha256,
            disagreement: null,
        };
    }

    return {
        spdxId: winner.spdxId,
        detectionSource: winner.source,
        licenseFilePath: scan.licenseFilePath,
        licenseSha256: scan.licenseSha256,
        disagreement: null,
    };
}

// ─── Workspace-license escalation (v1 scope-limiter) ────────────────────────

export interface WorkspaceDivergence {
    workspaceDir: string;
    spdxId: SpdxId | null;
}

export interface WorkspaceScanResult {
    scope: WorkspaceScope;
    workspaceDirs: string[];
    divergent: WorkspaceDivergence[];
}

/**
 * Resolve declared workspace directories from `package.json` `workspaces`
 * (array of globs, or `{packages: [...]}`). Only a trailing `/*` glob
 * segment is expanded (to the directory's real first-level subdirectories,
 * per the addendum's literal scope) — no general glob engine. Composer has
 * no native "workspaces" concept, so it is deliberately not modeled here:
 * absent a `workspaces` field, this whole check is a no-op.
 */
function resolveWorkspaceDirs(repoRoot: string): string[] {
    const pkg = readJsonIfExists(path.join(repoRoot, 'package.json'));
    const raw: unknown = isPlainRecord(pkg) ? pkg.workspaces : undefined;

    let patterns: string[] = [];
    if (Array.isArray(raw)) {
        patterns = raw.filter((v): v is string => typeof v === 'string');
    } else if (isPlainRecord(raw) && Array.isArray(raw.packages)) {
        patterns = raw.packages.filter((v): v is string => typeof v === 'string');
    }

    const dirs = new Set<string>();
    for (const pattern of patterns) {
        if (pattern.endsWith('/*')) {
            const base = pattern.slice(0, -2);
            const baseAbs = path.join(repoRoot, base);
            if (fs.existsSync(baseAbs) && fs.statSync(baseAbs).isDirectory()) {
                for (const entry of fs.readdirSync(baseAbs, { withFileTypes: true })) {
                    if (entry.isDirectory()) dirs.add(path.join(base, entry.name));
                }
            }
        } else if (fs.existsSync(path.join(repoRoot, pattern)) && fs.statSync(path.join(repoRoot, pattern)).isDirectory()) {
            dirs.add(pattern);
        }
    }
    return [...dirs].sort();
}

/**
 * Scan every declared workspace for its OWN license and compare to the
 * root's resolved SPDX id. Any workspace resolving to a DIFFERENT id is
 * `divergent` — the caller escalates through the same disagree path as
 * root-source disagreement (no second mechanism). When the root itself is
 * undetected (`rootSpdxId === null`) there is nothing to diverge FROM, so
 * this v1 scope-limiter skips the comparison rather than guessing what
 * "different from unknown" would even mean.
 */
function scanWorkspaces(repoRoot: string, rootSpdxId: SpdxId | null): WorkspaceScanResult {
    const workspaceDirs = resolveWorkspaceDirs(repoRoot);
    if (workspaceDirs.length === 0) {
        return { scope: 'single', workspaceDirs: [], divergent: [] };
    }

    const divergent: WorkspaceDivergence[] = [];
    if (rootSpdxId !== null) {
        for (const rel of workspaceDirs) {
            const scan = scanDirectoryLicenseSignals(path.join(repoRoot, rel), rel);
            const resolved = resolveLicenseSignals(scan);
            if (resolved.spdxId !== null && resolved.spdxId !== rootSpdxId) {
                divergent.push({ workspaceDir: rel, spdxId: resolved.spdxId });
            }
        }
    }

    return { scope: 'homogeneous-multi', workspaceDirs, divergent };
}

// ─── Root-level detection (the public entry point) ──────────────────────────

export interface DetectionResult {
    spdxId: SpdxId | null;
    targetClass: TargetClass;
    detectionSource: DetectionSourceKind;
    licenseFilePath: string | null;
    licenseSha256: string | null;
    escalate: boolean;
    escalateReason: string | null;
    warnings: string[];
    workspaceScope: WorkspaceScope;
    workspaceDirs: string[];
}

export function detectTargetLicense(repoRoot: string): DetectionResult {
    const rootScan = scanDirectoryLicenseSignals(repoRoot, '.');
    const rootResolved = resolveLicenseSignals(rootScan);

    const warnings: string[] = [];
    let escalate = false;
    let escalateReason: string | null = null;

    if (rootResolved.disagreement) {
        escalate = true;
        escalateReason =
            'license sources disagree: ' +
            rootResolved.disagreement.map((d) => `${d.source}=${d.spdxId}`).join(' vs ') +
            ' — never auto-pick, escalate to a human';
    } else if (rootResolved.spdxId === null) {
        warnings.push(
            'no LICENSE/LICENSE.md/COPYING file, package.json license field, or composer.json ' +
            'license field detected in the target repo — the repo itself has no discoverable ' +
            'license; defaulting to the strictest policy (target_class: none)',
        );
    }

    let targetClass: TargetClass = 'none';
    if (rootResolved.spdxId !== null) {
        const mapped = SPDX_TO_TARGET_CLASS[rootResolved.spdxId];
        if (mapped !== undefined) {
            targetClass = mapped;
        } else {
            warnings.push(
                `detected license '${rootResolved.spdxId}' has no row in the S1.2 compatibility ` +
                'matrix (permissive / weak-copyleft / gpl-2.0 / gpl-3.0 / agpl / none) — defaulting ' +
                'to the strictest policy (target_class: none) per the unknown-escalates-never-' +
                'down-guessed principle',
            );
        }
    }

    const workspace = scanWorkspaces(repoRoot, rootResolved.spdxId);
    if (workspace.divergent.length > 0 && !escalate) {
        escalate = true;
        escalateReason =
            'workspace license diverges from root: ' +
            workspace.divergent.map((d) => `${d.workspaceDir}=${d.spdxId ?? 'undetected'}`).join(', ') +
            ` vs root=${rootResolved.spdxId ?? 'undetected'} — heterogeneous monorepo, escalate ` +
            'rather than silently derive a root-wide policy (v1 scope-limiter; full per-workspace ' +
            'derivation is a later/ note)';
    }

    return {
        spdxId: rootResolved.spdxId,
        targetClass,
        detectionSource: rootResolved.spdxId === null ? 'none' : rootResolved.detectionSource,
        licenseFilePath: rootResolved.licenseFilePath,
        licenseSha256: rootResolved.licenseSha256,
        escalate,
        escalateReason,
        warnings,
        workspaceScope: workspace.scope,
        workspaceDirs: workspace.workspaceDirs,
    };
}

// ─── The derived policy document (license-policy.yaml) ─────────────────────

export interface LicensePolicyDoc {
    schema_version: 1;
    derived_from: SpdxId | 'none-detected' | 'manual';
    detection: {
        source: DetectionSourceKind;
        license_sha256: string | null;
    };
    target_class: TargetClass;
    workspace_scope: WorkspaceScope;
    policy: ClassBuckets;
    /** Flattened concrete-SPDX-id view of policy.deny — see file header. */
    deny: SpdxId[];
    warnings: string[];
    derived_at: string;
}

/** Refuses on an escalating detection — callers must resolve escalation before deriving. */
export function buildLicensePolicyDocument(detection: DetectionResult, nowIso: string): LicensePolicyDoc {
    if (detection.escalate) {
        throw new Error(
            'buildLicensePolicyDocument: refused — detection requires escalation ' +
            `(${detection.escalateReason ?? 'unspecified'}); never auto-derive a policy over it`,
        );
    }
    const policy = derivePolicyBuckets(detection.targetClass);
    return {
        schema_version: 1,
        derived_from: detection.spdxId ?? 'none-detected',
        detection: { source: detection.detectionSource, license_sha256: detection.licenseSha256 },
        target_class: detection.targetClass,
        workspace_scope: detection.workspaceScope,
        policy,
        deny: expandSourceClassesToSpdxIds(policy.deny),
        warnings: detection.warnings,
        derived_at: nowIso,
    };
}

// ─── Invalidation (SHA mismatch -> re-derive; downgrade -> escalate) ───────

export type InvalidationAction = 'unchanged' | 're-derive' | 'escalate';

export interface InvalidationVerdict {
    action: InvalidationAction;
    reason: string;
}

/**
 * Compares a previously-written policy against a fresh detection. A manual
 * file is never invalidated. A LICENSE-content SHA change that leaves the
 * target class unchanged is a harmless re-derive (refreshes the recorded
 * SHA). A SHA change that ALSO moves the target class is only safe to
 * re-derive when no previously-denied source class becomes allowed under
 * the new class — that specific transition is the downgrade this function
 * exists to catch, and it escalates instead of silently loosening.
 */
export function checkInvalidation(existing: LicensePolicyDoc, fresh: DetectionResult): InvalidationVerdict {
    if (existing.derived_from === 'manual') {
        return { action: 'unchanged', reason: 'derived_from: manual — consumer-owned, never auto-invalidated' };
    }

    if (existing.detection.license_sha256 === fresh.licenseSha256) {
        return { action: 'unchanged', reason: 'LICENSE file content unchanged (SHA match)' };
    }

    if (existing.target_class === fresh.targetClass) {
        return {
            action: 're-derive',
            reason: 'LICENSE file content changed but target_class unchanged — re-deriving to refresh the recorded SHA',
        };
    }

    const oldBuckets = derivePolicyBuckets(existing.target_class);
    const newBuckets = derivePolicyBuckets(fresh.targetClass);
    const downgraded = oldBuckets.deny.filter((s) => newBuckets.allow.includes(s));
    if (downgraded.length > 0) {
        return {
            action: 'escalate',
            reason:
                `target_class moved from '${existing.target_class}' to '${fresh.targetClass}', and ` +
                `previously-denied source class(es) [${downgraded.join(', ')}] would become allowed — ` +
                'a downgrade must never silently re-derive',
        };
    }
    return {
        action: 're-derive',
        reason: `target_class moved from '${existing.target_class}' to '${fresh.targetClass}' — no ` +
            'previously-denied source became allowed, safe to re-derive',
    };
}

// ─── Override merge (tighten accepted; loosen rejected without manual) ────

const VERDICT_STRICTNESS: Record<Verdict, number> = { deny: 0, conditional: 1, allow: 2 };

function verdictOf(buckets: ClassBuckets, source: SourceClass): Verdict {
    if (buckets.allow.includes(source)) return 'allow';
    if (buckets.deny.includes(source)) return 'deny';
    return 'conditional';
}

export interface OverrideMergeResult {
    doc: LicensePolicyDoc;
    rejectedOverrides: string[];
}

/**
 * Merges a consumer-edited `existing` policy against the freshly-derived
 * `fresh` one, per source class: tightening (existing stricter than
 * derived) is honored; loosening (existing looser than derived) is
 * rejected and reverted to the derived value — UNLESS `existing.derived_from
 * === 'manual'`, which hands the file entirely to the consumer.
 */
export function mergeOverride(existing: LicensePolicyDoc, fresh: LicensePolicyDoc): OverrideMergeResult {
    if (existing.derived_from === 'manual') {
        return { doc: existing, rejectedOverrides: [] };
    }

    const rejected: string[] = [];
    const merged: ClassBuckets = { allow: [], conditional: [], deny: [] };

    for (const source of SOURCE_CLASSES) {
        const existingVerdict = verdictOf(existing.policy, source);
        const freshVerdict = verdictOf(fresh.policy, source);
        const isLoosen = VERDICT_STRICTNESS[existingVerdict] > VERDICT_STRICTNESS[freshVerdict];
        const finalVerdict = isLoosen ? freshVerdict : existingVerdict;
        if (isLoosen) {
            rejected.push(
                `${source}: existing policy loosens '${freshVerdict}' -> '${existingVerdict}' without ` +
                `derived_from: manual — rejected, reverted to '${freshVerdict}'`,
            );
        }
        merged[finalVerdict === 'allow' ? 'allow' : finalVerdict === 'deny' ? 'deny' : 'conditional'].push(source);
    }

    return {
        doc: { ...fresh, policy: merged, deny: expandSourceClassesToSpdxIds(merged.deny) },
        rejectedOverrides: rejected,
    };
}
