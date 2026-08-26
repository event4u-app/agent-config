/**
 * Resolve a configuration file's `extends` / `includes` chain, and answer which
 * config governs a given path, before anything digests either one.
 *
 * WHY THIS EXISTS
 * ---------------
 * `standards-from-config` derives a project's enforced standards from its real
 * tooling config. Read literally — one file, one parse — that produces a null on
 * a repository whose root config is a single directive pointing somewhere else.
 * A fourteen-line linter config whose only load-bearing line is an `extends` into
 * a package in the same workspace is not a project without standards; it is a
 * project whose standards are one hop away. Reporting "no enforced standard
 * found" there is a false negative that reads exactly like a true one.
 *
 * `extends` is a specified directive in TypeScript, ESLint, Biome and Stylelint;
 * `includes` plays the same role in PHPStan's NEON. `workspace:`-linked packages
 * are a documented protocol in npm, yarn, pnpm and bun. Those are published
 * mechanisms, which is why chain-following is a general capability rather than
 * one repository's convention.
 *
 * AN EXTERNAL HOP IS LABELLED, NEVER MERGED
 * -----------------------------------------
 * A chain can leave the repository — into `node_modules`, into a vendor
 * directory, or above the repository root entirely. Presenting a third-party
 * preset as *the project's own* standard is worse than reporting nothing: the
 * reader cannot tell which rules the project chose. So every hop carries its
 * origin, and only `project` and `workspace-package` hops appear in
 * `digestible`. An `external` hop is reported, with its path, and excluded from
 * the digest.
 *
 * AN UNRESOLVABLE HOP IS A NAMED GAP, NEVER AN ABSENCE
 * ---------------------------------------------------
 * Three failures are indistinguishable to a caller that only sees "nothing came
 * back": the file is missing, the file is there but unparsable, and the
 * directive is expressed in a language this reader does not evaluate (a Rector
 * config building its set list from PHP expressions). All three are recorded as
 * a hop with `origin: 'unresolved'` and a `reason`, and any one of them sets
 * `complete: false`. A partial digest that says which hop it could not follow is
 * usable; a null is not, and a null that looks like "no standards" is a lie.
 * This is the same three-outcome posture the install diagnostic takes: present,
 * dangling, and unresolvable-for-a-stated-reason — never a silent absence.
 *
 * WHY A LOCAL JSONC READER
 * ------------------------
 * `linked_projects.ts` carries a private tolerant JSON reader that returns
 * `null` on both "absent" and "malformed". That collapse is correct for its
 * input domain and wrong here for the reason above: this module has to attribute
 * a parse failure to itself rather than report it as a missing config. So
 * `readConfigObject` returns a discriminated result instead of a nullable one.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';

/** Where a hop's file lives relative to the repository — the digest gate. */
export type HopOrigin = 'project' | 'workspace-package' | 'external' | 'unresolved';

export interface ConfigHop {
    /** The directive text as written. `''` for the chain's starting file. */
    specifier: string;
    /** Repository-relative path when resolved, `null` when not. */
    path: string | null;
    origin: HopOrigin;
    /**
     * Present on every non-`project` hop. On `unresolved` it names WHY, which is
     * the whole point — an unnamed gap is an absence wearing a label.
     */
    reason?: string;
}

export interface ChainResolution {
    /** Every hop, in resolution order, starting with the file asked about. */
    hops: ConfigHop[];
    /** `false` when any hop is `unresolved`. A partial digest, never a null. */
    complete: boolean;
    /** The hops a digest may read: `project` + `workspace-package` only. */
    digestible: ConfigHop[];
    /** Hops outside the repository. Reported, never merged into the digest. */
    externals: ConfigHop[];
    /** The named gaps. Non-empty exactly when `complete` is `false`. */
    unresolved: ConfigHop[];
}

export interface WorkspacePackage {
    /** Repository-relative directory. */
    dir: string;
    /** The manifest's `name` — the key a bare specifier matches on. */
    name: string;
}

/** Bounds the walk. A chain this long is a finding, not a configuration. */
const MAX_HOPS = 16;

/** Directory names a chain crosses only to leave the repository. */
const EXTERNAL_DIRS = new Set(['node_modules', 'vendor']);

/** Extensions tried when a specifier names no file extension of its own. */
const EXT_CANDIDATES = ['', '.json', '.jsonc', '.neon', '.yaml', '.yml'];

/** Filenames tried when a specifier resolves to a directory. */
const DIR_CANDIDATES = [
    'tsconfig.json',
    'biome.json',
    'eslint.config.js',
    '.eslintrc.json',
    '.stylelintrc.json',
    'phpstan.neon',
    'index.json',
];

type ReadResult =
    | { kind: 'ok'; value: Record<string, unknown> }
    | { kind: 'absent' }
    | { kind: 'unparsable'; reason: string }
    | { kind: 'opaque'; reason: string };

