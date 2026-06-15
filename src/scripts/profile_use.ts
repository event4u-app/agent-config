#!/usr/bin/env node
/**
 * `agent-config use --profile=<id>` — switch the active experience.
 *
 * TypeScript twin of `src/scripts/profile_use.py` (ADR-096 — Python→TS
 * migration, Phase 8 / Wave 8e). The CLI contract is mirrored EXACTLY:
 * same flags (`--profile=<id>` / `--profile <id>`), same exit codes
 * (0 success, 2 on missing/unknown profile), same byte-identical
 * stdout / stderr prose, and byte-identical surgical text edits of the
 * `.agent-settings.yml` block (comment-preserving regex rewrite, not a
 * yaml round-trip). No behaviour changes.
 *
 * The explicit profile-switch entry point named by the Execution-Model ADR
 * (`docs/decisions/ADR-040-execution-model-projection-time-filtering.md`).
 *
 * In 6.0.0-A this writes `profile.id` into the canonical project
 * `.agent-settings.yml` and prints what changed — it does NOT narrow what
 * gets projected into the tool trees. Pack-scoped surfacing activates in
 * 6.0.0-B behind a staged, opt-in rollout.
 *
 * CLI:
 *     agent-config use --profile=<id>
 *     agent-config use --profile <id>
 *
 * Valid ids (the six seed profiles, docs/contracts/profile-system.md):
 *     developer · content_creator · founder · agency · finance · ops
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { canonical_settings_write_path, find_project_root } from './_lib/agent_settings.js';

const _HERE = fileURLToPath(import.meta.url);

export const VALID_PROFILES: readonly string[] = [
    'developer',
    'content_creator',
    'founder',
    'agency',
    'finance',
    'ops',
];

// The `legacy-all` pseudo-profile: not an experience, but the projection
// escape hatch — restores the full (5.x) surface without changing profile.id.
export const LEGACY_ALL = 'legacy-all';

// Matches a top-level `profile:` block and the `id:` leaf under it. The id
// value may be bare, single-, or double-quoted; we only rewrite the value.
// Mirrors the Python `re.compile(r"(?m)...")` named-group pattern.
const _PROFILE_ID_RE = new RegExp(
    '^(profile:[ \\t]*\\n(?:[ \\t]+#[^\\n]*\\n|[ \\t]*\\n)*[ \\t]+id:[ \\t]*)([^\\n#]*)',
    'm',
);

// Same shape for `projection:` → `mode:` (ADR-040 / road-to-6.0.0-B Step 8).
const _PROJECTION_MODE_RE = new RegExp(
    '^(projection:[ \\t]*\\n(?:[ \\t]+#[^\\n]*\\n|[ \\t]*\\n)*[ \\t]+mode:[ \\t]*)([^\\n#]*)',
    'm',
);

function _resolve_write_path(): string {
    const cwd = process.cwd();
    const root = find_project_root(cwd) ?? cwd;
    return canonical_settings_write_path(root);
}

/**
 * Python `str.strip()` then `.strip("'\"")` — strip surrounding whitespace,
 * then strip leading/trailing single and double quotes. `|| null` mirrors
 * the `or None` truthiness collapse (empty string → null).
 */
