/** Makefile and Taskfile targets, with the targets each depends on. */
import { entries, get, items, scalar, parseYamlSource } from '../../../_lib/infra_files/yaml_source.js';

export interface Target {
    name: string;
    line: number;
    deps: { name: string; line: number }[];
}

const SPECIAL = /^\.(PHONY|DEFAULT|SUFFIXES|PRECIOUS|INTERMEDIATE|SECONDARY|SILENT|IGNORE|ONESHELL|EXPORT_ALL_VARIABLES|NOTPARALLEL|DELETE_ON_ERROR|LOW_RESOLUTION_TIME|SECONDEXPANSION|POSIX)$/;

export function parseMakefile(text: string): Target[] {
    const out: Target[] = [];
    text.split('\n').forEach((l, i) => {
        if (/^\s/.test(l) || l.startsWith('#')) return;
        const m = /^([A-Za-z0-9_./%-]+(?:\s+[A-Za-z0-9_./%-]+)*)\s*:(?![=:])\s*([^#;]*)/.exec(l);
        if (!m) return;
        const deps = m[2]!.split('|')[0]!.trim().split(/\s+/).filter((d) => d !== '' && !d.includes('$'));
        for (const name of m[1]!.split(/\s+/)) {
            if (SPECIAL.test(name) || name.includes('%')) continue;
            out.push({ name, line: i + 1, deps: deps.map((d) => ({ name: d, line: i + 1 })) });
        }
    });
    return out;
}

export function parseTaskfile(text: string): Target[] {
    const src = parseYamlSource(text);
    const doc = src.docs[0];
    if (!doc || src.error) return [];
    const out: Target[] = [];
    for (const t of entries(src, doc, get(src, doc, doc.contents, 'tasks')?.value)) {
        const deps: Target['deps'] = [];
        const d = get(src, doc, t.value, 'deps');
        for (const n of items(doc, d?.value)) {
            const name = scalar(doc, n) ?? scalar(doc, get(src, doc, n, 'task')?.value);
            if (name) deps.push({ name, line: src.lineOf(n) });
        }
        for (const c of items(doc, get(src, doc, t.value, 'cmds')?.value)) {
            const task = get(src, doc, c, 'task');
            const name = task ? scalar(doc, task.value) : null;
            if (task && name) deps.push({ name, line: task.line });
        }
        out.push({ name: t.key, line: t.line, deps });
    }
    return out;
}

export const isMakefileName = (n: string): boolean => n === 'Makefile' || n === 'makefile' || n === 'GNUmakefile' || n.endsWith('.mk');
export const isTaskfileName = (n: string): boolean => /^[Tt]askfile(\.dist)?\.ya?ml$/.test(n);
