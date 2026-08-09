/**
 * Rule-layer overlap detection — is the corpus about to be delivered twice?
 *
 * Claude Code loads `~/.claude/rules/` and `<project>/.claude/rules/` **both**,
 * user layer first, with no dedup between them: a rule present in both is in
 * standing context twice. Measured on a maintainer machine 2026-08-08 — 112
 * global entries + 92 project entries, 91 shared basenames, 176,354 exact-BPE
 * tokens of which 74,137 (42%) redundant. Evidence:
 * `agents/evidence/analysis/standing-rule-delivery-topologies.md`; the host's
 * loading contract: `agents/evidence/analysis/claude-code-rules-dir-contract.md`.
 *
 * This module answers three questions and nothing else:
 *
 * 1. **Do two layers overlap, and by how much?** ({@link compareLayers})
 * 2. **Is the overlap a pure duplicate, or a content skew?** — the difference
 *    decides whether suppression is enough or a refresh is also needed.
 * 3. **How is a layer suppressed without deleting it?** — the host's own
 *    `claudeMdExcludes` settings key ({@link claudeMdExcludesGlob},
 *    {@link mergeClaudeMdExcludes}).
 *
 * The comparison half is pure so it is testable from fixtures; only
 * {@link readRuleLayer} touches the filesystem, and nothing here ever writes or
 * unlinks. Deleting a user's `~/.claude/rules/` would be a Hard-Floor action
 * (`non-destructive-by-default`), so no function in this module can reach one.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Frontmatter keys the installer stamps onto its OWN copies, and which therefore
 * differ between a global (installed) copy and a project (projected) copy of the
 * same rule without either being stale.
 *
 * Kept in lockstep with `install.ts`'s `_set_key(fm_lines, 'package', …)` /
 * `_set_key(fm_lines, 'source_path', …)` pair. Adding a third stamped key there
 * without adding it here makes every rule read as divergent.
 */
export const INSTALLER_PROVENANCE_KEYS: readonly string[] = ['package', 'source_path'];

/** One rule layer: its directory and `basename → text` for every `.md` in it. */
export interface RuleLayer {
    readonly dir: string;
    readonly files: ReadonlyMap<string, string>;
}

/** What {@link compareLayers} found. Counts are chars; token conversion is the caller's. */
export interface OverlapReport {
    readonly schema_version: 1;
    /** Basenames present in both layers. */
    readonly overlap: readonly string[];
    /** Of {@link overlap}: bodies equal once the provenance keys are stripped — pure duplicates. */
    readonly duplicate: readonly string[];
    /** Of {@link overlap}: bodies genuinely differ — a content skew. Suppression alone is NOT enough. */
    readonly divergent: readonly string[];
    /** Basenames only in the first (global) layer. */
    readonly global_only: readonly string[];
    /** Basenames only in the second (project) layer. */
    readonly project_only: readonly string[];
    /** Chars the SECOND layer contributes redundantly — what suppressing it recovers. */
    readonly redundant_chars: number;
}

/** The three answers a user may give when an overlap is detected. */
export type LayerChoice = 'global' | 'project' | 'both-acknowledged';

/**
 * Strip the installer's provenance keys from a rule's frontmatter block.
 *
 * Only lines inside the leading `---` … `---` fence are considered, and only
 * those whose key is in {@link INSTALLER_PROVENANCE_KEYS}. A body line that
 * happens to start with `package:` survives — stripping it would make two
 * genuinely different rules compare equal, which is the failure direction that
 * matters here.
 *
 * A file with no frontmatter fence is returned unchanged.
 */
export function stripProvenance(text: string): string {
    const lines = text.split('\n');
    if (lines[0]?.trim() !== '---') return text;
    let close = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trim() === '---') {
            close = i;
            break;
        }
    }
    if (close === -1) return text;
    const kept: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (i > 0 && i < close) {
            const key = /^([A-Za-z_][A-Za-z0-9_-]*):/.exec(lines[i] ?? '')?.[1];
            if (key !== undefined && INSTALLER_PROVENANCE_KEYS.includes(key)) continue;
        }
        kept.push(lines[i] ?? '');
    }
    return kept.join('\n');
}

/** Sorted basenames of `a` that are absent from `b`. */
function only_in(a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): string[] {
    return [...a.keys()].filter((k) => !b.has(k)).sort();
}

/**
 * Compare two rule layers. Pure — no filesystem, no clock, no environment.
 *
 * `global_layer` is the user-level layer and `project_layer` the project one,
 * because {@link OverlapReport.redundant_chars} is measured on the SECOND
 * argument: it answers "what does suppressing the project layer recover", which
 * is the direction the installer offers first (the project layer is the one it
 * is usually about to write).
 */
