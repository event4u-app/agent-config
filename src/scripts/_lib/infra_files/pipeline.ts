/**
 * One pipeline model for GitHub Actions workflows and GitLab CI files.
 *
 * Both are read into the same shape — triggers, jobs, `needs`, environments,
 * `uses` references, step commands — so every consumer (the advisory inventory,
 * the delivery lane, the workflow linters) asks one model instead of scanning
 * lines its own way. Every element keeps the line it was read from.
 *
 * Variables and secrets are never resolved: an expression stays as written.
 */
import type { Document } from 'yaml';

import { entries, get, items, scalar, stringList, isMapNode, isSeqNode, parseYamlSource, type YNode, type YamlSource } from './yaml_source.js';

export type PipelineSystem = 'github' | 'gitlab';

export interface PipelineTrigger {
    event: string;
    line: number;
    branches: string[];
    paths: { glob: string; line: number }[];
    pathsIgnore: { glob: string; line: number }[];
    /** `workflow_run` source workflow names */
    workflows: string[];
}

export interface PipelineStep {
    line: number;
    name: string | null;
    uses: { ref: string; line: number } | null;
    /** `with:` scalars as written, keyed by input name */
    with: Record<string, { value: string; line: number }>;
    /** shell text, never emitted by the model's consumers except as a classification */
    run: { text: string; line: number } | null;
}

export interface PipelineEnvironment {
    name: string;
    line: number;
    url: string | null;
    action: string | null;
    tier: string | null;
}

export interface PipelineJob {
    id: string;
    line: number;
    name: string;
    /** GitLab stage; null for GitHub */
    stage: string | null;
    /** explicit `needs`; null when the job does not declare any (GitLab: stage order applies) */
    needs: { job: string; line: number }[] | null;
    /** a reusable workflow called by the whole job (GitHub `jobs.<id>.uses`) */
    uses: { ref: string; line: number } | null;
    environment: PipelineEnvironment | null;
    /** `write-all`, `read-all`, or `scope:level,…` as written; null when not set on the job */
    permissions: string | null;
    permissionsLine: number | null;
    /** container / job images and service images */
    images: { ref: string; line: number; role: 'job' | 'service' }[];
    steps: PipelineStep[];
    /** the job's run condition as written (`if:`, `rules: - if:`, `only:`) */
    conditions: { text: string; line: number }[];
    /** branches named by the job's own conditions; `<default>` for the default-branch variable */
    branches: string[];
    /** a person must start the job (GitLab `when: manual`) */
    manual: boolean;
    /** GitLab `rules: changes:` globs */
    changes: { glob: string; line: number }[];
    /** templates or jobs this one extends (GitLab) */
    extends: string[];
}

export interface PipelineModel {
    system: PipelineSystem;
    name: string | null;
    nameLine: number;
    triggers: PipelineTrigger[];
    permissions: string | null;
    permissionsLine: number | null;
    jobs: PipelineJob[];
    stages: string[];
    /** GitLab `include:` entries by name; `kind` is the include key (`local`, `project`, `template`, …) */
    includes: { name: string; line: number; kind: string }[];
    /** true when the workflow can be called by another (`on.workflow_call`) */
    reusable: boolean;
    error: string | null;
    source: YamlSource;
}

/**
 * The glob subset GitHub path filters use: `**` crosses directory separators,
 * `*` and `?` do not, everything else is literal.
 */
