/**
 * The exact bytes a release would send, rendered once for the person to read
 * and digested once for the release to check.
 *
 * The dry run and the release build this from the same inputs, so an approval
 * names the bytes that leave and nothing else: the branch name, the commit
 * identity and message, the diff, the title and the body of the pull request,
 * and the title and body of the issue the ladder degrades to. A change to any
 * of them after the person read them changes the digest, and the release
 * refuses. The comparison is `self_repair_class_b`'s `approve` — the one
 * digest-bound approval in the tree — rather than a second one. The
 * ratification `subjectDigest` was the other candidate and is not used: it
 * digests the gated paths of a ratification subject at a revision, not an
 * arbitrary outgoing payload.
 *
 * The commit date is not part of the digest. It is the moment of the release,
 * stated in UTC so the local timezone offset does not leave with it.
 */
import { type DefectRecord } from './self_repair.js';
import { approve, caseDigest } from './self_repair_class_b.js';

/** A neutral branch: the fingerprint, never the author's branch name. */
export function retroBranch(fingerprint: string): string {
    return `retro/${fingerprint.slice(0, 8)}`;
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

export interface Outgoing {
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
