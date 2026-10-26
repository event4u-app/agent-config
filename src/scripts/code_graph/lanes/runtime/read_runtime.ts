/**
 * The runtime lane: what a project runs locally and where it is deployed to,
 * read from files only — compose files, Dockerfiles, devcontainer config,
 * Make/Task targets, Terraform, Kubernetes manifests, and a `docker compose
 * config` output the user produced (rung T3).
 *
 * Never connects to Docker, a cluster or a cloud, never runs a binary, never
 * reads Terraform state or a `.env` value. Environment entries are names.
 * Hostnames, IP addresses and cloud account ids are redacted before output.
 */
import * as path from 'node:path';

import { parseCompose, type ComposeModel, type ComposeService } from '../../../_lib/infra_files/compose.js';
import { parseDockerfile } from '../../../_lib/infra_files/dockerfile.js';
import { SKIP_DIRS, isComposeName, isDockerfileName, isGithubWorkflowPath, isGitlabCiName, walkFiles } from '../../../_lib/infra_files/walk.js';
import { isFixturePath } from '../../fixture_paths.js';
import type { LaneOutput } from '../lane_fact.js';
import { Emitter, posix } from './emit.js';
import { CODE_EXT, envNamesInExample, envReadsInCode, isEnvExampleName, isPlatformName } from './env_names.js';
import { dbEngineOf, parseImageRef } from './images.js';
import { looksLikeManifest, readKubernetesFiles } from './kubernetes.js';
import { redactImage, redactOutput, redactText } from './redact.js';
import { isMakefileName, isTaskfileName, parseMakefile, parseTaskfile } from './targets.js';
import { readTerraformDir, terraformDirs } from './terraform.js';

const RUNTIME_SKIP = new Set([...SKIP_DIRS, '.terraform', '.terragrunt-cache', 'tests', 'test', '__tests__', 'fixtures']);
/** a `docker compose config` output the user saved (rung T3) */
export const isResolvedComposeName = (n: string): boolean => /^(docker-)?compose[.-](resolved|config)\.ya?ml$/.test(n);
const MAX_YAML_BYTES = 512 * 1024;

function imageAttrs(ref: string): Record<string, string | boolean | null> {
    const p = parseImageRef(ref);
    return {
        ref: redactImage(ref).text,
        repo: redactImage(p.repo).text,
        tag: p.tag,
        tag_implicit: p.tagImplicit,
        pinned_digest: p.digest !== null,
        db_engine: dbEngineOf(p.repo),
        redacted: redactImage(ref).redacted,
    };
}

interface ComposeRead {
    file: string;
    model: ComposeModel;
}

function serviceKey(file: string, name: string, resolved: boolean): string {
    return `${resolved ? 'resolved' : 'compose'}:${file}#${name}`;
}

