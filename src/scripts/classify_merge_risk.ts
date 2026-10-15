#!/usr/bin/env tsx
/**
 * classify_merge_risk — ADR-282's danger gate in front of an authorized
 * auto-merge.
 *
 * Says `routine`, `needs-council` or `needs-owner` for a diff, plus the
 * triggers that fired. `routine` merges on the owner's auto-merge instruction
 * with no review; `needs-council` sends the diff to the AI council first;
 * `needs-owner` is never sent for clearance and goes to the owner. The
 * classifier is advisory to that flow and grants nothing on its own.
 *
 * WHY A THIRD VERDICT. ADR-281 § Amendment makes a favourable council verdict on
 * the gated surface advisory until an authenticated owner authorisation is bound
 * to the same digest, and reserves the reviewer's trust chain to the owner. An
 * auto-merge sentence is neither authenticated nor bound to a digest, so a
 * council clearance of those paths would merge on something the record says
 * cannot authorise it. OWNER_TRIGGERS names which triggers that is.
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
 *   - Governance read from lists that already exist: an ADR whose frontmatter
 *     at base or head declares `reopen_policy: owner`, and a rule whose id is a
 *     member of `src/config/rule-consequence-class.json`.
 *   - The reviewer and the carriers of the merge rule, each named with the
 *     record that makes it one (ADR-281 `:101-106`, ADR-282).
 *
 * Prose files (`.md`, `.mdx`, `.txt`, `.rst`) are exempt from the security,
 * infra and migration token checks: a skill ABOUT secrets is not a secret
 * surface. They stay subject to deletion, governance and self-surface checks.
 *
 * Fails closed: a diff that cannot be read is `needs-council`, never `routine`,
 * and never an internal-error exit a caller might read as "nothing found". A
 * decision record whose frontmatter cannot be read fires its trigger, and an
 * unreadable consequence-class list makes every rule file a member.
 *
 * Inputs (one of):
 *   <pr-number>           PR mode: base and head read via `gh`, head fetched
 *   --range BASE..HEAD    range mode (`...` also accepted)
 * Options:
 *   --root DIR            repository to read (default: cwd)
 *   --json                one JSON object instead of text
 *
 * Exit codes: 0 = routine · 1 = needs-council (including fail-closed) · 2 = needs-owner.
 * The LAST output line is the verdict.
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CLASS_CONFIG_REL, readConsequenceClass } from './_lib/rule_consequence_class.js';
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

export type Verdict = 'routine' | 'needs-council' | 'needs-owner';

export interface Classification {
    verdict: Verdict;
    triggers: Trigger[];
}

/** What an ADR's frontmatter says about who may reopen it, across base and head. */
export type DecisionPolicy = 'owner' | 'other' | 'unreadable';

export interface ClassifyOptions {
    /** Does `dir` still exist in the head tree? Decides a removed directory. */
    dirExistsInHead: (dir: string) => boolean;
    /** Reopen policy of a decision record. Absent → every record reads `unreadable`. */
    decisionPolicy?: (p: string) => DecisionPolicy;
    /**
     * Rule ids of the consequence class. Absent → this checkout's list; `null`
     * → the list could not be read, so every rule file counts as a member.
     */
    consequenceMembers?: ReadonlySet<string> | null;
}

/**
 * Triggers that hand a PR to the owner instead of the council. An ADR with
 * `reopen_policy: owner` is among them because that field reserves its reopening
 * to the owner: a council clearing an edit to it would be the council reopening it.
 */
export const OWNER_TRIGGERS: ReadonlySet<string> = new Set([
    'governance-surface',
    'merge-authority-surface',
    'reviewer-trust-chain',
    'council-surface',
    'ratification-contract',
    'owner-reserved-decision',
]);

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

/** The record § 9a's council prompt cites for its dangerous-action predicates. */
const PREDICATE_RECORD = 'agents/evidence/council/authority-routing-20261007.md';

