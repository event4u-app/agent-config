/**
 * Kubernetes manifests: workloads, Services, Ingresses, ConfigMaps and Secrets
 * by NAME, and the env NAMES a container declares. Secret and ConfigMap data,
 * and an env entry's value, are never read. Edges come from three
 * stated mechanisms only — an explicit reference by name, a Service's label
 * selector matching a workload's pod labels, and `ownerReferences`.
 */
import type { Document } from 'yaml';

import { entries, get, items, scalar, parseYamlSource, type YNode, type YamlSource } from '../../../_lib/infra_files/yaml_source.js';
import type { Emitter } from './emit.js';
import { isPlatformName } from './env_names.js';

const WORKLOADS = new Set(['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'ReplicaSet', 'Pod']);
const NAMED = new Set([...WORKLOADS, 'Service', 'Ingress', 'ConfigMap', 'Secret', 'PersistentVolumeClaim', 'ServiceAccount', 'HorizontalPodAutoscaler', 'NetworkPolicy']);

interface Obj {
    kind: string;
    name: string;
    namespace: string;
    line: number;
    file: string;
    id: string;
    doc: Document;
    node: YNode;
}

function at(src: YamlSource, doc: Document, node: YNode, keys: string[]): ReturnType<typeof get> {
    let cur: ReturnType<typeof get> = { key: '', line: 0, value: node };
    for (const k of keys) {
        cur = get(src, doc, cur?.value, k);
        if (!cur) return undefined;
    }
    return cur;
}

function labelsOf(src: YamlSource, doc: Document, node: YNode): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of entries(src, doc, node)) out[e.key] = scalar(doc, e.value) ?? '';
    return out;
}

/** Does a YAML text look like a Kubernetes manifest at all? */
export function looksLikeManifest(text: string): boolean {
    return /^apiVersion:\s*\S/m.test(text) && /^kind:\s*\S/m.test(text);
}

