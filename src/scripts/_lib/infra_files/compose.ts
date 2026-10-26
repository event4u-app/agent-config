/**
 * Compose file reader (also reads a `docker compose config` output, which is
 * the same format). Environment entries are returned as NAMES only: a value
 * written after `=` or under a mapping key is never copied out of the parse,
 * and an `env_file` is recorded by name and never opened.
 */
import { entries, get, items, scalar, isMapNode, parseYamlSource, type YamlSource } from './yaml_source.js';

export interface ComposePort {
    /** host port or range as written; null when Docker picks the host port */
    published: string | null;
    target: string;
    protocol: string;
    /** host interface as written (an IP or a variable); null when not given */
    hostIp: string | null;
    line: number;
}

export interface ComposeService {
    name: string;
    line: number;
    image: string | null;
    imageLine: number;
    /** build context, when the service builds its own image */
    build: string | null;
    dockerfile: string | null;
    ports: ComposePort[];
    networks: { name: string; line: number }[];
    volumes: { source: string | null; target: string; named: boolean; line: number }[];
    dependsOn: { name: string; line: number }[];
    envNames: { name: string; line: number }[];
    envFiles: { name: string; line: number }[];
}

export interface ComposeModel {
    services: ComposeService[];
    networks: { name: string; line: number }[];
    volumes: { name: string; line: number }[];
    error: string | null;
    source: YamlSource;
}

/** Short port syntax: [[host_ip:]published:]target[/protocol]. IPv6 hosts come bracketed. */
export function parsePortShort(spec: string): Omit<ComposePort, 'line'> {
    let s = spec.trim();
    let protocol = 'tcp';
    const proto = /\/(tcp|udp|sctp)$/i.exec(s);
    if (proto) {
        protocol = proto[1]!.toLowerCase();
        s = s.slice(0, -proto[0].length);
    }
    let hostIp: string | null = null;
    const v6 = /^\[([^\]]+)\]:(.*)$/.exec(s);
    if (v6) {
        hostIp = v6[1]!;
        s = v6[2]!;
    }
    const parts = s.split(':');
    if (parts.length === 1) return { published: null, target: parts[0]!, protocol, hostIp };
    if (parts.length === 2) return { published: parts[0] || null, target: parts[1]!, protocol, hostIp };
    return { published: parts[parts.length - 2] || null, target: parts[parts.length - 1]!, protocol, hostIp: hostIp ?? parts.slice(0, -2).join(':') };
}

export function parseCompose(text: string): ComposeModel {
    const src = parseYamlSource(text);
    const model: ComposeModel = { services: [], networks: [], volumes: [], error: src.error, source: src };
    const doc = src.docs[0];
    if (!doc || src.error) return model;
    const root = doc.contents;
    for (const e of entries(src, doc, get(src, doc, root, 'networks')?.value)) model.networks.push({ name: e.key, line: e.line });
    for (const e of entries(src, doc, get(src, doc, root, 'volumes')?.value)) model.volumes.push({ name: e.key, line: e.line });
    const namedVolumes = new Set(model.volumes.map((v) => v.name));
    for (const svc of entries(src, doc, get(src, doc, root, 'services')?.value)) {
        const body = svc.value;
        const image = get(src, doc, body, 'image');
        const build = get(src, doc, body, 'build');
        const s: ComposeService = {
            name: svc.key,
            line: svc.line,
            image: image ? scalar(doc, image.value) : null,
            imageLine: image?.line ?? svc.line,
            build: build ? (scalar(doc, build.value) ?? scalar(doc, get(src, doc, build.value, 'context')?.value) ?? '.') : null,
            dockerfile: build ? scalar(doc, get(src, doc, build.value, 'dockerfile')?.value) : null,
            ports: [],
            networks: [],
            volumes: [],
            dependsOn: [],
            envNames: [],
            envFiles: [],
        };
        for (const p of items(doc, get(src, doc, body, 'ports')?.value)) {
            const line = src.lineOf(p);
            const short = scalar(doc, p);
            if (short !== null) {
                s.ports.push({ ...parsePortShort(short), line });
            } else {
                const target = scalar(doc, get(src, doc, p, 'target')?.value);
                if (target === null) continue;
                s.ports.push({
                    published: scalar(doc, get(src, doc, p, 'published')?.value),
                    target,
                    protocol: scalar(doc, get(src, doc, p, 'protocol')?.value) ?? 'tcp',
                    hostIp: scalar(doc, get(src, doc, p, 'host_ip')?.value),
                    line,
                });
            }
        }
        const nets = get(src, doc, body, 'networks');
        if (nets) {
            if (isMapNode(doc, nets.value)) for (const n of entries(src, doc, nets.value)) s.networks.push({ name: n.key, line: n.line });
            else for (const n of items(doc, nets.value)) { const v = scalar(doc, n); if (v) s.networks.push({ name: v, line: src.lineOf(n) }); }
        }
        for (const v of items(doc, get(src, doc, body, 'volumes')?.value)) {
            const line = src.lineOf(v);
            const short = scalar(doc, v);
            let source: string | null;
            let target: string;
            if (short !== null) {
                const parts = short.split(':');
                source = parts.length > 1 ? parts[0]! : null;
                target = parts.length > 1 ? parts[1]! : parts[0]!;
            } else {
                source = scalar(doc, get(src, doc, v, 'source')?.value);
                target = scalar(doc, get(src, doc, v, 'target')?.value) ?? '';
            }
            const named = source !== null && !/^[./~$]/.test(source) && (namedVolumes.has(source) || !source.includes('/'));
            s.volumes.push({ source, target, named, line });
        }
        const dep = get(src, doc, body, 'depends_on');
        if (dep) {
            if (isMapNode(doc, dep.value)) for (const d of entries(src, doc, dep.value)) s.dependsOn.push({ name: d.key, line: d.line });
            else for (const d of items(doc, dep.value)) { const v = scalar(doc, d); if (v) s.dependsOn.push({ name: v, line: src.lineOf(d) }); }
        }
        const env = get(src, doc, body, 'environment');
        if (env) {
            if (isMapNode(doc, env.value)) {
                for (const e of entries(src, doc, env.value)) s.envNames.push({ name: e.key, line: e.line });
            } else {
                for (const e of items(doc, env.value)) {
                    const raw = scalar(doc, e);
                    const name = raw?.split('=')[0]?.trim();
                    if (name) s.envNames.push({ name, line: src.lineOf(e) });
                }
            }
        }
        const envFile = get(src, doc, body, 'env_file');
        if (envFile) {
            const listed = items(doc, envFile.value);
            const nodes = listed.length > 0 ? listed : [envFile.value];
            for (const n of nodes) {
                const name = scalar(doc, n) ?? scalar(doc, get(src, doc, n, 'path')?.value);
                if (name) s.envFiles.push({ name, line: listed.length > 0 ? src.lineOf(n) : envFile.line });
            }
        }
        model.services.push(s);
    }
    return model;
}
