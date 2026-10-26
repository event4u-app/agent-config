/**
 * The interfaces lane: external services a repository talks to, the
 * operations it calls on them, and the contracts it ships for them.
 *
 * Files only. No URL, WSDL or schema location is ever fetched, `.env` files
 * are never opened, and only configuration NAMES are kept. Contract files are
 * authoritative for operations and parameters (rung T2); call sites (rung T1)
 * add what the contract does not list and are marked as such.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { LaneFact, LaneOutput, LaneRelation, Witness } from '../lane_fact.js';
import { scanFile, scanGraphqlDocument, scanSdk, signatureCheckIn, type RawCall, type WebhookRoute } from './call_sites.js';
import { emptyConfig, isSecretEnvFile, readExampleEnvNames, readLaravelConfig, readSpringConfig, siblingEntries, EXAMPLE_ENV_FILE, type ConfigIndex } from './config.js';
import { CONTRACT_FILE, readContract, type Contract } from './contracts.js';
import { MANIFEST_FILE, readManifest, type Dependency } from './manifests.js';
import { isBaseName, newService, opId, pathKey, witnessRef, type CallRec, type OpRec, type Protocol, type ServiceRec } from './model.js';
import { ECOSYSTEM_LANGS, rowMatches, SDK_TABLE } from './sdk_table.js';
import { langOf } from './text.js';

export interface ReadInterfacesOptions {
    /** repository-relative files to read instead of walking the tree */
    files?: string[];
    /** files above this size are skipped with a reason */
    maxBytes?: number;
    /** read test files for call sites too (default false: fakes and fixtures are not traffic) */
    includeTests?: boolean;
}

const SKIP_DIRS = new Set([
    '.git',
    'node_modules',
    'vendor',
    'dist',
    'build',
    'coverage',
    '.venv',
    'venv',
    '__pycache__',
    'target',
    'bin',
    'obj',
    '.next',
    '.nuxt',
    '.idea',
    '.vscode',
]);
const DEFAULT_MAX_BYTES = 1024 * 1024;
const TEST_PATH = /(?:^|\/)(?:tests?|__tests__|spec|specs)\/|\.(?:test|spec)\.[a-z]+$|_test\.go$|Tests?\.(?:java|cs|php)$/;

function walk(root: string, rel = '', out: string[] = []): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
            if (SKIP_DIRS.has(e.name) || r === 'agents/runtime' || r === 'storage/framework') continue;
            walk(root, r, out);
        } else if (e.isFile()) out.push(r);
    }
    return out;
}

function relevant(rel: string): boolean {
    if (isSecretEnvFile(rel)) return false;
    return (
        langOf(rel) !== null ||
        CONTRACT_FILE.test(rel) ||
        MANIFEST_FILE.test(rel) ||
        EXAMPLE_ENV_FILE.test(rel) ||
        /(?:^|\/)application(?:-[\w]+)?\.(?:ya?ml|properties)$/.test(rel)
    );
}

class Model {
    services = new Map<string, ServiceRec>();
    ops = new Map<string, OpRec>();
    calls: CallRec[] = [];

    service(name: string, witness: Witness, guess: boolean, rung: 'T1' | 'T2' = 'T1'): ServiceRec {
        let s = this.services.get(name);
        if (!s) {
            s = newService(name, witness, rung, guess);
            this.services.set(name, s);
        } else if (!guess && s.guess) {
            s.guess = false;
            s.witness = witness;
            s.owner = witness.file;
        }
        return s;
    }
}

