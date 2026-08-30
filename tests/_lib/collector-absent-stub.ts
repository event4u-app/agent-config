/**
 * The collector, ABSENT.
 *
 * `check_static_parity` aliases `src/scripts/_lib/collector_denominator.js` to
 * this file for its second run, so every importer resolves a module that does
 * nothing. That is a truer "absent" than a disabled flag: the real module is
 * not loaded at all, so its imports, its filesystem probes and its very
 * existence are out of the picture — which is what step 4.2 compares against.
 *
 * ## Why this mirrors the WHOLE export surface, not the dispatcher's slice
 *
 * The first version stubbed "only the symbols `dispatch_hook` actually
 * imports", and that policy was structurally wrong (R2 round-4 findings 1 and
 * 2): the vitest alias is a regex over the module specifier, so it rewrites the
 * module for EVERY importer in the run, not for the dispatcher. When a third
 * import was added to the dispatcher, run B died with
 * `TypeError: isSelfObservation is not a function` and the gate went red — and
 * a test in the parity set that imports the real module DIRECTLY would have
 * broken it independently.
 *
 * So the stub mirrors the full surface, and
 * `tests/scripts/collector_absent_stub_parity.test.ts` asserts it stays
 * mirrored. A missing export is then a named test failure rather than a
 * TypeError inside a gate whose message says static operation regressed.
 */

import type { CollectorEvent, CollectorPlatform } from '../../src/scripts/_lib/collector_record.js';

export const DENOMINATOR_FILE_NAME = 'opportunities.log';
export const SPOOL_DIR_NAME = 'spool';
export const SPOOL_PENDING_NAME = 'pending.jsonl';
export const ENABLED_MARKER_NAME = 'ENABLED';
export const MACHINE_ID_NAME = 'machine-id';
export const EPISODE_DIR_NAME = 'episodes';
export const COLLECTOR_VERSION = '1.0.0';
export const SPOOL_MAX_BYTES = 0;

export function denominatorPath(): string {
    return '';
}
export function spoolDir(): string {
    return '';
}
export function spoolPendingPath(): string {
    return '';
}
export function enabledMarkerPath(): string {
    return '';
}
export function machineIdPath(): string {
    return '';
}
export function isCollectorEnabled(): boolean {
    return false;
}
export function enableCollector(): void {
    /* absent */
}
export function disableCollector(): void {
    /* absent */
}
export function isSelfObservation(): boolean {
    // TRUE, not false, and the difference matters. Every caller uses this to
    // decide whether to record; an ABSENT collector records nothing, so `true`
    // is the value that makes the stub behave like absence. `false` would make
    // a stubbed caller take the recording branch into other no-op stubs — the
    // same answer by luck rather than by construction.
    return true;
}
export function utcDate(): string {
    return '1970-01-01';
}
export function machineId(): string | null {
    return null;
}
export function episodeId(): string {
    return '00000000-0000-4000-8000-000000000000';
}
export function nextSequence(): number {
    return 0;
}
export function recordOpportunity(
    _event?: CollectorEvent | string,
    _platform?: CollectorPlatform | string,
): boolean {
    return false;
}
export function recordCapture(
    _event?: CollectorEvent | string,
    _platform?: CollectorPlatform | string,
): boolean {
    return false;
}
export function readOpportunities(): {
    total: number;
    byEvent: Record<string, number>;
    malformed: number;
    firstDate: string | null;
    lastDate: string | null;
} {
    return { total: 0, byEvent: {}, malformed: 0, firstDate: null, lastDate: null };
}
export function pruneOpportunitiesOlderThan(): number {
    return 0;
}
export function pruneEpisodeCounters(): number {
    return 0;
}
export function spoolRecord(): boolean {
    return false;
}
export function claimSpool(): string | null {
    return null;
}
export function readClaimedSpool(): { records: unknown[]; malformed: number; unreadable: boolean } {
    return { records: [], malformed: 0, unreadable: false };
}
