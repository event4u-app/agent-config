/**
 * host_docs_pages — the reader for the sibling page list.
 *
 * `host_lowering.yaml` carries a `verified.docs_url` per host and
 * `check_host_docs_digest` watches exactly those. Every one of them is a HOOKS
 * page, because that is what a lowering row is about. A vendor page this tree
 * reads for anything else reached the tree only by accident — nothing
 * re-fetched it and nothing noticed when it moved.
 *
 * `host_docs_pages.yaml` is the list of those other pages. This module reads it
 * and writes digests back into it, with the same two disciplines the sibling
 * reader follows:
 *
 *   - PARSE with the YAML library, because the file is hand-written and a
 *     regex reader would accept shapes the schema does not.
 *   - WRITE by editing the two lines whose content changed, NOT by a
 *     `parseDocument` round-trip. The sibling learned that the hard way: a
 *     round-trip renormalises hand-aligned blocks and produces a diff nobody
 *     reads. Here the stake is smaller and the reason is the same — a
 *     scheduled job's commit should contain only what moved.
 *
 * Node-reading but logic-pure: every exported function takes TEXT, so a test
 * can exercise the whole round trip over a fixture without touching the
 * committed file.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _IN_BUNDLE = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
const _REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ...(_IN_BUNDLE ? ['..', '..'] : ['..', '..', '..']),
);

export const HOST_DOCS_PAGES_PATH = path.join(
    _REPO_ROOT,
    'src',
    'scripts',
    'hooks',
    'host_docs_pages.yaml',
);

/**
 * The name the watcher prints in the `host` column for a page-list row.
 *
 * The watcher's finding shape is `(host, surface)` and a page has neither. It
 * borrows the pair rather than growing a third axis: `pages/<id>` reads as one
 * identifier and sorts beside `claude/any` without pretending to be a host.
 */
export const PAGES_PSEUDO_HOST = 'pages';

export interface DocsPage {
    readonly id: string;
    readonly docs_url: string;
    readonly docs_at: string;
    readonly docs_digest: string | null;
    readonly expires: string;
    readonly why: string;
}

export class MalformedDocsPages extends Error {}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function _str(row: Record<string, unknown>, id: string, key: string): string {
    const v = row[key];
    if (typeof v !== 'string' || v.trim() === '') {
        throw new MalformedDocsPages(`page ${id}: ${key} must be a non-empty string`);
    }
    return v.trim();
}

/**
 * Parse the list from TEXT.
 *
 * Every field is checked here rather than at the use sites. A `docs_digest`
 * that is neither null nor a sha256, or an `expires` that is not an ISO date,
 * is a malformed row — and the watcher writes a DATE back into this file, so a
 * row it cannot trust is one it must refuse rather than work around.
 */
export function parseDocsPages(text: string): Map<string, DocsPage> {
    const doc = parseYaml(text) as unknown;
    if (doc === null || typeof doc !== 'object') {
        throw new MalformedDocsPages('the file must be a mapping with a `pages:` key');
    }
    const pages = (doc as Record<string, unknown>)['pages'];
    if (pages === null || typeof pages !== 'object' || Array.isArray(pages)) {
        throw new MalformedDocsPages('`pages:` must be a mapping of id -> row');
    }
    const out = new Map<string, DocsPage>();
    for (const [id, raw] of Object.entries(pages as Record<string, unknown>)) {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new MalformedDocsPages(`page ${id}: a row must be a mapping`);
        }
        const row = raw as Record<string, unknown>;
        const docs_url = _str(row, id, 'docs_url');
        const docs_at = _str(row, id, 'docs_at');
        const expires = _str(row, id, 'expires');
        const why = _str(row, id, 'why');
        const digestRaw = row['docs_digest'];
        if (!(digestRaw === null || digestRaw === undefined || typeof digestRaw === 'string')) {
            throw new MalformedDocsPages(`page ${id}: docs_digest must be a sha256 string or null`);
        }
        const docs_digest = typeof digestRaw === 'string' && digestRaw.trim() !== ''
            ? digestRaw.trim()
            : null;
        if (!ISO_DATE.test(docs_at)) throw new MalformedDocsPages(`page ${id}: docs_at must be YYYY-MM-DD`);
        if (!ISO_DATE.test(expires)) throw new MalformedDocsPages(`page ${id}: expires must be YYYY-MM-DD`);
        if (docs_digest !== null && !SHA256.test(docs_digest)) {
            throw new MalformedDocsPages(`page ${id}: docs_digest must be 64 hex characters`);
        }
        if (!/^https:\/\//.test(docs_url)) {
            throw new MalformedDocsPages(`page ${id}: docs_url must be an https URL`);
        }
        out.set(id, { id, docs_url, docs_at, docs_digest, expires, why });
    }
    if (out.size === 0) {
        // An EMPTY list is refused rather than reported clean. A watcher that
        // silently walks zero rows is indistinguishable from a watcher that
        // works — the same scan-scope argument every gate in this tree carries.
        throw new MalformedDocsPages('`pages:` is empty — a watcher over zero rows reports nothing and proves nothing');
    }
    return out;
}

/**
 * Rewrite a page's `docs_digest`, its `expires`, or both — whichever the edit
 * names.
 *
 * The two are separable because the watcher's two outcomes want different
 * halves of the row, and mirroring the sibling table matters more than a
 * simpler signature: a FILLED row gets its first digest, and a CHANGED row
 * keeps the digest it recorded (that is the evidence) while `expires` is pulled
 * back to the day before detection.
 *
 * Line-located structurally: the walk tracks the two-space page header and only
 * rewrites fields inside THAT row, so a `docs_digest:` in the file's header
 * comment or under a different page is never hit. Returns the text unchanged,
 * and reports the id as missed, when the row is not found — a silent no-op
 * here would read as a successful write.
 */
export function applyDocsPageEdits(
    yamlText: string,
    edits: ReadonlyArray<{ id: string; digest?: string; expires?: string }>,
): { text: string; written: string[]; expired: string[]; missed: string[] } {
    const wanted = new Map(edits.map((e) => [e.id, e]));
    const lines = yamlText.split('\n');
    const written: string[] = [];
    const expired: string[] = [];
    const seen = new Set<string>();
    let current: string | null = null;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        const header = /^ {2}([A-Za-z0-9][A-Za-z0-9._-]*):\s*$/.exec(line);
        if (header) {
            current = header[1] as string;
            if (wanted.has(current)) seen.add(current);
            continue;
        }
        // A line at column 0 ends the `pages:` block; nothing below it is a row.
        if (/^\S/.test(line)) {
            current = null;
            continue;
        }
        if (current === null) continue;
        const edit = wanted.get(current);
        if (edit === undefined) continue;
        if (edit.digest !== undefined) {
            const digestLine = /^(\s+docs_digest:\s*)(.*)$/.exec(line);
            if (digestLine) {
                lines[i] = `${digestLine[1] as string}${edit.digest}`;
                written.push(current);
                continue;
            }
        }
        if (edit.expires !== undefined) {
            const expiresLine = /^(\s+expires:\s*)(.*)$/.exec(line);
            if (expiresLine) {
                lines[i] = `${expiresLine[1] as string}${edit.expires}`;
                expired.push(current);
            }
        }
    }
    return {
        text: lines.join('\n'),
        written,
        expired,
        missed: [...wanted.keys()].filter((id) => !seen.has(id)),
    };
}