function _stripValue(raw: string): string | null {
    const trimmed = raw.replace(/^\s+/, '').replace(/\s+$/, '');
    const dequoted = trimmed.replace(/^['"]+/, '').replace(/['"]+$/, '');
    return dequoted.length > 0 ? dequoted : null;
}

/** Return [new_text, previous_id]. Append a block if none exists. */
function _set_profile_id(text: string, profile_id: string): [string, string | null] {
    const m = _PROFILE_ID_RE.exec(text);
    if (m) {
        const head = m[1] as string;
        const val = m[2] as string;
        const previous = _stripValue(val);
        const valStart = (m.index as number) + head.length;
        const valEnd = valStart + val.length;
        const new_text = text.slice(0, valStart) + profile_id + text.slice(valEnd);
        return [new_text, previous];
    }
    // No profile block — append one. Keep a single trailing newline.
    const block = `\n# --- Profile (experience) ---\nprofile:\n  id: ${profile_id}\n`;
    const sep = text.endsWith('\n') ? '' : '\n';
    return [text + sep + block, null];
}

/** Return [new_text, previous_mode]. Append a block if none exists. */
function _set_projection_mode(text: string, mode: string): [string, string | null] {
    const m = _PROJECTION_MODE_RE.exec(text);
    if (m) {
        const head = m[1] as string;
        const val = m[2] as string;
        const previous = _stripValue(val);
        const valStart = (m.index as number) + head.length;
        const valEnd = valStart + val.length;
        const new_text = text.slice(0, valStart) + mode + text.slice(valEnd);
        return [new_text, previous];
    }
    const block = `\n# --- Pack-scoped projection (ADR-040) ---\nprojection:\n  mode: ${mode}\n`;
    const sep = text.endsWith('\n') ? '' : '\n';
    return [text + sep + block, null];
}

interface ParsedArgs {
    profile: string | null;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let profile: string | null = null;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i]!;
        if (arg === '--profile') {
            const value = argv[i + 1];
            if (value === undefined) {
                _argError('argument --profile: expected one argument');
            }
            profile = value as string;
            i += 2;
            continue;
        }
        if (arg.startsWith('--profile=')) {
            profile = arg.slice('--profile='.length);
            i += 1;
            continue;
        }
        _argError(`unrecognized arguments: ${arg}`);
    }
    return { profile };
}

function _argError(message: string): never {
    process.stderr.write(`usage: agent-config use [-h] [--profile ID]\n`);
    process.stderr.write(`agent-config use: error: ${message}\n`);
    process.exit(2);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);

    if (!args.profile) {
        process.stderr.write(
            '❌  `use` requires --profile=<id>. Valid: ' +
                [...VALID_PROFILES, LEGACY_ALL].join(' · ') +
                '\n',
        );
        return 2;
    }

    const profile_id = args.profile.trim();
    if (profile_id !== LEGACY_ALL && !VALID_PROFILES.includes(profile_id)) {
        process.stderr.write(
            `❌  unknown profile \`${profile_id}\`. Valid: ` +
                [...VALID_PROFILES, LEGACY_ALL].join(' · ') +
                '\n',
        );
        return 2;
    }

    const p = _resolve_write_path();
    const text = _exists(p) ? fs.readFileSync(p, 'utf-8') : '';

    // `legacy-all` is the projection escape hatch — flip projection.mode only,
    // leave the recorded experience (profile.id) untouched.
    if (profile_id === LEGACY_ALL) {
        const [new_text, prev_mode] = _set_projection_mode(text, 'legacy-all');
        if (prev_mode === 'legacy-all' && _exists(p)) {
            process.stdout.write(
                `✅  Already in \`legacy-all\` projection (full surface) — no change (${p}).\n`,
            );
            return 0;
        }
        _mkdirParents(p);
        fs.writeFileSync(p, new_text, 'utf-8');
        process.stdout.write(`✅  Projection set to \`legacy-all\` (full surface) in ${p}.\n`);
        process.stdout.write('ℹ️   Run `agent-config refresh` to re-project the full set.\n');
        return 0;
    }

    // A real experience: record the profile AND opt into scoped projection.
    const [text1, previous] = _set_profile_id(text, profile_id);
    const [new_text] = _set_projection_mode(text1, 'scoped');
    _mkdirParents(p);
    fs.writeFileSync(p, new_text, 'utf-8');

    const arrow = previous ? `\`${previous}\` → \`${profile_id}\`` : `\`${profile_id}\``;
    process.stdout.write(`✅  Experience set to ${arrow}; projection mode \`scoped\` in ${p}.\n`);
    process.stdout.write(
        'ℹ️   Run `agent-config refresh` to re-project only this profile\'s ' +
            'packs (plus any runtime overlay). `agent-config use ' +
            `--profile=${LEGACY_ALL}\` restores the full surface.\n`,
    );
    return 0;
}

/** `Path.exists()`. */
function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** `path.parent.mkdir(parents=True, exist_ok=True)`. */
function _mkdirParents(p: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