export function compareLayers(
    global_layer: ReadonlyMap<string, string>,
    project_layer: ReadonlyMap<string, string>,
): OverlapReport {
    const overlap = [...global_layer.keys()].filter((k) => project_layer.has(k)).sort();
    const duplicate: string[] = [];
    const divergent: string[] = [];
    let redundant_chars = 0;
    for (const name of overlap) {
        const g = stripProvenance(global_layer.get(name) ?? '');
        const p = stripProvenance(project_layer.get(name) ?? '');
        if (g === p) {
            duplicate.push(name);
            redundant_chars += (project_layer.get(name) ?? '').length;
        } else {
            divergent.push(name);
        }
    }
    return {
        schema_version: 1,
        overlap,
        duplicate,
        divergent,
        global_only: only_in(global_layer, project_layer),
        project_only: only_in(project_layer, global_layer),
        redundant_chars,
    };
}

/**
 * Read every `.md` in `dir` into a {@link RuleLayer}, or `null` when the
 * directory does not exist.
 *
 * Symlinks are followed, because the project layer is a symlink projection into
 * `dist/agent-src/rules/` and its CONTENT is what lands in context. An entry
 * whose target is unreadable (a dangling symlink) is skipped rather than
 * throwing — a broken link contributes no bytes to the session either.
 */
export function readRuleLayer(dir: string): RuleLayer | null {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return null;
    }
    const files = new Map<string, string>();
    for (const name of names.filter((n) => n.endsWith('.md')).sort()) {
        try {
            files.set(name, fs.readFileSync(path.join(dir, name), 'utf-8'));
        } catch {
            continue;
        }
    }
    return { dir, files };
}

/**
 * The `claudeMdExcludes` glob that suppresses one rules directory.
 *
 * The host matches this key against ABSOLUTE paths, so the directory is
 * resolved before the `/**` suffix is appended. Documented example from the
 * host's own docs: `"/home/user/monorepo/other-team/.claude/rules/**"`.
 */
export function claudeMdExcludesGlob(dir: string): string {
    return `${path.resolve(dir).replace(/\/+$/, '')}/**`;
}

/**
 * Append `entry` to an existing `claudeMdExcludes` value, preserving everything
 * already there.
 *
 * `claudeMdExcludes` arrays MERGE across settings layers, so an install that
 * replaced the array would silently drop another layer's exclusions — a
 * different defect from the one being fixed. Non-string members of a
 * hand-edited array are preserved in order; an absent or non-array value starts
 * a fresh single-entry array. Already present → returned unchanged, so the
 * operation is idempotent across re-installs.
 */
export function mergeClaudeMdExcludes(existing: unknown, entry: string): unknown[] {
    if (!Array.isArray(existing)) return [entry];
    if (existing.includes(entry)) return [...existing];
    return [...existing, entry];
}

/** What the installer should do, given an overlap report and the user's choice. */
export interface LayerAction {
    /** Which layer this install writes. */
    readonly write: 'global' | 'project' | 'both';
    /** Directory to suppress via `claudeMdExcludes`, or `null` when nothing is suppressed. */
    readonly suppress_dir: string | null;
    /** True when the overlap contains divergent bodies — suppression alone loses obligations. */
    readonly refresh_required: boolean;
    /** One-line human summary; the installer prints it verbatim. */
    readonly note: string;
}

/**
 * Turn a report plus a {@link LayerChoice} into the action to take. Pure.
 *
 * `both-acknowledged` writes both and suppresses nothing — a deliberate
 * two-layer setup is legitimate and the flag exists so the installer does not
 * have to guess. The other two choices name the layer to KEEP and suppress the
 * other; suppression never deletes.
 *
 * `refresh_required` fires on any divergent body: suppressing a layer whose
 * copies differ would drop whichever obligations only the suppressed copy
 * carried, so the caller must refresh before suppressing. This is the guard
 * against the version-skew case, which the 2026-08-08 measurement found absent
 * but nothing prevents later.
 */
export function decideLayerAction(
    report: OverlapReport,
    choice: LayerChoice,
    global_dir: string,
    project_dir: string,
): LayerAction {
    const refresh_required = report.divergent.length > 0;
    const skew = refresh_required
        ? ` ${report.divergent.length} shared rule(s) differ in body — refresh before suppressing, or obligations only the suppressed copy carries are lost.`
        : '';
    if (choice === 'both-acknowledged') {
        return {
            write: 'both',
            suppress_dir: null,
            refresh_required,
            note:
                `Keeping both rule layers by request: ${report.overlap.length} shared rule(s), `
                + `${report.redundant_chars} chars delivered twice per session. Nothing suppressed, nothing deleted.${skew}`,
        };
    }
    const keep = choice === 'global' ? global_dir : project_dir;
    const drop = choice === 'global' ? project_dir : global_dir;
    return {
        write: choice,
        suppress_dir: drop,
        refresh_required,
        note:
            `Keeping ${choice} rule layer (${keep}); suppressing ${drop} via claudeMdExcludes — `
            + `recovers ${report.redundant_chars} chars per session. No file is deleted or rewritten.${skew}`,
    };
}
