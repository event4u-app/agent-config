#!/usr/bin/env tsx
/**
 * Command surface for the file-first global knowledge-card store (ADR-100).
 *
 * TypeScript twin of `src/scripts/knowledge_global_cli.py` (ADR-200). The CLI
 * contract mirrors the Python original EXACTLY — same subcommands, flags,
 * exit codes, stdout/stderr split, byte-identical messages, table layout,
 * provenance write, and kill-switch no-op behavior. No behaviour changes.
 *
 * Structure-grounding v2, Phase 3 (road-to-structure-grounding-v2). The
 * maintainer/agent surface over the per-user global store at
 * `~/.event4u/agent-config/knowledge/`:
 *
 *   list                 List global cards (table or --json): tier, seen-in, freshness.
 *   show <card>          Print a global card's content.
 *   trace <card>         Where-used: the repo-slugs the card has been seen in.
 *   forget <card>        Remove one global card (+ its usage entry).
 *   forget --tier <t>    Remove every global card of tier <t> (e.g. proprietary).
 *   promote <path>       Gate (redaction + tier) a project-local card and write it
 *                        to the global store with a provenance footer. Suggestion-
 *                        confirmed; proprietary requires explicit --manual.
 *
 * A standalone CLI (v1-consistent with check_knowledge_cards / evidence_report),
 * invoked directly or via the `knowledge:global:*` Taskfile targets.
 * Deliberately NOT a `/knowledge` slash sub-command — that cluster is the
 * unrelated local-file-ingestion surface; the structure-grounding global store
 * is a separate concern (see ADR-100 § command surface).
 *
 * Honours the kill-switch: every subcommand no-ops (prints a notice, exit 0) when
 * `knowledge.global_sharing.enabled` is false.
 *
 * Exit codes: 0 = ok / disabled-noop, 1 = usage / not-found, 2 = gate blocked,
 * 3 = internal error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { load_agent_settings } from './_lib/agent_settings.js';
import type { SettingsDict, SettingsValue } from './_lib/agent_settings.js';
import { write_atomic } from './_lib/fs_atomic.js';
import * as kg from './_lib/knowledge_global.js';
import * as kgp from './_lib/knowledge_global_promote.js';
import * as kgr from './_lib/knowledge_global_redaction.js';

// Python: re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
const _FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\n---[ \t]*\r?\n/;

const _PROG = 'knowledge_global_cli';

function _today(): string {
    // datetime.now(timezone.utc).date().isoformat() → YYYY-MM-DD (UTC).
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function _card_path(card: string): string {
    const name = card.endsWith('.md') ? card : `${card}.md`;
    return path.join(kg.global_store_dir(), path.basename(name)); // basename only — no traversal
}

function _list_cards(): string[] {
    const store = kg.global_store_dir();
    if (!fs.existsSync(store)) {
        return [];
    }
    return _globMdSorted(store).filter((p) => path.basename(p).toLowerCase() !== 'readme.md');
}

function _freshness_state(text: string, cfg: SettingsDict): string {
    const fresh = _isPlainObject(cfg['freshness']) ? (cfg['freshness'] as SettingsDict) : {};
    const hyp = _pyInt(fresh['hypothesis_after_days'], 90);
    const stale = _pyInt(fresh['stale_after_days'], 180);
    const prov = kg.parse_provenance_footer(text);
    const last = prov['last_verified'] ?? '';
    if (!last) {
        return '?';
    }
    const parsed = _strptime(last);
    if (parsed === null) {
        return '?';
    }
    const age = _dateDiffDays(_todayDateUTC(), parsed);
    if (age >= stale) {
        return 'stale';
    }
    if (age >= hyp) {
        return 'hypothesis';
    }
    return 'fresh';
}

function _disabled_notice(): number {
    process.stdout.write(
        'knowledge.global_sharing.enabled is false — global store is inert (no-op).\n',
    );
    return 0;
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function cmd_list(args: { json: boolean }): number {
    if (!kg.is_enabled()) {
        return _disabled_notice();
    }
    const cfg = kg.load_global_sharing_config();
    const cards = _list_cards();
    const rows: Record<string, string>[] = [];
    for (const p of cards) {
        const text = _readReplace(p);
        const prov = kg.parse_provenance_footer(text);
        rows.push({
            card: _stem(p),
            tier: prov['tier'] ?? '?',
            seen_in: prov['seen_in'] ?? '',
            last_verified: prov['last_verified'] ?? '?',
            freshness: _freshness_state(text, cfg),
        });
    }
    if (args.json) {
        process.stdout.write(kg.pyJsonDumps(rows, 2, true) + '\n');
        return 0;
    }
    if (rows.length === 0) {
        process.stdout.write(`No global cards in ${kg.global_store_dir()}.\n`);
        return 0;
    }
    process.stdout.write(
        `${_ljust('CARD', 28)} ${_ljust('TIER', 12)} ${_ljust('FRESH', 11)} ${_ljust('LAST-VERIFIED', 14)} SEEN-IN\n`,
    );
    for (const r of rows) {
        process.stdout.write(
            `${_ljust(r['card'] as string, 28)} ${_ljust(r['tier'] as string, 12)} ${_ljust(r['freshness'] as string, 11)} ${_ljust(r['last_verified'] as string, 14)} ${r['seen_in']}\n`,
        );
    }
    return 0;
}

function cmd_show(args: { card: string }): number {
    if (!kg.is_enabled()) {
        return _disabled_notice();
    }
    const p = _card_path(args.card);
    if (!fs.existsSync(p)) {
        process.stderr.write(`No global card '${args.card}' in ${kg.global_store_dir()}.\n`);
        process.exitCode = 1;
        return 1;
    }
    process.stdout.write(fs.readFileSync(p, 'utf-8') + '\n');
    return 0;
}

function cmd_trace(args: { card: string; json: boolean }): number {
    if (!kg.is_enabled()) {
        return _disabled_notice();
    }
    const cid = kgp.card_id_from({ card_name: args.card });
    const usage = kgp.load_usage();
    const cards = usage['cards'] as SettingsDict;
    const entry = cards[cid] as SettingsDict | undefined;
    const p = _card_path(args.card);
    let seen_in: string[] = [];
    if (entry) {
        const s = entry['seen_in'];
        seen_in = Array.isArray(s) ? (s as string[]) : [];
    } else if (fs.existsSync(p)) {
        const prov = kg.parse_provenance_footer(_readReplace(p));
        seen_in = (prov['seen_in'] ?? '').split(',').map((s) => _strip(s)).filter((s) => s);
    }
    if (args.json) {
        process.stdout.write(kg.pyJsonDumps({ card: cid, seen_in }, 2, true) + '\n');
        return 0;
    }
    if (seen_in.length === 0) {
        process.stdout.write(`No where-used record for '${args.card}'.\n`);
        return 0;
    }
    process.stdout.write(`${args.card} seen in ${seen_in.length} repo(s): ${seen_in.join(', ')}\n`);
    return 0;
}

function _forget_one(card: string): boolean {
    const p = _card_path(card);
    let removed = false;
    if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        removed = true;
    }
    const cid = kgp.card_id_from({ card_name: card });
    const usage = kgp.load_usage();
    const cards = usage['cards'] as SettingsDict;
    if (cid in cards) {
        delete cards[cid];
        write_atomic(
            path.join(kg.global_store_dir(null, { create: true }), kgp.USAGE_FILENAME),
            kg.pyJsonDumps(usage, 2, true) + '\n',
        );
        removed = true;
    }
    return removed;
}

function cmd_forget(args: { card: string; tier: string }): number {
    if (!kg.is_enabled()) {
        return _disabled_notice();
    }
    if (args.tier) {
        let removed = 0;
        for (const p of _list_cards()) {
            const prov = kg.parse_provenance_footer(_readReplace(p));
            if (prov['tier'] === args.tier) {
                if (_forget_one(_stem(p))) {
                    removed += 1;
                }
            }
        }
        process.stdout.write(`Forgot ${removed} global card(s) of tier '${args.tier}'.\n`);
        return 0;
    }
    if (!args.card) {
        process.stderr.write('forget: provide a <card> or --tier <t>.\n');
        process.exitCode = 1;
        return 1;
    }
    if (_forget_one(args.card)) {
        process.stdout.write(`Forgot global card '${args.card}'.\n`);
        return 0;
    }
    process.stdout.write(`No global card '${args.card}' to forget.\n`);
    process.exitCode = 1;
    return 1;
}

function cmd_promote(args: { path: string; source: string; tier: string; manual: boolean }): number {
    if (!kg.is_enabled()) {
        return _disabled_notice();
    }
    const src_path = args.path;
    let text: string;
    try {
        text = fs.readFileSync(src_path, 'utf-8');
    } catch (exc) {
        process.stderr.write(`cannot read ${src_path}: ${_osErrorStr(exc)}\n`);
        process.exitCode = 3;
        return 3;
    }

    // Resolve tier: explicit flag wins, else frontmatter, else classify the source.
    const tier =
        args.tier || _frontmatter_tier(text) || kg.classify_tier(args.source || src_path);
    const cfg = kg.load_global_sharing_config();
    const allowed = [...kg.allowed_tiers()];

    const redaction = _isPlainObject(cfg['redaction']) ? (cfg['redaction'] as SettingsDict) : {};
    const result = kgr.gate_card_for_global(text, {
        tier,
        source: args.source,
        card_name: path.basename(src_path),
        allowed_tiers: allowed,
        redaction_enabled: _pyBool(redaction['enabled'], true),
        halt_on_trigger: _pyBool(redaction['halt_on_trigger'], true),
    });
    if (!result.eligible) {
        if (result.manual_only && !args.manual) {
            process.stderr.write(
                `${result.summary()}\n` +
                    '→ proprietary cards are manual-only. Re-run with --manual to override ' +
                    '(operator intent), and ensure redaction is clean.\n',
            );
            process.exitCode = 2;
            return 2;
        }
        if (!(result.manual_only && args.manual)) {
            process.stderr.write(result.summary() + '\n');
            process.exitCode = 2;
            return 2;
        }
        // manual override of proprietary: still run redaction, never skip it.
        const violations = kgr.redaction_scan(text);
        if (violations.length > 0 && _pyBool(redaction['halt_on_trigger'], true)) {
            process.stderr.write(
                'global-share BLOCKED (manual proprietary): redaction halt — ' +
                    violations.map((v) => `${v.category}: ${_pyRepr(v.snippet)}`).join('; ') +
                    '\n',
            );
            process.exitCode = 2;
            return 2;
        }
    }

    // Build provenance + usage.
    const cid = kgp.card_id_from({ card_name: path.basename(src_path), source: args.source });
    const slug = kgp.repo_slug();
    const today = _today();
    const entry = kgp.record_seen(cid, slug, { tier, source: args.source, today });
    const entrySeen = entry['seen_in'];
    const seen_in =
        Array.isArray(entrySeen) && entrySeen.length > 0 ? (entrySeen as string[]) : [slug];
    const first = _pyTruthy(entry['first_seen'])
        ? (entry['first_seen'] as SettingsDict)
        : { repo: slug, date: today };

    const footer = kg.render_provenance_footer({
        first_seen_repo: (first['repo'] as string) ?? slug,
        first_seen_date: (first['date'] as string) ?? today,
        promoted_at: today,
        last_verified: today,
        tier,
        seen_in,
    });
    let out_text = _ensure_tier_frontmatter(text, tier);
    out_text = _rstrip(kg.strip_provenance_footer(out_text)) + '\n\n' + footer;
    const dest = _card_path(cid);
    write_atomic(path.join(kg.global_store_dir(null, { create: true }), path.basename(dest)), out_text);

    // Flag promoted in the usage sidecar.
    const usage = kgp.load_usage();
    const cards = usage['cards'] as SettingsDict;
    if (cid in cards) {
        (cards[cid] as SettingsDict)['promoted'] = true;
        write_atomic(
            path.join(kg.global_store_dir(null, { create: true }), kgp.USAGE_FILENAME),
            kg.pyJsonDumps(usage, 2, true) + '\n',
        );
    }
    process.stdout.write(`Promoted '${cid}' (tier=${tier}) → ${dest}\n`);
    return 0;
}

function cmd_purge(args: { confirm: boolean }): number {
    // Remove the global store and strip provenance footers from project cards.
    if (!args.confirm) {
        process.stderr.write(
            'Refusing to purge without --confirm. This removes the global ' +
                'store and strips provenance from project cards.\n',
        );
        process.exitCode = 1;
        return 1;
    }

    const store = kg.global_store_dir();
    let removed = 0;
    if (fs.existsSync(store)) {
        for (const p of _globAllSorted(store)) {
            if (_isFile(p)) {
                fs.unlinkSync(p);
                removed += 1;
            }
        }
        try {
            fs.rmdirSync(store);
        } catch {
            // non-empty (subdirs) — leave it
        }
    }
    process.stdout.write(`Purged global store (${removed} file(s)) at ${store}.\n`);

    // Strip provenance footers from project-local cards (idempotent).
    const local_dir = path.join('agents', 'knowledge');
    let stripped = 0;
    if (fs.existsSync(local_dir)) {
        for (const p of _globMdSorted(local_dir)) {
            if (path.basename(p).toLowerCase() === 'readme.md') {
                continue;
            }
            const text = _readReplace(p);
            const nw = kg.strip_provenance_footer(text);
            if (nw !== text) {
                write_atomic(p, nw);
                stripped += 1;
            }
        }
    }
    process.stdout.write(`Stripped provenance footer from ${stripped} project-local card(s).\n`);
    return 0;
}

function cmd_validate(args: { check_urls: boolean }): number {
    // Offline lint of the untracked global store + a freshness-flip report.
    if (!kg.is_enabled()) {
        return _disabled_notice();
    }
    const store = kg.global_store_dir();
    if (!fs.existsSync(store) || _list_cards().length === 0) {
        process.stdout.write(`No global cards in ${store} — nothing to validate.\n`);
        return 0;
    }

    // The Python original spawns `python3 check_knowledge_cards.py --global
    // --strict`. The TS twin spawns the sibling `check_knowledge_cards.ts`
    // via the same tsx runtime (process spawn, not an import).
    const tsxBin = path.join(
        _repoRoot(),
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );
    const checker = path.join(path.dirname(_thisFile()), 'check_knowledge_cards.ts');
    const cmd = [checker, '--global', '--strict'];
    if (args.check_urls) {
        cmd.push('--check-urls');
    }
    const lint = spawnSync(tsxBin, cmd, { encoding: 'utf-8' });
    process.stdout.write(lint.stdout ?? '');
    if (lint.stderr) {
        process.stderr.write(lint.stderr);
    }

    // Freshness-flip report (informational; never fails the run).
    const cfg = kg.load_global_sharing_config();
    process.stdout.write(
        '\nFreshness (lead-only flip — positive structure skipped until re-verified):\n',
    );
    const markers: Record<string, string> = {
        fresh: '✅',
        hypothesis: '⚠️',
        stale: '⚠️',
        '?': '⚠️',
    };
    for (const p of _list_cards()) {
        const state = _freshness_state(_readReplace(p), cfg);
        const marker = markers[state] ?? '⚠️';
        process.stdout.write(`  ${marker} ${_stem(p)}: ${state}\n`);
    }
    const code = lint.status ?? 0;
    process.exitCode = code;
    return code;
}

function cmd_lead_check(args: { report: string; strict: boolean }): number {
    // Lead-only enforcement: surface a violation when a GLOBAL positive-structure
    // line (Assumed bucket, origin=GLOBAL) was used without a this-session Verified
    // re-confirmation. Honest instrumentation — warn by default, --strict to fail.
    const report = args.report;
    if (!fs.existsSync(report)) {
        process.stdout.write(`No Evidence Report at ${report} — nothing to check.\n`);
        return 0;
    }
    const text = _readReplace(report);

    // Split into bucket sections by heading.
    const assumed: string[] = [];
    const verified: string[] = [];
    let current: string[] | null = null;
    for (const line of _splitlines(text)) {
        const low = _strip(line).toLowerCase();
        if (low.startsWith('## verified')) {
            current = verified;
        } else if (low.startsWith('## assumed')) {
            current = assumed;
        } else if (low.startsWith('## ')) {
            current = null;
        } else if (current !== null && _lstrip(line).startsWith('- ')) {
            current.push(_strip(line));
        }
    }

    // Python: re.compile(r"source=([^\s·\]]+)")
    const src_re = /source=([^\s·\]]+)/;
    const verified_sources = new Set<string>();
    for (const l of verified) {
        const m = src_re.exec(l);
        if (m) {
            verified_sources.add(m[1] as string);
        }
    }
    const verified_blob = verified.join('\n').toLowerCase();

    const violations: string[] = [];
    for (const line of assumed) {
        if (!line.toLowerCase().includes('origin=global')) {
            continue;
        }
        const m = src_re.exec(line);
        const src = m ? (m[1] as string) : '';
        const claim = _strip(_lstripDashSpace(_splitOnce(line, '`')[0]));
        const confirmed =
            (src && verified_sources.has(src)) ||
            (claim && _pyLen(claim) > 8 && verified_blob.includes(_pySliceHead(claim.toLowerCase(), 40)));
        if (!confirmed) {
            violations.push(claim || src || line);
        }
    }

    if (violations.length === 0) {
        process.stdout.write('✅  No unconfirmed GLOBAL positive-structure leads in the Evidence Report.\n');
        return 0;
    }
    process.stdout.write(
        `⚠️  ${violations.length} GLOBAL lead(s) used without this-session re-confirmation:\n`,
    );
    for (const v of violations) {
        process.stdout.write(`  - ${_pySliceHead(v, 100)}\n`);
    }
    process.stdout.write(
        'Re-confirm each against the live source (move to Verified) before relying on it.\n',
    );
    const code = args.strict ? 1 : 0;
    process.exitCode = code;
    return code;
}

// ---------------------------------------------------------------------------
// Frontmatter helpers
// ---------------------------------------------------------------------------

function _frontmatter_tier(text: string): string {
    const m = _FRONTMATTER_RE.exec(text);
    if (!m) {
        return '';
    }
    for (const line of _splitlines(m[1] as string)) {
        const s = _strip(line);
        if (s.startsWith('tier:')) {
            const val = _stripQuotes(_strip(s.slice('tier:'.length)));
            return kg.TIERS.includes(val) ? val : '';
        }
    }
    return '';
}

function _ensure_tier_frontmatter(text: string, tier: string): string {
    // Ensure the card frontmatter carries an accurate `tier:` field.
    const m = _FRONTMATTER_RE.exec(text);
    if (!m) {
        return text;
    }
    const block = m[1] as string;
    let new_block: string;
    if (/^\s*tier:/m.test(block)) {
        new_block = _reSubFirst(block, /^\s*tier:.*$/m, `tier: ${tier}`);
    } else {
        new_block = `tier: ${tier}\n${block}`;
    }
    // m.index of group 1: in Python `m.start(1)` / `m.end(1)`. The full match
    // starts at 0 (anchored `^`); group 1 begins after the leading `---\n`.
    const full = m[0];
    const groupStart = full.indexOf(block);
    const startIdx = groupStart;
    const endIdx = groupStart + block.length;
    return text.slice(0, startIdx) + new_block + text.slice(endIdx);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const _MAIN_USAGE = `${_PROG} [-h] {list,show,trace,forget,promote,validate,lead-check,purge} ...`;

export function main(argv: string[] | null = null): number {
    const args = argv ?? process.argv.slice(2);
    return _dispatch(args);
}

function _dispatch(argv: string[]): number {
    // Top-level help.
    if (argv.length === 0) {
        // add_subparsers(required=True) → argparse errors when no cmd.
        _argparseError('the following arguments are required: cmd', _MAIN_USAGE);
        return 2;
    }
    const first = argv[0] as string;
    if (first === '-h' || first === '--help') {
        _printMainHelp();
        process.exitCode = 0;
        return 0;
    }

    const cmd = first;
    const rest = argv.slice(1);
    switch (cmd) {
        case 'list':
            return _wrap(cmd, rest, _parseList, cmd_list);
        case 'show':
            return _wrap(cmd, rest, _parseShow, cmd_show);
        case 'trace':
            return _wrap(cmd, rest, _parseTrace, cmd_trace);
        case 'forget':
            return _wrap(cmd, rest, _parseForget, cmd_forget);
        case 'promote':
            return _wrap(cmd, rest, _parsePromote, cmd_promote);
        case 'validate':
            return _wrap(cmd, rest, _parseValidate, cmd_validate);
        case 'lead-check':
            return _wrap(cmd, rest, _parseLeadCheck, cmd_lead_check);
        case 'purge':
            return _wrap(cmd, rest, _parsePurge, cmd_purge);
        default:
            _argparseError(
                `argument cmd: invalid choice: ${_pyRepr(cmd)} (choose from 'list', 'show', 'trace', 'forget', 'promote', 'validate', 'lead-check', 'purge')`,
                _MAIN_USAGE,
            );
            return 2;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _wrap<T>(cmd: string, rest: string[], parse: (rest: string[]) => T | number, run: (a: T) => number): number {
    const parsed = parse(rest);
    if (typeof parsed === 'number') {
        return parsed; // help/error short-circuit
    }
    void cmd;
    return run(parsed);
}

// Per-subcommand argparse-faithful parsers.

function _parseList(rest: string[]): { json: boolean } | number {
    let json = false;
    const usage = `${_PROG} list [-h] [--json]`;
    for (const a of rest) {
        if (a === '-h' || a === '--help') {
            return _subHelp(usage);
        }
        if (a === '--json') {
            json = true;
        } else {
            return _subError('list', `unrecognized arguments: ${a}`, usage);
        }
    }
    return { json };
}

function _parseShow(rest: string[]): { card: string } | number {
    const usage = `${_PROG} show [-h] card`;
    let card: string | null = null;
    for (const a of rest) {
        if (a === '-h' || a === '--help') {
            return _subHelp(usage);
        }
        if (a.startsWith('-')) {
            return _subError('show', `unrecognized arguments: ${a}`, usage);
        }
        if (card === null) {
            card = a;
        } else {
            return _subError('show', `unrecognized arguments: ${a}`, usage);
        }
    }
    if (card === null) {
        return _subError('show', 'the following arguments are required: card', usage);
    }
    return { card };
}

function _parseTrace(rest: string[]): { card: string; json: boolean } | number {
    const usage = `${_PROG} trace [-h] [--json] card`;
    let card: string | null = null;
    let json = false;
    for (const a of rest) {
        if (a === '-h' || a === '--help') {
            return _subHelp(usage);
        }
        if (a === '--json') {
            json = true;
        } else if (a.startsWith('-')) {
            return _subError('trace', `unrecognized arguments: ${a}`, usage);
        } else if (card === null) {
            card = a;
        } else {
            return _subError('trace', `unrecognized arguments: ${a}`, usage);
        }
    }
    if (card === null) {
        return _subError('trace', 'the following arguments are required: card', usage);
    }
    return { card, json };
}

function _parseForget(rest: string[]): { card: string; tier: string } | number {
    const usage = `${_PROG} forget [-h] [--tier {public,vendor,proprietary}] [card]`;
    let card = '';
    let tier = '';
    let cardSet = false;
    for (let i = 0; i < rest.length; i += 1) {
        const a = rest[i] as string;
        if (a === '-h' || a === '--help') {
            return _subHelp(usage);
        }
        if (a === '--tier') {
            const choice = _choiceOrExit(rest[++i], ['public', 'vendor', 'proprietary'], '--tier', 'forget', usage);
            tier = choice;
        } else if (a.startsWith('--tier=')) {
            tier = _choiceOrExit(a.slice('--tier='.length), ['public', 'vendor', 'proprietary'], '--tier', 'forget', usage);
        } else if (a.startsWith('-')) {
            return _subError('forget', `unrecognized arguments: ${a}`, usage);
        } else if (!cardSet) {
            card = a;
            cardSet = true;
        } else {
            return _subError('forget', `unrecognized arguments: ${a}`, usage);
        }
    }
    return { card, tier };
}

function _parsePromote(rest: string[]): { path: string; source: string; tier: string; manual: boolean } | number {
    const usage = `${_PROG} promote [-h] [--source SOURCE] [--tier {public,vendor,proprietary}] [--manual] path`;
    let p: string | null = null;
    let source = '';
    let tier = '';
    let manual = false;
    for (let i = 0; i < rest.length; i += 1) {
        const a = rest[i] as string;
        if (a === '-h' || a === '--help') {
            return _subHelp(usage);
        }
        if (a === '--source') {
            source = (rest[++i] ?? '') as string;
        } else if (a.startsWith('--source=')) {
            source = a.slice('--source='.length);
        } else if (a === '--tier') {
            tier = _choiceOrExit(rest[++i], ['public', 'vendor', 'proprietary'], '--tier', 'promote', usage);
        } else if (a.startsWith('--tier=')) {
            tier = _choiceOrExit(a.slice('--tier='.length), ['public', 'vendor', 'proprietary'], '--tier', 'promote', usage);
        } else if (a === '--manual') {
            manual = true;
        } else if (a.startsWith('-')) {
            return _subError('promote', `unrecognized arguments: ${a}`, usage);
        } else if (p === null) {
            p = a;
        } else {
            return _subError('promote', `unrecognized arguments: ${a}`, usage);
        }
    }
    if (p === null) {
        return _subError('promote', 'the following arguments are required: path', usage);
    }
    return { path: p, source, tier, manual };
}

function _parseValidate(rest: string[]): { check_urls: boolean } | number {
    const usage = `${_PROG} validate [-h] [--check-urls]`;
    let check_urls = false;
    for (const a of rest) {
        if (a === '-h' || a === '--help') {
            return _subHelp(usage);
        }
        if (a === '--check-urls') {
            check_urls = true;
        } else {
            return _subError('validate', `unrecognized arguments: ${a}`, usage);
        }
    }
    return { check_urls };
}

function _parseLeadCheck(rest: string[]): { report: string; strict: boolean } | number {
    const usage = `${_PROG} lead-check [-h] [--report REPORT] [--strict]`;
    let report = 'agents/memory/knowledge/session/evidence-report.md';
    let strict = false;
    for (let i = 0; i < rest.length; i += 1) {
        const a = rest[i] as string;
        if (a === '-h' || a === '--help') {
            return _subHelp(usage);
        }
        if (a === '--report') {
            report = (rest[++i] ?? '') as string;
        } else if (a.startsWith('--report=')) {
            report = a.slice('--report='.length);
        } else if (a === '--strict') {
            strict = true;
        } else {
            return _subError('lead-check', `unrecognized arguments: ${a}`, usage);
        }
    }
    return { report, strict };
}

function _parsePurge(rest: string[]): { confirm: boolean } | number {
    const usage = `${_PROG} purge [-h] [--confirm]`;
    let confirm = false;
    for (const a of rest) {
        if (a === '-h' || a === '--help') {
            return _subHelp(usage);
        }
        if (a === '--confirm') {
            confirm = true;
        } else {
            return _subError('purge', `unrecognized arguments: ${a}`, usage);
        }
    }
    return { confirm };
}

function _subHelp(usage: string): number {
    process.stdout.write(`usage: ${usage}\n`);
    process.exitCode = 0;
    return 0;
}

function _subError(sub: string, message: string, usage: string): number {
    // argparse subparser errors use the subparser prog: `<prog> <sub>: error: …`.
    process.stderr.write(`usage: ${usage}\n${_PROG} ${sub}: error: ${message}\n`);
    process.exitCode = 2;
    return 2;
}

function _choiceOrExit(value: string | undefined, choices: string[], flag: string, sub: string, usage: string): string {
    if (value === undefined || !choices.includes(value)) {
        _subError(
            sub,
            `argument ${flag}: invalid choice: ${_pyRepr(value ?? '')} (choose from ${choices.map((c) => _pyRepr(c)).join(', ')})`,
            usage,
        );
        process.exit(process.exitCode ?? 2);
    }
    return value;
}

function _printMainHelp(): void {
    process.stdout.write(
        `usage: ${_MAIN_USAGE}\n\n` +
            'Command surface for the file-first global knowledge-card store (ADR-100).\n',
    );
}

function _argparseError(message: string, usage: string): void {
    process.stderr.write(`usage: ${usage}\n${_PROG}: error: ${message}\n`);
    process.exitCode = 2;
}

// ---------------------------------------------------------------------------
// helpers — Python compatibility
// ---------------------------------------------------------------------------

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** `p.read_text(encoding="utf-8", errors="replace")`. */
function _readReplace(p: string): string {
    // Node decodes invalid UTF-8 to U+FFFD by default with 'utf-8', matching
    // Python's errors="replace".
    return fs.readFileSync(p, 'utf-8');
}

