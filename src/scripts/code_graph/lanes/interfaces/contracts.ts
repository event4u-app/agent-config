/**
 * Interface contracts committed to the repository (rung T2): OpenAPI 3 /
 * Swagger 2, WSDL 1.1 / 2.0 with inline XSD, GraphQL SDL, `.proto`, Postman
 * collections and `.http` request files.
 *
 * Nothing here follows a reference out of the file: a remote `$ref`, a WSDL
 * import or a schema location is recorded as a reference string, never fetched.
 */
import { parse as parseYaml } from 'yaml';
import type { Witness } from '../lane_fact.js';
import type { Protocol } from './model.js';
import { SourceText } from './text.js';
import { childrenNamed, descendantsNamed, localRef, parseXml, XmlRefused, type XmlElement } from './xml.js';

export interface ContractOp {
    protocol: Protocol;
    method: string;
    path: string;
    params: string[];
    required: string[];
    witness: Witness;
}

export interface Contract {
    file: string;
    format: 'openapi' | 'swagger' | 'wsdl' | 'graphql-sdl' | 'proto' | 'postman' | 'http';
    /** hints to bind the contract to a service */
    hosts: string[];
    /** WSDL service names, proto service names, `{{var}}` names of a collection */
    names: string[];
    title: string | null;
    /** path prefix every operation is served under (`/v1`) */
    basePath: string;
    ops: ContractOp[];
    remoteRefs: string[];
    witness: Witness;
}

