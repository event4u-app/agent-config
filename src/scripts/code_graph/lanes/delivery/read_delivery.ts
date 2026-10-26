/**
 * The delivery lane: GitHub Actions workflows and GitLab CI pipelines read
 * into one model — triggers, jobs, `needs`, reusable workflows, environments,
 * action pinning, permissions — and the chains a reviewer asks about: which
 * branch deploys to which environment, and which job builds the image a
 * deploy job ships.
 *
 * Files only: no CI API, no secret, no variable is resolved. A dynamic
 * environment name (a review app per branch) stays as written.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parsePipeline, type PipelineJob, type PipelineModel } from '../../../_lib/infra_files/pipeline.js';
import { entries, get, items, scalar, parseYamlSource } from '../../../_lib/infra_files/yaml_source.js';
import { isGithubWorkflowPath, isGitlabCiName, walkFiles } from '../../../_lib/infra_files/walk.js';
import type { LaneOutput } from '../lane_fact.js';
import { Emitter, posix } from '../runtime/emit.js';
import { parseImageRef } from '../runtime/images.js';
import { redactImage, redactOutput, redactText } from '../runtime/redact.js';
import { excludedOwnFiles } from './self_trigger.js';

const DEPLOY_NAME = /(^|[^a-z])(deploy|release|rollout|promote|ship)/i;
const DEPLOY_CMD = /kubectl\s+(apply|set\s+image|rollout)|helm\s+(upgrade|install)|terraform\s+apply|aws\s+ecs\s+update-service|fly(ctl)?\s+deploy|vercel\s+.*--prod|gcloud\s+run\s+deploy|kamal\s+deploy|cap\s+\w+\s+deploy|serverless\s+deploy|sls\s+deploy/;
const TEST_NAME = /(^|[^a-z])(test|tests|lint|check|checks|spec|verify|ci)([^a-z]|$)/i;
const TEST_CMD = /\b(npm\s+(run\s+)?test|yarn\s+test|pnpm\s+(run\s+)?test|vitest|jest|pytest|phpunit|pest|go\s+test|cargo\s+test|task\s+test|make\s+test|rspec|playwright\s+test|composer\s+test|php\s+artisan\s+test)\b/;
const SHA = /^[0-9a-f]{40}$/;

function jobText(job: PipelineJob): string {
    return job.steps
        .map((s) => [s.run?.text ?? '', ...Object.values(s.with).map((w) => w.value)].join('\n'))
        .concat(job.images.map((i) => i.ref))
        .join('\n');
}

function normalizeRepo(raw: string): string | null {
    const cleaned = raw.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, '${{ $1 }}').replace(/^["']|["']$/g, '').trim();
    if (cleaned === '' || cleaned.startsWith('-')) return null;
    return parseImageRef(cleaned).repo;
}

/** Image repositories a job builds and pushes. */
function builtImages(job: PipelineJob): { repo: string; line: number }[] {
    const out: { repo: string; line: number }[] = [];
    for (const s of job.steps) {
        if (s.uses && /^docker\/build-push-action@/.test(s.uses.ref)) {
            const tags = s.with['tags'];
            if (tags) for (const t of tags.value.split(/[\n,]/)) {
                const r = normalizeRepo(t);
                if (r) out.push({ repo: r, line: tags.line });
            }
        }
        if (!s.run) continue;
        const text = s.run.text.replace(/\\\n/g, ' ');
        for (const m of text.matchAll(/docker\s+(?:buildx\s+)?build\b[^\n]*?\s(?:-t|--tag)[=\s]+(\S+)/g)) {
            const r = normalizeRepo(m[1]!);
            if (r) out.push({ repo: r, line: s.run.line });
        }
        for (const m of text.matchAll(/(?:docker\s+push\s+|--destination[=\s]+)(\S+)/g)) {
            const r = normalizeRepo(m[1]!);
            if (r) out.push({ repo: r, line: s.run.line });
        }
    }
    return out;
}