function emitCompose(em: Emitter, { file, model }: ComposeRead, all: ComposeRead[], resolved: boolean): void {
    const rung = resolved ? 'T3' : 'T1';
    const dir = path.posix.dirname(file);
    const svcId = (name: string): string => {
        if (model.services.some((s) => s.name === name)) return `service:${serviceKey(file, name, resolved)}`;
        const sibling = all.find((c) => path.posix.dirname(c.file) === dir && c.model.services.some((s) => s.name === name));
        return `service:${serviceKey(sibling?.file ?? file, name, resolved)}`;
    };
    const topId = (kind: 'network' | 'volume', name: string): string => {
        const declared = (c: ComposeRead): boolean => (kind === 'network' ? c.model.networks : c.model.volumes).some((x) => x.name === name);
        const owner = declared({ file, model }) ? file : (all.find((c) => path.posix.dirname(c.file) === dir && declared(c))?.file ?? file);
        return `${kind}:${owner}#${name}`;
    };
    for (const n of model.networks) em.fact('network', `${file}#${n.name}`, n.name, { source: 'compose' }, file, n.line, rung);
    for (const v of model.volumes) em.fact('volume', `${file}#${v.name}`, v.name, { source: 'compose' }, file, v.line, rung);
    for (const s of model.services) {
        const img = s.image ? imageAttrs(s.image) : null;
        const id = em.fact(
            'service',
            serviceKey(file, s.name, resolved),
            s.name,
            {
                source: resolved ? 'compose-config' : 'compose',
                image: img ? (img['ref'] as string) : null,
                build: s.build,
                db_engine: img ? (img['db_engine'] as string | null) : null,
                env_files: s.envFiles.map((e) => e.name),
                redacted: img?.['redacted'] === true,
            },
            file,
            s.line,
            rung,
        );
        if (s.image) {
            const imgId = em.fact('image', `${file}#${s.name}`, img!['ref'] as string, { ...img!, context: id }, file, s.imageLine, rung);
            em.rel('uses-image', id, imgId, {}, file, s.imageLine, { rung });
        }
        if (s.build !== null) {
            const df = path.posix.normalize(path.posix.join(dir, s.build, s.dockerfile ?? 'Dockerfile'));
            em.rel('uses-image', id, `image:built:${df}`, { mechanism: 'build', target_name: df }, file, s.line, { rung });
        }
        for (const p of s.ports) {
            const pub = p.published !== null && !p.published.includes('$');
            const hostIp = p.hostIp;
            const local = hostIp !== null && /^(127\.\d+\.\d+\.\d+|localhost|::1)$/.test(hostIp);
            const key = `${file}#${s.name}:${p.published ?? '-'}:${p.target}/${p.protocol}`;
            const portId = em.fact(
                'port',
                key,
                `${p.published ?? '*'}→${p.target}/${p.protocol}`,
                {
                    published: pub ? p.published : null,
                    is_published: pub,
                    target: p.target,
                    protocol: p.protocol,
                    host_ip: hostIp === null ? null : redactText(hostIp).text,
                    redacted: hostIp !== null && redactText(hostIp).redacted,
                    local_only: local,
                    service: s.name,
                    service_dir: dir,
                    db_engine: img ? (img['db_engine'] as string | null) : null,
                    context: id,
                },
                file,
                p.line,
                rung,
            );
            em.rel('publishes', id, portId, {}, file, p.line, { rung });
        }
        for (const n of s.networks.filter((x) => x.name !== 'default')) em.rel('on-network', id, topId('network', n.name), { target_name: n.name }, file, n.line, { rung });
        for (const v of s.volumes) {
            if (v.named && v.source) em.rel('mounts', id, topId('volume', v.source), { target: v.target, target_name: v.source }, file, v.line, { rung });
        }
        for (const d of s.dependsOn) em.rel('depends-on', id, svcId(d.name), { target_name: d.name }, file, d.line, { rung });
        for (const e of s.envNames) {
            const envId = em.fact('env-var', `${resolved ? 'resolved' : 'compose'}:${file}#${s.name}:${e.name}`, e.name, { name: e.name, source: resolved ? 'compose-config' : 'compose', service: s.name, platform: isPlatformName(e.name) }, file, e.line, rung);
            em.rel('configured-by', id, envId, {}, file, e.line, { rung });
        }
    }
}

function diffServices(a: ComposeService, b: ComposeService): string[] {
    const out: string[] = [];
    if ((a.image ?? '') !== (b.image ?? '')) out.push('image');
    const ports = (s: ComposeService): string => s.ports.map((p) => `${p.published}:${p.target}/${p.protocol}`).sort().join(',');
    if (ports(a) !== ports(b)) out.push('ports');
    const envs = (s: ComposeService): string => s.envNames.map((e) => e.name).sort().join(',');
    if (envs(a) !== envs(b)) out.push('environment');
    const deps = (s: ComposeService): string => s.dependsOn.map((e) => e.name).sort().join(',');
    if (deps(a) !== deps(b)) out.push('depends_on');
    return out;
}

