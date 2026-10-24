/**
 * Promote the claude rule layer after proof, never at install
 * (road-to-a-setup-that-decides-itself step 3.3).
 *
 * An install writes the full layer, exactly as before. A LATER session whose
 * evidence satisfies the layer-form decision thins it for the sessions after
 * it: the `layer-promote` concern calls {@link sessionLayerStep} on
 * `session_start`. Nothing here thins the session that is running — its rules
 * are already loaded — which is also why a promotion can never change what the
 * session that took the decision reads.
 *
 * OFF UNTIL STEP 5.3. `src/config/layer-form-promotion.json` ships
 * `enabled: false`, and an unreadable switch reads as off. Step 5.3 flips it on
 * a non-inferior pre-registered comparison and cites the result there; until
 * then the decision still runs in `doctor` as a shadow and nothing on disk
 * moves. The switch is package-owned and shipped, never a settings key.
 *
 * DEMOTION RUNS WHATEVER THE SWITCH SAYS. A thinned layer whose arrival record —
 * taken after the promotion — shows a standing law missing is restored from
 * the staged snapshot and the machine is demoted, as a dead carrier demotes it
 * in the shell branch of `claude_settings_hooks`. Only files carrying the
 * package stamp are overwritten, missing ones are added, none is removed.
 * Restoring is the safe direction, so no switch may stand in front of it.
 *
 * THE OWNERSHIP LEDGER FOLLOWS THE BYTES. The installer decides whether a file
 * was edited by comparing it with the digest it recorded. A layer rewritten
 * after the install would read as edited everywhere, and the next install would
 * preserve every stub as a user modification. Each file this module rewrites
 * has its recorded digest moved to the new bytes, so the next install sees
 * its own file and writes the full layer again — "a fresh install writes the
 * full layer" stays true after a promotion. A file whose bytes already
 * differed from the record before the pass is a user edit and is left alone.
 *
 * LATENCY. The budget is the shipped `any_hook_event` p95 of
 * `hook-latency-budget.json`. A promotion is attempted only when the time
 * already spent plus the last measured thin pass (or {@link DEFAULT_THIN_ESTIMATE_MS}
 * before the first one) fits inside it; otherwise it is left to a later session.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as global_deploy_inventory from '../scripts/_lib/global_deploy_inventory.js';
import { read_lockfile, lockfile_path } from '../scripts/_lib/installed_lock.js';
import { arrivalEvidence, arrivalsDirUnder, latestArrivalRecord, readObserverLines } from '../scripts/_lib/arrival_record.js';
import { decideLayerForm, gatherShippedEvidence, ruleForm } from '../scripts/_lib/layer_form_decision.js';
import { readMachineEvidence, withMachineEvidence } from '../scripts/_lib/layer_form_evidence.js';
import { readConsequenceClass } from '../scripts/_lib/rule_consequence_class.js';
import { thinInstalledRuleLayer } from './installThinLayer.js';
import { CLAUDE_LAYER_DIRNAME, DEMOTED_MARKER, PACKAGE_STAMP_LINE, THINNED_MARKER, currentRuntimeDir, markClaudeLayer, readCarrierState, runtimeRootFor, } from './stagedRuntime.js';
export const PROMOTION_SWITCH_REL = path.join('src', 'config', 'layer-form-promotion.json');
export const PROMOTION_RECORD = 'promotion.json';
/**
 * The promotion lock: created exclusively before the thin pass, removed after
 * the promotion record. It names its owner (`<pid> <ms since epoch>`), so a
 * concurrent session can tell a pass still running — skip, touch nothing — from
 * one whose owner is gone or older than {@link PROMOTING_STALE_MS} — recover.
 */
