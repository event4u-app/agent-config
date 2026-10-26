/**
 * Redaction for runtime and delivery facts. Hostnames, IP addresses and cloud
 * account ids identify a client's infrastructure; a committed map must not
 * carry them. A redacted value keeps its shape (`<ip>`, `<host>`,
 * `<account>`) so a reader sees that something was there.
 */
import type { LaneFact, LaneOutput, LaneRelation } from '../lane_fact.js';

/** Registries whose name says nothing about a client. */
const PUBLIC_REGISTRIES = new Set(['docker.io', 'index.docker.io', 'ghcr.io', 'quay.io', 'gcr.io', 'mcr.microsoft.com', 'public.ecr.aws', 'registry.gitlab.com', 'registry.k8s.io']);

const IPV4 = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?:\/\d{1,2})?\b/g;
const IPV6 = /(?<![\w:])[0-9a-f:]*:[0-9a-f:]*:[0-9a-f:]*(?![\w:])/gi;
const ACCOUNT = /(?<![\w.-])\d{12}(?![\w-])/g;
const ARN_ACCOUNT = /(arn:aws[\w-]*:[\w-]+:[\w-]*:)\d{12}/g;
const GCP_PROJECT = /(projects\/)[a-z][a-z0-9-]{4,28}[a-z0-9](?=\/(?:locations|zones|regions|global|secrets|topics|subscriptions|instances|databases)\b)/g;
const AZURE_SUB = /(subscriptions\/)[0-9a-f-]{36}/gi;
/** a dotted name ending in a top-level domain; file names end in an extension and are not matched */
const HOST = /(?<![\w-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|de|eu|cloud|internal|corp|uk|ch|at|fr|nl)\b/gi;

export function redactText(value: string): { text: string; redacted: boolean } {
    let out = value
        .replace(ARN_ACCOUNT, '$1<account>')
        .replace(GCP_PROJECT, '$1<project>')
        .replace(AZURE_SUB, '$1<subscription>')
        .replace(IPV4, '<ip>')
        .replace(IPV6, (m) => (m.includes('::') || m.split(':').length === 8 ? '<ip>' : m))
        .replace(ACCOUNT, '<account>')
        .replace(HOST, (h) => (PUBLIC_REGISTRIES.has(h.toLowerCase()) ? h : '<host>'));
    if (out === '') out = value;
    return { text: out, redacted: out !== value };
}

/** An image reference with a private registry host replaced. */
export function redactImage(ref: string): { text: string; redacted: boolean } {
    const slash = ref.indexOf('/');
    const first = slash > 0 ? ref.slice(0, slash) : '';
    const isHost = first.includes('.') || first.includes(':') || first === 'localhost';
    if (isHost && !PUBLIC_REGISTRIES.has(first.toLowerCase())) {
        const rest = redactText(ref.slice(slash));
        return { text: `<registry>${rest.text}`, redacted: true };
    }
    return redactText(ref);
}

type Attrs = LaneFact['attrs'];

function redactAttrs(attrs: Attrs): { attrs: Attrs; redacted: boolean } {
    let any = false;
    const out: Attrs = {};
    for (const [k, v] of Object.entries(attrs)) {
        if (typeof v === 'string') {
            const r = redactText(v);
            any ||= r.redacted;
            out[k] = r.text;
        } else if (Array.isArray(v)) {
            out[k] = v.map((x) => {
                const r = redactText(x);
                any ||= r.redacted;
                return r.text;
            });
        } else {
            out[k] = v;
        }
    }
    return { attrs: out, redacted: any };
}

/**
 * The last pass over a lane's output: every string attribute, name and id is
 * redacted, and a fact or relation that lost something carries `redacted: true`.
 */
export function redactOutput(out: LaneOutput): LaneOutput {
    const id = (s: string): string => redactText(s).text;
    const facts: LaneFact[] = out.facts.map((f) => {
        const a = redactAttrs(f.attrs);
        const name = redactText(f.name);
        const marked = a.redacted || name.redacted || f.attrs['redacted'] === true;
        return { ...f, id: id(f.id), name: name.text, attrs: marked ? { ...a.attrs, redacted: true } : a.attrs };
    });
    const relations: LaneRelation[] = out.relations.map((r) => {
        const a = redactAttrs(r.attrs);
        return { ...r, from: id(r.from), to: id(r.to), attrs: a.redacted ? { ...a.attrs, redacted: true } : a.attrs };
    });
    return { ...out, facts, relations };
}
