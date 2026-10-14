/**
 * The asset render, as a `post_tool_use` hook SAW it finish.
 *
 * WHY A RECORD, AND NOT A BETTER READING OF THE TRANSCRIPT. The turn-end gate
 * used to accept a digest-matching manifest when a render naming the file ran
 * after the edit, and voided the manifests when a recognised write touched the
 * render directory. "Recognised" was a command pattern list, so any write route
 * the list did not know — an unlisted interpreter, a script file, indirection
 * through a variable — forged a manifest unseen. A transcript cannot close that,
 * because it never sees what a command did.
 *
 * A `post_tool_use` hook sees the finished call and its exit status. So this
 * module records, at the moment a standalone asset render finished, which file
 * it read and the exact bytes of the manifest it left. The gate then accepts a
 * manifest only when its CURRENT bytes still hash to that recorded digest. A
 * manifest written by any other route — before the render, after it, or instead
 * of it — either has no record or no longer matches one, whatever the route was.
 *
 * WHAT IS STILL TRUSTED, stated rather than implied. The command must be a
 * standalone render (`isPureRender`) — a positive shape that fails closed, not a
 * list of forbidden writes — so a chained `&& echo > manifest.json` records
 * nothing. What is not enforced is that the `agent-config` the shell resolved is
 * this package's binary: a PATH shim that exits 0 and writes a manifest would be
 * recorded as a render. That is a forgery of the tool itself rather than of its
 * output, and no hook reading the tool's result could tell the two apart. Nor is
 * the recorder's own state file guarded: an agent that writes a forged
 * `asset_renders` entry there with an edit tool has forged the hook, not the
 * render, and that file is as trusted as every other record the gate reads.
 *
 * THE PATH MUST BE THE RENDER'S, NOT A GUESS AT IT. The record binds the
 * manifest at the path this module computes, so a computed path that differs
 * from the one the shell gave the CLI would bind a manifest the render never
 * wrote (completion review, finding 1). Every argument must therefore be a
 * plain word the shell cannot expand — no `$`, `~`, glob, escape or embedded
 * space — and the manifest must name the same target and slug; anything else
 * records nothing, which leaves the obligation open rather than discharged.
 * The working directory comes from the host's `cwd` where the payload carries
 * one (finding 2).
 *
 * Shared by the producer (`before_complete_hook.ts`) and the consumer
 * (`hooks/svg_obligation.ts`), and by `ui:render` itself for the two facts the
 * reader must agree with it on: where the manifest lands and which exit means
 * "no renderer".
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { isAssetRenderCommand } from './verification_command.js';

/** Where `ui:render` writes, relative to its project root. */
export const RENDER_REL = path.join('agents', 'runtime', 'state', 'render');

/**
 * `--profile asset` with no renderer. Distinct from 1, which `ui:render` uses
 * for an internal error, because "nothing rendered here" is a consumer's
 * ordinary state and its manifest still carries the static witness.
 */
export const EXIT_RENDERER_ABSENT = 3;

/**
 * The exits that leave a manifest describing the file. 1 is excluded: a render
 * that ran and failed, or was called wrong, is evidence of nothing.
 */
const RECORDED_EXITS: ReadonlySet<number> = new Set([0, EXIT_RENDERER_ABSENT]);

