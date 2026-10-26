/**
 * Outbound call sites in source files, by text: HTTP clients, SOAP clients,
 * GraphQL documents, gRPC stubs and vendor SDK constructors.
 *
 * A call site is reduced to what it states — verb, path template, the literal
 * parameter names it passes, the expression its base address comes from — and
 * the base is resolved to configuration NAMES (`config('services.partner.url')`,
 * `env('X')`, `process.env.X`, …) or to a literal host. Nothing is evaluated.
 */
import { CREDENTIAL_PREFIXES } from '../../../_lib/egress_prefixes.js';
import type { Witness } from '../lane_fact.js';
import { serviceFromConfigKey, type ConfigIndex } from './config.js';
import { serviceFromEnvName, type Protocol } from './model.js';
import { callArgs, enclosingSymbol, langOf, literalKeys, literalValue, SourceText, stringLiteral, type Lang } from './text.js';

export interface BaseRef {
    /** env name or config key the base address comes from */
    name: string;
    kind: 'env' | 'config-key';
    witness: Witness;
}

export interface ResolvedTarget {
    service: string;
    guess: boolean;
    host: string | null;
    base: BaseRef | null;
    path: string;
    literalWitness: Witness | null;
    userValue: Witness | null;
}

export interface RawCall {
    from: string;
    protocol: Protocol;
    method: string;
    target: ResolvedTarget;
    params: string[] | null;
    witness: Witness;
    timeout: boolean | null;
    timeoutSource: 'explicit' | 'library-default' | 'none' | 'unknown';
    clientWitness: Witness | null;
    credential: { masked: string; witness: Witness } | null;
    /** SOAP: the WSDL expression; resolved against repo files by the caller */
    wsdl?: { file: string | null; remote: string | null; base: BaseRef | null } | undefined;
    /** gRPC: proto service name from the stub constructor */
    grpcService?: string;
    /** SDK: package row service and constructor name */
    sdkCtor?: string;
}

export interface WebhookRoute {
    service: string;
    method: string;
    path: string;
    witness: Witness;
    handlerWitness: Witness;
    signatureCheck: boolean;
}

export interface FileScan {
    calls: RawCall[];
    graphqlClients: { target: ResolvedTarget; witness: Witness }[];
    webhooks: WebhookRoute[];
    /** handler class name → file; filled by the caller for webhook handlers */
    pendingHandlers: { route: WebhookRoute; className: string }[];
}

