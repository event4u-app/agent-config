/**
 * `GET|POST /api/v1/wizard/statusline` — the one offer of the quota status-line tap.
 *
 * Council decision on OQ-19 (2026-10-26, 2/2): `setup` offers the tap once,
 * defaulting to yes, and writes nothing into `~/.claude/settings.json` without
 * that answer. The answer is remembered beside the quota ledger, so neither a
 * declined nor an accepted offer is made again — not even after the tap is
 * uninstalled (`accepted`); uninstalling stays `agent-config statusline:uninstall`.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as z from 'zod';

import { claudeSettingsPath, installTap, TAP_COMMAND } from '../../scripts/_cli/cmd_statusline.js';
import { quotaStateDir } from '../../scripts/_lib/quota_ledger.js';
import type { EnvMap } from '../../scripts/_lib/user_global_paths.js';

export const StatuslineOfferSchema = z.object({
    /** `accepted`: the user said yes once and the tap is not there now — uninstalled since; never offered again. */
    state: z.enum(['offer', 'installed', 'accepted', 'declined']),
    settings_path: z.string(),
    has_existing: z.boolean(),
});
export type StatuslineOffer = z.infer<typeof StatuslineOfferSchema>;

const ApplyBodySchema = z.object({ install: z.boolean() });

function offerPath(env?: EnvMap | null): string {
    return path.join(quotaStateDir(env), 'statusline-offer.json');
}

function currentStatusLine(file: string): unknown {
    try {
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown> | null;
        return o?.['statusLine'];
    } catch {
        return undefined;
    }
}

export function readOffer(env?: EnvMap | null): StatuslineOffer {
    const file = claudeSettingsPath(env);
    const sl = currentStatusLine(file);
    const command = sl !== null && typeof sl === 'object' ? (sl as Record<string, unknown>)['command'] : undefined;
    const installed = typeof command === 'string' && command.trim().startsWith(TAP_COMMAND);
    // A missing file is no answer yet. An answer that exists but cannot be read
    // is never read as no answer: the offer is not made again (`declined`).
    let decision: unknown = null;
    try {
        decision = (JSON.parse(fs.readFileSync(offerPath(env), 'utf-8')) as { decision?: unknown }).decision ?? 'unknown';
    } catch (err) {
        decision = (err as NodeJS.ErrnoException).code === 'ENOENT' ? null : 'declined';
    }
    // Any answer file that exists is an answer: only `installed` reads as yes.
    const answered = decision !== null;
    return {
        state: installed ? 'installed' : decision === 'installed' ? 'accepted' : answered ? 'declined' : 'offer',
        settings_path: file,
        has_existing: !installed && sl !== undefined && sl !== null,
    };
}

/** Thrown when the answer is already on disk; the route turns it into 409. */
export class OfferAnsweredError extends Error {
    constructor() {
        super('The status-line offer was already answered.');
    }
}

/** The two file operations a test replaces to force a failure. */
export interface OfferIo {
    /** Writes the full record to its temporary file. */
    readonly write?: (file: string, data: string) => void;
    /** Removes a file: the temporary record after the claim, or the answer a failed install takes back. */
    readonly remove?: (file: string) => void;
}

const writeRecord = (file: string, data: string): void => fs.writeFileSync(file, data, { flag: 'wx', mode: 0o600 });
const removeRecord = (file: string): void => fs.rmSync(file, { force: true });

/**
 * Claim the one answer. The whole record is written to a temporary file first
 * and only then linked into place with `linkSync`, which refuses an existing
 * name: of two concurrent answers exactly one gets the file, and a write that
 * fails leaves no answer behind — only a complete record can ever be the answer.
 * The token keeps a failed install from taking back an answer that, when it
 * checks, belongs to another claim; a replacement between that check and the
 * removal is outside the claim protocol, which never overwrites an answer.
 */