const RATIFICATION_CONTRACT = 'docs/contracts/ratification-artifact.md';

/**
 * The reviewer's trust chain beyond the gate's own files: what the classifier
 * imports, the list it reads, the subject binding the ratification review signs,
 * and the predicates the council is asked about.
 */
const TRUST_CHAIN_PATHS: ReadonlySet<string> = new Set([
    'src/scripts/_lib/rule_consequence_class.ts',
    CLASS_CONFIG_REL,
    'src/scripts/_lib/ratification_subject.ts',
    PREDICATE_RECORD,
]);

const COUNCIL_SURFACE_RE =
    /^src\/scripts\/ai_council\/|^src\/scripts\/(?:_lib\/)?council_[^/]+\.ts$|(?:^|\/)skills\/ai-council\/|(?:^|\/)rules\/(?:council-availability|evaluator-independence)\.md$/;

const MERGE_RULE_CARRIER_RE =
    /(?:^|\/)contexts\/execution\/(?:roadmap-execution-contract|roadmap-process-loop)\.md$|^src\/scripts\/refusal_envelope\.ts$/;

const CONSUMER_TEMPLATE_RE = /(?:^|\/)agent-src\/templates\/AGENTS\.md$/;

const DECISION_RECORD_RE = /^docs\/decisions\/ADR-[^/]+\.md$/;
// Any-prefix like the ratification gate's own rule pattern: every projection
// root (`dist/agent-src/`, `.claude/`, `.augment/`, …) must match, and a fixture
// that also matches errs toward a review, never toward `routine`.
const RULE_FILE_RE = /(?:^|\/)rules\/([a-z0-9-]+)\.md$/;

/** The two `reopen_policy` values that do not reserve a record to the owner. */
const NON_OWNER_POLICIES: ReadonlySet<string> = new Set(['directional', 'unclassified']);

