/**
 * `code-graph scan` — the authoring-time backstop sweeps the security and test
 * skills used to carry as inline `rg` blocks, as one rule table. Output is one
 * `file:line:rule-id` per hit; a hit means read that line, never auto-fix.
 *
 *   code-graph scan [--pack security|frontend|tests|all] [--rule ID,…] [--list] [paths…]
 *
 * Scans tracked files only (`git ls-files`), so build output and vendored
 * trees in `.gitignore` are never read.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { gitProbe } from '../_lib/spawn_env.js';
import { resolveRoot } from './cli_args.js';

export type Pack = 'security' | 'frontend' | 'tests';

export interface ScanRule {
    id: string;
    pack: Pack;
    pattern: RegExp;
    /** only files whose path matches */
    files?: RegExp;
    /** a hit is dropped when the same line also matches this */
    unless?: RegExp;
    why: string;
}

export const SCAN_RULES: readonly ScanRule[] = [
    { id: 'render-sink', pack: 'frontend', pattern: /dangerouslySetInnerHTML|v-html|\.innerHTML\s*=|document\.write\(|\beval\(|new Function\(/, why: 'insecure render or eval sink' },
    { id: 'client-secret', pack: 'frontend', pattern: /NEXT_PUBLIC_.*(SECRET|KEY|TOKEN|PASSWORD)|VITE_.*(SECRET|KEY)|localStorage\.setItem\([^)]*[Tt]oken/, why: 'secret in client code or token in localStorage' },
    { id: 'cors-wildcard', pack: 'frontend', pattern: /origin:\s*['"]\*['"]|Access-Control-Allow-Origin.*\*/, why: 'wildcard CORS' },
    { id: 'postmessage-listener', pack: 'frontend', pattern: /addEventListener\(\s*['"]message['"]/, why: 'confirm the handler checks event.origin' },
    { id: 'blank-target', pack: 'frontend', pattern: /target=["']_blank["']/, unless: /noopener/, why: 'external link without rel="noopener"' },
    { id: 'svg-active-content', pack: 'frontend', files: /\.svg$/, pattern: /<foreignObject|<script[\s>]|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*["']?\s*javascript:/, why: 'active content in an SVG' },
    { id: 'bootstrap-payload', pack: 'frontend', pattern: /__NEXT_DATA__|__NUXT__|window\.__INITIAL_STATE__|@json\(|json_encode\([^)]*\)\s*\)?\s*<\/script>|dehydratedState/, why: 'server-composed payload: judge each field' },
    { id: 'string-built-sql', pack: 'security', pattern: /query\(.*(\+|\$\{|`).*\)|(SELECT|INSERT|UPDATE|DELETE).*(\+|\$\{)/, why: 'string-built SQL' },
    { id: 'hardcoded-secret', pack: 'security', pattern: /AKIA[0-9A-Z]{16}|sk_live_|AIza[0-9A-Za-z_-]{35}|password\s*=\s*["']|md5\(|sha1\(/, why: 'hardcoded secret or weak hash' },
    { id: 'fast-password-hash', pack: 'security', pattern: /(md5|sha1|sha224|sha256|sha384|sha512|hash|hashlib\.\w+)\s*\(\s*[^)]*(password|passwd|pwd)/, why: 'fast hash over a password' },
    { id: 'raw-secret-compare', pack: 'security', pattern: /\$?(token|otp|signature|mac|hmac|digest)\s*===?\s*|===?\s*\$?(token|otp|signature|mac|hmac)/, why: 'needs a constant-time compare' },
    { id: 'infra-wildcard', pack: 'security', pattern: /"Action"\s*:\s*"\*"|"Resource"\s*:\s*"\*"|0\.0\.0\.0\/0|InsecureSkipVerify|verify=false|curl.*\| *bash/, why: 'wildcard IAM, open ingress or disabled TLS' },
    { id: 'config-raw-secret', pack: 'security', files: /(^|\/)(\.mcp\.json|[^/]*\.mcp\.json|[^/]*\.env|[^/]*agent[^/]*config[^/]*|\.github\/workflows\/[^/]+)$/, pattern: /sk_live_|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|AIza[0-9A-Za-z_-]{35}/, why: 'raw secret in an agent, MCP or CI config' },
    { id: 'upload-client-name', pack: 'security', pattern: /getClientOriginalName|getClientOriginalExtension|originalname|getOriginalFilename|storeAs\(|storePubliclyAs\(/, why: 'client filename into a storage path' },
    { id: 'upload-mimes-only', pack: 'security', pattern: /mimes:/, unless: /extensions:/, why: 'mimes rule without extensions' },
    { id: 'upload-exec-sink', pack: 'security', pattern: /move_uploaded_file\(|phar:\/\/|(include|require)(_once)?\s*\(?\s*\$/, why: 'executable upload sink' },
    { id: 'swallowed-error', pack: 'security', pattern: /catch\s*\([^)]*\)\s*\{\s*\}|except[^:]*:\s*pass/, why: 'empty catch' },
    { id: 'test-skip', pack: 'tests', pattern: /\b(it|test|describe)\.skip\b|\.only\b|xit\(|xdescribe\(|@pytest\.mark\.(skip|xfail)|@Disabled|->markTestSkipped\(/, why: 'skip, only or xfail — a green that was not earned' },
];

export interface Hit {
    file: string;
    line: number;
    rule: string;
}

const MAX_BYTES = 1_000_000;
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|wasm|woff2?|ttf|sqlite3?|lock)$/i;

export function scanText(file: string, text: string, rules: readonly ScanRule[]): Hit[] {
    const live = rules.filter((r) => !r.files || r.files.test(file));
    if (live.length === 0) return [];
    const hits: Hit[] = [];
    text.split('\n').forEach((l, i) => {
        for (const r of live) if (r.pattern.test(l) && !(r.unless && r.unless.test(l))) hits.push({ file, line: i + 1, rule: r.id });
    });
    return hits;
}

export function selectRules(pack: string | null, ids: readonly string[]): ScanRule[] {
    if (ids.length) return SCAN_RULES.filter((r) => ids.includes(r.id));
    return SCAN_RULES.filter((r) => pack === null || pack === 'all' || r.pack === pack);
}

export function scanFiles(root: string, files: readonly string[], rules: readonly ScanRule[]): Hit[] {
    const out: Hit[] = [];
    for (const f of files) {
        if (BINARY.test(f)) continue;
        const p = path.join(root, f);
        let st: fs.Stats;
        try {
            st = fs.statSync(p);
        } catch {
            continue;
        }
        if (!st.isFile() || st.size > MAX_BYTES) continue;
        out.push(...scanText(f, fs.readFileSync(p, 'utf-8'), rules));
    }
    return out;
}

export function scanMain(argv: string[]): number {
    const root = resolveRoot(argv);
    const val = (name: string): string | null => {
        const i = argv.indexOf(name);
        return i >= 0 ? (argv[i + 1] ?? null) : null;
    };
    const pack = val('--pack');
    if (pack !== null && !['security', 'frontend', 'tests', 'all'].includes(pack)) {
        process.stderr.write('code-graph scan: --pack is security, frontend, tests or all\n');
        return 2;
    }
    const ids = (val('--rule') ?? '').split(',').filter(Boolean);
    const unknown = ids.filter((id) => !SCAN_RULES.some((r) => r.id === id));
    if (unknown.length) {
        process.stderr.write(`code-graph scan: unknown rule ${unknown.join(', ')} — \`--list\` prints them\n`);
        return 2;
    }
    const rules = selectRules(pack, ids);
    if (argv.includes('--list')) {
        for (const r of rules) process.stdout.write(`${r.id}\t${r.pack}\t${r.why}\n`);
        return 0;
    }
    const flagged = new Set(['--pack', '--rule', '--root']);
    const paths = argv.filter((a, i) => !a.startsWith('--') && !flagged.has(argv[i - 1] ?? ''));
    let files: string[];
    try {
        files = gitProbe(root, ['-c', 'core.quotePath=false', 'ls-files', '-z', '--', ...(paths.length ? paths : ['.'])], { maxBuffer: 256 * 1024 * 1024 }).split('\0').filter(Boolean);
    } catch {
        process.stderr.write('code-graph scan: not a git repository — scan reads tracked files only\n');
        return 2;
    }
    const hits = scanFiles(root, files, rules);
    for (const h of hits) process.stdout.write(`${h.file}:${h.line}:${h.rule}\n`);
    return 0;
}
