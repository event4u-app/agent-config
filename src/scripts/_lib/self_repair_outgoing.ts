/**
 * The exact bytes a release would send, rendered once for the person to read
 * and digested once for the release to check.
 *
 * The dry run and the release build this from the same inputs, so an approval
 * names the bytes that leave and where they go: the target repository, the
 * account, the route and its fallback rungs, the push remote and the base
 * commit; the branch name, the commit identity and message, the diff, the
 * title and the body of the pull request; and the title and body of the issue
 * the ladder degrades to. A change to any of them after the person read them
 * changes the digest, and the release refuses. The comparison is `self_repair_class_b`'s `approve` — the one
 * digest-bound approval in the tree — rather than a second one. The
 * ratification `subjectDigest` was the other candidate and is not used: it
 * digests the gated paths of a ratification subject at a revision, not an
 * arbitrary outgoing payload.
 *
 * The commit date is not part of the digest. It is the moment of the release,
 * stated in UTC so the local timezone offset does not leave with it.
 */
import { type DefectRecord, type EgressRoute } from './self_repair.js';
import { approve, caseDigest } from './self_repair_class_b.js';

/** A neutral branch: the fingerprint, never the author's branch name. */
export function retroBranch(fingerprint: string): string {
    return `retro/${fingerprint.slice(0, 8)}`;
}

/**
 * The body of the pull request and the issue, built from closed fields only:
 * the defect class, the intake source, the fingerprint, the occurrence count,
 * the resolved targets and the principle slug — all shape-validated, none of
 * them prose. The evidence span, the suggested surface, the mechanism and the
 * falsifier are free text whatever their field name, so they stay on the
 * machine (D10 of road-to-one-upstream-that-checks-what-leaves); `renderReport`
 * still carries them for the local and Class-B case. No dates either: when a
 * defect was seen is activity on the reporting machine, not part of the claim.
 */
export function renderUpstreamBody(record: DefectRecord, route: EgressRoute): string {
    const targets = record.target !== undefined && record.target.length > 0 ? record.target.map((t) => `\`${t}\``).join(', ') : 'none identified';
    const principle = record.principle !== undefined ? `\`${record.principle}\`` : 'not stated';
    return [
        `## Self-repair report — \`${record.defect_class}\``,
        '',
        `- **Source:** \`${record.source}\``,
        `- **Fingerprint:** \`${record.fingerprint}\``,
        `- **Occurrences:** ${record.occurrences}`,
        `- **Route:** ${route}`,
        `- **Targets:** ${targets}`,
        `- **Principle:** ${principle}`,
        '',
        '### Package fixture',
        '',
        `Reproduce against this package's own \`${record.defect_class}\` detector in`,
        '`src/scripts/_lib/self_repair.ts` and the targets named above.',
        '',
        '---',
        '',
        'Filed by the agent-config self-repair loop from closed fields only. The',
        'evidence span, the suggested surface, the mechanism and the falsifier stayed',
        'on the reporting machine; the person approved these exact bytes.',
    ].join('\n');
}

/** The structured fields the upstream intake form collects. */
export interface ParsedUpstreamBody {
    defect_class: string;
    source: string;
    fingerprint: string;
    occurrences: number;
    targets: string;
    principle: string;
}

/**
 * Inverse of {@link renderUpstreamBody} — the round-trip that pins the body to
 * the upstream issue form, so a released body and a hand-filed form carry the
 * same clustering keys. `targets` and `principle` come back as rendered.
 */
