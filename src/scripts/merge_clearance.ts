#!/usr/bin/env node
/**
 * Write and check the merge clearance a `needs-council` pull request needs.
 *
 *   merge_clearance write --pr N --head SHA --base SHA
 *                         --classification FILE --session FILE --prompt FILE
 *   merge_clearance --check N [--head SHA]
 *
 * `write` reads the seats from the council's saved session record and the
 * verdict from the danger gate's output; it takes no verdict from the command
 * line. It refuses a classification other than `needs-council` — `routine`
 * needs no clearance and `needs-owner` is never sent for one — and a session
 * whose `artefact` is not the prompt file given, so the prompt digest names
 * what the seats were actually asked.
 *
 * `--check` exits 0 only when the record named for the pull request's live
 * head exists, parses, re-derives to `cleared` under the committed quorum
 * policy, and names that pull request and head. `--head` additionally pins the
 * head the caller recorded; a live head that moved away from it fails.
 *
 * The record shape and every derivation live in `_lib/merge_clearance_record.ts`.
 *
 * Exit codes: 0 = written / cleared · 1 = not cleared · 2 = usage or input error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    CLEARANCE_DIR,
    clearanceFileName,
    deriveOutcome,
    parseClearance,
    readNeedsCouncilLine,
    renderClearance,
    seatsFromSession,
    sha256,
} from './_lib/merge_clearance_record.js';
import { readRequiredProviders } from './_lib/ratification_artifact.js';

const POLICY_PATH = 'src/config/ratification-policy.json';
const SHA40_RE = /^[0-9a-f]{40}$/u;

type Out = (line: string) => void;

function argValue(argv: readonly string[], flag: string): string | null {
    const i = argv.indexOf(flag);
    if (i === -1) return null;
    const v = argv[i + 1];
    return v === undefined || v.startsWith('--') ? null : v;
}

function readPolicy(root: string): number | null {
    try {
        return readRequiredProviders(fs.readFileSync(path.join(root, POLICY_PATH), 'utf8'));
    } catch {
        return null;
    }
}

function prNumber(raw: string | null): number | null {
    return raw !== null && /^[1-9][0-9]*$/u.test(raw) ? Number(raw) : null;
}

export function writeClearance(argv: readonly string[], root: string, out: Out): number {
    const pr = prNumber(argValue(argv, '--pr'));
    const head = argValue(argv, '--head') ?? '';
    const base = argValue(argv, '--base') ?? '';
    const classification = argValue(argv, '--classification');
    const sessionPath = argValue(argv, '--session');
    const promptPath = argValue(argv, '--prompt');
    if (pr === null || !SHA40_RE.test(head) || !SHA40_RE.test(base) || !classification || !sessionPath || !promptPath) {
        out('merge_clearance: write needs --pr N, full --head and --base, --classification, --session and --prompt');
        return 2;
    }
    const required = readPolicy(root);
    if (required === null) {
        out(`merge_clearance: ${POLICY_PATH} is missing or unreadable — refusing to derive an outcome`);
        return 2;
    }
    let lastLine: string;
    let session: unknown;
    let prompt: string;
    try {
        const lines = fs.readFileSync(classification, 'utf8').trimEnd().split('\n');
        lastLine = lines[lines.length - 1] ?? '';
        session = JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as unknown;
        prompt = fs.readFileSync(promptPath, 'utf8');
    } catch (exc) {
        out(`merge_clearance: cannot read an input — ${String(exc)}`);
        return 2;
    }
    const triggers = readNeedsCouncilLine(lastLine);
    if (triggers === null) {
        out(`merge_clearance: the classification's last line is not \`verdict: needs-council (…)\`: ${lastLine}`);
        return 2;
    }
    const artefact = (session as { artefact?: unknown } | null)?.artefact;
    if (typeof artefact !== 'string' || path.resolve(root, artefact) !== path.resolve(root, promptPath)) {
        out(`merge_clearance: the session's artefact (${String(artefact)}) is not the prompt file ${promptPath}`);
        return 2;
    }
    const seats = seatsFromSession(session);
    if (typeof seats === 'string') {
        out(`merge_clearance: ${seats}`);
        return 2;
    }
    const outcome = deriveOutcome(seats, required);
    const body = renderClearance({
        pr,
        head,
        base,
        classifierVerdict: 'needs-council',
        triggers,
        promptSha256: sha256(prompt),
        seats,
        outcome,
    });
    const rel = path.posix.join(CLEARANCE_DIR, clearanceFileName(pr, head));
    fs.mkdirSync(path.join(root, CLEARANCE_DIR), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body, 'utf8');
    out(`merge_clearance: wrote ${rel}`);
    out(`outcome: ${outcome}`);
    return 0;
}

/** The pull request's live head, from the forge. `null` on any failure. */
export function liveHeadFromForge(pr: number): string | null {
    const r = spawnSync('gh', ['pr', 'view', String(pr), '--json', 'headRefOid', '--jq', '.headRefOid'], {
        encoding: 'utf8',
    });
    const v = r.status === 0 && typeof r.stdout === 'string' ? r.stdout.trim() : '';
    return SHA40_RE.test(v) ? v : null;
}