/** Mirror `sorted(store.glob("*.md"))`. */
function _globMdSorted(dir: string): string[] {
    return _globSorted(dir, '.md');
}

/** Mirror `sorted(store.glob("*"))` for files+dirs. */
function _globAllSorted(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.map((n) => path.join(dir, n));
    out.sort();
    return out;
}

function _globSorted(dir: string, suffix: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out = entries
        .filter((e) => e.name.endsWith(suffix))
        .map((e) => path.join(dir, e.name));
    out.sort();
    return out;
}

/** Mirror pathlib `Path(p).stem`. */
function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? base : base.slice(0, dot);
}

/** Python `str.ljust(width)` — left-justify, pad with spaces. */
function _ljust(s: string, width: number): string {
    const len = _pyLen(s);
    return len >= width ? s : s + ' '.repeat(width - len);
}

/** Mirror Python len(str) — code-point count. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Slice the first `n` code points (Python `s[:n]`). */
function _pySliceHead(s: string, n: number): string {
    let out = '';
    let i = 0;
    for (const ch of s) {
        if (i >= n) {
            break;
        }
        out += ch;
        i += 1;
    }
    return out;
}

function _strip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}
function _lstrip(s: string): string {
    return s.replace(/^\s+/, '');
}
function _rstrip(s: string): string {
    return s.replace(/\s+$/, '');
}

