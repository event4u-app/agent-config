#!/usr/bin/env node
/**
 * A council model pin cannot notice its own age. This gate is what notices.
 *
 * THE DEFECT IT EXISTS FOR. The starter council config shipped a dated,
 * several-generation-old model id on an **enabled** member — the seat a quality
 * council actually reviews with — and nothing in the file could flag it: a grep
 * for `verified_at` or `stale` over the template returned two prose comments and
 * no key. The pin was unversioned and unstamped, so it rotted silently for as
 * long as nobody happened to re-read a template.
 *
 * WHAT IT DOES NOT DO, and this is the honest half: it cannot tell whether a
 * pinned id is current. That needs the provider's own listing, which lives
 * outside this tree and changes on the provider's schedule. It reports how long
 * ago a **human** last said they looked. A stamp is a claim about attention, not
 * about correctness, and treating it as the second would be worse than no stamp.
 *
 * SENTINELS ARE EXEMPT, BY DESIGN. A member on `codex-default`, or on a vendor
 * alias the provider documents as "the latest model" in a band (`claude --help`:
 * 'fable', 'opus', 'sonnet'), delegates the version decision to the vendor CLI
 * and cannot go stale. Demanding a date there would be asking for a refresh
 * nobody would ever perform, which is how a gate teaches its reader to ignore
 * it.
 *
 * Mirrors `check_corpus_staleness` rather than inventing a second idiom:
 * offline, deterministic, and the clock is INJECTABLE via `--today YYYY-MM-DD`
 * so a fixture cannot flip verdict with the calendar. A future date is its own
 * violation class — a stamp ahead of today is not "very fresh", it is a typo or
 * a fabrication, and collapsing it into the fresh path would hide exactly the
 * case worth catching.
 *
 * Exit: 0 clean or advisory-only, 1 on a violation, 2 on a usage error
 * (unparsable config, bad --today, or a dead scan scope).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Days before a stamped pin is called stale. */
export const CADENCE_DAYS = 100;

/**
 * Vendor sentinels and "latest in band" aliases — a member on one of these
 * cannot go stale, so it needs no stamp.
 *
 * The alias set is READ FROM the provider's own CLI surface (`claude --help`
 * documents 'fable', 'opus' and 'sonnet' as aliases for the latest model), not
 * from the agent's recall. That distinction is the one the roadmap behind this
 * gate names as its top risk: a plausible-sounding id typed from memory is
 * indistinguishable from a real one at review time.
 */
export const SENTINEL_MODELS: ReadonlySet<string> = new Set([
    'codex-default',
    'fable',
    'opus',
    'sonnet',
    'haiku',
]);

export type Verdict = 'fresh' | 'sentinel' | 'unstamped' | 'stale' | 'future-date' | 'malformed';

export interface PinRow {
    member: string;
    model: string;
    verified_at: string | null;
    enabled: boolean;
    verdict: Verdict;
    age_days: number | null;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a `YYYY-MM-DD` into a UTC epoch-day, or null when it is not a real date. */
export function epochDay(s: string): number | null {
    const m = DATE_RE.exec(s);
    if (m === null) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const t = Date.UTC(y, mo - 1, d);
    const probe = new Date(t);
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() + 1 !== mo || probe.getUTCDate() !== d) {
        return null;
    }
    return Math.floor(t / 86400000);
}

/** Classify one member. Pure — the unit under `--self-test`. */
export function classify(
    member: string,
    model: string,
    verified_at: string | null,
    enabled: boolean,
    today: string,
): PinRow {
    const base: Omit<PinRow, 'verdict' | 'age_days'> = { member, model, verified_at, enabled };
    if (SENTINEL_MODELS.has(model.trim().toLowerCase())) {
        return { ...base, verdict: 'sentinel', age_days: null };
    }
    if (verified_at === null || verified_at.trim() === '') {
        return { ...base, verdict: 'unstamped', age_days: null };
    }
    const stamp = epochDay(verified_at);
    if (stamp === null) return { ...base, verdict: 'malformed', age_days: null };
    const now = epochDay(today);
    if (now === null) throw new Error(`--today must be a real YYYY-MM-DD date (got ${today})`);
    const age = now - stamp;
    if (age < 0) return { ...base, verdict: 'future-date', age_days: age };
    return { ...base, verdict: age > CADENCE_DAYS ? 'stale' : 'fresh', age_days: age };
}

/**
 * Read the members out of a council YAML without a YAML dependency.
 *
 * Deliberately line-based and deliberately narrow: it reads `members:` two
 * levels deep, which is the whole shape this gate needs. A full parser would
 * pull a dependency into a gate whose entire job is to be runnable offline in
 * any checkout.
 */
