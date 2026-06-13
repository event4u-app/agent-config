/**
 * Shared constants + helpers for CHANGELOG.md era discipline.
 *
 * TypeScript twin of `src/scripts/_lib/changelog_eras.py` (ADR-092
 * py2ts Phase 2 / Wave 1). The drift gate (`tests/test_changelog_eras.py`
 * / `tests/lib/changelog_eras.test.ts`) and the release automation
 * (`scripts/release.py`) both reason about the same era shape: a single
 * `# Era: X.Y.x — current` header followed by inline entries, then
 * `# Era: pre-X.Y.0 — archived` pointers to files under `docs/archive/`.
 * Keeping the regex / cap / path constants in one place prevents drift
 * between the gate and the auto-split logic.
 *
 * Normative source: `docs/contracts/CHANGELOG-conventions.md § Era splits`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const _HERE = path.dirname(fileURLToPath(import.meta.url));

// src/scripts/_lib/ -> repo root (mirrors Path(__file__).parent x4 in Python).
export const REPO_ROOT = path.resolve(_HERE, '..', '..', '..');
export let CHANGELOG = path.join(REPO_ROOT, 'CHANGELOG.md');
export const CONVENTIONS = path.join(REPO_ROOT, 'docs', 'contracts', 'CHANGELOG-conventions.md');
export let ARCHIVE_DIR = path.join(REPO_ROOT, 'docs', 'archive');

/**
 * Test seam — the pytest twin reassigns the module attributes
 * (`eras.CHANGELOG = …`); ESM export bindings are read-only from the
 * importing side, so the vitest twin uses these setters instead.
 * Additive API only; production code never calls them.
 */
export function _set_changelog_path(p: string): void {
    CHANGELOG = p;
}

export function _set_archive_dir(p: string): void {
    ARCHIVE_DIR = p;
}

// Drift cap — entries between the current era header and the next era
// header may not exceed this many lines. Raising the cap is a contract
// change (see CHANGELOG-conventions.md § Era splits).
export const CURRENT_ERA_BODY_CAP = 250;

export const ERA_HEADER_RE = /^# Era: (?<label>[^\n]+?)(?: — (?<state>current|archived))?\s*$/;
// Global flag so `matchAll` works (the Python twin uses `findall`);
// `String.prototype.matchAll` clones the regex, so the shared constant
// keeps no `lastIndex` state across calls.
export const ARCHIVE_LINK_RE = /\(docs\/archive\/(CHANGELOG-pre-[^)\s]+\.md)\)/g;
export const VERSION_HEADING_RE = /^## \[?(?<version>\d+\.\d+\.\d+)/;
export const ERA_LABEL_RE = /^(?<major>\d+)\.(?<minor>\d+)\.x$/;

/** One era header in CHANGELOG.md, with its line index. */
export interface EraSpan {
    readonly line_index: number;
    readonly label: string;
    readonly state: string; // "current" | "archived" | ""
}

/** Mirror of Python `str.splitlines()` for the newline shapes a changelog can contain. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const parts = text.split(/\r\n|\r|\n/);
    // str.splitlines() does not emit a trailing empty element for a
    // final newline; String.split does — drop it.
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/** Return CHANGELOG.md split into lines (no trailing newlines). */
export function read_changelog_lines(): string[] {
    return _splitlines(fs.readFileSync(CHANGELOG, 'utf-8'));
}

/** Return every era header in line-order. */
export function era_spans(lines: readonly string[]): EraSpan[] {
    const spans: EraSpan[] = [];
    for (let i = 0; i < lines.length; i++) {
        const m = ERA_HEADER_RE.exec(lines[i]!);
        if (m) {
            spans.push({
                line_index: i,
                label: m.groups!['label']!,
                state: m.groups!['state'] ?? '',
            });
        }
    }
    return spans;
}

/** Return the line index of the `— current` era header, or null. */
export function current_era_index(spans: readonly EraSpan[]): number | null {
    for (const span of spans) {
        if (span.state === 'current') {
            return span.line_index;
        }
    }
    return null;
}

/**
 * Return the number of lines between the current era header and
 * the next era header (exclusive of both).
 */
export function current_era_body_size(lines: readonly string[] | null = null): number {
    if (lines === null) {
        lines = read_changelog_lines();
    }
    const spans = era_spans(lines);
    const current_idx = current_era_index(spans);
    if (current_idx === null) {
        return 0;
    }
    let next_era_line = lines.length;
    for (const span of spans) {
        if (span.line_index > current_idx) {
            next_era_line = span.line_index;
            break;
        }
    }
    return next_era_line - current_idx - 1;
}

/** Parse `M.N.x` into `[M, N]`; return null for archived labels. */
export function parse_era_label(label: string): [number, number] | null {
    const m = ERA_LABEL_RE.exec(label.trim());
    if (!m) {
        return null;
    }
    return [Number.parseInt(m.groups!['major']!, 10), Number.parseInt(m.groups!['minor']!, 10)];
}

