/**
 * The `Consumer-Impact:` commit trailer — parsing, the release-span refusal, and
 * the impact map the release writes into the published `package.json`.
 *
 * The trailer lives in the commit BODY, so the release log is read with a body
 * field and a record separator rather than one line per commit. The vocabulary
 * is documented beside the bump table in CONTRIBUTING.md § Versioning policy.
 *
 * Recording is advisory: the impact does not change how a release is numbered. The
 * bump still follows breaking-ness (`is_breaking_commit`); whether it should
 * follow the impact instead is an open owner decision.
 */

export const CONSUMER_IMPACT_VALUES = ['none', 'automatic', 'notice', 'action'] as const;
export type ConsumerImpact = (typeof CONSUMER_IMPACT_VALUES)[number];

export interface ImpactTrailers {
    readonly impact: ConsumerImpact;
    /** False when the commit carried no valid trailer and `impact` is the default. */
    readonly recorded: boolean;
    /** Why the trailer is not valid — out-of-enum value, conflicting duplicates, misspelt key — for the refusal. */
    readonly invalid: string | null;
    readonly security: boolean;
}

export const NO_IMPACT_TRAILERS: ImpactTrailers = Object.freeze({
    impact: 'none',
    recorded: false,
    invalid: null,
    security: false,
});

/** `git log --format` producing sha, subject and body, one record per `\x1e`. */
export const COMMIT_LOG_FORMAT = '%H%x1f%s%x1f%b%x1e';

export interface CommitRecord {
    readonly sha: string;
    readonly subject: string;
    readonly body: string;
}

export function parse_commit_log(raw: string): CommitRecord[] {
    const out: CommitRecord[] = [];
    for (const chunk of raw.split('\x1e')) {
        const rec = chunk.replace(/^\n+/, '');
        const parts = rec.split('\x1f');
        if (parts.length < 2) continue;
        out.push({ sha: parts[0]!, subject: parts[1]!, body: parts.slice(2).join('\x1f') });
    }
    return out;
}

const TRAILER_LINE = /^(BREAKING CHANGE|[A-Za-z0-9][A-Za-z0-9-]*):[ \t]*(.*?)[ \t]*$/;

/**
 * Every Git trailer block in the body: each paragraph whose every line is a
 * `Key: value` trailer or an indented continuation. Not only the final one — a
 * GitHub squash merge folds each squashed commit's trailers into an earlier
 * paragraph and closes the body with its own `Co-authored-by:` paragraph. A
 * paragraph holding any other line, or any part of a code fence, is not a block.
 */