const isDynamic = (name: string): boolean => /\$\{\{|\$\{?[A-Z_]/.test(name);
const isReview = (name: string): boolean => /^review[/-]/i.test(name) || /\$\{?CI_(COMMIT_REF_(SLUG|NAME)|MERGE_REQUEST_IID)|github\.(head_ref|event\.number|event\.pull_request)/.test(name);

/** Environments a committed `.github/settings.yml` declares with a protection rule. */
function protectedBySettings(em: Emitter, root: string): Set<string> {
    const out = new Set<string>();
    const rel = '.github/settings.yml';
    if (!fs.existsSync(path.join(root, rel))) return out;
    const text = em.read(rel);
    if (text === null) return out;
    const src = parseYamlSource(text);
    const doc = src.docs[0];
    if (!doc || src.error) return out;
    const protectionKeys = ['wait_timer', 'reviewers', 'deployment_branch_policy', 'prevent_self_review'];
    for (const it of items(doc, get(src, doc, doc.contents, 'environments')?.value)) {
        const name = scalar(doc, get(src, doc, it, 'name')?.value);
        if (name && entries(src, doc, it).some((x) => protectionKeys.includes(x.key))) out.add(name);
    }
    return out;
}

interface Read {
    file: string;
    model: PipelineModel;
}

function emitPipeline(em: Emitter, { file, model }: Read, all: Read[], protectedEnvs: Set<string>, byName: Map<string, string>): void {
    const wfId = em.fact(
        'workflow',
        file,
        model.name ?? path.posix.basename(file),
        {
            system: model.system,
            triggers: model.triggers.map((t) => t.event),
            permissions: model.permissions,
            reusable: model.reusable,
            stages: model.stages,
        },
        file,
        model.system === 'github' ? model.nameLine : 1,
    );
    const ownFiles = [file];
    for (const t of model.triggers) {
        if (model.system !== 'github') break;
        const hasFilter = t.paths.length > 0 || t.pathsIgnore.length > 0;
        const localUses = model.jobs.flatMap((j) => [j.uses?.ref, ...j.steps.map((s) => s.uses?.ref)]).filter((r): r is string => typeof r === 'string' && r.startsWith('./'));
        const own = [...new Set([...ownFiles, ...localUses.map((u) => u.replace(/^\.\//, ''))])];
        const excluded = hasFilter ? excludedOwnFiles(t.paths.map((p) => p.glob), t.pathsIgnore.map((p) => p.glob), own) : [];
        const self = hasFilter ? excluded.length === 0 : null;
        const tid = em.fact(
            'trigger',
            `${file}#${t.event}`,
            t.event,
            { event: t.event, branches: t.branches, paths: t.paths.map((p) => p.glob), paths_ignore: t.pathsIgnore.map((p) => p.glob), self_triggering: self, excluded, context: wfId },
            file,
            t.paths[0]?.line ?? t.pathsIgnore[0]?.line ?? t.line,
        );
        em.rel('triggers', tid, wfId, {}, file, t.line);
        for (const w of t.workflows) {
            const upstream = byName.get(w);
            em.rel('triggers', upstream ?? `workflow:name:${w}`, wfId, { mechanism: 'workflow_run', target_name: w }, file, t.line);
        }
    }
    const pushBranches = model.triggers.filter((t) => t.event === 'push').flatMap((t) => t.branches);
    const openToPrs = model.triggers.some((t) => /^pull_request|^merge_request/.test(t.event));
    const restrictedTrigger = model.system === 'github' && !openToPrs && pushBranches.length > 0 && pushBranches.every((b) => !/[*?[]/.test(b));
    const jobId = (id: string): string => `job:${file}#${id}`;
    const built = new Map<string, { jobIds: string[]; imageId: string }>();
    const envFacts = new Map<string, { jobs: string[] }>();
    for (const job of model.jobs) {
        const text = jobText(job);
        const isDeploy = job.environment !== null || DEPLOY_NAME.test(`${job.id} ${job.name}`) || DEPLOY_CMD.test(text);
        const isTest = TEST_NAME.test(`${job.id} ${job.name}`) || TEST_CMD.test(text);
        const permissions = job.permissions ?? model.permissions;
        const jid = em.fact(
            'job',
            `${file}#${job.id}`,
            job.name,
            {
                system: model.system,
                stage: job.stage,
                environment: job.environment?.name ?? null,
                permissions,
                permissions_inherited: job.permissions === null && model.permissions !== null,
                is_deploy: isDeploy,
                is_test: isTest,
                branches: job.branches,
                manual: job.manual,
                context: wfId,
            },
            file,
            job.line,
        );
        em.rel('contains', wfId, jid, {}, file, job.line);
        if (job.needs) for (const n of job.needs) em.rel('needs', jid, jobId(n.job), { target_name: n.job }, file, n.line);
        if (job.uses) emitUses(em, file, job, job.uses.ref, job.uses.line, jid, all, true);
        for (const s of job.steps) if (s.uses) emitUses(em, file, job, s.uses.ref, s.uses.line, jid, all, false);
        for (const b of builtImages(job)) {
            const red = redactImage(b.repo).text;
            const cur = built.get(red) ?? { jobIds: [], imageId: em.fact('image', `${file}#${red}`, red, { repo: red, source: 'pipeline' }, file, b.line) };
            cur.jobIds.push(jid);
            built.set(red, cur);
            em.rel('builds', jid, cur.imageId, {}, file, b.line);
        }
        if (job.environment) {
            const env = job.environment;
            const dynamic = isDynamic(env.name);
            const branches = job.branches.length > 0 ? job.branches : restrictedTrigger ? pushBranches : [];
            const prot = dynamic ? null : job.manual || job.branches.length > 0 || restrictedTrigger || protectedEnvs.has(env.name);
            const key = `${file}#${env.name}`;
            const existing = envFacts.get(key);
            if (!existing) {
                em.fact(
                    'environment',
                    key,
                    env.name,
                    { name: env.name, dynamic, review: isReview(env.name), url: env.url ? redactText(env.url).text : null, redacted: env.url !== null && redactText(env.url).redacted, tier: env.tier, action: env.action, protected: prot, branches, context: jid },
                    file,
                    env.line,
                );
                envFacts.set(key, { jobs: [jid] });
            } else {
                existing.jobs.push(jid);
                const f = em.facts.find((x) => x.id === `environment:${key}`)!;
                if (prot === false && f.attrs['protected'] !== false) {
                    f.attrs['protected'] = false;
                    f.attrs['context'] = jid;
                }
            }
            em.rel('deploys-to', jid, `environment:${key}`, { branches }, file, env.line);
        }
    }
    for (const job of model.jobs) {
        const jid = jobId(job.id);
        const f = em.facts.find((x) => x.id === jid);
        if (!f || f.attrs['is_deploy'] !== true) continue;
        const text = jobText(job);
        for (const [repo, b] of built) {
            if (b.jobIds.includes(jid) || !text.includes(repo.replace(/<registry>/, ''))) continue;
            em.rel('consumes', jid, b.imageId, {}, file, job.line);
            if (job.environment) em.rel('delivers', b.imageId, `environment:${file}#${job.environment.name}`, { via: jid }, file, job.environment.line);
        }
    }
    if (model.system === 'gitlab') {
        const order = new Map(model.stages.map((s, i) => [s, i]));
        for (const job of model.jobs) {
            if (job.needs !== null) continue;
            const mine = order.get(job.stage ?? 'test') ?? 0;
            for (const other of model.jobs) {
                if ((order.get(other.stage ?? 'test') ?? 0) < mine) em.rel('needs', jobId(job.id), jobId(other.id), { implicit: true, mechanism: 'stage order' }, file, job.line);
            }
        }
        for (const inc of model.includes) {
            const iid = em.fact('workflow', `include:${file}#${inc.name}`, inc.name, { system: 'gitlab', include: true, include_kind: inc.kind }, file, inc.line);
            em.rel('includes', wfId, iid, {}, file, inc.line);
        }
        for (const job of model.jobs.filter((j) => j.changes.length > 0)) {
            const excluded = excludedOwnFiles(job.changes.map((c) => c.glob), [], [file, ...model.includes.filter((i) => i.kind === 'local').map((i) => i.name.replace(/^\//, ''))]);
            const tid = em.fact('trigger', `${file}#${job.id}:changes`, `${job.id} changes`, { event: 'changes', branches: [], paths: job.changes.map((c) => c.glob), paths_ignore: [], self_triggering: excluded.length === 0, excluded, context: wfId }, file, job.changes[0]!.line);
            em.rel('triggers', tid, jobId(job.id), {}, file, job.changes[0]!.line);
        }
    }
}

function emitUses(em: Emitter, file: string, job: PipelineJob, ref: string, line: number, jid: string, all: Read[], reusable: boolean): void {
    if (ref.startsWith('./')) {
        const target = ref.replace(/^\.\//, '');
        if (reusable || /\.ya?ml$/.test(target)) {
            const local = all.find((r) => r.file === target);
            em.rel('calls', jid, local ? `workflow:${local.file}` : `workflow:${target}`, { target_name: target }, file, line);
        } else {
            const aid = em.fact('action', `${file}#${job.id}:${ref}`, ref, { ref, local: true, pinned: true, docker: false, reusable_workflow: false, context: jid }, file, line);
            em.rel('uses', jid, aid, {}, file, line);
        }
        return;
    }
    const docker = ref.startsWith('docker://');
    let pinned: boolean;
    let version: string | null;
    if (docker) {
        const p = parseImageRef(ref.slice('docker://'.length));
        pinned = p.digest !== null;
        version = p.digest ?? p.tag;
    } else {
        version = ref.includes('@') ? ref.slice(ref.lastIndexOf('@') + 1) : null;
        pinned = version !== null && SHA.test(version);
    }
    const aid = em.fact(
        'action',
        `${file}#${job.id}:${ref}`,
        ref,
        { ref, owner_repo: docker ? null : ref.split('@')[0]!, version, local: false, pinned, docker, reusable_workflow: /\/\.github\/workflows\//.test(ref), context: jid },
        file,
        line,
    );
    em.rel('uses', jid, aid, {}, file, line);
}

export function readDelivery(root: string): LaneOutput {
    const em = new Emitter(root);
    const reads: Read[] = [];
    for (const file of walkFiles(root, (n, rel) => isGithubWorkflowPath(rel) || isGitlabCiName(n), { maxDepth: 3 }).map(posix)) {
        const text = em.read(file);
        if (text === null) continue;
        const model = parsePipeline(text, isGitlabCiName(path.posix.basename(file)) ? 'gitlab' : 'github');
        if (model.error) {
            em.skip(file, `yaml: ${model.error}`);
            continue;
        }
        reads.push({ file, model });
    }
    const byName = new Map<string, string>();
    for (const r of reads) if (r.model.name) byName.set(r.model.name, `workflow:${r.file}`);
    const protectedEnvs = protectedBySettings(em, root);
    for (const r of reads) emitPipeline(em, r, reads, protectedEnvs, byName);
    return redactOutput(em.output('delivery'));
}