/** Reads every interface fact under `root`. */
export function readInterfaces(root: string, opts: ReadInterfacesOptions = {}): LaneOutput {
    const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
    const files = (opts.files ?? walk(root)).filter(relevant);
    const skipped: LaneOutput['skipped'] = [];
    const texts = new Map<string, string>();
    for (const rel of files) {
        const abs = path.join(root, rel);
        let size: number;
        try {
            size = fs.statSync(abs).size;
        } catch (e) {
            skipped.push({ file: rel, reason: `unreadable: ${(e as Error).message}` });
            continue;
        }
        if (size > maxBytes) {
            skipped.push({ file: rel, reason: `larger than ${String(maxBytes)} bytes` });
            continue;
        }
        texts.set(rel, fs.readFileSync(abs, 'utf8'));
    }

    const config: ConfigIndex = emptyConfig();
    const deps: Dependency[] = [];
    const contracts: Contract[] = [];
    for (const [rel, text] of texts) {
        readLaravelConfig(rel, text, config);
        readSpringConfig(rel, text, config);
        readExampleEnvNames(rel, text, config);
        if (MANIFEST_FILE.test(rel)) deps.push(...readManifest(rel, text));
        if (CONTRACT_FILE.test(rel) && !MANIFEST_FILE.test(rel)) {
            const r = readContract(rel, text);
            if (r.refused) skipped.push({ file: rel, reason: `contract refused: ${r.refused}` });
            else if (r.contract) contracts.push(r.contract);
        }
    }

    const sdkRows = SDK_TABLE.filter((row) => deps.some((d) => d.ecosystem === row.ecosystem && rowMatches(row, d.name)));
    const raw: RawCall[] = [];
    const webhooks: WebhookRoute[] = [];
    const graphqlClients: ReturnType<typeof scanFile>['graphqlClients'] = [];
    const pending: ReturnType<typeof scanFile>['pendingHandlers'] = [];
    for (const [rel, text] of texts) {
        const lang = langOf(rel);
        if (/\.(?:graphql|gql)$/i.test(rel)) raw.push(...scanGraphqlDocument(rel, text));
        if (!lang) continue;
        if (!opts.includeTests && TEST_PATH.test(rel)) continue;
        const scan = scanFile(rel, text, config);
        raw.push(...scan.calls);
        webhooks.push(...scan.webhooks);
        graphqlClients.push(...scan.graphqlClients);
        pending.push(...scan.pendingHandlers);
        const rows = sdkRows.filter((r) => ECOSYSTEM_LANGS[r.ecosystem].includes(lang));
        raw.push(...scanSdk(rel, text, rows));
    }
    for (const p of pending) {
        const file = [...texts.keys()].find((f) => f.endsWith(`/${p.className}.php`) || f === `${p.className}.php`);
        if (file) {
            p.route.signatureCheck = signatureCheckIn(texts.get(file) ?? '');
            p.route.handlerWitness = { file, line: 1, hash: p.route.handlerWitness.hash };
            const lines = (texts.get(file) ?? '').split('\n');
            const classLine = lines.findIndex((l) => new RegExp(`\\bclass\\s+${p.className}\\b`).test(l));
            if (classLine >= 0) p.route.handlerWitness = { file, line: classLine + 1, hash: p.route.handlerWitness.hash };
        }
    }

    const m = new Model();
    bindSdkServices(m, deps, sdkRows);
    const contractService = bindContracts(m, contracts, config, raw, graphqlClients);
    for (const call of raw) addCall(m, call, config, contracts, contractService, graphqlClients);
    for (const w of webhooks) addWebhook(m, w);
    matchCalls(m);
    return flatten(m, config, skipped);
}

function bindSdkServices(m: Model, deps: Dependency[], rows: typeof SDK_TABLE): void {
    for (const row of rows) {
        const dep = deps.find((d) => d.ecosystem === row.ecosystem && rowMatches(row, d.name));
        if (!dep) continue;
        const s = m.service(row.service, dep.witness, false);
        s.protocols.add('sdk');
        s.sdkPackage = dep.name;
    }
}

const WORD = /[a-z0-9]+/g;