/**
 * Read one config file into an object, keeping the four outcomes distinct.
 *
 * `opaque` is the case a null would hide: a `.php` config states its directives
 * as executable expressions, so a static reader cannot follow them and must say
 * so rather than report the file as carrying none.
 */
export function readConfigObject(absPath: string): ReadResult {
    if (!fs.existsSync(absPath)) return { kind: 'absent' };
    const ext = path.extname(absPath).toLowerCase();
    if (ext === '.php' || ext === '.js' || ext === '.cjs' || ext === '.mjs' || ext === '.ts') {
        return {
            kind: 'opaque',
            reason: `${ext} config: directives are expressed as executable code and are not statically resolvable`,
        };
    }
    let text: string;
    try {
        text = fs.readFileSync(absPath, 'utf-8');
    } catch (err) {
        return { kind: 'unparsable', reason: `unreadable: ${(err as Error).message}` };
    }
    if (ext === '.neon' || ext === '.yaml' || ext === '.yml') {
        // NEON's `includes:` list and YAML's `extends:` are both a top-level key
        // holding a scalar or a sequence, which YAML parses for both formats.
        try {
            const parsed = yaml.parse(text) as unknown;
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return { kind: 'unparsable', reason: 'top level is not a mapping' };
            }
            return { kind: 'ok', value: parsed as Record<string, unknown> };
        } catch (err) {
            return { kind: 'unparsable', reason: `parse error: ${(err as Error).message}` };
        }
    }
    const strict = tryJson(text);
    if (strict) return { kind: 'ok', value: strict };
    // tsconfig.json and its family carry `//` comments and trailing commas by
    // convention, so a strict parse failure is not yet a finding.
    const tolerant = tryJson(text.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
    if (tolerant) return { kind: 'ok', value: tolerant };
    return { kind: 'unparsable', reason: 'not valid JSON, even allowing comments and trailing commas' };
}

function tryJson(text: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
}

/** Pull the chain directives out of a parsed config, in declaration order. */
function directives(config: Record<string, unknown>): string[] {
    const out: string[] = [];
    for (const key of ['extends', 'includes']) {
        const raw = config[key];
        if (typeof raw === 'string') out.push(raw);
        else if (Array.isArray(raw)) {
            for (const item of raw) if (typeof item === 'string') out.push(item);
        }
    }
    return out;
}

/**
 * Enumerate the repository's workspace packages from its declarative source.
 *
 * `pnpm-workspace.yaml` wins when present because it is the more specific
 * declaration; otherwise `package.json#workspaces`. Conventional directories are
 * never used as a substitute — a declaration and a convention can disagree, and
 * the declaration is what the package manager obeys.
 */
export function listWorkspacePackages(repoRoot: string): WorkspacePackage[] {
    const patterns = workspacePatterns(repoRoot);
    const seen = new Set<string>();
    const out: WorkspacePackage[] = [];
    for (const pattern of patterns) {
        for (const dir of expandPattern(repoRoot, pattern)) {
            if (seen.has(dir)) continue;
            seen.add(dir);
            const manifest = readConfigObject(path.join(repoRoot, dir, 'package.json'));
            if (manifest.kind !== 'ok') continue;
            const name = manifest.value.name;
            if (typeof name === 'string' && name.length > 0) out.push({ dir, name });
        }
    }
    return out;
}

function workspacePatterns(repoRoot: string): string[] {
    const pnpm = path.join(repoRoot, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpm)) {
        const parsed = readConfigObject(pnpm);
        if (parsed.kind === 'ok' && Array.isArray(parsed.value.packages)) {
            return (parsed.value.packages as unknown[]).filter((p): p is string => typeof p === 'string');
        }
    }
    const rootManifest = readConfigObject(path.join(repoRoot, 'package.json'));
    if (rootManifest.kind === 'ok') {
        const ws = rootManifest.value.workspaces;
        if (Array.isArray(ws)) return ws.filter((p): p is string => typeof p === 'string');
        if (ws && typeof ws === 'object' && Array.isArray((ws as Record<string, unknown>).packages)) {
            return ((ws as Record<string, unknown>).packages as unknown[]).filter(
                (p): p is string => typeof p === 'string',
            );
        }
    }
    return [];
}

/**
 * Expand one workspace glob to the directories that actually carry a manifest.
 *
 * Only `*` and `**` as whole path segments are supported, which is what every
 * workspace declaration in the wild uses. A pattern this cannot express returns
 * nothing rather than a guess — a wrong workspace list would misclassify an
 * external hop as the project's own, which is the one error this module exists
 * to prevent.
 */
