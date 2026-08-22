/**
 * Per-file extraction — WASM tree-sitter, LLM-free, deterministic.
 *
 * Emits definition nodes and *raw* edges; the second pass in `build.ts`
 * resolves raw-edge targets against the whole-repo symbol table and finalises
 * the honest confidence taxonomy:
 *
 *   EXTRACTED — definitions, `use`/`import`, extends/implements, trait use,
 *               `new X()`, direct free-function calls.
 *   INFERRED  — `$this->`/`self::`/`static::`/`parent::` and TS `this.`
 *               receivers resolved against the parsed class hierarchy.
 *   AMBIGUOUS — dynamic method calls, facades, scoped calls to an unresolved
 *               name: kept with candidates, never dropped. This is the
 *               expected majority for dynamic-dispatch code (Laravel etc.).
 */
import {
    type CodeNode,
    type EdgeConfidence,
    type Lang,
    MAX_FILE_BYTES,
    type Relation,
} from './types.js';
import { getParser, nodeHasError, type TsNode } from './loader.js';

export type CallStyle = 'new' | 'free' | 'this' | 'self' | 'static' | 'parent' | 'scoped' | 'dynamic';

export interface RawEdge {
    /** caller / container scope node id (method, function, class, or file). */
    sourceId: string;
    relation: Relation;
    /** bare symbol or method name to resolve in the second pass. */
    targetName: string;
    confidenceHint: EdgeConfidence;
    callStyle?: CallStyle;
    /** enclosing class id, for this/self/static/parent resolution. */
    enclosingClassId?: string;
    /** scope token for `Scope::m()` scoped calls (a class name / self / static). */
    scopeName?: string;
}

export interface FileExtract {
    file: string;
    lang: Lang;
    nodes: CodeNode[];
    rawEdges: RawEdge[];
    /** local class id → its declared parent/interface names (2nd-pass inherits). */
    inherits: Array<{ classId: string; parentName: string }>;
    parseError: boolean;
}

function loc(n: TsNode): number[] {
    return [
        n.startPosition.row + 1,
        n.startPosition.column + 1,
        n.endPosition.row + 1,
        n.endPosition.column + 1,
    ];
}

function namedChildren(n: TsNode): TsNode[] {
    const out: TsNode[] = [];
    for (let i = 0; i < n.namedChildCount; i += 1) {
        const c = n.namedChild(i);
        if (c) out.push(c);
    }
    return out;
}

/** First descendant (DFS, named) whose type is in `types`. */
function firstNamed(n: TsNode, types: ReadonlySet<string>): TsNode | null {
    for (const c of namedChildren(n)) {
        if (types.has(c.type)) return c;
        const deep = firstNamed(c, types);
        if (deep) return deep;
    }
    return null;
}

function nameField(n: TsNode): string | null {
    const nm = n.childForFieldName('name');
    if (nm) return nm.text;
    return null;
}

const NAME_TYPES = new Set(['name', 'identifier', 'qualified_name', 'type_identifier']);
/** last `\`- or `.`-separated segment of a qualified name. */
function baseName(raw: string): string {
    const s = raw.trim().replace(/^\\+/, '');
    const parts = s.split(/[\\.]/);
    return parts[parts.length - 1] ?? s;
}

// ── PHP ──────────────────────────────────────────────────────────────────────

