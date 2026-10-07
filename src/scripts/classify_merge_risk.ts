#!/usr/bin/env tsx
/**
 * classify_merge_risk — ADR-282's danger gate in front of an authorized
 * auto-merge.
 *
 * Says `routine` or `needs-council` for a diff, plus the triggers that fired.
 * `routine` merges on the owner's auto-merge instruction with no review;
 * `needs-council` sends the diff to the AI council first. The classifier is
 * advisory to that flow and grants nothing on its own.
 *
 * Every trigger is lifted from a rule that already exists, never invented here:
 *
 *   - `non-destructive-by-default` Hard-Floor rows: bulk deletion (a removed
 *     directory, or DELETION_THRESHOLD deleted files), infrastructure config,
 *     production data and migrations, deploy and release paths.
 *   - `security-sensitive-stop` surfaces: auth, authz, tenancy, billing,
 *     secrets, uploads, webhooks, route files (public endpoints).
 *   - The ratification surfaces, read through `check_kernel_edit_ratified`'s own
 *     `classifyPaths` — a second list would drift from the first.
 *   - Any CI workflow: `process-full` makes a disabled required check the thing
 *     delivery-ready must refuse, and a green rollup on a weakened workflow is
 *     exactly what a no-review merge would trust.
 *   - Its own surface — this file and the two commands that call it — for the
 *     reason the ratification gate watches itself: a routine-class PR must not
 *     be able to loosen the gate that classed it.
 *
 * Prose files (`.md`, `.mdx`, `.txt`, `.rst`) are exempt from the security,
 * infra and migration token checks: a skill ABOUT secrets is not a secret
 * surface. They stay subject to deletion, governance and self-surface checks.
 *
 * Fails closed: a diff that cannot be read is `needs-council`, never `routine`,
 * and never an internal-error exit a caller might read as "nothing found".
 *
 * Inputs (one of):
 *   <pr-number>           PR mode: base and head read via `gh`, head fetched
 *   --range BASE..HEAD    range mode (`...` also accepted)
 * Options:
 *   --root DIR            repository to read (default: cwd)
 *   --json                one JSON object instead of text
 *
 * Exit codes: 0 = routine · 1 = needs-council (including fail-closed).
 * The LAST output line is the verdict.
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { classifyPaths, requiresRatification } from './check_kernel_edit_ratified.js';

export const DELETION_THRESHOLD = 5;

export interface ChangeEntry {
    status: string;
    path: string;
    oldPath?: string;
}

export interface Trigger {
    id: string;
    rule: string;
    paths: string[];
}

export interface Classification {
    verdict: 'routine' | 'needs-council';
    triggers: Trigger[];
}

export interface ClassifyOptions {
    /** Does `dir` still exist in the head tree? Decides a removed directory. */
    dirExistsInHead: (dir: string) => boolean;
}

const PROSE_EXT = new Set(['.md', '.mdx', '.txt', '.rst']);

const SECURITY_TOKENS = new Set([
    'auth', 'authn', 'authz', 'authenticate', 'authentication', 'authorization', 'authorize',
    'login', 'logout', 'oauth', 'sso', 'saml', 'mfa', '2fa', 'password', 'passwords', 'passwd', 'jwt',
    'permission', 'permissions', 'rbac', 'acl', 'policy', 'policies',
    'tenant', 'tenants', 'tenancy', 'multitenancy',
    'billing', 'payment', 'payments', 'invoice', 'invoices', 'subscription', 'subscriptions',
    'refund', 'refunds', 'charge', 'charges',
    'secret', 'secrets', 'credential', 'credentials', 'vault', 'kms', 'env',
    'upload', 'uploads', 'webhook', 'webhooks', 'routes',
]);

const INFRA_SEGMENTS = new Set([
    'terraform', 'terragrunt', 'pulumi', 'k8s', 'kubernetes', 'helm', 'charts', 'ansible',
    'cloudformation', 'cdk', 'infra', 'infrastructure',
]);
const INFRA_EXT = new Set(['.tf', '.tfvars', '.hcl']);
const INFRA_BASENAME_RE = /^(?:Pulumi(?:\.[\w-]+)?\.ya?ml|Chart\.ya?ml|kustomization\.ya?ml|serverless\.ya?ml)$/;

