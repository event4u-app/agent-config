#!/usr/bin/env tsx
/**
 * source_digest — keyed digests for the source deny set
 * (`road-to-source-silence` Phase 1.1).
 *
 * ## The problem
 *
 * `external_sources_denylist.json` publishes, in plaintext in a public
 * repository, 65 names of the harvest sources it exists to hide. The list IS
 * the disclosure. Phase 1's answer is to stop shipping the names: the tracked
 * config carries **HMAC-SHA256 digests**, the readable master lives in a
 * gitignored private file, and a build step derives one from the other.
 *
 * ## Why keyed and not a plain hash
 *
 * The candidate space is public repository slugs — a few million entries,
 * enumerable in minutes. An unsalted SHA-256 of a slug is a lookup, not a
 * secret. The construction is therefore keyed: without the key a digest is not
 * reversible by dictionary attack, and with the key the gate matches exactly as
 * a name list would.
 *
 * ## STATUS: DORMANT. This ships ALONGSIDE the plaintext gate, not instead of it.
 *
 * AI council 2026-08-28 (blocker `where-the-key-lives`), 2/2 convergent:
 * shipping this as a REPLACEMENT is net-negative, because the half an agent can
 * build is precisely the half that enforces nothing. Provisioning the CI
 * secret, generating production digests, deleting the tracked plaintext deny
 * array, and switching CI to strict mode are **one atomic maintainer change**;
 * splitting them leaves the gate either failing every run for want of a key or
 * silently degraded to warn mode, which is the exact failure the roadmap exists
 * to remove.
 *
 * So: the plaintext `deny` array stays in force and is not deleted, and
 * `deny_digests` ships EMPTY. When it is empty this module does no work at all.
 * The cutover recipe is in `docs/maintainers/source-deny-digests.md`.
 */

import * as crypto from 'node:crypto';

/** Environment variable carrying the HMAC key (CI secret / local `.env`). */
export const KEY_ENV = 'SOURCE_DENY_KEY';

/** Environment variable that makes a missing key fatal instead of dormant. */
export const STRICT_ENV = 'SOURCE_DENY_STRICT';

/** Exit code for "strict mode asked for, key absent". Never 0 — see Phase 1.2. */
export const EXIT_NO_KEY = 3;

/**
 * Fold a candidate to its comparison form.
 *
 * Lowercase, every separator run (`-`, `_`, `.`, `/`, whitespace) collapsed to a
 * single `-`, edges trimmed. `Foo_Bar`, `foo.bar`, `foo/bar` and `FOO - BAR` all
 * reach the same digest, so a source cannot be smuggled past the set by
 * re-punctuating its name.
 */
export function normalise(token: string): string {
    return token
        .toLowerCase()
        .replace(/[\s._/\\-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** HMAC-SHA256 of the normalised token, lowercase hex. */
export function digest(token: string, key: string): string {
    if (!key) throw new Error('empty digest key');
    return crypto.createHmac('sha256', key).update(normalise(token), 'utf-8').digest('hex');
}

/** A digest as it must appear in the config. */
export const DIGEST_RE = /^[0-9a-f]{64}$/;

/** Word-ish runs a source name could occupy. */
const WORD_RE = /[A-Za-z0-9][A-Za-z0-9._-]{2,80}/g;

/**
 * The candidate tokens on one line.
 *
 * A digest cannot be regex-matched, so the line is tokenised and each candidate
 * hashed. Three shapes are produced per word run: the run itself, the run
 * joined to its right-hand neighbour across a `/` (the `owner/repo` form), and
 * the same across a `-`. That is a deliberate ceiling: an attribution spread
 * over more than two adjacent tokens is not caught, and the module docstring of
 * `source_shape.ts` says the same thing about its own classes — a floor, not a
 * proof.
 */
export function candidateTokens(line: string): string[] {
    const words: string[] = [];
    WORD_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    const spans: Array<{ text: string; end: number; start: number }> = [];
    while ((m = WORD_RE.exec(line)) !== null) {
        spans.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    }
    for (let i = 0; i < spans.length; i += 1) {
        const cur = spans[i] as { text: string; end: number; start: number };
        words.push(cur.text);
        const next = spans[i + 1];
        if (!next) continue;
        const between = line.slice(cur.end, next.start);
        if (between === '/' || between === '-') words.push(`${cur.text}${between}${next.text}`);
    }
    return words;
}

/**
 * A digest matcher over one deny set. Memoises per normalised token, so the
 * per-line cost is a Map lookup once a token has been seen anywhere in the run.
 */
export class DigestMatcher {
    private readonly set: ReadonlySet<string>;
    private readonly key: string;
    private readonly memo = new Map<string, boolean>();

    constructor(digests: readonly string[], key: string) {
        this.set = new Set(digests.map((d) => d.toLowerCase()));
        this.key = key;
    }

    /** Is this raw token in the deny set? */
    has(token: string): boolean {
        const norm = normalise(token);
        if (norm.length < 3) return false;
        const cached = this.memo.get(norm);
        if (cached !== undefined) return cached;
        const hit = this.set.has(digest(norm, this.key));
        this.memo.set(norm, hit);
        return hit;
    }

    /** The denied tokens on one line, deduplicated, normalised form. */
    hits(line: string): string[] {
        const out = new Set<string>();
        for (const t of candidateTokens(line)) if (this.has(t)) out.add(normalise(t));
        return [...out];
    }

    get size(): number {
        return this.set.size;
    }
}

export interface DigestModeVerdict {
    /** Digest matching is active this run. */
    active: boolean;
    /** Digests present in the config. */
    digests: number;
    /** Set, but the key is missing. */
    keyMissing: boolean;
    /** Strict mode was requested. */
    strict: boolean;
    /** One line for stdout/stderr. Empty when there is nothing to say. */
    message: string;
}

/**
 * Decide what digest matching does this run — the loud-when-keyless contract
 * from Phase 1.2.
 *
 * | digests | key | strict | verdict |
 * |---|---|---|---|
 * | none | — | no | dormant, silent (today's shipped state) |
 * | none | — | yes | **fatal**: strict asked for and there is nothing to enforce |
 * | some | absent | no | **loud warning**, matching skipped — never silently green |
 * | some | absent | yes | **fatal** (`EXIT_NO_KEY`) |
 * | some | present | — | active |
 */
export function digestMode(opts: {
    digests: readonly string[];
    key: string | undefined;
    strict: boolean;
}): DigestModeVerdict {
    const n = opts.digests.length;
    const key = opts.key ?? '';
    if (n === 0) {
        return {
            active: false,
            digests: 0,
            keyMissing: false,
            strict: opts.strict,
            message: opts.strict
                ? `${STRICT_ENV} is set but the config carries no deny_digests — strict mode has ` +
                  'nothing to enforce. Run the digest build step before enabling strict mode.'
                : '',
        };
    }
    if (key === '') {
        return {
            active: false,
            digests: n,
            keyMissing: true,
            strict: opts.strict,
            message:
                `⚠️  ${String(n)} deny digest(s) present but ${KEY_ENV} is unset — digest matching ` +
                'is SKIPPED this run. This run did NOT check the hashed deny set. Set ' +
                `${KEY_ENV} (CI secret / local .env) to enforce it.`,
        };
    }
    return { active: true, digests: n, keyMissing: false, strict: opts.strict, message: '' };
}
