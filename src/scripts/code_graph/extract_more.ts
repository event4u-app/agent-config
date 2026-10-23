/**
 * Python, Go and Java extraction — the same shape `extract.ts` emits for
 * PHP / TS / JS, so the build pass resolves them with no language branch
 * beyond module lookup.
 *
 *   definitions   classes / interfaces / structs, functions, methods
 *   imports       with the module as written, for `build.ts` to map to a file
 *   inherits      superclasses, implemented interfaces
 *   calls         free calls, `self.` / `this.` calls on the enclosing class,
 *                 `X.m()` scoped calls, `new X()`, and dynamic member calls
 */
import { type FileExtract, loc, namedChildren, nameField, uniq } from './extract.js';
import type { TsNode } from './loader.js';

function text(n: TsNode | null | undefined): string {
    return n ? n.text : '';
}

/** Every descendant of `type`, document order. */
function descendants(n: TsNode, type: string): TsNode[] {
    const out: TsNode[] = [];
    const visit = (x: TsNode): void => {
        for (const c of namedChildren(x)) {
            if (c.type === type) out.push(c);
            visit(c);
        }
    };
    visit(n);
    return out;
}

/** Node identity: the runtime hands out a fresh wrapper per access. */
function same(a: TsNode | null, b: TsNode | null): boolean {
    return (
        a !== null &&
        b !== null &&
        a.type === b.type &&
        a.startPosition.row === b.startPosition.row &&
        a.startPosition.column === b.startPosition.column
    );
}

function lastSegment(dotted: string): string {
    const parts = dotted.split(/[./]/);
    return parts[parts.length - 1] ?? dotted;
}