export function globToRegExp(glob: string): RegExp {
    let out = '';
    for (let i = 0; i < glob.length; i += 1) {
        const c = glob[i] as string;
        if (c === '*') {
            if (glob[i + 1] === '*') {
                out += '.*';
                i += 1;
                if (glob[i + 1] === '/') i += 1;
            } else {
                out += '[^/]*';
            }
        } else if (c === '?') {
            out += '[^/]';
        } else {
            out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${out}$`);
}

/** Does `glob` match at least one path in `paths`? Directory-shaped entries match by prefix. */
export function globMatchesAny(glob: string, paths: readonly string[]): boolean {
    const re = globToRegExp(glob);
    const prefix = `${glob.replace(/\/?\*\*$/, '').replace(/\/$/, '')}/`;
    return paths.some((t) => re.test(t) || t === glob || t.startsWith(prefix));
}

function permissionsOf(src: YamlSource, doc: Document, node: YNode): string | null {
    const one = scalar(doc, node);
    if (one !== null) return one;
    if (!isMapNode(doc, node)) return null;
    return entries(src, doc, node)
        .map((e) => `${e.key}:${scalar(doc, e.value) ?? ''}`)
        .join(',');
}

const GH_BRANCH = /github\.ref\s*==\s*['"]refs\/heads\/([^'"]+)['"]|github\.ref_name\s*==\s*['"]([^'"]+)['"]/g;
const GL_BRANCH = /\$CI_COMMIT_(?:BRANCH|REF_NAME)\s*==\s*(?:["']([^"']+)["']|(\$CI_DEFAULT_BRANCH))/g;

function branchesIn(text: string): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(GH_BRANCH)) out.push(m[1] ?? m[2]!);
    for (const m of text.matchAll(GL_BRANCH)) out.push(m[2] ? '<default>' : m[1]!);
    return out;
}

function emptyJob(id: string, line: number): PipelineJob {
    return {
        id,
        line,
        name: id,
        stage: null,
        needs: null,
        uses: null,
        environment: null,
        permissions: null,
        permissionsLine: null,
        images: [],
        steps: [],
        conditions: [],
        branches: [],
        manual: false,
        changes: [],
        extends: [],
    };
}

function environmentOf(src: YamlSource, doc: Document, node: YNode, line: number): PipelineEnvironment | null {
    const one = scalar(doc, node);
    if (one !== null) return { name: one, line, url: null, action: null, tier: null };
    const name = scalar(doc, get(src, doc, node, 'name')?.value);
    if (name === null) return null;
    return {
        name,
        line,
        url: scalar(doc, get(src, doc, node, 'url')?.value),
        action: scalar(doc, get(src, doc, node, 'action')?.value),
        tier: scalar(doc, get(src, doc, node, 'deployment_tier')?.value),
    };
}

function parseGithub(model: PipelineModel, src: YamlSource, doc: Document): void {
    const root = doc.contents;
    const nameE = get(src, doc, root, 'name');
    model.name = nameE ? scalar(doc, nameE.value) : null;
    model.nameLine = nameE?.line ?? 1;
    const perm = get(src, doc, root, 'permissions');
    model.permissions = perm ? permissionsOf(src, doc, perm.value) : null;
    model.permissionsLine = perm?.line ?? null;
    const on = get(src, doc, root, 'on');
    if (on) {
        const simple = stringList(doc, on.value);
        if (simple.length > 0) {
            for (const event of simple) model.triggers.push({ event, line: on.line, branches: [], paths: [], pathsIgnore: [], workflows: [] });
        } else {
            for (const ev of entries(src, doc, on.value)) {
                const globs = (key: string): { glob: string; line: number }[] =>
                    items(doc, get(src, doc, ev.value, key)?.value)
                        .map((n) => ({ glob: scalar(doc, n) ?? '', line: src.lineOf(n) }))
                        .filter((g) => g.glob !== '');
                model.triggers.push({
                    event: ev.key,
                    line: ev.line,
                    branches: stringList(doc, get(src, doc, ev.value, 'branches')?.value),
                    paths: globs('paths'),
                    pathsIgnore: globs('paths-ignore'),
                    workflows: stringList(doc, get(src, doc, ev.value, 'workflows')?.value),
                });
            }
        }
    }
    model.reusable = model.triggers.some((t) => t.event === 'workflow_call');
    for (const j of entries(src, doc, get(src, doc, root, 'jobs')?.value)) {
        const body = j.value;
        const job = emptyJob(j.key, j.line);
        job.name = scalar(doc, get(src, doc, body, 'name')?.value) ?? j.key;
        const needs = get(src, doc, body, 'needs');
        if (needs) {
            const listed = items(doc, needs.value);
            job.needs = listed.length > 0
                ? listed.map((n) => ({ job: scalar(doc, n) ?? '', line: src.lineOf(n) })).filter((n) => n.job !== '')
                : stringList(doc, needs.value).map((n) => ({ job: n, line: needs.line }));
        }
        const uses = get(src, doc, body, 'uses');
        const usesRef = uses ? scalar(doc, uses.value) : null;
        if (uses && usesRef) job.uses = { ref: usesRef, line: uses.line };
        const env = get(src, doc, body, 'environment');
        if (env) job.environment = environmentOf(src, doc, env.value, env.line);
        const jp = get(src, doc, body, 'permissions');
        if (jp) {
            job.permissions = permissionsOf(src, doc, jp.value);
            job.permissionsLine = jp.line;
        }
        const container = get(src, doc, body, 'container');
        if (container) {
            const ref = scalar(doc, container.value) ?? scalar(doc, get(src, doc, container.value, 'image')?.value);
            const at = get(src, doc, container.value, 'image')?.line ?? container.line;
            if (ref) job.images.push({ ref, line: at, role: 'job' });
        }
        for (const s of entries(src, doc, get(src, doc, body, 'services')?.value)) {
            const img = get(src, doc, s.value, 'image');
            const ref = img ? scalar(doc, img.value) : null;
            if (img && ref) job.images.push({ ref, line: img.line, role: 'service' });
        }
        const cond = get(src, doc, body, 'if');
        const condText = cond ? scalar(doc, cond.value) : null;
        if (cond && condText) job.conditions.push({ text: condText, line: cond.line });
        for (const st of items(doc, get(src, doc, body, 'steps')?.value)) {
            const su = get(src, doc, st, 'uses');
            const sr = get(src, doc, st, 'run');
            const withs: PipelineStep['with'] = {};
            for (const w of entries(src, doc, get(src, doc, st, 'with')?.value)) {
                const v = scalar(doc, w.value);
                if (v !== null) withs[w.key] = { value: v, line: w.line };
            }
            const suRef = su ? scalar(doc, su.value) : null;
            const srText = sr ? scalar(doc, sr.value) : null;
            job.steps.push({
                line: src.lineOf(st),
                name: scalar(doc, get(src, doc, st, 'name')?.value),
                uses: su && suRef ? { ref: suRef, line: su.line } : null,
                with: withs,
                run: sr && srText !== null ? { text: srText, line: sr.line } : null,
            });
        }
        job.branches = job.conditions.flatMap((c) => branchesIn(c.text));
        model.jobs.push(job);
    }
}

const GITLAB_RESERVED = new Set(['image', 'services', 'stages', 'types', 'before_script', 'after_script', 'variables', 'cache', 'include', 'workflow', 'default', 'spec']);

function parseGitlab(model: PipelineModel, src: YamlSource, doc: Document): void {
    const root = doc.contents;
    const stages = get(src, doc, root, 'stages');
    model.stages = stages ? stringList(doc, stages.value) : ['build', 'test', 'deploy'];
    const inc = get(src, doc, root, 'include');
    if (inc) {
        const listed = items(doc, inc.value);
        for (const n of listed.length > 0 ? listed : [inc.value]) {
            const line = listed.length > 0 ? src.lineOf(n) : inc.line;
            const one = scalar(doc, n);
            if (one !== null) {
                model.includes.push({ name: one, line, kind: one.includes('://') ? 'remote' : 'local' });
                continue;
            }
            for (const key of ['local', 'file', 'template', 'project', 'component', 'remote']) {
                const v = get(src, doc, n, key);
                if (!v) continue;
                for (const name of stringList(doc, v.value)) {
                    model.includes.push({ name: key === 'remote' ? name.replace(/^.*\//, '') : name, line: v.line, kind: key });
                }
                break;
            }
        }
    }
    const all = entries(src, doc, root).filter((e) => !GITLAB_RESERVED.has(e.key));
    const byName = new Map(all.map((e) => [e.key, e]));
    const lookup = (body: YNode, key: string, seen = new Set<YNode>()): ReturnType<typeof get> => {
        const own = get(src, doc, body, key);
        if (own) return own;
        if (seen.has(body)) return undefined;
        seen.add(body);
        const ext = get(src, doc, body, 'extends');
        const parents = ext ? stringList(doc, ext.value) : [];
        for (let i = parents.length - 1; i >= 0; i--) {
            const p = byName.get(parents[i]!);
            const found = p ? lookup(p.value, key, seen) : undefined;
            if (found) return found;
        }
        return undefined;
    };
    for (const j of all) {
        if (j.key.startsWith('.')) continue;
        const body = j.value;
        if (!isMapNode(doc, body)) continue;
        const job = emptyJob(j.key, j.line);
        const ext = get(src, doc, body, 'extends');
        job.extends = ext ? stringList(doc, ext.value) : [];
        job.stage = scalar(doc, lookup(body, 'stage')?.value) ?? 'test';
        const needs = lookup(body, 'needs');
        if (needs) {
            job.needs = items(doc, needs.value)
                .map((n) => ({ job: scalar(doc, n) ?? scalar(doc, get(src, doc, n, 'job')?.value) ?? '', line: src.lineOf(n) }))
                .filter((n) => n.job !== '');
        }
        const env = lookup(body, 'environment');
        if (env) job.environment = environmentOf(src, doc, env.value, env.line);
        const img = lookup(body, 'image');
        if (img) {
            const ref = scalar(doc, img.value) ?? scalar(doc, get(src, doc, img.value, 'name')?.value);
            if (ref) job.images.push({ ref, line: img.line, role: 'job' });
        }
        for (const s of items(doc, lookup(body, 'services')?.value)) {
            const ref = scalar(doc, s) ?? scalar(doc, get(src, doc, s, 'name')?.value);
            if (ref) job.images.push({ ref, line: src.lineOf(s), role: 'service' });
        }
        for (const key of ['before_script', 'script', 'after_script']) {
            const sc = lookup(body, key);
            if (!sc) continue;
            const lines = stringList(doc, sc.value);
            if (lines.length > 0) job.steps.push({ line: sc.line, name: key, uses: null, with: {}, run: { text: lines.join('\n'), line: sc.line } });
        }
        const when = scalar(doc, lookup(body, 'when')?.value);
        job.manual = when === 'manual';
        const rules = lookup(body, 'rules');
        for (const r of items(doc, rules?.value)) {
            const ifE = get(src, doc, r, 'if');
            const t = ifE ? scalar(doc, ifE.value) : null;
            if (ifE && t) job.conditions.push({ text: t, line: ifE.line });
            if (scalar(doc, get(src, doc, r, 'when')?.value) === 'manual') job.manual = true;
            const ch = get(src, doc, r, 'changes');
            const chList = ch ? (isSeqNode(doc, ch.value) ? ch.value : get(src, doc, ch.value, 'paths')?.value) : null;
            for (const c of items(doc, chList)) {
                const g = scalar(doc, c);
                if (g) job.changes.push({ glob: g, line: src.lineOf(c) });
            }
        }
        const only = lookup(body, 'only');
        if (only) {
            const refs = stringList(doc, only.value).length > 0 ? stringList(doc, only.value) : stringList(doc, get(src, doc, only.value, 'refs')?.value);
            const named = refs.filter((r) => !['branches', 'tags', 'merge_requests', 'pushes', 'schedules', 'api', 'web', 'triggers', 'pipelines', 'external'].includes(r));
            job.conditions.push({ text: `only: ${refs.join(', ')}`, line: only.line });
            job.branches.push(...named);
        }
        job.branches.push(...job.conditions.flatMap((c) => branchesIn(c.text)));
        model.jobs.push(job);
    }
    model.triggers.push({ event: 'pipeline', line: 1, branches: [], paths: [], pathsIgnore: [], workflows: [] });
}

export function parsePipeline(text: string, system: PipelineSystem): PipelineModel {
    const src = parseYamlSource(text);
    const model: PipelineModel = {
        system,
        name: null,
        nameLine: 1,
        triggers: [],
        permissions: null,
        permissionsLine: null,
        jobs: [],
        stages: [],
        includes: [],
        reusable: false,
        error: src.error,
        source: src,
    };
    const doc = src.docs[0];
    if (!doc || src.error) return model;
    if (system === 'github') parseGithub(model, src, doc);
    else parseGitlab(model, src, doc);
    return model;
}
