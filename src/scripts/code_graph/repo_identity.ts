/**
 * A repository's identity on this machine (ADR-299, council decision O2).
 *
 * `repoId` is 12 hex of an HMAC-SHA256, keyed by a random key created once
 * under the user-global `runtime/projects/`, over the canonical origin URL —
 * userinfo, tokens, query and fragment removed, host lower-cased, default port
 * dropped, ssh / scp / https forms and a trailing `.git` collapsed. Without a
 * remote the main checkout's realpath stands in. Keyed rather than a plain hash
 * because a hosting URL is dictionary-guessable and may carry a token.
 *
 * A linked worktree keeps its parent's `repoId` and gets an `instance`, so its
 * writable caches never collide with the main checkout's while estate queries
 * still count one project. Two separate clones of one origin share `repoId` too,
 * so `checkout` — keyed over the main checkout's realpath — is what keeps their
 * writable homes apart.
 *
 * File-based like `_lib/git_common_dir.ts`: an inherited `GIT_DIR` would
 * redirect a `git config` subprocess to the wrong repository.
 */
import { createHmac, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { git_common_dir } from '../_lib/git_common_dir.js';
import { type EnvMap, event4u_root } from '../_lib/user_global_paths.js';

export interface RepoIdentity {
    repoId: string;
    /** Set for a linked worktree only. */
    instance: string | null;
    /** 8 hex over the main checkout's realpath: distinct per clone, shared by its worktrees. */
    checkout: string;
    source: 'origin' | 'realpath';
}

const DEFAULT_PORTS: Record<string, string> = { 'ssh:': '22', 'git+ssh:': '22', 'https:': '443', 'http:': '80', 'git:': '9418' };

export function projectsDir(env?: EnvMap | null): string {
    return path.join(event4u_root(env), 'runtime', 'projects');
}

/** `dir` overrides the projects directory, for a caller (advisories) that carries its own. */
export function machineKeyPath(env?: EnvMap | null, dir: string = projectsDir(env)): string {
    return path.join(dir, 'machine.key');
}

/**
 * The machine key, created on first use. Published with a hard link so a
 * concurrent first use either wins or reads the winner's complete key — never
 * an empty file. A key that exists but is malformed throws: replacing it would
 * silently re-key every repository on the machine.
 */
export function machineKey(env?: EnvMap | null, dir?: string): Buffer {
    const p = machineKeyPath(env, dir);
    const read = (): Buffer => {
        const hex = fs.readFileSync(p, 'utf-8').trim();
        if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`malformed machine key: ${p}`);
        return Buffer.from(hex, 'hex');
    };
    if (fs.existsSync(p)) return read();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = `${p}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, `${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
    try {
        fs.linkSync(tmp, p);
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    } finally {
        fs.rmSync(tmp, { force: true });
    }
    return read();
}

function trimPath(p: string): string {
    return p
        .replace(/\/{2,}/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .replace(/\.git$/i, '')
        .replace(/\/+$/, '');
}

/**
 * The credential-free form two spellings of one remote share. A relative local
 * path resolves against `base`, the repository root, because the process cwd
 * is wherever the CLI happened to be started.
 */
export function canonicalOrigin(raw: string, base?: string): string {
    const url = raw.trim();
    const scp = /^(?:[^@/]+@)?([^:/]+):(?!\/\/)(.+)$/.exec(url);
    if (!url.includes('://') && scp && !/^[a-zA-Z]:[\\/]/.test(url)) {
        return `${(scp[1] as string).toLowerCase()}/${trimPath(scp[2] as string)}`;
    }
    try {
        const u = new URL(url);
        if (u.protocol === 'file:') return `file:${trimPath(decodeURIComponent(u.pathname))}`;
        const port = u.port && u.port !== DEFAULT_PORTS[u.protocol] ? `:${u.port}` : '';
        return `${u.hostname.toLowerCase()}${port}/${trimPath(decodeURIComponent(u.pathname))}`;
    } catch {
        return `file:${trimPath(base === undefined ? path.resolve(url) : path.resolve(base, url))}`;
    }
}

/** The `origin` URL, else the first remote's, read from the common git config. */
export function remoteUrl(root: string): string | null {
    const common = git_common_dir(root);
    if (common === null) return null;
    let text: string;
    try {
        text = fs.readFileSync(path.join(common, 'config'), 'utf-8');
    } catch {
        return null;
    }
    const urls = new Map<string, string>();
    let remote: string | null = null;
    for (const line of text.split(/\r?\n/)) {
        const section = /^\s*\[\s*remote\s+"([^"]+)"\s*\]/.exec(line);
        if (section) {
            remote = section[1] as string;
            continue;
        }
        if (/^\s*\[/.test(line)) {
            remote = null;
            continue;
        }
        const kv = /^\s*url\s*=\s*(.+?)\s*$/.exec(line);
        if (remote !== null && kv && !urls.has(remote)) urls.set(remote, (kv[1] as string).replace(/^"|"$/g, ''));
    }
    return urls.get('origin') ?? urls.values().next().value ?? null;
}

function realpathOr(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return path.resolve(p);
    }
}

function hmac(key: Buffer, value: string): string {
    return createHmac('sha256', key).update(value).digest('hex');
}

export function repoIdentity(root: string, env?: EnvMap | null, dir?: string): RepoIdentity {
    const key = machineKey(env, dir);
    const real = realpathOr(root);
    const common = git_common_dir(real);
    let linked = false;
    try {
        linked = !fs.statSync(path.join(real, '.git')).isDirectory();
    } catch {
        linked = false;
    }
    const origin = remoteUrl(real);
    const main = common !== null && path.basename(common) === '.git' ? path.dirname(common) : real;
    let source: RepoIdentity['source'] = 'origin';
    let canonical: string;
    if (origin !== null) {
        canonical = `origin:${canonicalOrigin(origin, main)}`;
    } else {
        source = 'realpath';
        canonical = `path:${main}`;
    }
    return {
        repoId: hmac(key, canonical).slice(0, 12),
        instance: linked ? hmac(key, `instance:${real}`).slice(0, 8) : null,
        checkout: hmac(key, `checkout:${main}`).slice(0, 8),
        source,
    };
}

/**
 * The repository's display name: the last segment of its `origin` (else first
 * remote) without `.git`, else the folder of its main checkout. Never the folder
 * of a linked worktree, and never the owner part of a slug.
 */
export function repoName(root: string): string {
    const real = realpathOr(root);
    const origin = remoteUrl(real);
    const fromOrigin = origin === null ? '' : (canonicalOrigin(origin, real).split('/').pop() ?? '').replace(/\.git$/i, '');
    if (fromOrigin !== '') return fromOrigin;
    const common = git_common_dir(real);
    const main = common !== null && path.basename(common) === '.git' ? path.dirname(common) : real;
    return path.basename(main);
}
