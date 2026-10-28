/**
 * Frames to symbols (roadmap H.2): each in-app frame of a bug maps to the
 * symbol whose span encloses its line, read at the bug's first-seen release.
 *
 * The span witness: the graph holds spans at HEAD, so a frame's line is carried
 * from the release sha to HEAD through `git diff -U0`. A line inside a changed
 * hunk, a file absent at the release, or a release without a known sha yields
 * `unverifiable` with a reason — never the nearest guess.
 */
import * as fs from 'node:fs';

import { parse as parseYaml } from 'yaml';

import type { BugFrame, BugRecord } from './bugs.js';
import type { CodeGraph, CodeNode } from './types.js';

export interface CodeMapping {
    stack_root: string;
    source_root: string;
}

export interface MappedFrame {
    frame: BugFrame;
    file: string;
    /** the frame's line carried to HEAD */
    line: number;
    symbol: string;
    witness: { release_sha: string; release_line: number; head_line: number; span: [number, number] };
}

export interface UnmappedFrame {
    frame: BugFrame;
    reason: string;
}

export interface FrameMapping {
    bug: string;
    state: 'verified' | 'partial' | 'unverifiable';
    release_sha: string | null;
    mapped: MappedFrame[];
    unmapped: UnmappedFrame[];
}

type Git = (args: readonly string[]) => string;

/** The `code_mappings:` list of the map folder's `layers.yaml`, or none. */
export function readCodeMappings(layersFile: string): CodeMapping[] {
    try {
        const doc = parseYaml(fs.readFileSync(layersFile, 'utf-8')) as { code_mappings?: unknown } | null;
        const list = Array.isArray(doc?.code_mappings) ? (doc.code_mappings as Array<Record<string, unknown>>) : [];
        return list.filter((m) => typeof m?.['stack_root'] === 'string' && typeof m['source_root'] === 'string').map((m) => ({ stack_root: m['stack_root'] as string, source_root: m['source_root'] as string }));
    } catch {
        return [];
    }
}

const SCHEMES = /^(?:[a-z]+:\/\/\/?|\.\/|\/)+/i;

/** A frame's file as a repository path: scheme and leading slashes dropped, the longest matching stack root rewritten. */
export function repoPath(file: string, mappings: readonly CodeMapping[]): string {
    const bare = file.replace(SCHEMES, '');
    const hit = [...mappings].filter((m) => bare.startsWith(m.stack_root.replace(SCHEMES, ''))).sort((a, b) => b.stack_root.length - a.stack_root.length)[0];
    if (!hit) return bare;
    const rest = bare.slice(hit.stack_root.replace(SCHEMES, '').length).replace(/^\/+/, '');
    const root = hit.source_root.replace(/^\.?\/+/, '').replace(/\/+$/, '');
    return root ? `${root}/${rest}` : rest;
}

/**
 * Carry `line` from the release to HEAD through zero-context hunks. Null when
 * the line itself was changed or removed.
 */
export function carryLine(diff: string, line: number): number | null {
    let shift = 0;
    for (const m of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
        const oldStart = Number(m[1]);
        const oldLen = m[2] === undefined ? 1 : Number(m[2]);
        const newLen = m[4] === undefined ? 1 : Number(m[4]);
        // A pure insertion (`-n,0`) sits after old line n.
        const oldEnd = oldLen === 0 ? oldStart : oldStart + oldLen - 1;
        if (oldLen > 0 && line >= oldStart && line <= oldEnd) return null;
        if (line > oldEnd || (oldLen === 0 && line > oldStart)) shift += newLen - oldLen;
    }
    return line + shift;
}

/** The innermost non-file node whose span holds `line`. */
export function enclosingSymbol(nodes: readonly CodeNode[], file: string, line: number): CodeNode | null {
    let best: CodeNode | null = null;
    let width = Infinity;
    for (const n of nodes) {
        if (n.source_file !== file || n.kind === 'file' || n.source_location.length < 3) continue;
        const start = n.source_location[0] as number;
        const end = n.source_location[2] as number;
        if (line < start || line > end || end - start >= width) continue;
        best = n;
        width = end - start;
    }
    return best;
}

export function mapFrames(bug: BugRecord, graph: Pick<CodeGraph, 'nodes'>, opts: { mappings: readonly CodeMapping[]; releaseSha: (release: string) => string | null; git: Git }): FrameMapping {
    const sha = bug.first_release === null ? null : opts.releaseSha(bug.first_release);
    const unmapped: UnmappedFrame[] = [];
    const mapped: MappedFrame[] = [];
    if (sha === null) {
        for (const frame of bug.frames) unmapped.push({ frame, reason: bug.first_release === null ? 'no first-seen release' : `release ${bug.first_release} has no known sha` });
        return { bug: bug.id, state: 'unverifiable', release_sha: null, mapped, unmapped };
    }
    const files = new Set(graph.nodes.map((n) => n.source_file));
    for (const frame of bug.frames) {
        const file = repoPath(frame.file, opts.mappings);
        if (frame.line === null) {
            unmapped.push({ frame, reason: 'frame has no line' });
            continue;
        }
        if (!files.has(file)) {
            unmapped.push({ frame, reason: `${file} is not in the graph` });
            continue;
        }
        try {
            opts.git(['cat-file', '-e', `${sha}:${file}`]);
        } catch {
            unmapped.push({ frame, reason: `${file} is absent at ${sha.slice(0, 12)}` });
            continue;
        }
        let diff: string;
        try {
            diff = opts.git(['diff', '-U0', '--no-color', sha, 'HEAD', '--', file]);
        } catch {
            unmapped.push({ frame, reason: 'git diff failed' });
            continue;
        }
        const head = carryLine(diff, frame.line);
        if (head === null) {
            unmapped.push({ frame, reason: `line ${frame.line} changed since ${sha.slice(0, 12)}` });
            continue;
        }
        const sym = enclosingSymbol(graph.nodes, file, head);
        if (sym === null) {
            unmapped.push({ frame, reason: `no symbol encloses ${file}:${head}` });
            continue;
        }
        mapped.push({ frame, file, line: head, symbol: sym.id, witness: { release_sha: sha, release_line: frame.line, head_line: head, span: [sym.source_location[0] as number, sym.source_location[2] as number] } });
    }
    const state = mapped.length === 0 ? 'unverifiable' : unmapped.length === 0 ? 'verified' : 'partial';
    return { bug: bug.id, state, release_sha: sha, mapped, unmapped };
}
