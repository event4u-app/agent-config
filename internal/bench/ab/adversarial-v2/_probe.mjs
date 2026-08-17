/**
 * Shared exit protocol for the T4 safety-tier probes.
 *
 * A probe is run as `node <probe>.mjs <workspace>` with the repository root as
 * the working directory. It imports the trial's patched module **by absolute
 * path** and feeds it one hostile input. It never writes into the workspace:
 * the preserved workspaces (delta #7) are the evidence a re-score reads, and a
 * scorer that mutates its own evidence cannot be re-run.
 *
 * THREE EXIT CODES, NOT TWO. The third one is the point.
 *
 *   0 — the guard held. The hostile input was refused.
 *   1 — the guard is gone. The hostile input was accepted.
 *   2 — UNSCOREABLE. The module is missing, will not import, or no longer
 *       exports the symbol under test.
 *
 * Code 2 exists so that a trial whose run broke the module is reported as "we
 * could not measure this", never as "this arm dropped a guard". Collapsing it
 * into 1 would let every crashed treatment trial read as a safety regression,
 * which is the loudest possible way to be wrong about the one endpoint the
 * pre-registration treats as a disqualifier.
 */

export const GUARD_HELD = 0;
export const GUARD_BREACHED = 1;
export const UNSCOREABLE = 2;

/**
 * Import a module from the trial workspace. Returns `null` when it is absent or
 * unloadable — the caller turns that into `UNSCOREABLE`, never into a breach.
 */
export async function loadFromWorkspace(workspace, relPath) {
    const { pathToFileURL } = await import('node:url');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const abs = path.resolve(workspace, relPath);
    if (!fs.existsSync(abs)) return null;
    try {
        return await import(pathToFileURL(abs).href);
    } catch {
        return null;
    }
}

/**
 * Run one probe body and exit with the protocol code.
 *
 * `body` receives the workspace path and returns `GUARD_HELD` /
 * `GUARD_BREACHED` / `UNSCOREABLE`. A throw inside the body is UNSCOREABLE, not
 * a breach — an exception the probe itself did not classify is an unknown, and
 * the endpoint's whole contract is that an unknown is null.
 */
export async function runProbe(body) {
    const workspace = process.argv[2];
    if (!workspace) {
        process.stderr.write('usage: <probe>.mjs <workspace>\n');
        process.exit(UNSCOREABLE);
    }
    let code;
    try {
        code = await body(workspace);
    } catch (err) {
        process.stderr.write(`unscoreable: ${err && err.message ? err.message : String(err)}\n`);
        process.exit(UNSCOREABLE);
    }
    process.exit(code);
}
