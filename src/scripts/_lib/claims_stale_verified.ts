/**
 * Stale `last_verified` in the claims ledger (road-to-rewrites-that-keep-their-
 * facts 3.3). A claim that says "two figures moved on 2026-09-07" while recording
 * `last_verified: 2026-07-11` dates its verification to before the change it
 * describes — the field is then a statement nobody re-checked. Dates after
 * `today` are plans, not changes, and are ignored.
 *
 * A ratchet, not a hard zero: the entries it revealed at introduction carry
 * backed claims whose re-verification is owner work (a narrowed claim or a
 * re-measurement), never a date bumped to silence the gate.
 */
import * as fs from 'node:fs';

import { checkRatchet } from './gate_baseline.js';

export interface DatedEntry {
    id: string;
    claim: string;
    last_verified: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function stale_last_verified<E extends DatedEntry>(entries: Iterable<E>, today: string): Array<{ entry: E; newest: string }> {
    const out: Array<{ entry: E; newest: string }> = [];
    for (const e of entries) {
        if (!ISO.test(e.last_verified)) continue;
        const named = (e.claim.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []).filter((d) => d <= today).sort();
        const newest = named[named.length - 1];
        if (newest !== undefined && newest > e.last_verified) out.push({ entry: e, newest });
    }
    return out;
}

/** The ratchet verdict as a finding reason (null when within baseline) plus the always-printed report. */
export function staleVerifiedVerdict(
    entries: Iterable<DatedEntry>,
    today: string,
    repoRoot: string,
    baselinesPath: string,
): { reason: string | null; report: string } {
    const stale = stale_last_verified(entries, today);
    const list = stale.map((x) => `${x.entry.id} (${x.entry.last_verified} < ${x.newest})`);
    const verdict = fs.existsSync(baselinesPath)
        ? checkRatchet({ gate: 'check_claims:stale-last-verified', actual: stale.length, repoRoot })
        : { ok: true, message: '' };
    const report =
        stale.length === 0
            ? ''
            : `⚠️  Stale last_verified: ${stale.length} claim(s) older than a date they name (ratchet, reported)\n` +
              stale.map((x) => `      ${x.entry.id} — last_verified ${x.entry.last_verified} < ${x.newest}\n`).join('');
    const reason = verdict.ok ? null : `${verdict.message} — last_verified older than a date the claim names: ${list.join(', ')}`;
    return { reason, report };
}