function extractPhp(root: TsNode, file: string, out: FileExtract): void {
    const fileId = file;

    const walk = (n: TsNode, classId: string | null, scopeId: string): void => {
        switch (n.type) {
            case 'namespace_use_declaration': {
                for (const clause of namedChildren(n)) {
                    const nameNode = firstNamed(clause, new Set(['qualified_name', 'name']));
                    if (nameNode) {
                        out.rawEdges.push({
                            sourceId: fileId,
                            relation: 'imports',
                            targetName: baseName(nameNode.text),
                            confidenceHint: 'EXTRACTED',
                        });
                    }
                }
                return;
            }
            case 'class_declaration':
            case 'interface_declaration':
            case 'trait_declaration': {
                const nm = nameField(n) ?? '<anon>';
                const kind =
                    n.type === 'class_declaration'
                        ? 'class'
                        : n.type === 'interface_declaration'
                          ? 'interface'
                          : 'trait';
                const id = `${file}#${nm}`;
                out.nodes.push({ id, label: nm, kind, source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: fileId, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
                // extends / implements
                for (const c of namedChildren(n)) {
                    if (c.type === 'base_clause' || c.type === 'class_interface_clause') {
                        for (const nameNode of namedChildren(c)) {
                            if (NAME_TYPES.has(nameNode.type)) {
                                out.inherits.push({ classId: id, parentName: baseName(nameNode.text) });
                            }
                        }
                    }
                }
                for (const c of namedChildren(n)) walk(c, id, id);
                return;
            }
            case 'use_declaration': {
                // trait use inside a class body
                if (classId) {
                    for (const nameNode of namedChildren(n)) {
                        if (NAME_TYPES.has(nameNode.type)) {
                            out.rawEdges.push({
                                sourceId: classId,
                                relation: 'uses',
                                targetName: baseName(nameNode.text),
                                confidenceHint: 'EXTRACTED',
                            });
                        }
                    }
                }
                return;
            }
            case 'method_declaration':
            case 'function_definition': {
                const nm = nameField(n) ?? '<anon>';
                const id = classId ? `${classId}::${nm}` : `${file}#${nm}`;
                out.nodes.push({
                    id,
                    label: nm,
                    kind: n.type === 'method_declaration' ? 'method' : 'function',
                    source_file: file,
                    source_location: loc(n),
                });
                out.rawEdges.push({
                    sourceId: classId ?? fileId,
                    relation: 'member',
                    targetName: nm,
                    confidenceHint: 'EXTRACTED',
                });
                const body = n.childForFieldName('body');
                if (body) for (const c of namedChildren(body)) walk(c, classId, id);
                return;
            }
            case 'object_creation_expression': {
                const nameNode = firstNamed(n, new Set(['qualified_name', 'name']));
                if (nameNode)
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'calls',
                        targetName: baseName(nameNode.text),
                        confidenceHint: 'EXTRACTED',
                        callStyle: 'new',
                    });
                break;
            }
            case 'function_call_expression': {
                const fn = n.childForFieldName('function');
                if (fn && NAME_TYPES.has(fn.type))
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'calls',
                        targetName: baseName(fn.text),
                        confidenceHint: 'EXTRACTED',
                        callStyle: 'free',
                    });
                break;
            }
            case 'member_call_expression': {
                const obj = n.childForFieldName('object');
                const nm = n.childForFieldName('name');
                if (nm) {
                    const objText = obj?.text ?? '';
                    const isThis = objText === '$this';
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'calls',
                        targetName: nm.text,
                        confidenceHint: isThis && classId ? 'INFERRED' : 'AMBIGUOUS',
                        callStyle: isThis ? 'this' : 'dynamic',
                        ...(classId ? { enclosingClassId: classId } : {}),
                    });
                }
                break;
            }
            case 'scoped_call_expression': {
                const scope = n.childForFieldName('scope');
                const nm = n.childForFieldName('name');
                if (nm) {
                    const scopeText = scope?.text ?? '';
                    const isSelf = /^(self|static|parent)$/.test(scopeText);
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'calls',
                        targetName: nm.text,
                        confidenceHint: isSelf && classId ? 'INFERRED' : 'AMBIGUOUS',
                        callStyle: isSelf ? (scopeText as CallStyle) : 'scoped',
                        ...(classId ? { enclosingClassId: classId } : {}),
                        ...(isSelf ? {} : { scopeName: baseName(scopeText) }),
                    });
                }
                break;
            }
            default:
                break;
        }
        for (const c of namedChildren(n)) walk(c, classId, scopeId);
    };

    out.nodes.push({ id: fileId, label: file, kind: 'file', source_file: file, source_location: [] });
    walk(root, null, fileId);
}

// ── TypeScript / JavaScript ───────────────────────────────────────────────────

