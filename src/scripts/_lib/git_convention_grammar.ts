/**
 * The ticket grammar, the commit-subject grammars and the branch renderer.
 *
 * These were restated as regexes across several commands and checked by a model
 * reading them, which let a ticket inside a compound scope pass and left an
 * approved measured family with no validator at all. Pure: no I/O, so the CLI,
 * the reference generator and the tests read the same values.
 */

export const TICKET_GRAMMAR = '[A-Z][A-Z0-9]+-[0-9]+';

/** Prefixes of standard names that share the ticket shape (`UTF-8`, `CVE-2026-1234`). */
export const TICKET_DENYLIST = ['UTF', 'ISO', 'SHA', 'RFC', 'CVE', 'CWE', 'GHSA'] as const;

export type TicketStatus = 'ticket' | 'standard-name' | 'unknown-key';

export interface TicketCandidate {
    token: string;
    key: string;
    status: TicketStatus;
}

/**
 * Every ticket-shaped token in `text`, in order. With `keys`, a candidate whose
 * key is not listed is `unknown-key`; without, the grammar and the denylist
 * decide alone.
 */
export function ticketCandidates(text: string, keys?: readonly string[] | null): TicketCandidate[] {
    const out: TicketCandidate[] = [];
    for (const m of text.matchAll(new RegExp(TICKET_GRAMMAR, 'g'))) {
        const token = m[0];
        const key = token.slice(0, token.indexOf('-'));
        let status: TicketStatus = 'ticket';
        if ((TICKET_DENYLIST as readonly string[]).includes(key)) status = 'standard-name';
        else if (keys !== undefined && keys !== null && keys.length > 0 && !keys.includes(key)) status = 'unknown-key';
        out.push({ token, key, status });
    }
    return out;
}

export function firstTicket(text: string, keys?: readonly string[] | null): string | null {
    return ticketCandidates(text, keys).find((c) => c.status === 'ticket')?.token ?? null;
}

const KEY = /^[A-Z][A-Z0-9]+$/;

/**
 * The approved project keys from a convention card's `ticket_keys` line, or
 * from that line's value alone. A card without the line yields none.
 */