function claimAnswer(decision: 'installed' | 'declined', env?: EnvMap | null, io: OfferIo = {}): string {
    const write = io.write ?? writeRecord;
    const remove = io.remove ?? removeRecord;
    const p = offerPath(env);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const token = randomUUID();
    const temp = `${p}.${token}.tmp`;
    try {
        write(temp, JSON.stringify({ decision, at: new Date().toISOString(), token }));
        try {
            fs.linkSync(temp, p);
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'EEXIST') throw new OfferAnsweredError();
            throw err;
        }
    } finally {
        try {
            remove(temp);
        } catch {
            // a leftover temporary file is never read as an answer; it changes nothing
        }
    }
    return token;
}

/**
 * Take our own recorded yes back after a failed install. `gone`: no yes of
 * ours remains — removed, or already absent. `other`: the answer on disk
 * carries another token, so it is someone else's and is left alone. `stuck`:
 * our yes is still there (unreadable, or removing it failed) — setup will not
 * offer the tap again, so the caller says so and names the command.
 */
function takeBack(token: string, env?: EnvMap | null, remove = removeRecord): 'gone' | 'other' | 'stuck' {
    let o: { token?: unknown };
    try {
        o = JSON.parse(fs.readFileSync(offerPath(env), 'utf-8')) as { token?: unknown };
    } catch (err) {
        return (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'gone' : 'stuck';
    }
    if (o.token !== token) return 'other';
    try {
        remove(offerPath(env));
        return 'gone';
    } catch {
        return 'stuck';
    }
}

const AFTER_TAKE_BACK = {
    gone: '',
    other: ' The offer was meanwhile answered elsewhere; that answer stands.',
    stuck: ' Your yes is recorded but the tap was not added, so setup will not offer it again; run `agent-config statusline:install` to add it.',
} as const;

export function applyOffer(install: boolean, env?: EnvMap | null, io: OfferIo = {}): { ok: boolean; message: string } {
    if (!install) {
        claimAnswer('declined', env, io);
        return { ok: true, message: 'Not added. `agent-config statusline:install` adds it later.' };
    }
    // The yes is claimed BEFORE the host file is touched: a yes that cannot be
    // recorded throws here and nothing is installed; an install that fails or
    // throws takes its own claim back, so the offer stays open — and when even
    // that fails, the result says so instead of reporting a clean failure.
    const token = claimAnswer('installed', env, io);
    let r: { code: number; message: string };
    try {
        r = installTap(env);
    } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        throw new Error(why + AFTER_TAKE_BACK[takeBack(token, env, io.remove)]);
    }
    if (r.code !== 0) {
        return { ok: false, message: r.message + AFTER_TAKE_BACK[takeBack(token, env, io.remove)] };
    }
    return { ok: true, message: r.message };
}

export interface StatuslineRouteOptions {
    readonly dryRun?: boolean;
    readonly env?: EnvMap | null;
}

export function statuslineRoute(opts: StatuslineRouteOptions = {}): FastifyPluginAsync {
    return async (app: FastifyInstance): Promise<void> => {
        app.get('/api/v1/wizard/statusline', async () => readOffer(opts.env));
        app.post('/api/v1/wizard/statusline', async (request, reply) => {
            const parsed = ApplyBodySchema.safeParse(request.body);
            if (!parsed.success) return reply.code(400).send({ ok: false, message: 'body must be { install: boolean }' });
            if (opts.dryRun === true) {
                return {
                    ok: true,
                    dryRun: true,
                    message: `Dry-run: ${parsed.data.install ? 'would add' : 'would not add'} the status-line tap; nothing was recorded.`,
                };
            }
            // One answer: an offer that is not open refuses with 409, and the
            // exclusive claim in applyOffer settles a race between two answers.
            if (readOffer(opts.env).state !== 'offer') {
                return reply.code(409).send({ ok: false, message: new OfferAnsweredError().message });
            }
            try {
                const r = applyOffer(parsed.data.install, opts.env);
                return reply.code(r.ok ? 200 : 500).send(r);
            } catch (err) {
                const answered = err instanceof OfferAnsweredError;
                return reply.code(answered ? 409 : 500).send({ ok: false, message: err instanceof Error ? err.message : String(err) });
            }
        });
    };
}
