/**
 * Terraform by line rules: resource, data, module and provider blocks, and the
 * references between them. No HCL evaluation, no state file, no `terraform`
 * binary — only what the `.tf` text states. Addresses are scoped to their
 * directory, which is Terraform's own module scope.
 */
import * as path from 'node:path';

import type { Emitter } from './emit.js';
import { edgeTypeOf, providerOf } from './terraform_providers.js';

interface Block {
    type: 'resource' | 'data' | 'module' | 'provider';
    /** resource/data type, module name or provider name */
    label: string;
    name: string;
    line: number;
    /** top-level arguments: name → raw text and line */
    args: Map<string, { text: string; line: number }>;
    /** references found anywhere in the body, with their line */
    refs: { address: string; line: number }[];
}

const HEADER = /^\s*(resource|data)\s+"([^"]+)"\s+"([^"]+)"\s*\{|^\s*(module|provider)\s+"([^"]+)"\s*\{|^\s*(variable|output|locals|terraform|moved|import|check|removed)\b[^{]*\{/;
const REF = /(?<![\w.])(data\.[a-z][\w]*\.[\w-]+|module\.[\w-]+|[a-z][a-z0-9]*_[\w]+\.[a-zA-Z_][\w-]*)/g;

/** Braces outside strings and comments; heredoc bodies are skipped by the caller. */
function braceDelta(line: string): number {
    let d = 0;
    let inStr = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inStr) {
            if (c === '\\') i++;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === '#' || (c === '/' && line[i + 1] === '/')) break;
        else if (c === '{') d++;
        else if (c === '}') d--;
    }
    return d;
}

function stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"/g, (s) => (s.includes('${') ? s : '""'));
}