export function parseUpstreamBody(body: string): ParsedUpstreamBody | null {
    const field = (label: string): string | undefined => new RegExp(`^- \\*\\*${label}:\\*\\* (.+)$`, 'm').exec(body)?.[1];
    const unquote = (v: string): string => v.replace(/`/g, '');
    const cls = /^## Self-repair report — `([^`]+)`$/m.exec(body)?.[1];
    const [source, fp, occ, targets, principle] = ['Source', 'Fingerprint', 'Occurrences', 'Targets', 'Principle'].map(field);
    if (!cls || !source || !fp || !occ || !targets || !principle || !/^\d+$/.test(occ)) {
        return null;
    }
    return {
        defect_class: cls,
        source: unquote(source),
        fingerprint: unquote(fp),
        occurrences: Number(occ),
        targets: unquote(targets),
        principle: unquote(principle),
    };
}

export interface CommitIdentity {
    name: string;
    email: string;
}

const NOREPLY_DOMAIN = 'users.noreply.github.com';

/**
 * GitHub's noreply form for the account `gh` is signed in as. That account is
 * already visible on the pull request; the configured git identity, which is
 * often a company address, is not, and is never used.
 */
export function noreplyIdentity(login: string, id: string): CommitIdentity | null {
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(login) || !/^\d+$/.test(id)) {
        return null;
    }
    return { name: login, email: `${id}+${login}@${NOREPLY_DOMAIN}` };
}

export function isNoreplyEmail(email: string): boolean {
    return email.toLowerCase().endsWith(`@${NOREPLY_DOMAIN}`);
}

/** Built from the title and the fingerprint only — both closed, both in the digest. */
export function commitMessage(title: string, fingerprint: string): string {
    return `${title}\n\nSelf-repair fingerprint: ${fingerprint}\n`;
}

export interface OutgoingPullRequest {
    branch: string;
    identity: CommitIdentity;
    message: string;
    /** The author branch's net change against the base, as `git diff --binary` prints it. */
    patch: string;
    title: string;
    body: string;
}

export interface OutgoingIssue {
    title: string;
    body: string;
}

/** Where the bytes go — approved with them, because the same text sent elsewhere is another act. */
export interface Destination {
    /** `owner/name` the pull request or issue is opened against. */
    repo: string;
    /** The GitHub login the send carries, or null when it could not be resolved. */
    account: string | null;
    /** The planned route; `rungs` is the ladder it may degrade along. */
    route: 'pull-request' | 'issue' | 'local-only';
    rungs: Array<'upstream' | 'fork' | 'issue'>;
    /** The URL the first push rung pushes to; null on the issue route. */
    remote: string | null;
    /** The commit the pull request's one commit sits on; null on the issue route. */
    baseSha: string | null;
}

export interface Outgoing {
    destination: Destination | null;
    pullRequest: OutgoingPullRequest | null;
    issue: OutgoingIssue | null;
}

function section(label: string, text: string): string {
    // The byte count makes the concatenation unambiguous: no section's content
    // can be shifted into its neighbour without the digest changing.
    return `--- ${label} (${Buffer.byteLength(text, 'utf-8')} bytes) ---\n${text}\n`;
}

/** Every byte that may leave, in one deterministic text. */
export function renderOutgoing(o: Outgoing): string {
    let out = '';
    if (o.destination !== null) {
        const d = o.destination;
        out += '=== destination ===\n';
        out += section('repository', d.repo);
        out += section('account', d.account ?? '(unresolved)');
        out += section('route', `${d.route} (rungs: ${d.rungs.join(' -> ')})`);
        out += section('push remote', d.remote ?? '(none)');
        out += section('base commit', d.baseSha ?? '(none)');
    }
    if (o.pullRequest !== null) {
        const pr = o.pullRequest;
        out += '=== pull request ===\n';
        out += section('branch', pr.branch);
        out += section('author and committer', `${pr.identity.name} <${pr.identity.email}>`);
        out += section('commit message', pr.message);
        out += section('diff', pr.patch);
        out += section('title', pr.title);
        out += section('body', pr.body);
    }
    if (o.issue !== null) {
        out += o.pullRequest !== null ? '=== issue, if the pull request fails ===\n' : '=== issue ===\n';
        out += section('title', o.issue.title);
        out += section('body', o.issue.body);
    }
    return out;
}

/** The digest the person approves: SHA-256 of {@link renderOutgoing}. */
export function outgoingDigest(o: Outgoing): string {
    return caseDigest(renderOutgoing(o));
}

/** Null when the approval names exactly these bytes; otherwise the reason it does not. */
export function approvalRefusal(record: DefectRecord, o: Outgoing, approvedDigest: string | null | undefined): string | null {
    if (approvedDigest === null || approvedDigest === undefined || approvedDigest.trim() === '') {
        return 'no approval: run the dry run, read every byte, then release with --approve <digest>';
    }
    const verdict = approve(record, renderOutgoing(o), approvedDigest.trim());
    return verdict.ok ? null : verdict.reason;
}