export function extractPython(root: TsNode, file: string, out: FileExtract): void {
    out.nodes.push({ id: file, label: file, kind: 'file', source_file: file, source_location: [] });
    const walk = (n: TsNode, classId: string | null, scopeId: string): void => {
        switch (n.type) {
            case 'import_statement': {
                for (const c of namedChildren(n)) {
                    const dotted = c.type === 'aliased_import' ? c.childForFieldName('name') : c;
                    const alias = c.type === 'aliased_import' ? text(c.childForFieldName('alias')) : '';
                    const spec = text(dotted);
                    if (!spec) continue;
                    out.rawEdges.push({
                        sourceId: file,
                        relation: 'imports',
                        targetName: lastSegment(spec),
                        confidenceHint: 'EXTRACTED',
                        moduleSpecifier: spec,
                        importKind: 'namespace',
                        localName: alias || (spec.split('.')[0] as string),
                    });
                }
                return;
            }
            case 'import_from_statement': {
                const mod = text(n.childForFieldName('module_name'));
                for (const c of namedChildren(n)) {
                    if (same(c, n.childForFieldName('module_name'))) continue;
                    if (c.type !== 'dotted_name' && c.type !== 'aliased_import') continue;
                    const name = c.type === 'aliased_import' ? text(c.childForFieldName('name')) : text(c);
                    const alias = c.type === 'aliased_import' ? text(c.childForFieldName('alias')) : '';
                    out.rawEdges.push({
                        sourceId: file,
                        relation: 'imports',
                        targetName: name,
                        confidenceHint: 'EXTRACTED',
                        moduleSpecifier: mod,
                        importKind: 'named',
                        ...(alias ? { localName: alias } : {}),
                    });
                }
                return;
            }
            case 'class_definition': {
                const nm = nameField(n) ?? '<anon>';
                const id = uniq(out, `${file}#${nm}`);
                out.nodes.push({ id, label: nm, kind: 'class', source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: file, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
                const supers = n.childForFieldName('superclasses');
                if (supers)
                    for (const s of namedChildren(supers))
                        if (s.type === 'identifier' || s.type === 'attribute') out.inherits.push({ classId: id, parentName: lastSegment(s.text) });
                const body = n.childForFieldName('body');
                if (body) for (const c of namedChildren(body)) walk(c, id, id);
                return;
            }
            case 'function_definition': {
                const nm = nameField(n) ?? '<anon>';
                const id = uniq(out, classId ? `${classId}::${nm}` : `${file}#${nm}`);
                out.nodes.push({ id, label: nm, kind: classId ? 'method' : 'function', source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: classId ?? file, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
                const body = n.childForFieldName('body');
                // A nested def is a local helper: its calls belong to it, and it
                // no longer sees the class as `self`.
                if (body) for (const c of namedChildren(body)) walk(c, null, id);
                return;
            }
            case 'call': {
                const fn = n.childForFieldName('function');
                if (fn?.type === 'identifier') {
                    out.rawEdges.push({ sourceId: scopeId, relation: 'calls', targetName: fn.text, confidenceHint: 'EXTRACTED', callStyle: 'free' });
                } else if (fn?.type === 'attribute') {
                    const obj = fn.childForFieldName('object');
                    const attr = text(fn.childForFieldName('attribute'));
                    const isSelf = obj?.type === 'identifier' && (obj.text === 'self' || obj.text === 'cls');
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'calls',
                        targetName: attr,
                        confidenceHint: isSelf && classId ? 'INFERRED' : 'AMBIGUOUS',
                        callStyle: isSelf ? 'this' : 'dynamic',
                        ...(classId ? { enclosingClassId: classId } : {}),
                    });
                }
                break;
            }
            default:
                break;
        }
        for (const c of namedChildren(n)) walk(c, classId, scopeId);
    };
    walk(root, null, file);
}

export function extractJava(root: TsNode, file: string, out: FileExtract): void {
    out.nodes.push({ id: file, label: file, kind: 'file', source_file: file, source_location: [] });
    const TYPES: Record<string, 'class' | 'interface' | 'enum'> = {
        class_declaration: 'class',
        record_declaration: 'class',
        interface_declaration: 'interface',
        enum_declaration: 'enum',
    };
    const walk = (n: TsNode, classId: string | null, scopeId: string): void => {
        const kind = TYPES[n.type];
        if (kind) {
            const nm = nameField(n) ?? '<anon>';
            const id = uniq(out, classId ? `${classId}::${nm}` : `${file}#${nm}`);
            out.nodes.push({ id, label: nm, kind, source_file: file, source_location: loc(n) });
            out.rawEdges.push({ sourceId: classId ?? file, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
            for (const c of namedChildren(n)) {
                if (c.type === 'superclass' || c.type === 'super_interfaces' || c.type === 'extends_interfaces') {
                    for (const t of descendants(c, 'type_identifier')) out.inherits.push({ classId: id, parentName: t.text });
                }
            }
            const body = n.childForFieldName('body');
            if (body) for (const c of namedChildren(body)) walk(c, id, id);
            return;
        }
        switch (n.type) {
            case 'import_declaration': {
                const spec = namedChildren(n).find((c) => c.type === 'scoped_identifier' || c.type === 'identifier');
                if (spec && !n.text.includes('*')) {
                    out.rawEdges.push({
                        sourceId: file,
                        relation: 'imports',
                        targetName: lastSegment(spec.text),
                        confidenceHint: 'EXTRACTED',
                        moduleSpecifier: spec.text,
                        importKind: 'named',
                    });
                }
                return;
            }
            case 'method_declaration':
            case 'constructor_declaration': {
                const nm = nameField(n) ?? '<anon>';
                const id = uniq(out, classId ? `${classId}::${nm}` : `${file}#${nm}`);
                out.nodes.push({ id, label: nm, kind: 'method', source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: classId ?? file, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
                const body = n.childForFieldName('body');
                if (body) for (const c of namedChildren(body)) walk(c, classId, id);
                return;
            }
            case 'method_invocation': {
                const obj = n.childForFieldName('object');
                const nm = text(n.childForFieldName('name'));
                if (!obj || obj.type === 'this') {
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'calls',
                        targetName: nm,
                        confidenceHint: classId ? 'INFERRED' : 'AMBIGUOUS',
                        callStyle: 'this',
                        ...(classId ? { enclosingClassId: classId } : {}),
                    });
                } else if (obj.type === 'identifier' && /^[A-Z]/.test(obj.text)) {
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'calls',
                        targetName: nm,
                        confidenceHint: 'AMBIGUOUS',
                        callStyle: 'scoped',
                        scopeName: obj.text,
                        ...(classId ? { enclosingClassId: classId } : {}),
                    });
                } else {
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'calls',
                        targetName: nm,
                        confidenceHint: 'AMBIGUOUS',
                        callStyle: 'dynamic',
                        ...(classId ? { enclosingClassId: classId } : {}),
                    });
                }
                break;
            }
            case 'object_creation_expression': {
                const t = n.childForFieldName('type');
                if (t) out.rawEdges.push({ sourceId: scopeId, relation: 'calls', targetName: lastSegment(t.text.replace(/<.*$/, '')), confidenceHint: 'EXTRACTED', callStyle: 'new' });
                break;
            }
            default:
                break;
        }
        for (const c of namedChildren(n)) walk(c, classId, scopeId);
    };
    walk(root, null, file);
}