function readDockerfiles(em: Emitter, files: string[]): void {
    for (const file of files) {
        const text = em.read(file);
        if (text === null) continue;
        const df = parseDockerfile(text);
        if (df.stages.length === 0) continue;
        const last = df.stages[df.stages.length - 1]!;
        const lines = text.split('\n');
        let finalLine = lines.length;
        while (finalLine > 1 && /^\s*(#.*)?$/.test(lines[finalLine - 1]!)) finalLine--;
        // The image a Dockerfile produces is defined by its final instruction, a different line from any FROM.
        const built = em.fact('image', `built:${file}`, file, { source: 'dockerfile', stages: df.stages.length, ref: null, tag: null }, file, finalLine);
        const aliases = new Map<string, number>();
        for (const st of df.stages) {
            const fromStage = aliases.get(st.image.toLowerCase());
            const id = em.fact(
                'image',
                `${file}#stage${st.index}`,
                st.alias ?? `stage ${st.index}`,
                fromStage !== undefined || st.image === 'scratch'
                    ? { source: 'dockerfile', ref: st.image, repo: st.image, tag: null, stage: st.index, alias: st.alias, from_stage: fromStage ?? null, context: built }
                    : { source: 'dockerfile', ...imageAttrs(st.image), stage: st.index, alias: st.alias, context: built },
                file,
                st.line,
            );
            if (fromStage !== undefined) em.rel('based-on', id, `image:${file}#stage${fromStage}`, {}, file, st.line);
            if (st.alias) aliases.set(st.alias.toLowerCase(), st.index);
        }
        em.rel('based-on', built, `image:${file}#stage${last.index}`, {}, file, last.line);
        for (const ex of df.exposes) {
            const pid = em.fact('port', `${file}#expose:${ex.port}/${ex.protocol}`, `${ex.port}/${ex.protocol}`, { published: null, is_published: false, exposed: true, target: ex.port, protocol: ex.protocol, context: built }, file, ex.line);
            em.rel('publishes', built, pid, { mechanism: 'EXPOSE' }, file, ex.line);
        }
    }
}

function stripJsonc(text: string): string {
    let out = '';
    let inStr = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i]!;
        if (inStr) {
            out += c;
            if (c === '\\') out += text[++i] ?? '';
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') {
            inStr = true;
            out += c;
        } else if (c === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') i++;
            out += '\n';
        } else if (c === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            const skipped = text.slice(i, end < 0 ? text.length : end + 2);
            out += skipped.replace(/[^\n]/g, ' ');
            i = end < 0 ? text.length : end + 1;
        } else {
            out += c;
        }
    }
    return out.replace(/,(\s*[}\]])/g, '$1');
}

/** The project a devcontainer configures: the directory holding `.devcontainer/` or `.devcontainer.json`. */
function devcontainerProject(file: string): string {
    const i = file.lastIndexOf('.devcontainer');
    const dir = file.slice(0, i).replace(/\/$/, '');
    return dir;
}

function readDevcontainers(em: Emitter, files: string[], composeReads: ComposeRead[], scopes: string[]): void {
    for (const file of files) {
        const text = em.read(file);
        if (text === null) continue;
        let doc: Record<string, unknown>;
        try {
            doc = JSON.parse(stripJsonc(text)) as Record<string, unknown>;
        } catch (e) {
            em.skip(file, `devcontainer json: ${(e as Error).message.split('\n')[0]}`);
            continue;
        }
        const lineOf = (needle: string): number => {
            const i = text.indexOf(needle);
            return i < 0 ? 1 : text.slice(0, i).split('\n').length;
        };
        const image = typeof doc['image'] === 'string' ? doc['image'] : null;
        const composeFiles = (Array.isArray(doc['dockerComposeFile']) ? doc['dockerComposeFile'] : [doc['dockerComposeFile']]).filter((x): x is string => typeof x === 'string');
        const svc = typeof doc['service'] === 'string' ? doc['service'] : null;
        const features = doc['features'] && typeof doc['features'] === 'object' ? Object.keys(doc['features']) : [];
        const id = em.fact(
            'service',
            `devcontainer:${file}`,
            typeof doc['name'] === 'string' ? doc['name'] : 'devcontainer',
            { source: 'devcontainer', image: image ? redactImage(image).text : null, compose_service: svc, features: features.map((f) => redactImage(f).text), db_engine: image ? dbEngineOf(parseImageRef(image).repo) : null },
            file,
            lineOf(image ? '"image"' : svc ? '"service"' : '{'),
        );
        if (image) {
            const imgId = em.fact('image', `${file}#devcontainer`, redactImage(image).text, { ...imageAttrs(image), context: id }, file, lineOf('"image"'));
            em.rel('uses-image', id, imgId, {}, file, lineOf('"image"'));
        }
        if (svc) {
            const dir = path.posix.dirname(file);
            const targets = composeFiles.map((c) => path.posix.normalize(path.posix.join(dir, c)));
            const hit = composeReads.find((c) => targets.includes(c.file) && c.model.services.some((s) => s.name === svc));
            const target = `service:${serviceKey(hit?.file ?? targets[0] ?? file, svc, false)}`;
            em.rel('depends-on', id, target, { mechanism: 'dockerComposeFile', target_name: svc }, file, lineOf('"service"'));
        }
        let declares = false;
        for (const key of ['containerEnv', 'remoteEnv']) {
            const env = doc[key];
            if (!env || typeof env !== 'object' || Array.isArray(env)) continue;
            for (const name of Object.keys(env)) {
                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
                const line = lineOf(`"${name}"`);
                const envId = em.fact('env-var', `devcontainer:${file}#${name}`, name, { name, source: 'devcontainer', platform: isPlatformName(name) }, file, line);
                em.rel('configured-by', id, envId, {}, file, line);
                declares = true;
            }
        }
        if (declares) scopes.push(devcontainerProject(file));
        const fwd = Array.isArray(doc['forwardPorts']) ? doc['forwardPorts'] : [];
        for (const p of fwd) {
            if (typeof p !== 'number' && typeof p !== 'string') continue;
            const pid = em.fact('port', `${file}#forward:${p}`, String(p), { published: null, is_published: false, forwarded: true, target: String(p), protocol: 'tcp', context: id }, file, lineOf('"forwardPorts"'));
            em.rel('publishes', id, pid, { mechanism: 'forwardPorts' }, file, lineOf('"forwardPorts"'));
        }
    }
}