/** Which service each contract describes; null when nothing ties it to one. */
function bindContracts(
    m: Model,
    contracts: Contract[],
    config: ConfigIndex,
    raw: RawCall[],
    graphqlClients: ReturnType<typeof scanFile>['graphqlClients'],
): Map<string, { name: string; guess: boolean }> {
    const out = new Map<string, { name: string; guess: boolean }>();
    const known = new Set<string>([...raw.map((c) => c.target.service), ...[...config.byKey.keys()].filter((k) => k.startsWith('services.')).map((k) => k.split('.')[1] as string)]);
    for (const c of contracts) {
        let name: string | null = null;
        let guess = false;
        const host = c.hosts.find((h) => known.has(h));
        if (host) name = host;
        if (!name && c.format === 'wsdl') name = c.names[0] ?? path.basename(c.file).replace(/\.wsdl$/i, '');
        if (!name && c.format === 'proto') name = c.names[0] ?? null;
        if (!name && c.format === 'graphql-sdl' && graphqlClients.length === 1) {
            const t = (graphqlClients[0] as (typeof graphqlClients)[number]).target;
            name = t.service;
            guess = t.guess;
        }
        if (!name) {
            const tokens = new Set([...(c.file.toLowerCase().match(WORD) ?? []), ...(c.title?.toLowerCase().match(WORD) ?? []), ...c.names.flatMap((n) => n.toLowerCase().match(WORD) ?? [])]);
            const hits = [...known].filter((k) => k !== 'unresolved' && k !== 'graphql' && tokens.has(k.toLowerCase()));
            if (hits.length === 1) {
                name = hits[0] as string;
                guess = true;
            }
        }
        if (!name && c.hosts[0]) name = c.hosts[0];
        if (!name && (c.format === 'http' || c.format === 'postman') && c.names.length === 1) {
            name = (c.names[0] as string).toLowerCase().replace(/[_-]?(?:base[_-]?)?(?:url|host|uri)$/, '') || (c.names[0] as string);
            guess = true;
        }
        if (!name && c.format === 'graphql-sdl') {
            name = 'graphql';
            guess = true;
        }
        if (!name) {
            name = (c.title ?? path.basename(c.file)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            guess = true;
        }
        out.set(c.file, { name, guess });
        const proto: Protocol = c.format === 'wsdl' ? 'soap' : c.format === 'proto' ? 'grpc' : c.format === 'graphql-sdl' ? 'graphql' : 'rest';
        const s = m.service(name, c.witness, guess, 'T2');
        s.protocols.add(proto);
        s.contracts.add(c.file);
        for (const r of c.remoteRefs) s.remoteSpecs.add(r);
        for (const h of c.hosts) s.hosts.add(h);
        for (const op of c.ops) {
            const id = opId(name, op.protocol, op.method, op.path);
            if (m.ops.has(id)) continue;
            m.ops.set(id, {
                id,
                service: name,
                protocol: op.protocol,
                method: op.method,
                path: op.path,
                params: op.params,
                required: op.required,
                paramSource: op.params.length ? 'contract' : 'none',
                source: 'contract',
                contractFile: c.file,
                witness: op.witness,
                rung: 'T2',
                owner: c.file,
                called: false,
                extra: { base_path: c.basePath || null },
            });
        }
    }
    return out;
}

function addCall(
    m: Model,
    call: RawCall,
    config: ConfigIndex,
    contracts: Contract[],
    contractService: Map<string, { name: string; guess: boolean }>,
    graphqlClients: ReturnType<typeof scanFile>['graphqlClients'],
): void {
    let service = call.target.service;
    let guess = call.target.guess;
    let base = call.target.base;
    if (call.protocol === 'soap' && call.wsdl) {
        const wsdlFile = call.wsdl.file;
        const contract = wsdlFile ? contracts.find((c) => c.format === 'wsdl' && (c.file === wsdlFile || c.file.endsWith(`/${wsdlFile}`) || wsdlFile.endsWith(c.file) || wsdlFile.endsWith(`/${path.basename(c.file)}`))) : undefined;
        const bound = contract ? contractService.get(contract.file) : undefined;
        if (bound) {
            service = bound.name;
            guess = bound.guess;
        } else if (call.wsdl.base) {
            const k = call.wsdl.base.name;
            service = k.includes('.') ? (k.split('.').slice(-2, -1)[0] ?? k) : k.toLowerCase().replace(/_wsdl$/, '');
            guess = false;
        } else if (call.wsdl.remote) {
            service = (/^https?:\/\/([^/:]+)/i.exec(call.wsdl.remote)?.[1] ?? 'unresolved').toLowerCase();
            guess = false;
        }
    }
    if (call.protocol === 'graphql' && graphqlClients.length === 1) {
        const t = (graphqlClients[0] as (typeof graphqlClients)[number]).target;
        service = t.service;
        guess = t.guess;
        base = t.base;
    } else if (call.protocol === 'graphql') {
        const sdl = contracts.find((c) => c.format === 'graphql-sdl');
        if (sdl) service = contractService.get(sdl.file)?.name ?? service;
    }
    if (call.protocol === 'grpc') {
        const proto = contracts.find((c) => c.format === 'proto' && c.names.includes(call.grpcService ?? ''));
        if (proto) service = contractService.get(proto.file)?.name ?? service;
    }
    const s = m.service(service, call.witness, guess);
    s.protocols.add(call.protocol);
    if (call.target.host) s.hosts.add(call.target.host);
    if (call.wsdl?.remote) s.remoteSpecs.add(call.wsdl.remote);
    if (!s.firstCall) s.firstCall = call.witness;
    if (base) {
        if (base.kind === 'env') {
            if (isBaseName(base.name) || base.name.endsWith('WSDL')) s.baseNames.set(base.name, s.baseNames.get(base.name) ?? base.witness);
            else s.configNames.set(base.name, base.witness);
        } else s.configKeys.add(base.name);
        const key = [...config.byKey.values()].find((e) => e.env === base.name)?.key;
        if (key) {
            s.configKeys.add(key);
            for (const sib of siblingEntries(config, key)) {
                if (!s.baseNames.has(sib.env)) s.configNames.set(sib.env, sib.witness);
            }
        }
    }
    m.calls.push({
        from: call.from,
        service,
        serviceGuess: guess,
        protocol: call.protocol,
        method: call.method,
        path: call.protocol === 'soap' || call.protocol === 'sdk' ? '' : call.target.path,
        params: call.params,
        witness: call.witness,
        timeout: call.timeout,
        timeoutSource: call.timeoutSource,
        clientWitness: call.clientWitness,
        literalBase: call.target.host && call.target.literalWitness ? { host: call.target.host, witness: call.target.literalWitness } : null,
        credential: call.credential,
        userValue: call.target.userValue,
    });
}

function addWebhook(m: Model, w: WebhookRoute): void {
    const s = m.service(w.service, w.witness, false);
    s.protocols.add('webhook');
    const id = opId(w.service, 'webhook', w.method, w.path);
    m.ops.set(id, {
        id,
        service: w.service,
        protocol: 'webhook',
        method: w.method,
        path: w.path,
        params: [],
        required: [],
        paramSource: 'none',
        source: 'route',
        contractFile: null,
        witness: w.witness,
        rung: 'T1',
        owner: w.witness.file,
        called: true,
        extra: { direction: 'inbound', signature_check: w.signatureCheck, handler_witness: witnessRef(w.handlerWitness) },
    });
}

function contractKeyMatches(op: OpRec, call: CallRec): boolean {
    if (op.protocol !== call.protocol) return false;
    if (call.protocol === 'soap') return op.method.toLowerCase().replace(/_/g, '') === call.method.toLowerCase().replace(/_/g, '');
    if (call.protocol === 'grpc') return op.path.toLowerCase() === call.path.toLowerCase();
    if (call.protocol === 'graphql') return op.method === call.method && op.path === call.path;
    if (op.method !== call.method.toUpperCase()) return false;
    const want = pathKey(op.path);
    const got = pathKey(call.path);
    if (want === got) return true;
    const base = typeof op.extra['base_path'] === 'string' ? pathKey(op.extra['base_path']) : '';
    return base !== '/' && base !== '' && got.startsWith(base) && pathKey(got.slice(base.length)) === want;
}

function matchCalls(m: Model): void {
    for (const call of m.calls) {
        const s = m.services.get(call.service);
        const contractOps = [...m.ops.values()].filter((o) => o.service === call.service && o.source === 'contract');
        const hasContract = !!s && s.contracts.size > 0 && contractOps.some((o) => o.protocol === call.protocol);
        const hit = contractOps.find((o) => contractKeyMatches(o, call));
        if (hit) {
            hit.called = true;
            call.opId = hit.id;
            call.inContract = true;
            call.contractWitness = hit.witness;
            if (call.params) {
                const norm = (p: string): string => p.toLowerCase().replace(/[_-]/g, '');
                const allowed = new Set(hit.params.map(norm));
                const passed = new Set(call.params.map(norm));
                const unknown = call.params.filter((p) => !allowed.has(norm(p)) && !pathKey(hit.path).includes(p.toLowerCase()));
                const missing = hit.required.filter((r) => !passed.has(norm(r)));
                call.paramMismatch = hit.params.length ? [...unknown.map((u) => `+${u}`), ...missing.map((x) => `-${x}`)] : [];
            }
            continue;
        }
        call.inContract = hasContract ? false : null;
        if (hasContract) {
            const first = contractOps.find((o) => o.protocol === call.protocol) as OpRec;
            call.contractWitness = first.witness;
        }
        const id = call.protocol === 'sdk' ? opId(call.service, 'sdk', call.method, '') : opId(call.service, call.protocol, call.method, call.path);
        call.opId = id;
        const existing = m.ops.get(id);
        if (existing) {
            if (existing.paramSource !== 'contract' && call.params) existing.params = [...new Set([...existing.params, ...call.params])];
            continue;
        }
        m.ops.set(id, {
            id,
            service: call.service,
            protocol: call.protocol,
            method: call.method,
            path: call.path,
            params: call.params ?? [],
            required: [],
            paramSource: call.params?.length ? 'from-call-site' : 'none',
            source: 'call-site',
            contractFile: null,
            witness: call.witness,
            rung: 'T1',
            owner: call.witness.file,
            called: true,
            extra: {},
        });
    }
}

function flatten(m: Model, config: ConfigIndex, skipped: LaneOutput['skipped']): LaneOutput {
    const facts: LaneFact[] = [];
    const relations: LaneRelation[] = [];
    for (const s of [...m.services.values()].sort((a, b) => a.name.localeCompare(b.name))) {
        const id = `service:${s.name}`;
        const baseNames = [...s.baseNames.keys()].sort();
        facts.push({
            kind: 'service',
            id,
            name: s.name,
            attrs: {
                protocols: [...s.protocols].sort(),
                hosts: [...s.hosts].sort(),
                base_names: baseNames,
                base_name_witnesses: baseNames.map((n) => witnessRef(s.baseNames.get(n) as Witness)),
                config_names: [...s.configNames.keys()].sort(),
                config_keys: [...s.configKeys].sort(),
                undeclared_in_example: config.exampleNames.size ? [...baseNames, ...s.configNames.keys()].filter((n) => !config.exampleNames.has(n)).sort() : [],
                contracts: [...s.contracts].sort(),
                remote_specs: [...s.remoteSpecs].sort(),
                sdk_package: s.sdkPackage,
                first_call_witness: s.firstCall ? witnessRef(s.firstCall) : null,
                guess: s.guess,
            },
            witness: s.witness,
            rung: s.rung,
            owner: s.owner,
        });
        for (const n of baseNames) {
            const w = s.baseNames.get(n) as Witness;
            relations.push({ relation: 'configured-by', from: id, to: `env:${n}`, attrs: { role: 'base' }, witness: w, rung: 'T1', owner: w.file, guess: false });
        }
        for (const [n, w] of s.configNames) {
            relations.push({ relation: 'configured-by', from: id, to: `env:${n}`, attrs: { role: 'setting' }, witness: w, rung: 'T1', owner: w.file, guess: false });
        }
    }
    const callsByOp = new Map<string, CallRec[]>();
    for (const c of m.calls) {
        const list = callsByOp.get(c.opId as string) ?? [];
        list.push(c);
        callsByOp.set(c.opId as string, list);
    }
    for (const o of [...m.ops.values()].sort((a, b) => a.id.localeCompare(b.id))) {
        const svc = m.services.get(o.service);
        facts.push({
            kind: 'operation',
            id: o.id,
            name: o.path ? (o.protocol === 'rest' || o.protocol === 'webhook' ? `${o.method} ${o.path}` : o.path) : o.method,
            attrs: {
                service: o.service,
                protocol: o.protocol,
                method: o.method,
                path: o.path || null,
                params: o.params,
                required: o.required,
                param_source: o.paramSource,
                source: o.source,
                called: o.called,
                service_called: !!svc?.firstCall,
                service_call_witness: svc?.firstCall ? witnessRef(svc.firstCall) : null,
                ...o.extra,
            },
            witness: o.witness,
            rung: o.rung,
            owner: o.owner,
        });
        relations.push({ relation: 'member', from: `service:${o.service}`, to: o.id, attrs: {}, witness: o.witness, rung: o.rung, owner: o.owner, guess: false });
        if (o.contractFile) relations.push({ relation: 'described-by', from: o.id, to: o.contractFile, attrs: {}, witness: o.witness, rung: 'T2', owner: o.contractFile, guess: false });
    }
    for (const c of m.calls) {
        relations.push({
            relation: 'calls-out',
            from: c.from,
            to: c.opId as string,
            attrs: {
                protocol: c.protocol,
                method: c.method,
                path: c.path || null,
                params: c.params,
                param_source: 'from-call-site',
                timeout: c.timeout,
                timeout_source: c.timeoutSource,
                client_witness: witnessRef(c.clientWitness ?? c.witness),
                literal_base: c.literalBase?.host ?? null,
                literal_witness: c.literalBase ? witnessRef(c.literalBase.witness) : null,
                credential: c.credential?.masked ?? null,
                credential_witness: c.credential ? witnessRef(c.credential.witness) : null,
                user_value_in_url: !!c.userValue,
                user_value_witness: c.userValue ? witnessRef(c.userValue) : null,
                in_contract: c.inContract ?? null,
                contract_witness: c.contractWitness ? witnessRef(c.contractWitness) : null,
                param_mismatch: c.paramMismatch ?? [],
            },
            witness: c.witness,
            rung: 'T1',
            owner: c.witness.file,
            guess: c.serviceGuess,
        });
    }
    return { lane: 'interfaces', facts, relations, skipped };
}