const PROD_TOKENS = new Set(['prod', 'production']);
const MIGRATION_SEGMENTS = new Set(['migrations', 'migration', 'migrate']);
const DEPLOY_TOKENS = new Set(['deploy', 'deployment', 'deployments', 'release', 'releases', 'publish']);

const SELF_SURFACE_RE =
    /(?:^|\/)(?:scripts\/classify_merge_risk\.ts|domains\/git\/pr\/merge\/command\.md|domains\/product-basic\/roadmap\/process-full\/command\.md)$|^docs\/decisions\/ADR-282-[^/]+\.md$/;

/** Lower-cased word tokens of a path: split on separators and camelCase. */
function tokens(p: string): string[] {
    return p
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/[\/._\-\s]+/)
        .filter((t) => t !== '');
}

function segments(p: string): string[] {
    return p.toLowerCase().split('/');
}

function isProse(p: string): boolean {
    return PROSE_EXT.has(path.posix.extname(p).toLowerCase());
}

function isSecurity(p: string): boolean {
    if (isProse(p)) {
        return false;
    }
    const base = path.posix.basename(p);
    if (base === '.env' || base.startsWith('.env.')) {
        return true;
    }
    return tokens(p).some((t) => SECURITY_TOKENS.has(t));
}

function isInfra(p: string): boolean {
    if (INFRA_EXT.has(path.posix.extname(p).toLowerCase()) || INFRA_BASENAME_RE.test(path.posix.basename(p))) {
        return true;
    }
    return !isProse(p) && segments(p).slice(0, -1).some((s) => INFRA_SEGMENTS.has(s));
}

function isProdOrMigration(p: string): boolean {
    if (path.posix.extname(p).toLowerCase() === '.sql') {
        return true;
    }
    if (isProse(p)) {
        return false;
    }
    return segments(p).some((s) => MIGRATION_SEGMENTS.has(s)) || tokens(p).some((t) => PROD_TOKENS.has(t));
}

function isDeployOrRelease(p: string): boolean {
    return !isProse(p) && tokens(p).some((t) => DEPLOY_TOKENS.has(t));
}

function isWorkflow(p: string): boolean {
    return p.startsWith('.github/workflows/');
}

/** Every path a change touches — both sides of a rename or copy. */
function touched(entries: readonly ChangeEntry[]): string[] {
    const out = new Set<string>();
    for (const e of entries) {
        out.add(e.path);
        if (e.oldPath !== undefined) {
            out.add(e.oldPath);
        }
    }
    return [...out];
}

export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyOptions): Classification {
    const triggers: Trigger[] = [];
    const add = (id: string, rule: string, paths: string[]): void => {
        if (paths.length > 0) {
            triggers.push({ id, rule, paths: [...paths].sort() });
        }
    };
    const all = touched(entries);
    const deleted = entries.filter((e) => e.status === 'D').map((e) => e.path);

    if (deleted.length >= DELETION_THRESHOLD) {
        add('bulk-deletion', `non-destructive-by-default — ${deleted.length} deleted files (≥ ${DELETION_THRESHOLD})`, deleted);
    }
    const goneDirs = [...new Set(deleted.map((p) => path.posix.dirname(p)).filter((d) => d !== '.'))].filter(
        (d) => !opts.dirExistsInHead(d),
    );
    add(
        'removed-directory',
        'non-destructive-by-default — a directory no longer exists in the head',
        deleted.filter((p) => goneDirs.includes(path.posix.dirname(p))),
    );
    add('infra-config', 'non-destructive-by-default — Terraform / Pulumi / k8s / Ansible / cloud config', all.filter(isInfra));
    add('prod-data-or-migration', 'non-destructive-by-default — production data or a migration', all.filter(isProdOrMigration));
    add('deploy-or-release', 'non-destructive-by-default — deploy or release path', all.filter(isDeployOrRelease));
    add('ci-workflow', 'process-full — a disabled required check cannot reach delivery-ready', all.filter(isWorkflow));
    add('security-surface', 'security-sensitive-stop — auth, authz, tenancy, billing, secrets, uploads, webhooks, routes', all.filter(isSecurity));

    const gated = classifyPaths(all);
    if (requiresRatification(gated)) {
        const gatedPaths = [...gated.kernelRules, ...gated.governanceHooks, ...gated.plumbing];
        add(
            'governance-surface',
            'check_kernel_edit_ratified — kernel rule, governance hook, hook plumbing or the ratification mechanism',
            gatedPaths.length > 0 ? gatedPaths : all.filter((p) => classifyPaths([p]).self),
        );
    }
    add('merge-authority-surface', 'ADR-282 — the danger gate and the commands that call it', all.filter((p) => SELF_SURFACE_RE.test(p)));

    return { verdict: triggers.length > 0 ? 'needs-council' : 'routine', triggers };
}

