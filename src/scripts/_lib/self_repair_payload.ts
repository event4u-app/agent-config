/**
 * The release's floor over the WHOLE outgoing payload — branch name, commit
 * identities and messages, every commit's patch, title and body — where
 * `egressBlockedReason` reads only the record's own text.
 *
 * Credentials come from the one detector table (`egress_rules`); no pattern is
 * defined here. Identifiers are the consumer project's own, passed in as a deny
 * list. A finding refuses and is named by WHERE it was found and which rule
 * fired — never by the value, because the refusal is printed and stored.
 */
import { detect } from './egress_rules.js';

export type PayloadPart = 'branch' | 'commit' | 'diff' | 'title' | 'body';

export interface ReleasePayload {
    branch: string;
    /** Author and committer identities plus every message, as one text. */
    commits: string;
    /** Every commit's patch, so content added and later removed is still read. */
    patches: string;
    title: string;
    body: string;
}

export interface PayloadFinding {
    part: PayloadPart;
    rule: string;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The consumer's identifiers minus every token of the target repository: a
 * fix to this package names this package, and refusing on that would refuse
 * every release made from the package's own checkout.
 */
export function consumerDenyList(identifiers: Iterable<string>, targetRepo: string): string[] {
    const own = new Set<string>();
    for (const part of targetRepo.toLowerCase().split('/')) {
        own.add(part);
        for (const sub of part.split('-')) {
            own.add(sub);
        }
    }
    return [...new Set([...identifiers].map((i) => i.trim()).filter((i) => i.length > 0))]
        .filter((i) => !own.has(i.toLowerCase()))
        .sort();
}

export function scanPayload(payload: ReleasePayload, deny: readonly string[]): PayloadFinding[] {
    const denyRes = deny.map((ident) => ({
        rule: 'consumer-identifier',
        re: new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(ident)}(?![A-Za-z0-9])`, 'i'),
    }));
    const findings: PayloadFinding[] = [];
    const parts: Array<[PayloadPart, string]> = [
        ['branch', payload.branch],
        ['commit', payload.commits],
        ['diff', payload.patches],
        ['title', payload.title],
        ['body', payload.body],
    ];
    for (const [part, text] of parts) {
        const rules = new Set<string>();
        for (const span of detect(text)) {
            rules.add(span.rule);
        }
        for (const d of denyRes) {
            if (d.re.test(text)) {
                rules.add(d.rule);
            }
        }
        for (const rule of [...rules].sort()) {
            findings.push({ part, rule });
        }
    }
    return findings;
}

export function describeFindings(findings: readonly PayloadFinding[]): string {
    const named = findings.map((f) => `${f.rule} in ${f.part}`).join(', ');
    return `payload floor refused the pull request (${named}) — nothing was pushed`;
}