export const PROMOTING_MARKER = 'promoting';
/** Far beyond any real pass (11 ms measured, 250-ms budget); only a dead owner gets this old. */
export const PROMOTING_STALE_MS = 30_000;
function ownerAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (e) {
        return e.code === 'EPERM';
    }
}
/** Is the lock at `file` held by a live, recent owner? An unreadable lock is treated as held. */
export function promotionLockLive(file, nowMs = Date.now()) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    }
    catch {
        return true;
    }
    const [pid, at] = text.trim().split(/\s+/).map(Number);
    if (!Number.isInteger(pid) || !Number.isFinite(at))
        return nowMs - fs.statSync(file).mtimeMs < PROMOTING_STALE_MS;
    return nowMs - at < PROMOTING_STALE_MS && ownerAlive(pid);
}
export const LATENCY_BUDGET_REL = path.join('src', 'config', 'hook-latency-budget.json');
/** Measured 11 ms for the thin pass over 121 rules (tsx, warm, 2026-10-24); the default is that plus margin. */
export const DEFAULT_THIN_ESTIMATE_MS = 50;
const FALLBACK_BUDGET_MS = 250;
const LEDGER_TOOL = 'claude-code';
function readJson(file) {
    try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : null;
    }
    catch {
        return null;
    }
}
/** `true` only when the shipped switch says exactly `enabled: true`. */
export function promotionEnabled(packageRoot) {
    return readJson(path.join(packageRoot, PROMOTION_SWITCH_REL))?.['enabled'] === true;
}
export function readPromotionRecord(runtimeRoot) {
    const o = readJson(path.join(runtimeRoot, PROMOTION_RECORD));
    if (o === null || typeof o['promoted_at'] !== 'string')
        return null;
    return {
        promoted_at: o['promoted_at'],
        version: typeof o['version'] === 'string' ? o['version'] : 'unknown',
        last_thin_ms: typeof o['last_thin_ms'] === 'number' ? o['last_thin_ms'] : DEFAULT_THIN_ESTIMATE_MS,
    };
}
export function latencyBudgetMs(packageRoot) {
    const budgets = readJson(path.join(packageRoot, LATENCY_BUDGET_REL))?.['budgets_ms'];
    const p95 = budgets?.['any_hook_event']?.['p95_ci'];
    return typeof p95 === 'number' && p95 > 0 ? p95 : FALLBACK_BUDGET_MS;
}
function versionOf(dir) {
    const v = readJson(path.join(dir, 'package.json'))?.['version'];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}
/** The version the global install recorded — the install that wrote the layer on disk. */
function layerVersion(env) {
    const v = read_lockfile(lockfile_path(env))?.agent_config_version;
    return typeof v === 'string' && v.trim() !== '' ? v.trim().replace(/^v+/, '') : null;
}
/** The decision for the claude layer on this machine, with the two version facts filled in. */
export function decideClaudeLayer(packageRoot, env) {
    const payload = versionOf(packageRoot);
    const shipped = gatherShippedEvidence(packageRoot, payload ?? 'unknown')('claude-code');
    const input = withMachineEvidence(shipped, readMachineEvidence(packageRoot, env));
    return decideLayerForm({ ...input, payloadVersion: payload, layerVersion: layerVersion(env) });
}
/**
 * Ledger records for the claude anchor, or `null` when the ledger holds no
 * entry for this rules directory — then nothing proves which bytes are ours,
 * and nothing is rewritten.
 */
function ledgerFor(rulesDir, env) {
    const file = global_deploy_inventory.inventory_path(env);
    const inventory = global_deploy_inventory.load_inventory(file);
    const anchor = path.dirname(rulesDir);
    const recorded = global_deploy_inventory.recorded_digests(LEDGER_TOOL, anchor, inventory);
    return recorded.size === 0 ? null : { inventory, file, recorded };
}
function relOf(rulesDir, file) {
    return `${path.basename(rulesDir)}/${path.basename(file)}`;
}
/** Move the recorded digest of each rewritten file to its new bytes, and save the ledger. */
function rerecord(rulesDir, files, env) {
    const ledger = ledgerFor(rulesDir, env);
    if (ledger === null || files.length === 0)
        return;
    const tools = ledger.inventory['tools'];
    const digests = tools[LEDGER_TOOL]?.['digests'];
    if (digests === undefined)
        return;
    for (const file of files) {
        const rel = relOf(rulesDir, file);
        const onDisk = global_deploy_inventory.file_sha256(file);
        if (onDisk === null || !(rel in digests))
            continue;
        digests[rel] = { installed_sha256: onDisk, packaged_sha256: onDisk };
    }
    global_deploy_inventory.save_inventory(ledger.inventory, ledger.file);
}
/**
 * Files the thin pass must skip: any file the ledger does not record as this
 * package's with exactly these bytes — unrecorded or edited — and every rule
 * {@link ruleForm} keeps `full`.
 */
function keptWhole(rulesDir, recorded, decision, never) {
    const out = new Set();
    let names = [];
    try {
        names = fs.readdirSync(rulesDir).filter((n) => n.endsWith('.md'));
    }
    catch {
        return out;
    }
    for (const name of names) {
        const file = path.join(rulesDir, name);
        const rec = recorded.get(relOf(rulesDir, file));
        // No record means no proof the file is ours; a record that differs means the user edited it.
        const notOurs = rec === undefined || global_deploy_inventory.file_sha256(file) !== rec.installed_sha256;
        if (notOurs || ruleForm(name.slice(0, -3), decision, never) === 'full')
            out.add(path.resolve(file));
    }
    return out;
}
/**
 * The rules a thinned layer still carries whole (step 3.1): the consequence
 * class and the `safety-floor` tier, read from the staged package. The thin pass
 * would reduce them to stub-plus-law; the decision's contract is `full`.
 */