/** The output directory name `ui:render` derives from its target. */
export function renderSlug(target: string): string {
    return (
        target
            .replace(/^https?:\/\//, '')
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase()
            .slice(0, 60) || 'render'
    );
}

/**
 * A render call standing alone — no second command chained to it and no
 * redirect — so its text cannot also carry a write. A leading `cd <dir> &&`,
 * piping its output to a read-only filter, and folding stderr into stdout are
 * allowed.
 */
export function isPureRender(command: string): boolean {
    if (!isAssetRenderCommand(command)) return false;
    const [head, ...pipes] = command.replace(/^\s*cd\s+[^;&|<>`$\n]+&&\s*/, '').replace(/\s\d?>&\d\b/g, ' ').replace(/\s2>\s*\/dev\/null\b/g, ' ').split('|');
    if (/[;&<>`\n]|\$\(/.test(head ?? '')) return false;
    return pipes.every((p) => /^\s*(tail|head|grep|jq|cat|less|wc)\b[^;&<>`|]*$/.test(p) && !/\$\(/.test(p));
}

export interface AssetRenderRecord {
    /** The rendered file, relative to the recorder's root, forward slashes. */
    readonly file: string;
    readonly file_digest: string;
    /** The manifest the render left, relative to the recorder's root. */
    readonly manifest: string;
    /** sha256 of the manifest's bytes as the render left them. */
    readonly manifest_digest: string;
    readonly exit_code: number;
}

/** `ui:render` options that take a value, so their value is not the target. */
const VALUE_OPTIONS = new Set([
    '--project-root',
    '--slug',
    '--profile',
    '--class',
    '--delivery',
    '--thresholds',
    '--icon-set',
    '--compare',
    '--registration',
]);

const sha256 = (bytes: Buffer): string => crypto.createHash('sha256').update(bytes).digest('hex');
const unquote = (t: string): string => t.replace(/^['"]|['"]$/g, '');
/** A word the shell passes through unchanged, optionally in matching quotes. */
const PLAIN_WORD = /^(['"]?)[A-Za-z0-9._/:=@+,%-]+\1$/;
const slashed = (p: string): string => p.split(path.sep).join('/');

/**
 * The render a finished Bash call performed, or `null`.
 *
 * Reproduces the CLI's own resolution — target against `--project-root` (else
 * the call's working directory), slug from `--slug` (else the target) — so the
 * manifest read is the one that render wrote, not one found by search.
 * `shellCwd` is the host's report of the call's working directory, when it
 * sends one; without it the call is assumed to start at `root`.
 */
export function observeAssetRender(
    root: string,
    command: string,
    exitCode: number | null,
    shellCwd: string = root,
): AssetRenderRecord | null {
    if (exitCode === null || !RECORDED_EXITS.has(exitCode) || !isPureRender(command)) return null;
    const cd = /^\s*cd\s+([^;&|<>`$\n]+?)\s*&&/.exec(command);
    if (cd && !PLAIN_WORD.test(cd[1]!.trim())) return null;
    const cwd = path.resolve(shellCwd, cd ? unquote(cd[1]!.trim()) : '.');
    const head =
        command
            .replace(/^\s*cd\s+[^;&|<>`$\n]+&&\s*/, '')
            .replace(/\s\d?>&\d\b/g, ' ')
            .replace(/\s2>\s*\/dev\/null\b/g, ' ')
            .split('|')[0] ?? '';
    const words = head.trim().split(/\s+/);
    // One word the shell could rewrite and the computed path is a guess.
    if (!words.every((w) => PLAIN_WORD.test(w))) return null;
    const tokens = words.map(unquote);
    const at = tokens.findIndex((t) => t === 'ui:render');
    if (at === -1) return null;

    const opts = new Map<string, string>();
    let target: string | undefined;
    for (let i = at + 1; i < tokens.length; i += 1) {
        const t = tokens[i]!;
        const eq = t.indexOf('=');
        if (t.startsWith('--') && eq !== -1) {
            opts.set(t.slice(0, eq), t.slice(eq + 1));
        } else if (VALUE_OPTIONS.has(t)) {
            opts.set(t, tokens[i + 1] ?? '');
            i += 1;
        } else if (!t.startsWith('-') && target === undefined) {
            target = t;
        }
    }
    if (target === undefined) return null;

    const projectRoot = path.resolve(cwd, opts.get('--project-root') ?? '.');
    const fileAbs = path.resolve(projectRoot, target);
    const slug = opts.get('--slug') ?? renderSlug(target);
    const manifestAbs = path.join(projectRoot, RENDER_REL, slug, 'manifest.json');
    try {
        const manifestBytes = fs.readFileSync(manifestAbs);
        const m = JSON.parse(manifestBytes.toString('utf8')) as { target?: unknown; slug?: unknown };
        // The manifest must describe THIS call — a leftover from another
        // target or slug at the same path is not its output.
        if (m.target !== target || m.slug !== slug) return null;
        return {
            file: slashed(path.relative(root, fileAbs)),
            file_digest: sha256(fs.readFileSync(fileAbs)),
            manifest: slashed(path.relative(root, manifestAbs)),
            manifest_digest: sha256(manifestBytes),
            exit_code: exitCode,
        };
    } catch {
        // No file or no manifest: the render left nothing to bind, so nothing
        // is recorded — the same verdict as a render that never ran.
        return null;
    }
}

/** The well-formed records in a state value, dropping anything else. */
export function readAssetRenderRecords(raw: readonly unknown[]): AssetRenderRecord[] {
    return raw.filter((r): r is AssetRenderRecord => {
        if (typeof r !== 'object' || r === null) return false;
        const o = r as Record<string, unknown>;
        return ['file', 'file_digest', 'manifest', 'manifest_digest'].every((k) => typeof o[k] === 'string');
    });
}

/**
 * The manifest a record vouches for, parsed, or a reason it no longer does.
 *
 * `changed` is the forgery case this module exists for: the manifest's bytes
 * moved after the render the hook saw finish.
 */
export function recordedManifest(
    root: string,
    record: AssetRenderRecord,
): { manifest: unknown } | { changed: true } | null {
    let bytes: Buffer;
    try {
        bytes = fs.readFileSync(path.resolve(root, record.manifest));
    } catch {
        return null;
    }
    if (sha256(bytes) !== record.manifest_digest) return { changed: true };
    try {
        return { manifest: JSON.parse(bytes.toString('utf8')) as unknown };
    } catch {
        return null;
    }
}
