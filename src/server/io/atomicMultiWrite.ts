/**
 * Multi-file atomic write with a 2PC intent marker.
 *
 * The wizard commits `.agent-settings.yml` and `.agent-user.md` in one
 * gesture. A crash between the two renames would leave the project in a
 * mixed state — settings new, user-md stale, or vice versa — which the
 * council's HIGH-severity finding flagged as the worst case.
 *
 * Protocol (write phase):
 *   1. Write every payload to its `<target>.tmp-<txnId>` sibling, fsync.
 *   2. Write a `state/wizard-intent-<txnId>.json` marker listing the
 *      `{tmp,target}` pairs. fsync the marker.
 *   3. For each pair: rename tmp → target.
 *   4. Unlink the marker.
 *
 * Crash recovery (replay on next boot, `replayPendingCommits`):
 *   - Marker present + every `tmp` exists → finish the renames, unlink.
 *   - Marker present + any `tmp` missing → assume aborted mid-prepare:
 *     unlink the leftover tmps and the marker (target untouched).
 *
 * State dir lives under `<writeRoot>/state/` — in package-sandbox mode
 * `writeRoot` is `<repo>/agents/`, so the marker dir is the gitignored
 * `agents/runtime/state/` already shipped by the package gitignore template. In
 * global mode `writeRoot` is `~/.event4u/agent-config/` and the marker
 * dir lives outside any project tree.
 */

import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { tempPathFor } from './atomicWrite.js';

export interface CommitPayload {
    /** Absolute path to the final target file. */
    target: string;
    /** New file contents. */
    contents: string | Buffer;
    /** POSIX mode applied after rename. Default 0600. */
    mode?: number;
}

export interface CommitOptions {
    /** Write root — the state/marker dir resolves under `<writeRoot>/state/`. */
    writeRoot: string;
    /** Override the generated UUID (tests only). */
    txnId?: string;
}

interface MarkerEntry {
    tmp: string;
    target: string;
    mode: number;
}

interface Marker {
    version: 1;
    txnId: string;
    createdAt: string;
    entries: MarkerEntry[];
}

const DEFAULT_MODE = 0o600;
const STATE_SUBDIR = 'state';

function markerPath(writeRoot: string, txnId: string): string {
    return join(writeRoot, STATE_SUBDIR, `wizard-intent-${txnId}.json`);
}

async function fsyncFile(path: string): Promise<void> {
    const handle = await fs.open(path, 'r+');
    try {
        await handle.sync();
    } finally {
        await handle.close();
    }
}

async function writeJsonFsync(path: string, body: unknown): Promise<void> {
    await fs.mkdir(dirname(path), { recursive: true });
    const handle = await fs.open(path, 'w', 0o600);
    try {
        await handle.writeFile(JSON.stringify(body, null, 2));
        await handle.sync();
    } finally {
        await handle.close();
    }
}

/**
 * Commit every payload atomically. Resolves only after the marker has
 * been unlinked — meaning every rename succeeded. On error, the caller
 * sees the original files untouched; replay handles any leftover tmps.
 */