export function extractGo(root: TsNode, file: string, out: FileExtract): void {
    out.nodes.push({ id: file, label: file, kind: 'file', source_file: file, source_location: [] });
    const walk = (n: TsNode, scopeId: string): void => {
        switch (n.type) {
            case 'import_spec': {
                const spec = text(n.childForFieldName('path')).replace(/^["`]|["`]$/g, '');
                const alias = text(n.childForFieldName('name'));
                if (spec && alias !== '_') {
                    out.rawEdges.push({
                        sourceId: file,
                        relation: 'imports',
                        targetName: lastSegment(spec),
                        confidenceHint: 'EXTRACTED',
                        moduleSpecifier: spec,
                        importKind: 'namespace',
                        ...(alias && alias !== '.' ? { localName: alias } : {}),
                    });
                }
                return;
            }
            case 'type_spec': {
                const nm = text(n.childForFieldName('name'));
                const t = n.childForFieldName('type');
                const kind = t?.type === 'interface_type' ? 'interface' : t?.type === 'struct_type' ? 'class' : 'type';
                const id = uniq(out, `${file}#${nm}`);
                out.nodes.push({ id, label: nm, kind, source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: file, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
                return;
            }
            case 'function_declaration': {
                const nm = nameField(n) ?? '<anon>';
                const id = uniq(out, `${file}#${nm}`);
                out.nodes.push({ id, label: nm, kind: 'function', source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: file, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
                const body = n.childForFieldName('body');
                if (body) walk(body, id);
                return;
            }
            case 'method_declaration': {
                const nm = nameField(n) ?? '<anon>';
                const recv = n.childForFieldName('receiver');
                const typeName = recv ? (descendants(recv, 'type_identifier')[0]?.text ?? '') : '';
                const id = uniq(out, typeName ? `${file}#${typeName}::${nm}` : `${file}#${nm}`);
                out.nodes.push({ id, label: nm, kind: 'method', source_file: file, source_location: loc(n) });
                // The receiver type may be declared in another file of the
                // package, so the member link hangs off the file, named so the
                // build pass derives this method's own id from it.
                out.rawEdges.push({
                    sourceId: file,
                    relation: 'member',
                    targetName: id.slice(file.length + 1),
                    confidenceHint: 'EXTRACTED',
                });
                const body = n.childForFieldName('body');
                if (body) walk(body, id);
                return;
            }
            case 'call_expression': {
                const fn = n.childForFieldName('function');
                if (fn?.type === 'identifier') {
                    out.rawEdges.push({ sourceId: scopeId, relation: 'calls', targetName: fn.text, confidenceHint: 'EXTRACTED', callStyle: 'free' });
                } else if (fn?.type === 'selector_expression') {
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'calls',
                        targetName: text(fn.childForFieldName('field')),
                        confidenceHint: 'AMBIGUOUS',
                        callStyle: 'dynamic',
                    });
                }
                break;
            }
            default:
                break;
        }
        for (const c of namedChildren(n)) walk(c, scopeId);
    };
    walk(root, file);
}
