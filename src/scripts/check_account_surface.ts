#!/usr/bin/env tsx
/**
 * `check_account_surface` — a lexical, offline, read-only audit of a consumer
 * repository's account-flow code (`road-to-account-surface-detector` Phase 2).
 *
 * It reports only what a local pattern proves. A class finding no pattern is
 * listed as undecided, never as a passing surface: a regex that sees nothing
 * has not seen a safe login. Until `claim:account-surface-finds-planted` is
 * backed, every finding is printed as unmeasured.
 *
 * Remediation classes bind to `active-remediation`: `mechanical` is a fix that
 * reuses a primitive the project already has and invents no policy, so it is a
 * fix-now candidate; `policy` and `migration` are never applied — they are
 * note-and-ask items carrying a "leave it as is" option.
 *
 * No writes, no subprocess, no network. Symlinks are not followed and files
 * above {@link MAX_FILE_BYTES} are skipped and reported, so a hostile tree can
 * neither escape the scanned root nor make the scan unbounded.
 *
 * Exit codes: 0 = the scan ran (findings are advisory; zero account-surface
 * files is reported, since a repository may have no login code) · 2 = usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';

export type Evidence = 'violated' | 'suspected' | 'unknown' | 'not-applicable';
export type Remediation = 'mechanical' | 'policy' | 'migration' | 'informational';

export const MAX_FILE_BYTES = 256 * 1024;

const PREDICATE = /login|register|signup|password|reset|verify|session|oauth|callback|mfa|otp|passkey/i;
const CODE_EXT = new Set(['.php', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'vendor', '.git', 'dist', 'build', 'coverage']);

interface ClassDef {
    id: string;
    threat_row: string;
    evidence: Evidence;
    remediation: Remediation;
    /** Returns a short, secret-free description of the hit, or null. */
    match: (line: string, file: string) => string | null;
}