export function checkClearance(
    opts: { pr: number; liveHead: string | null; pinnedHead: string | null; root: string },
    out: Out,
): number {
    const { pr, liveHead, pinnedHead, root } = opts;
    if (liveHead === null) {
        out(`merge_clearance: not cleared — the live head of #${String(pr)} could not be read`);
        return 1;
    }
    if (pinnedHead !== null && pinnedHead !== liveHead) {
        out(`merge_clearance: not cleared — the live head ${liveHead} is not the recorded head ${pinnedHead}`);
        return 1;
    }
    const required = readPolicy(root);
    if (required === null) {
        out(`merge_clearance: not cleared — ${POLICY_PATH} is missing or unreadable`);
        return 1;
    }
    const rel = path.posix.join(CLEARANCE_DIR, clearanceFileName(pr, liveHead));
    let text: string;
    try {
        text = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
        out(`merge_clearance: not cleared — no record ${rel} for the live head`);
        return 1;
    }
    const parsed = parseClearance(text, required);
    if (Array.isArray(parsed)) {
        out(`merge_clearance: not cleared — ${rel} does not parse:`);
        for (const p of parsed) out(`  ${p}`);
        return 1;
    }
    if (parsed.pr !== pr || parsed.head !== liveHead) {
        out(`merge_clearance: not cleared — ${rel} names #${String(parsed.pr)} at ${parsed.head}`);
        return 1;
    }
    if (parsed.outcome !== 'cleared') {
        out(`merge_clearance: not cleared — ${rel} records \`${parsed.outcome}\``);
        return 1;
    }
    out(`merge_clearance: cleared — #${String(pr)} at ${liveHead}`);
    return 0;
}

export function main(argv: readonly string[] = process.argv.slice(2), out: Out = (l) => process.stdout.write(`${l}\n`)): number {
    const root = process.cwd();
    if (argv[0] === 'write') {
        return writeClearance(argv.slice(1), root, out);
    }
    if (argv.includes('--check')) {
        const pr = prNumber(argValue(argv, '--check'));
        if (pr === null) {
            out('merge_clearance: --check needs a pull request number');
            return 2;
        }
        const pinned = argValue(argv, '--head');
        if (pinned !== null && !SHA40_RE.test(pinned)) {
            out('merge_clearance: --head must be a full 40-hex revision');
            return 2;
        }
        return checkClearance({ pr, liveHead: liveHeadFromForge(pr), pinnedHead: pinned, root }, out);
    }
    out('usage: merge_clearance write --pr N --head SHA --base SHA --classification F --session F --prompt F');
    out('       merge_clearance --check N [--head SHA]');
    return 2;
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main());
}