function readTargets(em: Emitter, files: string[]): void {
    for (const file of files) {
        const text = em.read(file);
        if (text === null) continue;
        const name = path.posix.basename(file);
        const tool = isMakefileName(name) ? 'make' : 'task';
        const targets = tool === 'make' ? parseMakefile(text) : parseTaskfile(text);
        const declared = new Set(targets.map((t) => t.name));
        // An included Taskfile may define the dependency; only a self-contained file can call it undeclared.
        const hasIncludes = tool === 'task' && /^includes:/m.test(text);
        for (const t of targets) em.fact('target', `${tool}:${file}#${t.name}`, t.name, { tool }, file, t.line);
        for (const t of targets) {
            for (const d of t.deps) {
                if (d.name.includes(':') && tool === 'task') continue;
                if ((tool === 'make' || hasIncludes) && !declared.has(d.name)) continue;
                em.rel('depends-on', `target:${tool}:${file}#${t.name}`, `target:${tool}:${file}#${d.name}`, { target_name: d.name }, file, d.line);
            }
        }
    }
}

/**
 * The code a compose service's environment speaks for: its build context, or
 * the compose file's own directory for a service that builds nothing. A
 * context outside the scanned root is unplaceable and speaks for nothing here.
 */
function composeScopes(em: Emitter, reads: ComposeRead[], scopes: string[]): void {
    for (const { file, model } of reads) {
        const dir = path.posix.dirname(file);
        for (const s of model.services) {
            if (s.envNames.length === 0) continue;
            if (s.build === null) {
                scopes.push(dir === '.' ? '' : dir);
                continue;
            }
            const ctx = path.posix.normalize(path.posix.join(dir, s.build));
            if (ctx === '..' || ctx.startsWith('../')) {
                em.skip(file, `service ${s.name}: build context ${s.build} lies outside the scanned root; its environment is not matched against code`);
                continue;
            }
            scopes.push(ctx === '.' ? '' : ctx);
        }
    }
}

const inScope = (file: string, scopes: readonly string[]): boolean => scopes.some((s) => s === '' || file === s || file.startsWith(`${s}/`));

/**
 * Env names read in code, each marked with whether a declaring file speaks
 * for it (`declared_scope`) — RT-3 judges only those. With no declaring file at
 * all the check has no population: `env_check` is `unknown`, not `complete`.
 * Test, fixture and benchmark files are not read: a name only a test reads is
 * not one the deployed code needs.
 */
function readEnvNames(em: Emitter, root: string, scopes: string[]): void {
    for (const file of walkFiles(root, (n) => isEnvExampleName(n), { maxDepth: 3, skipDirs: RUNTIME_SKIP }).map(posix)) {
        if (isFixturePath(file)) continue;
        const text = em.read(file);
        if (text === null) continue;
        const names = envNamesInExample(text);
        for (const e of names) em.fact('env-var', `example:${file}#${e.name}`, e.name, { name: e.name, source: 'example', platform: isPlatformName(e.name) }, file, e.line);
        if (names.length > 0) {
            const dir = path.posix.dirname(file);
            scopes.push(dir === '.' ? '' : dir);
        }
    }
    if (em.facts.some((f) => f.kind === 'env-var' && f.attrs['source'] === 'kubernetes')) scopes.push('');
    const reads: { file: string; name: string; line: number; scoped: boolean }[] = [];
    for (const file of walkFiles(root, (n) => CODE_EXT.test(n) && !/\.(test|spec|d)\.\w+$/.test(n), { maxDepth: 8, skipDirs: RUNTIME_SKIP }).map(posix)) {
        if (isFixturePath(file)) continue;
        const text = em.read(file);
        if (text === null || text.length > 1024 * 1024) continue;
        const seen = new Set<string>();
        const scoped = inScope(file, scopes);
        for (const r of envReadsInCode(text)) {
            if (seen.has(r.name)) continue;
            seen.add(r.name);
            reads.push({ file, name: r.name, line: r.line, scoped });
        }
    }
    const outside = reads.filter((r) => !r.scoped && !isPlatformName(r.name));
    const check = scopes.length === 0 ? 'unknown' : outside.length > 0 ? 'partial' : 'complete';
    for (const r of reads) {
        em.fact('env-var', `code:${r.file}#${r.name}`, r.name, { name: r.name, source: 'code', platform: isPlatformName(r.name), declared_scope: r.scoped, env_check: check }, r.file, r.line);
    }
    if (scopes.length === 0 && reads.length > 0) {
        em.skip('.', `env check unknown: ${reads.length} env name read(s) in code, but no compose service, env example, devcontainer or Kubernetes manifest declares an env name`);
    } else if (outside.length > 0) {
        em.skip('.', `env check partial: ${outside.length} env name read(s) in ${new Set(outside.map((r) => r.file)).size} file(s) lie outside every declaring file's scope and are not judged`);
    }
}

