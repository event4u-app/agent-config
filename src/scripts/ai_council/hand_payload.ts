/**
 * What a hand is sent: the slice the head cut, and nothing else.
 *
 * A slice is the specification of the function to build plus the signatures it
 * must call. Implementations, repo maps, architecture docs, READMEs, roadmaps
 * and the project's name never go — no single unpaid provider should learn the
 * whole project. The API carries no field for any of them, so there is nothing
 * to forget to strip.
 *
 * Identifiers that would let fragments be joined back together (project and
 * package names, repository paths, domains) are replaced through the run's
 * placeholder scope before anything leaves.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { CouncilEgress } from './council_egress.js';
import { handSystemPrompt } from './hand_schemas.js';
import type { HandKind } from '../_lib/hand_kinds.js';

export type LinkingType = 'PROJECT' | 'PACKAGE' | 'REPOPATH' | 'DOMAIN';

export interface LinkingIdentifier {
    readonly type: LinkingType;
    readonly value: string;
}

export interface HandSlice {
    readonly kind: HandKind;
    /** The specification of the one thing to produce. */
    readonly spec: string;
    /** Source of each function the result must call; only its signature is sent. */
    readonly callees?: readonly string[];
    readonly linking?: readonly LinkingIdentifier[];
}

export interface HandPayload {
    readonly system: string;
    readonly user: string;
}

export class HandPayloadError extends Error {}

interface Block {
    readonly start: number;
    readonly end: number;
}

/** Top-level `{…}` blocks and `=>` positions, outside strings and comments. */
function scanTopLevel(src: string): { blocks: Block[]; arrows: number[] } {
    const blocks: Block[] = [];
    const arrows: number[] = [];
    let depth = 0;
    let open = -1;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        const next = src[i + 1];
        if (c === '/' && next === '/') {
            const nl = src.indexOf('\n', i);
            i = nl === -1 ? src.length : nl;
            continue;
        }
        if (c === '/' && next === '*') {
            const close = src.indexOf('*/', i + 2);
            i = close === -1 ? src.length : close + 1;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
            continue;
        }
        if (c === '(' || c === '[' || c === '{') {
            if (c === '{' && depth === 0) open = i;
            depth++;
        } else if (c === ')' || c === ']' || c === '}') {
            depth--;
            if (c === '}' && depth === 0 && open !== -1) {
                blocks.push({ start: open, end: i });
                open = -1;
            }
        } else if (c === '=' && next === '>' && depth === 0) {
            arrows.push(i);
        }
    }
    return { blocks, arrows };
}

/** The colon that closes a Python `def` header, outside brackets. */
function pythonHeaderEnd(src: string): number {
    let depth = 0;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (c === ':' && depth === 0) return i;
    }
    return -1;
}

/**
 * A function's signature without its body. Brace languages lose the final
 * top-level block (a return-type literal before it survives); an expression
 * arrow loses everything from its arrow; a Python `def` keeps its header line.
 */