/** Return `docs/archive/CHANGELOG-pre-<boundary>.md`. */
export function archive_path_for_boundary(boundary: string): string {
    return path.join(ARCHIVE_DIR, `CHANGELOG-pre-${boundary}.md`);
}

/**
 * Render the standard `# Era: pre-<boundary> — archived` pointer
 * block that replaces archived entries in CHANGELOG.md.
 *
 * Mirrors the wording the manual splits already used (verified against
 * every existing collapsed era as of 3.2.x).
 */
export function collapsed_era_block(boundary: string): string {
    const archive_rel = `docs/archive/CHANGELOG-pre-${boundary}.md`;
    return (
        `# Era: pre-${boundary} — archived\n` +
        '\n' +
        `> All entries before \`${boundary}\` live in\n` +
        `> [\`${archive_rel}\`](${archive_rel}).\n` +
        '> The archive is read-only; git tags remain the canonical\n' +
        '> source for what shipped. Splitting them out of the main file\n' +
        '> keeps the active era under the 250-line drift cap enforced by\n' +
        '> `tests/test_changelog_eras.py`.\n'
    );
}

/** Return the standard prologue for `docs/archive/CHANGELOG-pre-<boundary>.md`. */
export function archive_file_header(boundary: string): string {
    return (
        `# Changelog Archive — pre-${boundary}\n` +
        '\n' +
        '> Frozen snapshot of `event4u/agent-config` changelog entries\n' +
        `> released before \`${boundary}\`, split out of the main\n` +
        '> [`CHANGELOG.md`](../../CHANGELOG.md) by `scripts/release.py`\n' +
        "> once the active era's body crossed the drift cap enforced by\n" +
        '> `tests/test_changelog_eras.py`.\n' +
        '>\n' +
        '> **Read-only.** New entries land in `CHANGELOG.md`. Entries\n' +
        '> here are not amended — git tags remain the canonical source\n' +
        '> for what shipped.\n' +
        '>\n' +
        '> Entry shape follows\n' +
        '> [`../contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).\n' +
        '\n'
    );
}

// ─── split planning + execution ────────────────────────────────────────────────

const _RELEASE_VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/** Recipe for an era split during release of `release_version`. */
export class SplitPlan {
    constructor(
        public readonly release_version: string, // e.g. "3.3.0"
        public readonly boundary: string, // e.g. "3.3.0" — used in archive filename + pointer
        public readonly new_era_label: string, // e.g. "3.3.x"
        public readonly old_era_label: string, // e.g. "3.2.x"
        public readonly archive_path: string,
    ) {}

    get commit_subject(): string {
        return `chore(changelog): split era ${this.old_era_label} → pre-${this.boundary}`;
    }
}

/**
 * Plan an era split when releasing `release_version`.
 *
 * Returns null when no split is needed (release is a patch within the
 * current era, or no current era header exists). Returns a SplitPlan
 * when the release crosses a minor or major boundary; the caller
 * decides whether to invoke `perform_split` based on era body size.
 *
 * Throws Error when `release_version` is not bare semver, or when it
 * would move backward relative to the current era label.
 */
export function plan_split(release_version: string): SplitPlan | null {
    const m = _RELEASE_VERSION_RE.exec(release_version.trim());
    if (!m) {
        throw new Error(`not a bare semver (X.Y.Z): '${release_version}'`);
    }
    const rel_major = Number.parseInt(m[1]!, 10);
    const rel_minor = Number.parseInt(m[2]!, 10);

    const lines = read_changelog_lines();
    const spans = era_spans(lines);
    const current = spans.find((s) => s.state === 'current') ?? null;
    if (current === null) {
        return null;
    }

    const parsed = parse_era_label(current.label);
    if (parsed === null) {
        return null;
    }
    const [era_major, era_minor] = parsed;

    const releaseIsOlder = rel_major < era_major || (rel_major === era_major && rel_minor < era_minor);
    if (releaseIsOlder) {
        throw new Error(
            `release '${release_version}' is older than current era ` +
                `'${current.label}'; refusing to plan a backwards split`,
        );
    }
    if (rel_major === era_major && rel_minor === era_minor) {
        // Patch release within the current era — no era boundary crossed,
        // so an auto-split would create a nonsensical archive name. The
        // caller is expected to die() with the manual-intervention message.
        return null;
    }

    const boundary = `${rel_major}.${rel_minor}.0`;
    return new SplitPlan(
        release_version,
        boundary,
        `${rel_major}.${rel_minor}.x`,
        current.label,
        archive_path_for_boundary(boundary),
    );
}