function extractTsJs(root: TsNode, file: string, out: FileExtract): void {
    const fileId = file;

    const walk = (n: TsNode, classId: string | null, scopeId: string): void => {
        switch (n.type) {
            case 'import_statement': {
                const clause = firstNamed(n, new Set(['import_clause']));
                if (clause) {
                    for (const spec of namedChildren(clause)) {
                        for (const idn of [spec, ...namedChildren(spec)])
                            if (idn.type === 'identifier' || idn.type === 'import_specifier') {
                                const nm = idn.type === 'import_specifier' ? nameField(idn) ?? idn.text : idn.text;
                                out.rawEdges.push({
                                    sourceId: fileId,
                                    relation: 'imports',
                                    targetName: baseName(nm),
                                    confidenceHint: 'EXTRACTED',
                                });
                            }
                    }
                }
                return;
            }
            case 'class_declaration': {
                const nm = nameField(n) ?? '<anon>';
                const id = `${file}#${nm}`;
                out.nodes.push({ id, label: nm, kind: 'class', source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: fileId, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
                const heritage = firstNamed(n, new Set(['class_heritage']));
                if (heritage)
                    for (const cl of namedChildren(heritage))
                        for (const idn of namedChildren(cl))
                            if (idn.type === 'identifier' || idn.type === 'type_identifier')
                                out.inherits.push({ classId: id, parentName: baseName(idn.text) });
                const body = n.childForFieldName('body');
                if (body) for (const c of namedChildren(body)) walk(c, id, id);
                return;
            }
            case 'method_definition': {
                const nm = nameField(n) ?? '<anon>';
                const id = classId ? `${classId}::${nm}` : `${file}#${nm}`;
                out.nodes.push({ id, label: nm, kind: 'method', source_file: file, source_location: loc(n) });
                out.rawEdges.push({
                    sourceId: classId ?? fileId,
                    relation: 'member',
                    targetName: nm,
                    confidenceHint: 'EXTRACTED',
                });
                const body = n.childForFieldName('body');
                if (body) for (const c of namedChildren(body)) walk(c, classId, id);
                return;
            }
            case 'function_declaration': {
                const nm = nameField(n) ?? '<anon>';
                const id = `${file}#${nm}`;
                out.nodes.push({ id, label: nm, kind: 'function', source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: fileId, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
                const body = n.childForFieldName('body');
                if (body) for (const c of namedChildren(body)) walk(c, classId, id);
                return;
            }
            // Modern TS declares most of its functions as bindings, not as
            // `function` statements. Before this case the extractor produced
            // NO node for `export const f = () => {}` or
            // `const g = function () {}`, which is the measured cause of the
            // 170-vs-13,428 TS/PHP symbol gap: the six handled kinds simply do
            // not cover the dominant declaration form.
            //
            // Scoped deliberately to bindings whose value IS a function. A
            // `const x = 3` is data, not a symbol this graph answers questions
            // about, and emitting a node per constant would inflate the count
            // without improving recall — which is the cosmetic-improvement
            // failure the phase falsifier exists to catch.
            case 'lexical_declaration':
            case 'variable_declaration': {
                for (const d of namedChildren(n)) {
                    if (d.type !== 'variable_declarator') continue;
                    const value = d.childForFieldName('value');
                    if (!value || (value.type !== 'arrow_function' && value.type !== 'function_expression')) {
                        continue;
                    }
                    const nm = nameField(d) ?? '<anon>';
                    const id = classId ? `${classId}::${nm}` : `${file}#${nm}`;
                    out.nodes.push({
                        id,
                        label: nm,
                        kind: classId ? 'method' : 'function',
                        source_file: file,
                        source_location: loc(d),
                    });
                    out.rawEdges.push({
                        sourceId: classId ?? fileId,
                        relation: 'member',
                        targetName: nm,
                        confidenceHint: 'EXTRACTED',
                    });
                    // Walk the body under the BINDING's scope, so a call inside
                    // an arrow function attributes to that function rather than
                    // to the enclosing file — the same treatment
                    // `function_declaration` gets.
                    //
                    // `walk(body)` and not `namedChildren(body)`: an
                    // expression-bodied arrow (`() => helper()`) has the CALL
                    // itself as its body, so descending one level first steps
                    // straight past it and the edge is lost. The sibling cases
                    // can iterate children because a `statement_block` is never
                    // the interesting node; here it often is.
                    const body = value.childForFieldName('body');
                    if (body) walk(body, classId, id);
                }
                // Non-function declarators still need walking for their calls.
                for (const d of namedChildren(n)) {
                    if (d.type !== 'variable_declarator') continue;
                    const value = d.childForFieldName('value');
                    if (value && (value.type === 'arrow_function' || value.type === 'function_expression')) {
                        continue;
                    }
                    walk(d, classId, scopeId);
                }
                return;
            }
            // `class C { m = () => 1 }` — a class property holding a function.
            // Emitted as a `method`, the same kind `method_definition` emits,
            // because it is one to every caller.
            case 'public_field_definition': {
                const value = n.childForFieldName('value');
                const nm = nameField(n) ?? '<anon>';
                if (value && (value.type === 'arrow_function' || value.type === 'function_expression')) {
                    const id = classId ? `${classId}::${nm}` : `${file}#${nm}`;
                    out.nodes.push({
                        id,
                        label: nm,
                        kind: 'method',
                        source_file: file,
                        source_location: loc(n),
                    });
                    out.rawEdges.push({
                        sourceId: classId ?? fileId,
                        relation: 'member',
                        targetName: nm,
                        confidenceHint: 'EXTRACTED',
                    });
                    const body = value.childForFieldName('body');
                    if (body) walk(body, classId, id);
                    return;
                }
                break;
            }
            case 'new_expression': {
                const ctor = n.childForFieldName('constructor');
                if (ctor && (ctor.type === 'identifier' || ctor.type === 'type_identifier' || ctor.type === 'member_expression'))
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'calls',
                        targetName: baseName(ctor.text.split('.').pop() ?? ctor.text),
                        confidenceHint: 'EXTRACTED',
                        callStyle: 'new',
                    });
                break;
            }
            case 'call_expression': {
                const fn = n.childForFieldName('function');
                if (fn) {
                    if (fn.type === 'identifier') {
                        out.rawEdges.push({
                            sourceId: scopeId,
                            relation: 'calls',
                            targetName: fn.text,
                            confidenceHint: 'EXTRACTED',
                            callStyle: 'free',
                        });
                    } else if (fn.type === 'member_expression') {
                        const obj = fn.childForFieldName('object');
                        const prop = fn.childForFieldName('property');
                        if (prop) {
                            const isThis = obj?.type === 'this';
                            out.rawEdges.push({
                                sourceId: scopeId,
                                relation: 'calls',
                                targetName: prop.text,
                                confidenceHint: isThis && classId ? 'INFERRED' : 'AMBIGUOUS',
                                callStyle: isThis ? 'this' : 'dynamic',
                                ...(classId ? { enclosingClassId: classId } : {}),
                            });
                        }
                    }
                }
                break;
            }
            default:
                break;
        }
        for (const c of namedChildren(n)) walk(c, classId, scopeId);
    };

    out.nodes.push({ id: fileId, label: file, kind: 'file', source_file: file, source_location: [] });
    walk(root, null, fileId);
}

/**
 * Extract one file. `source` is the file's UTF-8 content; `relPath` is the
 * repo-relative POSIX path used to build collision-free node ids.
 */
export async function extractFile(relPath: string, source: string, lang: Lang): Promise<FileExtract> {
    const out: FileExtract = { file: relPath, lang, nodes: [], rawEdges: [], inherits: [], parseError: false };
    if (Buffer.byteLength(source, 'utf-8') > MAX_FILE_BYTES) {
        out.nodes.push({
            id: relPath,
            label: relPath,
            kind: 'skipped',
            source_file: relPath,
            source_location: [],
        });
        return out;
    }
    const parser = await getParser(lang);
    const tree = parser.parse(source);
    try {
        out.parseError = nodeHasError(tree.rootNode);
        if (lang === 'php') extractPhp(tree.rootNode, relPath, out);
        else extractTsJs(tree.rootNode, relPath, out);
    } finally {
        tree.delete(); // delete the tree, never the cached parser (loader.ts)
    }
    return out;
}