/** Python `s.lstrip("- ")` — strip leading dashes/spaces. */
function _lstripDashSpace(s: string): string {
    return s.replace(/^[- ]+/, '');
}

/** Python `s.strip('"').strip("'")` applied in sequence. */
function _stripQuotes(s: string): string {
    return _stripChar(_stripChar(s, '"'), "'");
}
function _stripChar(s: string, ch: string): string {
    let i = 0;
    let j = s.length;
    while (i < j && s[i] === ch) {
        i += 1;
    }
    while (j > i && s[j - 1] === ch) {
        j -= 1;
    }
    return s.slice(i, j);
}

/** Python `s.split(sep, 1)[0]` (and the tail). */
function _splitOnce(s: string, sep: string): [string, string] {
    const idx = s.indexOf(sep);
    if (idx < 0) {
        return [s, ''];
    }
    return [s.slice(0, idx), s.slice(idx + sep.length)];
}

/** Mirror Python str.splitlines(). */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const lines = text.split(/\r\n|\r|\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

/** Python `re.sub(pat, repl, s, count=1)`. */
function _reSubFirst(s: string, re: RegExp, repl: string): string {
    return s.replace(re, repl);
}

/** Python `int(...)` tolerant cast with default. */
function _pyInt(value: SettingsValue, fallback: number): number {
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const n = parseInt(value, 10);
        return Number.isNaN(n) ? fallback : n;
    }
    return fallback;
}