export function parseTicketKeys(text: string): string[] {
    const line = /^\s*ticket_keys\s*:(.*)$/m.exec(text)?.[1];
    const value = line ?? (text.includes(':') ? '' : text);
    return value
        .replace(/[[\]"']/g, ' ')
        .split(/[\s,]+/)
        .filter((k) => KEY.test(k));
}

/** The keys a commitlint config's `issuePrefixes` names: offered for the card, never written by code. */
export function commitlintIssuePrefixes(configText: string): string[] {
    const list = /["']?issuePrefixes["']?\s*:\s*\[([^\]]*)\]/.exec(configText)?.[1] ?? '';
    return [...list.matchAll(/["']([^"']*)["']/g)].map((m) => (m[1] as string).replace(/-$/, '')).filter((k) => KEY.test(k));
}

export const COMMIT_TYPES = ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'perf', 'style', 'build', 'ci', 'revert'] as const;

export type CommitFormat = 'ticket-scope' | 'ticket-conventional';
export type SubjectFamily = 'conventional' | 'ticket-conventional' | 'ticket-prefix' | 'gitmoji' | 'imperative-plain';

const TYPES = COMMIT_TYPES.join('|');

/** The `git.commit_format` grammars, in the syntax a JavaScript or PCRE engine reads. */
export const FORMAT_GRAMMAR: Readonly<Record<CommitFormat, string>> = {
    'ticket-scope': `^(${TYPES})(\\([^)]+\\))?!?: .+`,
    'ticket-conventional': `^(${TICKET_GRAMMAR} )?(${TYPES})(\\([^)]+\\))?!?: .+`,
};

/**
 * The measured families as POSIX extended regular expressions, matched in
 * order, first hit wins; anything else is `other`.
 */
export const FAMILY_ERE: ReadonlyArray<readonly [SubjectFamily, string]> = [
    ['conventional', '^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\\([^)]+\\))?!?: '],
    ['ticket-conventional', `^${TICKET_GRAMMAR} (build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\\([^)]+\\))?!?: `],
    ['ticket-prefix', `^\\[${TICKET_GRAMMAR}\\][: ]|^${TICKET_GRAMMAR}[: ]`],
    // `[:ascii:]` is not a POSIX class (GNU and BSD grep reject it); a leading
    // character outside printable ASCII, the controls and the spaces is the same set.
    ['gitmoji', '^:[a-z0-9_+-]+:[[:space:]]|^[^ -~[:cntrl:][:space:]]'],
    ['imperative-plain', '^[A-Z][a-z]+[[:space:]].*[^.]$'],
];

/** The two POSIX bracket expressions the families use, and nothing else, translated for a JavaScript engine. */
function _js(ere: string): RegExp {
    return new RegExp(ere.replaceAll('[^ -~[:cntrl:][:space:]]', '[^\\x00-\\x7F\\s]').replaceAll('[[:space:]]', '\\s'));
}

const FAMILY_JS: ReadonlyArray<readonly [SubjectFamily, RegExp]> = FAMILY_ERE.map(([f, ere]) => [f, _js(ere)] as const);

export function classifySubject(subject: string): SubjectFamily | 'other' {
    return FAMILY_JS.find(([, re]) => re.test(subject))?.[0] ?? 'other';
}

export type SubjectRule = { format: CommitFormat } | { family: SubjectFamily };
export type SubjectVerdict = { ok: true } | { ok: false; rule: string };

const SCOPE = /^[^(:]*\(([^)]*)\)/;

/** Grammars where the ticket leads the subject, so a ticket in the scope is a second, misplaced copy. */
function _ticketLeads(rule: SubjectRule): boolean {
    return 'format' in rule ? rule.format === 'ticket-conventional' : rule.family === 'ticket-conventional';
}

export function ruleName(rule: SubjectRule): string {
    return 'format' in rule ? `git.commit_format: ${rule.format}` : `approved family ${rule.family}`;
}

export function checkSubject(subject: string, rule: SubjectRule): SubjectVerdict {
    const grammar = 'format' in rule ? new RegExp(FORMAT_GRAMMAR[rule.format]) : (FAMILY_JS.find(([f]) => f === rule.family)?.[1] as RegExp);
    if (!grammar.test(subject)) {
        return { ok: false, rule: `${ruleName(rule)} — does not match ${'format' in rule ? FORMAT_GRAMMAR[rule.format] : (FAMILY_ERE.find(([f]) => f === rule.family)?.[1] ?? '')}` };
    }
    if (!_ticketLeads(rule)) return { ok: true };
    const lead = /^(\S+) /.exec(subject)?.[1] ?? '';
    const leading = ticketCandidates(lead).find((c) => c.token === lead);
    if (leading !== undefined && leading.status === 'standard-name') {
        return { ok: false, rule: `${ruleName(rule)} — \`${lead}\` is a standard name, not a ticket` };
    }
    const scope = SCOPE.exec(lead === '' || leading === undefined ? subject : subject.slice(lead.length + 1))?.[1] ?? '';
    const inScope = ticketCandidates(scope).find((c) => c.status !== 'standard-name');
    if (inScope !== undefined) {
        return { ok: false, rule: `${ruleName(rule)} — the ticket \`${inScope.token}\` stands inside the scope; it leads the subject, never the scope` };
    }
    return { ok: true };
}

export interface BranchInput {
    type?: string | null;
    ticket?: string | null;
    slug: string;
}

export type BranchRender = { ok: true; name: string } | { ok: false; reason: string };

const VALUE = /^[A-Za-z0-9._-]+$/;
const SEPARATORS = '-/_.';

/**
 * `pattern` with its placeholders filled. An empty placeholder drops together
 * with the separator after it, or the one before it when it is last; a ticket
 * the pattern has no slot for prefixes the slug. Literal characters of the
 * pattern are never rewritten, and a value outside `[A-Za-z0-9._-]` is refused
 * rather than repaired, because the name reaches shell commands.
 */
export function renderBranch(pattern: string, input: BranchInput): BranchRender {
    const type = input.type ?? '';
    const ticket = input.ticket ?? '';
    let slug = input.slug;
    if (slug === '' || !VALUE.test(slug)) return { ok: false, reason: `slug ${JSON.stringify(slug)} is empty or outside [A-Za-z0-9._-]` };
    if (type !== '' && !VALUE.test(type)) return { ok: false, reason: `type ${JSON.stringify(type)} is outside [A-Za-z0-9._-]` };
    if (ticket !== '' && !new RegExp(`^${TICKET_GRAMMAR}$`).test(ticket)) {
        return { ok: false, reason: `ticket ${JSON.stringify(ticket)} does not match ${TICKET_GRAMMAR}` };
    }
    if (ticket !== '' && !pattern.includes('{ticket}') && slug !== ticket && !slug.startsWith(`${ticket}-`)) slug = `${ticket}-${slug}`;

    const values: Record<string, string> = { type, ticket, slug };
    const parts = pattern.split(/(\{(?:type|ticket|slug)\})/).filter((p) => p !== '');
    const out: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i] as string;
        const ph = /^\{(type|ticket|slug)\}$/.exec(part);
        if (ph === null) {
            out.push(part);
            continue;
        }
        const value = values[ph[1] as string] as string;
        if (value !== '') {
            out.push(value);
            continue;
        }
        const next = parts[i + 1];
        if (next !== undefined && !next.startsWith('{') && SEPARATORS.includes(next[0] as string)) {
            parts[i + 1] = next.slice(1);
        } else if (next === undefined && out.length > 0) {
            const prev = out[out.length - 1] as string;
            if (SEPARATORS.includes(prev.slice(-1))) out[out.length - 1] = prev.slice(0, -1);
        }
    }
    const name = out.join('');
    if (name === '' || name.startsWith('/') || name.endsWith('/') || name.includes('//') || name.includes('..')) {
        return { ok: false, reason: `the rendered name ${JSON.stringify(name)} is not a branch name` };
    }
    return { ok: true, name };
}