export interface RuntimeOptions {
    /** read env names from source code (RT-3 needs them); default true */
    codeEnv?: boolean;
}

export function readRuntime(root: string, opts: RuntimeOptions = {}): LaneOutput {
    const em = new Emitter(root);
    const walked = walkFiles(root, () => true, { maxDepth: 6, skipDirs: RUNTIME_SKIP }).map(posix);
    const files = walked.filter((f) => !isFixturePath(f));
    if (files.length < walked.length) em.skip('.', `${walked.length - files.length} file(s) under test, fixture or benchmark trees not read as this project's runtime`);
    const scopes: string[] = [];
    const base = (f: string): string => path.posix.basename(f);

    const composeReads: ComposeRead[] = [];
    const resolvedReads: ComposeRead[] = [];
    for (const file of files.filter((f) => isComposeName(base(f)) || isResolvedComposeName(base(f)))) {
        const text = em.read(file);
        if (text === null) continue;
        const model = parseCompose(text);
        if (model.error) {
            em.skip(file, `yaml: ${model.error}`);
            continue;
        }
        (isResolvedComposeName(base(file)) ? resolvedReads : composeReads).push({ file, model });
    }
    for (const c of composeReads) emitCompose(em, c, composeReads, false);
    for (const r of resolvedReads) {
        emitCompose(em, r, resolvedReads, true);
        const dir = path.posix.dirname(r.file);
        for (const s of r.model.services) {
            const configured =
                composeReads.find((c) => path.posix.dirname(c.file) === dir && c.model.services.some((x) => x.name === s.name)) ??
                composeReads.find((c) => c.model.services.some((x) => x.name === s.name));
            if (!configured) continue;
            const cs = configured.model.services.find((x) => x.name === s.name)!;
            em.rel('resolves-to', `service:${serviceKey(configured.file, s.name, false)}`, `service:${serviceKey(r.file, s.name, true)}`, { differs: diffServices(cs, s) }, r.file, s.line, { rung: 'T3' });
        }
    }
    readDockerfiles(em, files.filter((f) => isDockerfileName(base(f))));
    composeScopes(em, [...composeReads, ...resolvedReads], scopes);
    readDevcontainers(em, files.filter((f) => /(^|\/)\.devcontainer(\/[^/]+)?\/devcontainer\.json$|(^|\/)\.devcontainer\.json$/.test(f)), composeReads, scopes);
    readTargets(em, files.filter((f) => isMakefileName(base(f)) || isTaskfileName(base(f))));
    for (const [dir, tfs] of terraformDirs(files.filter((f) => f.endsWith('.tf')))) readTerraformDir(em, dir, tfs);

    const manifestCandidates = files.filter((f) => {
        const n = base(f);
        if (!/\.ya?ml$/.test(n)) return false;
        if (isComposeName(n) || isResolvedComposeName(n) || isGitlabCiName(n) || isTaskfileName(n) || isGithubWorkflowPath(f)) return false;
        return !f.startsWith('.github/') && !f.startsWith('agents/');
    });
    const manifests: string[] = [];
    for (const f of manifestCandidates) {
        const text = em.read(f);
        if (text !== null && text.length <= MAX_YAML_BYTES && looksLikeManifest(text)) manifests.push(f);
    }
    readKubernetesFiles(em, manifests);
    if (opts.codeEnv !== false) readEnvNames(em, root, scopes);
    return redactOutput(em.output('runtime'));
}