export function parseTerraform(text: string): Block[] {
    const blocks: Block[] = [];
    const lines = text.split('\n');
    let depth = 0;
    let cur: Block | null = null;
    let heredoc: string | null = null;
    let inComment = false;
    for (let i = 0; i < lines.length; i++) {
        let raw = lines[i]!;
        if (heredoc !== null) {
            if (raw.trim() === heredoc) heredoc = null;
            continue;
        }
        if (inComment) {
            const end = raw.indexOf('*/');
            if (end < 0) continue;
            raw = raw.slice(end + 2);
            inComment = false;
        }
        const open = raw.indexOf('/*');
        if (open >= 0 && raw.indexOf('*/', open) < 0) {
            raw = raw.slice(0, open);
            inComment = true;
        }
        if (/^\s*(#|\/\/)/.test(raw)) continue;
        if (depth === 0) {
            const h = HEADER.exec(raw);
            if (h) {
                if (h[1]) cur = { type: h[1] as 'resource' | 'data', label: h[2]!, name: h[3]!, line: i + 1, args: new Map(), refs: [] };
                else if (h[4]) cur = { type: h[4] as 'module' | 'provider', label: h[5]!, name: h[5]!, line: i + 1, args: new Map(), refs: [] };
                else cur = null;
                if (cur) blocks.push(cur);
                depth += braceDelta(raw);
                if (depth <= 0) {
                    depth = 0;
                    cur = null;
                }
                continue;
            }
        }
        if (cur && depth === 1) {
            const arg = /^\s*([\w-]+)\s*=\s*(.*)$/.exec(raw);
            if (arg) cur.args.set(arg[1]!, { text: arg[2]!.trim(), line: i + 1 });
        }
        if (cur) {
            for (const m of stripStrings(raw).matchAll(REF)) {
                const parts = m[1]!.split('.');
                const address = parts[0] === 'data' ? parts.slice(0, 3).join('.') : parts.slice(0, 2).join('.');
                cur.refs.push({ address, line: i + 1 });
            }
        }
        const hd = /<<-?\s*([A-Z_][A-Z0-9_]*)\s*$/.exec(raw);
        if (hd) heredoc = hd[1]!;
        depth += braceDelta(raw);
        if (depth <= 0) {
            depth = 0;
            cur = null;
        }
    }
    return blocks;
}

function addressOf(b: Block): string {
    if (b.type === 'resource') return `${b.label}.${b.name}`;
    if (b.type === 'data') return `data.${b.label}.${b.name}`;
    if (b.type === 'module') return `module.${b.name}`;
    return `provider.${b.name}`;
}

type DirBlocks = { b: Block; file: string }[];

function parseDir(em: Emitter, files: string[]): DirBlocks {
    const blocks: DirBlocks = [];
    for (const file of files) {
        const text = em.read(file);
        if (text === null) continue;
        for (const b of parseTerraform(text)) blocks.push({ b, file });
    }
    return blocks;
}

const ENV_PARENTS = new Set(['envs', 'environments', 'env']);
/** Var-file stems that name a layer of settings rather than an environment. */
const NOT_ENV_STEMS = new Set(['terraform', 'common', 'shared', 'default', 'defaults', 'variables', 'vars', 'secrets', 'backend', 'global', 'base', 'locals', 'example']);

/** The environment a directory path names: the segment after `envs/`, `environments/` or `env/`. */
export function envOfDir(dir: string): string | null {
    const segs = dir.split('/');
    for (let i = 0; i < segs.length - 1; i++) if (ENV_PARENTS.has(segs[i] as string)) return segs[i + 1] as string;
    return null;
}

/** The environment a var file name names — `dev.tfvars`, `terraform.prod.tfvars`; auto-loaded and default files name none. */
export function envOfVarFile(name: string): string | null {
    if (/\.auto\.tfvars(\.json)?$/.test(name)) return null;
    const m = /^(?:terraform\.)?([\w-]+)\.tfvars(?:\.json)?$/.exec(name);
    if (!m || NOT_ENV_STEMS.has((m[1] as string).toLowerCase())) return null;
    return m[1] as string;
}

const dirOf = (f: string): string => (path.posix.dirname(f) === '.' ? '' : path.posix.dirname(f));

/**
 * The environments each Terraform directory belongs to, by name only: an env
 * directory (`infra/envs/<env>/`), env-named var files in a root module's
 * directory or a direct child of it (one root, one var file per workspace),
 * and — transitively — every environment whose directory instantiates a local
 * module, so a shared module's resources land in each caller's column.
 */
export function terraformEnvironments(parsed: ReadonlyMap<string, DirBlocks>, varFiles: readonly string[]): Map<string, string[]> {
    const envs = new Map<string, Set<string>>();
    const add = (dir: string, env: string): boolean => {
        const set = envs.get(dir) ?? new Set<string>();
        envs.set(dir, set);
        if (set.has(env)) return false;
        set.add(env);
        return true;
    };
    for (const dir of parsed.keys()) {
        const own = envOfDir(dir);
        if (own) add(dir, own);
    }
    for (const f of varFiles) {
        const env = envOfVarFile(path.posix.basename(f));
        if (!env) continue;
        const d = dirOf(f);
        if (envOfDir(d)) continue;
        if (parsed.has(d)) add(d, env);
        else if (parsed.has(dirOf(d)) && d !== '') add(dirOf(d), env);
    }
    const calls: Array<[string, string]> = [];
    for (const [dir, blocks] of parsed) {
        for (const { b } of blocks) {
            if (b.type !== 'module') continue;
            const src = /"([^"]+)"/.exec(b.args.get('source')?.text ?? '')?.[1];
            if (!src || !/^\.\.?\//.test(src)) continue;
            const target = path.posix.normalize(path.posix.join(dir === '' ? '.' : dir, src)).replace(/\/$/, '');
            const key = target === '.' ? '' : target;
            if (key !== dir && parsed.has(key)) calls.push([dir, key]);
        }
    }
    for (let changed = true; changed; ) {
        changed = false;
        for (const [from, to] of calls) for (const env of envs.get(from) ?? []) if (add(to, env)) changed = true;
    }
    return new Map([...envs].map(([d, set]) => [d, [...set].sort()] as const));
}

/** Read every `.tf` file, one directory per module scope, with the environments each directory belongs to. */
export function readTerraform(em: Emitter, tfFiles: readonly string[], varFiles: readonly string[]): void {
    const parsed = new Map<string, DirBlocks>();
    for (const [dir, tfs] of terraformDirs([...tfFiles])) parsed.set(dir, parseDir(em, tfs));
    const envs = terraformEnvironments(parsed, varFiles);
    for (const [dir, blocks] of parsed) emitDir(em, dir, blocks, envs.get(dir) ?? []);
}

/** Read every `.tf` file of one directory as one module scope. */
export function readTerraformDir(em: Emitter, dir: string, files: string[], environments: readonly string[] = []): void {
    emitDir(em, dir, parseDir(em, files), environments);
}

function emitDir(em: Emitter, dir: string, blocks: DirBlocks, environments: readonly string[]): void {
    const scope = dir === '' ? '.' : dir;
    const idOf = (address: string): string => `resource:tf:${scope}:${address}`;
    const declared = new Set(blocks.map(({ b }) => addressOf(b)));
    const firstRef = (b: Block, args: string[]): string | null => {
        for (const a of args) {
            const t = b.args.get(a)?.text ?? '';
            for (const m of stripStrings(t).matchAll(REF)) {
                const parts = m[1]!.split('.');
                const address = parts[0] === 'data' ? parts.slice(0, 3).join('.') : parts.slice(0, 2).join('.');
                if (declared.has(address)) return address;
            }
        }
        return null;
    };
    const asEdge = new Set<Block>();
    for (const { b, file } of blocks) {
        if (b.type !== 'resource') continue;
        const et = edgeTypeOf(b.label);
        if (!et) continue;
        const from = firstRef(b, et.from);
        const to = firstRef(b, et.to);
        if (!from || !to) continue;
        asEdge.add(b);
        em.rel('connects', idOf(from), idOf(to), { mechanism: b.label, name: b.name, provider: providerOf(b.label) }, file, b.line);
    }
    for (const { b, file } of blocks) {
        if (asEdge.has(b)) continue;
        const address = addressOf(b);
        const provArg = b.args.get('provider')?.text ?? null;
        const attrs: Record<string, string | string[] | null> = {
            tf_block: b.type,
            tf_type: b.type === 'module' || b.type === 'provider' ? null : b.label,
            address,
            provider: b.type === 'provider' ? b.name : b.type === 'module' ? null : provArg ? provArg.split('.')[0]! : providerOf(b.label),
            dir: scope,
            ...(environments.length ? { environments: [...environments] } : {}),
        };
        if (b.type === 'provider') {
            const alias = /"([^"]+)"/.exec(b.args.get('alias')?.text ?? '');
            attrs['alias'] = alias ? alias[1]! : null;
        }
        if (b.type === 'module') {
            const src = /"([^"]+)"/.exec(b.args.get('source')?.text ?? '');
            attrs['source'] = src ? src[1]! : null;
        }
        const key = b.type === 'provider' && attrs['alias'] ? `${scope}:${address}.${attrs['alias']}` : `${scope}:${address}`;
        em.fact('resource', `tf:${key}`, address, attrs, file, b.line);
    }
    for (const { b, file } of blocks) {
        if (asEdge.has(b)) continue;
        const from = idOf(addressOf(b));
        for (const r of b.refs) {
            if (r.address === addressOf(b)) continue;
            em.rel('references', from, idOf(r.address), { target_name: r.address }, file, r.line);
        }
    }
}

/** Group `.tf` files by directory. */
export function terraformDirs(files: string[]): Map<string, string[]> {
    const dirs = new Map<string, string[]>();
    for (const f of files) {
        const d = path.posix.dirname(f) === '.' ? '' : path.posix.dirname(f);
        dirs.set(d, [...(dirs.get(d) ?? []), f]);
    }
    return dirs;
}
