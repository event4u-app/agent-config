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
    /**
     * `imports` only: the module specifier as written (`'./types.js'`,
     * `'node:path'`), stripped of its quotes.
     *
     * Before this field the extractor read the import CLAUSE and threw the
     * `from` away, so the build pass had nothing to resolve against but a
     * repo-wide same-name table — which is how `import * as path from
     * 'node:path'` came to bind to this repository's own `path()` function in
     * `query.ts`, at `EXTRACTED`, in four of eleven files. The specifier is the
     * one piece of evidence that says WHERE the name came from, and it is in
     * the source text; discarding it turned a syntactic fact into a guess.
     *
     * Absent for PHP `use`, which names a fully-qualified symbol rather than a
     * module path — those still resolve by name, and the build pass labels them
     * accordingly.
     */
    moduleSpecifier?: string;
    /**
     * `imports` only: which import form produced this binding. `namespace`
     * (`import * as x`) and `default` bind the MODULE (or its default export),
     * never a named export, so neither may be matched against a same-named
     * symbol inside the target file.
     */
    importKind?: 'namespace' | 'named' | 'default';
    /**
     * `imports` only: the LOCAL binding name, when it differs from
     * `targetName` (`import { foo as bar }` → targetName `foo`, localName
     * `bar`). The file's scope is keyed on the local name; the target file is
     * searched for the remote one.
     */
    localName?: string;
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

/**
 * Node types that open a new function or class scope. A `const` inside one of
 * these is a LOCAL variable, not a module-level declaration, and emitting a
 * node for it would put every loop counter in the symbol table — the
 * count-inflation failure `2.1` is explicitly not allowed to cause.
 */
const TS_SCOPE_INTRODUCERS = new Set([
    'arrow_function',
    'function_expression',
    'function_declaration',
    'generator_function',
    'generator_function_declaration',
    'method_definition',
    'class_declaration',
    'class',
    'class_body',
]);

