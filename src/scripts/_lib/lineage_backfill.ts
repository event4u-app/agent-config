/**
 * `lineage backfill --draft` — turn the tree's existing ENC1 tokens into draft lineage rows.
 *
 * Years of roadmaps already carry sealed source links in their Provenance blocks. This
 * decrypts them locally, gives each a source id, and proposes a draft row only where the
 * block itself names a mechanism and a verdict on the token's line. Everything else is
 * reported as unclear. It writes drafts and nothing else: confirming a draft into a ledger is
 * the owner's step, because a row the agent confirmed itself is fabricated provenance.
 *
 * The decrypted output lands in `agents/.harvest-local/`, inside the work tree, so the run
 * refuses unless git ignores that directory.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { gitEnv } from './git_env.js';
import { decrypt } from './link_crypto.js';
import { sourceId } from './source_id.js';

export const BACKFILL_DIR_REL = 'agents/.harvest-local/lineage-backfill';

const TOKEN_RE = /ENC1:[A-Za-z0-9+/=]+/g;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const MECHANISM_RE = /\bmechanism:\s*([a-z0-9]+(?:-[a-z0-9]+)*)/;
const VERDICT_RE = /\bverdict:\s*(adopt|adapt|reject|already|gap|deferred)\b/;

export interface DecryptedToken {
    readonly file: string;
    readonly line: number;
    readonly source_id: string;
    readonly identity: string;
    readonly in_provenance: boolean;
}

export interface DraftRow {
    readonly file: string;
    readonly line: number;
    readonly source_id: string;
    readonly mechanism_id: string;
    readonly verdict: string;
}

export interface BackfillResult {
    readonly tokens: DecryptedToken[];
    readonly drafts: DraftRow[];
    /** `file:line` of a Provenance-block token that names no mechanism and verdict. */
    readonly unclear: string[];
    /** `file:line` of a token no configured key opens. */
    readonly undecryptable: string[];
}

function git(root: string, args: string[]): { status: number; stdout: string } {
    try {
        return { status: 0, stdout: execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8', env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'] }) };
    } catch (e) {
        const err = e as { status?: number; stdout?: string };
        return { status: err.status ?? 1, stdout: err.stdout ?? '' };
    }
}

export function isIgnored(root: string, rel: string): boolean {
    return git(root, ['check-ignore', '-q', '--no-index', `${rel}/`]).status === 0;
}

export function scanTree(root: string, keys: readonly string[]): BackfillResult {
    const files = git(root, ['ls-files', '-z', '--', '*.md']).stdout.split('\0').filter((f) => f !== '');
    const result: BackfillResult = { tokens: [], drafts: [], unclear: [], undecryptable: [] };
    for (const rel of files.sort()) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf-8');
        } catch {
            continue;
        }
        if (!text.includes('ENC1:')) continue;
        let provenanceLevel = 0;
        text.split('\n').forEach((lineText, i) => {
            const h = HEADING_RE.exec(lineText);
            if (h) {
                const level = (h[1] as string).length;
                if (/provenance/i.test(h[2] as string)) provenanceLevel = level;
                else if (provenanceLevel > 0 && level <= provenanceLevel) provenanceLevel = 0;
            }
            const tokens = lineText.match(TOKEN_RE) ?? [];
            for (const token of tokens) {
                const at = `${rel}:${String(i + 1)}`;
                let identity: string;
                try {
                    identity = decrypt(token, [...keys]);
                } catch {
                    result.undecryptable.push(at);
                    continue;
                }
                const id = sourceId(identity, keys[0] as string);
                const inProvenance = provenanceLevel > 0;
                result.tokens.push({ file: rel, line: i + 1, source_id: id, identity, in_provenance: inProvenance });
                if (!inProvenance) continue;
                const mech = MECHANISM_RE.exec(lineText);
                const verdict = VERDICT_RE.exec(lineText);
                if (mech && verdict && tokens.length === 1) {
                    result.drafts.push({ file: rel, line: i + 1, source_id: id, mechanism_id: mech[1] as string, verdict: verdict[1] as string });
                } else {
                    result.unclear.push(at);
                }
            }
        });
    }
    return result;
}

export function writeBackfill(root: string, result: BackfillResult): string {
    const out = path.join(root, BACKFILL_DIR_REL);
    fs.mkdirSync(out, { recursive: true, mode: 0o700 });
    const jsonl = (rows: readonly unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length > 0 ? '\n' : '');
    fs.writeFileSync(path.join(out, 'tokens.jsonl'), jsonl(result.tokens), { mode: 0o600 });
    fs.writeFileSync(path.join(out, 'drafts.jsonl'), jsonl(result.drafts), { mode: 0o600 });
    const report = [
        '# Lineage backfill — drafts for the owner to confirm',
        '',
        `${String(result.drafts.length)} draft(s), ${String(result.unclear.length)} unclear, ${String(result.undecryptable.length)} undecryptable, from ${String(result.tokens.length)} decrypted token(s).`,
        'No ledger row was written. Confirming a draft is the owner\'s step.',
        '',
        '## Drafts',
        '',
        ...result.drafts.map((d) => `- ${d.file}:${String(d.line)} — ${d.mechanism_id} — ${d.verdict} — ${d.source_id}`),
        '',
        '## Unclear',
        '',
        ...result.unclear.map((u) => `- ${u}`),
        '',
    ].join('\n');
    fs.writeFileSync(path.join(out, 'report.md'), report, { mode: 0o600 });
    return out;
}
