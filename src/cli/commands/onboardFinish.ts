/**
 * `agent-config onboard:finish` — TS replacement for the legacy Python
 * `scripts/_cli/cmd_onboard.py`. Phase 1 of
 * `agents/roadmaps/archive/onboard-skill-wizard-convergence.md` per the
 * TypeScript-first policy (`agents/policies/engineering/typescript-first.md`).
 *
 * The chat-side `/onboard` skill collects answers turn by turn (one
 * question per turn — `ask-when-uncertain`), then hands the assembled
 * payload to this subcommand to commit it. The subcommand:
 *
 *   1. Reads JSON from stdin: `{ settings: <nested object>, userMd: <string|null> }`.
 *   2. Loads the existing `.agent-settings.yml` so user-written values and
 *      template comments survive the merge.
 *   3. Calls `mergeIntoTemplate` to apply every leaf in `settings`.
 *   4. Validates `userMd` with `userMdSchema` (gray-matter parse) when present.
 *   5. Commits the dual write atomically via `commitMulti` (2PC marker).
 *
 * Wire shape (stdin JSON):
 *
 *   {
 *     "settings": { "personal": { "user_name": "Matze" }, ... },
 *     "userMd":   "<full markdown body>" | null
 *   }
 *
 * Stdout (one JSON line):
 *
 *   ok=true  → `{ "ok": true, "writtenPaths": [...], "txnId": "<uuid>" }`
 *   ok=false → `{ "ok": false, "error": { "code": "...", "message": "..." } }`
 *
 * Exit codes:
 *   0 — committed
 *   1 — IO or commit failure
 *   2 — invalid invocation / bad payload / validation failure
 *
 * No IPC, no headless server, no port file — this command runs the same
 * commit logic in-process. The wizard's HTTP route (`POST /api/v1/wizard/finish`)
 * still exists for the browser path; both surfaces share `commitMulti`.
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { commitMulti, type CommitPayload } from '../../server/io/atomicMultiWrite.js';
import { mergeIntoTemplate } from '../../server/io/yamlIO.js';
import { userMdSchema } from '../../server/schemas/userMd.js';
import { logger } from '../log/logger.js';

export interface OnboardFinishOptions {
    /** Override the project root (defaults to `process.cwd()`). */
    projectRoot?: string;
}

const SETTINGS_REL = '.agent-settings.yml';
const USER_MD_REL = '.agent-user.md';

export interface OnboardPayload {
    settings: Record<string, unknown>;
    userMd: string | null;
}

export type OnboardCommitResult =
    | { ok: true; writtenPaths: string[]; txnId: string }
    | {
          ok: false;
          error: {
              code: 'SETTINGS_MISSING' | 'VALIDATION' | 'TXN_PARTIAL';
              message: string;
              fields?: Array<{ path: string; message: string }>;
          };
      };

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

function parsePayload(raw: string): OnboardPayload {
    if (raw.trim() === '') throw new Error('payload is empty');
    const json = JSON.parse(raw) as unknown;
    if (json === null || typeof json !== 'object' || Array.isArray(json)) {
        throw new Error('payload must be a JSON object');
    }
    const obj = json as Record<string, unknown>;
    const settings = obj.settings;
    if (settings === null || settings === undefined || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new Error('payload.settings must be an object');
    }
    const userMdRaw = obj.userMd ?? null;
    if (userMdRaw !== null && typeof userMdRaw !== 'string') {
        throw new Error('payload.userMd must be a string or null');
    }
    return { settings: settings as Record<string, unknown>, userMd: userMdRaw };
}

function emit(payload: Record<string, unknown>): void {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
}

/**
 * In-process commit core — shared by the CLI runner below and the
 * `tests/server/onboardFinish_parity.test.ts` parity gate. Returns a
 * tagged result instead of writing to stdout so callers control how
 * the outcome is surfaced.
 */
export async function commitOnboardPayload(
    payload: OnboardPayload,
    projectRoot: string,
): Promise<OnboardCommitResult> {
    const settingsPath = join(projectRoot, SETTINGS_REL);
    let base: string;
    try {
        base = await fs.readFile(settingsPath, 'utf8');
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: { code: 'SETTINGS_MISSING', message } };
    }

    const merged = mergeIntoTemplate(base, payload.settings);

    const commitPayloads: CommitPayload[] = [
        { target: settingsPath, contents: merged, mode: 0o600 },
    ];

    if (payload.userMd !== null) {
        const parsed = userMdSchema.safeParse({ body: payload.userMd });
        if (!parsed.success) {
            const fields = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
            return { ok: false, error: { code: 'VALIDATION', message: 'invalid user-md', fields } };
        }
        commitPayloads.push({
            target: join(projectRoot, USER_MD_REL),
            contents: parsed.data.body,
            mode: 0o600,
        });
    }

    try {
        const { txnId } = await commitMulti(commitPayloads, { projectRoot });
        return { ok: true, writtenPaths: commitPayloads.map((p) => p.target), txnId };
    } catch (err) {
        const message = err instanceof Error ? err.message : '2PC commit failed';
        return { ok: false, error: { code: 'TXN_PARTIAL', message } };
    }
}

export async function runOnboardFinish(opts: OnboardFinishOptions): Promise<number> {
    const projectRoot = resolve(opts.projectRoot ?? process.cwd());

    let raw: string;
    try {
        raw = await readStdin();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`onboard:finish: stdin read failed: ${message}`);
        emit({ ok: false, error: { code: 'STDIN', message } });
        return 2;
    }

    let payload: OnboardPayload;
    try {
        payload = parsePayload(raw);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`onboard:finish: invalid payload: ${message}`);
        emit({ ok: false, error: { code: 'PAYLOAD', message } });
        return 2;
    }

    const result = await commitOnboardPayload(payload, projectRoot);
    if (result.ok) {
        emit({ ok: true, writtenPaths: result.writtenPaths, txnId: result.txnId });
        return 0;
    }
    logger.error(`onboard:finish: ${result.error.code}: ${result.error.message}`);
    emit({ ok: false, error: result.error });
    return result.error.code === 'TXN_PARTIAL' || result.error.code === 'SETTINGS_MISSING' ? 1 : 2;
}