const FAST_HASH = /\b(md5|sha1)\s*\(|createHash\(\s*['"](md5|sha1|sha256|sha512)['"]|\bhash\(\s*['"](md5|sha1|sha256|sha512)['"]/i;
const CONSTANT_TIME = /hash_equals|timingSafeEqual|compare_digest|secure_compare|safeCompare/i;
const SECRET_WORDS = new Set(['otp', 'token', 'secret', 'signature', 'sig', 'hmac', 'mac', 'nonce']);

/** True when one word of the operand, split on case and punctuation, names a secret. */
function namesSecret(operand: string): boolean {
    return operand
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .some((w) => SECRET_WORDS.has(w));
}
const SECRET_PATH = /otp|mfa|totp|2fa|signature|webhook/i;
const LITERAL = /^(null|undefined|true|false|NULL|\d+|'[^']*'|"[^"]*"|`[^`]*`)$/;
const HOST_SOURCE = /getHost\(\)|getHttpHost\(\)|getSchemeAndHttpHost\(\)|\$_SERVER\[['"]HTTP_HOST['"]\]|req(uest)?\.headers\.host|req(uest)?\.get\(\s*['"]host['"]\s*\)|req\.hostname/;
const TOKEN_KEY = String.raw`[^'"\x60]*(token|jwt|session|auth|bearer)[^'"\x60]*`;
const WEB_STORAGE_SET = new RegExp(String.raw`(localStorage|sessionStorage)\.setItem\(\s*['"\x60]${TOKEN_KEY}['"\x60]`, 'i');
const WEB_STORAGE_ASSIGN = new RegExp(
    String.raw`(localStorage|sessionStorage)(\[\s*['"\x60]${TOKEN_KEY}['"\x60]\s*\]|\.\w*(token|jwt|session|auth|bearer)\w*)\s*=(?!=)`,
    'i',
);
const DISCLOSURE = /['"`][^'"`]*(no account with|not registered|user not found|no such (user|account)|account (does not|doesn't) exist|unknown (email|user)|email (is )?not found)[^'"`]*['"`]/i;

function equalityOperands(line: string): [string, string] | null {
    const m = line.match(/(?<![=!<>])(===|!==|==|!=)(?![=])/);
    if (!m || m.index === undefined) return null;
    const left = line.slice(0, m.index).trimEnd().match(/([\w$>\-.'"()[\]]+)\s*$/)?.[1] ?? '';
    const right = line.slice(m.index + m[0].length).match(/^\s*([\w$>\-.'"()[\]]+)/)?.[1] ?? '';
    return [left.replace(/^\(+/, ''), right.replace(/\)+$/, '')];
}

export const CLASSES: readonly ClassDef[] = [
    {
        id: 'fast-hash',
        threat_row: 'Fast or home-made password storage',
        evidence: 'violated',
        remediation: 'migration',
        match: (line) => (FAST_HASH.test(line) && /password/i.test(line) ? 'general-purpose digest over a password' : null),
    },
    {
        id: 'secret-compare',
        threat_row: 'Unsafe secret comparison and home-made credential primitives',
        evidence: 'violated',
        remediation: 'mechanical',
        match: (line, file) => {
            if (CONSTANT_TIME.test(line)) return null;
            const ops = equalityOperands(line);
            if (!ops) return null;
            const [a, b] = ops;
            if (a === '' || b === '' || LITERAL.test(a) || LITERAL.test(b)) return null;
            if (/\.length$|->length$|typeof/.test(a) || /\.length$|typeof/.test(b)) return null;
            const secret = namesSecret(a) || namesSecret(b) || SECRET_PATH.test(file);
            return secret ? 'secret compared with an ordinary equality operator' : null;
        },
    },
    {
        id: 'pepper-literal',
        threat_row: 'Fast or home-made password storage',
        evidence: 'violated',
        remediation: 'migration',
        match: (line) =>
            /pepper\w*['"]?\s*(=>|=|:)\s*['"][^'"]+['"]/i.test(line) ? 'pepper assigned from a source literal (value withheld)' : null,
    },
    {
        id: 'host-derived-reset',
        threat_row: 'Password reset beyond the token',
        evidence: 'violated',
        remediation: 'mechanical',
        match: (line, file) => (/reset|forgot|password/i.test(file) && HOST_SOURCE.test(line) ? 'link host taken from the request' : null),
    },
    {
        id: 'email-linking',
        threat_row: 'Federated sign-in account takeover',
        evidence: 'violated',
        remediation: 'policy',
        match: (line) => (/allowDangerousEmailAccountLinking\s*:\s*true/.test(line) ? 'provider accounts linked on email alone' : null),
    },
    {
        id: 'token-verify-off',
        threat_row: 'Self-contained token validation bypass',
        evidence: 'violated',
        remediation: 'policy',
        match: (line) =>
            /algorithms?['"]?\s*(:|=>|=)\s*\[[^\]]*['"]none['"]/i.test(line) ||
            /['"]?alg['"]?\s*(:|=>|=)\s*['"]none['"]/i.test(line) ||
            /['"]?verify(_signature)?['"]?\s*(=>|:)\s*false\b/i.test(line)
                ? 'token signature verification disabled or `none` accepted'
                : null,
    },
    {
        id: 'token-in-localstorage',
        threat_row: 'Authentication token in script-readable browser storage',
        evidence: 'violated',
        remediation: 'migration',
        match: (line) =>
            WEB_STORAGE_SET.test(line) || WEB_STORAGE_ASSIGN.test(line) ? 'auth token written to script-readable storage' : null,
    },
    {
        id: 'account-disclosure',
        threat_row: 'Account enumeration through an observable difference',
        evidence: 'suspected',
        remediation: 'policy',
        match: (line) => (DISCLOSURE.test(line) ? 'response text separates an unknown account from a wrong secret' : null),
    },
];

export const REMEDIATION_BY_CLASS: Readonly<Record<string, Remediation>> = Object.fromEntries(
    CLASSES.map((c) => [c.id, c.remediation]),
);

/** Sub-cases the lexical classes cannot decide; listed so absence never reads as a pass. */
const UNDECIDED: readonly { class: string; reason: string }[] = [
    { class: 'pepper-literal', reason: 'a credential-table column used as the pepper needs data flow, not a line pattern' },
    { class: 'account-disclosure', reason: 'status codes, redirects, cookies and timing that differ per account are not string literals' },
    { class: 'rate-limiting', reason: 'whether a limiter is wired to the login route needs a route relation the code graph does not emit' },
    { class: 'session-lifecycle', reason: 'session rotation and server-side logout are behaviour, not a pattern on one line' },
    { class: 'mfa-enforcement', reason: 'server-side second-factor enforcement cannot be read off a single file' },
];

export interface Finding {
    class: string;
    threat_row: string;
    file: string;
    line: number;
    evidence: Evidence;
    remediation: Remediation;
    action: 'fix-now-candidate' | 'note-and-ask';
    options: string[];
    detail: string;
}

export interface Report {
    measured: boolean;
    root: string;
    scanned_files: number;
    findings: Finding[];
    skipped: { file: string; reason: string }[];
    undecided: { class: string; reason: string }[];
}

export function onAccountSurface(rel: string): boolean {
    return CODE_EXT.has(path.extname(rel).toLowerCase()) && PREDICATE.test(rel);
}

function isComment(line: string): boolean {
    return /^\s*(\/\/|#|\*|\/\*)/.test(line);
}

function optionsFor(remediation: Remediation): string[] {
    if (remediation === 'mechanical') return ["apply the fix with the project's existing primitive", 'leave it as is'];
    if (remediation === 'migration') return ['plan a migration with the owner', 'leave it as is'];
    return ['decide the policy with the owner', 'leave it as is'];
}

export function scanAccountSurface(root: string): Report {
    const findings: Finding[] = [];
    const skipped: { file: string; reason: string }[] = [];
    let scanned = 0;

    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            const rel = path.relative(root, full).split(path.sep).join('/');
            if (entry.isSymbolicLink()) {
                skipped.push({ file: rel, reason: 'symlink not followed' });
                continue;
            }
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) walk(full);
                continue;
            }
            if (!entry.isFile() || !onAccountSurface(rel)) continue;
            if (fs.statSync(full).size > MAX_FILE_BYTES) {
                skipped.push({ file: rel, reason: `larger than ${MAX_FILE_BYTES} bytes` });
                continue;
            }
            scanned += 1;
            const lines = fs.readFileSync(full, 'utf8').split('\n');
            lines.forEach((line, i) => {
                if (isComment(line)) return;
                for (const cls of CLASSES) {
                    const detail = cls.match(line, rel);
                    if (detail === null) continue;
                    findings.push({
                        class: cls.id,
                        threat_row: cls.threat_row,
                        file: rel,
                        line: i + 1,
                        evidence: cls.evidence,
                        remediation: cls.remediation,
                        action: cls.remediation === 'mechanical' ? 'fix-now-candidate' : 'note-and-ask',
                        options: optionsFor(cls.remediation),
                        detail,
                    });
                }
            });
        }
    };

    walk(root);

    return { measured: false, root, scanned_files: scanned, findings, skipped, undecided: [...UNDECIDED] };
}

function main(argv: string[]): number {
    const json = argv.includes('--json');
    const target = argv.find((a) => !a.startsWith('--'));
    if (target === undefined) {
        process.stderr.write('usage: check_account_surface <repo-root> [--json]\n');
        return 2;
    }
    const root = path.resolve(target);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        process.stderr.write(`check_account_surface: ${root} is not a directory\n`);
        return 2;
    }
    const report = scanAccountSurface(root);
    if (json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        process.stdout.write('check_account_surface — UNMEASURED: claim account-surface-finds-planted is unbacked\n');
        for (const f of report.findings) {
            process.stdout.write(`  [${f.evidence}] ${f.class} ${f.file}:${f.line} — ${f.detail} (${f.remediation}, ${f.action}; threat: ${f.threat_row})\n`);
        }
        for (const s of report.skipped) process.stdout.write(`  skipped ${s.file}: ${s.reason}\n`);
        for (const u of report.undecided) process.stdout.write(`  undecided ${u.class}: ${u.reason}\n`);
        process.stdout.write(`${report.scanned_files} account-surface file(s) scanned, ${report.findings.length} finding(s); absence of a finding is not a pass\n`);
    }
    // A warning here used to sit beside `return 0`: a gate whose predicate
    // matched nothing reported "no findings" and passed, which is the shape
    // `assertScanned` exists to refuse — an absence of findings over an empty
    // corpus is not a reading. The deletion test applies: if the account
    // surface moved or the predicate stopped matching, the reason "no findings"
    // would still print and still be false, so no `allowEmpty` is written here.
    try {
        assertScanned({
            gate: 'check_account_surface',
            scanned: report.scanned_files,
            units: 'account-surface file(s)',
            roots: [path.relative(root, root) || '.'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main(process.argv.slice(2)));
}