export function neverThinned(packageRoot) {
    const safetyFloor = new Set();
    const dir = path.join(packageRoot, 'dist', 'agent-src', 'rules');
    let names = [];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
    }
    catch {
        // No bodies to read a tier from: the thin pass reads the same directory and finds nothing either.
    }
    for (const name of names) {
        const text = fs.readFileSync(path.join(dir, name), 'utf8');
        const end = text.indexOf('\n---', 3);
        if (text.startsWith('---') && end > 0 && /^tier:\s*["']?safety-floor["']?\s*$/m.test(text.slice(0, end))) {
            safetyFloor.add(name.slice(0, -3));
        }
    }
    return { consequenceClass: new Set(Object.keys(readConsequenceClass(packageRoot).members)), safetyFloor };
}
/**
 * Restore the staged full layer into `rulesDir`: overwrite only stamped files,
 * add missing ones, remove none — the shell branch's rule. Returns the files
 * written, or `null` when the snapshot is missing.
 */
export function restoreStagedLayer(packageRoot, rulesDir) {
    const snapshot = path.join(packageRoot, CLAUDE_LAYER_DIRNAME);
    let names;
    try {
        names = fs.readdirSync(snapshot).filter((n) => n.endsWith('.md')).sort();
    }
    catch {
        return null;
    }
    const written = [];
    for (const name of names) {
        const target = path.join(rulesDir, name);
        if (fs.existsSync(target) && !fs.readFileSync(target, 'utf8').split(/\r?\n/).includes(PACKAGE_STAMP_LINE))
            continue;
        const tmp = `${target}.ac-restore`;
        fs.copyFileSync(path.join(snapshot, name), tmp);
        fs.renameSync(tmp, target);
        written.push(target);
    }
    return written;
}
/**
 * Where post-promotion evidence starts: the recorded promotion time, else the
 * thinned marker's own mtime. Never "no boundary" — a record missing, torn or
 * malformed must not let a session from before the promotion decide on it.
 */
function promotionBoundary(runtimeRoot) {
    const record = readPromotionRecord(runtimeRoot);
    if (record !== null && !Number.isNaN(Date.parse(record.promoted_at)))
        return new Date(record.promoted_at).toISOString();
    try {
        return fs.statSync(path.join(runtimeRoot, THINNED_MARKER)).mtime.toISOString();
    }
    catch {
        return null;
    }
}
function thinnedDir(runtimeRoot) {
    try {
        const first = fs.readFileSync(path.join(runtimeRoot, THINNED_MARKER), 'utf8').split('\n')[0]?.trim() ?? '';
        return first === '' ? null : first;
    }
    catch {
        return null;
    }
}
/** Does the arrival record taken after the promotion show a standing law missing? */
function standingLawMissingSince(runtimeRoot, packageRoot, env, since) {
    const lines = readObserverLines(arrivalsDirUnder(runtimeRoot)).filter((l) => l.ts > since);
    const evidence = arrivalEvidence(latestArrivalRecord(lines), readMachineEvidence(packageRoot, env).standingLaws);
    return evidence !== null && !evidence.standingLawsLoaded;
}
/**
 * One session's step: demote a thinned layer an arrival record contradicts,
 * or promote a full one the decision says may be thinned. Never throws.
 */