function extractTsJs(root: TsNode, file: string, out: FileExtract): void {
    const fileId = file;

    const walk = (n: TsNode, classId: string | null, scopeId: string, topLevel: boolean): void => {
        // A declaration is module-level until the walk descends through a
        // function or class scope; from there down it is a local.
        const inner = topLevel && !TS_SCOPE_INTRODUCERS.has(n.type);
        switch (n.type) {
            case 'import_statement': {
                const src = n.childForFieldName('source');
                // The specifier node is a `string`; its text carries the quotes.
                const specifier = src ? src.text.replace(/^['"`]/, '').replace(/['"`]$/, '') : undefined;
                const clause = firstNamed(n, new Set(['import_clause']));
                const emitImport = (
                    remote: string,
                    local: string,
                    importKind: 'namespace' | 'named' | 'default',
                ): void => {
                    out.rawEdges.push({
                        sourceId: fileId,
                        relation: 'imports',
                        targetName: baseName(remote),
                        confidenceHint: 'EXTRACTED',
                        ...(specifier === undefined ? {} : { moduleSpecifier: specifier }),
                        importKind,
                        ...(local === remote ? {} : { localName: local }),
                    });
                };
                if (clause) {
                    for (const child of namedChildren(clause)) {
                        if (child.type === 'namespace_import') {
                            // `import * as path from 'node:path'` — the binding
                            // is the MODULE. Matching `path` against a local
                            // symbol of the same name is the false edge 1.1
                            // exists to remove.
                            const idn = firstNamed(child, new Set(['identifier']));
                            if (idn) emitImport(idn.text, idn.text, 'namespace');
                        } else if (child.type === 'named_imports') {
                            for (const sp of namedChildren(child)) {
                                if (sp.type !== 'import_specifier') continue;
                                const nameNode = sp.childForFieldName('name');
                                const aliasNode = sp.childForFieldName('alias');
                                const remote = nameNode ? nameNode.text : sp.text;
                                emitImport(remote, aliasNode ? aliasNode.text : remote, 'named');
                            }
                        } else if (child.type === 'identifier') {
                            emitImport(child.text, child.text, 'default');
                        }
                    }
                }
                return;
            }
            // `const`, `type`, `interface`, `enum` — the shapes the v2 corpus
            // asks `references` questions about (`EXT_LANG` is a const,
            // `SettingsClass` a type alias). The extractor used to emit none of
            // them, which is the named mechanical cause of `references` recall
            // 0.333 against grep's 1.000.
            //
            // The body is not walked: a type or interface position holds no
            // call sites, and an enum body holds member names rather than
            // symbols this graph answers questions about.
            case 'interface_declaration':
            case 'type_alias_declaration':
            case 'enum_declaration': {
                const nmNode = n.childForFieldName('name') ?? firstNamed(n, NAME_TYPES);
                const nm = nmNode ? nmNode.text : '<anon>';
                const kind =
                    n.type === 'interface_declaration'
                        ? 'interface'
                        : n.type === 'type_alias_declaration'
                          ? 'type'
                          : 'enum';
                const id = `${file}#${nm}`;
                out.nodes.push({ id, label: nm, kind, source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: fileId, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
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
                if (body) for (const c of namedChildren(body)) walk(c, id, id, false);
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
                if (body) for (const c of namedChildren(body)) walk(c, classId, id, false);
                return;
            }
            case 'function_declaration': {
                const nm = nameField(n) ?? '<anon>';
                const id = `${file}#${nm}`;
                out.nodes.push({ id, label: nm, kind: 'function', source_file: file, source_location: loc(n) });
                out.rawEdges.push({ sourceId: fileId, relation: 'member', targetName: nm, confidenceHint: 'EXTRACTED' });
                const body = n.childForFieldName('body');
                if (body) for (const c of namedChildren(body)) walk(c, classId, id, false);
                return;
            }
            // Modern TS declares most of its functions as bindings, not as
            // `function` statements. Before this case the extractor produced
            // NO node for `export const f = () => {}` or
            // `const g = function () {}`, which is the measured cause of the
            // 170-vs-13,428 TS/PHP symbol gap: the six handled kinds simply do
            // not cover the dominant declaration form.
            //
            // The scoping note that stood here said a `const x = 3` is "data,
            // not a symbol this graph answers questions about", and that
            // emitting a node per constant would raise the count without
            // improving recall. **The v2 benchmark falsified the first half and
            // the second half no longer follows.** Two of its three
            // `references` questions probe exactly this shape — `EXT_LANG` (a
            // const) and `SettingsClass` (a type alias) — and the class scored
            // recall 0.333 against grep's 1.000 because neither had a node to
            // resolve to. The count-inflation worry was real and is answered by
            // SCOPE rather than by refusal: a binding earns a node only at
            // MODULE level (`topLevel`), so a loop counter inside a function
            // body still gets none. The reason is kept rather than deleted,
            // because a reversed decision whose reason disappears gets re-taken.
            case 'lexical_declaration':
            case 'variable_declaration': {
                for (const d of namedChildren(n)) {
                    if (d.type !== 'variable_declarator') continue;
                    const value = d.childForFieldName('value');
                    const nmNode = d.childForFieldName('name');
                    const isFn =
                        value !== null &&
                        value !== undefined &&
                        (value.type === 'arrow_function' || value.type === 'function_expression');
                    const isClassExpr = value?.type === 'class';
                    if (!isFn) {
                        // Only a plain `identifier` name: a destructuring
                        // pattern (`const { a, b } = x`) binds several names and
                        // none of them is a declaration this graph can id.
                        if (topLevel && nmNode?.type === 'identifier') {
                            const nm = nmNode.text;
                            const id = classId ? `${classId}::${nm}` : `${file}#${nm}`;
                            out.nodes.push({
                                id,
                                label: nm,
                                // `const Widget = class {}` IS constructible;
                                // calling it a constant would let the build pass
                                // reject a `new Widget()` that is perfectly real.
                                kind: isClassExpr ? 'class' : 'constant',
                                source_file: file,
                                source_location: loc(d),
                            });
                            out.rawEdges.push({
                                sourceId: classId ?? fileId,
                                relation: 'member',
                                targetName: nm,
                                confidenceHint: 'EXTRACTED',
                            });
                        }
                        // Non-function declarators still need walking for their
                        // calls — returning early on the whole declaration
                        // silently drops call edges from initialisers.
                        walk(d, classId, scopeId, inner);
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
                    if (body) walk(body, classId, id, false);
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
                    if (body) walk(body, classId, id, false);
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
            // A static registry literal — `const registry = { foo: handleFoo }`.
            //
            // road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh 1.3.
            // Before this, such a table produced NO edge at all: the value is an
            // identifier reference rather than a call, so nothing in the walker
            // saw it, and every dispatch table in the tree was invisible to the
            // graph. That is a real gap rather than an honest absence — the
            // reference is statically resolvable, with no inference involved.
            //
            // Scope is deliberately the shape that needs no inference: a
            // shorthand or `key: identifier` property whose value is a bare
            // identifier. A computed key, a call, an arrow function or a spread
            // is left alone, because resolving those DOES need inference and
            // guessing there is how the arbitrary-winner defect 1.2 removed got
            // in. Emitted as `references` rather than `calls`, because a table
            // naming a handler is not a call site — the call happens wherever
            // the table is looked up, and claiming otherwise would assert a
            // control-flow edge that does not exist. `uses` is the existing
            // relation for exactly that, so the union is not widened — a new
            // relation would be a schema change reaching the validator, the
            // query surface and every consumer, for a distinction `uses`
            // already draws.
            case 'pair':
            case 'shorthand_property_identifier': {
                if (n.type === 'shorthand_property_identifier') {
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'uses',
                        targetName: n.text,
                        confidenceHint: 'EXTRACTED',
                    });
                    break;
                }
                const val = n.childForFieldName('value');
                if (val?.type === 'identifier') {
                    out.rawEdges.push({
                        sourceId: scopeId,
                        relation: 'uses',
                        targetName: val.text,
                        confidenceHint: 'EXTRACTED',
                    });
                }
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
        for (const c of namedChildren(n)) walk(c, classId, scopeId, inner);
    };

    out.nodes.push({ id: fileId, label: file, kind: 'file', source_file: file, source_location: [] });
    walk(root, null, fileId, true);
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