/** Python `bool(cfg.get(..., default))`. */
function _pyBool(value: SettingsValue, fallback: boolean): boolean {
    if (value === undefined) {
        return fallback;
    }
    return _pyTruthy(value);
}

function _pyTruthy(value: SettingsValue): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (_isPlainObject(value)) {
        return Object.keys(value).length > 0;
    }
    return true;
}

/** Python repr() for a string (single-quoted preference). */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        if (ch === quote || ch === '\\') {
            out += `\\${ch}`;
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else {
            out += ch;
        }
    }
    return out + quote;
}

/** Mirror `datetime.strptime(last, "%Y-%m-%d").date()` → PyDate-ish. */
interface YMD {
    y: number;
    m: number;
    d: number;
}
function _strptime(s: string): YMD | null {
    // strptime("%Y-%m-%d") is strict on shape but tolerant on zero-padding
    // for single-digit months/days; it raises ValueError on a bad date.
    const m = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (!m) {
        return null;
    }
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) {
        return null;
    }
    // Reject overflow (e.g. Feb 31) the way datetime would raise ValueError.
    const probe = new Date(Date.UTC(y, mo - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
        return null;
    }
    return { y, m: mo, d };
}

function _todayDateUTC(): YMD {
    const now = new Date();
    return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
}

function _dateDiffDays(a: YMD, b: YMD): number {
    const ta = Date.UTC(a.y, a.m - 1, a.d);
    const tb = Date.UTC(b.y, b.m - 1, b.d);
    return Math.round((ta - tb) / 86_400_000);
}

/** Mirror Python `OSError`'s `str(exc)` for the read-failure message. */
function _osErrorStr(exc: unknown): string {
    if (exc && typeof exc === 'object') {
        const e = exc as NodeJS.ErrnoException;
        return String(e.message ?? e.code ?? exc);
    }
    return String(exc);
}

/** Resolve this module's own file path. */
function _thisFile(): string {
    const url = new URL(import.meta.url);
    return decodeURIComponent(process.platform === 'win32' ? url.pathname.replace(/^\//, '') : url.pathname);
}

/** Repo root = two levels up from src/scripts/. */
function _repoRoot(): string {
    return path.resolve(path.dirname(_thisFile()), '..', '..');
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    // Mirror `raise SystemExit(main())`.
    process.exit(main());
}