export function signatureOf(source: string): string {
    const src = source.trim();
    if (/^(?:async\s+)?def\s/.test(src)) {
        const end = pythonHeaderEnd(src);
        return end === -1 ? src : src.slice(0, end + 1);
    }
    const { blocks, arrows } = scanTopLevel(src);
    const tailEnd = src.replace(/[\s;]+$/u, '').length - 1;
    const last = blocks[blocks.length - 1];
    let head = src;
    if (last !== undefined && last.end === tailEnd) {
        head = src.slice(0, last.start).trimEnd();
        if (head.endsWith('=>')) head = head.slice(0, -2).trimEnd();
    } else if (arrows[0] !== undefined) {
        head = src.slice(0, arrows[0]).trimEnd();
    }
    return `${head.replace(/[\s;]+$/u, '')};`;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The body of a callee: what its signature withholds. */
function bodyOf(source: string, signature: string): string {
    const sigHead = signature.replace(/;$/, '');
    const src = source.trim();
    return src.startsWith(sigHead) ? src.slice(sigHead.length).trim() : src;
}

/**
 * Callee signatures under the spec, then linking identifiers and detected
 * values through the placeholder scope. Refuses a spec that already carries a
 * callee's body, and refuses to return a payload in which a linking identifier
 * survived in any spelling.
 */
export function buildHandPayload(slice: HandSlice, egress: CouncilEgress): HandPayload {
    const callees = slice.callees ?? [];
    const signatures = callees.map(signatureOf);
    callees.forEach((src, i) => {
        const body = bodyOf(src, signatures[i] as string).replace(/^[{\s]+|[}\s;]+$/g, '');
        if (body.length >= 12 && slice.spec.includes(body)) {
            throw new HandPayloadError('the spec carries a called function’s implementation; send its signature only');
        }
    });
    let user = slice.spec.trim();
    if (signatures.length > 0) {
        user += `\n\nSignatures you may call (implementations withheld):\n${signatures.join('\n')}`;
    }
    const linking = [...(slice.linking ?? [])].filter((l) => l.value.length > 0).sort((a, b) => b.value.length - a.value.length);
    for (const l of linking) {
        user = user.replace(new RegExp(escapeRegExp(l.value), 'gi'), (m) => egress.scope.mint(l.type, 'identifier', m));
    }
    user = egress.replace(user);
    const lower = user.toLowerCase();
    for (const l of linking) {
        if (lower.includes(l.value.toLowerCase())) throw new HandPayloadError(`a ${l.type} identifier survived replacement`);
    }
    return { system: handSystemPrompt(slice.kind), user };
}

function readJson(file: string): Record<string, unknown> | null {
    try {
        const v: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function urlOf(v: unknown): string | null {
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null && typeof (v as { url?: unknown }).url === 'string') return (v as { url: string }).url;
    return null;
}

/** Hosts, plus owner and repository segments of a repository URL. */
function urlIdentifiers(raw: string, withPath: boolean): LinkingIdentifier[] {
    try {
        const u = new URL(raw.replace(/^git\+/, ''));
        const out: LinkingIdentifier[] = [{ type: 'DOMAIN', value: u.hostname }];
        if (withPath) {
            for (const seg of u.pathname.split('/').filter(Boolean).slice(0, 2)) {
                out.push({ type: 'PROJECT', value: seg.replace(/\.git$/, '') });
            }
        }
        return out;
    } catch {
        return [];
    }
}

/** Names a slice could be re-linked by, read from the project root; short values are dropped. */
export function projectLinkingIdentifiers(root: string): LinkingIdentifier[] {
    const abs = path.resolve(root);
    const found: LinkingIdentifier[] = [
        { type: 'REPOPATH', value: abs },
        { type: 'PROJECT', value: path.basename(abs) },
    ];
    const pkg = readJson(path.join(abs, 'package.json'));
    const pkgName = pkg?.['name'];
    if (typeof pkgName === 'string') {
        found.push({ type: 'PACKAGE', value: pkgName });
        const scoped = /^@([^/]+)\/(.+)$/.exec(pkgName);
        if (scoped !== null) found.push({ type: 'PROJECT', value: scoped[1] as string }, { type: 'PACKAGE', value: scoped[2] as string });
    }
    for (const key of ['homepage', 'bugs']) {
        const u = urlOf(pkg?.[key]);
        if (u !== null) found.push(...urlIdentifiers(u, false));
    }
    const repo = urlOf(pkg?.['repository']);
    if (repo !== null) found.push(...urlIdentifiers(repo, true));
    const composerName = readJson(path.join(abs, 'composer.json'))?.['name'];
    if (typeof composerName === 'string') {
        found.push({ type: 'PACKAGE', value: composerName });
        for (const part of composerName.split('/')) found.push({ type: 'PROJECT', value: part });
    }
    const seen = new Set<string>();
    return found.filter((l) => {
        const key = l.value.toLowerCase();
        if (l.value.length < 3 || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