function expandPattern(repoRoot: string, pattern: string): string[] {
    const segments = pattern.replace(/^\.\//, '').split('/').filter((s) => s.length > 0);
    let frontier: string[] = [''];
    for (const segment of segments) {
        const next: string[] = [];
        for (const base of frontier) {
            if (segment === '*') next.push(...childDirs(repoRoot, base));
            else if (segment === '**') next.push(base, ...recursiveDirs(repoRoot, base, 4));
            else {
                const candidate = base ? `${base}/${segment}` : segment;
                if (isDir(path.join(repoRoot, candidate))) next.push(candidate);
            }
        }
        frontier = next;
    }
    return frontier.filter((d) => d.length > 0);
}

function childDirs(repoRoot: string, base: string): string[] {
    const abs = path.join(repoRoot, base);
    if (!isDir(abs)) return [];
    return fs
        .readdirSync(abs, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !EXTERNAL_DIRS.has(e.name))
        .map((e) => (base ? `${base}/${e.name}` : e.name));
}

function recursiveDirs(repoRoot: string, base: string, depth: number): string[] {
    if (depth <= 0) return [];
    const out: string[] = [];
    for (const child of childDirs(repoRoot, base)) {
        out.push(child, ...recursiveDirs(repoRoot, child, depth - 1));
    }
    return out;
}

function isDir(abs: string): boolean {
    try {
        return fs.statSync(abs).isDirectory();
    } catch {
        return false;
    }
}

/** Classify a resolved absolute path by where it sits relative to the repo. */
function classify(repoRoot: string, abs: string): { origin: HopOrigin; reason?: string } {
    const rel = path.relative(repoRoot, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return { origin: 'external', reason: 'resolves above the repository root' };
    }
    const crossed = rel.split(path.sep).find((seg) => EXTERNAL_DIRS.has(seg));
    if (crossed) return { origin: 'external', reason: `resolves inside \`${crossed}/\`` };
    return { origin: 'project' };
}

/** Try a specifier as a file, then with each extension, then as a directory. */
function firstExistingFile(base: string): string | null {
    for (const ext of EXT_CANDIDATES) {
        const candidate = base + ext;
        if (fs.existsSync(candidate) && !isDir(candidate)) return candidate;
    }
    if (isDir(base)) {
        for (const name of DIR_CANDIDATES) {
            const candidate = path.join(base, name);
            if (fs.existsSync(candidate)) return candidate;
        }
    }
    return null;
}

function resolveSpecifier(
    repoRoot: string,
    fromDir: string,
    specifier: string,
    workspaces: WorkspacePackage[],
): ConfigHop {
    const hop = (patch: Partial<ConfigHop>): ConfigHop => ({ specifier, path: null, origin: 'unresolved', ...patch });

    if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
        const base = path.isAbsolute(specifier) ? specifier : path.resolve(fromDir, specifier);
        const found = firstExistingFile(base);
        if (!found) return hop({ reason: 'relative target does not exist' });
        const { origin, reason } = classify(repoRoot, found);
        return hop({ path: path.relative(repoRoot, found), origin, ...(reason === undefined ? {} : { reason }) });
    }

    // A bare specifier is a workspace package before it is a dependency: a
    // `workspace:`-linked config package is INSIDE the repository, so its rules
    // are the project's own and belong in the digest.
    const match = workspaces
        .filter((ws) => specifier === ws.name || specifier.startsWith(`${ws.name}/`))
        .sort((a, b) => b.name.length - a.name.length)[0];
    if (match) {
        const subpath = specifier.slice(match.name.length).replace(/^\//, '');
        const wsDir = path.join(repoRoot, match.dir);
        const found = subpath ? firstExistingFile(path.join(wsDir, subpath)) : workspaceEntry(wsDir);
        if (!found) {
            return hop({ reason: `workspace package \`${match.name}\` has no config at \`${subpath || 'its entry point'}\`` });
        }
        return hop({ path: path.relative(repoRoot, found), origin: 'workspace-package', reason: `workspace package \`${match.name}\`` });
    }

    const installed = firstExistingFile(path.join(repoRoot, 'node_modules', specifier));
    if (installed) {
        return hop({ path: path.relative(repoRoot, installed), origin: 'external', reason: 'resolves inside `node_modules/`' });
    }
    return hop({ reason: 'bare specifier matches no workspace package and is not installed' });
}

/** A config package's entry: its manifest `main`, else a conventional filename. */
function workspaceEntry(wsDir: string): string | null {
    const manifest = readConfigObject(path.join(wsDir, 'package.json'));
    if (manifest.kind === 'ok' && typeof manifest.value.main === 'string') {
        const viaMain = firstExistingFile(path.join(wsDir, manifest.value.main));
        if (viaMain) return viaMain;
    }
    return firstExistingFile(wsDir);
}

/**
 * Follow `extends` / `includes` from one config file and report the whole chain.
 *
 * The returned `hops` always contain at least the starting file, so a caller
 * that finds `digestible` empty can still say WHICH file it read and why nothing
 * came of it. `startPath` is repository-relative.
 */
export function resolveConfigChain(repoRoot: string, startPath: string): ChainResolution {
    const workspaces = listWorkspacePackages(repoRoot);
    const hops: ConfigHop[] = [];
    const seen = new Set<string>();
    const queue: ConfigHop[] = [];

    const startAbs = path.resolve(repoRoot, startPath);
    if (!fs.existsSync(startAbs)) {
        hops.push({ specifier: '', path: startPath, origin: 'unresolved', reason: 'starting config does not exist' });
    } else {
        const { origin, reason } = classify(repoRoot, startAbs);
        queue.push({
            specifier: '',
            path: path.relative(repoRoot, startAbs),
            origin,
            ...(reason === undefined ? {} : { reason }),
        });
    }

    while (queue.length > 0) {
        const hop = queue.shift() as ConfigHop;
        if (hops.length >= MAX_HOPS) {
            hops.push({ ...hop, origin: 'unresolved', reason: `chain exceeds ${MAX_HOPS} hops` });
            break;
        }
        const abs = path.resolve(repoRoot, hop.path as string); // non-null: unresolved hops are never queued
        if (seen.has(abs)) {
            hops.push({ ...hop, origin: 'unresolved', reason: 'cycle: this file is already in the chain' });
            continue;
        }
        seen.add(abs);

        const read = readConfigObject(abs);
        if (read.kind !== 'ok') {
            const reason = read.kind === 'absent' ? 'file disappeared between resolution and read' : read.reason;
            hops.push({ ...hop, origin: 'unresolved', reason });
            continue;
        }
        hops.push(hop);
        // An external hop's own directives are not followed. Its rules are
        // already excluded from the digest, so walking deeper would only grow
        // the report with paths the project does not own.
        if (hop.origin === 'external') continue;
        for (const specifier of directives(read.value)) {
            const next = resolveSpecifier(repoRoot, path.dirname(abs), specifier, workspaces);
            // A hop the specifier resolver could not place has no path to read,
            // so it is RECORDED and not queued. Queueing it walked into
            // `path.resolve(root, null)` and threw — which turned a partial
            // digest, the whole point of this module, into a crash on exactly
            // the input it exists to handle gracefully.
            if (next.path === null) {
                hops.push(next);
                continue;
            }
            queue.push(next);
        }
    }

    const unresolved = hops.filter((h) => h.origin === 'unresolved');
    return {
        hops,
        complete: unresolved.length === 0,
        digestible: hops.filter((h) => h.origin === 'project' || h.origin === 'workspace-package'),
        externals: hops.filter((h) => h.origin === 'external'),
        unresolved,
    };
}

export interface NearestConfigResult {
    /** The config that governs `editPath`, repository-relative. `null` = none. */
    governing: string | null;
    /** Every candidate found walking up, nearest first. The precedence order. */
    candidates: string[];
    /** Which rule decided: nearest-wins, root-only, or none-found. */
    basis: 'nearest-wins' | 'root-only' | 'none-found';
}

/**
 * Answer which config governs an edit, given the config filenames to look for.
 *
 * Precedence is **nearest-first**: the file in the edited path's own directory
 * governs, then its parent, up to the repository root. This is not a preference
 * — it is what the tools do. A per-package `tsconfig.json`, `.eslintrc`, `.env`
 * or deployment manifest is the one its own package's build reads, and a root
 * file it does not extend has no effect on it. Reading the root config for an
 * edit inside a package that carries its own is a wrong answer, not a coarse one.
 *
 * `candidates` is the full walk rather than just the winner, because a reader
 * needs to see that a root config was found and outranked before they trust the
 * per-package answer.
 */
export function nearestConfig(repoRoot: string, editPath: string, filenames: string[]): NearestConfigResult {
    const candidates: string[] = [];
    const startAbs = path.resolve(repoRoot, editPath);
    let dir = isDir(startAbs) ? startAbs : path.dirname(startAbs);
    const rootAbs = path.resolve(repoRoot);

    for (;;) {
        for (const name of filenames) {
            const candidate = path.join(dir, name);
            if (fs.existsSync(candidate) && !isDir(candidate)) candidates.push(path.relative(rootAbs, candidate));
        }
        if (dir === rootAbs) break;
        const parent = path.dirname(dir);
        if (parent === dir || !parent.startsWith(rootAbs)) break;
        dir = parent;
    }

    if (candidates.length === 0) return { governing: null, candidates, basis: 'none-found' };
    const governing = candidates[0] as string;
    const basis = candidates.length === 1 && !governing.includes('/') ? 'root-only' : 'nearest-wins';
    return { governing, candidates, basis };
}