/** A scalar value as YAML would print it plainly: comment, quotes and case removed. */
function plainScalar(raw: string): string {
    return raw
        .replace(/\s+#.*$/u, '')
        .trim()
        .replace(/^(["'])(.*)\1$/u, '$2')
        .trim()
        .toLowerCase();
}

/**
 * The reopen policy one side of an ADR declares: `'absent'` when the field is
 * missing, `null` when there is no readable frontmatter.
 *
 * Read by hand, not through a YAML library: the base copy runs from a detached
 * worktree with no `node_modules` of its own, so it may import only `node:`
 * built-ins. So the reader accepts one subset — top-level lines `key: value`
 * with an unquoted key, and indented or `- ` lines beneath them — and reads
 * `'owner'` for anything outside it, because outside it YAML could say `owner`
 * where this parser cannot see it: a flow mapping, an explicit `?` key, a quoted
 * or escaped key, a merge key, or the word `reopen_policy` anywhere the subset
 * did not read it. Inside the subset every occurrence counts (a duplicate cannot
 * hide an `owner`), and any value other than the two non-owner policies — empty,
 * a block scalar, a tag, an alias, a typo — reads as `'owner'` too.
 */
export function reopenPolicyOf(text: string): string | null {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    if (fm === null) {
        return null;
    }
    const body = fm[1] ?? '';
    const values: string[] = [];
    let outsideSubset = /<<\s*:/u.test(body);
    for (const line of body.split(/\r?\n/u)) {
        if (line.trim() === '' || /^\s*#/u.test(line)) {
            continue;
        }
        if (/^\s/u.test(line) || line.startsWith('- ')) {
            const child = /^\s*(?:-\s+)?reopen_policy\s*:(.*)$/iu.exec(line);
            if (child !== null) {
                values.push(plainScalar(child[1] ?? ''));
            }
            continue;
        }
        const top = /^([A-Za-z0-9_-]+)\s*:(.*)$/u.exec(line);
        if (top === null) {
            outsideSubset = true;
        } else if ((top[1] ?? '').toLowerCase() === 'reopen_policy') {
            values.push(plainScalar(top[2] ?? ''));
        }
    }
    if (outsideSubset || (values.length === 0 && /reopen_policy/iu.test(body))) {
        return 'owner';
    }
    if (values.length === 0) {
        return 'absent';
    }
    return values.every((v) => NON_OWNER_POLICIES.has(v)) ? (values[0] ?? 'absent') : 'owner';
}

/**
 * Combine the two sides of an ADR. `undefined` is a side where the file does not
 * exist and is skipped; `null` is a side that exists but could not be read, and
 * fires — a failed read is never taken for a non-owner policy.
 */
export function combinePolicy(sides: readonly (string | null | undefined)[]): DecisionPolicy {
    let seen = false;
    for (const side of sides) {
        if (side === undefined) {
            continue;
        }
        seen = true;
        const policy = side === null ? null : reopenPolicyOf(side);
        if (policy === null) {
            return 'unreadable';
        }
        if (policy === 'owner') {
            return 'owner';
        }
    }
    return seen ? 'other' : 'unreadable';
}

/** Member ids of the consequence-class JSON text; `null` when it does not parse. */
export function consequenceMembersOf(text: string): Set<string> | null {
    try {
        const raw = JSON.parse(text) as { members?: unknown };
        return raw.members !== null && typeof raw.members === 'object' && !Array.isArray(raw.members)
            ? new Set(Object.keys(raw.members))
            : null;
    } catch {
        return null;
    }
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function localConsequenceMembers(): Set<string> | null {
    try {
        return new Set(Object.keys(readConsequenceClass(REPO_ROOT).members));
    } catch {
        return null;
    }
}

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
    add(
        'reviewer-trust-chain',
        "ADR-281 :101-106 — the reviewer's trust chain: the gate's imports and list, the subject binding, the council's predicates",
        all.filter((p) => TRUST_CHAIN_PATHS.has(p)),
    );
    add('ratification-contract', 'ADR-281 — the ratification contract', all.filter((p) => p === RATIFICATION_CONTRACT));
    add(
        'council-surface',
        'ADR-281 :101-106 — the council that reviews: ai_council, council modules, the ai-council skill, council-availability, evaluator-independence',
        all.filter((p) => COUNCIL_SURFACE_RE.test(p)),
    );

    const policyOf = opts.decisionPolicy ?? ((): DecisionPolicy => 'unreadable');
    add(
        'owner-reserved-decision',
        'decision-revisit-gate — an ADR declaring reopen_policy: owner at base or head, or with unreadable frontmatter',
        all.filter((p) => DECISION_RECORD_RE.test(p) && policyOf(p) !== 'other'),
    );
    const members = opts.consequenceMembers === undefined ? localConsequenceMembers() : opts.consequenceMembers;
    add(
        'consequence-class-rule',
        'rule-consequence-class.json — a rule in the high-consequence class; an unreadable list counts every rule',
        all.filter((p) => {
            const m = RULE_FILE_RE.exec(p);
            return m !== null && (members === null || members.has(m[1] ?? ''));
        }),
    );
    add(
        'merge-rule-carrier',
        'ADR-282 — a carrier of the merge rule: the two execution contexts, the refusal envelope, the predicate record',
        all.filter((p) => MERGE_RULE_CARRIER_RE.test(p) || p === PREDICATE_RECORD),
    );
    add('consumer-template', 'ADR-281 — the consumer AGENTS.md template', all.filter((p) => CONSUMER_TEMPLATE_RE.test(p)));

    return { verdict: verdictOf(triggers), triggers };
}

/** `needs-owner` above `needs-council` above `routine`. */
export function verdictOf(triggers: readonly Trigger[]): Verdict {
    if (triggers.some((t) => OWNER_TRIGGERS.has(t.id))) {
        return 'needs-owner';
    }
    return triggers.length > 0 ? 'needs-council' : 'routine';
}

/**
 * Parse `git diff --name-status` output, NUL-separated or tab-separated.
 *
 * The NUL form is what this file asks git for, and the reason is a fail-OPEN
 * defect rather than tidiness. Without `-z`, git applies `core.quotePath` and
 * prints a path with a non-ASCII byte as a C-quoted string —
 * `".github/workflows/ci-\303\266.yml"`, leading double quote included. Every
 * trigger regex here anchors at the start of the path, so the quote character
 * shifted the whole path out of every pattern and a range adding ONLY a CI
 * workflow classified `routine`. An attacker-shaped path is not needed: one
 * umlaut in a filename was enough, and the verdict it produced was the
 * permissive one.
 *
 * The tab form is still accepted, because a caller that already holds
 * non-`-z` output should not get a silent misparse. The discriminator is
 * sound in both directions: non-`-z` output never contains a NUL byte, and
 * `-z` output never quotes, so a path carrying a literal tab is read correctly
 * exactly when it arrives NUL-separated.
 *
 * Throws on a record it cannot read — a skipped record is a path the
 * classifier did not see, which is the same fail-open shape again.
 */
export function parseNameStatus(text: string): ChangeEntry[] {
    return text.includes('\0') ? parseNulRecords(text) : parseTabLines(text);
}

const STATUS_FIELD_RE = /^[AMDRCTU][0-9]*$/u;

function parseNulRecords(text: string): ChangeEntry[] {
    const fields = text.split('\0');
    while (fields.length > 0 && fields[fields.length - 1] === '') {
        fields.pop();
    }
    const out: ChangeEntry[] = [];
    let i = 0;
    while (i < fields.length) {
        const field = fields[i] ?? '';
        i += 1;
        if (!STATUS_FIELD_RE.test(field)) {
            throw new Error(`unreadable name-status record: ${JSON.stringify(field)}`);
        }
        const status = field.charAt(0);
        const want = status === 'R' || status === 'C' ? 2 : 1;
        if (i + want > fields.length) {
            throw new Error(`name-status record ${JSON.stringify(field)} is missing ${String(want)} path field(s)`);
        }
        const first = fields[i] ?? '';
        if (first === '') {
            throw new Error(`name-status record ${JSON.stringify(field)} carries an empty path`);
        }
        if (want === 2) {
            const second = fields[i + 1] ?? '';
            if (second === '') {
                throw new Error(`name-status record ${JSON.stringify(field)} carries an empty path`);
            }
            out.push({ status, oldPath: first, path: second });
        } else {
            out.push({ status, path: first });
        }
        i += want;
    }
    return out;
}

function parseTabLines(text: string): ChangeEntry[] {
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

/** The two external commands `resolvePr` runs, injectable so a test can fail one. */
export interface ResolveDeps {
    gh: (root: string, args: string[]) => { ok: boolean; out: string };
    git: (root: string, args: string[]) => { ok: boolean; out: string };
}

const REAL_DEPS: ResolveDeps = {
    gh: (root, args) => {
        const r = spawnSync('gh', args, { cwd: root, encoding: 'utf8' });
        return { ok: r.status === 0, out: r.stdout ?? '' };
    },
    git,
};

/**
 * Resolve a PR number to the base and head this classifier diffs.
 *
 * The fetch result is READ. It used to be discarded, and discarding it is a
 * fail-open path with no error anywhere: an offline runner, a revoked token or
 * a deleted base branch leaves `origin/<base>` at whatever the local clone last
 * saw, the diff then succeeds against that stale ref, and the verdict is
 * computed over a range nobody asked for — reported as a verdict rather than as
 * a failure. A failed fetch now returns null, which `classifyTarget` turns into
 * `needs-council` with the `diff-unreadable` trigger.
 */
export function resolvePr(root: string, pr: string, deps: ResolveDeps = REAL_DEPS): Resolved | null {
    const v = deps.gh(root, ['pr', 'view', pr, '--json', 'baseRefName,headRefOid']);
    if (!v.ok) {
        return null;
    }
    let meta: { baseRefName?: string; headRefOid?: string };
    try {
        meta = JSON.parse(v.out) as { baseRefName?: string; headRefOid?: string };
    } catch {
        return null;
    }
    if (meta.baseRefName === undefined || meta.headRefOid === undefined) {
        return null;
    }
    const fetched = deps.git(root, ['fetch', '-q', 'origin', meta.baseRefName, `pull/${pr}/head`]);
    if (!fetched.ok) {
        return null;
    }
    return { base: `origin/${meta.baseRefName}`, head: meta.headRefOid };
}

function resolveRange(range: string): Resolved | null {
    const m = /^(.+?)\.\.\.?(.+)$/.exec(range);
    return m === null ? null : { base: m[1] ?? '', head: m[2] ?? '' };
}

function failClosed(reason: string): Classification {
    return { verdict: 'needs-council', triggers: [{ id: 'diff-unreadable', rule: 'fail closed — ADR-282', paths: [reason] }] };
}

/**
 * One file at one revision: its text, `undefined` when the revision has no such
 * path, `null` when the read failed. `ls-tree` tells absence (exit 0, no output)
 * from a failed read (non-zero), which `cat-file -e` does not — and a failed
 * read taken for absence would skip the side that carries an `owner`.
 */
export function readSide(
    run: (args: string[]) => { ok: boolean; out: string },
    rev: string,
    p: string,
): string | null | undefined {
    const listed = run(['ls-tree', rev, '--', p]);
    if (!listed.ok) {
        return null;
    }
    if (listed.out.trim() === '') {
        return undefined;
    }
    const shown = run(['show', `${rev}:${p}`]);
    return shown.ok ? shown.out : null;
}

/**
 * The consequence class across both sides: the union, so a head can add a
 * member but never remove one. A side that exists and does not read, or no side
 * at all, is `null` — every rule file then counts.
 */
export function unionMembers(sides: readonly (string | null | undefined)[]): Set<string> | null {
    const out = new Set<string>();
    let seen = false;
    for (const side of sides) {
        if (side === undefined) {
            continue;
        }
        const read = side === null ? null : consequenceMembersOf(side);
        if (read === null) {
            return null;
        }
        seen = true;
        for (const id of read) {
            out.add(id);
        }
    }
    return seen ? out : null;
}

export function classifyTarget(root: string, target: { pr?: string | undefined; range?: string | undefined }): Classification {
    const resolved = target.pr !== undefined ? resolvePr(root, target.pr) : resolveRange(target.range ?? '');
    if (resolved === null) {
        return failClosed('could not resolve base and head');
    }
    const diff = git(root, ['diff', '--name-status', '-M', '-z', `${resolved.base}...${resolved.head}`]);
    if (!diff.ok) {
        return failClosed(`git diff ${resolved.base}...${resolved.head} failed`);
    }
    let entries: ChangeEntry[];
    try {
        entries = parseNameStatus(diff.out);
    } catch (e) {
        return failClosed((e as Error).message);
    }
    const exists = (rev: string, p: string): boolean => git(root, ['cat-file', '-e', `${rev}:${p}`]).ok;
    const side = (rev: string, p: string): string | null | undefined => readSide((args) => git(root, args), rev, p);
    return classifyChanges(entries, {
        dirExistsInHead: (dir) => exists(resolved.head, dir),
        decisionPolicy: (p) => combinePolicy([side(resolved.base, p), side(resolved.head, p)]),
        consequenceMembers: unionMembers([side(resolved.base, CLASS_CONFIG_REL), side(resolved.head, CLASS_CONFIG_REL)]),
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
                : `verdict: ${result.verdict} (${result.triggers.length} trigger(s): ${result.triggers.map((t) => t.id).join(', ')})`,
        );
    }
    return result.verdict === 'routine' ? 0 : result.verdict === 'needs-council' ? 1 : 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(main());
}