export function parseMembers(text: string): { member: string; model: string; verified_at: string | null; enabled: boolean }[] {
    const lines = text.split('\n');
    const out: { member: string; model: string; verified_at: string | null; enabled: boolean }[] = [];
    let inMembers = false;
    let cur: { member: string; model: string; verified_at: string | null; enabled: boolean } | null = null;
    for (const raw of lines) {
        const line = raw.replace(/\t/g, '  ');
        if (/^members:\s*$/.test(line)) {
            inMembers = true;
            continue;
        }
        if (!inMembers) continue;
        // A non-indented, non-empty, non-comment line ends the block.
        if (line.trim() !== '' && !line.startsWith(' ') && !line.trimStart().startsWith('#')) break;
        const head = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
        if (head !== null) {
            if (cur !== null) out.push(cur);
            cur = { member: String(head[1]), model: '', verified_at: null, enabled: false };
            continue;
        }
        if (cur === null) continue;
        const kv = /^ {4}([a-z_]+):\s*(.+?)\s*$/.exec(line);
        if (kv === null) continue;
        const k = String(kv[1]);
        const v = String(kv[2]).replace(/^['"]|['"]$/g, '');
        if (k === 'model') cur.model = v;
        else if (k === 'verified_at') cur.verified_at = v;
        else if (k === 'enabled') cur.enabled = v === 'true';
    }
    if (cur !== null) out.push(cur);
    return out.filter((m) => m.model !== '');
}

function selfTest(): number {
    const T = '2026-08-22';
    const cases: [string, string, string | null, Verdict][] = [
        ['a sentinel needs no stamp', 'codex-default', null, 'sentinel'],
        ['a vendor alias needs no stamp', 'sonnet', null, 'sentinel'],
        ['a dated pin with no stamp is unstamped', 'gemini-2.5-pro', null, 'unstamped'],
        ['a stamp inside the cadence is fresh', 'gemini-2.5-pro', '2026-08-01', 'fresh'],
        ['a stamp past the cadence is stale', 'gemini-2.5-pro', '2026-01-01', 'stale'],
        // 100 exactly is fresh; 101 is not. A cadence met on the day it comes
        // due is met — the same boundary `check_corpus_staleness` uses.
        ['the cadence boundary is inclusive', 'gemini-2.5-pro', '2026-05-14', 'fresh'],
        ['a future stamp is its own class, not "very fresh"', 'gemini-2.5-pro', '2027-01-01', 'future-date'],
        ['an impossible date is malformed, not stale', 'gemini-2.5-pro', '2026-02-30', 'malformed'],
        ['a non-date is malformed', 'gemini-2.5-pro', 'soon', 'malformed'],
    ];
    let pass = 0;
    let fail = 0;
    for (const [name, model, stamp, want] of cases) {
        const got = classify('m', model, stamp, true, T).verdict;
        if (got === want) pass += 1;
        else {
            fail += 1;
            console.error(`❌ ${name}: want ${want}, got ${got}`);
        }
    }
    // The parser is the other half that can silently return nothing.
    const parsed = parseMembers(
        'members:\n  anthropic:\n    enabled: true\n    model: sonnet\n  gemini:\n    enabled: false\n    model: gemini-2.5-pro\n    verified_at: 2026-08-22\n',
    );
    if (parsed.length === 2 && parsed[1]?.verified_at === '2026-08-22' && parsed[0]?.enabled === true) {
        pass += 1;
    } else {
        fail += 1;
        console.error(`❌ parseMembers: got ${JSON.stringify(parsed)}`);
    }
    process.stdout.write(`check_council_pin_staleness --self-test: ${pass} pass, ${fail} fail\n`);
    return fail === 0 ? 0 : 1;
}

function main(argv: string[]): number {
    if (argv.includes('--self-test')) return selfTest();
    const ti = argv.indexOf('--today');
    const today =
        ti >= 0 && argv[ti + 1] !== undefined
            ? String(argv[ti + 1])
            : new Date().toISOString().slice(0, 10);
    if (epochDay(today) === null) {
        process.stderr.write(`--today must be a real YYYY-MM-DD date (got ${today})\n`);
        return 2;
    }
    const fi = argv.indexOf('--file');
    const file =
        fi >= 0 && argv[fi + 1] !== undefined
            ? String(argv[fi + 1])
            : path.join(process.cwd(), 'agents/templates/.ai-council.yml.example');
    if (!fs.existsSync(file)) {
        process.stderr.write(`no council config at ${file}\n`);
        return 2;
    }
    const members = parseMembers(fs.readFileSync(file, 'utf-8'));
    if (members.length === 0) {
        // A dead scan scope is a usage error, never a pass. "0 stale pins" over
        // 0 members read is the failure this exit code exists to separate.
        process.stderr.write(`no members with a model: read from ${file} — dead scan scope\n`);
        return 2;
    }
    const rows = members.map((m) => classify(m.member, m.model, m.verified_at, m.enabled, today));
    const bad = rows.filter((r) => r.verdict === 'stale' || r.verdict === 'future-date' || r.verdict === 'malformed');
    const unstamped = rows.filter((r) => r.verdict === 'unstamped');

    for (const r of rows) {
        const age = r.age_days === null ? '—' : `${r.age_days}d`;
        process.stdout.write(
            `  ${r.verdict.padEnd(11)} ${r.member.padEnd(12)} ${r.model.padEnd(20)} ${age}${r.enabled ? '' : '  (disabled)'}\n`,
        );
    }
    process.stdout.write(`scanned: ${rows.length}\n`);
    if (bad.length > 0) {
        process.stdout.write(
            `❌  ${bad.length} pin(s) need attention (cadence ${CADENCE_DAYS}d). A stamp records when a human last\n` +
                `    checked the pin against the provider's own surface — refresh the pin or the date, and prefer a\n` +
                `    vendor sentinel where one exists: a sentinel cannot go stale, so it never needs a stamp.\n`,
        );
        return 1;
    }
    if (unstamped.length > 0) {
        process.stdout.write(
            `⚠️  ${unstamped.length} dated pin(s) carry no verified_at — advisory. Add a stamp, or move the member to a\n` +
                `    vendor sentinel and it drops out of this gate entirely.\n`,
        );
    }
    process.stdout.write('✅  council model pins within cadence.\n');
    return 0;
}

if (process.argv[1] !== undefined && process.argv[1].includes('check_council_pin_staleness')) {
    process.exit(main(process.argv.slice(2)));
}
