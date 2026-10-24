/**
 * Python, Go, Java and C# extraction — the same shape `extract.ts` emits for
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

/** The name a C# type expression names: `List<User>` → `List`, `A.B` → `B`. */
function csType(n: TsNode): string {
    if (n.type === 'generic_name') return text(namedChildren(n).find((c) => c.type === 'identifier'));
    if (n.type === 'qualified_name') return lastSegment(n.text.replace(/<.*$/, ''));
    return n.text.replace(/<.*$/, '');
}

export function extractCSharp(root: TsNode, file: string, out: FileExtract): void {
    out.nodes.push({ id: file, label: file, kind: 'file', source_file: file, source_location: [] });
    const TYPES: Record<string, 'class' | 'interface' | 'enum'> = {
        class_declaration: 'class',
        record_declaration: 'class',
        struct_declaration: 'class',
        interface_declaration: 'interface',
        enum_declaration: 'enum',
    };
    const namespaces: string[] = [];
    const typeNamespaces: Record<string, string> = {};
    /** Every project-type name a type expression mentions: `List<Order>` names `List` and `Order`; `int` names none. */
    const typeNames = (t: TsNode | null, acc: string[] = []): string[] => {
        if (!t || t.type === 'predefined_type') return acc;
        if (t.type === 'identifier' || t.type === 'qualified_name') return [...acc, csType(t)];
        if (t.type === 'generic_name') acc.push(csType(t));
        for (const c of namedChildren(t)) if (t.type !== 'generic_name' || c.type === 'type_argument_list') acc = typeNames(c, acc);
        return acc;
    };
    const usesTypes = (sourceId: string, t: TsNode | null): void => {
        for (const nm of new Set(typeNames(t))) out.rawEdges.push({ sourceId, relation: 'uses', targetName: nm, confidenceHint: 'EXTRACTED' });
    };
    const walk = (n: TsNode, classId: string | null, scopeId: string, ns = ''): void => {
        const kind = TYPES[n.type];
        if (kind) {
            const nm = nameField(n) ?? '<anon>';
            const id = uniq(out, classId ? `${classId}::${nm}` : `${file}#${nm}`);
            out.nodes.push({ id, label: nm, kind, source_file: file, source_location: loc(n) });
            if (!classId && ns) typeNamespaces[id] = ns;
            out.rawEdges.push({ sourceId: classId ?? file, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
            for (const c of namedChildren(n)) {
                if (c.type !== 'base_list') continue;
                for (const t of namedChildren(c)) {
                    if (t.type === 'identifier' || t.type === 'generic_name' || t.type === 'qualified_name') {
                        out.inherits.push({ classId: id, parentName: csType(t) });
                    }
                }
            }
            for (const c of namedChildren(n)) if (c.type === 'declaration_list') for (const d of namedChildren(c)) walk(d, id, id, ns);
            return;
        }
        switch (n.type) {
            case 'namespace_declaration':
            case 'file_scoped_namespace_declaration': {
                const name = n.childForFieldName('name');
                const inner = ns ? `${ns}.${text(name)}` : text(name);
                if (name && !namespaces.includes(inner)) namespaces.push(inner);
                const body = n.childForFieldName('body') ?? n;
                for (const c of namedChildren(body)) if (!same(c, name)) walk(c, classId, scopeId, inner);
                return;
            }
            case 'using_directive': {
                const parts = namedChildren(n);
                const spec = parts.find((c) => c.type === 'qualified_name' || c.type === 'identifier');
                const target = parts.filter((c) => c.type === 'qualified_name' || c.type === 'identifier').pop();
                if (spec && target) {
                    const aliased = parts.some((c) => c.type === 'name_equals') || n.text.includes('=');
                    out.rawEdges.push({
                        sourceId: file,
                        relation: 'imports',
                        targetName: lastSegment(target.text),
                        confidenceHint: 'EXTRACTED',
                        moduleSpecifier: target.text,
                        importKind: 'namespace',
                        ...(aliased && spec !== target ? { localName: spec.text } : {}),
                    });
                }
                return;
            }
            case 'field_declaration':
            case 'property_declaration': {
                const decl = n.type === 'field_declaration' ? namedChildren(n).find((c) => c.type === 'variable_declaration') : n;
                if (classId) usesTypes(classId, decl?.childForFieldName('type') ?? null);
                break;
            }
            case 'method_declaration':
            case 'constructor_declaration': {
                const nm = nameField(n) ?? '<anon>';
                const id = uniq(out, classId ? `${classId}::${nm}` : `${file}#${nm}`);
                out.nodes.push({ id, label: nm, kind: 'method', source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: classId ?? file, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
                usesTypes(id, n.childForFieldName('returns') ?? n.childForFieldName('type'));
                for (const c of namedChildren(n))
                    if (c.type === 'parameter_list') for (const p of namedChildren(c)) if (p.type === 'parameter') usesTypes(id, p.childForFieldName('type'));
                for (const c of namedChildren(n)) if (c.type === 'block' || c.type === 'arrow_expression_clause') walk(c, classId, id, ns);
                return;
            }
            case 'invocation_expression': {
                const fn = n.childForFieldName('function');
                const ctx = classId ? { enclosingClassId: classId } : {};
                if (fn && (fn.type === 'identifier' || fn.type === 'generic_name')) {
                    out.rawEdges.push({ sourceId: scopeId, relation: 'calls', targetName: csType(fn), confidenceHint: classId ? 'INFERRED' : 'AMBIGUOUS', callStyle: 'this', ...ctx });
                } else if (fn && fn.type === 'member_access_expression') {
                    const obj = fn.childForFieldName('expression');
                    const nm = csType(fn.childForFieldName('name') ?? fn);
                    if (obj && (obj.type === 'this_expression' || obj.type === 'base_expression')) {
                        out.rawEdges.push({ sourceId: scopeId, relation: 'calls', targetName: nm, confidenceHint: classId ? 'INFERRED' : 'AMBIGUOUS', callStyle: obj.type === 'base_expression' ? 'parent' : 'this', ...ctx });
                    } else if (obj && obj.type === 'identifier' && /^[A-Z]/.test(obj.text)) {
                        out.rawEdges.push({ sourceId: scopeId, relation: 'calls', targetName: nm, confidenceHint: 'AMBIGUOUS', callStyle: 'scoped', scopeName: obj.text, ...ctx });
                    } else {
                        out.rawEdges.push({ sourceId: scopeId, relation: 'calls', targetName: nm, confidenceHint: 'AMBIGUOUS', callStyle: 'dynamic', ...ctx });
                    }
                }
                break;
            }
            case 'object_creation_expression': {
                const t = n.childForFieldName('type');
                if (t) out.rawEdges.push({ sourceId: scopeId, relation: 'calls', targetName: csType(t), confidenceHint: 'EXTRACTED', callStyle: 'new' });
                break;
            }
            default:
                break;
        }
        for (const c of namedChildren(n)) walk(c, classId, scopeId, ns);
    };
    walk(root, null, file);
    out.namespaces = namespaces;
    out.typeNamespaces = typeNamespaces;
}