/** Parse `git diff --name-status` output. Throws on a line it cannot read. */
export function parseNameStatus(text: string): ChangeEntry[] {
    const out: ChangeEntry[] = [];
    for (const line of text.split('\n')) {
        if (line.trim() === '') {
            continue;
        }
        const parts = line.split('\t');
        const status = (parts[0] ?? '').charAt(0);
        if (parts.length < 2 || !/^[AMDRCTU]$/.test(status)) {
            throw new Error(`unreadable name-status line: ${JSON.stringify(line)}`);
        }
        if ((status === 'R' || status === 'C') && parts.length >= 3) {
            out.push({ status, oldPath: parts[1] ?? '', path: parts[2] ?? '' });
        } else {
            out.push({ status, path: parts[1] ?? '' });
        }
    }
    return out;
}

function git(root: string, args: string[]): { ok: boolean; out: string } {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return { ok: r.status === 0, out: r.stdout ?? '' };
}

interface Resolved {
    base: string;
    head: string;
}

function resolvePr(root: string, pr: string): Resolved | null {
    const v = spawnSync('gh', ['pr', 'view', pr, '--json', 'baseRefName,headRefOid'], { cwd: root, encoding: 'utf8' });
    if (v.status !== 0) {
        return null;
    }
    const meta = JSON.parse(v.stdout) as { baseRefName?: string; headRefOid?: string };
    if (meta.baseRefName === undefined || meta.headRefOid === undefined) {
        return null;
    }
    git(root, ['fetch', '-q', 'origin', meta.baseRefName, `pull/${pr}/head`]);
    return { base: `origin/${meta.baseRefName}`, head: meta.headRefOid };
}

function resolveRange(range: string): Resolved | null {
    const m = /^(.+?)\.\.\.?(.+)$/.exec(range);
    return m === null ? null : { base: m[1] ?? '', head: m[2] ?? '' };
}

function failClosed(reason: string): Classification {
    return { verdict: 'needs-council', triggers: [{ id: 'diff-unreadable', rule: 'fail closed — ADR-282', paths: [reason] }] };
}

export function classifyTarget(root: string, target: { pr?: string | undefined; range?: string | undefined }): Classification {
    const resolved = target.pr !== undefined ? resolvePr(root, target.pr) : resolveRange(target.range ?? '');
    if (resolved === null) {
        return failClosed('could not resolve base and head');
    }
    const diff = git(root, ['diff', '--name-status', '-M', `${resolved.base}...${resolved.head}`]);
    if (!diff.ok) {
        return failClosed(`git diff ${resolved.base}...${resolved.head} failed`);
    }
    let entries: ChangeEntry[];
    try {
        entries = parseNameStatus(diff.out);
    } catch (e) {
        return failClosed((e as Error).message);
    }
    return classifyChanges(entries, {
        dirExistsInHead: (dir) => git(root, ['cat-file', '-e', `${resolved.head}:${dir}`]).ok,
    });
}

export function main(argv: readonly string[] = process.argv.slice(2), write: (l: string) => void = (l) => process.stdout.write(`${l}\n`)): number {
    let root = process.cwd();
    let range: string | undefined;
    let pr: string | undefined;
    let json = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] ?? '';
        if (a === '--root') {
            root = argv[++i] ?? root;
        } else if (a === '--range') {
            range = argv[++i];
        } else if (a === '--json') {
            json = true;
        } else if (/^\d+$/.test(a)) {
            pr = a;
        }
    }
    const result =
        pr === undefined && range === undefined ? failClosed('no PR number and no --range given') : classifyTarget(root, { pr, range });
    if (json) {
        write(JSON.stringify(result));
    } else {
        for (const t of result.triggers) {
            write(`trigger ${t.id} — ${t.rule}`);
            for (const p of t.paths) {
                write(`  ${p}`);
            }
        }
        write(
            result.verdict === 'routine'
                ? 'verdict: routine'
                : `verdict: needs-council (${result.triggers.length} trigger(s): ${result.triggers.map((t) => t.id).join(', ')})`,
        );
    }
    return result.verdict === 'routine' ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(main());
}
