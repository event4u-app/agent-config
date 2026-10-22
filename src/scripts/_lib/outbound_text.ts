/**
 * outbound_text — the check every analysis-door body passes before it leaves
 * the machine through `gh` (a PR body, a PR comment), and the neutraliser for
 * model text that was derived from an untrusted PR or a dropped file.
 *
 * `outboundRefusals` never returns a byte of the body, only what fired: a
 * credential the egress rules detect, an absolute local path, an e-mail
 * address, or a source-confidentiality deny token. A non-empty list means the
 * body is not sent.
 */

import { detect } from './egress_rules.js';
import { loadDenyPatterns, redactSourceTokens } from './source_redact.js';

export class OutboundRefusedError extends Error {}

const LOCAL_PATH = /(?:^|[\s"'`(=:])(?:\/Users\/|\/home\/|\/root\/|[A-Za-z]:\\Users\\)[^\s"'`)]+/u;
const EMAIL = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/gu;
/** Documentation domains (RFC 2606) and GitHub's no-reply addresses identify nobody. */
const NEUTRAL_MAIL_DOMAIN = /^(?:example\.(?:com|org|net)|[a-z0-9.-]*\.example|users\.noreply\.github\.com)$/iu;

let denyCache: RegExp[] | null = null;

function denyPatterns(): RegExp[] {
    if (denyCache !== null) return denyCache;
    try {
        denyCache = loadDenyPatterns();
    } catch (err) {
        // The deny list ships with this package's source tree only; a consumer
        // install has no third-party source names of ours to protect. A list
        // that exists but does not load is a broken gate, not an absent one.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        denyCache = [];
    }
    return denyCache;
}

/** What makes `body` unpublishable; empty when it may be sent. Never echoes the matched text. */
export function outboundRefusals(body: string): string[] {
    const out: string[] = [];
    const rules = new Set(detect(body).filter((s) => s.class === 'credential').map((s) => s.rule));
    for (const rule of [...rules].sort()) out.push(`credential (${rule})`);
    if (LOCAL_PATH.test(body)) out.push('absolute local path');
    if ([...body.matchAll(EMAIL)].some((m) => !NEUTRAL_MAIL_DOMAIN.test(m[1] as string))) out.push('e-mail address');
    if (redactSourceTokens(body, denyPatterns()).count > 0) out.push('source-confidentiality deny token');
    return out;
}

/** Throws, naming only what fired, when `body` may not leave the machine. */
export function assertOutbound(body: string, what: string): void {
    const refused = outboundRefusals(body);
    if (refused.length > 0) throw new OutboundRefusedError(`${what} not sent: ${refused.join(', ')}`);
}

/**
 * Model text derived from untrusted input, made inert for a GitHub body: no
 * `@mention` notifies anyone, no link or image renders, no HTML is interpreted.
 * The text stays readable; a zero-width space breaks the mention and the
 * scheme is defanged.
 */
export function neutraliseForGithub(text: string): string {
    return text
        .replace(/&/gu, '&amp;')
        .replace(/</gu, '&lt;')
        .replace(/>/gu, '&gt;')
        .replace(/(^|[^\w`])@(?=[A-Za-z0-9])/gu, '$1@​')
        .replace(/!\[/gu, '!​[')
        .replace(/\]\(/gu, ']​(')
        .replace(/\b(https?|ftp|file|javascript|data):(\/\/)?/giu, (_m, scheme: string, slashes: string | undefined) =>
            `${scheme}[:]${slashes ?? ''}`,
        )
        .replace(/\bwww\./giu, 'www[.]');
}