/** Render the header + blockquote intro for a freshly-split current era. */
export function new_era_intro_block(new_era_label: string, boundary: string): string {
    const parsed = parse_era_label(new_era_label);
    let next_example: string;
    if (parsed === null) {
        next_example = '# Era: <next>.x';
    } else {
        const [m, n] = parsed;
        next_example = `# Era: ${m}.${n + 1}.x`;
    }
    return (
        `# Era: ${new_era_label} — current\n` +
        '\n' +
        `> Started at \`${boundary}\`. Full entries live inline below.\n` +
        '> The drift test caps this era at 250 lines of entry body; growth past\n' +
        `> that forces a new era split (\`${next_example}\`, etc.) — see\n` +
        '> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).\n'
    );
}

/**
 * Return `[body_start, body_end, next_era_line]` for the era at
 * `current_idx`.
 *
 * - `body_start` — first line after the header + leading blockquote
 *   intro + the blank line that follows.
 * - `body_end` — exclusive; one line before the next era marker (or
 *   end of file). Trailing blank lines are NOT trimmed; the caller
 *   reattaches them on splice.
 * - `next_era_line` — index of the next `# Era:` line, or
 *   `lines.length` when none follows.
 */
function _era_body_bounds(lines: readonly string[], current_idx: number): [number, number, number] {
    let next_era_line = lines.length;
    for (let i = current_idx + 1; i < lines.length; i++) {
        if (ERA_HEADER_RE.test(lines[i]!)) {
            next_era_line = i;
            break;
        }
    }

    let cursor = current_idx + 1;
    // Skip leading blank lines between header and blockquote intro.
    while (cursor < next_era_line && lines[cursor]!.trim() === '') {
        cursor += 1;
    }
    // Skip the leading blockquote intro (consecutive `>`-prefixed lines).
    while (cursor < next_era_line && lines[cursor]!.startsWith('>')) {
        cursor += 1;
    }
    // Skip the blank separator between intro and entries.
    while (cursor < next_era_line && lines[cursor]!.trim() === '') {
        cursor += 1;
    }

    return [cursor, next_era_line, next_era_line];
}

/**
 * Return the line index at which a new release entry should be
 * prepended within the current era.
 *
 * Strategy:
 * - If the current era body contains one or more `## [X.Y.Z]`
 *   headings, return the line of the topmost (newest) one.
 * - Otherwise, return the first line after the era intro blockquote.
 *
 * Returns null when no current era header exists.
 */
export function current_era_insertion_point(lines: readonly string[]): number | null {
    const spans = era_spans(lines);
    const current_idx = current_era_index(spans);
    if (current_idx === null) {
        return null;
    }
    const [body_start, body_end] = _era_body_bounds(lines, current_idx);
    for (let i = body_start; i < body_end; i++) {
        if (VERSION_HEADING_RE.test(lines[i]!)) {
            return i;
        }
    }
    return body_start;
}

/** Mirror of Python `str.rstrip("\n")`. */
function _rstrip_newlines(text: string): string {
    return text.replace(/\n+$/u, '');
}

/** Mirror of Python `str.rstrip()` (trailing whitespace). */
function _rstrip(text: string): string {
    return text.replace(/\s+$/u, '');
}

/**
 * Execute `plan` against the on-disk CHANGELOG.md.
 *
 * - Refuses to overwrite an existing archive file.
 * - Moves every entry in the current era body into the new archive.
 * - Replaces the current era block with the collapsed pointer + the
 *   freshly-labelled new current era header (empty body).
 */
export function perform_split(plan: SplitPlan): void {
    if (fs.existsSync(plan.archive_path)) {
        throw new Error(
            `archive already exists at ${plan.archive_path} — ` +
                'likely a previous --resume run; inspect manually',
        );
    }

    const lines = read_changelog_lines();
    const spans = era_spans(lines);
    const current_idx = current_era_index(spans);
    if (current_idx === null) {
        throw new Error('no current era header found in CHANGELOG.md');
    }

    const [body_start, , next_era_line] = _era_body_bounds(lines, current_idx);
    const entries = lines.slice(body_start, next_era_line);
    // Trim trailing blank lines so the archive doesn't accumulate them.
    while (entries.length > 0 && entries[entries.length - 1]!.trim() === '') {
        entries.pop();
    }

    const collapsed = _splitlines(_rstrip_newlines(collapsed_era_block(plan.boundary)));
    const new_era = _splitlines(_rstrip_newlines(new_era_intro_block(plan.new_era_label, plan.boundary)));

    const head = lines.slice(0, current_idx);
    const tail = lines.slice(next_era_line);
    const new_lines = [...head, ...collapsed, '', ...new_era, '', ...tail];
    const new_text = _rstrip(new_lines.join('\n')) + '\n';

    const archive_body = entries.length > 0 ? _rstrip(entries.join('\n')) + '\n' : '';
    const archive_text = archive_file_header(plan.boundary) + archive_body;

    fs.mkdirSync(path.dirname(plan.archive_path), { recursive: true });
    fs.writeFileSync(plan.archive_path, archive_text, 'utf-8');
    fs.writeFileSync(CHANGELOG, new_text, 'utf-8');
}