export interface ContractResult {
    contract: Contract | null;
    refused: string | null;
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

function lineOfKey(src: SourceText, needle: RegExp, from = 0): Witness {
    const m = needle.exec(src.text.slice(from));
    return m ? src.witness(from + m.index) : src.witnessAtLine(1);
}

function hostOf(url: string): string | null {
    const m = /^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i.exec(url.trim());
    return m ? (m[1] as string).toLowerCase() : null;
}

function pathOf(url: string): string {
    const m = /^[a-z][a-z0-9+.-]*:\/\/[^/]+(\/[^?#]*)?/i.exec(url.trim());
    if (m) return (m[1] ?? '').replace(/\/+$/, '');
    return url.startsWith('/') ? url.replace(/\/+$/, '') : '';
}

function readOpenApi(rel: string, text: string): Contract | null {
    let doc: unknown;
    try {
        doc = rel.endsWith('.json') ? JSON.parse(text) : parseYaml(text, { maxAliasCount: 50 });
    } catch {
        return null;
    }
    if (!doc || typeof doc !== 'object') return null;
    const d = doc as Record<string, unknown>;
    const isOas = typeof d['openapi'] === 'string';
    const isSwagger = String(d['swagger'] ?? '').startsWith('2');
    if (!isOas && !isSwagger) return null;
    const src = new SourceText(rel, text);
    const hosts: string[] = [];
    let basePath = '';
    if (isOas && Array.isArray(d['servers'])) {
        for (const s of d['servers'] as Record<string, unknown>[]) {
            const url = String(s['url'] ?? '');
            const h = hostOf(url);
            if (h) hosts.push(h);
            if (!basePath) basePath = pathOf(url);
        }
    }
    if (isSwagger) {
        if (typeof d['host'] === 'string') hosts.push((d['host'] as string).toLowerCase().split(':')[0] as string);
        if (typeof d['basePath'] === 'string') basePath = (d['basePath'] as string).replace(/\/+$/, '');
    }
    const schemas = ((d['components'] as Record<string, unknown> | undefined)?.['schemas'] ?? d['definitions'] ?? {}) as Record<string, unknown>;
    const remoteRefs = new Set<string>();
    const resolve = (node: unknown): Record<string, unknown> | null => {
        if (!node || typeof node !== 'object') return null;
        const n = node as Record<string, unknown>;
        const ref = n['$ref'];
        if (typeof ref === 'string') {
            if (!ref.startsWith('#')) {
                remoteRefs.add(ref);
                return null;
            }
            const name = ref.slice(ref.lastIndexOf('/') + 1);
            const target = schemas[name];
            return target && typeof target === 'object' ? (target as Record<string, unknown>) : null;
        }
        return n;
    };
    const ops: ContractOp[] = [];
    const paths = (d['paths'] ?? {}) as Record<string, unknown>;
    let cursor = 0;
    for (const [p, item] of Object.entries(paths)) {
        if (!item || typeof item !== 'object') continue;
        const pathWitnessIdx = src.text.indexOf(p, cursor);
        if (pathWitnessIdx >= 0) cursor = pathWitnessIdx;
        const shared = Array.isArray((item as Record<string, unknown>)['parameters']) ? ((item as Record<string, unknown>)['parameters'] as unknown[]) : [];
        for (const [method, raw] of Object.entries(item as Record<string, unknown>)) {
            if (!HTTP_METHODS.includes(method) || !raw || typeof raw !== 'object') continue;
            const op = raw as Record<string, unknown>;
            const params: string[] = [];
            const required: string[] = [];
            const all = [...shared, ...(Array.isArray(op['parameters']) ? (op['parameters'] as unknown[]) : [])];
            for (const prm of all) {
                const r = resolve(prm);
                if (!r || typeof r['name'] !== 'string') continue;
                if (r['in'] === 'header' || r['in'] === 'cookie') continue;
                if (r['in'] === 'body') {
                    collectProps(resolve(r['schema']), resolve, params, required);
                    continue;
                }
                params.push(r['name']);
                if (r['required'] === true && r['in'] !== 'path') required.push(r['name']);
            }
            const body = resolve(op['requestBody']);
            const content = (body?.['content'] ?? {}) as Record<string, unknown>;
            for (const media of Object.values(content)) {
                collectProps(resolve((media as Record<string, unknown> | null)?.['schema']), resolve, params, required);
                break;
            }
            const methodIdx = pathWitnessIdx >= 0 ? src.text.slice(pathWitnessIdx).search(new RegExp(`["']?${method}["']?\\s*:`)) : -1;
            const witness = methodIdx >= 0 ? src.witness(pathWitnessIdx + methodIdx) : lineOfKey(src, new RegExp(escapeRe(p)));
            ops.push({ protocol: 'rest', method: method.toUpperCase(), path: p, params: uniq(params), required: uniq(required), witness });
        }
    }
    const info = (d['info'] ?? {}) as Record<string, unknown>;
    return {
        file: rel,
        format: isOas ? 'openapi' : 'swagger',
        hosts,
        names: [],
        title: typeof info['title'] === 'string' ? (info['title'] as string) : null,
        basePath,
        ops,
        remoteRefs: [...remoteRefs],
        witness: src.witnessAtLine(1),
    };
}

function collectProps(
    schema: Record<string, unknown> | null,
    resolve: (n: unknown) => Record<string, unknown> | null,
    params: string[],
    required: string[],
): void {
    if (!schema) return;
    const props = schema['properties'];
    if (props && typeof props === 'object') params.push(...Object.keys(props));
    if (Array.isArray(schema['required'])) required.push(...(schema['required'] as unknown[]).filter((x): x is string => typeof x === 'string'));
    for (const k of ['allOf']) {
        if (Array.isArray(schema[k])) for (const s of schema[k] as unknown[]) collectProps(resolve(s), resolve, params, required);
    }
}

function uniq(xs: string[]): string[] {
    return [...new Set(xs)];
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readWsdl(rel: string, text: string): ContractResult {
    let root: XmlElement;
    try {
        root = parseXml(text);
    } catch (e) {
        return { contract: null, refused: e instanceof XmlRefused ? e.reason : String(e) };
    }
    if (root.name !== 'definitions' && root.name !== 'description') return { contract: null, refused: null };
    const src = new SourceText(rel, text);
    const elements = new Map<string, XmlElement>();
    for (const schema of descendantsNamed(root, 'schema')) {
        for (const el of childrenNamed(schema, 'element')) if (el.attrs['name']) elements.set(el.attrs['name'], el);
    }
    const remoteRefs: string[] = [];
    for (const imp of [...descendantsNamed(root, 'import'), ...descendantsNamed(root, 'include')]) {
        const loc = imp.attrs['location'] ?? imp.attrs['schemaLocation'];
        if (loc) remoteRefs.push(loc);
    }
    const fieldsOf = (elementName: string): { params: string[]; required: string[] } => {
        const el = elements.get(localRef(elementName));
        const params: string[] = [];
        const required: string[] = [];
        if (!el) return { params, required };
        for (const f of descendantsNamed(el, 'element')) {
            const n = f.attrs['name'] ?? localRef(f.attrs['ref']);
            if (!n) continue;
            params.push(n);
            if (f.attrs['minOccurs'] !== '0' && f.attrs['nillable'] !== 'true') required.push(n);
        }
        return { params, required };
    };
    const messages = new Map<string, { params: string[]; required: string[] }>();
    for (const msg of childrenNamed(root, 'message')) {
        const params: string[] = [];
        const required: string[] = [];
        for (const part of childrenNamed(msg, 'part')) {
            if (part.attrs['element']) {
                const f = fieldsOf(part.attrs['element']);
                params.push(...f.params);
                required.push(...f.required);
            } else if (part.attrs['name']) {
                params.push(part.attrs['name']);
                required.push(part.attrs['name']);
            }
        }
        if (msg.attrs['name']) messages.set(msg.attrs['name'], { params, required });
    }
    const ops: ContractOp[] = [];
    const seen = new Set<string>();
    for (const holder of [...childrenNamed(root, 'portType'), ...childrenNamed(root, 'interface')]) {
        for (const op of childrenNamed(holder, 'operation')) {
            const name = op.attrs['name'];
            if (!name || seen.has(name)) continue;
            seen.add(name);
            const input = childrenNamed(op, 'input')[0];
            let fields = { params: [] as string[], required: [] as string[] };
            if (input?.attrs['message']) fields = messages.get(localRef(input.attrs['message'])) ?? fields;
            else if (input?.attrs['element']) fields = fieldsOf(input.attrs['element']);
            ops.push({ protocol: 'soap', method: name, path: '', params: uniq(fields.params), required: uniq(fields.required), witness: src.witnessAtLine(op.line) });
        }
    }
    const names: string[] = [];
    const hosts: string[] = [];
    for (const svc of childrenNamed(root, 'service')) {
        if (svc.attrs['name']) names.push(svc.attrs['name']);
        for (const addr of descendantsNamed(svc, 'address')) {
            const h = hostOf(addr.attrs['location'] ?? '');
            if (h) hosts.push(h);
        }
        for (const ep of descendantsNamed(svc, 'endpoint')) {
            const h = hostOf(ep.attrs['address'] ?? '');
            if (h) hosts.push(h);
        }
    }
    return {
        contract: { file: rel, format: 'wsdl', hosts, names, title: root.attrs['name'] ?? null, basePath: '', ops, remoteRefs, witness: src.witnessAtLine(root.line) },
        refused: null,
    };
}

function stripGraphqlComments(text: string): string {
    const blank = (m: string): string => m.replace(/[^\n]/g, ' ');
    return text
        .replace(/@\w+(?:\([^)]*\))?/g, blank).replace(/"""[\s\S]*?"""/g, blank)
        .replace(/#[^\n]*/g, blank);
}

/** Root fields of `type Query/Mutation/Subscription { … }` (and `extend type`). */
function readGraphqlSdl(rel: string, text: string): Contract | null {
    const clean = stripGraphqlComments(text);
    if (!/\b(?:type|extend\s+type)\s+(?:Query|Mutation|Subscription)\b|\bschema\s*\{/.test(clean)) return null;
    const src = new SourceText(rel, text);
    const ops: ContractOp[] = [];
    for (const m of clean.matchAll(/\b(?:extend\s+)?type\s+(Query|Mutation|Subscription)\b[^{]*\{/g)) {
        const kind = (m[1] as string).toLowerCase();
        const bodyStart = (m.index ?? 0) + m[0].length;
        const bodyEnd = clean.indexOf('}', bodyStart);
        const body = clean.slice(bodyStart, bodyEnd < 0 ? clean.length : bodyEnd);
        for (const f of body.matchAll(/([A-Za-z_]\w*)\s*(\([^)]*\))?\s*:/g)) {
            const params: string[] = [];
            const required: string[] = [];
            for (const a of (f[2] ?? '').matchAll(/([A-Za-z_]\w*)\s*:\s*([^,)=]+)/g)) {
                params.push(a[1] as string);
                if ((a[2] as string).trim().endsWith('!')) required.push(a[1] as string);
            }
            ops.push({ protocol: 'graphql', method: kind, path: f[1] as string, params, required, witness: src.witness(bodyStart + (f.index ?? 0)) });
        }
    }
    return { file: rel, format: 'graphql-sdl', hosts: [], names: [], title: null, basePath: '', ops, remoteRefs: [], witness: src.witnessAtLine(1) };
}

function readProto(rel: string, text: string): Contract | null {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
    const src = new SourceText(rel, text);
    const messages = new Map<string, string[]>();
    for (const m of clean.matchAll(/\bmessage\s+(\w+)\s*\{/g)) {
        const start = (m.index ?? 0) + m[0].length;
        let depth = 1;
        let i = start;
        while (i < clean.length && depth > 0) {
            if (clean[i] === '{') depth++;
            else if (clean[i] === '}') depth--;
            i++;
        }
        const body = clean.slice(start, i - 1).replace(/\{[\s\S]*?\}/g, '');
        const fields = [...body.matchAll(/(?:^|;|\n)\s*(?:repeated\s+|optional\s+)?[\w.<>, ]+?\s+(\w+)\s*=\s*\d+/g)].map((f) => f[1] as string);
        messages.set(m[1] as string, fields);
    }
    const ops: ContractOp[] = [];
    const names: string[] = [];
    for (const s of clean.matchAll(/\bservice\s+(\w+)\s*\{/g)) {
        const svc = s[1] as string;
        names.push(svc);
        const start = (s.index ?? 0) + s[0].length;
        const end = clean.indexOf('\n}', start);
        const body = clean.slice(start, end < 0 ? clean.length : end);
        for (const r of body.matchAll(/\brpc\s+(\w+)\s*\(\s*(?:stream\s+)?([\w.]+)\s*\)/g)) {
            const req = (r[2] as string).split('.').pop() as string;
            const params = messages.get(req) ?? [];
            ops.push({ protocol: 'grpc', method: 'rpc', path: `${svc}/${r[1] as string}`, params, required: [], witness: src.witness(start + (r.index ?? 0)) });
        }
    }
    if (!ops.length && !names.length) return null;
    return { file: rel, format: 'proto', hosts: [], names, title: null, basePath: '', ops, remoteRefs: [], witness: src.witnessAtLine(1) };
}

function splitTemplateUrl(raw: string): { variable: string | null; host: string | null; path: string; query: string[] } {
    const [noQuery, query = ''] = raw.split('?');
    const v = /^\{\{\s*([\w.-]+)\s*\}\}/.exec(noQuery ?? '');
    let path = noQuery ?? '';
    let host: string | null = null;
    if (v) path = path.slice(v[0].length);
    else {
        host = hostOf(path);
        path = pathOf(path);
    }
    path = path.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, '{$1}');
    const keys = query
        .split('&')
        .map((kv) => kv.split('=')[0] ?? '')
        .filter((k) => /^[\w.-]+$/.test(k));
    return { variable: v ? (v[1] as string) : null, host, path: path || '/', query: keys };
}

function readPostman(rel: string, text: string): Contract | null {
    let doc: Record<string, unknown>;
    try {
        doc = JSON.parse(text) as Record<string, unknown>;
    } catch {
        return null;
    }
    const info = doc['info'] as Record<string, unknown> | undefined;
    if (!info || !String(info['schema'] ?? '').includes('getpostman.com')) return null;
    const src = new SourceText(rel, text);
    const ops: ContractOp[] = [];
    const names = new Set<string>();
    const hosts = new Set<string>();
    const walk = (items: unknown): void => {
        if (!Array.isArray(items)) return;
        for (const it of items as Record<string, unknown>[]) {
            if (it['item']) walk(it['item']);
            const req = it['request'] as Record<string, unknown> | string | undefined;
            if (!req) continue;
            const method = typeof req === 'string' ? 'GET' : String(req['method'] ?? 'GET');
            const urlNode = typeof req === 'string' ? req : req['url'];
            const raw = typeof urlNode === 'string' ? urlNode : String((urlNode as Record<string, unknown> | undefined)?.['raw'] ?? '');
            if (!raw) continue;
            const u = splitTemplateUrl(raw);
            if (u.variable) names.add(u.variable);
            if (u.host) hosts.add(u.host);
            const idx = src.text.indexOf(JSON.stringify(raw).slice(1, -1));
            ops.push({ protocol: 'rest', method: method.toUpperCase(), path: u.path, params: u.query, required: [], witness: idx >= 0 ? src.witness(idx) : src.witnessAtLine(1) });
        }
    };
    walk(doc['item']);
    return { file: rel, format: 'postman', hosts: [...hosts], names: [...names], title: typeof info['name'] === 'string' ? (info['name'] as string) : null, basePath: '', ops, remoteRefs: [], witness: src.witnessAtLine(1) };
}

/** `.http` / `.rest` request files: only request lines are kept, never a header or a body. */
function readHttpFile(rel: string, text: string): Contract | null {
    const src = new SourceText(rel, text);
    const ops: ContractOp[] = [];
    const names = new Set<string>();
    const hosts = new Set<string>();
    src.lines.forEach((line, i) => {
        const m = /^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/.exec(line);
        if (!m) return;
        const u = splitTemplateUrl(m[2] as string);
        if (u.variable) names.add(u.variable);
        if (u.host) hosts.add(u.host);
        ops.push({ protocol: 'rest', method: m[1] as string, path: u.path, params: u.query, required: [], witness: src.witnessAtLine(i + 1) });
    });
    if (!ops.length) return null;
    return { file: rel, format: 'http', hosts: [...hosts], names: [...names], title: null, basePath: '', ops, remoteRefs: [], witness: src.witnessAtLine(1) };
}

export const CONTRACT_FILE = /\.(?:ya?ml|json|wsdl|xsd|graphqls?|gql|proto|http|rest)$/i;

/** Reads one candidate file; `contract` null with `refused` null means "not a contract". */
export function readContract(rel: string, text: string): ContractResult {
    const lower = rel.toLowerCase();
    if (lower.endsWith('.wsdl')) return readWsdl(rel, text);
    if (lower.endsWith('.xsd')) return { contract: null, refused: null };
    if (/\.(?:graphqls?|gql)$/.test(lower)) return { contract: readGraphqlSdl(rel, text), refused: null };
    if (lower.endsWith('.proto')) return { contract: readProto(rel, text), refused: null };
    if (/\.(?:http|rest)$/.test(lower)) return { contract: readHttpFile(rel, text), refused: null };
    if (lower.endsWith('.json')) {
        if (text.includes('getpostman.com')) return { contract: readPostman(rel, text), refused: null };
        if (!/"(?:openapi|swagger)"\s*:/.test(text)) return { contract: null, refused: null };
        return { contract: readOpenApi(rel, text), refused: null };
    }
    if (/^\s*(?:openapi|swagger)\s*:/m.test(text)) return { contract: readOpenApi(rel, text), refused: null };
    return { contract: null, refused: null };
}