export function readKubernetesFiles(em: Emitter, files: string[]): void {
    const objs: Obj[] = [];
    const srcs = new Map<string, YamlSource>();
    for (const file of files) {
        const text = em.read(file);
        if (text === null) continue;
        if (text.includes('{{')) {
            em.skip(file, 'templated manifest (Helm/Go template) — not read');
            continue;
        }
        const src = parseYamlSource(text);
        if (src.error) {
            em.skip(file, `yaml: ${src.error}`);
            continue;
        }
        srcs.set(file, src);
        for (const doc of src.docs) {
            const root = doc.contents;
            const kind = scalar(doc, get(src, doc, root, 'kind')?.value);
            const meta = get(src, doc, root, 'metadata');
            const name = scalar(doc, get(src, doc, meta?.value, 'name')?.value);
            if (!kind || !name || !NAMED.has(kind)) continue;
            const namespace = scalar(doc, get(src, doc, meta?.value, 'namespace')?.value) ?? 'default';
            const line = get(src, doc, root, 'kind')!.line;
            const id = em.fact('resource', `k8s:${namespace}/${kind}/${name}`, `${kind}/${name}`, { api_kind: kind, namespace, workload: WORKLOADS.has(kind) }, file, line);
            objs.push({ kind, name, namespace, line, file, id, doc, node: root });
        }
    }
    const find = (kind: string, ns: string, name: string): string => `resource:k8s:${ns}/${kind}/${name}`;
    for (const o of objs) {
        const src = srcs.get(o.file)!;
        const { doc } = o;
        for (const ref of items(doc, at(src, doc, o.node, ['metadata', 'ownerReferences'])?.value)) {
            const k = scalar(doc, get(src, doc, ref, 'kind')?.value);
            const n = scalar(doc, get(src, doc, ref, 'name')?.value);
            if (k && n) em.rel('owned-by', o.id, find(k, o.namespace, n), { mechanism: 'ownerReferences', target_name: `${k}/${n}` }, o.file, src.lineOf(ref));
        }
        if (WORKLOADS.has(o.kind)) {
            const podSpecPath = o.kind === 'CronJob' ? ['spec', 'jobTemplate', 'spec', 'template', 'spec'] : o.kind === 'Pod' ? ['spec'] : ['spec', 'template', 'spec'];
            const spec = at(src, doc, o.node, podSpecPath)?.value;
            const refTo = (kind: 'ConfigMap' | 'Secret' | 'PersistentVolumeClaim' | 'ServiceAccount', name: string | null, line: number, how: string): void => {
                if (name) em.rel('configured-by', o.id, find(kind, o.namespace, name), { mechanism: how, target_name: `${kind}/${name}` }, o.file, line);
            };
            const containers = [...items(doc, get(src, doc, spec, 'containers')?.value), ...items(doc, get(src, doc, spec, 'initContainers')?.value)];
            for (const c of containers) {
                for (const ef of items(doc, get(src, doc, c, 'envFrom')?.value)) {
                    const cm = get(src, doc, ef, 'configMapRef');
                    const sr = get(src, doc, ef, 'secretRef');
                    if (cm) refTo('ConfigMap', scalar(doc, get(src, doc, cm.value, 'name')?.value), cm.line, 'envFrom');
                    if (sr) refTo('Secret', scalar(doc, get(src, doc, sr.value, 'name')?.value), sr.line, 'envFrom');
                }
                for (const ev of items(doc, get(src, doc, c, 'env')?.value)) {
                    const named = get(src, doc, ev, 'name');
                    const envName = scalar(doc, named?.value);
                    if (named && envName && /^[A-Za-z_][A-Za-z0-9_]*$/.test(envName)) {
                        const envId = em.fact('env-var', `k8s:${o.file}#${o.namespace}/${o.kind}/${o.name}:${envName}`, envName, { name: envName, source: 'kubernetes', platform: isPlatformName(envName) }, o.file, named.line);
                        em.rel('configured-by', o.id, envId, { mechanism: 'env' }, o.file, named.line);
                    }
                    const vf = get(src, doc, ev, 'valueFrom')?.value;
                    const cm = get(src, doc, vf, 'configMapKeyRef');
                    const sr = get(src, doc, vf, 'secretKeyRef');
                    if (cm) refTo('ConfigMap', scalar(doc, get(src, doc, cm.value, 'name')?.value), cm.line, 'env.valueFrom');
                    if (sr) refTo('Secret', scalar(doc, get(src, doc, sr.value, 'name')?.value), sr.line, 'env.valueFrom');
                }
            }
            for (const v of items(doc, get(src, doc, spec, 'volumes')?.value)) {
                const cm = get(src, doc, v, 'configMap');
                const sr = get(src, doc, v, 'secret');
                const pvc = get(src, doc, v, 'persistentVolumeClaim');
                if (cm) refTo('ConfigMap', scalar(doc, get(src, doc, cm.value, 'name')?.value), cm.line, 'volume');
                if (sr) refTo('Secret', scalar(doc, get(src, doc, sr.value, 'secretName')?.value), sr.line, 'volume');
                if (pvc) refTo('PersistentVolumeClaim', scalar(doc, get(src, doc, pvc.value, 'claimName')?.value), pvc.line, 'volume');
            }
            const sa = get(src, doc, spec, 'serviceAccountName');
            if (sa) refTo('ServiceAccount', scalar(doc, sa.value), sa.line, 'serviceAccountName');
        }
        if (o.kind === 'Service') {
            const sel = at(src, doc, o.node, ['spec', 'selector']);
            const want = labelsOf(src, doc, sel?.value);
            if (sel && Object.keys(want).length > 0) {
                for (const w of objs.filter((x) => WORKLOADS.has(x.kind) && x.namespace === o.namespace)) {
                    const wsrc = srcs.get(w.file)!;
                    const tplPath = w.kind === 'CronJob' ? ['spec', 'jobTemplate', 'spec', 'template', 'metadata', 'labels'] : w.kind === 'Pod' ? ['metadata', 'labels'] : ['spec', 'template', 'metadata', 'labels'];
                    const have = labelsOf(wsrc, w.doc, at(wsrc, w.doc, w.node, tplPath)?.value);
                    if (Object.entries(want).every(([k, v]) => have[k] === v)) {
                        em.rel('selects', o.id, w.id, { mechanism: 'label-selector', selector: Object.entries(want).map(([k, v]) => `${k}=${v}`) }, o.file, sel.line);
                    }
                }
            }
        }
        if (o.kind === 'Ingress') {
            const backends: { name: string | null; line: number }[] = [];
            const visit = (n: YNode, depth: number): void => {
                if (depth > 8) return;
                for (const e of entries(src, doc, n)) {
                    if (e.key === 'service') backends.push({ name: scalar(doc, get(src, doc, e.value, 'name')?.value), line: e.line });
                    else if (e.key === 'serviceName') backends.push({ name: scalar(doc, e.value), line: e.line });
                    else visit(e.value, depth + 1);
                }
                for (const it of items(doc, n)) visit(it, depth + 1);
            };
            visit(get(src, doc, o.node, 'spec')?.value, 0);
            for (const b of backends) if (b.name) em.rel('routes-to', o.id, find('Service', o.namespace, b.name), { mechanism: 'ingress backend', target_name: `Service/${b.name}` }, o.file, b.line);
        }
    }
}