const VERBS = 'get|post|put|patch|delete|head|options';
const USER_VALUE =
    /\$request->|\brequest\(\)|\$_(?:GET|POST|REQUEST|COOKIE)\b|->input\(|->query\(|\breq\.(?:query|params|body)\b|\brequest\.(?:args|form|GET|POST|json|query_params|path_params)\b|\bsearchParams\.get\(|\br\.URL\.Query\(\)|\br\.FormValue\(|\bRequest\.Query\b|\bparams\[:/;
const SIGNATURE_MARKERS =
    /signature|hash_hmac|hmac|constructEvent|timingSafeEqual|hash_equals|compare_digest|validateRequest|verifyWebhook|webhook_secret|webhookSecret/i;
// The egress table owns the shared vendor prefixes; these three it does not declare.
const EXTRA_KEY_PREFIX = /^(?:rk_(?:live|test)_|ASIA|SG\.)/;
const hasKeyPrefix = (v: string): boolean => CREDENTIAL_PREFIXES.some((p) => v.startsWith(p)) || EXTRA_KEY_PREFIX.test(v);
const CREDENTIAL_KEY = /^(?:api[_-]?key|apikey|token|access[_-]?token|secret|client[_-]?secret|password|passwd|auth|authorization|x-api-key)$/i;
const PLACEHOLDER = /^(?:x+|\*+|changeme|your[-_ ].*|<.*>|\{\{.*\}\}|%.*%|\$\{.*\}|null|none|example.*|test|dummy)$/i;

export function maskSecret(v: string): string {
    return `${v.slice(0, 4)}****(${String(v.length)} chars)`;
}

function credentialLiteral(value: string): boolean {
    if (value.length < 8 || PLACEHOLDER.test(value)) return false;
    return hasKeyPrefix(value) || /^[A-Za-z0-9_\-+/=.]{16,}$/.test(value);
}

function hostOf(url: string): string | null {
    const m = /^https?:\/\/([^/:?#'"]+)/i.exec(url);
    return m ? (m[1] as string).toLowerCase() : null;
}

/** Statement end: `;` at depth 0, or end of line for newline-terminated languages. */
function statementEnd(text: string, from: number, lang: Lang): number {
    let depth = 0;
    for (let i = from; i < text.length; i++) {
        const c = text[i] as string;
        if (c === '"' || c === "'" || c === '`') {
            const q = c;
            i++;
            while (i < text.length && text[i] !== q) {
                if (text[i] === '\\') i++;
                i++;
            }
            continue;
        }
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') {
            depth--;
            if (depth < 0) return i;
        } else if (c === ';' && depth === 0) return i + 1;
        else if (c === '\n' && depth === 0 && (lang === 'python' || lang === 'go' || lang === 'ruby' || lang === 'js')) {
            const rest = text.slice(i + 1).trimStart();
            if (!rest.startsWith('.') && !rest.startsWith('->') && !/[.+(,\\]\s*$/.test(text.slice(from, i))) return i;
        }
    }
    return text.length;
}

/** Start of the statement containing `at`: after the previous `;`, `{` or `}` at line level. */
function statementStart(text: string, at: number): number {
    for (let i = at - 1; i >= 0; i--) {
        const c = text[i];
        if (c === ';' || c === '{' || c === '}') return i + 1;
    }
    return 0;
}

interface Assignment {
    expr: string;
    offset: number;
}

function assignments(text: string): Map<string, Assignment> {
    const out = new Map<string, Assignment>();
    const re = /(?:\$this->|this\.|self\.|@|\$)?([A-Za-z_]\w*)\s*(?::=|=(?![=>~]))\s*([^;\n]+(?:\n\s*(?:->|\.)[^;\n]+)*)/g;
    for (const m of text.matchAll(re)) {
        const name = m[1] as string;
        if (['if', 'while', 'for', 'return', 'const', 'let', 'var'].includes(name)) continue;
        if (!out.has(name)) out.set(name, { expr: (m[2] as string).trim().replace(/;$/, ''), offset: m.index ?? 0 });
    }
    for (const m of text.matchAll(/(@Value\(\s*"\$\{[\w.-]+[^"]*"\s*\))\s*(?:(?:private|protected|public|final|static)\s+)*[\w<>]+\s+([A-Za-z_]\w*)\s*;/g)) {
        out.set(m[2] as string, { expr: m[1] as string, offset: m.index ?? 0 });
    }
    return out;
}

interface Ctx {
    src: SourceText;
    lang: Lang;
    config: ConfigIndex;
    vars: Map<string, Assignment>;
}

/** Splits a URL expression into literal and expression segments (concatenation and interpolation). */
function segments(expr: string, lang: Lang): { lit: boolean; v: string }[] {
    const out: { lit: boolean; v: string }[] = [];
    const concat = lang === 'php' ? '.' : '+';
    let depth = 0;
    let from = 0;
    const parts: string[] = [];
    for (let i = 0; i < expr.length; i++) {
        const c = expr[i] as string;
        if (c === '"' || c === "'" || c === '`') {
            const q = c;
            i++;
            while (i < expr.length && expr[i] !== q) {
                if (expr[i] === '\\') i++;
                i++;
            }
            continue;
        }
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (c === concat && depth === 0 && !(lang === 'php' && /\d/.test(expr[i - 1] ?? '') && /\d/.test(expr[i + 1] ?? ''))) {
            parts.push(expr.slice(from, i));
            from = i + 1;
        }
    }
    parts.push(expr.slice(from));
    for (const raw of parts) {
        const p = raw.trim();
        const q = /^(?:[fF]|\$|@)?(["'`])([\s\S]*)\1$/.exec(p);
        if (!q) {
            out.push({ lit: false, v: p });
            continue;
        }
        const interpolates = q[1] === '`' || /^[fF$]/.test(p) || (q[1] === '"' && (lang === 'php' || lang === 'ruby'));
        if (!interpolates) {
            out.push({ lit: true, v: q[2] as string });
            continue;
        }
        const body = q[2] as string;
        const re = /\$\{([^}]*)\}|\{\$([^}]*)\}|#\{([^}]*)\}|\$([A-Za-z_]\w*(?:->\w+)*)|\{([A-Za-z_][\w.]*)\}/g;
        let last = 0;
        for (const m of body.matchAll(re)) {
            const idx = m.index ?? 0;
            if (idx > last) out.push({ lit: true, v: body.slice(last, idx) });
            out.push({ lit: false, v: (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '').trim() });
            last = idx + m[0].length;
        }
        if (last < body.length) out.push({ lit: true, v: body.slice(last) });
    }
    return out;
}

function placeholder(expr: string): string {
    const m = /([A-Za-z_]\w*)\s*\)?\s*$/.exec(expr.replace(/\[['"]?(\w+)['"]?\]$/, '.$1'));
    return `{${m ? (m[1] as string) : 'param'}}`;
}

/** Resolves a single non-literal segment to a configuration name, or null. */
function baseSource(expr: string, ctx: Ctx, at: number, depth = 0): { base: BaseRef; service: string } | { host: string; witness: Witness } | null {
    const e = expr.trim();
    const w = ctx.src.witness(at);
    const cfg = /\bconfig\(\s*['"]([\w.-]+)['"]/.exec(e) ?? /\b(?:Configuration|config|_config|configuration)\s*\[\s*["']([\w:.-]+)["']\s*\]/.exec(e);
    if (cfg) {
        const key = (cfg[1] as string).replace(/:/g, '.');
        const entry = ctx.config.byKey.get(key);
        const base: BaseRef = entry ? { name: entry.env, kind: 'env', witness: entry.witness } : { name: key, kind: 'config-key', witness: w };
        return { base, service: serviceFromConfigKey(key) };
    }
    const value = /@Value\(\s*"\$\{([\w.-]+)/.exec(e) ?? /\$\{([\w.-]+)(?::[^}]*)?\}/.exec(e);
    if (value && ctx.lang === 'java') {
        const key = value[1] as string;
        const entry = ctx.config.byKey.get(key);
        const base: BaseRef = entry ? { name: entry.env, kind: 'env', witness: entry.witness } : { name: key, kind: 'config-key', witness: w };
        return { base, service: serviceFromConfigKey(key) };
    }
    const env =
        /\benv\(\s*['"]([A-Z][A-Z0-9_]*)['"]/.exec(e) ??
        /\bgetenv\(\s*['"]([A-Z][A-Z0-9_]*)['"]/.exec(e) ??
        /\bprocess\.env\.([A-Z][A-Z0-9_]*)/.exec(e) ??
        /\bprocess\.env\[\s*['"]([A-Z][A-Z0-9_]*)['"]/.exec(e) ??
        /\bimport\.meta\.env\.([A-Z][A-Z0-9_]*)/.exec(e) ??
        /\bos\.(?:getenv|environ\.get)\(\s*['"]([A-Z][A-Z0-9_]*)['"]/.exec(e) ??
        /\bos\.environ\[\s*['"]([A-Z][A-Z0-9_]*)['"]/.exec(e) ??
        /\bos\.Getenv\(\s*"([A-Z][A-Z0-9_]*)"/.exec(e) ??
        /\bENV(?:\.fetch\(|\[)\s*['"]([A-Z][A-Z0-9_]*)['"]/.exec(e) ??
        /\bEnvironment\.GetEnvironmentVariable\(\s*"([A-Z][A-Z0-9_]*)"/.exec(e) ??
        /\bSystem\.getenv\(\s*"([A-Z][A-Z0-9_]*)"/.exec(e) ??
        /\bsettings\.([A-Z][A-Z0-9_]*)/.exec(e);
    if (env) {
        const name = env[1] as string;
        return { base: { name, kind: 'env', witness: w }, service: serviceFromEnvName(name) ?? name.toLowerCase() };
    }
    const lit = stringLiteral(e);
    if (lit !== null) {
        const host = hostOf(lit);
        return host ? { host, witness: w } : null;
    }
    if (depth < 2) {
        const v = /^(?:\$this->|this\.|self\.|\$|@)?([A-Za-z_]\w*)$/.exec(e);
        const a = v ? ctx.vars.get(v[1] as string) : undefined;
        if (a) {
            const inner = segments(a.expr, ctx.lang)[0];
            if (inner) {
                if (inner.lit) {
                    const host = hostOf(inner.v);
                    return host ? { host, witness: ctx.src.witness(a.offset) } : null;
                }
                return baseSource(inner.v, ctx, a.offset, depth + 1);
            }
        }
    }
    return null;
}

function userValueIn(expr: string, ctx: Ctx, at: number): Witness | null {
    if (USER_VALUE.test(expr)) return ctx.src.witness(at);
    for (const v of expr.matchAll(/(?:\$this->|this\.|self\.|\$)?([A-Za-z_]\w*)/g)) {
        const a = ctx.vars.get(v[1] as string);
        if (a && USER_VALUE.test(a.expr)) return ctx.src.witness(a.offset);
    }
    return null;
}

/**
 * Resolves the address of a call: `urlExpr` is the URL argument, `baseExpr` the
 * client's configured base (`baseUrl`, `base_uri`, `baseURL`, …) if any.
 */
export function resolveTarget(urlExpr: string | null, baseExpr: string | null, ctx: Ctx, at: number, baseAt = at): ResolvedTarget {
    const segs = urlExpr ? segments(urlExpr, ctx.lang) : [];
    let pathSegs = segs;
    let service: string | null = null;
    let guess = false;
    let host: string | null = null;
    let base: BaseRef | null = null;
    let literalWitness: Witness | null = null;
    const first = segs[0];
    const apply = (r: ReturnType<typeof baseSource>): boolean => {
        if (!r) return false;
        if ('host' in r) {
            host = r.host;
            service = r.host;
            literalWitness = r.witness;
        } else {
            base = r.base;
            service = r.service;
        }
        return true;
    };
    if (first?.lit && /^https?:\/\//i.test(first.v)) {
        host = hostOf(first.v);
        service = host;
        literalWitness = ctx.src.witness(at);
        pathSegs = [{ lit: true, v: first.v.replace(/^https?:\/\/[^/]+/i, '') }, ...segs.slice(1)];
    } else if (first && !first.lit && apply(baseSource(first.v, ctx, at))) {
        pathSegs = segs.slice(1);
    } else if (baseExpr) {
        const bs = segments(baseExpr, ctx.lang);
        const b0 = bs[0];
        if (b0?.lit && /^https?:\/\//i.test(b0.v)) {
            host = hostOf(b0.v);
            service = host;
            literalWitness = ctx.src.witness(baseAt);
            const basePath = b0.v.replace(/^https?:\/\/[^/]+/i, '').replace(/\/+$/, '');
            if (basePath) pathSegs = [{ lit: true, v: basePath + '/' }, ...pathSegs];
        } else if (b0 && !b0.lit) {
            apply(baseSource(b0.v, ctx, baseAt));
        }
    }
    let path = '';
    for (const s of pathSegs) path += s.lit ? s.v : placeholder(s.v);
    path = path.split('?')[0] ?? '';
    path = path.replace(/\/{2,}/g, '/');
    if (path && !path.startsWith('/')) path = `/${path}`;
    if (!service) {
        service = 'unresolved';
        guess = true;
    }
    const userValue = userValueIn(`${urlExpr ?? ''} ${baseExpr ?? ''}`, ctx, at);
    return { service, guess, host, base, path: path || '/', literalWitness, userValue };
}

function queryKeys(urlExpr: string | null): string[] {
    if (!urlExpr) return [];
    const q = /\?([^'"`]*)/.exec(urlExpr);
    if (!q) return [];
    return (q[1] as string)
        .split('&')
        .map((kv) => kv.split('=')[0] ?? '')
        .filter((k) => /^[\w.-]+$/.test(k));
}

function pathParamNames(path: string): string[] {
    return [...path.matchAll(/\{([A-Za-z_]\w*)\}/g)].map((m) => m[1] as string).filter((n) => n !== 'param');
}

/** Literal parameter names passed by a call: path placeholders, query string, array/object keys. */
function callParams(path: string, urlExpr: string | null, paramExprs: (string | null)[]): string[] | null {
    const names = [...pathParamNames(path), ...queryKeys(urlExpr)];
    let opaque = false;
    for (const pe of paramExprs) {
        if (!pe) continue;
        const nested = ['query', 'json', 'form_params', 'params', 'data', 'body'].map((k) => literalValue(pe, k)).filter((x): x is string => !!x);
        const sources = nested.length ? nested : [pe];
        for (const s of sources) {
            const inner = /^JSON\.stringify\(([\s\S]*)\)$/.exec(s.trim());
            const keys = literalKeys(inner ? (inner[1] as string) : s);
            if (keys) names.push(...keys.filter((k) => !['headers', 'timeout', 'signal', 'method', 'auth', 'verify'].includes(k)));
            else opaque = true;
        }
    }
    const uniq = [...new Set(names)];
    return opaque && uniq.length === 0 ? null : uniq;
}

function credentialIn(stmt: string, ctx: Ctx, at: number): { masked: string; witness: Witness } | null {
    const checks: RegExp[] = [
        /->withToken\(\s*(['"])([^'"]+)\1/,
        /->withBasicAuth\(\s*['"][^'"]*['"]\s*,\s*(['"])([^'"]+)\1/,
        /['"]?Authorization['"]?\s*(?:=>|:|,)\s*(['"])(?:Bearer|Basic|Token)\s+([^'"]+)\1/i,
    ];
    for (const re of checks) {
        const m = re.exec(stmt);
        if (m && !PLACEHOLDER.test(m[2] as string) && (m[2] as string).length >= 8) {
            return { masked: maskSecret(m[2] as string), witness: ctx.src.witness(at + (m.index ?? 0)) };
        }
    }
    for (const m of stmt.matchAll(/['"]?([\w-]+)['"]?\s*(?:=>|:|=)\s*(['"])([^'"\n]+)\2/g)) {
        if (CREDENTIAL_KEY.test(m[1] as string) && credentialLiteral(m[3] as string)) {
            return { masked: maskSecret(m[3] as string), witness: ctx.src.witness(at + (m.index ?? 0)) };
        }
    }
    for (const m of stmt.matchAll(/(['"])([^'"\s]{8,})\1/g)) {
        if (hasKeyPrefix(m[2] as string)) return { masked: maskSecret(m[2] as string), witness: ctx.src.witness(at + (m.index ?? 0)) };
    }
    return null;
}

interface Client {
    kind: string;
    baseExpr: string | null;
    optionsExpr: string;
    witness: Witness;
    at: number;
    defaultTimeout: boolean;
}

/** Client constructors that a variable is bound to, keyed by normalised variable name. */
function findClients(ctx: Ctx): Map<string, Client> {
    const out = new Map<string, Client>();
    const { text } = ctx.src;
    const ctors: { re: RegExp; kind: string; base: (args: string[]) => string | null; timeoutKey: RegExp; defaultTimeout: boolean }[] = [];
    if (ctx.lang === 'php') {
        ctors.push(
            { re: /new\s+\\?(?:GuzzleHttp\\)?Client\s*\(/g, kind: 'guzzle', base: (a) => (a[0] ? literalValue(a[0], 'base_uri') : null), timeoutKey: /['"](?:timeout|connect_timeout|read_timeout)['"]/, defaultTimeout: false },
            { re: /\\?(?:Illuminate\\Support\\Facades\\)?Http::(?!fake|preventStray|assert)/g, kind: 'laravel', base: () => null, timeoutKey: /->(?:timeout|connectTimeout)\(/, defaultTimeout: true },
        );
    }
    if (ctx.lang === 'js') {
        ctors.push({ re: /\baxios\.create\s*\(/g, kind: 'axios', base: (a) => (a[0] ? literalValue(a[0], 'baseURL') : null), timeoutKey: /\btimeout\s*:/, defaultTimeout: false });
        ctors.push({ re: /\bky\.(?:create|extend)\s*\(/g, kind: 'ky', base: (a) => (a[0] ? (literalValue(a[0], 'prefixUrl') ?? literalValue(a[0], 'prefix')) : null), timeoutKey: /\btimeout\s*:/, defaultTimeout: true });
    }
    if (ctx.lang === 'python') {
        ctors.push({ re: /\bhttpx\.(?:Async)?Client\s*\(/g, kind: 'httpx', base: (a) => kwarg(a, 'base_url'), timeoutKey: /\btimeout\s*=/, defaultTimeout: true });
        ctors.push({ re: /\brequests\.Session\s*\(/g, kind: 'requests', base: () => null, timeoutKey: /\btimeout\s*=/, defaultTimeout: false });
    }
    if (ctx.lang === 'ruby') {
        ctors.push({ re: /\bFaraday\.new\s*\(/g, kind: 'faraday', base: (a) => kwarg(a, 'url') ?? a[0] ?? null, timeoutKey: /timeout/, defaultTimeout: false });
    }
    if (ctx.lang === 'java') {
        ctors.push({ re: /\bWebClient\.(?:builder\(\)[\s\S]{0,200}?\.baseUrl|create)\s*\(/g, kind: 'webclient', base: (a) => a[0] ?? null, timeoutKey: /\.timeout\(|responseTimeout|ReadTimeoutHandler/, defaultTimeout: false });
    }
    if (ctx.lang === 'csharp') {
        ctors.push({ re: /\bBaseAddress\s*=\s*new\s+Uri\s*\(/g, kind: 'httpclient', base: (a) => a[0] ?? null, timeoutKey: /\.Timeout\s*=|\bTimeout\s*=/, defaultTimeout: true });
    }
    for (const c of ctors) {
        for (const m of text.matchAll(c.re)) {
            const idx = m.index ?? 0;
            const sStart = statementStart(text, idx);
            const end = statementEnd(text, idx, ctx.lang);
            const stmt = text.slice(sStart, end);
            if (c.kind === 'laravel' && new RegExp(`(?:->|Http::)(?:${VERBS})\\s*\\(`).test(stmt)) continue;
            const open = idx + m[0].length - 1;
            const args = text[open] === '(' ? callArgs(text, open).args : [];
            let base = c.base(args);
            if (c.kind === 'laravel') {
                const b = /->baseUrl\(/.exec(stmt);
                base = b ? (callArgs(stmt, (b.index ?? 0) + b[0].length - 1).args[0] ?? null) : null;
            }
            const lhs = /(?:\$this->|this\.|self\.|@|\$)?([A-Za-z_]\w*)\s*(?::=|=)\s*(?:await\s+)?$/.exec(text.slice(sStart, idx).replace(/\s+$/, ' ').trimEnd() + ' ');
            const varName = lhs ? (lhs[1] as string) : `#${String(idx)}`;
            const fileHasTimeout = c.kind === 'csharp' || c.kind === 'httpclient' ? c.timeoutKey.test(text) : c.timeoutKey.test(stmt);
            out.set(varName, { kind: c.kind, baseExpr: base, optionsExpr: stmt, witness: ctx.src.witness(idx, end), at: idx, defaultTimeout: c.defaultTimeout || fileHasTimeout });
            if (fileHasTimeout) (out.get(varName) as Client).kind += '+timeout';
        }
    }
    return out;
}

function kwarg(args: string[], name: string): string | null {
    for (const a of args) {
        const m = new RegExp(`^${name}\\s*[=:]\\s*([\\s\\S]+)$`).exec(a.trim());
        if (m) return (m[1] as string).trim();
    }
    return null;
}

function timeoutOf(client: Client | null, stmt: string, explicitKey: RegExp, libDefault: boolean): Pick<RawCall, 'timeout' | 'timeoutSource'> {
    if (explicitKey.test(stmt) || client?.kind.endsWith('+timeout')) return { timeout: true, timeoutSource: 'explicit' };
    if (client ? client.defaultTimeout : libDefault) return { timeout: true, timeoutSource: 'library-default' };
    return { timeout: false, timeoutSource: 'none' };
}

/** Scans one source file. */
export function scanFile(rel: string, text: string, config: ConfigIndex): FileScan {
    const out: FileScan = { calls: [], graphqlClients: [], webhooks: [], pendingHandlers: [] };
    const lang = langOf(rel);
    if (!lang) return out;
    const src = new SourceText(rel, text);
    const ctx: Ctx = { src, lang, config, vars: assignments(text) };
    const clients = findClients(ctx);
    const push = (
        at: number,
        end: number,
        method: string,
        urlExpr: string | null,
        paramExprs: (string | null)[],
        client: Client | null,
        timeout: Pick<RawCall, 'timeout' | 'timeoutSource'>,
    ): void => {
        const target = resolveTarget(urlExpr, client?.baseExpr ?? null, ctx, at, client?.at ?? at);
        const stmt = text.slice(at, end);
        const line = src.lineOf(at);
        out.calls.push({
            from: enclosingSymbol(src, line, lang),
            protocol: 'rest',
            method: method.toUpperCase(),
            target,
            params: callParams(target.path, urlExpr, paramExprs),
            witness: src.witness(at, end),
            ...timeout,
            clientWitness: client?.witness ?? null,
            credential: credentialIn(stmt, ctx, at) ?? (client ? credentialIn(client.optionsExpr, ctx, client.at) : null),
        });
    };

    if (lang === 'php') {
        for (const m of text.matchAll(/\\?(?:Illuminate\\Support\\Facades\\)?Http::(?!fake|preventStray|assert)/g)) {
            const idx = m.index ?? 0;
            const end = statementEnd(text, idx, lang);
            const stmt = text.slice(idx, end);
            const verb = [...stmt.matchAll(new RegExp(`(?:->|^\\\\?(?:Illuminate\\\\Support\\\\Facades\\\\)?Http::)(${VERBS})\\s*\\(`, 'g'))].pop();
            if (!verb) continue;
            const open = idx + (verb.index ?? 0) + verb[0].length - 1;
            const { args } = callArgs(text, open);
            const b = /->baseUrl\(/.exec(stmt);
            const baseExpr = b ? (callArgs(stmt, (b.index ?? 0) + b[0].length - 1).args[0] ?? null) : null;
            const client: Client = { kind: 'laravel', baseExpr, optionsExpr: stmt, witness: src.witness(idx, end), at: idx, defaultTimeout: true };
            push(idx, end, verb[1] as string, args[0] ?? null, [args[1] ?? null], client, timeoutOf(null, stmt, /->(?:timeout|connectTimeout)\(/, true));
        }
        for (const [name, client] of clients) {
            if (name.startsWith('#')) continue;
            const recv = `(?:\\$this->|\\$)${name}`;
            for (const m of text.matchAll(new RegExp(`${recv}\\s*->\\s*(${VERBS}|request|send)\\s*\\(`, 'gi'))) {
                const idx = m.index ?? 0;
                if (idx === client.at) continue;
                const end = statementEnd(text, idx, lang);
                const { args } = callArgs(text, idx + m[0].length - 1);
                let method = (m[1] as string).toLowerCase();
                let rest = args;
                if (method === 'request' || method === 'send') {
                    method = stringLiteral(args[0] ?? '') ?? 'GET';
                    rest = args.slice(1);
                }
                const stmt = text.slice(idx, end);
                const key = client.kind.startsWith('laravel') ? /->(?:timeout|connectTimeout)\(/ : /['"](?:timeout|connect_timeout)['"]/;
                push(idx, end, method, rest[0] ?? null, [rest[1] ?? null], client, timeoutOf(client, stmt, key, false));
            }
        }
    }

    if (lang === 'js') {
        for (const m of text.matchAll(/(?<![\w.])fetch\s*\(/g)) {
            const idx = m.index ?? 0;
            const { args, end } = callArgs(text, idx + m[0].length - 1);
            const opts = args[1] ?? '';
            const method = stringLiteral(literalValue(opts, 'method') ?? '') ?? 'GET';
            const body = literalValue(opts, 'body');
            push(idx, end, method, args[0] ?? null, [body], null, /\bsignal\s*[:,}]/.test(opts) ? { timeout: true, timeoutSource: 'explicit' } : { timeout: false, timeoutSource: 'none' });
        }
        for (const m of text.matchAll(new RegExp(`\\b(axios|ky|got)\\.(${VERBS})\\s*\\(`, 'g'))) {
            const idx = m.index ?? 0;
            const { args, end } = callArgs(text, idx + m[0].length - 1);
            const lib = m[1] as string;
            const method = m[2] as string;
            const hasBody = ['post', 'put', 'patch'].includes(method) && lib === 'axios';
            const cfg = (hasBody ? args[2] : args[1]) ?? '';
            const explicit = /\btimeout\s*:|\bsignal\s*:/.test(cfg) || (lib === 'axios' && /axios\.defaults\.timeout\s*=/.test(text));
            const t = explicit ? { timeout: true, timeoutSource: 'explicit' as const } : lib === 'ky' ? { timeout: true, timeoutSource: 'library-default' as const } : { timeout: false, timeoutSource: 'none' as const };
            push(idx, end, method, args[0] ?? null, hasBody ? [args[1] ?? null, literalValue(cfg, 'params')] : [literalValue(cfg, 'params') ?? literalValue(cfg, 'json') ?? literalValue(cfg, 'searchParams')], null, t);
        }
        for (const [name, client] of clients) {
            if (name.startsWith('#')) continue;
            for (const m of text.matchAll(new RegExp(`(?:this\\.)?\\b${name}\\.(${VERBS})\\s*\\(`, 'g'))) {
                const idx = m.index ?? 0;
                const { args, end } = callArgs(text, idx + m[0].length - 1);
                const method = m[1] as string;
                const hasBody = ['post', 'put', 'patch'].includes(method) && client.kind.startsWith('axios');
                const cfg = (hasBody ? args[2] : args[1]) ?? '';
                push(idx, end, method, args[0] ?? null, [hasBody ? (args[1] ?? null) : null, literalValue(cfg, 'params') ?? literalValue(cfg, 'json')], client, timeoutOf(client, cfg, /\btimeout\s*:|\bsignal\s*:/, false));
            }
        }
    }

    if (lang === 'python') {
        for (const m of text.matchAll(new RegExp(`\\b(requests|httpx)\\.(${VERBS}|request)\\s*\\(`, 'g'))) {
            const idx = m.index ?? 0;
            const { args, end } = callArgs(text, idx + m[0].length - 1);
            let method = m[2] as string;
            let rest = args;
            if (method === 'request') {
                method = stringLiteral(args[0] ?? '') ?? 'GET';
                rest = args.slice(1);
            }
            const stmt = text.slice(idx, end);
            const t = timeoutOf(null, stmt, /\btimeout\s*=/, m[1] === 'httpx');
            const url = rest[0] && !/^\w+\s*=/.test(rest[0]) ? rest[0] : kwarg(rest, 'url');
            push(idx, end, method, url, [kwarg(rest, 'params'), kwarg(rest, 'json'), kwarg(rest, 'data')], null, t);
        }
        for (const [name, client] of clients) {
            if (name.startsWith('#')) continue;
            for (const m of text.matchAll(new RegExp(`(?:self\\.)?\\b${name}\\.(${VERBS})\\s*\\(`, 'g'))) {
                const idx = m.index ?? 0;
                const { args, end } = callArgs(text, idx + m[0].length - 1);
                const stmt = text.slice(idx, end);
                push(idx, end, m[1] as string, args[0] ?? null, [kwarg(args, 'params'), kwarg(args, 'json'), kwarg(args, 'data')], client, timeoutOf(client, stmt, /\btimeout\s*=/, false));
            }
        }
    }

    if (lang === 'go') {
        const clientTimeout = /&?http\.Client\s*\{[^}]*\bTimeout\s*:/.test(text) || /context\.WithTimeout|context\.WithDeadline/.test(text);
        for (const m of text.matchAll(/\bhttp\.(Get|Post|Head|PostForm)\s*\(/g)) {
            const idx = m.index ?? 0;
            const { args, end } = callArgs(text, idx + m[0].length - 1);
            push(idx, end, (m[1] as string).replace('PostForm', 'POST'), args[0] ?? null, [], null, { timeout: false, timeoutSource: 'none' });
        }
        for (const m of text.matchAll(/\bhttp\.NewRequest(?:WithContext)?\s*\(/g)) {
            const idx = m.index ?? 0;
            const { args, end } = callArgs(text, idx + m[0].length - 1);
            const a = m[0].includes('WithContext') ? args.slice(1) : args;
            const method = (a[0] ?? '').replace(/^http\.Method/, '').replace(/"/g, '') || 'GET';
            push(idx, end, method, a[1] ?? null, [], null, clientTimeout ? { timeout: true, timeoutSource: 'explicit' } : { timeout: false, timeoutSource: 'none' });
        }
    }

    if (lang === 'java') {
        const explicit = /setConnectTimeout|setReadTimeout|\.timeout\(|responseTimeout|setConnectionRequestTimeout/.test(text);
        for (const m of text.matchAll(/\b\w*[rR]estTemplate\.(getForObject|getForEntity|postForObject|postForEntity|put|delete|exchange|patchForObject)\s*\(/g)) {
            const idx = m.index ?? 0;
            const { args, end } = callArgs(text, idx + m[0].length - 1);
            const op = m[1] as string;
            let method = op.replace(/For(?:Object|Entity)$/, '').toUpperCase();
            if (op === 'exchange') method = (/HttpMethod\.(\w+)/.exec(args[1] ?? '')?.[1] ?? 'GET').toUpperCase();
            push(idx, end, method, args[0] ?? null, [], null, explicit ? { timeout: true, timeoutSource: 'explicit' } : { timeout: false, timeoutSource: 'none' });
        }
        for (const [name, client] of clients) {
            if (name.startsWith('#')) continue;
            for (const m of text.matchAll(new RegExp(`\\b${name}\\s*\\.\\s*(${VERBS})\\(\\)\\s*\\.\\s*uri\\s*\\(`, 'gi'))) {
                const idx = m.index ?? 0;
                const { args, end } = callArgs(text, idx + m[0].length - 1);
                const stmtEnd = statementEnd(text, idx, lang);
                push(idx, Math.max(end, stmtEnd), m[1] as string, args[0] ?? null, [], client, timeoutOf(client, text.slice(idx, stmtEnd), /\.timeout\(/, false));
            }
        }
    }

    if (lang === 'csharp') {
        const client = [...clients.values()][0] ?? null;
        for (const m of text.matchAll(/\.(Get|Post|Put|Delete|Patch)(?:Async|FromJsonAsync|StringAsync|ByteArrayAsync|StreamAsync|AsJsonAsync)\s*\(/g)) {
            const idx = m.index ?? 0;
            const { args, end } = callArgs(text, idx + m[0].length - 1);
            push(idx, end, m[1] as string, args[0] ?? null, [], client, timeoutOf(client, '', /\.Timeout\s*=/, true));
        }
        for (const m of text.matchAll(/new\s+HttpRequestMessage\s*\(\s*HttpMethod\.(\w+)\s*,/g)) {
            const idx = m.index ?? 0;
            const { args, end } = callArgs(text, idx + m[0].length - (m[0].length - m[0].indexOf('(')));
            push(idx, end, m[1] as string, args[1] ?? null, [], client, timeoutOf(client, '', /\.Timeout\s*=/, true));
        }
    }

    if (lang === 'ruby') {
        const explicit = /read_timeout|open_timeout|timeout:/.test(text);
        for (const m of text.matchAll(/\bNet::HTTP\.(get|get_response|post|post_form)\s*\(/g)) {
            const idx = m.index ?? 0;
            const { args, end } = callArgs(text, idx + m[0].length - 1);
            const uri = /^URI(?:\.parse)?\(([\s\S]*)\)$/.exec((args[0] ?? '').trim());
            push(idx, end, (m[1] as string).startsWith('post') ? 'POST' : 'GET', uri ? (uri[1] as string) : (args[0] ?? null), [], null, explicit ? { timeout: true, timeoutSource: 'explicit' } : { timeout: true, timeoutSource: 'library-default' });
        }
        for (const [name, client] of clients) {
            if (name.startsWith('#')) continue;
            for (const m of text.matchAll(new RegExp(`(?:@)?\\b${name}\\.(${VERBS})\\s*\\(`, 'g'))) {
                const idx = m.index ?? 0;
                const { args, end } = callArgs(text, idx + m[0].length - 1);
                push(idx, end, m[1] as string, args[0] ?? null, [args[1] ?? null], client, timeoutOf(client, text.slice(idx, end), /timeout/, false));
            }
        }
    }

    scanSoap(ctx, out);
    scanGraphql(ctx, out);
    scanGrpc(ctx, out);
    scanWebhooks(ctx, out);
    return out;
}

function wsdlRef(expr: string, ctx: Ctx, at: number): RawCall['wsdl'] {
    const lit = /['"]([^'"]+(?:\.wsdl|\?wsdl)[^'"]*)['"]/i.exec(expr);
    if (lit) {
        const v = lit[1] as string;
        if (/^https?:\/\//i.test(v)) return { file: null, remote: v, base: null };
        return { file: v.replace(/^\/+/, ''), remote: null, base: null };
    }
    const r = baseSource(expr, ctx, at);
    if (r && 'base' in r) return { file: null, remote: null, base: r.base };
    return { file: null, remote: null, base: null };
}

function scanSoap(ctx: Ctx, out: FileScan): void {
    const { text } = ctx.src;
    const soapVars = new Map<string, { wsdl: RawCall['wsdl']; at: number; timeout: boolean; witness: Witness }>();
    const ctorRes: RegExp[] =
        ctx.lang === 'php'
            ? [/new\s+\\?SoapClient\s*\(/g]
            : ctx.lang === 'python'
              ? [/\b(?:zeep\.)?(?:Async)?Client\s*\(\s*(?=['"]|wsdl\s*=)/g]
              : ctx.lang === 'ruby'
                ? [/\bSavon\.client\s*\(/g]
                : [];
    for (const re of ctorRes) {
        for (const m of text.matchAll(re)) {
            const idx = m.index ?? 0;
            const open = text.indexOf('(', idx + m[0].length - 1);
            const { args, end } = callArgs(text, open);
            const sStart = statementStart(text, idx);
            const lhs = /(?:\$this->|self\.|@|\$)?([A-Za-z_]\w*)\s*=\s*$/.exec(text.slice(sStart, idx));
            const wsdlExpr = ctx.lang === 'ruby' ? (kwarg(args, 'wsdl') ?? args[0] ?? '') : (kwarg(args, 'wsdl') ?? args[0] ?? '');
            const opts = args.slice(1).join(',') + text.slice(sStart, end);
            soapVars.set(lhs ? (lhs[1] as string) : `#${String(idx)}`, {
                wsdl: wsdlRef(wsdlExpr, ctx, idx),
                at: idx,
                timeout: /connection_timeout|timeout/.test(opts),
                witness: ctx.src.witness(idx, end),
            });
        }
    }
    for (const [name, v] of soapVars) {
        if (name.startsWith('#')) continue;
        const callRe =
            ctx.lang === 'php'
                ? new RegExp(`(?:\\$this->|\\$)${name}\\s*->\\s*(?:__soapCall\\(\\s*['"](\\w+)['"]|(?!__)(\\w+)\\s*\\()`, 'g')
                : ctx.lang === 'python'
                  ? new RegExp(`(?:self\\.)?\\b${name}\\.service\\.(\\w+)\\s*\\(()`, 'g')
                  : new RegExp(`(?:@)?\\b${name}\\.call\\(\\s*:(\\w+)()`, 'g');
        for (const m of text.matchAll(callRe)) {
            const idx = m.index ?? 0;
            if (idx === v.at) continue;
            const op = (m[1] || m[2]) as string;
            const open = text.indexOf('(', idx + m[0].length - 1);
            const { args, end } = callArgs(text, open >= 0 ? open : idx);
            const paramExpr = ctx.lang === 'php' && m[1] ? args[1] : ctx.lang === 'ruby' ? kwarg(args, 'message') : args[0];
            const keys = ctx.lang === 'python' ? args.map((a) => /^([A-Za-z_]\w*)\s*=(?!=)/.exec(a)?.[1]).filter((k): k is string => !!k) : paramExpr ? literalKeys(paramExpr) : [];
            out.calls.push({
                from: enclosingSymbol(ctx.src, ctx.src.lineOf(idx), ctx.lang),
                protocol: 'soap',
                method: op,
                target: { service: 'unresolved', guess: true, host: null, base: v.wsdl?.base ?? null, path: '', literalWitness: null, userValue: null },
                params: keys,
                witness: ctx.src.witness(idx, end),
                timeout: true,
                timeoutSource: v.timeout ? 'explicit' : 'library-default',
                clientWitness: v.witness,
                credential: null,
                wsdl: v.wsdl,
            });
        }
    }
}

interface GqlField {
    name: string;
    args: string[];
}

function graphqlTopFields(doc: string): { kind: string; name: string | null; fields: GqlField[]; offset: number }[] {
    const out: { kind: string; name: string | null; fields: GqlField[]; offset: number }[] = [];
    const clean = doc.replace(/#[^\n]*|@\w+/g, (m) => ' '.repeat(m.length));
    for (const m of clean.matchAll(/\b(query|mutation|subscription)\b\s*(\w+)?[^{]*\{/g)) {
        const start = (m.index ?? 0) + m[0].length;
        let depth = 1;
        let i = start;
        let token = '';
        const fields: GqlField[] = [];
        let parens = 0;
        while (i < clean.length && depth > 0) {
            const c = clean[i] as string;
            if (/\w/.test(c) && depth === 1 && parens === 0) {
                token += c;
                i++;
                continue;
            }
            if (token) {
                const rest = clean.slice(i).trimStart();
                if (!rest.startsWith(':') && token !== 'on' && token !== 'fragment') {
                    const args = rest.startsWith('(') ? [...(/^\(([^)]*)\)/.exec(rest)?.[1] ?? '').matchAll(/(\w+)\s*:/g)].map((a) => a[1] as string) : [];
                    if (!fields.some((f) => f.name === token)) fields.push({ name: token, args });
                }
                token = '';
            }
            if (c === '(') parens++;
            else if (c === ')') parens--;
            else if (c === '{') depth++;
            else if (c === '}') depth--;
            i++;
        }
        out.push({ kind: m[1] as string, name: m[2] ?? null, fields, offset: m.index ?? 0 });
    }
    return out;
}

function scanGraphql(ctx: Ctx, out: FileScan): void {
    const { text, file: rel } = ctx.src;
    if (ctx.lang !== 'js') return;
    for (const m of text.matchAll(/new\s+(?:ApolloClient|GraphQLClient)\s*\(|\bcreateClient\s*\(\s*\{[^}]*\burl\s*:/g)) {
        const idx = m.index ?? 0;
        const open = text.indexOf('(', idx);
        const { args } = callArgs(text, open);
        const uri = literalValue(args[0] ?? '', 'uri') ?? literalValue(args[0] ?? '', 'url') ?? (m[0].includes('GraphQLClient') ? (args[0] ?? null) : null);
        if (uri) out.graphqlClients.push({ target: resolveTarget(uri, null, ctx, idx), witness: ctx.src.witness(idx) });
    }
    for (const m of text.matchAll(/\b(?:gql|graphql)\s*`([^`]*)`/g)) {
        const idx = m.index ?? 0;
        const bodyAt = idx + m[0].indexOf('`') + 1;
        const holder = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/.exec(text.slice(Math.max(0, idx - 120), idx));
        const from = holder ? `${rel}#${holder[1] as string}` : enclosingSymbol(ctx.src, ctx.src.lineOf(idx), ctx.lang);
        for (const op of graphqlTopFields(m[1] as string)) {
            for (const f of op.fields) {
                const at = bodyAt + op.offset;
                out.calls.push({
                    from,
                    protocol: 'graphql',
                    method: op.kind,
                    target: { service: 'graphql', guess: true, host: null, base: null, path: f.name, literalWitness: null, userValue: null },
                    params: f.args,
                    witness: ctx.src.witness(at),
                    timeout: null,
                    timeoutSource: 'unknown',
                    clientWitness: null,
                    credential: null,
                });
            }
        }
    }
}

/** GraphQL operation documents in `.graphql`/`.gql` files (not SDL). */
export function scanGraphqlDocument(rel: string, text: string): RawCall[] {
    if (/\btype\s+(?:Query|Mutation)\b|\bschema\s*\{/.test(text)) return [];
    const src = new SourceText(rel, text);
    const calls: RawCall[] = [];
    for (const op of graphqlTopFields(text)) {
        for (const f of op.fields) {
            calls.push({
                from: rel,
                protocol: 'graphql',
                method: op.kind,
                target: { service: 'graphql', guess: true, host: null, base: null, path: f.name, literalWitness: null, userValue: null },
                params: f.args,
                witness: src.witness(op.offset),
                timeout: null,
                timeoutSource: 'unknown',
                clientWitness: null,
                credential: null,
            });
        }
    }
    return calls;
}

function scanGrpc(ctx: Ctx, out: FileScan): void {
    const { text } = ctx.src;
    const stubRe: Partial<Record<Lang, RegExp>> = {
        go: /\b(\w+)\s*:?=\s*(?:\w+\.)?New(\w+)Client\s*\(\s*\w*[cC]onn/g,
        python: /\b(?:self\.)?(\w+)\s*=\s*(?:[\w.]+\.)?(\w+)Stub\s*\(/g,
        java: /\b(\w+)\s*=\s*(\w+)Grpc\.new(?:Blocking|Future)?Stub\s*\(/g,
        csharp: /\b(\w+)\s*=\s*new\s+(\w+)\.\2Client\s*\(/g,
        js: /\b(\w+)\s*=\s*new\s+(?:[\w.]+\.)?(\w+)\s*\([^)]*grpc\.credentials/g,
    };
    const re = stubRe[ctx.lang];
    if (!re) return;
    for (const m of text.matchAll(re)) {
        const v = m[1] as string;
        const svc = m[2] as string;
        const stubAt = m.index ?? 0;
        for (const c of text.matchAll(new RegExp(`(?:self\\.|this\\.)?\\b${v}\\.([A-Za-z_]\\w*)\\s*\\(`, 'g'))) {
            const idx = c.index ?? 0;
            if (idx <= stubAt + m[0].length && idx >= stubAt) continue;
            const method = c[1] as string;
            if (/^(?:close|withDeadline\w*|withCallCredentials|getChannel)$/.test(method)) continue;
            const { args, end } = callArgs(text, idx + c[0].length - 1);
            const reqArg = args.find((a) => /\{|\(/.test(a)) ?? null;
            const keys = reqArg ? literalKeys(reqArg.replace(/^[&\w.]*(?=[{(])/, '')) : null;
            const stmt = text.slice(idx, end);
            const deadline = /deadline|timeout|WithTimeout|withDeadlineAfter/i.test(stmt) || /context\.WithTimeout/.test(text);
            out.calls.push({
                from: enclosingSymbol(ctx.src, ctx.src.lineOf(idx), ctx.lang),
                protocol: 'grpc',
                method: 'rpc',
                target: { service: svc, guess: false, host: null, base: null, path: `${svc}/${method}`, literalWitness: null, userValue: null },
                params: keys,
                witness: ctx.src.witness(idx, end),
                timeout: deadline ? true : null,
                timeoutSource: deadline ? 'explicit' : 'unknown',
                clientWitness: ctx.src.witness(stubAt),
                credential: null,
                grpcService: svc,
            });
        }
    }
}

function webhookService(path: string): string {
    const segs = path.split('/').filter((s) => s && !s.startsWith('{') && !s.startsWith(':') && !s.startsWith('<'));
    const i = segs.findIndex((s) => /webhooks?/i.test(s));
    const after = segs[i + 1];
    if (i >= 0 && after) return after.toLowerCase();
    const named = /^(.+?)[-_]?webhooks?$/i.exec(segs[i] ?? '');
    if (named?.[1]) return named[1].toLowerCase();
    return 'webhook';
}

function scanWebhooks(ctx: Ctx, out: FileScan): void {
    const { text } = ctx.src;
    const routeRes: { re: RegExp; handlerArg: number }[] = [];
    if (ctx.lang === 'php') routeRes.push({ re: /Route::(post|any|put|match)\s*\(/g, handlerArg: 1 });
    if (ctx.lang === 'js') routeRes.push({ re: /\b(?:app|router|server|fastify)\.(post|all|put)\s*\(/g, handlerArg: -1 });
    if (ctx.lang === 'python') routeRes.push({ re: /@\w+\.(post|route|api_route)\s*\(/g, handlerArg: -2 });
    if (ctx.lang === 'ruby') routeRes.push({ re: /^\s*(post|match)\s+(?=['"])/gm, handlerArg: -3 });
    for (const { re, handlerArg } of routeRes) {
        for (const m of text.matchAll(re)) {
            const idx = m.index ?? 0;
            let args: string[];
            let end: number;
            if (handlerArg === -3) {
                end = text.indexOf('\n', idx);
                args = text.slice(idx + m[0].length, end < 0 ? undefined : end).split(',').map((s) => s.trim());
            } else {
                ({ args, end } = callArgs(text, idx + m[0].length - 1));
            }
            const pathArg = ctx.lang === 'php' && m[1] === 'match' ? args[1] : args[0];
            const path = stringLiteral(pathArg ?? '');
            if (!path || !/webhook/i.test(path)) continue;
            const witness = ctx.src.witness(idx, end);
            const route: WebhookRoute = { service: webhookService(path), method: 'POST', path: path.startsWith('/') ? path : `/${path}`, witness, handlerWitness: witness, signatureCheck: false };
            if (ctx.lang === 'php') {
                const h = args[handlerArg] ?? '';
                const cls = /([A-Za-z_]\w*)::class/.exec(h);
                if (cls) {
                    out.pendingHandlers.push({ route, className: cls[1] as string });
                    out.webhooks.push(route);
                    continue;
                }
                route.signatureCheck = SIGNATURE_MARKERS.test(text.slice(idx, end));
            } else if (ctx.lang === 'python') {
                const after = text.slice(end);
                const def = after.search(/\n\s*(?:async\s+)?def\s/);
                const rest = after.slice(def < 0 ? 0 : def + 1);
                const next = rest.slice(1).search(/\n(?=[^\s#])/);
                route.signatureCheck = SIGNATURE_MARKERS.test(next < 0 ? rest : rest.slice(0, next + 1));
            } else {
                route.signatureCheck = SIGNATURE_MARKERS.test(text.slice(idx, end));
            }
            out.webhooks.push(route);
        }
    }
}

/** SDK constructor call sites for the packages the manifests declare. */
export function scanSdk(rel: string, text: string, rows: { service: string; ctor: string; pkg: string }[]): RawCall[] {
    const lang = langOf(rel);
    if (!lang || !rows.length) return [];
    const src = new SourceText(rel, text);
    const calls: RawCall[] = [];
    for (const row of rows) {
        for (const m of text.matchAll(new RegExp(row.ctor, 'g'))) {
            const idx = m.index ?? 0;
            const line = src.lines[src.lineOf(idx) - 1] ?? '';
            if (/^\s*(?:\/\/|#|\*|import\b|use\b|from\b|require\b)/.test(line)) continue;
            const ctor = (m[1] ?? m[0].replace(/^new\s+/, '').replace(/[\s(=]+$/, '')).replace(/^\\/, '');
            const ctx: Ctx = { src, lang, config: { byKey: new Map(), exampleNames: new Map() }, vars: new Map() };
            calls.push({
                from: enclosingSymbol(src, src.lineOf(idx), lang),
                protocol: 'sdk',
                method: ctor,
                target: { service: row.service, guess: false, host: null, base: null, path: '', literalWitness: null, userValue: null },
                params: null,
                witness: src.witness(idx),
                timeout: null,
                timeoutSource: 'unknown',
                clientWitness: null,
                credential: credentialIn(text.slice(idx, statementEnd(text, idx, lang)), ctx, idx),
                sdkCtor: ctor,
            });
        }
    }
    return calls;
}

export function signatureCheckIn(text: string): boolean {
    return SIGNATURE_MARKERS.test(text);
}