export async function commitMulti(
    payloads: CommitPayload[],
    opts: CommitOptions,
): Promise<{ txnId: string }> {
    if (payloads.length === 0) {
        throw new Error('commitMulti: at least one payload required');
    }
    const txnId = opts.txnId ?? randomUUID();
    const entries: MarkerEntry[] = payloads.map((p) => ({
        tmp: tempPathFor(p.target, txnId),
        target: p.target,
        mode: p.mode ?? DEFAULT_MODE,
    }));

    // Phase 1: write every tmp with fsync. Ensure parent dirs exist
    // (payloads may target nested subdirs like `settings/.agent-user.yml`).
    for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i]!;
        const entry = entries[i]!;
        const { contents } = payload;
        const { tmp, mode } = entry;
        await fs.mkdir(dirname(entry.target), { recursive: true });
        const handle = await fs.open(tmp, 'w', mode);
        try {
            const buf = typeof contents === 'string' ? Buffer.from(contents, 'utf8') : contents;
            await handle.writeFile(buf);
            await handle.sync();
        } finally {
            await handle.close();
        }
    }

    // Phase 2: write intent marker, fsync.
    const marker: Marker = {
        version: 1,
        txnId,
        createdAt: new Date().toISOString(),
        entries,
    };
    const mPath = markerPath(opts.writeRoot, txnId);
    await writeJsonFsync(mPath, marker);

    // Phase 3: rename every tmp → target. A crash here is recoverable
    // because the marker still points at every pending rename.
    try {
        for (const entry of entries) {
            try {
                await fs.rename(entry.tmp, entry.target);
            } catch (err) {
                if ((err as NodeJS.ErrnoException).code === 'EPERM') {
                    await fs.unlink(entry.target).catch(() => undefined);
                    await fs.rename(entry.tmp, entry.target);
                } else {
                    throw err;
                }
            }
            await fs.chmod(entry.target, entry.mode).catch(() => undefined);
        }
    } catch (err) {
        // Mid-commit failure: leave the marker for replay, surface the error.
        throw err;
    }

    // Phase 4: marker no longer needed.
    await fs.unlink(mPath).catch(() => undefined);
    await fsyncFile(dirname(mPath)).catch(() => undefined);
    return { txnId };
}

export interface ReplayResult {
    completed: string[];
    aborted: string[];
}

/**
 * Replay pending commit-intent markers at boot. For each marker:
 *   - Every tmp exists → finish the renames (commit was in-flight).
 *   - Any tmp missing → assume aborted; unlink leftover tmps and the
 *     marker (target was never touched).
 *
 * Idempotent: safe to call on every server start. Never throws on a
 * single corrupted marker — that marker is skipped and reported via
 * the returned arrays so the caller can log and continue.
 */
export async function replayPendingCommits(writeRoot: string): Promise<ReplayResult> {
    const stateDir = join(writeRoot, STATE_SUBDIR);
    let names: string[];
    try {
        names = await fs.readdir(stateDir);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { completed: [], aborted: [] };
        throw err;
    }
    const completed: string[] = [];
    const aborted: string[] = [];
    for (const name of names) {
        if (!name.startsWith('wizard-intent-') || !name.endsWith('.json')) continue;
        const mPath = join(stateDir, name);
        let marker: Marker;
        try {
            const raw = await fs.readFile(mPath, 'utf8');
            marker = JSON.parse(raw) as Marker;
            if (marker.version !== 1 || !Array.isArray(marker.entries)) throw new Error('bad marker');
        } catch {
            aborted.push(name);
            await fs.unlink(mPath).catch(() => undefined);
            continue;
        }

        const presence = await Promise.all(
            marker.entries.map(async (e) =>
                fs
                    .stat(e.tmp)
                    .then(() => true)
                    .catch(() => false),
            ),
        );
        const allTmpsPresent = presence.every(Boolean);

        if (allTmpsPresent) {
            try {
                for (const entry of marker.entries) {
                    try {
                        await fs.rename(entry.tmp, entry.target);
                    } catch (err) {
                        if ((err as NodeJS.ErrnoException).code === 'EPERM') {
                            await fs.unlink(entry.target).catch(() => undefined);
                            await fs.rename(entry.tmp, entry.target);
                        } else {
                            throw err;
                        }
                    }
                    await fs.chmod(entry.target, entry.mode).catch(() => undefined);
                }
                await fs.unlink(mPath).catch(() => undefined);
                completed.push(marker.txnId);
            } catch {
                aborted.push(marker.txnId);
            }
        } else {
            for (const entry of marker.entries) {
                await fs.unlink(entry.tmp).catch(() => undefined);
            }
            await fs.unlink(mPath).catch(() => undefined);
            aborted.push(marker.txnId);
        }
    }
    return { completed, aborted };
}
