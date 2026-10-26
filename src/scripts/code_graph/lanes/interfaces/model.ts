/**
 * The interface lane's working model before it is flattened into `LaneOutput`.
 */
import type { SourceRung, Witness } from '../lane_fact.js';

export type Protocol = 'rest' | 'graphql' | 'soap' | 'grpc' | 'webhook' | 'queue' | 'sdk';

export interface Binding {
    /** env variable or config key the base comes from */
    name: string;
    kind: 'env' | 'config-key' | 'host' | 'contract' | 'sdk-package';
    witness: Witness;
}

export interface ServiceRec {
    name: string;
    protocols: Set<Protocol>;
    hosts: Set<string>;
    /** env names that carry the service's base address */
    baseNames: Map<string, Witness>;
    /** env names of any other configuration the service reads (keys, secrets: names only) */
    configNames: Map<string, Witness>;
    configKeys: Set<string>;
    contracts: Set<string>;
    remoteSpecs: Set<string>;
    sdkPackage: string | null;
    witness: Witness;
    rung: SourceRung;
    owner: string;
    guess: boolean;
    firstCall: Witness | null;
}

export interface OpRec {
    id: string;
    service: string;
    protocol: Protocol;
    /** REST verb, `query`/`mutation`, SOAP/gRPC operation, SDK constructor */
    method: string;
    /** REST path template, GraphQL field, gRPC `Service/Method`; empty for SOAP/SDK */
    path: string;
    params: string[];
    required: string[];
    paramSource: 'contract' | 'from-call-site' | 'none';
    source: 'contract' | 'call-site' | 'route';
    contractFile: string | null;
    witness: Witness;
    rung: SourceRung;
    owner: string;
    called: boolean;
    extra: Record<string, string | boolean | null>;
}

export interface CallRec {
    from: string;
    service: string;
    serviceGuess: boolean;
    protocol: Protocol;
    method: string;
    path: string;
    /** literal parameter names at the call site; null when the call passes a non-literal */
    params: string[] | null;
    witness: Witness;
    timeout: boolean | null;
    timeoutSource: 'explicit' | 'library-default' | 'none' | 'unknown';
    clientWitness: Witness | null;
    literalBase: { host: string; witness: Witness } | null;
    credential: { masked: string; witness: Witness } | null;
    userValue: Witness | null;
    /** set during matching */
    opId?: string;
    inContract?: boolean | null;
    contractWitness?: Witness | null;
    paramMismatch?: string[];
}

export function newService(name: string, witness: Witness, rung: SourceRung, guess: boolean): ServiceRec {
    return {
        name,
        protocols: new Set(),
        hosts: new Set(),
        baseNames: new Map(),
        configNames: new Map(),
        configKeys: new Set(),
        contracts: new Set(),
        remoteSpecs: new Set(),
        sdkPackage: null,
        witness,
        rung,
        owner: witness.file,
        guess,
        firstCall: null,
    };
}

/** `/stock/{sku}`, `/stock/:sku`, `/stock/{$sku}` → `/stock/{}` for matching */
export function pathKey(p: string): string {
    let s = p.split('?')[0] ?? '';
    s = s.replace(/\{[^}]*\}|:[A-Za-z_]\w*|<[^>]*>/g, '{}');
    s = s.replace(/\/+$/, '');
    if (!s.startsWith('/')) s = `/${s}`;
    return s.toLowerCase();
}

export function opId(service: string, protocol: Protocol, method: string, path: string): string {
    const sig = protocol === 'rest' || protocol === 'webhook' ? `${method.toUpperCase()} ${path}` : path ? `${method} ${path}` : method;
    return `operation:${service}:${sig}`;
}

export function witnessRef(w: Witness): string {
    return `${w.file}:${String(w.line)}:${w.hash}`;
}

export function parseWitnessRef(ref: unknown): Witness | null {
    if (typeof ref !== 'string') return null;
    const m = /^(.*):(\d+):([0-9a-f]{8})$/.exec(ref);
    if (!m) return null;
    return { file: m[1] as string, line: Number(m[2]), hash: m[3] as string };
}

/** Env-name stem → service name: `PARTNER_BASE_URL` → `partner`. */
export function serviceFromEnvName(name: string): string | null {
    const m = /^(?:VITE_|NEXT_PUBLIC_|REACT_APP_|NUXT_PUBLIC_)?([A-Z][A-Z0-9_]*?)_(?:API_)?(?:BASE_)?(?:URL|URI|HOST|ENDPOINT|DSN|ADDR|ADDRESS|WSDL)$/.exec(name);
    return m ? (m[1] as string).toLowerCase() : null;
}

export function isBaseName(name: string): boolean {
    return /(?:URL|URI|HOST|ENDPOINT|ADDR|ADDRESS|WSDL)$/.test(name);
}
