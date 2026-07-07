/**
 * Pre-flight validation stage — road-to-flow-learnings Phase 0.
 *
 * Pure-ish (read-only filesystem probes, no writes) validation that runs
 * BEFORE {@link buildInstallPlan} output is applied. Each probe produces a
 * typed {@link PreflightFinding} instead of crashing, so callers (the init
 * CLI's `--validate-only`, the fleet runner, the wizard) can render the
 * full finding list and decide.
 *
 * Severity contract:
 *   - `blocking` — the install would fail or corrupt state; `--validate-only`
 *     exits non-zero on any blocking finding.
 *   - `warning`  — the install can proceed but the operator should look.
 *   - `info`     — context surfaced for the report, never gating.
 */
import { accessSync, constants, existsSync, statSync } from 'node:fs';
import * as fs from 'node:fs';
import { dirname } from 'node:path';
import { buildInstallPlan } from './plan.js';
import { computeConflicts } from './conflict.js';
import { detectToolPresence } from './detect.js';
/** Default free-disk floor: 50 MiB — far above any real payload size. */
export const DEFAULT_DISK_FLOOR_BYTES = 50 * 1024 * 1024;
/** Walk up from `p` to the nearest existing ancestor (inclusive). */
function nearestExistingAncestor(p) {
    let cur = p;
    while (!existsSync(cur)) {
        const parent = dirname(cur);
        if (parent === cur)
            return cur;
        cur = parent;
    }
    return cur;
}
/** Probe 1 — every distinct destination root must be writable (or creatable). */
export function checkPermissions(inputs) {
    const out = [];
    const roots = new Set([inputs.root, ...inputs.sources.map((s) => s.destDir)]);
    for (const root of roots) {
        const probe = nearestExistingAncestor(root);
        try {
            accessSync(probe, constants.W_OK);
        }
        catch {
            out.push({
                id: 'permissions',
                severity: 'blocking',
                path: root,
                message: `target root is not writable (nearest existing ancestor: ${probe})`,
                remedy: `fix permissions on ${probe} or choose a different target`,
            });
        }
        if (existsSync(root)) {
            try {
                if (!statSync(root).isDirectory()) {
                    out.push({
                        id: 'permissions',
                        severity: 'blocking',
                        path: root,
                        message: 'target root exists but is not a directory',
                        remedy: `move or remove the file at ${root}`,
                    });
                }
            }
            catch {
                // statSync raced with a concurrent delete — treat as absent.
            }
        }
    }
    return out;
}
/** Probe 2 — free-disk floor on the volume holding the install root. */
export function checkDiskSpace(inputs, opts = {}) {
    const floor = opts.diskFloorBytes ?? DEFAULT_DISK_FLOOR_BYTES;
    const probe = nearestExistingAncestor(inputs.root);
    // statfsSync is Node >= 18.15; treat absence as "check unavailable",
    // never as a pass or a fail.
    const statfsSync = fs.statfsSync;
    if (typeof statfsSync !== 'function') {
        return [
            {
                id: 'disk-space',
                severity: 'info',
                path: probe,
                message: 'free-disk check unavailable on this Node runtime',
                remedy: '',
            },
        ];
    }
    try {
        const st = statfsSync(probe);
        const free = st.bavail * st.bsize;
        if (free < floor) {
            return [
                {
                    id: 'disk-space',
                    severity: 'blocking',
                    path: probe,
                    message: `free disk ${free} B is below the ${floor} B floor`,
                    remedy: 'free disk space on the target volume, then re-run',
                },
            ];
        }
    }
    catch {
        return [
            {
                id: 'disk-space',
                severity: 'info',
                path: probe,
                message: 'free-disk probe failed (statfs error) — check skipped',
                remedy: '',
            },
        ];
    }
    return [];
}
/** Probe 3 — surface plan conflicts as findings (reuses `computeConflicts`). */
export function checkConflicts(inputs) {
    const plan = buildInstallPlan(inputs);
    const conflicts = computeConflicts(plan);
    return conflicts.map((c) => ({
        id: 'conflicts',
        severity: 'warning',
        path: c.path,
        message: `existing file conflicts with planned ${c.kind} content`,
        remedy: 'resolve interactively, or pass --force to overwrite',
    }));
}
/** Probe 4 — host-detection sanity: report what the target tree looks like. */
export function checkHostDetection(inputs) {
    const presence = detectToolPresence(inputs.root);
    const detected = Object.entries(presence)
        .filter(([, v]) => v === true)
        .map(([k]) => k);
    if (detected.length === 0) {
        return [
            {
                id: 'host-detection',
                severity: 'info',
                path: inputs.root,
                message: 'no AI-tool directories detected at the target root',
                remedy: 'expected for a first global install; verify the target path is right',
            },
        ];
    }
    return [
        {
            id: 'host-detection',
            severity: 'info',
            path: inputs.root,
            message: `detected AI-tool surfaces: ${detected.join(', ')}`,
            remedy: '',
        },
    ];
}
/**
 * Run the full pre-flight suite. Never throws for probe-level problems —
 * every issue is a typed finding. Ordering is stable (probe order above).
 */
export function runPreflight(inputs, opts = {}) {
    return [
        ...checkPermissions(inputs),
        ...checkDiskSpace(inputs, opts),
        ...checkConflicts(inputs),
        ...checkHostDetection(inputs),
    ];
}
/** True when any finding blocks the install (`--validate-only` exit contract). */
export function hasBlockingFinding(findings) {
    return findings.some((f) => f.severity === 'blocking');
}
//# sourceMappingURL=preflight.js.map