export function trailer_blocks(body: string): Array<Array<[key: string, value: string]>> {
    const blocks: Array<Array<[string, string]>> = [];
    let para: string[] = [];
    let tainted = false;
    let fenced = false;
    const flush = (): void => {
        const block = tainted ? [] : parse_trailer_paragraph(para);
        if (block.length > 0) blocks.push(block);
        para = [];
        tainted = false;
    };
    for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
        if (/^[ \t]*(```|~~~)/.test(line)) {
            fenced = !fenced;
            tainted = true;
        } else if (fenced) {
            tainted = true;
        } else if (/^[ \t]*$/.test(line)) {
            flush();
        } else {
            para.push(line);
        }
    }
    flush();
    return blocks;
}

function parse_trailer_paragraph(lines: readonly string[]): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    for (const line of lines) {
        if (/^[ \t]+\S/.test(line) && out.length > 0) continue;
        const m = TRAILER_LINE.exec(line);
        if (!m) return [];
        out.push([m[1]!, m[2]!]);
    }
    return out;
}

type BlockImpact = Omit<ImpactTrailers, 'security'>;

function block_impact(block: ReadonlyArray<[string, string]>): BlockImpact | null {
    const variant = block.find(([k]) => k !== 'Consumer-Impact' && k.toLowerCase() === 'consumer-impact');
    if (variant) return { impact: 'none', recorded: false, invalid: `key '${variant[0]}' (spell it Consumer-Impact)` };
    const values = [...new Set(block.filter(([k]) => k === 'Consumer-Impact').map(([, v]) => v))];
    if (values.length === 0) return null;
    if (values.length > 1) return { impact: 'none', recorded: false, invalid: `conflicting values '${values.join("', '")}'` };
    const value = values[0]!;
    if ((CONSUMER_IMPACT_VALUES as readonly string[]).includes(value)) {
        return { impact: value as ConsumerImpact, recorded: true, invalid: null };
    }
    return { impact: 'none', recorded: false, invalid: `value '${value}'` };
}

/**
 * One block decides by the single-commit contract. Several blocks are a squash
 * of several commits: an invalid block refuses the whole body, otherwise the
 * most severe value wins — the reduction `release_impact_entry` applies to a span.
 */
export function parse_impact_trailers(body: string): ImpactTrailers {
    const blocks = trailer_blocks(body);
    const security = blocks.some((b) => b.some(([k, v]) => k === 'Security' && v === 'yes'));
    let best: BlockImpact | null = null;
    for (const block of blocks) {
        const r = block_impact(block);
        if (r === null) continue;
        if (r.invalid !== null) return { ...r, security };
        if (best === null || IMPACT_RANK[r.impact] > IMPACT_RANK[best.impact]) best = r;
    }
    return best === null ? { ...NO_IMPACT_TRAILERS, security } : { ...best, security };
}

/**
 * Breaking-ness, decided without depending on the subject being conventional: a
 * `!` before the colon (`bang`, when the conventional parse matched), `BREAKING
 * CHANGE` / `BREAKING-CHANGE` in the subject, or a `BREAKING CHANGE:` /
 * `BREAKING-CHANGE:` footer at any body line start. The footer is not limited to
 * the trailer block: a Conventional Commits breaking footer may run on over
 * paragraphs, and over-matching here only demands a trailer, where
 * under-matching lets a breaking change through.
 */
export function is_breaking_commit(subject: string, body: string, bang = false): boolean {
    return bang || /BREAKING[ -]CHANGE/.test(subject) || /^BREAKING[ -]CHANGE:/m.test(body);
}

export interface ImpactCommit {
    readonly sha: string;
    readonly type: string;
    readonly scope: string | null;
    readonly subject: string;
    readonly breaking: boolean;
    readonly trailers: ImpactTrailers;
}

function label(c: ImpactCommit): string {
    if (c.type === 'other') return c.subject;
    return `${c.type}${c.scope ? `(${c.scope})` : ''}${c.breaking ? '!' : ''}: ${c.subject}`;
}

/**
 * The release-span refusal: a breaking subject must say what it costs a
 * consumer. Exit 2 matches `die()`'s default code in `release.ts`.
 */
export function impact_span_verdict(commits: readonly ImpactCommit[]): { exit: number; message: string } {
    const missing = commits.filter((c) => c.breaking && !c.trailers.recorded);
    if (missing.length === 0) return { exit: 0, message: '' };
    const lines = missing.map((c) => {
        const why = c.trailers.invalid !== null ? `invalid trailer: ${c.trailers.invalid}` : 'no trailer';
        return `  ${c.sha.slice(0, 7)} ${label(c)} — ${why}`;
    });
    return {
        exit: 2,
        message:
            'release span carries a breaking subject with no valid Consumer-Impact trailer:\n' +
            `${lines.join('\n')}\n` +
            `Each needs one 'Consumer-Impact: ${CONSUMER_IMPACT_VALUES.join(' | ')}' trailer in a trailer-only paragraph of the body ` +
            '(CONTRIBUTING.md § Versioning policy).',
    };
}

export interface ImpactEntry {
    readonly impact: ConsumerImpact;
    readonly security?: true;
}
export type ImpactMap = Readonly<Record<string, ImpactEntry>>;

export const IMPACT_RANK: Readonly<Record<ConsumerImpact, number>> = Object.freeze({
    none: 0,
    automatic: 1,
    notice: 2,
    action: 3,
});

export function release_impact_entry(commits: readonly ImpactCommit[]): ImpactEntry {
    let impact: ConsumerImpact = 'none';
    let security = false;
    for (const c of commits) {
        if (IMPACT_RANK[c.trailers.impact] > IMPACT_RANK[impact]) impact = c.trailers.impact;
        security = security || c.trailers.security;
    }
    return security ? { impact, security: true } : { impact };
}

/** Add `version`'s entry to the map; a release that is `none` throughout adds nothing. */
export function with_release_impact(
    map: ImpactMap,
    version: string,
    commits: readonly ImpactCommit[],
): ImpactMap {
    const entry = release_impact_entry(commits);
    if (entry.impact === 'none' && !entry.security) return { ...map };
    return { ...map, [version]: entry };
}

/** Write the map under `agentConfig.impact` of a parsed package.json, in place. */
export function write_impact_map(
    data: Record<string, unknown>,
    version: string,
    commits: readonly ImpactCommit[],
): void {
    const block = (data['agentConfig'] ?? {}) as Record<string, unknown>;
    const next = with_release_impact((block['impact'] ?? {}) as ImpactMap, version, commits);
    if (Object.keys(next).length === 0) return;
    data['agentConfig'] = { ...block, impact: next };
}