export function sessionLayerStep(opts = {}) {
    const env = opts.env ?? process.env;
    const now = opts.now ?? (() => performance.now());
    const started = opts.startedAt ?? now();
    try {
        const runtimeRoot = runtimeRootFor(env);
        let packageRoot;
        try {
            packageRoot = fs.realpathSync(currentRuntimeDir(runtimeRoot));
        }
        catch {
            return { action: 'none', reason: 'no-staged-runtime' };
        }
        const home = env['HOME'] ?? os.homedir();
        const promoting = path.join(runtimeRoot, PROMOTING_MARKER);
        if (fs.existsSync(promoting)) {
            // A pass still running in another session is left alone.
            if (promotionLockLive(promoting))
                return { action: 'none', reason: 'promotion-in-progress' };
            // Its owner is gone: claim the recovery by one rename, so two sessions never both restore.
            const claim = `${promoting}.recover-${process.pid}`;
            try {
                fs.renameSync(promoting, claim);
            }
            catch {
                return { action: 'none', reason: 'promotion-in-progress' };
            }
            const rulesDir = thinnedDir(runtimeRoot) ?? opts.rulesDir ?? path.join(home, '.claude', 'rules');
            rerecord(rulesDir, restoreStagedLayer(packageRoot, rulesDir) ?? [], env);
            markClaudeLayer(runtimeRoot, { thinned: false, rulesDir });
            fs.rmSync(claim, { force: true });
            return { action: 'none', reason: 'promotion-interrupted' };
        }
        const state = readCarrierState(runtimeRoot);
        if (state.layer === 'thinned') {
            const since = promotionBoundary(runtimeRoot);
            if (since === null || !standingLawMissingSince(runtimeRoot, packageRoot, env, since)) {
                return { action: 'none', reason: 'thinned-holds' };
            }
            const rulesDir = thinnedDir(runtimeRoot) ?? opts.rulesDir ?? path.join(home, '.claude', 'rules');
            const written = restoreStagedLayer(packageRoot, rulesDir);
            if (written === null)
                return { action: 'none', reason: 'snapshot-missing' };
            rerecord(rulesDir, written, env);
            fs.renameSync(path.join(runtimeRoot, THINNED_MARKER), path.join(runtimeRoot, DEMOTED_MARKER));
            return { action: 'demoted', reason: 'arrival-standing-law-missing' };
        }
        if (state.layer === 'demoted')
            return { action: 'none', reason: 'demoted' };
        if (!promotionEnabled(packageRoot))
            return { action: 'none', reason: 'promotion-disabled' };
        const decision = decideClaudeLayer(packageRoot, env);
        if (decision.form !== 'thinned')
            return { action: 'none', reason: decision.reason };
        const rulesDir = opts.rulesDir ?? path.join(home, '.claude', 'rules');
        const ledger = ledgerFor(rulesDir, env);
        if (ledger === null)
            return { action: 'none', reason: 'no-ledger' };
        const estimate = readPromotionRecord(runtimeRoot)?.last_thin_ms ?? DEFAULT_THIN_ESTIMATE_MS;
        if (now() - started + estimate > latencyBudgetMs(packageRoot))
            return { action: 'skipped', reason: 'over-latency-budget' };
        // Both markers go first. `promoting` makes an interrupted pass visible to
        // the next session, which restores it; `thinned` lets the shell branch
        // restore it on a dead carrier meanwhile. `promoting` goes last, after the record.
        const lock = path.join(runtimeRoot, PROMOTING_MARKER);
        const token = `${process.pid} ${Date.now()}\n`;
        try {
            fs.writeFileSync(lock, token, { flag: 'wx' });
        }
        catch {
            return { action: 'none', reason: 'promotion-in-progress' };
        }
        const stillOurs = () => {
            try {
                return fs.readFileSync(lock, 'utf8') === token;
            }
            catch {
                return false;
            }
        };
        markClaudeLayer(runtimeRoot, { thinned: true, rulesDir });
        const rewritten = [];
        const t0 = now();
        let failed = true;
        try {
            const res = thinInstalledRuleLayer({
                rulesDir,
                packageRoot,
                bodyLinkRoot: packageRoot,
                preserved: keptWhole(rulesDir, ledger.recorded, decision, neverThinned(packageRoot)),
                onWrite: (target) => rewritten.push(target),
            });
            failed = res.failed.length > 0;
        }
        finally {
            if (failed) {
                rerecord(rulesDir, restoreStagedLayer(packageRoot, rulesDir) ?? [], env);
                if (stillOurs()) {
                    markClaudeLayer(runtimeRoot, { thinned: false, rulesDir });
                    fs.rmSync(lock, { force: true });
                }
            }
        }
        if (failed)
            return { action: 'none', reason: 'thin-failed' };
        const thinMs = Math.max(1, Math.round(now() - t0));
        // A recovery took the lock meanwhile: it is restoring, so this pass records nothing.
        if (!stillOurs())
            return { action: 'none', reason: 'promotion-preempted' };
        rerecord(rulesDir, rewritten, env);
        const record = {
            promoted_at: (opts.date ?? (() => new Date()))().toISOString(),
            version: versionOf(packageRoot) ?? 'unknown',
            last_thin_ms: thinMs,
        };
        fs.writeFileSync(path.join(runtimeRoot, PROMOTION_RECORD), `${JSON.stringify(record, null, 2)}\n`);
        fs.rmSync(lock, { force: true });
        return { action: 'promoted', reason: decision.reason };
    }
    catch {
        return { action: 'none', reason: 'error' };
    }
}
//# sourceMappingURL=layerPromotion.js.map